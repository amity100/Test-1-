---
metadata:
  version: "1.0"
name: multiplayer-dynamics-audit
description: "Use this skill for anything involving players interacting with players: PvP, co-op, matchmaking, competitive balance, griefing, or reading opponents. Trigger on: 'add multiplayer', 'PvP design', 'co-op review', 'players keep griefing', 'one strategy dominates ranked', 'matchmaking feels unfair', 'mind games', 'counter-play', 'stomps', 'kill stealing', 'team damage', or any request to design or audit systems where player behaviour affects other players' experience. Also trigger when a single-player game is adding multiplayer modes, or when auditing netcode-adjacent design like rank systems and lobbies. Pairs with elegance-audit for balance numbers; this skill covers the human-versus-human layer."
---

# Multiplayer Dynamics Audit

Multiplayer moves the source of challenge from designed systems to other minds. That buys endless depth for free (humans adapt forever) and imports every destructive behaviour humans bring. This skill audits the strategic layer between players and the social layer around them, in designs and repos.

 

## Core concepts

**Game theory describes the strategic skeleton.** Where one choice beats another regardless of what the opponent does, players converge on it and the interaction dies; a Nash equilibrium nobody wants to leave can make a whole mode stale. Healthy competitive designs avoid single stable answers by making the best choice depend on the opponent's choice.

**Circular counters keep prediction alive.** Rock-paper-scissors structures (and their asymmetric-payoff cousins) force mixed strategies: no pure option is safe, so players must randomise and read. Payoff asymmetry tunes how often each option should appear; a counter that wins little while risking much will vanish from play even though it "exists".

**Yomi is the skill of reading the opponent.** Layered prediction (I know that you know that I know) is the deepest well in multiplayer design, and it only opens when three conditions hold: players make choices the opponent can partially observe or infer, choices resolve against each other, and no option dominates. Designs that hide everything kill reads; designs that reveal everything kill mixups.

**Destructive behaviour is a design problem before a moderation problem.** Griefing, kill stealing, spawn camping, team-damage abuse, rage quitting, and stat padding are all behaviours some mechanic makes possible and some incentive makes attractive. Audit both halves: what the systems permit and what the reward structure quietly encourages. Divergent goals within a team (one player farming score while four push the objective) come from misaligned rewards, so fix the rewards, not the players.

**Skill differentials dominate the experience.** A modest gap between players collapses the interesting strategy space: the weaker player loses every exchange regardless of choice, which is a failure trap wearing a scoreboard. Tools: matchmaking on measured skill, asymmetric roles that let differently skilled players contribute, comeback mechanics with real but bounded force, handicaps players choose, and match lengths short enough that a stomp ends quickly.

## Design review workflow

1. **Map the strategic choices.** List the decision points where players choose against each other (loadouts, openings, engagements, timings). For each, ask whether any option dominates and whether the counter structure is circular.
2. **Check the yomi conditions.** Per decision point: can players observe or infer anything about the opponent's likely choice? Do choices resolve against each other? Is there payoff for correct reads? Points failing all three are effectively single-player.
3. **Run the misery audit.** For each mechanic that lets one player affect another, ask what the worst-intentioned player does with it, then ask what the reward system pays them for. List every behaviour that is both possible and profitable.
4. **Goal alignment check.** In team modes, compare what the scoreboard rewards against what winning requires. Every divergence is a future argument in voice chat.
5. **Differential stress test.** Describe the match experience at a large skill gap. If the answer is "the weaker player is a spectator", prescribe from the differential toolkit and check match length.

## Repo audit workflow

1. **Dominance in the numbers.** Pull the stat tables for opposing options (weapons, classes, factions) and compute matchup spreads. Options that win their intended counter and their intended weakness are coded dominance; report the matchup matrix.
2. **Grief surface census.** Grep for player-affects-player code paths: friendly fire, collision, resource stealing, shared loot rolls, vote systems, trade. For each, check what limits exist (caps, cooldowns, consent gates, reputation costs). Paths with power and no limit are pre-written grief reports.
3. **Reward attribution.** Read the scoring and XP grant sites in team modes. Flag rewards granted for actions that do not advance the win condition, and win-condition contributions that grant nothing (healing, spotting, objective time are the classic unpaid labour). This is the divergent-goals fix in code.
4. **Quit and idle handling.** Check what happens in code when a player disconnects, idles, or feeds: backfill, bots, forfeit thresholds, penalty logic. Absent handling converts one player's exit into four players' failure trap.
5. **Matchmaking inputs.** If a rating system exists, check what it measures (wins only, or performance), how fast it converges, and whether party skill is aggregated sensibly. A rating that converges over hundreds of matches guarantees months of stomps at the entry point.
6. **Information channels.** Audit what each client actually receives about opponents (positions, loadouts, cooldown states). Information sent to the client is information available to cheats and huds regardless of what the UI shows; anything read-sensitive should never leave the server.

## Output format

**Strategic choice map** with dominance and counter-circularity verdicts · **Yomi condition table** per decision point · **Misery audit**: possible-and-profitable behaviours with the mechanic and incentive behind each · **Goal alignment findings** with reward fixes · **Differential plan**: toolkit selections with bounds · **Repo findings** with file paths: matchup matrices, unlimited grief paths, unpaid contributions, quit handling gaps, oversharing to clients · **Top three changes** ranked by matches-made-miserable prevented per unit of work.
