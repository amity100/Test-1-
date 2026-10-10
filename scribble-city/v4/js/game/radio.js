import { Band, makeSong } from '../core/music.js';

// The car radio (ROADMAP 1.5): four stations, each with a sound of its own, on the air all the
// time (tune in and you join a station wherever it is), with DJs between the songs and silly ads
// for the city's shops, their words on the screen and in a voice of the radio's own (a burble of
// syllables through a small speaker). R, or the radio button, turns the dial (and off). Out of
// the car the radio goes on playing in it, muffled, fainter as you walk away.

const STATIONS = [
  {
    name: 'Ink FM 88.1', style: 'synth', pitch: 118,
    lines: [
      'You are tuned to Ink FM, the sound of the margins!',
      'It is {time} in Scribble City. {weather} over the bay.',
      'Traffic update: a giant pencil is blocking Palm Avenue. Again.',
      'That one goes out to everyone stuck on Bayview. Draw yourself a bike, folks!',
      'Ink FM. We never erase the classics.',
      'Somebody just drew a helicopter downtown. Please, do not do that.',
    ],
  },
  {
    name: 'Doodle Jazz 94.5', style: 'jazz', pitch: 196,
    lines: [
      'Good {part}, this is Doodle Jazz, smooth as a fresh page.',
      'It is {time}. {weather}. Pour yourself something warm.',
      'That was a little something in blue ink. Lovely.',
      'Doodle Jazz, where every note is drawn by hand.',
      'Coming up: more cool lines for the late hours.',
    ],
  },
  {
    name: 'Eraser Rock 101.3', style: 'rock', pitch: 104,
    lines: [
      'EraserRock! One oh one point three! Turn it UP!',
      'It is {time} and it is LOUD in Scribble City!',
      '{weather}? Who cares! Here comes another one!',
      'If your speakers are not shaking, you are doing it wrong.',
      'Rub out the boring stuff. Keep the riffs.',
    ],
  },
  {
    name: 'Margins Lo-Fi 106.7', style: 'lofi', pitch: 176,
    lines: [
      'Margins Lo-Fi. Beats to doodle and relax to.',
      'It is {time}. {weather}. Take it slow.',
      'Little notes in the margins. That is what we play.',
      'Stay in the lines, or do not. Your page.',
    ],
  },
];

// the ads (for the city's own shops and a few made-up things)
const ADS = [
  'Tired of mistakes? ERASE-O-MATIC rubs out anything! Not responsible for missing buildings.',
  'Sunny Pencils. Always sharp. Just like you.',
  'Bay Cafe: our coffee is so strong, it draws itself.',
  'Lonely? Draw Yourself a Friend, on the promenade! Every friend comes out different.',
  'PaperSnow correction fluid. Cover up your past. Ask about our tank rentals!',
  'TACOS 24 7. Because it is always taco o clock.',
  'Margin Motors: new cars, freshly inked! No eraser marks, guaranteed.',
  'Feeling sketchy? The Neon Bar. Happy hour, every hour.',
];

const WEATHER = {
  clear: 'Clear skies', cloudy: 'Clouds rolling in', drizzle: 'A little drizzle', rain: 'Rain on the windshield', storm: 'Thunder and lightning', fog: 'Morning fog',
};

// the vowels' two formants (Hz): what makes a syllable an "a" or an "o"
const VOWELS = { a: [800, 1250], e: [500, 1900], i: [320, 2300], o: [520, 920], u: [360, 820], y: [320, 2100] };
// how long a station's stretch is: a song (bars) or words
const SONG_BARS = 32;
const STORE = 'scribble-city-v4-radio';

export class Radio {
  constructor(game) {
    this.game = game;
    // the station it is on (-1: off)
    this.station = 0;
    try {
      const s = parseInt(localStorage.getItem(STORE), 10);
      if (s >= -1 && s < STATIONS.length) this.station = s;
    } catch (e) {
      // (no storage)
    }
    // the car it plays in, and the radio's own clock (the stations go on without you)
    this.car = null;
    this.clock = 0;
    this.ready = false;
    this.seg = null;
    this.label = null;
    this.labelT = 0;
    this.lineT = 0;
  }

  build() {
    const a = this.game.audio;
    const c = a.ctx;
    this.c = c;
    this.a = a;
    // the band and the voice play into the radio; then the car's speakers (or, outside it, the
    // muffled sound through its windows), from where the car is
    this.input = c.createGain();
    this.speaker = c.createBiquadFilter();
    this.speaker.type = 'lowpass';
    this.speaker.frequency.value = 9000;
    this.pan = c.createStereoPanner();
    this.vol = c.createGain();
    this.vol.gain.value = 0;
    this.input.connect(this.speaker).connect(this.pan).connect(this.vol).connect(a.master);
    this.band = new Band(c, this.input, a.noise);
    this.ready = true;
  }

  // ------------------------------------------------------------------ what is on the air
  // a station's day: songs, and words between them (a DJ, an ad, by turns). Stretch k of
  // station s, the same every time.
  stretch(s, k) {
    const st = STATIONS[s];
    if (k % 2 === 0) {
      const song = makeSong(st.style, s * 1000 + k / 2 + 1);
      return { kind: 'song', song, len: Band.length(song, SONG_BARS) };
    }
    const ad = (k >> 1) % 3 === 2;
    const n = ((k * 7 + s * 3) >> 1) % (ad ? ADS.length : st.lines.length);
    const text = ad ? ADS[n] : st.lines[n];
    return { kind: ad ? 'ad' : 'dj', text, len: 1.6 + text.length * 0.07 };
  }

  // where the station on the dial is at the radio's clock: the stretch, and how far into it
  // (followed along as the clock goes; worked out from the start only when the dial turns)
  at() {
    const s = this.station;
    // (each station started a little before the others: they do not change songs together)
    const u = Math.max(0, this.clock + s * 37);
    let w = this.where;
    if (!w || w.s !== s || u < w.start) w = this.where = { s, k: 0, start: 0, x: this.stretch(s, 0) };
    while (u >= w.start + w.x.len) {
      w.start += w.x.len;
      w.k++;
      w.x = this.stretch(s, w.k);
    }
    w.into = u - w.start;
    return w;
  }

  // ------------------------------------------------------------------ the dial
  next() {
    this.station = this.station + 1 >= STATIONS.length ? -1 : this.station + 1;
    try {
      localStorage.setItem(STORE, String(this.station));
    } catch (e) {
      // (no storage)
    }
    this.seg = null;
    if (this.ready) {
      this.band.stop();
      // (the click of the dial, a moment of static)
      this.static();
    }
    this.show();
  }

  show() {
    const game = this.game;
    const txt = this.station < 0 ? 'הרדיו כבוי' : `📻 ${STATIONS[this.station].name}`;
    game.hud.radio(txt, null);
    this.labelT = 3;
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const game = this.game;
    const a = game.audio;
    this.clock += dt;
    const p = game.player;
    const v = p.inVehicle;
    const inCar = !!(v && v.kind === 'car' && !v.dead);
    if (inCar && this.car !== v) {
      // into a car: its radio is on (on the station you had)
      this.car = v;
      this.seg = null;
      if (this.station >= 0) this.show();
    }
    if (!inCar && (this.labelT > 0 || this.lineT > 0)) {
      // (out of the car: its words are not on your screen any more)
      this.labelT = 0;
      this.lineT = 0;
      game.hud.radio(null);
    }
    if (this.labelT > 0) {
      this.labelT -= dt;
      if (this.labelT <= 0 && this.lineT <= 0) game.hud.radio(null);
    }
    if (this.lineT > 0) {
      this.lineT -= dt;
      if (this.lineT <= 0) game.hud.radio(null);
    }
    if (!a.ctx) return;
    if (!this.ready) this.build();
    const c = this.c;
    const now = c.currentTime;
    const car = this.car;
    let vol = 0;
    if (car && this.station >= 0 && !car.dead) {
      if (inCar) {
        vol = 0.5;
        this.speaker.frequency.setTargetAtTime(9000, now, 0.1);
        this.pan.pan.setTargetAtTime(0, now, 0.1);
      } else {
        // out of the car: through its windows, fainter as you go
        const cam = game.camera.position;
        const d = Math.hypot(car.pos.x - cam.x, car.pos.z - cam.z);
        vol = 0.32 * Math.max(0, 1 - d / 28);
        this.speaker.frequency.setTargetAtTime(750, now, 0.15);
        const f = game.camera.getWorldDirection(this._f || (this._f = cam.clone()));
        const fl = Math.hypot(f.x, f.z) || 1;
        const pan = d > 1 ? ((car.pos.x - cam.x) * (-f.z / fl) + (car.pos.z - cam.z) * (f.x / fl)) / d : 0;
        this.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan * 0.8)), now, 0.2);
        if (d > 40) {
          // (too far: the car keeps its radio on, nobody hears it)
          this.band.stop();
          this.seg = null;
        }
      }
    }
    this.level = vol;
    this.vol.gain.setTargetAtTime(game.state === 'play' ? vol : vol * 0.3, now, 0.25);
    if (vol <= 0 || game.state === 'paused') {
      if (vol <= 0) {
        this.band.stop();
        this.seg = null;
      }
      return;
    }
    // what the station is on now: a song (join it where it is), or words
    const w = this.at();
    if (!this.seg || this.seg.k !== w.k) {
      this.seg = { k: w.k };
      if (w.x.kind === 'song') {
        const spb = 60 / w.x.song.bpm / 4;
        this.band.play(w.x.song, now + 0.05, Math.floor(w.into / spb));
      } else {
        this.band.stop();
        // (joined halfway through somebody talking: only the end of it)
        if (w.into < 1) this.talk(w.x, now + 0.1);
      }
    }
    this.band.update(now);
  }

  // ------------------------------------------------------------------ words
  talk(x, t) {
    const game = this.game;
    const st = STATIONS[this.station];
    const text = this.fill(x.text);
    const dur = this.say(text, t, x.kind === 'ad' ? 150 : st.pitch);
    if (game.player.inVehicle) {
      game.hud.radio(x.kind === 'ad' ? `📻 ${text}` : `📻 ${st.name}: ${text}`, x.kind);
      this.lineT = dur + 1.2;
    }
  }

  fill(text) {
    const game = this.game;
    const dn = game.daynight;
    const h = dn ? dn.hour : 18.3;
    const hh = Math.floor(h) % 12 || 12;
    const mm = String(Math.floor((h % 1) * 60)).padStart(2, '0');
    const part = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
    const weather = WEATHER[game.weather ? game.weather.kind : 'clear'];
    return text.replace('{time}', `${hh}:${mm} ${h < 12 ? 'a.m.' : 'p.m.'}`).replace('{weather}', weather).replace('{part}', part);
  }

  // a voice of the radio's own: each syllable a buzz shaped into its vowel, the pitch rising and
  // falling with the sentence (returns how long it takes)
  say(text, t0, f0) {
    let t = t0;
    const words = text.split(/\s+/);
    let i = 0;
    for (const w of words) {
      const syl = w.toLowerCase().match(/[^aeiouy]*[aeiouy]+/g) || [w];
      for (const s of syl) {
        const v = VOWELS[(s.match(/[aeiouy]/) || ['a'])[0]];
        const dur = 0.085 + Math.min(0.06, s.length * 0.012);
        // (up a little through a sentence, down at its end, up at a question)
        const end = /[.!]$/.test(w) ? 0.85 : /\?$/.test(w) ? 1.2 : 1;
        const f = f0 * (1 + 0.08 * Math.sin(i * 1.7)) * (w === words[words.length - 1] ? end : 1);
        this.syllable(v, t, dur, f, /[A-Z]{3,}/.test(w) ? 1.4 : 1);
        t += dur;
        i++;
      }
      t += /[.!?,:]$/.test(w) ? 0.22 : 0.05;
    }
    return t - t0;
  }

  syllable(v, t, dur, f0, loud) {
    const c = this.c;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * 0.94, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * loud, t + 0.015);
    g.gain.setValueAtTime(0.16 * loud, t + dur - 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const F of v) {
      const b = c.createBiquadFilter();
      b.type = 'bandpass';
      b.frequency.value = F;
      b.Q.value = 7;
      o.connect(b).connect(g);
    }
    g.connect(this.input);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // between two stations: a breath of static
  static() {
    const c = this.c;
    const t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = this.a.noise;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2500;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    s.connect(f).connect(g).connect(this.input);
    s.start(t, (t * 0.13) % 0.9);
    s.stop(t + 0.4);
  }
}
