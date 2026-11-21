export const meta = {
  name: 'gta4-city-team-round2c',
  description: 'GTA IV team, round 2, third start: review venues, finish trees and shops, build rooftops and homes, review each (facades, pedestrians, traffic and streets are already reviewed)',
  whenToUse: 'Large parallel upgrade of the scribble-city v5 world, aspect by aspect, each in its own git worktree',
  phases: [
    { title: 'Build', detail: 'one agent per unfinished aspect, in its own worktree: before shots, implement, test, after shots, commit' },
    { title: 'Review', detail: 'an adversarial reviewer per aspect: read the diff and the shots, fix real problems, re-test (incl. the lab smoke test), commit' },
  ],
}

// args (see RESUME.md): {G: '<scratchpad>/gta4', BASE: '6277529', FACADES: '<gta4/facades head>',
//   WT: {venues: '<worktree of gta4/venues>', trees: '<...gta4/trees>', shops: '<...gta4/shops>'}}
const G = args.G
const BASE = args.BASE            // the main branch head that was merged into every gta4/* branch (6277529)
const FACADES = args.FACADES      // the reviewed gta4/facades head: rooftops starts from it
const WIP = '/home/user/Test-1-/scribble-city/wip/gta4-round2'
// Reviewed and ready to merge (round 2b): not run again.
const DONE = ['facades', 'pedestrians', 'traffic', 'streets']
// Built, not yet reviewed: straight to the reviewer.
const BUILT = { venues: args.WT.venues }
// Stopped mid-build: the next builder continues in the existing worktree. shops started from gta4/facades at 7a20387.
const PARTIAL = { trees: args.WT.trees, shops: args.WT.shops }
const PBASE = { trees: BASE, shops: '7a20387' }
const START = { rooftops: FACADES, homes: BASE }

const PREAMBLE = `
You are one member of a team of agents upgrading a browser game, working in parallel with the others.
The user (who writes in Hebrew) wants the city to reach the level of GTA IV:
- very detailed, real-looking streets, buildings, shops, restaurants, malls and homes;
- intelligent people and a bustling, rich street life;
- no "collection of Lego cubes".
They do not compromise on detail, behaviour, variety and realism. Work hard and thoroughly on YOUR aspect only.

THE PROJECT
- Repo: a git worktree (see your instructions below for which one; run \`pwd\` and \`git rev-parse --show-toplevel\`).
  - The game is in scribble-city/v5 (three.js r169, ES modules, no build step; package.json has "type": "module").
  - The main branch head is ${BASE}. It is already merged into every existing gta4/* branch. Since the team's first base (30f175c) the main branch only added the "lab" (?lab=1: drawing gear onto cars, police cars held by that gear through game/traffic.js updateCar -> gear.holdCar, driving buttons on phones). The world code (js/world/**) is identical to 30f175c.
- The look: a hand-drawn notebook / pen style.
  - Geometry is plain three.js meshes, merged into batches per material (world/kit.js Batch: B.add(material, geometry, matrix, id, {color})).
  - The pen shader (render/glsl.js, render/pipeline.js) draws hatching and ink outlines by part id.
  - KEEP this style. NEVER lower graphics quality.
- World structure:
  - The island: world/city.js, world/blocks.js, world/streets.js, etc.
  - The big mainland (world/mainland/*): blocks are streamed in and out by world/mainland/stream.js. Each block is built by world/mainland/blocks.js buildMBlock using a block context "bctx" with: B, R (room batch), M (materials), col (collision BoxList), rng (seeded), shops, seats, benches, busStops, stock, objects.
  - Street tiles: world/mainland/tiles.js.
  - Building kits: world/kits.js (house, condo, apartments, storefront, shopStrip, ...); world/deco.js (fbox, windows, airCon...); world/sobe.js (rows of lots).
  - Yards: world/yards.js (softBox hedges, fences, bushes).
  - Street props: world/streets.js, world/streetscape.js (shadeTree, clump, planter, payStation, bikeRack), world/mainland/sidewalks.js (dressSidewalks: sidewalk furniture, bus stops, hot dog carts).
- Interiors:
  - world/rooms.js Room: frame u along the front ua..ub, d out of the front (back wall db, front da), y0 floor, y1 ceiling. R.box/R.cyl/R.table/R.chair; R.spots.{browse,seats,chairs,keeper,pay,queueDir,staff,mirrors,fitting,marks}; R.solid for collision.
  - FURNISH[kind] plans: island ones in rooms.js, mainland ones in mainland/furnish.js.
  - Detailed stock plans are in world/shops2.js and world/stock.js (Run helper, goods(), shelving(), fridges(), checkout(), ...), built into typed-array "soups" (world/soup.js FSoup: fbox/fcyl/fball; R.soup('box'|'cyl'|'gloss'|'lamp')).
  - A plan function with .stock = true is laid out lazily: solids and spots at block build; the soups are rebuilt near the player by world/interiors.js. The same seeded rng order is used in both passes, so every rng call must happen in both passes.
  - world/homes2.js wraps the home kinds the same way.
- People and life:
  - game/civilians.js: pedestrians walking sidewalk loops, steer() avoidance, windowStop(), spawn caps 40/18 on touch.
  - game/farcrowd.js: cheap far walkers.
  - game/streetlife.js:
    - OpenShop: keepers, visitors and shoppers inside rooms with phases (in/at/pay-go/pay/out/queue).
    - Errands: people popping into shops. Carts (toCart/cartWork).
  - game/routines.js: benches, bus stops, cafe tables.
  - game/crowds.js: looks per district. game/reactions.js.
  - game/traffic.js: cars, buses, taxis, parked cars. game/vehicles.js.
  - game/carry.js: things people hold.
  - game/rhythm.js: hours, people/cars factors.
- Figures: game/doodle.js and render/people.js. fig.carry / fig.carryL / fig.reachR / fig.lookAt / fig.sit / fig.dance / fig.holdUp.
- Read the code before changing it. Match the surrounding code's style:
  - long narrative comments in the same voice;
  - the same helpers;
  - no new dependencies.

HARD RULES
- Work ONLY in scribble-city/v5. Never touch v1..v4, v5ab, scribble-city/js, ROADMAP.md, README.md, or anything outside your worktree except the shared folder ${G}.
- Never touch the main checkout /home/user/Test-1- itself or any other agent's worktree (read-only git commands like git log/diff/show are fine).
- FILE OWNERSHIP:
  - You may freely edit only the files listed as yours below, and NEW files you create.
  - If you truly need a change in another file, keep it a minimal additive hook (an import line, one call) and list it in outside_edits.
  - Other agents are editing other files at the same time; keep merges clean.
- Keep the game fast. The mainland is streamed and runs on phones too (game.touch, low flags; check how existing code scales down on touch).
  - No per-frame allocations in hot loops. No O(n^2) per frame over large sets.
  - Geometry: merge into batches as existing code does. Report vertex/draw-call or per-frame CPU impact you measured.
- Content rules:
  - Parody or invented brand and shop names only, no real brands.
  - In-world text in English; UI text (if any) in Hebrew.
  - Modest clothing for women (looks go through existing helpers). No aliens. No smoking or alcohol glamour beyond what exists.
- Processes: never use pkill/killall/grep-kill. Kill only by PID, and only processes you started. A machine-learning training job (python3 train.py) may be running: never touch it.
- When rm -rf uses a variable, write "\${VAR:?}".
- Syntax-check every changed JS file with: node --check <file>.
- GIT:
  - Commit ONLY in your worktree, on your branch gta4/<aspect key>.
  - NEVER push, NEVER touch other branches, NEVER rewrite history (no rebase, no amend, no reset of commits).
  - Every commit message ends with exactly these two lines (after a blank line):
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_0153GfthkSpGNsVr8EsmCE1z
  - Do not put model names in code or commit messages.
  - COMMIT EARLY AND OFTEN: an earlier run of this team was cut off by a usage limit and lost its agents' context. After every step that works (syntax-checked, and ideally browser-checked), commit a snapshot ("... (in progress): <what>"), so an interruption loses little. If you find uncommitted changes in your worktree when you start, they are an interrupted agent's work: read them and continue from them (commit them first as a snapshot).
  - RUNNING NOTES: keep a plain-text notes file ${G}/notes/<your label, e.g. review_facades>.txt (mkdir -p first; plain .txt): what you checked, what you found, what you fixed (with commit ids), measurements, and what is left to do. Update it after every step. If the file already exists when you start, a previous agent with your label was cut off (usage limit or a machine restart): read it and its commits first, and CONTINUE from where it stopped instead of redoing its work.

BROWSER TESTS (headless Chromium with software WebGL; this machine has only 4 processors)
- Every browser run MUST go through the shared lock wrapper, so only one browser runs at a time across the whole team:
    bash ${G}/run_browser.sh <your worktree>/scribble-city <script.json> <out prefix> [W=1280] [H=720] [query]
  It serves YOUR worktree's scribble-city folder. It writes <out prefix>.log (console, [eval] results, [shot] lines, [pageerror] lines), screenshots <out prefix>_<shot>.png, and finally <out prefix>.done with the exit code. Default query: test=1&autostart=1.
- A run can wait for the lock and then take 5–25 minutes. Start it with the Bash tool using run_in_background: true. Then wait with a foreground Bash call like:
    until [ -f <out prefix>.done ]; do sleep 10; done; cat <out prefix>.done
  with timeout 600000, repeated until done.
  Keep scripts focused (few steps, modest frame counts) so the shared browser is not hogged.
- Script format (JSON array of steps):
  - {"js": "<code evaluated in the page; return a value to log it>", "frames": n, "shot": "name"}
  - frames runs n game updates at 1/30 s, then renders one frame. shot saves a PNG after that.
- Useful in-page handles:
  - window.__game (g): g.player.spawn(x, z, yaw), g.camRig.yaw/pitch, g.daynight.setHour(13).
  - g.world.mainland.fill({x, z}, 30000) builds the blocks around a point now.
  - g.world.interiors.fill(x, z, 20000) builds nearby shop stock now.
  - g.world.shops (each shop: kind, name, door [x,y,z], nx/nz, rx/rz, room with room.center and room.facade).
  - g.civilians.list, g.traffic.list, g.streetlife.active, g.renderer.info.
  - The mainland plan: await import('/v5/js/world/mainland/plan.js') → M_BLOCKS (kind, rect {x0,x1,z0,z1}, cx, cz, col, row), PLACES, placeBlock.
- Working examples to copy from (read them): ${G}/example_navigation.json (street, facade, shop, home, mall, restaurant shots), ${G}/example_shops.json (shop interiors and shoppers, with an info probe), ${G}/example_details.json (houses, home interior, food shop), ${G}/example_perf.json (per-system CPU timing wrapper: per-update ms of civilians, farcrowd, traffic, shops, ...).
- An untouched checkout of the main branch head (${BASE}) for baseline runs is at ${G}/base_main (read-only: never edit or commit there; you may point run_browser.sh at ${G}/base_main/scribble-city).
- THE LAB SMOKE TEST (required before you finish): run
    bash ${G}/run_browser.sh <your worktree>/scribble-city ${G}/lab_smoke.json <out prefix> 640 360 'test=1&autostart=1&lab=1'
  and compare its [eval] lines with the main branch's baseline ${G}/smoke/main.log (the gear things harpoon/net/tesla/oil/decoy acting on police cars). Same kinds of results and the final {"errors":0} are required; no [pageerror].
- Time of day 13:00 for daytime shots. Use 1280x720 for shots you will show. Use 320x180 for pure timing runs.
- Look at your screenshots with the Read tool (it shows images). Judge them honestly: is it clearly richer, more real, still in the drawn style, with nothing broken, floating, z-fighting or blocking paths?

DELIVERABLES
1. BEFORE shots: take the shots that best show your aspect before your change (see your instructions for where from). Save them under ${G}/shots/<key>/before_*.png.
2. Implement, iterate, re-test until the after shots are convincingly better.
3. AFTER shots from the same camera setups: ${G}/shots/<key>/after_*.png.
4. Compose 2–4 before/after images for the user:
     python3 ${G}/compose.py <before.png> <after.png> ${G}/send/<key>_<n>.jpg "<Hebrew label for before>" "<Hebrew label for after>"
   - Labels: short Hebrew, gender-neutral, e.g. "לפני: ..." / "אחרי: ...".
5. Commit on gta4/<key>.
6. Return the structured report. In summary, say concretely what changed, what you measured, and what you could not do.
`

const ASPECTS = [
  {
    key: 'facades',
    title: 'Building facades up close',
    owns: ['scribble-city/v5/js/world/kits.js', 'scribble-city/v5/js/world/deco.js', 'scribble-city/v5/js/world/hotels.js', 'NEW scribble-city/v5/js/world/facades.js'],
    goal: `Buildings must stop looking like boxes up close. On the mainland, look at: Little Havana rows (kind 'calle'), downtown storefront rows, apartment blocks, condos, garden apartments, houses.
- Add the real architectural layer:
  - windows that read as deep: thick frames, inner reveals, sills, lintels, mullions, blinds or curtains behind the glass, sometimes open;
  - string courses and cornices, pilasters, a base plinth, rusticated ground floors;
  - balconies with railings and things on them (plants, chairs, laundry);
  - fire escapes on the older walk-ups (the NYC look of GTA IV);
  - AC units, downpipes, utility meters, wall lamps, house numbers, intercoms by doors, mail slots;
  - storefront details: roll-up shutter housings, sign brackets, door handles, kick plates, posters on glass;
  - weathering accents.
- Vary by building type and district.
- Keep vertex growth per block reasonable (aim under +40%) and keep everything merged.`,
  },
  {
    key: 'pedestrians',
    title: 'Intelligent pedestrians and street behaviour',
    owns: ['scribble-city/v5/js/game/civilians.js', 'scribble-city/v5/js/game/crowds.js', 'scribble-city/v5/js/game/reactions.js', 'scribble-city/v5/js/game/routines.js', 'scribble-city/v5/js/game/ambient.js', 'scribble-city/v5/js/game/voices.js', 'NEW scribble-city/v5/js/game/streetsocial.js'],
    goal: `People must feel intelligent and alive like GTA IV pedestrians: groups talking with gestures and turn-taking bubbles, acquaintances meeting, phone calls, noticing and reacting to the player, lunch on benches, tourists photographing, street performers, waiting and crossing together at signals, shopping bags, elderly and joggers, evening crowds. Keep CPU in check (target < +20% on civilians' per-update cost), with distance gating.`,
  },
  {
    key: 'traffic',
    title: 'Living traffic',
    owns: ['scribble-city/v5/js/game/traffic.js', 'scribble-city/v5/js/game/vehicles.js', 'scribble-city/v5/js/game/fleet.js', 'scribble-city/v5/js/game/workers.js', 'NEW scribble-city/v5/js/game/curbs.js', 'NEW scribble-city/v5/js/game/deliveries.js', 'NEW scribble-city/v5/js/game/patrol.js'],
    goal: `GTA IV-like traffic life on the mainland: buses serving the mainland stops, taxis picking up and dropping off, double-parked delivery vans with a worker carrying boxes, parked cars along curbs, cars yielding at crossings and honking in jams, police patrols, a morning garbage truck. Keep traffic CPU per update modest.
NOTE: game/traffic.js was ALSO changed on the main branch (the lab's gear hooks: police cars held by gear in updateCar via gear.holdCar, traffic.policeCar). The merge was automatic; check that both sides still work together (the lab smoke test exercises it).`,
  },
  {
    key: 'streets',
    title: 'Road and sidewalk detail',
    owns: ['scribble-city/v5/js/world/mainland/tiles.js', 'scribble-city/v5/js/world/mainland/sidewalks.js', 'scribble-city/v5/js/world/mainland/ground.js', 'NEW scribble-city/v5/js/world/mainland/roadkit.js', 'NEW scribble-city/v5/js/world/mainland/roadside.js', 'NEW scribble-city/v5/js/world/mainland/roadmarks.js'],
    goal: `Mainland streets as detailed as GTA IV's: manholes, storm drains, patches and cracks, lane arrows, stop lines, crosswalks, bike lanes, parking ticks, painted curbs; at corners walk/don't-walk signals, green street-name signs with the plan's names, curb ramps, bollards; on sidewalks tree grates, utility boxes, litter, scuffed joints, planted strips and utility poles with wires in residential districts. Tiles are streamed: keep vertex/draw-call growth controlled and measured.`,
  },
  {
    key: 'trees',
    title: 'Trees and greenery that look organic up close',
    owns: ['scribble-city/v5/js/world/streetscape.js', 'scribble-city/v5/js/world/palms.js', 'NEW scribble-city/v5/js/world/foliage.js', 'world/city.js: only the few lines the earlier builder already added'],
    goal: `Street shade trees currently look faceted / low-poly ("Lego") up close: big flat-faced icosahedron clumps.
- Investigate why. The leaf pen kind uses UV-based hatching (render/glsl.js strokeCoords: kind 7 leaf uses vUv*uUvScale), so the UVs of IcosahedronGeometry clumps and the noise displacement matter.
- Make crowns read as organic masses of leaves: smoother silhouettes, leafy fringe, layered clumps, varied species shapes, dappled colour. Make palms richer (fronds, coconuts, trunk rings).
- Prefer geometry/UV/normal changes in your files. Do NOT change shaders unless the change is strictly limited to the leaf kind, and you show before/after of other surfaces unchanged.
- Trees are many: measure vertices (renderer info or batch counts) before/after on a mainland avenue and keep growth reasonable; use detail only where seen near (tiles near the player) if a cheap switch exists.`,
  },
  {
    key: 'venues',
    title: 'Restaurants, bars, nightlife, mall hall',
    owns: ['scribble-city/v5/js/world/mainland/furnish.js (NOT the home functions near the end)', 'scribble-city/v5/js/world/mainland/mall.js', 'scribble-city/v5/js/world/mainland/venues.js', 'scribble-city/v5/js/game/streetlife.js', 'scribble-city/v5/js/game/mall.js', 'scribble-city/v5/js/game/nightlife.js', 'NEW scribble-city/v5/js/world/venues2.js', 'NEW scribble-city/v5/js/game/venuelife.js'],
    goal: `Sit-down places and the mall must reach real-life detail.
- Stock plans (lazy, like world/shops2.js and homes2.js; registered via FURNISH in world/venues2.js imported next to shops2.js in world/city.js and world/mainland/blocks.js) for:
  - 'gourmet' restaurants: tablecloths, full table settings, wine glasses, candles, bread baskets, a host stand, a bar with a lit bottle wall, an open kitchen pass;
  - 'bar'; 'club' (check what exists in venues.js);
  - 'cinema' and 'theatre' lobbies: concession stand with popcorn machine, posters, ropes.
- Behaviour (game/streetlife.js, game/venuelife.js): waiters taking orders, bringing plates and clearing them; diners eating with fork motion and talking; a host seating newcomers. Check what exists and improve it.
- Mall hall (mainland/mall.js): storefront window dressing, kiosks with goods, benches with shoppers, plants, signage, info screens, trash bins, people riding escalators.
- Do not edit shops2.js/stock.js (another agent owns them); you may import helpers from stock.js.`,
  },
  {
    key: 'shops',
    title: 'Every remaining shop kind, and window displays',
    owns: ['scribble-city/v5/js/world/shops2.js', 'scribble-city/v5/js/world/stock.js', 'NEW scribble-city/v5/js/world/shops3.js'],
    goal: `These room kinds still have no detailed stock plan:
- barber, laundry, flowers, music, gym, falafel, store, studio, arcade, lobby (office/condo tower lobby with lifts: keep the lift spots streetlife expects).
- Write realistic plans for each in world/shops3.js, registered like shops2.js does (FURNISH[kind] = plan; plan.stock = true), for example:
  - barber: chairs, mirrors, product shelves, waiting bench, pole;
  - laundry: rows of machines, folding tables, carts;
  - flowers: buckets and stands of bouquets, a cooler, a wrapping counter;
  - music: guitar wall, vinyl bins, keyboards, amps;
  - gym: machines, racks, mats, mirrors;
  - arcade: lit cabinets, a prize counter.
- Keep the R.spots the behaviours in game/streetlife.js rely on for each kind: read streetlife.js for chairs, seats, browse, keeper, lift spots.
- Add shop WINDOW DISPLAYS to the existing plans: the front zone (FRONT_KEEP) is mostly empty. Add product pyramids, mannequins, price cards, SALE posters, so shops look full from the street. (Your branch starts from the facades work, which already put stickers/posters ON the glass and shutter housings outside: dress the inside of the window so the two read together, without z-fighting with them.)
- The shops3.js import goes next to shops2.js in world/city.js and world/mainland/blocks.js (a minimal hook; list it).
- Do not edit game/streetlife.js (another agent owns it). Check phones: stock verts are capped by world/interiors.js.`,
  },
  {
    key: 'rooftops',
    title: 'Rooftops and upper-floor silhouettes',
    owns: ['scribble-city/v5/js/world/roofs.js', 'scribble-city/v5/js/world/skyline.js', 'scribble-city/v5/js/world/sobe.js'],
    goal: `From the street looking up, and from above, roofs are bare boxes. Read how roofs.js/ctx.roofs and sobe.js rows place roof items on the mainland.
- Add GTA IV-like rooftop life:
  - water towers on older blocks;
  - HVAC units with fans, vents, pipes, antennas, satellite dishes;
  - parapet caps and coping, stair/elevator bulkheads with doors;
  - skylights, solar panels on houses;
  - rooftop billboard frames, laundry lines;
  - rooftop terraces and pools on condos where they fit.
- Vary by building type.
- Your branch starts from the facades work (cornices, fire escapes, AC units on the walls): make the roof edge meet those cornices cleanly - no double coping, no z-fighting, nothing floating.
- Keep it merged and measure vertex growth. Distant blocks use mainland/far.js baked bodies, which you should not need to touch.`,
  },
  {
    key: 'homes',
    title: 'Homes that look lived in, by who lives there',
    owns: ['scribble-city/v5/js/world/homes2.js', 'scribble-city/v5/js/world/home.js', 'scribble-city/v5/js/world/mainland/furnish.js: ONLY the home functions near the end (the venues agent owns the rest of that file)'],
    goal: `world/homes2.js already adds a lived-in layer to the mainland home kinds (homeFamily, homeArtist, homeGrandma, homeLux, homeFriend).
- Push it to real-life detail and variety per household:
  - kids' corner with toy box, drawings, small table;
  - artist clutter;
  - grandma's knick-knacks, doilies, photo frames;
  - luxury art, sculptures, big plants;
  - wall clock, ceiling fan, AC unit, laundry basket, pet bed and bowls, shoe rack, framed photos on shelves, rug patterns, magazines, remote, phone charger, fruit, a fridge covered in notes, and more.
- Also check world/home.js (who lives there and what they do) and make the people at home do believable things: cooking at the stove, reading, watching TV, kids playing, a pet. Use existing marks/spots.
- Keep homes cheap: they are lazily streamed; measure verts of a home (interiors.info()) before/after.`,
  },
]

const IMG = { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, caption_he: { type: 'string' } }, required: ['path', 'caption_he'] } }
const REPORT = {
  type: 'object',
  properties: {
    aspect: { type: 'string' },
    worktree: { type: 'string', description: 'absolute path of the worktree' },
    branch: { type: 'string' },
    base: { type: 'string', description: 'the commit your branch work started from (git diff base..HEAD is your work)' },
    commits: { type: 'array', items: { type: 'string' } },
    files_changed: { type: 'array', items: { type: 'string' } },
    outside_edits: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string', description: 'English: concretely what changed' },
    images: IMG,
    tests: { type: 'array', items: { type: 'string' } },
    perf: { type: 'string' },
    known_issues: { type: 'array', items: { type: 'string' } },
  },
  required: ['aspect', 'worktree', 'branch', 'base', 'commits', 'files_changed', 'summary', 'images', 'tests', 'perf', 'known_issues'],
}

const REVIEW = {
  type: 'object',
  properties: {
    aspect: { type: 'string' },
    issues: { type: 'array', items: { type: 'object', properties: { issue: { type: 'string' }, severity: { type: 'string' }, fixed: { type: 'boolean' } }, required: ['issue', 'severity', 'fixed'] } },
    commits: { type: 'array', items: { type: 'string' } },
    tests: { type: 'array', items: { type: 'string' } },
    lab_smoke: { type: 'string', description: 'the [eval] lines of your lab smoke run, and whether they match the baseline' },
    perf: { type: 'string', description: 'what you measured against the base and the numbers' },
    images: IMG,
    verdict: { type: 'string', description: 'ready | needs-work' },
    notes: { type: 'string' },
  },
  required: ['aspect', 'issues', 'commits', 'tests', 'lab_smoke', 'perf', 'verdict', 'notes'],
}

const owns = (a) => a.owns.map((f) => '  - ' + f).join('\n')

const buildPrompt = (a) => {
  const partial = PARTIAL[a.key]
  const pb = PBASE[a.key]
  const where = partial
    ? `WHERE YOU WORK: the existing worktree ${partial}, already on branch gta4/${a.key}. cd there first and stay on that branch (do not create a new branch or a new worktree for your work).
RESUMING: an earlier builder of this aspect was stopped mid-way. Its work is on gta4/${a.key}; the main branch (${BASE}) was then merged into it.
1. Read what is already there: git log --oneline --no-merges ${pb}..HEAD and git diff ${pb}..HEAD (that diff is exactly this aspect's work). Earlier builders were cut off (a stop on request, usage limits, a machine restart): their commits are "... (in progress) ..." / "snapshot of a builder stopped by the usage limit". The newest snapshot may be half-finished and untested: read it (git show HEAD), and the last builder's notes ${G}/notes/${a.key}.txt, make it build and run before adding more.
2. BEFORE shots: earlier builders may have left them in ${G}/shots/${a.key}/before_*.png (if that folder is gone, take them from a detached checkout of ${pb} in ${G}/base_${a.key}: git worktree add --detach <dir> ${pb}).
3. Continue and finish the work, adding new commits on top. Never rewrite history.
Your report's base is ${pb}.`
    : `WHERE YOU WORK: you start in a fresh git worktree of your own (run pwd). Create your branch there from ${START[a.key]}:
    git checkout -b gta4/${a.key} ${START[a.key]}
${START[a.key] === FACADES ? `(${FACADES} is the head of gta4/facades: the main branch plus the facades aspect's work, so your work fits the new facades. Another agent may still commit review fixes on gta4/facades; never touch that branch.)` : `(${BASE} is the main branch head.)`}
BEFORE shots: take them in your worktree right after creating the branch, before changing anything (so they differ from the after shots only by your work).
Your report's base is ${START[a.key]}.`
  return `${PREAMBLE}

YOUR ASPECT: ${a.title} (key: ${a.key})
Branch: gta4/${a.key}. Shots folder: ${G}/shots/${a.key}/. Images for the user: ${G}/send/${a.key}_<n>.jpg.
Files you own:
${owns(a)}

${where}

GOAL
${a.goal}

Start by reading the relevant code thoroughly, then the before shots, then build. Iterate with the browser until the AFTER shots are clearly, visibly better and nothing is broken (no [pageerror] in logs). Run the lab smoke test. Commit, compose the before/after images, and return the report.`
}

const reviewPrompt = (a, r) => {
  const wt = BUILT[a.key] || PARTIAL[a.key] || (r && r.worktree)
  const base = BUILT[a.key] ? BASE : PARTIAL[a.key] ? PBASE[a.key] : (r && r.base) || START[a.key]
  const rep = BUILT[a.key]
    ? `read it with the Read tool: ${WIP}/reports/${a.key}.json (its perf numbers are against ${BASE}). Its shot paths point to ${G}/shots/${a.key}/ and ${G}/send/${a.key}_*.jpg, which may be gone after a machine restart: small copies of its images are in ${WIP}/images/; re-take shots with the same intent if you need them, and re-compose ${G}/send/${a.key}_*.jpg if you change the look.`
    : JSON.stringify(r, null, 1)
  return `${PREAMBLE}

YOU ARE THE ADVERSARIAL REVIEWER AND FIXER for the aspect "${a.title}" (key: ${a.key}).
Files the aspect owns:
${owns(a)}

The builder's report:
${rep}

Work INSIDE the builder's worktree: cd ${wt || '(missing: find the worktree that has branch gta4/' + a.key + ' with `git worktree list` from /home/user/Test-1-)'}.
- Stay on branch gta4/${a.key}. Do not create another worktree.
- Review everything the aspect changed: git diff ${base}..HEAD and git log --no-merges ${base}..HEAD (also 30f175c..HEAD --no-merges for the history before the main branch was merged in).
- Look at the builder's shots and images with the Read tool.
${a.key === 'traffic' ? '- traffic.js was changed on BOTH sides (the lab added gear holds of police cars in updateCar and traffic.policeCar); read the merged result carefully.\n' : ''}
Try hard to find REAL problems:
- runtime errors (undefined names, wrong imports, exceptions in hot paths, null cases such as touch mode, night, rain, the island ?island=1, a block detaching mid-action, the lab ?lab=1);
- performance regressions (allocations per frame, per-frame loops over all shops/people, vertex explosions, missing distance gating) - measure against ${G}/base_main with an example_perf.json style run (the whole team shares one browser: a base/branch pair, repeated once if the numbers are ambiguous, is enough);
- geometry that floats, intersects, z-fights or blocks doorways and paths;
- behaviour that can get stuck or leak people/objects when blocks stream out;
- lazy-stock rng-order mismatches between passes;
- ownership violations (edits outside the owned files beyond a minimal hook);
- content rules (names, modesty, language);
- debug leftovers (counters, console logs) in hot code;
- anything that looks worse or still looks like boxes.
The builder's own known_issues are a starting list, not the whole list.
${a.key === 'facades' || a.key === 'pedestrians' ? `
A PREVIOUS REVIEWER of this aspect was cut off by a machine restart before it reported (it left no notes file). Its fixes are the commits titled "... review (in progress): ..." at the top of the branch (git log --no-merges ${BASE}..HEAD). ${a.key === 'facades' ? `Its scratch measurements (per-block vertex counts before/after, by material) are in ${G}/review_facades/.` : ''} Read those commits first, keep what is right, and continue the review from there; do not redo finished work.
` : ''}

Then:
1. Fix what is real and worth fixing, in the aspect's own files.
2. Re-run a focused browser test through the lock wrapper: no [pageerror], the look confirmed.
3. Run the LAB SMOKE TEST and compare with the baseline (required).
4. If your fixes change the look, refresh the after shots and the composed images in ${G}/send/${a.key}_*.jpg.
5. Commit on the same branch (with the two trailer lines).
6. Report verdict "ready" only if the branch is safe to merge into the main branch.`
}

phase('Build')
const RUN = ASPECTS.filter((a) => !DONE.includes(a.key))
const results = await pipeline(
  RUN,
  async (a) => {
    if (BUILT[a.key]) return { aspect: a.key, branch: 'gta4/' + a.key, worktree: BUILT[a.key], base: BASE, report_file: WIP + '/reports/' + a.key + '.json' }
    // (the four built aspects' reviews queue first: they are shorter, and finish mergeable work early)
    for (let i = 0; i < 20; i++) await null
    return agent(buildPrompt(a), PARTIAL[a.key]
      ? { label: `build:${a.key}`, phase: 'Build', schema: REPORT }
      : { label: `build:${a.key}`, phase: 'Build', isolation: 'worktree', schema: REPORT })
  },
  (r, a) => {
    log(`${a.key}: ${r ? 'built' : 'builder returned nothing'} - review starts`)
    return agent(reviewPrompt(a, r), { label: `review:${a.key}`, phase: 'Review', schema: REVIEW }).then((v) => ({ build: r, review: v }))
  },
)
return results.map((x, i) => ({ key: RUN[i].key, ...(x || { build: null, review: null }) }))
