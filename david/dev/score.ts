// Score harness: renders the opening film's score + sound design offline through AudioEngine.renderOffline (the
// runtime code path), driven exactly like src/gameplay/Intro.ts drives it, and downloads float WAVs. Used by the
// headless verification (dev/screens/score/). Every time comes from the live shot sheet (INTRO_CUES).
import { AudioEngine, type OfflineRenderOptions } from '../src/audio/AudioEngine';
import { INTRO_CUES } from '../src/content/introScript';

type Job = Omit<OfflineRenderOptions, 'script'> & { script: NonNullable<OfflineRenderOptions['script']> };
const STEP = 0.05;
const at = (t: number, t0: number): boolean => t >= t0 && t < t0 + STEP - 1e-9;
const END_T = INTRO_CUES.reduce((m, c) => (c.shot && c.dur !== undefined ? Math.max(m, c.t + c.dur) : m), 0);
const shotT = (id: string): number => (INTRO_CUES.find((c) => c.shot === id) ?? { t: NaN }).t;

/**
 * The film's call pattern (Intro.ts): playIntro at 0, syncIntro(filmClock) every frame, the legacy ambience call and
 * the growl / bleat at the thicket, titleHit on the title, stopIntro(2.5) + ambience('fields') at the end, then
 * Story's music('pastoral', 4). `clock(t)` maps audio time -> film clock (stalls).
 */
function filmCalls(clock: (t: number) => number, skipAt = Infinity) {
  let skipped = false;
  let prev = -1;
  return (e: AudioEngine, t: number): void => {
    if (t === 0) e.playIntro(INTRO_CUES, 0);
    if (skipped) {
      if (at(t, skipAt + 3.4)) e.setMusicMood('pastoral', 4);
      return;
    }
    const f = clock(t);
    e.syncIntro(f);
    const cross = (x: number): boolean => prev < x && f >= x;
    if (cross(shotT('thicket'))) e.setAmbience({ wind: 0.32, cicadas: 0, birds: 0 });
    if (cross(shotT('thicket') + 1.0)) e.sfx('bearGrowl', { volume: 0.28, pitch: 0.7 });
    if (cross(shotT('lamb') + 0.9)) e.sfx('lambBleat', { volume: 0.5 });
    if (cross(shotT('title'))) e.sfx('titleHit');
    if (cross(END_T)) { e.stopIntro(2.5); e.setAmbienceBed('fields', 2); e.setMusicMood('pastoral', 4); }
    if (t >= skipAt) {
      // Intro.end(skipped): no stopIntro while the score plays, the title hit (jumps the score to its title)
      skipped = true;
      e.sfx('titleHit');
      e.setAmbienceBed('fields', 1);
    }
    prev = f;
  };
}
const straight = (t: number): number => t;
/** a 1.4 s picture stall (loading hitch) just before the shofar cut: the film clock stands still, then runs on */
const STALL_AT = shotT('gilgal-dust') - 1.0;
const stalled = (t: number): number => (t < STALL_AT ? t : t < STALL_AT + 1.4 ? STALL_AT : t - 1.4);

const JOBS: Record<string, Job> = {
  film: { seconds: END_T + 7, script: filmCalls(straight) },
  'film-lite': { seconds: END_T + 7, lite: true, script: filmCalls(straight) },
  'film-stall': { seconds: 52, script: filmCalls(stalled) },
  'film-skip': { seconds: 70, script: filmCalls(straight, 60) },
  'bed-heights': { seconds: 14, script: (e, t) => { if (t === 0) e.setAmbienceBed('heights', 0.5); } },
  'bed-coast': { seconds: 14, script: (e, t) => { if (t === 0) e.setAmbienceBed('coast', 0.5); } },
  'bed-gilgal': { seconds: 14, script: (e, t) => { if (t === 0) e.setAmbienceBed('gilgal', 0.5); } },
  'bed-fields': { seconds: 14, script: (e, t) => { if (t === 0) e.setAmbienceBed('fields', 0.5); } },
  'sfx-cinematic': { seconds: 10, script: (e, t) => {
    if (at(t, 0.2)) e.sfx('robeTear');
    if (at(t, 3)) e.sfx('riser');
    if (at(t, 6)) e.sfx('stinger');
  } },
};

function wavF32(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate;
  const data = new ArrayBuffer(44 + n * ch * 4);
  const v = new DataView(data);
  const w = (o: number, s: string): void => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 4, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 3, true); v.setUint16(22, ch, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * ch * 4, true); v.setUint16(32, ch * 4, true); v.setUint16(34, 32, true);
  w(36, 'data'); v.setUint32(40, n * ch * 4, true);
  const chans = Array.from({ length: ch }, (_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { v.setFloat32(o, chans[c][i], true); o += 4; }
  return new Blob([data], { type: 'audio/wav' });
}

async function render(name: string): Promise<Record<string, unknown>> {
  const job = JOBS[name];
  if (!job) throw new Error('unknown job ' + name);
  const t0 = performance.now();
  let maxVoices = 0, sumVoices = 0, nV = 0;
  const script: Job['script'] = (e, t) => { job.script(e, t); const v = e.voices; maxVoices = Math.max(maxVoices, v); sumVoices += v; nV++; };
  const buf = await AudioEngine.renderOffline({ ...job, script, sampleRate: 48000, step: STEP });
  const ms = performance.now() - t0;
  let peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(wavF32(buf));
  a.download = name + '.wav';
  document.body.appendChild(a);
  a.click();
  return { name, seconds: buf.duration, renderMs: Math.round(ms), peak, maxVoices, meanVoices: Math.round(sumVoices / Math.max(1, nV)) };
}

(window as unknown as Record<string, unknown>).renderJob = render;
const shotMarks = (): Array<[number, string]> => INTRO_CUES.filter((c) => c.shot).map((c) => [Math.round(c.t * 100) / 100, `${c.n}`]);
(window as unknown as Record<string, unknown>).marks = {
  film: [...shotMarks(), [END_T, 'END']],
  'film-lite': [...shotMarks(), [END_T, 'END']],
  'film-stall': [...shotMarks().filter((m) => m[0] < 52), [STALL_AT, 'STALL']],
  'film-skip': [...shotMarks().filter((m) => m[0] < 60), [60, 'SKIP']],
};
(window as unknown as Record<string, unknown>).shots = INTRO_CUES.filter((c) => c.shot).map((c) => ({ t: c.t, id: c.shot, n: c.n, cue: c.cue, dur: c.dur, cut: c.cut }));
(window as unknown as Record<string, unknown>).jobNames = Object.keys(JOBS);
const btns = document.getElementById('btns') as HTMLElement;
const log = document.getElementById('log') as HTMLElement;
for (const k of Object.keys(JOBS)) {
  const b = document.createElement('button');
  b.textContent = k;
  b.onclick = async () => { log.textContent += JSON.stringify(await render(k)) + '\n'; };
  btns.appendChild(b);
}

// realtime smoke test: the game's path (init(), playIntro mid-film, syncIntro every frame with a 0.8 s stall,
// then the skip's titleHit and Story's music('pastoral')) on a real AudioContext
(window as unknown as Record<string, unknown>).realtime = async (): Promise<Record<string, unknown>> => {
  const e = new AudioEngine();
  await e.init();
  const start = shotT('gilgal-spear') - 3;
  let film = start;
  let last = performance.now();
  const log: Array<[number, number]> = [];
  const tp = performance.now();
  e.playIntro(INTRO_CUES, start); // plans the whole film + bakes the film buffers
  const playIntroMs = Math.round(performance.now() - tp);
  const stallAt = performance.now() + 2500;
  await new Promise<void>((done) => {
    const iv = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!(now > stallAt && now < stallAt + 800)) film += dt; // a stall: the picture stands still
      e.syncIntro(film);
      e.update(dt);
      log.push([Math.round(film * 1000) / 1000, Math.round(e.introTime() * 1000) / 1000]);
      if (now > stallAt + 4500) { clearInterval(iv); done(); }
    }, 16);
  });
  const drift = log.map(([f, a]) => a - f);
  const out: Record<string, unknown> = {
    state: e.context?.state, introActive: e.introActive, voices: e.voices, bed: e.ambienceBed,
    maxAbsDriftAfterStall: Math.max(...drift.slice(-60).map(Math.abs)), samples: log.length, playIntroMs,
  };
  out.bakeMs = Math.round((e as unknown as { intro: { bakeMs: number } }).intro.bakeMs);
  // the film's own start (film time 0): playIntro must not carry the bakes
  const e2 = new AudioEngine();
  await e2.init();
  const t2 = performance.now();
  e2.playIntro(INTRO_CUES, 0);
  out.playIntroAt0Ms = Math.round(performance.now() - t2);
  await new Promise((r) => setTimeout(r, 1500));
  e2.update(0.016);
  out.bakeMsAt0 = Math.round((e2 as unknown as { intro: { bakeMs: number } }).intro.bakeMs);
  e2.dispose();
  e.sfx('titleHit');
  await new Promise((r) => setTimeout(r, 600));
  out.afterTitle = e.introTime();
  e.setMusicMood('pastoral', 2);
  out.introActiveAfterMood = e.introActive;
  e.dispose();
  return out;
};
