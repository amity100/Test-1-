import { LINES } from './lines.js';

// (v5, ROADMAP 18) The prologue's voices: every line recorded (v5/audio/prologue/<id>.mp3 - ROADMAP
// 18.9: ElevenLabs v3, one fixed voice for each of them, each line with its feeling; game/prologue/
// lines.js), loaded as soon as there is sound, played as it
// is said, the speaker's mouth saying the words with it (render/people.js reads them off the text at the
// voice's own pace) and the words under the picture. Every voice is heard from where it is said: from
// the speaker's head, as far and as much to one side as the camera has it, in the place's own echo. Also
// the sound of the kids up on the wheel - their calls and their laughing, far off and high up, cut off at
// once when it goes - and the memory of two of them, coming back in the silence after (inside the head).
//
// The API (the director):
//   voices.load()                 everything fetched and decoded, in the background (a promise)
//   voices.update(dt, camera)     EVERY FRAME, with game.camera: the ear goes where the camera is and looks
//                                 where it looks; every voice that is playing follows its speaker's head
//   voices.say(id, fig, o)        a line, said by fig: a figure (its head: fig.j.headC), a civilian (its
//                                 figure's head, or its pos + 1.6 m), or null (the phone: in the ear, not
//                                 placed; a kid's line with no figure comes from the wheel, bedAt).
//                                 o.at: a position {x, y, z} (or a function giving one) to say it from
//                                 instead; o.gain (1.15); o.tone (the face); o.sub === false: no subtitle.
//                                 Sets fig.say (the mouth) and the subtitle; returns how long it is (s).
//   voices.space(name)            the place's acoustics, crossfaded: 'open' (the pier, the beach: a short
//                                 slap back, no tail), 'street', 'carpark' (concrete: a long echo), 'car'
//                                 (a small dry cabin), 'roof' (open, dry). 'open' to begin with.
//   voices.bedAt(x, y, z)         where the kids on the wheel are heard from (the wheel's middle). The kids
//                                 (the bed, K01, K02) are never heard closer than 30-35 m, whatever the camera
//   voices.bed(on, k)             the kids on the wheel: on (k: how loud, 1 as it was), or cut dead
//   voices.memory(gain)           the echo of two kids' calls, inside the head; returns its length (s)
//   voices.stop()                 everything quiet (skipped, or over)
// Before the first update() nothing is placed yet: a voice is heard as if in the middle of the head until
// the camera is known.

// (the game's folder as main.js tells it - the same whether the code comes one file at a time or
// all in one; without it, from this file's own place)
const url = (name) => new URL(`${window.__gameBase ? '' : '../../../'}audio/prologue/${name}.mp3`, window.__gameBase || import.meta.url).href;
// (lines seen and not heard - none any more: Lily's laugh is a real one now)
const SILENT = new Set();
// (what the mouth does for a line that isn't words: a giggle's quick hee-hee, a laugh's open ha-ha)
const MOUTH = { LG1: 'hi hi hi hi', L05: 'ha ha ha ha ha' };

// how a voice falls off with distance (metres; the panner's 'exponential' model: (d / ref) ^ -roll):
// talking - full up to 2.5 m, then -3.6 dB each time the distance doubles (15 m: -9 dB, 30 m: -13 dB);
// a kid shouting from the wheel is a louder source (full to 8 m), and the whole wheelful louder still.
// The kids up on the wheel are never heard close, wherever the camera is (min: a long lens on them
// from the ground) - always at least that far, in the same direction
const TALK = { ref: 2.5, roll: 0.6 };
const SHOUT = { ref: 8, roll: 0.75, min: 30 };
const WHEEL = { ref: 12, roll: 0.8, min: 35 };
// (the angle to a voice narrowed a little, as a film's mix has it: one to the side is heard to the side,
// but nobody hard in one ear)
const WIDTH = 0.7;
// (equal-power panning puts a voice in the middle 3 dB down in each ear: made up, so a close-up is as
// loud as the lines always were)
const PAN_GAIN = Math.SQRT2;
// the highs that go with distance: a low-pass from 20 kHz close by to ~9 kHz at 40 m, ~5 kHz at 80 m
const lowpassAt = (d) => Math.max(2500, Math.min(20000, 20000 / (1 + Math.pow(d / 35, 1.3))));
// the echo sent from a voice: it falls off far more slowly than the voice itself, so the further away
// the more of the place you hear in it
const wetAt = (d, P) => Math.pow(Math.max(d, P.ref) / P.ref, -0.25);

// the places (each echo made here, from noise and a few reflections - no recordings): level is how much
// of it a close voice has (the echo is made to unit energy); the rest shapes it (seconds unless noted):
// pre - before the tail, rt - its 60 dB decay, tail - its share against the reflections, damp - how
// fast its highs go, bright - how bright it starts, taps - early reflections [ms, gain, left -1..1 right]
const SPACES = {
  // the pier and the beach: the stalls and the boardwalk's fronts 20-40 m off, the sea open - a slap or
  // two coming back, hardly a tail
  open: { level: 0.24, len: 0.6, pre: 0.02, rt: 0.42, tail: 0.25, damp: 0.12, bright: 0.6, taps: [[38, 0.5, -0.4], [61, 0.32, 0.5], [97, 0.22, -0.2], [143, 0.12, 0.3]] },
  // between two rows of fronts: quick reflections from both sides, a short bright tail
  street: { level: 0.32, len: 1.1, pre: 0.012, rt: 0.9, tail: 0.5, damp: 0.25, bright: 0.75, taps: [[14, 0.55, -0.7], [23, 0.45, 0.7], [41, 0.35, -0.6], [58, 0.3, 0.6], [79, 0.2, -0.5], [102, 0.15, 0.5]] },
  // concrete all round and a low roof: dense reflections and a long ringing tail
  carpark: { level: 0.46, len: 2.3, pre: 0.006, rt: 1.9, tail: 1.0, damp: 0.6, bright: 0.85, taps: [[6, 0.6, 0.1], [11, 0.5, -0.5], [17, 0.45, 0.6], [23, 0.4, -0.3], [31, 0.35, 0.4], [44, 0.3, -0.6], [57, 0.25, 0.2]] },
  // a car's cabin: a few reflections a metre off, gone at once, a little boxy
  car: { level: 0.16, len: 0.18, pre: 0.001, rt: 0.12, tail: 0.6, damp: 0.03, bright: 0.4, taps: [[1.3, 0.6, 0.3], [2.4, 0.5, -0.4], [3.6, 0.4, 0.5], [5.1, 0.3, -0.3]] },
  // a roof: open sky and wind, only a faint slap from the next building
  roof: { level: 0.1, len: 0.45, pre: 0.03, rt: 0.3, tail: 0.15, damp: 0.08, bright: 0.5, taps: [[118, 0.25, 0.4], [190, 0.12, -0.5]] },
};

// one place's echo: two channels a little different (the echo all round you), unit energy each
function impulse(c, P, salt) {
  const sr = c.sampleRate;
  const len = Math.max(8, Math.ceil(P.len * sr));
  const b = c.createBuffer(2, len, sr);
  let seed = 0x9e3779b9 ^ (salt * 2654435761);
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
  };
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    // the tail: noise dying away (60 dB over rt), its highs dying faster (a one-pole low-pass closing)
    const p0 = Math.floor(P.pre * sr);
    let lp = 0;
    for (let i = p0; i < len; i++) {
      const t = (i - p0) / sr;
      const env = Math.exp((-6.91 * t) / P.rt) * Math.min(1, t / 0.012);
      const k = 0.04 + 0.9 * P.bright * Math.exp(-t / P.damp);
      lp += (rnd() - lp) * k;
      d[i] = lp * env * P.tail;
    }
    // the reflections: a short smeared click each, louder on its own side
    for (const [ms, g, side] of P.taps) {
      const i = Math.floor((ms / 1000) * sr);
      const s = ch === 0 ? 1 - side * 0.8 : 1 + side * 0.8;
      for (let j = 0; j < 4 && i + j < len; j++) d[i + j] += g * s * (j === 0 ? 0.6 : 0.4 / j) * (rnd() < 0 ? -1 : 1);
    }
    // (the end faded, no click)
    const f = Math.min(len, Math.floor(0.02 * sr));
    for (let i = 0; i < f; i++) d[len - 1 - i] *= i / f;
    let e = 0;
    for (let i = 0; i < len; i++) e += d[i] * d[i];
    const n = 1 / Math.sqrt(e || 1);
    for (let i = 0; i < len; i++) d[i] *= n;
  }
  return b;
}

// (an AudioParam moved: at once, or glided over a few hundredths of a second)
function setP(p, v, t, snap, tc = 0.035) {
  if (!p) return;
  if (snap) {
    p.cancelScheduledValues(t);
    p.setValueAtTime(v, t);
  } else p.setTargetAtTime(v, t, tc);
}

export class PrologueVoices {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.buf = new Map();
    this.loading = null;
    this.playing = new Set();
    // the bed of kids on the wheel (and where it is)
    this.bedRec = null;
    this.bedPos = null;
    // the camera as last seen by update() (null: not yet - nothing placed)
    this.cam = null;
    this.camMoved = true;
    // the echo: one convolver per place, crossfaded when it changes
    this.spaceName = 'open';
    this.verb = null;
    this.irs = new Map();
  }

  get ctx() {
    return this.game.audio && this.game.audio.ctx;
  }

  // everything fetched and decoded (in the background: the opening does not wait for it)
  load() {
    if (this.loading) return this.loading;
    const c = this.ctx;
    if (!c) return Promise.resolve();
    const names = [...Object.keys(LINES), 'kids_bed', 'kids_memory'];
    this.loading = Promise.all(
      names.map((n) =>
        fetch(url(n))
          .then((r) => (r.ok ? r.arrayBuffer() : null))
          .then((ab) => (ab ? c.decodeAudioData(ab) : null))
          .then((b) => {
            if (b) this.buf.set(n, b);
          })
          .catch(() => {}),
      ),
    );
    return this.loading;
  }

  out() {
    const a = this.game.audio;
    return a.fx || a.master;
  }

  // ------------------------------------------------------------------ the place's echo
  // (the echo's input, made the first time a placed voice needs it)
  wet() {
    const c = this.ctx;
    if (!this.verb) {
      const input = c.createGain();
      this.verb = { input, cur: null };
      this.verbTo(this.spaceName, true);
    }
    return this.verb.input;
  }

  verbTo(name, now = false) {
    const c = this.ctx;
    const P = SPACES[name];
    if (!c || !this.verb || !P) return;
    if (!this.irs.has(name)) this.irs.set(name, impulse(c, P, Object.keys(SPACES).indexOf(name) + 1));
    const conv = c.createConvolver();
    conv.normalize = false;
    conv.buffer = this.irs.get(name);
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(now ? P.level : 0, t);
    if (!now) g.gain.setTargetAtTime(P.level, t, 0.25);
    this.verb.input.connect(conv);
    conv.connect(g).connect(this.out());
    const old = this.verb.cur;
    if (old) {
      old.g.gain.cancelScheduledValues(t);
      old.g.gain.setTargetAtTime(0, t, 0.25);
      setTimeout(() => {
        try {
          this.verb.input.disconnect(old.conv);
          old.conv.disconnect();
          old.g.disconnect();
        } catch (e) {
          // (gone already)
        }
      }, 2500);
    }
    this.verb.cur = { conv, g, name };
  }

  // the place changes: its echo crossfaded in ('open', 'street', 'carpark', 'car', 'roof')
  space(name) {
    if (!SPACES[name] || name === this.spaceName) return;
    this.spaceName = name;
    if (this.verb) this.verbTo(name);
  }

  // ------------------------------------------------------------------ where things are
  // where a line is said from: o.at, the figure's head, a civilian's figure's head or its feet + 1.6 m;
  // a kid on the wheel with nobody to say it, the wheel. A function giving {x, y, z} each frame, or null
  headOf(fig, o, who) {
    if (o && o.at) {
      const at = o.at;
      return typeof at === 'function' ? at : () => at;
    }
    if (fig) {
      const f = fig.j && fig.j.headC ? fig : fig.fig && fig.fig.j && fig.fig.j.headC ? fig.fig : null;
      if (f) return () => f.j.headC;
      const p = fig.pos || (fig.fig && fig.fig.pos);
      if (p) {
        const h = { x: 0, y: 0, z: 0 };
        return () => {
          h.x = p.x;
          h.y = p.y + 1.6;
          h.z = p.z;
          return h;
        };
      }
    }
    if ((who === 'KB' || who === 'KG') && this.bedPos) return () => this.bedPos;
    return null;
  }

  // a voice's way out: gain -> the highs going with distance -> placed (panner) -> out, and from before
  // the panner a send to the place's echo. Returns the nodes; place() moves them
  chain(src, gain, head, P, hrtf) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = gain * PAN_GAIN;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 20000;
    lp.Q.value = -3;
    const pan = c.createPanner();
    pan.panningModel = hrtf ? 'HRTF' : 'equalpower';
    pan.distanceModel = 'exponential';
    pan.refDistance = P.ref;
    pan.rolloffFactor = P.roll;
    pan.maxDistance = 10000;
    const send = c.createGain();
    send.gain.value = 0;
    src.connect(g).connect(lp).connect(pan).connect(this.out());
    lp.connect(send).connect(this.wet());
    const r = { s: src, g, lp, pan, send, head, P, fresh: true };
    // (where the listener is now; before any update() the voice stays at the listener - in the head)
    if (this.cam) this.place(r, c.currentTime, true);
    return r;
  }

  // a voice put where its speaker's head is, seen from the camera (the angle narrowed by WIDTH)
  place(r, t, snap) {
    const h = r.head();
    const K = this.cam;
    if (!h || !K) return;
    let vx = h.x - K.x;
    let vy = h.y - K.y;
    let vz = h.z - K.z;
    if (r.P.min) {
      const d0 = Math.hypot(vx, vy, vz) || 1;
      if (d0 < r.P.min) {
        const k = r.P.min / d0;
        vx *= k;
        vy *= k;
        vz *= k;
      }
    }
    const lx = vx * K.rx + vy * K.ry + vz * K.rz;
    const ly = vx * K.ux + vy * K.uy + vz * K.uz;
    const lz = vx * K.fx + vy * K.fy + vz * K.fz;
    const rh = Math.hypot(lx, lz);
    const az = Math.atan2(lx, lz) * WIDTH;
    const nx = rh * Math.sin(az);
    const nz = rh * Math.cos(az);
    const px = K.x + nx * K.rx + ly * K.ux + nz * K.fx;
    const py = K.y + nx * K.ry + ly * K.uy + nz * K.fy;
    const pz = K.z + nx * K.rz + ly * K.uz + nz * K.fz;
    const p = r.pan;
    if (p.positionX) {
      setP(p.positionX, px, t, snap);
      setP(p.positionY, py, t, snap);
      setP(p.positionZ, pz, t, snap);
    } else p.setPosition(px, py, pz);
    const d = Math.hypot(vx, vy, vz);
    setP(r.lp.frequency, lowpassAt(d), t, snap, 0.08);
    setP(r.send.gain, wetAt(d, r.P), t, snap, 0.08);
    r.fresh = false;
  }

  // every frame: the ear where the camera is (and looking where it looks), every voice where its speaker is
  update(dt, camera) {
    if (!camera) return;
    camera.updateMatrixWorld();
    const e = camera.matrixWorld.elements;
    const n = (x, y, z) => {
      const l = Math.hypot(x, y, z) || 1;
      return [x / l, y / l, z / l];
    };
    const [rx, ry, rz] = n(e[0], e[1], e[2]);
    const [ux, uy, uz] = n(e[4], e[5], e[6]);
    const [fx, fy, fz] = n(-e[8], -e[9], -e[10]);
    const K = this.cam;
    // (a cut - the camera somewhere else at once: everything moved at once, not glided across)
    const snap = !K || Math.hypot(e[12] - K.x, e[13] - K.y, e[14] - K.z) > 2 || fx * K.fx + fy * K.fy + fz * K.fz < 0.9;
    this.cam = { x: e[12], y: e[13], z: e[14], rx, ry, rz, ux, uy, uz, fx, fy, fz };
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    const L = c.listener;
    if (L.positionX) {
      setP(L.positionX, e[12], t, snap);
      setP(L.positionY, e[13], t, snap);
      setP(L.positionZ, e[14], t, snap);
      setP(L.forwardX, fx, t, snap);
      setP(L.forwardY, fy, t, snap);
      setP(L.forwardZ, fz, t, snap);
      setP(L.upX, ux, t, snap);
      setP(L.upY, uy, t, snap);
      setP(L.upZ, uz, t, snap);
    } else {
      L.setPosition(e[12], e[13], e[14]);
      L.setOrientation(fx, fy, fz, ux, uy, uz);
    }
    for (const r of this.playing) if (r.pan) this.place(r, t, snap || r.fresh);
    if (this.bedRec && this.bedRec.pan) this.place(this.bedRec, t, snap || this.bedRec.fresh);
  }

  // ------------------------------------------------------------------ lines
  // a line said by who (a figure: Danny's, Lily's, somebody's - or null for a voice on the phone):
  // its voice from where it is said, its words on the speaker's mouth, its subtitle. Returns how long
  // it lasts (seconds)
  say(id, fig = null, o = {}) {
    const L = LINES[id];
    if (!L) return 0;
    const dur = L.dur;
    const c = this.ctx;
    const b = this.buf.get(id);
    if (c && b && this.game.audio.enabled && !SILENT.has(id)) {
      const s = c.createBufferSource();
      s.buffer = b;
      const gain = o.gain !== undefined ? o.gain : 1.15;
      // (the phone is in the ear: not placed, no echo - its own filter is in the recording)
      const head = L.who === 'P' ? null : this.headOf(fig, o, L.who);
      let rec;
      if (head) {
        const kid = L.who === 'KB' || L.who === 'KG';
        rec = this.chain(s, gain, head, kid ? SHOUT : TALK, kid);
      } else {
        const g = c.createGain();
        g.gain.value = gain;
        s.connect(g).connect(this.out());
        rec = { s, g };
      }
      s.start();
      this.playing.add(rec);
      s.onended = () => {
        this.playing.delete(rec);
        for (const k of ['g', 'lp', 'pan', 'send']) if (rec[k]) rec[k].disconnect();
      };
    }
    const mouth = MOUTH[id] || L.en;
    if (fig) fig.say = { text: mouth, tone: o.tone || 'talk', at: 0, atT: this.game.time, cps: mouth.length / Math.max(0.4, dur), wait: false, done: false };
    if (this.ui && o.sub !== false) this.ui.sub(L.who, L.en, L.he, dur + 0.35);
    return dur;
  }

  // ------------------------------------------------------------------ the kids on the wheel
  // where they are heard from (the wheel's middle, about (128, 32, 243)): far off and high up
  bedAt(x, y, z) {
    if (x && typeof x === 'object') this.bedPos = { x: x.x, y: x.y, z: x.z };
    else this.bedPos = { x, y, z };
    const r = this.bedRec;
    const c = this.ctx;
    if (r && r.pan && c && this.cam) this.place(r, c.currentTime, false);
  }

  // the kids on the wheel: on (a loop, k as loud as it was asked to be), or cut dead
  bed(on, k = 1) {
    const c = this.ctx;
    if (!c) return;
    if (on) {
      const b = this.buf.get('kids_bed');
      if (!b) return;
      if (!this.bedRec) {
        const s = c.createBufferSource();
        s.buffer = b;
        s.loop = true;
        if (this.bedPos) this.bedRec = this.chain(s, 0.55, () => this.bedPos, WHEEL, true);
        else {
          const g = c.createGain();
          s.connect(g).connect(this.out());
          this.bedRec = { s, g };
        }
        this.bedRec.level = this.bedRec.pan ? 0.55 * PAN_GAIN : 0.55;
        this.bedRec.g.gain.value = 0;
        s.start();
      }
      this.bedRec.g.gain.setTargetAtTime(this.bedRec.level * k, c.currentTime, 0.3);
    } else if (this.bedRec) {
      // (cut: no fade at all)
      const r = this.bedRec;
      r.g.gain.cancelScheduledValues(c.currentTime);
      r.g.gain.setValueAtTime(0, c.currentTime);
      try {
        r.s.stop();
      } catch (e) {
        // already stopped
      }
      for (const n of ['g', 'lp', 'pan', 'send']) if (r[n]) r[n].disconnect();
      this.bedRec = null;
    }
  }

  // the memory of two of them, after: inside the head (not placed, its own echo in the recording)
  memory(gain = 0.5) {
    const c = this.ctx;
    const b = this.buf.get('kids_memory');
    if (!c || !b) return 0;
    const s = c.createBufferSource();
    s.buffer = b;
    const g = c.createGain();
    g.gain.value = gain;
    s.connect(g).connect(this.out());
    s.start();
    const rec = { s, g };
    this.playing.add(rec);
    s.onended = () => this.playing.delete(rec);
    return b.duration;
  }

  // quiet (skipped, or over)
  stop() {
    for (const r of this.playing) {
      try {
        r.s.stop();
      } catch (e) {
        // already stopped
      }
    }
    this.playing.clear();
    this.bed(false);
  }
}
