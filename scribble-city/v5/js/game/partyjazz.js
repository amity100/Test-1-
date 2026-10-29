import * as THREE from 'three';
import { Kit, linC } from './items.js';
import { clubMats, pictureGeo } from './venuekit.js';
import { flashLight, makeSurface, canvasTexture } from '../render/materials.js';
import { barLook, BAR_STYLE_NAMES, civilianLook, bartenderLook, modest } from './looks.js';
import { venueFrame, PartySound, drawPeople } from './partykit.js';
import { paintPosters } from './partyart.js';
import { jazzPlan } from '../world/jazzplan.js';

// (v5, ROADMAP 12.9) BLUE VELVET's night: a jazz club on Inkwood Boulevard. Its room is laid out as
// one (world/jazzplan.js, world/venues2.js: the bandstand before the velvet curtain, the parquet,
// the round tables with their candles, the bar, the booths); here, near you, what makes it a night:
// the band - the grand piano and its pianist, the drummer behind the kit, the upright bass, the
// saxophone, the singer at the old microphone - playing (core/music.js: jazz, and a slow one now
// and then), the spots on them through the haze; couples dancing slow on the parquet; the tables
// full, a glass raised, the room applauding at the end of every song; the waiter going round with
// his tray; the posters of the legends who played here on the walls. Ask the band for a song, or
// tip them and hear them play for you.

const NEAR = 60;
const BARS = 32;
const R = Math.random;
const GOLD = linC(0.85, 0.65, 0.25);
const BLACK = linC(0.02, 0.02, 0.025);
const WOOD = linC(0.42, 0.2, 0.08);
const CHROME = linC(0.75, 0.76, 0.8);

export class JazzNight {
  constructor(game, key) {
    this.game = game;
    this.F = venueFrame(key);
    this.J = this.F ? jazzPlan(this.F) : null;
    this.set = null;
    this.crowd = [];
    this.t = 0;
    this.beat = 0;
    this.lastN = 0;
    this.clap = 0;
    this.sound = new PartySound(game, { styles: ['jazz', 'jazz', 'lofi'], bars: BARS, seed: 31 });
  }

  owns(shop) {
    return !!(this.set && shop && this.F && shop.name === this.F.name);
  }

  open() {
    const Rh = this.game.rhythm;
    return !Rh || Rh.open('club');
  }

  // ------------------------------------------------------------------ the band's instruments, the posters
  build() {
    const g = this.game;
    const F = this.F;
    const J = this.J;
    const CM = clubMats('club');
    const K = new Kit();
    const { y0 } = F;
    const top = y0 + J.stage.h;
    const P = (u, y, d) => F.P(u, y, d);
    const B = (u0, ya, d0, u1, yb, d1, mat, c) => K.box(mat, F.x(Math.min(d0, d1)), ya, F.z(Math.max(u0, u1)), F.x(Math.max(d0, d1)), yb, F.z(Math.min(u0, u1)), c);
    const CYL = (u, d, r, ya, yb, mat, c, segs = 12, r1 = r) => K.cyl(mat, r, r1, ya, yb, c, { axis: 'y', x: F.x(d), z: F.z(u), segs });
    // a drum on its side, its face to the room (+d: the world's +x)
    const drumX = (u, y, d, r, len, c) => {
      const geo = new THREE.CylinderGeometry(r, r, len, 18);
      geo.rotateZ(Math.PI / 2);
      const p = P(u, y, d);
      geo.translate(p[0], p[1], p[2]);
      K.add(CM.paint, geo, c);
    };
    // ---- the grand piano: its curved body, the lid up on its stick, the keys, the legs, the bench
    {
      const { u, d } = J.band.piano;
      const pu = u;
      const pd = d;
      B(pu - 0.75, top + 0.62, pd - 0.75, pu + 0.75, top + 0.95, pd + 0.6, CM.paint, BLACK);
      CYL(pu + 0.15, pd - 0.75, 0.6, top + 0.62, top + 0.95, CM.paint, BLACK, 18);
      // (the keyboard on the side towards the pianist: the room's -u)
      B(pu - 0.95, top + 0.72, pd - 0.7, pu - 0.75, top + 0.8, pd + 0.55, CM.matte, linC(0.95, 0.94, 0.9));
      for (let k = 0; k < 14; k++) B(pu - 0.95, top + 0.8, pd - 0.65 + k * 0.088, pu - 0.86, top + 0.82, pd - 0.62 + k * 0.088, CM.matte, BLACK);
      // the lid, up at an angle (a thin box turned on the keyboard's far edge)
      const lid = new THREE.BoxGeometry(1.5, 0.03, 1.5);
      lid.rotateZ(0.0);
      lid.rotateX(-0.75);
      const lp = P(pu, top + 1.32, pd - 0.25);
      lid.translate(lp[0], lp[1], lp[2]);
      K.add(CM.paint, lid, BLACK);
      for (const [lu, ld] of [[-0.6, -0.6], [0.6, -0.6], [0.0, 0.45]]) CYL(pu + lu, pd + ld, 0.06, top, top + 0.62, CM.paint, BLACK, 8);
      B(pu - 1.55, top, pd - 0.45, pu - 1.2, top + 0.48, pd + 0.35, CM.paint, BLACK);
    }
    // ---- the drum kit: the bass drum with the club's name, the snare, the toms, the cymbals, the hi-hat
    {
      const { u, d } = J.band.drums;
      drumX(u, top + 0.3, d, 0.3, 0.42, linC(0.12, 0.2, 0.6));
      // (its face: the name, a circle of white)
      const face = new THREE.CircleGeometry(0.27, 20);
      face.rotateY(Math.PI / 2);
      const fp = P(u, top + 0.3, d + 0.215);
      face.translate(fp[0], fp[1], fp[2]);
      K.add(CM.matte, face, linC(0.92, 0.9, 0.84));
      CYL(u - 0.5, d + 0.15, 0.17, top + 0.55, top + 0.7, CM.paint, linC(0.85, 0.85, 0.88), 14);
      CYL(u - 0.5, d + 0.15, 0.015, top, top + 0.55, CM.metal, CHROME, 4);
      for (const [du, dd, r] of [[-0.18, 0.05, 0.12], [0.18, 0.05, 0.13]]) CYL(u + du, d + dd, r, top + 0.7, top + 0.86, CM.paint, linC(0.12, 0.2, 0.6), 12);
      CYL(u + 0.5, d + 0.05, 0.2, top + 0.3, top + 0.55, CM.paint, linC(0.12, 0.2, 0.6), 14);
      for (const [du, dd, h, r] of [[-0.7, -0.05, 1.25, 0.22], [0.75, -0.2, 1.4, 0.26], [-0.62, 0.32, 0.95, 0.17]]) {
        CYL(u + du, d + dd, 0.012, top, top + h, CM.metal, CHROME, 4);
        CYL(u + du, d + dd, r, top + h, top + h + 0.012, CM.metal, GOLD, 18, r * 0.2);
      }
      CYL(u, d - 0.55, 0.2, top, top + 0.45, CM.paint, linC(0.1, 0.1, 0.12), 12);
    }
    // ---- the upright bass, standing on its spike; its neck, the scroll
    {
      const { u, d } = J.band.bass;
      const [bx, , bz] = P(u, 0, d);
      K.sphere(CM.paint, 0.36, bx, top + 0.62, bz, WOOD, 0.62, 1.1, 0.32, 14);
      K.sphere(CM.paint, 0.28, bx, top + 1.02, bz, WOOD, 0.62, 0.95, 0.3, 12);
      K.box(CM.paint, bx - 0.025, top + 1.1, bz - 0.03, bx + 0.025, top + 1.85, bz + 0.03, BLACK);
      K.sphere(CM.paint, 0.05, bx, top + 1.88, bz, WOOD, 1, 1.2, 0.8, 8);
      K.cyl(CM.metal, 0.01, 0.01, top, top + 0.2, CHROME, { axis: 'y', x: bx, z: bz, segs: 4 });
    }
    // ---- the singer's microphone, an old one of chrome on its stand
    {
      const { u, d } = J.band.singer;
      const md = d + 0.32;
      CYL(u, md, 0.14, top, top + 0.03, CM.metal, CHROME, 12);
      CYL(u, md, 0.012, top, top + 1.52, CM.metal, CHROME, 6);
      const [mx, , mz] = P(u, 0, md);
      K.sphere(CM.metal, 0.055, mx, top + 1.58, mz, CHROME, 0.9, 1.25, 0.9, 10);
    }
    // ---- the saxophone, in the player's hands: the body down, the bell up, the neck to the mouth
    {
      const { u, d } = J.band.sax;
      const [sx, , sz] = P(u, 0, d + 0.3);
      K.cyl(CM.metal, 0.035, 0.05, top + 0.85, top + 1.35, GOLD, { axis: 'y', x: sx, z: sz, segs: 8 });
      K.cyl(CM.metal, 0.05, 0.1, top + 0.85, top + 1.0, GOLD, { axis: 'y', x: sx + 0.1, z: sz, segs: 10 });
      K.sphere(CM.metal, 0.06, sx + 0.05, top + 0.84, sz, GOLD, 1.4, 0.8, 1, 8);
    }
    const group = K.build({ seed: 0.52 });
    // ---- the posters of the legends, in gold frames: on the front wall and the back's corners
    const pp = paintPosters(g.touch ? 384 : 768, g.touch ? 288 : 576);
    this.posterTex = canvasTexture(pp.c, { mips: true });
    this.posterMat = makeSurface({ kind: 'uv', map: this.posterTex, uvScale: 1, ang: 0.4, wash: 0.92, line: 0.2, indoor: 'club', emissive: new THREE.Color(0.25, 0.22, 0.18), emMap: this.posterTex });
    const KF = new Kit();
    const spots = [[F.ub - 9.5, F.da - 0.05, -1, 0], [F.ub - 6.5, F.da - 0.05, -1, 0], [F.ub - 12.5, F.da - 0.05, -1, 0], [F.ua + 2.4, F.db + 0.05, 1, 0], [F.ub - 2.4, F.db + 0.05, 1, 0], [F.ub - 15.5, F.da - 0.05, -1, 0]];
    spots.forEach(([u, d, nx, nz], i) => {
      const p = P(u, y0 + 2.3, d);
      const m = new THREE.Mesh(pictureGeo(1.05, 1.4, p[0] + nx * 0.03, p[1], p[2], nx, nz, pp.boxes[i % pp.boxes.length]), this.posterMat);
      m.frustumCulled = false;
      group.add(m);
      KF.box(CM.metal, p[0] - 0.02, p[1] - 0.78, p[2] - 0.6, p[0] + 0.02, p[1] + 0.78, p[2] + 0.6, GOLD);
    });
    for (const mm of KF.build({ seed: 0.3 }).children.slice()) group.add(mm);
    this.mats = [this.posterMat];
    this.texs = [this.posterTex];
    group.updateMatrix();
    g.scene.add(group);
    this.set = group;
    this.makeCrowd();
  }

  teardown() {
    const g = this.game;
    if (this.set) {
      g.scene.remove(this.set);
      this.set.traverse((o) => {
        if (o.isMesh) o.geometry.dispose();
      });
    }
    for (const t of this.texs || []) t.dispose();
    for (const m of this.mats || []) m.dispose();
    this.texs = [];
    this.mats = [];
    this.set = null;
    this.crowd = [];
    this.sound.stop();
  }

  // ------------------------------------------------------------------ the people
  makeCrowd() {
    const g = this.game;
    const F = this.F;
    const J = this.J;
    const N = g.touch ? 0.45 : 1;
    const list = [];
    const top = F.y0 + J.stage.h;
    const yawOf = (fu, fd) => Math.atan2(fd, -fu);
    const person = (u, d, yaw, at, o = {}) => {
      const look = o.look || barLook(BAR_STYLE_NAMES[Math.floor(R() * BAR_STYLE_NAMES.length)]);
      const [x, y, z] = F.P(u, o.y || F.y0, d);
      list.push({ x, z, y, y0: y, look, scale: look.build.height, yaw, yaw0: yaw, speed: 0, phase: R() * 6, seed: R() * 100, cheer: 0, sit: 0, at, indoor: 3, hop: R(), ...o });
    };
    // the band, dressed for it
    const suit = (fem, col) => {
      const L = modest(civilianLook({ fem, kind: fem ? 'dress' : 'smart', pen: 'fineliner' }));
      if (!fem) L.top = { kind: 'jacket', color: col, sleeves: 'long', inner: [0.95, 0.94, 0.9] };
      return L;
    };
    const b = J.band;
    person(b.pianist.u, b.pianist.d, yawOf(...b.pianist.face), 'piano', { look: suit(false, [0.08, 0.08, 0.1]), y: top, sit: 1 });
    person(b.drummer.u, b.drummer.d, yawOf(...b.drummer.face), 'drums', { look: suit(false, [0.2, 0.22, 0.35]), y: top, sit: 1 });
    person(b.bassist.u, b.bassist.d, yawOf(...b.bassist.face), 'bass', { look: suit(false, [0.3, 0.12, 0.1]), y: top });
    person(b.sax.u, b.sax.d, yawOf(...b.sax.face), 'sax', { look: suit(false, [0.12, 0.16, 0.42]), y: top });
    const diva = modest(civilianLook({ fem: true, kind: 'dress', pen: 'gelPurple' }));
    diva.top = { kind: 'dress', color: [0.12, 0.2, 0.7], sleeves: 'long' };
    diva.bottom = { kind: 'midi', color: [0.12, 0.2, 0.7] };
    person(b.singer.u, b.singer.d, yawOf(...b.singer.face), 'sing', { look: modest(diva), y: top });
    // the tables: two of the three chairs (the third is for whoever comes in - game/venuelife.js)
    J.tables.forEach((t) => {
      for (const c of t.chairs.slice(1)) if (R() < 0.78 * N + 0.1) person(c.u, c.d, yawOf(...c.face), 'table', { sit: 1 });
    });
    // couples on the parquet, slow
    const fl = J.floor;
    for (let k = 0; k < (g.touch ? 2 : 4); k++) {
      const u = fl.u0 + 0.8 + R() * (fl.u1 - fl.u0 - 1.6);
      const d = fl.d0 + 2.0 + R() * (fl.d1 - fl.d0 - 2.6);
      const a = R() * Math.PI * 2;
      const du = Math.cos(a) * 0.3;
      const dd = Math.sin(a) * 0.3;
      person(u + du, d + dd, yawOf(-du, -dd), 'couple', { look: barLook(BAR_STYLE_NAMES[k % BAR_STYLE_NAMES.length], { fem: true }) });
      person(u - du, d - dd, yawOf(du, dd), 'couple', { look: barLook(BAR_STYLE_NAMES[(k + 3) % BAR_STYLE_NAMES.length], { fem: false }) });
    }
    // at the bar, standing behind the stools
    for (let d = J.floor.d0; d < F.da - 3.2; d += 0.8) if (R() < 0.4 * N) person(F.ub - 3.2 + (R() - 0.5) * 0.3, d, Math.PI, 'bar');
    // the waiter going round with his tray; the host at the door
    const w = bartenderLook();
    person(F.mid, J.floor.d1 + 0.5, Math.PI / 2, 'waiter', { look: w, tray: true, uMin: F.ua + 4, uMax: F.ub - 5, dir: 1, v: 0.7 });
    this.crowd = list;
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const g = this.game;
    const F = this.F;
    if (!F || this.failed) return;
    const ml = g.world.mainland;
    const p = g.player.pos;
    const built = !!(ml && ml.blocks && ml.blocks.has(F.block.id));
    const dist = Math.hypot(p.x - F.cx, p.z - F.cz);
    if (!this.set && built && dist < NEAR) {
      try {
        this.build();
      } catch (e) {
        console.error('[jazz]', e);
        this.failed = true;
        this.teardown();
        return;
      }
    }
    if (this.set && (!built || dist > NEAR + 30)) this.teardown();
    if (!this.set) return;
    this.t += dt;
    const on = this.open();
    this.on = on;
    const cam = g.camera.position;
    const inCam = F.inside(cam.x, cam.z, 0.3);
    const inP = F.inside(p.x, p.z);
    this.inCam = inCam;
    const dd = Math.hypot(cam.x - F.door[0], cam.z - F.door[1]);
    const near = inCam || inP || dd < 30;
    const S = this.sound;
    if (on && near && !S.band) S.start();
    if (S.band && (!on || !near)) S.stop();
    const playing = !!(g.minigames && g.minigames.isOpen);
    if (S.band && S.c && S.c.state === 'running') {
      S.update(playing ? 0 : inCam ? 0.32 : 0.14 * Math.max(0, 1 - dd / 30), inCam ? 9000 : 800);
      this.beat = S.beat;
      // (a song ended: the room applauds)
      if (S.n !== this.lastN) {
        if (this.lastN && inCam) this.applause();
        this.lastN = S.n;
      }
    } else {
      this.beat = this.t * (96 / 60);
      const n = Math.floor(this.beat / (BARS * 4));
      if (n !== this.lastN) {
        if (inCam) this.applause();
        this.lastN = n;
      }
    }
    if (inP && !this.welcomed && on) {
      this.welcomed = true;
      g.hud.big(F.name, 2000);
      g.hud.toast('להקת ג׳אז חיה הלילה. E ליד הבמה כדי לבקש שיר או לתת טיפ ללהקה; הברמן מכין קוקטיילים', 'info', 5);
    }
    if (!inP && dist > 40) this.welcomed = false;
    if (this.clap > 0) this.clap -= dt;
    if (inCam || inP) this.animate(dt);
  }

  applause() {
    this.clap = 3;
    this.game.audio.play('cheer', 0.3);
  }

  animate(dt) {
    const b = this.beat;
    const t = this.t;
    const swing = Math.abs(Math.sin(Math.PI * b));
    const on = this.on;
    const F = this.F;
    for (const w of this.crowd) {
      if (!on) {
        w.cheer = 0;
        continue;
      }
      const clap = this.clap > 0 ? (Math.floor(t * 6 + w.hop * 3) % 2 ? 0.95 : 0.6) : 0;
      if (w.at === 'piano') {
        w.cheer = 0.32 + 0.12 * Math.abs(Math.sin(t * 7 + w.seed));
        w.yaw = w.yaw0 + Math.sin(b * 0.5) * 0.08;
      } else if (w.at === 'drums') {
        w.cheer = 0.3 + 0.35 * swing;
        w.y = w.y0 + swing * 0.02;
      } else if (w.at === 'bass') {
        w.cheer = 0.28;
        w.yaw = w.yaw0 + Math.sin(b * Math.PI * 0.25) * 0.18;
        w.y = w.y0 + swing * 0.015;
      } else if (w.at === 'sax') {
        w.cheer = 0.55 + 0.15 * Math.sin(b * 0.7);
        w.yaw = w.yaw0 + Math.sin(b * Math.PI * 0.25 + 1) * 0.3;
      } else if (w.at === 'sing') {
        w.cheer = this.clap > 0 ? 0.9 : 0.2 + 0.35 * Math.abs(Math.sin(b * Math.PI * 0.125));
        w.yaw = w.yaw0 + Math.sin(b * Math.PI * 0.125) * 0.25;
      } else if (w.at === 'couple') {
        w.cheer = 0.3;
        w.yaw = w.yaw0 + Math.sin(t * 0.9 + w.seed * 0.1) * 0.35;
        w.y = w.y0 + swing * 0.02;
      } else if (w.at === 'table' || w.at === 'bar') {
        w.cheer = clap || (Math.sin(t * 0.6 + w.seed * 4) > 0.93 ? 0.5 : 0);
      } else if (w.at === 'waiter') {
        if (w.pause > 0) {
          w.pause -= dt;
          w.speed = 0;
        } else {
          const u = F.U(w.z) + w.dir * w.v * dt;
          const [x, , z] = F.P(u, 0, F.D(w.x));
          w.x = x;
          w.z = z;
          w.speed = 2.4;
          w.yaw = Math.atan2(0, -w.dir);
          if (u > w.uMax || u < w.uMin) w.dir = -w.dir;
          else if (R() < dt * 0.15) w.pause = 2 + R() * 3;
        }
        w.cheer = 0.55;
        w.phase += dt * 3 * (w.speed > 0 ? 1 : 0);
      }
    }
  }

  // ------------------------------------------------------------------ drawing (game/game.js)
  draw(fr) {
    if (!this.set) return;
    const g = this.game;
    const F = this.F;
    const J = this.J;
    const cam = g.camera.position;
    const dc = Math.hypot(cam.x - F.cx, cam.z - F.cz);
    if (this.inCam || dc < 30) drawPeople(g, this.crowd, g.touch ? 26 : 40);
    if (!this.inCam || !this.on) return;
    // the spots on the band: warm beams from their bar through the haze
    const top = F.y0 + J.stage.h;
    const b = J.band;
    let id = 7700;
    const targets = [b.pianist, b.sax, b.singer, b.bassist, b.drummer];
    let k = 0;
    for (let u = F.mid - 3.6; u <= F.mid + 3.6 + 1e-6; u += 1.8, k++) {
      const tg = targets[k % targets.length];
      const [x, y, z] = F.P(u, F.y1 - 0.74, J.stage.d1 + 0.85);
      const [ex, , ez] = F.P(tg.u, 0, tg.d);
      const al = tg === b.singer ? 0.22 : 0.13;
      for (let q = -1; q <= 1; q++) fr.lineXYZ(x, y, z, ex + q * 0.18, top + 0.05, ez + q * 0.1, [1, 0.8, 0.5], 7 - Math.abs(q) * 2, id++, al * (q ? 0.5 : 1), 0.001, 0);
    }
    // their light: warm on the band, the singer brightest; blue on the curtain
    const [sx, , sz] = F.P(b.singer.u, 0, b.singer.d);
    flashLight(sx + 1.2, top + 2.6, sz, 6, _warm, 1.6);
    const [px, , pz] = F.P(b.piano.u, 0, b.piano.d);
    flashLight(px + 1.0, top + 2.4, pz, 5, _warm, 1.1);
    const [cx, , cz] = F.P(F.mid, 0, F.db + 0.4);
    flashLight(cx + 1.2, top + 2.5, cz, 9, _blue, 1.0 + 0.2 * Math.sin(this.t * 0.5));
  }

  // ------------------------------------------------------------------ what you can do there
  target() {
    if (!this.set || !this.on || (this.game.minigames && this.game.minigames.isOpen)) return null;
    const F = this.F;
    const p = this.game.player.pos;
    if (!F.inside(p.x, p.z)) return null;
    const u = F.U(p.z);
    const d = F.D(p.x);
    const st = this.J.stage;
    if (Math.abs(u - F.mid) < 3.2 && d > st.d1 - 0.2 && d < st.d1 + 1.5) {
      if (Math.abs(u - F.mid) < 1.4) return { kind: 'tip', label: 'E — לתת טיפ ללהקה ($20)' };
      return { kind: 'song', label: 'E — לבקש שיר מהלהקה ($10)' };
    }
    return null;
  }

  interact() {
    const tg = this.target();
    if (!tg) return false;
    const g = this.game;
    const price = tg.kind === 'tip' ? 20 : 10;
    if (g.money && !g.money.pay(price, 'BAND')) {
      g.money.refuse(this.F.name, price);
      return true;
    }
    g.audio.play('coins', 0.5);
    if (tg.kind === 'song') {
      // (the next song now: a slow one or a quick one, the room's choice)
      const S = this.sound;
      if (S.band && S.c && S.c.state === 'running') {
        S.next(S.c.currentTime + 0.3);
        this.lastN = S.n;
      }
      this.applause();
      g.hud.toast('הזמרת מחייכת אליכם: "This one is for you, darling"', 'good', 3.5);
    } else {
      this.applause();
      for (const w of this.crowd) if (w.at === 'table') w.cheer = 1;
      g.hud.toast('הלהקה מקדישה לכם סולו! כל השולחנות מוחאים כפיים', 'good', 3);
      const p = g.player;
      p.hp = Math.min(p.maxHp, p.hp + 10);
    }
    return true;
  }
}

const _warm = new THREE.Color(1, 0.78, 0.5);
const _blue = new THREE.Color(0.35, 0.5, 1);
