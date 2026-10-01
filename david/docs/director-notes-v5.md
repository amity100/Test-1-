# Director's notes on CUT v2 as integrated (1 Oct) — the finishing pass

Written by the orchestrator after watching the whole integrated 58 s film frame by frame: 0.3 s steps (≈3.3 fps),
desktop-high, 640×360, dissolves in film time (PostFX.tick, commit 53e7b68 — earlier stepped captures stretched every
dissolve 3–10×), plus the 1280×720 key frames of the cut teammate and the teammates' own strips. Sheets:
`scratchpad/watch/v5sheets/*.jpg`, frames `scratchpad/watch/v5a` (0–27.5 s) and `v5b` (27.5–58 s + hand-off).

**`docs/intro-script-v2.md` stays the binding brief.** The timing contract (shot order, durations, beats,
VERDICT_WORDS) is FROZEN — the score is keyed to it. Everything below is about what is on screen inside those
seconds.

## Verdict

The structure, the length and the rhythm work (58 s; prologue → Gilgal → David → the hook → the title). The best
images are already good: the ridges in valley mist (P1), the army out of the dust (G1), Saul's low-angle stride under
his name card (G2), the spear raised (G3), the title. **But the moments the story hangs on are the weakest shots of
the film** — the tear (G5b), the verdict (G6), the hook (H1–H2) — the prologue's crowds look unfinished (P4, P5),
and the verses still read as subtitles. These are exactly the user's complaints: "not fitting", "static",
"models far from polished", "titles not cinematic", "things that look unfinished".

## The five problems that run through the film

1. **Verses are subtitles.** All five sit bottom-centre at ≈5 % of frame height across bodies and faces: P5 over the
   elders' steps, G3 across Saul's body, G6 across Samuel's beard, D1 across David's staff and tunic, D2 across his
   chest. The G3 verse also runs 0.8 s past the roar cut into the silence (27.5–28.3), which kills the silence.
2. **The story-critical shots fail.** G5b shows a pale limb on sand that reads like a leg and a foot — no hand, no
   cloth, no tear. G6 is 4.5 s of one frame: Samuel's eyes read CLOSED under two white cotton-ball brows, the verse
   lies on his beard, and Saul's coat fills 45 % of the frame as orange roof tiles. H2 shows a whole brown bear
   walking across an open clearing; the "two eyes in the dark" never happen (two specks appear far from its head).
3. **The prologue's people look unfinished.** P4: one bright rectangular mass of identical figures on a flat yellow
   plain, locked camera — a crowd-simulation demo, not a threat. P5: three elders before a huge flat wall with a
   black door frame — "כֹּל זִקְנֵי יִשְׂרָאֵל" (8:4) is not there; a white head blob in the right foreground.
4. **Static holds remain** (rule 1 of the brief: if a frame 1 s later looks the same, the shot is wrong): P1 4.5–7.5
   (the ridges hold almost still for 3 s), P3 (a creeping push, the flock and shepherd invisible), P4 (locked),
   G5a (locked wide), G6 (one frame), D1 (David stands still, no flock in frame), H1 (the lamb a grey lump).
5. **The David shots are front-lit and flat** (an even orange light on the face and tunic). Shot against the low sun
   — silhouette, rim light, haze — they would be cinematic and kinder to faces that still read CG at 3.5 s.

## Shot by shot (what is wrong → what it must be)

### P1 · Flight (0–7.5)
Good: black → the time card resolving → the cloud deck → the dive → the ridges in valley mist at sunrise.
Wrong: after the burst out of the deck (4.5) the camera eases almost to a stop; 4.5–7.5 is a near-still frame. The
deck is one smooth bright sheet with a hard edge. → Keep flying: after the burst the camera keeps a steady forward
glide with a slow bank into the sun and a gentle descent, the nearest ridge sliding under the lens (parallax) until
the dissolve. If cheap, break the deck into puffy tops (noise displacement + self-shadow).

### P3 · Rachel's stone (7.5–10.5)
Good: the standing stone at dawn, the place card. Wrong: nothing moves but a creeping push; the shepherd and his
flock are invisible (hidden by the bushes). → The flock (8–12 sheep) and the shepherd with his staff cross clearly
in front of or just behind the stone, unobstructed, at 10–25 m; grass and branches in the wind; a few birds cross
the sky; a real low dolly through the grass toward the stone (parallax), not a creep.

### P4 · The Philistine host (10.5–13.0) — REDESIGN
Now: one bright block of identical figures filling the frame, flat plain, locked camera. → A long-lens (fov 8–14°)
lateral track at 1.2–1.6 m height beside a COLUMN on a track that runs diagonally toward and past the lens: the
nearest files LARGE and soft in the foreground crossing the frame, the column receding into dust and heat haze,
bronze spear points and helmets catching the sun. Variety and no lockstep (phase, stride, spear angle, head turn).
The look per visual-bible §3.9: clean-shaven, the reed/feather-crown headdress for the rank and file, bronze helmets,
corselets and greaves in the front ranks, kilts, round shields, long straight swords, spears. Harsh light with real
contrast, not flat yellow.

### P5 · Ramah (13.0–17.0) — REDESIGN
Now: three elders, a big flat wall, a black door frame, a white blur in the corner, the verse over the steps. →
"וַיִּתְקַבְּצוּ כֹּל זִקְנֵי יִשְׂרָאֵל וַיָּבֹאוּ אֶל־שְׁמוּאֵל הָרָמָתָה" (8:4): 8–12 elders (grey and white
beards, mantles in undyed wool / brown / dark, head-cloths and headbands, staffs) gathered in a loose arc before
Samuel in the gateway. The camera dollies low through the group: heads and shoulders of elders in the near
foreground left and right (real faces and beards, the near LOD — never a white blob), the speaking elder rising
from the bench and lifting his arm at `rise`, two others turning to each other and nodding, Samuel turning his face
away at `turnAway` (8:6). The gate: wooden doors standing open, a textured lintel beam, the passage in shade. The
verse high over the wall, never over the elders.

### G1 · The army out of the dust (17.0–20.0)
Good. The road reads as dark grey asphalt → hot, pale dusty earth (the Gilgal set's ground tint / grade).

### G2 · Saul's stride (20.0–24.5)
Good — keep it.

### G3 · The spear (24.5–27.5)
Good. The verse → into the dusty sky at frame left (huge negative space), and it must be GONE by 27.4: the roar cut
at 27.5 is clean silence.

### G4 · The silence (27.5–30.5)
Good idea, weak read: Samuel ends at ≈20 % of the frame height; the ranks parting is not seen; a dark elongated
shadow lies in the middle of the road. → Samuel ≥ 35–40 % of the frame height by the end (a closer mark or a
longer lens, the push continuing); the soldiers in the mid-ground visibly stepping aside left and right; his hair
and mantle moving; his step at 2.2. Remove or motivate the dark shadow.

### G5a · The tear, wide (30.5–32.5)
Reads (Samuel turns away, Saul lunges and drops to a knee at the hem) but it is a locked wide and the figures are
small. → Medium-wide two-shot (bodies ≈70 % of frame height), camera at chest height with a slow lateral move;
clear space between the silhouettes until the grab; the armour-bearer stays back.

### G5b · The tear, insert (32.5–35.0, slow motion) — REDESIGN
Now: a pale forearm and hand filling the frame against the sand — it reads as a leg and a foot; the cloth and the
tear are never seen. → **A low close two-shot, not a macro:** camera at 0.5–0.7 m, 1.6–2.2 m from the grip, on
Saul's side of the action line, fov 28–35°, looking slightly up so the bright sky and the low sun sit behind them.
Left half: Saul on his knee, face in profile (anguish, mouth open), arm stretched, the FIST clenched in the dark
wool — fingers and knuckles readable from the side. Right half: Samuel's legs and lower me'il striding away. The
me'il pulled taut on a diagonal from the fist to Samuel. `rip` (0.6): the wool gives along a stepped, frayed line
(visual-bible 3.3); `free` (1.8): the corner WITH ITS TZITZIT (the tekhelet thread visible) comes away in Saul's fist,
the rest of the mantle swings on with Samuel. Rim light on the cloth edge and the hair, dust glowing in the backlight.
If the cloth simulation cannot give a readable rip at this framing, author the corner's separation (a pre-shaped
piece that detaches along a frayed edge) — what matters is that a viewer SEES the wool tear in Saul's hand.

### G6 · The verdict (35.0–39.5) — REDESIGN
Now: one frame for 4.5 s; eyes read closed under cotton-ball brows; verse on the beard; the coat as roof tiles over
45 % of the frame. → Medium close-up on Samuel, 3/4 front, eye level, **the sun behind him** (rim light through the
white hair and beard, the face in a soft warm fill — the 'verdict' face rig), the background soft. Saul only as a
dark soft edge (head and shoulder) at frame left, ≤ 20 % of the frame — or a clean single. A slow push (5–8 %) with
a slight handheld drift. Samuel: **eyes open and locked on Saul** (just off-lens to the left), blinks, the jaw and
lips speaking on VERDICT_WORDS, a slight tilt, hair and beard moving in the wind (the hair sim on). Brows: natural
white brow hair (thin, groomed strands), never cotton balls. The verse in the upper-left negative space.

### G7 · Saul alone (39.5–41.5)
Composition works (a tilt from the fist to his face). Wrong: the scale coat reads as gold sequins / coins filling the
frame; the torn piece is not readable in his hand. → Start on the fist with the torn corner and its tzitzit (dark
wool, the tekhelet thread) readable against the coat, rack focus to his face looking down, breathing. The coat
(models): aged dark bronze with dusty patina, smaller scales in tighter overlapping rows, far less per-scale sparkle.

### Light-flash (41.5): good.

### D1 · David from behind (41.5–45.5)
A good wide (golden hills, David on the ridge, short chestnut curls exactly as approved) but: David stands still, the
flock is not in frame, the verse lies across his staff and tunic, flat front light. → Shoot **against the low sun**:
David on the rock as a rim-lit silhouette, the flock IN FRAME below and around him (8–14 sheep within 4–15 m of the
lens, grazing and moving), wind in the grass, his tunic and curls; his weight shifting onto the staff, the head
following the flock; the camera's crane/orbit with real parallax (grass or a branch near the lens). The verse
"וּנְתָנָהּ לְרֵעֲךָ הַטּוֹב מִמֶּךָּ" in the sky, its last two words — the film's own title — set in gold.

### D2 · David's face (45.5–49.0)
The face reads CG in even orange front light; he looks up and then straight at the lens. → **Backlit**: the sun behind
him (rim on the curls, the ear, the cheek), the face in a soft fill, shallow focus; the turn of the head INTO the
light at `turn` (a 3/4 profile catching the sun), a blink, the eyes settling on the distance — never a stare into the
lens. The verse at frame left at mid height, never over the face.

### H1 · The thicket (49.0–51.5)
The lamb reads as a grey lump among flat yellow "sticks" (grass cards). → The lamb close enough to read (≈20–25 % of
the frame height: face, ears, legs), grazing, then the head lifting at `lambHead`, ears twitching; dense dark bushes
and branches behind it (not flat cards), the light dimming (a cloud shadow), a few birds flying off at `birdsStop`.

### H2 · The eyes (51.5–53.0) — REDESIGN
Now: a brown bear walking in an open clearing, two specks far from its head. → Near-black: the inside of the thicket,
foliage silhouettes, leaves shivering with a breath; at `eyesOpen` two amber eyes open (eye-shine on the bear's real
eyes — `bear.model.eyeShine` — or sprites locked exactly to its eyes) behind the leaves; the bear's body NOT seen
(darkness / foliage / an albedo multiplier in this take). Faint amber, never red (visual-bible 3.15).

### Title (53.0–58.0)
Classy, but the Hebrew name is tiny under a huge English DAVID — the film is Hebrew. → **דָּוִד** is the hero
(very large, the gold metal treatment, Frank Ruhl Libre), DAVID small and letter-spaced as the secondary line, then
the rule and *פֶּרֶק רִאשׁוֹן · הָרֹעֶה*. Keep the timing beats.

### Hand-off: good.

## Typography of the verses (applies to all five)

* Placed per shot in the composition's NEGATIVE SPACE (sky, dark ground, soft background) — never across a face,
  a body or the action. Give every verse text event an explicit anchor in `introScript.ts` (e.g. upper-left,
  upper-right, high-centre, mid-left) chosen by looking at that shot's frames.
* ≈1.35× the current size (desktop ≈4vw, phones ≥ 22 px), weight 400–500, warm ivory, generous line height; long
  verses broken into two balanced lines (presentation only — the words come unchanged from the catalog).
* Word by word as now; the reference small and letter-spaced after the words.
* No verse may cross a hard cut except the planned 15:28 split G6 → D1.
* Phones: portrait and landscape rules; inside the safe areas; above the letterbox.

## Models seen in the integrated film (for the models teammate)

* Samuel: the brows (two dense white patches) → natural brow hair; the lids/eyes must read OPEN at 640×360 in G6.
* Saul's coat in close-ups (G6 foreground, G7): roof tiles / sequins → aged dark bronze, smaller scales in tighter
  overlapping rows, much less per-scale specular sparkle, patina and dust in the overlaps.
* The torn corner: dark wool, a frayed edge, the tzitzit with one tekhelet thread — readable in a fist.
* The Philistines (P4): the look of visual-bible §3.9 and variety (no clones); the elders (P5): real faces, beards,
  varied mantles and head coverings at the near LOD.
* The lamb (H1): reads as a lamb at 20–25 % of frame height (face, ears, legs, dirty off-white wool with shading).
* David (D1/D2): keep the approved likeness, hair length and colour; make the skin hold up under backlight and rim.
