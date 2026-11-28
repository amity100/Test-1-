---
metadata:
  version: "1.1"
name: game-design-director
description: "The orchestrator for the game design skill suite. Use this skill FIRST for any broad, multi-lens, or ambiguous game design request, and whenever the user extends scope mid-conversation. Trigger on: 'review my game', 'full design audit', 'audit my repo', 'why isn't my game fun', 'what's wrong with my game', 'design pass on everything', 'add in the multiplayer aspects too', 'now look at the rewards side', 'what about the story', 'run the other lenses', or any request that spans more than one design domain or names no specific domain. Also trigger when the user asks which design skill applies, or asks to continue a previous audit with more coverage. Routes to and sequences: emotion-engine-audit, elegance-audit, skill-curve-audit, game-narrative-tools, decision-flow-audit, reward-psychology-audit, game-interface-audit, game-feel-audit, multiplayer-dynamics-audit, playtest-protocol."
---

# Game Design Director

Ten specialist skills audit a game from different angles. This skill decides which to run, in what order, and how to merge their findings into one report instead of nine. It also handles scope extensions: when the user says something like "add in the multiplayer aspects too", this skill maps that phrase to the right specialist, runs it against the material already in context, and integrates the new findings with the existing report rather than starting over.

Nine specialists adapt concepts from Tynan Sylvester's *Designing Games* (O'Reilly, 2013); game-feel-audit adapts Jan Willem Nijman's "The Art of Screenshake" talk (Vlambeer, 2013). Never reproduce either source's text.

## The routing table

Match the user's request to lenses. Requests often need two or three; run the minimum set that covers the ask.

| User signal | Skill to read and run |
|---|---|
| Boring, flat, "not fun", unclear feature value, feedback-starved moments | emotion-engine-audit |
| Bloat, feature creep, dominant strategy, exploit, special-case code, balance numbers | elegance-audit |
| Too hard/easy, rage quits, stuck players, softlocks, tutorials, difficulty settings | skill-curve-audit |
| Story, dialogue, lore, agency, LLM narration, emergent drama, worldbuilding | game-narrative-tools |
| Choices feel obvious/random, overwhelm, dead time, AI readability, info on screen | decision-flow-audit |
| Progression, loot, grind, retention, streaks, monetisation-adjacent loops | reward-psychology-audit |
| HUD, controls, input feel, latency, guidance, popups, accessibility | game-interface-audit |
| Flat/weak/floaty action, juice, screenshake, hitstop, impact, camera feel, polish pass | game-feel-audit |
| PvP, co-op, griefing, matchmaking, reads and mixups, team incentives | multiplayer-dynamics-audit |
| What to build next, playtest design, feedback interpretation, roadmap, prototyping | playtest-protocol |

To run a specialist: locate its SKILL.md by name in the available skills and read it before producing that section of the audit. Never improvise a lens from this table's one-line summary; the specialist holds the actual checks.

## Sequencing a full audit

When the user asks for a full review, run lenses in dependency order, since later lenses assume earlier answers:

1. **emotion-engine-audit** first, always. It produces the experiential target every other lens judges against. Without it, elegance cuts the wrong mechanics and interface polishes the wrong signals.
2. **Structure lenses** second, selected by what the game is: elegance-audit and decision-flow-audit for systems-driven games, game-narrative-tools for story-driven ones, multiplayer-dynamics-audit where players meet players. Most games need two of these.
3. **Surface lenses** third: skill-curve-audit, game-interface-audit, game-feel-audit, reward-psychology-audit. These tune the delivery of whatever structure survived step 2. game-feel-audit in particular must run after the structure lenses; juicing a loop that elegance-audit is about to change is wasted polish.
4. **playtest-protocol** last, converting all findings into an ordered backlog and the single next test. A full audit that ends without a next action is a document, and documents do not fix games.

For repo audits, run each selected specialist's repo workflow against the codebase and pool the file-path findings; overlaps between lenses (the same module flagged by two specialists) rank highest.

## Handling scope extensions

When the user extends an audit mid-conversation ("add the multiplayer aspects too", "what about rewards", "now the story side"):

1. Map the phrase via the routing table and read that specialist.
2. Run it against the material already established: the same game, the same experiential target, the same repo. Do not re-ask for context the conversation already contains.
3. Integrate, do not append. Cross-reference the new findings against the existing report: a mechanic the elegance pass marked for cutting may be the anchor of the multiplayer pass's counter structure, and the merged report must resolve that conflict explicitly rather than shipping both recommendations.
4. Re-rank the combined top-three changes. New lenses change priorities; a report whose priority list predates its newest section is stale.

## Conflict resolution between lenses

Specialists disagree by design; the director arbitrates. Default precedence when findings conflict:

1. The experiential target wins. A recommendation that scores well on its own lens but pulls against the stated feeling of the game loses.
2. Structural fixes beat surface fixes. Do not recommend interface polish for a problem elegance-audit traced to a dead mechanic.
3. Player wellbeing beats retention. reward-psychology-audit's ethics flags are never overridden by engagement arguments from any other lens.
4. Cheapest-test-first breaks remaining ties, per playtest-protocol: prefer the recommendation whose validity a graybox can check this week.

State every arbitration in the report. Silent conflict resolution reads as inconsistency when the user later reads the specialist sections.

## Output format for multi-lens audits

One merged report, never one report per lens: **Experiential target** · **Findings by theme, not by skill** (group by the problem, cite which lenses flagged it; multi-lens hits first) · **Conflicts and arbitrations** · **Repo findings table**: file path, issue, flagging lens or lenses · **Top three changes** across all lenses · **Next test**, from playtest-protocol.

For single-lens routed requests, use the specialist's own output format and note at the end which adjacent lens would pay off next, in one sentence, only if one clearly would.
