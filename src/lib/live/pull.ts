import { createServerFn } from "@tanstack/react-start";
import type { League } from "@/lib/sim/types";
import type { LiveLineup, LiveSlate } from "@/lib/live/types";

export type { LiveLineup, LiveRosterPlayer, LiveSlate, LiveSpot, SlateChip } from "@/lib/live/types";

type PullInput = { league: League; awayId: string; homeId: string; force?: boolean };

export const pullLiveLineup = createServerFn({ method: "POST" })
  .validator((input: PullInput) => {
    if (input?.league !== "NFL" && input?.league !== "NBA") throw new Error("Pick a league");
    if (!input.awayId || !input.homeId || input.awayId === input.homeId) throw new Error("Pick two different teams");
    return input;
  })
  .handler(async ({ data }): Promise<LiveLineup> => {
    const { pullMatchup } = await import("./pull.server");
    return pullMatchup(data);
  });

export const listLiveSlate = createServerFn({ method: "POST" })
  .validator((input: { league: League }) => {
    if (input?.league !== "NFL" && input?.league !== "NBA") throw new Error("Pick a league");
    return input;
  })
  .handler(async ({ data }): Promise<LiveSlate> => {
    const { listSlate } = await import("./pull.server");
    return listSlate(data.league);
  });
