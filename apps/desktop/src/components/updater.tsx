import { useTranslation } from "@/i18n";
import { Download } from "lucide-react";
import { type Update } from "@tauri-apps/plugin-updater";
import { Button } from "./ui/button";
import { useRef, useState } from "react";

export const Updater = ({ update }: { update: Update }) => {
  const t = useTranslation();
  const installing = useRef(false);
  const [status, setStatus] = useState<"idle" | "downloading" | "installing" | "error">("idle");
  const busy = status === "downloading" || status === "installing";

  const installUpdate = async () => {
    if (installing.current) return;
    installing.current = true;
    setStatus("downloading");
    try {
      await update.downloadAndInstall(
        event => {
          if (event.event === "Finished") setStatus("installing");
        },
        { timeout: 120000 }
      );
    } catch (error) {
      console.error("Could not install update", error);
      setStatus("error");
    } finally {
      installing.current = false;
    }
  };

  return (
    <div className="mb-3 rounded-md border border-zinc-700 bg-zinc-800 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">
          {t("Update available")} {update.version}
        </p>
        <Button size="sm" disabled={busy} onClick={() => void installUpdate()}>
          <Download size={16} aria-hidden="true" className="mr-2" />
          {t(
            status === "downloading"
              ? "Downloading update..."
              : status === "installing"
                ? "Installing update..."
                : "Update now"
          )}
        </Button>
      </div>
      {status === "error" && (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {t("Could not install the update. Try again.")}
        </p>
      )}
    </div>
  );
};
