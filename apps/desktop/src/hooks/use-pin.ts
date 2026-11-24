import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import Config from "../config";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

export const usePin = (connected = false) => {
  const [pin, setPin] = useState(false);
  useEffect(() => {
    let gotEvent = false;
    const unlisten = listen<{ pinned: boolean; remember: boolean }>("toggle_pin", event => {
      gotEvent = true;
      const { pinned, remember } = event.payload;
      setPin(pinned);
      if (remember && getCurrentWebviewWindow().label === "main") {
        void Config.set("pin", pinned).catch(error => console.warn("Could not save the pin preference", error));
      }
    });

    // Sync the state once the listener is registered, without overriding
    // a newer value that already arrived as an event (e.g. from startPinned)
    unlisten
      .then(() => invoke<boolean>("get_pin"))
      .then(pin => {
        if (!gotEvent) setPin(pin);
      });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  useEffect(() => {
    if (getCurrentWebviewWindow().label !== "main") return;
    let active = true;
    const preference = connected ? Config.get("pin") : Promise.resolve(false);
    void preference
      .then(preferredPin => {
        if (active) return invoke("set_overlay_connection", { connected, preferredPin });
      })
      .catch(error => console.warn("Could not update overlay connection state", error));
    return () => {
      active = false;
    };
  }, [connected]);

  return { pin };
};
