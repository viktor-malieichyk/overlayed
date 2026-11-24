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
  { key: "showHistoryJoinsAndLeaves", label: "Show join and leave events" },
  { key: "showHistoryVoiceActivity", label: "Show speaking events" },
  { key: "joinHistoryNotifications", label: "Notify when users join or leave" },
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
    <div className="flex h-full min-h-0 flex-col gap-2 text-sm">
      <p className="settings-hint shrink-0">{t("Voice channel activity from the last 24 hours")}</p>
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
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
          <span className="mr-2">{t("Clear history")}</span>
          <Trash size={18} />
        </Button>
      </div>
      <ol
        aria-label={t("History")}
        className="min-h-0 min-w-0 flex-1 divide-y divide-zinc-800 overflow-y-auto pr-2 [scrollbar-gutter:stable]"
      >
        {visibleLog.map(item => {
          const date = new Date(item.timestamp);
          const time = dateFormat.format(date);
          const duration = item.event === "speaking" ? formatDuration(item.duration) : null;
          const Icon = { join: PhoneIncoming, leave: PhoneOff, speaking: Mic }[item.event];
          const color = { join: "text-green-500", leave: "text-red-500", speaking: "text-pink-400" }[item.event];
          const details = [t(item.event), item.room ?? t("Private call"), duration].filter(Boolean).join(" · ");
          return (
            <li key={item.key} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 py-2">

              <Icon size={16} aria-hidden className={cn(color, "shrink-0")} />
              <div className="min-w-0 [overflow-wrap:anywhere]">
                <button
                  type="button"
                  className="block max-w-full text-left font-medium [overflow-wrap:anywhere] hover:underline"
                  onClick={async () => {
                    const discordTime = `<t:${Math.floor(item.timestamp / 1000)}:F>`;
                    await navigator.clipboard.writeText(`${item.username} (${details}) <@${item.id}> ${discordTime}`);
                    toast({ title: t("User info copied"), variant: "success", duration: 3000 });
                  }}
                >
                  {item.username}
                </button>
                <span className="text-zinc-300">{details}</span>
              </div>
              <time className="max-w-36 text-right tabular-nums text-zinc-400 [overflow-wrap:anywhere]" dateTime={date.toISOString()}>
                {time}
              </time>
            </li>
          );
        })}
        {visibleLog.length === 0 && <li className="settings-hint py-2">{t("No matching events")}</li>}
      </ol>
    </div>
  );
};
