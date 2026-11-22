import { useTranslation } from "@/i18n";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import Config, { type OpacityTarget, type TaskbarHideMode } from "@/config";
import { useConfigValue } from "@/hooks/use-config-value";
import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

export const Configuration = () => {
  const t = useTranslation();
  const { value: hideRoomName } = useConfigValue("hideRoomName");
  const { value: showOnlyTalkingUsers } = useConfigValue("showOnlyTalkingUsers");
  const { value: opacity } = useConfigValue("opacity");
  const { value: opacityTarget } = useConfigValue("opacityTarget");
  const { value: vertical } = useConfigValue("vertical");
  const { value: horizontal } = useConfigValue("horizontal");
  const { value: maxUsernameLength } = useConfigValue("maxUsernameLength");
  const { value: userScale } = useConfigValue("userScale");
  const { value: taskbarHideMode } = useConfigValue("taskbarHideMode");
  const { value: placementMode } = useConfigValue("placementMode");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between mt-2 h-8 mx-2">
        <label htmlFor="hide-room-name" className="text-sm font-medium">
          {t("Hide room name")}
        </label>
        <Switch
          id="hide-room-name"
          checked={hideRoomName}
          onCheckedChange={async checked => {
            await Config.set("hideRoomName", checked);
            await emit("config_update", await Config.getConfig());
          }}
        />
      </div>
      <div className="flex items-center justify-between h-8 mx-2">
        <label
          htmlFor="notification"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {t("Only show users who are speaking")}
        </label>
        <Switch
          id="notification"
          checked={showOnlyTalkingUsers}
          onCheckedChange={async () => {
            const newBool = !showOnlyTalkingUsers;
            await Config.set("showOnlyTalkingUsers", newBool);

            await emit("config_update", await Config.getConfig());
          }}
        />
      </div>
      <div className="flex items-center justify-between h-8 mx-2">
        <label
          htmlFor="maxUsernameLength"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {t("Max username length")}
        </label>
        <div className="flex items-center gap-4 w-1/2">
          <div className="flex-1">
            <Slider
              value={[maxUsernameLength]}
              min={4}
              max={60}
              step={1}
              onValueChange={async (val: number[]) => {
                const newVal = val[0] ?? maxUsernameLength;
                await Config.set("maxUsernameLength", Number(newVal));
                await emit("config_update", await Config.getConfig());
              }}
            />
          </div>
          <div className="w-10 text-right">
            <span className="text-sm">{maxUsernameLength}</span>
          </div>
        </div>
      </div>
      {placementMode === "anchored" && (
        <p className="text-xs text-zinc-400 mx-2">{t("Alignment follows the fixed position.")}</p>
      )}
      <div className={placementMode === "anchored" ? "hidden" : "flex items-center justify-between h-8 mx-2"}>
        <label
          htmlFor="horizontal"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {t("Anchor horizontal")}
        </label>
        <select
          id="horizontal"
          value={horizontal}
          onChange={async event => {
            const newTarget = event.target.value as "left" | "center" | "right";
            await Config.set("horizontal", newTarget);

            await emit("config_update", await Config.getConfig());
          }}
          className="w-40 p-1 rounded border bg-zinc-800 text-white outline-none focus:ring-0 cursor-pointer"
        >
          <option value="left" className="bg-zinc-800 text-white">
            {t("Left")}
          </option>
          <option value="center" className="bg-zinc-800 text-white">
            {t("Center")}
          </option>
          <option value="right" className="bg-zinc-800 text-white">
            {t("Right")}
          </option>
        </select>
      </div>
      <div className={placementMode === "anchored" ? "hidden" : "flex items-center justify-between h-8 mx-2"}>
        <label
          htmlFor="vertical"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {t("Anchor vertical")}
        </label>
        <select
          id="vertical"
          value={vertical}
          onChange={async event => {
            const newTarget = event.target.value as "top" | "bottom";
            await Config.set("vertical", newTarget);

            await emit("config_update", await Config.getConfig());
          }}
          className="w-40 p-1 rounded border bg-zinc-800 text-white outline-none focus:ring-0 cursor-pointer"
        >
          <option value="top" className="bg-zinc-800 text-white">
            {t("Top")}
          </option>
          <option value="bottom" className="bg-zinc-800 text-white">
            {t("Bottom")}
          </option>
        </select>
      </div>
      <div className="flex items-center justify-between h-8 mx-2">
        <label
          htmlFor="opacityTarget"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {t("Opacity target")}
        </label>
        <select
          id="opacityTarget"
          value={opacityTarget}
          onChange={async event => {
            const newTarget = event.target.value as OpacityTarget;
            await Config.set("opacityTarget", newTarget);

            await emit("config_update", await Config.getConfig());
          }}
          className="p-1 rounded border bg-zinc-800 text-white outline-none focus:ring-0 cursor-pointer"
        >
          <option value="all" className="bg-zinc-800 text-white">
            {t("Fade quiet users")}
          </option>
          <option value="entire-overlay" className="bg-zinc-800 text-white">
            {t("Entire voice overlay")}
          </option>
          <option value="username-box" className="bg-zinc-800 text-white">
            {t("Username background only")}
          </option>
        </select>
      </div>
      <div className="flex items-center justify-between h-8 mx-2">
        <label
          htmlFor="opacity"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {t("Overlay opacity")}
        </label>
        <div className="flex items-center gap-4 w-1/2">
          <div className="flex-1">
            <Slider
              aria-label={t("Overlay opacity")}
              value={[opacity]}
              min={1}
              max={100}
              step={1}
              onValueChange={async (val: number[]) => {
                const newVal = val[0] ?? opacity;
                await Config.set("opacity", Number(newVal));
                await emit("config_update", await Config.getConfig());
              }}
            />
          </div>
          <div className="w-10 text-right">
            <span className="text-sm">{opacity} %</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between h-8 mx-2">
        <label
          htmlFor="userScale"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {t("Overlay size")}
        </label>
        <div className="flex items-center gap-4 w-1/2">
          <div className="flex-1">
            <Slider
              aria-label={t("Overlay size")}
              value={[userScale]}
              min={50}
              max={200}
              step={5}
              onValueChange={async (val: number[]) => {
                const newVal = val[0] ?? userScale;
                await Config.set("userScale", Number(newVal));
                await emit("config_update", await Config.getConfig());
              }}
            />
          </div>
          <div className="w-16 text-right">
            <span className="text-sm">{userScale} %</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between h-8 mx-2">
        <label
          htmlFor="hideTaskbar"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {t("Hide overlay from taskbar")}
        </label>
        <select
          id="hideTaskbar"
          value={taskbarHideMode}
          onChange={async event => {
            const mode = event.target.value as TaskbarHideMode;
            await Config.set("taskbarHideMode", mode);
            await invoke("set_taskbar_hide_mode", { mode });
            await emit("config_update", await Config.getConfig());
          }}
          className="w-40 p-1 rounded border bg-zinc-800 text-white outline-none focus:ring-0 cursor-pointer"
        >
          <option value="never">{t("Never")}</option>
          <option value="pinned">{t("When pinned")}</option>
          <option value="always">{t("Always")}</option>
        </select>
      </div>
    </div>
  );
};
