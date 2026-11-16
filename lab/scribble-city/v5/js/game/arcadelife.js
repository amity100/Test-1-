import * as THREE from 'three';
import { Kit, linC } from './items.js';
import { clubMats } from './venuekit.js';
import { GAMES, clawGeo, toyParts } from './arcade.js';
import { ClawGame } from './minigames/arcade/claw.js';
import { worldAt } from '../ui/minigame.js';
import { CAB_GAMES } from '../world/arcaderoom.js';
import { tr } from '../core/lang.js';

// (v5, ROADMAP 26) The arcade's people at play, and yours (world/arcaderoom.js; game/shoplife.js, the flow 'arcade').
//
// - The people come for a game or three: to a free cabinet, their hands on the stick and the buttons, a while at it - now and
//   then a cheer, a groan, a new high score; or to a claw machine, the claw down, and sometimes a soft toy won and carried out.
// - You: E at a cabinet - its game, on its screen, the camera over your shoulder (ui/minigame.js world mode), $1 or a token;
//   the claw machine - the claw moved by your hand, down, and whatever it holds to the chute (game/minigames/arcade/claw.js);
//   the token machine - six tokens for $5; the prize counter - the tickets the games paid out turned into prizes. The tickets
//   and the prizes are INK ARCADE's (game/arcade.js): one count, both places.

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const SAY = {
  start: ['Okay, one more.', 'My machine!', 'Let\'s go!', 'Watch this.'],
  mid: ['Come on, come on...', 'No no no!', 'Yes!', 'Get out of the way!', 'So close!'],
  win: ['NEW HIGH SCORE!', 'Ha! Beat that!', 'Yes! Yes!'],
  lose: ['Game over... again.', 'That was rigged.', 'Ugh!'],
  claw: ['It\'s got it... it\'s got it...', 'Drop, drop!', 'Oh, come ON.'],
  clawWin: ['I GOT IT!', 'Look! I won!'],
};
const TOY = [linC(1, 0.45, 0.7), linC(0.45, 0.9, 1), linC(1, 0.88, 0.4), linC(0.6, 1, 0.5), linC(0.75, 0.55, 1), linC(1, 0.6, 0.3)];
const TOY_NAMES = [tr('ארנב ורוד', 'Pink rabbit'), tr('דוב תכלת', 'Light blue bear'), tr('אפרוח צהוב', 'Yellow chick'), tr('צפרדע ירוקה', 'Green frog'), tr('חתול סגול', 'Purple cat'), tr('שועל כתום', 'Orange fox')];
const TOKEN_PACK = { n: 6, price: 5 };

export class ArcadeLife {
  static for(life) {
    return life.prof && life.prof.flow === 'arcade' ? new ArcadeLife(life) : null;
  }

  constructor(life) {
    this.life = life;
    this.game = life.game;
    this.M = life.marks;
    this.t = 0;
    // the cabinets: where to stand, the screen; the claw machines: where to stand, the middle of the box
    this.cabs = [];
    this.claws = [];
    for (const [k, m] of Object.entries(this.M)) {
      const c = /^cab\.(\d+)$/.exec(k);
      if (c && this.M[`scr.${c[1]}`]) {
        const scr = this.M[`scr.${c[1]}`];
        const n = [Math.sin(scr.yaw), Math.cos(scr.yaw)];
        this.cabs.push({ i: +c[1], game: CAB_GAMES[+c[1] % CAB_GAMES.length], stand: m, scr, n, v: null });
      }
      const w = /^claw\.(\d+)$/.exec(k);
      if (w && this.M[`clawc.${w[1]}`]) {
        const at = this.M[`clawc.${w[1]}`];
        const n = [Math.sin(at.yaw), Math.cos(at.yaw)];
        this.claws.push({ i: +w[1], stand: m, at, n, v: null });
      }
    }
    this.group = new THREE.Group();
    this.group.name = 'arcade claws';
    this.buildClaws();
    this.game.scene.add(this.group);
  }

  say(c, text, chance = 1) {
    if (c && text) this.life.say(c, text, chance);
  }

  has(svc) {
    return svc === 'play' || svc === 'claw';
  }

  // what a customer comes for: a game or three, now and then the claw
  plan(v, list) {
    if (!this.cabs.length && !this.claws.length) return;
    const n = 1 + Math.floor(Math.random() * 3);
    const out = [];
    for (let i = 0; i < n; i++) out.push({ svc: this.claws.length && Math.random() < 0.28 ? 'claw' : 'play' });
    list.splice(0, list.length, ...out);
  }

  decide() {
    return false;
  }

  release(v) {
    for (const c of this.cabs) if (c.v === v) c.v = null;
    for (const c of this.claws) if (c.v === v) c.v = null;
    // (a toy won and carried: gone with them)
    if (v.L && v.L.keepToy) {
      this.life.movers.remove(v.L.keepToy);
      v.L.keepToy = null;
    }
  }

  leave(v) {
    const L = v.L;
    const c = v.c;
    c.fig.reachR = null;
    c.fig.reachL = null;
    c.fig.lookAt = null;
    if (L.S && L.S.at) L.S.at.v = null;
    if (L.S && L.S.toy) this.life.movers.remove(L.S.toy);
    L.S = null;
    L.st = 'next';
    L.t = 0;
    return null;
  }

  visit(v, dt) {
    const L = v.L;
    const S = L.S || (L.S = { st: 'go', t: 0 });
    S.t += dt;
    return this.play(v, S, dt, L.svc === 'claw');
  }

  // a game at a cabinet, or a go at a claw machine: walked to it, the hands on it, a while, a word now and then
  play(v, S, dt, claw) {
    const c = v.c;
    const f = c.fig;
    const life = this.life;
    switch (S.st) {
      case 'go': {
        const free = (claw ? this.claws : this.cabs).filter((q) => !q.v);
        if (!free.length) return this.leave(v);
        // (the nearest few, one of them)
        free.sort((p, q) => Math.hypot(p.stand.x - c.pos.x, p.stand.z - c.pos.z) - Math.hypot(q.stand.x - c.pos.x, q.stand.z - c.pos.z));
        S.at = pick(free.slice(0, 3));
        S.at.v = v;
        S.st = 'walk';
        life.go(v, S.at.stand.x, S.at.stand.z);
        return null;
      }
      case 'walk': {
        const mv = life.open.follow(v);
        if (mv) return mv;
        S.st = 'at';
        S.t = 0;
        S.dur = claw ? 9 + Math.random() * 6 : 16 + Math.random() * 22;
        if (Math.random() < 0.5) this.say(c, pick(SAY.start), 0.5);
        life.open.sound('coins', 0.25, 7);
        return null;
      }
      case 'at': {
        const A = S.at;
        const n = A.n;
        // facing it, the hands on the stick and the buttons (the panel is half a metre out of the screen, at the hip)
        c.faceYaw = Math.atan2(-n[0], -n[1]);
        const px = (claw ? A.at.x : A.scr.x) + n[0] * (claw ? 0.6 : 0.5);
        const pz = (claw ? A.at.z : A.scr.z) + n[1] * (claw ? 0.6 : 0.5);
        const py = A.stand.y + (claw ? 0.98 : 1.05);
        const rx = n[1];
        const rz = -n[0];
        const jig = Math.sin(S.t * 9 + v.L.seed * 7) * 0.025;
        // (each their own points: two playing side by side would share one otherwise)
        S.hl = S.hl || new THREE.Vector3();
        S.hr = S.hr || new THREE.Vector3();
        f.reachL = S.hl.set(px - rx * 0.16 + jig, py, pz - rz * 0.16);
        f.reachR = S.hr.set(px + rx * 0.14, py + (Math.sin(S.t * 13) > 0.6 ? -0.02 : 0), pz + rz * 0.14);
        f.lookAt = null;
        if (!S.said && S.t > S.dur * 0.45) {
          S.said = true;
          this.say(c, pick(claw ? SAY.claw : SAY.mid), 0.5);
          if (!claw && Math.random() < 0.5) life.open.sound('ding', 0.15, 6);
        }
        if (S.t < S.dur) return null;
        f.reachR = null;
        f.reachL = null;
        if (claw) {
          // (a toy won now and then: carried out in the arms)
          if (Math.random() < 0.3) {
            this.say(c, pick(SAY.clawWin), 0.9);
            S.toy = life.movers.add({ line: 'toy', model: 'teddy', cell: null, tint: pick([[0.98, 0.8, 0.85], [0.6, 0.75, 0.95], [0.98, 0.95, 0.4], [0.6, 0.85, 0.6]]), cap: [0.92, 0.26, 0.3] }, true);
            S.toy.at = { c, how: 'carried' };
            v.L.keepToy = S.toy;
            S.toy = null;
          }
        } else this.say(c, pick(Math.random() < 0.35 ? SAY.win : SAY.lose), 0.35);
        A.v = null;
        S.at = null;
        return this.leave(v);
      }
      default:
        return this.leave(v);
    }
  }

  // ---------------------------------------------------------------- the claws
  // each machine's claw, home over its chute (the front right corner of the box); moved by the claw game while it is played
  buildClaws() {
    if (!this.claws.length) return;
    const CM = clubMats();
    this.clawGeo = [clawGeo(CM, 1), clawGeo(CM, 0)];
    for (const c of this.claws) {
      c.box = { u0: -0.33, u1: 0.33, d0: -0.34, d1: 0.24 };
      c.chute = [0.28, 0.24];
      c.top = c.at.y + 0.42;
      c.floor = c.at.y - 0.42;
      c.claw = { u: c.chute[0], d: c.chute[1], y: c.top, open: 1 };
      c.mesh = new THREE.Mesh(this.clawGeo[0].geometry, CM.metal);
      c.mesh.frustumCulled = false;
      this.group.add(c.mesh);
      // (what is in it, for the game: where each toy lies - the soft toys seen there are the room's own)
      c.toys = [];
      for (let i = 0; i < 9; i++) {
        const k = (i + c.i) % TOY.length;
        c.toys.push({ u: c.box.u0 + 0.06 + ((i * 0.37) % 1) * (c.box.u1 - c.box.u0 - 0.12), d: c.box.d0 + 0.06 + ((i * 0.61 + 0.2) % 1) * (c.box.d1 - c.box.d0 - 0.16), y: c.floor + 0.1, col: TOY[k], name: TOY_NAMES[k], r: 0.075 });
      }
      this.placeClaw(c);
    }
  }

  // the machine's own frame: u across (to its right, seen from the front), d out of its front
  at(c, u, d) {
    const [nx, nz] = c.n;
    return [c.at.x + nz * u + nx * d, c.at.z - nx * u + nz * d];
  }

  placeClaw(c) {
    const [x, z] = this.at(c, c.claw.u, c.claw.d);
    c.mesh.position.set(x, c.claw.y, z);
    c.mesh.rotation.y = Math.atan2(c.n[0], c.n[1]);
    c.mesh.geometry = this.clawGeo[c.claw.open > 0.5 ? 0 : 1].geometry;
    const held = c.toys.find((t) => t.held);
    if (held && held.mesh) held.mesh.position.set(x, c.claw.y - 0.16, z);
    c.mesh.updateMatrixWorld();
  }

  rig(c) {
    const self = this;
    return {
      box: c.box,
      chute: c.chute,
      top: c.top,
      floor: c.floor,
      toys: c.toys,
      claw: c.claw,
      set(u, d, y, open) {
        c.claw.u = u;
        c.claw.d = d;
        c.claw.y = y;
        c.claw.open = open;
        self.placeClaw(c);
      },
      grab(t) {
        t.held = true;
        const K = new Kit();
        toyParts(K, clubMats(), 0, 0, 0, t.r, t.col);
        t.mesh = K.build({ seed: 0.9 });
        t.mesh.matrixAutoUpdate = true;
        self.group.add(t.mesh);
        self.placeClaw(c);
      },
      drop(t, u, d) {
        self.dropMesh(t);
        t.held = false;
        t.u = u;
        t.d = d;
      },
      won(t) {
        self.dropMesh(t);
        t.held = false;
      },
    };
  }

  dropMesh(t) {
    if (!t.mesh) return;
    this.group.remove(t.mesh);
    t.mesh.traverse((o) => o.isMesh && o.geometry.dispose());
    t.mesh = null;
  }

  // ---------------------------------------------------------------- you
  // what is in front of you: a cabinet, a claw machine, the token machine, the prize counter
  target(p) {
    const g = this.game;
    if (g.minigames && g.minigames.isOpen) return null;
    const near = (m, r) => m && Math.hypot(p.pos.x - m.x, p.pos.z - m.z) < r;
    const tok = g.player.tokens || 0;
    const cost = tok > 0 ? tr(`אסימון · נשארו ${tok}`, `1 token · ${tok} left`) : '$1';
    for (const c of this.cabs) if (!c.v && near(c.stand, 0.6)) return { arcade: true, cab: c, label: tr(`E — לשחק ב־${GAMES[c.game].name} (${cost})`, `E — play ${GAMES[c.game].name} (${cost})`) };
    for (const c of this.claws) if (!c.v && near(c.stand, 0.65)) return { arcade: true, claw: c, label: tr(`E — מכונת המנוף (${cost})`, `E — the claw machine (${cost})`) };
    if (near(this.M.tokens, 0.9)) return { arcade: true, tokens: true, label: tr(`E — ${TOKEN_PACK.n} אסימונים ב־$${TOKEN_PACK.price}`, `E — ${TOKEN_PACK.n} tokens for $${TOKEN_PACK.price}`) };
    const tickets = g.arcade ? g.arcade.tickets : 0;
    const ps = this.life.room.pay;
    if (near(this.M.prizes, 0.9) || (tickets > 0 && near(ps, 1.2))) return { arcade: true, prizes: true, label: tr(`E — דלפק הפרסים (${tickets} כרטיסים)`, `E — the prize counter (${tickets} tickets)`) };
    return null;
  }

  // a play costs a token if you have one, else a dollar
  pay(name) {
    const g = this.game;
    const p = g.player;
    if ((p.tokens || 0) > 0) {
      p.tokens--;
      g.audio.play('coins', 0.35);
      return true;
    }
    if (!g.money || g.money.pay(1, name)) {
      g.audio.play('coins', 0.4);
      return true;
    }
    g.money.refuse(name, 1);
    return false;
  }

  act(t) {
    const g = this.game;
    if (t.tokens) {
      if (g.money && !g.money.pay(TOKEN_PACK.price, 'TOKENS')) {
        g.money.refuse('TOKENS', TOKEN_PACK.price);
        return;
      }
      g.player.tokens = (g.player.tokens || 0) + TOKEN_PACK.n;
      g.audio.play('coins', 0.7);
      g.hud.toast(tr(`קלינק-קלינק: ${TOKEN_PACK.n} אסימונים בכיס (יש לכם ${g.player.tokens})`, `Clink-clink: ${TOKEN_PACK.n} tokens in your pocket (you have ${g.player.tokens})`), 'good', 2.6);
      return;
    }
    if (t.prizes) {
      if (g.arcade) g.arcade.prizeMenu();
      return;
    }
    if (!g.minigames) return;
    if (t.cab) {
      const c = t.cab;
      const G = GAMES[c.game];
      if (!this.pay(G.name)) return;
      const n = c.n;
      const S = c.scr;
      const world = worldAt({ at: [S.x, S.y, S.z], n, w: 0.6, h: 0.5, stand: 0.84, y0: c.stand.y, back: 0.42, up: 2.05, camSide: 0.36, fov: 40, glow: 1.1, exit: [c.stand.x + n[0] * 0.3, c.stand.z + n[1] * 0.3, Math.atan2(-n[0], -n[1])] });
      c.v = 'you';
      g.minigames.play(new G.cls({ cab: G.name, fee: 1 }), (r) => {
        c.v = null;
        if (g.arcade) g.arcade.paid(r || {}, G.name);
      }, { world });
      return;
    }
    if (t.claw) {
      const c = t.claw;
      if (!this.pay('CLAW-SOME')) return;
      const n = c.n;
      const world = worldAt({ at: [c.at.x, c.at.y, c.at.z], n, w: 0.9, h: 0.6, hidden: true, stand: 1.2, y0: c.stand.y, back: 0.3, up: 2.2, camSide: 0.46, fov: 52, exit: [c.stand.x + n[0] * 0.3, c.stand.z + n[1] * 0.3, Math.atan2(-n[0], -n[1])] });
      c.v = 'you';
      g.minigames.play(new ClawGame({ rig: this.rig(c) }), (r) => {
        c.v = null;
        c.claw.u = c.chute[0];
        c.claw.d = c.chute[1];
        c.claw.y = c.top;
        c.claw.open = 1;
        this.placeClaw(c);
        if (r && r.prize) {
          if (g.arcade) g.arcade.keep({ kind: 'plush', name: r.prize, from: 'CLAW-SOME' });
          g.hud.big('YOU GOT IT!', 1800);
          g.hud.toast(tr(`תפסתם ${r.prize}! הוא נשמר באוסף הפרסים שלכם, לבית`, `You caught ${r.prize}! It's kept in your prize collection, for home`), 'good', 3.5);
        } else g.hud.toast(tr('המנוף החליק... עוד ניסיון?', 'The claw slipped... another try?'), 'info', 2.5);
      }, { world });
    }
  }

  update(dt) {
    this.t += dt;
  }

  dispose() {
    for (const c of this.claws) for (const t of c.toys || []) this.dropMesh(t);
    if (this.group.parent) this.group.parent.remove(this.group);
    this.group.traverse((o) => {
      if (o.isMesh && o.geometry && (!this.clawGeo || !this.clawGeo.some((q) => q.geometry === o.geometry))) o.geometry.dispose();
    });
    if (this.clawGeo) for (const q of this.clawGeo) q.geometry.dispose();
  }
}
