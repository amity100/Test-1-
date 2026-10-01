# DAVID — opening film "הַטּוֹב מִמֶּךָּ" · CUT v3 (60 s, six scenes)

**This document replaces the shot list and the timing contract of `docs/intro-script-v2.md`.** Everything else of v2
stays binding (the typography system, the performances and models briefs, the accuracy rules), together with
`docs/director-notes-v5.md` (what every shot must look like), `docs/visual-bible.md` and `docs/intro-script.md`.

## The user's verdict on CUT v2 (verbatim, 1 Oct)

> "עשית את זה מהיר מידי ובחלקים קטנים מידי, אף אחד לא רואה פתיח למשחק שהוא כל כך מהיר… זה טו מאץ' מהיר ותמציתי"

CUT v2 had 17 shots in 58 s (3.4 s per shot): it read as a trailer, not as the opening of a game. Offered three
options, the user chose **"about a minute, only 6 scenes"**: no prologue (no flight, no Rachel's stone, no Philistine
column, no Ramah) — the film opens at Gilgal; six scenes, each one or two long takes; a slow pace with time to look and
to read.

## Rules of this cut

1. **60 s including the title.** Six scenes of 5–12 s; 13 shots in all (3–6.5 s each). Never a shot shorter than 2 s.
2. **Slow, motivated camera**: every move is long and eased across its whole shot (a move must not finish early and
   then hold, and must not rush); the handheld layer subtle. Longer takes mean the motion inside the frame must carry
   the whole shot: people, cloth, hair, dust, light.
3. **Text: only 7 events**, each with time to be read: the time card, הַגִּלְגָּל, שָׁאוּל · מֶלֶךְ יִשְׂרָאֵל, 9:2,
   שְׁמוּאֵל, 15:28a (spoken), 15:28b (over David, הַטּוֹב מִמֶּךָּ in gold). Dropped from v2: 8:5 (Ramah), 16:7 (D2), קֶבֶר
   רָחֵל. No text crosses a cut.
4. Accuracy, the looks and the typography exactly as in v2 / director-notes-v5 (the work of the finishing pass stays).

## The scenes and the timing contract (written into `src/content/introScript.ts` by the orchestrator)

| Scene | Shot | Set : take | Start | Dur | Beats (shot seconds) | Text |
|---|---|---|---|---|---|---|
| 1 Gilgal | G1 | gilgal : `dustWall` (cut `black`, hold 1.5, fade 0.2) | 0.0 | 5.5 | timeCard 0.2 · **shofar 1.5** (the picture comes in on the blast) · horns 2.1 · card 2.8 | time card 0.2 (3.6 s, over black then the picture); הַגִּלְגָּל 2.8 (2.5 s) |
| | G2 | gilgal : `king` (slow motion 0.5) | 5.5 | 6.5 | card 1.0 · headTurn 3.6 | שָׁאוּל · מֶלֶךְ יִשְׂרָאֵל 1.0 (3.6 s) |
| 2 The spear and the silence | G3 | gilgal : `spearRaised` | 12.0 | 5.0 | halt 0.6 · spearUp 1.3 · **roar 1.7** (spread 0.5) · verse 2.0 | 9:2 at 2.0 (2.8 s) |
| | G4 | gilgal : `silence` | 17.0 | 4.0 | **roarCut 0** · headsTurn 0.4 · part 1.0 · card 1.6 · step 2.8 | שְׁמוּאֵל 1.6 (2.3 s) |
| 3 The tear | G5a | gilgal : `tear` | 21.0 | 4.0 | turn 0.5 · lunge 2.2 · grip 3.3 | — |
| | G5b | gilgal : `tear:insert` (slow motion 0.35; blocking time = shot time + 4.0) | 25.0 | 5.0 | pull 0.4 · **rip 1.4** · free 3.6 | — |
| 4 The verdict | G6 | gilgal : `verdict` | 30.0 | 6.0 | turnBack 0.5 · speech 1.2 · speechEnd 4.9 (VERDICT_WORDS: 1.2 / 1.68 / 2.3 / 3.1 / 3.72 / 4.46) | 15:28a with the words (to 6.0) |
| | G7 | gilgal : `saulAlone` | 36.0 | 3.0 | lookDown 0.4 · tighten 1.8 · flash 2.75 | — |
| 5 David | D1 | world : `figure` (cut `light` 0.6) | 39.0 | 6.0 | verse 0.6 | 15:28b at 0.6 (5.2 s), stagger 0.45, gold 2 |
| | D2 | world : `face` | 45.0 | 4.0 | turn 0.8 | — |
| 6 The thicket | H1 | world : `thicket` (dissolve 0.8) | 49.0 | 3.0 | birdsStop 0.5 · lambHead 1.8 | — |
| | H2 | world : `lamb` | 52.0 | 2.0 | eyesOpen 0.9 · smash 2.0 | — |
| Title | T | black : `title` (smash) | 54.0 | 6.0 | hit 0 · david 0.3 · hebrew 1.6 · chapter 2.4 | דָּוִד · DAVID · פֶּרֶק רִאשׁוֹן · הָרֹעֶה |

## Performances (what changes with the longer takes)

* **G1** (5.5 s, the picture from 1.5 s): the front rank comes out of the dust toward the lens over 4 s — horns lifted
  and blown at `horns`, the ranks never in lockstep; enough march to fill the shot.
* **G2** (6.5 s, slow motion 0.5 → 3.25 s of action): Saul's stride continuous for the whole shot (no stopping), the
  spear swinging, the head turning over the ranks at `headTurn`.
* **G3** (5 s): the halt at 0.6, the thrust at 1.3, the roar from 1.7 through every rank (staggered 0.5 s) and held to
  the cut — men shouting to each other, spears and fists going up and down, never a frozen pose.
* **G4** (4 s): the freeze, heads turning, the ranks parting, Samuel's step at 2.8.
* **G5a** (4 s): Samuel turns (an old man's turn-step) and walks away; Saul pleads after him — a step, an arm out — then
  lunges and drops to his knee and grips the corner at 3.3; clear space between them until then.
* **G5b** (5 s, slow motion 0.35 → 1.75 s of action): the pull, the rip at `rip`, the corner free at `free`; Samuel walks
  on and stops; Saul sinks back with the piece.
* **G6** (6 s): the turn back, the speech on the slower VERDICT_WORDS, then a held silence with the eyes on Saul.
* **G7** (3 s): the fist, the look down, the breath, the tighten at 1.8.
* **D1** (6 s) / **D2** (4 s): David alive through the longer takes; the turn into the light at 0.8.
* **H1** (3 s) / **H2** (2 s): the lamb grazing → the head up at `lambHead`; the eyes open at `eyesOpen`.

## Sound

The score must be re-composed for this structure (no prologue): from black, a low air and the time card → the
**shofar hit at 1.5 s** with the picture; the army and the drums (score only) under G1; Saul's theme across G2's
6.5 s; the build into the roar at 13.7 s (G3 roar 1.7); the roar held to the hard cut at 17.0 → silence (wind, the far
bleating and lowing of the spoil); the tear (21–30) with the slowed wool rip at 26.4 s; near-silence under the verdict
with one stroke on the last word (34.46 s) and the held silence after it; Saul's falling motif (G7); the warm
light-flash into David (39.0) and David's theme (pipe, kinnor, voices) across 10 s; the birds stopping at 49.5; the
breath and the heartbeat; the eyes at 52.9; the SMASH hit at 54.0; the title motif and the tail into gameplay.
Every hit keyed to the named beats (never hard-coded seconds).
