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
    <div className="min-h-0 flex-1 bg-zinc-900 px-4 py-3">
      <div className="pt-1 mb-3 font-bold text-2xl text-center">
        <p className="mb-2">{t(discordReady ? "Authorize Discord" : "Connect to Discord")}</p>
        <p className="text-sm text-center text-zinc-400">
          {t("UniversalOverlay is not affiliated with Discord. Discord is a trademark of Discord Inc.")}
        </p>
        {discordReady ? (
          <ul className="mt-3 flex list-decimal flex-col gap-2 py-3 pl-7 text-left text-base">
            <li>
              <p className="leading-8">{t("Discord should have opened a popup")}</p>
            </li>
            <li>
              <p className="leading-8">{t('Click "Authorize" within Discord')}</p>
            </li>
            <li>
              <p className="leading-8">{t("Join a voice channel")}</p>
            </li>
            <li>
              <p className="leading-8">{t("Enjoy 🥳")}</p>
            </li>
          </ul>
        ) : (
          <p className="my-4 text-base font-normal">
            {t("Open the Discord desktop app. UniversalOverlay will connect automatically.")}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
          <Button
            onClick={() => {
              window.dispatchEvent(new Event(RETRY_AUTH_EVENT));
            }}
          >
            {t(discordReady ? "Try Again" : "Check for Discord")}
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
      </div>
    </div>
  );
};
