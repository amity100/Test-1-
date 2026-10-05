# DAVID — opening film "הַטּוֹב מִמֶּךָּ" · CUT v6.1 (104.7 s): every cut has a reason

CUT v6 (docs/intro-script-v6.md) stays binding for the concept (the question and the answer) and everything not changed
here. The numbers are in `src/content/introScript.ts` (the shared timing contract).

## The user's notes (5 Oct, after Version 11, verbatim)

> "קודם כל בזמן שרואים את שאול היה כמה קפיצות לדויד זה לא קשור בכלל לא מבין מה זה הקפיצות המהירות האלה..."
>
> "דבר שני כששאול בא לתפוס בבגד של שמואל היה לו חנית ביד החנית פתאום נעלמה"
>
> "דבר שלישי הזקנים של כל הדמויות נראים מודבקים כמו תחפושת וזה פשוט מביך בטירוף ולא נראה מציאותי בכלל"
>
> "דבר רביעי המעברים חלקים מהירים סתם, צריך שיהיה היגיון בטיימינג של המעברים, יש מעברים שהם מהירים בצורה הגיונית ויש
> כאלה שהם סתם ככה פשוט קופצים מדבר לדבר המעברים צריכים להיות הגיוניים"
>
> "דבר אחרון לאחר מכן כשרואים את דוד תופס לכבשה, היד שלו ממש חודרת דרכה, וזה נראה מאוד מוזר ומטריד ולא נראה טבעי"
>
> "זה אמור להיות סופר טבעי, כל התנועות בסרטון"

In English: (1) the quick jumps to David while we see Saul are not connected at all — remove them; (2) when Saul comes to
seize Samuel's garment he had a spear in his hand, and the spear suddenly vanished; (3) the beards of all the characters
look glued on like a costume — embarrassing, not realistic at all; (4) some transitions are fast for no reason — the
timing of the transitions must have logic: some are fast in a logical way, others just jump from thing to thing; (5) when
David takes hold of the sheep his hand really goes through it — strange, disturbing, unnatural. And: every motion in the
film must be super natural.

## What changes

1. **The flashes F1 / F2 are out.** Gilgal runs G1 → G2 → G3 → G4 without interruption; the concept holds without them
   (the question at the start, the answer at the end).
2. **Saul's spear never vanishes.** G3: raised for the roar. G4: lowered at `roarCut`, gripped in his right fist (fingers
   closed round the shaft — the Version 11 frames show an OPEN hand beside a standing shaft) while Samuel speaks. G5a: ON
   SCREEN, as Samuel turns away, Saul's hand opens and the spear falls — it topples, the shaft strikes the dust (`drop`),
   bounces once and lies there; his empty right hand seizes the corner of the me'il. From then on it lies where it fell,
   in every shot where that ground is in frame (G5b, G7): the king's spear in the dust. A dull knock of wood on earth
   under the music at the strike. (Nothing in the text contradicts it; 1 Sam 15:27 says only that he seized the corner
   of the mantle.)
3. **Beards that grow out of the skin.** Every bearded man (Saul, Samuel, the elders, the soldiers, the crowd): no shell,
   no hard edge, no "bib"; density, length and colour falling off naturally into the cheeks and the neck, the skin under
   a beard darkened by roots and shadow, irregular silhouettes, natural colour mixtures (salt and pepper, sun-bleached
   tips, yellowed white around the mouth for the old), self-shadowing, the moustache over the lip with the lips visible,
   the beard moving with the jaw and the wind. The same for the scalp caps (Samuel's grey cap shows as a flat band in
   Version 11).
4. **Every transition has a reason** (the table below) and **every motion is natural** (the rules below).
5. **David's hands touch, never pass through:** the hand on the ewe's back rests ON the wool; the hands under the lamb
   press into the wool. The stretched sling cords at the D3 → D4 cut are a bug.

## The cut and its transitions

| # | shot | s | film | comes in by | the reason |
|---|---|---|---|---|---|
| C0 | cold | 4.7 | 0-4.7 | out of black (0.5 + 0.6) | the film begins |
| T | title | 3.0 | 4.7-7.7 | SMASH to black 0.5 s after the last thread (`snap`), as the corner flies free | a cut on the climax of the action and its sound |
| P1 | land | 6.5 | 7.7-14.2 | out of black (0.3 + 1.0) | after the title: the world before |
| P4 | map-exodus | 10.5 | 14.2-24.7 | MATCH DISSOLVE 1.2 s: the map opens on the same ridges, at the same angle and light as P1's last frame, and soars up and back over the whole region | the land → its story: one continuous rise, no change of direction under the dissolve |
| P6 | philistines | 7.0 | 24.7-31.7 | DISSOLVE 1.0 s: the map's last move sinks toward the glowing Philistine cities; P6 rises out of the dust of their front rank | the cities → their army |
| P7 | elders | 5.0 | 31.7-36.7 | HARD CUT on the drum hit that closes P6's phrase, after the crane has arrived (`settle` 6.4) | the threat → "give us a king"; never in the middle of a move |
| G1 | dust | 4.0 | 36.7-40.7 | HARD CUT on the shofar blast | Samuel turns away (P7 `away`) — the shofar answers: the king |
| G2 | king | 6.0 | 40.7-46.7 | a CUT hidden in a man of the front rank passing close across the lens (G1 `wipe` 3.6) | the army → the man at its head |
| G3 | spear | 5.0 | 46.7-51.7 | CUT ON ACTION: G2's last stride (`lastStep` 5.6) is picked up by G3 from the other angle; he halts at `halt` | continuous time |
| G4 | silence | 6.0 | 51.7-57.7 | CUT ON SOUND AND EYELINE: at G3's end the nearest men's heads begin to turn (`notice` 4.5); the roar breaks off on the cut; G4 opens on what they see — Samuel in the road | why the roar dies |
| G5a | tear | 3.0 | 57.7-60.7 | CUT ON ACTION: 15:26 has been read, Samuel begins to turn (G4 `turnGo` 5.6); G5a continues the same turn from the side — the same positions, Saul a pace from him, the spear in his fist | continuity |
| G5b | tear-insert | 4.0 | 60.7-64.7 | CUT ON ACTION: the fist closes on the wool (G5a `grip` 2.6); the cut ~0.4 s later as the pull begins; G5b continues the pull | the moment of C0, now whole |
| G6 | verdict | 5.5 | 64.7-70.2 | CUT ON ACTION: the corner tears free (`free` 3.0), Samuel stops (`stop` 3.5) and begins to turn back; G6 continues his turn into the close-up | his reaction |
| G7 | saul-alone | 4.0 | 70.2-74.2 | EYELINE CUT: after the last word Samuel's eyes go down (G6 `lookDown` 5.0); G7 is what he sees | the verdict → the man it falls on |
| D1 | figure | 5.5 | 74.2-79.7 | LIGHT 0.8 s: G7's lens rises from Saul into the sun (`flash` 3.55); D1 comes out of the same light | the answer |
| D2 | face | 4.0 | 79.7-83.7 | CUT ON ACTION: a lamb bleats below; at D1 `turn` 5.0 he begins to turn his head; D2 continues the turn — his face into the light | the reveal |
| D3 | watch | 7.0 | 83.7-90.7 | EYELINE CUT: his eyes go down to the flock (D2 `lookDown` 3.3); D3 over his shoulder is what he sees | his flock |
| D4 | horizon | 14.0 | 90.7-104.7 | DISSOLVE 1.0 s (time passes): at D3 `walk` 6.2 he starts down toward them; D4 he walks among them | from watching to working |

Lengths that changed and why: C0 5.0 → 4.7 (the smash on the climax); P4 10.0 → 10.5 and Judg 21:25 3.9 → 4.4 s (nine
words); G4 5.0 → 6.0 and 15:26 3.2 → 4.2 s (nine words — in Version 11 the cut came while it was still being read);
G5a 3.5 → 3.0 (it starts where G4 ends; the cut on the grip); G7 3.0 → 4.0 (a real breath); D3 6.0 → 7.0 and Ps
78:70-71 5.1 → 6.2 s (fourteen words); D3 → D4 a dissolve (the place and the time change).

## Rules of the edit

1. A HARD CUT joins continuous time: the action, the look or the sound goes on across it, and it MATCHES — positions,
   poses, props in hand, screen direction, light. No prop appears or vanishes across a cut; a prop leaves a hand only on
   screen.
2. Every cut has a named reason (an action continued, a look, a sound). The owner of the incoming shot makes its first
   frame continue the outgoing shot's last.
3. A DISSOLVE marks a change of time or place, or the passage between the real land and the map; its length follows the
   speed of the motion it joins.
4. A shot holds until its action and its text are complete, plus a beat (≥ 0.3 s). A verse stays on screen at least
   0.35 s per word + 1.2 s.
5. No cut in the middle of a camera move unless the next shot continues the same motion; a move that ends a shot eases
   out.
6. The sound carries the cut: a phrase or a hit lands on every hard cut; the sound of the next shot may lead it by
   0.2-0.5 s (a J-cut); no musical jump at a cut that the picture does not motivate.

## Rules of motion ("super natural")

1. Real contacts: hands on wool, cloth, staffs and spears touch the surface (no gap, no penetration, fingers closed round
   what they hold); feet planted (no sliding); knees reach the ground.
2. Weight and timing: anticipation before a move, follow-through after it, real acceleration curves; no linear blends
   between poses, no snaps, no pops at a cut.
3. Secondary motion: cloth, hair, beards, tzitzit, plumes and straps move with the body and the wind.
4. Life in every held pose: breath, small shifts of weight, eyes that blink and look with purpose; never frozen, never
   jittering.
5. Animals: real gaits; heads that graze and look up; ears that flick.
6. Props keep their physics: a dropped spear falls and lies; a staff plants and lifts.
7. Proof: 8 fps strips close on every contact and every cut.

## Defects in the Version 11 frames (found in review, all to fix)

- G4: the spear stands beside an OPEN right hand (dev/screens/cut7/w5/keys1280/K055.5.jpg, K057.6.jpg); the first second
  is a large blurred soldier crossing the lens.
- G4 → G5a: G5a starts with Saul ~4 m from Samuel in mid-stride and without the spear; in G4 he stood a pace from him
  holding it.
- G5a: white dashed lines on the ground near Samuel (full_2fps 58.43-59.80).
- G5b: Saul's fist closes in the AIR — the mantle's corner is not in it (K063.0.jpg); grey triangles and dark shards on
  his scale corselet; dark shards on Samuel's white sleeve.
- P7: the speaker's raised sleeve reads as a flat white sheet; his hand is lost in it (K034.0.jpg); Samuel's scalp cap
  shows as a flat grey band (K035.6.jpg).
- D4: the sling cords stretch across the frame at the cut in (cut8/w5/D4_handoff_2fps/h_000_89.70.jpg and the lift
  strip); the hand on the ewe goes into her back (h_001-h_003); dark rectangular patches on his tunic during the lift
  (sheet_after_D4_lift_8fps_close.jpg).
