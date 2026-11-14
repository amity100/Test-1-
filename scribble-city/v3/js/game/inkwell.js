import * as THREE from 'three';
import { Doodle } from './doodle.js';
import { barLook, bartenderLook } from './looks.js';
import { buildBar } from '../world/bar.js';
import { BLUEPRINTS } from './blueprints.js';
import { shared } from '../render/materials.js';
import { damp, dampAngle, clamp, angleDiff } from '../core/util.js';

// The Inkwell: a busy little bar of doodled people, each drawn by a different hand.
// Order from the bartender (the drink shows inside you: you're only a drawing), dance,
// chat, and try your luck with someone who catches your eye.

const DRINKS = {
  beer: { name: 'בירה מהחבית', color: [0.95, 0.72, 0.22], tipsy: 0.35, en: 'Draft beer' },
  ink: { name: 'ספיישל הדיו', color: [0.25, 0.42, 0.95], tipsy: 0.7, en: 'Ink Special' },
  shake: { name: 'מילקשייק תות', color: [0.98, 0.62, 0.72], heal: 30, en: 'Strawberry shake' },
  water: { name: 'כוס מים', color: [0.72, 0.86, 0.98], sober: 0.5, en: 'Water' },
};
const PATRON_DRINKS = ['beer', 'beer', 'ink', 'shake', 'water', 'ink'];

// who the people you can flirt with are
const TRAITS = {
  artsy: { drink: 10, joke: 8, style: 30, cheesy: -18, ask: 25, brag: 12, dance: 18, flowers: 26 },
  funny: { drink: 10, joke: 32, style: 8, cheesy: 12, ask: 10, brag: 5, dance: 20, flowers: 18 },
  romantic: { drink: 26, joke: 6, style: 16, cheesy: 18, ask: 12, brag: 2, dance: 26, flowers: 42 },
  cool: { drink: 16, joke: 6, style: 12, cheesy: -26, ask: 8, brag: -10, dance: 14, flowers: 10 },
  nerdy: { drink: 2, joke: 18, style: 14, cheesy: 6, ask: 28, brag: 26, dance: 6, flowers: 24 },
};
const OPENERS = {
  artsy: 'הקווים שלך נראים כאילו צוירו בעט ג\'ל בשיעור היסטוריה. אני אוהבת את זה.',
  funny: 'אם תצליח להצחיק אותי, אולי אשאר לשבת פה עוד קצת.',
  romantic: 'הלילה הזה מרגיש כמו עמוד ריק... מישהו צריך לצייר עליו משהו יפה.',
  cool: 'אז אתה הבחור שמסתובב בעיר עם עיפרון ענק? שמעתי עליך.',
  nerdy: 'ידעת שהדיו בעטים כחולים מתייבש תוך שנייה? ...סליחה, אני חופרת.',
};
const REACT = {
  good: ['חחח, זה היה ממש טוב!', 'אוקיי, הצלחת להפתיע אותי.', 'אתה מצחיק, אתה יודע את זה?', 'וואו. לזה לא ציפיתי.'],
  ok: ['חמוד.', 'נו, לפחות ניסית.', 'אמממ... בסדר.', 'מעניין.'],
  bad: ['אוי. לא.', 'זה היה... משהו.', 'בוא נעמיד פנים שלא אמרת את זה.', 'ממש לא.'],
};
const BUBBLE = { good: ['Haha!', 'Aww!', 'Stop it!', 'Ha!'], ok: ['Hm.', 'Cute.', 'Okay...'], bad: ['Ugh.', 'Yikes.', 'Nope.'] };
const SMALLTALK = [
  'ה-Erasers מנגנים פה ביום שישי. חובה לבוא.',
  'אל תזמין את ספיישל הדיו. ...טוב, תזמין. אבל רק אחד.',
  'מי צייר אותך? יש לו יד טובה.',
  'הברמן פה מצייר את עצמו מחדש כל בוקר. רואים לפי השפם.',
  'פעם מישהו מחק לי את הכתף ברחוב. מאז אני הולך עם מעיל.',
  'המוזיקה פה מעולה. תנסה את הג\'וקבוקס!',
  'אני מחכה לחבר. הוא מאחר. כנראה עוד מצייר את הנעליים.',
];
const CHATTER = ['Cheers!', 'No way!', 'Hahaha', 'Love this song!', 'Another round?', 'Who drew you?', 'So then he says...', 'Is that ballpoint?', 'Ink-credible!', 'Erasers on Friday!', 'Shh, listen!', 'Best bar in town.'];
const FLIRT_NAMES = ['נועה', 'מאיה', 'ליה', 'דנה', 'רוני', 'תמר', 'שירה', 'יעל'];

const _v = new THREE.Vector3();
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Inkwell {
  constructor(game) {
    this.game = game;
    this.room = null;
    this.inside = false;
    this.people = [];
    this.bartender = null;
    this.tipsy = 0;
    this.song = 0;
    this.flipping = false;
    this.later = []; // [game time, fn]
  }

  after(sec, fn) {
    this.later.push([this.game.time + sec, fn]);
  }

  // ------------------------------------------------------------------ getting in and out
  get door() {
    return this.game.world.bar;
  }

  nearStreetDoor(p) {
    const d = this.door;
    return !!d && !this.inside && Math.hypot(p.x - d.x, p.z - d.z) < 1.9;
  }

  build() {
    if (this.room) return;
    const game = this.game;
    this.room = buildBar(game.scene, game.mats, game.signAtlas, game.world.collision);
    this.populate();
  }

  flip(mid) {
    if (this.flipping) return;
    this.flipping = true;
    const el = document.getElementById('pageflip');
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
    this.game.audio.play('pageflip');
    setTimeout(() => mid(), 420);
    setTimeout(() => {
      el.classList.remove('on');
      this.flipping = false;
    }, 950);
  }

  enter() {
    const game = this.game;
    this.build();
    this.flip(() => {
      const p = game.player;
      const s = this.room.spawn;
      this.room.group.visible = true;
      this.inside = true;
      game.inBar = true;
      document.body.classList.add('in-bar');
      p.pos.set(s.x, this.room.origin.y, s.z);
      p.vel.set(0, 0, 0);
      p.yaw = s.yaw;
      game.camRig.yaw = s.yaw;
      game.camRig.pitch = -0.12;
      game.audio.music(true, this.song);
      game.hud.toast('ברוכים הבאים ל-The Inkwell', 'info', 2.2);
      if (!game.goalFlags.bar) {
        game.goalFlags.bar = true;
        game.updateGoals();
      }
      // whoever was after you lost you at the door
      const door = this.door;
      for (const e of game.enemies.list) {
        if (e.alive && e.state === 'combat') {
          e.squad.lastKnown.set(door.x, 0, door.z);
          e.lastSeen.set(door.x, 0, door.z);
        }
      }
      if (game.police.hostile) game.police.lastSeen.set(door.x, 0, door.z);
    });
  }

  exit() {
    const game = this.game;
    if (game.dialog.open) game.dialog.closeQuiet();
    this.flip(() => {
      const p = game.player;
      const d = this.door;
      this.room.group.visible = false;
      this.inside = false;
      game.inBar = false;
      document.body.classList.remove('in-bar');
      p.pos.set(d.x + d.nx * 0.6, 0.15, d.z + d.nz * 0.6);
      p.vel.set(0, 0, 0);
      p.yaw = Math.atan2(d.nx, d.nz);
      game.camRig.yaw = p.yaw;
      p.fig.dance = 0;
      game.audio.music(false);
    });
  }

  // ------------------------------------------------------------------ the crowd
  populate() {
    const game = this.game;
    const R = this.room;
    const styles = ['gelGirl', 'comicBoy', 'ballpointGuy', 'manga', 'artsy', 'pencil', 'punk', 'sepia'];
    const mk = (style, spot, kind, o = {}) => {
      const look = barLook(style, o);
      const fig = new Doodle(game.figures, look, { seed: Math.random() * 100 });
      const person = {
        fig, look, style, kind, spot,
        drink: pick(PATRON_DRINKS), drinkT: 3 + Math.random() * 8, glass: kind !== 'dance' || Math.random() < 0.3,
        chatT: 2 + Math.random() * 10, yaw: spot.yaw || 0, phase: Math.random() * 6,
        flirt: null,
      };
      fig.belly = 0.2 + Math.random() * 0.5;
      fig.bellyColor = DRINKS[person.drink].color;
      fig.pos.set(spot.x, R.origin.y, spot.z);
      fig.yaw = person.yaw;
      this.people.push(person);
      return person;
    };
    // at the counter
    const stools = R.stools.slice();
    const counterCrowd = [['gelGirl', { fem: true }], ['ballpointGuy', {}], ['punk', { fem: true }], ['pencil', {}], ['manga', { fem: true }]];
    const stoolIdx = [0, 2, 3, 5, 7];
    counterCrowd.forEach(([st, o], i) => mk(st, stools[stoolIdx[i]], 'stool', o));
    // at the tables
    const tablePeople = [['artsy', { fem: true }], ['comicBoy', {}], ['sepia', { fem: true }], ['ballpointGuy', {}], ['gelGirl', { fem: true }]];
    const seats = [R.tables[0].seats[0], R.tables[0].seats[1], R.tables[1].seats[0], R.tables[1].seats[2], R.tables[2].seats[1]];
    tablePeople.forEach(([st, o], i) => mk(st, seats[i], 'seat', o));
    // dancing
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const d = R.dance;
      mk(styles[(i * 3 + 1) % styles.length], { x: d.x + Math.cos(a) * 1.0, z: d.z + Math.sin(a) * 1.2, yaw: a + Math.PI }, 'dance', { fem: i !== 1 });
    }
    // by the jukebox
    mk('comicBoy', { x: R.jukebox.x - 0.4, z: R.jukebox.z + 0.6, yaw: Math.PI / 2 }, 'stand');
    // some of the women would chat you up back: names and personalities
    const names = FLIRT_NAMES.slice().sort(() => Math.random() - 0.5);
    const traits = Object.keys(TRAITS);
    let n = 0;
    for (const p of this.people) {
      if (p.look.fem && n < 6) {
        p.flirt = { name: names[n], trait: traits[n % traits.length], interest: 20 + Math.random() * 15, rounds: 0, done: null, coolT: 0 };
        n++;
      }
    }
    // the bartender
    const look = bartenderLook();
    const fig = new Doodle(game.figures, look, { seed: 42 });
    fig.pos.set((R.counter.x0 + R.counter.x1) / 2, R.origin.y, R.counter.behind);
    this.bartender = { fig, look, targetX: fig.pos.x, task: null, taskT: 0, wipeT: 0 };
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const game = this.game;
    if (this.later.length) {
      const due = this.later.filter(([t]) => t <= game.time);
      this.later = this.later.filter(([t]) => t > game.time);
      for (const [, fn] of due) fn();
    }
    // being tipsy wears off slowly, inside or out
    if (this.tipsy > 0) this.tipsy = Math.max(0, this.tipsy - dt / 70);
    shared.uBoilAmp.value = game.boilOn === false ? 0 : 1 + this.tipsy * 2.5;
    if (!this.inside) return;
    const p = game.player;
    // the dance floor makes you move
    const R = this.room;
    const onFloor = p.pos.x > R.dance.x0 && p.pos.x < R.dance.x1 && p.pos.z > R.dance.z0 && p.pos.z < R.dance.z1;
    const still = Math.hypot(p.vel.x, p.vel.z) < 0.5;
    p.fig.dance = damp(p.fig.dance, onFloor && still && p.mode === 'foot' ? 1 : this.danceT > 0 ? 1 : 0, 4, dt);
    if (this.danceT > 0) this.danceT -= dt;
    // your own drink: glass up, and it settles in your belly
    if (p.fig.drinkT >= 0) p.fig.drinkT = Math.min(1, p.fig.drinkT + dt / 1.1);
    if (p.fig.belly > 0) p.fig.belly = Math.max(0, p.fig.belly - dt * 0.006);
    for (const m of this.people) this.updatePerson(m, dt);
    this.updateBartender(dt);
  }

  updatePerson(m, dt) {
    const game = this.game;
    const fig = m.fig;
    const R = this.room;
    m.phase += dt;
    if (m.dancingWithYou) {
      fig.sit = 0;
      fig.dance = 1;
      fig.pos.x = damp(fig.pos.x, m.danceX, 2, dt);
      fig.pos.z = damp(fig.pos.z, m.danceZ, 2, dt);
      fig.pos.y = R.origin.y;
      fig.speed = 0;
      fig.yaw = dampAngle(fig.yaw, Math.atan2(game.player.pos.x - fig.pos.x, game.player.pos.z - fig.pos.z), 3, dt);
    } else if (m.kind === 'stool' || m.kind === 'seat') {
      fig.sit = 1;
      fig.dance = 0;
      // bar stools are taller than chairs
      fig.pos.y = R.origin.y + (m.kind === 'stool' ? 0.3 : 0.0);
      fig.speed = 0;
      fig.yaw = dampAngle(fig.yaw, m.talkTo ? Math.atan2(m.talkTo.x - fig.pos.x, m.talkTo.z - fig.pos.z) : m.spot.yaw + Math.sin(m.phase * 0.3) * 0.25, 3, dt);
    } else if (m.kind === 'dance') {
      fig.sit = 0;
      fig.dance = 1;
      const a = m.phase * 0.25;
      fig.pos.x = damp(fig.pos.x, m.spot.x + Math.cos(a) * 0.25, 2, dt);
      fig.pos.z = damp(fig.pos.z, m.spot.z + Math.sin(a) * 0.25, 2, dt);
      fig.speed = 0;
      fig.yaw = dampAngle(fig.yaw, m.spot.yaw + Math.sin(m.phase * 0.7) * 1.2, 2, dt);
    } else {
      fig.sit = 0;
      fig.speed = 0;
      fig.yaw = dampAngle(fig.yaw, m.talkTo ? Math.atan2(m.talkTo.x - fig.pos.x, m.talkTo.z - fig.pos.z) : m.spot.yaw, 3, dt);
    }
    // sip now and then: the drink goes down into the drawing
    m.drinkT -= dt;
    if (m.drinkT <= 0 && fig.drinkT < 0 && m.glass) {
      fig.drinkT = 0;
      m.drinkT = 7 + Math.random() * 10;
    }
    if (fig.drinkT >= 0) {
      fig.drinkT += dt / 1.4;
      if (fig.drinkT > 0.5 && !m.sipped) {
        m.sipped = true;
        fig.belly = Math.min(1, fig.belly + 0.12);
        fig.bellyColor = DRINKS[m.drink].color;
      }
      if (fig.drinkT >= 1) {
        fig.drinkT = -1;
        m.sipped = false;
      }
    } else fig.belly = Math.max(0.15, fig.belly - dt * 0.004);
    // chatter
    m.chatT -= dt;
    if (m.chatT <= 0) {
      m.chatT = 9 + Math.random() * 14;
      const cam = game.camera.position;
      if (Math.hypot(cam.x - fig.pos.x, cam.z - fig.pos.z) < 12 && !game.dialog.open) game.bubbles.say(m, pick(CHATTER));
    }
    m.pos = fig.pos;
    fig.update(dt);
  }

  updateBartender(dt) {
    const b = this.bartender;
    const R = this.room;
    const fig = b.fig;
    const p = this.game.player;
    // follows you along the counter so he's there when you order
    if (b.task) {
      b.taskT += dt;
      b.targetX = b.task.x;
      if (Math.abs(fig.pos.x - b.task.x) < 0.25) {
        if (!b.task.at) b.task.at = b.taskT;
        fig.reachR = _v.set(fig.pos.x, R.origin.y + 1.3, R.counter.z - 0.6 + Math.sin(b.taskT * 9) * 0.04);
        if (b.taskT - b.task.at > 1.2) {
          const t = b.task;
          b.task = null;
          fig.reachR = null;
          t.done();
        }
      }
    } else if (Math.abs(p.pos.z - R.counter.z) < 2.5) {
      b.targetX = clamp(p.pos.x, R.counter.x0, R.counter.x1);
    } else {
      b.wipeT += dt;
      b.targetX = (R.counter.x0 + R.counter.x1) / 2 + Math.sin(b.wipeT * 0.15) * 3;
    }
    const dx = b.targetX - fig.pos.x;
    const sp = Math.abs(dx) > 0.2 ? Math.sign(dx) * Math.min(1.6, Math.abs(dx) * 2) : 0;
    fig.pos.x += sp * dt;
    fig.pos.z = R.counter.behind;
    fig.pos.y = R.origin.y;
    fig.speed = Math.abs(sp);
    fig.yaw = dampAngle(fig.yaw, Math.abs(sp) > 0.1 ? (sp > 0 ? Math.PI / 2 : -Math.PI / 2) : 0, 6, dt);
    if (!b.task && Math.abs(sp) < 0.1) {
      // polishing a glass
      fig.reachR = _v.set(fig.pos.x + Math.sin(b.wipeT * 4) * 0.08, R.origin.y + 1.15, fig.pos.z + 0.45);
    } else if (!b.task) fig.reachR = null;
    b.pos = fig.pos;
    fig.update(dt);
  }

  draw(camPos) {
    if (!this.inside) return;
    const fr = this.game.figures;
    for (const m of this.people) {
      m.fig.draw(camPos);
      if (m.glass) this.drawGlass(fr, m.fig, DRINKS[m.drink].color);
    }
    this.bartender.fig.draw(camPos);
    this.drawGlass(fr, this.bartender.fig, [0.85, 0.9, 0.95], true);
    const p = this.game.player;
    if (this.playerGlass) this.drawGlass(fr, p.fig, this.playerGlass.color);
    // disco ball sparkles sweeping the walls and floor
    const t = this.game.time;
    const R = this.room;
    for (let i = 0; i < 14; i++) {
      const a = t * 0.6 + i * 2.39;
      const r = 2.2 + (i % 4) * 0.9;
      const x = R.dance.x + Math.cos(a) * r;
      const z = R.dance.z + Math.sin(a) * r * 0.8;
      const y = R.origin.y + 0.03 + (i % 3) * 1.1;
      const col = i % 3 === 0 ? [1, 0.55, 0.75] : i % 3 === 1 ? [0.5, 0.85, 1] : [1, 0.92, 0.6];
      fr.lineXYZ(x, y, z, x + 0.06, y, z + 0.04, col, 6, i, 0.85, 0.01, 0);
    }
  }

  // a glass in the right hand, the drink level drawn in its colour
  drawGlass(fr, fig, color, empty = false) {
    if (fig.parts.armR < 0.5) return;
    const h = fig.j.handR;
    const x = h.x;
    const y = h.y + 0.02;
    const z = h.z;
    const s = 0.05;
    fr.lineXYZ(x - s, y, z, x - s * 0.8, y + 0.16, z, [0.3, 0.35, 0.42], 1.6, 1, 0.9, 0.004, 0);
    fr.lineXYZ(x + s, y, z, x + s * 0.8, y + 0.16, z, [0.3, 0.35, 0.42], 1.6, 2, 0.9, 0.004, 0);
    fr.lineXYZ(x - s, y, z, x + s, y, z, [0.3, 0.35, 0.42], 1.6, 3, 0.9, 0.004, 0);
    if (!empty) fr.lineXYZ(x, y + 0.01, z, x, y + 0.11, z, color, 9, 4, 0.85, 0.004, 0);
  }

  // ------------------------------------------------------------------ talking to people
  // what pressing E would do right now
  // whatever you're closest to and facing: people, the bartender over the counter, the jukebox, the door
  target() {
    if (!this.inside || this.game.dialog.open) return null;
    const p = this.game.player.pos;
    const face = this.game.camRig.yaw;
    const R = this.room;
    if (Math.hypot(p.x - R.door.x, p.z - R.door.z) < 1.4) return { kind: 'exit', label: 'E — לצאת לרחוב' };
    if (Math.hypot(p.x - R.jukebox.x, p.z - R.jukebox.z) < 1.3) return { kind: 'jukebox', label: 'E — להחליף שיר בג\'וקבוקס' };
    const score = (x, z, maxD) => {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d > maxD) return Infinity;
      const a = Math.abs(angleDiff(face, Math.atan2(x - p.x, z - p.z)));
      return a > 1.3 && d > 0.8 ? Infinity : d + a * 1.1;
    };
    let best = null;
    let bs = Infinity;
    for (const m of this.people) {
      const s = score(m.fig.pos.x, m.fig.pos.z, 1.8);
      if (s < bs) {
        bs = s;
        best = m;
      }
    }
    if (Math.abs(p.z - R.counter.z) < 1.0 && p.x > R.counter.x0 - 0.5 && p.x < R.counter.x1 + 0.5) {
      const s = score(clamp(p.x, R.counter.x0, R.counter.x1), R.counter.behind, 2.6) - 0.6;
      if (s < bs) return { kind: 'bartender', label: 'E — להזמין משקה מהברמן' };
    }
    if (best) {
      const f = best.flirt;
      return { kind: 'person', who: best, label: f && !f.done ? `E — לדבר עם ${f.name}` : 'E — לדבר' };
    }
    return null;
  }

  interact() {
    const t = this.target();
    if (!t) return;
    if (t.kind === 'exit') this.exit();
    else if (t.kind === 'jukebox') this.nextSong();
    else if (t.kind === 'bartender') this.order();
    else this.talk(t.who);
  }

  nextSong() {
    this.song = (this.song + 1) % 3;
    this.game.audio.music(true, this.song);
    const names = ['לו-פיי של מחברות', 'רוקנרול מחיקות', 'דיסקו בעט ג\'ל'];
    this.game.hud.toast(`🎵 ${names[this.song]}`, 'info', 1.8);
    for (const m of this.people) if (Math.random() < 0.3) this.game.bubbles.say(m, pick(['Yes!', 'My song!', 'Turn it up!']));
  }

  order(forWho = null) {
    const game = this.game;
    const choices = Object.entries(DRINKS).map(([id, d]) => ({ label: d.name, fn: () => this.serve(id, forWho) }));
    choices.push({ label: 'אולי אחר כך', fn: null });
    game.dialog.show('הברמן', forWho ? `מה להביא ל${forWho.flirt.name}?` : 'ערב טוב! מה אפשר להביא לך?', choices);
  }

  serve(id, forWho) {
    const game = this.game;
    const R = this.room;
    const p = game.player;
    const d = DRINKS[id];
    const x = clamp(forWho ? forWho.fig.pos.x : p.pos.x, R.counter.x0, R.counter.x1);
    game.bubbles.say(this.bartender, pick(['Coming right up!', 'One ' + d.en + '!', 'Good choice.']));
    this.bartender.task = {
      x,
      done: () => {
        game.audio.play('pour');
        if (forWho) {
          forWho.drink = id;
          forWho.glass = true;
          forWho.fig.drinkT = 0;
          forWho.drinkT = 6;
          game.bubbles.say(forWho, 'Thanks!');
        } else {
          this.playerGlass = d;
          p.fig.drinkT = 0;
          this.after(0.7, () => this.drink(d));
        }
      },
    };
    this.bartender.taskT = 0;
  }

  // you drink it, and you can see it inside you
  drink(d) {
    const game = this.game;
    const p = game.player;
    p.fig.belly = Math.min(1, p.fig.belly + 0.55);
    p.fig.bellyColor = d.color;
    if (d.tipsy) {
      this.tipsy = Math.min(1.5, this.tipsy + d.tipsy);
      game.hud.toast(this.tipsy > 1 ? 'העולם קצת מתנדנד…' : 'מממ. מרגישים את זה בקווים.', 'info', 2);
    }
    if (d.heal) {
      p.hp = Math.min(p.maxHp, p.hp + d.heal);
      game.hud.toast('מתוק! (+חיים)', 'good', 1.6);
    }
    if (d.sober) this.tipsy = Math.max(0, this.tipsy - d.sober);
    this.after(0.9, () => {
      this.playerGlass = null;
      p.fig.drinkT = -1;
    });
  }

  talk(m) {
    const game = this.game;
    m.talkTo = game.player.pos;
    this.after(6, () => {
      if (!game.dialog.open) m.talkTo = null;
    });
    const f = m.flirt;
    if (!f || f.done) {
      const line = f && f.done === 'no' ? 'אמרתי שאני לא מעוניינת. אבל תהנה מהערב.' : f && f.done ? 'היי! עוד מחכה לראות אותך על רחבת הריקודים.' : pick(SMALLTALK);
      game.dialog.show(f ? f.name : 'מישהו בבר', line, null);
      return;
    }
    if (f.coolT > game.time) {
      game.dialog.show(f.name, 'תן לי רגע, אני באמצע משהו. אולי עוד קצת?', null);
      return;
    }
    f.rounds = 0;
    this.flirtRound(m, OPENERS[f.trait]);
  }

  flirtRound(m, text) {
    const f = m.flirt;
    const game = this.game;
    const r = f.rounds;
    let opts;
    if (r === 0) {
      opts = [
        ['drink', 'להזמין אותה למשקה'],
        ['joke', 'לספר בדיחה על מחקים'],
        ['style', 'מחמאה על הסטייל של הקווים שלה'],
        ['cheesy', 'שורת פתיחה צ\'יזית'],
      ];
    } else if (r === 1) {
      opts = [
        ['ask', 'לשאול מי צייר אותה'],
        ['brag', 'לספר על השרטוטים שאספת בעיר'],
        ['dance', 'להזמין אותה לרקוד'],
        ['joke', 'עוד בדיחה'],
      ];
    } else {
      opts = [
        ['dance', 'לרקוד איתה'],
        ['ask', 'לשאול אם אפשר להתקשר מחר'],
        ['style', 'להגיד לה שהיא הדבר הכי יפה בעמוד'],
      ];
    }
    // flowers from the shop down the street
    if (game.player.fig.carryL === 'bouquet') opts.unshift(['flowers', 'לתת לה את זר הפרחים']);
    const choices = opts.map(([kind, label]) => ({ label, fn: () => this.flirtAnswer(m, kind) }));
    choices.push({ label: 'להיפרד בנימוס', fn: () => this.flirtEnd(m, 'later') });
    game.dialog.show(f.name, text, choices);
  }

  flirtAnswer(m, kind) {
    const f = m.flirt;
    const game = this.game;
    let delta = TRAITS[f.trait][kind] + (Math.random() - 0.5) * 16;
    if (kind === 'dance' && f.interest < 40) delta -= 15; // too soon
    if (kind === 'drink') this.serve(pick(['beer', 'ink', 'shake']), m);
    if (kind === 'flowers') {
      game.player.fig.carryL = null;
      m.fig.carryL = 'bouquet';
    }
    f.interest = clamp(f.interest + delta, 0, 100);
    const tone = delta > 17 ? 'good' : delta > 3 ? 'ok' : 'bad';
    game.bubbles.say(m, pick(BUBBLE[tone]), tone === 'bad' ? 'plain' : 'plain');
    f.rounds++;
    let text = pick(REACT[tone]);
    if (kind === 'ask' && tone !== 'bad') text = pick(['ילד בכיתה ח\' צייר אותי בעט ג\'ל במהלך מבחן במתמטיקה. הוא נכשל, אבל אני יצאתי מושלמת.', 'מישהי ציירה אותי על שולי מחברת. היא אף פעם לא סיימה לי את הנעליים.', 'אני מקווה שמישהו עוד יצבע אותי יום אחד.']);
    if (kind === 'flowers') text = tone === 'bad' ? 'פרחים? ...תודה, אני מניחה.' : tone === 'ok' ? 'אוו, פרחים. חמוד.' : 'פרחים?! אף אחד לא הביא לי פרחים מאז שציירו אותי. אתה מתוק.';
    if (kind === 'joke') text = (tone === 'good' ? 'חחחח! "למה המחק לא הלך למסיבה? כי הוא תמיד מוחק את עצמו!" זה גרוע. אני מתה.' : tone === 'ok' ? 'הבדיחה הזאת עם המחק... היא חמודה, נגיד.' : 'זאת הבדיחה הכי מחוקה ששמעתי השבוע.');
    if (f.interest < 18) return this.flirtEnd(m, 'no');
    if (f.rounds >= 3) return this.flirtEnd(m, f.interest >= 65 ? 'yes' : 'later');
    this.flirtRound(m, text);
  }

  flirtEnd(m, how) {
    const f = m.flirt;
    const game = this.game;
    m.talkTo = null;
    if (how === 'no') {
      f.done = 'no';
      game.dialog.show(f.name, 'תקשיב, אתה נחמד, אבל אני לא מעוניינת. ערב טוב.', null);
      return;
    }
    if (how === 'later') {
      f.coolT = game.time + 25;
      game.dialog.show(f.name, 'היה נחמד לדבר איתך. אולי נמשיך אחר כך.', null);
      return;
    }
    f.done = 'yes';
    // what she offers: her number, a dance, or a blueprint sketched on a napkin
    const missing = ['rifle', 'bazooka', 'car', 'tank', 'ufo', 'katana', 'boomerang', 'planes', 'laser', 'bike'].filter((id) => !game.album.has(id));
    const roll = Math.random();
    if (missing.length && roll < 0.45) {
      const id = missing[0];
      game.album.add(id);
      game.dialog.show(f.name, `רגע... (היא מציירת משהו על מפית) קח. ראיתי את זה פעם בשוליים של מחברת: ${BLUEPRINTS[id].name}. תצייר אותו כשתצטרך.`, null);
      game.hud.toast(`שרטוט חדש באלבום: ${BLUEPRINTS[id].name}!`, 'good', 3.2);
      game.audio.play('ding');
    } else if (roll < 0.75) {
      const R = this.room;
      game.dialog.show(f.name, 'בוא, השיר הזה טוב מדי בשביל לשבת.', [{ label: 'לרקוד', fn: () => this.danceWith(m) }]);
      return;
    } else {
      game.dialog.show(f.name, 'הנה, רשמתי לך את המספר שלי על המפית. אל תמחק אותו, טוב?', null);
      game.hud.toast(`קיבלת את המספר של ${f.name} 📝`, 'good', 3);
      game.audio.play('ding');
    }
    game.bubbles.say(m, pick(['Call me!', 'See you around!', '<3']));
  }

  danceWith(m) {
    const game = this.game;
    const R = this.room;
    const p = game.player;
    const x = R.dance.x - 0.5;
    const z = R.dance.z + 0.6;
    this.flip(() => {
      p.pos.set(x, R.origin.y, z);
      p.vel.set(0, 0, 0);
      m.dancingWithYou = true;
      m.danceX = x + 1.1;
      m.danceZ = z - 0.2;
      m.fig.sit = 0;
      m.fig.pos.set(m.danceX, R.origin.y, m.danceZ);
      p.yaw = Math.atan2(m.danceX - x, m.danceZ - z);
      game.camRig.yaw = p.yaw + 0.9;
      this.danceT = 14;
      this.after(14, () => {
        m.dancingWithYou = false;
        m.fig.dance = 0;
        m.fig.pos.set(m.spot.x, R.origin.y, m.spot.z);
      });
    });
    game.hud.toast(`רוקדים עם ${m.flirt.name}`, 'good', 2);
  }
}
