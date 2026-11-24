import { useTranslation } from "@/i18n";
import Config from "@/config";
import { useConfigValue } from "@/hooks/use-config-value";
import { emit } from "@tauri-apps/api/event";
import { Updater } from "@/components/updater";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Account } from "./account";
import { JoinHistory } from "./join-history";
import { useSearchParams } from "react-router-dom";
import { usePlatformInfo } from "@/hooks/use-platform-info";
import { FORK_REPOSITORY, UPSTREAM_REPOSITORY } from "@/constants";
import { useUpdate } from "@/hooks/use-update";
import { Configuration } from "./configuration";
import { Placement } from "./placement";
import { Hotkeys } from "./hotkeys";

export const SettingsView = () => {
  const t = useTranslation();
  const { value: language } = useConfigValue("language");
  const { canary, os, arch } = usePlatformInfo();
  const update = useUpdate(!canary && os === "windows" && arch === "x86_64");
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const currentTab =
    requestedTab && ["account", "configuration", "placement", "hotkeys", "join-history"].includes(requestedTab)
      ? requestedTab
      : "account";
  return (
    <div className="min-h-0 w-full flex-1 bg-zinc-900">
      <Tabs
        className="flex h-full min-h-0 flex-col"
        value={currentTab}
        onValueChange={tab => setSearchParams({ tab }, { replace: true })}
      >
        <TabsList className="grid w-full shrink-0 grid-cols-5 rounded-t-none [&>button]:whitespace-normal [&>button]:px-2 [&>button]:leading-tight">
          <TabsTrigger value="account">{t("General")}</TabsTrigger>
          <TabsTrigger value="configuration">{t("Overlay")}</TabsTrigger>
          <TabsTrigger value="placement">{t("Position")}</TabsTrigger>
          <TabsTrigger value="hotkeys">{t("Hotkeys")}</TabsTrigger>
          <TabsTrigger value="join-history">{t("History")}</TabsTrigger>
        </TabsList>
        {canary && (
          <div className="shrink-0 bg-yellow-400 px-4 py-2 text-center text-sm font-medium text-black">
            <a target="_blank" rel="noreferrer" href={`${FORK_REPOSITORY}/releases`}>
              <p>{t("The canary build may be unstable (click to learn more)")}</p>
            </a>
          </div>
        )}
        {update && (
          <div hidden={currentTab !== "account"} className="px-4 pt-3">
            <Updater update={update} />
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-hidden text-sm">
          <TabsContent tabIndex={-1} value="account" className="settings-panel">
            <div className="settings-row mb-4">
              <label htmlFor="language">{t("Language")}</label>
              <select
                id="language"
                className="settings-select"
                value={language}
                onChange={async event => {
                  await Config.set("language", event.target.value === "uk" ? "uk" : "en");
                  await emit("config_update", await Config.getConfig());
                }}
              >
                <option value="en" lang="en">
                  English
                </option>
                <option value="uk" lang="uk">
                  Українська
                </option>
              </select>
            </div>
            <Account />
          </TabsContent>
          <TabsContent tabIndex={-1} value="configuration" className="settings-panel">
            <Configuration />
          </TabsContent>
          <TabsContent tabIndex={-1} value="placement" className="settings-panel">
            <Placement />
          </TabsContent>
          <TabsContent tabIndex={-1} value="hotkeys" className="settings-panel">
            <Hotkeys />
          </TabsContent>
          <TabsContent tabIndex={-1} value="join-history" className="settings-panel settings-history-panel">
            <JoinHistory />
          </TabsContent>
        </div>
        <div className="flex min-h-10 w-full shrink-0 flex-wrap items-center gap-x-4 gap-y-2 bg-zinc-800 px-4 py-2 text-sm">
          <a className="text-blue-400" target="_blank" rel="noreferrer" href={FORK_REPOSITORY}>
            {t("UniversalOverlay on GitHub")}
          </a>
          <a className="text-blue-400" target="_blank" rel="noreferrer" href={UPSTREAM_REPOSITORY}>
            {t("Original Overlayed project on GitHub")}
          </a>
        </div>
      </Tabs>
    </div>
  );
};
