import { invoke } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { type } from "@tauri-apps/plugin-os";
import { v4 } from "uuid";
import Config from "@/config";
import { translate } from "@/i18n";
import { CHANNEL_TYPES } from "@/constants";
import type { CurrentChannel, OverlayedUser } from "@/types";

export const HISTORY_KEY = "voice-history";
const RETENTION_MS = 24 * 60 * 60 * 1000;

export type VoiceHistoryRecord = Pick<OverlayedUser, "id" | "username" | "avatarHash" | "discriminator"> & {
  key: string;
  room: string | null;
  timestamp: number;
} & ({ event: "join" | "leave" } | { event: "speaking"; duration: number });

export function readVoiceHistory(now = Date.now()): VoiceHistoryRecord[] {
  try {
    const records: VoiceHistoryRecord[] = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return records.filter(record => record.timestamp >= now - RETENTION_MS);
  } catch {
    return [];
  }
}

export function maintainVoiceHistory() {
  const saved = localStorage.getItem(HISTORY_KEY);
  const current = JSON.stringify(readVoiceHistory());
  if (saved !== null && saved !== current) localStorage.setItem(HISTORY_KEY, current);
}

function writeVoiceHistory(records: VoiceHistoryRecord[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(records));
  } catch (error) {
    console.warn("Could not save voice history", error);
  }
}

let permission: Promise<boolean> | undefined;

async function notify(record: VoiceHistoryRecord) {
  const config = await Config.getConfig();
  if (!config.joinHistoryNotifications) return;
  permission ??= isPermissionGranted().then(granted => granted || requestPermission().then(p => p === "granted"));
  if (!(await permission) || !(await Config.get("joinHistoryNotifications"))) return;

  const t = (message: string) => translate(config.language, message);
  const title = record.room ?? t("Private call");
  const action = t(record.event === "join" ? "joined the voice channel" : "left the voice channel");
  const body = `${record.username} ${action}`;
  if (type() === "windows") {
    await invoke("show_voice_notification", {
      title,
      body,
      userId: record.id,
      avatarHash: record.avatarHash || null,
      discriminator: record.discriminator || null,
    });
  } else {
    sendNotification({
      title,
      body,
      icon: record.avatarHash ? `https://cdn.discordapp.com/avatars/${record.id}/${record.avatarHash}.png` : undefined,
    });
  }
}

export class VoiceHistory {
  private readonly speakers = new Map<string, { key: string; timestamp: number }>();

  record(user: OverlayedUser, channel: CurrentChannel, event: VoiceHistoryRecord["event"]) {
    if (event === "speaking" && this.speakers.has(user.id)) return;
    const { id, username, avatarHash, discriminator } = user;
    const room = channel.type === CHANNEL_TYPES.DM || channel.type === CHANNEL_TYPES.GROUP_DM ? null : channel.name;
    const details = { key: v4(), id, username, avatarHash, discriminator, room, timestamp: Date.now() };
    const record: VoiceHistoryRecord =
      event === "speaking" ? { ...details, event, duration: 0 } : { ...details, event };
    writeVoiceHistory([record, ...readVoiceHistory()]);

    if (record.event === "speaking") {
      this.speakers.set(id, { key: record.key, timestamp: record.timestamp });
    } else {
      void notify(record).catch(error => {
        permission = undefined;
        console.warn("Could not send voice channel notification", error);
      });
    }
  }

  stopSpeaking(userId: string) {
    this.finishSpeakers(id => id === userId);
  }

  finishSpeakers(shouldFinish: (id: string) => boolean = () => true) {
    this.updateDurations(shouldFinish, true);
  }

  checkpoint() {
    this.updateDurations(() => true, false);
    maintainVoiceHistory();
  }

  private updateDurations(matches: (id: string) => boolean, finish: boolean) {
    const now = Date.now();
    const durations = new Map<string, number>();
    for (const [id, speaker] of this.speakers) {
      if (!matches(id)) continue;
      durations.set(speaker.key, Math.max(0, now - speaker.timestamp));
      if (finish) this.speakers.delete(id);
    }
    if (durations.size === 0) return;

    const records = readVoiceHistory(now);
    writeVoiceHistory(
      records.map(record =>
        record.event === "speaking" && durations.has(record.key)
          ? { ...record, duration: durations.get(record.key)! }
          : record
      )
    );
  }
}
