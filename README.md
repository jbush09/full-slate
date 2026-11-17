# Full Slate

NFL and NBA projection model. Each run plays the matchup **10,000 times** and publishes the mean, not a single made-up final.

What you get back:

- Average score for each side
- Win rate, model spread, and model total
- Home-margin histogram
- Average team stats (yards, shooting, rebounds, and the rest)
- Average line for every player in the live rotation

Lineups are pulled from ESPN before the sims. Players marked out are left off the sheet. Questionable and day-to-day players keep a smaller share of the work.

The game script is still play-by-play. NBA runs possession by possession off the last five games (pace, shot profile, turnovers, rotation). NFL runs drive by drive off the last four games (situational calls, pace, fourth down, rotation).

On top of that script, a live pull can tilt the same game:

- Weather at the stadium: wind, temperature, and precipitation. Domes skip it.
- Style matchup: a run-heavy offense against a soft run defense leans run, and a pass offense that gives up sacks against a pressure defense takes more sacks.
- Injuries on the current sheet, including a bigger hit when the quarterback is out.
- Rest (short week or a back-to-back), Denver altitude, and divisional games.
- Head-coach meetings this season, and head-to-head margins from the last three seasons.

A separate prop run plays one listed player prop **5,000 times** against the current opponent and counts how often it hits. Finals can be pulled after the game and graded against a saved sim.

The numbers are a statistical toy. They are not a sportsbook line and they are not betting advice.

## Run

```ts
import { simulateMatch } from "./src/lib/sim/run";

const result = simulateMatch("NFL", "BUF", "KC", {
  away: liveAwayTeam,
  home: liveHomeTeam,
});

result.proj.meanAway; // average away score
result.proj.meanHome;
result.proj.awayAvg;  // NFL team means (yards, sacks, possession)
result.proj.awayPlayers;
```

`SIM_COUNT` in [src/lib/sim/run.ts](src/lib/sim/run.ts) is `10_000`. Pass a live roster from [src/lib/live/pull.server.ts](src/lib/live/pull.server.ts) so the sim uses today's names, weather, and matchup spot instead of the fallback ratings file. Prop hit rates live in [src/lib/sim/props.ts](src/lib/sim/props.ts) (`PROP_SIMS` is `5_000`).

NBA team shooting and rebounding are the sum of the player means. NFL team means are accumulated inside `projectNfl`.

## Layout

| Path | What it is |
| --- | --- |
| `src/lib/sim/nfl-sim.ts` | Drive model and the 10,000-sim NFL average |
| `src/lib/sim/nba-sim.ts` | Possession model and the 10,000-sim NBA average |
| `src/lib/sim/props.ts` | 5,000-sim hit rate for one listed prop |
| `src/lib/sim/run.ts` | `simulateMatch` entry point |
| `src/lib/props.ts` | Prop market names |
| `src/lib/record.ts` | Grade a saved sim against the final |
| `src/data` | Fallback ratings if a live roster is not passed |
| `src/lib/live` | ESPN roster, injuries, weather, style, coaches, head-to-head, and finals |
