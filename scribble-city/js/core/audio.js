// Tiny WebAudio synth: every sound is generated, no audio files.

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

  // 0..1: how close the nearest siren is
  siren(level) {
    if (!this.ctx || !this.sirOsc) return;
    const t = this.ctx.currentTime;
    const wail = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 0.45);
    this.sirOsc.frequency.setTargetAtTime(560 + wail * 380, t, 0.05);
    this.sirGain.gain.setTargetAtTime(this.enabled ? level * level * 0.07 : 0, t, 0.1);
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
      case 'crumble':
        // a whole prop rubbed out of the page
        this.hiss(0.5, 0.4 * v, 2200, 1.5, 'bandpass', 0, 900);
        this.hiss(0.3, 0.25 * v, 700, 1, 'lowpass', 0.1);
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
