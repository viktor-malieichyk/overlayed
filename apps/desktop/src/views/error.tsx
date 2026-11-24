import { useTranslation } from "@/i18n";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSetWindowSize } from "../hooks/use-set-size";
import { useAppStore } from "../store";
import { exit } from "@tauri-apps/plugin-process";

export const ErrorView = ({ anchored }: { anchored: boolean }) => {
  const t = useTranslation();
  useSetWindowSize({ width: 400, height: 600, enabled: !anchored });
  const { discordErrors } = useAppStore();

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto bg-zinc-900 p-4 text-center text-sm">
      <h1 className="text-xl font-semibold">{t("Couldn't connect to Discord")}</h1>
      <div className="size-20 shrink-0">
        <img src="/img/sad-face.svg" alt="" className="w-full" />
      </div>
      {discordErrors.size > 0 ? (
        <div className="min-w-0 space-y-2 break-words">
          {Array.from(discordErrors.values()).map((item, i) => (
            <p key={`error-${i}`}>{t(item)}</p>
          ))}
        </div>
      ) : (
        <p>{t("Restart Discord and try again.")}</p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link to="/">{t("Connect to Discord")}</Link>
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
  );
};
