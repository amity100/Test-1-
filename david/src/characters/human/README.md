# Realistic humans (`src/characters/human`)

Skinned, photo-real-oriented humans built from **MakeHuman 1.1 (CC0)** data by `tools/human/`.
Presets: `david` (a na'ar of ≈19-20, 1.75 m, athletic and muscular — he killed a lion and a bear —, youthful full
face, "admoni" ruddy tan, auburn brows, freckles), `saul` (≈48 y, 1.96 m, heavy powerful frame, thick neck, broad
shoulders, strong brow, forehead lines / crow's feet, grey temples, beard shadow), `man` (ordinary Israelite adult,
1.70 m, **seedable variations**).

Preset options of note (`tools/human/presets/*.json`):
* `face_macro` — the head gets its own macro build (David: a younger, average-muscle face on a max-muscle body; MakeHuman's
  max-muscle / low-weight targets otherwise hollow and age the face). Blended at the neck, rigid head shift removed.
* `skull_lock` — pins the cranium / scalp / ears / nape to a stored reference (`tools/human/ref/<preset>_skull.npz`,
  written by `python3 tools/human/skull_lock.py save <preset>` **before** reshaping; `... check <preset>` reports the
  scalp displacement). David's groomed scalp stays within ~1 mm (head-bone relative) of the 12:13 build.
* `skin.hairline` — optional override of the painted hairline table (see "Hairline" below), `skin.grey_temples`.

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

## Skinning (8 influences, LBS/DQS blend)

The body carries **8 bone influences** per vertex (`skinIndex/skinWeight` + `skinIndex2/skinWeight2`; MakeHuman's
weights need them around the shoulders and hips) and is skinned by `DualQuatSkinning` (`human.dqs`): per bone a
blend of linear-blend and dual-quaternion skinning (`defaultDQSFactor`: spine/neck/pelvis 1, thighs 0.85,
clavicle 0.5, deltoid 0.3, upper arm 0.15, elbows/knees 0.5, hands/feet 0.45, face 0 — full DQS balloons the
lat/armpit on a raised arm with MakeHuman's broad shoulder weights, pure LBS pinches it).

```ts
human.dqs.enabled = 1;                         // 0 = plain LBS everywhere (debug)
human.dqs.setFactors((bone) => 0.5);           // retune per bone at runtime
human.dqs.patchMaterial(myMaterial, true);     // only for SkinnedMeshes you bind yourself with 8 influences;
                                               // skinAttachment() already does it
```

Any other material drawn on a mesh bound to `human.skeleton` must be patched the same way (`eight = false` for
4-influence geometry), otherwise it deforms with plain three.js LBS and drifts from the skin at the shoulders.
`patchMaterial` chains an existing `onBeforeCompile`, so set your own hook **before** calling it.

## Hands, face, eyes

```ts
human.rig.setFingers('L', 'grip');   // 'relaxed' | 'fist' | 'grip' | 'open' | 'spread' | 'cup' (cross-faded)
human.setGripRadius(0.02);           // staff radius (m): fingers are solved to wrap it, grip sockets move
human.rig.setExpression('effort');   // 'neutral' | 'determined' | 'effort' | 'awe' | 'smile' | 'fear' | 'pain' | 'anger' | 'sad'
human.rig.setExpressionWeight('awe', 0.5); // layer
human.rig.faceUnits.JawDrop = 0.3;   // any MakeHuman face pose unit (see rig.json "poseunits")
human.rig.jawOpen = 0.2;
human.rig.lipSeal = 0.3;             // resting lip closure (auto-released when the jaw opens); 0 = MakeHuman's parted lips
human.rig.faceBias.LeftUpperLidClosed = 0.1;  // resting face layer (lids), added under every expression
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

* `human.skinAttachment(geometry, material, { space: 'rest', k: 6, boneFilter, facing: true })` — skins any garment
  modelled around the **rest pose** (arms down; get the body with `human.restPositions()` / `human.restNormals()`),
  transferring up to 8 weights from the k nearest body vertices that face the garment point and inverse-skinning it
  into the bind pose. Returns a `SkinnedMesh` (added to `human.root`, bound to `human.skeleton`, material(s) patched
  with the body's 8-influence LBS/DQS skinning, shadow depth material included), so cloth follows the skin exactly.
  Authored normals are kept (carried into the bind pose with the same blended matrix); geometry without normals gets
  `computeVertexNormals()`.
* **One human per material.** The DQS patch binds a material to one human's skinning data. `skinAttachment` (and
  `human.dqs.patchMaterial` / its alias `human.dqs.materialFor(material, eight)`) therefore return a **per-human clone**
  when the material already skins another human (the clone keeps the onBeforeCompile hook and program key the
  material had before its first patch). Always use the returned material / `mesh.material`; set custom hooks and
  `customProgramCacheKey` **before** the first patch (the key is captured at patch time).
* `human.hideSkin((p, bone) => boolean)` — drop body triangles under clothing (rest-pose position test).
* Hair: parent to `human.bones.head` (or `sockets.headTop`); the painted scalp/hairline and brows are in the albedo.

### Hairline (painted scalp)

`bake_skin.py` paints the scalp where `y - eyeCentre.y > HL(phi)` (phi = angle around the crown landmark, 0 = front,
180 = back; `HAIRLINE_PHI = [0, 30, 45, 62, 72, 80, 100, 120, 140, 180]`,
`HAIRLINE_HL = [0.072, 0.07, 0.064, 0.052, 0.036, -0.04, -0.028, -0.05, -0.08, -0.09]`): a natural, uncut hairline —
full temples, sideburns down to the ear lobe, hair right up to the ear and down the nape (no modern fade; the corners
of the head are not rounded, Lev 19:27). The ear itself is excluded by a ray-cast thickness test (thin flap lateral
to the skull). `src/characters/hair/HeadSurface.ts` uses the same table format.

## Performance notes

* No per-frame allocations in `HumanRig.update`; 132 bones; skinning on the GPU (bone texture + dual-quaternion
  texture). Per vertex the 8-influence LBS/DQS blend reads 8 bone matrices (4 texels each) and 8 dual quaternions
  (3 texels each) — ~56 texel fetches, twice with shadows; fine on desktop, the main vertex cost on phones.
* One draw call each for body, brows, lashes, tear lines, teeth, 2×eyeball, 2×cornea.
* **Crowds**: per preset (`HumanData`) and geometry level the topology work — Catmull-Clark subdivision (its
  position stencil is kept), uv split, 8 weights, tangents, uv density, brow/lash/tear/teeth geometry — runs once;
  every instance gets its own `BufferGeometry` sharing those attributes (David / Saul instances share positions too).
  A seeded `man` only re-applies the cached stencil to its morphed control mesh and recomputes normals. Textures are
  loaded once per preset and shared; `human.dispose()` frees per-instance resources only.
* Variation morphs (`man`) also move the brows, lashes, tear lines, teeth and the lid-opening ellipse with the
  nearest skin (3 nearest control vertices), so strands never float above or sink into a morphed face.
* Load time measured in headless software WebGL (swiftshader): hero (sub1) ≈ 0.6–2 s for the first instance,
  later instances of the same preset much less; phone numbers are not measured on a real device yet.
