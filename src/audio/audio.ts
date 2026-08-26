/** Fully synthesised soundtrack + UI foley. No audio assets. */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private droneNodes: OscillatorNode[] = [];
  private noiseSrc: AudioBufferSourceNode | null = null;
  private started = false;
  muted = false;
  private tensionTarget = 0;
  private filter!: BiquadFilterNode;

  start() {
    if (this.started) return;
    this.started = true;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.0;
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 620;
    this.filter.Q.value = 1.2;
    this.filter.connect(this.musicGain);

    // Drone: stacked fifths, slightly detuned, slow amplitude drift.
    const roots = [55, 82.41, 110, 164.81, 220];
    roots.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 ? 'sawtooth' : 'sine';
      osc.frequency.value = f * (1 + (i - 2) * 0.0015);
      const g = ctx.createGain();
      g.gain.value = 0.055 / (1 + i * 0.55);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.03 + i * 0.017;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = g.gain.value * 0.7;
      lfo.connect(lfoGain).connect(g.gain);
      osc.connect(g).connect(this.filter);
      osc.start(); lfo.start();
      this.droneNodes.push(osc, lfo);
    });

    // Air: filtered noise bed
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const ng = ctx.createGain();
    ng.gain.value = 0.05;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 420;
    nf.Q.value = 0.6;
    src.connect(nf).connect(ng).connect(this.musicGain);
    src.start();
    this.noiseSrc = src;

    this.musicGain.gain.setTargetAtTime(0.5, ctx.currentTime, 3);
  }

  resume() {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx!.currentTime, 0.15);
  }

  /** 0 = calm, 1 = national alert. Opens the filter and adds bite. */
  setTension(v: number) {
    this.tensionTarget = v;
    if (!this.ctx) return;
    this.filter.frequency.setTargetAtTime(560 + v * 1500, this.ctx.currentTime, 2.5);
    this.musicGain.gain.setTargetAtTime(0.42 + v * 0.22, this.ctx.currentTime, 2.5);
  }

  private env(type: OscillatorType, freq: number, dur: number, gain: number, sweep = 0, delay = 0) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + sweep), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private noise(dur: number, gain: number, freq: number, type: BiquadFilterType = 'bandpass') {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t);
  }

  play(id: string) {
    if (!this.ctx) return;
    switch (id) {
      case 'hover': this.env('sine', 1480, 0.05, 0.035); break;
      case 'click': this.env('square', 660, 0.06, 0.05, -240); this.noise(0.05, 0.05, 2600, 'highpass'); break;
      case 'open': this.env('triangle', 380, 0.16, 0.07, 420); break;
      case 'close': this.env('triangle', 700, 0.14, 0.06, -420); break;
      case 'op-start':
        this.env('sawtooth', 180, 0.3, 0.06, 320);
        this.env('sine', 720, 0.2, 0.05, 240, 0.05);
        break;
      case 'breach-ok':
        [440, 660, 880, 1320].forEach((f, i) => this.env('sine', f, 0.35, 0.075, 0, i * 0.06));
        this.noise(0.3, 0.05, 1800);
        break;
      case 'breach-fail':
        this.env('sawtooth', 220, 0.4, 0.09, -140);
        this.env('square', 110, 0.5, 0.06, -60, 0.05);
        this.noise(0.35, 0.08, 500, 'lowpass');
        break;
      case 'alert':
        [880, 660].forEach((f, i) => this.env('square', f, 0.22, 0.07, 0, i * 0.22));
        break;
      case 'purge':
        this.env('sawtooth', 90, 1.4, 0.14, -60);
        this.noise(1.1, 0.16, 260, 'lowpass');
        break;
      case 'upgrade':
        [523, 659, 784, 1046].forEach((f, i) => this.env('triangle', f, 0.5, 0.06, 0, i * 0.07));
        break;
      case 'objective':
        [784, 1046].forEach((f, i) => this.env('sine', f, 0.3, 0.06, 0, i * 0.09));
        break;
      case 'chapter':
        [110, 165, 220].forEach((f, i) => this.env('sine', f, 2.2, 0.09, 0, i * 0.18));
        this.noise(1.6, 0.06, 300, 'lowpass');
        break;
      case 'dialog': this.env('sine', 520, 0.5, 0.05, 90); break;
      case 'type': this.env('square', 2200 + Math.random() * 600, 0.02, 0.018); break;
      case 'capture': this.env('sine', 1200, 0.25, 0.05, -400); break;
      default: break;
    }
  }
}

export const audio = new AudioEngine();
