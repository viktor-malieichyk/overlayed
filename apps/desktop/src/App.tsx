import { Routes, Route, useLocation } from "react-router-dom";
import { MainView } from "./views/main";
import { ChannelView } from "./views/channel";

import { SettingsView } from "./views/settings";
import { ErrorView } from "./views/error";
import { NavBar } from "./components/nav-bar";
import { usePin } from "./hooks/use-pin";
import { usePlacement } from "./hooks/use-placement";
import { useHotkeys } from "./hooks/use-hotkeys";
import { useAlign } from "./hooks/use-align";
import { useDisableWebFeatures } from "./hooks/use-disable-context-menu";
import { useAppStore } from "./store";
import { Toaster } from "./components/ui/toaster";
import { useConfigValue } from "@/hooks/use-config-value";
import { useEffect } from "react";
import { useSocket } from "./rpc/manager";
import { cn } from "./utils/tw";
import Config from "./config";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

function App() {
  useDisableWebFeatures();
  useSocket();
  const { value: language } = useConfigValue("language");
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const styleForLog = "font-size: 20px; color: #00dffd";
    console.log(`%cUniversalOverlay ${window.location.hash} Window`, styleForLog);
  }, []);

  useEffect(() => {
    if (getCurrentWebviewWindow().label !== "main") return;

    Config.get("taskbarHideMode")
      .then(mode => invoke("set_taskbar_hide_mode", { mode }))
      .catch(error => console.error("Could not restore taskbar visibility preference", error));
  }, []);

  const { visible } = useAppStore();

  const location = useLocation();
  const connected = useAppStore(state => state.me !== null) && location.pathname === "/channel";
  const { pin } = usePin(connected);
  useHotkeys();
  const { horizontal, setHorizontalDirection } = useAlign();
  const visibleClass = visible ? "opacity-100" : "opacity-0";
  const { anchored, channelPlacement, displayOnly, rootRef } = usePlacement(pin, location.pathname);
  const isSettingsWindow = location.pathname === "/settings";

  return (
    <div
      ref={rootRef}
      className={cn(
        `text-white h-screen select-none rounded-lg flex flex-col font-sans text-sm ${visibleClass}`,
        channelPlacement && "overflow-hidden",
        // A fully transparent Windows overlay pixel passes clicks through to the app underneath.
        visible && !pin && !isSettingsWindow && "bg-black/5",
        // Only show the border on the overlay (main) window when not pinned.
        pin || isSettingsWindow ? null : "border border-zinc-600"
      )}
    >
      {!displayOnly && (
        <>
          <NavBar
            pin={pin}
            alignDirection={horizontal}
            setAlignDirection={setHorizontalDirection}
          />
          <Toaster />
        </>
      )}
      <Routes>
        <Route path="/" element={<MainView />} />
        <Route path="/channel" element={<ChannelView alignDirection={horizontal} anchored={anchored} pinned={pin} />} />
        <Route path="/settings" element={<SettingsView />} />
        <Route path="/error" element={<ErrorView anchored={anchored} />} />
      </Routes>
    </div>
  );
}

export default App;
