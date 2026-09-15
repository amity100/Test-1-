# FLAGKEEP v14 — Sky Arenas, true aim, fast hands

Implementation plan for the next version of the Sky Flag mode. Written by the game architect for
the model that will build it. Work on branch `claude/shooting-game-building-flags-mh8xfx`, commit
per stage, push at the end of every stage (the GitHub Pages deploy runs on push), keep Fortress War
and the classic rotation green, and never put a model name in a commit, a comment or a file.

---

## תקציר בעברית (למי שמאשר את התכנון)

מה השתנה בהבנה: המבנים של v13 הם חתיכות דקות (רמפות ברוחב 3 על עמודים דקים). זה לא מה שרוצים.
רוצים **זירות שמיים**: מבנים רחבים, כבדים, מלוטשים, שנראים בנויים באמת, ומתאימים לקרבות
אנכיים מטורפים – כמו הבניינים היפים של הארכיטקט מגרסאות 6-7, רק בשמיים.

הפתרון: במקום "חלקים קטנים", השחקן והבוטים מניחים **מודולים** על רשת גסה (תאים של 8×8 מטר,
קומות של 6 מטר) בלחיצה אחת – **דק, מגדל מדרגות, רמפה, גשר, זירה** – ומחולל ("ארכיטקט שמיים")
הופך כל תא למבנה גמור אוטומטית: רצפות שיש עם שוליים בצבע השחקן, מעקות עם שיניים מזהב, עמודים,
קשתות, מדרגות פנימיות רחבות, דגלונים, פנסים, ומתחת לכל רצפה "קיל" צף עם גביש זוהר (במקום
עמודים דקים). מבנים של שחקנים שונים שנוגעים – מתמזגים לזירה אחת. כל קומה מובטחת נגישה ברגל.

בנייה מהירה וזורמת: הרוח מוצמדת לרשת, רואים רוח ירוקה תמיד, לחיצה = מודול שלם, לחיצה ארוכה
משרשרת מגדלים/רמפות למעלה. כלכלה: 24 לבנים בהתחלה, לבנה כל 3 שניות, מודול עולה 2-10.
להגיע לאויב: גשרים שנמתחים לבד עד המבנה הקרוב (עד 24 מ'), וכולם מקבלים במצב הזה זיפליין
וקרס תנופה (קיימים במשחק) בטווח 60 מ'.

עכבר במחשב: נעילת עכבר אמיתית בלחיצה, ואם הדפדפן לא מאפשר (למשל בתוך הארטיפקט) – מצב
"כוונת = עכבר": הסמן נעלם, הכוונת מצוירת במקום העכבר, המצלמה מסתובבת לפי המרחק מהמרכז,
והיריות הולכות בדיוק לאן שהכוונת מצביעה.

כוונת: במצב ADS מסתכלים **דרך** הכוונת של הנשק – הנשק מוזז כך שמרכז הכוונת שלו יושב בדיוק
במרכז המסך, FOV מתכווץ, הצלב נעלם.

טלפון: סיבוב מסך מהיר פי 1.6, בלי השהיה ("החלקה") של הדגימות, עיבוד כל דגימות המגע, החלת
הסיבוב בכל פריים מצויר (לא רק בצעד הסימולציה), ואפשרות ג'ירו.

ביצועים (המשחק איטי במחשב וקצת בטלפון): מדדתי איפה הזמן הולך. הסימולציה עצמה זולה (0.2 מ"ש
לצעד). מה שיקר בכל פריים הוא צד ה-JS של התצוגה: 12 הדמויות (147 רשתות-עור נפרדות, 4 מ"ש),
ה-HUD שנכתב ל-DOM כל פריים (2.7 מ"ש), האפקטים (1.5 מ"ש), הדגל/הקרניים (1.2 מ"ש) – ביחד ~10 מ"ש
לפני שהכרטיס הגרפי בכלל מתחיל לצייר. ובצד הגרפי: רמת "high" מציירת ב-1.5× רזולוציה עם AO
ברזולוציה מלאה, מפת צל 4096, קרני אור ב-48 דגימות ו-4 מעברים על כל המסך – כבד לכרטיס בינוני.
התוכנית: לא להוריד איכות אלא לעשות את אותה עבודה בזול – לאחד את רשתות הדמויות (147 → ~36),
לעדכן דמויות רחוקות פחות פעמים, לכתוב ל-HUD רק מה שהשתנה, AO בחצי רזולוציה עם שחזור קצוות,
מפת צל 2048 שמותאמת בדיוק למה שרואים (אותה חדות), קרני אור ובלום בחצי רזולוציה, מעבר
פוסט אחד פחות, רזולוציה דינמית ששומרת 60 fps, עשב שנעלם כשמסתכלים מ-40 מטר גובה, פנסים
כחומר זוהר במקום אורות אמיתיים. עם שכבת מדידה (`?debug=perf`) ובדיקה אוטומטית שאוכפת
תקציבים. יעד: 60 fps ב-1080p על כרטיס מובנה בינוני ועל אייפון 12 / פיקסל 6.

השלבים, הבדיקות וקריטריוני הקבלה מפורטים למטה באנגלית. הסדר: מדידה ותקציבים → מחולל הזירות →
הנחה וכלכלה → בוטים → עכבר ו-ADS → טלפון → ביצועים → בדיקות, README, גרסה 14, דיפלוי וארטיפקט.

---

## 0. How to work

- Read this whole file first, then `README.md`, then the files in §9 before touching code.
- Build with `npm run build` (tsc + vite). Preview with `sh scratch/preview.sh` (serves `dist/` on
  127.0.0.1:4173) and probe with headless Chromium (`/opt/pw-browsers/chromium`, see the existing
  `scripts/probe-*.mjs` for the launch flags and the `window.__fk.game()` debug API).
- Every stage ends with: typecheck clean, `node scripts/probe-ascent.mjs` and
  `node scripts/probe-ascent-phone.mjs` green (updated for the new rules), `node scripts/probe-war.mjs`
  still 18/18, a commit, a push.
- Commit messages end with the two trailer lines the session requires (co-author and session URL).
- Ship: `VERSION = '14.0'` in `src/core/Version.ts`, README rewritten for the new building, `npm run
  build:artifact`, republish the artifact to its existing URL (read it first, then publish with `url`).

## 1. What is wrong today (diagnosis)

1. **The structures.** `src/build/SkyBuild.ts` stamps five small pieces: a 3-wide ramp of slope
   blocks with a 3×2 landing, a 5×5 deck, an 8-long bridge, a 5-long parapet, an 11 m disc. They
   hang on 1×1 marble stilts (`dropSupport`). Bots only ever place ramps in switchbacks, so the sky
   fills with thin white zigzags on sticks. Nothing has mass, walls, arches or interiors; nothing
   reads as a building, let alone an arena. Compare `src/build/Architect.ts`, which turns a coarse
   plan of 8 m cells into finished fortresses (walls, slits, arches, stairs, crenels, bridges,
   courtyards) — that is the quality bar, and that is the technique to reuse.
2. **The mouse.** `src/core/Input.ts` requests pointer lock; when the page cannot lock (the artifact
   viewer's iframe has no `pointer-lock` permission — the console shows `Unrecognized feature:
   'pointer-lock'`), `fallbackLook` turns the view only in the outer 28 % band of the window
   (`src/sim/Player.ts` ~line 96). The OS cursor stays visible and wanders away from the crosshair,
   so the mouse feels disconnected from the game. After Escape the lock is lost and not clearly
   recovered.
3. **ADS.** `src/render/ViewModel.ts` lerps the weapon from `userData.hip` to `userData.ads`; the
   `ads` vectors in `src/render/WeaponModels.ts` are hand-guessed (`-sightY`, `-0.4`), so the sight
   sits below or beside the crosshair instead of on it. The FOV barely changes (`adsZoom` 0.85).
4. **Phone look.** `Player.ts` lines ~120-140: base `0.0048 rad/px` (a full-screen swipe is about
   half a turn), plus a carry filter `1 - exp(-dt*40)` that lags the finger, and the delta is applied
   in the fixed simulation step, so at 30 fps two samples land together and the view stutters.
5. **Build feel.** Placement is per piece, aimed freely (no snap), with reasons like `unanchored`
   and `blocked` that stop the flow; reaching another tower means building a bridge every 8 m.
6. **Speed.** Measured in headless Chromium (CPU side only, 12 entities, after 60 s of bot building,
   `scratch/diag-perf2.mjs`): a simulation step costs 0.22 ms (bots 0.17) — the sim is cheap. The
   presentation side of `Game.update` costs about 10 ms per frame: `updateCharacters` 4.0 ms (12
   characters made of **147 separate SkinnedMesh objects**, every one posed, culled and drawn on
   its own, plus a shadow pass each), `hudState` + `hud.update` 2.7 ms (a fresh state object and
   DOM writes every frame), `vfx.update` 1.5 ms, `ascentVisuals` 1.2 ms (flag, beams, drop views,
   ghost), bots 1.2 ms. The scene holds 387 meshes + 147 skinned meshes + 6 instanced (311 visible)
   and **10 lights** (the flag point light and lamp lights are real lights: every material pays for
   them per fragment). On the GPU side the auto tier gives any NVIDIA/AMD machine `high`: pixel ratio
   1.5 (a 1080p window renders 2880×1620; a 4K window at dpr 1 renders full 4K), N8AO at full
   resolution (`aoHalfRes: false`), a 4096² PCF shadow map with soft shadows, god rays at 48
   samples, bloom, SMAA HIGH and a separate grade pass — four full-screen passes. That is too much
   for laptop and mid-range GPUs, and Intel-class GPUs get `medium` (pixel ratio 1.25, 2048²
   shadows, full post). The frame loop clamps `dt` to 50 ms, so below 20 fps the game also runs
   in slow motion, which is what "the game is slow" feels like.

## 2. Requirements (from the owner's words)

- R1 Structures must be **wide, massive, polished, clearly built**, and shaped for **arena fighting
  in the sky**: open fighting floors with cover, ring walls, inner stairs, bridges, bastions.
- R2 Building must be **fast and flowing**: one tap = a whole module; a live snapped ghost; chaining
  upward by holding; no fiddling with anchoring.
- R3 It must be **easy to reach enemy structures**.
- R4 Everything built must be **artistic** — the same finish as the Architect fortresses.
- R5 Desktop mouse: captured and synchronised with the crosshair the moment you enter the fight;
  a fallback that still feels right when the browser refuses to lock.
- R6 ADS looks **through the sight**, like every shooter.
- R7 Phone look is **much faster and smoother**.
- R8 The game must run **fast on the PC and on the phone without losing graphics**: the same look,
  produced cheaper; 60 fps at 1080p on a mid-range integrated GPU and on an iPhone 12 / Pixel 6.

---

## 3. Part A — Sky Arenas

### A1. The model: `SkyPlan` (new file `src/build/SkyPlan.ts`)

An island-wide sparse grid of **cells**. Cell = 8 × 8 m footprint (`CELL = 8`, same as the
Architect), **storey = 6 blocks** (`SKY_STOREY = 6`). Cell `(i, j, k)` covers world
`x ∈ [i*8, i*8+8)`, `z ∈ [j*8, j*8+8)`, floor slab at `y = k*6` (top surface `k*6 + 1`), clearance
up to `k*6 + 6`. `k` runs 0..40 (the world is 255 blocks tall).

```ts
type SkyKind = 'deck' | 'tower' | 'ramp' | 'bridge' | 'arena';
interface SkyCell { i: number; j: number; k: number; kind: SkyKind; owner: number; color: number;
  dir: 0|1|2|3; group: number; placedAt: number; }
class SkyPlan { cells: Map<string, SkyCell>; get(i,j,k); set(cell); remove(key);
  neighbours(i,j,k) → 4 side cells at the same k; below(i,j,k); above(i,j,k);
  structures(): SkyCell[][]  // connected components across all owners (side + vertical adjacency)
  structureOf(cell): SkyCell[]; bounds(structure) }
```

`group` identifies a multi-cell module placed by one tap (an arena is 9 cells with one group id;
a bridge is 1-3 cells) so it can be removed or inspected as one thing.

The `SkyPlan` is authoritative; the voxel world is a render of it. `SkyBuilder` (rewritten) turns
plan edits into world edits through the generator (A4).

### A2. Module catalogue (one tap each)

| Module | Footprint | Cost | Height | What you get |
|---|---|---|---|---|
| **Deck** | 1 cell | 2 | +0 | An 8×8 marble fighting floor with parapets on open edges, corner posts and lamps. Adjacent decks merge into one hall (no parapet between). |
| **Tower** | 1 cell | 4 | +6 m | A stair tower: walls on three sides with arrow slits, an arch on `dir`, an inner two-flight stair (2 wide) to a crenellated top deck with the owner's banner. Towers stack: a tower on a tower continues the stair through a stairwell. |
| **Ramp** | 1 cell | 3 | +6 m | A 6-wide flight of stair blocks rising 6 m over 6 m along `dir`, then a 2 m landing at the top level; masonry under it with arches, 1-block rails with gold caps. |
| **Bridge** | 1–3 cells in a line | 2 / cell | +0 | A 4-wide deck with gold rails, lamps every 4 m and an arched underside; auto-length: it extends along `dir` until it meets another structure's edge (max 3 cells). Both ends must touch a structure, or the far end ends in a 2×2 pier with a keel. |
| **Arena** | 3×3 cells | 10 | +0 | A round fighting floor (radius 11.5 blocks) inside a ring parapet with eight merloned bastions, eight 2×2 columns with gold capitals on the inner ring, four stair openings, and a raised central dais (radius 3.5, two blocks high, stairs on four sides) — where the flag naturally lands. |

Bricks: `bricksStart 24`, `trickleEvery 3`, `bricksMax 60`, `dropMin 8`, `respawnBricks 12`. Flag:
`flagStartY 180`, `flagFall 0.2` (180 → 36 m over the match). Sea: `seaStartAt 330`. Everything
else in `ASCENT` stays. A tower every 12 s is 30 m/min for a builder who does nothing else.

### A3. Placement — snapped, instant, forgiving (rewrite `SkyBuilder.aim/place`)

1. **Target cell.** Cast the view ray (first person) or the architect-camera ray (architect view) up
   to 40 m. Hit on a structure's *top* (a floor) → target = the hit cell's `(i, j)` at that `k`
   (for deck/arena: the cell above if the hit cell is occupied and its top is the floor you stand
   on; ramps/towers go **on** the hit cell's level and extend up). Hit on a structure's *side* →
   the empty neighbour cell at the same `k` on that side. Hit on terrain at height `h` → `k =
   ceil((h - 0.5) / 6)`; the generator drops a plinth to the ground (A4.7). No hit → the cell 12 m
   ahead at the player's own `k`.
2. **Orientation.** Default `dir` = the player's facing quantised (`quantizeYaw`), `R` / the rotate
   button turns it. For ramps and towers the generator flips `dir` automatically if the open side
   would face a wall (auto-fit), so the player never has to think about it.
3. **Validity** (the only three reasons left): `bricks` (cannot afford: amber ghost),
   `occupied` (a cell in the footprint already holds a different module: red), `unsupported` (no
   side neighbour at the same `k`, nothing below, and terrain more than 6 m under the floor: red).
   Bodies are never a reason: anyone standing inside the footprint whose feet are within 2 m
   below the new floor is lifted onto it (`e.pos.y = floorTop + 0.05`); above that, the floor goes
   in under them and they simply stand on it.
4. **Ghost.** A full-module ghost (the real generated blocks, green / amber / red, drawn by
   `AscentMeshes.ghost` from the generator's dry run) updates every frame and snaps audibly (a
   soft tick when the target cell changes).
5. **Chaining.** Holding the place button with Tower or Ramp selected places the next module
   continuing upward every 0.25 s while bricks last: Tower → the same cell one storey up; Ramp →
   the cell beyond the landing, one storey up, `dir` kept. Holding with Deck selected paints decks
   along the view at the same `k` (one per cell crossed).
6. **Quick keys.** `B` build on/off, `1-5` modules, `R` rotate, wheel rotates, `X` architect view
   (keep the 4 s / 6 s cooldown). Phone: BUILD toggles, PIECE opens a **radial wheel** of the five
   modules (tap to pick, drag to pick-and-release), EYE = architect view, PLACE on the fire
   button, hold = chain.

### A4. The generator: `SkyArchitect` (new file `src/build/SkyArchitect.ts`)

Deterministic rules from a structure (a connected set of cells) to blocks, written like
`Architect.generate` (classify cells and edges, then emit). Regenerate incrementally: on every
plan change, regenerate only the structure that changed (cells → blocks into a `Field` bounded
by the structure's bounds ± 2, then diff-apply to the world so untouched blocks are not rewritten
and only touched chunks re-mesh). Budget: a 40-cell structure regenerates in under 8 ms.

Materials (`SKY_PALETTE` in `src/world/Voxel.ts`, extend as needed):
`FLOOR` marble ivory (82), `PILLAR` marble (83, pillar shape), `WALL` a new light warm stone
(`#d9d2c4`, smooth stone), `BORDER` the owner's deep colour (86..97, smooth stone), `TRIM` the
owner's crystal colour (70..81, thin strips only), `GOLD` (84) for caps, merlons, capitals and
rails, `LAMP` fence-shaped lamps, `CRYSTAL` for keels and banners.

Rules, in order:

1. **Floor.** Every cell except bridge cells: a 1-block slab at `y = k*6` over the whole 8×8, `FLOOR`
   with a 1-block `BORDER` rim on every edge of the *structure* (not between merged cells) and a
   gold inlay in the middle (a 2×2 diamond of `GOLD` slabs, flush). Arena cells: the round floor
   replaces the square (outside the radius: nothing); the ring floor is `BORDER` for the outer two
   blocks.
2. **Open edges → parapet.** An edge with no neighbour at the same `k` and no ramp/bridge attached
   there: a 1-block-thick, 1-high `WALL` parapet along the edge at `y = k*6+1`, `GOLD` slab merlons
   on every other block, `PILLAR` corner posts 2 high with a `LAMP` on top. Edges where a ramp
   arrives or a bridge leaves are left open (a 4- or 6-block gap centred on the connection).
3. **Stacked cells → room.** A cell with a cell above it is a room: `WALL` walls 1 thick on its
   open sides from `y = k*6+1` to `k*6+5`, each open side with an **arch** opening 3 wide and 4 tall
   centred on the side (arch = stairs-shape corbels on the top corners), `PILLAR` columns in the
   four inside corners, arrow slits (1×2 gaps) either side of the arch. The room's ceiling is the
   upper cell's floor slab. Interior cover: a 1-high, 3-long `BORDER` wall offset from the centre.
4. **Tower cell.** `WALL` on the three closed sides full height (`k*6+1 .. k*6+6`), the `dir` side
   an arch; inside, **flight A** along the back wall (2 wide, stairs blocks, rising 3 m over 3 m,
   from the `dir` corner), a 2×2 landing in the far corner, **flight B** along the side wall
   rising 3 m over 3 m to the top; the top is a deck (rule 1) with a 2×3 stairwell hole where
   flight B arrives, a crenellated parapet all round (merlons every block) and the owner's banner:
   a 1-wide, 3-tall vertical strip of `CRYSTAL` on the outside of the `dir` face at `y = k*6+3..5`.
   A tower placed on a tower: the lower top deck keeps its stairwell and the upper stair starts
   there (flights continue in the same rotational sense).
5. **Ramp cell.** From the cell edge facing `-dir` (the start, at `y = k*6+1`) a 6-wide run of
   stairs blocks (shape `stairs`, rotated to `dir`) rising one block per block for 6 blocks, then a
   2-block-deep landing at `y = k*6+7` (= the next storey's floor top) — the landing is the first
   two blocks of the cell in front of the ramp at `k+1` if that cell is empty (generated as a
   half-deck with parapets), or opens straight onto it if it is occupied. Under the flight: solid
   `WALL` masonry in steps with a 3-wide arch through it (so the ramp reads as a vault, not a
   plank), 1-block `BORDER` rails either side with `GOLD` slab caps.
6. **Bridge cells.** A 4-wide `FLOOR` deck centred in the cell at `y = k*6` with `BORDER` edge
   blocks, `GOLD` fence rails, a `LAMP` post every 4 blocks on both sides, and an arched underside:
   a `WALL` keystone row 1 below the deck at the cell middle tapering to nothing at the ends
   (three rows: 4, 2, 1 blocks). Far end without a structure: a 2×2 pier of `PILLAR` two blocks
   down to a small keel.
7. **Under every floor** with no cell below: a **plinth** when the terrain is within 6 m under the
   slab — solid `WALL` 6×6 (centred) down to the ground with a 1-block chamfer under the slab
   (`BORDER` slabs) and a 3-wide, 4-tall arch through each face; else a **keel** — an inverted
   stepped pyramid under the slab: 6×6 `WALL` (1 high), 4×4 `WALL` (1 high), 2×2 `CRYSTAL` in the
   owner's colour (2 high) so every floating platform glows underneath. Arena keel: three steps
   8×8 → 5×5 → 2×2 crystal, 3 high.
8. **Arena.** Round floor (rule 1, radius 11.5 around the centre of the 3×3), ring parapet on the
   circle (merlons every other block), eight bastions on the ring at 45° steps (2×2 `WALL` 2 high
   with `GOLD` merlons and a `LAMP`), eight `PILLAR` 2×2 columns 5 high on the inner ring (radius
   8) with `GOLD` capitals (a 4×4 slab ring at the top), the dais (radius 3.5, `BORDER` two blocks
   high, `FLOOR` top, four 2-wide stair flights on the axes), four openings in the parapet on the
   axes (4 wide) for ramps and bridges.
9. **Merging.** Cells of different owners that touch belong to one structure: the shared edge gets
   no parapet, each cell keeps its own `BORDER` colour, and the two rims meet in a 1-block `GOLD`
   seam.
10. **Ways up (guarantee).** After generating a structure, every floor at `k > min k` must be
    reachable on foot from a floor at `k-1` inside the structure (a tower or ramp cell that
    connects them). When a deck at `k+1` sits on a deck at `k` with no such connection anywhere in
    the structure, carve an **auto-stair** in the lower cell: a 2-wide flight along the back edge
    (rule 4's flight A/B pattern) with a 2×3 hole in the upper slab. Verify with the walkability
    flood fill from the classic build validator (walk, 1.2 m jump, 1 m mantle, stairs) and assert
    it in the probe.
11. **Details pass.** String course: a 1-block `BORDER` band around rooms at `y = k*6+4`; quoins:
    `PILLAR` blocks at room corners every other row; `LAMP` on every parapet corner; a `GOLD` slab
    coping on every wall top. Keep the block count sane: no decoration inside solid masonry.

### A5. Walking the results

- Stairs blocks are already climbed by walking (`CharacterController.stepUp`); keep the slope lift
  for legacy slopes, but the new modules use `stairs` shapes only.
- Arches are 4 tall and 3 wide; the character is 1.8 m: no crouching anywhere in a room.
- Parapets are 1 high: vaultable with a jump (keep it — fights over parapets are the point).

### A6. Reaching enemies (R3)

- Bridges auto-extend (A2). Snapping favours the nearest other-owner structure edge within 24 m
  along `dir`.
- In Sky Flag every player and bot carries a fixed kit: **zipline** (3 lines, 60 m) and **swing
  hook** (already in `src/sim/Gadgets.ts`); the loadout screen is skipped in this mode. Bots use
  the zipline to cross to the marked player's structure when it is within 60 m and higher by
  less than 12 m (`AscentBrain` gets a `cross` job).
- The flag drift stays: the fight converges on one column.

### A7. Bots on modules (`src/ai/AscentBrain.ts`)

- `climb`: place a **Tower** on the cell you stand on (or the neighbour with the best fit) and
  walk it: the generator exposes `waypoints(cell)` (the centre line of flights A and B and the
  landings), so the brain follows waypoints instead of steering by slope blocks. Repeat.
- `fight`: stand on a deck or the arena dais; use parapets (crouch behind, pop up: reuse the
  cover logic with the parapet as cover cell).
- `hunt`/`cross`: a bridge toward the marked player's structure when within 24 m at ±1 storey;
  a zipline when within 60 m.
- The marked bot builds an **Arena** around itself when it has 10 bricks and stands on a deck
  with three free cells around (the crown gets a court).
- Keep the hold-when-out-of-bricks behaviour; remove the slope-steering code once no bot places
  slopes.

### A8. Performance

- Incremental regeneration per structure (A4). Cap: 80 cells per structure, 1200 cells island-wide
  (about 12 players × 100); refuse placement with reason `occupied`… no: with a new reason `full`
  (grey ghost) when the island cap is hit.
- Region meshing already merges 16 m chunks into 64 m regions; a structure touches few regions.
- Phone tier in Sky Flag: pixel ratio 1.0, shadows every other frame, foliage density halved.

---

## 4. Part B — Mouse on desktop (`src/core/Input.ts`, `src/sim/Player.ts`, `src/ui/HUD.ts`)

1. **Lock on entry.** On "Click to play" and on any click on the canvas during a fight without a
   lock: `requestPointerLock({ unadjustedMovement: true })` with the existing retry. On success:
   raw deltas as today. Show a small pill "Click to capture the mouse" whenever the fight is on,
   the input is not touch, and neither the lock nor cursor-aim is active.
2. **Cursor-aim mode** (replaces the edge-band fallback) when the lock is refused, errors, or is
   unavailable (`fallbackLook`): `canvas.style.cursor = 'none'`; the HUD crosshair is drawn at the
   cursor position (`input.cursorX/Y`); the camera turns from the cursor's offset from the centre:
   `o = (cursor - centre) / (half size)`, per axis `turn = sign(o) · max(0, |o| - 0.10)^1.5 ·
   260°/s · sensitivity`, so the centre 10 % is a dead zone and the edges turn fast; **the fire ray
   passes through the cursor's screen position** (unproject NDC → direction) so shots land on the
   reticle; ADS in this mode pulls the reticle to the centre over 0.12 s and turns from mouse
   deltas (`movementX/Y` still arrive without a lock) until the cursor reaches the window edge,
   where it hands back to offset turning. Leaving the canvas restores the cursor.
3. **Escape / pause.** Escape exits the lock and opens the pause screen; the Resume button (and the
   `Esc` key on the pause screen) requests the lock again on that same click. No other path opens
   the pause screen on a lost lock (a lock lost because the window blurred just shows the pill).
4. **Probe** `scripts/probe-aim.mjs`: (a) force `fallbackLook = true`, move the mouse to x = 90 % →
   yaw changes by more than 20° in one second, to x = 55 % → no change; (b) with the cursor at
   (70 %, 40 %) a fired projectile's direction equals the unprojected cursor ray within 0.5°; (c)
   the pill is visible before the first click and hidden in cursor-aim mode.

## 5. Part C — Aim down sights through the sight (`src/render/WeaponModels.ts`, `ViewModel.ts`)

1. Every weapon model gets `userData.sight = { point: Vector3, axis: Vector3 }`: the optical centre
   of the rear sight / red dot / scope (the functions `redDot` and `scope` already know their
   height; return the centre point too) and the sight line direction (model -Z).
2. ADS pose: solve the model transform so that, in camera space, `sight.point` sits at
   `(0, 0, -adsDist)` with `adsDist = 0.30` (0.42 for the scope) and `sight.axis` is parallel to
   -Z. Lerp hip → this pose over `adsTime` with the existing `e.ads`. Sway and bob × 0.15 at full
   ADS; recoil goes to the camera kick, not the model, so the sight stays on the target.
3. FOV: hip = the settings FOV (default 75); ADS: rifle 52, SMG 58, shotgun 62, DMR 38, pistol 62,
   sniper 22 with the existing scope overlay. Put `adsFov` next to `adsZoom` in `src/sim/Weapons.ts`
   and drive the camera from it (mouse sensitivity scales with `adsFov / fov`, as now with `zoom`).
4. The crosshair fades out above `e.ads = 0.6`; the red-dot's emissive dot and the iron sights are
   the reticle. Hit-scan and projectiles keep using the camera forward (which is the sight line).
5. Probe: for each weapon, at full ADS, project `sight.point`'s world position to NDC and assert
   `|x| < 0.01, |y| < 0.01`; screenshot each weapon in ADS to `scratch/ads/<weapon>.png` and look
   at them once.

## 6. Part D — Phone look (`src/sim/Player.ts`, `src/ui/TouchControls.ts`, `Settings.ts`)

1. Base `0.0048` → `0.0078 rad/px` (a full-screen swipe ≈ 200°); `touchAccel` default 1.2 with the
   boost starting at 400 px/s; ADS multiplier 0.6.
2. Remove the carry filter: apply `lookDX/lookDY` directly (no `exp(-dt*40)`); keep a 1-sample
   median on the delta only if a device shows jitter (behind a setting, default off).
3. In `TouchControls.onPointerMove` sum `e.getCoalescedEvents()` deltas so no sample is lost
   between frames; set `touch-action: none` on the zones (already) and mark the listeners
   non-passive.
4. Apply the look in the **render frame**, not the fixed sim step: `Player.applyLook(dtRender)`
   runs once per rendered frame before the camera is set; the sim step reads `yaw/pitch`.
5. Settings: touch sensitivity 0.5–3 (default 1.3), ADS sensitivity, gyroscope aim on/off (iOS
   permission on first toggle; `deviceorientation` yaw/pitch deltas added to the look at 1.0×).
6. Phone probe: a 300 px horizontal swipe over 6 events turns yaw by ≥ 95° and, after the finger
   lifts, yaw changes by less than 0.2° in the next 10 frames (no carry).

## 7. Part E — Build feel (R2, R4 beyond A3)

- Placement feedback: a rising dust ring on the footprint, a marble chime, the ghost snaps with a
  tick; the pieces bar shows costs and greys what you cannot afford.
- Undo: `Z` (or long-press PIECE) removes the last module you placed within 5 s, refunding it.
- The architect view shows the cell grid on the ground plane as faint lines and the module ghost
  in full; a still finger or click places, drag moves the cursor (as now).
- Sky Flag skips the loadout screen (fixed kit, A6) so the match starts faster.

---

## 7b. Part F — Performance without losing graphics (R8)

Principle: never trade the look away. Every item below produces the same picture (or one nobody
can tell apart at play distance) for less work. Measure first, then cut, then prove it with the
probe.

### F1. Measure (do this first, keep it forever)

- `?debug=perf` overlay (top-left, monospace): fps; ms per frame for `game.update` and its parts
  (characters, hud, vfx, ascent visuals, bots, chunks), `gr.render` CPU time, GPU frame time via
  `EXT_disjoint_timer_query_webgl2` when the extension exists (otherwise "n/a"); draw calls,
  triangles, render resolution and scale, tier. Values are 1-second averages.
- `scripts/probe-perf.mjs`: a 12-player Sky Flag match, 60 s of bots building, then 10 s of real
  frames; asserts the CPU budgets in F9 (headless numbers exclude the GPU; they are the JS cost).
- Settings → Performance: quality tier (exists), **resolution scale** (0.6–1.0), **dynamic
  resolution** on/off, shadows (off / 1024 / 2048 / 4096), ambient occlusion on/off, fps counter.

### F2. Characters (4.0 ms → under 0.8 ms; 147 skinned meshes → about 36)

- Build each character as **one SkinnedMesh per material** (body + gear merged with geometry
  groups; `PartBuilder.merge` already merges per material — merge across body and gear too), so a
  character is ≤ 3 skinned meshes instead of ~12. Draw calls and shadow draw calls fall the same
  way.
- Pose LOD: within 40 m of the camera the skeleton is posed every frame; 40–80 m every second
  frame; beyond 80 m every fourth frame (root position/rotation every frame so nobody slides).
  Behind the camera (outside the frustum, tested on the root's bounding sphere): root transform
  only.
- `setWeapon` only when the weapon id changes; `frustumCulled = false` on the parts and one
  bounding-sphere test on the root per frame.
- Name tags and the marked crown stay; shadows on characters within 60 m only.

### F3. HUD (2.7 ms → under 0.4 ms)

- `hudState()` allocates a new state tree every frame; keep it, but `HUD.setState` must **diff**
  against the previous state and touch the DOM only for values that changed (text, classes,
  transforms). Markers and the objective use `transform: translate()` only (no layout).
- Throttle canvases and lists: minimap 20 Hz, the Sky Flag height strip 10 Hz, feed and
  scoreboard on change only.
- No `getBoundingClientRect` in the frame path (cache sizes on resize).

### F4. Effects and Sky Flag visuals (2.7 ms → under 1 ms)

- VFX: particles in pooled typed arrays behind one `Points` per kind (check `src/render/VFX.ts`;
  make sure no per-particle objects are created per frame), a hard cap per tier (phone 600,
  desktop 2000), and no ambient particles when the camera is more than 40 m above the terrain.
- `AscentMeshes.update`: beams, crown and drop views update their transforms only when the
  flag/marked/drops changed (dirty flags from `AscentState`), the ring rotation is a uniform, the
  ghost is rebuilt only when the target cell, kind or dir changes (A3).
- Bots: `perceive` stays at 0.12 s; `decide` for bots farther than 80 m from every human and not
  fighting runs at 5 Hz.

### F5. Rendering, tier by tier (same look, less GPU)

- **Resolution.** Cap `pixelRatio` so the render target never exceeds 2560×1440 pixels; `high`
  uses 1.25 (was 1.5) — with SMAA HIGH plus the sharpen in the grade pass the difference at
  1080p is not visible. **Dynamic resolution**: every 0.5 s adjust a scale in [0.75, 1.0] from the
  measured frame time (GPU time when available, else wall frame time) to hold 60 fps (55 on
  phones); apply through `composer.setSize` / `renderer.setPixelRatio`; SMAA runs at output
  resolution. Settings can pin it.
- **Ambient occlusion.** `aoHalfRes: true` on every tier (N8AO's bilateral upsample keeps edges
  crisp; the full-resolution path is the single most expensive pass on `high`/`ultra`). Keep
  `Medium` quality, radius 2.2.
- **Shadows.** One 2048² map on `high` (4096 only on `ultra`) with a **fitted shadow frustum**:
  each frame set the sun's ortho box to the bounding box of what is in view within 70 m plus every
  structure cell above it (the sky towers), instead of a fixed 90 m radius around the player —
  the texel density is equal or better than today's 4096 box, so nothing gets blurrier. Keep PCF
  soft shadows and the every-other-frame refresh under 50 fps. Characters cast shadows within
  60 m; beams, discs, water and grass never cast.
- **Post chain.** God rays at `resolutionScale 0.5` with 32 samples (blurred by nature, identical on
  screen); bloom at `resolutionScale 0.5` (mipmap blur already); fold the grade effect into the
  main `EffectPass` after tone mapping (one full-screen pass fewer; the library keeps effect order
  inside a pass); SMAA HIGH stays.
- **Lights.** At most three real lights: the sun, the hemisphere/sky light, and the flag's point
  light. Lamps, banners, crystal keels and beams are **emissive materials** with bloom, not
  `PointLight`s (they look the same at night-time intensities and cost nothing per fragment).
- **Foliage.** Keep the counts (the ground must look the same from the ground); fade grass out
  between 40 m and 60 m of camera height above the terrain and skip its draw entirely above
  60 m (from a tower you cannot see blades). Trees keep their instancing and cast shadows only
  within the fitted frustum.
- **Voxels.** Regions stay merged (two draw calls per fortress); the sky generator's incremental
  regeneration (A4) keeps remeshing under the 9 ms budget per frame; `castShadow` only for regions
  intersecting the fitted shadow frustum.
- **Materials.** Voxel and character materials share programs (41 programs today): audit
  `renderer.info.programs` and merge variants that differ only by a uniform.

### F6. Phone

- `medium` on mobile GPUs stays (pixel ratio 1.25, AO off, 2048 shadows) plus dynamic resolution
  with a floor of 0.8, the character pose LOD, the HUD diffing, the VFX cap (600), the shadow
  frustum fit, and the render-frame look application from Part D. Shadows refresh every other
  frame always on phones. Target 60 fps on iPhone 12 / Pixel 6, ≥ 30 fps on 2019 mid-range.

### F7. Frame pacing

- Keep the 50 ms clamp, but stop the slow motion it causes: when a frame exceeds 25 ms, run the
  simulation in up to two 1/60 s sub-steps per frame instead of one long step (an accumulator; no
  interpolation needed for a first-person game at ≥ 30 fps).
- No allocations in the hot path: `updateCharacters`, `hudState`, `flagMarker`, `ascentVisuals`
  and bot `decide` reuse temporaries (`new THREE.Vector3` inside per-frame code is a bug).

### F8. Loading

- The single-file artifact and the site both load in one bundle (1.5 MB gz 0.5 MB); keep it, but
  build the procedural textures and character parts lazily per style (only what the match uses)
  and show the loading bar's real progress. Not a frame-rate item, but "the game is slow" includes
  the start.

### F9. Acceptance (headless CPU budgets per frame, 12 players, 60 s of building, tier high)

- `game.update` ≤ 4 ms; `updateCharacters` ≤ 0.8 ms; HUD (`hudState` + `hud.update`) ≤ 0.5 ms;
  `vfx` ≤ 0.6 ms; `ascentVisuals` ≤ 0.5 ms; bots ≤ 1 ms per rendered frame.
- Scene: ≤ 40 SkinnedMesh objects for 12 characters; ≤ 3 lights; draw calls ≤ 260 from a tower
  top in a full match (read `renderer.info` after one render).
- On real hardware (report the `?debug=perf` numbers in the ship notes): 60 fps at 1080p on an
  Intel Iris Xe / Radeon 680M laptop at `medium`, 60 fps on a GTX 1650-class at `high` with
  dynamic resolution mostly at 1.0; iPhone 12 / Pixel 6 at 60 fps in Sky Flag with twelve players.
- Screenshots before/after at the same camera (`scratch/perf/before-*.png`, `after-*.png`) for the
  ground view, a tower top and ADS, compared once by eye: no visible loss.

---

## 8. Stages, tests, acceptance

**S0 — Measure.** `?debug=perf` overlay and `scripts/probe-perf.mjs` (F1) with today's numbers
recorded in the commit message, so every later stage can show what it changed. Commit.

**S1 — SkyPlan + SkyArchitect (generator).** Add `?debug=skydemo`: loads the island, builds a demo
plan (an arena, three stacked towers, ramps, two bridges, a merged deck of two owners) through the
generator, and free-flies the camera for screenshots. Acceptance: `node scripts/probe-skyarch.mjs`
— generation of the demo under 8 ms per structure; every floor reachable (walkability flood fill);
no floating decoration; screenshots `scratch/skyarch/*.png` looked at once for mass, parapets,
keels, arches. Commit.

**S2 — Placement, ghost, chaining, economy.** `SkyBuilder` on top of `SkyPlan`; `Game.ascentInput`
uses the three reasons; hold-to-chain; radial wheel on the phone. Update `probe-ascent.mjs`: the
human places a tower and reaches its top by walking the waypoints; a bridge auto-extends to a
neighbouring structure; a body inside a new deck is lifted; chaining three towers in 1 s costs 12
bricks. Commit.

**S3 — Bots on modules + fixed kit.** `AscentBrain` climb/fight/cross on waypoints; zipline use.
Acceptance in `probe-ascent.mjs`: within 90 s of a 12-bot match, at least eight bots stand above
30 m, at least three structures have ≥ 6 cells, at least one bridge or zipline crossing happened,
no bot fell more than 8 m without being shot. Commit.

**S4 — Mouse lock + cursor-aim; ADS through sights.** `probe-aim.mjs` green; ADS NDC check for all
weapons; screenshots looked at once. Commit.

**S5 — Phone look + wheel.** `probe-ascent-phone.mjs` extended with the swipe checks and the wheel
(tap PIECE → five options → tap Tower → `buildKind === 'tower'`). Commit.

**S5b — Performance.** F2–F8 in this order: characters, HUD, effects, lights, AO half-res, shadow
fit, post chain, dynamic resolution, frame pacing, phone. `probe-perf.mjs` green with the F9
budgets; before/after screenshots compared. Commit.

**S6 — Ship.** README (building section rewritten around modules and the generator), version 14.0,
`probe-war.mjs` 18/18, smokes clean, build, push, artifact republished, a short report in Hebrew.

## 9. Where things are today (file map)

- `src/sim/Ascent.ts` — `ASCENT` constants, `AscentState` (trickle, drops, mark, flag, sea, finish).
- `src/build/SkyBuild.ts` — the five stamps, `aim()`, `check()`, `place()`, `standableSpots()`.
  To be rewritten on `SkyPlan` + `SkyArchitect`; keep the public surface `aim / aimFrom / place /
  standableSpots / events('placed') / count / placed / clear` so `Game.ts` and the bots need few
  changes.
- `src/build/Architect.ts` — the fortress generator to imitate: `Plan`, `Field`, `applyField`,
  `generate()`, `stairRun()`, edge classification, roles per style.
- `src/ai/AscentBrain.ts` — jobs `climb / hunt / loot / flee / hold / fight`, `goalUp`,
  `steerAndBuild`, `tryPlace`, `rampUnderFeet`, `legGoal`.
- `src/core/Game.ts` — `setupAscent`, `ascentHooks`, `ascentSpawn`, `ascentInput` (B/X/1-5/R,
  place, architect camera), `archCamera`, `ascentVisuals`, `ascentCinematic`, `hudState.ascent`.
- `src/render/AscentMeshes.ts` — flag, beams, brick clusters, ghost.
- `src/sim/CharacterController.ts` — `stepUp` with the slope lift and the bisection settle.
- `src/core/Input.ts` — `requestPointerLock`, `fallbackLook`, `looking`, `lookDX/DY`, `virtual`.
- `src/sim/Player.ts` — lines ~90-150: look application, edge band, aim assist, touch curve.
- `src/render/ViewModel.ts` — hip/ADS lerp, sway, bob, recoil; `src/render/WeaponModels.ts` —
  `userData { muzzle, hip, ads }`, `redDot()`, `scope()`.
- `src/ui/TouchControls.ts` — zones, buttons (`button(g, id, cls, icon, opts)`), `onPointerMove`,
  sky buttons `skyb build/piece/arch`, `setAscent/setPlacing/setArchTaps`.
- `src/ui/HUD.ts` — `.sky` block (bricks, heights, strip, pieces bar, hint, arch ring).
- `src/core/Settings.ts` — `sensitivity, touchSens, touchAccel, touchAdsSens, fov, aimAssist`.
- `src/core/App.ts` — the frame loop (`loop`, `update`: game → sky → fog → water → foliage →
  `chunks.update(9)` → shadow refresh → `gr.render`), the 50 ms `dt` clamp.
- `src/render/Renderer.ts` — `QUALITY_PROFILES`, `rebuildPasses` (RenderPass, N8AO, one
  EffectPass with god rays/fog/bloom/hue/contrast/tone mapping/vignette, the grade pass, SMAA),
  `resize` (pixel ratio); `src/render/Sky.ts` — the sun and its 4096 shadow map / ortho camera;
  `src/render/CharacterMesh.ts` + `PartBuilder.ts` — `skinnedMeshesFrom` (one mesh per material
  per part group); `src/render/VFX.ts`; `src/render/Foliage.ts`; `src/core/Settings.ts` — the
  tier auto-detection (`resolveQuality`: software → low, mobile GPU or Intel → medium, NVIDIA/AMD
  → high).
- Probes: `scripts/probe-ascent.mjs` (19), `scripts/probe-ascent-phone.mjs` (10),
  `scripts/probe-war.mjs` (18), `scripts/smoke*.mjs`; measurements: `scratch/diag-perf2.mjs`
  (the numbers in §1.6; scratch is git-ignored, copy it to `scripts/probe-perf.mjs` in S0).
