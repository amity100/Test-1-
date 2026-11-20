---
metadata:
  version: "1.0"
name: skill-curve-audit
description: "Use this skill for anything involving difficulty, learning curves, player skill, or failure states. Trigger on: 'my game is too hard/too easy', 'players rage quit', 'new players bounce off', 'veterans get bored', 'difficulty settings review', 'tutorial design', 'players get stuck', 'softlock', 'checkpoint design', 'how should failure work', or any request to audit difficulty tuning, onboarding, or failure handling in a design or repo. Also trigger when playtest data shows a sharp drop-off at a specific point in the game."
---

# Skill Curve Audit

Every game teaches a skill and then tests it. The design questions are how deep the skill goes, how wide the range of players it serves, and what happens when a player fails the test. This skill audits all three, in designs and in code.

## Core concepts

**Depth and accessibility are separate axes.** Depth is how far mastery can go before returns stop. Accessibility is how little a beginner needs before play becomes possible. Chess is deep and moderately accessible; a good design pushes both instead of trading one for the other by default.

**Skill range is the band of player ability the game serves.** Below the floor, the game is impenetrable; above the ceiling, it is solved and dull. Widen the band with elastic challenges (goals that scale with performance: score tiers, optional objectives, self-set constraints), reinvention (new mechanics that reset part of the learning curve mid-game), and difficulty options.

**Difficulty modification has flavours.** Explicit menus, adaptive systems that watch performance, and player-directed difficulty (choosing risky routes or handicaps). Hidden adaptive help preserves pride but risks feeling patronising when noticed; explicit menus are honest but force self-assessment before the player has information.

**Failure must carry meaning without trapping.** Failure gives decisions their stakes, and it must return the player to play quickly with something learned. The pathology is the failure trap: a stretch of play where loss is already guaranteed but the player is forced to keep going, or a repeating cycle the player cannot escape (a checkpoint saved in an unwinnable state, an economy hole with no floor, a fight that requires resources the player can no longer obtain).

**Emotional support around failure matters.** Fast restarts, low ceremony on death, and framing that blames the attempt rather than the player keep frustration productive. Long reload times and lost progress convert challenge into punishment.

## Design review workflow

1. **State the core skills.** What is the player actually getting better at? (Aim, routing, resource judgement, reading tells, deck knowledge.) A game whose devs cannot name its skills usually has a flat curve.
2. **Trace the learning path.** Where is each skill introduced, practised in safety, then tested? Flag skills tested before taught and skills taught then never tested.
3. **Find the floor and ceiling.** What must a first-session player already know? What does a hundred-hour player still have left to learn? Estimate the band and compare it to the intended audience.
4. **Audit failure loops.** For each failure state: what does the player lose, how long until they are playing again, and what did the failure teach? Anything over roughly thirty seconds of ceremony per death needs a reason.
5. **Hunt failure traps.** Walk the resource and checkpoint model looking for states that are lost-but-not-over or repeatably unwinnable. Prescribe the standard escapes: floors on critical resources, fallback tools that cannot run out, surrender or restart affordances, hint escalation on repeated failure, checkpoint validation.

## Repo audit workflow

1. **Difficulty parameter map.** Locate every knob that scales challenge (enemy HP/damage multipliers, timer lengths, spawn rates, AI reaction times). Report where they live and whether they route through one difficulty system or are scattered. Scattered knobs mean difficulty settings silently miss content.
2. **Checkpoint state audit.** Inspect what the save/checkpoint system serialises. Flag checkpoints that can capture unwinnable states: saving with zero critical resource, saving mid-scripted-sequence, saving after a point of no return without validating the player can proceed. This is the highest-value single check in the workflow; softlocks live here.
3. **Resource floor check.** For each consumable required to progress (ammo, keys, currency, fuel), verify a regeneration path or fallback exists in code, and that it is reachable from every state. Grep for the decrement sites and trace whether any state has no increment path.
4. **Failure ceremony timing.** Measure or read the death-to-play path: animations, loads, menus, unskippable screens. Report the sequence and estimated duration.
5. **Adaptive systems.** If dynamic difficulty exists, check its inputs and clamps. Unclamped adaptive systems oscillate; systems keyed to a single metric (deaths only) misread players who fail in unusual ways.
6. **Telemetry hooks.** Check whether failure locations and retry counts are logged at all. Without them, "too hard" reports cannot be localised. If absent, recommend the three cheapest hooks: death position, retry count per encounter, and quit point.

## Output format

**Named core skills** · **Learning path trace** with taught/tested gaps · **Skill range estimate** versus target audience · **Failure loop table**: state, cost, time-to-play, lesson · **Failure trap findings** with reproduction path and prescribed escape, file paths included for repo audits · **Difficulty system findings**: parameter map, checkpoint risks, resource floors · **Top three changes** ranked by drop-off reduction per unit of work.
