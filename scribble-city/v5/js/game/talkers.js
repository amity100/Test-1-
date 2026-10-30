import { folkLook } from './looks.js';
import { FOLK_ON } from '../render/folkspec.js';

// (v5, ROADMAP 13.8) People who talk: a few of the city's people standing together on the sidewalk near
// where you come into the city, in the middle of a conversation - each line said aloud in their own
// voice (the browser's: game/voices.js speak), its mouth read off it sound by sound and its feeling on
// their face (render/people.js faceOf), in a bubble and in the subtitles; the others turn to whoever
// is talking. Come up to them and they turn to you.
//
// A line: [who (their number in the group; -1: whoever is nearest you), what - '[joy] ...' says how
// they feel saying it: joy, surprised, angry, sad, scared].
const SCENES = [
  [
    [0, '[joy] Mei! Lena! You came. I saved you the good table.'],
    [1, '[surprised] The good table? Bruno, it is on the sidewalk.'],
    [0, 'Ah, but it has the best view of the whole bay.'],
    [2, '[joy] And of the seagulls stealing your bread.'],
    [0, '[angry] Those birds are criminals. Every one of them!'],
    [1, '[joy] Maybe somebody should draw them a bakery.'],
    [2, '[surprised] Wait... is that the one who draws things that come alive?'],
  ],
  [
    [2, 'Did you hear the music from the old pier last night?'],
    [0, '[sad] I heard it. Until three in the morning.'],
    [1, '[joy] Bruno, you were dancing. I have the photos.'],
    [0, '[surprised] Photos? Mei, we agreed. No photos!'],
    [2, '[joy] Too late. Half the city has seen them.'],
    [0, '[sad] My reputation. Thirty years of serious pasta.'],
  ],
  [
    [1, 'I am designing a bridge you can fold up like paper.'],
    [0, '[surprised] A paper bridge? Over the bay?'],
    [1, '[joy] Not paper. Ink. The kind that comes alive.'],
    [2, '[scared] Please tell me it does not come alive in the rain.'],
    [1, '[sad] ...I will add an umbrella to the drawing.'],
  ],
];
// (to you, when you come up to them)
const TO_YOU = [
  '[joy] Hey! You are the artist, right? Draw me a seagull net!',
  '[surprised] Is it true you drew a helicopter last night?',
  'Careful. Bruno will have you paint his whole trattoria.',
  '[joy] Come by the trattoria later. First coffee is on me.',
];

export class Talkers {
  constructor(game) {
    this.game = game;
    this.group = null;
    this.started = false;
    this.scene = 0;
    this.i = 0;
    this.t = 0;
    this.youT = 0;
    this.saidToYou = 0;
    this.cur = null;
    this.curFig = null;
    this.lineEnd = 0;
    this.centre = { x: 0, z: 0 };
  }

  // the group, a few steps ahead of you on your side of the street
  startNear(x, z, yaw) {
    const g = this.game;
    const civ = g.civilians;
    if (!civ || g.classic || FOLK_ON.n < 6) return false;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const cx = x + fx * 6.5 + fz * 1.6;
    const cz = z + fz * 6.5 - fx * 1.6;
    this.centre = { x: cx, z: cz };
    // (Bruno, Mei, Lena - render/folkspec.js FOLK), round the middle of the group, facing it
    const who = [0, 3, 5];
    this.group = who.map((k, n) => {
      const a = (n / who.length) * Math.PI * 2 + 0.4;
      const px = cx + Math.sin(a) * 0.8;
      const pz = cz + Math.cos(a) * 0.8;
      const c = civ.spawnScripted(px, pz, folkLook(k), this);
      c.voiced = true;
      c.yaw = Math.atan2(cx - px, cz - pz);
      c.faceYaw = c.yaw;
      c.ctrl = () => null;
      return c;
    });
    this.started = true;
    this.t = 1.2;
    this.i = 0;
    return true;
  }

  // somebody of the group still there to talk
  alive() {
    return this.group && this.group.every((c) => c.alive && !c.gone && !(c.panicT > 0) && c.dying < 0);
  }

  update(dt) {
    const g = this.game;
    if (!this.started) {
      // (the first time you are in the city)
      if (g.state === 'play' && g.player && !g.classic && g.civilians) this.startNear(g.player.pos.x, g.player.pos.z, g.camRig ? g.camRig.yaw : 0);
      return;
    }
    if (!this.group) return;
    if (!this.alive()) {
      // (scattered - by a fight, a car, a shot: they are the city's again)
      for (const c of this.group) if (c.alive && !c.gone) g.civilians.release(c);
      this.group = null;
      return;
    }
    // (the last line still being said: the voice, or the mouth when there is none)
    const speaking = !!(this.cur && !this.cur.done && this.cur === this.curFig.say) && g.time < this.lineEnd;
    const p = g.player.pos;
    const near = this.group.reduce((a, c) => Math.min(a, Math.hypot(c.pos.x - p.x, c.pos.z - p.z)), 99);
    // (you came up to them: the nearest turns to you and says something, now and then)
    this.youT -= dt;
    if (near < 3.2 && this.youT <= 0 && !speaking && this.t > 0.4) {
      let best = this.group[0];
      for (const c of this.group) if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < Math.hypot(best.pos.x - p.x, best.pos.z - p.z)) best = c;
      best.faceYaw = Math.atan2(p.x - best.pos.x, p.z - best.pos.z);
      this.line(best, TO_YOU[this.saidToYou++ % TO_YOU.length], true);
      this.youT = 9;
      this.t = Math.max(this.t, 3.5);
      return;
    }
    if (near > 6) for (let n = 0; n < this.group.length; n++) {
      const c = this.group[n];
      c.faceYaw = Math.atan2(this.centre.x - c.pos.x, this.centre.z - c.pos.z);
    }
    this.t -= dt;
    if (this.t > 0 || speaking) return;
    const sc = SCENES[this.scene % SCENES.length];
    if (this.i >= sc.length) {
      // (a pause, then the next of what they talk about)
      this.scene++;
      this.i = 0;
      this.t = 4 + Math.random() * 3;
      for (const c of this.group) c.fig.lookAt = null;
      return;
    }
    const [k, text] = sc[this.i++];
    this.line(this.group[k], text, false);
  }

  // a line said: the others look at whoever says it
  line(who, text, toYou) {
    const g = this.game;
    for (const c of this.group) c.fig.lookAt = c === who ? null : who.fig.j.headC;
    if (toYou) g.voices.sayToYou(who, text);
    else g.voices.say(who, text);
    this.cur = who.fig.say || null;
    this.curFig = who.fig;
    // (however it goes, not longer than this)
    this.lineEnd = g.time + text.length / 8 + 3;
    // (long enough to say it, and a breath)
    const words = text.replace(/^\[\w+\]\s*/, '');
    this.t = Math.max(1.6, words.length / 13) + 0.45;
  }
}
