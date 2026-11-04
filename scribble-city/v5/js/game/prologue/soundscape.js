// (v5, ROADMAP 18.9) The prologue's air: the sound of the evening under everything that is said and
// played, never silent - the sea (its waves coming in and breaking, the foam after them), the people
// round you (a murmur of voices, as many as there are near), the city's low hum, gulls now and then,
// and your own steps (on the pier's boards, on stone). It goes on when the wheel is gone, as if
// nothing had happened - only the wheel's own music stops.
//
// All of it is made on the fly (noise through filters, a gull's glide), and driven by levels:
// levels(t, sea, crowd, city) sets where each is going at t; step(t, wood, k) a footstep; gull(t, pan)
// a cry. In the game the director's tick works the levels out from where the ear is (update); for a
// film made of the game, the same calls are made into an offline context from what was logged.

const STEP_DUR = 0.11;

export class Soundscape {
  // c: an AudioContext (or an offline one); out: where it goes; noise: a buffer of white noise
  constructor(c, out, noise) {
    this.c = c;
    this.out = out;
    this.noise = noise;
    const mk = (type, freq, q, gain = 0) => {
      const s = c.createBufferSource();
      s.buffer = noise;
      s.loop = true;
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = c.createGain();
      g.gain.value = gain;
      s.connect(f).connect(g).connect(out);
      s.start(0, Math.random() * 0.9);
      return { s, f, g };
    };
    // the sea: its body low, the foam high - each swelling with the waves (an LFO-like envelope
    // written ahead in waves())
    this.seaLo = mk('lowpass', 380, 0.6);
    this.seaHi = mk('bandpass', 2600, 0.5);
    this.seaAmp = c.createGain();
    this.seaAmp.gain.value = 0;
    this.seaLo.g.disconnect();
    this.seaHi.g.disconnect();
    this.seaLo.g.connect(this.seaAmp);
    this.seaHi.g.connect(this.seaAmp);
    this.seaAmp.connect(out);
    this.seaLo.g.gain.value = 0.55;
    this.seaHi.g.gain.value = 0.09;
    // the people: voices as a murmur - a few bands where voices are, each opening and closing at the
    // pace of syllables, out of step with the others
    this.crowd = c.createGain();
    this.crowd.gain.value = 0;
    this.crowd.connect(out);
    this.voices = [[420, 4.2, 4.3], [900, 5.0, 5.1], [1500, 4.5, 3.7], [2400, 5.5, 6.2]].map(([fq, q, rate], i) => {
      const s = c.createBufferSource();
      s.buffer = noise;
      s.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = fq;
      f.Q.value = q;
      const g = c.createGain();
      g.gain.value = 0.5;
      const l = c.createOscillator();
      l.frequency.value = rate;
      const lg = c.createGain();
      lg.gain.value = 0.45;
      l.connect(lg).connect(g.gain);
      // (a second, slower wobble: the murmur's own rise and fall)
      const l2 = c.createOscillator();
      l2.frequency.value = 0.21 + i * 0.07;
      const lg2 = c.createGain();
      lg2.gain.value = 0.25;
      l2.connect(lg2).connect(g.gain);
      s.connect(f).connect(g).connect(this.crowd);
      s.start(0, Math.random() * 0.9);
      l.start(0);
      l2.start(0);
      return { s, f, g, l, l2 };
    });
    // the city: a low hum
    this.city = mk('lowpass', 140, 0.7);
    this.waveAt = 0;
    this.gullAt = 0;
    this.stepAt = 0;
  }

  // where each is going from t (0..1), over a moment
  levels(t, sea, crowd, city) {
    const T = 0.35;
    this.seaK = sea;
    this.crowd.gain.setTargetAtTime(0.06 * crowd, t, T);
    this.city.g.gain.setTargetAtTime(0.05 * city, t, T);
    this.waves(t);
  }

  // the waves written ahead to t + 4 s: each one swells over a couple of seconds, breaks, and the
  // foam hisses out after it; the next one some seconds on (the sea's level its height)
  waves(t) {
    const g = this.seaAmp.gain;
    const k = this.seaK || 0;
    while (this.waveAt < t + 4) {
      const t0 = Math.max(this.waveAt, t);
      const up = 1.6 + Math.random() * 1.2;
      const peak = (0.05 + 0.04 * Math.random()) * k;
      const low = 0.018 * k;
      g.setTargetAtTime(peak, t0, up / 3);
      g.setTargetAtTime(low, t0 + up, 1.1);
      this.waveAt = t0 + up + 2.2 + Math.random() * 3.5;
    }
  }

  // a gull's cry: two or three glides down, a little apart (pan -1..1)
  gull(t, vol = 0.5, pan = 0) {
    const c = this.c;
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    const out = c.createGain();
    out.gain.value = vol * 0.05;
    if (p) {
      p.pan.value = pan;
      out.connect(p).connect(this.out);
    } else out.connect(this.out);
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const t0 = t + i * (0.22 + Math.random() * 0.08);
      const o = c.createOscillator();
      o.type = 'sawtooth';
      const f0 = 1900 + Math.random() * 300;
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.62, t0 + 0.2);
      const v = c.createOscillator();
      v.frequency.value = 28;
      const vg = c.createGain();
      vg.gain.value = 40;
      v.connect(vg).connect(o.frequency);
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1500;
      f.Q.value = 1.4;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(1, t0 + 0.03);
      g.gain.setTargetAtTime(0, t0 + 0.12, 0.05);
      o.connect(f).connect(g).connect(out);
      o.start(t0);
      v.start(t0);
      o.stop(t0 + 0.45);
      v.stop(t0 + 0.45);
    }
  }

  // a footstep: on wood a hollow knock and the boards' give, on stone a short scuff (k: how heavy)
  step(t, wood, k = 1) {
    const c = this.c;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = wood ? 'lowpass' : 'bandpass';
    f.frequency.value = wood ? 700 : 1900;
    f.Q.value = wood ? 1.2 : 0.9;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime((wood ? 0.16 : 0.08) * k, t + 0.006);
    g.gain.setTargetAtTime(0, t + 0.012, STEP_DUR / 4);
    s.connect(f).connect(g).connect(this.out);
    s.start(t, Math.random() * 0.8);
    s.stop(t + STEP_DUR * 2);
    if (wood) {
      const o = c.createOscillator();
      o.frequency.setValueAtTime(150 + Math.random() * 30, t);
      o.frequency.exponentialRampToValueAtTime(90, t + 0.08);
      const og = c.createGain();
      og.gain.setValueAtTime(0, t);
      og.gain.linearRampToValueAtTime(0.09 * k, t + 0.004);
      og.gain.setTargetAtTime(0, t + 0.01, 0.025);
      o.connect(og).connect(this.out);
      o.start(t);
      o.stop(t + 0.2);
    }
  }
}

// how much of each there is where the ear is: the sea by how near the water (and the pier over it),
// the people by how many are near, the city a little everywhere, less out over the water
export function airAt(game, p) {
  const WATER_X = 108;
  const onPier = p.z > 234 && p.z < 252 && p.x > 30;
  let sea = Math.max(0, Math.min(1, 1 - (WATER_X - p.x) / 110));
  if (onPier) sea = Math.max(sea, 0.75);
  let n = 0;
  const L = (game.civilians && game.civilians.list) || [];
  for (const c of L) {
    if (!c.alive) continue;
    const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
    if (d < 26) n += 1 - d / 26;
  }
  const S = game.prolSet;
  if (S && S.below) for (const b of S.below) {
    const d = Math.hypot(b.x - p.x, b.z - p.z);
    if (d < 30) n += 0.7 * (1 - d / 30);
  }
  const crowd = Math.max(0.25, Math.min(1, n / 7));
  const city = Math.max(0.2, 1 - sea * 0.6);
  return { sea, crowd, city };
}
