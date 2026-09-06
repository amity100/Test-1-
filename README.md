# FLAGKEEP

**Build. Hide. Storm.** A 3D web shooter where every player first builds a fortress from a budget of
blocks, hides a flag inside it, and then the match rotates a spotlight over each fortress: its owner
defends while everyone else storms in, fights each other, and tries to stand on the flag for three
seconds.

Runs entirely in the browser (WebGL 2). No accounts, no downloads, no external assets: every texture,
model and sound is generated procedurally at load time.

## Play

- `npm install`
- `npm run dev` then open http://localhost:5173

Production build: `npm run build` (static site in `dist/`, deployable to any static host such as
GitHub Pages). Single-file build for artifact hosting: `npm run build:artifact` (writes
`artifact/flagkeep.html`).

## How a match works

1. **Build phase** (3, 5, 8 minutes or unlimited). Place blocks, box-fill, stamp 30 prefabs
   (walls, curved walls, hedges, towers, watchtowers, spires, gates, arches, stairs, ramps, bridges,
   balconies, roofs, domes, houses, keeps, pillar halls, gazebos, tunnels, mazes, fountains,
   pyramids), paint, mirror, undo/redo, or start from one of six fortress templates. Six style
   palettes: Candy, Gothic, Modern, Medieval, Neon Cyber, Desert Adobe. Save and load blueprints.
   You also choose exactly where you stand when defending (spawn tool).
2. **Hide the flag.** The flag must remain reachable: a flood fill from outside the plot (walking,
   jumping, mantling, dropping, or grappling onto exposed ledges) has to reach it. Fully sealed
   rooms are rejected.
3. **Rounds** (4 minutes each, one per fortress). The owner waits inside at their chosen spawn;
   every attacker starts at their own fortress and runs across the island (an objective marker
   points the way). Attackers fight each other too. Standing three seconds next to the flag
   captures it and ends the round. When time runs out the defender earns a hold bonus.
4. **Scoring**: 1 point per 10 s of defense, 40 for holding to the end, 50 per capture, 5 per kill
   (8 as the defender). The podium sorts by total score.

## Controls

WASD move · Space jump · Shift sprint · C crouch/slide · Mouse aim and fire · Right mouse aim down
sights · 1-3 / wheel weapons · R reload · G grenade · Q / F gadgets · Tab scoreboard · Esc pause.
Mouse look uses pointer lock with raw, uncapped deltas, so a fast flick turns all the way; if the
page cannot lock the pointer, the outer band of the window keeps turning the view.

**Gadget kit.** Before every round you pick a primary weapon and two of five gadgets (the choice is
remembered): a **zipline** cable that anyone can ride both ways, a **jump pad** that launches whoever
steps on it, a sticky **breach charge** that blows a hole through fortress walls, a **swing hook**
(real pendulum rope: hold to reel in, let go to fly, jump at the top to vault the ledge) and the
**burrow drill** that tunnels under the ground, surfaces inside the fortress and drills through
blocks while you hold the button. Bots carry random kits too.

**Building, Townscaper style.** The build phase is a plan of room blocks on a 5 m grid: tap the ground
to grow a room, tap a wall or a roof to add one beside or on top of it, hold (or right-click) to take
one away, and pick one of eight tones for the next block. The **Architect** turns that coarse plan
into finished, playable architecture after every tap: exterior walls with slits, windows or curtain
glass, gates and doors on the ground floor (always at least two entrances, facing the attackers),
doorways between rooms of different tones (same-tone rooms merge into halls with cover crates),
stairs between storeys with stairwell holes, roof terraces with crenels or railings and roof
access, pitched roofs for the roof tone, balconies on the front, arcades under overhanging rooms,
string courses, quoins and lamps, all in the match style. Every room is guaranteed reachable, so
whatever you build is an arena. The flag goes into any room with a tap; a "surprise castle" button
generates a full fortress you can then edit, and the opponents' fortresses come from the same
generator (keeps, citadels, palaces, bastions, temples and spires). One finger orbits and two
fingers pan and zoom on a phone; the mouse drags to orbit, the wheel zooms, `1-8` pick tones, `X`
toggles the eraser, `G` the flag, `Z` undoes. At match end a shareable fortress card renders your
build, and every round opens with a short camera flyby.

**Phones and tablets** get a layout modelled on today's popular mobile shooters: a movement stick on
the left (push far to sprint), look by dragging anywhere on the right, twin fire buttons, and only
the essentials as buttons (jump, crouch, aim, reload, swap, grenade and the two gadget slots in a
compact cluster). Auto fire and aim assist are on by default for touch and can be tuned in Settings
together with button size and opacity. Building on a phone is the same tap-a-block flow with the
palette along the bottom. Landscape is recommended.

**Bots** notice you the way people do (slower in the periphery, at range or when you stand still,
instantly when you shoot), their first shots start off target and settle, their aim trails your
movement, they flinch and break for cover under fire, reload out of sight and fire in bursts.

## Tech

TypeScript, Vite, three.js, pmndrs/postprocessing, N8AO. Custom voxel engine (chunked storage,
greedy meshing with baked vertex AO, six block shapes with shape-aware collision, DataArrayTexture
PBR materials with per-block variation and bevelled edges), heightmap island with a detail-mapped
ground, paths, a central monument and ruins, distant horizon islands, height fog, colour
grading/sharpen pass, procedural Web Audio.

All models are generated at load time from parametric parts merged per material: skinned operators
(plate carrier, pouches, pads, boots, camouflage and team-tinted armour with emissive accents) on a
seven-bone skeleton, dressed by an outfit layer driven by the gadget kit: five head types (wraparound
tech visor, classic visor, dark full-face plate with slanted lenses, hood with a HUD monocle, goggles
with a respirator), gadget gear (line launcher and cable coil, exo leg braces with an energy cell,
heavy plates with chest charges and a demo satchel, forearm hookshot with a rope coil, drill gauntlet
with a shovel) and six camo palettes with small flair so no two operators look alike; weapons with receivers, rails, optics, magazines,
stocks, muzzle devices and lights, plus gloved first-person hands that wrap the grips; trees with
lathe trunks, tapered branches and leaf-card canopies, ragged conifers, bushes, noise-displaced
mossy boulders and flower cards, all instanced. Procedural PBR tiles (fabric, camo, armour,
gunmetal, polymer, wood, bark, rock, soil) supply albedo, normal and roughness maps.

Bots navigate the whole island: a fine voxel grid around each fortress stitched to a coarse terrain
grid, with hearing, damage reaction, cover, peeking and defender repositioning.

Quality tiers (low/medium/high/ultra) are picked from the GPU and can be forced with
`?debug=low|medium|high|ultra`.

## Tests

`node scripts/smoke.mjs <url>`, `node scripts/smoke-game.mjs <url>`, `node scripts/smoke-nav.mjs <url>`
(spawns and cross-island navigation), `node scripts/smoke-build-mouse.mjs <url>` (mouse building and
firing) and `node scripts/smoke-mobile.mjs <url>` (touch emulation) drive the game in headless
Chromium (Playwright) and save screenshots. Test against `npm run build && npm run preview` so dev
server reloads do not interrupt the runs.
