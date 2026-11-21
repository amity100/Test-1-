---
metadata:
  version: "1.0"
name: decision-flow-audit
description: "Use this skill when gameplay decisions feel flat, obvious, overwhelming, or random. Trigger on: 'choices don't matter', 'the game plays itself', 'analysis paralysis', 'players feel overwhelmed', 'combat feels random', 'players can't plan ahead', 'too much information on screen', 'nothing to think about between fights', 'turn pacing', or any request to audit decision quality, information design, or moment-to-moment engagement in a design or repo. Complements elegance-audit: that skill checks whether mechanics interact, this one checks whether the player can think interestingly about them."
---

# Decision Flow Audit

A decision is interesting when the player can partially predict its consequences: enough foresight to reason, enough uncertainty to make reasoning matter. Games fail on both sides, and they fail by feeding the player too little or too much information. This skill audits the thinking the game asks players to do.

 

## Core concepts

**Anticipation is where engagement lives.** Players feel a game in the futures they imagine: threats forming, plans maturing, risks weighed. A game with no predictability offers nothing to imagine (pure dice); a game with total predictability offers nothing to decide (a solved puzzle). Tune systems so players can sketch the next few moments but not the exact outcome.

**Predictability is a property of systems and AI.** Enemies with readable tells, physics that behave consistently, and costs known in advance all buy anticipation. AI that acts arbitrarily destroys planning even when it is "smarter", because the player cannot model it. An AI that telegraphs is usually better game design than one that optimises.

**Information balance has two failure modes.** Starvation: the player lacks the facts needed to reason, so choices collapse into guessing. Glut: everything is visible and the best move is computable, so play becomes spreadsheet-reading, or the player drowns and disengages. Hide information with fog, hidden hands, randomised reveals, or fictional ambiguity; reveal it with tells, previews, and clear costs. Balance per decision, not globally.

**Decision scope must fit the moment.** Scope is how far a decision reaches: twitch reactions, tactical picks, strategic commitments. Real-time pressure suits small scopes; large scopes need time to think. Mismatches produce either panic (big decision, no time) or boredom (trivial decision, long pause).

**Flow gaps and overflow.** A flow gap is a stretch where the game asks nothing of the player's mind: dead travel, waiting on timers, foregone fights. Overflow is more simultaneous demands than attention can hold. Both eject the player from flow; audits should chart demand over time, not just average it.

## Design review workflow

1. **Sample the decision stream.** Take a representative five-minute slice of play and list every decision the player makes, with its scope and the information available at the moment of choice.
2. **Grade each decision.** Obvious (one option dominates), interesting (multiple defensible options with imaginable consequences), or blind (no basis to choose). Obvious and blind decisions are both non-decisions; note which information change would upgrade each.
3. **Chart cognitive load over time.** Mark flow gaps (nothing to think about) and overflow points (too much at once). Check that decision scope matches available time at each point.
4. **Audit the randomness.** For each random element: does it create imaginable futures (drawn cards you can plan around) or erase them (post-decision damage rolls that swing outcomes)? Pre-decision randomness feeds anticipation; post-decision randomness taxes it.
5. **Check the metagame leak.** Will optimal play migrate to wikis and calculators? If a decision is best made outside the game, its in-game version is already dead.

## Repo audit workflow

1. **AI readability.** Inspect enemy/NPC decision code for telegraphs: wind-up states, audio cues, intent broadcasts. Flag AI actions with player-relevant consequences that fire with no observable precursor. Also flag pure `Random.value` branches in AI where a state machine would give players something to learn.
2. **Randomness placement.** Locate RNG calls in outcome resolution. Classify each as pre-decision (generation, draws, spawns) or post-decision (hit/miss, crit, damage variance). Report post-decision RNG with wide variance on high-stakes outcomes; these are the "feels random" complaints in code form.
3. **Information plumbing.** For each key decision surface (targeting, shop, upgrade screen), check the UI can actually display the facts the decision needs (costs, ranges, odds, previews). Grep for values that exist in the simulation but never reach a display component; hidden-by-accident is starvation.
4. **Dead-time inventory.** Find forced waits in the loop: timers with no parallel activity, unskippable animations gating input, travel with no decisions. Report duration and frequency.
5. **Simultaneity spikes.** In real-time games, look for event systems that can stack many player-relevant alerts in the same window (wave spawns plus objective timers plus resource alarms). Recommend queueing or staggering where stacks exceed roughly three simultaneous demands.

## Output format

**Decision stream sample** with per-decision grade and scope · **Load-over-time chart** (described or drawn) with gaps and overflow marked · **Randomness audit**: pre versus post decision, variance, stakes · **Information fixes**: what to reveal, what to hide, per decision · **Repo findings** with file paths: untelegraphed AI, post-decision RNG, missing displays, dead time, alert stacking · **Top three changes** ranked by engagement gain per unit of work.
