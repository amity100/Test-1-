# DAVID — opening film "הַטּוֹב מִמֶּךָּ" · CUT v4 (59 s): the logo over the panorama

**This document changes only the END of CUT v3 (`docs/intro-script-v3.md`).** Scenes 1–4 (Gilgal → Saul alone,
0–39 s) and D1–D2 (David, 39–49 s) stay exactly as they are; everything else of v3, v2, director-notes-v5 and the
visual bible stays binding.

## The user's request (2 Oct, verbatim)

> "שיפור לסרטון יחסית בסוף הסרטון לפני שרואים את הדוב בזמן שרואים את דוד אני רוצה שהמצלמה תראה בצורה קולנועית את
> דוד ואת כל מה שסביב תוך כדי שהוא מסתכל לאופק אל הכבשים והנוף ויהיה כתוב כזה david בכותרת … פשוט פתיח סינמטי כזה עוד
> כמה שניות שרואים את הדמות שלו של דויד ואז מתחיל כאילו המשחק, קטע אפי כזה כמו שהיה ב-Assassin's Creed 2 כששני האחים
> על הגג ומדברים ואז יש את הלוגו של תחילת המשחק … שיהיה יפה ומהמם… כמובן גם המוזיקה צריכה להיות בהתאם. את הסרטון עם
> הדוב צריך לראות אחרי זה, אחרי שמתחילים לשחק."

So: (1) the film ends on an epic, cinematic introduction of David — the camera shows him and everything around him
while he looks out to the horizon, at his flock and the land — and the game's logo **DAVID** appears over that
panorama, then the game begins (the reference: the end of Assassin's Creed 2's prologue — the brothers on the roof at
sunset over Florence, the camera pulling away over the city, the logo); (2) the music rises with it; (3) the bear (the
thicket and the eyes) leaves the film and opens the bear's attack in gameplay.

## The new end (written into `src/content/introScript.ts`)

| Shot | Set : take | Start | Dur | Beats | What |
|---|---|---|---|---|---|
| D1 | world : `figure` (light cut) | 39.0 | 6.0 | verse 0.6 | unchanged (15:28b, הַטּוֹב מִמֶּךָּ in gold) |
| D2 | world : `face` | 45.0 | 4.0 | turn 0.8 | unchanged (the turn into the light, no text) |
| **D3** | world : **`horizon`** (cut) | 49.0 | **10.0** | rise 0.2 · **logo 3.6** · hebrew 4.6 · chapter 5.6 · logoOut 8.0 · settle 8.0 | **THE LOGO SHOT** — then the game |

Removed: H1, H2 (the thicket and the eyes), the title card over black. Film length 59 s.

### D3 · the logo shot (10 s) — the camera

One long, continuous, sweeping move — the crane of a big game's prologue: it starts close behind David's shoulder (his
curls and the low sun ahead), rises and pulls back and around in a wide arc, and by ≈4 s reveals the whole picture:
David small and proud on the rock, his flock grazing and walking on the slope below him — **the sheep clearly in frame**
(from the high angle the slope below the rock is in view; stage 10–20 sheep there) — and the Bethlehem hills to the
horizon, terraces, olive trees, the haze in the valleys, the low golden sun. The logo forms in the sky. From `settle`
(8.0) the camera glides down and in behind him into exactly the gameplay camera's position and angle, the letterbox
retracts, and at 10.0 the player has control — no cut, no black (the AC2 hand-off).

### The logo

**DAVID** as the game's logo — large, Cinzel, the gold metal treatment, forming from light with one sweep at `logo`;
**דָּוִד** in gold beneath it at `hebrew` (≈45 % of its size, Frank Ruhl Libre); a thin gold rule; *פֶּרֶק רִאשׁוֹן ·
הָרֹעֶה* at `chapter`. Over the picture (the sky), with a soft glow for legibility — never a black card. The lockup fades
from `logoOut`. The loading screen uses the same lockup.

### Performance

David on the rock through D3: looking out over the flock and the land (the head following the flock, then up to the
horizon), the wind in his curls and tunic, his weight on the staff, breathing; at `settle` he is in the gameplay idle
pose so the hand-off is seamless.

### Sound

David's theme (D1–D2: the pipe, the kinnor, the voices) rises into the epic swell of D3: full strings, choir and the
kinnor's ostinato building under the crane, a warm, majestic hit on `logo` (not a smash), the theme's answer under the
Hebrew and the chapter line, then it settles into the game's pastoral music on the hand-off — no silence, no seam.

## The bear in gameplay

The film's hook (CUT v3 H1–H2) now opens the bear's attack (`src/gameplay/Story.ts` `bearAttack`): before the existing
stalk / charge / grab shots, a ≈5 s cinematic: the lamb strays to the edge of the thicket, grazing, the birds fly up and
fall silent, the light dims in the thicket's shade, and two faint amber eyes open in the dark between the bushes (the
bear's eye-shine, its body unseen); then the bear comes out. Its sound: the birds scattering, the hush, a heartbeat, a
low sting on the eyes, then the 'tension' music as now.
