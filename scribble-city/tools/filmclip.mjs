// A scene of the story's film as a moving picture, as a phone draws it (no sound; its words are on the screen): the scene is prepared
// and played by the story's own test pilot (tools/perf/lib.mjs open), stepped a fifteenth of a second a picture, and the pictures
// put together by ffmpeg. For judging a scene in motion - a walk, a cut, a hand - before the owner sees it.
//   node tools/filmclip.mjs <outDir> <scene 1-9> <from s> <to s>      EXTRA="look=1"   FPS=15   NAME=s2
//   SOUND=1: with the game's own sound - its voices, its music, its air, as the game mixes them. A browser without a screen plays
//   nothing that can be recorded, and the pictures are not taken in real time: so the game is given an audio context that renders
//   into memory (OfflineAudioContext) in place of the live one, and it is run by hand, a fifteenth of a second a picture; at the
//   end what it rendered is written as a wav and put under the pictures by ffmpeg
//   BURN=1: a review copy - each shot's number and the scene's own clock in the picture's top corner (in the recording only)
//   THRU=8: on through the scenes after the one asked for, to the end time in scene THRU's own clock (scenes 8 and 9 cannot be
//   begun at: they need what scene 7 made - the drawn ramp, the flight): node tools/filmclip.mjs out 7 0.5 24  with THRU=8
//   INIT="<js>": JS run once in the page before the first picture (g: the game, P: the prologue; may be async) - e.g. a gun put
//   on the car and its trigger held, for a clip of the chase as a player would play it
//   WATCH="<js>": a line of JS asked after every picture (g: the game, P: the prologue) - its answer printed whenever it changes,
//   with the scene's time: for finding the moment something goes wrong in the very run that is filmed
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { open } from './perf/lib.mjs';

const OUT = process.argv[2] || 'filmclip-out';
const sc = +process.argv[3] || 2;
const T0 = +process.argv[4] || 0.5;
const T1 = +process.argv[5] || 30;
const FPS = +process.env.FPS || 15;
const name = process.env.NAME || `s${sc}`;
const dir = path.join(OUT, `${name}_frames`);
fs.mkdirSync(dir, { recursive: true });
for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
const SOUND = !!process.env.SOUND;
const SR = 48000;
const LAST = +process.env.THRU || sc;
const MAXS = Math.ceil(T1 - T0 + 12) + (LAST > sc ? 90 * (LAST - sc) : 0);
// (in place of the live AudioContext: one that renders into memory, the game's own nodes on it. The game tells a context that
// renders into memory apart from a live one - game/prologue/score.js: its recorded music is not loaded for one - so this one
// is not to be known for what it is)
const init = SOUND
  ? `(() => {
  const Real = window.OfflineAudioContext;
  if (!Real) return;
  let mine = null;
  function AC() {
    mine = new Real(2, ${MAXS * SR}, ${SR});
    mine.resume0 = mine.resume.bind(mine);
    mine.resume = () => Promise.resolve();
    window.__octx = mine;
    return mine;
  }
  window.AudioContext = AC;
  window.webkitAudioContext = AC;
  window.OfflineAudioContext = new Proxy(Real, { get(t, k) { return k === Symbol.hasInstance ? (o) => o !== mine && Function.prototype[Symbol.hasInstance].call(t, o) : t[k]; } });
})()`
  : null;
const t0 = Date.now();
const { pg, close } = await open({ where: `s${sc}`, query: process.env.EXTRA || '', cond: `P.sceneT > ${T0}`, dsf: 1, frames: 1, init });
await pg.evaluate(() => {
  for (const id of ['hud', 'touch']) {
    const el = document.getElementById(id);
    if (el) el.style.visibility = 'hidden';
  }
});
// (BURN=1: a review copy - each shot's number and the scene's own clock in the picture's top corner, so that a note can name
// the very moment: "shot 7, 0:14". Only in this recording: nothing of it is in the game)
if (process.env.BURN) {
  await pg.evaluate(() => {
    const P = window.__game.prologue;
    const d = document.createElement('div');
    d.id = 'review-burn';
    d.style.cssText = 'position:fixed;right:1.2vw;top:5.4vh;z-index:99999;font:700 3.3vh/1 ui-monospace,Menlo,Consolas,monospace;color:#fffaf0;background:rgba(8,6,14,.72);padding:.7vh 1vw;border-radius:.6vh;letter-spacing:.04em;pointer-events:none;direction:ltr';
    document.body.appendChild(d);
    window.__shotN = 0;
    const cut0 = P.shots.cut.bind(P.shots);
    let last = -1;
    P.shots.cut = (s) => {
      // (a held picture - a name's card, a painted still - is its shot still: no new number)
      const held = s && s.from && s.from.isVector3 && P.shots.lastPos && s.from.distanceTo(P.shots.lastPos) < 1e-6 && P.kWant < 0.01;
      if (!held && P.sceneT !== last) window.__shotN++;
      last = P.sceneT;
      return cut0(s);
    };
    window.__burn = () => {
      const t = Math.max(0, P.sceneT || 0);
      d.textContent = `SHOT ${String(window.__shotN).padStart(2, '0')}  ${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
      d.style.display = P.holdCam ? '' : 'none';
    };
  });
}
if (process.env.INIT) {
  const r = await pg.evaluate(async (code) => {
    const AsyncF = Object.getPrototypeOf(async () => {}).constructor;
    try {
      return await new AsyncF('g', 'P', code)(window.__game, window.__game.prologue);
    } catch (e) {
      return 'INIT error: ' + String((e && e.stack) || e).slice(0, 400);
    }
  }, process.env.INIT);
  console.log('INIT:', JSON.stringify(r));
}
const steps = Math.round(30 / FPS);
let n = 0;
for (;;) {
  const r = await pg.evaluate(async ([steps, quanta]) => {
    window.__frame(steps, 1 / 30);
    const P = window.__game.prologue;
    if (window.__burn) window.__burn();
    const c = window.__octx;
    if (c) {
      // (the music's notes written, as its own timer would: game/prologue/score.js pump - and the sound on by the picture's time)
      if (P.score && P.score.pump) P.score.pump();
      window.__aq = (window.__aq || 0) + quanta;
      const p = c.suspend((window.__aq * 128) / c.sampleRate);
      if (!window.__adone) window.__adone = c.startRendering();
      else c.resume0();
      await p;
    }
    return { scene: P.sceneN, t: P.sceneT };
  }, [steps, Math.round(SR / FPS / 128)]);
  if (process.env.WATCH) {
    const w = JSON.stringify(await pg.evaluate((code) => new Function('g', 'P', code)(window.__game, window.__game.prologue), process.env.WATCH));
    if (w !== globalThis.__watched) console.log(`${r.t.toFixed(2)}  ${w}`);
    globalThis.__watched = w;
  }
  if (r.scene < sc || r.scene > LAST || (r.scene === LAST && r.t > T1) || n > 3600) break;
  // (two of the browser's own frames first: a sheet drawn over the game's picture - the film's comic pages, Lily's sketchbook -
  // was photographed torn, its top from the frame before, when it moved fast)
  await pg.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
  await pg.screenshot({ path: path.join(dir, `f${String(n).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 88, timeout: 180000 });
  n++;
}
// (what was rendered: as a wav, 16 bits)
let wav = null;
if (SOUND) {
  const info = await pg.evaluate(async (secs) => {
    const c = window.__octx;
    if (!c || !window.__adone) return { err: 'no audio context was made' };
    c.resume0();
    const buf = await window.__adone;
    const n = Math.min(buf.length, Math.round(secs * c.sampleRate));
    const L = buf.getChannelData(0);
    const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
    const out = new Int16Array(n * 2);
    let peak = 0;
    for (let i = 0; i < n; i++) {
      peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
      out[i * 2] = Math.max(-1, Math.min(1, L[i])) * 32767;
      out[i * 2 + 1] = Math.max(-1, Math.min(1, R[i])) * 32767;
    }
    const u8 = new Uint8Array(out.buffer);
    let b64 = '';
    for (let i = 0; i < u8.length; i += 30000) b64 += btoa(String.fromCharCode.apply(null, u8.subarray(i, i + 30000)));
    window.__pcm = b64;
    return { n, sr: c.sampleRate, peak: +peak.toFixed(3), len: b64.length };
  }, n / FPS + 0.5);
  if (info.err) console.log('SOUND: ' + info.err);
  else {
    // (out of the page a piece at a time)
    let b64 = '';
    for (let i = 0; i < info.len; i += 4000000) b64 += await pg.evaluate(([a, b]) => window.__pcm.slice(a, b), [i, i + 4000000]);
    const pcm = Buffer.from(b64, 'base64');
    const h = Buffer.alloc(44);
    h.write('RIFF', 0);
    h.writeUInt32LE(36 + pcm.length, 4);
    h.write('WAVEfmt ', 8);
    h.writeUInt32LE(16, 16);
    h.writeUInt16LE(1, 20);
    h.writeUInt16LE(2, 22);
    h.writeUInt32LE(info.sr, 24);
    h.writeUInt32LE(info.sr * 4, 28);
    h.writeUInt16LE(4, 32);
    h.writeUInt16LE(16, 34);
    h.write('data', 36);
    h.writeUInt32LE(pcm.length, 40);
    wav = path.join(OUT, `${name}.wav`);
    fs.writeFileSync(wav, Buffer.concat([h, pcm]));
    console.log(`sound: ${(info.n / info.sr).toFixed(1)} s, its loudest ${info.peak}`);
  }
}
await close();
const mp4 = path.join(OUT, `${name}.mp4`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%04d.jpg'), ...(wav ? ['-i', wav, '-c:a', 'aac', '-b:a', '128k', '-shortest'] : []), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', process.env.CRF || '24', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-movflags', '+faststart', mp4]);
console.log(`${name}.mp4  ${n} pictures, ${(n / FPS).toFixed(1)} s  (${Math.round((Date.now() - t0) / 1000)} s)`);
