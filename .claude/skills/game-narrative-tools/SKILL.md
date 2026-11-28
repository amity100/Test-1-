---
metadata:
  version: "1.0"
name: game-narrative-tools
description: "Use this skill for any game storytelling problem: story structure, dialogue systems, environmental storytelling, procedural or AI-generated narrative, player agency, pacing, or setting. Trigger on: 'my story fights my gameplay', 'players skip the dialogue', 'design an emergent story system', 'LLM-driven narrative', 'players don't care about the plot', 'ludonarrative dissonance', 'branching dialogue review', 'worldbuilding for my game', or any request to design or audit narrative systems in a design doc or repo. Especially relevant for AI-narrated games where generated text must cohere with simulation state."
---

# Game Narrative Tools

Game stories are built with a toolkit, and each tool trades authored control against player interactivity. Most narrative problems come from using a high-control tool where the design needs interactivity, or vice versa. This skill picks tools, designs emergent-story systems, and audits narrative code.

 

## Core concepts

**The tool spectrum.** Scripted story (cutscenes, fixed dialogue) gives full authorial control and zero interactivity. Soft scripting arranges a space and its triggers so events reliably unfold during play while the player keeps control. World narrative embeds story in the environment itself: architecture, wreckage, item placement, documents; the player reads the past out of the present at their own pace. Emergent story arises from mechanics interacting; nobody authored it. Strong games mix tools deliberately per beat rather than defaulting to one.

**Apophenia powers emergent story.** Players project minds, motives, and drama onto anything that behaves with minimal consistency. An emergent-story system does not need to simulate people; it needs to give the player's pattern-hungry mind enough hooks. The design levers: labeling (names, portraits, traits that seed projection), abstraction (less visual fidelity leaves more room for imagination), and recordkeeping (kill feeds, histories, chronicles that fix fleeting events into narratable form). Sportscaster-style systems that surface and dramatise what the simulation did convert invisible mechanics into story.

**Agency has known failure modes.** The player-character motivation gap: the character has story reasons the player does not share, so the player ignores the plot or the plot rails the player. The human interaction problem: scripted NPCs cannot converse freely, so designs must route around open dialogue (constrained verbs, menus, or, in AI-driven games, generation with hard guardrails). Choices that change nothing teach players to stop reading.

**Coherence beats volume.** A world narrative works when its details agree with each other and with the mechanics. One contradiction (a starving settlement with overflowing granaries in the art pass) costs more belief than ten missing details.

**Pacing is a designed rhythm.** Alternate tension and release; place reveals where play slackens; never stack the biggest story beat on the hardest fight unless the design wants the player to fail through it.

## Design review workflow

1. **Beat-to-tool map.** List the intended story beats. For each, record which tool delivers it and why that tool. Flag scripted beats that interrupt strong play loops and emergent hopes with no supporting systems.
2. **Agency check.** For each major choice: does the outcome differ in a way the player can perceive? For the protagonist: what does the player want at this moment, and does it match what the character is written to want?
3. **Emergent-story system design** (when asked to build one): define the actors and their labels, the event types worth narrating, the recordkeeping surface, and the dramatisation layer that retells events. Keep simulation simple and legible; the player's imagination scales better than the simulation does.
4. **Coherence pass.** Cross-check fiction against mechanics and environment art. List contradictions with the cheaper side to fix.
5. **Pacing pass.** Chart tension across a session; flag long flats and stacked peaks.

## Repo audit workflow

1. **Tool census.** Locate the systems delivering story: cutscene player, dialogue trees, trigger volumes, journal/lore data, procedural event systems, LLM prompt layers. Map each to the spectrum and compare against the beat-to-tool map; mismatches explain most "story feels bolted on" complaints.
2. **Choice plumbing.** Trace flag variables set by player choices to their read sites. Flags written and never read are broken promises; report each with file paths. Count reads per flag as a cheap agency metric.
3. **Recordkeeping surface.** Check whether notable simulation events are captured anywhere the player can revisit (log, chronicle, stats). Emergent drama that leaves no record evaporates.
4. **For LLM-driven narration**, audit the constraint layer:
   - Verify generation prompts receive current simulation state, and that state summaries include the facts most likely to contradict (who is alive, where, holding what).
   - Check for a validation pass that rejects or repairs output contradicting state (hallucinated characters, dead NPCs speaking, items the player lacks). If absent, this is the top finding.
   - Check tone and register constraints exist per scene type; unconstrained tone reads as no authorial voice.
   - Check persistence: generated facts that matter must be written back to state, or the next generation contradicts them.
5. **Dialogue dead ends.** In branching systems, find nodes unreachable from any path and branches that reconverge immediately with identical downstream state; the first is waste, the second is fake choice.

## Output format

**Beat-to-tool map** with mismatches · **Agency findings**: perceivable-difference table per major choice, motivation-gap notes · **Emergent system design** (when requested): actors, labels, events, records, dramatisation · **Coherence contradictions** with cheaper fix per item · **Repo findings** with file paths: tool census, dead flags, missing records, LLM constraint gaps, dialogue dead ends · **Top three changes** ranked by narrative payoff per unit of work.
