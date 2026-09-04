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
sights · 1-3 / wheel weapons · R reload · G grenade · Q grapple hook · Tab scoreboard · Esc pause.

Build mode: left click place, right click remove, R rotate prefab, wheel prefab size, WASD move the
camera, Q/E down/up, right-drag look, Tab prefab browser.

**Phones and tablets** get on-screen controls: a movement stick on the left, look by dragging on the
right, tap to fire, and dedicated buttons for jump, crouch, aim, reload, grenade, grapple and weapon
swap. In the build phase: tap to place, long-press to remove, drag to orbit, pinch to zoom, two-finger
drag to pan, and a bottom sheet with tools, materials, prefabs and templates. Landscape is
recommended.

## Tech

TypeScript, Vite, three.js, pmndrs/postprocessing, N8AO. Custom voxel engine (chunked storage,
greedy meshing with baked vertex AO, DataArrayTexture PBR materials with per-block variation and
bevelled edges), heightmap island with paths, a central monument and ruins, distant horizon islands,
height fog, colour grading/sharpen pass, procedural Web Audio. Bots navigate the whole island: a
fine voxel grid around each fortress stitched to a coarse terrain grid, with hearing, damage
reaction, cover, peeking and defender repositioning.

Quality tiers (low/medium/high/ultra) are picked from the GPU and can be forced with
`?debug=low|medium|high|ultra`.

## Tests

`node scripts/smoke.mjs <url>`, `node scripts/smoke-game.mjs <url>`, `node scripts/smoke-nav.mjs <url>`
(spawns and cross-island navigation), `node scripts/smoke-build-mouse.mjs <url>` (mouse building and
firing) and `node scripts/smoke-mobile.mjs <url>` (touch emulation) drive the game in headless
Chromium (Playwright) and save screenshots. Test against `npm run build && npm run preview` so dev
server reloads do not interrupt the runs.
