import { useTranslation } from "@/i18n";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import Config, { type DirectionLR, type DirectionTB, type OverlayedConfig, type PlacementAnchor } from "@/config";
import { useConfigValue } from "@/hooks/use-config-value";
import type { PlacementMonitors, PlacementPreview } from "@/hooks/use-placement";
import { cn } from "@/utils/tw";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useEffect, useRef, useState } from "react";

const anchors: PlacementAnchor[] = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

type OffsetKey = keyof PlacementPreview;

function alignmentForAnchor(anchor: PlacementAnchor): { horizontal: DirectionLR | null; vertical: DirectionTB | null } {
  let horizontal: DirectionLR | null = null;
  let vertical: DirectionTB | null = null;

  if (anchor.endsWith("-left")) {
    horizontal = "left";
  } else if (anchor.endsWith("-right")) {
    horizontal = "right";
  }

  if (anchor.startsWith("top-")) {
    vertical = "top";
  } else if (anchor.startsWith("bottom-")) {
    vertical = "bottom";
  }

  return { horizontal, vertical };
}

export const Placement = () => {
  const t = useTranslation();
  const { value: placementMode } = useConfigValue("placementMode");
  const { value: placementMonitor } = useConfigValue("placementMonitor");
  const { value: placementAnchor } = useConfigValue("placementAnchor");
  const { value: placementMarginX } = useConfigValue("placementMarginX");
  const { value: placementMarginY } = useConfigValue("placementMarginY");
  const [response, setResponse] = useState<PlacementMonitors | null>(null);
  const [error, setError] = useState<string | null>(null);
  const writes = useRef(Promise.resolve());
  const [offsets, setOffsets] = useState({ placementMarginX, placementMarginY });
  const savedOffsets = useRef({ placementMarginX, placementMarginY });
  savedOffsets.current = { placementMarginX, placementMarginY };
  const dragging = useRef<OffsetKey | null>(null);
  const awaitingCommit = useRef<PlacementPreview>({});
  const commitVersions = useRef({ placementMarginX: 0, placementMarginY: 0 });
  const pendingPreview = useRef<PlacementPreview | null>(null);
  const previewFrame = useRef(0);

  useEffect(() => {
    const saved = { placementMarginX, placementMarginY };
    const next: PlacementPreview = {};
    (["placementMarginX", "placementMarginY"] as OffsetKey[]).forEach(key => {
      if (awaitingCommit.current[key] === saved[key]) delete awaitingCommit.current[key];
      if (dragging.current !== key && awaitingCommit.current[key] === undefined) next[key] = saved[key];
    });
    setOffsets(previous => ({ ...previous, ...next }));
  }, [placementMarginX, placementMarginY]);

  useEffect(() => () => cancelAnimationFrame(previewFrame.current), []);

  const previewOffset = (key: OffsetKey, value: number) => {
    setOffsets(previous => ({ ...previous, [key]: value }));
    pendingPreview.current = { ...pendingPreview.current, [key]: value };
    if (previewFrame.current) return;
    previewFrame.current = requestAnimationFrame(() => {
      previewFrame.current = 0;
      const preview = pendingPreview.current;
      pendingPreview.current = null;
      if (preview) {
        emit("placement_preview", preview).catch(error => console.warn("Could not preview overlay placement", error));
      }
    });
  };

  useEffect(() => {
    let disposed = false;
    let latestQuery = 0;
    const refresh = async () => {
      const query = ++latestQuery;
      try {
        const value = await invoke<PlacementMonitors>("get_monitors");
        if (!disposed && query === latestQuery) {
          setResponse(value);
          setError(null);
        }
      } catch (error) {
        console.warn("Could not load placement monitors", error);
        if (!disposed && query === latestQuery) setError("Couldn't load displays. Return to this tab to try again.");
      }
    };
    refresh();
    const unlisten = getCurrentWebviewWindow().onFocusChanged(event => {
      if (event.payload) refresh();
    });
    return () => {
      disposed = true;
      unlisten.then(fn => fn());
    };
  }, []);

  const update = <K extends keyof OverlayedConfig>(key: K, value: OverlayedConfig[K]) => {
    let saved = false;
    writes.current = writes.current
      .then(async () => {
        const current = await Config.getConfig();
        if (current[key] !== value) await Config.set(key, value);
        if (
          (key === "placementAnchor" && current.placementMode === "anchored") ||
          (key === "placementMode" && value === "anchored")
        ) {
          const config = await Config.getConfig();
          const { horizontal, vertical } = alignmentForAnchor(config.placementAnchor);
          if (horizontal && config.horizontal !== horizontal) await Config.set("horizontal", horizontal);
          if (vertical && config.vertical !== vertical) await Config.set("vertical", vertical);
        }
        await emit("config_update", await Config.getConfig());
        saved = true;
        setError(null);
      })
      .catch(error => {
        console.warn("Could not save placement settings", error);
        setError("Couldn't save this setting. Try changing it again.");
      });
    return writes.current.then(() => saved);
  };

  const commitOffset = (key: OffsetKey, value: number) => {
    dragging.current = null;
    const version = ++commitVersions.current[key];
    awaitingCommit.current[key] = value;
    previewOffset(key, value);
    update(key, value).then(saved => {
      if (commitVersions.current[key] !== version) return;
      if (saved && savedOffsets.current[key] !== value) return;
      delete awaitingCommit.current[key];
      if (!saved && dragging.current !== key) previewOffset(key, savedOffsets.current[key]);
    });
  };

  const monitors = [...(response?.monitors ?? [])].sort((a, b) => a.x - b.x || a.y - b.y);
  const selected =
    monitors.find(monitor => placementMonitor !== null && monitor.name === placementMonitor) ??
    monitors.find(monitor => monitor.primary) ??
    monitors[0];
  const missing = placementMonitor !== null && !monitors.some(monitor => monitor.name === placementMonitor);
  const fixed = placementMode === "anchored" && response?.positioningSupported !== false;
  const enabled = placementMode === "anchored" && response?.positioningSupported === true;
  const anchorIndex = Math.max(0, anchors.indexOf(placementAnchor));
  const horizontal = anchorIndex % 3;
  const vertical = Math.floor(anchorIndex / 3);

  return (
    <div className="settings-stack">
      <div className="settings-row">
        <label htmlFor="fixed-position" className="font-medium">
          {t("Fixed position")}
        </label>
        <Switch
          id="fixed-position"
          checked={fixed}
          disabled={!response?.positioningSupported}
          onCheckedChange={checked => update("placementMode", checked ? "anchored" : "manual")}
        />
      </div>
      {fixed && (
        <p className="settings-hint">
          {t(
            "Fixed position applies while pinned. Use the tray icon to open settings or unpin the overlay."
          )}
        </p>
      )}
      {response?.positioningSupported === false ? (
        <p className="settings-hint">
          {t("Your desktop doesn't let apps place their own windows (Wayland). Drag the overlay instead.")}
        </p>
      ) : null}
      <div className="settings-row">
        <label htmlFor="placement-display" className="font-medium">
          {t("Display")}
        </label>
        <select
          id="placement-display"
          className="settings-select w-52"
          disabled={!enabled || !selected}
          value={selected ? String(monitors.indexOf(selected)) : ""}
          onChange={event => {
            const monitor = monitors[Number(event.target.value)];
            if (monitor) void update("placementMonitor", monitor.name || null);
          }}
        >
          {!selected && <option value="">{t("No displays found")}</option>}
          {monitors.map((monitor, index) => (
            <option key={index} value={index}>
              {t("Display")} {index + 1} - {monitor.width} × {monitor.height}
              {monitor.primary ? ` ${t("(primary)")}` : ""}
            </option>
          ))}
        </select>
      </div>
      {selected && (
        <div
          className={cn("flex items-center justify-center rounded-md bg-zinc-950 p-3", !enabled && "opacity-60")}
        >
          <fieldset
            aria-label={t("Overlay position")}
            disabled={!enabled}
            className="relative rounded-md border-2 border-sky-400 bg-zinc-800 shadow-sm shadow-sky-400/30"
            style={{
              width: Math.max(140, Math.min(390, (150 * selected.width) / selected.height)),
              height: Math.max(100, Math.min(150, (390 * selected.height) / selected.width)),
            }}
          >
            <div className="absolute inset-2 grid grid-cols-3 grid-rows-3">
              {anchors.map((anchor, index) => {
                const label = t(anchor) === anchor ? anchor.replace(/-/g, " ") : t(anchor);
                return (
                  <input
                    key={anchor}
                    type="radio"
                    name="overlay-position"
                    aria-label={label}
                    title={label}
                    checked={placementAnchor === anchor}
                    className="size-4 cursor-pointer accent-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-default"
                    style={{
                      justifySelf: ["start", "center", "end"][index % 3],
                      alignSelf: ["start", "center", "end"][Math.floor(index / 3)],
                    }}
                    onChange={() => void update("placementAnchor", anchor)}
                  />
                );
              })}
            </div>
          </fieldset>
        </div>
      )}
      <p className="settings-hint empty:hidden" aria-live="polite">
        {error
          ? t(error)
          : missing
            ? t("Saved display isn't connected. The primary display is used.")
            : !selected
              ? t(response ? "No displays found" : "Loading displays...")
              : null}
      </p>
      {[
        {
          label: "Horizontal margin",
          key: "placementMarginX" as const,
          value: offsets.placementMarginX,
          centered: horizontal === 1,
          resolution: selected?.width,
        },
        {
          label: "Vertical margin",
          key: "placementMarginY" as const,
          value: offsets.placementMarginY,
          centered: vertical === 1,
          resolution: selected?.height,
        },
      ].map(({ label, key, value, centered, resolution }) => (
        <div
          key={key}
          className={cn("settings-row", (!enabled || centered) && "opacity-40")}
        >
          <label htmlFor={key} className="font-medium">
            {t(label)}
          </label>
          <div className="flex w-1/2 items-center gap-4">
            <Slider
              id={key}
              aria-label={t(label)}
              value={[value]}
              min={0}
              max={50}
              step={0.1}
              disabled={!enabled || centered}
              onPointerDownCapture={() => {
                dragging.current = key;
              }}
              onPointerUp={() => {
                dragging.current = null;
              }}
              onPointerCancel={() => {
                dragging.current = null;
                previewOffset(key, awaitingCommit.current[key] ?? savedOffsets.current[key]);
              }}
              onValueChange={values => previewOffset(key, values[0] ?? value)}
              onValueCommit={values => commitOffset(key, values[0] ?? value)}
            />
            <span className="min-w-24 shrink-0 text-right tabular-nums">
              {value}%{resolution !== undefined && ` (${Math.round((value * resolution) / 100)} ${t("px")})`}
            </span>
          </div>
        </div>
      ))}
      <p className="settings-hint">
        {t("Drag the title bar to move the unpinned overlay.")}
      </p>
    </div>
  );
};
