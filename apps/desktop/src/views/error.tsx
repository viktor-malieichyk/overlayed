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
    <div className="flex min-h-0 flex-1 flex-col items-center bg-zinc-900 p-4">
      <div className="py-4 text-center text-xl font-bold">
        <p>{t("Error Connecting to Discord")}</p>
      </div>
      <div className="size-20 shrink-0">
        <img src="/img/sad-face.svg" alt="sad" className="text-white fill-white w-full" />
      </div>
      {discordErrors.size > 0 ? (
        <div className="break-words py-4 text-center text-sm">
          {Array.from(discordErrors.values()).map((item, i) => (
            <p key={`error-${i}`}>{item}</p>
          ))}
        </div>
      ) : (
        <div>
          <p className="py-4">{t("Please try restarting discord then try again")}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
        <Link to="/">
          <Button>{t("Connect to Discord")}</Button>
        </Link>
        <Button
          variant="ghost"
          onClick={async () => {
            await exit();
          }}
        >
          {t("Quit Overlayed")}
        </Button>
      </div>
    </div>
  );
};
