# Realistic humans (`src/characters/human`)

Skinned, photo-real-oriented humans built from **MakeHuman 1.1 (CC0)** data by `tools/human/`.
Presets: `david` (≈20 y, 1.75 m, lean athletic, "admoni" ruddy tan, freckles), `saul` (≈48 y, 1.96 m, broad,
strong brow, beard shadow), `man` (ordinary Israelite adult, 1.70 m, **seedable variations**).

```
tools/human/presets/<name>.json   modifiers (MakeHuman targets), skin/brow/eye style
tools/human/build_human.py        -> src/assets/human/<name>/{rig.json, human.binz}
tools/human/bake_skin.py          -> src/assets/human/<name>/{albedo,normal,mask}_{2k,1k}.webp
                                     src/assets/human/common/{skin_detail_normal, eye_*}.webp (--common)
```

## Loading

```ts
import { HumanModel } from './characters/human/HumanModel';
const david = await HumanModel.load({ preset: 'david', quality: engine.quality.name });
scene.add(david.root);                      // faces +Z, left = +X, soles on y = 0, origin under the pelvis
const guard = await HumanModel.load({ preset: 'man', quality: q, seed: 7 });   // random build/face/skin tone
```

| quality | body geometry | textures | shader |
|---|---|---|---|
| `high` | Catmull-Clark level 1 done at load (limit surface, ~56k verts / 107k tris) | 2048² | dual-lobe spec, transmission, sheen, 2-sample pore detail |
| `medium` | hm08 control mesh (14.5k verts / 27k tris) | 2048² | single lobe, transmission, pore detail |
| `low` (phones) | hm08 control mesh | 1024² | wrap SSS only, no detail map, half the brow/lash strands |

Override with `geometry: 'base' | 'sub1'` and `textureSize: 1024 | 2048`.

## Posing (drop-in for `DavidModel.j`)

`human.joints` are proxy `Object3D`s named `hips spine chest neck head uaL faL hdL uaR faR hdR thL shinL ftL thR shinR ftR`
with the DavidModel conventions (rotation.x < 0 swings a limb forward, + shin bends the knee, all limbs hang straight
down at rotation 0). Drive them with `PoseMixer` and foot IK exactly like before, then call once per frame:

```ts
mixer.apply();
human.joints.hips.position.y = human.rig.hipHeight + (mixer.cur.hipsY ?? 0);
human.joints.hips.position.z = human.rig.pelvis.z + (mixer.cur.hipsZ ?? 0);
// foot IK: a = human.rig.thighLength, b = human.rig.shinLength
human.update(dt, camera, renderer.domElement.height);   // proxies -> MakeHuman bones, face, eyes
```

`HumanRig.update` maps each proxy rotation `r` (character axes) onto the MakeHuman bones with
`bone.local = B·W⁻¹·r·W` (W/B = rest world/local rotation), distributes spine/neck over spine05…01 / neck01…03,
splits limb twist over the twist bones (the forearm also takes the hand's twist), and drives the clavicle and
deltoid with the arm (scapulohumeral rhythm) and a subtle breathing cycle (`rig.breathe`).

## Hands, face, eyes

```ts
human.rig.setFingers('L', 'grip');   // 'relaxed' | 'fist' | 'grip' | 'open' | 'spread' | 'cup' (cross-faded)
human.setGripRadius(0.02);           // staff radius (m): fingers are solved to wrap it, grip sockets move
human.rig.setExpression('effort');   // 'neutral' | 'determined' | 'effort' | 'awe' | 'smile' | 'fear' | 'pain' | 'anger' | 'sad'
human.rig.setExpressionWeight('awe', 0.5); // layer
human.rig.faceUnits.JawDrop = 0.3;   // any MakeHuman face pose unit (see rig.json "poseunits")
human.rig.jawOpen = 0.2;
human.rig.lookTarget = worldPoint;   // eyes (clamped); null -> rest gaze + micro-saccades
human.rig.blinkEnabled = true;       // natural blinking; human.rig.blink() forces one
human.setPupil(0.2);                 // 0 bright sun .. 1 dark
```

## Sockets (`human.sockets.*`, children of bones)

| name | parent bone | frame |
|---|---|---|
| `handGripL/R` | wrist | origin = centre of the fist hole (for `rig.gripRadius`); **+Y** along the hole toward the thumb/index side (a staff passes along ±Y), **+X** out of the palm |
| `palmL/R` | wrist | palm centre, same axes |
| `shoulderCarry` | spine01 | on the shoulders behind the neck; **+Z points along the character's +X** (like `DavidModel.shoulderSocket`: a lamb modelled facing +Z lies across the shoulders) |
| `headTop` | head | top of the skull |
| `chin` | jaw | chin point (beard anchor; follows the jaw) |
| `crownAnchor` | head | centre of the head cross-section at crown height; radii in `human.metrics.crownRadius` = [x half-width, z half-depth] |
| `eyeL/R`, `mouth`, `spineUpper`, `pelvis` | head / spine01 / spine05 | reference points |

`human.addSocket(name, bone, restPos, restQuat)` creates more (rest-pose character coordinates).

## Clothing / hair helpers

* `human.skinAttachment(geometry, material, { space: 'rest' })` — skins any garment modelled around the **rest pose**
  (arms down; get the body with `human.restPositions()`), transferring weights from the nearest body vertices and
  inverse-skinning it into the bind pose. Returns a `SkinnedMesh` on the same skeleton.
* `human.hideSkin((p, bone) => boolean)` — drop body triangles under clothing (rest-pose position test).
* Hair: parent to `human.bones.head` (or `sockets.headTop`); the painted scalp/hairline and brows are in the albedo.

## Performance notes

* No per-frame allocations in `HumanRig.update`; 132 bones; skinning on the GPU (bone texture).
* One draw call each for body, brows, lashes, tear lines, teeth, 2×eyeball, 2×cornea.
* Hero load ≈ 0.6–1.2 s on desktop (subdivision + tangents on the CPU); phone tier ≈ 0.3–0.4 s.
