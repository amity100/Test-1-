# Wardrobe (`src/characters/wardrobe`)

Film-costume clothing, accessories and hand props for the MakeHuman bodies of `src/characters/human`, fitted **at load
time** from `human.restPositions()` — so garments re-fit automatically when a preset (`tools/human/presets/*.json`) or a
seeded `man` variation changes the body. Nothing is hand-tuned to one mesh.

```ts
import { dressDavid, dressSaul, dressMan, attachProp } from './characters/wardrobe';

const human = await HumanModel.load({ preset: 'david', quality: engine.quality.name });
const outfit = await dressDavid(human, { quality: engine.quality.name });   // Saul: dressSaul(human, { quality })
// court: dressMan(human, { quality, role: 'guard' | 'runner' | 'servant' | 'abner', seed })
human.root.position.y += outfit.groundOffset;              // sandal soles are 9 mm thick (or raise the IK ground)
attachProp(outfit.props.staff!, human.sockets.handGripR);  // props are NOT pre-attached (grip frame: +Y along the shaft)
human.setGripRadius(outfit.props.staff!.object.userData.radiusAtGrip);
engine.enforceTextureBudget(human.root);                   // wardrobe textures are <= 1K already
// every frame, AFTER human.update(dt, camera, h):
outfit.update(dt, { velocity /* world m/s */, wind /* world m/s */ });
outfit.resetDynamics();                                    // after teleports / camera cuts
outfit.setVisible(false); outfit.dispose();
```

## Outfit

| member | |
|---|---|
| `root` | group under `human.root` (skinned garments are children of `human.root` too; all tracked in `meshes`) |
| `props.staff` / `props.spear` | `Prop { object, grip, tip, butt }` — `grip` is the frame for `handGripL/R` (+Y along the shaft toward the tip); `object.userData.radiusAtGrip` for `setGripRadius` |
| `props.slingPouch` | leather cradle (Object3D) with children `cordA` / `cordB` where the two cords attach; cupped toward −Y |
| `props.slingCordMaterial` | braided-cord material for `Rope.ts` tubes (uv.x around, uv.y 0..1 along; repeat 60 ≈ 0.75 m cord) |
| `props.satchel` | the shepherd's bag (already on the left hip, pendulum sway); add stones as children of `props.satchel.children[0]` |
| `props.sword` / `props.dagger` | already hanging from the belt (sockets `wardrobeSword` / `wardrobeDagger`); +Y toward the hilt, origin = scabbard mouth |
| `props.shield` | NOT attached; child `grip` (the handle); +Z = face |
| `groundOffset` | sandal sole thickness |
| `stats` | `{ triangles, drawCalls, textures, buildMs }` |
| `capsules` | leg capsules (thigh/shin) used by the skirt vertex-shader push-out and by cords |

Secondary motion: hem sway (damped spring driven by −velocity and wind, applied in the cloth vertex shader, strongest at
the hem), leg-capsule push-out in the vertex shader (legs never poke through skirts/robes in walk / run / crouch / kneel),
verlet chains for the sash cords (David) and the tzitzit (Saul) with tassel cards, a pendulum for the satchel.
No per-frame allocations except inside `Pendulum.step` (two small vectors — TODO pool).

## What each character wears

* **David** (`david.ts`): coarse, loosely woven undyed **wool** tunic (open grid weave, 7 mm thread pitch as in the
  reference; see-through gaps at frayed edges; back-light translucency), short sleeves ending above the elbow with frayed
  cuffs, V-neck with a whip-stitched rolled edge, holes/tears with frayed borders and loose threads (chest, skirt),
  knee-length ragged hem with fringe + a longer, yellower frayed under-layer; sash of rust-brown and tan twisted cords
  wound 3× and knotted in front, 4 hanging cords to the knee with frayed tassels; satchel (woven body, leather flap with
  laced edge and toggle, bulging with 5 stones) on the LEFT hip on a leather strap over the LEFT shoulder; sandals
  (sole, forefoot band, criss-cross ankle thongs, side risers); staff 1.75 m gnarled/knotty, bark worn smooth at the grip;
  sling cradle + braided cord material. Wool only (sha'atnez), no tzitzit (a closed tunic has no corners).
* **Saul** (`saul.ts`): long linen undertunic (separate garment → no sha'atnez); **me'il** of murex purple wool cut as a
  long tabard open at the sides → four corners with **tzitzit** (white + one tekhelet thread); woven scarlet band with
  lozenges + tekhelet stripes + a row of sewn gold discs at the hem, scarlet zigzag band + gold discs at the neck
  (geometric only); wide scarlet sash with gold plaques; gilded-bronze-fitted sword in a leather scabbard; thin gold
  **nezer** band with a lozenge plaque (`sockets.crownAnchor`, `metrics.crownRadius` + 1 cm for hair); gold **etz'adah**
  armlet on the left upper arm; sandals; spear 2.5 m with a leaf-shaped iron head and a bronze butt-spike.
* **Court** (`court.ts`, seedable): guards/runners — knee-length wool tunics in natural/earthy dyes, leather belt, 60 % of
  guards a sleeveless leather jerkin, 65 % a headband, spear, round or oval oiled-leather shield with bronze/leather boss
  (guards), dagger; servants — plain tunic, cloth sash, wrapped headcloth; **Abner** — madder-red fine tunic with a
  checked ochre/tekhelet hem band, sword belt + sword, spear, blue headband.

## Costs (measured in the harness, headless software GL; CPU times on a shared 4-core box)

| | high | low (phones) |
|---|---|---|
| David garments + props | ≈ 65 k triangles, 34 draw calls (+ shadow pass) | ≈ 30 k triangles, ~28 draw calls |
| Saul | ≈ 55 k triangles, 42 draw calls | fewer segments |
| court man | 30–54 k triangles, 10–23 draw calls | |
| textures | 1K tileable (weave pair 2×~0.3 MB, leather, wood, bark), 512 metal, 256 rope/braid | 512 / 256 variants |
| fitting time | 1.2–4 s per character (hull fields + weight transfer + inverse skinning), less on low | |

All wardrobe textures together: 3.9 MB of WebP (both sizes); a character loads only what it uses (lazy glob).

## Tools

`python3 tools/wardrobe/gen_textures.py [names…]` regenerates `src/assets/wardrobe/*.webp` (~45 s for all).
Harness: `dev/wardrobe.html?who=david|saul|guard|runner|servant|abner&q=high|medium|low&seed=N`, scripted with
`window.__W.shot({ pose, view, w, h, vel })` (poses: rest, ref, walk, run, crouch, kneel, sling, king; views: front,
three4, back, profile, low, posed, vneck, sash, satchel, sandals, hem, head, belt, arm, prop).
