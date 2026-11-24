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
    <div className="settings-stack">
      <div className="settings-row">
        <label htmlFor="hide-room-name">{t("Hide channel name")}</label>
        <Switch
          id="hide-room-name"
          checked={hideRoomName}
          onCheckedChange={async checked => {
            await Config.set("hideRoomName", checked);
            await emit("config_update", await Config.getConfig());
          }}
        />
      </div>
      <div className="settings-row">
        <label htmlFor="notification">{t("Only show users who are speaking")}</label>
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
      <div className="settings-row">
        <label htmlFor="maxUsernameLength">{t("Maximum username length")}</label>
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
        <p className="settings-hint">{t("Alignment follows the fixed position.")}</p>
      )}
      <div className={placementMode === "anchored" ? "hidden" : "settings-row"}>
        <label htmlFor="horizontal">{t("Horizontal alignment")}</label>
        <select
          id="horizontal"
          value={horizontal}
          onChange={async event => {
            const newTarget = event.target.value as "left" | "center" | "right";
            await Config.set("horizontal", newTarget);

            await emit("config_update", await Config.getConfig());
          }}
          className="settings-select w-52"
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
      <div className={placementMode === "anchored" ? "hidden" : "settings-row"}>
        <label htmlFor="vertical">{t("Vertical alignment")}</label>
        <select
          id="vertical"
          value={vertical}
          onChange={async event => {
            const newTarget = event.target.value as "top" | "bottom";
            await Config.set("vertical", newTarget);

            await emit("config_update", await Config.getConfig());
          }}
          className="settings-select w-52"
        >
          <option value="top" className="bg-zinc-800 text-white">
            {t("Top")}
          </option>
          <option value="bottom" className="bg-zinc-800 text-white">
            {t("Bottom")}
          </option>
        </select>
      </div>
      <div className="settings-row">
        <label htmlFor="opacityTarget">{t("Opacity target")}</label>
        <select
          id="opacityTarget"
          value={opacityTarget}
          onChange={async event => {
            const newTarget = event.target.value as OpacityTarget;
            await Config.set("opacityTarget", newTarget);

            await emit("config_update", await Config.getConfig());
          }}
          className="settings-select w-1/2"
        >
          <option value="all-users" className="bg-zinc-800 text-white">
            {t("All users")}
          </option>
          <option value="non-speaking" className="bg-zinc-800 text-white">
            {t("Only users who aren’t speaking")}
          </option>
        </select>
      </div>
      <div className="settings-row">
        <label htmlFor="opacity">{t("Overlay opacity")}</label>
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
            <span className="text-sm">{opacity}%</span>
          </div>
        </div>
      </div>
      <div className="settings-row">
        <label htmlFor="userScale">{t("Overlay size")}</label>
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
            <span className="text-sm">{userScale}%</span>
          </div>
        </div>
      </div>
      <div className="settings-row">
        <label htmlFor="hideTaskbar">{t("Hide window from the taskbar")}</label>
        <select
          id="hideTaskbar"
          value={taskbarHideMode}
          onChange={async event => {
            const mode = event.target.value as TaskbarHideMode;
            await Config.set("taskbarHideMode", mode);
            await invoke("set_taskbar_hide_mode", { mode });
            await emit("config_update", await Config.getConfig());
          }}
          className="settings-select w-52"
        >
          <option value="never">{t("Never")}</option>
          <option value="pinned">{t("When pinned")}</option>
          <option value="always">{t("Always")}</option>
        </select>
      </div>
    </div>
  );
};
