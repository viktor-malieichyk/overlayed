import { translate, useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Trash, PhoneOff, PhoneIncoming } from "lucide-react";
import { cn } from "@/utils/tw";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { Event } from "@/constants";
import { useToast } from "@/components/ui/use-toast";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { Checkbox } from "@/components/ui/checkbox";
import Config from "@/config";
import type { JoinHistoryLogUser } from "@/types";
import { useConfigValue } from "@/hooks/use-config-value";

const MAX_LOG_LENGTH = 420;
const PAGE_SIZE = 8;

export const JoinHistory = () => {
  const t = useTranslation();
  const [userLog, setUserLog] = useState<JoinHistoryLogUser[]>([]);
  const [page, setPage] = useState(0);
  const lastPage = Math.max(0, Math.ceil(userLog.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  const { value: joinHistoryNotifications } = useConfigValue("joinHistoryNotifications");

  const { toast } = useToast();
  useEffect(() => {
    let disposed = false;
    let permission: Promise<boolean> | undefined;
    const notify = async ({ event, username }: JoinHistoryLogUser) => {
      if (!(await Config.get("joinHistoryNotifications")) || disposed) return;

      permission ??= isPermissionGranted().then(async granted => granted || (await requestPermission()) === "granted");
      if (!(await permission) || disposed || !(await Config.get("joinHistoryNotifications"))) return;

      const language = await Config.get("language");
      const action = translate(language, event === "leave" ? "left the voice channel" : "joined the voice channel");
      if (!disposed) sendNotification({ title: translate(language, "Discord Voice"), body: `${username} ${action}` });
    };

    const unlisten = listen<JoinHistoryLogUser>(Event.UserLogUpdate, ({ payload }) => {
      if (disposed) return;
      setUserLog(previous => [...previous, payload].slice(-MAX_LOG_LENGTH));
      void notify(payload).catch(error => {
        permission = undefined;
        console.warn("Could not send voice channel notification", error);
      });
    });

    return () => {
      disposed = true;
      void unlisten.then(removeListener => removeListener());
    };
  }, []);

  const resetUserLog = () => {
    setUserLog([]);
    setPage(0);
  };

  return (
    <div className="flex flex-col pb-4">
      <p className="text-sm text-gray-400 mb-2">
        {t("Display join/leave events in the voice chat useful for moderation purposes")}
      </p>
      <div className="flex flex-wrap items-center gap-3 pb-2">
        <div className="flex items-center">
          <Checkbox
            id="notification"
            checked={joinHistoryNotifications}
            onCheckedChange={async () => {
              await Config.set("joinHistoryNotifications", !joinHistoryNotifications);
              await emit("config_update", await Config.getConfig());
            }}
          />
          <label
            htmlFor="notification"
            className="ml-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {t("Enable join/leave notifications")}
          </label>
        </div>
        <div className="grow"></div>
        <Button size="sm" onClick={resetUserLog} variant="ghost" className="hover:bg-red-500">
          <span className="mr-2">{t("Clear list")}</span>
          <Trash size={18} />
        </Button>
      </div>
      <div className="space-y-1 pb-3">
        {[...userLog]
          .reverse()
          .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
          .map((item, i) => {
            const timeInSeconds = Math.floor(item.timestamp / 1000);
            const userInfoString = `${item.username} (${item.event}) <@${item.id}> <t:${timeInSeconds}:R>`;
            const Icon = item.event === "join" ? PhoneIncoming : PhoneOff;
            const className = item.event === "join" ? "text-green-500" : "text-red-500";
            return (
              <Tooltip key={`user-${i}-${item.id}`} disableHoverableContent delayDuration={100}>
                <TooltipTrigger asChild>
                  <div className="flex cursor-pointer items-center text-sm text-white">
                    <Icon size={18} className={cn(className, "mr-2 shrink-0")} />{" "}
                    <span
                      className="break-all"
                      onClick={() => {
                        navigator.clipboard.writeText(userInfoString);
                        toast({
                          title: t("User Info Copied"),
                          variant: "success",
                          description: `${item.username} (${t(item.event)}) ${t("copied to clipboard")}`,
                          duration: 3000,
                        });
                      }}
                    >
                      {item.username}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent align="start">
                  {item.username} ({t(item.event)})
                </TooltipContent>
              </Tooltip>
            );
          })}
      </div>
      {lastPage > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button size="sm" variant="outline" disabled={currentPage <= 0} onClick={() => setPage(currentPage - 1)}>
            {t("Previous page")}
          </Button>
          <span className="tabular-nums">
            {currentPage + 1} / {lastPage + 1}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={currentPage >= lastPage}
            onClick={() => setPage(currentPage + 1)}
          >
            {t("Next page")}
          </Button>
        </div>
      )}
    </div>
  );
};
