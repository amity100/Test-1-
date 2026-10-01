# Film crowds (`src/film/crowd`)

The armies of the opening film (docs/intro-script.md): **Saul's army returning to Gilgal** (shots 6-9) and the
**Philistine host on the coastal plain** (shot 4). They are GPU-instanced skinned crowds driven by the real motion
capture of `src/characters/mocap`, on decimated MakeHuman bodies wearing the wardrobe's real garments.

```
dev/crowd-export.html (+ crowdExport.ts)  dresses the `man` body with the wardrobe (tunic, belt, jerkin, head-band,
                                          head-cloth, sandals, dagger/sword, spear, shield) and dumps it in the bind pose
tools/crowd/export.mjs                    runs it headless (playwright, not a project dependency) -> export.json
tools/crowd/bake_crowd.py                 decimation (pyfqmr), weights -> the 36 mocap bones, skin colour from the
                                          MakeHuman albedo, hair / beard shells from the painted hairline, generated
                                          props (bow, quiver, bedroll, waterskin, reed crown, bronze helmet, greaves)
                                          -> src/assets/crowd/{israel,philistine}.binz (3 LODs each, ~130 KB gzip)
CrowdAnim.ts      bakes mocap clips into one RGBA32F texture of skinning matrices (runs the real HumanRig of the
                  `man` preset; variants: mirrored, spear-carry right arm, "hold the peak" one-shots)
crowdShader.ts    MeshStandardMaterial patch: instanced skinning, per-instance regions / colours / head turn / spear
                  (kept clear of the forearm, >= 0.5 px wide far away), thigh push-out of the tunic skirt, dusty hair
impostorShader.ts LOD3: skeletal impostors, one camera-facing quad per far soldier; the vertex shader samples the
                  soldier's own mocap pose (11 joints + the spear from the grip) and the fragment shader draws him as
                  lit capsules (legs, skirt, torso, arms, head + hair / beard / head-cloth / reed crown / helmet,
                  shield, spear) -> thousands in one draw call, marching and raising spears like the meshes
Crowd.ts          agents, per-frame culling + LOD sort + upload, one draw call per LOD (+ shadow), near-camera hide
CrowdDust.ts      footstep dust puffs born at the feet of walking agents drawn as meshes (GPU-aged ring buffer)
SpoilHerd.ts      the spoil herds (1 Sam 15:9, 15:21): fat-tailed sheep, black goats, small humpless cattle, low-poly
                  instanced with a procedural walk / graze, beside the column (background only, bible 3.5)
GilgalArmy.ts     Saul's army driven by the gilgal blocking (armyAt / armySlot / timeScale), + impostor tail, dust,
                  herds, FilmActor slots (setActorSlots / slotState / nearestSlots)
PhilistineHost.ts the Philistine host: column mode on the land set's coast anchors (main column in companies of 16
                  ranks with an elite rank at the head of each + flank columns in the fields), or loose blocks
```

## Use

```ts
// Gilgal (shots 6-13): behind the loading screen
const { GilgalArmy } = await import('./film/crowd/GilgalArmy');
const army = await GilgalArmy.create({ tier: engine.quality.tier, ground: (x, z) => gilgal.height(x, z) });
gilgal.scene.add(army.group);                      // soldiers (4 LODs incl. impostors), footstep dust, spoil herds
army.crowd.viewportHeight = drawingBufferHeight;   // on resize too
army.crowd.precompile(engine.renderer, gilgal.scene, cam);
// FilmActors standing in the ranks near the lens (shot 9): hide those crowd figures, mirror their state
army.setActorSlots([{ file: 7, rank: 5 }, { file: 8, rank: 5 }]);   // army.slotState(7, 5) -> pos / yaw / kit / clip
// every frame, with the same beat as gilgal.setBeat(name, time):
army.setBeat(name, time);
army.update(dt, cam);             // advances by dt * timeScale(name, time) (slow motion of shot 7)
army.dispose();                   // after the film (frees the anim texture it baked)

// the coast (shot 4)
const { PhilistineHost } = await import('./film/crowd/PhilistineHost');
const host = await PhilistineHost.create({ tier: engine.quality.tier, coast: land.anchors.coast!, ground: (x, z) => land.height.height(x, z) });
land.scene.add(host.group);  land.showPlaceholders(false);
host.crowd.viewportHeight = drawingBufferHeight;
host.setTravel(0);                 // at the cut into shot 4 (the head of the column at anchors.coast.columnHead)
// each frame: host.update(dt, cam) (marches host.speed m/s along the road)
host.dispose();
```

Low level: `CrowdAnim.bake(specs)` then `Crowd.create({ army, anim, capacity, tier, impostors?, nearHide? })`, set
`crowd.agents[i]` (`pos`, `yaw`, `scale`, `girth`, `seed`, `mask` = `bit('spearShaft', …)`, `lean`, `headYaw`,
`visible`, `stride`) and `agent.play('march:m:c', { fade, time, rate })`; `crowd.update(dt, camera)` each frame.

## Accuracy (docs/visual-bible.md)

* Israel (§3.0, §3.4): on foot only, no horses / camels / chariots, no banners or drums; bearded (Lev 19:27), knee
  tunics of undyed wool (palette §2), a few madder / ochre stripes, leather belts, sandals or barefoot (28 %),
  head-cloths (40 %) or headbands (25 %); kit per 100 men 45 spears, 20 slingers, 15 archers, 10 swords/daggers,
  10 goads; ~35 % round oiled-leather shields (Rashi 2 Sam 1:21), on the arm or slung on the back; 5 % leather
  corselet; no bronze helmets or scale armour (Saul's alone). The king's first two ranks: spear + shield.
* No crosses (§5): daggers and swords hang sheathed in brown leather with their guards slimmed in the shader, so a hilt
  at the belt never reads as a dark cross on a light tunic. No banners, standards, drums, horses, camels or chariots.
* Spoils (§3.5): fat-tailed sheep (Awassi: cream wool, dark head and legs, the fat tail), black goats, small humpless
  cattle, north of the road beside / behind the column, walking with it and grazing at the halt; no camels, no Agag.
* Philistines (§3.9): clean-shaven, reed / feather crown on a band (rank and file), ribbed corselet over a kilt
  with a tasselled hem, round shields; elite (front ranks) bronze helmet (17:5), bronze greaves (17:6), bronze
  bosses, swords, iron spear heads. No chariots are drawn.

## Costs (headless swiftshader, the real sets through PostFX, `dev/crowd-sets.html`)

| tier | Gilgal army (mesh ranks + impostor tail) | Philistine host | crowd triangles in the heaviest shot | CPU / frame (setBeat + update) |
|---|---|---|---|---|
| desktop-high | 74 + 110 ranks x 15 = 2760 | 3800 (3 columns) | 2.3 M (shot 7), 1.8 M (shot 8), 1.3 M (coast column) | 2.5-4 ms |
| desktop-medium | 46 + 100 ranks = 2190 | 2600 (2 columns) | ~1.2 M | ~2.5 ms |
| mobile-high | 30 + 60 ranks = 1350 | 1600 (2 columns) | ~0.5 M | ~2 ms |
| mobile-low | 22 + 44 ranks = 990 | 1200 (2 columns) | 0.34 M (shot 8, no crowd shadows), 0.16 M (coast) | ~2 ms |

Per-tier LOD distances / caps (Crowd.ts TIER_LOD): LOD0 < 22/16/10/8 m (cap 90/60/24/14), LOD1 < 60/45/32/26 m
(320/220/120/70), LOD2 mesh < 150/110/70/55 m (1500/900/360/200), impostors to 2500/2000/1500/1200 m
(6000/4000/2400/1600, 2 triangles each). LOD triangles: Israel 6186 / 2431 / 829, Philistines 5256 / 2138 / 787.
Draw calls: 1 per LOD in use + shadows + 1 dust + 3 herd kinds. Dust: 700/450/220/140 particles. Herds: 150/100/60/36
animals (~260-560 triangles each). Anim texture 3.3 MB desktop / 1.4 MB phones. Assets 137 + 114 KB gzip.

## Rebuild

```
npx vite build --config <scratch vite config with input dev/crowd-export.html>   # serve it, then
node export.mjs export.json                                                      # page -> window.__out
python3 tools/crowd/bake_crowd.py export.json                                    # needs pip install --user pyfqmr
```

## Cut v2 behaviour (anim teammate) — the timing contract of `src/content/introScript.ts`

Every beat below is read from the contract through `src/film/gilgal/gilgalBlocking.ts` (`BEATS`, `armyAt`), never
hard-coded:

* **G1–G2 march** — every man his own take (CMU `march` `march_c` `walk_b..d` + Rocketbox `walk_n1` `walk_n2`
  `walk_cool_b`, mirrored), phase, pace (±6 %) and spear bob (the `carry` bakes keep 25 % of the arm swing); 45 % of
  the men look about now and then (`headYaw`).
* **G3 halt + roar** — the column rolls in onto its marks and halts rank by rank from the king back (`halt` + 0.12 +
  0.018 s per rank + jitter); at `roar` (+ 0 … `roarSpread`, the front and centre first) every man plays his own take:
  Rocketbox `cheer_1..5` (m_cheer_01..05) or the CMU raises held at their peak (`raise_arm_R` `cheer_reach`
  `arms_high`), `cheer_arms`; spear-men never mirror (the spear goes up in the right hand); ~20 % turn their head to
  shout at a neighbour.
* **G4 silence** — the roar is cut: the men freeze in their pose (rate 0.05); heads turn to the road (`headsTurn` +
  0.012 s per rank + jitter); the arms come down over 0.9–1.5 s; some men turn the whole body to look (Rocketbox
  `look_around_L/R`, desktop); the front ranks STEP aside (`part`): they play a walk at the speed of their slot's move,
  turn into the step and back — away from the lens lane `PART_LANE` (1.575 m south of the road's centre, FilmCams'
  G4 lane), so nobody walks into the long lens.
* **G5–G7** — standing (weight-shifting idles), heads toward the two men.
* **Hero soldiers** (`ArmyHeroes.ts`): full FilmActors take the slots nearest the lens that are in view on the first
  frames of every beat (`setActorSlots` hides the crowd figure) and play that soldier's part with the real mocap on
  the full human (his march take, halt, cheer with the mouth open, freeze, head turn, step aside). Two or three of them
  are the rams'-horn blowers of G1 (visual-bible 3.4): at `horns` the horn goes from the hand to the lips (placed each
  frame between the carry and the blowing pose, the hands follow by arm IK), the head goes back, the cheeks fill.
  Count per tier `HERO_COUNT`: desktop-high 3 horns + 2 spear-men, desktop-medium 3 + 1, phones 2 horns; their hair is
  the exact groom (no strand sim). `GilgalArmy.create({ heroes: false })` turns them off.
* **Philistines (P4)** — Rocketbox walks added to the take mix, a slow lateral weave per man (nobody on rails), a glance
  to the side now and then.
* Clip lists to release after the film: `ARMY_CLIPS` (GilgalArmy.ts) minus the game's `DAVID_MOCAP`.
