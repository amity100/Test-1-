// A little band in the computer (ROADMAP 1.5): drums, a bass, chords and a lead line, played
// step by step from a song's patterns and made on the spot like every other sound of the game
// (no sound files). The radio of the cars (game/radio.js) and the music out of the shops' doors
// (game/soundscape.js) play it.
//
// A style says how its songs go (tempo, swing, the drum patterns, which instruments); a song is
// a style, a key, a chord progression and a melody of its own, all from one number, so a song is
// the same song every time it comes round.

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// chord shapes over a root (semitones)
const SHAPES = {
  maj: [0, 4, 7], min: [0, 3, 7], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom7: [0, 4, 7, 10], pow: [0, 7, 12], sus: [0, 5, 7],
};

// patterns: 16 steps a bar (x hit, o open hat / accent, . rest)
export const STYLES = {
  // the city's own sound: synths and a steady beat, an arpeggio running over it
  synth: {
    bpm: [100, 114], swing: 0, keys: [45, 47, 48, 50],
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.',
    bass: 'x.x.x.x.x.x.x.xx', bassWave: 'sawtooth', bassCut: 700,
    chordWave: 'sawtooth', chordCut: 1600, chordHits: [0], chordLen: 3.6,
    lead: 'arp', leadWave: 'square', leadCut: 2400, leadVol: 0.035,
    progs: [[[0, 'min'], [8, 'maj'], [3, 'maj'], [10, 'maj']], [[0, 'min'], [5, 'min'], [8, 'maj'], [7, 'maj']], [[0, 'min'], [10, 'maj'], [8, 'maj'], [10, 'maj']]],
  },
  // a jazz trio after hours: brushes, a walking bass, chords on the off-beats, swung
  jazz: {
    bpm: [88, 104], swing: 0.16, keys: [48, 50, 53, 55],
    kick: 'x.......x.......', snare: '....s.......s...', hat: 'x..xx..xx..xx..x',
    bass: 'w...w...w...w...', bassWave: 'triangle', bassCut: 900,
    chordWave: 'triangle', chordCut: 2200, chordHits: [3, 10], chordLen: 0.7,
    lead: 'melody', leadWave: 'sine', leadCut: 3000, leadVol: 0.05,
    progs: [[[2, 'min7'], [7, 'dom7'], [0, 'maj7'], [9, 'min7']], [[0, 'maj7'], [9, 'min7'], [2, 'min7'], [7, 'dom7']], [[4, 'min7'], [9, 'dom7'], [2, 'min7'], [7, 'dom7']]],
  },
  // guitars (power chords) and a hard beat
  rock: {
    bpm: [124, 140], swing: 0, keys: [40, 43, 45],
    kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    bass: 'x.x.x.x.x.x.x.x.', bassWave: 'sawtooth', bassCut: 500,
    chordWave: 'square', chordCut: 1300, chordHits: [0, 3, 6, 8, 11, 14], chordLen: 0.4, chordShape: 'pow',
    lead: 'melody', leadWave: 'sawtooth', leadCut: 1800, leadVol: 0.03,
    progs: [[[0, 'pow'], [7, 'pow'], [9, 'pow'], [5, 'pow']], [[0, 'pow'], [10, 'pow'], [5, 'pow'], [0, 'pow']], [[0, 'pow'], [5, 'pow'], [7, 'pow'], [5, 'pow']]],
  },
  // slow, soft chords, a lazy beat and the crackle of the record
  lofi: {
    bpm: [76, 88], swing: 0.12, keys: [50, 52, 53, 57],
    kick: 'x......x..x.....', snare: '....x.......x...', hat: 'x.x.x.x.xxx.x.x.',
    bass: 'x......x..x.....', bassWave: 'sine', bassCut: 600,
    chordWave: 'triangle', chordCut: 1400, chordHits: [0, 7], chordLen: 1.6,
    lead: 'melody', leadWave: 'triangle', leadCut: 2000, leadVol: 0.04, crackle: true,
    progs: [[[5, 'maj7'], [4, 'min7'], [2, 'min7'], [0, 'maj7']], [[0, 'maj7'], [9, 'min7'], [2, 'min7'], [7, 'dom7']], [[2, 'min7'], [7, 'dom7'], [4, 'min7'], [9, 'min7']]],
  },
  // the club: four on the floor, open hats on the off-beats, an octave bass
  disco: {
    bpm: [118, 124], swing: 0, keys: [45, 48, 50],
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..o...o...o...o.',
    bass: 'x.X.x.X.x.X.x.X.', bassWave: 'sawtooth', bassCut: 800,
    chordWave: 'sawtooth', chordCut: 2000, chordHits: [2, 6, 10, 14], chordLen: 0.25,
    lead: 'arp', leadWave: 'triangle', leadCut: 3000, leadVol: 0.03,
    progs: [[[0, 'min7'], [5, 'min7'], [0, 'min7'], [7, 'min7']], [[0, 'min7'], [8, 'maj7'], [10, 'dom7'], [0, 'min7']]],
  },
};

// one song: from a style and a number (the same number, the same song)
export function makeSong(style, n) {
  const S = STYLES[style];
  let s = (n * 7919 + 13) % 2147483647 || 1;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const prog = S.progs[Math.floor(r() * S.progs.length)];
  const key = S.keys[Math.floor(r() * S.keys.length)];
  const bpm = Math.round(S.bpm[0] + r() * (S.bpm[1] - S.bpm[0]));
  // the melody: 32 steps of eighth notes over the chords (scale steps of a pentatonic, rests)
  const melody = [];
  let deg = 2;
  for (let i = 0; i < 32; i++) {
    if (r() < 0.38) {
      melody.push(null);
      continue;
    }
    deg = Math.max(0, Math.min(7, deg + Math.floor(r() * 5) - 2));
    melody.push(deg);
  }
  return { style, S, key, prog, bpm, melody, n };
}

const PENTA_MIN = [0, 3, 5, 7, 10, 12, 15, 17];
const PENTA_MAJ = [0, 2, 4, 7, 9, 12, 14, 16];

export class Band {
  // ctx: the AudioContext, out: where the band plays into, noise: a buffer of noise
  constructor(ctx, out, noise) {
    this.c = ctx;
    this.out = out;
    this.noise = noise;
    this.song = null;
    this.step = 0;
    this.next = 0;
  }

  // start a song at time t (from step 'from': join a song already going)
  play(song, t, from = 0) {
    this.song = song;
    this.step = Math.max(0, from);
    this.next = t;
  }

  stop() {
    this.song = null;
  }

  // a song's length in seconds, bars bars of it
  static length(song, bars) {
    return (bars * 16 * 60) / song.bpm / 4;
  }

  // schedule what is due in the next moment (call often: a few times a second at least)
  update(now) {
    const s = this.song;
    if (!s) return;
    const spb = 60 / s.bpm / 4;
    // (a long way behind, after a pause: catch up without playing it all at once)
    if (this.next < now - 0.5) {
      const skip = Math.ceil((now - this.next) / spb);
      this.next += skip * spb;
      this.step += skip;
    }
    while (this.next < now + 0.3) {
      const swing = this.step % 2 ? s.S.swing * spb : 0;
      this.tick(this.step, this.next + swing, spb);
      this.next += spb;
      this.step++;
    }
  }

  tick(i, t, spb) {
    const s = this.song;
    const S = s.S;
    const k = i % 16;
    const bar = Math.max(0, Math.floor(i / 16));
    const [deg, q] = s.prog[bar % s.prog.length];
    const root = s.key + deg;
    const shape = SHAPES[S.chordShape || q] || SHAPES[q];
    const minor = q === 'min' || q === 'min7';
    // the drums
    const kc = S.kick[k];
    if (kc !== '.') this.kick(t);
    const sc = S.snare[k];
    if (sc === 'x') this.snare(t, 0.16);
    else if (sc === 's') this.brush(t);
    const hc = S.hat[k];
    if (hc === 'x') this.hat(t, 0.035, 0.05);
    else if (hc === 'o') this.hat(t, 0.16, 0.05);
    if (S.crackle && (i * 7) % 5 === 0) this.crackle(t);
    // the bass
    const bc = S.bass[k];
    if (bc === 'w') {
      // walking: up through the chord, a step to the next one
      const walk = [0, shape[1], shape[2], shape[1] + 2];
      this.voice(S.bassWave, hz(root - 24 + walk[(k / 4) % 4]), t, spb * 3.6, 0.16, S.bassCut);
    } else if (bc !== '.') this.voice(S.bassWave, hz(root - 24 + (bc === 'X' ? 12 : 0)), t, spb * 1.7, 0.15, S.bassCut);
    // the chords
    if (S.chordHits.includes(k)) {
      const len = (S.chordLen * 60) / s.bpm;
      for (const n of shape) {
        this.voice(S.chordWave, hz(root + n), t, len, 0.035, S.chordCut);
        // (two voices a little apart: a fuller sound)
        if (S.chordWave === 'sawtooth') this.voice(S.chordWave, hz(root + n) * 1.006, t, len, 0.02, S.chordCut);
      }
    }
    // the lead: an arpeggio up the chord, or the song's own melody (every other bar)
    if (k % 2 === 0) {
      if (S.lead === 'arp') {
        const n = shape[(k / 2) % shape.length] + 12 * (1 + ((k >> 3) & 1));
        this.voice(S.leadWave, hz(root + n), t, spb * 1.6, S.leadVol, S.leadCut);
      } else if (bar % 4 >= 2) {
        // (two bars of melody in every four, the next four bars its second half)
        const d = s.melody[(((bar >> 2) & 1) * 16 + ((bar % 4) - 2) * 8 + k / 2) % 32];
        if (d !== null && d !== undefined) {
          const sc = minor ? PENTA_MIN : PENTA_MAJ;
          this.voice(S.leadWave, hz(s.key + 12 + sc[d]), t, spb * 2.6, S.leadVol, S.leadCut);
        }
      }
    }
  }

  voice(type, f, t, dur, vol, cut) {
    const c = this.c;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cut, t);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.setTargetAtTime(vol * 0.6, t + 0.04, dur * 0.3);
    g.gain.setTargetAtTime(0.0001, t + dur * 0.85, 0.05);
    o.connect(lp).connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.3);
  }

  kick(t) {
    const c = this.c;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.25);
  }

  hiss(t, dur, vol, type, freq, q = 1) {
    const c = this.c;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.out);
    s.start(t, (t * 0.37) % 0.9);
    s.stop(t + dur + 0.05);
  }

  snare(t, vol) {
    this.hiss(t, 0.13, vol, 'bandpass', 1900, 0.8);
    this.voice('triangle', 190, t, 0.06, vol * 0.5, 2000);
  }

  brush(t) {
    this.hiss(t, 0.18, 0.05, 'bandpass', 3200, 0.6);
  }

  hat(t, dur, vol) {
    this.hiss(t, dur, vol, 'highpass', 7200, 0.7);
  }

  crackle(t) {
    this.hiss(t + 0.03, 0.012, 0.03, 'highpass', 5000, 0.5);
  }
}
