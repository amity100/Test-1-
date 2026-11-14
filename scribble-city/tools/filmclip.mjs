// A scene of the story's film as a moving picture, as a phone draws it (no sound; its words are on the screen): the scene is prepared
// and played by the story's own test pilot (tools/perf/lib.mjs open), stepped a fifteenth of a second a picture, and the pictures
// put together by ffmpeg. For judging a scene in motion - a walk, a cut, a hand - before the owner sees it.
//   node tools/filmclip.mjs <outDir> <scene 1-9> <from s> <to s>      EXTRA="look=1"   FPS=15   NAME=s2
//   SOUND=1: with the game's own sound - its voices, its music, its air, as the game mixes them. A browser without a screen plays
//   nothing that can be recorded, and the pictures are not taken in real time: so the game is given an audio context that renders
//   into memory (OfflineAudioContext) in place of the live one, and it is run by hand, a fifteenth of a second a picture; at the
//   end what it rendered is written as a wav and put under the pictures by ffmpeg
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
const MAXS = Math.ceil(T1 - T0 + 12);
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
const steps = Math.round(30 / FPS);
let n = 0;
for (;;) {
  const r = await pg.evaluate(async ([steps, quanta]) => {
    window.__frame(steps, 1 / 30);
    const P = window.__game.prologue;
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
  if (r.scene !== sc || r.t > T1 || n > 3000) break;
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
