// Fully procedural Web Audio engine: no sound files, everything is synthesized.
// Positional sounds are panned/attenuated relative to the listener (the camera).
import * as THREE from 'three';

const _tmp = new THREE.Vector3();

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.ambBus = null;
    this.musicBus = null;
    this.lowpass = null;
    this.listenerPos = new THREE.Vector3();
    this.listenerRight = new THREE.Vector3(1, 0, 0);
    this.listenerFwd = new THREE.Vector3(0, 0, -1);
    this.volume = 0.8;
    this.timeScale = 1;
    this.noiseBuffer = null;
    this.started = false;
    this.ambient = null;
    this.tension = 0;       // 0..1, drives music intensity
    this._tensionTarget = 0;
    this.music = null;
  }

  // Must be called from a user gesture.
  start() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.volume;
    this.lowpass = c.createBiquadFilter(); this.lowpass.type = 'lowpass'; this.lowpass.frequency.value = 20000; this.lowpass.Q.value = 0.5;
    this.compressor = c.createDynamicsCompressor();
    this.compressor.threshold.value = -14; this.compressor.knee.value = 20; this.compressor.ratio.value = 4; this.compressor.attack.value = 0.003; this.compressor.release.value = 0.2;
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = 1;
    this.ambBus = c.createGain(); this.ambBus.gain.value = 0.7;
    this.musicBus = c.createGain(); this.musicBus.gain.value = 0.55;
    this.sfxBus.connect(this.lowpass); this.ambBus.connect(this.lowpass); this.musicBus.connect(this.lowpass);
    this.lowpass.connect(this.compressor); this.compressor.connect(this.master); this.master.connect(c.destination);

    // 2 seconds of white noise, reused by every noise-based sound.
    const len = c.sampleRate * 2;
    this.noiseBuffer = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.started = true;
    this.startAmbient();
    this.startMusic();
    if (c.state === 'suspended') c.resume();
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }

  setListener(pos, fwd, right) {
    this.listenerPos.copy(pos); this.listenerFwd.copy(fwd); this.listenerRight.copy(right);
  }

  // Architect mode: muffle everything and slow the ambient pulse.
  setSlowMotion(on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.lowpass.frequency.cancelScheduledValues(t);
    this.lowpass.frequency.setTargetAtTime(on ? 520 : 20000, t, 0.12);
  }

  _spatial(pos, maxDist = 60, refDist = 4) {
    if (!pos) return { gain: 1, pan: 0, dist: 0 };
    _tmp.subVectors(pos, this.listenerPos);
    const dist = _tmp.length();
    if (dist > maxDist) return null;
    const g = Math.min(1, refDist / Math.max(refDist, dist));
    const gain = g * g * (1 - dist / maxDist) + 0.02;
    _tmp.y = 0;
    const len = _tmp.length();
    const pan = len > 0.01 ? THREE.MathUtils.clamp(_tmp.dot(this.listenerRight) / len * 0.8, -0.85, 0.85) : 0;
    return { gain, pan, dist };
  }

  _out(pos, maxDist, refDist) {
    if (!this.ctx) return null;
    const sp = this._spatial(pos, maxDist, refDist);
    if (!sp) return null;
    const c = this.ctx;
    const g = c.createGain(); g.gain.value = sp.gain;
    const p = c.createStereoPanner(); p.pan.value = sp.pan;
    g.connect(p); p.connect(this.sfxBus);
    return { node: g, dist: sp.dist, gain: sp.gain };
  }

  _noise(out, { dur = 0.2, filter = 'bandpass', freq = 1200, q = 1, gain = 1, attack = 0.002, decay = 0.15, freqEnd = null, delay = 0 } = {}) {
    const c = this.ctx; const t0 = c.currentTime + delay;
    const src = c.createBufferSource(); src.buffer = this.noiseBuffer; src.loop = true;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = c.createBiquadFilter(); f.type = filter; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.setTargetAtTime(0.0001, t0 + attack, decay);
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t0); src.stop(t0 + dur + decay * 4);
  }

  _tone(out, { freq = 440, type = 'sine', dur = 0.2, gain = 0.5, attack = 0.005, decay = 0.1, freqEnd = null, delay = 0 } = {}) {
    const c = this.ctx; const t0 = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.setTargetAtTime(0.0001, t0 + attack + dur * 0.5, decay);
    o.connect(g); g.connect(out);
    o.start(t0); o.stop(t0 + dur + decay * 5);
  }

  // ---- Public one-shots ----
  gunshot(pos, kind = 'rifle') {
    const o = this._out(pos, 140, 6); if (!o) return;
    const far = o.dist > 25;
    if (kind === 'rifle') {
      this._noise(o.node, { dur: 0.08, filter: 'lowpass', freq: far ? 900 : 3800, freqEnd: 300, gain: 1.1, decay: far ? 0.12 : 0.05 });
      this._noise(o.node, { dur: 0.05, filter: 'highpass', freq: 2500, gain: 0.6, decay: 0.03 });
      this._tone(o.node, { freq: 160, freqEnd: 45, type: 'sine', dur: 0.09, gain: 0.9, decay: 0.05 });
    } else if (kind === 'ak') {
      this._noise(o.node, { dur: 0.1, filter: 'lowpass', freq: far ? 700 : 2600, freqEnd: 200, gain: 1.2, decay: far ? 0.16 : 0.07 });
      this._tone(o.node, { freq: 120, freqEnd: 40, type: 'triangle', dur: 0.12, gain: 1.0, decay: 0.07 });
    } else {
      this._noise(o.node, { dur: 0.07, filter: 'bandpass', freq: 1800, gain: 0.8, decay: 0.05 });
      this._tone(o.node, { freq: 200, freqEnd: 60, dur: 0.07, gain: 0.7, decay: 0.05 });
    }
  }

  impact(pos, material = 'concrete') {
    const o = this._out(pos, 40, 3); if (!o) return;
    if (material === 'metal') {
      this._tone(o.node, { freq: 1800 + Math.random() * 1200, freqEnd: 900, type: 'triangle', dur: 0.12, gain: 0.35, decay: 0.09 });
      this._noise(o.node, { dur: 0.04, filter: 'highpass', freq: 3000, gain: 0.4, decay: 0.03 });
    } else if (material === 'flesh') {
      this._noise(o.node, { dur: 0.06, filter: 'lowpass', freq: 600, gain: 0.7, decay: 0.05 });
    } else {
      this._noise(o.node, { dur: 0.05, filter: 'bandpass', freq: 1400 + Math.random() * 800, q: 0.8, gain: 0.55, decay: 0.04 });
    }
  }

  ricochet(pos) {
    const o = this._out(pos, 50, 3); if (!o) return;
    this._tone(o.node, { freq: 2600 + Math.random() * 900, freqEnd: 400, type: 'sine', dur: 0.25, gain: 0.25, decay: 0.12 });
  }

  explosion(pos) {
    const o = this._out(pos, 200, 12); if (!o) return;
    this._noise(o.node, { dur: 0.6, filter: 'lowpass', freq: 1800, freqEnd: 80, gain: 1.6, attack: 0.005, decay: 0.35 });
    this._tone(o.node, { freq: 70, freqEnd: 28, type: 'sine', dur: 0.8, gain: 1.4, decay: 0.4 });
    this._noise(o.node, { dur: 0.3, filter: 'highpass', freq: 1500, gain: 0.5, decay: 0.2, delay: 0.02 });
  }

  footstep(pos, running = false, surface = 'concrete') {
    const o = this._out(pos, 22, 2); if (!o) return;
    const g = running ? 0.35 : 0.18;
    if (surface === 'metal') {
      this._tone(o.node, { freq: 380 + Math.random() * 120, freqEnd: 180, type: 'triangle', dur: 0.08, gain: g * 0.8, decay: 0.06 });
      this._noise(o.node, { dur: 0.04, filter: 'bandpass', freq: 2200, gain: g, decay: 0.03 });
    } else {
      this._noise(o.node, { dur: 0.05, filter: 'lowpass', freq: 700 + Math.random() * 300, gain: g, decay: 0.035 });
    }
  }

  reload(pos) {
    const o = this._out(pos, 20, 2); if (!o) return;
    this._noise(o.node, { dur: 0.03, filter: 'bandpass', freq: 2400, gain: 0.5, decay: 0.03 });
    this._tone(o.node, { freq: 900, freqEnd: 500, type: 'square', dur: 0.03, gain: 0.12, decay: 0.03, delay: 0.5 });
    this._noise(o.node, { dur: 0.04, filter: 'bandpass', freq: 1800, gain: 0.6, decay: 0.04, delay: 1.3 });
    this._tone(o.node, { freq: 1400, freqEnd: 700, type: 'square', dur: 0.03, gain: 0.15, decay: 0.03, delay: 1.75 });
  }

  dryFire(pos) {
    const o = this._out(pos, 10, 2); if (!o) return;
    this._tone(o.node, { freq: 1200, freqEnd: 600, type: 'square', dur: 0.02, gain: 0.15, decay: 0.02 });
  }

  pin(pos) {
    const o = this._out(pos, 15, 2); if (!o) return;
    this._tone(o.node, { freq: 2200, freqEnd: 1800, type: 'triangle', dur: 0.05, gain: 0.2, decay: 0.05 });
  }

  bounce(pos) {
    const o = this._out(pos, 25, 2); if (!o) return;
    this._tone(o.node, { freq: 700 + Math.random() * 200, freqEnd: 300, type: 'triangle', dur: 0.06, gain: 0.3, decay: 0.05 });
  }

  modulePlace(pos, heavy = false) {
    const o = this._out(pos, 60, 6); if (!o) return;
    this._noise(o.node, { dur: 0.25, filter: 'lowpass', freq: heavy ? 320 : 600, freqEnd: 60, gain: heavy ? 1.3 : 0.8, decay: 0.18 });
    this._tone(o.node, { freq: heavy ? 55 : 90, freqEnd: 30, type: 'sine', dur: 0.3, gain: 0.8, decay: 0.2 });
    if (heavy) this._tone(o.node, { freq: 420, freqEnd: 300, type: 'triangle', dur: 0.2, gain: 0.15, decay: 0.15, delay: 0.05 });
  }

  moduleGrab() { if (!this.ctx) return; this._tone(this.sfxBus, { freq: 520, freqEnd: 780, type: 'sine', dur: 0.08, gain: 0.12, decay: 0.05 }); }
  moduleInvalid() { if (!this.ctx) return; this._tone(this.sfxBus, { freq: 220, freqEnd: 160, type: 'square', dur: 0.12, gain: 0.08, decay: 0.06 }); }

  architectEnter() {
    if (!this.ctx) return;
    this._noise(this.sfxBus, { dur: 0.5, filter: 'lowpass', freq: 3000, freqEnd: 200, gain: 0.5, attack: 0.01, decay: 0.2 });
    this._tone(this.sfxBus, { freq: 220, freqEnd: 110, type: 'sine', dur: 0.6, gain: 0.25, decay: 0.3 });
    this._tone(this.sfxBus, { freq: 880, type: 'sine', dur: 0.15, gain: 0.08, decay: 0.2, delay: 0.1 });
  }
  architectExit() {
    if (!this.ctx) return;
    this._noise(this.sfxBus, { dur: 0.35, filter: 'highpass', freq: 300, freqEnd: 4000, gain: 0.4, attack: 0.01, decay: 0.15 });
    this._tone(this.sfxBus, { freq: 110, freqEnd: 240, type: 'sine', dur: 0.35, gain: 0.25, decay: 0.15 });
  }

  ui(kind = 'click') {
    if (!this.ctx) return;
    if (kind === 'click') this._tone(this.sfxBus, { freq: 1200, freqEnd: 900, type: 'sine', dur: 0.05, gain: 0.12, decay: 0.04 });
    else if (kind === 'hover') this._tone(this.sfxBus, { freq: 1600, type: 'sine', dur: 0.03, gain: 0.05, decay: 0.03 });
    else if (kind === 'objective') { this._tone(this.sfxBus, { freq: 660, type: 'sine', dur: 0.12, gain: 0.2, decay: 0.15 }); this._tone(this.sfxBus, { freq: 990, type: 'sine', dur: 0.2, gain: 0.2, decay: 0.25, delay: 0.12 }); }
    else if (kind === 'checkpoint') { this._tone(this.sfxBus, { freq: 523, type: 'triangle', dur: 0.1, gain: 0.15, decay: 0.1 }); this._tone(this.sfxBus, { freq: 784, type: 'triangle', dur: 0.25, gain: 0.15, decay: 0.3, delay: 0.1 }); }
    else if (kind === 'alert') { this._tone(this.sfxBus, { freq: 196, type: 'sawtooth', dur: 0.3, gain: 0.12, decay: 0.2 }); this._tone(this.sfxBus, { freq: 233, type: 'sawtooth', dur: 0.4, gain: 0.12, decay: 0.3, delay: 0.05 }); }
    else if (kind === 'hit') this._tone(this.sfxBus, { freq: 2200, freqEnd: 1500, type: 'sine', dur: 0.04, gain: 0.12, decay: 0.03 });
    else if (kind === 'kill') { this._tone(this.sfxBus, { freq: 1800, freqEnd: 1200, type: 'sine', dur: 0.05, gain: 0.14, decay: 0.05 }); this._tone(this.sfxBus, { freq: 900, type: 'sine', dur: 0.06, gain: 0.1, decay: 0.06, delay: 0.05 }); }
    else if (kind === 'damage') this._noise(this.sfxBus, { dur: 0.15, filter: 'lowpass', freq: 500, freqEnd: 120, gain: 0.5, decay: 0.12 });
    else if (kind === 'fail') { this._tone(this.sfxBus, { freq: 220, freqEnd: 110, type: 'sawtooth', dur: 1.2, gain: 0.2, decay: 0.6 }); }
    else if (kind === 'win') { [523, 659, 784, 1046].forEach((f, i) => this._tone(this.sfxBus, { freq: f, type: 'triangle', dur: 0.3, gain: 0.15, decay: 0.4, delay: i * 0.12 })); }
    else if (kind === 'radio') { this._noise(this.sfxBus, { dur: 0.08, filter: 'bandpass', freq: 1800, q: 3, gain: 0.2, decay: 0.05 }); this._tone(this.sfxBus, { freq: 1500, type: 'square', dur: 0.03, gain: 0.03, decay: 0.03, delay: 0.09 }); }
  }

  heli(pos, intensity) {
    // called continuously; creates a rotor loop once
    if (!this.ctx) return;
    if (!this._heli) {
      const c = this.ctx;
      const src = c.createBufferSource(); src.buffer = this.noiseBuffer; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
      const lfo = c.createOscillator(); lfo.frequency.value = 14; const lg = c.createGain(); lg.gain.value = 0.9;
      const am = c.createGain(); am.gain.value = 0.2;
      lfo.connect(lg); lg.connect(am.gain);
      const g = c.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(am); am.connect(g); g.connect(this.sfxBus);
      src.start(); lfo.start();
      this._heli = { g };
    }
    const sp = this._spatial(pos, 400, 40);
    const target = sp ? Math.min(1.2, sp.gain * 3) * intensity : 0;
    this._heli.g.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
  }

  // ---- Ambient bed: wind + rain + distant hum ----
  startAmbient() {
    const c = this.ctx;
    const mk = (type, freq, q, gain, lfoRate, lfoDepth) => {
      const src = c.createBufferSource(); src.buffer = this.noiseBuffer; src.loop = true; src.playbackRate.value = 0.5 + Math.random();
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.value = gain;
      if (lfoRate) { const lfo = c.createOscillator(); lfo.frequency.value = lfoRate; const lg = c.createGain(); lg.gain.value = lfoDepth; lfo.connect(lg); lg.connect(f.frequency); lfo.start(); }
      src.connect(f); f.connect(g); g.connect(this.ambBus); src.start();
      return g;
    };
    this.ambient = {
      wind: mk('bandpass', 380, 0.6, 0.16, 0.11, 220),
      rain: mk('highpass', 5200, 0.4, 0.09, 0.3, 800),
      hum: null,
    };
    const hum = c.createOscillator(); hum.type = 'sine'; hum.frequency.value = 50;
    const hg = c.createGain(); hg.gain.value = 0.03; hum.connect(hg); hg.connect(this.ambBus); hum.start();
    this.ambient.hum = hg;
  }

  // ---- Music: an evolving pad whose intensity follows combat tension ----
  startMusic() {
    const c = this.ctx;
    const voices = [];
    const base = 55; // A1
    const ratios = [1, 1.5, 2, 2.9966, 4, 4.7568];
    for (let i = 0; i < ratios.length; i++) {
      const o = c.createOscillator(); o.type = i % 2 ? 'sawtooth' : 'triangle'; o.frequency.value = base * ratios[i];
      o.detune.value = (Math.random() - 0.5) * 12;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180; f.Q.value = 1.2;
      const g = c.createGain(); g.gain.value = 0;
      o.connect(f); f.connect(g); g.connect(this.musicBus); o.start();
      voices.push({ o, f, g, i });
    }
    // slow pulse for the tension layer
    const pulse = c.createOscillator(); pulse.type = 'sine'; pulse.frequency.value = 110;
    const pf = c.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 400;
    const pg = c.createGain(); pg.gain.value = 0;
    const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 2.2; const lg = c.createGain(); lg.gain.value = 0.5;
    const lfoOff = c.createConstantSource(); lfoOff.offset.value = 0.5;
    const amp = c.createGain(); amp.gain.value = 0;
    lfo.connect(lg); lg.connect(amp.gain); lfoOff.connect(amp.gain);
    pulse.connect(pf); pf.connect(amp); amp.connect(pg); pg.connect(this.musicBus);
    pulse.start(); lfo.start(); lfoOff.start();
    this.music = { voices, pg, pf, lfo };
  }

  setTension(v) { this._tensionTarget = THREE.MathUtils.clamp(v, 0, 1); }

  update(dt, menu = false) {
    if (!this.ctx || !this.music) return;
    const k = 1 - Math.exp(-dt * 0.8);
    this.tension += (this._tensionTarget - this.tension) * k;
    const t = this.tension;
    const ct = this.ctx.currentTime;
    const baseGain = menu ? 0.06 : 0.035;
    for (const v of this.music.voices) {
      const target = baseGain * (v.i < 2 ? 1 : 0.6 + t * 0.6) * (v.i > 3 ? t : 1);
      v.g.gain.setTargetAtTime(target, ct, 0.5);
      v.f.frequency.setTargetAtTime(180 + t * 900 + v.i * 40, ct, 0.5);
    }
    this.music.pg.gain.setTargetAtTime(t * t * 0.09, ct, 0.3);
    this.music.lfo.frequency.setTargetAtTime(2.2 + t * 2.8, ct, 0.5);
    if (this.ambient) {
      this.ambient.rain.gain.setTargetAtTime(menu ? 0.05 : 0.09, ct, 0.5);
    }
  }
}
