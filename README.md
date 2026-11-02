# Full Slate

NFL and NBA projection model. Each run plays the matchup **10,000 times** and publishes the mean, not a single made-up final.

What you get back:

- Average score for each side
- Win rate, model spread, and model total
- Home-margin histogram
- Average team stats (yards, shooting, rebounds, and the rest)
- Average line for every player in the live rotation

Lineups are pulled from ESPN before the sims. Players marked out are left off the sheet.

When that matchup has a posted number, the score, win rate, and total are blended toward it (about half early, less as the season sample grows). Player lines stay on the sim. Team ratings and usage shares lean on this year's stats, and a thin starter inherits a starter's share of the work. Drives react to the score: a two-score lead in the second half shortens the game script, and a team playing from behind passes more. Yardage and pace use a skewed draw. Outdoor NFL games also read the wind, and 15 mph or more cuts the pass rate, deep yards, and long field goals.

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

`SIM_COUNT` in [src/lib/sim/run.ts](src/lib/sim/run.ts) is `10_000`. Pass a live roster from [src/lib/live/pull.server.ts](src/lib/live/pull.server.ts) so the sim uses today's names instead of the fallback ratings file.

NBA team shooting and rebounding are the sum of the player means. NFL team means are accumulated inside `projectNfl`.

## Layout

| Path | What it is |
| --- | --- |
| `src/lib/sim/nfl-sim.ts` | Drive model and the 10,000-sim NFL average |
| `src/lib/sim/nba-sim.ts` | Possession model and the 10,000-sim NBA average |
| `src/lib/sim/run.ts` | `simulateMatch` entry point |
| `src/data` | Fallback ratings if a live roster is not passed |
| `src/lib/live` | ESPN roster, depth chart, injury pull, market line, and wind |
