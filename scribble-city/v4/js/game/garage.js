import * as THREE from 'three';
import { makeSurface, srgb, flashLight } from '../render/materials.js';
import { clamp } from '../core/util.js';

// (ROADMAP 4.6; not with ?classic) The service station on Flamingo Ave (world/garages.js):
//  - the body shop: drive into its bay and stop - the door comes down and the mechanic asks what
//    it will be: a new colour and a design you draw on the car yourself (ui/paintshop.js), the
//    upgrades (engine, brakes, tyres, armour: three steps each), a repair (dents, glass, tyres,
//    the fire);
//  - the wash: stop in its bay - brushes, foam, water, and it comes out clean (a car gathers dust
//    as it is driven, quicker on a wet road);
//  - the pumps: stop beside one - the hose goes in, the tank fills (a car burns its fuel as it is
//    driven; with an empty tank it only crawls);
//  - your parking: a car left in one of the three blue bays is kept (it stays there however far
//    you go, and it is in the save).
// Nothing costs anything yet (money: ROADMAP 8.1).

const FUEL_RANGE = 14000; // metres on a full tank
const DIRT_RANGE = 9000; // metres until it is as dusty as it gets (a third of that on a wet road)
const WASH_T = 4.6;
const FILL_T = 3.2;

export const PAINTS = [
  { name: 'אדום דובדבן', c: [0.86, 0.12, 0.16] },
  { name: 'כתום שקיעה', c: [1.0, 0.5, 0.18] },
  { name: 'צהוב מונית', c: [1.0, 0.8, 0.2] },
  { name: 'ירוק דשא', c: [0.3, 0.72, 0.32] },
  { name: 'טורקיז', c: [0.1, 0.62, 0.66] },
  { name: 'תכלת', c: [0.45, 0.72, 0.98] },
  { name: 'כחול לילה', c: [0.16, 0.22, 0.58] },
  { name: 'סגול', c: [0.48, 0.24, 0.66] },
  { name: 'ורוד מסטיק', c: [1.0, 0.5, 0.72] },
  { name: 'שחור', c: [0.1, 0.1, 0.12] },
  { name: 'לבן פנינה', c: [0.95, 0.95, 0.94] },
  { name: 'כסף', c: [0.7, 0.72, 0.76] },
];

const UPS = [
  { id: 'engine', name: 'מנוע', note: 'יותר כוח ומהירות' },
  { id: 'brakes', name: 'בלמים', note: 'עוצרים מהר יותר' },
  { id: 'tires', name: 'צמיגים', note: 'אחיזה בסיבובים' },
  { id: 'armor', name: 'שריון', note: 'הרכב סופג יותר' },
];

const HOSE = [0.08, 0.08, 0.1];
const BRUSH_A = [0.25, 0.5, 1.0];
const BRUSH_B = [1.0, 0.35, 0.45];
const WATER = [0.7, 0.9, 1.0];
const FOAM = [1, 1, 1];
const RIB = [0.38, 0.4, 0.46];

export class Garage {
  constructor(game) {
    this.game = game;
    this.W = game.world.garages || null;
    this.state = null;
    this.car = null;
    this.bay = null;
    this.washT = 0;
    this.fill = null;
    this.stillT = 0;
    this.doors = [];
    this.stats = { menus: 0, washes: 0, fills: 0, kept: 0 };
    if (!this.W) return;
    // the roller doors (down while the work is done)
    const mat = makeSurface({ kind: 'box', color: srgb(0.72, 0.74, 0.8), gloss: 0.25, line: 0.7, obj: 0.4417 });
    for (const b of this.W.bays) {
      const d = b.door;
      const h = d.y1 - d.y0;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, d.z1 - d.z0), mat);
      mesh.visible = false;
      mesh.userData.noReflect = true;
      game.scene.add(mesh);
      this.doors.push({ bay: b, mesh, k: 0, want: 0, h });
    }
  }

  // the car you are in, if it is one the station can work on
  carOf() {
    const v = this.game.player.inVehicle;
    // (a bicycle, a scooter: nothing here for them, ROADMAP 4.8)
    return v && (v.kind === 'car' || (v.kind === 'bike' && !v.model)) && !v.dead && !v.materializing ? v : null;
  }

  // inside a bay's door (and not just driving past its front)
  inBay(v, b) {
    return v.pos.x > b.x0 && v.pos.x < b.door.x0 - 1.6 && v.pos.z > b.z0 + 0.2 && v.pos.z < b.z1 - 0.2;
  }

  update(dt) {
    if (!this.W) return;
    const game = this.game;
    const v = this.carOf();
    // (a car's fuel and dust, from the first time you sit in it)
    if (v) this.wear(v, dt);
    // the doors
    for (const d of this.doors) {
      const k0 = d.k;
      d.k = clamp(d.k + Math.sign(d.want - d.k) * dt / 1.4, 0, 1);
      if (Math.abs(d.want - d.k) < 0.01) d.k = d.want;
      if (k0 === 0 && d.k > 0) game.audio.play('shutter', 0.6);
      const m = d.mesh;
      m.visible = d.k > 0.01;
      if (m.visible) {
        const D = d.bay.door;
        m.scale.y = d.k;
        m.position.set(D.x0 + 0.05, D.y1 - (d.h * d.k) / 2, (D.z0 + D.z1) / 2);
      }
    }
    // the work going on: the car held still in its bay
    if (this.state) {
      const c = this.car;
      if (!c || c.dead || game.player.inVehicle !== c) return this.leave();
      c.speed = 0;
      c.speedAbs = 0;
      if (c.vx !== undefined) {
        c.vx = 0;
        c.vz = 0;
      }
      if (this.state === 'menu' && !game.dialog.open && !(game.paintshop && game.paintshop.open)) this.leave();
      else if (this.state === 'wash') this.washStep(c, dt);
      return;
    }
    if (!v) {
      this.fill = null;
      this.stillT = 0;
      return;
    }
    // the bays: stopped inside one, the work starts (once a visit)
    let here = null;
    for (const b of this.W.bays) if (this.inBay(v, b)) here = b;
    if (here !== this.bay) {
      this.bay = here;
      this.done = false;
      this.stillT = 0;
    }
    if (here && !this.done) {
      this.stillT = v.speedAbs < 0.6 ? this.stillT + dt : 0;
      if (this.stillT > 0.6) {
        this.done = true;
        this.car = v;
        if (here.kind === 'garage') this.openMenu(v);
        else this.startWash(v);
      }
    }
    // the pumps
    this.pumpStep(v, dt);
  }

  // ------------------------------------------------------------------ fuel and dust
  wear(v, dt) {
    if (v.fuel === undefined) {
      // (a drawn car comes with a full tank; one taken off the street, with what it had)
      v.fuel = v.stock ? 0.35 + Math.random() * 0.6 : 1;
      v.dirt = v.stock ? Math.random() * 0.35 : 0;
    }
    const d = (v.speedAbs || 0) * dt;
    if (d <= 0) return;
    const was = v.fuel;
    v.fuel = Math.max(0, v.fuel - d / FUEL_RANGE);
    const wet = this.game.weather ? this.game.weather.wet || 0 : 0;
    v.dirt = Math.min(1, (v.dirt || 0) + (d / DIRT_RANGE) * (1 + 2 * wet));
    const hud = this.game.hud;
    if (was >= 0.15 && v.fuel < 0.15) hud.toast('הדלק כמעט נגמר — תחנת דלק בשדרת הפלמינגו', 'bad', 3);
    if (was > 0 && v.fuel === 0) {
      hud.toast('נגמר הדלק! הרכב בקושי זז. הדרך לתחנה מסומנת', 'bad', 3.5);
      const s = this.W.station;
      if (this.game.gps) this.game.gps.set(s.x + 6, s.z + 12, 'תחנת הדלק');
    }
  }

  pumpStep(v, dt) {
    const game = this.game;
    let at = null;
    for (const p of this.W.pumps) if (Math.hypot(v.pos.x - p.x, v.pos.z - p.z) < 2.4) at = p;
    if (!at || v.speedAbs > 0.4 || v.fuel === undefined) {
      if (this.fill && this.fill.full) this.fill = null;
      if (this.fill && !this.fill.full) this.fill = null;
      return;
    }
    if (!this.fill || this.fill.pump !== at) {
      if (v.fuel > 0.985) return;
      this.fill = { pump: at, t: 0, full: false };
      game.audio.play('click', 0.6);
      this.stats.fills++;
    }
    const F = this.fill;
    if (F.full) return;
    F.t += dt;
    if (F.t > 0.5) {
      v.fuel = Math.min(1, v.fuel + dt / FILL_T);
      if ((F.pourT = (F.pourT || 0) - dt) <= 0) {
        F.pourT = 0.9;
        game.audio.play('pour', 0.45);
      }
    }
    if (v.fuel >= 1) {
      F.full = true;
      game.audio.play('ding', 0.6);
      game.hud.toast('המיכל מלא ✓', 'good', 1.8);
    }
  }

  // ------------------------------------------------------------------ the body shop
  openMenu(v) {
    const game = this.game;
    this.state = 'menu';
    this.stats.menus++;
    this.doorOf('garage').want = 0.62;
    game.audio.play('ding', 0.5);
    this.menu(v);
  }

  menu(v) {
    const game = this.game;
    const U = v.up || {};
    const n = UPS.reduce((a, u) => a + (U[u.id] || 0), 0);
    const hurt = v.hp < v.maxHp - 0.5 || (v.dmg && (v.dmg.d0 || v.dmg.glass || v.dmg.flat >= 0 || v.dmg.bumper || v.dmg.burning));
    const choices = [
      { label: `שדרוגים (${n} מתוך ${UPS.length * 3})`, fn: () => this.upgrades(v) },
      { label: hurt ? 'תיקון: פחחות, זכוכית, צמיגים' : 'תיקון (הרכב שלם)', fn: () => this.repair(v) },
      { label: 'לנסוע', fn: () => this.leave() },
    ];
    // (the paint shop is for cars: a motorbike's paint is its own)
    if (v.kind === 'car') choices.unshift({ label: 'צבע חדש וציור על הרכב', fn: () => this.paint(v) });
    game.dialog.show('מוסך INK & IRON', 'שלום! מה עושים לרכב היום? (בינתיים הכול בחינם)', choices);
  }

  paint(v) {
    const game = this.game;
    if (!game.paintshop) return this.menu(v);
    game.paintshop.show(v, (res) => {
      if (res) {
        game.audio.play('paint', 0.8);
        this.applyPaint(v, res);
        // (while the police search for you: they lose you, ROADMAP 6.4)
        if (!(game.lose && game.lose.repainted(v))) game.hud.toast('צבע חדש! ✓', 'good', 1.8);
      }
      this.menu(v);
    });
  }

  applyPaint(v, res) {
    if (res.color) {
      v.color = res.color.slice();
      if (v.stock) v.stock.color = v.color;
    }
    v.design = res.design || null;
    v.dirt = 0;
    this.game.vehicles.dirty(v);
  }

  upgrades(v) {
    const game = this.game;
    v.up = v.up || { engine: 0, brakes: 0, tires: 0, armor: 0 };
    const U = v.up;
    const choices = UPS.map((u) => {
      const l = U[u.id] || 0;
      const dots = '●'.repeat(l) + '○'.repeat(3 - l);
      return {
        label: `${u.name} ${dots} — ${l < 3 ? u.note : 'מקסימום'}`,
        fn: () => {
          if (l < 3) {
            U[u.id] = l + 1;
            this.applyUps(v);
            game.audio.play('drill', 0.6);
            game.audio.play('clang', 0.4);
            game.fx.sparks(v.pos.x, v.pos.y + 0.6, v.pos.z, 8, [1, 0.8, 0.3]);
          }
          this.upgrades(v);
        },
      };
    });
    choices.push({ label: 'חזרה', fn: () => this.menu(v) });
    game.dialog.show('מוסך INK & IRON', 'כל שדרוג בשלושה שלבים. מה לשפר?', choices);
  }

  applyUps(v) {
    const U = v.up || {};
    if (v.baseMaxHp === undefined) v.baseMaxHp = v.maxHp;
    const k = v.hp / v.maxHp;
    v.maxHp = v.baseMaxHp * (1 + 0.3 * (U.armor || 0));
    v.hp = v.maxHp * k;
  }

  repair(v) {
    const game = this.game;
    v.hp = v.maxHp;
    const D = v.dmg;
    if (D) Object.assign(D, { hp: D.hp > 100 ? D.hp : 100, d0: null, d1: null, glass: 0, flat: -1, bumper: 0, burning: false, burnT: 0, fuse: 0, burnt: false, puffT: 0 });
    game.audio.play('drill', 0.7);
    game.audio.play('clang', 0.5);
    game.hud.toast('הרכב כמו חדש ✓', 'good', 1.8);
    this.menu(v);
  }

  leave() {
    if (this.state === 'menu' && this.game.dialog.open) this.game.dialog.close(true);
    this.state = null;
    for (const d of this.doors) d.want = 0;
    this.car = null;
  }

  doorOf(kind) {
    return this.doors.find((d) => d.bay.kind === kind);
  }

  // ------------------------------------------------------------------ the wash
  startWash(v) {
    const game = this.game;
    this.state = 'wash';
    this.washT = 0;
    this.stats.washes++;
    this.doorOf('wash').want = 0.45;
    game.audio.play('sweep', 0.6);
  }

  washStep(v, dt) {
    const game = this.game;
    this.washT += dt;
    const k = this.washT / WASH_T;
    // (the dust goes as the brushes pass)
    v.dirt = Math.max(0, (v.dirt || 0) * (1 - dt * 1.2));
    if (Math.random() < dt * 9) {
      const fx = game.fx;
      const a = Math.random() * Math.PI * 2;
      fx.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', v.pos.x + Math.cos(a) * 1.2, v.pos.y + 0.6 + Math.random() * 1.0, v.pos.z + Math.sin(a) * 2.0, { size: 0.9, grow: 1.3, life: 1.1, vy: 0.3, alpha: 0.85, tint: FOAM });
    }
    if ((this.hissT = (this.hissT || 0) - dt) <= 0) {
      this.hissT = 0.7;
      game.audio.hiss(0.7, 0.12, 2400, 0.8);
    }
    if (k >= 1) {
      v.dirt = 0;
      v.shineT = game.time;
      game.audio.play('ding', 0.6);
      game.hud.toast('נקי ומבריק ✓', 'good', 1.8);
      this.leave();
    }
  }

  // what stopping here does (the prompt over the car, game.js)
  prompt() {
    if (!this.W || this.state) return null;
    const v = this.carOf();
    if (!v) return null;
    for (const b of this.W.bays) if (this.inBay(v, b) && !this.done) return b.kind === 'garage' ? 'עוצרים כאן — המוסך' : 'עוצרים כאן — שטיפה';
    if (v.fuel !== undefined && v.fuel < 0.985) for (const p of this.W.pumps) if (Math.hypot(v.pos.x - p.x, v.pos.z - p.z) < 2.4) return 'עוצרים ליד המשאבה — דלק';
    if (v.kind === 'car' && this.parked(v)) return 'E — לצאת ולהשאיר את הרכב בחניה שלכם';
    return null;
  }

  // ------------------------------------------------------------------ parking
  // a car left in one of your bays is kept; driven out, it is not
  parked(v) {
    if (!this.W || !v || v.kind !== 'car') return false;
    for (const p of this.W.parking) if (Math.abs(v.pos.x - p.x) < 2.6 && Math.abs(v.pos.z - p.z) < 1.5) return true;
    return false;
  }

  // you got out: in one of your bays? (game.js exitVehicle)
  onExit(v) {
    if (!this.W || !v) return;
    const was = !!v.kept;
    v.kept = this.parked(v);
    if (v.kept && !was) {
      this.stats.kept++;
      this.game.hud.toast('הרכב חונה בחניה שלכם ונשמר ✓', 'good', 2.4);
      this.game.audio.play('ding', 0.4);
    }
  }

  // ------------------------------------------------------------------ what you see
  draw(fr) {
    if (!this.W) return;
    const game = this.game;
    const cam = game.camera.position;
    const S = this.W.station;
    if (Math.hypot(S.x - cam.x, S.z - cam.z) > 90) return;
    // the doors' ribs
    for (const d of this.doors) {
      if (!d.mesh.visible) continue;
      const D = d.bay.door;
      const y0 = D.y1 - d.h * d.k;
      for (let y = D.y1 - 0.3; y > y0 + 0.05; y -= 0.3) fr.lineXYZ(D.x0 + 0.1, y, D.z0 + 0.1, D.x0 + 0.1, y, D.z1 - 0.1, RIB, 1.6, 700 + y * 10, 0.9, 0.003, 0);
    }
    // the hose into the car being filled
    const F = this.fill;
    const v = this.carOf();
    if (F && v && !F.full && F.t > 0.15) {
      const p = F.pump;
      const fx = Math.sin(v.yaw);
      const fz = Math.cos(v.yaw);
      // (the filler cap: at the back, on the pump's side)
      const sx = Math.sign((p.hx - v.pos.x) * -fz + (p.hz - v.pos.z) * fx) || 1;
      const half = (v.halfWid || 0.98) + 0.02;
      const cx = v.pos.x - fx * (v.halfLen || 2.3) * 0.55 - fz * half * sx;
      const cz = v.pos.z - fz * (v.halfLen || 2.3) * 0.55 + fx * half * sx;
      const cy = (v.pos.y || 0) + 0.85;
      const n = 6;
      let ax = p.hx;
      let ay = p.hy;
      let az = p.hz;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const x = p.hx + (cx - p.hx) * t;
        const z = p.hz + (cz - p.hz) * t;
        const y = p.hy + (cy - p.hy) * t - Math.sin(t * Math.PI) * 0.55;
        fr.lineXYZ(ax, ay, az, x, y, z, HOSE, 3.2, 900 + i, 1, 0.004, 0);
        ax = x;
        ay = y;
        az = z;
      }
    }
    // the wash: two brushes spinning down the car's sides, a curtain of water
    if (this.state === 'wash' && this.car) {
      const c = this.car;
      const fx = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      const t = game.time;
      const k = this.washT / WASH_T;
      const along = (Math.sin(k * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5 - 0.5) * (c.halfLen || 2.3) * 2;
      for (const s of [-1, 1]) {
        const half = (c.halfWid || 0.98) + 0.35;
        const bx = c.pos.x + fx * along - fz * half * s;
        const bz = c.pos.z + fz * along + fx * half * s;
        for (let i = 0; i < 9; i++) {
          const a = t * 9 * s + (i / 9) * Math.PI * 2;
          const r = 0.38;
          const x0 = bx + Math.cos(a) * 0.08;
          const z0 = bz + Math.sin(a) * 0.08;
          for (let y = 0.25; y < 1.8; y += 0.32) fr.lineXYZ(x0, y, z0, x0 + Math.cos(a) * r, y + 0.1, z0 + Math.sin(a) * r, i % 2 ? BRUSH_A : BRUSH_B, 2.4, 950 + i * 7 + y * 3, 0.9, 0.01, 0);
        }
      }
      for (let i = 0; i < 10; i++) {
        const u = (i / 9 - 0.5) * 2 * ((c.halfWid || 0.98) + 0.2);
        const x = c.pos.x + fx * (along + 0.4) - fz * u;
        const z = c.pos.z + fz * (along + 0.4) + fx * u;
        const ph = (t * 3 + i * 0.37) % 1;
        fr.lineXYZ(x, 3.3 - ph * 0.6, z, x, 2.3 - ph * 0.6, z, WATER, 1.4, 990 + i, 0.55, 0.005, 0);
      }
      flashLight(c.pos.x, 2.6, c.pos.z, 7, WATER, 0.6);
    }
  }
}
