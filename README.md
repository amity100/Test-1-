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
   Touching the flag trips the **alarm**: a siren, the fortress zone and flag beat red, and
   everyone else gets a marker on the capturer through the walls (attacker bots also learn where
   the flag is from the siren). If the clock runs out mid-capture the round goes into
   **overtime**: no respawns until the flag falls or the capturer is cleared (25 s at most).
4. **Scoring**: 1 point per 10 s of defense, 40 for holding to the end, 15 for every full minute
   the flag stays safe, 50 per capture, 5 per kill (8 as the defender). The podium sorts by total
   score. Whoever is last always sees where the leader is. **Kill streaks** pay out for everyone,
   bots included: three kills in a row give an armour plate (soaks 50 damage before health), five a
   radar pulse (enemies through walls for four seconds), seven overdrive (faster movement and
   reloads for ten seconds); dying resets the streak.

## Controls

WASD move · Space jump · Shift sprint · C crouch/slide · Mouse aim and fire · Right mouse aim down
sights · 1-3 / wheel weapons · R reload · G grenade · Q / F gadgets · Tab scoreboard · Esc pause.
Stairs, slabs and one-metre ledges are climbed by simply walking into them. Aim assist (on by
default, off in Settings) slows the view over an enemy, follows one near the crosshair, snaps onto
the nearest enemy when the sights come up and forgives near misses a little; on touch it also fires
for you.
Mouse look uses pointer lock with raw, uncapped deltas, so a fast flick turns all the way; if the
page cannot lock the pointer, the outer band of the window keeps turning the view.

**Gadget kit.** Before every round you pick a primary weapon and two of five gadgets (the choice is
remembered): a **zipline** cable that anyone can ride both ways, a **jump pad** that launches whoever
steps on it, a sticky **breach charge** that blows a hole through fortress walls, a **swing hook**
(real pendulum rope: hold to reel in, let go to fly, jump at the top to vault the ledge) and the
**burrow drill** that tunnels under the ground, surfaces inside the fortress and drills through
blocks while you hold the button. Bots carry random kits too.

**Building.** The build phase is a plan of room blocks on an 8 m grid (six-metre interiors, wide
enough to fight in; same-tone neighbours merge into bigger halls): tap the ground to grow a room,
tap a wall or a roof to add one beside or on top of it, hold (or right-click) to take one away, and
pick one of eight tones for the next block. The **Architect** turns that coarse plan into finished,
playable architecture after every tap: exterior walls with slits, climb-in windows (two rows tall
on the ground floor: a jump and a mantle gets you in, so every room has flanks) or curtain glass,
gates and doors on the ground floor (always at least two entrances, facing the attackers), doorways
between rooms of different tones flanked by chest-high shooting slots (same-tone rooms merge into
halls), a **drop hole** in the ceiling of every stacked room so upper floors have a quick way
down, interior **cover** (a diagonal pair of columns in wide halls, a knee-high wall or crates in
smaller rooms, never on stairs or in front of openings), stairs
between storeys with stairwell holes, roof terraces with crenels or railings and roof access,
pitched roofs with chimneys for the roof tone, balconies on the front, arcades under overhanging
rooms, string courses, quoins and lamps, all in the match style. Configurations unlock more: two
rooms of the same tone facing each other across a gap get a **bridge** with railings and arches
underneath; a room beside a lower roof opens a **terrace door** onto it; a ground cell enclosed on
three or four sides becomes a **courtyard** with paving, a fountain or pylon, lamp posts and doors;
the dark tone builds open **colonnades** and loggias; a two-storey facade on the approach side earns
a broad **outdoor stair** to a first-floor door; free-standing towers get **crowns** (machicolations
and merlons, or an antenna with a beacon). Every floor, terrace and bridge is guaranteed walkable
from the ground (stairs are planned so no stair ever blocks another, and a block that holds up rooms
above it cannot be erased), so whatever you build is an arena you can climb without gadgets. The flag
goes into any room with a tap; a "surprise castle" button generates a full fortress you can then
edit, and the opponents' fortresses come from the same generator (keeps, citadels, palaces,
bastions, temples and spires, now with bridges, cloisters, courtyards and hypostyle halls). One
finger orbits and two fingers pan and zoom on a phone; the mouse drags to orbit, the wheel zooms,
`1-8` pick tones, `X` toggles the eraser, `G` the flag, `Z` undoes. At match end a shareable fortress
card renders your build, and every round opens with a short camera flyby.

**Phones and tablets** get a layout modelled on today's popular mobile shooters: a movement stick on
the left (push far to sprint), look by dragging anywhere on the right, twin fire buttons, and only
the essentials as buttons (jump, crouch, aim, reload, swap, grenade and the two gadget slots in a
compact cluster). Auto fire and aim assist are on by default for touch and can be tuned in Settings
together with button size and opacity. Building on a phone is the same tap-a-block flow with the
palette along the bottom. Landscape is recommended.

**Bots** notice you the way people do: awareness builds up over a second or more depending on
where you are in their field of view, how far and how exposed you are (head, chest and knees are
checked separately), whether you stand still, walk or sprint, and how attentive the bot happens to
be right now (its attention drifts every few seconds), so a still figure half hidden at the edge of
vision can go unseen while someone sprinting across the middle of the view, or firing, registers
almost at once. Their first shots start off target and settle, their aim trails your movement, they
flinch and break for cover under fire, reload out of sight and fire in bursts.

**The flag hall.** The room you plant the flag in becomes the **hero hall**: the flag stands on a
podium with a ring of steps in the middle of its hall, four columns around it, and when every cell
of the hall has a room above, that upper floor opens into a **gallery ring** around a double-height
centre, railed except where the stairs arrive, so the last fight is fought from the podium, the
gallery and the drops between them. Bot fortresses pick a covered hall for their flag the same
way. Indoors is darker than outdoors (roofed cells get less sky light, baked per vertex) and lamp
blocks throw warm pools onto nearby walls, so doorways and lit rooms read from a distance.

**Traps.** The build phase also gives five trap slots (T, or the trap tool): **spikes** and a
**trapdoor** (upper floors only, drops the intruder into the room below) hide in the floor until
someone steps on them, a **mine** waits by a doorway, a **turret** (two slots) tracks and fires at
anyone in its room, and a **gate** spans a doorway and lets only its builder through until it is
shot open. Attackers see turrets and gates but not the hidden kinds until they fire; the builder
sees everything and never triggers their own traps; trap kills count for the defender. Bot
fortresses come with traps too, and bots shoot gates that bar their way. Everything re-arms at the
start of each round.

**Round events.** About once a minute, announced with a three-second countdown, the round throws
a surprise: a **blackout** (roofed rooms go dark and the lamps die for twelve seconds; bots see
worse too), a **wall breach** (a 3x3 piece of the contested fortress's outer wall comes down, a new
way in until the round ends), a **supply drop** (a crate of armour, grenades and ammo falls onto a
roof of the fortress, first come first served) or **fog** (a short view for eighteen seconds). Never
in the last stretch of a round or during overtime.

**Close quarters.** A knife (V, or the knife button on touch) lunges forward and cuts for 60, or a
lot more from behind (bots draw it too when you get too close). Glass shatters: bullets and blasts
break panes, and a sprinting body crashes straight through a window. Weapon swaps are near instant.

**Combat feedback.** Floating damage numbers at the hit point (gold for headshots, red for kills),
a red arc around the crosshair pointing at whoever just hit you, a crosshair that turns red on a
living enemy, name markers over enemies who shot you recently or stand close in plain sight, a
warning over live grenades near you, a short spawn shield after respawning, faster health
regeneration, and auto sprint (a moment of forward movement breaks into a run; aiming or crouching
walks again) that can be switched off in Settings. Kills land with a hit-stop and a camera shake,
a multi-kill announcer with stingers (double, triple, quad, rampage), slow motion when a kill stops
a capture ("capture denied"), a streak counter and armour bar on the HUD, and a death cam that
first turns to whoever got you and names them with the distance before orbiting your body.

## Tech

TypeScript, Vite, three.js, pmndrs/postprocessing, N8AO. Custom voxel engine (chunked storage,
greedy meshing with baked vertex AO, 16 m chunks concatenated into 64 m region meshes so a fortress
is two draw calls, six block shapes with shape-aware collision, DataArrayTexture PBR materials with
per-block variation and bevelled edges), frustum-culled grass tiles and skinned characters, baked
horizon and flag metalwork, shadow maps that refresh every other frame when a device drops below
50 fps, heightmap island with a detail-mapped
ground, paths, a central monument and ruins, distant horizon islands, height fog, colour
grading/sharpen pass, procedural Web Audio. On phone GPUs the automatic tier leaves screen-space AO
off (the baked vertex occlusion stays), frame buffers drop to 8-bit when the GPU cannot render to
half floats, and a shader that fails to compile drops the fragile passes instead of drawing
garbage; `?debug=info` shows the GPU readout and `?debug=noao`, `nopost`, `byte` isolate passes.

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
