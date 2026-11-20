---
metadata:
  version: "1.0"
name: game-interface-audit
description: "Use this skill for game UI, HUD, controls, input feel, or player guidance problems. Trigger on: 'players don't understand my UI', 'HUD review', 'players miss important information', 'controls feel bad/floaty/unresponsive', 'input lag', 'players get lost', 'how do I guide players without arrows everywhere', 'tutorial popups everywhere', 'UI audit', or any request to audit interface code, input handling, or player guidance in a design or repo. Distinct from general frontend-design skills: this covers the game-specific layer of metaphor, signal versus noise, indirect control, and control feel."
---

# Game Interface Audit

The interface is the pipe between the game's state and the player's mind, and between the player's intent and the game's input system. Both directions fail in characteristic ways: information drowns in noise going out, and intent gets mangled by latency and poor mapping coming in. This skill audits both directions.

 

## Core concepts

**Metaphor buys free learning.** Players arrive knowing doors open, red barrels explode, and hearts mean health. Interfaces built on borrowed knowledge (from life, from genre convention) need no tutorial; interfaces that invent fresh symbols charge learning cost for every one. Break convention only where the game's identity is at stake.

**Signal versus noise governs every screen.** Signal is information that changes player decisions; noise is everything else, including decoration, redundant numbers, and detail-rich art that hides the readable shapes. The audit question per element: which decision does this inform, and how often? Art complexity competes with readability, and gameplay-critical elements must win that competition.

**Hierarchy and redundancy carry the load.** The most decision-relevant information should be largest, brightest, most central, and most motion-catching. Critical facts deserve multiple channels at once (screen flash plus sound plus controller rumble for near-death), because any single channel gets missed under load.

**Indirect control steers without commands.** Nudging (lighting, layout, and paths that make the desired route the natural one), priming (imagery and sound that set expectations before a beat), and social imitation (NPCs modelling the intended behaviour) guide players while preserving the feeling of freedom. Every waypoint arrow the design removes in favour of these earns immersion.

**Control feel is made of small numbers.** Latency between input and visible response, acceleration curves, input buffering, coyote time, snap and assist. Sub-100ms response reads as "responsive"; sluggishness anywhere in the pipe reads as a bad character, not a bad pipe, because players misattribute. Assists should be invisible: generous hitboxes and buffered inputs feel like skill.

## Design review workflow

1. **Decision-to-display map.** List the decisions the player makes per minute; for each, list where the needed information lives on screen. Facts needed but undisplayed are starvation; displays informing no decision are noise candidates.
2. **Squint test.** Blur or shrink a representative screenshot. What survives should be exactly the top of the hierarchy. If decoration survives and the health state does not, the hierarchy is inverted.
3. **Convention inventory.** List symbols and interactions that follow genre convention versus invented ones. Every invention needs a justification and a teaching moment.
4. **Guidance audit.** Where do players get lost or ignore the intended path? Prescribe indirect fixes first (light, layout, motion, NPC behaviour) and explicit markers only where stakes demand certainty.
5. **Redundancy check on critical states.** Low health, incoming threat, objective change: each should hit at least two senses.

## Repo audit workflow

1. **HUD data plumbing.** Trace what the HUD components actually read. Flag simulation facts that decisions need but no widget displays, and widgets bound to values that never change or that no decision uses.
2. **Update-rate and flicker.** Check UI update logic for per-frame churn on slow-changing values and for thrashing bindings; visual noise is sometimes a code bug, not an art choice.
3. **Input pipeline latency.** Read the input path: polling versus event, input consumed this frame or next, animation-gated responses, tweens inserted before state changes. Report each added frame of delay and where it comes from. Check for input buffering and (in platformers/action) coyote-time style forgiveness windows; absence is a finding.
4. **Assist and snap systems.** Locate aim assist, hitbox padding, and magnetism code. Check they are tuned and clamped rather than binary, and that they never visibly override the player (visible override reads as broken controls).
5. **Notification stacking.** Audit the popup/toast/tutorial systems for queueing: can three tutorials fire at once? Is there a priority scheme? Unqueued notification systems produce the "popups everywhere" complaint.
6. **Accessibility hooks.** Check for remapping support, colour-independent state signalling, and text scaling. These are cheap early and expensive late; report their presence honestly.

## Output format

**Decision-to-display map** with starvation and noise lists · **Hierarchy verdict** from the squint test · **Convention inventory** with unjustified inventions flagged · **Guidance fixes**, indirect first · **Repo findings** with file paths: unplumbed facts, latency sources by frame count, missing buffering/forgiveness, unqueued notifications, accessibility gaps · **Top three changes** ranked by clarity gained per unit of work.
