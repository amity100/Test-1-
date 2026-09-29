# Saul's court — `src/palace/cast/`

King Saul and his court on the set of his house at Gibeah (`src/palace/`), staged per intro beat
(`src/content/introScript.ts`, research in `docs/sources.md` §3–5).

```ts
import { PalaceSet } from './palace/PalaceSet';
import { PalaceCast } from './palace/cast';

const palace = await PalaceSet.create({ renderer, quality: engine.quality, tex: engine.tex });
const cast = await PalaceCast.create(palace, {
  quality: engine.quality.name,            // 'low' | 'medium' | 'high'
  msaa: engine.quality.msaa,               // hair coverage mode (0 = dithered, resolved by TAA)
  beats: INTRO_CUES_SHORT.map((c) => c.beat), // optional: only build the actors these beats need
  onProgress: (f, label) => ui.progress(f, label),
});
engine.enforceTextureBudget(palace.scene);  // covers the cast too (cast.root is inside palace.scene)

// on every intro cue
cast.setBeat(cue.beat, secondsIntoBeat);   // 'judea' / 'bethlehem' / ... / null hide the cast
cam.playShots(cast.beatShots(cue.beat));   // or the set's shots + cast.focus(...) for your own

// every frame while a palace beat is on screen, BEFORE palace.update / post.render
cast.update(dt, camera, drawingBufferHeight);

cast.dispose();                             // before palace.dispose()
```

## Staging

| beat | who / where |
|---|---|
| `gibeah` | the court already under the tamarisk on the height; the men at arms stand at the gate (`anchors.gateGuardMarks`) |
| `saul-court` | Saul enthroned on the front of the stone seat under the tamarisk, spear upright in his right hand, butt planted (22:6, 26:7); servants with jug and bowl and the young armour-bearer (14:1) at his shoulders; two runners/guards (22:17) flanking in front; Abner (14:50) a little apart at his left |
| `saul-portrait` | Saul risen before the seat and turned so the low morning sun is behind his left shoulder (warm rim), the dark tamarisk trunk and hanging foliage behind him; the armour-bearer at his left shoulder and a runner at his right, their heads at his shoulders — a head and shoulders above all (9:2, 10:23). Low-angle push from a medium shot to a close shot (`shots.portrait`); eyes open to the horizon, brows level and low |
| `warriors` | Abner walks the line of men at arms 9 m in front of the seat — Benjaminite archers and slingers (1 Chr 12:2, Judg 20:16), a spearman with an oiled leather shield (2 Sam 1:21), guards closing the line; Saul watches from his seat (14:52) |
| `saul-hall` | evening (the set's `setTimeOfDay('evening')` is switched automatically): the king alone on his seat by the wall (20:25), the set's spear leaning by him, brooding — the weight of 15:28 / 15:35, NOT the evil spirit of 16:14 |
| `hinge` | the same seat; he has lifted the torn corner of a robe in his left hand (elbow on the thigh, pose `kingSeatedMemory`) and looks at it — the memory of Gilgal. By the plain sense (Rashi, Radak, Metzudat David on 15:27) Saul took hold of the corner of SAMUEL's me'il and it tore, so the piece is undyed dark wool (a prophet's robe, not Saul's purple), with its tzitzit and tekhelet thread. `shots.robeCorner`: close on the cloth, pulling back and up to his bowed face |

## Camera helpers

* `cast.focus(name)` → world `Vector3`: `'saul'` (upper chest), `'saulFace'` (between the eyes), `'saulEyeL'`,
  `'saulEyeR'`, `'saulHead'` (crown), `'saulHand'` (right grip), `'spear'` (spear tip: his own in the exterior beats,
  the set's leaning spear in the hall), `'abner'` (Abner's eyes), `'robeCorner'` (tzitzit corner of the torn robe).
* `cast.shots` (`CastShots`, same `Shot` type as `palace.shots`): `court` 6.5 s, `portrait` 4.8 s, `warriorsLine` 4 s,
  `warriorsSaul` 3 s, `hall` 6 s, `robeCorner` 5.5 s — framed from probed positions of the settled poses.
* Harness: `dev/court.html?q=high|medium|low&beats=…&taa=0&hud=1&play=1`; `window.__court.shot(beat, i, u, frames, acc)`
  renders shot `i` of `cast.beatShots(beat)` at normalised time `u` (`acc` > 0 averages that many extra frames of the
  same instant, i.e. what TAA converges to). Screens: `dev/screens/court/`.
* `cast.beatShots(beat)` → suggested shot list per beat (set shots + cast shots).

## Light

`castLights.ts`: key / rim / fill per beat (never added or removed after create, so no program recompiles):
exterior beats a warm reflector key and a low-sun rim (the portrait is low-key: sun rim behind his left shoulder,
key on the far side of the face, the lens on the shadow side); the evening hall a flickering niche-lamp key, a cool
window rim and a warm floor bounce. `castInterior.ts` blends the set's interior light model (sky ambient down to the
set's `uSkyVis`, warm floor bounce) into the cast's skin, garments and props for the hall beats only
(`castInterior.value` 0 outdoors / 1 inside, switched by `setBeat`), as the set's own `interiorize` does for walls.

## Fixes layered on the shared characters (cast-local)

* Saul's linen kuttonet (body + skirt) is pulled 3 mm (8 mm on low) inside the me'il in the vertex shader — the
  wardrobe's layering otherwise lets it poke through in the seated poses (large white patches on phones).
* The me'il / sash get a polygon offset toward the camera (thin layered cloth over the kuttonet).
* First blinks are desynchronised per actor (HumanRig starts every face 2 s before its first blink).

## Actors (`CastActor`)

HumanModel + `createGroom` + wardrobe outfit + props, a base pose (`castPoses.ts`) and procedural idle life: breathing,
slow weight shifts, head turns toward `lookTarget` with occasional glances, eye saccades and blinks, micro head
motion, wind in hair and cloth (outdoors). A grip solver keeps a held spear upright with its butt planted on the
ground (the hand re-aims each frame, the shaft slides through the fist). `actor.settle()` after cuts.

| tier | actors built (all beats) |
|---|---|
| high | Saul (sub1 body, full groom ×0.8), Abner (sub1), armour-bearer, 2 servants, 2 guards, 2 archers, a slinger, a spearman (base bodies, low-tier grooms) — 11 |
| medium | the same minus the spearman — 10 |
| low (phones) | Saul, Abner, bearer, 1 servant, 2 guards, 1 archer, 1 slinger — 8; pass `beats: INTRO_CUES_SHORT…` to drop the `warriors` men (5) |
