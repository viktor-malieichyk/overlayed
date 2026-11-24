import type { DirectionLR } from "@/config";
import { User } from "../components/user";
import { cn } from "@/utils/tw";
import { useAppStore } from "../store";
import { useConfigValue } from "@/hooks/use-config-value";
import { getChannelName } from "@/utils/channel";

export const ChannelView = ({
  alignDirection,
  anchored,
  pinned,
}: {
  alignDirection: DirectionLR;
  anchored: boolean;
  pinned: boolean;
}) => {
  const { users, me, currentChannel } = useAppStore();

  const { value: hideRoomName } = useConfigValue("hideRoomName");
  const { value: showOnlyTalkingUsers } = useConfigValue("showOnlyTalkingUsers");
  const { value: showOwnUser } = useConfigValue("showOwnUser");
  const { value: opacity } = useConfigValue("opacity");
  const { value: opacityTarget } = useConfigValue("opacityTarget");
  const { value: userScale } = useConfigValue("userScale");
  const { value: vertical } = useConfigValue("vertical");

  const allUsers = Object.entries(users);
  let userList = showOnlyTalkingUsers ? allUsers.filter(([, item]) => item.talking) : allUsers;

  userList = userList.filter(([, item]) => {
    if (item.id === me?.id) {
      return showOwnUser && (showOnlyTalkingUsers ? item.talking : true);
    }
    return true;
  });

  const channelName = getChannelName(currentChannel);
  const rows = userList.map(([, item]) => (
    <User
      key={item.id}
      item={item}
      alignDirection={alignDirection}
      opacity={opacityTarget === "non-speaking" && item.talking ? 100 : opacity}
      anchored={anchored}
    />
  ));

  return (
    <div
      className={
        anchored
          ? cn("flex flex-1 min-h-0 overflow-hidden", {
              "justify-start": alignDirection === "left",
              "[justify-content:safe_center]": alignDirection === "center",
              "[justify-content:safe_flex-end]": alignDirection === "right",
              "[align-items:safe_flex-end]": vertical === "bottom",
              "items-start": vertical !== "bottom",
            })
          : "h-full"
      }
    >
      <div
        data-placement-content={anchored ? "" : undefined}
        className={
          anchored
            ? cn("flex flex-col w-max shrink-0 overflow-hidden py-2", {
                "items-center": alignDirection === "center",
                "items-start": alignDirection === "left",
                "items-end": alignDirection === "right",
              })
            : cn("py-2 h-full overflow-auto", {
                "flex flex-wrap justify-center": alignDirection === "center",
                "flex flex-1 flex-col": alignDirection !== "center",
                "justify-end": alignDirection !== "center" && vertical === "bottom",
                "justify-start": alignDirection !== "center" && vertical !== "bottom",
              })
        }
        style={{ zoom: userScale / 100 }}
      >
        {pinned && !hideRoomName && channelName && (
          <div
            className="mx-2 mb-1 max-w-[280px] truncate rounded-md bg-[#282828] px-2 py-1 text-xs font-semibold text-white"
            title={channelName}
          >
            {channelName}
          </div>
        )}
        {anchored ? (
          <div
            className={cn("flex w-max shrink-0 overflow-hidden", {
              "flex-row": alignDirection === "center",
              "flex-col items-start": alignDirection === "left",
              "flex-col items-end": alignDirection === "right",
            })}
          >
            {rows}
          </div>
        ) : (
          rows
        )}
      </div>
    </div>
  );
};
