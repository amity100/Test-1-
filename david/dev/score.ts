// Score harness: renders the opening film's score + sound design offline through AudioEngine.renderOffline (the
// runtime code path), driven exactly like src/gameplay/Intro.ts + Story.ts drive it, and downloads float WAVs; plus
// the bear's hook in gameplay (the 'birdsScatter' / 'eyesSting' sounds and the 'hush' mood) and the sounds of gameplay
// v2 in sequence. Used by the headless verification (dev/screens/score6/). Every film time comes from the live shot
// sheet (INTRO_CUES, CUT v5).
import { AudioEngine, type OfflineRenderOptions } from '../src/audio/AudioEngine';
import { INTRO_CUES, beatTime, type IntroCue } from '../src/content/introScript';

type Job = Omit<OfflineRenderOptions, 'script'> & { script: NonNullable<OfflineRenderOptions['script']> };
const STEP = 0.05;
/**
 * true on the first script step at or after t0 — exactly once per (job run, t0): the offline render's steps are
 * quantised to its 128-sample quantum, so their spacing wobbles around STEP (a window test could fire twice or never)
 */
const onceDone = new Set<string>();
const at = (t: number, t0: number, key = ''): boolean => {
  if (t < 1e-9) onceDone.clear();
  const k = key + '@' + t0;
  if (t < t0 - 1e-5 || onceDone.has(k)) return false;
  if (t > t0 + 0.5) return false;
  onceDone.add(k);
  return true;
};
const lengthOf = (cs: readonly IntroCue[]): number => cs.reduce((m, c) => (c.shot && c.dur !== undefined ? Math.max(m, c.t + c.dur) : m), 0);
const END_T = lengthOf(INTRO_CUES);
/** Start of the first shot whose cue is one of `cues` (NaN when none). */
const cueT = (...cues: string[]): number => (INTRO_CUES.find((c) => c.shot && cues.includes(String(c.cue))) ?? { t: NaN }).t;

/**
 * The film's call pattern: playIntro at 0, syncIntro(filmClock) every frame until the end; at the end Intro.end(false)
 * (stopIntro(2.5)), Intro.finish (ambience('fields', 2)) and Story's music('pastoral', 4) — `end: 'mood'` leaves the
 * stopIntro out. A skip (Intro.end(true)): sfx('titleHit') (the score jumps to its logo statement), ambience('fields'),
 * then Story's music('pastoral', 4) 3.4 s later. `clock(t)` maps audio time -> film clock (stalls, seeks).
 */
function filmCalls(clock: (t: number) => number, skipAt = Infinity, end: 'stop' | 'mood' = 'stop', from = 0) {
  let skipped = false;
  let done = false;
  let skipT = 0;
  let prev = -1;
  return (e: AudioEngine, t: number): void => {
    if (t === 0) e.playIntro(INTRO_CUES, from);
    if (skipped) {
      if (at(t, skipT + 3.4)) e.setMusicMood('pastoral', 4);
      return;
    }
    if (done) return;
    const f = clock(t);
    e.syncIntro(f);
    if (prev < END_T && f >= END_T) {
      done = true;
      if (end === 'stop') e.stopIntro(2.5);
      e.setAmbienceBed('fields', 2);
      e.setMusicMood('pastoral', 4);
      return;
    }
    if (t >= skipAt) {
      skipped = true;
      skipT = t;
      e.sfx('titleHit');
      e.setAmbienceBed('fields', 2);
    }
    prev = f;
  };
}
const straight = (t: number): number => t;
/** a picture stall (a loading hitch) of `len` s at film time `at`: the film clock stands still, then runs on */
const stall = (at: number, len: number) => (t: number): number => (t < at ? t : t < at + len ? at : t - len);
/** CUT v5: the logo in D4 and the lift before it (film times from the sheet's beats) */
const LOGO = beatTime('horizon', 'logo');
const LIFT = beatTime('horizon', 'lift');
const STALL_AT = LOGO - 0.6;
const SKIP_EARLY = cueT('saul') + 1;
const SKIP_PRO = cueT('map') + 2;
const SKIP_D4 = LIFT + 0.3;
const SEEK_TO = cueT('face') + 1;
const SEEK_PRO = cueT('judges') + 0.5;
/** CUT v5.2: a seek / a hidden-tab jump landing inside G4's hush (1.5 s after the roar's cut) — the roar must not restart */
const SEEK_G4 = cueT('silence') + 1.5;
/** partial windows (fast iteration): the prologue into Gilgal, and D2 → the hand-off */
const PRO_END = cueT('shofar') + 5;
const END_FROM = cueT('face');

/**
 * The bear's hook as Story.bearAttack plays it (cut6's BearHook: H1 3.0 s + H2 2.2 s, its cues in hook seconds — the
 * birds fly up at 0.45 (birdsScatter), fall silent at 1.0 (music('hush', 1.2)), the lamb bleats at 3.25 (a positional
 * lambBleat, ≈0.2 after distance), the eyes open at 3.9 (eyesSting); the bear comes out at the end of the hook, 5.2
 * (music('tension', 1.5) + ambience(0.6, 0.15, 0))) after 6 s of the chapter's pastoral music and fields bed.
 */
const H0 = 6.0;
const HOOK = { scatter: H0 + 0.45, hush: H0 + 1.0, bleat: H0 + 3.25, eyes: H0 + 3.9, tension: H0 + 5.2 };
function hookCalls() {
  return (e: AudioEngine, t: number): void => {
    if (t === 0) { e.setAmbienceBed('fields', 0.5); e.setMusicMood('pastoral', 1); }
    if (at(t, HOOK.scatter)) e.sfx('birdsScatter');
    if (at(t, HOOK.hush)) e.setMusicMood('hush', 1.2);
    if (at(t, HOOK.bleat)) e.sfx('lambBleat', { volume: 0.2, pan: 0.3 });
    if (at(t, HOOK.eyes)) e.sfx('eyesSting');
    if (at(t, HOOK.tension)) { e.setMusicMood('tension', 1.5); e.setAmbience({ wind: 0.6, cicadas: 0.15, birds: 0 }); }
  };
}

/** every named beat of the shots in [a, b) as a mark (film time, 'shot:beat') */
function beatMarks(a: number, b: number): Array<[number, string]> {
  const out: Array<[number, string]> = [];
  for (const c of INTRO_CUES) {
    if (!c.shot || !c.beats) continue;
    for (const [k, v] of Object.entries(c.beats)) { const x = c.t + v; if (x >= a && x < b && v > 0) out.push([Math.round(x * 100) / 100, `${c.n}:${k}`]); }
  }
  return out;
}

/**
 * The sounds of gameplay v2 in sequence (the names play1 calls; a name the engine does not know is silently ignored,
 * so this job also shows which names exist): [time, name, options].
 */
const GAME_SFX: ReadonlyArray<readonly [number, string, { volume?: number; pitch?: number; pan?: number }?]> = [
  [0.5, 'slingDraw'], [1.0, 'stoneToPouch'],
  // the whirl (slingSpin every frame at its rate + one slingWhoosh per revolution), the perfect release, the flight
  [1.6, 'slingWhoosh', { pitch: 0.9, volume: 0.45 }], [2.15, 'slingWhoosh', { pitch: 1.05, volume: 0.6 }], [2.6, 'slingWhoosh', { pitch: 1.2, volume: 0.75 }],
  [3.0, 'slingRelease', { volume: 0.9 }], [3.0, 'slingPerfect'], [3.02, 'stoneWhistle', { pitch: 1.15, volume: 0.9 }],
  [3.8, 'hitConfirm'], [3.8, 'jarShatter'], [3.8, 'waterSplash'],
  [5.0, 'stoneOnRock'], [5.8, 'stoneOnWood'], [6.6, 'stoneOnEarth'], [7.6, 'gourdSplit'], [8.8, 'cordSnap'],
  [9.6, 'skinThud'], [9.62, 'waterSplash', { volume: 0.6 }],
  [10.6, 'slingStow'], [11.6, 'pebblesKneel'], [12.3, 'gravelReach'], [13.0, 'waterRinse'], [13.8, 'stoneRub'],
  [14.4, 'stoneToBag'], [15.4, 'stoneToss'],
  [16.6, 'roundStart'], [17.6, 'streak', { pitch: 1 }], [18.3, 'streak', { pitch: 1.12 }], [19.0, 'streak', { pitch: 1.24 }],
  [20.0, 'roundComplete'], [22.5, 'rating1'], [24.6, 'rating2'], [27.0, 'rating3'], [30.4, 'praise'],
];
const GAME_SFX_LEN = 32.5;
const fired: Array<[number, string]> = [];
(window as unknown as Record<string, unknown>).fired = fired;
function gameSfx() {
  return (e: AudioEngine, t: number): void => {
    if (t === 0) { e.setAmbienceBed('fields', 0.5); fired.length = 0; }
    for (const [x, name, o] of GAME_SFX) if (at(t, x, name)) { fired.push([Math.round(t * 1000) / 1000, name]); e.sfx(name as Parameters<AudioEngine['sfx']>[0], o); }
    if (t >= 1.4 && t < 3.0) { const u = (t - 1.4) / 1.6; e.slingSpin(true, u, 1.4 + 1.6 * u); }
  };
}

/**
 * The bear's fight (bear1's calls, gameplay v2 §4) as a mini-fight: the warnings (huffs, the jaw popping, a stomp), the
 * rise (bearRoar + riseSting → 'battle'), a lunge dodged and a blow on the snout, a bluff charge pulled up short, the slam
 * that knocks David down, the bear tiring (panting), a blow on the head, the grip (gripSting + 'grip' + slow motion + the
 * struggle), the last blow ('fightEnd'), the collapse, the last breaths, then 'victory'. [time, call, a, b]
 */
const BEAR_FIGHT: ReadonlyArray<readonly [number, string, number?, number?]> = [
  [0.8, 'bearHuff', 0.9], [1.25, 'bearHuff', 1], [1.5, 'bearJawPop', 1], [2.1, 'bearStomp', 0.9], [2.7, 'bearJawPop', 0.9], [3.1, 'bearHuff', 1],
  [4.2, 'bearRoar', 1.2], [4.2, 'riseSting'], [4.3, 'music:battle', 1.2], [6.0, 'bearLand', 1],
  [6.9, 'bearStep', 0.8], [7.4, 'bearStep', 0.8], [7.9, 'bearStep', 0.8],
  [8.6, 'bearSnap', 1], [8.75, 'dodge', 0.8], [9.4, 'whoosh', 0.9], [9.55, 'staffBlow', 1, 1.3], [9.6, 'bearHurt', 0.9],
  [10.8, 'bearSkid', 1], [11.5, 'bearHuff', 1], [11.9, 'bearJawPop', 1],
  [12.9, 'bearSlam', 1.4], [13.0, 'davidFall', 1], [13.05, 'davidHurt', 0.9],
  [14.6, 'bearPant', 0.8, 0.95], [15.2, 'bearPant', 0.8, 0.95], [15.8, 'bearPant', 0.8, 0.92], [16.4, 'bearPant', 0.8, 0.9],
  [17.0, 'whoosh', 0.9], [17.15, 'staffBlow', 1, 1], [17.2, 'bearHurt', 1], [18.2, 'bearPant', 0.8, 0.85], [18.8, 'bearGrowl', 0.9],
  [19.6, 'bearSnap', 1], [20.0, 'gripSting'], [20.0, 'music:grip', 0.3], [20.0, 'slow:0.8'], [20.05, 'grab', 1], [20.1, 'gripStruggle', 1], [22.7, 'gripStruggle', 1],
  [25.0, 'whoosh', 1], [25.15, 'staffBlow', 1.2, 1], [25.15, 'music:fightEnd', 0.15], [25.2, 'slow:0'], [25.3, 'bearHurt', 1, 0.8],
  [25.9, 'bearCollapse', 1], [27.6, 'bearPant', 0.6, 0.7], [28.4, 'bearPant', 0.45, 0.65],
  [31.5, 'music:victory', 3],
];
const BEAR_FIGHT_LEN = 38;
/** the fight's sounds alone (no music), 1.6 s apart at volume 1, pitch 1: their own levels against the bed */
const BEAR_SFX = ['bearHuff', 'bearJawPop', 'bearStomp', 'bearSnap', 'bearSlam', 'bearLand', 'bearSkid', 'bearCollapse', 'bearPant', 'bearStep',
  'staffBlow', 'davidFall', 'gripStruggle', 'riseSting', 'gripSting', 'bearGrowl', 'bearHurt', 'staffHit'];
const BEAR_SFX_AT = (i: number): number => 0.5 + i * 1.6 + (i > 7 ? 1.2 : 0) + (i > 12 ? 1.6 : 0) + (i > 13 ? 1.4 : 0) + (i > 14 ? 2.2 : 0);
function bearFight() {
  return (e: AudioEngine, t: number): void => {
    if (t === 0) { e.setAmbienceBed('fields', 0.5); e.setAmbience({ wind: 0.6, cicadas: 0.15, birds: 0 }); e.setMusicMood('tension', 0.5); }
    for (const [x, call, a, b] of BEAR_FIGHT) {
      if (!at(t, x, call)) continue;
      if (call.startsWith('music:')) e.setMusicMood(call.slice(6) as Parameters<AudioEngine['setMusicMood']>[0], a ?? 1);
      else if (call.startsWith('slow:')) e.setSlowMotion(Number(call.slice(5)));
      else e.sfx(call as Parameters<AudioEngine['sfx']>[0], { volume: a ?? 1, pitch: b ?? 1, pan: 0.1 });
    }
  };
}

const JOBS: Record<string, Job> = {
  film: { seconds: END_T + 7, script: filmCalls(straight) },
  'film-lite': { seconds: END_T + 7, lite: true, script: filmCalls(straight) },
  // the end without Intro.end's stopIntro (only Story's music('pastoral')): the hand-off must be the same
  'film-mood': { seconds: END_T + 7, script: filmCalls(straight, Infinity, 'mood') },
  // a 1.0 s stall just before the logo: the arrival must land on the late picture
  'film-stall': { seconds: END_T + 8, script: filmCalls(stall(STALL_AT, 1.0)) },
  // skips: early (G2) and in the crane before the logo — the logo statement, then the score's own hand-off
  'film-skip': { seconds: SKIP_EARLY + 14, script: filmCalls(straight, SKIP_EARLY) },
  'film-skip-d4': { seconds: SKIP_D4 + 14, script: filmCalls(straight, SKIP_D4) },
  'film-skip-pro': { seconds: SKIP_PRO + 14, script: filmCalls(straight, SKIP_PRO) },
  // a seek (Intro.seek / ?introAt=): the film clock jumps from 5 s into D2; the score restarts there
  'film-seek': { seconds: 5 + (END_T - SEEK_TO) + 7, script: filmCalls((t) => (t < 5 ? t : t + SEEK_TO - 5)) },
  'film-seek-pro': { seconds: 5 + (PRO_END - SEEK_PRO), script: filmCalls((t) => (t < 5 ? t : t + SEEK_PRO - 5)) },
  'film-seek-g4': { seconds: 5 + (cueT('verdict') - SEEK_G4), script: filmCalls((t) => (t < 5 ? t : t + SEEK_G4 - 5)) },
  // re-anchors in the middle of an exit (wave 4): a 0.4 s picture hitch while the roar falls into G4 (sync re-anchors),
  // and a 60 ms hitch just before the shofar (the hit's relock re-anchors while Ramah's bus is ramping out) — the
  // falling / cut bus must carry on from where it is, never swell back
  'g4-stall': { seconds: cueT('tear') + 2 - cueT('peak') + 0.4, script: filmCalls((t) => stall(cueT('silence') + 0.3, 0.4)(t + cueT('peak')), Infinity, 'stop', cueT('peak')) },
  'g1-stall': { seconds: 7, script: filmCalls((t) => stall(cueT('shofar') - 0.12, 0.06)(t + cueT('shofar') - 3), Infinity, 'stop', cueT('shofar') - 3) },
  // partial windows: the prologue into Gilgal (0 → G1 + 5) and D2 → the hand-off (+7 s of the game's pastoral)
  prologue: { seconds: PRO_END, script: filmCalls(straight) },
  'prologue-lite': { seconds: PRO_END, lite: true, script: filmCalls(straight) },
  ending: { seconds: END_T - END_FROM + 7, script: filmCalls((t) => t + END_FROM, Infinity, 'stop', END_FROM) },
  'ending-lite': { seconds: END_T - END_FROM + 7, lite: true, script: filmCalls((t) => t + END_FROM, Infinity, 'stop', END_FROM) },
  // the gameplay v2 sounds in sequence (play1's names; see GAME_SFX)
  'sfx-game': { seconds: GAME_SFX_LEN, script: gameSfx() },
  'sfx-game-lite': { seconds: GAME_SFX_LEN, lite: true, script: gameSfx() },
  // the bear's fight (bear1's names + the fight's music states and stings)
  'bear-fight': { seconds: BEAR_FIGHT_LEN, script: bearFight() },
  'bear-fight-lite': { seconds: BEAR_FIGHT_LEN, lite: true, script: bearFight() },
  'bear-sfx': { seconds: BEAR_SFX_AT(BEAR_SFX.length) + 1, script: (e, t) => {
    if (t === 0) e.setAmbienceBed('fields', 0.5);
    BEAR_SFX.forEach((n, i) => { if (at(t, BEAR_SFX_AT(i), n)) e.sfx(n as Parameters<AudioEngine['sfx']>[0]); });
  } },
  'bear-sfx-lite': { seconds: BEAR_SFX_AT(BEAR_SFX.length) + 1, lite: true, script: (e, t) => {
    if (t === 0) e.setAmbienceBed('fields', 0.5);
    BEAR_SFX.forEach((n, i) => { if (at(t, BEAR_SFX_AT(i), n)) e.sfx(n as Parameters<AudioEngine['sfx']>[0]); });
  } },
  'bear-hook': { seconds: 18, script: hookCalls() },
  'bear-hook-lite': { seconds: 18, lite: true, script: hookCalls() },
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
  let maxVoices = 0, sumVoices = 0, nV = 0, maxAt = 0;
  const busy: Array<[number, number]> = [];
  const moods: Array<[number, string, boolean]> = [];
  const script: Job['script'] = (e, t) => {
    job.script(e, t);
    const v = e.voices;
    if (v > maxVoices) { maxVoices = v; maxAt = t; }
    if (v >= 45) busy.push([Math.round(t * 10) / 10, v]);
    sumVoices += v; nV++;
    const last = moods[moods.length - 1];
    if (!last || last[1] !== e.currentMood || last[2] !== e.introActive) moods.push([Math.round(t * 100) / 100, e.currentMood, e.introActive]);
  };
  let beats: unknown = null;
  const script2: Job['script'] = (e, t) => {
    script(e, t);
    if (beats === null) { const sc = (e as unknown as { intro?: { beatTable?: () => unknown } }).intro; if (sc && sc.beatTable) beats = sc.beatTable(); }
  };
  const buf = await AudioEngine.renderOffline({ ...job, script: script2, sampleRate: 48000, step: STEP });
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
  return { name, seconds: buf.duration, renderMs: Math.round(ms), peak, maxVoices, meanVoices: Math.round(sumVoices / Math.max(1, nV)), maxVoicesAt: Math.round(maxAt * 100) / 100, busy: busy.filter((_, i) => i % 4 === 0).slice(0, 40), moods, sheet: 'live', beats };
}

(window as unknown as Record<string, unknown>).renderJob = render;
const shotMarks = (): Array<[number, string]> => INTRO_CUES.filter((c) => c.shot).map((c) => [Math.round(c.t * 100) / 100, `${c.n}`]);
const hookMarks: Array<[number, string]> = [[H0, 'hook'], [HOOK.scatter, 'birdsScatter'], [HOOK.hush, 'hush'], [HOOK.bleat, 'bleat'], [HOOK.eyes, 'eyesSting'], [HOOK.tension, 'tension']];
(window as unknown as Record<string, unknown>).marks = {
  film: [...shotMarks(), [END_T, 'END']],
  'film-lite': [...shotMarks(), [END_T, 'END']],
  'film-mood': [...shotMarks(), [END_T, 'END']],
  'film-stall': [...shotMarks(), [STALL_AT, 'STALL'], [LOGO + 1.0, 'logo@late picture'], [END_T + 1.0, 'END(late)']],
  'film-skip': [...shotMarks().filter((m) => m[0] < SKIP_EARLY + 14), [SKIP_EARLY, 'SKIP'], [SKIP_EARLY + 3.4, 'pastoral req']],
  'film-skip-d4': [...shotMarks().filter((m) => m[0] < SKIP_D4 + 14), [SKIP_D4, 'SKIP'], [SKIP_D4 + 3.4, 'pastoral req']],
  'film-skip-pro': [...shotMarks().filter((m) => m[0] < SKIP_PRO + 14), [SKIP_PRO, 'SKIP'], [SKIP_PRO + 3.4, 'pastoral req']],
  'film-seek': [[5, 'SEEK'], [5 + cueT('watch') - SEEK_TO, 'D3'], [5 + cueT('horizon') - SEEK_TO, 'D4'], [5 + END_T - SEEK_TO, 'END']],
  'film-seek-pro': [[5, 'SEEK'], [5 + cueT('threat') - SEEK_PRO, 'P6'], [5 + cueT('elders') - SEEK_PRO, 'P7'], [5 + cueT('shofar') - SEEK_PRO, 'G1']],
  'g4-stall': [[cueT('silence') - cueT('peak'), 'G4'], [cueT('silence') + 0.3 - cueT('peak'), 'STALL 0.4'], [cueT('tear') + 0.4 - cueT('peak'), 'G5a']],
  'g1-stall': [[2.88, 'STALL 0.06'], [3.06, 'G1 (late picture)']],
  'film-seek-g4': [[5, 'SEEK'], [5 + beatTime('silence', 'verse') - SEEK_G4, 'verse'], [5 + cueT('tear') - SEEK_G4, 'G5a'], [5 + cueT('verdict') - SEEK_G4 - 0.01, 'G6']],
  prologue: [...shotMarks().filter((m) => m[0] < PRO_END), ...beatMarks(0, PRO_END)],
  'prologue-lite': [...shotMarks().filter((m) => m[0] < PRO_END), ...beatMarks(0, PRO_END)],
  ending: [...shotMarks().filter((m) => m[0] >= END_FROM).map(([x, n]) => [x - END_FROM, n] as [number, string]), ...beatMarks(END_FROM, END_T).map(([x, n]) => [x - END_FROM, n] as [number, string]), [END_T - END_FROM, 'END']],
  'ending-lite': [...shotMarks().filter((m) => m[0] >= END_FROM).map(([x, n]) => [x - END_FROM, n] as [number, string]), ...beatMarks(END_FROM, END_T).map(([x, n]) => [x - END_FROM, n] as [number, string]), [END_T - END_FROM, 'END']],
  'sfx-game': GAME_SFX.map(([x, n]) => [x, n] as [number, string]),
  'sfx-game-lite': GAME_SFX.map(([x, n]) => [x, n] as [number, string]),
  'bear-fight': BEAR_FIGHT.filter(([, c]) => !c.startsWith('slow')).map(([x, c]) => [x, c] as [number, string]),
  'bear-fight-lite': BEAR_FIGHT.filter(([, c]) => !c.startsWith('slow')).map(([x, c]) => [x, c] as [number, string]),
  'bear-sfx': BEAR_SFX.map((n, i) => [BEAR_SFX_AT(i), n] as [number, string]),
  'bear-sfx-lite': BEAR_SFX.map((n, i) => [BEAR_SFX_AT(i), n] as [number, string]),
  'bear-hook': hookMarks,
  'bear-hook-lite': hookMarks,
};
(window as unknown as Record<string, unknown>).shots = INTRO_CUES.filter((c) => c.shot).map((c) => ({ t: c.t, id: c.shot, n: c.n, cue: c.cue, dur: c.dur, cut: c.cut, beats: c.beats }));
(window as unknown as Record<string, unknown>).jobNames = Object.keys(JOBS);
const btns = document.getElementById('btns') as HTMLElement;
const log = document.getElementById('log') as HTMLElement;
for (const k of Object.keys(JOBS)) {
  const b = document.createElement('button');
  b.textContent = k;
  b.onclick = async () => { log.textContent += JSON.stringify(await render(k)) + '\n'; };
  btns.appendChild(b);
}

// realtime smoke test: the game's path (init(), playIntro in the crane, syncIntro every frame with a 0.8 s stall before
// the logo, the end of the film: stopIntro + music('pastoral') at the hand-off) on a real AudioContext
(window as unknown as Record<string, unknown>).realtime = async (): Promise<Record<string, unknown>> => {
  const e = new AudioEngine();
  await e.init();
  const start = cueT('horizon') - 2;
  let film = start;
  let last = performance.now();
  const log: Array<[number, number]> = [];
  const tp = performance.now();
  e.playIntro(INTRO_CUES, start);
  const playIntroMs = Math.round(performance.now() - tp);
  const stallAt = performance.now() + (LOGO - 1.2 - start) * 1000;
  let ended = false;
  let moodAtEnd = '';
  await new Promise<void>((done) => {
    const iv = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!(now > stallAt && now < stallAt + 800)) film += dt; // a stall: the picture stands still
      if (!ended) {
        e.syncIntro(film);
        log.push([Math.round(film * 1000) / 1000, Math.round(e.introTime() * 1000) / 1000]);
        if (film >= END_T) { ended = true; e.stopIntro(2.5); e.setMusicMood('pastoral', 4); moodAtEnd = e.currentMood; }
      }
      e.update(dt);
      if (film > END_T + 2) { clearInterval(iv); done(); }
    }, 16);
  });
  const drift = log.map(([f, a]) => Math.abs(a - f)).filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  const pct = (p: number): number => Math.round(1000 * (drift[Math.min(drift.length - 1, Math.floor(p * drift.length))] ?? NaN)) / 1000;
  const hits = (e as unknown as { intro: { hitLog: Array<[number, number]> } }).intro.hitLog.slice();
  const out: Record<string, unknown> = {
    state: e.context?.state, introActiveAfterEnd: e.introActive, voices: e.voices, bed: e.ambienceBed, moodAtEnd, moodAfter: e.currentMood,
    driftMedian: pct(0.5), drift95: pct(0.95), driftMax: pct(1), samples: log.length, playIntroMidFilmMs: playIntroMs, hits,
  };
  e.dispose();
  // the film's own start (film time 0, as Intro.ts calls it): planning cost, three times (the first carries the JIT)
  const at0: number[] = [];
  for (let k = 0; k < 3; k++) {
    const e2 = new AudioEngine();
    await e2.init();
    const t2 = performance.now();
    e2.playIntro(INTRO_CUES, 0);
    at0.push(Math.round(performance.now() - t2));
    e2.dispose();
  }
  out.playIntroAt0Ms = at0;
  return out;
};

// probe: render one sound effect alone (the library called directly, so an exception is reported, not swallowed)
(window as unknown as Record<string, unknown>).probeSfx = async (name: string, pitch = 1, volume = 1): Promise<Record<string, unknown>> => {
  const errors: string[] = [];
  const buf = await AudioEngine.renderOffline({ seconds: 3, step: STEP, script: (e, t) => {
    if (t !== 0) return;
    const x = e as unknown as { lib: { play: (n: string, o: unknown, now: number) => void }; core: { ctx: BaseAudioContext } };
    try { x.lib.play(name, { pitch, volume }, x.core.ctx.currentTime + 0.2); } catch (err) { errors.push(String((err as Error)?.stack ?? err)); }
  } });
  let peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i])); }
  return { name, pitch, peak: Math.round(2000 * Math.log10(peak + 1e-9)) / 100, errors };
};
