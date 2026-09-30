# Motion capture (`src/characters/mocap`)

Real motion capture from the **CMU Graphics Lab Motion Capture Database** (BVH conversion by Bruce Hahne), retargeted
offline onto the MakeHuman skeleton of our humans (`src/characters/human`), cleaned, and played at runtime directly
on the MakeHuman bones.

```
tools/mocap/mocap_lib.py     BVH parser + FK, MakeHuman rest skeleton (rig.json), retarget, contacts, foot lock,
                             loop search/blend, straightening, twist distribution, despike, quantized export
tools/mocap/clips.py         the clip table (CMU take + time range + loop + tags)
tools/mocap/build_clips.py   python3 tools/mocap/build_clips.py [patterns]   (~30 s for the whole library)
src/assets/mocap/*.binz      one gzip'ed clip each (loaded lazily) + index.json (bundled, ~8 KB)
dev/mocap.html               contact sheets + slide / pop / CPU checks (screens in dev/screens/mocap/)
```

## Runtime

```ts
import { MocapLibrary, MocapPlayer } from './characters/mocap';
const lib = MocapLibrary.shared;
await lib.preload(['idle_king', 'walk_king', 'raise_arm_R']);      // fetch + decode (cached, shareable)
const mp = new MocapPlayer(saul);          // opt-in: hooks saul.rig.update; the proxy path keeps working underneath
mp.play('idle_king');                      // base layer
mp.play('walk_king', { fade: 0.5 });       // cross-fade
mp.playLayer('spear', 'raise_arm_R', { mask: 'armR', fade: 0.25, onEnd: () => mp.setSpeed('raise_arm_R', 0) });
mp.rootMotion = 'apply';                   // moves mp.rootTarget (default saul.root); 'extract' -> mp.rootDelta; 'inplace'
mp.footIK = { enabled: true, ground: (x, z) => world.heightAt(x, z) };
mp.lookAt = samuelHeadWorldPos;            // head/neck (+ eyes through rig.lookTarget)
// per frame, BEFORE human.update():
mp.update(dt);
saul.update(dt, camera, h);                // rig: proxies, fingers, face, eyes -> then the mocap body pose on top
```

* **What it drives:** root (pelvis), spine05..01, neck01..03, head, clavicles, shoulder01 (deltoid), upperarm01/02,
  lowerarm01/02 (forearm twist incl. pronation), wrist, upperleg01/02, lowerleg01/02, foot, toes (one channel
  for the five toe bones). Fingers, face, eyes and blinking stay with `HumanRig` (`rig.setFingers('R','grip')`,
  `setGripRadius`, `setExpression`, `lookTarget`) — CMU does not capture fingers.
* **Blending with the proxy path:** `mp.weight` (0 = proxies only), `mp.setMask('armR')` or `mp.mask[i]` per bone
  (e.g. legs on mocap, a procedural sling arm from `human.joints` + `PoseMixer`). `mp.detach()` removes the hook.
* **Layers:** `playLayer(layer, clip, { mask, mode: 'override' | 'additive', refTime, layerWeight, fade })`,
  `stopLayer(layer, fade)`. Masks: `full upper lower torso arms armL armR head legs none` or `{ bone: w }`.
* **Time:** `speed` per track, `setSpeed(name, rate)` (0 freezes a pose, e.g. the spear at its peak),
  `matchSpeed(name, metresPerSecond)` (no sliding at any speed), `sync: true` keeps the phase of the leading loop
  (walk <-> run blends), `additiveBlend: true` + `setWeight(name, w)` for blend spaces, `timeScale` (slow motion),
  `remaining()`, `onEnd`, `onFootstep(side)`.
* **Mirroring:** `play(name, { mirror: true })` (left/right swap + reflection; root motion mirrored).
* **Proportions:** clips were cleaned on David's skeleton; `mp.scale` = leg-length ratio scales pelvis and root
  motion (Saul 1.96 m, men). Rotations are proportion-independent.
* **Cost:** 36 bone channels, nlerp sampling; measured in the harness (swiftshader machine, 2 blended tracks + 1
  layer + foot IK + look-at): **~0.025 ms/frame per character** on top of `HumanRig.update` (0.19 ms). No
  per-frame allocations. Memory: a decoded clip is frames x 36 x 16 B (a 4 s clip ≈ 69 KB).

## Offline pipeline (what `build_clips.py` does)

1. Parse the BVH (120 fps, ZYX Euler), FK. Frame 1 (Hahne's T-pose) is the twist reference.
2. **Direction-exact retarget:** every mapped bone gets the actor's world rotation delta from the T-pose times a
   hierarchical min-arc alignment of our rest bone to the actor's T-pose bone, so arms/legs point exactly where the
   actor's did, whatever the rest-pose/bone-axis differences. Torso: Hips -> root, LowerBack -> spine05..03 (slerped),
   Spine -> spine02, Spine1 -> spine01, Neck/Neck1 -> neck01..03, Head -> head; hands from `*FingerBase`.
3. Clavicles: CMU has no clavicle data -> scapulohumeral rhythm (elevation/protraction from the arm direction in the
   chest frame, like `HumanRig`); the deltoid bone takes 30 % of the arm swing.
4. Pelvis follows the actor's hip-joint midpoint scaled by the **leg-length ratio**; Gaussian low-pass (σ 1.6
   frames at 120 fps), decimate to **30 fps**.
5. Start normalisation (origin, facing +Z), ground the soles at y = 0.
6. **Foot contacts** (heel / ball height + speed) and **foot lock**: planted heel pinned, then the ball during
   roll-off (continuous offsets), 2-bone IK on OUR legs, pelvis lowered smoothly where a leg would over-extend.
7. Loops: search the best cycle (pose + pelvis velocity; idles also close heading and position), cross-fade the tail
   into the frames that precede the loop start, straighten the heading drift of locomotion cycles, linear trajectory.
8. Root motion = smoothed pelvis ground track + heading (σ 0.35 s); the root rotation is stored relative to it.
9. Twist distribution like `HumanRig` (arm/leg twist split over the two segments, hand pronation moved into the
   forearm bones) with **unwrapped** twist angles; wrist clamped to 80°; despike (> 40°/frame) for CMU dropouts.
10. Export: int16 quaternion xyz (w reconstructed), delta-coded along time, gzip -> `.binz` (~4.6 KB per second).

## Clip table

| clip | CMU take (range) | s | loop | m/s | turn | KB | tags | notes |
|---|---|---|---|---|---|---|---|---|
| `walk` | 35_01 (0.0–3.0 s) | 1.13 | loop | 1.32 | +0° | 5.7 | loco, game, film | natural walk (subject 35, the cleanest CMU walker) |
| `walk_b` | 16_15 (0.0–3.9 s) | 1.17 | loop | 1.19 | -1° | 5.8 | loco, film, army | walk, subject 16 (variation) |
| `walk_c` | 69_01 (0.5–3.9 s) | 1.17 | loop | 0.97 | +0° | 5.8 | loco, film, army | walk forward, subject 69 (variation) |
| `walk_d` | 07_01 (0.0–2.6 s) | 1.07 | loop | 1.54 | +2° | 5.6 | loco, film, army | walk, subject 7 (variation) |
| `jog` | 35_17 (0.0–1.4 s) | 0.77 | loop | 3.27 | +2° | 4.2 | loco, game | run/jog |
| `run` | 16_55 (0.0–1.5 s) | 0.57 | loop | 4.45 | -3° | 3.4 | loco, game | run |
| `sprint` | 09_01 (0.0–1.2 s) | 0.73 | loop | 3.77 | +2° | 4.2 | loco, game | fast run (subject 9) |
| `start_walk` | 82_09 (4.8–7.8 s) | 3.00 | — | 0.48 | +3° | 13.8 | loco, game | stand -> confident walk |
| `start_jog` | 104_06 (0.0–2.4 s) | 2.40 | — | 1.64 | +4° | 12.1 | loco, game | start jog |
| `stop_jog` | 104_09 (0.3–2.9 s) | 2.63 | — | 1.41 | -3° | 13.2 | loco, game | jog -> stop |
| `walk_stop` | 16_33 (0.0–2.4 s) | 2.40 | — | 0.66 | -0° | 11.4 | loco, game, film | slow walk, stop, stand |
| `turn_left` | 69_16 (0.0–1.7 s) | 1.70 | — | 0.14 | +64° | 7.7 | loco, game | turn in place ~65 deg left (mirror = right) |
| `march_c` | 91_19 (2.8–6.8 s) | 1.23 | loop | 1.16 | +1° | 6.6 | film, army, loco | march (subject 91) |
| `march` | 20_06 (0.0–2.4 s) | 1.50 | loop | 1.08 | -0° | 7.7 | film, army, loco | soldiers march (subject 20) |
| `walk_king` | 82_09 (6.2–10.3 s) | 1.37 | loop | 0.93 | -1° | 6.9 | film, saul, loco | confident, proud stride |
| `walk_strong` | 137_42 (2.0–6.2 s) | 1.80 | loop | 0.73 | +0° | 8.6 | film, saul, loco | "strong man" heavy, broad walk |
| `walk_heavy` | 17_08 (1.0–5.0 s) | 1.73 | loop | 0.69 | +0° | 8.3 | film, saul, loco | muscular heavyset person walk |
| `walk_halt` | 82_14 (0.5–7.5 s) | 7.00 | — | 0.47 | -49° | 30.9 | film, saul, loco | walk, slow down, come to a halt, stand |
| `idle_king` | 137_41 (0.5–9.0 s) | 3.20 | loop | 0.01 | +1° | 11.6 | film, saul, idle | "strong man" wait: broad stance |
| `raise_arm_R` | 13_26 (8.0–9.3 s) | 1.37 | — | 0.03 | -77° | 7.0 | film, saul, army, gesture | right arm thrust up overhead (the spear raise; hold the peak with setSpeed 0) |
| `cheer_arms` | 79_69 (0.5–6.2 s) | 5.70 | — | 0.00 | +2° | 27.8 | film, army, gesture | very happy: both arms up, cheering |
| `cheer_reach` | 14_20 (13.0–16.6 s) | 3.60 | — | 0.07 | -3° | 17.3 | film, army, gesture | both arms reach up high |
| `arms_high` | 05_12 (8.0–11.3 s) | 3.30 | — | 0.15 | -6° | 16.3 | film, army, gesture | one arm swept up high |
| `cheer_walk` | 142_09 (11.5–14.6 s) | 3.10 | — | 1.20 | +17° | 15.9 | film, army, gesture | joyful walk with the arms up |
| `grab_pull_R` | 18_05 (0.0–3.6 s) | 3.67 | — | 0.34 | +149° | 18.3 | film, saul, gesture | step in, seize with the right hand and pull (A pulls B by the elbow) |
| `grab_R` | 56_02 (10.5–14.0 s) | 3.50 | — | 0.00 | +7° | 15.7 | film, saul, gesture | angry grab forward |
| `reach_forward` | 15_06 (0.5–3.6 s) | 3.10 | — | 0.01 | -8° | 14.3 | film, gesture | lean forward, reach for |
| `stagger_back` | 23_12 (0.0–2.5 s) | 2.53 | — | 0.85 | +4° | 12.3 | film, saul, gesture | bumped: stumble / recoil |
| `flinch` | 77_09 (0.5–3.2 s) | 2.70 | — | 0.04 | -19° | 13.4 | film, gesture | duck / flinch away |
| `recoil_surprised` | 120_15 (2.5–6.6 s) | 4.10 | — | 0.45 | +4° | 19.4 | film, gesture | surprised, backs away |
| `walk_old` | 142_07 (3.0–11.0 s) | 0.93 | loop | 0.28 | -0° | 4.6 | film, samuel, elders, loco | elderly man walk, slow and upright |
| `walk_old_hunched` | 137_33 (2.0–8.0 s) | 1.60 | loop | 0.42 | -0° | 7.5 | film, elders, loco | old man walk, stooped |
| `old_turn_walk` | 142_07 (17.5–23.5 s) | 6.00 | — | 0.06 | +176° | 25.3 | film, samuel, loco | elderly man turns away and walks off |
| `idle_old` | 137_32 (0.5–9.0 s) | 3.03 | loop | 0.00 | -1° | 13.0 | film, samuel, elders, idle | old man wait |
| `talk_gesture` | 18_08 (1.0–13.0 s) | 12.00 | — | 0.02 | -7° | 50.0 | film, elders, gesture | explaining with hand gestures (standing) |
| `argue` | 18_10 (0.0–3.0 s) | 3.00 | — | 0.03 | -6° | 14.5 | film, elders, gesture | quarrel: angry hand gestures |
| `point_directions` | 139_25 (0.0–5.5 s) | 5.53 | — | 0.16 | -30° | 26.4 | film, elders, gesture | giving directions, pointing |
| `kneel` | 23_03 (0.3–5.4 s) | 5.10 | — | 0.06 | -5° | 23.7 | film, game, gesture | kneel down, stay, rise |
| `kneel_hold` | 23_03 (1.2–4.0 s) | 1.00 | loop | 0.02 | +0° | 4.9 | film, game, idle | kneeling (loop) |
| `kneel_bow` | 23_03 (1.2–4.0 s) | 1.00 | loop | 0.02 | +0° | 5.0 | film, idle | kneeling, bowed low (kneel_hold + spine/head pitch): obeisance |
| `idle_soldier` | 137_28 (0.3–6.0 s) | 2.50 | loop | 0.03 | -1° | 10.9 | film, army, idle, game | normal wait |
| `idle_shift` | 139_02 (0.5–7.8 s) | 4.87 | loop | 0.00 | -0° | 20.1 | film, army, idle, game | shifting weight |
| `idle_nervous` | 79_73 (0.3–6.2 s) | 2.47 | loop | 0.00 | +0° | 10.8 | film, idle | scared, fidgeting |
| `idle_bus` | 40_10 (0.5–9.0 s) | 2.57 | loop | 0.00 | +0° | 10.6 | film, idle, elders | wait for the bus: restless stand |
| `pickup_squat` | 69_70 (1.3–4.8 s) | 3.50 | — | 0.21 | -80° | 16.8 | game | step up, squat, pick up, rise |
| `pickup_box` | 115_06 (0.0–3.0 s) | 3.00 | — | 0.01 | -2° | 14.6 | game | pick up from the ground bending the knees |
| `throw_overhand` | 124_01 (0.8–4.6 s) | 3.80 | — | 0.28 | +104° | 18.5 | game | overhand throw (baseball pitch) - base for the sling release |
| `throw_ball` | 141_11 (0.3–3.2 s) | 2.90 | — | 0.06 | -2° | 14.4 | game | overhand throw |
| `look_around` | 139_01 (4.5–9.0 s) | 4.50 | — | 0.01 | -41° | 20.7 | game, idle | cautious look around |

Total **49 clips, 664 KB** (gzip; the phone downloads only the clips a scene preloads).

### What CMU lacks and how it is covered

* **Walking with a staff** (elders, David): no take. Use `walk_old` / `walk` + `rig.setFingers('L','grip')`; for an
  upright staff mask the staff arm (`mp.mask` on armL = 0.3–0.5) and pose it from the proxy path.
* **Spear raise in triumph**: `raise_arm_R` (a traffic-direction take: the right arm thrusts overhead) — hold its peak
  with `setSpeed('raise_arm_R', 0)`; layer it with `mask: 'armR'` over `walk_king` / `idle_king`.
* **A crowd's cheer**: `cheer_arms`, `cheer_reach`, `arms_high`, `cheer_walk` (+ mirroring and phase offsets for variety).
* **Prostration / bowing** (וַיִּשְׁתַּחוּ): no usable take (CMU's "bow" is a dancer's curtsy — removed). `kneel`,
  `kneel_hold` and `kneel_bow` (kneel + retargeted spine/head pitch) cover it.
* **Shock / recoil**: `stagger_back` (bumped), `flinch`, `recoil_surprised`; Saul "shattered" at shot 12 is better
  done as an additive torso slump over `idle_king` than a big move.
* **Grab the robe corner** (15:27): `grab_pull_R` — a step-in lunge, seize and pull (it turns ~150°: use the first
  ~2.2 s, or root motion 'inplace'); `grab_R`, `reach_forward` are calmer.
* **Samuel turns to leave** (`old_turn_walk`, 142_07 "Elderlyman", turns ~176° and walks off; visual bible: upright,
  slow, no staff in Act I). **Carrying on the shoulders** (David + lamb): no take — walk + arms-up pose from the proxy path
  (mask the arms). **Sling release**: `throw_overhand` (a baseball pitch with a leg kick) / `throw_ball` as a base;
  the whirl above the head is procedural.
* Army march: `march` (20_06 "soldiers march"), `march_c`, `walk`..`walk_d` (+ `speed`, `mirror`, time offsets). A
  stylised high-knee parade march (142_11) was rejected: not an Iron-Age levy.
