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
| **pier** | y 0 | Quay 80 × 50 m with sea on 3 sides, containers, crates, gatehouse, a harbour crane, barge | door (cross a channel), trapdoor (2 unaware guards at the quay edge: tapped from the gap between stack T and row R1 they're thrown on into the sea; from the top of stack T the one further from the edge lands on the quay, knocked down), returnToSender (a lone rifleman), slingshot (jump from a container stack into an air entrance, exit on a wall facing a group), arena (4 riflemen + warden) |
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
cornices, railings and the vault's ribs (`iron`) do (on phones only the
masses and the statue).

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
- On phones only a character's body casts a shadow (not its visor, weapon or
  glow strips), and only within 22 m of you; phones without MSAA get FXAA.
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
  `bark.boss1`, `bark.boss2`, `bark.boss3`.
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
