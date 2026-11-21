---
metadata:
  version: "1.0"
name: reward-psychology-audit
description: "Use this skill for anything involving rewards, progression, retention, or player motivation. Trigger on: 'design my progression system', 'loot design', 'daily rewards', 'players grind but seem miserable', 'is my game addictive in a bad way', 'battle pass review', 'XP curve', 'retention mechanics', 'reward schedule', or any request to design or audit reward loops in a design or repo. Always run the ethics check in this skill when reward systems target retention or monetisation; flag manipulative patterns even when not asked."
---

# Reward Psychology Audit

Reward systems steer behaviour whether or not the designer intends it. The same machinery that makes progression satisfying can make a game compulsive and joyless, and players feel the difference even when they keep playing. This skill designs reward loops that motivate toward fun and audits existing ones for misalignment and manipulation.

 

## Core concepts

**Wanting and liking are different circuits.** Anticipation of a reward drives action; the pleasure of receiving it is separate and smaller. Systems can make players want intensely without liking at all. A game that players cannot stop playing but do not enjoy has captured wanting and abandoned liking; treat that as a defect, not a retention win.

**Reinforcement schedules shape behaviour predictably.** Fixed-ratio rewards (every Nth action) produce bursts of effort then pauses after payout. Variable-ratio rewards (random chance per action) produce steady, persistent, hard-to-extinguish behaviour; this is the slot-machine schedule and the reason loot rolls are so gripping. Real games superimpose several schedules, and schedules also emerge uninvited from mechanics (drop tables, spawn odds). Know which schedules a design is running, including the accidental ones.

**Extrinsic rewards can crowd out intrinsic joy.** Paying players (XP, badges, currency) for an activity they already enjoy reframes the activity as work; remove the payment later and enjoyment does not return. Reserve extrinsic rewards for bridging players into activities whose intrinsic fun takes time to reach, and keep them light where the activity carries itself.

**Alignment is the core test.** Rewards should point at play the game is proud of. Misaligned rewards manufacture grind: if the XP-optimal path is repetitive and dull, players will take it and resent it, because reward systems outvote fun in guiding behaviour.

**Player's remorse is the tell.** The signature of a manipulative loop is a player who, after stopping, regrets the time spent. Compulsion metrics (session length, streaks) cannot distinguish a loved game from a trap; regret can. Design so that a player looking back endorses the time they gave.

## Design review workflow

1. **Map the reward graph.** Every reward source, its schedule (fixed, variable, interval), its magnitude, and the behaviour it reinforces.
2. **Alignment check.** For each reward: is the reinforced behaviour fun on its own terms? Would the dev showcase it in a trailer? Rewards pointing at dull behaviour get realigned or removed.
3. **Schedule check.** Identify emergent schedules from drop tables and probabilities. Look for unintended variable-ratio loops on trivial actions; these produce zombie grinding.
4. **Crowding-out check.** Find activities that are intrinsically strong but heavily paid. Recommend easing extrinsic weight before the payment becomes the point.
5. **Ethics check (mandatory).** Flag: streak mechanics that punish absence, fear-of-missing-out timers, variable-ratio rewards attached to purchases, pity systems tuned to sell rather than relieve, and any loop whose engagement depends on anxiety. For each flag, state the player-respecting alternative. Run this even when the user did not ask.

## Repo audit workflow

1. **Reward source census.** Grep for grant sites: XP awards, currency adds, drop-table rolls, achievement triggers. Build the actual reward graph from code; it usually differs from the design doc, and the differences are findings.
2. **Drop-table analysis.** Read the probability tables and compute expected actions per meaningful reward. Report loops where expected cost in repetitive actions is high and the reinforced action is low-engagement; that is coded grind.
3. **Schedule reconstruction.** Classify each grant site by schedule. Flag variable-ratio schedules on purchase-adjacent actions immediately.
4. **Stacking and inflation.** Check for multiplicative reward stacking (event bonus times subscription bonus times streak bonus) with no cap, and currency faucets with no sinks; both flatten the value of every reward over time.
5. **Time-pressure mechanics.** Locate daily-reset logic, streak counters, expiring rewards. For each, report what a player loses by taking a week off. Systems that punish rest are retention debt; the audit should price it.
6. **Telemetry honesty.** If analytics exist, check whether anything measures satisfaction (completion of self-chosen goals, return-after-break) rather than raw engagement. Recommend one regret-sensitive metric if none exists.

## Output format

**Reward graph** (source, schedule, magnitude, behaviour) from design and from code, with mismatches · **Alignment findings**: rewards pointing at dull play, with realignment per item · **Emergent schedule findings** · **Ethics flags** with player-respecting alternatives, always included · **Repo findings** with file paths: grind loops with expected-action counts, uncapped stacking, punitive resets · **Top three changes** ranked by motivation health per unit of work.
