# Full Slate

NFL and NBA projection model. Each run plays the matchup **10,000 times** and publishes the mean, not a single made-up final.

What you get back:

- Average score for each side
- Win rate, model spread, and model total
- Home-margin histogram
- Average team stats (yards, shooting, rebounds, and the rest)
- Average line for every player in the live rotation

Lineups are meant to be pulled from ESPN before the sims. Players marked out are left off the sheet. The numbers are a statistical toy. They are not a sportsbook line and they are not betting advice.

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

`SIM_COUNT` in [src/lib/sim/run.ts](src/lib/sim/run.ts) is `10_000`. Pass a live roster from [src/lib/live/pull.server.ts](src/lib/live/pull.server.ts) so the sim uses today's names instead of the fallback ratings file.

NBA team shooting and rebounding are the sum of the player means. NFL team means are accumulated inside `projectNfl`.

## Layout

| Path | What it is |
| --- | --- |
| `src/lib/sim/nfl-sim.ts` | Drive model and the 10,000-sim NFL average |
| `src/lib/sim/nba-sim.ts` | Possession model and the 10,000-sim NBA average |
| `src/lib/sim/run.ts` | `simulateMatch` entry point |
| `src/data` | Fallback ratings if a live roster is not passed |
| `src/lib/live` | ESPN roster, depth chart, and injury pull |
