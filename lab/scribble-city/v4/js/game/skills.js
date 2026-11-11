// (ROADMAP 5.6, not with ?classic) What the hero gets better at by doing it. Each skill has
// points (0..100) that doing the thing adds to; every 20 points is a level (0..5), and a word on
// the screen when it comes:
//   run     stamina: sprinting runs it down (out of breath, you only jog until it is back); the
//           more you have run, the longer it lasts and the faster the sprint
//   shoot   the guns' spread and kick shrink with every hit you land
//   drive   quicker steering and more grip, the more you drive fast
//   draw    every drawing makes the next one easier: points onto its score
//   fight   the fists' blows land harder with every one that lands (ROADMAP 5.4)
// The phone's skills page shows where each one is (ui/phone.js); the saves keep them.

export const SKILLS = [
  { id: 'run', name: 'סיבולת', up: 'הסיבולת השתפרה! רצים יותר זמן ומהר יותר', what: (l) => `ריצה מהירה: ${Math.round(100 / drainOf(l))} שניות` },
  { id: 'shoot', name: 'ירי', up: 'הירי השתפר! הקליעים מדויקים יותר', what: (l) => `פיזור הקליעים: ${Math.round(100 * spreadOf(l))}%` },
  { id: 'drive', name: 'נהיגה', up: 'הנהיגה השתפרה! הרכב נשמע לכם יותר', what: (l) => (l ? `אחיזה בכביש: עוד ${l * 5}%` : 'אחיזה בכביש: רגילה') },
  { id: 'draw', name: 'ציור', up: 'הציור השתפר! קל יותר לצייר ציור מושלם', what: (l) => (l ? `כל ציור מקבל עוד ${l * 2} נקודות` : 'כל ציור מקבל את הציון שלו') },
  { id: 'fight', name: 'כוח', up: 'המכות התחזקו!', what: (l) => (l ? `המכות חזקות יותר ב־${l * 8}%` : 'מכות רגילות') },
];
export const MAX_LEVEL = 5;
const PER_LEVEL = 20;
// how fast a sprint uses up the stamina (a bar of 100): 10 a second at first, 5 at the top
const drainOf = (l) => 10 - l;
const spreadOf = (l) => 1 - 0.09 * l;

export class Skills {
  constructor(game) {
    this.game = game;
    this.points = {};
    for (const s of SKILLS) this.points[s.id] = 0;
    this.stamina = 100;
    this.winded = false;
    this.restT = 0;
    this.fullT = 1;
    this.ui = {
      el: document.getElementById('stamina'),
      fill: document.querySelector('#stamina .fill'),
    };
    this.shownW = -1;
  }

  level(id) {
    return Math.min(MAX_LEVEL, Math.floor(this.points[id] / PER_LEVEL));
  }

  // doing the thing: points, and the word when a level comes
  add(id, n) {
    const before = this.level(id);
    this.points[id] = Math.min(MAX_LEVEL * PER_LEVEL, this.points[id] + n);
    const after = this.level(id);
    if (after > before) {
      const s = SKILLS.find((x) => x.id === id);
      this.game.hud.toast(`${s.up} (רמה ${after} מתוך ${MAX_LEVEL})`, 'good', 3.2);
      this.game.audio.play('ding', 0.7);
    }
  }

  // ------------------------------------------------------------------ what the levels change
  get canSprint() {
    return !this.winded;
  }

  get sprintBonus() {
    return 0.14 * this.level('run');
  }

  get spreadMul() {
    return spreadOf(this.level('shoot'));
  }

  get kickMul() {
    return 1 - 0.08 * this.level('shoot');
  }

  get gripMul() {
    return 1 + 0.05 * this.level('drive');
  }

  get steerMul() {
    return 1 + 0.06 * this.level('drive');
  }

  get drawBonus() {
    return 2 * this.level('draw');
  }

  get fightMul() {
    return 1 + 0.08 * this.level('fight');
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const P = this.game.player;
    // the stamina: down while sprinting (out of breath at the bottom), back up after a breather
    if (P.mode === 'foot' && P.sprinting) {
      this.stamina = Math.max(0, this.stamina - dt * drainOf(this.level('run')));
      this.restT = 0;
      this.add('run', (Math.hypot(P.vel.x, P.vel.z) * dt) / 25);
      if (this.stamina <= 0 && !this.winded) {
        this.winded = true;
        this.game.hud.toast('אין אוויר… רגע לנשום', 'info', 1.6);
      }
    } else {
      this.restT += dt;
      if (this.restT > 0.6) this.stamina = Math.min(100, this.stamina + dt * 16);
    }
    if (this.winded && this.stamina > 30) this.winded = false;
    // the miles behind the wheel (fast ones count)
    const v = P.inVehicle;
    if (v && v.driver === P && (v.kind === 'car' || v.kind === 'bike' || v.kind === 'boat')) {
      const sp = v.speedAbs || Math.abs(v.speed || 0);
      if (sp > 8) this.add('drive', (sp * dt) / 120);
    }
    this.show(dt);
  }

  // the stamina's bar under the health (only while it is not full)
  show(dt) {
    const u = this.ui;
    if (!u.el) return;
    if (this.stamina < 100) this.fullT = 0;
    else this.fullT += dt;
    const vis = this.fullT < 0.8 && this.game.player.mode === 'foot';
    if (vis !== this.shownVis) {
      this.shownVis = vis;
      u.el.classList.toggle('hidden', !vis);
    }
    const w = Math.round(this.stamina);
    if (w !== this.shownW) {
      this.shownW = w;
      u.fill.style.width = `${w}%`;
    }
    if (this.winded !== this.shownWinded) {
      this.shownWinded = this.winded;
      u.el.classList.toggle('low', this.winded);
    }
  }

  // ------------------------------------------------------------------ the saves
  save() {
    return { ...this.points };
  }

  load(o) {
    if (!o) return;
    for (const s of SKILLS) if (typeof o[s.id] === 'number') this.points[s.id] = Math.max(0, Math.min(MAX_LEVEL * PER_LEVEL, o[s.id]));
  }

  // for the phone's page: each skill, its level, the way to the next one (0..1), what it gives
  rows() {
    return SKILLS.map((s) => {
      const l = this.level(s.id);
      const p = this.points[s.id];
      return { id: s.id, name: s.name, level: l, next: l >= MAX_LEVEL ? 1 : (p - l * PER_LEVEL) / PER_LEVEL, what: s.what(l) };
    });
  }
}
