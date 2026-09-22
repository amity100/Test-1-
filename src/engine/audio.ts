import * as THREE from 'three';

/**
 * Fully procedural audio: every sound is synthesised with WebAudio, so the
 * game ships with zero audio files and still has rain, a reactive score and
 * spatialised effects.
 */
export class Audio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private music: { drone: GainNode; pulse: GainNode; alarm: GainNode; filter: BiquadFilterNode } | null = null;
  private pulseTimer = 0;
  private tension = 0;
  private alarm = 0;
  private focusFilter!: BiquadFilterNode;
  volume = 0.9;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.focusFilter = ctx.createBiquadFilter();
    this.focusFilter.type = 'lowpass';
    this.focusFilter.frequency.value = 20000;
    this.master.connect(this.focusFilter).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.5;
    this.musicBus.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startAmbience();
    this.startMusic();
  }

  private noise(loop = false) {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = loop;
    s.loopStart = Math.random();
    return s;
  }

  private startAmbience() {
    const ctx = this.ctx!;
    // Rain: band-passed noise, two layers.
    const rain = this.noise(true);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.value = 0.09;
    rain.connect(hp).connect(lp).connect(g).connect(this.master);
    rain.start();
    const rumble = this.noise(true);
    const lp2 = ctx.createBiquadFilter();
    lp2.type = 'lowpass';
    lp2.frequency.value = 180;
    const g2 = ctx.createGain();
    g2.gain.value = 0.22;
    rumble.connect(lp2).connect(g2).connect(this.master);
    rumble.start();
    // occasional distant ship horn
    const horn = () => {
      if (!this.ctx) return;
      const t = ctx.currentTime;
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      o1.type = 'sawtooth'; o2.type = 'sawtooth';
      o1.frequency.value = 73; o2.frequency.value = 110.5;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 380;
      const hg = ctx.createGain();
      hg.gain.setValueAtTime(0, t);
      hg.gain.linearRampToValueAtTime(0.05, t + 0.8);
      hg.gain.setValueAtTime(0.05, t + 3.2);
      hg.gain.linearRampToValueAtTime(0, t + 5);
      o1.connect(f); o2.connect(f); f.connect(hg).connect(this.master);
      o1.start(t); o2.start(t); o1.stop(t + 5.2); o2.stop(t + 5.2);
      setTimeout(horn, 40000 + Math.random() * 50000);
    };
    setTimeout(horn, 12000);
  }

  private startMusic() {
    const ctx = this.ctx!;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    filter.Q.value = 2;
    const drone = ctx.createGain();
    drone.gain.value = 0.06;
    // D minor-ish drone with slow detune shimmer
    for (const [f, type] of [[36.7, 'sawtooth'], [55, 'sawtooth'], [73.4, 'triangle'], [110, 'sine'], [87.3, 'triangle']] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + Math.random() * 0.1;
      const lg = ctx.createGain();
      lg.gain.value = 1.5;
      lfo.connect(lg).connect(o.detune);
      lfo.start();
      o.connect(filter);
      o.start();
    }
    filter.connect(drone).connect(this.musicBus);
    const pulse = ctx.createGain();
    pulse.gain.value = 0;
    pulse.connect(this.musicBus);
    const alarm = ctx.createGain();
    alarm.gain.value = 0;
    alarm.connect(this.musicBus);
    this.music = { drone, pulse, alarm, filter };
  }

  /** tension 0..1 (suspicion), alarm 0..1 (combat). */
  setIntensity(tension: number, alarm: number, dt: number) {
    if (!this.ctx || !this.music) return;
    this.tension += (tension - this.tension) * Math.min(1, dt * 1.5);
    this.alarm += (alarm - this.alarm) * Math.min(1, dt * 2);
    const t = this.ctx.currentTime;
    this.music.filter.frequency.setTargetAtTime(420 + this.tension * 900 + this.alarm * 2200, t, 0.3);
    this.music.drone.gain.setTargetAtTime(0.055 + this.tension * 0.03 + this.alarm * 0.04, t, 0.3);
    // heartbeat pulse
    this.pulseTimer -= dt;
    const rate = this.alarm > 0.3 ? 0.36 : 0.78 - this.tension * 0.3;
    if (this.pulseTimer <= 0 && (this.tension > 0.15 || this.alarm > 0.1)) {
      this.pulseTimer = rate;
      this.thump(0.12 * Math.max(this.tension, this.alarm), this.alarm > 0.3 ? 58 : 48);
      if (this.alarm > 0.3) this.hat(0.04 * this.alarm);
    }
  }

  private thump(vol: number, freq: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(freq * 2, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.4);
  }

  private hat(vol: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.18;
    const n = this.noise();
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    n.connect(f).connect(g).connect(this.musicBus);
    n.start(t);
    n.stop(t + 0.08);
  }

  setFocus(amount: number) {
    if (!this.ctx) return;
    this.focusFilter.frequency.setTargetAtTime(20000 - amount * 18500, this.ctx.currentTime, 0.08);
  }

  updateListener(cam: THREE.Camera) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const p = cam.getWorldPosition(_p);
    const f = cam.getWorldDirection(_f);
    if (l.positionX) {
      const t = this.ctx.currentTime;
      l.positionX.setTargetAtTime(p.x, t, 0.02);
      l.positionY.setTargetAtTime(p.y, t, 0.02);
      l.positionZ.setTargetAtTime(p.z, t, 0.02);
      l.forwardX.setTargetAtTime(f.x, t, 0.02);
      l.forwardY.setTargetAtTime(f.y, t, 0.02);
      l.forwardZ.setTargetAtTime(f.z, t, 0.02);
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else {
      (l as any).setPosition(p.x, p.y, p.z);
      (l as any).setOrientation(f.x, f.y, f.z, 0, 1, 0);
    }
  }

  private out(pos?: THREE.Vector3, refDist = 4) {
    if (!pos) return this.sfx;
    const p = this.ctx!.createPanner();
    p.panningModel = 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = refDist;
    p.maxDistance = 80;
    p.rolloffFactor = 1.2;
    p.positionX.value = pos.x;
    p.positionY.value = pos.y;
    p.positionZ.value = pos.z;
    p.connect(this.sfx);
    return p;
  }

  riftOpen(pos: THREE.Vector3, anchor = false) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, o = this.out(pos, 5);
    const n = this.noise();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 3;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(3500, t + 0.25);
    bp.frequency.exponentialRampToValueAtTime(900, t + 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    n.connect(bp).connect(g).connect(o);
    n.start(t);
    n.stop(t + 0.75);
    // shimmering chord
    const base = anchor ? 330 : 247;
    for (const m of [1, 1.5, 2.01, 3.02]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base * m * 0.5, t);
      osc.frequency.exponentialRampToValueAtTime(base * m, t + 0.18);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.05, t + 0.05);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      osc.connect(og).connect(o);
      osc.start(t);
      osc.stop(t + 1);
    }
  }

  riftClose(pos: THREE.Vector3) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, o = this.out(pos, 4);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(g).connect(o);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  /** Continuous hum for an open rift; returns a handle to move/stop it. */
  hum(pos: THREE.Vector3) {
    if (!this.ctx) return null;
    const ctx = this.ctx;
    const p = this.out(pos, 2.5) as PannerNode;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.06, ctx.currentTime, 0.2);
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.frequency.value = 98; o2.frequency.value = 98.7 * 2;
    o1.type = 'sawtooth';
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    o1.connect(f); o2.connect(f); f.connect(g).connect(p);
    o1.start(); o2.start();
    return {
      stop: () => {
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
        o1.stop(ctx.currentTime + 0.5);
        o2.stop(ctx.currentTime + 0.5);
      },
      move: (v: THREE.Vector3) => {
        if (!p.positionX) return;
        p.positionX.value = v.x; p.positionY.value = v.y; p.positionZ.value = v.z;
      },
    };
  }

  whoosh(vol = 0.35) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const n = this.noise();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(4000, t);
    bp.frequency.exponentialRampToValueAtTime(250, t + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    n.connect(bp).connect(g).connect(this.sfx);
    n.start(t);
    n.stop(t + 0.55);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(35, t + 0.4);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.35, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(og).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.5);
  }

  footstep(pos: THREE.Vector3, loud: number, metal = false) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, o = this.out(pos, 2);
    const n = this.noise();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = metal ? 2400 : 900 + Math.random() * 400;
    f.Q.value = metal ? 6 : 1.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05 + loud * 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (metal ? 0.12 : 0.09));
    n.connect(f).connect(g).connect(o);
    n.start(t);
    n.stop(t + 0.15);
  }

  takedown(pos: THREE.Vector3) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, o = this.out(pos, 3);
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(g).connect(o);
    osc.start(t);
    osc.stop(t + 0.32);
    const n = this.noise();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.3, t + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    n.connect(f).connect(ng).connect(o);
    n.start(t);
    n.stop(t + 0.15);
  }

  bodyDrop(pos: THREE.Vector3, vol = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, o = this.out(pos, 3);
    const n = this.noise();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.7 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    n.connect(f).connect(g).connect(o);
    n.start(t);
    n.stop(t + 0.4);
  }

  radio(pos: THREE.Vector3) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, o = this.out(pos, 3);
    const n = this.noise();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    f.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    for (let i = 0; i < 14; i++) g.gain.setValueAtTime(Math.random() * 0.25, t + i * 0.08);
    g.gain.setValueAtTime(0, t + 1.2);
    n.connect(f).connect(g).connect(o);
    n.start(t);
    n.stop(t + 1.25);
    const beep = ctx.createOscillator();
    beep.frequency.value = 1400;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.08, t + 1.2);
    bg.gain.setValueAtTime(0, t + 1.32);
    beep.connect(bg).connect(o);
    beep.start(t);
    beep.stop(t + 1.35);
  }

  sting(kind: 'suspicious' | 'alert' | 'found') {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const notes = kind === 'alert' ? [220, 233, 311] : kind === 'found' ? [196, 207.6] : [440, 466];
    notes.forEach((fr, i) => {
      const o = ctx.createOscillator();
      o.type = kind === 'suspicious' ? 'sine' : 'sawtooth';
      o.frequency.value = fr;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = kind === 'suspicious' ? 3000 : 1600;
      const g = ctx.createGain();
      const st = t + i * (kind === 'suspicious' ? 0.09 : 0.02);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(kind === 'suspicious' ? 0.07 : 0.12, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, st + (kind === 'suspicious' ? 0.35 : 1.4));
      o.connect(f).connect(g).connect(this.musicBus);
      o.start(st);
      o.stop(st + 1.5);
    });
  }

  gunshot(pos: THREE.Vector3) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, o = this.out(pos, 8);
    const n = this.noise();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(6000, t);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(1.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    n.connect(f).connect(g).connect(o);
    n.start(t);
    n.stop(t + 0.45);
  }

  hurt() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.3);
  }

  ui(kind: 'click' | 'confirm' | 'deny' | 'pickup' | 'objective') {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const seq = kind === 'click' ? [880] : kind === 'confirm' ? [660, 990] : kind === 'deny' ? [200, 150] : kind === 'pickup' ? [520, 780] : [523, 659, 784, 1046];
    seq.forEach((fr, i) => {
      const o = ctx.createOscillator();
      o.type = kind === 'deny' ? 'square' : 'sine';
      o.frequency.value = fr;
      const g = ctx.createGain();
      const st = t + i * 0.07;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(kind === 'deny' ? 0.05 : 0.09, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.18);
      o.connect(g).connect(this.sfx);
      o.start(st);
      o.stop(st + 0.2);
    });
  }
}

const _p = new THREE.Vector3();
const _f = new THREE.Vector3();
