import * as THREE from 'three';
import { PIER, PROM_X1, NORTH_EDGE, SOUTH_EDGE } from '../world/layout.js';

// What people say (ROADMAP 3.8). Short lines, and the answers to them:
//   friends         walking together, at a café table, on a bench, in the line outside the club,
//                   on the corner: one says something and the other answers (the hour and the
//                   weather have their own things to say)
//   strangers       passing on the sidewalk, a "Morning!" and a "Morning!" back; now and then one
//                   stops the other to ask the time (the city's own clock) or the way (and is
//                   shown it: the arm out towards the park, the market, the pier...)
//   to you          walk into somebody and you hear about it; stand too close for too long and
//                   they ask what you want; point a gun at somebody and their hands go up (keep
//                   it on them and they run); drive at them and they shout
// Every line said in the city (game.bubbles.say) also comes by here: spoken aloud by the
// browser's own voice when that is asked for in the settings (one at a time, a voice for each
// person, nearer is louder), and as a subtitle when the subtitles are on (whatever is spoken near
// you; without the voice, what is said to you by somebody you can't see).
// (?classic: none of it)

const pick = (a) => a[Math.floor(Math.random() * a.length)];

// two friends: a line, the answer (now and then a third)
const CHAT = [
  ['Did you see the game last night?', "Don't remind me."],
  ['I love this weather.', 'Finally, right?'],
  ['Where do you want to eat?', 'Tacos?', 'Tacos.'],
  ["How's work?", 'Busy. You?', 'Same.'],
  ['Is that a new jacket?', 'You noticed!'],
  ['We should go to the beach.', 'This weekend!'],
  ["My phone's almost dead.", 'Mine too.'],
  ['Coffee?', 'Always.'],
  ['Did you hear about Dana?', 'No! What happened?', "I'll tell you later."],
  ['I need a vacation.', 'We live by the beach!'],
  ['Remind me to call my mom.', 'Call your mom.'],
  ['Have you tried the new place?', 'The burger one? So good.'],
  ['I think I left the oven on.', 'You always say that.'],
  ['Look at that sky.', 'Like a painting.'],
  ['Are we still on for Friday?', 'Of course!'],
  ['I started running again.', 'Since when?', 'Since yesterday.'],
];
const CHAT_RAIN = [
  ["It's pouring!", "Should've brought an umbrella."],
  ['Look at this rain!', "It'll pass."],
  ['My shoes are soaked.', 'Mine too.'],
];
const CHAT_NIGHT = [
  ["It's getting late.", 'One more stop?'],
  ['Look at the lights.', 'Never gets old.'],
  ["I'm starving.", 'Pizza?', 'Pizza.'],
];
const CHAT_MORNING = [
  ['Coffee first.', 'Coffee first.'],
  ['Too early for this.', 'Way too early.'],
  ['Did you sleep?', 'Not really.'],
];
// young people on the corner
const YOUTH = [
  ['Yo, you see that ride?', 'Clean.', 'Mine is cleaner.'],
  ['What we doing tonight?', 'Same as always.'],
  ['This beat is fire.', 'Turn it up!'],
  ['You hear about the party?', "Who's going?", 'Everybody.'],
  ['Got any gum?', 'Nope.'],
  ['Ha! Did you see his face?', 'Priceless.'],
];
// in the line outside the club
const QUEUE = [
  ['How long is this line?', 'Forever.'],
  ['I hope they let us in.', "We're on the list."],
  ["Who's playing tonight?", 'DJ Scribble!'],
  ['These shoes are killing me.', 'Almost there.'],
  ['Is it always this busy?', 'Every Friday.'],
];
// in the line outside the cinema
const CINEMA = [
  ['Is it any good?', "I heard it's scary!"],
  ['Did you get the popcorn?', 'Large. Obviously.'],
  ["Who's in it?", 'No idea. Looks fun though.'],
  ['Two hours long!', 'Bring tissues.'],
];
// a child and the parent holding the hand
const KID = [
  ['Are we there yet?', 'Almost, sweetie.'],
  ['Can I have an ice cream?', 'After lunch.'],
  ['Look, a pigeon!', 'I see it!'],
  ['Carry me!', 'Just a little longer.'],
  ['Why is the sky blue?', 'Good question...'],
  ["I'm hungry.", "We'll eat soon."],
];
// strangers passing each other
const GREET = {
  morning: [['Morning!', 'Morning!'], ['Good morning!', 'Hi there!'], ['Morning!', 'Hey, good morning.']],
  day: [['Hi!', 'Hey!'], ['Afternoon!', 'Hi!'], ['Hey there!', 'Hello!']],
  evening: [['Evening!', 'Evening!'], ['Hey!', 'Hi!'], ['Good evening.', 'Evening.']],
  night: [['Hey.', 'Hey.'], ['Night.', 'Night.']],
};
const ASK_TIME = ['Excuse me, got the time?', 'Sorry, what time is it?', 'Do you have the time?'];
const THANKS = ['Thanks!', 'Thank you!', 'Great, thanks!'];
const LATE = ["Oh no, I'm late!", 'Thanks! Gotta run.'];
const NUMBERS = ['', 'one', 'two', 'three', 'four', 'five'];
// to you
const BUMP = ['Hey, watch it!', 'Excuse me!', 'Ow!', 'Careful!', "Look where you're going!", 'Sorry!'];
const LINGER = ['Can I help you?', 'Uh... hi?', 'Do I know you?', 'Personal space, please.', 'Nice pencil.'];
const AIMED = ['Whoa, whoa! Easy!', "Don't shoot!", "I don't want any trouble!", 'Put that down!'];
const AIM_GONE = ['Phew...', 'Crazy...', 'What was that about?'];
const SLOW = ['Slow down!', 'Hey! Watch the road!', 'Are you crazy?!', 'This is a sidewalk!'];

// (the names a browser gives its voices: whose is whose, roughly)
const FEM_VOICE = /female|zira|samantha|victoria|karen|moira|tessa|fiona|susan|hazel|serena|allison|ava|kate|libby|sonia|jenny|aria|emma|amy|joanna|salli|kimberly/i;
const MALE_VOICE = /\bmale|david|mark|daniel|alex|fred|tom\b|george|ryan|guy|james|oliver|arthur|brian|matthew|joey|justin/i;

const _f = new THREE.Vector3();

export class Voices {
  constructor(game) {
    this.game = game;
    this.talks = [];
    this.pairT = 3;
    this.quietT = 4;
    this.youT = 0;
    this.slowT = 0;
    this.aimed = null;
    this.aimT = 0;
    this.linger = null;
    this.lingerT = 0;
    this.places = null;
    // the browser's voice (the settings: off unless asked for), and the subtitles of what people
    // say (with the radio's)
    this.spoken = false;
    this.voiceList = null;
    this.lastTone = 'plain';
    this.subs = [];
    this.direct = false;
    // (counted for the tests)
    this.stats = { talks: 0, lines: 0, heard: 0, spoken: 0, subs: 0, greets: 0, times: 0, ways: 0, bumps: 0, lingers: 0, aimed: 0, slow: 0 };
    // every line said in the city comes by here
    if (!game.classic) game.bubbles.onSay = (who, text, tone) => this.heard(who, text, tone);
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const game = this.game;
    if (game.classic) return;
    // the lines being said, each after the other
    for (const ex of this.talks) this.step(ex, dt);
    if (this.talks.some((ex) => ex.done)) this.talks = this.talks.filter((ex) => !ex.done);
    if (game.inBar) return;
    // strangers passing each other
    this.quietT -= dt;
    this.pairT -= dt;
    if (this.pairT <= 0) {
      this.pairT = 0.8;
      if (this.quietT <= 0) this.pairUp();
    }
    // what they say to you
    this.slowT -= dt;
    this.youT -= dt;
    if (this.youT <= 0) {
      this.youT = 0.2;
      this.toYou(0.2);
    }
    // subtitles fade
    if (this.subs.length) this.subsTick(dt);
  }

  // ------------------------------------------------------------------ a few lines between people
  // people: two or three (or one, to you); lines: strings, or functions (who, ex) giving one.
  // opts.stand: they stop and turn to each other (or to opts.face) while it lasts; opts.stay: a
  // function, held on after the last line while it is true; opts.after: the line said then;
  // opts.arms: hands up while it lasts
  talk(people, lines, opts = {}) {
    for (const c of people) if (!this.free(c, opts.stand)) return null;
    const ex = { who: people, lines, i: 0, t: opts.delay || 0.15, stand: !!opts.stand, held: [], tone: opts.tone || 'plain', stay: opts.stay || null, after: opts.after || null, arms: !!opts.arms, hands: !!opts.arms, face: opts.face || null, direct: !!opts.direct, look: null, pointer: null, pointAt: null, pointT: 0, done: false };
    for (const c of people) c.convo = ex;
    if (ex.stand) {
      for (let k = 0; k < people.length; k++) this.hold(ex, people[k], ex.face || people[(k + 1) % people.length]);
    }
    this.talks.push(ex);
    this.stats.talks++;
    return ex;
  }

  // free to talk (and to stop and stand, if asked)
  free(c, stand) {
    if (!c || !c.alive || c.gone || c.dying >= 0 || c.panicT > 0 || c.inside || c.convo || c.headless) return false;
    if (stand && (c.ctrl || c.scripted || c.owner || c.buddy || c.buddyOf || c.dog || c.crossing || c.photo || c.exitRoom)) return false;
    return true;
  }

  // stopped, turned to the other one (or that way, while showing the way)
  hold(ex, c, other) {
    const ctrl = (me) => {
      const tx = ex.look && ex.look.c === me ? ex.look.x : other.pos.x;
      const tz = ex.look && ex.look.c === me ? ex.look.z : other.pos.z;
      me.faceYaw = Math.atan2(tx - me.pos.x, tz - me.pos.z);
      if (ex.arms) me.fig.armsUp = 1;
      return null;
    };
    c.ctrl = ctrl;
    ex.held.push([c, ctrl]);
  }

  step(ex, dt) {
    if (ex.done) return;
    // broken off: somebody fell, ran, was taken by something else
    for (const c of ex.who) {
      if (!c.alive || c.gone || c.dying >= 0 || c.panicT > 0 || c.headless) return this.end(ex);
    }
    for (const [c, f] of ex.held) if (c.ctrl !== f) return this.end(ex);
    // the arm out showing the way, for a while
    if (ex.pointer) {
      ex.pointT -= dt;
      if (ex.pointT <= 0) {
        if (ex.pointer.fig.reachR === ex.pointAt) ex.pointer.fig.reachR = null;
        ex.pointer = null;
        ex.look = null;
      }
    }
    ex.t -= dt;
    if (ex.t > 0) return;
    if (ex.i >= ex.lines.length) {
      if (ex.stay && ex.stay()) {
        ex.t = 0.2;
        return;
      }
      if (ex.after) {
        const who = ex.who[0];
        if (ex.direct) this.sayToYou(who, ex.after, 'plain');
        else this.say(who, ex.after, 'plain');
        ex.after = null;
        ex.stay = null;
        ex.arms = false;
        who.fig.armsUp = 0;
        ex.t = 0.9;
        return;
      }
      return this.end(ex);
    }
    const who = ex.who[ex.i % ex.who.length];
    let text = ex.lines[ex.i];
    if (typeof text === 'function') text = text(who, ex);
    ex.i++;
    if (!text) {
      ex.t = 0.3;
      return;
    }
    this.direct = ex.direct;
    const life = this.say(who, text, ex.tone);
    this.direct = false;
    ex.t = life + 0.3 + Math.random() * 0.4;
  }

  // a line in a bubble, long enough to read (how long it stays)
  say(who, text, tone = 'plain') {
    const life = Math.min(3.4, 1.3 + text.length * 0.045);
    this.game.bubbles.say(who, text, tone, life);
    this.stats.lines++;
    return life;
  }

  // a line said to you
  sayToYou(who, text, tone = 'plain') {
    this.direct = true;
    this.say(who, text, tone);
    this.direct = false;
  }

  end(ex) {
    if (ex.done) return;
    ex.done = true;
    for (const [c, f] of ex.held) {
      if (c.ctrl === f) {
        c.ctrl = null;
        c.faceYaw = null;
      }
    }
    if (ex.hands) for (const c of ex.who) c.fig.armsUp = 0;
    if (ex.pointer && ex.pointer.fig.reachR === ex.pointAt) ex.pointer.fig.reachR = null;
    for (const c of ex.who) if (c.convo === ex) c.convo = null;
  }

  // ------------------------------------------------------------------ friends talking
  // (for the other systems: the friends walking together, at a table, the line, the corner)
  chat(people, kind = 'chat') {
    if (this.game.classic) return null;
    const set = kind === 'youth' ? YOUTH : kind === 'queue' ? QUEUE : kind === 'cinema' ? CINEMA : kind === 'kid' ? KID : this.chatSet();
    return this.talk(people, pick(set));
  }

  chatSet() {
    const g = this.game;
    const rain = g.weather && g.weather.cur ? g.weather.cur.rain || 0 : 0;
    const h = g.daynight ? g.daynight.hour : 12;
    if (rain > 0.3 && Math.random() < 0.6) return CHAT_RAIN;
    if ((h > 21 || h < 4) && Math.random() < 0.45) return CHAT_NIGHT;
    if (h > 5.5 && h < 10 && Math.random() < 0.4) return CHAT_MORNING;
    return CHAT;
  }

  // ------------------------------------------------------------------ strangers
  pairUp() {
    const game = this.game;
    if (this.talks.length >= 4) return;
    const civs = game.civilians;
    const p = game.player.pos;
    const near = [];
    for (const c of civs.list) {
      if (c.convo || (c.talkedT || 0) > game.time || !civs.plain(c)) continue;
      if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < 18) near.push(c);
    }
    for (let i = 0; i < near.length; i++) {
      for (let j = i + 1; j < near.length; j++) {
        const a = near[i];
        const b = near[j];
        const d = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
        if (d > 2.6 || d < 0.5) continue;
        // walking past each other, the opposite ways
        if (a.vel.x * b.vel.x + a.vel.z * b.vel.z > -0.3) continue;
        a.talkedT = game.time + 45;
        b.talkedT = game.time + 45;
        const tourist = a.fig.look.role === 'tourist' ? a : b.fig.look.role === 'tourist' ? b : null;
        const r = Math.random();
        if (tourist && r < 0.6) this.askWay(tourist, tourist === a ? b : a);
        else if (r < 0.08) this.askWay(a, b);
        else if (r < 0.2) this.askTime(a, b);
        else if (r < 0.75) this.greet(a, b);
        this.quietT = 3 + Math.random() * 4;
        return;
      }
    }
  }

  greet(a, b) {
    const h = this.game.daynight ? this.game.daynight.hour : 12;
    const set = h >= 5 && h < 12 ? GREET.morning : h >= 12 && h < 18 ? GREET.day : h >= 18 && h < 23 ? GREET.evening : GREET.night;
    if (this.talk([a, b], pick(set))) this.stats.greets++;
  }

  askTime(a, b) {
    const lines = [pick(ASK_TIME), () => this.timeLine(), Math.random() < 0.2 ? pick(LATE) : pick(THANKS)];
    if (this.talk([a, b], lines, { stand: true })) this.stats.times++;
  }

  // the city's clock, as somebody would say it
  timeLine() {
    const h = this.game.daynight ? this.game.daynight.hour : 12;
    const m = Math.floor(h * 60) % 1440;
    const hh = Math.floor(m / 60) % 12 || 12;
    const mm = m % 60;
    if (mm === 0) return `It's ${hh} o'clock.`;
    return `It's ${hh}:${String(mm).padStart(2, '0')}.`;
  }

  // where people ask the way to
  get placeList() {
    if (this.places) return this.places;
    const w = this.game.world;
    const L = [];
    const mid = (a) => ({ x: (a.x0 + a.x1) / 2, z: (a.z0 + a.z1) / 2 });
    for (const pk of w.parks || []) L.push({ q: 'Excuse me, which way to the park?', x: pk.cx, z: pk.cz });
    const mk = (w.alleys || []).find((a) => a.type === 'market');
    if (mk) L.push({ q: 'Excuse me, where is the market?', ...mid(mk) });
    const tw = (w.alleys || []).find((a) => a.type === 'towers');
    if (tw) L.push({ q: 'Excuse me, which way is downtown?', ...mid(tw) });
    L.push({ q: 'Excuse me, how do I get to the pier?', x: PIER.x0 + 6, z: (PIER.z0 + PIER.z1) / 2 });
    // (the promenade: straight towards the bay from wherever you are)
    L.push({ q: 'Excuse me, which way to the promenade?', x: PROM_X1 - 4, z: null });
    this.places = L;
    return L;
  }

  askWay(a, b) {
    const far = this.placeList.filter((pl) => {
      const z = pl.z === null ? a.pos.z : pl.z;
      return Math.hypot(pl.x - a.pos.x, z - a.pos.z) > 70;
    });
    if (!far.length) return this.greet(a, b);
    const pl = pick(far);
    const place = { x: pl.x, z: pl.z === null ? Math.max(NORTH_EDGE + 10, Math.min(SOUTH_EDGE - 10, b.pos.z)) : pl.z };
    if (this.talk([a, b], [pl.q, (who, ex) => this.wayLine(who, place, ex), pick(THANKS)], { stand: true })) this.stats.ways++;
  }

  // the answer, and the arm out that way (turned that way while showing it)
  wayLine(who, place, ex) {
    const dx = place.x - who.pos.x;
    const dz = place.z - who.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const s = who.fig.scale || 1;
    ex.pointAt = new THREE.Vector3(who.pos.x + (dx / d) * 1.5, who.pos.y + 1.5 * s, who.pos.z + (dz / d) * 1.5);
    who.fig.reachR = ex.pointAt;
    ex.pointer = who;
    ex.pointT = 2.8;
    ex.look = { c: who, x: who.pos.x + dx / d, z: who.pos.z + dz / d };
    if (d < 70) return pick(["It's right over there!", 'Just there, look!']);
    const blocks = Math.max(1, Math.round(d / 110));
    if (blocks === 1) return 'That way, one block.';
    if (blocks <= 5) return `That way, about ${NUMBERS[blocks]} blocks.`;
    return pick(["That way. It's a long walk!", 'Way over there. Take a cab!']);
  }

  // ------------------------------------------------------------------ to you
  toYou(dt) {
    const game = this.game;
    const pl = game.player;
    if (pl.inVehicle || pl.mode !== 'foot') {
      this.aimed = null;
      this.linger = null;
      return;
    }
    const p = pl.pos;
    const civs = game.civilians;
    // a gun pointed at somebody: hands up; kept on them, they run
    this.aimAt(dt);
    const moving = pl.fig.speed > 1.2;
    const still = pl.fig.speed < 0.3;
    const fwd = game.camera.getWorldDirection(_f);
    let close = null;
    let cd = 1.6;
    for (const c of civs.list) {
      if (!c.alive || c.dying >= 0 || c.panicT > 0 || c.inside || c.headless) continue;
      const dx = c.pos.x - p.x;
      const dz = c.pos.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 2) continue;
      // walked into
      if (d < 0.75 && moving && (c.bumpT || 0) < game.time && !c.convo) {
        c.bumpT = game.time + 6;
        if (!c.scripted && !c.ctrl) c.dodgeV.set((dx / (d || 1)) * 2.2, 0, (dz / (d || 1)) * 2.2);
        if (c.brave || c.fig.look.role === 'cop') continue;
        this.sayToYou(c, pick(BUMP), 'plain');
        this.stats.bumps++;
        continue;
      }
      // right by them, looking at them
      if (still && d < cd && (dx * fwd.x + dz * fwd.z) / (d || 1) > 0.6) {
        close = c;
        cd = d;
      }
    }
    if (close && close === this.linger) {
      this.lingerT += dt;
      if (this.lingerT > 2.5 && (close.lingeredT || 0) < game.time && !close.convo) {
        close.lingeredT = game.time + 25;
        this.stats.lingers++;
        // (somebody walking stops, turns to you, says it, and goes on)
        if (!this.talk([close], [pick(LINGER)], { stand: true, face: pl, delay: 0.1, direct: true })) this.sayToYou(close, pick(LINGER));
      }
    } else {
      this.linger = close;
      this.lingerT = 0;
    }
  }

  aimAt(dt) {
    const game = this.game;
    const w = game.weapons;
    if (!w || !w.isAiming()) {
      this.aimed = null;
      return;
    }
    const cam = game.camera;
    const o = cam.position;
    const f = cam.getWorldDirection(_f);
    let best = null;
    let bd = 0.75;
    for (const c of game.civilians.list) {
      if (!c.alive || c.dying >= 0 || c.inside || c.panicT > 0 || c.brave || c.headless) continue;
      const dx = c.pos.x - o.x;
      const dy = c.pos.y + 1.2 - o.y;
      const dz = c.pos.z - o.z;
      const t = dx * f.x + dy * f.y + dz * f.z;
      if (t < 1 || t > 20) continue;
      const off = Math.hypot(dx - f.x * t, dy - f.y * t, dz - f.z * t);
      if (off < bd) {
        bd = off;
        best = c;
      }
    }
    if (!best) {
      this.aimed = null;
      return;
    }
    best.aimedAt = game.time;
    if (this.aimed !== best) {
      this.aimed = best;
      this.aimT = 0;
    }
    this.aimT += dt;
    if (this.aimT > 3.5) {
      // enough: they run
      best.panicT = 6 + Math.random() * 2;
      best.fearX = game.player.pos.x;
      best.fearZ = game.player.pos.z;
      this.aimed = null;
      return;
    }
    if (best.convo && best.convo.arms) return;
    if (best.convo) this.end(best.convo);
    const c = best;
    const ex = this.talk([c], [pick(AIMED)], { stand: this.free(c, true), face: game.player, arms: true, tone: 'alarm', delay: 0.05, stay: () => game.time - (c.aimedAt || 0) < 1.2, after: pick(AIM_GONE), direct: true });
    if (ex) {
      this.stats.aimed++;
      // (somebody busy with something, held by their own scene: the hands go up all the same)
      if (!ex.stand) c.fig.armsUp = 1;
    }
  }

  // a car coming at people on the sidewalk (Civilians.dodge)
  dodged(c) {
    if (this.game.classic || this.slowT > 0 || !c.alive) return;
    const cam = this.game.camera.position;
    if (Math.hypot(c.pos.x - cam.x, c.pos.z - cam.z) > 30) return;
    this.slowT = 3.5;
    this.sayToYou(c, pick(SLOW), 'alarm');
    this.stats.slow++;
  }

  // ------------------------------------------------------------------ heard: spoken, subtitled
  heard(who, text, tone) {
    if (!who || !who.pos || !text) return;
    this.stats.heard++;
    const cam = this.game.camera.position;
    const d = Math.hypot(who.pos.x - cam.x, who.pos.z - cam.z);
    if (this.spoken) this.speak(who, text, tone, d);
    // a subtitle: whatever is spoken near you; without the voice, what is said to you by
    // somebody you can't see
    const hud = this.game.hud;
    if (!hud || hud.subtitles === false || d > 16) return;
    let behind = false;
    if (d < 10 && this.direct) {
      const f = this.game.camera.getWorldDirection(_f);
      behind = ((who.pos.x - cam.x) * f.x + (who.pos.z - cam.z) * f.z) / (d || 1) < 0.35;
    }
    if (!(this.spoken && d < 18) && !behind) return;
    this.subtitle(text);
  }

  subtitle(text) {
    const el = this.subsEl || (this.subsEl = document.getElementById('subs'));
    if (!el) return;
    this.subs.push({ text, t: Math.min(3.6, 1.6 + text.length * 0.05) });
    while (this.subs.length > 2) this.subs.shift();
    this.subsShow();
    this.stats.subs++;
  }

  subsTick(dt) {
    let gone = false;
    for (const s of this.subs) {
      s.t -= dt;
      if (s.t <= 0) gone = true;
    }
    if (gone) {
      this.subs = this.subs.filter((s) => s.t > 0);
      this.subsShow();
    }
  }

  subsShow() {
    const el = this.subsEl;
    if (!el) return;
    if (!this.subs.length) {
      el.classList.add('hidden');
      return;
    }
    el.textContent = '';
    for (const s of this.subs) {
      const line = document.createElement('div');
      line.textContent = `“${s.text}”`;
      el.appendChild(line);
    }
    el.classList.remove('hidden');
  }

  // the browser's own voice (the settings): on or off
  setSpoken(on) {
    const S = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.spoken = !!on && !!S && !this.game.classic;
    if (!this.spoken) this.hush();
    else if (S && !this.voiceHooked) {
      this.voiceHooked = true;
      const again = () => {
        this.voiceList = null;
      };
      if (S.addEventListener) S.addEventListener('voiceschanged', again);
      else S.onvoiceschanged = again;
    }
  }

  // quiet now (the pause, the sound off)
  hush() {
    const S = typeof window !== 'undefined' ? window.speechSynthesis : null;
    if (S && (S.speaking || S.pending)) S.cancel();
  }

  speak(who, text, tone, d) {
    const S = window.speechSynthesis;
    const audio = this.game.audio;
    if (!S || !audio.enabled || this.game.state !== 'play') return;
    const fx = audio.vol ? audio.vol.fx : 1;
    if (fx < 0.02 || d > 18) return;
    const words = text.replace(/[♪♫*]/g, '').trim();
    if (!/[a-z]/i.test(words)) return;
    // one at a time: a shout cuts in, anything else waits for quiet or is let go
    if (S.speaking || S.pending) {
      if (tone !== 'alarm' || this.lastTone === 'alarm') return;
      S.cancel();
    }
    const u = new SpeechSynthesisUtterance(words);
    u.lang = 'en-US';
    const fig = who.fig;
    const look = fig ? fig.look : null;
    const seed = fig ? fig.seed || 0 : 0;
    const v = this.voiceFor(look, seed);
    if (v) u.voice = v;
    // a voice for each person: higher or lower, quicker or slower (a child's, an old one's)
    const kid = fig && fig.scale < 0.8;
    const elder = look && look.role === 'elder';
    let pitch = (look && look.fem ? 1.15 : 0.9) + (((seed * 7.31) % 1) - 0.5) * 0.3;
    if (kid) pitch = 1.7;
    if (elder) pitch *= 0.85;
    u.pitch = Math.max(0.1, Math.min(2, pitch));
    u.rate = (0.95 + ((seed * 3.17) % 1) * 0.2) * (tone === 'alarm' ? 1.15 : 1) * (elder ? 0.85 : 1);
    u.volume = Math.max(0.05, Math.min(1, fx * fx * (1 - d / 18) * 1.1));
    this.lastTone = tone;
    try {
      S.speak(u);
      this.stats.spoken++;
    } catch (e) {
      // (no voice after all)
    }
  }

  voiceFor(look, seed) {
    const S = window.speechSynthesis;
    if (!this.voiceList || !this.voiceList.length) {
      const all = (S.getVoices() || []).filter((v) => /^en/i.test(v.lang));
      this.voiceList = all;
      this.voiceF = all.filter((v) => FEM_VOICE.test(v.name));
      this.voiceM = all.filter((v) => !FEM_VOICE.test(v.name) && MALE_VOICE.test(v.name));
    }
    const pool = look && look.fem ? this.voiceF : this.voiceM;
    const list = pool && pool.length ? pool : this.voiceList;
    if (!list.length) return null;
    return list[Math.floor(seed * 13.7) % list.length];
  }
}
