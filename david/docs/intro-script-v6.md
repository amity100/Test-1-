# DAVID — opening film "הַטּוֹב מִמֶּךָּ" · CUT v6 (≈103.6 s): the question and the answer

## The user's notes (4 Oct, after Version 10, verbatim)

> "זה נראה כרגע כמו סרט היסטוריה יש שם יותר מידי קטעים לא מעניינים … זה צריך לרתק ולתפוס את האנשים מהרגע הראשון
> ולהיות וואו ומעניין, ויחד עם זאת גם ענייני"
>
> "צריך להיות יותר סינמטי, פחות צפוי, מעניין ויותר אומנותי ומותח ווואו אבל גם שיראה באמת עבודה סינמטית טובה ולא
> כל פעם סצנה שמובילה אחריה לסצנה אחרת שהגיונית מבחינת זמן"
>
> "ביקשתי שהמוזיקה תמשיך בחלק שרואים את שאול עם כולם — צריך שהיא תמשיך גם במפגש עם שמואל"

His edit of Version 10 (from the storyboard): keep 8-18 (all of Gilgal, D1-D3); cut Bethlehem (2), Rachel's tomb (3) and
the tribes' map (5); change:
- **4, the map:** "connect it to our story — explain how it connects to our story and how we got to David's story,
  something similar happens with the people of Israel — but it can't be too long, a little shorter";
- **6, the Philistines:** "the animation here is most embarrassing and looks very bad — it must be improved to a really,
  really high level of animation and polish";
- **7, Ramah:** "more focused and shorter: because they don't speak, it is annoying to watch people who only move their
  heads for too long — it must be fast and dynamic";
- **12, Samuel and Saul:** "the whole part with Samuel and Saul can't be overly long";
- **19, the lamb and the logo:** "the animation of lifting the lamb must be far more polished, and David must look really
  artistic, busy with his flock and his work as a shepherd — what we see there must be very natural".

## The concept (the orchestrator's proposal, built on his edit)

The film asks one question — **who is "the one better than you"?** — and answers it only at the end.
- **It opens in the middle of its climax:** C0, an extreme close-up in slow motion of a fist tearing a mantle's corner,
  near silence, no context; smash to black; the title הַטּוֹב מִמֶּךָּ in gold — the question.
- **"Before":** the land at dawn, the road out of Egypt drawn as a flock of light (Ps 78:52 "וַיַּסַּע כַּצֹּאן עַמּוֹ"),
  no king in Israel (Judg 21:25), the Philistine host, "give us a king" — fast, each a few seconds.
- **The king:** the shofar, Saul, the roar — and two silent 0.8 s FLASHES of a shepherd whose face we never see (a boy on
  a rock; a young hand on a staff). The king's music never stops (the user).
- **The fall:** Samuel, the tear again — now seen whole and understood — the verdict, Saul alone.
- **The answer:** out of the light, the boy of the flashes: "וּנְתָנָהּ לְרֵעֲךָ הַטּוֹב מִמֶּךָּ"; his face for the first
  time; the flock (Ps 78:70-71 — the psalm of the map); the lamb and the logo; the game.

## The cut (the numbers are in `src/content/introScript.ts` — the shared timing contract)

| # | shot | set : take | s | what |
|---|---|---|---|---|
| C0 | cold | gilgal : tear:macro (→ a light set of its own, `macro`) | 5.0 | the tear, extreme close, very slow motion; near silence |
| T | title | black : title | 3.0 | הַטּוֹב מִמֶּךָּ in gold, centred |
| P1 | land | judah : flight | 6.5 | the best of the dawn flight; the time card |
| P4 | map-exodus | map : exodus | 10.0 | the road out of Egypt as a flock of light (Ps 78:52); the land, no king (Judg 21:25) |
| P6 | philistines | coast : threat | 7.0 | the front rank and the column — top-game animation |
| P7 | elders | ramah : elders | 5.0 | fast: the elder's arm thrust out, 8:5, Samuel's eyes close |
| G1 | dust | gilgal : dustWall | 4.0 | the shofar — Saul's music begins and runs to the tear |
| G2 | king | gilgal : king | 6.0 | Saul's stride |
| F1 | glimpse-rock | world : glimpse:rock | 0.8 | flash: the boy on the rock, a silhouette |
| G3 | spear | gilgal : spearRaised | 5.0 | the spear, the roar |
| F2 | glimpse-hand | world : glimpse:hand | 0.8 | flash: a young hand on a staff |
| G4 | silence | gilgal : silence | 5.0 | Samuel before Saul, 15:26 — the music goes on, darker |
| G5a | tear | gilgal : tear | 3.5 | he turns to go; the grip |
| G5b | tear-insert | gilgal : tear:insert | 4.0 | the tear, slow motion — the cold open understood |
| G6 | verdict | gilgal : verdict | 5.5 | 15:28a |
| G7 | saul-alone | gilgal : saulAlone | 3.0 | the torn piece; the light |
| D1 | figure | world : figure | 5.5 | the boy on the rock; 15:28b |
| D2 | face | world : face | 4.0 | his face — first time |
| D3 | watch | world : watch | 6.0 | the flock; Ps 78:70-71 |
| D4 | horizon | world : horizon | 14.0 | the shepherd at work, the lamb, the logo, into the game |

## Rules
- Fewer words: no place card for Ramah; no 13:19; only the verses that carry the question and the answer.
- Every shot ends on motion; every cut has a reason (a sound, a movement, a match).
- The music: one line of Saul's music from G1 to G5b (peak at the tear), darker under Samuel — never a hush; the flashes
  are visual only.
- Phones: the same cut; portrait framings for every new shot.
- Loading: the film starts on C0 — it must not need the Gilgal set (a small `macro` set); the scheduler's deadlines follow
  the new timeline (Gilgal by 36.5 s).
