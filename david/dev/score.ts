// Score harness: renders cues offline through AudioEngine.renderOffline (the runtime code path),
// reports levels, and downloads float WAVs. Used by the headless verification (dev/screens/score/).
import { AudioEngine, type OfflineRenderOptions } from '../src/audio/AudioEngine';
import { INTRO_CUES, INTRO_CUES_SHORT } from '../src/content/introScript';

type Job = Omit<OfflineRenderOptions, 'script'> & { script: NonNullable<OfflineRenderOptions['script']> };
const at = (t: number, t0: number, step: number): boolean => t >= t0 && t < t0 + step - 1e-9;
const STEP = 0.05;
let gameAmb = '';
const END_T = INTRO_CUES.reduce((m, c) => (c.shot && c.dur !== undefined ? Math.max(m, c.t + c.dur) : m), 0);
const HINGE_T = (INTRO_CUES.find((c) => c.beat === 'hinge') ?? { t: 45 }).t;

const clock: Array<[number, number, number]> = [];
(window as unknown as Record<string, unknown>).clock = clock;
const JOBS: Record<string, Job> = {
  'intro-full': { seconds: 114, script: (e, t) => { if (t === 0) e.playIntro(INTRO_CUES, 0); } },
  'intro-short-lite': { seconds: 100, lite: true, script: (e, t) => { if (t === 0) e.playIntro(INTRO_CUES_SHORT, 0); } },
  'intro-skip': { seconds: 34, script: (e, t) => {
    if (t === 0) e.playIntro(INTRO_CUES, 0);
    if (at(t, 18, STEP)) e.sfx('titleHit'); // the player skips: the game shows the title and calls titleHit
  } },
  'intro-from-hinge': { seconds: 26, script: (e, t) => { if (t === 0) e.playIntro(INTRO_CUES, HINGE_T - 1); } },
  // the intro teammate's call pattern (src/gameplay/Intro.ts): playIntro, ambience per shot, titleHit on the
  // title shot, stopIntro(2.5) at the end, then gameplay: ambience('fields'), music('pastoral', 4)
  'intro-game-calls': { seconds: 118, script: (e, t) => {
    if (t === 0) e.playIntro(INTRO_CUES, 0);
    for (const c of INTRO_CUES) {
      if (!c.shot || !at(t, c.t, STEP)) continue;
      const amb = c.world === 'field' ? 'fields' : c.beat === 'saul-hall' || c.beat === 'hinge' ? 'gibeah-hall' : 'gibeah-exterior';
      if (amb !== gameAmb) { gameAmb = amb; e.setAmbienceBed(amb, c.cut === 'cut' ? 0.8 : 1.5); }
      if (c.shot === 'title') e.sfx('titleHit');
    }
    if (at(t, END_T, STEP)) { e.stopIntro(2.5); e.setAmbienceBed('fields', 2); }
    if (at(t, END_T + 1.5, STEP)) e.setMusicMood('pastoral', 4);
  } },
  'bed-fields': { seconds: 24, script: (e, t) => { if (t === 0) e.setAmbienceBed('fields', 0.5); } },
  'bed-gibeah-exterior': { seconds: 24, script: (e, t) => { if (t === 0) e.setAmbienceBed('gibeah-exterior', 0.5); } },
  'bed-gibeah-hall': { seconds: 24, script: (e, t) => { if (t === 0) e.setAmbienceBed('gibeah-hall', 0.5); } },
  'sfx-cinematic': { seconds: 12, script: (e, t) => {
    if (at(t, 0.2, STEP)) e.sfx('robeTear');
    if (at(t, 3, STEP)) e.sfx('riser');
    if (at(t, 5, STEP)) e.sfx('stinger');
  } },
  'chapter-bear': { seconds: 26, script: (e, t) => {
    if (t === 0) { e.setAmbience({ wind: 0.6, cicadas: 0.15, birds: 0 }); e.setMusicMood('tension', 1.5); }
    if (at(t, 2.4, STEP)) e.sfx('bearGrowl', { volume: 0.8 });
    if (at(t, 12, STEP)) e.setMusicMood('battle', 1.2);
    if (at(t, 14, STEP)) e.sfx('bearRoar');
    if (at(t, 16, STEP)) e.sfx('staffHit');
    if (at(t, 16.05, STEP)) e.sfx('bearHurt');
    if (at(t, 20, STEP)) e.sfx('slingRelease');
  } },
  'chapter-victory': { seconds: 30, script: (e, t) => {
    if (t === 0) { e.setAmbience({ wind: 0.5, cicadas: 0.4, birds: 0.2 }); e.setMusicMood('victory', 3); }
    if (at(t, 1, STEP)) e.sfx('bearDeath');
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
  let peak = 0, ss = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; ss += d[i] * d[i]; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(wavF32(buf));
  a.download = name + '.wav';
  document.body.appendChild(a);
  a.click();
  return { name, seconds: buf.duration, renderMs: Math.round(ms), peak, rms: Math.sqrt(ss / (buf.length * buf.numberOfChannels)),
    maxVoices, meanVoices: Math.round(sumVoices / Math.max(1, nV)) };
}

(window as unknown as Record<string, unknown>).renderJob = render;
// realtime smoke test: the game's path (init() from a gesture, then playIntro / ambience / titleHit)
(window as unknown as Record<string, unknown>).realtime = async (): Promise<Record<string, unknown>> => {
  const e = new AudioEngine();
  await e.init();
  e.setAmbienceBed('fields', 1);
  e.playIntro(INTRO_CUES, 30);
  const out: Record<string, unknown> = { state: e.context?.state, ready: e.ready };
  await new Promise((r) => setTimeout(r, 2500));
  out.introActive = e.introActive; out.introTime = e.introTime(); out.voices = e.voices; out.ctxTime = e.context?.currentTime;
  e.setAmbienceBed('gibeah-hall', 0.5);
  e.sfx('titleHit');
  await new Promise((r) => setTimeout(r, 1500));
  out.afterTitleIntroTime = e.introTime(); out.bed = e.ambienceBed;
  e.setMusicMood('pastoral', 2);
  await new Promise((r) => setTimeout(r, 500));
  out.introActiveAfterMood = e.introActive; out.mood = e.currentMood;
  e.dispose();
  return out;
};
const shotMarks = (cues: typeof INTRO_CUES, off = 0) => cues.filter((c) => c.shot).map((c) => [Math.round((c.t - off) * 100) / 100, c.shot]);
(window as unknown as Record<string, unknown>).marks = {
  'intro-full': shotMarks(INTRO_CUES),
  'intro-game-calls': [...shotMarks(INTRO_CUES), [END_T, 'END stopIntro'], [END_T + 1.5, 'pastoral']],
  'intro-short-lite': shotMarks(INTRO_CUES_SHORT),
  'intro-skip': [...shotMarks(INTRO_CUES).filter((m) => (m[0] as number) < 18), [18, 'SKIP: titleHit']],
  'intro-from-hinge': shotMarks(INTRO_CUES, HINGE_T - 1).filter((m) => (m[0] as number) >= 0),
};
(window as unknown as Record<string, unknown>).jobNames = Object.keys(JOBS);
const btns = document.getElementById('btns') as HTMLElement;
const log = document.getElementById('log') as HTMLElement;
for (const k of Object.keys(JOBS)) {
  const b = document.createElement('button');
  b.textContent = k;
  b.onclick = async () => { log.textContent += JSON.stringify(await render(k)) + '\n'; };
  btns.appendChild(b);
}
