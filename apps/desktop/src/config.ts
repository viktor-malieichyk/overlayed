import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { BaseDirectory } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import type { PlacementMonitors } from "@/hooks/use-placement";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import * as Sentry from "@sentry/react";

export type DirectionLR = "left" | "right" | "center";
export type DirectionTB = "top" | "bottom";

export type TaskbarHideMode = "never" | "pinned" | "always";

export type OpacityTarget = "all-users" | "non-speaking";

export type HotkeyCommand = "pin" | "toggle-visibility" | "next-monitor" | "open-settings" | "open-history" | "toggle-speaking-only";
export interface HotkeyBinding {
  key: string;
  command: HotkeyCommand;
}

export type PlacementMode = "manual" | "anchored";
export type PlacementAnchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

// TODO: this is hard to use we zzz
// NOTE: how can i handle versions updates where i add new keys
// NOTE: this looks cool https://github.com/harshkhandeparkar/tauri-settings/issues
export interface OverlayedConfig {
  pin: boolean;
  horizontal: DirectionLR;
  vertical: DirectionTB;
  telemetry: boolean;
  joinHistoryNotifications: boolean;
  showHistoryJoinsAndLeaves: boolean;
  showHistoryVoiceActivity: boolean;
  hideOwnHistoryVoiceActivity: boolean;
  showOnlyTalkingUsers: boolean;
  showOwnUser: boolean;
  opacity: number;
  opacityTarget: OpacityTarget;
  maxUsernameLength: number;
  userScale: number;
  taskbarHideMode: TaskbarHideMode;
  placementMode: PlacementMode;
  placementMonitor: string | null;
  placementAnchor: PlacementAnchor;
  placementMarginX: number;
  placementMarginY: number;
  hideRoomName: boolean;
  language: "en" | "uk";
  hotkeys: HotkeyBinding[];
}

export type OverlayedConfigKey = keyof OverlayedConfig;

export const DEFAULT_OVERLAYED_CONFIG: OverlayedConfig = {
  pin: false,
  horizontal: "left",
  // TODO: vertical alignment? i.e., if aligned to bottom, then the navbar should be at the bottom (and corner radius changes appropriately)
  vertical: "bottom",
  telemetry: true,
  joinHistoryNotifications: true,
  showHistoryJoinsAndLeaves: true,
  showHistoryVoiceActivity: false,
  hideOwnHistoryVoiceActivity: false,
  showOnlyTalkingUsers: false,
  showOwnUser: true,
  opacity: 100,
  opacityTarget: "all-users",
  maxUsernameLength: 40,
  userScale: 100,
  taskbarHideMode: "always",
  placementMode: "anchored",
  placementMonitor: null,
  placementAnchor: "top-left",
  placementMarginX: 1,
  placementMarginY: 1.5,
  hideRoomName: true,
  language: "en",
  hotkeys: [
    { key: "CommandOrControl+Shift+H", command: "pin" },
    { key: "CommandOrControl+Shift+G", command: "toggle-visibility" },
  ],
};

const CONFIG_FILE_NAME = "config.json";

export class Config {
  private config: OverlayedConfig = DEFAULT_OVERLAYED_CONFIG;
  private readonly loaded: Promise<void>;
  private writes = Promise.resolve();

  constructor() {
    this.loaded = this.readConfig(DEFAULT_OVERLAYED_CONFIG, true).then(value => {
      this.config = value;
      if (!value.telemetry) void Sentry.close();
    });

    listen<OverlayedConfig>("config_update", event => {
      this.config = event.payload;
    });
  }

  private async readConfig(fallback: OverlayedConfig, initializeLanguage = false): Promise<OverlayedConfig> {
    try {
      const raw = await readTextFile(CONFIG_FILE_NAME, { baseDir: BaseDirectory.AppConfig }).catch(() => null);
      const saved: Partial<Omit<OverlayedConfig, "opacityTarget">> & {
        opacityTarget?: OpacityTarget | "all" | "username-box" | "entire-overlay";
        hideTaskbarWhenPinned?: boolean;
        showHistoryJoins?: boolean;
        showHistoryLeaves?: boolean;
        placementOffsetX?: number;
        placementOffsetY?: number;
      } = raw === null ? {} : JSON.parse(raw);
      const {
        hideTaskbarWhenPinned,
        placementOffsetX,
        placementOffsetY,
        showHistoryJoins,
        showHistoryLeaves,
        opacityTarget,
        ...config
      } = saved;
      if (
        (config.placementMarginX === undefined && placementOffsetX !== undefined) ||
        (config.placementMarginY === undefined && placementOffsetY !== undefined)
      ) {
        const response = await invoke<PlacementMonitors>("get_monitors").catch(() => null);
        const monitors = response?.monitors ?? [];
        const monitor =
          monitors.find(item => item.name === config.placementMonitor) ??
          monitors.find(item => item.primary) ??
          monitors[0];
        const percent = (offset: number, resolution: number) =>
          Math.max(0, Math.min(50, Math.round((offset * (monitor?.scaleFactor ?? 1) * 1000) / resolution) / 10));
        if (config.placementMarginX === undefined && placementOffsetX !== undefined)
          config.placementMarginX = percent(placementOffsetX, monitor?.width || 1920);
        if (config.placementMarginY === undefined && placementOffsetY !== undefined)
          config.placementMarginY = percent(placementOffsetY, monitor?.height || 1080);
      }
      const value: OverlayedConfig = {
        ...DEFAULT_OVERLAYED_CONFIG,
        ...config,
        opacityTarget: opacityTarget === "all" || opacityTarget === "non-speaking" ? "non-speaking" : "all-users",
        // Preserve manually positioned overlays from before fixed placement was added.
        placementMode: config.placementMode ?? (raw === null ? fallback.placementMode : "manual"),
        showHistoryJoinsAndLeaves:
          config.showHistoryJoinsAndLeaves ?? (showHistoryJoins !== false || showHistoryLeaves !== false),
        taskbarHideMode:
          config.taskbarHideMode ??
          (hideTaskbarWhenPinned === undefined
            ? DEFAULT_OVERLAYED_CONFIG.taskbarHideMode
            : hideTaskbarWhenPinned
              ? "pinned"
              : "never"),
      };
      if (initializeLanguage && config.language !== "en" && config.language !== "uk") {
        value.language = await invoke<OverlayedConfig["language"]>("get_initial_language").catch(() => "en" as const);
        if (getCurrentWebviewWindow().label === "main") {
          await writeTextFile(CONFIG_FILE_NAME, JSON.stringify(value, null, 2), {
            baseDir: BaseDirectory.AppConfig,
          }).catch(error => console.warn("Could not save the initial app language", error));
        }
      }
      return raw === null && !initializeLanguage ? fallback : value;
    } catch {
      return fallback;
    }
  }

  async getConfig(): Promise<OverlayedConfig> {
    await this.loaded;
    return this.config;
  }

  async get<K extends OverlayedConfigKey>(key: K): Promise<OverlayedConfig[K]> {
    return (await this.getConfig())[key];
  }

  set<K extends OverlayedConfigKey>(key: K, value: OverlayedConfig[K]): Promise<void> {
    const write = this.writes.then(async () => {
      await this.loaded;
      const current = await this.readConfig(this.config);
      const updated = { ...current, [key]: value };
      await writeTextFile(CONFIG_FILE_NAME, JSON.stringify(updated, null, 2), { baseDir: BaseDirectory.AppConfig });
      this.config = updated;
    });
    this.writes = write.catch(() => {});
    return write;
  }
}

const config = new Config();

export default config;
