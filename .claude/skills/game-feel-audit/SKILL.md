---
metadata:
  version: "1.0"
name: game-feel-audit
description: "Use this skill when the moment-to-moment action of a game feels weak, floaty, unsatisfying, or lifeless, or when adding impact and juice to a working loop. Trigger on: 'my game feels flat', 'shooting/hitting feels weak', 'add juice', 'game feel', 'screenshake', 'hitstop', 'my combat has no impact', 'the core verb isn't satisfying', 'polish pass', 'feedback effects', 'camera feel', or any request to design or audit the feedback layer of an action game in a design or repo. Distinct from game-interface-audit (input latency and HUD clarity) and emotion-engine-audit (which feelings to target): this skill covers the physical punch of each action once those are settled."
---

# Game Feel Audit

Game feel is the accumulated weight of dozens of tiny feedback effects layered on the core verb: what the player sees, hears, and senses in the tenth of a second after pressing a button. Players never itemise these effects; they just report that a game with them feels good and a game without them feels cheap. This skill audits and prescribes that layer.

## Core concepts

**Feel is spent on the core verb.** The action the player performs hundreds of times per session (shoot, hit, jump, dash) carries the whole experience, so the feedback budget concentrates there. A polished menu on a limp core verb is effort in the wrong place.

**Every meaningful event needs a feedback stack.** A hit that only decrements a number did not happen, as far as the player's senses report. Stack channels on each impact: a flash or colour pop on the target, an impact particle at the contact point, a sound with real low end, knockback on the receiver, a screen response. Two or three channels firing together read as weight; one reads as a spreadsheet.

**Exaggerate past realism.** Projectiles sized and paced for visibility rather than accuracy, oversized explosions, generous muzzle flashes, spread that makes the stream look alive. Action readability beats simulation fidelity in this layer every time.

**The camera is a feel instrument.** Smoothed follow (interpolation rather than lock), lookahead toward aim or movement so the screen shows what matters instead of the player sprite, recoil kick opposite the fire direction, and shake scaled to impact. Shake specifically: implement it with a decaying intensity value that events add to, not as a binary on/off, and clamp the maximum.

**Hitstop buys perceived impact for free.** Pausing the game a few tens of milliseconds on significant hits gives the moment processing weight without the player consciously registering the pause. Scale duration to significance (light hit, heavy hit, kill) and guard against stacking during multi-hit frames.

**Permanence tells the fight's story.** Corpses, shell casings, scorch decals, rubble, and smoke that persist convert past action into visible history. Modern hardware affords thousands of inert leftovers through pooling; a battlefield that self-cleans erases the player's evidence of having played.

**Firing needs a cost.** Give the player one small reason not to hold the button forever: recoil pushing them backward, movement slowing while firing, spread blooming. A costless action is an action the design might as well automate, and a small cost turns constant fire into a decision.

**Designers habituate; players do not.** Whoever tunes juice all day stops feeling it and keeps escalating, until fresh players get motion sickness. Calibrate against fresh testers, ship intensity toggles for screenshake and flashes, and treat "someone felt ill" as a hard stop, not a preference.

**Juice amplifies gameplay; it cannot replace it.** The feedback layer multiplies whatever the loop already delivers. If the loop is empty, juice produces a brief impressive demo and a fast bounce. Run elegance-audit or emotion-engine-audit first if the underlying loop is in doubt.

## Design review workflow

1. **Name the core verb** and estimate uses per minute. That number sets the feedback budget priority order.
2. **Audit the feedback stack per event.** Table the game's meaningful events (fire, hit, kill, take damage, land, pick up). For each, list channels firing: target reaction, particles, sound, knockback, camera, hitstop. Events under two channels are the work queue.
3. **Exaggeration pass.** Check projectile size and speed, explosion scale, flash presence against the readability standard, not the realism standard.
4. **Camera pass.** Follow smoothing, lookahead, kick, shake model and clamps. A locked camera centred on the player is almost always leaving feel on the table in an action game.
5. **Cost-of-fire check.** Identify the reason not to press the button. If none exists, prescribe the smallest one that creates a decision.
6. **Permanence pass.** What remains sixty seconds after a fight? Prescribe the cheapest persistent evidence (bodies, casings, decals) with pooling.
7. **Calibration check.** Ask when a fresh player last played the current tuning, and whether intensity toggles exist. Escalated-past-comfort juice is a recurring failure in solo-dev games; say so when the signs are there.

## Repo audit workflow

1. **Feedback hook census.** Locate the event sites for the core verb chain (fire, projectile spawn, impact, damage, death). For each, trace what feedback actually triggers in code: VFX spawn, SFX play, shake add, hitstop call, knockback impulse. Report the table; silent events are the top findings.
2. **Screenshake implementation.** Check for an additive decaying intensity model versus scattered one-shot shakes, a maximum clamp, and a user-facing intensity or disable setting. Missing accessibility toggle is a mandatory flag, alongside any full-screen flash without a photosensitivity option.
3. **Hitstop implementation.** If present, check the duration table scales by significance and that simultaneous hits cannot stack pauses into a visible freeze. If absent, mark the insertion point at the damage-application site.
4. **Camera system.** Read the follow code: interpolation factor, lookahead inputs (aim vector, velocity, threat positions), kick hooks, bounds clamping. A camera that reads only player position is the finding.
5. **Persistence and pooling.** Check whether corpses, casings, and decals persist, for how long, and whether they pool or leak. Instant-cleanup timers on cosmetic leftovers are a one-line feel fix; unpooled permanent spawns are a performance bug wearing a feel feature.
6. **Audio layering.** Check impact sounds for variation (pitch or sample randomisation), low-frequency content on the core verb, and channel limiting so rapid fire does not clip into mush.
7. **Tuning centralisation.** Feel values (shake magnitudes, hitstop durations, knockback forces, camera factors) should live in one tunable config, since this layer is tuned by iteration. Scattered magic numbers across systems tax every iteration; report the scatter.

## Output format

**Core verb and budget order** · **Feedback stack table**: event, channels firing, channels missing · **Camera findings** · **Cost-of-fire verdict** · **Permanence findings** · **Calibration and accessibility flags** (always included) · **Repo findings** with file paths: silent events, shake model, hitstop sites, camera inputs, pooling, magic-number scatter · **Prescription list** ordered by feel gained per line of code, since most of this layer is cheap and the ordering is the value.
