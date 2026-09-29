# Strand hair & beards (`src/characters/hair`)

Real strand hair for the MakeHuman-based `HumanModel`: grooms are **grown deterministically at load** from the rest-pose
skin of the actual head (so seeded `man` variations get exact root positions), rendered as **camera-facing ribbon
strands** (instanced, spline-evaluated in the vertex shader) with a **Marschner / Karis hair BSDF**, baked self-occlusion,
shadow casting onto the face, guide-strand dynamics and a scalp/beard **cap** under the strands.
No asset files, no third-party code.

```ts
import { createGroom } from './characters/hair';

const david = await HumanModel.load({ preset: 'david', quality: engine.quality.name });
const hair = await createGroom(david, 'david', { quality: engine.quality.name, msaa: engine.quality.msaa });
// parented to david.bones.head automatically (hair.root)

// per frame, AFTER human.update(dt, camera, h):
hair.update(dt, windVelocityWorld);          // guides + jaw following; no allocations

// Saul with the wardrobe's nezer (headRing height 0.017, extra 0.01, thickness 0.0022, tilt 0.008 on crownAnchor):
const [rx, rz] = saul.metrics.crownRadius;
const saulHair = await createGroom(saul, 'saul', {
  quality, msaa, headband: { height: 0, radius: [rx + 0.0078, rz + 0.0078], width: 0.017, tilt: 0.008 },
});

// ordinary men (guards, runners, servants, Abner) — seedable
const g = await createGroom(guard, { kind: 'man', seed: 7, beard: 'full', headband: true }, { quality, msaa });
```

## API

| | |
|---|---|
| `createGroom(human, style, opts): Promise<Groom>` | `style`: `'david'` \| `'saul'` \| `{ kind: 'man', seed, beard?: 'none'\|'short'\|'full', headband?: boolean }` (beard defaults to a seeded short/full choice) |
| `opts.quality` | `'low' \| 'medium' \| 'high'` (= `engine.quality.name`) |
| `opts.msaa` | `engine.quality.msaa` (default: low 0, else 4). With MSAA ribbons go down to 0.55 px and the rasteriser's sample coverage anti-aliases them; without MSAA they stay ≥ 1 px with dithered coverage (FXAA smooths it) |
| `opts.headband` | `{ height, radius: [x, z], width?, tilt? }` relative to `sockets.crownAnchor`: hair outside the band ellipse is pressed in to it (tight under the band, relaxing over ~3 cm). `man` with `headband: true` uses `crownRadius + 4 mm` |
| `opts.simulate` / `opts.density` | guide dynamics on/off (default on); strand-count scale |
| `groom.root` | `THREE.Group` under `human.bones.head` (strands + cap) |
| `groom.update(dt, wind?)` | after `human.update()`: Verlet guides (gravity difference, wind drag + gusts, head inertia, SDF collision) → guide texture; jaw matrix for beards |
| `groom.setVisible(v)`, `groom.dispose()` | |
| `groom.setMSAA(samples)` | when the engine governor changes MSAA |
| `groom.setSimulation(on)` | freeze to the exact groom (e.g. for a still portrait) |
| `groom.lodFullPx` (360), `groom.lodMinFraction` (0.12), `groom.shadowFraction` (0.45), `groom.windScale` | distance LOD: below `lodFullPx` projected head height a uniform random subset of strands is drawn, widened to keep the coverage; the shadow pass draws `shadowFraction` of them |
| `groom.stats` | strands, control points, segments, sim guides, triangles, GPU bytes, build ms (+ per phase), per-layer diagnostics |

## How it works

1. **HeadSurface** (`HeadSurface.ts`): `human.restPositions()/restNormals()`, per-vertex head / neck / jaw weights from the
   8 skin influences, the scalp mask (same hairline curve as the painted scalp in `tools/human/bake_skin.py`; ears excluded by a
   flap-thickness test on the SDF), the beard mask (cheek line, moustache, under-chin; lips kept bare), a **signed distance field**
   of head+neck(+shoulders for long hair) built by chamfer nearest-vertex propagation (5-8 mm grid), stratified area-weighted
   root sampling and Poisson lock centres.
2. **Grooming** (`grow.ts`, styles in `styles.ts`): each lock (≈170-260 per layer) grows a flow curve (lift off the skin,
   comb field, gravity, tousle noise, kept outside the SDF at a volume offset) with a parallel-transport frame. Child strands
   join the nearest lock: root spread → clumping, a per-lock **helix** (radius / pitch / phase / handedness, with radius and
   phase noise so ringlets are irregular), a twisted position inside the lock, frizz, flyaways, final SDF push-out. Then the
   optional headband compression, baked **occlusion** (optical depth of the hair further out along the SDF gradient + skin
   proximity), per-strand colours (root → tip gradient, brightness/hue variation, grey threads), and a **global shuffle** so
   any prefix is a uniform subset of all layers (distance LOD).
3. **Rendering** (`HairMaterial.ts`): one `InstancedBufferGeometry` per groom (instance = strand, template = ribbon of
   `segs+1` vertex pairs). Control points (x y z ao, head space) live in a float texture; the vertex shader evaluates a
   Catmull-Rom spline, adds the blended displacement of two simulated guides, blends to the jaw for beard strands, and
   expands the ribbon perpendicular to the view with a root→tip taper. Lighting replaces three.js' `RE_Direct` with the
   far-field Marschner model in Karis' form (R shifted toward the root, TT back-light transmission — the golden-hour rim glow —,
   coloured TRT shifted toward the tip, Kajiya/wrap multiple-scattering diffuse on an ellipsoidal volume normal) and scales
   direct/indirect light by the baked occlusion; everything else (sun shadows, hemisphere, env, fog, tone mapping) is the stock
   `MeshStandardMaterial` path. **Transparency without sorting**: strands are opaque; sub-pixel coverage is stochastic
   (interleaved-gradient-noise alpha test) and, with MSAA, geometric per sample. Alpha-to-coverage is *not* used for strands
   (equal alpha values map to the same sample mask, so overlapping strands never accumulate — tried, it looks like a ghost);
   it *is* used for the cap's soft hairline edge (single layer), alpha-hash without MSAA.
   `HairDepthMaterial` casts shadows with the same expansion (1.6× wider, ≥ 1 shadow texel, dithered coverage).
4. **Cap**: the scalp (and beard) region of the skin, offset 1-6 mm along the normal, hair-root coloured with noise, soft
   alpha at the hairline; follows the jaw. Keeps the scalp from showing through on every tier.
5. **Dynamics** (`HairSim.ts`): 16-56 guides per groom, damped Verlet in world space, roots pinned, style-memory spring
   toward the groomed shape (fading to the tip), gravity applied as the difference to the groomed gravity (still upright
   head = exact groom), wind drag with gusts, SDF collision via the head's current transform. Output: K × G float texture.

## Costs (measured in headless Chromium; desktop GPUs / JS engines are faster)

| | strands (David / Saul / man) | ctrl pts → segs | triangles (all strands) | draw calls | GPU memory | build (David, desktop CPU) |
|---|---|---|---|---|---|---|
| high | 24 000 / 34 000 (hair + beard) / ~21-25 000 | 16 → 30 (Saul 20 → 36, man 14 → 24) | 1.44 M / 2.45 M / ~1.1 M | 2 (+1 shadow) | 7.6 / 13 / 7 MB | 0.9-1.2 s |
| medium | 11 000 / 14 000 / ~10 000 | 12 → 20 | 0.44 M / 0.67 M / ~0.3 M | 2 (+1) | ~2.5 MB | ~0.8 s |
| low (phones) | 3 800 / 5 000 / ~3 500 | 9 → 12 | 91 k / ~140 k / ~70 k | 2 (+1) | 0.8 MB | ~0.7 s |

The distance LOD cuts these with the projected head size (a gameplay camera 4-8 m away draws 12-25 %), and the shadow pass
draws 45 % of what the camera draws. Per-frame CPU: guide sim (≤ 56 × 20 points) + one tiny texture upload.
