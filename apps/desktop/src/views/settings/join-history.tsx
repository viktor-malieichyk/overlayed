import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import { ListFilter, LogIn, LogOut, Mic, Trash } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { Event } from "@/constants";
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import Config from "@/config";
import { useConfigValue } from "@/hooks/use-config-value";
import { HISTORY_KEY, readVoiceHistory } from "@/voice-history";
import type { VoiceUser } from "@/types";

function formatDuration(milliseconds: number) {
  const tenths = Math.floor(milliseconds / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = String(Math.floor(tenths / 10) % 60).padStart(2, "0");
  return `${minutes}:${seconds}.${tenths % 10}`;
}

const options = [
  { key: "showHistoryJoinsAndLeaves", label: "Show join and leave events" },
  { key: "showHistoryVoiceActivity", label: "Show speaking events" },
] as const;

const defaultAvatar = "/img/default.png";

function readOwnUserId(): string | undefined {
  try {
    const user: VoiceUser | null = JSON.parse(localStorage.getItem("user_data") ?? "null");
    return user?.id;
  } catch {
    return undefined;
  }
}

export const JoinHistory = () => {
  const t = useTranslation();
  const { value: language } = useConfigValue("language");
  const { value: showJoinsAndLeaves } = useConfigValue("showHistoryJoinsAndLeaves");
  const { value: showVoiceActivity } = useConfigValue("showHistoryVoiceActivity");
  const { value: hideOwnActivity } = useConfigValue("hideOwnHistoryVoiceActivity");
  const { value: notifications } = useConfigValue("joinHistoryNotifications");
  const [userLog, setUserLog] = useState(readVoiceHistory);
  const [ownUserId, setOwnUserId] = useState(readOwnUserId);
  const { toast } = useToast();

  useEffect(() => {
    const refresh = () => {
      setUserLog(readVoiceHistory());
      setOwnUserId(readOwnUserId());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === HISTORY_KEY || event.key === "user_data" || event.key === null) refresh();
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
  const values = [showJoinsAndLeaves, showVoiceActivity];
  const visibleLog = userLog
    .filter(item => filters[item.event] && !(hideOwnActivity && item.event === "speaking" && item.id === ownUserId))
    .sort((a, b) => b.timestamp - a.timestamp);
  const dateFormat = new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "medium" });

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 text-sm">
      <div className="flex shrink-0 items-center gap-3">
        <Popover.Root>
          <Popover.Trigger asChild>
            <Button type="button" size="sm" variant="outline" className="shrink-0 gap-2">
              <ListFilter size={16} aria-hidden />
              {t("Filters")}
            </Button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={6}
              collisionPadding={12}
              aria-label={t("Filters")}
              className="z-50 w-72 max-w-[var(--radix-popover-content-available-width)] rounded-md border border-zinc-700 bg-zinc-900 p-3 text-sm text-white shadow-lg"
            >
              {options.map(({ key, label }, index) => (
                <div key={key}>
                  <label htmlFor={key} className="flex min-h-8 items-center gap-2 font-medium">
                    <Checkbox
                      id={key}
                      checked={values[index]}
                      onCheckedChange={async checked => {
                        await Config.set(key, checked === true);
                        await emit("config_update", await Config.getConfig());
                      }}
                    />
                    {t(label)}
                  </label>
                  {key === "showHistoryVoiceActivity" && (
                    <label
                      htmlFor="hideOwnHistoryVoiceActivity"
                      className="ml-6 flex items-center gap-2 text-zinc-300 has-[:disabled]:text-zinc-500"
                    >
                      <Checkbox
                        id="hideOwnHistoryVoiceActivity"
                        checked={hideOwnActivity}
                        disabled={!showVoiceActivity}
                        onCheckedChange={async checked => {
                          await Config.set("hideOwnHistoryVoiceActivity", checked === true);
                          await emit("config_update", await Config.getConfig());
                        }}
                      />
                      {t("Hide my activity")}
                    </label>
                  )}
                </div>
              ))}
              <label
                htmlFor="joinHistoryNotifications"
                className="mt-2 flex items-center gap-2 border-t border-zinc-700 pt-3 font-medium"
              >
                <Checkbox
                  id="joinHistoryNotifications"
                  checked={notifications}
                  onCheckedChange={async checked => {
                    await Config.set("joinHistoryNotifications", checked === true);
                    await emit("config_update", await Config.getConfig());
                  }}
                />
                {t("Notify when users join or leave")}
              </label>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <p className="settings-hint min-w-0 flex-1 truncate" title={t("Voice channel activity from the last 24 hours")}>
          {t("Voice channel activity from the last 24 hours")}
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 hover:bg-red-500"
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
        className="nice-scroll min-h-0 min-w-0 flex-1 divide-y divide-zinc-800 overflow-y-auto pr-2 [scrollbar-gutter:stable]"
      >
        {visibleLog.map(item => {
          const date = new Date(item.timestamp);
          const time = dateFormat.format(date);
          const duration = item.event === "speaking" ? formatDuration(item.duration) : null;
          const Icon = { join: LogIn, leave: LogOut, speaking: Mic }[item.event];
          const color = { join: "text-green-500", leave: "text-red-500", speaking: "text-pink-400" }[item.event];
          const action = t(item.event);
          const room = item.room ?? t("Private call");
          const avatarUrl = item.avatarHash
            ? `https://cdn.discordapp.com/avatars/${item.id}/${item.avatarHash}.jpg`
            : defaultAvatar;
          return (
            <li key={item.key} className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 py-1.5">
              <Icon size={16} role="img" aria-label={action} className={color} />
              <img
                src={avatarUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-6 rounded-full bg-zinc-800 object-cover"
                onError={event => {
                  const image = event.currentTarget;
                  if (image.getAttribute("src") !== defaultAvatar) image.src = defaultAvatar;
                }}
              />
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  className="max-w-[50%] truncate text-left font-medium hover:underline"
                  title={item.username}
                  onClick={async () => {
                    const discordTime = `<t:${Math.floor(item.timestamp / 1000)}:F>`;
                    const details = [action, room, duration].filter(Boolean).join(" · ");
                    await navigator.clipboard.writeText(`${item.username} (${details}) <@${item.id}> ${discordTime}`);
                    toast({ title: t("User info copied"), variant: "success", duration: 3000 });
                  }}
                >
                  {item.username}
                </button>
                <span className="truncate text-zinc-300" title={room}>
                  {room}
                </span>
                {duration && <span className="shrink-0 tabular-nums text-zinc-300">{duration}</span>}
              </div>
              <time className="whitespace-nowrap text-right tabular-nums text-zinc-400" dateTime={date.toISOString()}>
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
