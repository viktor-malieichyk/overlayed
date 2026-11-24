import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import { FORK_REPOSITORY, FTUE_PIN_TRAY_TIP_KEY, UPSTREAM_REPOSITORY } from "@/constants";
import { exit } from "@tauri-apps/plugin-process";
import { uk } from "date-fns/locale";
import { useConfigValue } from "@/hooks/use-config-value";
import * as dateFns from "date-fns";
import { saveWindowState, StateFlags } from "@tauri-apps/plugin-window-state";

import { invoke } from "@tauri-apps/api/core";
import { usePlatformInfo } from "@/hooks/use-platform-info";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { usePin } from "@/hooks/use-pin";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Pin } from "lucide-react";
import type { VoiceUser } from "@/types";

export const Developer = () => {
  const t = useTranslation();
  const DEV_TOKEN_BACKUP_KEY = "overlayed:dev:token-backup";
  const DEV_TOKEN_EXPIRY_BACKUP_KEY = "overlayed:dev:token-expiry-backup";
  const DEV_USER_DATA_BACKUP_KEY = "overlayed:dev:user-data-backup";

  const simulateTokenExpiryForTesting = async () => {
    const currentToken = localStorage.getItem("discord_access_token");
    const currentTokenExpiry = localStorage.getItem("discord_access_token_expiry");
    const currentUserData = localStorage.getItem("user_data");

    if (currentToken) {
      localStorage.setItem(DEV_TOKEN_BACKUP_KEY, currentToken);
    }
    if (currentTokenExpiry) {
      localStorage.setItem(DEV_TOKEN_EXPIRY_BACKUP_KEY, currentTokenExpiry);
    }
    if (currentUserData) {
      localStorage.setItem(DEV_USER_DATA_BACKUP_KEY, currentUserData);
    }

    // Clear auth keys so the app immediately routes back to the re-auth screen.
    localStorage.removeItem("discord_access_token");
    localStorage.removeItem("discord_access_token_expiry");
    localStorage.removeItem("user_data");

    // Bring focus back to the main window where the auth screen is shown.
    await invoke("close_settings");
  };

  const restoreTokenAfterTesting = () => {
    const tokenBackup = localStorage.getItem(DEV_TOKEN_BACKUP_KEY);
    const tokenExpiryBackup = localStorage.getItem(DEV_TOKEN_EXPIRY_BACKUP_KEY);
    const userDataBackup = localStorage.getItem(DEV_USER_DATA_BACKUP_KEY);

    if (tokenBackup) {
      localStorage.setItem("discord_access_token", tokenBackup);
      localStorage.removeItem(DEV_TOKEN_BACKUP_KEY);
    }
    if (tokenExpiryBackup) {
      localStorage.setItem("discord_access_token_expiry", tokenExpiryBackup);
      localStorage.removeItem(DEV_TOKEN_EXPIRY_BACKUP_KEY);
    }
    if (userDataBackup) {
      localStorage.setItem("user_data", userDataBackup);
      localStorage.removeItem(DEV_USER_DATA_BACKUP_KEY);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await invoke("open_devtools");
              await invoke("open_overlay_devtools");
            }}
          >
            {t("Open developer tools")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await invoke("open_config_dir");
            }}
          >
            {t("Open settings folder")}
          </Button>
        </div>
        {import.meta.env.DEV && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                localStorage.removeItem(FTUE_PIN_TRAY_TIP_KEY);
              }}
            >
              {t("Reset the pinning tip")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void simulateTokenExpiryForTesting();
              }}
            >
              {t("Expire authorization")}
            </Button>
            <Button size="sm" variant="outline" onClick={restoreTokenAfterTesting}>
              {t("Restore authorization")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await invoke("simulate_error_screen");
              }}
            >
              {t("Simulate the error screen")}
            </Button>
          </div>
        )}
      </div>
    </>
  );
};

const canaryVersionToCommit = (version: string) => {
  const split = version.split("-");
  if (split.length > 1 && split[1]) {
    const [, commitSha] = split[1].split(".");

    return commitSha;
  }

  return null;
};

export const AppInfo = () => {
  const t = useTranslation();
  const platformInfo = usePlatformInfo();

  const urlForVersion = platformInfo.canary
    ? `${UPSTREAM_REPOSITORY}/commit/${canaryVersionToCommit(platformInfo.appVersion)}`
    : `${FORK_REPOSITORY}/releases/tag/v${platformInfo.appVersion}`;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
      <div>
        <p className="text-sm">
          <strong>{t("OS")}</strong> {platformInfo.os} {platformInfo.kernalVersion} {platformInfo.arch}
        </p>
      </div>
      <span className="text-sm">/</span>
      <div>
        <p className="text-sm">
          <strong>Tauri</strong> {platformInfo.tauriVersion}
        </p>
      </div>
      <span className="text-sm">/</span>
      <div>
        <p className="text-sm">
          <strong>{t("App")}</strong>{" "}
          <a target="_blank" rel="noreferrer" href={urlForVersion}>
            {platformInfo.appVersion}
          </a>
        </p>
      </div>
    </div>
  );
};

export const Account = () => {
  const t = useTranslation();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [user, setUser] = useState<VoiceUser | null>(null);
  const { value: language } = useConfigValue("language");
  const [tokenExpires, setTokenExpires] = useState(localStorage.getItem("discord_access_token_expiry"));
  const { pin: pinned } = usePin();

  // pull out the user data from localStorage
  useEffect(() => {
    const user = localStorage.getItem("user_data");
    if (user) {
      setUser(JSON.parse(user));
    }

    // TODO: these should have keys that are shared from perhaps and abstraction
    const onStorageChange = (e: StorageEvent) => {
      if (e.key === "user_data" && e.newValue) {
        setUser(JSON.parse(e.newValue));
      }

      if (e.key === "discord_access_token_expiry" && e.newValue) {
        setTokenExpires(e.newValue);
      }
    };

    // if we get a login update the data
    window.addEventListener("storage", onStorageChange);

    return () => {
      window.removeEventListener("storage", onStorageChange);
    };
  }, []);

  const avatarUrl = `https://cdn.discordapp.com/avatars/${user?.id}/${user?.avatar}.png`;
  return (
    <div>
      <div className="space-y-4 text-sm">
        <div className="flex items-center gap-3">
          {user?.id && (
            <Avatar className="size-12 shrink-0">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
          )}
          <div>
            {user?.id ? (
              <div>
                <p className="break-all font-semibold">
                  {user?.global_name} ({user?.id})
                </p>
              </div>
            ) : (
              <p>{t("Connect to Discord to use UniversalOverlay.")}</p>
            )}

            <div className="settings-hint">
              {tokenExpires && (
                <p className="text-sm">
                  <strong>{t("Token expires in")}</strong>{" "}
                  {dateFns.formatDistanceToNow(new Date(tokenExpires), { locale: language === "uk" ? uk : undefined })}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={async () => {
                try {
                  await invoke("set_pin", { value: !pinned });
                } catch (e) {
                  console.error("failed to set pin", e);
                }
              }}
            >
              <Pin className={pinned ? "mr-2 h-4 w-4 text-yellow-400" : "mr-2 h-4 w-4"} size={16} />
              {t(pinned ? "Unpin" : "Pin")}
            </Button>
          </div>
          <div>
            <Dialog
              onOpenChange={e => {
                setShowLogoutDialog(e);
              }}
              open={showLogoutDialog}
            >
              <DialogTrigger asChild>
                <Button size="sm" disabled={!user?.id}>
                  {t("Log out")}
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[80%]">
                <form
                  onSubmit={async event => {
                    event.preventDefault();
                    setShowLogoutDialog(false);
                    // TODO: move this to the other window but for now this works
                    localStorage.removeItem("discord_access_token");
                    localStorage.removeItem("discord_access_token_expiry");
                    localStorage.removeItem("user_data");
                    setTokenExpires(null);
                    setUser(null);
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>{t("Log out")}</DialogTitle>
                    <DialogDescription>
                      {t("Are you sure you want to log out of UniversalOverlay?")}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="mt-4">
                    <DialogClose asChild>
                      <Button variant="secondary">{t("Cancel")}</Button>
                    </DialogClose>
                    <Button type="submit">{t("Log out")}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Dialog
            onOpenChange={e => {
              setShowQuitDialog(e);
            }}
            open={showQuitDialog}
          >
            <DialogTrigger asChild>
              <Button size="sm">{t("Quit")}</Button>
            </DialogTrigger>
            <DialogContent className="w-[80%]">
              <form
                onSubmit={async event => {
                  event.preventDefault();
                  await saveWindowState(StateFlags.POSITION && StateFlags.SIZE);
                  await exit();
                }}
              >
                <DialogHeader>
                  <DialogTitle>{t("Quit UniversalOverlay")}</DialogTitle>
                  <DialogDescription>
                    {t("Are you sure you want to quit the UniversalOverlay app?")}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4">
                  <DialogClose asChild>
                    <Button variant="secondary">{t("Cancel")}</Button>
                  </DialogClose>
                  <Button variant="destructive" type="submit">
                    {t("Quit")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <Developer />
        <AppInfo />
      </div>
    </div>
  );
};
