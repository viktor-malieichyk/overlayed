import { useAppStore } from "@/store";
import Config, { DEFAULT_OVERLAYED_CONFIG, type OverlayedConfig, type PlacementAnchor } from "@/config";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface PlacementMonitor {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
  primary: boolean;
}

export interface PlacementMonitors {
  monitors: PlacementMonitor[];
  positioningSupported: boolean;
}

export type PlacementPreview = Partial<Pick<OverlayedConfig, "placementMarginX" | "placementMarginY">>;

interface PlacementParameters {
  monitor: string | null;
  anchor: PlacementAnchor;
  offsetX: number;
  offsetY: number;
}

interface PlacementRequest extends PlacementParameters {
  width: number;
  height: number;
}

const mainWindow = getCurrentWebviewWindow().label === "main";
// Mirrors the main window size in tauri.conf.json.
const DEFAULT_WINDOW_SIZE = { width: 420, height: 600 };
// Keeps navbar buttons above the 200px breakpoint.
const NAVBAR_MIN_WIDTH = 220;
// Small bounds for an empty voice channel.
const EMPTY_CONTENT_SIZE = { width: 64, height: 52 };
// Leaves room for fractional-DPI rounding.
const FIT_HEADROOM = 1;

export const usePlacement = (pin: boolean, pathname: string) => {
  const channelSnapshotReady = useAppStore(state => state.channelSnapshotReady);
  const rootRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<OverlayedConfig | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  // A failed config stays manual until its placement values change.
  const [failedConfig, setFailedConfig] = useState<string | null>(null);
  const parameters = useRef<PlacementParameters>({
    monitor: null,
    anchor: "top-left",
    offsetX: DEFAULT_OVERLAYED_CONFIG.placementMarginX,
    offsetY: DEFAULT_OVERLAYED_CONFIG.placementMarginY,
  });
  const previewOffsets = useRef<PlacementPreview>({});
  const savedOffsets = useRef({
    placementMarginX: DEFAULT_OVERLAYED_CONFIG.placementMarginX,
    placementMarginY: DEFAULT_OVERLAYED_CONFIG.placementMarginY,
  });
  const configSeen = useRef(false);
  // One apply runs while pending holds only the latest request or a release.
  const pending = useRef<PlacementRequest | "release" | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const scheduleRef = useRef<((force?: boolean) => void) | null>(null);
  const drainRef = useRef<() => void>(() => {});
  const allowed = useRef(false);
  const currentConfigKey = useRef("");
  // Release is idempotent; allowed blocks queued work after leaving placement.
  const released = useRef(false);
  const lastRequest = useRef<PlacementRequest | null>(null);
  const currentPin = useRef(pin);
  currentPin.current = pin;
  const lockActivation = useRef(0);
  const pendingLock = useRef<number | null>(null);
  const previousMode = useRef<OverlayedConfig["placementMode"] | null>(null);
  const pendingUnlock = useRef(false);

  const configKeyFor = (value: OverlayedConfig) =>
    JSON.stringify([
      value.placementMode,
      value.placementMonitor,
      value.placementAnchor,
      value.placementMarginX,
      value.placementMarginY,
    ]);

  useEffect(() => {
    if (!mainWindow) return;
    mounted.current = true;
    let disposed = false;
    const receiveConfig = (value: OverlayedConfig) => {
      if (disposed) return;
      if (previousMode.current === "anchored" && value.placementMode === "manual") pendingUnlock.current = true;
      if (value.placementMode === "anchored") pendingUnlock.current = false;
      previousMode.current = value.placementMode;
      savedOffsets.current = { placementMarginX: value.placementMarginX, placementMarginY: value.placementMarginY };
      if (value.placementMode === "manual") previewOffsets.current = {};
      const preview = previewOffsets.current;
      if (preview.placementMarginX === value.placementMarginX) delete preview.placementMarginX;
      if (preview.placementMarginY === value.placementMarginY) delete preview.placementMarginY;
      parameters.current = {
        monitor: value.placementMonitor,
        anchor: value.placementAnchor,
        offsetX: preview.placementMarginX ?? value.placementMarginX,
        offsetY: preview.placementMarginY ?? value.placementMarginY,
      };
      currentConfigKey.current = configKeyFor(value);
      if (value.placementMode === "manual") {
        allowed.current = false;
        pending.current = "release";
        drainRef.current();
      }
      setConfig({ ...value });
      scheduleRef.current?.();
    };
    const unlisten = listen<OverlayedConfig>("config_update", event => {
      configSeen.current = true;
      receiveConfig(event.payload);
    });
    const unlistenPreview = listen<PlacementPreview>("placement_preview", event => {
      if (disposed || !allowed.current) return;
      const { placementMarginX, placementMarginY } = event.payload;
      if (
        Number.isFinite(placementMarginX) &&
        placementMarginX !== undefined &&
        placementMarginX >= 0 &&
        placementMarginX <= 50
      ) {
        if (placementMarginX === savedOffsets.current.placementMarginX) delete previewOffsets.current.placementMarginX;
        else previewOffsets.current.placementMarginX = placementMarginX;
        parameters.current.offsetX = placementMarginX;
      }
      if (
        Number.isFinite(placementMarginY) &&
        placementMarginY !== undefined &&
        placementMarginY >= 0 &&
        placementMarginY <= 50
      ) {
        if (placementMarginY === savedOffsets.current.placementMarginY) delete previewOffsets.current.placementMarginY;
        else previewOffsets.current.placementMarginY = placementMarginY;
        parameters.current.offsetY = placementMarginY;
      }
      scheduleRef.current?.();
    });
    Config.getConfig().then(value => {
      if (!configSeen.current) receiveConfig(value);
    });
    invoke<PlacementMonitors>("get_monitors")
      .then(value => {
        if (!disposed) setSupported(value.positioningSupported);
      })
      .catch(error => {
        console.warn("Could not query placement monitors", error);
        if (!disposed) setSupported(false);
      });
    return () => {
      disposed = true;
      mounted.current = false;
      allowed.current = false;
      pending.current = null;
      unlisten.then(fn => fn());
      unlistenPreview.then(fn => fn());
    };
  }, []);

  const mode = config?.placementMode;
  const configKey = config ? configKeyFor(config) : "";
  const anchored = mainWindow && mode === "anchored" && supported !== false && failedConfig !== configKey;
  const channelPlacement = anchored && pathname === "/channel";
  const displayOnly = channelPlacement && pin;

  useLayoutEffect(() => {
    allowed.current = anchored && supported === true;
    currentConfigKey.current = configKey;
  }, [anchored, supported, configKey]);

  useLayoutEffect(() => {
    const activation = ++lockActivation.current;
    pendingLock.current = channelPlacement && supported === true ? activation : null;
    return () => {
      pendingLock.current = null;
      lockActivation.current++;
    };
  }, [channelPlacement, supported]);

  const release = async () => {
    if (released.current) return;
    await invoke("release_placement");
    released.current = true;
    lastRequest.current = null;
  };

  drainRef.current = () => {
    if (inFlight.current || !mounted.current || !pending.current) return;
    inFlight.current = true;
    (async () => {
      try {
        while (mounted.current && pending.current) {
          const request = pending.current;
          pending.current = null;
          if (request === "release" || !allowed.current) {
            try {
              await release();
            } catch (error) {
              console.warn("Could not release overlay placement", error);
            }
            if (pendingUnlock.current) {
              pendingUnlock.current = false;
              try {
                // Wait for any in-flight fixed lock before restoring manual input.
                const pinned = await invoke<boolean>("get_pin");
                if (pinned && previousMode.current === "manual") await invoke("set_pin", { value: false });
              } catch (error) {
                console.warn("Could not unpin the manual overlay", error);
              }
            }
            continue;
          }
          const previous = lastRequest.current;
          if (
            previous &&
            pendingLock.current === null &&
            previous.monitor === request.monitor &&
            previous.anchor === request.anchor &&
            previous.offsetX === request.offsetX &&
            previous.offsetY === request.offsetY &&
            Math.abs(previous.width - request.width) < 1 &&
            Math.abs(previous.height - request.height) < 1
          ) {
            continue;
          }
          const requestConfigKey = currentConfigKey.current;
          const requestActivation = lockActivation.current;
          try {
            await invoke("apply_placement", { ...request });
            released.current = false;
            lastRequest.current = request;
            if (mounted.current && allowed.current && pendingLock.current === requestActivation) {
              pendingLock.current = null;
              if (!currentPin.current) {
                try {
                  await invoke("set_pin", { value: true });
                } catch (error) {
                  console.warn("Could not pin the fixed overlay", error);
                }
              }
            }
          } catch (error) {
            console.warn("Could not apply overlay placement; keeping manual controls", error);
            released.current = false;
            if (mounted.current && requestConfigKey === currentConfigKey.current) {
              allowed.current = false;
              pending.current = null;
              pendingLock.current = null;
              setFailedConfig(requestConfigKey);
            }
            try {
              await release();
            } catch (releaseError) {
              console.warn("Could not restore manual overlay controls", releaseError);
            }
          }
        }
      } finally {
        inFlight.current = false;
        if (mounted.current && pending.current) drainRef.current();
      }
    })();
  };

  useLayoutEffect(() => {
    if (!mainWindow) return;
    document.documentElement.classList.toggle("placement-display", channelPlacement);
    return () => document.documentElement.classList.remove("placement-display");
  }, [channelPlacement]);

  useEffect(() => {
    if (!mainWindow || !mode || supported === null) return;
    const root = rootRef.current;
    let frame = 0;

    if (!anchored) {
      if (mode === "manual") setFailedConfig(null);
      pending.current = "release";
      drainRef.current();
      return;
    }

    const measure = () => {
      frame = 0;
      // Keep the native window bounds while a reloaded channel waits for its first snapshot.
      if (!root || !allowed.current || (pathname === "/channel" && !channelSnapshotReady)) return;
      let { width, height } = DEFAULT_WINDOW_SIZE;
      if (pathname === "/channel") {
        const content = root.querySelector<HTMLElement>("[data-placement-content]");
        const navbar = root.querySelector<HTMLElement>("[data-placement-navbar]");
        const bounds = content?.getBoundingClientRect();
        const navbarHeight = navbar?.getBoundingClientRect().height ?? 0;
        const style = getComputedStyle(root);
        const borderX = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
        const borderY = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
        width =
          Math.ceil(Math.max(pin ? EMPTY_CONTENT_SIZE.width : NAVBAR_MIN_WIDTH, bounds?.width ?? 0) + borderX) +
          FIT_HEADROOM;
        height =
          Math.ceil(Math.max(EMPTY_CONTENT_SIZE.height, bounds?.height ?? 0) + navbarHeight + borderY) + FIT_HEADROOM;
      }

      pending.current = { ...parameters.current, width, height };
      drainRef.current();
    };

    const schedule = (force = false) => {
      if (force) lastRequest.current = null;
      if (!frame) frame = requestAnimationFrame(measure);
    };
    scheduleRef.current = schedule;
    const resize = new ResizeObserver(() => schedule());
    const observed = new Set<HTMLElement>();
    const observeContent = () => {
      const elements = new Set(
        root?.querySelectorAll<HTMLElement>("[data-placement-content], [data-placement-navbar], [data-placement-row]")
      );
      observed.forEach(element => {
        if (!elements.has(element)) {
          resize.unobserve(element);
          observed.delete(element);
        }
      });
      elements.forEach(element => {
        if (!observed.has(element)) {
          resize.observe(element);
          observed.add(element);
        }
      });
    };
    const mutations = new MutationObserver(() => {
      observeContent();
      schedule();
    });
    if (root) mutations.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
    observeContent();
    schedule(true);

    return () => {
      scheduleRef.current = null;
      if (pending.current !== "release") pending.current = null;
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
    };
  }, [anchored, mode, supported, pathname, pin, channelSnapshotReady]);

  return { anchored, channelPlacement, displayOnly, rootRef };
};
