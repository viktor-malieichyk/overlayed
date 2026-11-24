import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Mic, PhoneIncoming, PhoneOff, Trash } from "lucide-react";
import { cn } from "@/utils/tw";
import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { Event } from "@/constants";
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import Config from "@/config";
import { useConfigValue } from "@/hooks/use-config-value";
import { HISTORY_KEY, readVoiceHistory } from "@/voice-history";

function formatDuration(milliseconds: number) {
  const tenths = Math.floor(milliseconds / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = String(Math.floor(tenths / 10) % 60).padStart(2, "0");
  return `${minutes}:${seconds}.${tenths % 10}`;
}

const options = [
  { key: "showHistoryJoinsAndLeaves", label: "Show joins and leaves" },
  { key: "showHistoryVoiceActivity", label: "Show voice activity" },
  { key: "joinHistoryNotifications", label: "Enable join/leave notifications" },
] as const;

export const JoinHistory = () => {
  const t = useTranslation();
  const { value: language } = useConfigValue("language");
  const { value: showJoinsAndLeaves } = useConfigValue("showHistoryJoinsAndLeaves");
  const { value: showVoiceActivity } = useConfigValue("showHistoryVoiceActivity");
  const { value: notifications } = useConfigValue("joinHistoryNotifications");
  const [userLog, setUserLog] = useState(readVoiceHistory);
  const { toast } = useToast();

  useEffect(() => {
    const refresh = () => setUserLog(readVoiceHistory());
    const onStorage = (event: StorageEvent) => {
      if (event.key === HISTORY_KEY || event.key === null) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 5000);
    refresh();
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, []);

  const filters = { join: showJoinsAndLeaves, leave: showJoinsAndLeaves, speaking: showVoiceActivity };
  const values = [showJoinsAndLeaves, showVoiceActivity, notifications];
  const visibleLog = userLog.filter(item => filters[item.event]).sort((a, b) => b.timestamp - a.timestamp);
  const dateFormat = new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "medium" });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="mb-2 shrink-0 text-sm text-gray-400">{t("Voice channel activity from the last 24 hours")}</p>
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 pb-2">
        {options.map(({ key, label }, index) => (
          <div key={key} className="flex items-center gap-2">
            <Checkbox
              id={key}
              checked={values[index]}
              onCheckedChange={async checked => {
                await Config.set(key, checked === true);
                await emit("config_update", await Config.getConfig());
              }}
            />
            <label htmlFor={key} className="text-sm font-medium">
              {t(label)}
            </label>
          </div>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto hover:bg-red-500"
          onClick={async () => {
            await emit(Event.ClearVoiceHistory);
          }}
        >
          <span className="mr-2">{t("Clear list")}</span>
          <Trash size={18} />
        </Button>
      </div>
      <ol aria-label={t("History")} className="min-h-0 flex-1 space-y-1 overflow-y-auto pb-3">
        {visibleLog.map(item => {
          const date = new Date(item.timestamp);
          const time = dateFormat.format(date);
          const duration = item.event === "speaking" ? formatDuration(item.duration) : null;
          const Icon = { join: PhoneIncoming, leave: PhoneOff, speaking: Mic }[item.event];
          const color = { join: "text-green-500", leave: "text-red-500", speaking: "text-pink-400" }[item.event];
          const details = [t(item.event), item.room ?? t("Private call"), duration].filter(Boolean).join(" · ");
          return (
            <li key={item.key} className="flex flex-wrap items-center gap-x-2 text-sm">
              <Icon size={16} aria-hidden className={cn(color, "shrink-0")} />
              <button
                type="button"
                className="break-all font-medium hover:underline"
                onClick={async () => {
                  const discordTime = `<t:${Math.floor(item.timestamp / 1000)}:F>`;
                  await navigator.clipboard.writeText(`${item.username} (${details}) <@${item.id}> ${discordTime}`);
                  toast({ title: t("User Info Copied"), variant: "success", duration: 3000 });
                }}
              >
                {item.username}
              </button>
              <span className="break-all text-gray-300">{details}</span>
              <time className="ml-auto whitespace-nowrap tabular-nums text-gray-400" dateTime={date.toISOString()}>
                {time}
              </time>
            </li>
          );
        })}
      </ol>
      {visibleLog.length === 0 && <p className="text-sm text-gray-400">{t("No matching activity")}</p>}
    </div>
  );
};
