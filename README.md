# FLAGKEEP

**Build up. Hold the sky.** A 3D web shooter about building into the sky. In **Sky Flag** (the
default) twelve players share one island, everyone for themselves. A golden flag drifts down from
the clouds toward whoever stands highest; you get there by throwing up marble combat arenas in real
time (ramps, decks, bridges, parapets and round arenas) from the bricks in your hand. Bricks trickle
in slowly and pour out of anyone you kill. The highest player wears a crown and a beam of light that
everyone can see, and is worth a bounty of bricks. Past the halfway point a tsunami rises from
below and swallows the island floor; the moment the flag is first taken it rises three times as
fast. Hold the flag for twenty seconds and the match is yours; otherwise, when time or the water
runs out, the last one standing highest wins. The eleven others are bots that build switchback
towers, hunt the leader, dive for dropped bricks and flee the water.

**Fortress War** (two teams, a stronghold each, three capture points, tickets) and the classic
**rotation** (everyone builds a fortress, then each one is stormed in turn) are still there in the
setup screen.

Runs entirely in the browser (WebGL 2). No accounts, no downloads, no external assets: every texture,
model and sound is generated procedurally at load time.

## Play

- `npm install`
- `npm run dev` then open http://localhost:5173

Production build: `npm run build` (static site in `dist/`, deployable to any static host such as
GitHub Pages). Single-file build for artifact hosting: `npm run build:artifact` (writes
`artifact/flagkeep.html`).

## How a match works

### Sky Flag

1. **Twelve on one island, twelve minutes.** Everyone spawns spread around the shore with
   twenty-four bricks. One brick trickles in every three seconds (up to 60 in hand); a kill drops most of the
   victim's bricks (at least six) as a cluster that hovers over the spot for ten seconds and then
   plunges, and whoever walks through it takes them. The marked leader drops a bounty of twelve
   more.
2. **Building, with the weapon never leaving your hands.** Hold `B` (BUILD on a phone) and a path
   grows where you walk: look up and the next piece is a **stair** (3 bricks: six wide between
   stringer walls with a glowing handrail, six metres up to its own landing), look ahead and it is a
   **terrace** (2: eight metres of floor behind glass balustrades and posts of light). A press lays
   one piece where your path ends; held down it keeps laying them as you climb, so a road climbs
   into the sky under your feet. Turn and the path turns with you. `X` cycles the set pieces and
   shows their ghost until `B` places one: a **hall** (4: a glass-walled storey with a portal and a
   stair up to its own roof terrace), a **bridge** (2 per cell: a glass-railed span that reaches
   until it meets something, up to three cells) and a **stadium** (10: a round bowl twenty-three
   metres across with four gates, light masts and a lit dais). `R` turns a piece, `C` picks your
   **finish** — Aurora (ivory, graphite, gold), Obsidian (charcoal, silver, smoked glass) or Ember
   (sand, bronze, copper); the bots take turns through all three, so a shared citadel has the
   patchwork of a real skyline. Your colour is only ever light: the posts on the balustrades, the
   handrails, the strip over your portals, the crystal in your keels.

   Nothing has to be lined up by hand. An architect dresses every cell and its neighbours: floors
   get a rim and a fascia where they face out, edges that face out get balustrades, cells that touch
   merge into one hall with a portal instead of a wall, a floor with a hall under it gets a
   stairwell, a terrace on top of a stack gets a light mast, and everything hanging in the air
   grows four pylons down to the hill or a stepped keel with a crystal glowing under it. Every pane
   of glass can be shot out or run through. A green ghost of the real masonry shows where a piece
   will land; amber means you cannot afford it, red that something is already there.
3. **The sky islands.** Eight neutral plazas hang over the island from the first second: four
   thirty-six metres up over the shores, three sixty metres up closer in, and the summit
   eighty-four metres up in the middle, under the flag's approach. Each is a three-by-three
   terrace with a hall in the corner nearest the middle of the map and a cache of ten bricks in
   the centre that comes back thirty seconds after it is taken. The way up runs through them and so
   does everyone else's, which is where the fights are; a gold marker points to the next one up.
   Respawns land on decks halfway up the pack, islands included.
4. **The flag** starts 180 m up and descends at 0.2 m/s, drifting sideways toward the marked
   leader (or the island centre). Standing within three metres of it takes it; the holder must
   survive twenty seconds. Killing the holder drops the flag right there. The **marked** player is
   whoever stands highest, at least six metres above the ground and four metres above the next;
   they carry a crown and an eighty-metre beam.
5. **The sea** starts rising at 5:30 (0.12 m/s) and three times faster after the first grab; being
   under it drowns you in about two and a half seconds. Falls hurt from 15 m/s and kill from 44 m/s
   of landing speed. Whoever dies respawns after five seconds on a free deck halfway up the pack
   (or the shore); once nothing dry is left, they are out. A grab held for twenty seconds, the water
   reaching the flag, time running out, or one player left ends the match; the winner is the holder,
   else the highest.
6. **Scoring**: 5 per kill, 1 per brick collected, 2 per five metres of peak altitude, 3 per second
   of holding the flag, 150 for the win. The podium sorts by win, then score, kills and peak height.

### Fortress War

1. **Team build** (90 s, 3 or 5 minutes, or unlimited). Your team's plot is split into four
   quarters and every bot lays the stronghold plan for its quarter, one room every couple of
   seconds, so the castle rises around whatever you place yourself. Twelve blocks stay reserved for
   you for the first minute. The **ping** tool marks a column ("a tower here") and the nearest
   builder does it next. Press Ready early and the crew finishes the walls at once. The stronghold
   is built to be stormed: a ring wall with one gate and one postern onto the field, corner towers,
   an inner courtyard with its own doors, arrow slits instead of climbable windows, no outdoor
   stairs or balconies, merlons on every parapet and a five-storey keep with the flag hall at the
   top. The enemy team gets a stronghold of its own, and the empty plots carry ruins for cover.
2. **Trap walk.** You appear inside the fortress with four personal trap slots; each bot sets two
   traps in its own quarter at the same time. Traps hurt only the other team.
3. **War** (12 minutes). 150 tickets a side. A kill costs one ticket. Three capture points across
   the middle of the island (A by the west road, B at the monument, C by the east road): ten seconds
   alone on a point takes it, and every five seconds the side holding fewer points loses a ticket
   per point of difference. Looting the enemy flag (eight seconds in their flag hall with no
   defender there) costs them forty tickets and drops the flag for twenty seconds. First side out of
   tickets loses; at the bell the higher pool wins. When you die you choose where to respawn: the
   fortress or any point your team holds (keys 1-4, or tap).
4. **Supplies and repair.** Kills and held points earn supplies. Breach charges blow real holes in
   the walls; standing by a hole in your own fortress for a few seconds puts the blocks back for
   five supplies, and defender bots do the same on their own.
5. **The team AI.** Each side has a commander that hands out tasks every second and a half: a
   garrison at the flag posts and doorways (bigger under alarm, nearly everyone when the flag has
   just been looted, and the whole team respawns at the flag posts while it is down), squads of
   three on the points, and always one squad on the assault, rallying outside the enemy walls and
   going in together. Bots share sightings, remember every trap they have seen and route around it,
   blow a wall when the way to the flag is barred, hold angles at their posts and escort you when
   you push out. Team results, tickets and the MVP close the match.

### Classic rotation

1. **Build phase** (3, 5, 8 minutes or unlimited). Place blocks, box-fill, stamp 30 prefabs
   (walls, curved walls, hedges, towers, watchtowers, spires, gates, arches, stairs, ramps, bridges,
   balconies, roofs, domes, houses, keeps, pillar halls, gazebos, tunnels, mazes, fountains,
   pyramids), paint, mirror, undo/redo, or start from one of six fortress templates. Six style
   palettes: Candy, Gothic, Modern, Medieval, Neon Cyber, Desert Adobe. Save and load blueprints.
   You also choose exactly where you stand when defending (spawn tool).
2. **Hide the flag.** The flag must remain reachable: a flood fill from outside the plot (walking,
   jumping, mantling, dropping, or grappling onto exposed ledges) has to reach it. Fully sealed
   rooms are rejected.
3. **Trap walk** (75 s, or unlimited when the build was). Press Ready and you appear inside your
   finished fortress in first person. Walk to the spots attackers must pass, aim at the floor and
   set a trap (click, or the PLACE button on a phone); aim at one of yours to take it back. An
   on-screen card explains the walk, a picker along the bottom shows the ten trap kinds with what
   each does, and a label under the crosshair says what a press would do right now.
4. **Rounds** (4 minutes each, one per fortress). The owner waits inside at their chosen spawn;
   every attacker starts at their own fortress and runs across the island (an objective marker
   points the way). Attackers fight each other too. Standing three seconds next to the flag
   captures it and ends the round. When time runs out the defender earns a hold bonus.
   Touching the flag trips the **alarm**: a siren, the fortress zone and flag beat red, and
   everyone else gets a marker on the capturer through the walls (attacker bots also learn where
   the flag is from the siren). If the clock runs out mid-capture the round goes into
   **overtime**: no respawns until the flag falls or the capturer is cleared (25 s at most).
5. **Scoring**: 1 point per 10 s of defense, 40 for holding to the end, 15 for every full minute
   the flag stays safe, 50 per capture, 5 per kill (8 as the defender). The podium sorts by total
   score. Whoever is last always sees where the leader is. **Kill streaks** pay out for everyone,
   bots included: three kills in a row give an armour plate (soaks 50 damage before health), five a
   radar pulse (enemies through walls for four seconds), seven overdrive (faster movement and
   reloads for ten seconds); dying resets the streak.

## Controls

WASD move · Space jump · Shift sprint · C crouch/slide · Mouse aim and fire · Right mouse aim down
sights · 1-3 / wheel weapons · R reload · G grenade · Q / F gadgets · Tab scoreboard · Esc pause.
Sky Flag: hold B to build your path (look up for stairs, ahead for floor) · X set piece · R turn ·
C finish. On a phone the arc is trimmed to FIRE, JUMP, aim, reload and one BUILD button (hold it to
keep building); the piece bar appears while you build and a tap on a tile arms a set piece.
The mouse is either captured or hidden: click once to capture it, and where a browser refuses to
lock the pointer (inside an embedding frame, say) aiming still works one-to-one from raw movement,
with the outer eighth of the window turning the view so a full spin is always possible. Aiming down
the sights puts the weapon's own optic on the crosshair — the model is held still and the field of
view narrows to the weapon (47° on the rifle, 20° through the sniper's scope).
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

**Phones and tablets** get a layout modelled on today's popular mobile shooters: a floating movement
stick on the left (push far to sprint; the stick follows a thumb that drifts past its rim), look by
dragging anywhere else, and a big fire button under the right thumb with aim, jump and crouch on an
arc around it, knife and reload a little further in, grenade and the two gadgets up the edge, plus a
second fire button above the stick. A finger sliding on a held fire or aim button keeps turning the
view, so you aim while shooting. Touch look is brisk (a swipe across the screen turns about half a
circle), speeds up on fast flicks, slows while aiming down sights and is lightly smoothed against
uneven touch samples; look speed, aim speed and the flick boost are sliders in Settings. **Customize
the buttons** (Settings) opens an editor where every battle button is dragged into place and resized,
with a left-handed mirror preset; the layout is saved on the device. Auto fire and aim assist are on
by default for touch. Building on a phone is the same tap-a-block flow with the palette along the
bottom. Landscape is recommended.

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

**Traps.** Eight trap slots per fortress, set on the trap walk (and still available from the trap
tool during the build). Hidden in the floor until they fire: **spikes** (stab and slow), a **flame
vent** (a column of fire for a few seconds; whoever it touches keeps burning after they run out), a
**spring pad** (flings the intruder up and onward, and into the ceiling when there is one), a
**mine** (blast) and a **trapdoor** (upper floors only, drops them into the room below). In plain
sight and dodged with timing: a **saw rail** (two slots; a blade runs back and forth along a line of
floor, jump over it), a **swinging blade** (two slots; hangs in a doorway and swings across it, time
it or crouch under it), a **crusher** (two slots; a block under a ceiling three to five blocks up
that clicks, then slams onto whoever is beneath), a **turret** (two slots) that tracks and fires at
anyone in its room and can be shot to pieces, and a **gate** that spans a doorway and lets only its
builder through until it is shot open. Attackers see the mechanical kinds but not the hidden ones
until they fire; the builder sees everything and never triggers their own traps; trap kills count
for the defender. Bot fortresses come with a mixed roster too, and bots shoot gates that bar their
way. Everything re-arms at the start of each round.

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

Sky Flag adds a voxel world 255 blocks tall and a building system that works on a plan rather than
on stamps: a sparse grid of eight-metre cells anchored to the ground each structure started on
(`src/build/SkyPlan.ts`), an architect that turns one cell and its neighbours into finished masonry
and publishes the waypoints a walker follows through it (`src/build/SkyArchitect.ts`), and a placer
that diff-applies only the blocks that actually changed (`src/build/SkyBuild.ts`). Around it: the
rules core (`src/sim/Ascent.ts`), bots that build towers and walk the architect's own way up them
(`src/ai/AscentBrain.ts`), a rising sea with swell, deep colour and crest foam, a cloud band and
underwater murk in the height fog, and the flag, marked beam, brick clusters and placement ghosts
(`src/render/AscentMeshes.ts`).

Performance is measured, not guessed: `?debug=perf` shows the millisecond cost of each subsystem,
the GPU frame time where the driver exposes a timer query, draw calls and the render resolution.
Each character is one skinned mesh with a draw group per material and a pose level of detail (every
frame up close, every fourth past eighty metres); the scene keeps six lights rather than ten;
ambient occlusion runs at half resolution with a bilateral upsample on every tier; the colour grade
shares a pass with the rest of the post chain; god rays and bloom render at half resolution; the
high tier renders at the display's own density and the target never exceeds about three
megapixels; and a dynamic resolution scale between 0.7 and 1 judges the typical frame rather than
the average, so one hitch never costs sharpness for the rest of the match, and climbs back after a
couple of seconds at the display's own rate.

The voxel pipeline was rebuilt for a city that changes every second. A module used to remesh the
whole world synchronously the moment it landed (a median 66 ms, up to 240 ms, every time any of
twelve builders tapped); now changed chunks are remeshed within a per-frame budget of a few
milliseconds, nearest the camera first, and the 32 m regions they are batched into are rebuilt at
most two per frame. The mesher itself reads its neighbourhood straight from the chunk arrays instead
of a hash lookup per block, stamps a lamp-distance field once per chunk instead of scanning every
lamp per face, caches the geometry of shaped blocks, and appends into growable typed arrays — about
half the time per chunk.

Bots navigate the whole island: a fine voxel grid around each fortress stitched to a coarse terrain
grid, with hearing, damage reaction, cover, peeking and defender repositioning.

Quality tiers (low/medium/high/ultra) are picked from the GPU and can be forced with
`?debug=low|medium|high|ultra`.

## Tests

`node scripts/smoke.mjs <url>`, `node scripts/smoke-game.mjs <url>`, `node scripts/smoke-nav.mjs <url>`
(spawns and cross-island navigation), `node scripts/smoke-build-mouse.mjs <url>` (mouse building and
firing) and `node scripts/smoke-mobile.mjs <url>` (touch emulation; the trap walk, touch look and
the button editor are exercised there and in the probe scripts) drive the game in headless
Chromium (Playwright) and save screenshots. Test against `npm run build && npm run preview` so dev
server reloads do not interrupt the runs. Sky Flag has `node scripts/probe-ascent.mjs` (a whole match through the debug API: start,
spawns, a tower placed and walked from its door to its roof, a deck, ninety seconds of bots building
and climbing, the mark, kill drops and pickup, fall damage, the rising sea and drowning, the grab
and the surge, holding to win, the podium), `node scripts/probe-ascent-phone.mjs` (the same buttons
and HUD on a touch phone, plus swipe speed and settling), `node scripts/probe-aim.mjs` (every
weapon's optic on the crosshair at full aim, and aiming without a pointer lock) and
`node scripts/probe-perf.mjs` (the frame budget of each subsystem, the scene's mesh and light
counts, and draw calls).
Fortress War has its own probes: `node scripts/probe-war.mjs <url>`
(team build, pings, the trap walk, the war, respawn choice, repair, the team podium),
`node scripts/probe-war-phone.mjs <url>` (the same on a touch phone) and
`node scripts/probe-war-balance.mjs <url>` (five minutes of bots against bots, watching tickets,
points, loots, repairs and the commanders' task counts; `IDLE_ENEMY=1` parks one enemy bot too, for a
fair comparison with the idle human; `SEEDS=1,2` picks the runs).
