import { useTranslation } from "@/i18n";
import { useAppStore } from "../store";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { exit } from "@tauri-apps/plugin-process";
import { RETRY_AUTH_EVENT } from "@/rpc/manager";

export const MainView = () => {
  const t = useTranslation();
  const { discordReady, resetErrors } = useAppStore();

  useEffect(() => {
    resetErrors();
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-zinc-900 p-4 text-sm">
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-xl font-semibold">{t(discordReady ? "Authorize in Discord" : "Connect to Discord")}</h1>
        {discordReady ? (
          <ol className="list-decimal space-y-2 pl-5 text-left">
            <li>{t("Open the authorization prompt in Discord.")}</li>
            <li>{t('Select "Authorize" in Discord.')}</li>
            <li>{t("Join a voice channel.")}</li>
          </ol>
        ) : (
          <p>{t("Open the Discord desktop app. UniversalOverlay will connect automatically.")}</p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            onClick={() => {
              window.dispatchEvent(new Event(RETRY_AUTH_EVENT));
            }}
          >
            {t(discordReady ? "Try again" : "Check for Discord")}
          </Button>

          <Button
            variant="ghost"
            onClick={async () => {
              await exit();
            }}
          >
            {t("Quit UniversalOverlay")}
          </Button>
        </div>
        <p className="settings-hint">
          {t("UniversalOverlay is not affiliated with Discord. Discord is a trademark of Discord Inc.")}
        </p>
      </div>
    </div>
  );
};
