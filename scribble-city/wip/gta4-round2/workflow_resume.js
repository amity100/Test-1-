export const meta = {
  name: 'gta4-city-team-resume',
  description: 'Resume the GTA IV team: finish trees and venues, build shops, rooftops and homes, then adversarially review all 9 aspect branches',
  whenToUse: 'Large parallel upgrade of the scribble-city v5 world, aspect by aspect, each in its own git worktree',
  phases: [
    { title: 'Build', detail: 'one agent per aspect, in its own worktree: before shots, implement, test, after shots, commit' },
    { title: 'Review', detail: 'an adversarial reviewer per aspect: read the diff and the shots, fix real problems, re-test, commit' },
  ],
}

// Pass {G: '<new scratchpad>/gta4', BASE: '30f175c'} as the workflow's args (see RESUME.md).
const G = (args && args.G) || '/tmp/gta4'
const BASE = (args && args.BASE) || '30f175c'
const WIP = '/home/user/Test-1-/scribble-city/wip/gta4-round2'
// Built and committed before the stop, not yet reviewed: they skip the build and go straight to review.
const BUILT = ['facades', 'pedestrians', 'traffic', 'streets']
// Stopped mid-build: the branch holds the work in progress, the builder picks it up.
const PARTIAL = ['trees', 'venues']

const PREAMBLE = `
You are one member of a team of agents upgrading a browser game, working in parallel with the others.
The user (who writes in Hebrew) wants the city to reach the level of GTA IV:
- very detailed, real-looking streets, buildings, shops, restaurants, malls and homes;
- intelligent people and a bustling, rich street life;
- no "collection of Lego cubes".
They do not compromise on detail, behaviour, variety and realism. Work hard and thoroughly on YOUR aspect only.

THE PROJECT
- Repo: a git worktree (your current directory when you start; run \`pwd\` and \`git rev-parse --show-toplevel\`).
  - The game is in scribble-city/v5 (three.js r169, ES modules, no build step; package.json has "type": "module").
  - Base commit: ${BASE}.
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
- Work ONLY in scribble-city/v5. Never touch v1..v4, v5ab, scribble-city/js, ROADMAP.md, or anything outside the repo except the shared folder ${G}.
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
- Never use pkill/killall/grep-kill. Kill only by PID if ever needed.
- When rm -rf uses a variable, write "\${VAR:?}".
- Syntax-check every changed JS file with: node --check <file>.
- GIT:
  - Commit ONLY in your worktree, on a branch named gta4/<aspect key>. Create it first: git checkout -b gta4/<key>.
  - NEVER push, NEVER touch other branches, NEVER rewrite history.
  - Every commit message ends with exactly these two lines (after a blank line):
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_0153GfthkSpGNsVr8EsmCE1z
  - Do not put model names in code or commit messages.

BROWSER TESTS (headless Chromium with software WebGL; this machine has only 4 processors)
- Every browser run MUST go through the shared lock wrapper, so only one browser runs at a time across the whole team:
    bash ${G}/run_browser.sh <your worktree>/scribble-city <script.json> <out prefix> [W=1280] [H=720] [query]
  It writes <out prefix>.log (console, [eval] results, [shot] lines, [pageerror] lines), screenshots <out prefix>_<shot>.png, and finally <out prefix>.done with the exit code.
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
- Time of day 13:00 for daytime shots. Use 1280x720 for shots you will show. Use 320x180 for pure timing runs.
- Look at your screenshots with the Read tool (it shows images). Judge them honestly: is it clearly richer, more real, still in the drawn style, with nothing broken, floating, z-fighting or blocking paths?

DELIVERABLES
1. BEFORE shots: first, in your untouched worktree, take the shots that best show your aspect. Save them under ${G}/shots/<key>/before_*.png.
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
    owns: ['scribble-city/v5/js/world/kits.js', 'scribble-city/v5/js/world/deco.js', 'scribble-city/v5/js/world/hotels.js'],
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
- Keep vertex growth per block reasonable (measure a block's verts before/after via the mainland live objects or renderer info; aim under +40%) and keep everything merged.`,
  },
  {
    key: 'pedestrians',
    title: 'Intelligent pedestrians and street behaviour',
    owns: ['scribble-city/v5/js/game/civilians.js', 'scribble-city/v5/js/game/crowds.js', 'scribble-city/v5/js/game/reactions.js', 'scribble-city/v5/js/game/routines.js', 'scribble-city/v5/js/game/ambient.js', 'scribble-city/v5/js/game/voices.js'],
    goal: `People must feel intelligent and alive like GTA IV pedestrians. Behaviours (check what exists first, extend and polish rather than duplicate):
- groups of 2–4 standing and talking with hand gestures and turn-taking speech bubbles (in English);
- acquaintances meeting and greeting (wave, stop, chat, part);
- phone calls with pacing and gestures;
- people noticing the player close by: glance, step aside; complain when bumped or when the player runs into them; react to the player standing in their way;
- people eating lunch on benches and ledges at midday;
- tourists taking photos of things;
- street performers (a musician with an open case, a small crowd, coins tossed);
- people waiting properly at crossings and crossing together;
- people with shopping bags walking home;
- elderly slower, joggers;
- rain/umbrellas (exists);
- evening crowds.
- Keep CPU in check: measure per-update cost of civilians with ${G}/example_perf.json style timing before/after, and keep the increase small (target < +20%), using distance gating like steer() does.`,
  },
  {
    key: 'traffic',
    title: 'Living traffic',
    owns: ['scribble-city/v5/js/game/traffic.js', 'scribble-city/v5/js/game/vehicles.js', 'scribble-city/v5/js/game/fleet.js', 'scribble-city/v5/js/game/workers.js'],
    goal: `Streets need GTA IV-like traffic life, especially on the mainland:
- City buses must actually serve the mainland bus stops: blocks have bctx.busStops; game/routines.js gives waiting people places and boards them when a bus with car.bus, car.dwell, car.lastStop stops (read routines.buses()). Register mainland stops with traffic as blocks attach/detach (a minimal hook in world/mainland/blocks.js or routines is allowed if needed; list it).
- Taxis that pull over to pick up and drop off pedestrians.
- Delivery trucks/vans double-parked with hazard lights while a worker carries boxes into a shop and back.
- Parked cars along mainland curbs where it makes sense (check what exists).
- Cars braking and waiting for pedestrians at crossings, honking in jams.
- Occasional police patrol cruising, garbage truck in the morning.
- Measure traffic CPU per update before/after (example_perf.json) and keep it modest.`,
  },
  {
    key: 'streets',
    title: 'Road and sidewalk detail',
    owns: ['scribble-city/v5/js/world/mainland/tiles.js', 'scribble-city/v5/js/world/mainland/sidewalks.js', 'scribble-city/v5/js/world/mainland/ground.js'],
    goal: `Make the mainland streets as detailed as GTA IV's:
- On the asphalt: manhole covers, storm drains at curbs, patches and cracks, lane arrows, stop lines, crosswalk stripes where missing, bike lanes on some avenues, parking bay ticks and loading zones, painted curbs (red/yellow).
- At corners:
  - pedestrian crossing signals (walk / don't-walk boxes on poles, visuals only unless you can read the existing signal state cheaply);
  - green street-name signs with the real avenue/street names from plan.js (M_AVES/M_STREETS name/sign fields);
  - curb ramps, bollards.
- On sidewalks: tree grates, utility boxes, newspaper litter here and there, scuffed joints, some planted strips in residential districts, utility poles with wires in residential districts.
- Tiles are streamed: keep vertex/draw-call growth controlled and measure it.`,
  },
  {
    key: 'trees',
    title: 'Trees and greenery that look organic up close',
    owns: ['scribble-city/v5/js/world/streetscape.js', 'scribble-city/v5/js/world/palms.js'],
    goal: `Street shade trees currently look faceted / low-poly ("Lego") up close: big flat-faced icosahedron clumps.
- Investigate why. The leaf pen kind uses UV-based hatching (render/glsl.js strokeCoords: kind 7 leaf uses vUv*uUvScale), so the UVs of IcosahedronGeometry clumps and the noise displacement matter.
- Make crowns read as organic masses of leaves: smoother silhouettes, leafy fringe, layered clumps, varied species shapes, dappled colour. Make palms richer (fronds, coconuts, trunk rings).
- Prefer geometry/UV/normal changes in your files. Do NOT change shaders unless the change is strictly limited to the leaf kind, and you show before/after of other surfaces unchanged.
- Trees are many: measure vertices (renderer info or batch counts) before/after on a mainland avenue and keep growth reasonable; use detail only where seen near (tiles near the player) if a cheap switch exists.`,
  },
  {
    key: 'venues',
    title: 'Restaurants, bars, nightlife, mall hall',
    owns: ['scribble-city/v5/js/world/mainland/furnish.js (NOT the home functions near the end)', 'scribble-city/v5/js/world/mainland/mall.js', 'scribble-city/v5/js/world/mainland/venues.js', 'scribble-city/v5/js/game/streetlife.js', 'scribble-city/v5/js/game/mall.js', 'scribble-city/v5/js/game/nightlife.js', 'NEW scribble-city/v5/js/world/venues2.js'],
    goal: `Sit-down places and the mall must reach real-life detail.
- Write stock plans (lazy, like world/shops2.js and homes2.js; register via FURNISH in a NEW file world/venues2.js imported next to shops2.js in world/city.js and world/mainland/blocks.js) for:
  - 'gourmet' restaurants: tablecloths, full table settings, wine glasses, candles, bread baskets, a host stand, a bar with a lit bottle wall, an open kitchen pass;
  - 'bar';
  - 'club' (check what exists in venues.js);
  - 'cinema' and 'theatre' lobbies: concession stand with popcorn machine, posters, ropes.
- Behaviour (game/streetlife.js):
  - waiters taking orders at tables, bringing plates and clearing them;
  - diners eating with fork motion and talking;
  - a host seating newcomers;
  - check what exists and improve it.
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
- Add shop WINDOW DISPLAYS to the existing plans: the front zone (FRONT_KEEP) is mostly empty. Add product pyramids, mannequins, price cards, SALE posters, so shops look full from the street.
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
- Keep it merged and measure vertex growth. Distant blocks use mainland/far.js baked bodies, which you should not need to touch.`,
  },
  {
    key: 'homes',
    title: 'Homes that look lived in, by who lives there',
    owns: ['scribble-city/v5/js/world/homes2.js', 'scribble-city/v5/js/world/home.js'],
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

const REPORT = {
  type: 'object',
  properties: {
    aspect: { type: 'string' },
    worktree: { type: 'string', description: 'absolute path of the worktree' },
    branch: { type: 'string' },
    commits: { type: 'array', items: { type: 'string' } },
    files_changed: { type: 'array', items: { type: 'string' } },
    outside_edits: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string', description: 'English: concretely what changed' },
    images: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, caption_he: { type: 'string' } }, required: ['path', 'caption_he'] } },
    tests: { type: 'array', items: { type: 'string' } },
    perf: { type: 'string' },
    known_issues: { type: 'array', items: { type: 'string' } },
  },
  required: ['aspect', 'worktree', 'branch', 'commits', 'files_changed', 'summary', 'images', 'tests', 'perf', 'known_issues'],
}

const REVIEW = {
  type: 'object',
  properties: {
    aspect: { type: 'string' },
    issues: { type: 'array', items: { type: 'object', properties: { issue: { type: 'string' }, severity: { type: 'string' }, fixed: { type: 'boolean' } }, required: ['issue', 'severity', 'fixed'] } },
    commits: { type: 'array', items: { type: 'string' } },
    tests: { type: 'array', items: { type: 'string' } },
    images: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, caption_he: { type: 'string' } }, required: ['path', 'caption_he'] } },
    verdict: { type: 'string', description: 'ready | needs-work' },
    notes: { type: 'string' },
  },
  required: ['aspect', 'issues', 'commits', 'tests', 'verdict', 'notes'],
}

const buildPrompt = (a) => `${PREAMBLE}

YOUR ASPECT: ${a.title} (key: ${a.key})
Branch: gta4/${a.key}. Shots folder: ${G}/shots/${a.key}/. Images for the user: ${G}/send/${a.key}_<n>.jpg.
Files you own:
${a.owns.map((f) => '  - ' + f).join('\n')}

GOAL
${a.goal}

Start by reading the relevant code thoroughly, then take BEFORE shots, then build. Iterate with the browser until the AFTER shots are clearly, visibly better and nothing is broken (no [pageerror] in logs). Commit, compose the before/after images, and return the report.${PARTIAL.includes(a.key) ? `

RESUMING: an earlier builder of this aspect was stopped mid-way. Its work is on branch gta4/${a.key} (restored from ${WIP}/gta4-round2.bundle).
1. Do NOT create the branch again. In your own worktree run \`git checkout gta4/${a.key}\`; the worktree's own auto-created branch can be left alone.
2. Read what is already there (git log/diff ${BASE}..HEAD). The last commit is a "stopped on request" snapshot and may be half-finished: make it build and run before adding more.
3. BEFORE shots: take them from a detached checkout of ${BASE} in your scratch area (\`git worktree add --detach <dir> ${BASE}\`, remove it when done).
4. Continue and finish the work, adding new commits on top. Never rewrite history.` : ''}`

const reviewPrompt = (a, r) => `${PREAMBLE}

YOU ARE THE ADVERSARIAL REVIEWER AND FIXER for the aspect "${a.title}" (key: ${a.key}).
The builder's report:
${r && r.report_file ? 'read it with the Read tool: ' + r.report_file + ' (its shot and image paths point to an older scratch folder that may be gone: re-take shots with the same intent if you need them; small copies of its before/after images are in ' + WIP + '/images/)' : JSON.stringify(r, null, 1)}

Work INSIDE the builder's worktree: cd ${r && r.worktree ? r.worktree : '(missing: find the worktree that has branch gta4/' + a.key + ' with `git worktree list` from /home/user/Test-1-)'}.
- Stay on branch gta4/${a.key}. Do not create another worktree.
- Review everything the branch changed: git diff ${BASE}..HEAD and git log ${BASE}..HEAD.
- Look at the builder's shots and images with the Read tool.

Try hard to find REAL problems:
- runtime errors (undefined names, wrong imports, exceptions in hot paths, null cases such as touch mode, night, rain, the island ?island=1, a block detaching mid-action);
- performance regressions (allocations per frame, per-frame loops over all shops/people, vertex explosions, missing distance gating);
- geometry that floats, intersects, z-fights or blocks doorways and paths;
- behaviour that can get stuck or leak people/objects when blocks stream out;
- lazy-stock rng-order mismatches between passes;
- ownership violations;
- content rules (names, modesty, language);
- anything that looks worse or still looks like boxes.

Then:
1. Fix what is real and worth fixing.
2. Re-run a focused browser test through the lock wrapper: no [pageerror], the look confirmed.
3. If your fixes change the look, refresh the after shots and the composed images in ${G}/send/${a.key}_*.jpg.
4. Commit on the same branch (with the two trailer lines).
5. Report verdict "ready" only if the branch is safe to merge.`

phase('Build')
const results = await pipeline(
  ASPECTS,
  (a) => BUILT.includes(a.key)
    ? Promise.resolve({ aspect: a.key, branch: 'gta4/' + a.key, worktree: null, report_file: WIP + '/reports/' + a.key + '.json' })
    : agent(buildPrompt(a), { label: `build:${a.key}`, phase: 'Build', isolation: 'worktree', schema: REPORT }),
  (r, a) => agent(reviewPrompt(a, r), { label: `review:${a.key}`, phase: 'Review', schema: REVIEW }).then((v) => ({ build: r, review: v })),
)
return results.map((x, i) => ({ key: ASPECTS[i].key, ...(x || { build: null, review: null }) }))
