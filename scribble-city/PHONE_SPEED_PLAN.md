# Beyond the Outline — the phone speed plan (ROADMAP stage 19)

A work order for the agent that will carry it out. Written by the agent that measured the game and
designed the work; that agent changed nothing in the game for it. Everything here was checked
against the code at commit `6330f49` (game code identical to what is on the site, round 25).

---

## 0. לבעל המשחק — מה יש במסמך הזה (בעברית)

- **המטרה:** שהמשחק ירוץ חלק בטלפון (30 פריימים בשנייה שבאמת מחזיקים, גם כשהטלפון חם, גם בקניון), בלי לשנות את איך שהוא נראה. **במחשב שום דבר לא משתנה.**
- **איך עובדים:** בשלבים. אחרי כל שלב מי שמבצע שולח לך **תמונות לפני/אחרי** בגודל המסך של הטלפון שלך, ומחכה ל**אישור** שלך. בלי אישור לא ממשיכים ולא מפרסמים.
- **השלבים, לפי מה שנמדד שהכי כבד:**
  0. הכנה: כפתור "מבחן ביצועים" בראש תפריט ההפסקה בטלפון, והמבחן עצמו מודד "לפני" מול "אחרי" באותה ריצה.
  1. לא מציירים סחורה של חנויות שהקירות מסתירים, ומכוניות רחוקות מצוירות בפחות נקודות. (זה הניסוי שכבר נכתב; הוא הוצא מהקוד עד שיאושר.)
  2. **האנשים** — הדבר הכבד ביותר ברחוב: כל אדם קרוב הוא כ־23 אלף משולשים, גם כשהוא בגובה 30 פיקסלים על המסך. ייבנו להם גרסאות קלות לפי הגודל שלהם על המסך, בהבדל של פחות מפיקסל.
  3. **בתוך הקניון** — המקום הכבד ביותר במשחק (כ־2.5 מיליון משולשים בפריים): סחורה רחוקה בגרסה קלה, האי לא מצויר כשאי אפשר לראות אותו, ובדיקה של המבנה של הקניון עצמו.
  4. פיקסלים ומעברים: פחות מעברי זוהר, מעבר סיום זול יותר. רזולוציה נמוכה יותר עם הגדלה חכמה — רק אם יהיה צורך, ורק באישור שלך על תמונות.
  5. המעבד: פחות קריאות ציור, בלי תקיעות כשהעיר נטענת.
  6. קצב יציב וחום, ושלוש רמות איכות לטלפונים חלשים יותר (הטלפון שלך נשאר ברמה הגבוהה).
- **מה אתה צריך לעשות:** לאשר תמונות, ומדי פעם ללחוץ בטלפון על "מבחן ביצועים" ולהדביק את התוצאה בשיחה (כפתור "העתקה"). כיום הכפתור נמצא **בתחתית** תפריט ההפסקה — צריך לגלול למטה; שלב 0 מעלה אותו לראש התפריט.
- **מה לא נעשה כאן:** האריזה לחנות האפליקציות. היא שלב נפרד, אחרי שהמשחק חלק.

---

## 1. The job in one paragraph

Make the game smooth on phones without changing how it looks, in the stages below, in order. Each
stage: measure → change → prove with numbers and with before/after pictures → send the pictures to
the owner → **stop and wait for approval** → only then publish, and go on. On a computer nothing may
change. You implement; the owner approves. If a step turns out not to give what this plan expects,
say so with the numbers and propose the next best thing — do not push a change that does not pay.

## 2. Rules that hold for every step

### 2.1 Phones only

- "Phone" means exactly what the game already means by it: `low = isTouchDevice() || ?low`
  (`v5/js/main.js:201`). Every change of this plan sits behind a flag of `GFX`
  (`v5/js/core/util.js`, Stage 0.2) that is false on a computer.
- The proof, for every stage: `node tools/ab.mjs shoot <dir> v5/index.html` (a computer, 9 spots)
  before and after the stage, then `node tools/ab.mjs diff` → **0.00% at every spot and the same
  draw calls and triangles** in `stats.json`. A stage that moves a computer's numbers is not done.
  (If `tools/ab.mjs` gives up waiting for the game to be ready, lengthen its 120-second wait: the
  tool, not the game.)
- A part stays off by default until the owner approved it (`APPROVED` in Stage 0.2); `?newgfx`
  turns on everything written so far, `?oldgfx` turns all of it off, `?no<name>` one part.

### 2.2 Pictures first; the owner approves each stage

- The owner's words: after the first part send pictures; go on only if they approve. Treat every
  stage that way.
- What to send: the sheets made by `node tools/perf/ab-phone.mjs sheet` (Section 4) — "לפני" over
  "אחרי" at the phone's own size, then two places enlarged 3× side by side. 3 to 6 sheets a stage,
  the ones that show the most. Send the files to the owner with the file-sending tool; describe in
  two or three Hebrew sentences what changed and what did not.
- Then stop. Do not start the next stage, and do not publish, until the owner says yes.
- If the owner sees a difference they do not like: fix or drop that part. Their eye decides, not the
  percentage.

### 2.3 "The same picture" — what counts

- First find the noise: the same build photographed twice (Stage 0.6). A change is judged against
  that, not against zero.
- Exact changes (nothing a ray from the eye reaches is touched: Stage 1 goods, hidden island): the
  difference must be within the noise.
- Size-on-screen changes (cars, people, goods far off): the shape may differ by **at most about half
  a pixel of the drawing** at the distance where the lighter version takes over; in pictures, under
  0.5% of the pixels of a spot differing by more than 24 of 255, and nothing the eye catches at 3×.
- Anything that visibly changes the look (resolution, glow width) is shown to the owner as such and
  goes in only with their yes.

### 2.4 Talking to the owner

- Hebrew, short, plain. No code names in the message unless needed. Numbers with units.
- Never tell the owner something is live before you have seen the deploy succeed (2.5).
- The owner tests on their own phone. When you need a number from the device, ask for one run of the
  test route ("מבחן ביצועים" in the pause menu, then "העתקה", then paste). One run per stage at most.
- The owner's email, and anything else about them, is private: never put it in a commit, a file or a
  request to any service.

### 2.5 Git, publishing, backup

- The game's latest code is on the branch **`claude/serene-hypatia-mj9w2j`** (hundreds of commits ahead
  of `main`; `main` is not the game). Work on the branch your session's instructions name; if that is
  a different branch, start it from `origin/claude/serene-hypatia-mj9w2j`.
- Commit messages in English, in the project's own style (what changed for the player, then how,
  then what was measured). End them with the attribution lines your own session gives you. Never
  write a model's name or id in a commit, a pull request, code or a file. No pull request unless the
  owner asks for one.
- The site is published **from HEAD**: `ESBUILD=false bash scribble-city/tools/publish-pages.sh`
  copies everything committed under `scribble-city/` to the `gh-pages` branch. Work is committed
  and pushed every turn, approved or not — so an unapproved part must be off by default
  (`APPROVED`, Stage 0.2): then a publish at any moment, for any reason, changes nothing the owner
  has not said yes to. After their yes: set the part's `APPROVED` to true, commit, publish.
  (If the owner wants to try a part on their phone before deciding: publish with it still off, and
  give them the link with `?newgfx=1` at its end.)
- After publishing: check `git show origin/gh-pages:scribble-city/v5/js/core/util.js` (or another
  file you changed) has your change, then watch the Pages run with the GitHub Actions tools until its
  conclusion is `success` (it once failed on GitHub's side after the link had been sent: use
  `rerun_failed_jobs` then). Only then send the link: https://amity100.github.io/Test-1-/scribble-city/v5/
- Before the first publish of this plan, make a backup of the site as it is now, the way
  `backup-r22b` was made (gh-pages commit `2c9ee7f`: a whole copy of the site's `scribble-city/`
  under `backup-r25/`), and add it to the list at the top of `tools/restore-backup.sh`. Going back
  is then one command: `bash scribble-city/tools/restore-backup.sh backup-r25`.
- The project's own release steps (ROADMAP, "תהליך שחרור לכל גרסה") hold too: among them
  `node tools/phone.mjs <prefix> se` and `iphone` after anything that touches the screen's layout
  (Stage 0.3's button) — nothing may lie over anything.
- `scribble-city/ROADMAP.md` is the project's record, in Hebrew. Add a section "19 מהירות בטלפון"
  and an entry for every stage that went in: what was asked, what was measured, what was done, what
  was checked — in the style of sections 11.1ב–11.1ה.
- Everything committed and pushed before you end a turn.

### 2.6 Never

- Never bring the people's simple far shapes nearer (`lodFar`), never lower the drawing's resolution
  floors (`minScale`, `minScaleSteady`), never take the pens off anything, never turn the mirror or
  the shadows off to gain speed. The owner has said the game "looks terrible" at lower resolution.
  (Weaker phones than the owner's may get less, but only as the owner agrees in Stage 6.3.)
- Never skip, weaken or delete a check to get a pass.
- Never `rm -rf` with a shell variable in the path.
- Never touch the keys in the session's scratch folders, never ask the owner to paste a key.
- Never change the film's look, the story, the controls or the sound as part of this plan.

### 2.7 The machine you work on

- No graphics card: Chromium draws with SwiftShader. **Milliseconds on the card cannot be measured
  here.** What can: triangles, draw calls, passes, pixels, pictures. Milliseconds come from the
  owner's phone, through the test route.
- A run of the game in the headless browser takes 3 to 10 minutes, more with the mainland. Run them
  in the background, one or two at a time, and keep working.
- Running code fetched from the network (the mesh simplifier of Stage 2) may be refused by your
  session's permissions. If it is, do not work round it: use Appendix B's own simplifier, or ask the
  owner once.

---

## 3. What is known

### 3.1 The device, and what was measured on it before

- The owner's phone: Adreno 730, screen 1764 × 822 (882 × 411 CSS pixels, the game clamps the pixel
  ratio to 2), Chrome on Android.
- The drawing is made at 0.875 of the screen: **1544 × 719**, two half-float pictures at once
  (colour; outlines' data) and depth. Field of view 62° on a phone.
- The last clean numbers from the device (ROADMAP 11.1ד — **before** the mainland, the big mall and
  the film existed): 27 frames a second on the test route; not drawn at all: 60. Processor about
  14 ms a frame (game 5–6, sending the draws 8–11). **Graphics card about 37 ms a frame.** After two
  minutes of heat the card was 70% slower. By parts: pixels about 12 ms, people and cars about 9 ms,
  mirror 2.6 ms, the sun's view 1.8 ms.
- No newer numbers from the device. Stage 0 gets them.
- A phone plays at "steady 30" (`game/pace.js`; settings `pace: 'device'`). When frames run long the
  drawing's size comes down (to 0.6 of the screen at the least, `minScaleSteady`) — so today's
  slowness is also today's softness: every millisecond saved gives sharpness back.

### 3.2 A frame on the phone, pass by pass (measured here, `tools/perf/passes.mjs`)

Island, the start of the game — 12 passes, 237 draws, 1.21 M triangles:

| pass | size | draws | triangles |
|---|---|---|---|
| a slice of a shadow map | 2048 × 512 | 11 | 63 K |
| the sun's view of what moves | 1024 × 1024 | 23 | 56 K |
| **the drawing** (2 pictures + depth) | 1544 × 719 | 194 | **1,096 K** |
| ink (outlines) | 1544 × 719 | 1 | — |
| glow: bright, 3 down, 3 up | 772×359 → 96×44 → 772×359 | 7 | — |
| the last pass (to the screen) | 1764 × 822 | 1 | — |

- 7 of the 12 passes are the glow (`pipeline.js:1109`: `levels = low ? 4 : 5`; `drawGlow`).
- The last pass runs `grade()` five times a pixel of the screen: 5 reads of the picture, 5 reads of
  the glow, 5 tone curves (`FINAL_FRAG`, `pipeline.js:391`).
- No multisampling anywhere. Every pass begins with a clear.

### 3.3 Where the triangles of the drawing go (`tools/perf/breakdown.mjs`, the game as on the site)

| place | drawing pass | of it |
|---|---|---|
| island, the start | 1,131 K, 197 draws | still city 647 K · what moves 484 K |
| street east of Bayview Mall (`WHERE=mall`) | 3,422 K, 410 draws | **shops' goods about 2,300 K** · blocks · what moves 170 K |
| under the dome inside Bayview Mall (`WHERE=mall_in`) | 2,548 K, 404 draws | the mall and the blocks round it 1,279 K · goods 547 K · what moves 503 K · **the island, 600 m away, 219 K** |
| the film, scene 2 (the pier) | 520 K, 166 draws | what moves about 400 K |

Inside the mall there is also a pass into a 4 × 4 picture with 13–22 K triangles a frame. Find out
what it is (Stage 3.1).

### 3.4 What "what moves" is (`tools/perf/moving.mjs`, island, 15 people near)

- 488 K triangles: **people's heads 127 K** (15 × 8,440), **the rest of their own shapes 194 K** (of
  it their eyes 20 K: two balls of 660 triangles each a person), two more shapes of 1,184 triangles,
  16 of each (38 K; pen kind "cyl", not from the people's atlas — find out what they are), far
  walkers' simple shapes about 30 K, **cars about 45 K** (7 in traffic, 4 parked: about 4,400 each
  with wheels).
- One person inside 32 m is **22 to 24 K triangles**: the head 8,440 (the MakeHuman head, 4,244
  corners, drawn from both sides), the two eyes 1,320, torso and clothes about 5,800 in 7 shapes,
  limbs and shoes about 4,400 (5 shapes, twice each), and the rest.
- On the phone a metre is `598 / distance` pixels of the drawing. A head (0.24 m) at 10 m is 14
  pixels high and still 8,440 triangles: about 28 triangles a pixel. At 3 m: 2.5 triangles a pixel.
  Only nearer than about 2 m is a triangle of the head as big as a pixel.
- Why this is the worst kind of triangle for a phone's card: a triangle that covers one pixel's
  centre is shaded as a block of 2 × 2; the people's and cars' pens may throw a pixel away
  (`discard`, `glsl.js:1104-1108`), so the card cannot skip hidden ones before the shader (ROADMAP
  11.1ה); and the shader is the heaviest in the game.
- **Correction of an earlier note:** the experiment's own comment (`render/cars.js`, commit
  `3035a3a`) says a third of a frame's triangles were cars. Wrong: the 371 K it counted were the
  people's parts and the cars together (the same pen kind, "paint"). Cars are about 4% of the island's
  frame; more on a street full of them. The people are the big one.

### 3.5 Measured, and not worth doing

- Leaving out the still city's small parts by distance, piece by piece (a draw range by size):
  parts under 3 pixels are 11% of the island's still triangles by their own distance, but only 1% by
  their whole piece's (pieces are big). Mall street: 16% and 4%. Not worth it as the pieces are cut
  today (`tools/perf/parts.mjs`).
- Already tried in earlier stages and rejected or done (ROADMAP 10.7, 11.1ב–ה, 11.3–11.5; do not
  redo): half the pixels a frame (checkerboard) and reuse between frames (the lines smear); the pens
  once a pixel in two passes on a phone (512 bits a pixel; tried in play, kept only where faster);
  depth first (tried in play automatically, `render/depthtrial.js`); the still city's pens without
  `discard` (`render/solid.js`, done); the mirror only where water is seen (done); people and cars
  drawn before the city (done); shaders prepared while loading (done).

### 3.6 Two things seen in the experiment's first pictures (open)

`tools/perf/ab-phone.mjs sheet` on the pictures taken before the experiment was stopped:

- `blvd_south`: the people sitting at the café tables are in the "before" picture and missing in the
  "after" one (0.74% of the pixels). Either the people differ between any two runs (the shops' goods
  are built by the wall clock, and may draw from the same dice as the people), or the experiment
  hides something it must not. Stage 0.6 settles which.
- `avenue_wet`: a far walker differs; the bus far off, in fewer points, looks the same.

---

## 4. Tools

All under `scribble-city/`; run from that folder. They open the game the way the owner's phone does
(882 × 411, touch, pixel ratio clamped to 2 → drawing 1544 × 719). Places and options: the comment
at the top of `tools/perf/lib.mjs` (`WHERE=island | mall | mall_in | at:x,z,yaw | s2…`,
`EXTRA="newgfx=1"`, `COND` for a film scene).

| tool | what it tells |
|---|---|
| `node tools/perf/passes.mjs` | every pass of a frame: size, pictures written, draws, triangles |
| `node tools/perf/breakdown.mjs` | the drawing pass's triangles by what is drawn (goods · mainland · island · what moves), the 45 biggest |
| `node tools/perf/moving.mjs` | the people and the cars: every unnamed draw by shape size and count (heads · people's parts · cars) |
| `node tools/perf/parts.mjs` | how much of the still city is parts smaller than 1.5 / 3 / 5 / 8 pixels |
| `node tools/perf/ab-phone.mjs shoot <dir>` | seeded photographs of 11 spots (island, mainland, mall) + `stats.json` (draws and triangles a pass). `AB_QUERY="newgfx=1"` for the "after" run, `AB_SPOTS=a,b` to pick |
| `node tools/perf/ab-phone.mjs diff <a> <b>` | % of pixels that differ, spot by spot |
| `node tools/perf/ab-phone.mjs sheet <a> <b> <out>` | the sheets for the owner: before over after, then two places at 3× |
| `OUT=<prefix> node tools/perf/pause.mjs` | the pause menu on a phone: two pictures, and where the test route's button is |
| `node tools/ab.mjs shoot <dir> v5/index.html` / `diff` | the computer's "same picture" check (2.1) |
| the test route (pause menu) | the only source of milliseconds: on the owner's phone |

Notes:
- `ab-phone.mjs`'s three mall spots (`mall_east`, `mall_in`, `inkwell`) were placed from the map
  (`world/mainland/plan.js`: Bayview Mall's dome at −835, −37) and have not been looked at. Look at
  their first pictures; move the camera if one faces a wall.
- The test hooks the tools use: the address `?test=1&autostart=1&prologue=0`, `window.__game`,
  `window.__frame(n, dt)`, `window.__camOverride = { pos, look }`, `mainland.fill({x,z})`,
  `interiors.fill(x, z, ms, y)`.
- Add spots and probes as you need them; keep them in `tools/perf/`.

## 5. Targets

On the owner's phone (the test route's report):

1. Route average **≥ 40 frames a second** measured at the free pace (so that the steady 30 has a
   third of headroom), and "שוב רגיל" (the phone warm) **≥ 32**.
2. Standing inside the mall **≥ 30**.
3. No frame over 100 ms on the route; long tasks of the game under 20 ms a second.
4. In play (steady 30): the drawing stays at its full size (0.875) nearly all the time.

Here, as stand-ins that can be measured without a graphics card (the drawing pass, phone settings):

| place | now | after Stage 1 | after Stage 2 | after Stage 3 |
|---|---|---|---|---|
| island start | 1,131 K | ~1,090 K | **≤ 850 K** | — |
| mall street | 3,422 K | **≤ 1,100 K** | ≤ 950 K | — |
| inside the mall | 2,548 K | ~2,460 K | ~2,250 K | **≤ 1,500 K** |
| film, scene 2 | 520 K | ~470 K | ≤ 400 K | — |

Draw calls must not grow by more than 15 at any spot in any stage (each costs the phone's processor
about 0.04 ms). These are estimates made before the work: correct the table in Section 14 as the
real numbers come in.

---

## 6. Stage 0 — groundwork (nothing the player sees changes, except one button)

**0.1 Where you start.** `git log --oneline -3` shows `6330f49` (the experiment taken out) on top of
`3035a3a` (the experiment) on top of `809b51a` (round 25, what the site has). The game's code at
`6330f49` is identical to `809b51a`.

**0.2 The flags** — `v5/js/core/util.js`. Add (the function `isTouchDevice` is in the same file; a
function declaration, so it may be used above its place):

```js
// (ROADMAP 19) The phone's own way of drawing: which parts of it are on. Phones only - the same test
// as main.js's `low` (touch, or ?low): a computer draws exactly as it did.
// A part is on by itself only once the owner has approved its pictures (APPROVED, below: set to true
// in the commit that is published after their yes). Until then it is on only when the address asks
// for it - ?<name>, or ?newgfx for all of them - so whatever is published at any moment draws with
// approved parts alone. ?oldgfx: none of it; ?no<name>: all but that part.
// off: all of it switched off for a moment while the game runs (the test route's "as before" stand,
// game/perf.js) - so every part reads its flag where it decides, each frame; what a part builds
// once (lighter shapes) is built when its flag is on and simply not chosen while off is true.
const APPROVED = { shopview: false, carlod: false, folklod: false, goodsfar: false, farhide: false, glowlite: false, finallite: false };
export const GFX = (() => {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  const phone = isTouchDevice() || q.has('low');
  const on = phone && !q.has('oldgfx');
  const part = (name) => on && !q.has('no' + name) && (APPROVED[name] || q.has(name) || q.has('newgfx'));
  return {
    phone, on, off: false,
    shopView: part('shopview'), // Stage 1: a shop's goods its own walls hide
    carLod: part('carlod'), // Stage 1: a car far off in fewer points
    folkLod: part('folklod'), // Stage 2: the people by their size on the screen
    goodsFar: part('goodsfar'), // Stage 3: a shop's goods from far off
    farHide: part('farhide'), // Stage 3: the island from inside a mall
    glowLite: part('glowlite'), // Stage 4: the glow in five passes
    finalLite: part('finallite'), // Stage 4: the last pass reads the glow once
  };
})();
```

Add a flag here (and its `false` in `APPROVED`) for every later part. Nothing reads them yet in
this stage. In every tool run of this plan: **before** is the game with no parameter (what is
approved so far), **after** is `EXTRA="newgfx=1"` (`AB_QUERY="newgfx=1"` for `ab-phone.mjs`);
`oldgfx=1` is the game as it was before the whole plan.

**0.3 The test route's button where a phone shows it.**
- `v5/index.html`, in `.pause-btns` (line ~346), after `#map-btn`:
  `<button id="bench-btn-top" class="btn touch-only">מבחן ביצועים</button>`
  (`.touch-only` exists: `css/style.css:459` hides it on a computer. The old `#bench-btn` at the
  bottom stays.)
- `v5/js/game/game.js:456`: the same handler for both buttons.
- Check: `OUT=/tmp/x node tools/perf/pause.mjs` → `bench-btn-top` is inside the first screen
  (its top under 356 px, the sheet's visible height); look at `_top.png`. Run `tools/ab.mjs` for the
  computer (2.1).

**0.4 The test route measures "as before" against "now" in one run** — `v5/js/game/perf.js`.
- `STILL` (line 21): a new stand `['כמו קודם', 'old']` right after the first `'רגיל'`. Only on a
  device where `GFX.on` (use one filtered list everywhere `STILL` is read: `nextStill`, and the two
  report lines that walk it by index and compare with `STILL.length`).
- `nextStill()`: in the "back as it was" block `GFX.off = false`; `else if (what === 'old') GFX.off = true;`.
  `endBench()`: `GFX.off = false`.
- The report: for every stand also its triangles and draw calls
  (`summary(frames)` has `tris`, `calls`) — one more line:
  `עומדים במקום, אלפי משולשים / קריאות ציור: רגיל 1100/237 · כמו קודם 1400/240 · …`.
- **Two more places**, after the island's stands, when `g.world.mainland` exists: "הקניון מבחוץ"
  (player at −700, −37, yaw −1.57; camera [−694, 2.2, −32] looking at [−760, 6, −40]) and "בתוך
  הקניון" (player at −835, −37; camera [−828, 2.0, −37] looking at [−880, 2.4, −37]) — each stand
  twice: now, and "as before". For each: a toast ("בונים את הקניון…"), `g.world.mainland.fill({x, z})`,
  `g.world.interiors.fill(x, z, 20000, 0)`, `pl.spawn(x, z, yaw)`, the camera held there
  (`benchCamera` sets the camera from the route every frame: give `b.still` an `at: { pos, look }`
  and use it when set), 2 seconds to settle (not counted) and 5 counted. Report line:
  `הקניון מבחוץ: עכשיו 31.0 (950/260) · כמו קודם 14.2 (3400/410) · בתוך הקניון: עכשיו … · כמו קודם …`.
  At the end the player goes back to where the route began (it does already: `b.from`).
- Check it here the way `tools/route.mjs` runs the route (read it first; it opens v4 — open
  `v5/index.html?test=1&autostart=1&prologue=0` as a phone instead): `g.perf.startBench()`, then
  `window.__frame(1, 0.1)` again and again until `g.perf.lastReport` is there. The report must have
  every new line with sane numbers ("כמו קודם" equal to "רגיל" within a few percent at this stage:
  nothing reads the flags yet), and the game must be left as it was: `GFX.off === false`, the
  drawing's scale back, the player back where the route began.

**0.5 The baseline.** With the game as it is: `passes`, `breakdown`, `moving` at `island`, `mall`,
`mall_in`, and `s2` (`WHERE=s2 COND="<a moment on the pier>"` — pick a condition from
`game/prologue/director.js`); `ab-phone.mjs shoot base0`. Put the numbers in Section 14. Most are
already in 3.2–3.4; redo them so that "before" and "after" come from the same tool on the same day.

**0.6 The noise.** `ab-phone.mjs shoot base0b` (the same build again), then `diff base0 base0b`.
- Under 0.1% everywhere: good, that is the noise.
- If people or cars differ between the two runs (see 3.6): find why, and make the **test mode**
  repeatable — never by changing what the real game does. Where to look: the streamers work by the
  wall clock (`world/mainland/stream.js` budget in ms; `world/interiors.js` `budget`, `rush`): with
  `?test` let them finish what they began inside the frame (or build by count); any `Math.random()`
  on a path the clock orders (`world/rooms.js` `buildStock`, the shop people in `game/shoplife.js`,
  the café tables) wants its own seeded dice; `performance.now()` in `render/people.js` (`inCar`,
  the portraits' fade).
- Do not go on to Stage 1 before two runs of the same build agree: every later proof stands on it.

**0.7 Commit** ("The phone's test route: its button at the top of the pause menu, and 'as before'
against 'now' in one run, on the island and at the mall"). Not published yet; it goes out with
Stage 1.

---

## 7. Stage 1 — what cannot be seen, and cars far off (the experiment `3035a3a`)

What it is: (a) a shop's goods are left out of a view that cannot see into the shop; (b) a car far
off is drawn in fewer points. Written and running, never compared in pictures.

**1.1 Put it back:** `git cherry-pick -n 3035a3a`. Read its diff first (`git show 3035a3a`). It
applies cleanly on `6330f49`; after Stage 0 it will clash in one place only, `core/util.js` (both
add `GFX`): keep Stage 0.2's block. Then change it:

- `core/util.js`: Stage 0.2's `GFX` block, not the experiment's (its flags had no "phone only").
- `world/interiors.js` `viewHide(cam, hidden)`: first line of the work `if (GFX.off) return;`
  (after the two counters are zeroed).
- `render/cars.js` `drawCar`: the level is 0 while `GFX.off`. The header comment's "a third of
  every frame's triangles were cars" is wrong (3.4): correct it to what you measure.
- `render/cars.js`: a car on the line between two levels must not flicker: keep each car's last
  level and change it only when it is 8% past the line (`LOD_MID = 26`, `LOD_FAR = 9` pixels a metre).
  A parked car has no record of its own: key it by its place.

**1.2 Is the rule for the goods true for every room?** The rule (`viewHide`): a shop's goods are
seen only from inside the room, or from in front of the line of its front. It is exact only if every
room with goods is three solid walls, a ceiling and one front with the openings.
- Read `world/rooms.js` (the shell: where a wall may get an opening) and the kinds of stock
  (`buildStock`), the mall's shops (`world/mainland/megamall.js`, `mall.js`), kiosks standing free in
  a hall, market stalls, corner shops, shops of two floors, a shop with a glass roof.
- A room that may be seen from another side: either extend the rule for it (seen from in front of
  **any** wall of it that has an opening) or leave its goods always drawn. Say which rooms.
- From above and below (a store on a mall's third floor seen from the first across the hall; the
  camera above a roof): the rule uses x and z only. Make sure that is right for a room under a
  solid ceiling, and for the mirror's camera (it has the same x, z).

**1.3 Numbers** (before = no parameter, after = `EXTRA="newgfx=1"`; both on this commit):
- `breakdown` at `mall`, `mall_in`, `at:-835,60,0` (Via Inkwell) and at one street of shops on the
  island (`at:-9,-40,0`): goods and draws, before and after. Expected at `mall`: goods from about
  2,300 K to under 300 K. At `mall_in`: no change (inside the hall every shop is in front of the
  camera — Stage 3).
- `moving` at `island` and at `at:5,120,0` (the boulevard looking south, cars parked along it —
  the spot `ocean_cars`; if few cars are there, find a street that has a row of them): cars'
  triangles and the draws, before and after. Keep the cars' part only if it saves at least 25 K
  triangles there and adds at most 8 draws; otherwise leave it out (`carLod` off) and say so.

**1.4 Pictures.** `ab-phone.mjs shoot` twice (before, after), `diff`, `sheet`.
- Goods: within the noise at every spot. Add spots that look at shops from behind, from the side,
  from across a street, from a floor above, and through a shop's own window — 8 at least; `diff`
  must be within the noise at all of them. Then walk the camera round one shop in 24 steps
  (15° each, 12 m away) and once through its door: no step may differ from "before" beyond the noise.
- Cars: a row of cars from 5 m to 150 m (`ocean_cars`): under 0.3% of the pixels; look at the 3×
  crops of the cars at about 23 m and about 66 m, where the levels change on the phone (26 and 9
  pixels a metre).
- The computer: `tools/ab.mjs` before/after: 0.00%, same counts (2.1).

**1.5 Send to the owner** (Hebrew; the template is in Appendix C): the sheets of `mall_east`,
`shopfront`, `ocean_cars`, `blvd_south`, one from behind a shop; and `_top.png` of the pause menu
with the new button. Say what was gained in numbers a person can picture ("ליד הקניון המשחק צייר 3.4
מיליון משולשים בכל תמונה, עכשיו כמיליון"). **Stop. Wait for the yes.**

**1.6 After the yes:** `APPROVED.shopview` and `APPROVED.carlod` true (only what was approved),
ROADMAP section 19 (Hebrew), backup `backup-r25` (2.5), commit, publish,
see the deploy succeed, send the link, and ask for one run of "מבחן ביצועים". Put the report in
Section 14. What to read in it: "רגיל" against "כמו קודם" in the three places; the processor's two
numbers; the draw calls; the line of each pass alone (צל, השתקפות, ציור, דיו, זוהר, סיום) — the
baseline for Stage 4.

---

## 8. Stage 2 — the people, by their size on the screen

The biggest thing in the street (3.4): 22–24 K triangles for every person inside 32 m, whatever
their size in the picture. Farther than 32 m they are already drawn in simple shapes
(`render/people.js` `lodFar`; `game/game.js:168` sets 32 on a phone) — **that line does not move**:
the owner dislikes simple people. What is added is in between: the same person, the same shapes,
the same pictures on them, with fewer triangles while they are small on the screen.

### 8.1 How the people are drawn today (read these first)

- `render/people.js`: every kind of part is a `Shape` (line 470): its corners live in a float
  texture (`buildShapes`, line 1189: two texels a corner, `sh.row` where it starts, `sh.count`
  corners). Parts with the same layout of triangles share one `DrawClass` (line 350): an instanced
  mesh whose index buffer is that layout; the vertex shader fetches corner `gl_VertexID` of the
  instance's shape from the texture (`glsl.js:664-705`). A face's moves (`USE_EXPR`) are more texels,
  looked up by the same corner number.
- A city person ("folk") is `drawFolk(fig, camDist)` (line 2304): `q = F.sh` are their own shapes
  (`folk<k>_<name>`, made in `folkKind`, line 1124); each part is `q.<name>.push(matrix, colour, …)`.
- Their head: `render/folkshapes.js` (`base()`, `headOf`, `headGeo`) from `render/folkheads.js`
  (4,244 corners, 8,440 triangles; every kind's head has the same triangles, its corners moved).
  The heads' class wears `headMat` (line 1313: both sides drawn, `FOLK_HEAD`: the inside of the
  mouth and throat). Eyes: `eyeGeo` (`folkshapes.js:448`), a ball of 22 × 16.
- The camera: `game/figure.js` `begin(camera)` gives it each frame (`this.bodies.cam`).

### 8.2 The idea: the same corners, fewer triangles

A lighter version of a shape is **only another list of triangles over the same corners** (an edge
collapsed onto one of its own ends, never a new point). So the texture, the face's moves, the
pictures laid on the shapes, the neck's ring, the mouth's marks — all stay as they are and stay in
step; a lighter version is one more index buffer and one more `DrawClass`.

How far to simplify — by the pixel: a version used while a metre of the person is fewer than `P`
pixels may differ from the full shape by at most **0.55 / P metres** (about half a pixel).

| | used while a metre is under | on the owner's phone that is beyond | may differ by |
|---|---|---|---|
| head, version 1 | 150 px | 4 m | 3.5 mm |
| head, version 2 | 55 px | 11 m | 10 mm |
| body parts, one version | 110 px | 5.4 m | 5 mm |
| eyes, one version (a ball of 10 × 8) | 150 px | 4 m | — |

(A metre is `ppm = ppmK × fig.scale / distance` pixels, `ppmK = drawing's height / (2 tan(fov/2))`.
A long lens in the film or a bigger screen keeps the full shapes further, by themselves.)

### 8.3 Steps

**2.0 The simplifier — try it before anything else (half a day at most).**
- First choice: meshoptimizer's simplifier (MIT, Arseny Kapoulkine). `npm pack meshoptimizer@1.3.0`,
  take `package/meshopt_simplifier.js` (67 KB, the WebAssembly inside it, an ES module) to
  `scribble-city/js/vendor/meshopt_simplifier.module.js`, its licence line kept. The call:
  `MeshoptSimplifier.simplifyWithAttributes(indices: Uint32Array, positions: Float32Array, 3,
  attributes: Float32Array, 5, [wn, wn, wn, wuv, wuv], lock: Uint8Array | null, targetIndexCount,
  targetError, ['ErrorAbsolute', 'LockBorder'])` → `[Uint32Array of indices into the same
  corners, error]`; `await MeshoptSimplifier.ready` first. Read `package/README.md` for what the
  target count and the error mean together (you want: as few triangles as the error allows).
  The site is published without a bundler: `tools/modulepreload.mjs` lists every module the page
  reaches — check that a module outside `v5/` (as three.js is) is listed and loads from the site.
- If your session may not run or fetch it (2.7): Appendix B — a small simplifier of the game's own.
- The trial, in a scratch page or a node script, on the base head (`folkheads.js`): with errors
  3.5 mm and 10 mm, how many triangles are left? Expected: under 2,500 and under 800. If the
  simplifier cannot get the head under 3,500 and 1,200 inside those errors, stop and tell the owner
  what it can do instead of going on.

**2.1 `v5/js/render/lod.js` (new).** `export async function initLod()` (loads and readies the
simplifier; resolves false if it cannot — then nobody gets lighter versions and the game draws as
before) and `export function lighter(index, pos, nor, uv, maxErr)` → a `Uint32Array` of triangles
over the same corners, or `null` when it would not save at least 30%. Borders locked (a limb's open
ends, the head's ring to the neck: `LockBorder`). Weights to start from: normals 0.5, uv 0.3.
`main.js` `boot()`: `if (GFX.folkLod) await initLod();` before the game's renderers are made (it is
an async function already). Not loaded at all on a computer.

**2.2 `render/people.js` `buildShapes` — the lighter versions made.** Only when `GFX.folkLod`, only
for shapes whose side is `folk-full` and that are drawn by their corners (`sh.layout`):
- once for each layout (all kinds that share it get the same list): from the first shape that has it
  — its `geo`'s position, normal, uv (do it before `sh.geo = null`, line 1292) → `lighter(...)` with
  the error of 8.2 (the head: twice, for its two versions; from the base head's own corners,
  `baseHead()`);
- for every shape of that layout a twin: `const t = Object.create(sh)` (it reads `row`, `count`,
  `pen`, `flags`, `atlas`, `expr` through `sh`, so they are always the same), `t.cls` = the
  `DrawClass` of that lighter layout; `sh.lods = [sh, t1]` (the head `[sh, t1, t2]`);
- one `DrawClass` for each lighter layout: `new DrawClass(scene, corners, mat, cap, lighterIndex)`
  with the same `cap` as the full one, `mesh.layers.set(LAYERS.MIRRORLESS)`,
  `mesh.userData.noShadow = true`, pushed to `this.classes` (so `end()` ends it). `mat`: `folkMat`;
  the head's version 1 `headMat` (as the full head: a talking mouth at 4 to 11 m still shows its
  inside), the head's version 2 `folkMat` (one side only: beyond 11 m an open mouth is two pixels).
  No new shader is made by any of this (the same materials): check `renderer.info.programs.length`.
- the twins get no texels of their own: they are made after the rows are given out.
- The eyes: `eyeGeo(sd, 10, 8)` (give `eyeGeo` the two counts as arguments, 22 and 16 by default)
  as shapes `folkEyeR1`, `folkEyeL1`.
- Shapes drawn in size classes (no layout: `IN_CLASS`, a skirt) stay as they are.
- How long it took (`performance.now()` round the whole of it) goes to the loading steps the
  performance screen shows; on the owner's phone it must be under 0.4 s.

**2.3 `render/people.js` — the version chosen, a person a frame.**
- `begin()`: `this.ppmK = shared.uResolution.value.y / (2 * Math.tan((this.cam.fov * Math.PI) / 360))`.
- `drawFolk`: `const ppm = this.ppmK * fig.scale / Math.max(0.5, camDist);` then the levels for
  the head (0, 1, 2) and for the body (0, 1), each **kept until the line is passed by 8%** (the last
  ones in `fig._lodH`, `fig._lodB`: no flicker on the line), and 0 for both when
  `!GFX.folkLod || GFX.off`, when the person has a hole rubbed in them or is being rubbed out, and
  when `fig.lodFull` is set (for the film to use, if a shot ever needs it).
- Every `q.<name>.push(` of `drawFolk` goes through a small chooser:
  `const B = (sh) => (lvB && sh.lods ? sh.lods[1] : sh);` `B(q.torso).push(…)`; the head
  `(q.head.lods ? q.head.lods[lvH] : q.head).push(…)`; the eyes `folkEyeR1/L1` when `lvH > 0`.
- Nothing else of a person changes: the lines over them (`HL.set`, `HL.draw`), the portrait of a
  near face (`portraitFor`), the hands, what they hold, the simple shapes for the sun's view and the
  mirror (`drawLow(fig, true)`).
- The hero is not touched (`drawHero`). The older kind of person (`drawFull` without `look.folk`):
  leave it, unless `moving.mjs` shows it matters.

**2.4 Numbers** (`moving.mjs` at `island`, `mall`, `mall_in`, `s2`; before = no parameter, after =
`EXTRA="newgfx=1"`):
heads + people's parts on the island from about 320 K to **under 90 K**; draws up by 12 at most;
`renderer.info.programs.length` the same; the loading step's time.

**2.5 Pictures.**
- **The ladder:** every kind of the city's people (`render/folkspec.js` `FOLK`, all of them) stood
  in rows at 2, 3.5, 4.5, 6, 9, 12, 16, 24 and 30 m from a still camera, front, side and back to
  it, one of each row talking (mouth open). Before/after; 3× and 6× crops of each row. In the rows
  at and beyond a line the outline of no head or limb may move by a pixel; nothing may show through
  a mouth; hair, ears, glasses, collars, wrists and ankles must still meet. The lab pages
  (`game/facelab.js`, `tools/bodylab`) show how to stand people where you want them.
- **Walking through the lines:** one person walked from 14 m to 3 m and back, a frame every 0.25 m:
  the frame where a version changes must not differ from its neighbours more than they differ from
  each other.
- **The street:** `ab-phone.mjs` all spots, under 0.5%.
- **The film:** two moments of each scene with people in it (s2 the pier's crowd, s3, s4, s5):
  before/after. The cast in close shots must be within the noise (they are at level 0).
- The computer: `tools/ab.mjs`, 0.00%.

**2.6 Send** the ladder's sheet (cut to the rows that matter), two street sheets, two film sheets.
**Stop for the yes.** Then ROADMAP, publish, the test route from the owner (Section 14).

**2.7 After it,** run `moving.mjs` again and list what is still big among what moves (the two
1,184-triangle shapes of 3.4, hands, hair, the far walkers' 885 small shapes in the film's crowd).
The same recipe where it pays; say what you found.

---

## 9. Stage 3 — inside the mall

The heaviest place in the game: 2.5 M triangles and 404 draws a frame under the dome (3.3), and
Stage 1 gives nothing there. Four different things make it up; take them in this order.

**3.1 Look first.** At `mall_in`, at the same place one floor up, at the far end of the hall and
inside one shop: `breakdown.mjs` (`DEPTH=4 TOP=80`), `parts.mjs`, `moving.mjs`. Write down:
which pieces of the mall itself are the biggest and what they are (rails? balusters? ceiling
coffers? plants? shop fronts? escalators? — `world/mainland/megamall.js` builds it); what the 4 × 4
pass is; how many of the draws are pieces of under 2,000 triangles.

**3.2 The island is not drawn when it cannot be seen (`farHide`).** 219 K triangles of the island,
600 m away, are drawn from under the dome. `game/mall.js` `deepInside(p)` (line 353) already says
when the camera is well inside a mall's hall (the pipeline uses it for the sun's view). While it is
true, hide for the drawing and the mirror the island's own pieces — through the renderer's own
per-view list, as `viewHide` does (`pipeline.js` `occlude`/`unocclude`), not by switching things off
for good. Before doing it, prove what can and cannot be seen from there: from deep inside the hall,
through its glass roof and its doors, turn the camera all the way round and up, with the island
drawn in plain red (a test material): if any red pixel shows, narrow the rule (only the pieces
below the horizon line of the doors, or only while the doors are out of view) until none does.
Exact: within the noise in pictures.

**3.3 A shop's goods from far off (`goodsFar`).** 547 K: one fashion shop across the hall is 231 K
triangles in a window a hundred pixels wide.
- Where: `world/shopkit.js` — `put()` (line 356) lays a product's model into the shop's soup
  (`model(look.model, low)` already has a lighter make for a phone and for back rows);
  `soupMeshes()` (line 383) turns a soup into the meshes `goods <pen>`; `world/interiors.js` builds
  and shows them (`group.name = 'stock <kind>'`).
- The far make: a second soup for the same shop, every product in a model that keeps its outline and
  its colours within 1.2 cm (0.6 of a pixel at 12 m on the phone) and no more — made once a model
  (with `lighter()`, or by its own generator with fewer rounds), cached. Meshes `goods far <pen>`,
  hidden to begin with.
- Which is drawn, a view at a time (extend `Interiors.viewHide`; it needs a second list, of things
  shown for this view and hidden again after it): the camera outside the room and more than 12 m in
  front of its front → the far make; otherwise the full one. Keep the last choice until the line is
  passed by 10%.
- Things a player can take or buy (`live <pen>`, `LiveSet`) stay as they are.
- The far make counts in the shops' corner budget (`interiors.js` `this.verts`, 450 K on a phone)
  and is built in the same small jobs; it must not make a shop appear later by more than a fifth.
- Pictures: every kind of shop (`rec.kind`) looked at through its front from 8, 12, 14, 20 and 35 m
  and from inside, before/after, 3× crops. Expected inside the mall: goods from 547 K to under 150 K.

**3.4 The mall itself (1,279 K).** Decide from 3.1. Likely candidates, cheapest first:
- generators of round or repeated small things (rail posts, balusters, lamp chains, plants) that
  make far more triangles than their size on a phone can show: a phone-only build parameter for
  their rounds — judged by the half-pixel rule at the distance they are usually seen from;
- pieces cut by floor and by bay, so that the renderer's box test and the buildings-hide-buildings
  test (`render/occlusion.js`; the mall gives its boxes in `megamall.js:2599`) can leave out what a
  floor's slab hides — only if it does not add draws (count them);
- the shops' own rooms seen from the hall: their back walls and ceilings are in the block's pieces,
  not in the stock — could be split off and hidden by the same rule as the goods.
Bring the owner the finding and the option you recommend, with numbers, **before** building any of
it: this one is a choice, not a fix.

**3.5 People in the mall** come with Stage 2 (`game/mallcrowd.js`): check `moving.mjs` there.

**3.6 Pictures and send:** `mall_in` and three more views inside (one from the top floor, one at a
door looking out, one into a fashion shop from 20 m), before/after sheets. **Stop for the yes.**

---

## 10. Stage 4 — pixels and passes

Do 4.1–4.3 (the picture stays the same or within a rounding); 4.4–4.6 only if the owner's test
route after Stage 3 is still short of Section 5, and each of those with its own yes.

**4.1 The last pass reads the glow once (`finalLite`).** `FINAL_FRAG` (`pipeline.js:391`): `main()`
calls `grade()` for five places; each reads the glow (`tBloom`) again, though the glow is a blur.
A second make of the shader (a define, `LITE`): when there is no smear, no painted look and no rain
picture this frame (`uSmear`, `pk`, `uRainOn` — the film and the smart drawing keep the old way),
read `tBloom` once at `vUv` and use it for all five; the rest of the arithmetic unchanged. Both
makes prepared while loading (`precompile`), chosen at the pass by `this.low && GFX.finalLite &&
!GFX.off`. Pictures: within 0.2%. On the device: the report's "סיום" against the baseline.

**4.2 The glow in five passes instead of seven (`glowLite`).** Today (`levels = 4`): the bright
parts at half size, three times down, three times up — and the two half-size passes are three
quarters of its pixels. On a phone: the bright pass straight to a quarter (`BRIGHT_FRAG`'s four
taps one source pixel out instead of half, so they cover 4 × 4), two down, two up; the last pass
reads a quarter-size glow. What changes: the thinnest ring of the glow (a pixel or two round a
light). Match the glow's overall strength (`uBloom`) so that the mean of the glow's picture is
within 3% of before at a night spot. Pictures at night and in the film's neon: sheets to the owner;
this is a look, so it needs the yes. On the device: "זוהר".

**4.3 Small exact things, each measured by its pass's line in the report; keep what shows.**
- After each shadow pass, tell the card its colour picture is not needed
  (`gl.invalidateFramebuffer(gl.FRAMEBUFFER, [gl.COLOR_ATTACHMENT0])`): the sun's views are read by
  depth only (`pipeline.js:984`).
- The people's and the cars' pens without `discard` when nothing of theirs can be thrown away this
  frame — the still city's trick (`render/solid.js`) for the classes of `render/people.js` and the
  pools of `render/cars.js`: a twin material with `SOLID`, worn by a class in a frame in which no
  person has a hole (`inPersonHole`), nothing is crumbling (`vGone`), no rubbed-out spot is near and
  no instance of the class was pushed with a cutting plane (`clip`). The same pixels. Its shaders
  prepared while loading, or the first frame stalls.

**4.4 (needs a yes) Fewer pixels with a better enlargement.** Only if needed. Today the drawing is
0.875 of the screen and the last pass enlarges it with plain filtering and sharpening. A drawing at
0.75 (27% fewer pixels in the drawing, the ink and the glow) enlarged along its edges (AMD's FSR 1
"EASU", MIT, 12 reads a pixel in WebGL 2 — there is no `textureGather`) and then sharpened as now.
Show the owner three sheets at 3× of pen lines, faces and far buildings: today's against 0.75 with
the new enlargement. If they can tell which is which and like today's more, drop it.

**4.5 (experiment) The outlines' picture in 8 bits.** The drawing writes two half-float pictures
(128 bits a pixel). The second (`gAux`: a normal's x and y, an id, a line weight — all 0..1,
`glsl.js:1629`) could be RGBA8: 96 bits. Risk: two things whose ids fall in the same 1/255 lose the
line between them (today 1/1024 or finer). Behind `?aux8` only; pictures; the device's "ציור" line.

**4.6 (last resort, needs a yes) Cheaper pens.** The pens are half of the heaviest shader. Pen
strokes read from prepared pictures instead of worked out a pixel would be much cheaper and would
look a little different (a pattern that repeats). Not without the owner seeing it side by side.

---

## 11. Stage 5 — the processor: draw calls and stalls

A phone's processor spends 0.03–0.045 ms a draw call (ROADMAP 10.7, 11.1): 237 draws on the
island are 8–11 ms, the mall's 400–630 would be 16–25 ms — there the processor alone can miss 30. And the owner feels stalls
when the city loads round them.

**5.1 Measure on the device first.** The test route's report: "מעבד: משחק / שליחת הציור", draw calls
(average, peak), long tasks, the slowest frame, the systems' list. Add to the route a second leg
that **drives** through the mainland at 20 m/s for 30 s (from the bridge to Bayview Mall), the
streamers working as in play, and report for it: frames over 50 ms and over 100 ms, the longest,
and for each of the five worst what was being built then (`mainland.info()`, `interiors.info()`
give the job) — that is what a stall is made of.

**5.2 Then, by what the report shows:**
- **Draws.** Every hidden thing of Stages 1 and 3 is draws saved too: count again. Pieces of under
  2,000 triangles that share a pen and stand close: merge when the block is built. The values shared
  by all the pens (camera, sun, fog, the lamps' arrays, the shadows' matrices) sent once a frame in
  one block (`THREE.UniformsGroup`) instead of at every change of pen — ROADMAP 10.7 measured 40% of
  the sending there; the same picture; a change through `render/materials.js` and `render/glsl.js`
  to be made with care and proved by `tools/ab.mjs` at 0.00% on both a phone and a computer (this
  one may stay on for computers only if the owner agrees: it changes no picture).
- **Stalls from building.** The streamers' slices (`world/mainland/stream.js`: budget, the adaptive
  58 ms gap; `world/interiors.js`: 1.2 ms a frame on a phone): no slice over 4 ms on a phone; a
  block's meshes handed to the card over several frames, not in one; nothing compiled in play
  (the report's "הכנת שיידרים" must stay 0 after loading). If building still stalls: the block's
  geometry made on a worker thread (the generators in `world/mainland/blocks.js` and what they call
  must then run without the page — a large change: bring it to the owner as its own stage).
- **Garbage.** About 200 KB a frame was left (ROADMAP 11.1ג). Chrome's allocation profile in the
  headless phone on the route: the ten biggest sources; fix those that are loops making arrays or
  closures a frame.

**5.3 Pictures:** none needed where nothing drawn changes; `tools/ab.mjs` and `ab-phone.mjs` at the
noise. The owner gets numbers: the test route before and after.

## 12. Stage 6 — the pace, heat, and weaker phones

**6.1 The steady 30 that holds.** With the card's time down, check `game/pace.js` on the device
(the performance screen's pace line; the report): the drawing's size should now sit at its full
0.875; if it still breathes, look at why before touching the controller. Do not raise the pace to
60 on phones by default; `auto` is there for whoever picks it.

**6.2 Heat.** The route's "שוב רגיל" and the device-speed line (start against end) show the phone
warming. If after Stages 1–5 the warm numbers still fall under 30: the steps of what is least seen
(`game.js` `applyDetail`: the mirror, then the sun's view of what moves, every other frame) are
taken *before* the card is throttled — by the trend of the frame's time on the card over a minute —
rather than after. Nothing the eye sees first.

**6.3 Three levels of quality, for the store.** The owner's phone is the top level and keeps everything above as
it is. Phones a class or two below need more: a level chosen at the first start from a three-second
measure of the card (`game/perf.js` `gpuSpeed`) and remembered, shown in the settings, changeable.
Draft table (to be agreed with the owner before any of it is built — the lower levels do change the
look on weak phones):

| | high (the owner's) | medium | low |
|---|---|---|---|
| drawing, CSS pixels | 1.75 | 1.5 | 1.25 |
| people: lines of 8.2 | × 1 | × 1.4 | × 1.9 |
| people in simple shapes beyond | 32 m | 26 m | 20 m |
| parked cars to | 110 m | 80 m | 60 m |
| mainland blocks in detail to | 150 m | 120 m | 100 m |
| mirror | every 2nd frame | every 3rd | water only |
| glow | 5 passes | 5 | 3 |

## 13. After this plan: the store

Not part of this work. When the game is smooth: wrapping it for the stores (Capacitor or a Trusted
Web Activity on Android; WKWebView on iOS, where WebGL 2 runs on Metal and memory is capped),
fullscreen and orientation, the screen kept awake, sound unlocked at the first touch, files kept on
the device, a test on five or six real phones. A plan of its own.

---

## 14. Results (add to this as you go; never delete a line)

### 14.1 Before anything (the game as on the site, commit `809b51a` = `6330f49`), measured here

| what | island | mall street | inside the mall | film s2 |
|---|---|---|---|---|
| passes / draws / triangles, whole frame | 12 / 237 / 1.21 M | 14 / 629 / 4.17 M | — | 14 / 271 / 0.74 M |
| the drawing pass: draws / triangles | 197 / 1,131 K | 410 / 3,422 K | 404 / 2,548 K | 166 / 520 K |
| of it: goods | 0 | ~2,300 K | 547 K | 0 |
| of it: what moves | 484 K | ~170 K | 503 K | ~400 K |
| heads / people's parts / cars | 127 K / 194 K / ~45 K (15 people near, 11 cars) | | | 34 K / — / ~75 K (4 heads; the cars estimated, 17 of them) |

Pause menu on the phone: the sheet shows 356 of its 652 pixels; the test route's button is at 606.

### 14.2 The experiment `3035a3a` as it was (not phone-only, never approved), measured here

| what | before | with it |
|---|---|---|
| mall street: still triangles drawn | ~3,250 K | 895 K |
| inside the mall: the drawing pass | 2,548 K | 2,459 K (goods 547 K both ways) |
| island: cars | ~45 K | ~9 K |
| pictures (3 island spots) | | 0.06%, 0.14%, 0.74% — see 3.6 |

### 14.3 From the owner's phone

(the test route's reports, pasted whole, newest last — each with the commit it was run on)

---

## Appendix A — where things are

| what | file | where |
|---|---|---|
| phone or not; pixel ratio; the drawing's scale and floors | `v5/js/main.js` | 192–230 |
| passes of a frame, in order | `v5/js/render/pipeline.js` | `renderFrameInner` 2612 |
| pictures made and sized | `pipeline.js` | `ensure` 1206, `makeG` 1326 |
| glow | `pipeline.js` | `BRIGHT/DOWN/UP_FRAG` 228–293, `drawGlow` 3032, `levels` 1109 |
| last pass | `pipeline.js` | `FINAL_FRAG` 391, uniforms 1049 |
| per-view hiding | `pipeline.js` | `occlude` 1845, `unocclude` 1863; called for the mirror 2503 and for the drawing 2863 |
| the pens' shader; what it may throw away | `v5/js/render/glsl.js` | `discard` 1104–1108; people's corners 664–705 |
| people | `v5/js/render/people.js` | `DrawClass` 350, `Shape` 470, `buildShapes` 1189, `draw` 1795, `drawFolk` 2304 |
| heads, eyes, face moves | `v5/js/render/folkshapes.js`, `folkheads.js` | `base` 27, `headOf` 178, `eyeGeo` 448, `exprMoves` 467 |
| cars | `v5/js/render/cars.js` | `lowerBody`, `build`, the pools, `drawCar` |
| shops' rooms and goods | `v5/js/world/rooms.js`, `shopkit.js`, `interiors.js` | `shopkit.js`: `put` 356, `soupMeshes` 383; `interiors.js`: `NEAR/FAR` 13 |
| mainland blocks, streaming | `v5/js/world/mainland/blocks.js`, `stream.js`, `megamall.js`, `plan.js` | |
| inside a mall? | `v5/js/game/mall.js` | `deepInside` 353 |
| the steady pace; detail steps | `v5/js/game/pace.js`; `game.js` | `applyDetail` 917, the loop 955 |
| the test route and its report | `v5/js/game/perf.js` | `STILL` 21, `ROUTE` 25, `startBench` 593, `nextStill` 720, `endBench` 777 |
| pause menu | `v5/index.html` 343–438; `v5/css/style.css` 928, 459 | |
| settings (pace, smart drawing…) | `v5/js/core/settings.js` | |
| the project's record | `scribble-city/ROADMAP.md` | 10.7, 11.1ב–ה, 11.3–11.5 for all earlier speed work |

Line numbers are for commit `6330f49`; search by name if they moved.

## Appendix B — a simplifier of the game's own (only if meshoptimizer cannot be used)

`v5/js/render/simplify.js`: `simplify(index, pos, nor, maxErr) → Uint32Array`.
- Half-edge collapses only: corner `u` is moved onto a neighbour `v` and its triangles re-pointed;
  no corner is ever made or moved, so the result indexes the same corners.
- A quadric a corner (Garland and Heckbert): the sum, over its triangles, of the plane's
  `(n, d)(n, d)ᵀ` with the triangle's unit normal. The cost of `u → v` is `vᵀ(Qu + Qv)v`; its
  square root is taken as the distance moved.
- Not allowed: a corner on a border (an edge with one triangle) moving; a collapse that turns any
  remaining triangle's normal by more than 60° or leaves it with no area; one that joins corners
  whose own normals differ by more than 45° (a crease stays a crease).
- A heap of the candidate collapses by cost; after each, the neighbours' candidates are recosted
  (stamp each corner with a version; a popped candidate with an old stamp is dropped).
- Stop when the cheapest candidate's distance is over `maxErr`. Return the triangles left.
- Test it on a ball and on a bent tube before the head: the count must fall, the outline must stay
  inside `maxErr`, no hole may open.

## Appendix C — the message to the owner at a stage's gate (Hebrew, adapt)

> סיימתי את שלב N (שם השלב). מה השתנה: … (משפט או שניים). מה לא השתנה: המראה, והמחשב.
> במספרים: … (למשל "ליד הקניון: מ־3.4 מיליון משולשים בתמונה לכמיליון").
> מצורפות X תמונות: בכל אחת "לפני" למעלה ו"אחרי" למטה, ומתחת שני קטעים מוגדלים פי 3.
> אם זה נראה לך אותו דבר — תאשר, ואפרסם ואמשיך לשלב הבא. אם משהו מפריע לך בתמונה, תגיד איפה.
> (עוד לא פורסם לאתר; מה שיש עכשיו בקישור הוא הגרסה הקודמת.)

And after publishing:

> פורסם ונבדק שהעלייה לאתר הצליחה: https://amity100.github.io/Test-1-/scribble-city/v5/
> כשנוח לך: בטלפון, תפריט ההפסקה ← "מבחן ביצועים" (בראש התפריט). בלי לגעת כדקה וחצי, ובסוף "העתקה"
> ולהדביק לי כאן. זה מודד גם "כמו קודם" מול "עכשיו" באותה ריצה.
