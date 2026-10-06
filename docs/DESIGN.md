# THRESHOLD: The Tower (design + technical spec)

This is the source of truth for the rebuild. Every workstream reads it. Shared
TypeScript types live in `src/core/contracts.ts`: implement against those,
never around them.

## 1. Vision

A third-person portal **action** game for desktop and phones. You have no gun.
You own one rift pair, and the world does the killing: enemy bullets,
grenades, beams, charging brutes, hanging cargo, gravity and your own falling
speed. Every kill passes through a rift, except up close, where a hidden
blade does it. The game rewards invention: named tricks, a style meter,
auto-replays and one-tap clip sharing.

The setting is **Kessler Threshold Tower**, a 100 m skyscraper under
construction above the harbour at golden hour. Kessler invented rift gates;
you stole a prototype Rift Gauntlet. You climb from the pier to the roof and
take down Director Voss.

## 2. The three rules (shown to the player, one line each)

1. **Everything keeps its speed through a rift**: you, enemies, bodies,
   bullets, grenades, cargo, light and sound.
2. **The rift is your weapon.** Kessler guns are IFF-locked and can't
   hurt Kessler. Anything that has passed through your rift is *rift-charged*
   and can hurt anyone. You are attuned: your own rift-charged things never
   hurt you. Up close you also carry a hidden blade (§4).
3. **You control both ends.** One key opens both: the ENTRANCE where the
   moment needs it, the EXIT where you aim while time slows. Closing a rift
   on something mid-pass cuts it (SHEAR).

## 3. The rift model

The player owns **one pair**: an **orange ENTRANCE** (where things go in)
and a **blue EXIT** (where things come out). Both come from **one key**,
PORTAL (LMB / RT / the PORTAL touch button):

- **Press:** the ENTRANCE opens, by what you aim at and what's happening.
- **Hold:** time slows and you aim the EXIT (a GRAB or a fall slows time at
  once; a door, hole or load once you've held past the tap). A ghost
  end shows where it goes;
  for a throw, a dotted arc shows where the thing lands and its colour says
  what that does (drown / void / lethal / knockdown / safe).
- **Let go:** the EXIT opens there. A **tap** (under 0.2 s) puts the exit
  where it does the most by itself.
- Every press starts a new pair (the old one collapses). RMB / LT / sliding
  onto ✕ while holding lets go without an exit; so does pausing. A man let
  go of climbs out stumbling.
- The PORTAL costs nothing and doesn't answer fire: shots, beams, grenades
  and charges coming at you are REFLECT's (see STRIKES).

### What a press opens (priority)
1. **AIR** (airborne, `vel.y < -3`): an entrance on your fall path (1.5–3 m
   below, facing your velocity; on the ground instead when that is closer
   than your feet would allow). Its EXIT opens at once where you look and
   follows your aim while you hold, until you come out of it (SLINGSHOT /
   COMET / LOOP / CANNONBALL).
2. **LOAD** (crosshair on a hanging load, or on a prop nearer it than any
   man): the same as GRAB for things: 14 m/s, and a tap drops it through a
   hatch over the head of the man you look at (else the nearest one in
   sight, not one by the hole).
3. **GRAB** (crosshair on an enemy, 40 m, in sight): the floor under him
   opens and he sinks into it (he does nothing while held). Free, whether
   he's fighting you or not; turrets and Voss (stunned or not) won't
   budge. Hold to aim the throw: a launcher end along your view (or 2.4 m in
   front of a man you look at, to hit him with the body), facing where you
   look, 17 m/s. **Tap** (or let go with no valid aim): **straight on, away
   from you**: an exit 2 m past him on the level line from you through him,
   its centre 2 m over his feet, facing on and tilted 20° up, 17 m/s. A
   wall in the way pulls it back toward you to 1.4 m short of it (a wall
   right behind him is what he hits); anything lower there (a crate, stairs,
   a roof over that spot) steps it back further, at most 1.4 m to your side
   of him, and he flies over it or into it. No room even so (a low roof over
   him), he climbs out.
   On open floor he comes down ~11 m on at ~9 m/s: knocked down, not killed
   (8 ≤ v < 12). A wall on the way, or a man where he comes down, takes him
   at 16 m/s; a drop or the sea on the way takes him too. Where you stand
   decides: put the edge behind him. With the crosshair on him, before you
   press, a dotted arc shows where a tap would throw him, coloured by what
   it does. A thrown man's floor end shuts as soon as he's through (off a
   wall close behind him, or under a low roof, he'd drop back into his own
   hole); its exit fades 0.5 s later on a tap.
4. **HIJACK** (crosshair on a Kessler gate's arena end): the gate feeds your
   EXIT from now on. Tap: over the nearest drop / out of the sky.
5. **HOLE** (looking steeply down at a floor near you, or into a pit): a
   floor end right there. Tap: a hatch straight above it as high as you
   stand (a loop). A falling player drifts onto an open floor end below.
6. **DOOR** (anything else): a standing door in front of you (or on the wall
   you face). The EXIT goes where you aim, snapping to surfaces:
   - floor: faces up; wall: faces out; ceiling: faces down; perch: the top
     of a thing aimed high on its side;
   - open air: a door facing along the aim, or a sky hatch (auto over a
     target; G / Y / ⇄ flips it while holding; the wheel sets the distance).
   **Air ends can never be above your feet** (`LAW.airAboveFeetMax` = 0):
   height is earned. Surface ends are allowed anywhere in range and sight.

Throw pairs (GRAB, LOAD, HIJACK exits) are only for what they were opened
for: **the player passes through them like air**. An aimed throw's pair
closes 1.2 s after its load went through.

### Rules for both ends
- Opening costs nothing.
- CLOSE (X / middle mouse / LB / ✕) closes the pair. If an enemy or prop is
  straddling a plane (centre within ±0.45 m and inside the rectangle), it is
  **sheared**: an instant kill for anything, including armour. It doesn't
  work on the boss core.
- Only one entrance and one exit exist. A new PORTAL replaces the old pair.

### Anti-exploit
- No aimed end may open within 1.2 m of a living steady enemy's body.
- A tapped GRAB throws him straight on, not to the deadliest spot around:
  it only kills when you've put a wall, a drop, the sea or a man behind him.
- Air ends can't be above your feet.
- Speed cap is 40 m/s.
- Only rift-charged speed hurts.
- These rules make "one click = one kill" impossible. Kills come from
  combinations.

### STRIKES (rift attacks, one press)
Four attacks that use the rift like a weapon, no set-up. Aim near an enemy
(lock-on to the one nearest the crosshair, 32 m, in sight; a reticle shows
it) and press. Their ends open at once in your colours, do their thing and
close by themselves; your PORTAL pair is untouched.

| Strike | Keys | What happens |
|---|---|---|
| **REFLECT** | RMB / 1 · LT · touch | A rift on his muzzle, facing him (a lid over a grenadier's throw; a door in front of you for the unarmed, 2.6 m out for a brute) and **he's made to fire now**. It all comes out of the other end: beside him, facing him, homing in. Look at another man (or a barrel) and the other end slides over to him. 4 s. A brute's charge is thrown over the edge instead. |
| **LOOP** | Q / 2 · Y · touch | The floor under him and a hatch 7.5 m over it: he falls forever, faster every lap (to 40 m/s). **Press again:** GEYSER, up out of an end facing the sky over the nearest drop / water (else beside the hole). **Hold:** HUMAN CANNON, slow motion, aim (arc + outcome), let go: he comes out where you look at loop speed (22 m/s at least); men he hits are his kills too. After 6 s, a geyser. |
| **SWAP** | E / 3 · D-pad ◀ · touch | A floor end under each of you: you trade places (he drops first). He is **rift-marked** for 2.5 s: his own side's bolts and blasts hurt him. Up to 9 m above you. |
| **DASH** | R / 4 · D-pad ▶ · touch | The floor under you, and an end 3 m in front of him facing him: you come out at 22 m/s into him (a charged ram: kills, even armour). With no one in sight, a dash 12 m ahead at your height. |

- **Rift charge:** 3 charges; a strike costs one, one comes back every 9 s,
  and every kill that isn't a strike's refunds one. 1.5 s lockout per
  strike. The pips sit over the strike bar.
- **REFLECT is the way to return fire** (the PORTAL key has no catch):
  RETURN TO SENDER, CROSSFIRE, MIRROR, FIRING LINE, POSTAGE and BORROWED
  GUN; on a brute it sets up MATADOR. (A door you put in a shot's way
  still sends it on.)
- Turrets can't be moved; Voss only by LOOP or SWAP when stunned or down,
  never by the PORTAL grab (REFLECT works on anyone).
- Strike kills score REFLECT / GEYSER / HUMAN CANNON / SWITCHEROO / RIFT
  DASH (+ what finished him: SPLASHDOWN, INTO THE VOID, SKYFALL...). Their
  floor end is not a TRAPDOOR. Whatever a REFLECT's fire kills (the man you
  sent it into, a barrel you steered it onto) is REFLECT's kill too, so it
  refunds nothing.

### Assists (so the tricks land the way players mean them)
- **Air ends come down to your level.** Aimed above your feet, an air door
  drops until things step out of it at your feet's height (a hatch until
  its centre is there). Height is still earned, but the refusal never fires
  for an air end.
- **Walls behind enemies win.** The auto sky hatch over a target only
  happens when the aim ray is on his body or hits the ground; aiming past
  him at a wall puts the EXIT on the wall (Return to Sender set-ups).
- **Rift magnetism.** A bolt or beam leaving a rift bends onto a Kessler body
  within 12° of its path, or onto the man who fired it within 60°. A
  grenade out of your rift arcs onto a body within ~32° of its way out (its thrower within
  60°) and goes off on contact.
- **Rift slide.** A charged landing at knock speed or more skids (9 m/s²,
  a roll) and keeps its charge while it is that fast, so a slingshot through
  a floor-level door carries into the group. A charged player rams with full
  speed even at a glance and keeps 65% after each hit.
- **Stable loops.** An entrance opened while falling out of your own sky
  hatch centres under it; a floor/ceiling loop is steered over the end it
  falls back into, so it holds up to the speed cap. LOOP pays up to 12 loops.
- **Cargo.** A hanging load's entrance opens on the ground under it when
  that's a real drop (it arrives fast), else just below it.
- **Hole drift.** A falling player within 1.6 m past the rim of an open
  up-facing end below drifts onto it.
- **MATADOR keeps his run.** A charging brute's speed carries through the
  rift (his charge ends, not his momentum).

### Kessler rift gates
- Fixed enemy pairs, drawn in red. Reinforcement waves walk out of the gate's
  arena end.
- **HIJACK:** stand at the gate's panel and press ACTION (with an EXIT open;
  else "Open an exit first"), or aim PORTAL at
  a gate's arena end. The gate's out-end then links to your EXIT. Everything that comes through the gate now comes out of your exit
  (over the void, above their commander).
- Wave members hop into the in-end one by one, and the next only once
  nobody is standing where he'd come out (4 s at most), so no one is shoved
  back through the wall into the staging room; with no EXIT to send them to,
  a hijacked gate lets them out of its arena end on foot. A gate fight isn't
  cleared while waves are still to come.

### Lab hazards
- **Laser curtains** burn and block you (20 a touch, thrown back). They are
  rays like a beam: a laser that goes into your ENTRANCE comes out of your
  EXIT in rift colours and cuts Kessler (FIRING LINE).
- **The electric trench** pulses (1 s of every 3). It hurts you, and fries
  Kessler who are knocked about in it; walking their own lab is safe.

## 4. The laws (numbers)

All values are in `LAW`, in `src/core/contracts.ts`.

| Quantity | Value |
|---|---|
| gravity | 22 m/s² |
| speed cap | 40 m/s |
| knock speed | 8 m/s |
| kill speed | 12 m/s |
| armour speed | 18 m/s |
| charge lasts | 1.5 s after crossing, or until the first ground contact (props/bodies keep it until they come to rest) |

**Rift-charged impact on an enemy** (a body, prop, player or projectile
striking him):
- 8 m/s or more knocks him down.
- 12 m/s or more kills.
- 18 m/s or more kills armour.

**An enemy landing after a rift exit** uses the same landing-speed
thresholds. Water is always a drown, and the void is always death.

**Player landings:**
- A charged landing is always safe. At 18 m/s or more it releases a knock
  shockwave (r = 3 m) and scores COMET.
- An uncharged fall over 14 m/s hurts: damage = (v − 14) × 9.

**Bolts:**
- 26 m/s, 3-round bursts, 15 damage to the player (a burst that all lands takes 45).
- Charged, they do 60 damage to Kessler actors.
- They pass through Kessler actors while uncharged.

**Grenades:**
- 2.2 s fuse, bounce 0.35.
- Explosion radius 4.5 m, 45 damage (falloff).
- IFF unless charged.

**Beams (sniper and lasers):**
- 1.2 s telegraph, then 0.35 s of beam, 45 damage.
- Raycast through up to 2 rifts. Segments after the first rift are charged.

**Barrels:** explode (neutral: they hurt everyone, the player at 50%) when
hit by:
- a charged bolt
- a charged impact of 8 m/s or more
- a grenade blast
- a charged landing of 8 m/s or more

**Player:**
- 100 HP. It regenerates at 25/s after 4 s without damage.
- A kill heals +15 ("embers"), the blade's too.

**SHOVE** (V / touch): a 4 m dash that staggers enemies it touches for
1.4 s. It does 0 damage and has a 1.2 s cooldown. This is how you make
things off-balance on foot.

**HIDDEN BLADE** (ACTION: F / pad X / the touch ACTION button; first in
line after throwing what you carry). A blade under the right wrist that
takes down any enemy in any state: it goes through armour and shields, kills
a charging brute, wrecks a turret. `src/game/blade.ts` (numbers in `BLADE`).
- **Reach:** within 2 m of his body, from any side, up to 1.2 m above or
  below. You turn and step in (0.1 s at most) and the blade lands.
- **Lunge:** within 3.5 m of his body, ahead of you (±50° of where you face
  or where the camera looks), within 0.6 m of your level, with a clear run
  and floor between you: you dash to him at 14 m/s (about 0.2 s, silent, no
  footsteps) and strike on arrival, 0.6 m from his body. If he gets away
  (thrown, launched, through a rift: anywhere much further than he was) it
  misses at once, with no swerve after him. Walls and fences block both, at
  the press and again when the blade lands. Neither goes through an open
  rift end (your own door between you, a hole in the floor on the way); a
  man flying past is cut only right on you, never stepped after.
- A rift you go through mid-lunge ends it (its momentum carries you on), as
  does a strike you fire, or dying.
- **Cooldown** 0.8 s from the press. The prompt stays on the blade while a
  target is near.
- **Stealth:** a stab is quiet unless he sees it coming (in combat, on his
  feet, you inside his ±90° view). A quiet kill is witnessed only by allies
  looking his way (±90°, LOS, 25 m) or standing within 2.5 m of him;
  unwitnessed, a calm or suspicious man's death scores GHOST. A loud one
  (from his front, in a fight) is a death cry: everyone in earshot (15 m,
  walls muffle it past 8 m) comes to where he fell, and calm ones join the
  fight. A downed, stunned or held man can't cry out.
- **Voss** takes 150 per stab, stunned or not, then breaks away at once: he
  gets up and passes straight through his red rift (no warning) to a blink
  point about 11 m off. With nowhere to blink, his gauntlet throws you back
  (9 m/s, no damage).
- **Feel:** the player turns to him, plays the strike, the blade snaps out
  of the wrist; 0.1 s hitstop, camera kick, sparks, the blade sound; a kill
  adds a 0.3 s slow beat. Scoring: HIDDEN BLADE (the `finisher` trick); it
  is not a strike's kill, so it refunds one strike charge. Nor is it a
  TRAPDOOR when a strike's floor end dropped him. Replays show the blade.

## 5. Enemies (Kessler Security)

Enemies have states: idle, patrol, suspicious, combat, stagger, charge,
launched, downed, stunned and dead.

| Kind | HP | Behaviour | Answers |
|---|---|---|---|
| **Rifleman** | 40 | Keeps 10–20 m range and strafes; beyond 24 m he closes in instead of firing. 0.6 s laser telegraph (the only warning), then a 3-bolt burst at you. After a burst he varies: moves to a new spot, holds and re-aims, or hesitates. Looser aim at range, at a fast-moving target and on a fresh sighting; steadier the longer he watches you. | Return to Sender (REFLECT), a grab, anything charged, the hidden blade |
| **Grenadier** | 40 | Lobs a grenade every 5 s (shows an arc and landing ring). | REFLECT: a rift over his throw sends it back (POSTAGE); a grab |
| **Warden** | 70 | Front shield (120°) blocks everything from the front, charged too, below armour speed. Advances and shield-bashes (15 damage, knockback). Turns toward an exit that shot him. | Hit from behind (exit behind him), a grab (the floor isn't shielded), loop, shear, armour-speed impact, grenade; the hidden blade goes through the shield |
| **Brute** | 250, armoured | Telegraphs a charge (roar 1 s), then 14 m/s in a straight line for up to 18 m. Hits for 35 and knocks you down. Stunned 2.5 s if he hits a wall. | MATADOR: his charge into your entrance sends him out of your exit (the sea or void kills him, a wall stuns and damages him, a crowd bowls). REFLECT sets it up: he charges now, into a door in front of you, out over the edge. Also cannonball, shear, hazards, and the hidden blade (even mid-charge). |
| **Sniper** | 40 | Perched and never moves. 1.2 s red beam telegraph, then the beam. | FIRING LINE: REFLECT and he fires his beam into your rift, out into him (or the man you look at); also cargo and shear |
| **Turret** | 120 | Static and turns. A 6-round stream with a laser. | BORROWED GUN: REFLECT takes its stream; the other end goes where you look. Also barrels. |
| **Director Voss** (boss) | 1800, armoured, 3 phases (phase 2 under 2/3 of his hp, phase 3 under 1/3); his bar runs across the top of the screen while he fights | Carries his own rift gauntlet. He catches straight shots with a red rift (returns your returned bolts) and blinks between two red ends. Anchored: the PORTAL grab never takes him, stunned or not. One impact takes at most 200 (the crown's load 300). | Hit him from where his catch-rift doesn't face (behind/above). Shear him mid-blink. Stunned: LOOP him. The hidden blade wounds him any time (150), then he blinks away at once. Cannonball a looped barrel into him. Drop the crown's hanging load. |

**Roles (mission 1): holding ground.** One hero against many works when the
men hold positions instead of flooding you, and some of them hold ground only
your power reaches. Each mission-1 spawn has a role built from an existing
kind (`SpawnDef.role`, with an optional `fallback` post and a `leash`
override). His *post* is his spawn; his *leash* is how far from it he goes in a
fight. A spawn without a role behaves as before (the later zones).

| Role | Kind | Job | Leash |
|---|---|---|---|
| **Holder** | rifleman | Holds a post above the fight that can't be reached on foot; the squad's spotter ("Up top! I've got him!"). Stands at his post and aims; never strafes. | 1.2 m |
| **Anchor** | rifleman | Holds a post in cover (the fight's floor, climbable high ground, or behind bars) and covers his mates. Strafes only inside his circle. | 6 m (a level may set less) |
| **Pusher** | warden | Walks at you so you can't camp, but stays in the fight. | 18 m |

- R1 territory: in a fight (not calm) every walk goal (the hunt to your last
  known spot, the search, an investigation, the warden's advance) is pulled in
  to his leash, and further in along the same line if that lands on something
  he can't stand on, so the walk ends inside his ground. Calm patrols are
  authored inside it.
- R2 return: pushed off his ground on his own floor (a grab tap along his
  roof) by more than 0.75 m past the leash, he runs back and does nothing else
  until he is inside it again. (A walk to a spot inside his ground that bends
  out round a corner doesn't count while he is walking it; a path he stopped
  following, a holder standing to aim, does.)
- R3 rebase: landed more than 1.2 m (height) off his post's floor, stranded,
  on ground his post's walk grid doesn't reach (thrown over into the next
  zone's yard at the same height), or with no way back twice, he fights from
  where he is: that spot becomes his post (a 6 m circle at least, on the floor
  under him if he came down on a rail's top or a crate), and a holder fights on
  as an anchor. He never climbs back. Thrown up onto something over his own
  floor at an edge (the balcony's rail top), the step down onto his floor is
  no drop to him: he steps off and walks back instead of standing up there.
- R4 holders: stand and aim within 24 m in waves like any rifleman. Lost you,
  he searches, investigates and stands down from his post (the only walk he
  takes is back onto it). A holder
  who sees you on his own floor within 10 m (you came up by a door, a swap, a
  dash) calls "He's up here!" once and tells his squad.
- R5 anchors: spot picks are pulled in to just inside his circle (as close
  as his ground lets him get to where he'd like to stand: out of range, he
  closes in to its edge); with none safe there he takes a spot inside it with
  a line on you (a few rays, now and then), else holds. You coming close or going far doesn't move him off a
  spot; only his own strafe timing does. One anchor per fight may have a
  prepared *fallback* (same floor, 5–12 m back): when you come within 7 m in
  his sight and it lies further from you than he does, he calls "Falling
  back!", runs to it once, and it becomes his post. Cornered (no fallback, or
  it's used), he stays in his circle and keeps firing. Nobody else flees.
- R6 pushers: R1 only (stairs are still walls to a warden).
- R7 covering fire: a squad is pressed for 2.5 s when one of its men is
  grabbed, hurt and still standing, falls back, or sees you within 6 m. Then a
  mate who sees you takes the next turn to fire ahead of the line ("Covering!",
  once a press). The volley gap, the stagger and the two-gun limit still hold.
- R8 calm: his idle walk goes back to the post he holds now.
- Priority emerges without a morale system: the holder is the spotter (high,
  sees over cover, calls your spot every 2.5 s). Kill him first and the anchors
  keep only their own eyes and their leashed hunts.

**Perception (information, not telepathy):**
- Vision: a ±60° cone at 70% of sight range (32 m) while unaware, ±90° at
  full range in combat. Anyone within 2.5 m is noticed in any direction.
  Voss alone sees all round. Hearing uses noise events (a sprint carries 12 m).
- An enemy knows only what he saw, heard or was told. When one spots you, he
  shouts: his squad and anyone in earshot (15 m, walls muffle it) join the
  fight with his last known spot, give or take 3 m. They turn to it and come
  to look, but must see you themselves before they fire. While he has eyes on
  you he calls out your spot every 2.5 s.
- Reinforcements (gate waves, Voss's adds) arrive knowing what the fight
  there knows: the freshest last known spot among their side, give or take
  3 m (nothing, if nobody has seen you). They bring no news of their own.
  Someone alarmed with no clue (hurt by something he didn't see) looks
  around where he is. A witness to a death goes to the body, or stares at
  the rift exit it came out of (a searching man too), unless he has eyes on
  you.
- Down, flying, reeling or held in a floor end, he isn't watching you: back
  on his feet he looks again, and a real sighting then takes its reaction
  beat. A brute's roar follows you only while he sees you; out of sight it
  keeps the last line he had. A grenadier with no clear arc moves for one
  without holding up the squad's guns.
- Losing track: no sight, sound or word of you for 5–6.5 s (it varies per
  man) and he searches ("Where'd he go?"). He walks carefully to your last
  known spot, looks around, then checks spots nearby. A noise brings him to
  it. If he sees you again he calls it ("There he is!"), tells the squad, and
  fires after a 0.3–0.7 s reaction. After 12–16 s of fruitless searching he
  stands down ("Lost him."): suspicious, then calm, but for 40 s he notices
  you twice as fast and sees further. Going through a rift out of their sight
  leaves them searching the wrong place. Rift vision marks a searching man as
  suspicious. Voss never loses you.
- Firing: only at what he sees (a lock already running may finish on your
  last known spot). A short reaction on first sighting and after losing you.
  At most 2 shooters at once (attack tokens), and the turn goes to whoever
  has waited longest. After one shooter's turn nobody new opens up for
  0.5–1 s, and two never lock on in the same breath, so fire comes in waves
  with gaps.
- They never see rifts, only effects. When an ally dies to something that
  came out of a rift, they look at the exit and a Warden turns his shield to
  it.
- A zone is "hot" while any of its enemies is in combat (searching included).
- Kills of unaware enemies (calm, suspicious, stood down) that no one sees
  score GHOST. A hidden-blade stab is quiet unless he sees it coming; a
  quiet one is seen only by allies facing him, a loud one is a death cry
  (§4).

**Launched:** an enemy that crosses a rift becomes a physics body until it
lands.
- Landing at 8 m/s or more gives downed (2.5 s).
- 12 m/s or more kills (18 for armour).
- Below that he staggers 1 s and resumes on the new spot. A step or two off
  the walkable floor (by a wall, an edge: within 3 m) he walks back on; any
  further off the nav grid (a crate top, a beam) he stays and fights from
  there ("stranded"). When a fight has lost a man and is down to its last
  one or two, the objective marker points at the nearest of them, wherever
  he ended up.
- A man who falls below his own zone's floor (`killY`) is out of his fight
  for good: the void takes him, inside the tower too.
- Only the 12 enemies nearest you think (see, aim, fire) each frame; the
  rest of a fight still close in on what they know.

## 6. Tricks (style)

`src/meta/style.ts` turns `GameEvent`s into named tricks. Points are base
values.

| Trick | Detected when | Pts |
|---|---|---|
| RETURN TO SENDER | Killed by a charged bolt that he fired himself | 300 |
| CROSSFIRE | Killed by a charged bolt fired by another enemy | 250 |
| POSTAGE | Killed by a charged grenade | 300 |
| FIRING LINE | Killed by a charged beam segment | 350 |
| BORROWED GUN | Killed by a charged turret round | 300 |
| TRAPDOOR | Died after falling through a floor end | 200 |
| SPLASHDOWN | Drowned after a rift | 200 |
| INTO THE VOID | Fell into the void after a rift | 200 |
| SKYFALL | Fall kill after a rift, fall ≥ 10 m | 250 |
| MATADOR | A brute crossed your entrance during a charge | 400 |
| BOWLING | One launched enemy/prop knocks down or kills ≥ 2 others | 350 |
| HEADS UP | A launched enemy lands on another | 300 |
| LOOP ×N | ≥ 3 consecutive crossings of the same pair without landing (bonus per loop) | 50 + 50/loop |
| CANNONBALL | Kill by something that looped ≥ 2 times first | 450 |
| SLINGSHOT | Player charged impact kill after a floor/air → wall/air crossing | 350 |
| COMET | Player charged landing or impact at ≥ 18 m/s that kills | 450 |
| GUILLOTINE | Shear | 350 |
| CARGO | Killed by a charged falling prop | 300 |
| BOOM | A barrel explosion kills ≥ 1 | 250 |
| HIDDEN BLADE (`finisher`) | Hidden-blade kill | 150 |
| GHOST | Kill of an unaware enemy unseen by others | +150 bonus |
| AIRTIME | Airborne ≥ 3 s with ≥ 1 crossing (awarded on landing) | 100/s |
| DOUBLE / TRIPLE / MULTI | 2 / 3 / 4+ kills within 0.6 s | 200 / 500 / 1000 |
| MIRROR | Charged bolt kills its shooter within 0.35 s of being fired | 400 |
| HIJACK | A gate hijacked | 300 |
| JUGGLE | Victim crossed rifts ≥ 3 times before dying | 300 |

**Combo:**
- A chain continues while the next trick lands within 4 s, or while you're
  airborne.
- Combo score = sum × variety, where variety is the number of distinct
  tricks in the chain (capped at 8).
- A repeat of any of the last 3 tricks scores half.

**Style rank** (D, C, B, A, S, SS, SSS) comes from a meter that rises with
points and decays (faster at high ranks). Getting hurt drops it one rank.

**HUD:**
- Trick names pop with points.
- A rank letter with a meter.
- Combo ×variety.

## 7. Clips, replay, photo mode, challenges

- **Recorder:** records a snapshot every 1/30 s (the last 15 s ring buffer;
  types in contracts).
- **CLIP button:** after a combo ≥ 1500 points or rank ≥ A, a "🎬 CLIP"
  button pulses for 6 s. T (desktop), View (pad) or tapping it opens the
  replay.
- **Replay:**
  - Plays the last ~10 s around the combo.
  - The cinematic camera cuts between the follow cam, orbit cams at trick
    moments (0.25× slow motion for 0.8 s), and a *portal cam* looking out of
    the exit as something emerges.
  - Trick names are drawn into the frame, with a THRESHOLD watermark.
- **Export:**
  - A 2D canvas composites each rendered frame plus the overlays.
  - `canvas.captureStream(30)` + `MediaRecorder` (mp4 where supported, else
    webm).
  - Share via the Web Share API with files (phones: TikTok, Instagram,
    WhatsApp), or fall back to a download.
- **Photo mode:**
  - Freeze, orbit camera, depth-of-field-free tilt, FOV.
  - Snap a PNG, then share or download.
- **Challenges:**
  - 3 per zone, like "Return to Sender ×3" or "Drown two with one rift".
  - Plus a **daily challenge** seeded by date: a trick plus a condition.
  - Progress is kept in localStorage.

## 8. The Tower (level)

Golden hour: a low sun at the west, warm light, long shadows, a hazy city
skyline, and the sea around the pier. It is never dark. Each zone is an
arena or a sequence of encounters. The tower footprint is about 36 × 36 m,
centred near (0, 0, 40).

| Zone | Height | Content | Lessons |
|---|---|---|---|
| **pier** | y 0 | Quay 80 × 50 m with sea on 3 sides, containers, crates, gatehouse, harbour office, warehouse, a harbour crane with a maintenance catwalk, barge | door (cross a channel), trapdoor (2 unaware guards at the quay edge: tapped from the gap between stack T and row R1 they're thrown on into the sea; from the top of stack T the one further from the edge lands on the quay, knocked down), returnToSender (a lone lookout on the office roof), slingshot (jump from a container stack into an air entrance, exit on a wall facing a pair; a sentry on the warehouse roof wakes after), arena (lookouts on stack CA and the crane catwalk, 2 riflemen in cover, the warden) |
| **yard** | y 0–24 | Construction site at the tower base: tower crane with hanging loads (steel beam bundle, container), scaffolding towers, fuel barrels, mixer truck, the hoist | cargo, matador (brute near the pier edge), grenade (postage), shield (warden) |
| **skeleton** | floors y 30 / 36 / 42 | Open steel floors, void at the edges, elevator shaft (a vertical hole through all floors, for loops), scaffolding, a neighbouring crane cab with a sniper | loop, firingLine, arena with brute + wardens + riflemen |
| **lab** | y 60 | Glass-walled floor, Kessler rift gates (reinforcement waves), a server hall, turret, laser curtains | hijack, a plain fight in the server hall (2 riflemen, the electric trench; no lesson, no hint), borrowedGun |
| **crown** | roof y 90 | Helipad, hanging load on a small crane, the helicopter | boss (Voss, 3 phases), then a leap of faith off the roof into a rift to the sea, the end |

- **Progress:** each zone's `exit` lift (a hoist / elevator platform) runs
  when its `requireClear` encounters are cleared. Rifts may also be used to
  climb early; that's freedom, not a bug.
- **Checkpoints:** every zone start and every cleared encounter. Death
  restarts at the last checkpoint in under 1 s.
- **Kill volumes:**
  - Pier and yard: the sea (y < −1.2, splash/drown).
  - Skeleton, lab and crown: the void (falling below `zone.killY` kills
    enemies; the player can save themselves with an air entrance while
    falling). If they don't, they respawn at the checkpoint, taking 30
    damage.

### Holding ground: posts you can't walk to (mission 1)

The §5 roles need places to hold. A *holder*'s post is a perch the player
can't reach on foot, built into the world where a security team would put a
man, with the way he got up in plain view (a roof hatch, a door in a crane
leg). Every other tool reaches him: REFLECT always, a GRAB tap (where you
stand decides: an edge or a wall behind him kills, open roof only knocks him
down and he walks back), a DOOR onto his perch (aimed 2–3 m beside him: an
exit within 1.2 m of a steady man is refused), SWAP or DASH (up to 9 m), then
the blade.

**Perch rules** (checked in `tests/level/tower.test.ts`, `halcyon.test.ts` and `climb.test.ts`):
- *Jump model* (`tests/level/reach.ts`, from `FEEL`): the player stays grounded
  until the ground probe (0.65 r) leaves the edge, runs on through the coyote
  time, jumps at 6.6 m/s under g 22 and lands when the probe reaches the far
  edge: about 4.5 m edge to edge on the level, 4.3 m onto a surface 0.23 m
  higher, 5.9 m from 1.9 m higher, 6.2 m from 2.6 m higher. Mantles reach
  2.75 m up onto a ledge within 1.2 m.
- *Unreachable on foot*: a perch is more than 2.75 m above every foothold
  within 1.2 m (railing tops count), and at least jump reach + 0.5 m from
  every foothold within 7.5 m. The test floods every collider top from the
  pier's starts with that pessimistic reach, and every move needs a clear line
  for the body through rails too.
- *Reachable by every tool*: in sight of his fight's approach and within 24 m
  of its key spots, a portal-friendly floor under him and a face at least
  0.6 m tall under his feet for a DOOR to perch on.
- *Honest*: the collider top is the top you see (±3 cm), no man floats or
  clips a rail, the same colliders on phones, every post a walkable cell of
  a nav layer at its floor. Railings that meet at a corner never share an
  end post (the N/S runs are inset 0.08 m).
- *In the world's own kit*: containers, `railing()`, `lampPole()`, `jersey()`
  and steel, metal, concrete and hazard boxes on the pier; `rail()`, the
  facade vocabulary, trim, iron and gilt in Halcyon (`ironGrille()` and
  `sunburst()` carry its railing up into bars). All merged into the existing
  builders (no new draws or materials).

**The pier's posts** (`pier.ts`; the catwalk in `structure.ts`):

| Fight | Holder's post | Why you can't walk there | What was built |
|---|---|---|---|
| returnToSender | office roof (−31.2, 8, −34), over the container yard | 8 m up; R1's top is 2.8 m below; the NW block's 20ft is 5.8 m off | the cap is now the roof's collider (8.0: it was 7.5 under an 8.0 top), a guard rail round it, the plant box solid, a roof hatch with its lid thrown back, a floodlight on the NE corner lighting the yard |
| slingshot | warehouse roof (22.6, 9.35, −31), facing along the roof toward the crane | 9.35 m up; S top is 13 m away | the metal cap is the roof (9.35), a guard rail, a hatch, two vent units |
| arena (west) | stack CA (−18.5, 5.18, −13.8) | CA is a flat two-high 40ft stack now, 1.5 m further east: 6.2 m from the NW block's 5.18 top, 3.9 m above the crate beside it | CA's top 20ft became a 40ft; the crate moved with it |
| arena (east) | the crane's maintenance catwalk (26.3, 8.8, −5.8) | 8.8 m up on the crane's west legs | a steel grating on a 0.6 m edge girder and a ledger welded to both legs, two cantilever arms with knee braces, the sill beam as its parapet, rails; the NW leg's stair door stands open onto it, the one at its foot is padlocked |

The NW block's top 20ft moved to the outer column (z0 −18): its 7.77 top is
the player's own vantage over the arena (a mantle chain 2.59 / 5.18 / 7.77
from the quay), 20 m from the CA lookout and above him. The rts trigger is
the container yard itself (x −18..−4), so its hint shows as the lookout comes
into view; he is out of range as you round row R1 (28 m), in range at the
checkpoint. The warehouse sentry has his back to stack S and can't see the
pair, the wall's foot or the landing: the slingshot is learned in quiet, and
he wakes to the noise (teach, then twist). The two arena lookouts cover
opposite halves of the floor. The forklift man's fallback is behind a jersey
by the gate (13, 0, −2), 5.3 m back. The catwalk post sits where a GRAB tap
from anywhere on the arena floor throws him over the sill beam into the sea
(2 m further south, the throw from the east entry glanced off the yard's lamp
pole into the yard).

**Halcyon's posts** (`halcyon/mission.ts`; the grilles and the gallery in
`buildings.ts`, the gate in `square.ts`):

| Fight | Post | Why you can't walk there | What was built |
|---|---|---|---|
| returnToSender | an anchor behind bars in the Hall's river colonnade (45.4, 6, 24.5), leash 3 | an iron grille fills every arch from the floor to the Hall above (one see-through collider that refuses rifts) | in each arch the city's railing carried up (bars on a shoe rail, a rail at railing height, a gilt rail, the top rail at the spring) and a ridged gilt sunburst on an iron ring against the soffit; the north slot beside the Loggia House gets a narrow one |
| slingshot | a holder on the Hall's speaker's gallery over the café terrace (30, 12.6, 41.35), facing the Grand Stair | 6.6 m over the terrace; the Loggia roof's lip is 6.8 m off | one bay of the café face: a paved slab with a moulded lip and gilt fillet over a 0.6 m apron, four stepped consoles, an iron rail into slim stone newels, geraniums, ivy; its middle window became a lit French window under Kessler's emblem (`Floor.skip` keeps the facade's other windows as they were) |
| arena (Hall) | a holder on the Hall balcony (19.4, 6, 30.5), behind its locked gate | the gate (4.4 m of bars on a stone pier and a pilaster, a gilt sunburst crest, a chain and padlock) closes the balcony at the café strip; a screen of the same bars replaces the strip's railing, the balcony's railing stops 2 m short of it | the gate and screen; the balcony railing now ends at z 38 |
| arena (podium) | an anchor on the statue's podium by the maple planter (1.5, 7.8, 35.8), leash 4 | reachable on purpose, by the pedestal stair under the balcony's fire | nothing: a nav layer on the podium |

The square's other two anchors hold cover on its floor (behind the trunks at
(−4, 48); by the planter at (12, 16), falling back once to the trunks at
(3, 9)); the warden walks the pod's drop zone. Taps (the level test checks
each): the gallery sentry dies against the Hall wall from the terrace, the
slingshot's landing or the Loggia roof, and only goes down along his gallery
from the stair top; the balcony lookout dies against the Hall wall from the
square and is knocked down along his balcony through the gate from the stair
top (he walks back); the colonnade man dies against its back wall when
tapped through the bars from abeam, and is knocked along it from down the
walkway. A DOOR onto the one-bay gallery goes at its far end, 2 m beside him
(the rails keep the room inside the slim newels for it).

### Mission 1 in two worlds (while the owner picks one)

The main menu's **WORLD** toggle chooses where mission 1 happens: the
**harbour** (the tower above) or **Halcyon**, Kessler's art-deco city of
tomorrow (`src/world/halcyon/`, spec in its `layout.ts`). Halcyon is one zone
with the same id (`pier`), the same five lessons and the same encounter ids,
so challenges, the rules card and the lesson flow are shared; three hints get
city texts (`hint.halcyon.*`). It has its own river (the lethal water, y −2),
a rail cut whose tracks kill (`level.killYAt`), a blue sky
(`atmosphere.sky`), a menu postcard (`level.menuView`) and ends on a train
(`level.missionEnd`: the doors open once the four fights are won; stepping in
wins the run). The toggle rebuilds the level in place (no reload: sandboxed
hosts may block navigation and storage); the pick is kept in
`threshold.world` and `?world=` where the host allows. While Halcyon is
loaded, `t()` prefers `halcyon:<key>` strings (its names for the pier's). To
drop a world: its entry in `src/world/worlds.ts`, its folder and its strings.

The city is built in three chunks (left x > 22, centre, right x < −12), each
one merged mesh per material (lamps, trees and flowers are merged in too), so
whole chunks cull. `halcyon/kit.ts` holds the facade vocabulary (arched and
square windows, shopfronts, cornices, pilasters, balconettes, awnings,
window boxes, banners and signs from one atlas, alpha-cut railings and
balusters, lamps, planters, trunks, ivy and string lights); `square.ts`,
`buildings.ts` and `station.ts` place it on the spec's colliders, which stay
exactly as the grey-box had them (the relief has no colliders). Window
surrounds (`relief`) and small metalwork (`metal`) cast no shadows; masses,
cornices, railings and the vault's ribs (`iron`) do (phones too).

Its look: `statue.ts` is the Spirit of Tomorrow (a robed bronze figure, five
brass ribbons with lit outer edges, the armillary with turning rings and two
orbits of planets; modelled at 1:1 and set up 1.4x on her drum, top +44.5);
`airship.ts` the AURORA over the square (still: the pod hangs from it) and a
second airship cruising round the city; `backdrop.ts` the river's banks, the
Pont d'Or, the Dome of Tomorrow and two stone rail viaducts; `traffic.ts`
the trains on them, river launches, swifts and people on the far quays
(instanced, one draw each). Beyond the level, `render/cityscape.ts` draws the
deco city in one procedural shader: `createNearBackdrop` (the far banks and
the Kessler Spire, in place) and `createDecoSkyline` (towers, glass domes,
the Threshold Tower under construction, snow-capped mountains; with the
harbour skyline's camera parallax). The sky's `puff` layer gives it big
sunlit cumulus; everything else (sun, fill, bloom, grade) is its
`atmosphere`, which also sets what the harbour leaves at its old values: a
rim light on the characters (`rim`: the route walks into the low sun, so
without it every man is a black cut-out; Kessler's men get an orange rim, you
a cream one), a gentler rift pass flash, and a bloom that takes in no pixel
brighter than a lantern (`bloomClamp`: sun glitter on the river and on brass
would veil the frame; phones, whose wide view takes in the low sun, bloom
less still and draw no lamp cones). Leaves glow when the sun is behind them.
Readability beats the painting: nothing navy or near-black stands between
0 and 2.5 m on a wall that faces a fight (the trunks are oxblood and tan, the
pedestal has a cream dado, the stage a red base, the armoured car gunmetal).

Engine rules this world leans on (both worlds get them):
- A world switch frees everything the old world added (its systems' pools,
  instanced meshes' buffers, the characters' bone textures, the sky's
  environment map target; the faded Voss that warms the blink's shaders is
  one for every world): memory stays flat however often the toggle is used.
- A world that fails to build leaves nothing behind: the switch goes back to
  the world that was working, and at boot the harbour is loaded instead (the
  pick is saved only once its world is built).
- A fight in plain view of the routes into it spawns earlier than 22 m
  (`EncounterDef.spawnAhead`): Halcyon's square is manned from the start, the
  café squad as you reach the walkway, so nobody is placed in front of you.
- A floor end that closes on a body part-way through it (a new PORTAL takes
  the pair mid-throw) leaves the body standing on that floor. Thick slabs
  (the city's terraces are 9 m of stone) used to squeeze it out sideways and
  drop it through the world.
- A rift window renders only its own patch of the frame (a tight frustum over
  the window's rectangle): the same pixels, a fraction of the fill.
- Phones get the PC's shadows: the same 2048 map and box (±50 m in Halcyon),
  every caster the PC has (railings, ironwork, paint, leaves), and every
  character with its visor and weapon, at any distance.
- The sun's shadow box moves across the light in whole shadow-map texels
  (`render/shadowbox.ts`): static shadow edges stay on their texels while you
  walk or turn instead of crawling.
- A character is culled against one sphere, its T-pose sphere x1.5: every
  pose, death, fall and tumble stays inside it (the bones' reach, tested).
  The visor shares it (its own small sphere stayed at the T-pose head, so a
  downed man's visor could be culled with his head in view).
- The load warms the shadow pass too: one man of every look (a warden's
  double-sided shield has its own depth program) stands in the sun's box
  while the shaders compile, for each light-set size, so the first fight
  compiles nothing (it used to compile two depth programs).
- Phones start on the `high` preset, the PC's look, at up to 2x their CSS
  resolution (`touchPixelRatio`; a DPR-3 phone used to render a third of its
  pixels per axis and upscale them). Desktops keep their caps (`high` 1.5).
  Saved settings from before (`v` 1) move a phone's old default `medium` to
  `high`. Presets without MSAA (or a device that can't multisample a
  half-float target) get FXAA, with gentler subpixel blending.
- The post chain is two full-resolution passes: the scene (half float, the
  only MSAA target, colour resolve only) and one final pass that adds the
  bloom, runs the world grade and does exposure, ACES and sRGB (what the
  bloom blend, grade and output passes did in three). The bloom itself is
  unchanged: a quarter of the resolution per axis.
- The sky and the skylines draw after the opaque world (same pixels: the sky
  sits at depth 1), so the pixels buildings cover are never shaded twice.
- Rift glows and blast flashes that aren't lit are left out of the light set
  (they'd add exactly 0 to every lit pixel). The set holds none of them, two
  (one rift pair open: the usual case) or all six, so every material has
  three programs, all compiled at load, with a rift and the post chain, into
  targets like the real ones: no shader compiles when the first rift opens.
  Phones get the PC's four rift glows.
- The additive double-sided effects three would draw face by face (the rift
  aiming ring and arrow, blast rings and seams) draw both faces in one pass: a
  sum doesn't depend on the order. (Shader materials, like the lamp cones and
  light shafts, are drawn in one pass by three already.)
- A dynamic-resolution safety net lowers the scene's resolution by 5% steps
  (never below 85% per axis) only after about a second of frames over budget
  because of the GPU, and steps back up when there is room. If the frames at
  the floor are no faster than before the first step (a 30 Hz rAF in iOS Low
  Power Mode or a battery saver: the resolution isn't what limits them), it
  goes back to full resolution and doesn't step down for a minute. Photos and
  clips are full resolution. Settings → Performance overlay shows fps, frame / CPU /
  GPU ms, the render size and scale, draws, triangles and the GPU.
- Phones on `high` and `ultra` build the PC's own world: full-size textures
  and normal maps, alpha-to-coverage foliage and railings, the full skyline,
  backdrop and props, lamp cones and the PC's bloom tuning. `low` and `medium`
  on a phone build the lighter variant (`touchLiteContent`); a desktop builds
  the full world on every preset. The variant is picked when a world is built
  (boot, or the menu's world switch), so a quality change mid-session changes
  the resolution and effects at once and the world's variant at the next build.
- Opaque draws go nearest first (`frontToBack` in `render/renderer.ts`; three
  sorts by material first): a GPU's early depth test then skips most of what
  nearer surfaces cover. Fragments shaded per covered pixel in the opaque pass
  drop from 2.6 to 2.2 in the Halcyon start view, 2.3 to 1.5 in its arena and
  1.8 to 1.2 at the harbour start. Only coincident edges between two meshes
  can resolve differently (a sample or two of a pillar's silhouette).
- Per frame, not per render call: the scene's world matrices are updated once
  (`scene.matrixWorldAutoUpdate` is off; `Game.render` updates them before the
  rift views) and each skeleton's bones are computed and uploaded once
  (`render/frameonce.ts`), however many rift views render them.
- The city's traffic (trains, launches, swifts, walkers) is culled as a whole
  by a fixed sphere round everywhere it goes (tested over a full loop).
- No per-frame garbage from telegraphs or the player's event handlers; the
  laser buffers upload only while there is something to draw; the audio
  listener isn't moved when the camera hasn't.
- Challenge names follow the world (`halcyon:challenge.pier.3.*`: no "Pier
  Pressure" in a city).

## 9. Controls

**Desktop:**

| Input | Action |
|---|---|
| WASD, mouse | Move, look |
| Space | Jump / mantle |
| Shift | Sprint |
| C | Crouch |
| V | SHOVE |
| LMB (hold) | PORTAL: press = entrance, hold = aim the exit (slow motion), let go = exit |
| RMB while holding | Let go without an exit |
| G while holding | Flip the exit (hatch / door) |
| Wheel while holding | Exit distance |
| RMB / 1 | REFLECT |
| Q / 2 (again / hold) | LOOP (geyser / human cannon) |
| E / 3 · mouse back | SWAP |
| R / 4 · mouse forward | DASH |
| X / MMB | CLOSE (shear) |
| F | ACTION (hidden blade / grab / throw / hijack / use lift) |
| Tab | RIFT VISION (routes, cones, outcome icons) |
| Z (hold) | COMBAT LAB, FLOW only: POWER (pad R3; a touch button) |
| T | CLIP |
| K | Photo mode |
| Esc | Pause |

**Gamepad:**

| Button | Action |
|---|---|
| RT (hold) | PORTAL |
| LT | REFLECT (with RT held: let go without an exit) |
| Y | LOOP (with RT held: flip the exit) |
| D-pad ◀ / ▶ | SWAP / DASH (with RT held: exit distance) |
| LB | Close |
| RB | Shove |
| A | Jump |
| X | Action (hidden blade, ...) |
| B | Crouch |
| L3 | Sprint (latches) |
| D-pad ▼ / ▲ | Vision / photo |
| View | Clip |

**Touch:**
- **Left thumb:** the stick (a full push sprints).
- **Right side:** drag to look.
- **Buttons:**
  - **PORTAL** (touch = entrance, drag = aim the exit, lift = exit; a quick
    tap = auto exit; slide onto CANCEL to let go without one). Its caption
    says what a press does now (GRAB / LOAD / DOOR / ...).
  - **The STRIKES bar** (left, above the stick): REFLECT, LOOP (hold it the
    second time to aim the cannon), SWAP, DASH, with the charge pips.
  - **JUMP**
  - **SHOVE**
  - **✕** (tap closes)
  - **ACTION** (context label: HIDDEN BLADE, GRAB, THROW, ...)
  - **⇄** (flip, while holding PORTAL)
  - **CROUCH** (small)
  - **🎬** (when offered)
  - **pause**
- **Lesson hints** (touch only; with mouse and keyboard the pointer is locked
  and a pad can't tap, so small windows keep the full, timed hint box):
  two lines under the pause button for 5 s, then a small **?** tab (25 s).
  A tap on either shows the whole text (a tap folds it; the next hint waits
  while it's open); they step aside while a zone title card plays (on phones
  a 2 s banner at the top, not over the middle of the view). Toasts
  there sit under the strip, one line each, two at most (repeats merge).

## 10. Architecture and ownership

```
src/core/contracts.ts        shared types + LAW              (lead)
src/game/portals.ts          RiftSystem implements RiftQuery (CORE)
src/sim/physics.ts           DynBody physics, rift crossing  (CORE)
src/sim/projectiles.ts       bolts, grenades, beams          (CORE)
src/game/player.ts           player controller on DynBody    (CORE)
src/game/blade.ts            hidden blade: reach, lunge      (lead)
src/actors/enemies.ts (+enemy.ts)  Kessler AI               (ENEMIES)
src/world/nav.ts             multi-floor nav grids           (ENEMIES)
src/world/tower.ts           the level                       (LEVEL)
src/render/fx.ts             golden-hour sky, skyline, lamps (LEVEL)
src/game/characters.ts       animation API + retargeted clips(ANIM)
scripts/extract-anims.mjs, public/assets/anims.json          (ANIM)
src/meta/style.ts replay.ts clip.ts photo.ts challenges.ts   (META)
src/ui/hud.ts menu.ts i18n.ts style.css                      (UI)
src/engine/input.ts touch.ts                                 (UI)
src/engine/audio.ts                                          (AUDIO)
src/game/game.ts, src/main.ts, src/config.ts, props, flow    (lead: integration)
```

Old stealth code (`guards.ts`, `harbor.ts`) is removed at integration.

**Testing:**
- `npm test` (vitest) covers pure logic: physics, crossings, loops, IFF,
  style detection, replay buffer, nav.
- Headless Chromium scenarios check the full game.
- Every module must typecheck under `strict`.

## 11. Performance budget (phones)

- At most 8 active enemies, 40 live bolts (instanced) and 2 rendered portal
  views on medium.
- No runtime light creation: pools only. No shader compiles on a kill frame
  (pre-warm).
- Zones far from the player are hidden (`zoneRoots`).
- Draw calls: static geometry is merged per material per zone.

## 12. Canonical i18n keys (UI writes EN + HE for all of these)

- `zone.<id>.name`, `zone.<id>.sub` for pier, yard, skeleton, lab, crown.
- `hint.<LessonId>` for every LessonId. Optional device variants are
  `hint.<lesson>.touch` and `hint.<lesson>.pad`; t() falls back to the base
  key.
- `rule.1`, `rule.2`, `rule.3`: the three rules, one line each.
- Aim refusals: `aim.tooHigh` (air end above your feet), `aim.range`,
  `aim.los`, `aim.enemyClose`, `aim.space`,
  `aim.noSurface`.
- PORTAL modes: `portal.air`, `portal.grab`, `portal.load`,
  `portal.hijack`, `portal.hole`, `portal.door`; refusals `portal.anchored`,
  `portal.noFloor`, `portal.nowhere`, `portal.loopLow`.
- Entrance refusals: `gate.steady`, `gate.enemyClose`, `gate.noSpace`,
  `gate.range`; `gate.noExit` (HIJACK at a panel with no exit open).
- `outcome.splash`, `outcome.void`, `outcome.skull`, `outcome.stars`,
  `outcome.safe`.
- `prompt.blade`, `prompt.grab`, `prompt.throw`, `prompt.hijack`,
  `prompt.lift`, `prompt.drop`.
- `obj.clear`, `obj.lift`, `obj.boss`, `obj.escape`.
- Rift vision labels: `state.<EnemyState>` (a searching man shows
  `state.suspicious`).
- `toast.checkpoint`, `toast.hijack`, `toast.clipSaved`, `toast.clipFailed`,
  `toast.photoSaved`, `toast.challenge`, `toast.zoneClear`.
- Enemy barks: `bark.contact`, `bark.reload`, `bark.grenade`, `bark.charge`,
  `bark.lost`, `bark.where`, `bark.there`, `bark.mateDown`, `bark.what`,
  `bark.boss1`, `bark.boss2`, `bark.boss3`; men who hold ground (§5 roles):
  `bark.upTop`, `bark.upHere`, `bark.fallback`, `bark.covering`.
- `trick.<TrickId>` and `challenge.<id>.title` / `challenge.<id>.desc`:
  provided by META in `src/meta/strings.ts` (`META_STRINGS = { en, he }`).
  UI merges them through `addStrings`.

## 13. Module entry points (the lead's integration relies on these exactly)

| Module | Entry point |
|---|---|
| CORE | `new RiftSystem(scene, renderer \| null, world, { portalScale, lightCount, maxViews, outcomeAt? })` implements `RiftAPI` (+ `events`, `playerEnds()`, `ghostFigure`, `gateEnds(id)`) |
| CORE | `new Physics(world, rifts, { seaY, isSea, killYAt })` implements `PhysicsAPI` |
| CORE | `new Projectiles(world, rifts, physics, hooks)` implements `ProjectileAPI` |
| CORE | `new Player(char, body)`, `update(dt, input, world, physics, physEv, ev, time)` |
| CORE | `CollisionWorld` gains a broadphase (same API) + `moveCollider(c, dx, dy, dz)` |
| ENEMIES | `new EnemySystem(physics, hooks, makeChar)` implements `EnemyAPI` (+ `setNav`, `onCrossed`, `onImpact`, `onSplash`, `onFellOut`, `enemyOfBody`, `trapTargets`, `boss()`) |
| LEVEL | `buildTower(envMap, mobile, { headless? })` returns `TowerLevel`. `fx.ts`: `createSky()` (uniform `uSunDir`), `createSkyline()`, `LampSystem`, `createBeam` |
| ANIM | `loadAnimLibrary(json, soldierAsset)` returns `AnimLibrary`; `new Character(asset, anims, look)` implements `CharacterAPI`. Looks: hero, rifleman, grenadier, warden, brute, sniper, boss, hologram |
| META | `StyleSystem`, `ReplayRecorder`, `ReplayPlayer(host)`, `ClipExporter`, `PhotoMode`, `ChallengeSystem`, `META_STRINGS` |
| UI | `HUD` implements `HudAPI` (+ `onClip`), `Input` (`Action` from contracts), `TouchControls`, `Menu` (+ `RunStats`, `showChallenges`), `t()` / `addStrings()` |
| AUDIO | `Audio` implements `AudioAPI` |

## 14. The COMBAT LAB (combat variants, side by side)

A third world, `'lab'` (menu: **COMBAT LAB** under the WORLD toggle; `?world=lab`),
built in place like the others. It is a grey-box test range, not a mission: its
wave director brings the fights, and the owner plays the same five waves under
each **combat variant** to choose one.

- **Arena** (`src/world/combatlab.ts`, plan in `combatlab/layout.ts`): a 60 x 58 m
  deck (y 0) in a 4 m measured grid; perimeter walls (6 m) with five gate alcoves
  (Kessler rifts, numbered 01-05); the north edge open over a void (lethal,
  kill line y -9); a pool on the east (lethal water, y -1.2); a raised ring (4 m)
  with 16-step stairs on its west and east sides; two sniper towers T1 / T2 (8.5 m,
  rift access only, their tops portal-able); a free-standing long wall (5 m) for
  flanking exits; cover blocks of 1 m and 2 m; a gantry (not portal-able) with
  two hanging loads; three casks, two crates; the player's pad in the south. (This is the
  `'classic'` range, kept for the other variants. AIM PORTAL, the lab's default, plays in the
  COMPOUND: see below. SEALED panels are dark metal, `noPortal`: a red flash and a buzz where you aim.)
  One zone (`'pier'`, no encounters), nav layers: deck, ring, each tower top.
- **Waves** (`WAVES`, `game/labdirector.ts`): W1 3 rifle anchors; W2 3 anchors + 2
  tower holders; W3 warden + 2 brutes pushing, 2 riflemen (one on the ring);
  W4 sniper + rifleman holding the towers, grenadier, flanking riflemen, a brute,
  a warden; W5 both towers sniping, grenadiers (ring and deck), 2 brutes, a warden,
  3 riflemen. Edge-gate men step out of their gate's rift and walk to their posts;
  drop-gate men appear on their post (a tower top, the ring). All arrive in the
  fight, knowing where you are (`EnemySystem.inform`). 3.5 s before W1, 3 s between
  waves (WAVE CLEAR card, then the WAVE n banner with a countdown).
- **Run**: death respawns you on the pad (1.5 s guard) and the wave goes on; the
  run records it. Enter (or the pause menu) restarts. After W5: the results card.
  Stats (real time): time per wave, total, damage taken, deaths, kills by tool
  (`killTool`: GRAB/THROW, REFLECT, LOOP incl. geyser/cannon, SWAP, DASH, BLADE,
  OTHER), per wave too. Lab kills don't count toward the missions' challenges.
- **Variants** (`src/game/variant.ts`): `current` (the game as it plays today),
  `precision`, `onslaught`, `flow`, `reach`, `aimportal`. **AIM PORTAL is the lab's default and the
  only one its UI offers now** (`LAB_OFFERED`; a saved pick it doesn't offer, REACH included, reads
  back as AIM PORTAL); the other four stay in the code, unreachable from the UI, until the owner
  signs off. No F-keys. The pick is
  the `combatVariant` setting; the pause menu, the main menu and the HUD chip show it.
  Systems read `activeVariant()`: the pick inside the lab, `current` everywhere
  else; `onVariantChange()` notifies. ONSLAUGHT is PRECISION (`precisionOn()`) plus the
  enemy side below; FLOW is ONSLAUGHT (`onslaughtOn()`: its men, waves and dodge rule) plus
  the body and the POWER moment at the end of this section.
- **AIM PORTAL** (the lab's current mechanic, replacing REACH, which the owner rejected as clunky;
  `game/aimportal.ts` — every number in `AIMP` and the pure geometry — with `game/aimmode.ts`,
  `game/aimfx.ts`, `actors/aimai.ts`, `ui/aimhud.ts`; gated on `aimOn()`: the missions and the other
  variants play exactly as before; strikes, lock-on, the blade lunge, SHOVE, POWER and REACH's verbs
  are off; the body is FLOW's). **One rule: a pair of portals. The far one (the EXIT) opens where the
  crosshair points (on a man: right next to him), now; its twin (the ENTRANCE) opens right in front of
  you, on the crosshair. Whatever enters one comes out of the other with its speed. You choose where;
  nothing attacks for you.** (Comfort pass after the owner's playtest: the exit next to a man at any
  range with no modifier, the near twin at arm's length on the crosshair, GO, buffered attacks, a fair
  beat before a man reacts to a portal or to you behind him.)
  - *PORTAL* (RMB / LT / the PORTAL button; no modifier). **The crosshair on a man** (within 3° of his
    body on desktop, 4.5° pad, 7° touch, his body padded 0.35 m and 0.3 m up/down, in sight, up to 45 m:
    `magnetTarget`; the nearest to the crosshair by that leeway wins): a magenta bracket and a ring at his
    feet mark him and a ghost shows the exit; the press opens it **next to him**: 1.3 m from where he will
    be in 0.2 s, standing on his floor, facing him, by default BEHIND him as you see him (the far side;
    his back if he faces away from you; no room there: his left, his right, then over his head). Held on
    him past 0.06 s, the look (mouse flick / R-stick / the drag from PORTAL) picks the side, live, on an
    8-way compass round him: up ABOVE, down BELOW (a floor disc: he drops through it), left / right LEFT /
    RIGHT as the screen has them, the upper diagonals BEHIND, the lower FRONT; let go and it stays. Ctrl /
    MMB held on their own still pick a side first (an alias). **Off a man**: the first surface the ray
    meets within 30 m (a wall: 0.05 m off it; the floor or a ceiling: a 1.4 m disc), else mid-air at 12 m
    (the wheel / a vertical drag on PORTAL: 3-30 m); held past 0.15 s it follows the crosshair. SEALED
    panels and surfaces nearer than 1.6 m refuse. Phone: a tap within 60 px of a man on the screen opens
    next to him; a tap on the plain world opens right there (ignored while a pair is open: a nudge of the
    look thumb is no reason to lose it). One pair, 6 s from let-go, 0.15 s apart; a new one replaces it.
  - *The near twin* opens right in front of you on the crosshair: 1.0 m ahead of your chest (to 1.4 m at a
    sprint; nearer at a wall), 1.3 x 2.1 m (the exit too), centred on where the crosshair ray crosses that
    plane as far as your own body line stays 0.2 m inside it (the camera is over your shoulder), on your
    floor unless the crosshair needs it raised (0.6 m at most, then as far as the crosshair stays 0.3 m
    inside). So the crosshair is always in it and the man you put it by is framed on the crosshair (you see
    his back through it). While it is open it slides sideways with you (a strafe keeps him in it); walking
    at it walks you in (no grace: you cross only moving into its front).
  - *GO* (Q / pad B while a pair is open / the GO button over PORTAL, lit while a pair is open): a 0.12 s
    dash into the near twin's middle; out of the exit at 3.2 m/s along its front (no body-slam), facing
    where it faces, the view turned by the pair's own turn (you look at him); the pair shuts as you come
    out (nothing of it left in your view; a light flash only). A STAB or FIRE pressed during the dash lands
    on arrival (buffer 0.25 s). For 0.35 s after arriving the knife reaches 1 m further (2.8 m) and 2.6 m
    up or down (out over his head: down onto him). A man who sees you vanish and turn up at his side or
    his back has lost you for 0.6 / 0.8 s (he stops, doesn't turn to you, doesn't shoot).
  - *FIRE* (LMB / RT / FIRE): the rifle (24 rounds, 22 a round, 0.14 s, auto-reload 1.4 s), hitscan through
    `raycastThrough`: a round into the near twin leaves the exit (the tracer in two pieces); one that misses
    the near twin flies as ever. *STAB* (F / X / STAB): a man within 1.8 m in front of you (a lunge that
    ends at him), else, a pair open and its near twin within 3.6 m of you, whoever stands within 2.0 m in
    front of the exit: the knife goes through (your hand into the near twin, the blade out of the exit),
    whatever the crosshair is on: you put the exit by him. From behind or the side he dies, from the front
    he parries (the mirror's front is where his shield looks). *PULL* (E / RB / PULL): the man within
    2.5 m in front of the exit is yanked through (0.18 s) onto your crosshair 2 m ahead, staggered 1.2 s;
    the pair shuts; for 0.6 s PULL or FIRE THROWS him (18 m/s, lofted): a wall at 12 m/s or a fall of 8 m
    kills, the void or the pool; softer hurts. Men who walk or drop into an end come out of the other (out
    of your near twin: at 1.2 m/s, in front of you, staggered: a drop under his feet brings him to your
    knife). Enemy rounds cross the pair too.
  - *The three men* (`AimAI`; `LabSpawn.aim`): GUNNER (60 hp): hides behind cover and peeks, a red
    laser 0.5 s then a burst of 3 (12 each), at most 2 guns on you and never two laser locks within
    0.8 s; MIRROR (70 hp, a violet portal-shield 1.5 m in front of him, 1.5 x 2 m): eats every round
    from the front (30% come back at you) and parries the knife; he keeps the shield on you
    (140°/s) but turns it toward where a round through a portal came from; he walks at you (2.2 m/s) and
    bashes up close (18, 0.6 s wind-up); RUSHER (50 hp): runs at you (6.4 m/s), a red wind-up 0.45 s, 25;
    from afar he steps through a red portal of his own (0.5 s of warning) out next to you. They notice a
    new exit in front of their eyes within 8 m after 0.35 s, at their side after 0.6 s, behind them after
    0.8 s (within 4 m: they hear it) — a shout, they turn to it; a gunner may fire into it (a laser to the
    exit and one out of the near twin at you). A man on a platform with no line to you comes down.
  - *The COMPOUND* (AIM PORTAL's arena; `world/combatlab/compound.ts` is the data — axis-aligned boxes the
    builder, the tests and the AI all read; the old range with its towers, ring and long wall stays in
    `layout.ts` as `arena: 'classic'` for the other variants). The same 60 x 58 m deck, void edge, pool,
    pad and gates, built as a place to HIDE: a 3 x 3 of complexes inside a 3 m ring road, 6 m streets
    between them: **A** the landing (the pad's walled court, four ways out), **B** the SW yard (a dead-end
    pocket, an L-cell, a perch P3), **C** the compound (four rooms round a hall, doors offset so no line
    runs through), **D** the west barracks (an L), its lane and a kiosk, **E** the NW court (3 m walls,
    P1 looks over them), **F** the north hall (a sealed mid wall), **G** the NE terrace (P2, pillars, a
    pocket), **H** the east lane (a dead end), the shore of the pool and the SE yard (baffles). Walls
    are 0.5 m thick, 3.5-4.5 m tall (`noMantle`: out of the jump + mantle's reach; the way up is the
    perches' 13-step stairs, `noMantle` too), with doors (3 m, amber jamb lights, nav-safe on the lab's
    0.5 m nav cell), **windows** (sill 0.9, head 2.0: a man's eye sees through; orange frame) and
    **slits** (0.4 m wide), 1.2 m cover, pillar rows, three 3.2 m perches with 1.2 m parapets.
    Four SEALED pieces (a pocket's back panel, the NE pocket's, the east lane's end, the north hall's
    mid wall) refuse portals; every other wall takes them (under 1 m in 12 is sealed). Wall tops are
    bright capped ledges (a floor exit fits on one), zone letters A-H are stencilled big on the floor
    (they read from a perch). One merged mesh per material: the draw calls are the old arena's (about
    65 a frame, 61-70 against the old 64-70); a frame's triangles 108-132k against 82-105k, the bundle
    +23 kB. **Sight is broken everywhere**: from no spot (grid of 1.5 m,
    perches included) can you see more than 35% of the 25 posts (the test pins it; the worst is a perch
    at 8 of 25), the average spot sees 2.4. **How you get a man you can't see**: (a) peek through a
    window or a slit, the crosshair on him, PORTAL puts the exit behind him, GO, stab; (b) aim at a
    surface you *can* see past a wall (through a window, over a 1.2 m wall, from a perch: a far face,
    the floor on his side), walk out of it; (c) he does it to you. Every post has a flank (the test:
    a spot where he is hidden but floor beside him is seen and takes a portal).
  - *What the men know* (`aimai.ts`, `AIMP.intel`): nobody is told where you are. A man starts on his
    post (HOLD, 4-9 s) believing you are where the fight started, then walks to where he last SAW you
    or HEARD you (6.5 m, through a wall); there nothing: he SEARCHES (three spots 3-8 m round it, a
    look at each). 12 s without news and he gets a hunch (your place give or take 5 m, new every 4 s):
    a wave can't stall (the last two men are still marked on the screen). Cover is chosen by the walk (a spot behind a wall that is a long
    way round is skipped: `EnemySystem.pathLength`), a man 5 s without getting anywhere takes another
    way, a man on a perch who has no line to you for 4.5 s (a glimpse only eases it) jumps down.
    **Round the wall by a portal**: a man who has had no sight of you for 5 s (a man who never has: 18 s
    into the wave) may open a red portal of his own whose exit is BEHIND you (a rusher 3.6 m, a gunner
    5.5 m; floor you could stand on, a clear line to you): 0.5 s to open, an arrow on the screen's edge
    while it is out of your view, then he steps through: a rusher's blow follows its 0.45 s wind-up, a
    gunner must turn to you (0.55 s) before his 0.5 s laser. About 1.4 s from the portal's opening to a blow
    (measured). Fair: one red portal at a time, 5 s apart.
  - *Waves* (`AIM_WAVES_C`, 3-2-1 first 2 s then 1.8 s; men stand on their posts through the countdown):
    3 gunners, 3 gunners + a mirror, + two rushers, two mirrors, 8 (perch men included).
    *Measured* (headless Chromium, the human-like bot: 0.45-0.6 s reaction, 0.5 deg of aim error, a walk
    over the nav grid to the nearest unvisited post, the verbs by taste): 12 runs (8 seeds mixed, rifle
    only, FIRE only, STAB only, GO only), all five waves done in 90-129 s (a wave 12-41 s, never 20 s
    without a kill: the longest stretch between two kills 7.5-17 s), 0-1 deaths, 97-286 damage; 0-4
    red-portal ambushes and 0-3 perch descents a run; a passive hero on the pad dies at 16.4 s. A
    camping hero (stands in the SW pocket and takes it) is flanked by a portal once or twice a wave.
    Hero 100 hp, regen only after 4 s unhurt. KILLS BY TOOL: RIFLE, KNIFE, THROW, PORTAL (the pair
    dropped or slammed him), OTHER. No clip offer mid-fight in the lab (its phone button sat in the look
    thumb's way).
  - *CHAIN* (the add-on, NOT the game: R / pad Y / the small CHAIN button over PULL; lab-only, gated on
    `aimOn()`; `AimMode.chain`, `CHAIN` in `aimportal.ts`). CHAIN starts a chain; each PORTAL after it adds
    the next link at the surface under the crosshair, four links at most counting the pair (its near
    twin and exit are links 1 and 2; a link needs a surface, 1.6 m from the others, not sealed; mid-air
    is refused). Go into the near twin (walk, GO) and you come out of the exit as ever; the chain
    carries you on, 0.1 s later out of the next link, and the next, your speed kept (never less than
    GO's 3.2 m/s), facing out of each. A hop with no room out of the link (`chainArrival`: 0.6 / 0.9 /
    1.2 m out, a body's room) stops the chain where you are, on solid ground. The chain's gold links are
    drawn by `AimFx` (the pair stays the rift system's). The chain shuts 8 s after its last link, on
    CHAIN again, on your death, or on a new pair after a full / used chain (opening a pair while it is
    still being placed is its first link). Rounds, stabs and pulls go through the pair as ever; the HUD
    shows `CHAIN 3/4` and its pips. Tests: order, the limit, close rules, momentum, gating, no soft-lock.
  - *Controls*. Desktop: mouse aim, RMB PORTAL (on a man: next to him; hold + flick: his side; off a man:
    hold to re-aim live), LMB fire, F stab, Q GO, E pull / throw, wheel mid-air distance, Ctrl / MMB the side
    key (alias), Space jump / double jump, C slide, Shift sprint. Pad: LT portal (+ R-stick held: side), RT
    fire, X stab, B GO (while a pair is open; else slide), RB pull / throw. Phone (landscape; right
    cluster: PORTAL and FIRE at the bottom, GO over PORTAL, STAB over FIRE, PULL left of PORTAL, SLIDE and
    JUMP on the right; the chips by the crosshair sit left of it): PORTAL (tap; drag toward a side), FIRE
    (drag from it to aim), STAB, GO, PULL, JUMP, SLIDE; a tap on (or near) a man opens next to him. One tip
    line at the first GO of the fight.
  - *Measured* (headless Chromium, real mouse / CDP touch, a man at 8 / 20 / 32 m, 0.25 s between inputs,
    first input to his death): PORTAL + FIRE 0.60-0.62 s, PORTAL + STAB 0.32-0.33 s, PORTAL + GO + STAB
    0.58 s, PORTAL held + flick BELOW + STAB 0.43-0.48 s, desktop and phone, standing or on the move (the
    old build: plain PORTAL put the exit 8-20 m from him; with the old SNAP key a moving man walked out of
    the 1.5 m knife and the walk-in slammed him down, 1.0-1.3 s or never).
- **REACH** (the approved core mechanic; `game/reach.ts` — every number in `REACH` — with
  `game/weapons.ts`, `game/reachmode.ts`, `game/reachfx.ts`, `actors/reachai.ts`, `ui/reachhud.ts`;
  gated on `reachOn()`, so the missions and the other variants play exactly as before).
  **One rule: you open a window; what you do in front of you happens at the window.**
  - *WINDOW* (hold RMB / LT / WINDOW; the touch button's drag aims). A ghost window (its outline,
    a chevron the way it faces, a line down to the floor) stands where you aim: on the first wall
    (0.6 m in front of it), on the floor (standing on the spot), else in mid-air at 30 m; the wheel
    sets a mid-air distance (3-30 m, 1.5 m a step; a new hold starts from the aim's own). Aimed at a
    man it stands 0.9 m past him; at a weapon on the floor, on it. Cyan: it can open; amber: a man
    would see it (HE'LL SEE IT); red: too near you (< 3 m). Let go: it opens there (0.2 s) and its
    twin, the NEAR window, opens 1.4 m in front of you on the crosshair, facing you; the pair is a
    real rift pair (`RiftSystem.openStrike`, both cyan): through the near one you see out of the far
    one. A window looks at the man right by it (past him: back at you, his back in the near window;
    short of him: at his face, and he sees you through it), with nobody by it, at you. One pair at a
    time, 4 s (a new one shuts the old), 0.35 s between; the far one has a cyan frame and a diamond
    readable from anywhere; a bar under the crosshair runs its time down.
  - *HAND* (E / MMB / F / RB / X / HAND), only with a window open; it acts at the far window. The
    arm comes out of it (0.15 s) to what is right by it: ≤1.6 m from its plane (either side), ≤1.0 m
    across, ±1.45 m up. Their red portal first, then the nearest of: a weapon on the floor (it flies
    through to your hand), a man's weapon (DISARM), an unarmed man (PULL: into the far window,
    0.18 s, out of the near one, 0.16 s, landing 2 m in front of you on the crosshair, facing you,
    reeling 1.2 s; the window shuts behind him). Nothing there: a whiff, 0.4 s to recover. A man who
    has NOTICED the window and has it in front of him slaps the hand away / holds on to his gun
    (0.4 s). The chip by the crosshair says what HAND does now (TAKE RIFLE / DISARM / PULL HIM /
    TAKE PORTAL / NOTHING THERE / HE SEES IT), a ring marks it. Their portal: hold HAND, aim, let go:
    its exit is where you aimed (a tap: 3 m in front of you), the chip names the outcome.
  - *WEAPON* (LMB / RT / WEAPON). RIFLE: 12 rounds, 22 a round (double on a reeling man); fired with
    the crosshair on the near window the round comes out of the far one (`raycastThrough`), else
    as ever. KNIFE: a man within 2.3 m in front of you dies of one stab (a lunge); otherwise, with a
    window open, the knife comes out of the far window at the man right by it (≤1.3 m from its plane):
    from behind or the side he dies, from the front he parries (PARRIED); nobody there: a whiff.
  - *BODY*. Walk (or jump) into the near window: out of the far one, your speed kept (the rift
    pair's physics; behind a man, you come out facing his back). Q and the old door portal are gone
    here. The body is FLOW's (run, slide, double jump, wall kick) without the meter or POWER; the
    strikes, PARRY, DODGE, lock-on, the blade lunge, SHOVE and POWER are all off.
  - *They see it* (`REACH.notice`). A far window within 8 m in front of a man's eyes (±60°, in
    sight) for 0.35 s is noticed (he shouts, turns to it for 1.6 s). A rifleman on its facing side
    (he can see you through it) lasers into it (0.55 s; the laser is drawn into the far window and
    out of the near one at you) and fires a burst through it: the rounds come out of the near
    window at you (they stay his: they hurt you, nobody steers them). So: open it behind them, fast.
  - *Weapons on the floor*. Every wave starts with everyone empty-handed and ~1.3 weapons per fighter
    (you included), ~60% rifles, laid out in clusters about as far from your pad as from them; they
    glow (an amber or ice ring, a light pillar). A weapon is whoever's hand TOUCHES it first: a
    hand out of a window getting there, or walking over it with empty hands (1.05 m). Sending a hand
    only marks it; a hand that gets there second comes back empty (TOO LATE). One weapon in hand;
    taking another drops it; a spent rifle is thrown aside; a knife lost over the edge comes back.
  - *Their side* (`ReachAI`; 60 hp; three kinds of man per `LabSpawn.reachRole`: RUSHER — a knife,
    portals in at you; GUNNER — a rifle at range; FLANKER — a rifle and portals round your side).
    A beat (0.35-0.9 s) after GO, then the weapon he likes: walked over, or through a big red window
    of his own (2.2 m tall, a light pillar; 0.45 s open before the hand comes out, 0.25 s out) — a
    race you can see. With you armed and in sight, sometimes your weapon: a red window by your hand,
    0.5 s to get away (1.6 m, or through your window). A rifle keeps 9-18 m and fires bursts of 3
    after a 0.55 s red laser, at most 2 guns on you. A knife runs at you, a 0.45 s red wind-up, 25.
    Their RED PORTALS (one at a time, 3 s apart; 2.3 m tall with a pillar) open over 0.5 s, then he
    braces 0.9 s before stepping in: a rusher's exit 2.6 m from you, a flanker's 9 m out. Your far
    window by one of its ends + HAND takes it. Out of an exit you moved he tumbles (5 m/s): over the
    void or the pool he's gone; 6 m+ over the floor the fall kills him, 3 m+ he reels 2.4 s (25);
    facing a wall within 1.4 m he's slammed into it (30, reeling 1.6 s); for 3 s his own side's rounds
    hit him.
  - *What you can't see* (`ReachMode.threats`): red arrows at the screen's edge for every threat off
    it within 30 m: a gun with its laser on you, a knife within 12 m, a thief (and MOVE), their red
    windows and portals (urgent ones pulse). The lab panel is a compact strip top-left (wave, who's
    left, the clock; the rules card opens itself through W1's start, then folds behind RULES); the
    old mode's STYLE meter, rift pips, score feed, floor distance marks, FLIP button and hints are
    gone here. One tip line at the first GO, gone in 5 s.
  - *Waves* (`REACH_WAVES`): 3, 4, 5, 6, 8 men (later waves mix rushers, gunners and flankers) on
    their posts as the banner comes up, still through a short 3-2-1 (3 s for W1, 2.2 s after the
    CLEAR card), then GO. Death: back at whichever respawn spot is furthest from them. KILLS BY TOOL:
    RIFLE, KNIFE, PORTAL (a redirect: the void, the water, a fall, a slam), OTHER.
  - *Controls*. Desktop: RMB hold WINDOW (wheel: mid-air distance), E / MMB HAND, LMB WEAPON, Space
    jump / double jump, C slide, Shift sprint. Pad: LT WINDOW, RB / X HAND, RT WEAPON. Phone
    (landscape): WINDOW (hold, drag to aim, lift to open), HAND, WEAPON, JUMP and a small SLIDE; a
    thumb's ghost leans onto the spot 1 m behind the man nearest the crosshair (within ~4°, and only
    if it was within 2.6 m of it anyway).
- **PRECISION** (`src/game/precision.ts`; the answer to "the game plays itself"). Nothing
  aims, picks or chases for you; defence and execution are skills:
  - *Manual aim.* Strikes (REFLECT's key aside), a LOOP cannon's catch, and GRAB take only
    the man under the crosshair (`aimedEnemy`): the nearest one the aim ray passes within
    2.5° of his body's axis (never less than his own width, x1.1), in range and in sight;
    a thumb or a pad 4° (x1.35). No "best target", no switching. The crosshair turns red
    on a man a strike / GRAB would take.
  - *GRAB.* Press on a man: the floor end under him (as before). Let go: the exit is where
    the crosshair is then (`aimedThrow`), tap or hold: in front of the man it's on, else a
    launcher end just short of what the aim meets, never short of him + 4 m, along the aim.
    Invalid (a wall in your face) = he climbs out. The hold is x0.5 slow motion for 1.2 s at
    most; the arc and its outcome show while aiming and on the crosshair before the press.
  - *PARRY* (RMB / LT / the REFLECT button, relabelled). A small rift in front of you for
    0.25 s (each catch holds it 0.14 s more, so a burst met on its first round is met
    whole); 0.6 s from press to press; free. Fire from your front (within ~80°) that meets
    it (you, 0.55 m wider) goes back at its shooter: rounds and beams as a charged round
    (44 m/s, homing on him, 60 dmg, a REFLECT kill), grenades lobbed onto him, fused to go
    off on arrival. Outside the window nothing is caught. The first 0.1 s is PERFECT: he
    reels 1.5 s (and the blade finishes him meanwhile). Feel: 60 ms hitstop, the rift
    flares, a screen flash, a ring, sparks, a glassy ring sound, PARRY / PERFECT PARRY.
  - *DODGE* (V / RB / the SHOVE button, relabelled; SHOVE is gone here). Grounded: down
    through a floor rift and up 4.5 m the way you move (back with no input) in 0.2 s
    (0.06 down, 0.14 across, hidden), a 3.2 m/s hop out; untouchable 0.35 s (rounds pass
    through); 0.8 s lockout; only onto floor about your level (±1.2 m), solid all round,
    never over the void or water, never through a wall (else as far as there is floor,
    down to 2 m; none: refused). Come up within 3.2 m behind a man (>105° off his facing):
    he staggers 0.9 s and is exposed 1.4 s. A pip left of the crosshair shows the lockout.
  - *BLADE.* Reach only (no lunge). It finishes the exposed: behind him (>95°), reeling,
    down, unaware, held, or marked by a dodge / a PERFECT parry: FINISHER (140 ms hitstop,
    0.55 s at x0.3, a flare). A man on his guard facing you (or a brute's charge) turns it
    aside: a clang, he reels 0.35 s (armour doesn't), you're pushed off at 5 m/s.
  - *Danger.* No health regen while anyone is on to you; a cleared wave heals you in full.
    The kill heal stays 15.
  - *HUD.* The lab panel's PRECISION RULES card (one line per key, the key per device,
    EN + HE); the red crosshair; the dodge pip; the PARRY / FINISHER / GUARDED callouts;
    the strike bar's REFLECT button reads PARRY.
- **ONSLAUGHT** (`src/actors/onslaught.ts`, numbers `ONS` in `actors/tuning.ts`; the answer to
  "enemies don't really fight"). PRECISION's tools, and an enemy side that attacks in clear,
  telegraphed, varied patterns. Only men spawned with `SpawnDef.onslaught` (the lab's spawner sets
  it under ONSLAUGHT) read any of it; everyone else, and every other variant, plays as before.
  Colours: **RED** = melee (dodge it), **ORANGE** = gunfire (parry it); in ONSLAUGHT both are drawn
  solid and wide (an additive line washes out on the lab's pale floor), CURRENT's lasers are untouched.
  - *STORMER* (a rifleman, `archetype: 'stormer'`, rust red, gun down, 55 hp). Sprints in at
    6.4 m/s zig-zagging (±0.6 rad) on an open line, the nav's way round anything else; the first
    time he's close he circles you 1.4-2.4 s (size-up). His blow: a 0.45 s RED wind-up (strike clip,
    a red flash and ring, a red line; tracking you until its last 0.18 s, then a 4.5 m/s step in),
    25 and an 8 m/s knock back within 2.3 m. Dodged (or out of reach): a whiff, open 0.8 s (the
    blade finishes him). After a blow he springs back out of reach (0.8 s), then circles you at
    5.5 m until his next turn (1.4-2.4 s cooldown) and dashes in. Comes in pairs from two sides.
  - *SUPPRESSOR* (a rifleman, `archetype: 'suppressor'`, olive with an orange visor, 120 hp,
    kneels to fire). An ORANGE 0.7 s lock, then 8-10 rounds 0.13 s apart; his aim walks onto you
    at 3.2 m/s (keep moving and it trails; stand and it finds you): every round parryable. He lays
    fire on your cover (no sight of you) while the squad has word of you. A chest plate: returned
    rounds from his front (±70°) do 40% (a PERFECT parry and the blade, a flank, a GRAB answer him).
  - *WARDEN.* A shield rush from 3.5-10 m on an open line: a 0.55 s RED wind-up with his lane drawn
    on the floor (edges a body apart, rungs filling in), then 9 m/s for up to 9 m: 20 and a 10 m/s
    knock back. Dodged, run out, stopped by a wall or pulled up at a drop: open 1 s. The close bash
    gets a red 0.45 s wind-up (a whiff: open 0.6 s). His shield still turns parried rounds from
    the front; behind him (a dodge through) he's open as in PRECISION.
  - *BRUTE.* His charge as before (a DOOR in its path sends him through: MATADOR), and a ground
    slam within 3.8 m: a 0.8 s RED double ring (his reach, 4.2 m, and one closing out onto it), then
    30 and a lift to anyone on the ground in it (a jump or a dodge clears it); open 1.2 s after,
    hit or miss.
  - *The squad* (`OnsSquad`, run before the men think). At most 3 guns telegraphing / firing at
    once (2 in DESIGN §5) and 2 melee attackers; every attack books the moment it lands: no two
    within 0.3 s, and melee blows (strikes, bashes, rushes, slams, charges) take turns 2 s apart.
    Pinned (a gun had you, none sees you for 2 s): the stormers flank you, one each side (7 m out),
    the suppressors fire on your cover ("He's pinned! Flank him!", 7 s between orders). A stormer
    down: the nearest man calls it, the suppressors open up (3 s). The radio: whoever can't see you
    hears where you are every 2.5 s (± 3 m): nobody searches or stands down. A gun blind to you 8 s
    widens his ground by 6 m (to 40): he comes out after you. Nobody stands stuck (4 s without
    moving 0.8 m, not meant to stand: he drops his plan; twice, his ground moves a third of the way
    to you). A non-lethal hit rocks him 0.2-0.4 s (hitHead from a high hit, else hitChest; armour
    0.2 s) and breaks a wind-up. Barks: flank, suppress, stormer down, "I'm on him!", shield rush.
  - *Waves* (`ONSLAUGHT_WAVES`; `LabArena.variants.onslaught`, `labWaves(arena, v)`; CURRENT and
    PRECISION keep `WAVES`): O1 2 stormers + a suppressor; O2 + a tower-holder sniper (a ring
    suppressor); O3 a warden + 2 stormers + a suppressor; O4 a brute + a warden + a suppressor +
    2 stormers + a grenadier; O5 ten in two pulses (`LabWave.pulse`: the second 5 come at 25 s, or
    once no more than 2 of the first stand). Grenadiers and snipers fight as in DESIGN §5, under
    the squad's gun cap and booking.
  - *Measured* (headless, a scripted player that reads 65% of attacks with a 0.22 s reaction:
    parry, dodge through, blade finisher): O1-O5 32 / 38 / 45 / 65 / 77 s, 595 damage, 2 deaths;
    with no tools, W1 alone takes 400 damage (4 deaths) a minute.
- **FLOW + POWER** (`src/game/flow.ts`, every number in `FLOW`; the answer to "the variants feel
  the same, only the enemies change"). ONSLAUGHT's fight with a different body; gated on
  `flowOn()`, so CURRENT, PRECISION, ONSLAUGHT and the missions move exactly as before.
  - *Speed.* Walk / sprint x1.5 (4.65 / 9 m/s), ground acceleration 26 (14), air control 0.8
    (0.35); air control turns your flight but never adds speed past max(your speed, the run cap)
    (no air-strafing to 20 m/s). Over the run cap on the ground (a slide, a kick, a rift) and still pushing on, the
    speed bleeds at 4.5 m/s² instead of stopping. Fast running widens the FOV and draws speed
    lines; a landing over 6 m/s thuds (camera shake, dust).
  - *SLIDE* (crouch — C / B / the crouch button — at 5.5 m/s or more; it doesn't toggle crouching):
    +2.6 m/s at once but never past 11.6 m/s (slide after slide doesn't stack), low (camera dips),
    bleeds 5.5 m/s², steers a little, ends under 3.6 m/s or after 1.5 s; a jump out of it keeps the
    speed and adds 1.2 m/s (to the same 11.6 cap); 0.35 s from slide to slide.
  - *Jumps.* One DOUBLE JUMP (7 m/s up, the flight turned 70% toward the stick, speed kept);
    in the air a ledge in reach is mantled first, then a wall within 0.85 m (8 rays, waist high)
    is KICKED off — only a real wall: it must also be there 1.5 m over the floor under you (top
    ≥ 1.6 m; cover, rails and crates give the double jump) and you've been airborne 0.12 s: 6.5 m/s out, 7.2 up, speed along the wall kept, the double jump given back
    (0.22 s between kicks).
  - *Rifts keep your speed* (physics already turns the velocity through, magnitude whole); out
    of a door or wall end FLOW adds x1.12 (never past 18 m/s; floor ends and loops untouched).
  - *POWER meter* (0..1, starts at 0.5 each life; full stays full until spent): per second
    0.0035 per m/s above 2.8 m/s, +0.03 sliding, +0.02 in the air; +0.03 a wall kick, +0.012 a
    double jump, +0.03 a rift crossing, +0.06 a kill (+0.12 in the air, sliding or rift-charged);
    -0.015/s standing still. Sized so active, stylish play fills it from empty in ~25-30 s (a
    movement-only bot: 29 s), plain running in ~1 min.
    A bar above the strike bar (top centre on a phone): READY — hold Z (R3 / the POWER button).
  - *POWER moment.* Full, hold its key: time x0.05 at once (cold drained grade, the camera
    2.8 m further out and 14° wider), every man within 48 m lit, and every lit man on screen is markable
    (no line of sight: rifts take you there). Up to 3: the crosshair snaps to the lit man nearest
    it within 11% of the screen's height (LMB / RT; a thumb by resting it there 0.28 s), and on a
    phone a TAP within 64 px of a man marks him. Portal hints hide meanwhile. Untouchable while it lasts. Let go (or after
    4 s): nothing marked, time runs again (0.8 s lockout, the meter kept); marked, the meter is
    spent and the CHAIN runs on the wall clock: 0.12 s, then one link per 0.22 s at x0.18: a rift
    burst where you stand, you come out 1.1 m past him (else this side; only where there's room
    to stand AND a floor — never over the void or the pool) at 9 m/s (0 if the floor ends 4 m on), he dies (a
    blade kill; a boss takes 150), 90 ms hitstop, a hard shake, a flash, sparks, a ring, a
    vibration, STRIKE n; the camera swings to each dash. After the last: 0.6 s at x0.35.
  - *On a phone* (`engine/touch.ts`, landscape). FLOW adds two buttons to the right cluster:
    **SLIDE** (over JUMP, where the thumb rolls up to; it takes CROUCH's place and is the crouch
    key: at a run it slides, lit gold when fast enough, else it crouches) and **POWER** (above
    DODGE: a ring round it fills with the meter, it pulses gold when full, cyan while held).
    JUMP again in the air: the double jump, or the wall kick by a wall. Hold POWER with the
    right thumb; while it's held every touch off the buttons is a TAP that marks the man under
    it (`Input.taps` → `pickMark`), the rest of the controls fade, the stick doesn't appear;
    drag the POWER thumb to look; let go: the chain. One line on the moves shows once when FLOW
    comes on (after the WAVE banner, gone in ~6 s). The lab panel on a phone is one row of chips
    and the wave line; its rules fold behind a RULES chip (9 s open). The menu's variant picker
    is a 2 x 2 grid of big targets (no F-keys). Checked at 667x375, 844x390, 915x412, 1180x820.
