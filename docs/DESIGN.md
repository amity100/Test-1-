# THRESHOLD: The Tower (design + technical spec)

This is the source of truth for the rebuild. Every workstream reads it. Shared
TypeScript types live in `src/core/contracts.ts`: implement against those,
never around them.

## 1. Vision

A third-person portal **action** game for desktop and phones. You have no gun.
You own one rift pair, and the world does the killing: enemy bullets,
grenades, beams, charging brutes, hanging cargo, gravity and your own falling
speed. Every kill passes through a rift. The game rewards invention: named
tricks, a style meter, auto-replays and one-tap clip sharing.

The setting is **Kessler Threshold Tower**, a 100 m skyscraper under
construction above the harbour at golden hour. Kessler invented rift gates;
you stole a prototype Rift Gauntlet. You climb from the pier to the roof and
take down Director Voss.

## 2. The three rules (shown to the player, one line each)

1. **Everything keeps its speed through a rift**: you, enemies, bodies,
   bullets, grenades, cargo, light and sound.
2. **The rift is your only weapon.** Kessler guns are IFF-locked and can't
   hurt Kessler. Anything that has passed through your rift is *rift-charged*
   and can hurt anyone. You are attuned: your own rift-charged things never
   hurt you.
3. **You control both ends.** You place the EXIT, the ENTRANCE opens where
   the moment needs it, and you can move the exit while things are in transit.
   Closing a rift on something mid-pass cuts it (SHEAR).

## 3. The rift model

The player owns **one pair**: a **blue EXIT** (where things come out) and an
**orange ENTRANCE** (where things go in).

### EXIT
- **Aim**, then place it. Hold RMB, or hold the RIFT touch button and drag.
  Time slows to 0.3 while aiming.
- **It snaps to surfaces:**
  - floor: faces up
  - wall: faces out
  - ceiling: faces down
  - perch: the top of a thing aimed high on its side
- **Open air (`air`)** gives two orientations: a vertical door facing along
  the aim, or a **sky hatch** facing down. Aiming over an enemy or prop
  auto-picks the hatch. FLIP (E key / ⇄) toggles. The wheel or drag sets the
  distance.
- **Air ends can never be above the player's feet** (`LAW.airAboveFeetMax` =
  0). Height is earned: you can't make a lethal drop from thin air while
  standing on the ground. Surface ends (walls, ceilings, floors) are allowed
  anywhere in range and line of sight (60 m).
- **It stays until you place it again.** Moving it while things loop or fly
  re-aims them (CANNONBALL, SPLIT).

### ENTRANCE
Press GATE (LMB when not aiming / the GATE touch button). It resolves by
priority:
1. **Airborne and falling** (`vel.y < -3`): an `air` end opens 1.5–3 m below
   you on your fall path, facing your velocity. You fall in, and out of the
   EXIT at full speed (SLINGSHOT / COMET / LOOP).
2. **Imminent threat, CATCH:** a laser lock on you (bolt burst or sniper
   beam), a grenade within 6 m, or a brute charging at you. A standing door
   opens 1.4 m in front of you, turned to face the threat. Whatever hits it
   comes out of the EXIT.
3. **Crosshair on a target, TRAPDOOR:** the crosshair is on an enemy or prop
   within 40 m with line of sight, and its footing can fall. A `floor` end
   (1.7 × 1.7) opens under it.
   - **Props** always fall.
   - **Enemies** fall only if they are *off-balance*: unaware (idle/patrol/
     suspicious), staggered, charging, downed, stunned or airborne.
   - A steady combat enemy sidesteps. The aim tag says "STEADY: knock him off
     balance".
4. **Otherwise, DOOR:** a standing door in front of you (or on the wall you
   face), for travel.

### Rules for both ends
- Opening costs nothing. There are no charges.
- CLOSE (X / middle mouse / ✕) closes the pair. If an enemy or prop is
  straddling a plane (centre within ±0.45 m and inside the rectangle), it is
  **sheared**: an instant kill for anything, including armour. It doesn't
  work on the boss core.
- Only one entrance and one exit exist. Opening a new entrance replaces the
  old one.

### Anti-exploit
- No end may open within 1.2 m of a living steady enemy's body.
- Trapdoors are refused on steady combat enemies.
- Air ends can't be above your feet.
- Speed cap is 40 m/s.
- Only rift-charged speed hurts.
- These rules make "one click = one kill" impossible. Kills come from
  combinations.

### Kessler rift gates
- Fixed enemy pairs, drawn in red. Reinforcement waves walk out of the gate's
  arena end.
- **HIJACK:** stand at the gate's panel and press ACTION, or put your
  ENTRANCE on a gate's arena end. The gate's out-end then links to your
  EXIT. Everything that comes through the gate now comes out of your exit
  (over the void, above their commander).

## 4. The laws (numbers)

All values are in `LAW`, in `src/core/contracts.ts`.

| Quantity | Value |
|---|---|
| gravity | 22 m/s² |
| speed cap | 40 m/s |
| knock speed | 8 m/s |
| kill speed | 12 m/s |
| armour speed | 18 m/s |
| charge lasts | 1.5 s after crossing, or until the first ground contact (props/bodies keep it until they come to rest) |

**Rift-charged impact on an enemy** (a body, prop, player or projectile
striking him):
- 8 m/s or more knocks him down.
- 12 m/s or more kills.
- 18 m/s or more kills armour.

**An enemy landing after a rift exit** uses the same landing-speed
thresholds. Water is always a drown, and the void is always death.

**Player landings:**
- A charged landing is always safe. At 18 m/s or more it releases a knock
  shockwave (r = 3 m) and scores COMET.
- An uncharged fall over 14 m/s hurts: damage = (v − 14) × 9.

**Bolts:**
- 26 m/s, 3-round bursts, 15 damage to the player.
- Charged, they do 60 damage to Kessler actors.
- They pass through Kessler actors while uncharged.

**Grenades:**
- 2.2 s fuse, bounce 0.35.
- Explosion radius 4.5 m, 45 damage (falloff).
- IFF unless charged.

**Beams (sniper and lasers):**
- 1.2 s telegraph, then 0.35 s of beam, 45 damage.
- Raycast through up to 2 rifts. Segments after the first rift are charged.

**Barrels:** explode (neutral: they hurt everyone, the player at 50%) when
hit by:
- a charged bolt
- a charged impact of 8 m/s or more
- a grenade blast
- a charged landing of 8 m/s or more

**Player:**
- 100 HP. It regenerates at 25/s after 4 s without damage.
- A rift kill heals +15 ("embers").

**SHOVE** (V / touch): a 4 m dash that staggers enemies it touches for
1.4 s. It does 0 damage and has a 1.2 s cooldown. This is how you make
things off-balance on foot.

**FINISH** (F, blade): kills a downed or stunned enemy within 2 m, with a
0.15 s hitstop.

## 5. Enemies (Kessler Security)

Enemies have states: idle, patrol, suspicious, combat, stagger, charge,
launched, downed, stunned and dead.

| Kind | HP | Behaviour | Answers |
|---|---|---|---|
| **Rifleman** | 40 | Keeps 10–20 m range and strafes. 0.6 s laser telegraph, then a 3-bolt burst. At most 3 shooters at once (attack tokens). | Return to Sender, trapdoor when off-balance, anything charged |
| **Grenadier** | 40 | Lobs a grenade every 5 s (shows an arc and landing ring). | CATCH the grenade (POSTAGE), return it, trapdoor |
| **Warden** | 70 | Front shield (120°) blocks everything from the front, charged too, below armour speed. Advances and shield-bashes (15 damage, knockback). Turns toward an exit that shot him. | Hit from behind (exit behind him), shove + trapdoor, loop, shear, armour-speed impact, grenade |
| **Brute** | 250, armoured | Telegraphs a charge (roar 1 s), then 14 m/s in a straight line for up to 18 m. Hits for 35 and knocks you down. Stunned 2.5 s if he hits a wall. | MATADOR: his charge into your entrance sends him out of your exit (the sea or void kills him, a wall stuns and damages him, a crowd bowls). Also cannonball, shear, hazards. |
| **Sniper** | 40 | Perched and never moves. 1.2 s red beam telegraph, then the beam. | FIRING LINE: catch his beam and it exits your exit; also cargo and shear |
| **Jammer** | 40 | Projects a 7 m bubble where no rift end can open. Flees from you. | Things launched in from outside the bubble, grenades, bodies |
| **Turret** | 120 | Static and turns. A 6-round stream with a laser. | BORROWED GUN: a caught stream exits your exit. Also barrels. |
| **Director Voss** (boss) | 3 phases | Carries his own rift gauntlet. He catches straight shots with a red rift (returns your returned bolts) and blinks between two red ends. | Hit him from where his catch-rift doesn't face (behind/above). Shear him mid-blink. Cannonball a looped barrel into him. Drop the crown's hanging load. |

**Perception:**
- Vision cone ±60°, 32 m. Hearing uses noise events.
- They never see rifts, only effects. When an ally dies to something that
  came out of a rift, they look at the exit and a Warden turns his shield to
  it.
- A zone becomes "hot" (all its enemies go to combat) when any enemy in it
  enters combat.
- Kills of unaware enemies that no one sees score GHOST.

**Launched:** an enemy that crosses a rift becomes a physics body until it
lands.
- Landing at 8 m/s or more gives downed (2.5 s).
- 12 m/s or more kills (18 for armour).
- Below that he staggers 1 s and resumes on the new spot. If he's off the nav
  grid he stays and fights from there ("stranded").

## 6. Tricks (style)

`src/meta/style.ts` turns `GameEvent`s into named tricks. Points are base
values.

| Trick | Detected when | Pts |
|---|---|---|
| RETURN TO SENDER | Killed by a charged bolt that he fired himself | 300 |
| CROSSFIRE | Killed by a charged bolt fired by another enemy | 250 |
| POSTAGE | Killed by a charged grenade | 300 |
| FIRING LINE | Killed by a charged beam segment | 350 |
| BORROWED GUN | Killed by a charged turret round | 300 |
| TRAPDOOR | Died after falling through a floor end | 200 |
| SPLASHDOWN | Drowned after a rift | 200 |
| INTO THE VOID | Fell into the void after a rift | 200 |
| SKYFALL | Fall kill after a rift, fall ≥ 10 m | 250 |
| MATADOR | A brute crossed your entrance during a charge | 400 |
| BOWLING | One launched enemy/prop knocks down or kills ≥ 2 others | 350 |
| HEADS UP | A launched enemy lands on another | 300 |
| LOOP ×N | ≥ 3 consecutive crossings of the same pair without landing (bonus per loop) | 50 + 50/loop |
| CANNONBALL | Kill by something that looped ≥ 2 times first | 450 |
| SLINGSHOT | Player charged impact kill after a floor/air → wall/air crossing | 350 |
| COMET | Player charged landing or impact at ≥ 18 m/s that kills | 450 |
| GUILLOTINE | Shear | 350 |
| CARGO | Killed by a charged falling prop | 300 |
| BOOM | A barrel explosion kills ≥ 1 | 250 |
| FINISHER | Blade finish | 150 |
| GHOST | Kill of an unaware enemy unseen by others | +150 bonus |
| AIRTIME | Airborne ≥ 3 s with ≥ 1 crossing (awarded on landing) | 100/s |
| DOUBLE / TRIPLE / MULTI | 2 / 3 / 4+ kills within 0.6 s | 200 / 500 / 1000 |
| MIRROR | Charged bolt kills its shooter within 0.35 s of being fired | 400 |
| HIJACK | A gate hijacked | 300 |
| JUGGLE | Victim crossed rifts ≥ 3 times before dying | 300 |

**Combo:**
- A chain continues while the next trick lands within 4 s, or while you're
  airborne.
- Combo score = sum × variety, where variety is the number of distinct
  tricks in the chain (capped at 8).
- A repeat of any of the last 3 tricks scores half.

**Style rank** (D, C, B, A, S, SS, SSS) comes from a meter that rises with
points and decays (faster at high ranks). Getting hurt drops it one rank.

**HUD:**
- Trick names pop with points.
- A rank letter with a meter.
- Combo ×variety.

## 7. Clips, replay, photo mode, challenges

- **Recorder:** records a snapshot every 1/30 s (the last 15 s ring buffer;
  types in contracts).
- **CLIP button:** after a combo ≥ 1500 points or rank ≥ A, a "🎬 CLIP"
  button pulses for 6 s. R (desktop) or tapping it opens the replay.
- **Replay:**
  - Plays the last ~10 s around the combo.
  - The cinematic camera cuts between the follow cam, orbit cams at trick
    moments (0.25× slow motion for 0.8 s), and a *portal cam* looking out of
    the exit as something emerges.
  - Trick names are drawn into the frame, with a THRESHOLD watermark.
- **Export:**
  - A 2D canvas composites each rendered frame plus the overlays.
  - `canvas.captureStream(30)` + `MediaRecorder` (mp4 where supported, else
    webm).
  - Share via the Web Share API with files (phones: TikTok, Instagram,
    WhatsApp), or fall back to a download.
- **Photo mode:**
  - Freeze, orbit camera, depth-of-field-free tilt, FOV.
  - Snap a PNG, then share or download.
- **Challenges:**
  - 3 per zone, like "Return to Sender ×3" or "Drown two with one rift".
  - Plus a **daily challenge** seeded by date: a trick plus a condition.
  - Progress is kept in localStorage.

## 8. The Tower (level)

Golden hour: a low sun at the west, warm light, long shadows, a hazy city
skyline, and the sea around the pier. It is never dark. Each zone is an
arena or a sequence of encounters. The tower footprint is about 36 × 36 m,
centred near (0, 0, 40).

| Zone | Height | Content | Lessons |
|---|---|---|---|
| **pier** | y 0 | Quay 80 × 50 m with sea on 3 sides, containers, crates, gatehouse, a harbour crane, barge | door (cross a channel), trapdoor (2 unaware guards at the quay edge, exit over the sea), returnToSender (a lone rifleman), slingshot (jump from a container stack into an air entrance, exit on a wall facing a group), arena (4 riflemen + warden) |
| **yard** | y 0–24 | Construction site at the tower base: tower crane with hanging loads (steel beam bundle, container), scaffolding towers, fuel barrels, mixer truck, the hoist | cargo, matador (brute near the pier edge), grenade (postage), shield (warden) |
| **skeleton** | floors y 30 / 36 / 42 | Open steel floors, void at the edges, elevator shaft (a vertical hole through all floors, for loops), scaffolding, a neighbouring crane cab with a sniper | loop, firingLine, arena with brute + wardens + riflemen |
| **lab** | y 60 | Glass-walled floor, Kessler rift gates (reinforcement waves), jammer, turret, laser curtains | hijack, jammer, borrowedGun |
| **crown** | roof y 90 | Helipad, hanging load on a small crane, the helicopter | boss (Voss, 3 phases), then a leap of faith off the roof into a rift to the sea, the end |

- **Progress:** each zone's `exit` lift (a hoist / elevator platform) runs
  when its `requireClear` encounters are cleared. Rifts may also be used to
  climb early; that's freedom, not a bug.
- **Checkpoints:** every zone start and every cleared encounter. Death
  restarts at the last checkpoint in under 1 s.
- **Kill volumes:**
  - Pier and yard: the sea (y < −1.2, splash/drown).
  - Skeleton, lab and crown: the void (falling below `zone.killY` kills
    enemies; the player can save themselves with an air entrance while
    falling). If they don't, they respawn at the checkpoint, taking 30
    damage.

## 9. Controls

**Desktop:**

| Input | Action |
|---|---|
| WASD, mouse | Move, look |
| Space | Jump / mantle |
| Shift | Sprint |
| C | Crouch |
| V | SHOVE |
| RMB (hold) | Aim EXIT (time 0.3×) |
| LMB while aiming | Place EXIT |
| LMB | GATE (entrance, contextual) |
| E | Flip exit orientation |
| Wheel | Air distance |
| X / MMB | CLOSE (shear) |
| F | ACTION (finish / grab / throw / hijack / use lift) |
| Tab | RIFT VISION (routes, cones, outcome icons) |
| R | CLIP |
| K | Photo mode |
| Esc | Pause |

**Gamepad:**

| Button | Action |
|---|---|
| LT | Aim |
| RT | Place / gate |
| LB | Close |
| RB | Shove |
| A | Jump |
| X | Action |
| B | Crouch |
| Y | Flip |
| D-pad down | Vision |
| View | Clip |

**Touch:**
- **Left thumb:** the stick (a full push sprints).
- **Right side:** drag to look.
- **Buttons:**
  - **RIFT** (hold + drag = aim exit, release = place; slide off to cancel)
  - **GATE**
  - **JUMP**
  - **SHOVE**
  - **✕** (tap closes)
  - **ACTION** (context label)
  - **⇄** (flip, while aiming)
  - **CROUCH** (small)
  - **🎬** (when offered)
  - **pause**

## 10. Architecture and ownership

```
src/core/contracts.ts        shared types + LAW              (lead)
src/game/portals.ts          RiftSystem implements RiftQuery (CORE)
src/sim/physics.ts           DynBody physics, rift crossing  (CORE)
src/sim/projectiles.ts       bolts, grenades, beams          (CORE)
src/game/player.ts           player controller on DynBody    (CORE)
src/actors/enemies.ts (+enemy.ts)  Kessler AI               (ENEMIES)
src/world/nav.ts             multi-floor nav grids           (ENEMIES)
src/world/tower.ts           the level                       (LEVEL)
src/render/fx.ts             golden-hour sky, skyline, lamps (LEVEL)
src/game/characters.ts       animation API + retargeted clips(ANIM)
scripts/extract-anims.mjs, public/assets/anims.json          (ANIM)
src/meta/style.ts replay.ts clip.ts photo.ts challenges.ts   (META)
src/ui/hud.ts menu.ts i18n.ts style.css                      (UI)
src/engine/input.ts touch.ts                                 (UI)
src/engine/audio.ts                                          (AUDIO)
src/game/game.ts, src/main.ts, src/config.ts, props, flow    (lead: integration)
```

Old stealth code (`guards.ts`, `harbor.ts`) is removed at integration.

**Testing:**
- `npm test` (vitest) covers pure logic: physics, crossings, loops, IFF,
  style detection, replay buffer, nav.
- Headless Chromium scenarios check the full game.
- Every module must typecheck under `strict`.

## 11. Performance budget (phones)

- At most 8 active enemies, 40 live bolts (instanced) and 2 rendered portal
  views on medium.
- No runtime light creation: pools only. No shader compiles on a kill frame
  (pre-warm).
- Zones far from the player are hidden (`zoneRoots`).
- Draw calls: static geometry is merged per material per zone.
