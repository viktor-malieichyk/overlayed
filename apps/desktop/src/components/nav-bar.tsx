import { useTranslation } from "@/i18n";
import { useLocation } from "react-router-dom";
import { Settings, Pin, ArrowLeftToLine, ArrowRightToLine, ChevronsRightLeft, X, type LucideIcon } from "lucide-react";
import { usePlatformInfo } from "@/hooks/use-platform-info";
import React, { useEffect } from "react";
import Config, { type DirectionLR } from "../config";
import { useConfigValue } from "@/hooks/use-config-value";
import { useAppStore } from "../store";
import { useState } from "react";
import { FTUE_PIN_TRAY_TIP_KEY } from "@/constants";
import { getChannelName } from "@/utils/channel";
import { cn } from "@/utils/tw";
import { Metric, track } from "@/metrics";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

const mapping = {
  left: 0,
  center: 1,
  right: 2,
};

interface Alignment {
  direction: DirectionLR;
  name: string;
  icon: LucideIcon;
}

const horizontalAlignments: Alignment[] = [
  {
    direction: "left",
    name: "Left",
    icon: ArrowLeftToLine,
  },
  {
    direction: "center",
    name: "Center",
    icon: ChevronsRightLeft,
  },
  {
    direction: "right",
    name: "Right",
    icon: ArrowRightToLine,
  },
];

export const NavBar = ({
  pin,
  alignDirection,
  setAlignDirection,
}: {
  pin: boolean;
  alignDirection: DirectionLR;
  setAlignDirection: React.Dispatch<React.SetStateAction<DirectionLR>>;
}) => {
  const t = useTranslation();
  const location = useLocation();
  const { currentChannel, me } = useAppStore();

  const { value: hideRoomName } = useConfigValue("hideRoomName");
  const channelName = hideRoomName ? undefined : getChannelName(currentChannel);
  const [currentAlignment, setCurrentAlignment] = useState(mapping[alignDirection]);

  // keep local currentAlignment in sync when the prop changes (e.g., loaded from config)
  useEffect(() => {
    setCurrentAlignment(mapping[alignDirection] ?? mapping.right);
  }, [alignDirection]);

  const canDrag = !pin;
  const opacity = pin && location.pathname === "/channel" ? "opacity-0" : "opacity-100";
  const IconComponent = horizontalAlignments[currentAlignment]?.icon || ArrowLeftToLine;

  const routesToShowOn = ["/channel", "/error", "/"];
  const { canary, os } = usePlatformInfo();
  const [showFtue, setShowFtue] = useState(() => !localStorage.getItem(FTUE_PIN_TRAY_TIP_KEY));

  const dismissFtue = () => {
    localStorage.setItem(FTUE_PIN_TRAY_TIP_KEY, "true");
    setShowFtue(false);
  };

  if (!routesToShowOn.includes(location.pathname)) return null;

  useEffect(() => {
    // Listen for storage changes from other windows (e.g., settings clearing FTUE key)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === FTUE_PIN_TRAY_TIP_KEY && e.newValue === null) {
        setShowFtue(true);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const trayHint = os === "macos"
    ? t("Use the menu bar icon to unpin the overlay or open settings.")
    : t("Use the system tray icon to unpin the overlay or open settings.");

  return (
    <div
      data-placement-navbar
      className={cn(opacity, "shrink-0 rounded-t-lg font-semibold select-none bg-white dark:bg-zinc-900 px-4 py-2 text-sm")}
    >
      <div className="flex justify-between gap-2">
        <div
          className={cn("flex min-w-0 flex-1 items-center", canDrag && "cursor-move")}
          onMouseDown={event => {
            if (!canDrag || event.button !== 0) return;
            event.preventDefault();
            void getCurrentWindow().startDragging().catch(error => console.warn("Could not drag the overlay", error));
          }}
        >
          <img
            src={canary ? "/img/32x32-canary.png" : "/img/32x32.png"}
            alt=""
            draggable={false}
            className="mr-2 size-8 shrink-0"
          />
          <span className="truncate">{channelName ?? "UniversalOverlay"}</span>
        </div>
        {location.pathname !== "/settings" && (
          <div className="hidden shrink-0 gap-4 md:flex">
            <button
              className="cursor-pointer"
              title={`${t("Alignment")}: ${t(horizontalAlignments[currentAlignment]?.name ?? "Left")}`}
            >
              <IconComponent
                size={20}
                onClick={async () => {
                  const newAlignment = (currentAlignment + 1) % horizontalAlignments.length;
                  setCurrentAlignment(newAlignment);
                  const dir = horizontalAlignments[newAlignment]?.direction || "center";
                  setAlignDirection(dir);
                  await Config.set("horizontal", dir);
                  await emit("config_update", await Config.getConfig());
                }}
              />
            </button>
            <div className={cn("relative items-center", location.pathname === "/channel" ? "flex" : "hidden")}>
              <button className="cursor-pointer" title={t(pin ? "Unpin" : "Pin")} aria-label={t(pin ? "Unpin" : "Pin")}>
                <Pin
                  size={20}
                  onClick={async () => {
                    await invoke("toggle_pin");
                    track(Metric.Pin, 1);
                  }}
                />
              </button>
              {showFtue && !!me && (
                <div className="absolute right-0 top-full z-50 mt-3 w-60 rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-sm font-normal shadow-xl cursor-default">
                  {/* Arrow pointing up toward the pin button */}
                  <div className="absolute -top-3 right-0 h-0 w-0 border-x-[9px] border-b-[12px] border-x-transparent border-b-zinc-500" />
                  <div className="flex items-start gap-2">
                    <p className="flex-1 pr-4 leading-snug text-zinc-300">
                      {t("Pinning hides this frame to only show the users in the call.")}{" "}
                      {trayHint}
                    </p>
                    <button
                      onClick={dismissFtue}
                      className="absolute right-2 top-2 shrink-0 cursor-pointer text-zinc-400 hover:text-white"
                      title={t("Dismiss")}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              className="cursor-pointer"
              title={t("Settings")}
              aria-label={t("Settings")}
              onClick={() => {
                invoke("open_settings");
              }}
            >
              <Settings size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
