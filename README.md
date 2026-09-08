# FLAGKEEP

**Build. Command. Storm.** A 3D web shooter about castles under siege. In **Siege** (the default)
two castles face each other across a plaza. Your team raises yours together before the bell, then you
fight as a soldier of the gunpowder age (crossbows, arquebuses, hand cannon, fire pots) and, whenever
you step back inside your own walls, as its commander: a map of the live battle where you order
rooms, traps and siege engines that your builders raise while the fight goes on, and set how many
of your people build, defend or attack. Loot the enemy flag three times from the top of their keep
and the castle falls. **Fortress War** (points and tickets across the whole island) and the classic
**rotation** (everyone builds a fortress, then each one is stormed in turn) are still in the setup
screen. Single player already plays like the multiplayer will: your teammates are bots who build
with you, take your orders, crew the ballistae, hold posts, breach walls and repair them, and the
enemy has a commander of its own.

Runs entirely in the browser (WebGL 2). No accounts, no downloads, no external assets: every texture,
model and sound is generated procedurally at load time.

## Play

- `npm install`
- `npm run dev` then open http://localhost:5173

Production build: `npm run build` (static site in `dist/`, deployable to any static host such as
GitHub Pages). Single-file build for artifact hosting: `npm run build:artifact` (writes
`artifact/flagkeep.html`).

## How a match works

### Siege

1. **Team build** (90 s, 3 or 5 minutes, or unlimited). Both plots stand on the plaza, 72 m apart,
   facing each other. Your castle starts as a **castle**: a ring of wall rooms whose roofs are the
   wall walk with merlons, two-storey corner towers with pitched caps, a two-storey gatehouse flanked
   by towers and lit by torches, a covered way to the keep, and the keep itself three storeys over the
   walls with the flag hall on top; the yard around the keep stays open. Your bots extend it (one room
   every couple of seconds each) around whatever you place, the **ping** tool says "a tower here", and
   Ready finishes the walls at once. Heraldic banners in your colour hang from the keep and over the
   gates. The enemy castle is generated in one of the period styles (Medieval, Gothic, Desert) and
   trapped by its whole team; the unused plots carry ruins.
2. **Trap walk.** You appear inside with personal trap slots; each bot sets traps in its quarter.
3. **The siege** (8 minutes). Each side has **three lives**: standing eight seconds in the enemy flag
   hall with no defender there loots the flag and takes one; the flag then locks for fifteen seconds.
   A side out of lives stops respawning, and when its last soldier falls the castle is lost. Kills
   never cost lives, and respawns take three seconds. Each castle has a **courtyard** zone in its open
   yard: hold the enemy's and your side may respawn there, a forward camp inside their walls; every
   held yard also pays supplies.
4. **Commander.** Press **M** (or the map button on a phone) inside your own walls. The battle keeps
   running while you look down on both castles: tap a cell to **order a room** (5 supplies) that
   your builders raise while you fight, set traps (supplies too), place a **ballista** (20) on a roof
   or a **catapult** (35) in the yard, and split the **crew** between build, defend and attack. Getting
   hit throws you back into your body; you cannot open the map outside your walls. The enemy
   commander does the same with its purse: engines on its roofs (none on easy, one on normal, two on
   hard), fresh traps where the old ones were spent, and builders sent to the sites.
5. **Engines.** A **ballista** shoots heavy bolts at anyone in sight (two bolts kill); a **catapult**
   lobs stones in a high arc that burst on landing and break the wall they hit. A friendly bot
   standing by an engine crews it (the commander sends crews from the garrison, never more than half
   of it); you can man one yourself with **E**: your body stays at the controls, your look aims it,
   the trigger fires it, E steps off. Engines can be destroyed, and each side starts with a ballista
   on a roof and a catapult in the yard.
6. **Supplies and repair.** Kills and held yards earn supplies. Catapult stones and powder kegs blow
   real holes in the walls; standing by a hole in your own castle for a few seconds puts the blocks
   back for five supplies, and bots do the same on their own.

### Fortress War

1. **Team build** as above, with the **stronghold** plan (a curtain wall, corner towers, a gatehouse
   and a five-storey keep) and the empty plots carrying ruins for cover.
2. **Trap walk.**
3. **War** (12 minutes). 150 tickets a side. A kill costs one ticket. Three capture points across
   the middle of the island (A by the west road, B at the monument, C by the east road): ten seconds
   alone on a point takes it, and every five seconds the side holding fewer points loses a ticket
   per point of difference. Looting the enemy flag (eight seconds in their flag hall with no
   defender there) costs them forty tickets and drops the flag for twenty seconds. First side out of
   tickets loses; at the bell the higher pool wins. When you die you choose where to respawn: the
   fortress or any point your team holds (keys 1-4, or tap).
4. **The team AI.** Each side has a commander that hands out tasks every second and a half: a
   garrison at the flag posts and doorways (bigger under alarm, nearly everyone when the flag has
   just been looted), engine crews, builders while orders are pending, squads of three on the
   points, and always one squad on the assault, rallying outside the enemy walls and going in
   together. Bots share sightings, remember every trap they have seen and route around it, blow a
   wall when the way to the flag is barred, hold angles at their posts and escort you when you push
   out. Team results and the MVP close the match.

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
   set a trap (click, or the PLACE button on a phone); aim at one of yours to take it back.
4. **Rounds** (4 minutes each, one per fortress). The owner waits inside at their chosen spawn;
   every attacker starts at their own fortress and runs across the island. Attackers fight each
   other too. Standing three seconds next to the flag captures it and ends the round. When time runs
   out the defender earns a hold bonus. Touching the flag trips the **alarm**; if the clock runs out
   mid-capture the round goes into **overtime**: no respawns until the flag falls or the capturer is
   cleared (25 s at most).
5. **Scoring**: 1 point per 10 s of defense, 40 for holding to the end, 15 for every full minute
   the flag stays safe, 50 per capture, 5 per kill (8 as the defender). **Kill streaks** pay out for
   everyone, bots included: three kills in a row give an armour plate, five a radar pulse, seven
   overdrive; dying resets the streak.

## Controls

WASD move · Space jump · Shift sprint · C crouch/slide · Mouse aim and fire · Right mouse aim down
sights · 1-3 / wheel weapons · R reload · G fire pot · Q / F gadgets · E man an engine · M command
map (inside your walls) · Tab scoreboard · Esc pause. Stairs, slabs and one-metre ledges are climbed
by simply walking into them. Aim assist (on by default, off in Settings) slows the view over an
enemy, follows one near the crosshair, snaps onto the nearest enemy when the sights come up and
forgives near misses a little; on touch it also fires for you. Mouse look uses pointer lock with
raw, uncapped deltas; if the page cannot lock the pointer, the outer band of the window keeps
turning the view.

**Arsenal of the gunpowder age.** A **flintlock** pistol (two shots, hard hitting), a **repeating
crossbow** (a magazine of ten light bolts), the **crossbow** (four heavy bolts, slow to span), a
**hand cannon** (a fistful of shot, two charges), the **arquebus** (one shot, a long reload, half
the screen through its sights) and the **hand mortar** (a lobbed bomb that bursts). The **fire pot**
is the grenade: it shatters and leaves whoever it splashes burning.

**Gadget kit.** Before every round you pick a primary weapon and two of five gadgets (the choice is
remembered): a **rope line** that anyone can ride both ways, a **spring board** that launches whoever
steps on it, a sticky **powder keg** that blows a hole through walls, a **grappling hook** (real
pendulum rope: hold to reel in, let go to fly, jump at the top to vault the ledge) and the
**sapper's shovel** that tunnels under the ground, surfaces inside the fortress and digs through
blocks while you hold the button. Bots carry random kits too.

**Building.** The build phase is a plan of room blocks on an 8 m grid (six-metre interiors, wide
enough to fight in; same-tone neighbours merge into bigger halls): tap the ground to grow a room,
tap a wall or a roof to add one beside or on top of it, hold (or right-click) to take one away, and
pick one of eight tones for the next block. The **Architect** turns that coarse plan into finished,
playable architecture after every tap: exterior walls with slits, climb-in windows or curtain glass,
gates and doors on the ground floor (always at least two entrances, facing the attackers), doorways
between rooms of different tones flanked by chest-high shooting slots, a **drop hole** in the
ceiling of every stacked room, interior **cover**, stairs between storeys with stairwell holes, roof
terraces with crenels or railings and roof access, pitched roofs with chimneys for the roof tone,
balconies on the front, arcades under overhanging rooms, string courses, quoins and lamps, all in the
match style. Configurations unlock more: two rooms of the same tone facing each other across a gap
get a **bridge**; a room beside a lower roof opens a **terrace door** onto it; a ground cell enclosed
on three or four sides becomes a **courtyard** with paving, a fountain, lamp posts and doors; the
dark tone builds open **colonnades**; a two-storey facade on the approach side earns a broad
**outdoor stair**; free-standing towers get **crowns**. Fortified plans (team modes) get arrow slits
instead of climbable windows, one gate and one postern, no outdoor stairs or balconies, merlons on
every parapet and torches on the gatehouse. Every floor, terrace and bridge is guaranteed walkable
from the ground, so whatever you build is an arena you can climb without gadgets. The flag goes into
any room with a tap; a "surprise castle" button generates a full fortress you can then edit. One
finger orbits and two fingers pan and zoom on a phone; the mouse drags to orbit, the wheel zooms,
`1-8` pick tones, `X` toggles the eraser, `G` the flag, `Z` undoes. At match end a shareable fortress
card renders your build, and every round opens with a short camera flyby.

**Phones and tablets** get a layout modelled on today's popular mobile shooters: a floating movement
stick on the left (push far to sprint), look by dragging anywhere else, and a big fire button under
the right thumb with aim, jump and crouch on an arc around it, knife and reload a little further in,
fire pot and the two gadgets up the edge, plus a second fire button above the stick and, in the team
modes, a **map** button that opens the command view. A finger sliding on a held fire or aim button
keeps turning the view, so you aim while shooting. Touch look is brisk, speeds up on fast flicks,
slows while aiming down sights and is lightly smoothed; look speed, aim speed and the flick boost
are sliders in Settings. **Customize the buttons** (Settings) opens an editor where every battle
button is dragged into place and resized, with a left-handed mirror preset. Auto fire and aim assist
are on by default for touch. Landscape is recommended.

**Bots** notice you the way people do: awareness builds up over a second or more depending on
where you are in their field of view, how far and how exposed you are, whether you stand still, walk
or sprint, and how attentive the bot happens to be right now, so a still figure half hidden at the
edge of vision can go unseen while someone sprinting across the middle of the view, or firing,
registers almost at once. Their first shots start off target and settle, their aim trails your
movement, they flinch and break for cover under fire, reload out of sight and fire in bursts.

**The flag hall.** The room you plant the flag in becomes the **hero hall**: the flag stands on a
podium with a ring of steps, four columns around it, and when every cell of the hall has a room
above, that upper floor opens into a **gallery ring** around a double-height centre. Indoors is
darker than outdoors (roofed cells get less sky light, baked per vertex) and lamp blocks throw warm
pools onto nearby walls.

**Traps.** Set on the trap walk, from the trap tool during the build, and from the command map
during a siege. Hidden in the floor until they fire: **spikes**, a **flame vent**, a **spring pad**,
a **mine** and a **trapdoor**. In plain sight and dodged with timing: a **saw rail**, a **swinging
blade**, a **crusher**, a **turret** that tracks and fires at anyone in its room and can be shot to
pieces, and a **gate** that spans a doorway and lets only its builder through until it is shot open.
The builder sees everything and never triggers their own traps; trap kills count for the defender.
A spent trap is cleared away after a few seconds and frees its slots for a new one.

**Round events.** About once a minute, announced with a three-second countdown: a **blackout**, a
**wall breach**, a **supply drop** or **fog**. Never in the last stretch of a round or during
overtime.

**Close quarters.** A knife (V, or the knife button on touch) lunges forward and cuts for 60, or a
lot more from behind. Glass shatters: shots and blasts break panes, and a sprinting body crashes
straight through a window. Weapon swaps are near instant.

**Combat feedback.** Floating damage numbers, a red arc pointing at whoever just hit you, a
crosshair that turns red on a living enemy, name markers over enemies who shot you recently, a
warning over live fire pots near you, a spawn shield after respawning, kill hit-stop and camera
shake, a multi-kill announcer, slow motion when a kill stops a capture, and a death cam that first
turns to whoever got you before orbiting your body.

## Tech

TypeScript, Vite, three.js, pmndrs/postprocessing, N8AO. Custom voxel engine (chunked storage,
greedy meshing with baked vertex AO, 16 m chunks concatenated into 64 m region meshes so a fortress
is two draw calls, six block shapes with shape-aware collision, DataArrayTexture PBR materials with
per-block variation and bevelled edges), frustum-culled grass tiles and skinned characters, baked
horizon and flag metalwork, shadow maps that refresh every other frame when a device drops below
50 fps, heightmap island with a detail-mapped ground, paths, a central monument and ruins, distant
horizon islands, height fog, colour grading/sharpen pass, procedural Web Audio. On phone GPUs the
automatic tier leaves screen-space AO off, frame buffers drop to 8-bit when the GPU cannot render to
half floats, and a shader that fails to compile drops the fragile passes instead of drawing garbage;
`?debug=info` shows the GPU readout and `?debug=noao`, `nopost`, `byte` isolate passes.

All models are generated at load time from parametric parts merged per material: skinned soldiers
of the siege era (quilted gambeson in six dyes, mail coif and collar, breast and back plates under a
team-coloured tabard with the team's heraldic device, fauld, sword belt, leather gloves and boots,
knee cops, four skin tones) on a seven-bone skeleton, dressed by an outfit layer driven by the
gadget kit: six helmets (kettle hat, bascinet with visor and aventail, great helm, sallet with bevor,
comb morion, archer's hood), kit gear (rope coil and grapnel, quiver of bolts, spring board with
coil springs, powder kegs and slow-match, forearm hook, shovel and pick, greaves) and cloaks, arm
bands and plumes as flair; period weapons with stocks, prods, locks and match cords, plus gloved
first-person hands in gambeson sleeves; ballistae and catapults in timber and iron with animated
arms; heraldic cloth banners that sway; trees with lathe trunks, tapered branches and leaf-card
canopies, ragged conifers, bushes, noise-displaced mossy boulders and flower cards, all instanced.
Procedural PBR tiles (quilt, mail, leather, plate steel, fabric, gunmetal, polymer, wood, bark, rock,
soil) supply albedo, normal and roughness maps.

Bots navigate the whole island: a fine voxel grid around each fortress stitched to a coarse terrain
grid, with hearing, damage reaction, cover, peeking and defender repositioning. Each team has a
commander (garrison, crews, builders, squads) and the bot team's commander runs its own works from
its purse.

Quality tiers (low/medium/high/ultra) are picked from the GPU and can be forced with
`?debug=low|medium|high|ultra`.

## Tests

`node scripts/smoke.mjs <url>`, `node scripts/smoke-game.mjs <url>`, `node scripts/smoke-nav.mjs <url>`
(spawns and cross-island navigation), `node scripts/smoke-build-mouse.mjs <url>` (mouse building and
firing) and `node scripts/smoke-mobile.mjs <url>` (touch emulation) drive the game in headless
Chromium (Playwright) and save screenshots. Test against `npm run build && npm run preview` so dev
server reloads do not interrupt the runs. The siege has its own probes under `scripts/`:
`probe-siege.mjs` (the loop: castles, lives, courtyards, respawns, the end), `probe-siege-command.mjs`
(the command map: orders, crew, being hit, outside the walls), `probe-siege-arsenal.mjs` (the period
weapons), `probe-siege-engines.mjs` (ballistae and catapults, crews, manning, wall damage),
`probe-siege-castle.mjs` (the castle archetype, yards, banners, torches, repair),
`probe-siege-chars.mjs` (the soldiers' outfits and a line-up), `probe-siege-works.mjs` (the enemy
commander's works), `probe-siege-phone.mjs` (the siege on a touch phone) and `probe-siege-balance.mjs`
(four minutes of bots against bots; `NOWORKS=1` disables the enemy commander, `SEEDS=1,2` picks the
runs). Fortress War keeps `probe-war.mjs`, `probe-war-phone.mjs` and `probe-war-balance.mjs`.
