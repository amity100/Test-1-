---
metadata:
  version: "1.0"
name: emotion-engine-audit
description: "Use this skill when designing, reviewing, or auditing a game (or a game repo) at the level of what the player feels. Trigger on: 'why is my game boring', 'is this feature worth building', 'what should this game feel like', 'review my game design', 'audit my game repo', 'my playtest feedback is flat', 'players quit early', or any request to evaluate whether mechanics, content, or code serve the player experience. Also trigger when a dev proposes a new feature and the value is unclear, or when a repo has grown features without a clear experiential goal. This is the foundation lens; run it before elegance-audit, skill-curve-audit, or decision-flow-audit when the problem is vague."
---

# Emotion Engine Audit

Games are machines that generate events, and events matter only when they provoke emotion. A mechanic that never changes how the player feels is dead weight regardless of how well it is coded. This skill audits designs and repos against that standard.

Concepts adapted from Tynan Sylvester's *Designing Games* (O'Reilly, 2013), rewritten here. Do not quote or reproduce the book's text when using this skill; explain ideas in your own words and credit the book when the user asks about sources.

## Core concepts

**Mechanics generate events; events generate emotion.** The chain runs: rules → play events → emotional response. Design quality lives at the end of that chain, so evaluate every mechanic by the events it produces and the feelings those events provoke, never by how clever the rule looks on paper.

**Emotion tracks change in things the player values.** Threats to a character, a shift in status, a resource gained or lost, a reveal about the world. If nothing the player cares about changes, no emotion fires. The corollary: to make a moment land, first make the player value the thing, then change it.

**The unconscious does the work.** Players rarely know why they feel what they feel. They misattribute: a player bored by weak pacing will report that "the graphics are bad". Treat playtest explanations as symptoms, never diagnoses. Watch what players feel and when; distrust their stated reasons.

**Triggers are plural.** Learning something new, challenge, social interaction, acquisition, music, spectacle, beauty, environment, novelty, primal threat, character arcs. Strong games layer several triggers into one moment. A design leaning on a single trigger (usually challenge) is fragile.

**Fiction and mechanics must dovetail.** The fictional wrapping and the underlying rules each carry emotional weight, and they multiply when they agree. A mismatch (a dramatic story moment resolved by a mundane mechanic, or a deep mechanic dressed in incoherent fiction) leaks emotion. Neither layer is "the real game"; the experience is their interaction.

**Flow and immersion are states to protect.** Flow needs a challenge matched to skill with fast, clear feedback. Immersion needs the player's real emotions to sync with the character's fictional situation. Interruptions, incoherence, and dead time break both.

## Design review workflow

1. **Name the experiential target.** One or two sentences: what should the player feel, and when? If the dev cannot state this, stop and produce it with them before reviewing anything else. Every later judgement hangs on it.
2. **Map the emotional beats.** Walk a typical session. List the moments where a feeling should fire and which trigger drives each one. Gaps longer than a few minutes with no beat are pacing problems.
3. **Trace each mechanic to a feeling.** For every mechanic, ask: what events does this produce, and what do those events make the player feel? Mechanics with no answer go on a cut list (hand that list to elegance-audit).
4. **Check fiction/mechanics agreement.** Find places where the story says one thing and the systems say another. Flag each with the cheaper fix: rewrap the mechanic or rework the fiction.
5. **Check variation.** A single emotion sustained too long numbs. Look for contrast: tension then relief, dread then triumph, quiet then spectacle.

## Repo audit workflow

When given a repo, audit the code against the experiential target:

1. Locate the systems that generate player-facing events: combat resolution, dialogue, progression, spawning, economy, audio cues. Build a table: system → events it emits → intended feeling.
2. Flag **orphan systems**: substantial code (hundreds of lines, own module) whose events no player would notice or care about. These are cut or rework candidates.
3. Flag **feedback starvation**: state changes that matter emotionally but produce no immediate audiovisual or textual signal. Grep for state mutations in gameplay systems and check whether each one triggers feedback (sound, VFX, UI, log line). Silent changes waste their emotional charge.
4. Flag **fiction/mechanics drift in data**: item descriptions, dialogue, or lore that promise behaviour the code does not implement, and mechanics with placeholder or contradictory fiction.
5. Flag **dead time in the loop**: loading, forced waits, unskippable transitions, cooldowns with nothing to do. These are flow breaks; list them with rough duration.
6. For AI-driven games (LLM narration, generated content): check that generated output is constrained toward the experiential target. Unconstrained generation drifts to tonal mush, which reads as "no emotion" in playtests.

## Output format

Produce a report with these sections, in prose plus tables where listing systems:

**Experiential target** (stated or reconstructed) · **Emotional beat map** with gaps flagged · **Mechanic-to-feeling trace** with cut candidates · **Fiction/mechanics mismatches** with cheapest fix per item · **Repo findings** (orphan systems, feedback starvation, dead time) with file paths · **Top three changes** ranked by emotional payoff per unit of work.

Be blunt about weak features. A dev who ships a dead mechanic pays for it in every playtest afterward.
