# Comic prototype and test tools (kept for the next session)

- `play4.mjs` - the browser test harness: `ROOT=<folder holding scribble-city> PAGE=v5/index.html MEMGB=13.5 node play4.mjs '<query>' <steps.json> <outPrefix> <w> <h>`.
  Steps: `[{ js, frames?, shot? }]` - each `js` evaluated in the page, then `frames` rendered, then a screenshot `<outPrefix>_<shot>.png`.
  Always under `flock <lock> ...` (one headless browser at a time), and from a snapshot copy of `scribble-city` (tar without v2 v3 v4 v5ab wip).
  The game is slow here (software GPU): load ~1.5 min, each render several seconds - keep runs few and short.
- `panels1.json` .. `panels3.json` - the comic's panels staged in the game (query `test=1&autostart=1&prologue=s3`): the director frozen,
  Danny and Lily placed, moods (`P.feel`), gestures (`P.acting.play`), a fixed camera (`P.shot`), the prologue UI hidden. `uProbe = 1`
  renders without the pens - THAT is why Lily looked different in the comic (no hand-drawn strokes on her face and hair): keep the pens on.
- `comicfx*.py`, `paint.py` - post-processing tried on stills (light print; a Kuwahara "brush" filter: good on backgrounds, it wipes faces).
- `rec.mjs` - records `v5/comic/index.html?rec=1` to video (Playwright); the sounds mixed after with ffmpeg from `window.__timeline`.
- `painterly_test.jpg` - the brush filter test (left: the clean render, right: painted).
