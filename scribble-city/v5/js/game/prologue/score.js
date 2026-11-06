// (v5, ROADMAP 18) The prologue's music: the score of the city's last sunset. Not the band's songs
// made out of a number (core/music.js) but pieces written for it, each with its own chords, bass
// line and beat, and one tune that comes back in all of them - the hook: the swagger of the opening
// over the bay, the chase, the title over the jump, and a piano alone at the end. It is played the
// way the band plays, every sound made on the spot (no sound files), with a few instruments grown
// for the screen: pads that breathe in, a bass and a lead that each play one note at a time (their
// oscillators run the whole cue and a note only moves their pitch, their filter and their volume -
// cheap enough for a phone), a gated snare, steel drums, an electric piano, and one room for all of
// it to ring in.
//
// The director (game/prologue/director.js) calls the cues by name:
//  - opening  the fly-over at sunset and the first minute of the city: synth-funk in A minor at
//             104 bpm. Four bars come in once (the pads, a taste of the hook on the steel drums, the
//             beat), then 32 bars go round: the hook, the bridge (steel drums, a sliding whistle),
//             the hook again with claps, and a breakdown with the hook on the steel drums;
//  - chase    A minor at 144 bpm, 16 bars round. How hard it goes is the heat (heat(0..1)): cold, a
//             ticking clock and a low pulse; hot, a galloping bass, four to the floor, brass stabs,
//             toms, and the hook on top. Left to itself it climbs a little as it goes;
//  - slowmo   time slowing: everything drops away, then a drone, a heartbeat and a swell held under
//             the action for as long as it lasts;
//  - title    the top of the jump: the hit on the call (whatever played is cut off by it), a bright
//             chord, the hook's first two bars big; four and a half seconds on it lands on A and
//             hands back to the chase at full heat;
//  - ending   the lookout: an electric piano and a pad at 66 bpm, never quite coming home; the hook
//             comes back on the piano as the camera draws away, and stops short of home;
//  - and three stings that play over whatever is playing: discovery (the men by the car park: a
//    low swell), hit (a punch), land (a car coming down hard).
// play(name, { fade }) crossfades from what plays to the cue, stop({ fade }) fades it out, heat(k)
// says how hot the chase is, level(v) turns the whole score down or up, now is the audio's clock.
// The notes are written a moment ahead by a timer of the score's own (and by update(), if it is
// called every frame), so a late frame leaves no gap; the sound off or the music turned down to
// nothing, no notes are written at all.

import { loadTrack, trackBuf, Looper } from './tracks.js';

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
// nothing below a, all of it above b, a smooth way between
const ramp = (x, a, b) => {
  const u = clamp((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
// how loud a letter of a pattern is: X an accent, x a hit, o a soft one, g a ghost
const V = { X: 1, x: 0.78, o: 0.55, g: 0.32 };
// how far ahead the notes are written (seconds): enough for a frame or a timer that comes late
const AHEAD = 0.35;
// the whole score's level into the music volume, and each cue's against the others (the chase
// under the title's hit; the ending and the discovery under the words said over them)
const TRIM = 0.55;
const LEVEL = { opening: 1, chase: 0.82, slowmo: 0.9, title: 1, ending: 1, discovery: 0.6, hit: 1.5, land: 1, wheel: 1.25, unease: 1.05, memory: 0.9, surreal: 1.0 };
// how loud the room comes back
const ROOM = 2.5;

// a value held where it is at t, all that was to come after it forgotten
function hold(p, t) {
  if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
  else {
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
  }
}

// a second of noise, the same every time (when the game's own is not there)
function noiseBuf(c) {
  const b = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const d = b.getChannelData(0);
  let s = 777;
  for (let i = 0; i < d.length; i++) d[i] = ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  return b;
}

// the room: a couple of seconds of noise dying away (to a thousandth by its end), darker as it
// dies (the highs go first), a little different in each ear, made by hand (whole numbers for the
// noise, one multiplication a sample for the dying away) - the same room every time
function roomIR(c, secs) {
  const n = Math.floor(c.sampleRate * secs);
  const pre = Math.floor(c.sampleRate * 0.014);
  const m = n - pre;
  const b = c.createBuffer(2, n, c.sampleRate);
  const fall = Math.exp(-6.9 / m);
  let s = 4242;
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let lp = 0;
    let env = 1;
    for (let i = 0; i < m; i++) {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      lp += ((s | 0) / 2147483648 - lp) * (0.88 - (0.72 * i) / m);
      d[pre + i] = lp * env;
      env *= fall;
    }
  }
  return b;
}

// The room hung in the reverb: in the game, the same thing rendered to one side - the noise through
// a filter closing and a level dying away, played by an offline context on a thread of its own, so
// that nothing of it is on the game's frames - and hung in when it is ready (the first moment of the
// first cue rings without it). Rendered offline itself (the score's tests), or with no offline
// context to be had, made by hand on the spot.
function hangRoom(c, verb, noise, secs) {
  const W = typeof window !== 'undefined' ? window : globalThis;
  const OAC = W.OfflineAudioContext || W.webkitOfflineAudioContext;
  const byHand = () => {
    try {
      verb.buffer = roomIR(c, secs);
    } catch (e) {
      // (no room: the score plays dry)
    }
  };
  if (!OAC || c instanceof OAC || !noise) return byHand();
  try {
    const off = new OAC(2, Math.floor(c.sampleRate * secs), c.sampleRate);
    const mg = off.createChannelMerger(2);
    for (let ch = 0; ch < 2; ch++) {
      const s = off.createBufferSource();
      s.buffer = noise;
      s.loop = true;
      s.connect(mg, 0, ch);
      s.start(0.014, ch * 0.41);
    }
    const f = off.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 0;
    f.frequency.setValueAtTime(15000, 0);
    f.frequency.exponentialRampToValueAtTime(1200, secs);
    const g = off.createGain();
    g.gain.setValueAtTime(1, 0);
    g.gain.exponentialRampToValueAtTime(0.001, secs);
    mg.connect(f).connect(g).connect(off.destination);
    const hang = (b) => {
      try {
        verb.buffer = b;
      } catch (e) {
        // (no room: the score plays dry)
      }
    };
    const p = off.startRendering();
    if (p && p.then) p.then(hang, byHand);
    else off.oncomplete = (e) => hang(e.renderedBuffer);
  } catch (e) {
    byHand();
  }
}

// ------------------------------------------------------------------ the charts

// The hook: four bars of sixteenths, [step, note, length]. A call that falls (E D E, down to A,
// in threes - three, three, two - the way the bass walks), its answer a step lower (D C D, down
// to G and home to A); then the call again reaching up the octave, and an answer that does not
// quite come home (it stops on B over the E7: the city is not done with you).
const HOOK = [
  [[0, 76, 3], [3, 74, 3], [6, 76, 2], [8, 69, 6], [14, 72, 2]],
  [[0, 74, 3], [3, 72, 3], [6, 74, 2], [8, 67, 4], [12, 69, 4]],
  [[0, 76, 3], [3, 74, 3], [6, 76, 2], [8, 81, 4], [12, 79, 2], [14, 76, 2]],
  [[0, 74, 3], [3, 72, 3], [6, 71, 2], [8, 72, 2], [10, 71, 6]],
];
// the steps of the threes (3 + 3 + 2, twice): the bass's, the steel drums', the stabs'
const TRES = [0, 3, 6, 8, 11, 14];

// the opening's chords: the bass's root and the pad's notes (E7: its sus4 first, the 7 from the
// middle of the bar)
const OC = {
  Am9: { r: 33, pad: [55, 60, 64, 71] },
  Dm9: { r: 38, pad: [60, 64, 65, 69] },
  Fmaj9: { r: 29, pad: [60, 64, 67, 69] },
  E7: { r: 28, pad: [62, 64, 69, 71], then: [62, 64, 68, 71] },
  G6: { r: 31, pad: [62, 64, 67, 71] },
  Em7: { r: 28, pad: [59, 62, 67, 71] },
  Bb: { r: 34, pad: [62, 64, 65, 69] },
  E7s9: { r: 28, pad: [56, 62, 67, 71] },
};
const O_INTRO = ['Am9', 'Dm9', 'Fmaj9', 'E7'];
const O_HOOK = ['Am9', 'Dm9', 'Fmaj9', 'E7', 'Am9', 'Dm9', 'Fmaj9', 'E7'];
const O_BRIDGE = ['Fmaj9', 'G6', 'Em7', 'Am9', 'Fmaj9', 'G6', 'Bb', 'E7s9'];
// the 32 bars that go round: the hook, the bridge, the hook again, the breakdown (on the hook's chords)
const O_LOOP = [...O_HOOK, ...O_BRIDGE, ...O_HOOK, ...O_HOOK];
// the bass: [step, interval over the root, length, how hard]
const B_HOOK = [[0, 0, 2, 1], [3, 0, 1, 0.7], [6, 12, 1, 0.9], [8, 0, 2, 1], [11, 0, 1, 0.7], [12, 12, 1, 0.85], [14, 7, 2, 0.8]];
const B_BRIDGE = [[0, 0, 5, 1], [6, 7, 2, 0.8], [8, 12, 3, 0.9], [12, 0, 2, 0.8], [14, 7, 2, 0.75]];
const B_DOWN = [[0, 0, 7, 0.9], [8, 0, 3, 0.8], [11, 12, 1, 0.7], [14, 7, 2, 0.7]];
const B_LONG = [[0, 0, 15, 0.8]];
const O_KICK = ['X.....x.X.......', 'X.....x.X..x....'];
const O_KICK_B = ['X.......X.......', 'X.......X..x....'];
const O_HATS = 'XoxoXoxoXoxoXoxo';
const O_HATS_B = '..x...x...x...x.';
const SHAKE = 'xoxoxoxoxoxoxoxo';
// the whistle over the bridge, sliding from note to note
const WHISTLE = [
  [[0, 69, 4], [4, 72, 4], [8, 76, 8]],
  [[0, 74, 8], [8, 71, 4], [12, 74, 4]],
  [[0, 79, 12], [12, 76, 4]],
  [[0, 76, 8], [8, 72, 4], [12, 71, 4]],
  [[0, 69, 4], [4, 72, 4], [8, 79, 8]],
  [[0, 76, 8], [8, 74, 8]],
  [[0, 76, 8], [8, 77, 4], [12, 76, 4]],
  [[0, 79, 6], [6, 80, 6], [12, 71, 4]],
];
// the toms down a fill
const TOMS = [220, 196, 165, 147, 131, 110];

// the chase's chords: the root, the brass's stab, the dark pad
const CC = {
  Am: { r: 33, stab: [57, 60, 64], pad: [45, 52, 57, 60] },
  F: { r: 29, stab: [57, 60, 65], pad: [41, 48, 53, 57] },
  G: { r: 31, stab: [59, 62, 67], pad: [43, 50, 55, 59] },
  Bb: { r: 34, stab: [58, 62, 65], pad: [46, 53, 58, 62] },
  E: { r: 28, stab: [56, 59, 64], pad: [40, 47, 52, 56] },
};
const C_BARS = ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'Bb', 'E', 'F', 'G', 'Am', 'Am', 'F', 'G', 'Bb', 'E'];
// the gallop: root, root, octave, in threes
const GALLOP = [0, 0, 12, 0, 0, 12, 0, 12, 0, 0, 12, 0, 0, 12, 0, 12];
const ACCENT = [1, 0.6, 0.8, 1, 0.6, 0.8, 1, 0.8, 1, 0.6, 0.8, 1, 0.6, 0.8, 1, 0.8];
// (the last bar's last beat: E F G G#, up into A)
const RUN = [0, 1, 3, 4];
const C_KICK = ['X...x...X...x...', 'X...x...X...x.x.'];
const C_HATS = 'XoxoXoxoXoxoXoxo';
const STABS = { Am: [0, 3, 6], F: [0, 3, 6, 10], G: [0, 3, 6, 10], Bb: [0, 3, 6, 8, 11, 14], E: [0, 3, 6, 8, 10, 12, 14] };

// the ending's bars: the bass (the piano's left hand) and the chord over it
const E_BARS = [
  { r: 45, ch: [55, 59, 60, 64] }, // Am9
  { r: 41, ch: [57, 60, 64, 67] }, // Fmaj7
  { r: 38, ch: [57, 60, 64, 65] }, // Dm9
  { r: 40, ch: [57, 59, 62, 64] }, // Esus4
  { r: 41, ch: [57, 60, 64, 67] }, // Fmaj7
  { r: 40, ch: [56, 59, 62, 64] }, // E7 - and it does not go home:
  { r: 41, ch: [57, 59, 60, 64] }, // Fmaj7#11 (the hook)
  { r: 48, ch: [55, 59, 64, 67] }, // Am7 over C (the hook stops on G)
  { r: 38, ch: [57, 60, 64, 65] }, // Dm9
  { r: 34, ch: [57, 62, 64, 65] }, // Bbmaj7#11 (the ghost)
  { r: 41, ch: [57, 60, 64, 67] }, // Fmaj7
  { r: 40, ch: [57, 59, 62, 64] }, // Esus4
  { r: 45, ch: [55, 59, 60, 64] }, // Am9
  { r: 41, ch: [57, 59, 60, 64] }, // Fmaj7#11 (the hook, an octave up)
  { r: 48, ch: [55, 59, 64, 67] }, // Am7 over C
  { r: 34, ch: [57, 62, 64, 65] }, // Bbmaj7#11 (the ghost)
];
// the hook's first two bars, slow, the second left on G
const E_HOOK = [
  [[0, 76, 3], [3, 74, 3], [6, 76, 2], [8, 69, 6], [14, 72, 2]],
  [[0, 74, 3], [3, 72, 3], [6, 74, 2], [8, 67, 8]],
];
// the piano: [step, which note of the chord (-1 the bass), octave up, how hard]
const P_ARP = [[0, -1, 0, 1], [2, 0, 0, 0.55], [4, 1, 0, 0.5], [6, 2, 0, 0.55], [8, 3, 0, 0.6], [12, 2, 12, 0.32]];
const P_SPARSE = [[0, -1, 0, 0.9], [0, 1, 0, 0.32], [0, 2, 0, 0.32], [0, 3, 0, 0.3]];

// ------------------------------------------------------------------ one note at a time

// A synth that plays one note at a time (the bass, the lead, the whistle): its oscillators run from
// the cue's start to its end, and a note only moves their pitch (sliding to it, with glide), their
// filter and their volume. Each oscillator is [wave, octave, detune (cents), level].
class Mono {
  constructor(q, out, oscs, { cut = 2000, res = 1, vib = 0, rate = 5.5 } = {}) {
    const c = q.c;
    this.f = c.createBiquadFilter();
    this.f.type = 'lowpass';
    this.f.frequency.value = cut;
    this.f.Q.value = res;
    this.v = c.createGain();
    this.v.gain.value = 0;
    this.f.connect(this.v).connect(out);
    this.o = oscs.map(([type, oct, det, vol]) => {
      const o = c.createOscillator();
      o.type = type;
      o.detune.value = det;
      const g = c.createGain();
      g.gain.value = vol;
      o.connect(g).connect(this.f);
      o.start(q.t0);
      q.live.push(o);
      return { o, mul: Math.pow(2, oct), g: g.gain };
    });
    // (the vibrato: a slow wobble of the pitch, coming in once the note has been held a moment)
    this.vibAmt = vib;
    if (vib) {
      const l = c.createOscillator();
      l.frequency.value = rate;
      this.vib = c.createGain();
      this.vib.gain.value = 0;
      l.connect(this.vib);
      for (const { o } of this.o) this.vib.connect(o.detune);
      l.start(q.t0);
      q.live.push(l);
    }
    this.held = -1;
    this.m = null;
  }

  // a note: m (a MIDI number) at t, held dur seconds. a, d, s, r: the attack and the decay (time
  // constants), the sustain (a part of vol), the release; cut, env, et: the filter's cutoff, how
  // much higher it opens at the note's start, how fast it closes again
  note(t, m, dur, { vol = 0.1, glide = 0, a = 0.004, d = 0.2, s = 0.7, r = 0.05, cut = 0, env = 0, et = 0.08 } = {}) {
    // (the last note still held: no new attack, only the slide to this one)
    const tied = t < this.held - 0.002;
    const f = hz(m);
    for (const { o, mul } of this.o) {
      const p = o.frequency;
      p.cancelScheduledValues(t);
      if (glide && this.m !== null) p.setTargetAtTime(f * mul, t, glide);
      else p.setValueAtTime(f * mul, t);
    }
    const g = this.v.gain;
    g.cancelScheduledValues(t);
    if (!tied) g.setTargetAtTime(vol, t, a);
    g.setTargetAtTime(vol * s, t + Math.min(a * 3, dur * 0.5), d);
    g.setTargetAtTime(0, t + dur, r);
    if (cut) {
      const p = this.f.frequency;
      p.cancelScheduledValues(t);
      if (env && !tied) {
        p.setTargetAtTime(cut * (1 + env), t, 0.002);
        p.setTargetAtTime(cut, t + 0.008, et);
      } else p.setTargetAtTime(cut, t, 0.03);
    }
    if (this.vib) {
      const p = this.vib.gain;
      p.cancelScheduledValues(t);
      p.setTargetAtTime(0, t, 0.03);
      p.setTargetAtTime(this.vibAmt, t + Math.min(0.22, dur * 0.45), 0.12);
    }
    this.held = t + dur;
    this.m = m;
  }

  // one oscillator's level from t (a layer in or out: the lead's octave below)
  layer(j, vol, t) {
    const p = this.o[j].g;
    p.cancelScheduledValues(t);
    p.setTargetAtTime(vol, t, 0.05);
  }
}

// ------------------------------------------------------------------ a cue

// A cue: its own way into the score's mix (and into the room), a clock of sixteenths at its tempo
// (tick() says what plays on each), and the instruments, made fresh for each note and gone after it.
class Cue {
  constructor(score, t0, name, o = {}) {
    const c = score.c;
    this.s = score;
    this.c = c;
    this.t0 = t0;
    this.name = name;
    this.o = o;
    this.noise = score.noise;
    // dry, through a filter of its own (open; closed down when time slows), and into the room;
    // both faded in and out together
    this.out = c.createGain();
    this.out.gain.value = 0;
    this.lp = c.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 18000;
    this.lp.Q.value = 0.5;
    this.out.connect(this.lp).connect(score.mix);
    this.wet = c.createGain();
    this.wet.gain.value = 0;
    this.wet.connect(score.room);
    // what runs the whole cue (stopped at its end), and what is wired in a loop (cut at the end)
    this.live = [];
    this.loops = [this.lp];
    // (how loud the cue sits against the others)
    this.vol = LEVEL[name] || 1;
    this.bpm = 0;
    this.swing = 0;
    this.step = 0;
    this.next = t0;
    this.until = Infinity;
    this.dead = Infinity;
  }

  fadeIn(t, secs) {
    const v = this.vol;
    for (const p of [this.out.gain, this.wet.gain]) {
      if (secs > 0.01) {
        p.setValueAtTime(0, t);
        p.linearRampToValueAtTime(v, t + secs);
      } else p.setValueAtTime(v, t);
    }
  }

  // a sting: on at once, at its level
  sting() {
    this.out.gain.value = this.vol;
    this.wet.gain.value = this.vol;
  }

  // write the notes due in the next moment (in time order: each instrument's next note always
  // after its last)
  schedule(now) {
    if (!this.bpm) return;
    const spb = 60 / this.bpm / 4;
    // (far behind - a long stall: skip on rather than play it all at once)
    if (this.next < now - 0.2) {
      const n = Math.ceil((now - this.next) / spb);
      this.next += n * spb;
      this.step += n;
    }
    const quiet = !this.s.audible();
    while (this.next < now + AHEAD && this.next < this.until) {
      if (!quiet) this.tick(this.step, this.next + (this.step % 2 ? this.swing * spb : 0), spb);
      this.next += spb;
      this.step++;
    }
  }

  tick() {}

  // everything falls away: the cue's own filter closing down (time slowing)
  drop(t, secs) {
    const p = this.lp.frequency;
    p.cancelScheduledValues(t);
    p.setValueAtTime(18000, t);
    p.exponentialRampToValueAtTime(110, t + Math.max(0.2, secs));
  }

  // out over fade seconds from t (a cue may go its own way, knowing which comes next: the slowmo)
  release(t, fade) {
    const f = Math.max(0.02, fade);
    for (const p of [this.out.gain, this.wet.gain]) {
      hold(p, t);
      p.setTargetAtTime(0, t, f / 4);
    }
    this.until = Math.min(this.until, t + f);
    const end = t + f * 1.8 + 0.05;
    for (const s of this.live) {
      try {
        s.stop(end);
      } catch (e) {
        // (stopped already)
      }
    }
    this.dead = end + 0.6;
  }

  dispose() {
    for (const s of this.live) {
      try {
        s.stop();
      } catch (e) {
        // (stopped already)
      }
    }
    for (const n of [this.out, this.wet, ...this.loops]) n.disconnect();
  }

  // ---------------------------------------------------------------- its wiring
  // a bus into the cue (send: how much of it goes into the room)
  bus(send = 0, vol = 1, to = this.out) {
    const g = this.c.createGain();
    g.gain.value = vol;
    g.connect(to);
    if (send) {
      const s = this.c.createGain();
      s.gain.value = send;
      g.connect(s).connect(this.wet);
    }
    return g;
  }

  // an echo: what goes into src comes back secs later, and again softer, darker each time
  echo(src, secs, fb, mix, pan = 0.35) {
    const c = this.c;
    const d = c.createDelay(2);
    d.delayTime.value = secs;
    const k = c.createGain();
    k.gain.value = fb;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2400;
    const w = c.createGain();
    w.gain.value = mix;
    const p = c.createStereoPanner();
    p.pan.value = pan;
    src.connect(d);
    d.connect(f);
    f.connect(k).connect(d);
    f.connect(w).connect(p).connect(this.out);
    this.loops.push(d, k, f, w, p);
  }

  // a channel of noise running the whole cue, heard only when it is hit (the hats, the shaker,
  // the snare's rattle): no new sound made for each hit, only its volume moved
  chan(type, freq, q, out, off = 0) {
    const c = this.c;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(out);
    src.start(this.t0, off);
    this.live.push(src);
    return { g: g.gain, f: f.frequency };
  }

  // a hit on a channel: at once up, then away (or held, then shut: the gated snare of the
  // eighties); a hit before the last one is done cuts it short, as a hi-hat does
  hit(ch, t, vol, dec, gate = 0) {
    const g = ch.g;
    g.cancelScheduledValues(t);
    g.setValueAtTime(vol, t);
    if (gate) {
      g.setTargetAtTime(vol * 0.45, t + 0.002, 0.025);
      g.setTargetAtTime(0, t + gate, 0.01);
    } else g.setTargetAtTime(0, t + 0.002, dec / 3);
  }

  // ---------------------------------------------------------------- the instruments
  // the kick: a sine falling fast from high to low (the punch), held a moment, then let go; slower
  // and lower, the boom under a big moment, or a heartbeat
  kick(t, vol, out, f0 = 170, f1 = 45, dec = 0.3, sweep = 0.07) {
    const c = this.c;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + sweep);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.002);
    g.gain.setTargetAtTime(0, t + 0.02, dec / 4);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.02 + dec * 1.8);
  }

  tom(t, f, vol, out) {
    this.kick(t, vol, out, f * 1.5, f, 0.34, 0.05);
  }

  // a short pitched knock (the snare's body)
  knock(t, f0, f1, dur, vol, out) {
    const c = this.c;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.002);
    g.gain.setTargetAtTime(0, t + 0.005, dur / 3);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur * 2.2);
  }

  // the snare: its rattle on the snare channel (gated: a big room shut off short), its body a knock
  snare(t, vol, gate = 0.16) {
    this.hit(this.snr, t, vol, 0.12, gate);
    this.knock(t, 240, 165, 0.09, vol * 0.5, this.snrOut);
  }

  // the clap: three slaps a hair apart and a breath of room after them
  clap(t, vol) {
    const g = this.clp.g;
    g.cancelScheduledValues(t);
    [0, 0.011, 0.023].forEach((d, i) => {
      g.setValueAtTime(vol * (i === 2 ? 1 : 0.7), t + d);
      g.setTargetAtTime(vol * 0.12, t + d + 0.001, 0.004);
    });
    g.setTargetAtTime(0, t + 0.03, 0.05);
  }

  // a burst of noise through a filter that moves (f0 to f1): a blast, a rush of air, a scrape
  burst(t, dur, vol, out, type, f0, f1, q = 0.7) {
    const c = this.c;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.setTargetAtTime(0, t + 0.004, dur / 3.5);
    s.connect(f).connect(g).connect(out);
    s.start(t, (t * 0.37) % 0.9);
    s.stop(t + dur * 1.6 + 0.05);
  }

  crash(t, vol, out, dec = 1.6) {
    this.burst(t, dec, vol, out, 'highpass', 5200, 3800, 0.6);
  }

  // a riser: noise climbing in pitch and in loudness to t + dur, and cut there (the beat lands)
  riser(t, dur, vol, out, f0 = 400, f1 = 6500) {
    const c = this.c;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.8;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur);
    g.gain.setTargetAtTime(0, t + dur, 0.012);
    s.connect(f).connect(g).connect(out);
    s.start(t, (t * 0.53) % 0.9);
    s.stop(t + dur + 0.1);
  }

  // a pad: the chord on pairs of saws a little apart (one to the left, one to the right; with mid,
  // a third in the middle), through one filter (cut, moving to cut1 if asked), breathing in and out.
  // Short and sharp, the same thing is the brass's stab
  pad(t, notes, dur, out, { vol = 0.03, a = 0.2, r = 0.4, cut = 1400, cut1 = 0, ct = 0.1, q = 0.6, type = 'sawtooth', det = 9, wide = 0.6, mid = false } = {}) {
    const c = this.c;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(cut, t);
    if (cut1) f.frequency.setTargetAtTime(cut1, t + 0.005, ct);
    const g = c.createGain();
    const hold_ = Math.max(a, dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.setTargetAtTime(0, t + hold_, r / 3);
    f.connect(g).connect(out);
    const L = c.createStereoPanner();
    L.pan.value = -wide;
    const R = c.createStereoPanner();
    R.pan.value = wide;
    L.connect(f);
    R.connect(f);
    const end = t + hold_ + r * 2.6;
    for (const m of notes) {
      const voices = mid ? [[-det, L], [det, R], [0, f]] : [[-det, L], [det, R]];
      for (const [d, to] of voices) {
        const o = c.createOscillator();
        o.type = type;
        o.frequency.value = hz(m);
        o.detune.value = d;
        o.connect(to);
        o.start(t);
        o.stop(end);
      }
    }
  }

  // the steel drums: a sine and its octave (gone sooner), struck a hair sharp and settling
  steel(t, m, vol, out, dec = 0.55) {
    const c = this.c;
    const f = hz(m);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.003);
    g.gain.setTargetAtTime(0, t + 0.01, dec / 4);
    g.connect(out);
    const end = t + 0.01 + dec * 1.7;
    for (const [mul, amp, tau] of [[1, 1, 0], [2, 0.45, 0.13]]) {
      const o = c.createOscillator();
      o.frequency.setValueAtTime(f * mul * 1.012, t);
      o.frequency.setTargetAtTime(f * mul, t, 0.012);
      const k = c.createGain();
      k.gain.setValueAtTime(amp, t);
      if (tau) k.gain.setTargetAtTime(0, t + 0.002, tau);
      o.connect(k).connect(g);
      o.start(t);
      o.stop(end);
    }
  }

  // the electric piano: one sine bending another (the bark of it at the strike, mellowing as it
  // rings), a quick fall and then a long one
  piano(t, m, vol, out, dec = 2.6) {
    const c = this.c;
    const f = hz(m);
    const car = c.createOscillator();
    car.frequency.value = f;
    const mod = c.createOscillator();
    mod.frequency.value = f;
    const idx = c.createGain();
    idx.gain.setValueAtTime(f * 1.1, t);
    idx.gain.setTargetAtTime(f * 0.12, t, 0.18);
    mod.connect(idx).connect(car.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.setTargetAtTime(vol * 0.45, t + 0.01, 0.3);
    g.gain.setTargetAtTime(0, t + 0.5, dec / 4);
    car.connect(g).connect(out);
    const end = t + 0.5 + dec * 1.8;
    car.start(t);
    mod.start(t);
    car.stop(end);
    mod.stop(end);
  }
}

// ------------------------------------------------------------------ the opening

class Opening extends Cue {
  constructor(s, t0, o) {
    super(s, t0, 'opening', o);
    this.bpm = 104;
    // (a little lazy: the off sixteenths a touch late)
    this.swing = 0.08;
    const spb = 60 / this.bpm / 4;
    this.drums = this.bus(0.14);
    this.snrOut = this.drums;
    this.low = this.bus(0.02);
    this.keys = this.bus(0.45);
    this.lead = this.bus(0.38);
    this.hat = this.chan('highpass', 8200, 0.7, this.drums, 0.1);
    this.ohat = this.chan('highpass', 6800, 0.6, this.drums, 0.4);
    this.shk = this.chan('bandpass', 6200, 1.6, this.drums, 0.7);
    this.snr = this.chan('bandpass', 2100, 0.55, this.drums, 0.25);
    this.clp = this.chan('bandpass', 1300, 1.3, this.drums, 0.55);
    this.bs = new Mono(this, this.low, [['sawtooth', 0, 0, 0.55], ['sine', 0, 0, 0.65]], { cut: 450, res: 4.5 });
    this.ld = new Mono(this, this.lead, [['sawtooth', 0, -6, 0.5], ['square', 0, 6, 0.3], ['square', -1, 0, 0]], { cut: 2600, res: 2.2, vib: 12 });
    this.wh = new Mono(this, this.lead, [['triangle', 0, 0, 0.8], ['sine', 1, 0, 0.12]], { cut: 3800, res: 0.7, vib: 20, rate: 5.1 });
    this.echo(this.lead, spb * 3, 0.33, 0.28);
  }

  // the pads give way to the kick a moment, every kick (they pump with it)
  duck(t) {
    const g = this.keys.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0.5, t, 0.004);
    g.setTargetAtTime(1, t + 0.03, 0.13);
  }

  tick(i, t, spb) {
    const k = i % 16;
    const b = (i - k) / 16;
    const intro = b < 4;
    const n = intro ? -1 : (b - 4) % 32;
    // the part: -1 the intro, 0 the hook, 1 the bridge, 2 the hook again, 3 the breakdown
    const sec = intro ? -1 : n >> 3;
    const m = intro ? b : n & 7;
    const hook = sec === 0 || sec === 2;
    const ch = OC[intro ? O_INTRO[b] : O_LOOP[n]];
    const nx = OC[intro ? (b < 3 ? O_INTRO[b + 1] : O_LOOP[0]) : O_LOOP[(n + 1) % 32]];

    // the pads (the E7 moves from its sus4 at the middle of the bar)
    if (k === 0 || (k === 8 && ch.then)) {
      const notes = k === 8 ? ch.then : ch.pad;
      const len = (ch.then ? 8 : 16) * spb;
      let P;
      if (intro) P = { vol: 0.03, a: b === 0 ? 2.2 : 0.3, r: 0.6, cut: 380 + b * 340, cut1: 640 + b * 380, ct: 1.2 };
      else if (sec === 1) P = { vol: 0.032, a: 0.3, r: 0.7, cut: 1500 };
      else if (sec === 3) P = { vol: 0.027, a: 0.45, r: 0.8, cut: 950 };
      else P = { vol: 0.03, a: 0.05, r: 0.35, cut: 1350 };
      this.pad(t, notes, len, this.keys, P);
    }

    // the bass: one long note a bar to start with; the threes under the hook; longer lines under the
    // bridge; a step up or down into the next chord's root
    const pat = intro ? (b < 2 ? B_LONG : B_BRIDGE) : sec === 1 ? B_BRIDGE : sec === 3 ? B_DOWN : B_HOOK;
    const appr = nx.r !== ch.r && !(intro && b < 2);
    for (const [st, iv, len, v] of pat) {
      if (st !== k || (appr && st === 15)) continue;
      const L = appr && st + len > 15 ? 15 - st : len;
      this.bs.note(t, ch.r + iv, L * spb * 0.9, { vol: 0.24 * v, cut: pat === B_LONG ? 300 : 420, env: pat === B_LONG ? 0 : 3.2, et: 0.07, a: 0.003, d: 0.25, s: 0.6, r: 0.03 });
    }
    if (appr && k === 15) this.bs.note(t, nx.r + (nx.r > ch.r ? -1 : 1), spb * 0.9, { vol: 0.2, cut: 420, env: 2.5, et: 0.06, a: 0.003, d: 0.2, s: 0.6, r: 0.03 });

    // the kick (and the pads pumping with it)
    let kp = null;
    if (intro) kp = b === 2 ? 'X.......X.......' : b === 3 ? 'X.....x.X.......' : null;
    else if (sec === 3) kp = 'X.......o.......';
    else kp = (sec === 1 ? O_KICK_B : O_KICK)[m & 1];
    if (kp && kp[k] !== '.') {
      this.kick(t, 0.5 * V[kp[k]], this.drums);
      if (!intro && sec !== 3) this.duck(t);
    }

    // the snare on two and four, a clap with it the second time round the hook; into the hook
    // from the intro, a fill; out of the breakdown, a roll
    if (hook || sec === 1) {
      if (k === 4 || k === 12) {
        this.snare(t, sec === 1 ? 0.24 : 0.28);
        if (sec === 2) this.clap(t, 0.2);
      }
      if (hook && m === 7 && k === 15) this.snare(t, 0.08, 0.05);
    }
    if (intro && b === 3 && (k === 4 || k >= 12)) this.snare(t, k === 4 ? 0.2 : 0.1 + (k - 12) * 0.05, k === 4 ? 0.16 : 0.06);
    if (sec === 3 && m === 7) this.snare(t, 0.04 + 0.2 * Math.pow(k / 15, 2), 0.05);
    // the toms down out of the bridge into the hook
    if (sec === 1 && m === 7 && k >= 10) this.tom(t, TOMS[k - 10], 0.32, this.drums);

    // the hats, the open hat on the and of four (every off-beat, the second time round), the shaker
    const hp = intro ? (b >= 2 ? O_HATS_B : null) : hook ? O_HATS : sec === 1 ? O_HATS_B : null;
    if (hp && hp[k] !== '.') this.hit(this.hat, t, 0.06 * V[hp[k]], 0.045);
    if (hook && ((m & 1 && k === 14) || (sec === 2 && k % 4 === 2))) this.hit(this.ohat, t, 0.045, 0.22);
    if ((intro && b >= 1) || sec === 1 || sec === 3) this.hit(this.shk, t, (intro ? 0.024 : 0.032) * V[SHAKE[k]], 0.07);

    // a crash on the downbeat of each part (not the breakdown); risers into the hook
    if (k === 0 && !intro && m === 0 && sec !== 3) this.crash(t, sec === 1 ? 0.05 : 0.08, this.drums);
    if (k === 0 && ((intro && b === 2) || ((sec === 1 || sec === 3) && m === 6))) this.riser(t, 32 * spb, intro ? 0.05 : 0.035, this.keys);

    // the hook (the octave below it joins the second time round)
    if (k === 0 && m === 0 && !intro) this.ld.layer(2, sec === 2 ? 0.26 : 0, t);
    if (hook) {
      for (const [st, mm, len] of HOOK[m & 3]) if (st === k) this.ld.note(t, mm, len * spb * 0.86, { vol: 0.12, glide: 0.012, a: 0.005, d: 0.3, s: 0.75, r: 0.06 });
    }

    // the steel drums: a taste of the hook in the intro; over the hook the second time round, an
    // octave up; the hook itself in the breakdown; the threes up the chord in the bridge
    const steelHook = intro ? (b === 1 ? HOOK[0] : null) : sec === 2 ? HOOK[m & 3] : sec === 3 && m < 4 ? HOOK[m] : null;
    if (steelHook) {
      const up = sec === 2 ? 12 : 0;
      for (const [st, mm] of steelHook) if (st === k) this.steel(t, mm + up, up ? 0.032 : intro ? 0.06 : 0.08, this.keys);
    } else if (sec === 1 || (sec === 3 && m >= 4)) {
      const j = TRES.indexOf(k);
      if (j >= 0) this.steel(t, ch.pad[[0, 1, 2, 3, 2, 1][j]] + 12, 0.045, this.keys);
    }

    // the whistle over the bridge
    if (sec === 1) for (const [st, mm, len] of WHISTLE[m]) if (st === k) this.wh.note(t, mm, len * spb * 0.97, { vol: 0.085, glide: 0.05, a: 0.03, d: 0.4, s: 0.85, r: 0.12 });
  }
}

// ------------------------------------------------------------------ the chase

class Chase extends Cue {
  constructor(s, t0, o) {
    super(s, t0, 'chase', o);
    this.bpm = 144;
    // the layers, each as loud as the heat says: the bed (always), the beat, the brass and the
    // toms, the hook and the crashes
    this.L = [0.08, 0.1, 0.22, 0.3].map((send) => this.bus(send, 0));
    const [l0, l1] = this.L;
    this.snrOut = l1;
    this.tik = this.chan('highpass', 9000, 0.8, l0, 0.15);
    this.hat = this.chan('highpass', 7600, 0.7, l1, 0.45);
    this.ohat = this.chan('highpass', 6400, 0.6, this.L[2], 0.8);
    this.snr = this.chan('bandpass', 2000, 0.6, l1, 0.3);
    // the bass, a little dirty: hot into a soft clip, back down after it
    const c = this.c;
    const ws = c.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) curve[i] = Math.tanh(2.2 * ((i / 1023) * 2 - 1)) / Math.tanh(2.2);
    ws.curve = curve;
    const post = c.createGain();
    post.gain.value = 0.42;
    ws.connect(post).connect(l0);
    this.loops.push(ws, post);
    this.bs = new Mono(this, ws, [['sawtooth', 0, -8, 0.6], ['sawtooth', 0, 8, 0.6], ['sine', -1, 0, 0.5]], { cut: 400, res: 3 });
    this.ld = new Mono(this, this.L[3], [['sawtooth', 0, -6, 0.5], ['square', 0, 6, 0.32], ['square', -1, 0, 0.22]], { cut: 3400, res: 2.4, vib: 10 });
    this.fx = this.bus(0.3);
    this.heat(s.h, t0, true);
  }

  heat(h, t, now = false) {
    const lv = [0.55 + 0.45 * h, ramp(h, 0.1, 0.3) * (0.7 + 0.3 * h), ramp(h, 0.36, 0.56), ramp(h, 0.6, 0.8)];
    this.L.forEach((g, i) => {
      g.gain.cancelScheduledValues(t);
      if (now) g.gain.setValueAtTime(lv[i], t);
      else g.gain.setTargetAtTime(lv[i], t, 0.25);
    });
  }

  // the way in (in place of the first bar's kick): out of time slowing, a rush up, the crash and a
  // deep kick; out of the title, nothing (its landing rang them); out of nothing, a crash if it starts
  // hot, and a low boom
  enter(t) {
    const from = this.o.from;
    if (from === 'title') return;
    if (from === 'slowmo') {
      this.burst(t, 0.35, 0.08, this.fx, 'bandpass', 300, 5000, 1.2);
      this.crash(t, 0.1, this.fx, 2);
      this.kick(t, 0.6, this.fx, 160, 38, 0.6, 0.15);
    } else {
      if (this.s.h >= 0.45) this.crash(t, 0.09, this.fx, 1.8);
      this.kick(t, 0.5, this.fx, 110, 34, 0.9, 0.3);
    }
  }

  tick(i, t, spb) {
    const h = this.s.h;
    const k = i % 16;
    const n = ((i - k) / 16) % 16;
    const name = C_BARS[n];
    const ch = CC[name];
    const [l0, l1, l2, l3] = this.L;
    const hook = n >= 8;
    if (i === 0) this.enter(t);

    // the bed: a dark chord through each bar, opening as it heats and as the eight bars go on
    if (k === 0) this.pad(t, ch.pad, 16 * spb, l0, { vol: 0.026, a: 0.04, r: 0.25, cut: 360 + 1300 * h + 50 * (n & 7), q: 2, det: 7 });

    // the bass: cold, quiet eighths on the root; hot, the gallop (and up into A at the very end)
    if (h < 0.3) {
      if (k % 2 === 0) this.bs.note(t, ch.r, spb * 1.4, { vol: 0.34 * (k % 8 === 0 ? 1 : 0.7), cut: 230 + 250 * h, env: 2, et: 0.05, a: 0.004, d: 0.1, s: 0.5, r: 0.03 });
    } else {
      const iv = n === 15 && k >= 12 ? RUN[k - 12] : GALLOP[k];
      this.bs.note(t, ch.r + iv, spb * 0.78, { vol: 0.5 * ACCENT[k], cut: 280 + 1600 * h * h, env: 3, et: 0.05, a: 0.003, d: 0.08, s: 0.55, r: 0.02 });
    }

    // the clock (cold), the hats (hot)
    if (k % 4 === 0) this.hit(this.tik, t, (k === 0 ? 0.05 : 0.035) * (1 - ramp(h, 0.3, 0.6) * 0.6), 0.025);
    if (h >= 0.25 && C_HATS[k] !== '.') this.hit(this.hat, t, 0.055 * V[C_HATS[k]], 0.035);
    if (k % 4 === 2) this.hit(this.ohat, t, 0.04, 0.18);

    // the kick: a heartbeat on the one when cold; four to the floor when hot, with a pickup on the
    // and of four every other bar
    if (h < 0.12) {
      if (k === 0 && i > 0) this.kick(t, 0.3, l0, 110, 40, 0.4, 0.09);
    } else if (i > 0) {
      const kp = C_KICK[n & 1];
      if (kp[k] !== '.') this.kick(t, 0.56 * V[kp[k]], l1);
    }

    // the snare on two and four; a fill at the end of each eight, once it is hot
    if (k === 4 || k === 12) this.snare(t, 0.3, 0.13);
    if (h >= 0.6 && (n === 7 || n === 15) && k >= 8 && k !== 12) this.snare(t, 0.08 + 0.025 * (k - 8), 0.06);

    // the brass: stabs in threes (only on the one, under the hook)
    const sp = hook ? [0] : STABS[name];
    if (sp.includes(k)) this.pad(t, ch.stab, spb * 1.6, l2, { vol: 0.05, a: 0.004, r: 0.08, cut: 3400, cut1: 700, ct: 0.06, det: 10, q: 1.5 });
    // the toms down into every fourth bar's end
    if (n % 4 === 3 && k >= 10) this.tom(t, TOMS[k - 10], 0.3, l2);
    // a riser over the last two bars of each eight
    if ((n === 6 || n === 14) && k === 0) this.riser(t, 32 * spb, 0.05, l2);

    // a crash at the top of each eight; the hook over the second eight
    if (k === 0 && n % 8 === 0 && i > 0) this.crash(t, 0.09, l3, 1.8);
    if (hook) for (const [st, mm, len] of HOOK[(n - 8) & 3]) if (st === k) this.ld.note(t, mm, len * spb * 0.82, { vol: 0.12, glide: 0.008, a: 0.004, d: 0.25, s: 0.75, r: 0.05 });
  }
}

// ------------------------------------------------------------------ time slowing

class Slowmo extends Cue {
  constructor(s, t0, o) {
    super(s, t0, 'slowmo', o);
    // (its clock is a heart, slowed right down: lub on the beat, dub a sixteenth after it)
    this.bpm = 54;
    const c = this.c;
    this.body = this.bus(0.12);
    this.air = this.bus(0.5);
    // the drop: a long fall in pitch, a rush of air falling with it
    this.kick(t0, 0.5, this.body, 150, 30, 1.6, 1.2);
    this.burst(t0, 1.1, 0.14, this.air, 'bandpass', 3200, 160, 0.9);
    // the drone: A low down, its octave and its fifth, under a filter that breathes slowly
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 320;
    f.Q.value = 1.2;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.11;
    const lg = c.createGain();
    lg.gain.value = 140;
    lfo.connect(lg).connect(f.frequency);
    lfo.start(t0);
    this.live.push(lfo);
    const dg = c.createGain();
    dg.gain.setValueAtTime(0, t0);
    dg.gain.linearRampToValueAtTime(0.13, t0 + 1.6);
    f.connect(dg).connect(this.body);
    this.drone = [['sine', 33, 0, 0.45], ['sawtooth', 45, -7, 0.45], ['sawtooth', 52, 6, 0.3]].map(([type, m, det, v]) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = hz(m);
      o.detune.value = det;
      const g = c.createGain();
      g.gain.value = v;
      o.connect(g).connect(f);
      o.start(t0);
      this.live.push(o);
      return o;
    });
    // the swell, as if played backwards: noise climbing slowly in pitch and loudness, and out of it
    // A, E and B high up, trembling faster as it holds
    this.sw = this.chan('bandpass', 500, 0.9, this.air, 0.3);
    this.sw.f.setValueAtTime(500, t0 + 0.5);
    this.sw.f.exponentialRampToValueAtTime(5200, t0 + 6.5);
    this.sw.g.setValueAtTime(0.0001, t0 + 0.5);
    this.sw.g.exponentialRampToValueAtTime(0.045, t0 + 6.5);
    this.cg = c.createGain();
    // (silent until it starts to come: a gain is 1 before its first change)
    this.cg.gain.value = 0;
    this.cg.gain.setValueAtTime(0.0001, t0 + 0.8);
    this.cg.gain.exponentialRampToValueAtTime(0.03, t0 + 6.5);
    const tr = c.createGain();
    tr.gain.value = 0.6;
    const tl = c.createOscillator();
    tl.frequency.setValueAtTime(3, t0);
    tl.frequency.linearRampToValueAtTime(7, t0 + 8);
    const tg = c.createGain();
    tg.gain.value = 0.4;
    tl.connect(tg).connect(tr.gain);
    tl.start(t0);
    this.live.push(tl);
    tr.connect(this.cg).connect(this.air);
    for (const m of [69, 76, 83]) {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = hz(m);
      o.connect(tr);
      o.start(t0);
      this.live.push(o);
    }
  }

  tick(i, t) {
    const k = i % 4;
    if (k === 0) this.kick(t, i === 0 ? 0.18 : 0.34, this.body, 130, 42, 0.24, 0.06);
    if (k === 1) this.kick(t, i === 1 ? 0.12 : 0.22, this.body, 110, 40, 0.22, 0.06);
  }

  release(t, fade, next) {
    if (next === 'title') {
      // the swell goes into the hit: cut on it
      for (const p of [this.sw.g, this.cg.gain]) {
        hold(p, t);
        p.setTargetAtTime(0, t, 0.01);
      }
      super.release(t, Math.min(fade, 1.5));
    } else if (next) {
      // time comes back: the drone rushes up and away
      for (const o of this.drone) {
        hold(o.frequency, t);
        o.frequency.setTargetAtTime(o.frequency.value * 2.5, t, 0.15);
      }
      super.release(t, Math.min(fade, 0.45));
    } else super.release(t, fade);
  }
}

// ------------------------------------------------------------------ the title

class Title extends Cue {
  constructor(s, t0, o) {
    super(s, t0, 'title', o);
    this.bpm = 104;
    const spb = 60 / this.bpm / 4;
    // (the phrase is two bars; then it rings, and the chase takes over)
    this.until = t0 + 32.5 * spb;
    this.hits = this.bus(0.3);
    this.snrOut = this.hits;
    this.keys = this.bus(0.42);
    this.lead = this.bus(0.4);
    this.low = this.bus(0.03);
    this.snr = this.chan('bandpass', 2000, 0.5, this.hits, 0.3);
    this.ld = new Mono(this, this.lead, [['sawtooth', 0, -7, 0.5], ['square', 0, 7, 0.3], ['square', -1, 0, 0.32]], { cut: 3400, res: 2, vib: 14 });
    this.bs = new Mono(this, this.low, [['sawtooth', 0, 0, 0.45], ['sine', 0, 0, 0.8]], { cut: 260, res: 1.5 });
    this.echo(this.lead, spb * 3, 0.36, 0.3);
    this.hand = o.then === null ? null : { name: o.then || 'chase', t: t0 + 32 * spb, fade: 5, heat: 1 };
  }

  tick(i, t, spb) {
    if (i > 32) return;
    const k = i % 16;
    const b = (i - k) / 16;
    const H = this.hits;
    if (i === 0) {
      // the hit, on the call: a kick and a boom under the city, a blast of air, the crash, the big
      // snare, and the bright chord (F major with its seventh and ninth, wide open)
      this.kick(t, 0.75, H, 190, 42, 0.5);
      this.kick(t, 0.55, H, 75, 27, 2.6, 1.6);
      this.burst(t, 1.3, 0.3, H, 'lowpass', 4000, 220, 0.6);
      this.crash(t, 0.13, H, 3.2);
      this.snare(t, 0.34, 0.26);
      this.pad(t, [53, 60, 64, 67, 69, 72], 16 * spb, this.keys, { vol: 0.05, a: 0.005, r: 1.2, cut: 7000, cut1: 2200, ct: 0.8, det: 12, mid: true });
      this.bs.note(t, 29, 16 * spb, { vol: 0.34, a: 0.003, d: 0.6, s: 0.75, r: 0.3 });
    } else if (i === 16) {
      // a step up: G with its sixth and ninth
      this.kick(t, 0.55, H, 170, 44, 0.4);
      this.crash(t, 0.06, H, 2);
      this.pad(t, [55, 62, 64, 69, 71], 16 * spb, this.keys, { vol: 0.045, a: 0.005, r: 1, cut: 5000, cut1: 2000, ct: 0.7, det: 12 });
      this.bs.note(t, 31, 16 * spb, { vol: 0.32, a: 0.003, d: 0.6, s: 0.75, r: 0.3 });
    } else if (i === 32) {
      // and down on A: open, neither major nor minor (the chase will say which)
      this.kick(t, 0.65, H, 180, 42, 0.45);
      this.kick(t, 0.45, H, 70, 28, 2, 1.2);
      this.crash(t, 0.11, H, 2.8);
      this.pad(t, [57, 64, 69, 71, 76], 20 * spb, this.keys, { vol: 0.048, a: 0.005, r: 1.6, cut: 6000, cut1: 1800, ct: 1, det: 12 });
      this.bs.note(t, 33, 24 * spb, { vol: 0.32, a: 0.003, d: 0.6, s: 0.75, r: 0.4 });
    }
    // the hook's first two bars, big: the lead with its octave below, steel drums an octave over it
    if (b < 2) {
      for (const [st, m, len] of HOOK[b]) {
        if (st !== k) continue;
        this.ld.note(t, m, len * spb * 0.92, { vol: 0.13, glide: 0.01, a: 0.005, d: 0.35, s: 0.8, r: 0.08 });
        this.steel(t, m + 12, 0.045, this.lead, 0.6);
      }
    }
    // half time: the snare on three; the toms down into the landing
    if (i === 8 || i === 24) this.snare(t, 0.3, 0.2);
    if (i >= 26 && i < 32) this.tom(t, TOMS[i - 26], 0.4, H);
  }
}

// ------------------------------------------------------------------ the ending

class Ending extends Cue {
  constructor(s, t0, o) {
    super(s, t0, 'ending', o);
    this.bpm = 66;
    const c = this.c;
    this.keys = this.bus(0.5);
    this.low = this.bus(0.08);
    // the keys through a delay that sways a little: a worn tape, the pitch never quite still
    this.kin = c.createGain();
    const d = c.createDelay(0.05);
    d.delayTime.value = 0.012;
    const l = c.createOscillator();
    l.frequency.value = 0.23;
    const lg = c.createGain();
    lg.gain.value = 0.0028;
    l.connect(lg).connect(d.delayTime);
    l.start(t0);
    this.live.push(l);
    this.kin.connect(d).connect(this.keys);
    this.loops.push(this.kin, d, lg);
    this.sub = new Mono(this, this.low, [['sine', 0, 0, 0.9], ['triangle', 0, 0, 0.15]], { cut: 400, res: 0.5 });
  }

  // a high note that is not quite in tune, coming in over the chord that never resolves
  ghost(t, m, dur) {
    const c = this.c;
    const o = c.createOscillator();
    o.frequency.value = hz(m);
    o.detune.setValueAtTime(0, t);
    o.detune.linearRampToValueAtTime(-38, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.008, t + dur * 0.5);
    g.gain.setTargetAtTime(0, t + dur * 0.7, dur * 0.12);
    o.connect(g).connect(this.keys);
    o.start(t);
    o.stop(t + dur * 1.4);
  }

  tick(i, t, spb) {
    const k = i % 16;
    const n = ((i - k) / 16) % 16;
    const B = E_BARS[n];
    const hb = n === 6 || n === 7 ? n - 6 : n === 13 || n === 14 ? n - 13 : -1;
    const up = n >= 13 ? 12 : 0;
    const ghost = n === 9 || n === 15;
    if (k === 0) {
      this.pad(t, B.ch, 16 * spb, this.kin, { vol: 0.034, a: 1.4, r: 2.2, cut: 900, det: 7, wide: 0.7 });
      this.sub.note(t, B.r - 12 >= 28 ? B.r - 12 : B.r, 15.5 * spb, { vol: 0.05, a: 0.25, d: 1.5, s: 0.7, r: 0.6 });
    }
    // the piano: up through the chord, or (under the hook, under the ghost) the chord once, softly
    for (const [st, j, oct, v] of hb >= 0 || ghost ? P_SPARSE : P_ARP) if (st === k) this.piano(t, (j < 0 ? B.r : B.ch[j]) + oct, 0.085 * v, this.kin);
    if (hb >= 0) for (const [st, m, len] of E_HOOK[hb]) if (st === k) this.piano(t, m + up, up ? 0.055 : 0.095, this.kin, 1.2 + len * spb);
    if (ghost && k === 4) this.ghost(t, 88, 11 * spb);
    // (a breath in before it goes round again)
    if (n === 15 && k === 8) this.riser(t, 8 * spb, 0.016, this.keys, 600, 3500);
  }
}


// ------------------------------------------------------------------ the wheel (ROADMAP 18.9)

// the wheel's own tune, a waltz on its music box, heard from along the pier: bells over a soft
// oom-pah-pah, a little out of the way of the words (instead of kids' voices: the wheel's life heard
// as a fairground's music). Going into the unease, it winds down - slower, sagging out of tune -
// as a music box does
const W_TUNE = [
  [[0, 72], [4, 76], [8, 79]], [[0, 84, 1], [8, 83]], [[0, 81], [4, 79], [8, 76]], [[0, 79, 1]],
  [[0, 72], [4, 74], [8, 76]], [[0, 77, 1], [8, 76]], [[0, 74], [4, 71], [8, 74]], [[0, 72, 1]],
];
const W_BASS = [48, 43, 45, 43, 48, 41, 43, 48];
const W_CH = [[64, 67], [62, 67], [64, 69], [62, 67], [64, 67], [65, 69], [62, 65], [64, 67]];

class Wheel extends Cue {
  constructor(s, t0, o) {
    super(s, t0, 'wheel', o);
    this.bpm = 138;
    const c = this.c;
    // (from along the pier: dulled, and more of the room than of itself)
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2600;
    f.Q.value = 0.4;
    this.far = c.createGain();
    this.far.connect(f).connect(this.bus(0.65));
    this.loops.push(this.far, f);
    this.warpT = Infinity;
  }

  // (the music box winding down: from t, slower and slower, sagging under its note)
  warp(t) {
    this.warpT = t;
  }

  tick(i, t) {
    // (3/4: a bar is twelve sixteenths)
    const k = i % 12;
    const bar = Math.floor(i / 12) % 8;
    const w = Math.max(0, t - this.warpT);
    const sag = -w * 0.9;
    if (w > 0) this.bpm = Math.max(46, 138 - w * 26);
    if (k === 0) this.piano(t, W_BASS[bar] + sag, 0.05, this.far, 1.2);
    if (k === 4 || k === 8) for (const m of W_CH[bar]) this.piano(t, m + sag, 0.022, this.far, 0.6);
    for (const [st, m, long] of W_TUNE[bar]) if (st === k) this.steel(t, m + sag + (w > 0 ? Math.sin(i * 1.7) * w * 0.15 : 0), 0.05, this.far, long ? 1.4 : 0.7);
  }

  release(t, fade, next) {
    if (next === 'unease') this.warp(t);
    super.release(t, next === 'unease' ? Math.max(fade, 4) : fade);
  }
}

// what should not be there, growing under the evening as the wheel goes: a cluster deep down (A,
// B flat, E a little off), opening up slowly; a heart, faint and then not; glass trembling high up
// on a tritone; a breath of air climbing - and all of it cut dead when the wheel is gone
class Unease extends Cue {
  constructor(s, t0, o) {
    super(s, t0, 'unease', o);
    this.bpm = 58;
    const c = this.c;
    const T = 11;
    this.body = this.bus(0.25);
    this.air = this.bus(0.6);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(110, t0);
    f.frequency.exponentialRampToValueAtTime(1500, t0 + T);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.11, t0 + T * 0.6);
    g.gain.linearRampToValueAtTime(0.16, t0 + T);
    f.connect(g).connect(this.body);
    this.loops.push(f, g);
    for (const [m, det, type] of [[33, 0, 'sawtooth'], [34, -6, 'sawtooth'], [40, 14, 'sawtooth'], [21, 0, 'sine']]) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = hz(m);
      o.detune.setValueAtTime(det, t0);
      o.detune.linearRampToValueAtTime(det - 30, t0 + T);
      o.connect(f);
      o.start(t0);
      this.live.push(o);
    }
    // the glass: E and B flat high up, trembling faster as it holds
    const tr = c.createGain();
    tr.gain.value = 0.5;
    const tl = c.createOscillator();
    tl.frequency.setValueAtTime(4, t0);
    tl.frequency.linearRampToValueAtTime(11, t0 + T);
    const tg = c.createGain();
    tg.gain.value = 0.5;
    tl.connect(tg).connect(tr.gain);
    tl.start(t0);
    this.live.push(tl);
    const cg = c.createGain();
    cg.gain.value = 0;
    cg.gain.setValueAtTime(0.0001, t0 + 1.5);
    cg.gain.exponentialRampToValueAtTime(0.022, t0 + T);
    tr.connect(cg).connect(this.air);
    this.loops.push(tr, cg, tg);
    for (const m of [88, 94]) {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = hz(m);
      o.connect(tr);
      o.start(t0);
      this.live.push(o);
    }
    // the air climbing
    this.sw = this.chan('bandpass', 300, 1.2, this.air, 0.4);
    this.sw.f.setValueAtTime(300, t0);
    this.sw.f.exponentialRampToValueAtTime(3800, t0 + T);
    this.sw.g.setValueAtTime(0.0001, t0);
    this.sw.g.exponentialRampToValueAtTime(0.05, t0 + T);
  }

  tick(i, t) {
    // the heart: faint at first, then not (lub on the beat, dub a sixteenth after)
    const k = i % 4;
    const n = Math.floor(i / 4);
    const v = Math.min(1, 0.25 + n * 0.07);
    if (k === 0) this.kick(t, 0.3 * v, this.body, 120, 38, 0.26, 0.06);
    if (k === 1) this.kick(t, 0.2 * v, this.body, 100, 36, 0.24, 0.06);
  }

  release(t, fade) {
    // (cut dead: the wheel gone, and with it this)
    super.release(t, Math.min(fade, 0.05));
  }
}

// (ROADMAP 18.9) nobody remembers it: the wheel's waltz as a dream has it - half as fast, a quarter
// tone flat, its bells ringing on too long, over a pad that will not settle and a low bell now and
// then; the cheerful tune gone wrong
class Surreal extends Cue {
  constructor(s, t0, o) {
    super(s, t0, 'surreal', o);
    this.bpm = 72;
    const c = this.c;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 3200;
    this.box = c.createGain();
    this.box.connect(f).connect(this.bus(0.8));
    this.loops.push(this.box, f);
    this.pads = this.bus(0.7);
  }

  tick(i, t, spb) {
    const k = i % 12;
    const bar = Math.floor(i / 12) % 8;
    const flat = -0.45 + Math.sin(i * 0.05) * 0.15;
    if (k === 0 && bar % 2 === 0) {
      const ch = W_CH[bar].map((m) => m - 12 + flat);
      this.pad(t, [W_BASS[bar] + flat, ...ch], 24 * spb, this.pads, { vol: 0.02, a: 1.5, r: 2.5, cut: 700, det: 18, wide: 0.8 });
    }
    if (k === 0 && bar % 4 === 0) this.piano(t, W_BASS[bar] - 12 + flat, 0.05, this.box, 4);
    for (const [st, m, long] of W_TUNE[bar]) if (st === k) this.steel(t, m + flat, 0.045, this.box, long ? 2.6 : 1.6);
  }
}

// the wheel's tune remembered: its first bar on the music box, far off, out of tune, in a long room
class Memory extends Cue {
  constructor(s, t0, o) {
    super(s, t0, 'memory', o);
    this.sting();
    const out = this.bus(0.95, 0.8);
    const spb = 60 / 120 / 4;
    const notes = [[0, 72], [4, 76], [8, 79], [12, 84], [20, 83]];
    for (const [st, m] of notes) this.steel(t0 + st * spb * 1.6, m - 0.35, 0.045, out, 1.8);
    this.until = t0 + 6;
    this.dead = t0 + 9;
  }
}

// ------------------------------------------------------------------ the stings

// the men by the car park: a low swell (A against B flat, a rumble, a tritone trembling high up),
// a thud at its top and a scrape of metal, then gone
class Discovery extends Cue {
  constructor(s, t0, o) {
    super(s, t0, 'discovery', o);
    this.sting();
    const c = this.c;
    const out = this.bus(0.35);
    const T = 2.8;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(140, t0);
    f.frequency.exponentialRampToValueAtTime(900, t0 + T);
    f.frequency.setTargetAtTime(160, t0 + T, 0.5);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.16, t0 + T);
    g.gain.setTargetAtTime(0, t0 + T, 0.45);
    f.connect(g).connect(out);
    const end = t0 + T + 3;
    for (const [m, det] of [[33, 0], [34, 0], [45, -8], [46, 8]]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(m);
      o.detune.value = det;
      o.connect(f);
      o.start(t0);
      o.stop(end);
    }
    // the rumble
    const n = c.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const nf = c.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 120;
    nf.Q.value = 0.8;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0, t0);
    ng.gain.linearRampToValueAtTime(0.32, t0 + T);
    ng.gain.setTargetAtTime(0, t0 + T, 0.5);
    n.connect(nf).connect(ng).connect(out);
    n.start(t0, 0.2);
    n.stop(end);
    // the tritone, trembling
    const hg = c.createGain();
    hg.gain.setValueAtTime(0, t0);
    hg.gain.linearRampToValueAtTime(0.02, t0 + T);
    hg.gain.setTargetAtTime(0, t0 + T, 0.4);
    const tr = c.createGain();
    tr.gain.value = 0.6;
    const tl = c.createOscillator();
    tl.frequency.value = 6.5;
    const tg = c.createGain();
    tg.gain.value = 0.4;
    tl.connect(tg).connect(tr.gain);
    tr.connect(hg).connect(out);
    for (const m of [69, 75]) {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = hz(m);
      o.connect(tr);
      o.start(t0);
      o.stop(end);
    }
    tl.start(t0);
    tl.stop(end);
    // the top
    this.kick(t0 + T, 0.36, out, 90, 36, 0.7, 0.12);
    this.burst(t0 + T, 0.5, 0.05, out, 'bandpass', 2600, 2200, 7);
    this.dead = end + 0.5;
  }
}

// a punch: a kick, a thump of air, the brass on A, short
class Hit extends Cue {
  constructor(s, t0, o) {
    super(s, t0, 'hit', o);
    this.sting();
    const v = o.vol !== undefined ? o.vol : 1;
    const out = this.bus(0.22);
    this.kick(t0, 0.55 * v, out, 210, 48, 0.28, 0.05);
    this.burst(t0, 0.12, 0.28 * v, out, 'lowpass', 1400, 500, 0.8);
    this.pad(t0, [45, 52, 57], 0.18, out, { vol: 0.07 * v, a: 0.003, r: 0.15, cut: 2800, cut1: 380, ct: 0.07, det: 12, wide: 0.4 });
    this.dead = t0 + 1.4;
  }
}

// a car coming down hard: a kick, the boom, a blast, a crash
class Land extends Cue {
  constructor(s, t0, o) {
    super(s, t0, 'land', o);
    this.sting();
    const v = o.vol !== undefined ? o.vol : 1;
    const out = this.bus(0.3);
    this.kick(t0, 0.6 * v, out, 150, 40, 0.5);
    this.kick(t0, 0.5 * v, out, 70, 26, 2.2, 1.2);
    this.burst(t0, 1, 0.3 * v, out, 'lowpass', 2600, 180, 0.7);
    this.crash(t0, 0.1 * v, out, 2.4);
    this.dead = t0 + 4.5;
  }
}

// the cues: what each is, how long from the call to its first sound (lead), whether it comes in at
// once whatever the fade (hard), whether what it follows falls away under it (drops) or is cut off
// short by it (cut: the most it is given to go, seconds)
// ------------------------------------------------------------------ the recorded ones

// (ROADMAP 18.9) the wheel's waltz, the unease, the dream after it and the waltz remembered, made as
// recordings (ElevenLabs Music, v5/audio/prologue/music/) and played from them (game/prologue/
// tracks.js): through the cue's own way into the mix like every other - its fades, its filter when
// time slows, the room. Where a file is not in (yet, or at all), the synthesised cue as it was.
// a, b: the stretch played over and over (x: its crossfade); from: where the first time starts in
// it; once: the one time only; gain, lp (a low-pass: from along the pier), send (to the room)
const FILES = {
  // (the music box from along the pier: dulled, more of the room than of itself)
  // (round 9, the player's word: not heard at the wheel - louder, and less muffled)
  // (round 11, the player's word: from the first sight of the wheel, music cute but very tense - a
  // music box's carnival waltz in a minor key over a racing pizzicato, a clock, tremolo strings and a
  // low drone, growing all the way (ElevenLabs): from her stand on, round its fuller half until the
  // boy waves from his gondola. The old waltz the wheel's own no more)
  tense: { path: 'music/wheel_tense.mp3', from: 0, a: 48, b: 131, x: 3, gain: 0.9, send: 0.3 },
  // (round 13, the player's word: the cute tune only for the first moments of the wheel - then, a
  // couple of seconds on, it goes over slowly into the most disturbing music, and that stays with the
  // scene till the wheel is gone: a carnival music box broken and dying over a drone that never
  // resolves, a clock off the beat, a heart - ElevenLabs, round and round)
  // (round 15: from its loud part, and louder - frightening from the first moment)
  dread: { path: 'music/wheel_dread.mp3', from: 3, a: 2, b: 116, x: 3, gain: 0.95, send: 0.25 },
  // (ROADMAP 18.9: the player's word - cute and disturbing at once, a little horror film: a sweet
  // music box that goes out of tune and melts while a dark drone, scraping strings and a heart grow
  // under it - begun under the boy waving from his gondola, cut dead the moment the wheel goes, some
  // 15 s on. Loud: over the eraser, the air and all)
  unease: { path: 'music/horror_box.mp3', from: 0, once: true, gain: 1.25, send: 0.2 },
  surreal: { path: 'music/surreal.mp3', a: 0.5, b: 84, x: 3, gain: 0.8, send: 0.35 },
  // (round 9: once it is gone - not silence: dread. A music box played wrong over a low dissonant
  // drone, a ringing in the ears, a heart - ElevenLabs, round and round until the questions)
  shock: { path: 'music/shock.mp3', a: 0.5, b: 39.5, x: 3, gain: 1.0, send: 0.25 },
  // (a bar or two of the waltz, slowed, far off, mostly the room)
  memory: { path: 'music/wheel_tense.mp3', from: 2, b: 13, once: true, rate: 0.82, gain: 0.6, lp: 1700, send: 0.9 },
};

class FileCue extends Cue {
  constructor(s, t0, name, o, buf, F) {
    super(s, t0, name, o);
    const c = this.c;
    const g = c.createGain();
    g.gain.value = F.gain;
    let head = g;
    if (F.lp) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = F.lp;
      f.Q.value = 0.4;
      g.connect(f);
      head = f;
      this.loops.push(f);
    }
    head.connect(this.out);
    if (F.send) {
      const w = c.createGain();
      w.gain.value = F.send;
      head.connect(w).connect(this.wet);
      this.loops.push(w);
    }
    this.loops.push(g);
    this.F = F;
    this.L = new Looper(c, buf, g, { a: F.a, b: F.b, x: F.x, from: F.from, rate: F.rate, once: F.once, t0 });
    if (F.once) {
      const len = (Math.min(F.b || buf.duration, buf.duration) - (F.from || 0)) / (F.rate || 1);
      this.until = t0 + len;
      this.dead = t0 + len + 1.5;
    }
  }

  // (as a sting: in over a moment, out over the last of it)
  sting() {
    const t = this.t0;
    const v = this.vol;
    const len = this.until - t;
    for (const p of [this.out.gain, this.wet.gain]) {
      p.setValueAtTime(0, t);
      p.linearRampToValueAtTime(v, t + 0.6);
      p.setValueAtTime(v, t + Math.max(0.7, len - 2));
      p.linearRampToValueAtTime(0, t + len);
    }
  }

  schedule(now) {
    this.L.pump(now, AHEAD + 1.5);
  }

  release(t, fade, next) {
    // (the music box winding down under what comes: slower, lower)
    const f = this.name === 'wheel' && next === 'unease' ? Math.max(fade, 4) : fade;
    if (f !== fade) this.L.sag(t, 0.78, f);
    super.release(t, f);
    this.L.stop(t + Math.max(0.02, f) * 1.8 + 0.05);
  }

  dispose() {
    this.L.stop(this.c.currentTime);
    super.dispose();
  }
}

// the recording when it is in, the synthesis when not (called with new: what it returns is the cue)
const fileOr = (Synth, name) =>
  function (s, t0, o) {
    const F = FILES[name];
    const b = F && trackBuf(F.path);
    if (!b) return new Synth(s, t0, o);
    const q = new FileCue(s, t0, name, o, b, F);
    if (F.once && CUES[name] && CUES[name].sting) q.sting();
    return q;
  };

const CUES = {
  opening: { K: Opening, lead: 0.06 },
  chase: { K: Chase, lead: 0.04, hard: true },
  slowmo: { K: Slowmo, lead: 0.02, hard: true, drops: true },
  title: { K: Title, lead: 0.02, hard: true, cut: 0.12 },
  ending: { K: Ending, lead: 0.06 },
  discovery: { K: Discovery, sting: true },
  // (ROADMAP 18.9: the wheel's own music, the unease as it goes, its tune remembered after)
  wheel: { K: fileOr(Wheel, 'wheel'), lead: 0.05 },
  tense: { K: fileOr(Wheel, 'tense'), lead: 0.05 },
  dread: { K: fileOr(Unease, 'dread'), lead: 0.03 },
  unease: { K: fileOr(Unease, 'unease'), lead: 0.03 },
  memory: { K: fileOr(Memory, 'memory'), sting: true },
  surreal: { K: fileOr(Surreal, 'surreal'), lead: 0.05 },
  shock: { K: fileOr(Unease, 'shock'), lead: 0.02 },
  hit: { K: Hit, sting: true },
  land: { K: Land, sting: true },
};

// ------------------------------------------------------------------ the score

export class Score {
  constructor(game) {
    this.game = game;
    this.cue = null;
    this.gone = [];
    // the chase's heat (0..1), and whether the director set it (left alone, it climbs)
    this.h = 0.55;
    this.pinned = false;
    this.lvl = 1;
    this.want = null;
    this.c = null;
    this.timer = null;
    this.last = 0;
    this.idle = 0;
  }

  // the audio clock (seconds)
  get now() {
    const a = this.game.audio;
    return a && a.ctx ? a.ctx.currentTime : 0;
  }

  // the cue playing (its name), or null
  get playing() {
    return this.cue ? this.cue.name : null;
  }

  // the score's own wiring, once, on the first cue that has sound to play into: a mix, its level,
  // and last a compressor that only the loudest moments reach (the title's hit: it keeps them from
  // going over), into the music volume; and the room every cue sends into
  rig() {
    if (this.c) return true;
    const a = this.game.audio;
    const c = a && a.ctx;
    if (!c || !a.musicBus) return false;
    this.c = c;
    this.noise = a.noise || noiseBuf(c);
    this.mix = c.createGain();
    this.master = c.createGain();
    this.master.gain.value = TRIM * this.lvl;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -6;
    comp.knee.value = 4;
    comp.ratio.value = 12;
    comp.attack.value = 0.002;
    comp.release.value = 0.15;
    // (under the words: the music let down while somebody speaks - under(), from the director's say)
    this.duckG = c.createGain();
    this.mix.connect(this.duckG).connect(this.master).connect(comp).connect(a.musicBus);
    this.room = c.createGain();
    const verb = c.createConvolver();
    const g = this.game;
    // (a smaller room on a phone)
    hangRoom(c, verb, this.noise, g.touch || (g.pipe && g.pipe.low) ? 1.4 : 2.2);
    const back = c.createGain();
    back.gain.value = ROOM;
    this.room.connect(verb).connect(back).connect(this.mix);
    this.nodes = [this.mix, this.duckG, comp, this.master, this.room, verb, back];
    // (rendered offline, the clock is driven by hand: no timer)
    this.offline = typeof OfflineAudioContext !== 'undefined' && c instanceof OfflineAudioContext;
    // (the recorded cues, fetched now - long before the wheel: FILES)
    if (!this.offline) for (const F of Object.values(FILES)) loadTrack(c, F.path);
    if (this.offline) this.sleep();
    return true;
  }

  // a line being said for dur seconds: the music down to k of itself under it, quickly, and back up
  // slowly after it (a line on top of another: from where it is)
  under(dur, k = 0.6) {
    if (!this.c || !this.duckG || !(dur > 0)) return;
    const t = this.c.currentTime;
    const p = this.duckG.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.setTargetAtTime(k, t, 0.06);
    p.setTargetAtTime(1, t + dur + 0.1, 0.4);
  }

  // (the sound off, or the music turned all the way down: no notes written)
  audible() {
    const a = this.game.audio;
    return !!a && a.enabled !== false && !(a.vol && a.vol.music <= 0.001);
  }

  // a cue by name, crossfading from what plays over fade seconds. A sting plays over whatever
  // plays. Asked for before there is sound, a cue waits for it. Options: heat (for the chase),
  // then (for the title: the cue it hands to, null for none), vol (for a sting)
  play(name, { fade = 1.0, ...o } = {}) {
    const C = CUES[name];
    if (!C) return false;
    if (!this.rig()) {
      if (!C.sting) {
        this.want = { name, fade, o };
        this.wake();
      }
      return false;
    }
    const now = this.c.currentTime;
    if (C.sting) {
      if (this.audible()) this.gone.push(new C.K(this, now + 0.015, o));
      this.wake();
      return true;
    }
    this.want = null;
    if (name === 'chase' && !(this.cue && this.cue.name === 'chase')) this.pinned = false;
    if (o.heat !== undefined) this.heat(o.heat);
    if (this.cue && this.cue.name === name) return true;
    const t = o.at !== undefined ? Math.max(o.at, now + 0.01) : now + C.lead;
    const was = this.cue;
    const cue = new C.K(this, t, { ...o, from: was ? was.name : null });
    if (was) {
      const f = C.cut !== undefined ? Math.min(fade, C.cut) : fade;
      if (C.drops) was.drop(t, f);
      was.release(t, f, name);
      this.gone.push(was);
    }
    cue.fadeIn(t, C.hard ? 0 : fade);
    this.cue = cue;
    cue.schedule(now);
    this.wake();
    return true;
  }

  stop({ fade = 1.0 } = {}) {
    this.want = null;
    if (!this.cue || !this.c) return;
    this.cue.release(this.c.currentTime + 0.01, fade, null);
    this.gone.push(this.cue);
    this.cue = null;
  }

  // how hot the chase is, 0..1 (cold: the clock and a low pulse; hot: the whole band)
  heat(k) {
    this.h = clamp(+k || 0);
    this.pinned = true;
    // (said with the chase's start, before it has begun: it starts at that heat)
    const q = this.cue;
    if (q && q.name === 'chase' && this.c) q.heat(this.h, this.c.currentTime, this.c.currentTime < q.t0);
  }

  // the whole score's level, 0..1 (under a scene's words, say)
  level(v, { fade = 0.5 } = {}) {
    this.lvl = clamp(v);
    if (this.master) this.master.gain.setTargetAtTime(TRIM * this.lvl, this.c.currentTime, Math.max(0.01, fade / 3));
  }

  update() {
    this.pump();
  }

  // the notes due written, the title's hand to the chase, the chase's own climb, cues gone out of
  // hearing let go
  pump() {
    const a = this.game.audio;
    if (!a || !a.ctx) return;
    if (this.want && this.rig()) {
      const w = this.want;
      this.want = null;
      this.play(w.name, { fade: w.fade, ...w.o });
    }
    if (!this.c) return;
    const now = this.c.currentTime;
    const dt = clamp(now - (this.last || now), 0, 1);
    this.last = now;
    // (ROADMAP 18.9: a cue begun on its synthesis because its recording was not in yet - the recording
    // in now: crossfaded over to it)
    {
      const q0 = this.cue;
      const F = q0 && FILES[q0.name];
      if (F && !F.once && !(q0 instanceof FileCue) && now > q0.t0 && trackBuf(F.path)) {
        const nq = new FileCue(this, now + 0.05, q0.name, q0.o || {}, trackBuf(F.path), F);
        q0.release(now + 0.05, 2.5, null);
        this.gone.push(q0);
        nq.fadeIn(now + 0.05, 2.5);
        this.cue = nq;
        nq.schedule(now);
      }
    }
    const q = this.cue;
    if (q) {
      if (q.name === 'chase' && !this.pinned && this.h < 0.88) {
        this.h = Math.min(0.88, this.h + dt * 0.006);
        if (Math.abs(this.h - (q.hAt || 0)) > 0.02) {
          q.heat(this.h, now);
          q.hAt = this.h;
        }
      }
      q.schedule(now);
      if (q.hand && now > q.hand.t - AHEAD - 0.05) {
        const hd = q.hand;
        q.hand = null;
        this.play(hd.name, { at: hd.t, fade: hd.fade, heat: hd.heat });
      }
    }
    for (let i = this.gone.length - 1; i >= 0; i--) {
      const g = this.gone[i];
      if (now < g.until) g.schedule(now);
      if (now > g.dead) {
        g.dispose();
        this.gone.splice(i, 1);
      }
    }
    // (nothing left to play: once the room has rung out, the score's wiring is let go too - it is
    // made again for the next cue)
    if (this.cue || this.gone.length || this.want) this.idle = 0;
    else if (!this.idle) this.idle = now;
    else if (now - this.idle > 4) this.unrig();
  }

  wake() {
    if (this.timer || this.offline || typeof setInterval === 'undefined') return;
    this.timer = setInterval(() => this.pump(), 100);
  }

  sleep() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  unrig() {
    this.sleep();
    if (this.nodes) for (const n of this.nodes) n.disconnect();
    this.nodes = null;
    this.master = null;
    this.duckG = null;
    this.c = null;
    this.idle = 0;
  }

  // everything off at once and unwired (the prologue gone)
  dispose() {
    for (const q of [this.cue, ...this.gone]) if (q) q.dispose();
    this.cue = null;
    this.gone = [];
    this.want = null;
    this.unrig();
  }
}
