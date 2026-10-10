// Tiny WebAudio synth: every sound is generated, no audio files.

// jukebox songs: chords (MIDI), bass hits [step, interval], chord stabs
export const SONGS = [
  { bpm: 84, prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], bass: [[0, 0], [3, 0], [4, 7], [6, 0]], stabs: [0, 3], stabLen: 0.6 },
  { bpm: 138, prog: [[52, 56, 59], [57, 61, 64], [52, 56, 59], [59, 63, 66]], bass: [[0, 0], [2, 4], [4, 7], [6, 9]], stabs: [1, 3, 5, 7], stabLen: 0.12 },
  { bpm: 118, prog: [[50, 53, 57], [55, 58, 62], [48, 52, 55], [53, 57, 60]], bass: [[0, 0], [1, 12], [2, 0], [3, 12], [4, 0], [5, 12], [6, 0], [7, 12]], stabs: [2, 6], stabLen: 0.18, four: true },
];

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    this.engineKind = null;
    this.engineT = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch (e) {
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(c.destination);
    const len = c.sampleRate;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // continuous pencil scratch while drawing
    this.scratchSrc = c.createBufferSource();
    this.scratchSrc.buffer = this.noise;
    this.scratchSrc.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3800;
    bp.Q.value = 0.9;
    this.scratchGain = c.createGain();
    this.scratchGain.gain.value = 0;
    this.scratchSrc.connect(bp).connect(this.scratchGain).connect(this.master);
    this.scratchSrc.start();
    // engine
    this.engOsc = c.createOscillator();
    this.engOsc.type = 'sawtooth';
    this.engOsc2 = c.createOscillator();
    this.engOsc2.type = 'square';
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    this.engFilter = lp;
    this.engGain = c.createGain();
    this.engGain.gain.value = 0;
    this.engOsc.connect(lp);
    this.engOsc2.connect(lp);
    lp.connect(this.engGain).connect(this.master);
    this.engOsc.start();
    this.engOsc2.start();
    // police siren (wails up and down)
    this.sirOsc = c.createOscillator();
    this.sirOsc.type = 'triangle';
    this.sirGain = c.createGain();
    this.sirGain.gain.value = 0;
    this.sirOsc.connect(this.sirGain).connect(this.master);
    this.sirOsc.start();
  }

  // ------------------------------------------------------------------ the jukebox at the Inkwell
  music(on, song = 0) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (!this.musicGain) {
      this.musicGain = c.createGain();
      this.musicGain.gain.value = 0;
      this.musicGain.connect(this.master);
    }
    const t = c.currentTime;
    if (on) {
      this.song = SONGS[song % SONGS.length];
      this.step = 0;
      this.nextNote = t + 0.05;
      if (!this.musicTimer) this.musicTimer = setInterval(() => this.schedule(), 60);
      this.musicGain.gain.setTargetAtTime(0.85, t, 0.4);
    } else {
      this.musicGain.gain.setTargetAtTime(0, t, 0.3);
      clearTimeout(this.musicStop);
      this.musicStop = setTimeout(() => {
        clearInterval(this.musicTimer);
        this.musicTimer = null;
      }, 1500);
    }
  }

  schedule() {
    const c = this.ctx;
    if (!c || !this.song) return;
    const spb = 60 / this.song.bpm / 2;
    while (this.nextNote < c.currentTime + 0.25) {
      this.playStep(this.step, this.nextNote);
      this.nextNote += spb;
      this.step++;
    }
  }

  playStep(i, t) {
    const s = this.song;
    const c = this.ctx;
    const out = this.musicGain;
    const beat = i % 8;
    const chord = s.prog[Math.floor(i / 8) % s.prog.length];
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const note = (type, f, dur, vol, f1 = null, filt = 0) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      if (filt) {
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = filt;
        o.connect(lp).connect(g).connect(out);
      } else o.connect(g).connect(out);
      o.start(t);
      o.stop(t + dur + 0.05);
    };
    const noise = (dur, vol, freq, type) => {
      const src = c.createBufferSource();
      src.buffer = this.noise;
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(out);
      src.start(t, Math.random() * 0.5);
      src.stop(t + dur + 0.05);
    };
    if (beat === 0 || beat === 4 || (s.four && beat % 2 === 0)) note('sine', 130, 0.18, 0.22, 42);
    if (beat === 2 || beat === 6) noise(0.13, 0.09, 1900, 'bandpass');
    if (beat % 2 === 1 || s.four) noise(0.03, s.four ? 0.035 : 0.025, 7500, 'highpass');
    for (const b of s.bass) if (b[0] === beat) note('triangle', hz(chord[0] - 24 + b[1]), 0.22, 0.16);
    if (s.stabs.includes(beat)) for (const m of chord) note('sawtooth', hz(m), s.stabLen, 0.022, null, 1300);
  }

  // 0..1: how close the nearest siren is
  siren(level) {
    if (!this.ctx || !this.sirOsc) return;
    const t = this.ctx.currentTime;
    const wail = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 0.45);
    this.sirOsc.frequency.setTargetAtTime(560 + wail * 380, t, 0.05);
    this.sirGain.gain.setTargetAtTime(this.enabled ? level * level * 0.07 : 0, t, 0.1);
  }

  // rain on the page and wind in the streets, 0..1 each (continuous)
  weather(rain, wind) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (!this.rainGain) {
      if (rain < 0.01 && wind < 0.3) return;
      const loop = (type, freq, q) => {
        const s = c.createBufferSource();
        s.buffer = this.noise;
        s.loop = true;
        const f = c.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        const g = c.createGain();
        g.gain.value = 0;
        s.connect(f).connect(g).connect(this.master);
        s.start(0, Math.random() * 0.9);
        return { g, f };
      };
      this.rainGain = loop('highpass', 1900, 0.4).g;
      this.rainLow = loop('bandpass', 650, 0.6).g;
      const w = loop('lowpass', 500, 1.4);
      this.windGain = w.g;
      this.windFilter = w.f;
    }
    const t = c.currentTime;
    this.rainGain.gain.setTargetAtTime(rain * 0.05, t, 0.4);
    this.rainLow.gain.setTargetAtTime(rain * 0.03, t, 0.4);
    const wv = Math.max(0, wind - 0.25);
    this.windGain.gain.setTargetAtTime(wv * 0.09, t, 0.5);
    this.windFilter.frequency.setTargetAtTime(330 + wv * 520 + Math.sin(t * 0.7) * 110, t, 0.3);
  }

  // a roll of thunder (vol 0..1, louder when the bolt was close)
  thunder(vol = 1) {
    if (!this.ctx || !this.enabled) return;
    const v = Math.max(0.3, Math.min(1, vol));
    this.hiss(0.45, 0.2 * v, 1100, 0.5, 'lowpass', 0, 140);
    this.hiss(2.8, 0.34 * v, 95, 0.7, 'lowpass', 0.05, 45);
    this.hiss(1.8, 0.22 * v, 170, 0.8, 'lowpass', 0.4, 60);
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.55 : 0;
  }

  env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  tone(type, f0, f1, dur, vol, at = 0) {
    const c = this.ctx;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    this.env(g, t, 0.005, vol, dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  hiss(dur, vol, freq, q = 1, type = 'bandpass', at = 0, f1 = null) {
    const c = this.ctx;
    const t = c.currentTime + at;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    this.env(g, t, 0.004, vol, dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  play(name, vol = 1) {
    if (!this.ctx || !this.enabled) return;
    const v = vol;
    switch (name) {
      case 'paint':
        this.tone('sine', 520, 160, 0.09, 0.22 * v);
        this.hiss(0.06, 0.12 * v, 1800, 1);
        break;
      case 'pencilShot':
        this.hiss(0.08, 0.3 * v, 4000, 2, 'bandpass', 0, 1500);
        this.tone('triangle', 900, 300, 0.07, 0.12 * v);
        break;
      case 'bazooka':
        this.hiss(0.35, 0.5 * v, 900, 0.7, 'lowpass', 0, 200);
        this.tone('sine', 140, 50, 0.3, 0.4 * v);
        break;
      case 'cannon':
        this.hiss(0.5, 0.7 * v, 700, 0.6, 'lowpass', 0, 120);
        this.tone('sine', 110, 35, 0.45, 0.6 * v);
        break;
      case 'boom':
        this.hiss(0.9, 0.8 * v, 600, 0.5, 'lowpass', 0, 60);
        this.tone('sine', 90, 28, 0.8, 0.6 * v);
        break;
      case 'plop':
        this.tone('sine', 160, 560, 0.09, 0.4 * v);
        this.tone('sine', 560, 140, 0.2, 0.3 * v);
        this.hiss(0.14, 0.22 * v, 1100, 1.2, 'lowpass');
        break;
      case 'splat':
        this.hiss(0.08, 0.2 * v, 900, 1.5, 'lowpass');
        break;
      case 'swing':
        this.hiss(0.18, 0.18 * v, 1400, 1.2, 'bandpass', 0, 500);
        break;
      case 'erase':
        this.hiss(0.16, 0.35 * v, 2500, 3, 'bandpass', 0, 3500);
        this.tone('triangle', 1200, 1600, 0.06, 0.06 * v, 0.02);
        break;
      case 'enemyShot':
        this.tone('square', 700, 180, 0.08, 0.1 * v);
        this.hiss(0.05, 0.12 * v, 2500, 1);
        break;
      case 'punch':
      case 'bite':
        this.hiss(0.1, 0.4 * v, 500, 1, 'lowpass');
        this.tone('sine', 160, 70, 0.1, 0.3 * v);
        break;
      case 'hurt':
        this.tone('sawtooth', 300, 120, 0.15, 0.12 * v);
        break;
      case 'clang':
        this.tone('square', 600, 580, 0.12, 0.08 * v);
        break;
      case 'crash':
        this.hiss(0.4, 0.5 * v, 1500, 0.8, 'lowpass', 0, 300);
        break;
      case 'honk':
        this.tone('square', 420, 410, 0.18, 0.12 * v);
        this.tone('square', 520, 510, 0.18, 0.08 * v);
        break;
      case 'jump':
        this.tone('sine', 300, 520, 0.1, 0.08 * v);
        break;
      case 'switch':
        this.tone('triangle', 800, 900, 0.04, 0.08 * v);
        break;
      case 'jam':
        this.tone('square', 220, 200, 0.06, 0.15 * v);
        this.tone('square', 180, 170, 0.06, 0.15 * v, 0.09);
        break;
      case 'shutter':
        this.hiss(0.03, 0.4 * v, 3000, 1, 'highpass');
        this.hiss(0.05, 0.3 * v, 2000, 1, 'bandpass', 0.08);
        break;
      case 'ding':
        this.tone('sine', 880, 880, 0.25, 0.2 * v);
        this.tone('sine', 1320, 1320, 0.35, 0.15 * v, 0.12);
        break;
      case 'meh':
        this.tone('triangle', 440, 400, 0.2, 0.15 * v);
        this.tone('triangle', 400, 380, 0.25, 0.15 * v, 0.2);
        break;
      case 'fail':
        this.tone('sawtooth', 300, 280, 0.25, 0.1 * v);
        this.tone('sawtooth', 270, 250, 0.25, 0.1 * v, 0.27);
        this.tone('sawtooth', 240, 180, 0.6, 0.1 * v, 0.54);
        break;
      case 'click':
        this.tone('triangle', 1000, 900, 0.03, 0.08 * v);
        break;
      case 'alarm':
        // car alarm: a few alternating whoops
        for (let i = 0; i < 6; i++) this.tone('square', i % 2 ? 620 : 880, i % 2 ? 880 : 620, 0.22, 0.07 * v, i * 0.24);
        break;
      case 'pageflip':
        this.hiss(0.32, 0.3 * v, 1800, 0.8, 'bandpass', 0, 600);
        this.hiss(0.12, 0.2 * v, 3500, 1, 'highpass', 0.2);
        break;
      case 'pour':
        for (let i = 0; i < 5; i++) this.tone('sine', 300 + Math.random() * 300, 500 + Math.random() * 400, 0.08, 0.05 * v, i * 0.09);
        this.hiss(0.5, 0.08 * v, 900, 2, 'bandpass');
        break;
      case 'scribble':
        // somebody else's pencil, quick strokes in the air
        for (let i = 0; i < 4; i++) this.hiss(0.09, 0.12 * v, 3200 + Math.random() * 1200, 2.5, 'bandpass', i * 0.13);
        break;
      case 'bell':
        // shop door bell
        this.tone('sine', 1760, 1760, 0.5, 0.09 * v);
        this.tone('sine', 2350, 2350, 0.45, 0.06 * v, 0.07);
        break;
      case 'bark':
        this.tone('sawtooth', 520, 260, 0.09, 0.14 * v);
        this.hiss(0.08, 0.18 * v, 900, 1.5, 'bandpass');
        this.tone('sawtooth', 500, 240, 0.08, 0.12 * v, 0.17);
        break;
      case 'snip':
        this.hiss(0.03, 0.18 * v, 5000, 3, 'highpass');
        this.hiss(0.03, 0.14 * v, 4200, 3, 'highpass', 0.08);
        break;
      case 'pop':
        this.tone('sine', 900, 200, 0.06, 0.25 * v);
        this.hiss(0.05, 0.25 * v, 2500, 1, 'highpass');
        break;
      case 'cheer':
        this.tone('triangle', 660, 990, 0.12, 0.1 * v);
        this.tone('triangle', 880, 1320, 0.14, 0.08 * v, 0.1);
        break;
      case 'strum':
        // a guitar chord, string by string
        [196, 247, 294, 392, 494].forEach((f, i) => this.tone('triangle', f, f * 0.995, 0.9, 0.05 * v, i * 0.025));
        break;
      case 'shotgun':
        this.hiss(0.32, 0.6 * v, 1200, 0.7, 'lowpass', 0, 260);
        this.tone('sine', 160, 55, 0.25, 0.45 * v);
        this.hiss(0.05, 0.25 * v, 3500, 1, 'highpass', 0.18);
        this.tone('square', 260, 240, 0.04, 0.06 * v, 0.3);
        break;
      case 'staple':
        this.tone('square', 1500, 700, 0.03, 0.08 * v);
        this.hiss(0.03, 0.18 * v, 5200, 2, 'highpass');
        break;
      case 'slash':
        this.hiss(0.16, 0.32 * v, 2800, 1.6, 'bandpass', 0, 900);
        this.tone('triangle', 1400, 2400, 0.08, 0.05 * v);
        break;
      case 'whoosh':
        this.hiss(0.4, 0.28 * v, 600, 1.2, 'bandpass', 0, 2200);
        this.tone('sine', 220, 440, 0.18, 0.08 * v);
        break;
      case 'glue':
        this.tone('sine', 140, 90, 0.12, 0.3 * v);
        this.hiss(0.12, 0.2 * v, 700, 2, 'lowpass');
        break;
      case 'laser':
        this.tone('sawtooth', 880 + Math.random() * 60, 860, 0.1, 0.035 * v);
        this.tone('sine', 1760, 1740, 0.1, 0.03 * v);
        break;
      case 'scissors':
        this.hiss(0.5, 0.22 * v, 1800, 3, 'bandpass', 0, 3600);
        this.hiss(0.03, 0.18 * v, 5000, 3, 'highpass', 0.05);
        break;
      case 'mini':
        this.tone('square', 520 + Math.random() * 80, 300, 0.035, 0.05 * v);
        this.hiss(0.03, 0.14 * v, 2600, 1.4, 'bandpass');
        break;
      case 'tippex':
        // a wet squirt from the bottle
        this.hiss(0.05, 0.16 * v, 1400 + Math.random() * 300, 2, 'bandpass', 0, 600);
        this.tone('sine', 380 + Math.random() * 60, 200, 0.04, 0.06 * v);
        break;
      case 'rubber':
        // a rubber thwack
        this.tone('triangle', 300 + Math.random() * 60, 140, 0.04, 0.09 * v);
        this.hiss(0.025, 0.1 * v, 3000, 1.5, 'bandpass');
        break;
      case 'chute':
        // the canopy snaps open
        this.hiss(0.35, 0.45 * v, 900, 1, 'bandpass', 0, 300);
        this.tone('sine', 110, 70, 0.2, 0.25 * v);
        break;
      case 'block':
        this.hiss(0.12, 0.45 * v, 500, 1, 'lowpass');
        this.tone('sine', 120, 80, 0.1, 0.3 * v);
        break;
      case 'crumble':
        // a whole prop rubbed out of the page
        this.hiss(0.5, 0.4 * v, 2200, 1.5, 'bandpass', 0, 900);
        this.hiss(0.3, 0.25 * v, 700, 1, 'lowpass', 0.1);
        break;
      case 'magic':
        // the drawing lifts off the air: a rising shimmer of little bells
        [784, 988, 1175, 1568, 1976, 2349].forEach((f, i) => this.tone('sine', f, f * 1.01, 0.32, 0.075 * v, i * 0.055));
        this.hiss(0.55, 0.12 * v, 5000, 2, 'bandpass', 0, 9000);
        break;
      case 'poof':
        // ...and puffs up into the real thing
        this.tone('sine', 140, 420, 0.16, 0.38 * v);
        this.tone('triangle', 420, 260, 0.22, 0.1 * v, 0.1);
        this.hiss(0.3, 0.3 * v, 600, 0.8, 'lowpass', 0, 2400);
        break;
      default:
        break;
    }
  }

  scratchStart() {
    if (!this.ctx) return;
    this.scratchGain.gain.setTargetAtTime(0.05, this.ctx.currentTime, 0.02);
  }

  scratch(amount) {
    if (!this.ctx || !this.enabled) return;
    const g = Math.min(0.32, 0.03 + amount * 0.01);
    this.scratchGain.gain.setTargetAtTime(g, this.ctx.currentTime, 0.03);
  }

  scratchStop() {
    if (!this.ctx) return;
    this.scratchGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  }

  // call every frame while a vehicle is driven
  engine(level, kind) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this.engineT = performance.now();
    let f = 60;
    let vol = 0.05;
    if (kind === 'car') {
      f = 55 + level * 120;
      vol = 0.05 + level * 0.04;
      this.engFilter.frequency.setTargetAtTime(500 + level * 900, t, 0.05);
    } else if (kind === 'bike') {
      // a buzzy little two-stroke
      f = 90 + level * 210;
      vol = 0.045 + level * 0.035;
      this.engFilter.frequency.setTargetAtTime(900 + level * 1400, t, 0.04);
    } else if (kind === 'tank') {
      f = 32 + level * 30;
      vol = 0.09;
      this.engFilter.frequency.setTargetAtTime(300, t, 0.05);
    } else if (kind === 'ufo') {
      f = 220 + Math.sin(t * 6) * 30 + level * 80;
      vol = 0.03;
      this.engFilter.frequency.setTargetAtTime(1200, t, 0.05);
    } else if (kind === 'beam') {
      f = 440 + Math.sin(t * 30) * 60;
      vol = 0.05;
      this.engFilter.frequency.setTargetAtTime(2000, t, 0.05);
    }
    this.engOsc.frequency.setTargetAtTime(f, t, 0.05);
    this.engOsc2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.engGain.gain.setTargetAtTime(vol, t, 0.08);
  }

  tick() {
    if (!this.ctx) return;
    if (performance.now() - this.engineT > 200) this.engGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }
}
