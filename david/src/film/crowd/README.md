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
Crowd.ts          agents, per-frame culling + LOD sort + upload, one draw call per LOD (+ shadow)
GilgalArmy.ts     Saul's army driven by the gilgal blocking (armyAt / armySlot / timeScale)
PhilistineHost.ts the Philistine host (blocks or a column along the land set's coast route)
```

## Use

```ts
import { GilgalArmy } from './film/crowd/GilgalArmy';
const army = await GilgalArmy.create({ tier: engine.quality.tier, ground: (x, z) => gilgal.ground.height(x, z) });
gilgal.scene.add(army.group);
// every frame, with the same beat as gilgal.setBeat(name, time):
army.setBeat(name, time);
army.update(dt, camera);          // advances by dt * timeScale(name, time) (slow motion of shot 7)
army.dispose();                   // after the film (frees the anim texture it baked)

import { PhilistineHost } from './film/crowd/PhilistineHost';
const a = land.anchors.coast!;
const host = await PhilistineHost.create({ tier, trail: [a.columnHead, ...a.route.slice().reverse().filter((p) => p.x < a.columnHead.x)],
  columnWidth: a.columnWidth, ground: (x, z) => land.height.height(x, z) });
land.scene.add(host.group);  host.speed = 1.2;  // each frame: host.update(dt, camera)
```

Low level: `CrowdAnim.bake(specs)` then `Crowd.create({ army, anim, capacity, tier })`, set `crowd.agents[i]`
(`pos`, `yaw`, `scale`, `girth`, `seed`, `mask` = `bit('spearShaft', …)`, `lean`, `headYaw`, `visible`) and
`agent.play('march:m:c', { fade, time, rate })`; `crowd.update(dt, camera)` each frame.

## Accuracy (docs/visual-bible.md)

* Israel (§3.0, §3.4): on foot only, no horses / camels / chariots, no banners or drums; bearded (Lev 19:27), knee
  tunics of undyed wool (palette §2), a few madder / ochre stripes, leather belts, sandals or barefoot (28 %),
  head-cloths (40 %) or headbands (25 %); kit per 100 men 45 spears, 20 slingers, 15 archers, 10 swords/daggers,
  10 goads; ~35 % round oiled-leather shields (Rashi 2 Sam 1:21), on the arm or slung on the back; 5 % leather
  corselet; no bronze helmets or scale armour (Saul's alone). The king's first two ranks: spear + shield.
* Philistines (§3.9): clean-shaven, reed / feather crown on a band (rank and file), ribbed corselet over a kilt
  with a tasselled hem, round shields; elite (front ranks) bronze helmet (17:5), bronze greaves (17:6), bronze
  bosses, swords, iron spear heads. No chariots are drawn.

## Costs (headless swiftshader harness, `dev/crowd.html`)

| tier | Gilgal army figures | LOD caps (0/1/2) | triangles incl. shadows | CPU / update |
|---|---|---|---|---|
| desktop-high | 1110 (74 ranks x 15) | 90 / 320 / 4000 | ~1.9 M (roar view) | ~1.5-2 ms |
| desktop-medium | 690 (46 ranks) | 60 / 220 / 3000 | ~1.0 M | ~1.2 ms |
| mobile-low | 330 (22 ranks) | 14 / 80 / 700 | ~0.47 M (no crowd shadows) | ~0.9 ms |

LOD triangles (all regions; switched-off regions are degenerate and not rasterised): Israel 6186 / 2431 / 829,
Philistines 5256 / 2138 / 787. Anim texture: 1920 frames on desktop (RGBA32F 1080 x 192 = 3.3 MB),
803 frames on phones (1.4 MB). Bake at load: 0.4-1 s. Assets: 137 + 114 KB gzip.

## Rebuild

```
npx vite build --config <scratch vite config with input dev/crowd-export.html>   # serve it, then
node export.mjs export.json                                                      # page -> window.__out
python3 tools/crowd/bake_crowd.py export.json                                    # needs pip install --user pyfqmr
```
