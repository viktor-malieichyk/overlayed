import { check, type Update } from "@tauri-apps/plugin-updater";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useEffect, useState } from "react";

const CHECK_INTERVAL = 60 * 60 * 1000;
const MIN_CHECK_INTERVAL = 5 * 60 * 1000;

export const useUpdate = (enabled: boolean) => {
  const [update, setUpdate] = useState<Update | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let checking = false;
    let lastCheck = -Infinity;
    let available: Update | null = null;

    const closeUpdate = (candidate: Update | null) => {
      void candidate?.close().catch(error => console.warn("Could not close updater resource", error));
    };

    const checkForUpdate = async () => {
      if (disposed || checking || available || Date.now() - lastCheck < MIN_CHECK_INTERVAL) return;
      checking = true;
      lastCheck = Date.now();
      try {
        const result = await check({ timeout: 15000 });
        if (disposed) {
          closeUpdate(result);
        } else {
          available = result;
          setUpdate(result);
        }
      } catch (error) {
        if (!disposed) console.warn("Could not check for updates", error);
      } finally {
        checking = false;
      }
    };

    void checkForUpdate();
    const interval = window.setInterval(checkForUpdate, CHECK_INTERVAL);
    const unlisten = getCurrentWebviewWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) void checkForUpdate();
    });

    return () => {
      disposed = true;
      closeUpdate(available);
      window.clearInterval(interval);
      void unlisten.then(remove => remove()).catch(error => console.warn("Could not remove updater listener", error));
    };
  }, [enabled]);

  return enabled ? update : null;
};
