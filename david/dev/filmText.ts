// Film text harness (cut3): the opening film's on-screen texts with the real UI + CSS, frozen at a chosen moment over
// a background frame — legibility / layout checks on phone frames without WebGL.
//   dev/filmText.html?shot=<IntroShotId>&at=<seconds into the shot>&bg=<image url>   (title: shot=title)
import { UI } from '../src/ui/UI';
import { INTRO_SHOTS } from '../src/content/introScript';
import { narration } from '../src/content/introNarration';
import { verseArgs } from '../src/content/sources';

const q = new URLSearchParams(location.search);
const shotId = q.get('shot') ?? 'verdict';
const at = Number(q.get('at') ?? 2);
const bg = q.get('bg');
if (bg) (document.getElementById('bg') as HTMLDivElement).style.backgroundImage = `url(${bg})`;
const ui = new UI(document.body, q.get('touch') === '1');
ui.dismissLoading();
ui.fade(0, 0);
ui.filmMode(true);
ui.letterbox(true, true);
// the renderer's 2.39 bars (PostFX caps: portrait 10 %, landscape 13 %)
const aspect = innerWidth / innerHeight;
const frac = Math.min(aspect < 1 ? 0.1 : 0.13, Math.max(0, (1 - aspect / 2.39) / 2));
ui.setBars(frac);
for (const id of ['bt', 'bb']) (document.getElementById(id) as HTMLDivElement).style.height = `${frac * 100}vh`;

const els: HTMLElement[] = [];
if (shotId === 'title') {
  ui.titleCard(true);
  els.push(ui.titleElement);
} else {
  // every text event alive at `at` (texts of the previous shot that run into this one included)
  let start = 0;
  const starts = new Map<string, number>();
  for (const s of INTRO_SHOTS) {
    starts.set(s.id, start);
    start += s.dur;
  }
  const T = (starts.get(shotId) ?? 0) + at;
  let t0 = 0;
  for (const s of INTRO_SHOTS) {
    for (const x of s.text ?? []) {
      const ts = t0 + x.at;
      if (T < ts || T > ts + x.seconds) continue;
      const o = { side: x.side, v: x.v, lines: x.lines, gold: x.gold, stagger: x.stagger, refAfter: x.refAfter, words: x.words ? x.words.map((w) => Math.max(0, w.t - x.at)) : undefined };
      let e: HTMLElement;
      if (x.kind === 'verse' && x.quote) {
        const [text, ref] = verseArgs(x.quote);
        e = ui.filmText('verse', text, ref, x.seconds, 0, false, o);
      } else {
        const ids = x.narration ?? [];
        e = ui.filmText(x.kind, narration(ids[0]), ids[1] ? narration(ids[1]) : '', x.seconds, 0, false, o);
      }
      e.dataset.el = String(T - ts);
      els.push(e);
    }
    t0 += s.dur;
  }
}
// freeze every animation at its moment
requestAnimationFrame(() => {
  for (const e of els) {
    const el = e === ui.titleElement ? at : Number(e.dataset.el ?? at);
    for (const a of e.getAnimations({ subtree: true })) {
      a.pause();
      a.currentTime = el * 1000;
    }
  }
  (window as unknown as Record<string, unknown>).__textReady = true;
});
