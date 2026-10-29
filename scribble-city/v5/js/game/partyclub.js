import * as THREE from 'three';
import { Kit, linC } from './items.js';
import { clubMats, pictureGeo } from './venuekit.js';
import { flashLight, makeSurface, canvasTexture } from '../render/materials.js';
import { worldAt } from '../ui/minigame.js';
import { barLook, BAR_STYLE_NAMES, bouncerLook, bartenderLook, civilianLook, modest } from './looks.js';
import { DanceGame } from './minigames/dance.js';
import { venueFrame, floorQuad, wallQuad, canvas, PartySound, drawPeople, Boxes, ringMesh } from './partykit.js';
import { paintLED, paintFloor, paintNeon, paintBackdrop, paintBand } from './partyart.js';
import { megaPlan } from '../world/megaplan.js';

// (v5, ROADMAP 12.9, 12.9b) NEON INK's night, the way the world's great clubs do it. Its hall is the
// city's (world/megaplan.js, world/venues2.js: thirteen metres high, the stage across its back,
// balconies on three sides, the bars, the VIP sofas); here, the show over it all, built when you
// come near:
// - a wall of LED twenty-five metres wide behind the DJ and its two pillars, all playing to the
//   music (game/partyart.js); the floor of LED in patterns to the beat; the balconies' lit edges, one
//   strip of light running round the hall;
// - over the floor a ring chandelier, three rings of light turning and tilting, and above it a
//   kinetic ceiling - a hundred bars of light on their wires rising and falling in waves;
// - moving heads on the stage's lip and under the balconies, lasers fanning from the top of the
//   wall and from the balconies, strobes;
// - the music in its parts (game/partykit.js): the groove; the break - the beat gone, the hands
//   down, the ceiling drifting; the build - the snare rolling faster, the ceiling rising, the hands
//   going up, the countdown on the wall, everyone down low for the last beat; and the drop: flames
//   from the stage, the CO2 blasting, confetti, the ceiling crashing down and rippling, the whole
//   hall jumping;
// - and hundreds of people: packed onto the floor, along the balconies' glass, on the VIP sofas,
//   three deep at the bars, going up and down the stairs; the bottles carried along the balconies
//   with their sparklers held high.
// You can dance on the floor (Ink Beat on the wall of LED), tip the DJ for the drop, have the
// bottles brought to you upstairs, and drink at the bar upstairs.

const BARS = 40;
// (the song: sixteen bars of groove, four of break, four of build - its snare rolling in fours,
// then twos, then every step - a breath of nothing, then sixteen bars of the drop)
export const CLUB_FORM = (bar, k) => (bar >= 16 && bar < 20 ? 'break' : bar >= 20 && bar < 22 ? 'roll4' : bar === 22 ? 'roll2' : bar === 23 ? (k >= 12 ? 'gap' : 'roll1') : null);
const partOf = (bar) => (bar < 16 ? 'groove' : bar < 20 ? 'break' : bar < 24 ? 'build' : 'drop');
const BPM = 126;
const NEAR = 80;
const HUES = [0.9, 0.52, 0.76, 0.12];
const LASER_C = [[0.3, 1, 0.4], [0.2, 0.9, 1], [1, 0.25, 0.5], [0.8, 0.35, 1]];
const BEAM_C = [[1, 0.35, 0.75], [0.3, 0.9, 1], [1, 0.9, 0.35], [0.55, 1, 0.6], [0.75, 0.5, 1]];
const SPARK = [[1, 0.95, 0.75], [1, 0.8, 0.4], [1, 1, 1]];
const pm = (a, n) => ((Math.floor(a) % n) + n) % n;
const R = Math.random;
const hsl = (h, s, l, out) => out.setHSL(((h % 1) + 1) % 1, s, l);

export class ClubNight {
  constructor(game, key) {
    this.game = game;
    this.F = venueFrame(key);
    this.P = this.F ? megaPlan(this.F) : null;
    this.set = null;
    this.crowd = [];
    this.servers = [];
    this.cols = [];
    this.t = 0;
    this.clock = 0;
    this.beat = 0;
    this.bar = 0;
    this.songN = 0;
    this.part = 'off';
    this.dropped = -1;
    this.parade = -1;
    this.flameT = 0;
    this.sound = new PartySound(game, { styles: ['house'], bars: BARS, form: CLUB_FORM, seed: 77 });
  }

  // (game/soundscape.js: the club's own music is ours while the show is on)
  owns(shop) {
    return !!(this.set && shop && this.F && shop.name === this.F.name);
  }

  open() {
    const Rh = this.game.rhythm;
    return !Rh || Rh.open('club');
  }

  // ------------------------------------------------------------------ the show's rig
  build() {
    const g = this.game;
    const F = this.F;
    const P = this.P;
    const touch = g.touch;
    const CM = clubMats('club');
    const K = new Kit();
    const { mid, by } = P;
    const { y0, y1, db, da, ua, ub } = F;
    const st = P.stage;
    const top = y0 + st.h;
    const le = P.led;
    // (a box in the room's frame: u along the front, d out of it)
    const B = (u0, ya, d0, u1, yb, d1, mat, c) => K.box(mat, F.x(Math.min(d0, d1)), ya, F.z(Math.max(u0, u1)), F.x(Math.max(d0, d1)), yb, F.z(Math.min(u0, u1)), c);
    const CYL = (u, d, r, ya, yb, mat, c, segs = 10, r1 = r) => K.cyl(mat, r, r1, ya, yb, c, { axis: 'y', x: F.x(d), z: F.z(u), segs });
    const BLACK = linC(0.03, 0.03, 0.04);
    const STEEL = linC(0.4, 0.41, 0.45);
    // ---- the lasers: four on the top of the wall of LED (out over the hall), one at the stage's end
    // of each side balcony (across the floor)
    this.lasers = [];
    for (const du of [-11, -4, 4, 11]) {
      B(mid + du - 0.2, le.y1 + 0.35, db + 0.15, mid + du + 0.2, le.y1 + 0.62, db + 0.55, CM.matte, BLACK);
      this.lasers.push({ at: F.P(mid + du, le.y1 + 0.48, db + 0.6), base: du * 0.025, rise: -0.2, s: Math.sign(du), n: 0 });
    }
    for (const s of [-1, 1]) {
      const u = s < 0 ? ua + P.B - 0.3 : ub - P.B + 0.3;
      B(u - 0.2, by + 1.16, db + 7.2, u + 0.2, by + 1.42, db + 7.6, CM.matte, BLACK);
      this.lasers.push({ at: F.P(u, by + 1.3, db + 7.65), base: -s * 0.75, rise: -0.1, s, n: 1 });
    }
    // ---- the moving heads: along the stage's lip (up over the hall), under the balconies' edges
    // (down onto the floor)
    this.heads = [];
    for (let u = mid - 8.75; u <= mid + 8.75 + 1e-6; u += touch ? 5 : 2.5) {
      B(u - 0.18, top, st.d1 - 0.55, u + 0.18, top + 0.3, st.d1 - 0.2, CM.matte, BLACK);
      this.heads.push({ i: this.heads.length, up: true, u, d: st.d1 - 0.35, at: F.P(u, top + 0.36, st.d1 - 0.35) });
    }
    for (const s of [-1, 1]) {
      const u = s < 0 ? ua + P.B + 0.14 : ub - P.B - 0.14;
      for (let d = db + 9; d < da - P.B - 1; d += touch ? 9 : 4.5) {
        B(u - 0.15, by - 1.25, d - 0.15, u + 0.15, by - 0.95, d + 0.15, CM.matte, BLACK);
        this.heads.push({ i: this.heads.length, up: false, u, d, at: F.P(u, by - 1.3, d) });
      }
    }
    for (let u = ua + P.B + 4; u < ub - P.B - 3; u += touch ? 10 : 5) {
      B(u - 0.15, by - 1.25, da - P.B - 0.3, u + 0.15, by - 0.95, da - P.B, CM.matte, BLACK);
      this.heads.push({ i: this.heads.length, up: false, u, d: da - P.B - 0.15, at: F.P(u, by - 1.3, da - P.B - 0.15) });
    }
    // ---- the CO2 cannons and the flame-throwers along the stage's lip
    this.co2 = [];
    this.pyro = [];
    for (const du of [-8.5, -5.5, -2.5, 2.5, 5.5, 8.5]) {
      CYL(mid + du, st.d1 - 0.35, 0.12, top, top + 0.16, CM.matte, BLACK, 10);
      CYL(mid + du, st.d1 - 0.35, 0.05, top + 0.16, top + 0.5, CM.metal, STEEL, 8);
      this.co2.push(F.P(mid + du, top + 0.52, st.d1 - 0.35));
    }
    for (const du of [-10, -7, -4, 4, 7, 10]) {
      B(mid + du - 0.2, top, st.d1 - 0.55, mid + du + 0.2, top + 0.42, st.d1 - 0.15, CM.metal, linC(0.18, 0.18, 0.2));
      CYL(mid + du, st.d1 - 0.35, 0.06, top + 0.42, top + 0.5, CM.metal, STEEL, 8);
      this.pyro.push(F.P(mid + du, top + 0.5, st.d1 - 0.35));
    }
    // ---- the strobes on the top of the wall; the dancers' risers either side of the booth
    this.strobes = [];
    for (const du of [-9, -3, 3, 9]) {
      B(mid + du - 0.45, le.y1 + 0.36, db + 0.2, mid + du + 0.45, le.y1 + 0.5, db + 0.4, CM.matte, BLACK);
      this.strobes.push(F.P(mid + du, le.y1 + 0.43, db + 0.45));
    }
    this.risers = [];
    for (const s of [-1, 1]) {
      const u = mid + s * 7;
      const d = db + 2.8;
      CYL(u, d, 0.62, top, top + 0.5, CM.paint, linC(0.07, 0.06, 0.09), 22, 0.7);
      CYL(u, d, 0.65, top + 0.5, top + 0.56, CM.glow, linC(1, 0.3, 0.72), 22);
      this.risers.push({ u, d, y: top + 0.56 });
    }
    // ---- the photo wall in the lobby under the front balcony: its frame, the ring light, the camera
    {
      const pu = ub - 8.5;
      const bw = 4.0;
      const bh = 2.5;
      for (const s of [-1, 1]) B(pu + s * (bw / 2 + 0.03) - 0.03, y0, da - 0.14, pu + s * (bw / 2 + 0.03) + 0.03, y0 + bh + 0.25, da - 0.04, CM.metal, STEEL);
      const [rx, , rz] = F.P(pu - 1.0, 0, da - 2.6);
      K.cyl(CM.metal, 0.02, 0.02, y0, y0 + 1.55, STEEL, { axis: 'y', x: rx, z: rz, segs: 6 });
      const ring = new THREE.TorusGeometry(0.32, 0.035, 6, 24);
      ring.rotateY(Math.PI / 2);
      ring.translate(rx, y0 + 1.85, rz);
      K.add(CM.glow, ring, linC(1, 0.97, 0.92));
      const [cx, , cz] = F.P(pu + 0.6, 0, da - 3.3);
      for (const [ox, oz] of [[-0.25, -0.15], [0.25, -0.15], [0, 0.25]]) K.cyl(CM.metal, 0.012, 0.012, y0, y0 + 1.45, BLACK, { axis: 'y', x: cx + ox * 0.6, z: cz + oz * 0.6, segs: 4 });
      K.box(CM.matte, cx - 0.06, y0 + 1.45, cz - 0.1, cx + 0.12, y0 + 1.6, cz + 0.1, BLACK);
      this.photoWall = { u: pu, d: da - 1.0, w: bw, h: bh, ring: [rx, y0 + 1.85, rz], cam: [cx, y0 + 1.5, cz] };
    }
    const group = K.build({ seed: 0.37 });
    this.mats = [];
    this.texs = [];
    const pic = (map, em) => {
      const m = makeSurface({ kind: 'uv', map, uvScale: 1, ang: 0.3, wash: 1, line: 0.06, indoor: 'club', emissive: new THREE.Color(em, em, em), emMap: map });
      this.mats.push(m);
      this.texs.push(map);
      return m;
    };
    const add = (geo, mat) => {
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = false;
      group.add(m);
      return m;
    };
    // ---- the wall of LED, its pillars (the picture's two ends), the booth's front (its middle)
    const LW = touch ? 384 : 960;
    this.ledC = canvas(LW, Math.round(LW * 0.4));
    this.ledTex = canvasTexture(this.ledC, { mips: false });
    const ledMat = pic(this.ledTex, 0.95);
    const lw = le.u1 - le.u0;
    const lh = le.y1 - le.y0;
    const la = F.P(mid, le.y0 + lh / 2, le.d);
    this.led = add(pictureGeo(lw, lh, la[0], la[1], la[2], 1, 0), ledMat);
    for (const [k, pl] of P.pillars.entries()) {
      const pa = F.P((pl.u0 + pl.u1) / 2, le.y0 + lh / 2, le.d);
      // (u along the front runs against the picture's x: the first pillar is the picture's right end)
      add(pictureGeo(pl.u1 - pl.u0, lh, pa[0], pa[1], pa[2], 1, 0, k === 0 ? [0.86, 0, 1, 1] : [0, 0, 0.14, 1]), ledMat);
    }
    const bo = P.booth;
    const bp = F.P(mid, top + bo.h / 2, bo.d1 + 0.012);
    add(pictureGeo(bo.u1 - bo.u0 - 0.1, bo.h - 0.1, bp[0], bp[1], bp[2], 1, 0, [0.38, 0.25, 0.62, 0.55]), ledMat);
    // ---- the floor of LED
    const fl = P.floor;
    const NX = Math.round(fl.u1 - fl.u0);
    const NY = Math.round(fl.d1 - fl.d0);
    const PX = touch ? 8 : 16;
    this.floorN = [NX, NY, PX];
    this.floorC = canvas(NX * PX, NY * PX);
    this.floorTex = canvasTexture(this.floorC, { mips: false });
    {
      const c = (u, d) => {
        const p = F.P(u, 0, d);
        return [p[0], p[2]];
      };
      add(floorQuad([c(fl.u0, fl.d0), c(fl.u1, fl.d0), c(fl.u1, fl.d1), c(fl.u0, fl.d1)], y0 + 0.022), pic(this.floorTex, 1.2));
    }
    // ---- the balconies' lit edge: one strip of LED round the three of them
    {
      const BW = touch ? 1024 : 2048;
      this.bandC = canvas(BW, touch ? 12 : 24);
      this.bandTex = canvasTexture(this.bandC, { mips: false });
      const bandMat = pic(this.bandTex, 1.4);
      const side = P.bal[0].d1 - P.B - P.bal[0].d0;
      const front = P.bal[2].u1 - P.bal[2].u0;
      const total = side * 2 + front;
      const ya = by - 0.9;
      const yb = by - 0.45;
      // (round the hall: up the first side from the stage to the front, across, back down the other)
      const L = P.bal[0];
      const Rb = P.bal[1];
      const Fb = P.bal[2];
      let [ax, , az] = F.P(L.u1 + 0.07, 0, L.d0);
      let [bx, , bz] = F.P(L.u1 + 0.07, 0, L.d1 - P.B);
      add(wallQuad(ax, az, bx, bz, ya, yb, 0, side / total, 0, -1), bandMat);
      [ax, , az] = F.P(Fb.u0, 0, Fb.d0 - 0.07);
      [bx, , bz] = F.P(Fb.u1, 0, Fb.d0 - 0.07);
      add(wallQuad(ax, az, bx, bz, ya, yb, side / total, (side + front) / total, -1, 0), bandMat);
      [ax, , az] = F.P(Rb.u0 - 0.07, 0, Rb.d1 - P.B);
      [bx, , bz] = F.P(Rb.u0 - 0.07, 0, Rb.d0);
      add(wallQuad(ax, az, bx, bz, ya, yb, (side + front) / total, 1, 0, 1), bandMat);
    }
    // ---- the neon high on the walls over the balconies
    const signs = [
      { text: 'DANCE ALL NIGHT', color: '#3fe8ff' },
      { text: 'NO SLEEP TILL SUNRISE', color: '#ff4fb0' },
      { text: 'GOOD VIBES ONLY', color: '#ffe14f' },
    ];
    const ng = paintNeon(signs, touch ? 512 : 1024, touch ? 64 : 128);
    const neonTex = canvasTexture(ng.c, { mips: true });
    const neonMat = pic(neonTex, 1.4);
    const sign = (text, u, y, d, h, nx, nz, wmax) => {
      const bx = ng.boxes[text];
      const w = Math.min(wmax, h * bx.aspect);
      const p = F.P(u, y, d);
      add(pictureGeo(w, h, p[0], p[1], p[2], nx, nz, bx.uv), neonMat);
    };
    sign('DANCE ALL NIGHT', ua + 0.05, by + 4.0, db + 19, 1.7, 0, -1, 15);
    sign('NO SLEEP TILL SUNRISE', ub - 0.05, by + 4.0, db + 19, 1.4, 0, 1, 15);
    sign('GOOD VIBES ONLY', mid, by + 4.4, da - 0.05, 1.7, -1, 0, 16);
    // ---- the photo wall's backdrop
    {
      const W = this.photoWall;
      const backTex = canvasTexture(paintBackdrop(F.name, ['#ff4fb0', '#3fe8ff', '#ffffff']), { mips: true });
      const p = F.P(W.u, y0 + 0.15 + W.h / 2, da - 0.06);
      add(pictureGeo(W.w, W.h, p[0], p[1], p[2], -1, 0), pic(backTex, 0.55));
    }
    // ---- the kinetic ceiling: its bars, their wires
    const rg = P.rig;
    const nu = touch ? 8 : rg.nu;
    const nd = touch ? 7 : rg.nd;
    this.rigPts = [];
    for (let i = 0; i < nu; i++) for (let j = 0; j < nd; j++) {
      const u = rg.u0 + ((i + 0.5) / nu) * (rg.u1 - rg.u0);
      const d = rg.d0 + ((j + 0.5) / nd) * (rg.d1 - rg.d0);
      const [x, , z] = F.P(u, 0, d);
      this.rigPts.push({ u, d, x, z, r: Math.hypot(u - P.ring.u, d - P.ring.d), y: rg.hi });
    }
    this.barsMesh = new Boxes(this.rigPts.length, CM.glow);
    this.wiresMesh = new Boxes(this.rigPts.length, CM.matte);
    group.add(this.barsMesh.mesh, this.wiresMesh.mesh);
    // ---- the lit frames round the wall of LED and its pillars, their colour chasing round
    this.frames = [];
    for (const [u0, u1] of [[le.u0, le.u1], ...P.pillars.map((pl) => [pl.u0, pl.u1])]) {
      const e = 0.09;
      const d = le.d + 0.05;
      for (const [a0, a1, ya, yb] of [[u0 - e, u1 + e, le.y1, le.y1 + e], [u0 - e, u1 + e, le.y0 - e, le.y0], [u0 - e, u0, le.y0, le.y1], [u1, u1 + e, le.y0, le.y1]]) {
        const [x0, , z0] = F.P(a0, 0, d);
        const [x1, , z1] = F.P(a1, 0, d);
        this.frames.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, y: (ya + yb) / 2, sx: 0.06, sy: yb - ya, sz: Math.abs(z1 - z0), k: this.frames.length });
      }
    }
    this.frameMesh = new Boxes(this.frames.length, CM.glow);
    group.add(this.frameMesh.mesh);
    // ---- the ring chandelier
    const [rx, , rz] = F.P(P.ring.u, 0, P.ring.d);
    this.rings = P.ring.r.map((r, k) => {
      const m = ringMesh(r, 0.11 - k * 0.02, CM.glow);
      m.position.set(rx, P.ring.y + k * 0.4, rz);
      group.add(m);
      return m;
    });
    group.updateMatrix();
    g.scene.add(group);
    this.set = group;
    this.makeCrowd();
    this.paint();
    this.animateRig(0);
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
    for (const id of this.cols) g.world.collision.remove(id);
    this.cols = [];
    this.texs = [];
    this.mats = [];
    this.set = null;
    this.led = null;
    this.rings = null;
    this.barsMesh = null;
    this.crowd = [];
    this.servers = [];
    this.sound.stop();
  }

  // ------------------------------------------------------------------ the people
  makeCrowd() {
    const g = this.game;
    const F = this.F;
    const P = this.P;
    const N = g.touch ? 0.22 : 1;
    const night = this.nightK();
    const list = [];
    const { mid, by } = P;
    const { y0, ua, ub, da, db } = F;
    const top = y0 + P.stage.h;
    const person = (u, d, yaw, at, o = {}) => {
      const look = o.look || barLook(BAR_STYLE_NAMES[Math.floor(R() * BAR_STYLE_NAMES.length)]);
      const [x, y, z] = F.P(u, o.y === undefined ? y0 : o.y, d);
      list.push({ x, z, y, y0: y, u, d, look, scale: look.build.height, yaw, yaw0: yaw, speed: 0, phase: R() * 6, seed: R() * 100, cheer: 0, sit: 0, at, indoor: 3, hop: R(), feel: 0.4 + R() * 0.6, ...o });
    };
    // (facing the stage: the room's back is -d, the world's -x)
    const STAGE = -Math.PI / 2;
    const fl = P.floor;
    // the room's own dancers stand at these (world/venues2.js): the crowd round them
    const own = [];
    for (let i = 0; i < 16; i++) own.push([fl.u0 + 2 + (i % 4) * 5, fl.d0 + 2.5 + Math.floor(i / 4) * 3.6]);
    const free = (u, d) => own.every(([a, b]) => Math.hypot(u - a, d - b) > 0.6);
    // the floor, packed - thickest at the barrier
    const fill = (night * 0.42 + 0.12) * N;
    for (let u = fl.u0 + 0.35; u < fl.u1 - 0.2; u += 0.8) {
      for (let d = fl.d0 + 0.35; d < fl.d1 - 0.2; d += 0.85) {
        const front = 1 - (d - fl.d0) / (fl.d1 - fl.d0);
        if (R() > fill * (0.75 + 0.5 * front)) continue;
        const uu = u + (R() - 0.5) * 0.4;
        const dd = d + (R() - 0.5) * 0.4;
        if (!free(uu, dd)) continue;
        person(uu, dd, STAGE + (R() < 0.85 ? (R() - 0.5) * 0.7 : (R() - 0.5) * 3), 'dance');
      }
    }
    // behind the floor towards the doors, thinner; the front row at the barrier
    for (let u = mid - 13; u < mid + 13; u += 0.9) for (let d = fl.d1 + 0.4; d < da - P.B - 1.5; d += 1.0) if (R() < 0.22 * N * night) person(u + (R() - 0.5) * 0.4, d + (R() - 0.5) * 0.4, STAGE + (R() - 0.5) * 0.9, 'dance');
    for (let u = P.barrier.u0 + 0.4; u < P.barrier.u1; u += 0.7) if (R() < 0.8 * N + 0.1) person(u, P.barrier.d + 0.45, STAGE, 'dance', { hop: 0.9 + R() * 0.1 });
    // the security behind the barrier
    for (const du of [-6, 0, 6]) person(mid + du, P.barrier.d - 0.45, Math.PI / 2, 'guard', { look: bouncerLook() });
    // the stage: the DJ at the booth, the MC, the dancers on their risers
    const dj = modest(civilianLook({ kind: 'street', pen: 'comic' }));
    dj.acc = (dj.acc || []).filter((a) => a !== 'headphones').concat(['headphones']);
    person(mid, P.booth.d0 - 0.35, Math.PI / 2, 'dj', { look: dj, y: top });
    person(mid + 4.2, P.booth.d1 + 0.6, Math.PI / 2, 'mc', { y: top, look: modest(civilianLook({ kind: 'street', pen: 'comic' })) });
    for (const q of this.risers) {
      const L = modest(civilianLook({ fem: R() < 0.7, kind: 'dress', pen: 'gelPurple' }));
      L.top = { kind: 'jacket', color: [0.95, 0.85, 0.3], sleeves: 'long', inner: [0.95, 0.3, 0.7] };
      person(q.u, q.d, Math.PI / 2, 'gogo', { look: L, y: q.y });
    }
    // the balconies: along the glass, looking down on the floor
    const BN = (night * 0.55 + 0.15) * N;
    for (const s of [-1, 1]) {
      const u = s < 0 ? ua + P.B - 0.45 : ub - P.B + 0.45;
      const yaw = s < 0 ? Math.PI : 0;
      for (let d = db + 7.6; d < da - P.B - 0.4; d += 0.72) if (R() < BN) person(u + (R() - 0.5) * 0.15, d, yaw + (R() - 0.5) * 0.6, 'rail', { y: by });
      // (and a second row behind, some)
      for (let d = db + 8; d < da - P.B - 0.4; d += 1.1) if (R() < BN * 0.4) person(u - s * 0.9, d, yaw + (R() - 0.5) * 0.8, 'rail', { y: by });
    }
    for (let u = ua + P.B + 2.6; u < ub - P.B - 2.6; u += 0.72) if (R() < BN) person(u, da - P.B + 0.45, STAGE + (R() - 0.5) * 0.6, 'rail', { y: by });
    // the VIP sofas: three sitting on each, more standing round their tables
    for (const v of P.vip) {
      const sg = v.side < 0 ? 1 : -1;
      const yaw = v.side < 0 ? Math.PI : 0;
      for (const dd of [-0.8, 0, 0.8]) if (R() < 0.75 * N + 0.2) person(v.u - sg * 0.15, v.d + dd, yaw, 'vip', { y: by - 0.02, sit: 1 });
      for (const dd of [-0.7, 0.7]) if (R() < 0.6 * N + 0.1) person(v.u + sg * 2.5, v.d + dd, yaw + (R() - 0.5) * 2, 'vipStand', { y: by });
    }
    // the bars under the balconies: standing behind the stools
    for (const b of P.bars) {
      const u = b.side < 0 ? ua + 3.3 : ub - 3.3;
      for (let d = b.d0 + 0.6; d < b.d1 - 0.4; d += 0.85) if (R() < 0.5 * N + 0.1) person(u + (R() - 0.5) * 0.3, d, b.side < 0 ? Math.PI : 0, 'bar');
    }
    // the bar upstairs
    for (let u = P.upbar.u0 + 0.5; u < P.upbar.u1 - 0.3; u += 0.8) if (R() < 0.6 * N + 0.1) person(u, P.upbar.d0 - 0.55, Math.PI / 2, 'bar', { y: by });
    for (const du of [-3, 3]) person(mid + du, da - 1.0, -Math.PI / 2, 'staff', { look: bartenderLook(), y: by });
    // the lobby under the front balcony: friends in their groups, the photo wall
    for (let k = 0; k < (g.touch ? 2 : 5); k++) {
      const cu = ua + 10 + R() * (ub - ua - 24);
      const cd = da - P.B + 1.2 + R() * 2.4;
      const n = 2 + Math.floor(R() * 3);
      for (let q = 0; q < n; q++) {
        const a = (q / n) * Math.PI * 2 + R() * 0.5;
        person(cu + Math.cos(a) * 0.55, cd + Math.sin(a) * 0.55, Math.atan2(-Math.sin(a), Math.cos(a)), 'talk');
      }
    }
    if (this.photoWall) {
      const W = this.photoWall;
      for (const du of [-0.45, 0.45]) person(W.u + du, W.d, -Math.PI / 2, 'pose');
      person(W.u + 0.6, F.da - 3.6, Math.PI / 2, 'shoot');
    }
    // up and down the stairs
    for (const [k, sr] of P.stairs.entries()) {
      for (let q = 0; q < (g.touch ? 1 : 3); q++) {
        const d = sr.d0 - 1 + R() * (sr.d1 - sr.d0 + 2.5);
        person((sr.u0 + sr.u1) / 2 + (q - 1) * 0.6, d, 0, 'stairs', { stair: k, dir: R() < 0.5 ? 1 : -1, v: 0.75 + R() * 0.3 });
      }
    }
    this.crowd = list;
  }

  nightK() {
    const h = this.game.daynight ? this.game.daynight.hour : 23;
    // (the afternoon's day party a few; the hall full from ten)
    return h >= 22 || h < 4 ? 1 : h >= 19 ? 0.7 : 0.35;
  }

  // (the height of the stairs under someone at d: the step they are on)
  stairY(sr, d) {
    const P = this.P;
    const y0 = this.F.y0;
    if (d <= sr.d0) return y0;
    if (d >= sr.d1) return P.by;
    return y0 + Math.min(P.steps, Math.ceil((d - sr.d0) / P.run)) * P.rise;
  }

  // the bottles carried in: two hosts from the bar upstairs, the bottles held high, sparklers
  // fizzing; along the balcony to a VIP sofa (or to you, when you asked)
  service(toYou) {
    const F = this.F;
    const P = this.P;
    const g = this.game;
    const start = [P.mid + 0.5, P.upbar.d0 - 0.8];
    let path;
    if (toYou) {
      const u = F.U(g.player.pos.z);
      const d = F.D(g.player.pos.x);
      const uc = u < P.mid ? F.ua + P.B - 1.4 : F.ub - P.B + 1.4;
      path = [start, [uc, start[1]], [uc, d + 0.9], [u + (u < P.mid ? 0.7 : -0.7), d + 0.6]];
    } else {
      const v = P.vip[Math.floor(R() * P.vip.length)];
      const uc = v.side < 0 ? F.ua + P.B - 1.4 : F.ub - P.B + 1.4;
      path = [start, [uc, start[1]], [uc, v.d]];
    }
    for (let k = 0; k < 2; k++) {
      const L = modest(civilianLook({ fem: k === 0, kind: 'office', pen: 'fineliner' }));
      L.top = { kind: 'vest', color: [0.08, 0.08, 0.1], sleeves: 'long', under: [0.95, 0.95, 0.92] };
      const [x, , z] = F.P(start[0] - k * 0.9, 0, start[1]);
      // (the second a step behind the first all the way)
      const mine = path.map(([u, d], i) => (i === 0 ? [u - k * 0.9, d] : i === path.length - 1 ? [u, d - k * 0.6] : [u, d - k * 0.6]));
      this.servers.push({ x, z, y: P.by, y0: P.by, look: L, scale: L.build.height, yaw: 0, speed: 0, phase: R() * 6, seed: R() * 100, cheer: 1, sit: 0, indoor: 3, path: mine, leg: 0, wait: 0, back: false, toYou, lag: k * 0.9 });
    }
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
        console.error('[party]', e);
        this.failed = true;
        this.teardown();
        return;
      }
    }
    if (this.set && (!built || dist > NEAR + 30)) this.teardown();
    if (!this.set) return;
    this.t += dt;
    const on = this.open();
    const cam = g.camera.position;
    const inCam = F.inside(cam.x, cam.z, 0.3);
    const inP = F.inside(p.x, p.z);
    this.inCam = inCam;
    const dd = Math.hypot(cam.x - F.door[0], cam.z - F.door[1]);
    const near = inCam || inP || dd < 32;
    const S = this.sound;
    if (on && near && !S.band) S.start();
    if (S.band && (!on || !near)) S.stop();
    const playing = !!(g.minigames && g.minigames.isOpen);
    this.dancing = playing && this.dancing;
    const running = !!(S.band && S.c && S.c.state === 'running');
    if (running) {
      const part = partOf(Math.floor(S.bar));
      const cut = inCam ? (part === 'build' ? 500 + 12000 * Math.pow(Math.max(0, S.bar - 20) / 4, 2) : part === 'break' ? 2600 : 16000) : 700;
      S.update(playing ? 0 : inCam ? 0.38 : 0.16 * Math.max(0, 1 - dd / 32), cut);
      this.beat = S.beat;
      this.bar = S.bar;
      this.songN = S.n;
      this.barSec = S.spb * 16;
      // (the build's riser and the drop's crash, on the song's own clock)
      if (this.bar >= 19 && this.bar < 23.5 && S.cued !== S.n) {
        S.cued = S.n;
        S.riser(S.at(20), S.at(24) - 4 * S.spb);
        S.crash(S.at(24));
      }
    } else {
      if (S.band) S.update(0, 700);
      this.clock += dt;
      this.barSec = (4 * 60) / BPM;
      const bars = this.clock / this.barSec;
      this.songN = Math.floor(bars / BARS);
      this.bar = bars - this.songN * BARS;
      this.beat = this.bar * 4;
    }
    this.part = on ? partOf(Math.floor(this.bar)) : 'off';
    this.prog = this.part === 'build' ? (this.bar - 20) / 4 : 0;
    this.dropT = this.part === 'drop' ? (this.bar - 24) * this.barSec : 99;
    this.hue = HUES[pm(this.songN, HUES.length)];
    const here = inCam || inP;
    if (this.part === 'drop' && this.dropped !== this.songN) {
      this.dropped = this.songN;
      if (here) this.drop(true);
    }
    // (in the drop, every four bars, the flames again; half way through, the cannons)
    if (this.part === 'drop' && here) {
      const k = Math.floor((this.bar - 24) / 4);
      if (k > 0 && this.flameK !== this.songN * 10 + k) {
        this.flameK = this.songN * 10 + k;
        this.flames(k % 2 ? 'outer' : 'inner');
        if (k === 2) this.drop(false);
      }
    }
    if (this.flameT > 0) this.flameT -= dt;
    // the bottles go by now and then (every other song, in its drop)
    if (this.part === 'drop' && this.bar > 26 && this.parade !== this.songN && this.songN % 2 === 0 && this.servers.length === 0) {
      this.parade = this.songN;
      this.service(false);
    }
    if (inP && !this.welcomed && on) {
      this.welcomed = true;
      g.hud.big(F.name, 2200);
      g.hud.toast('הרחבה מלאה! E על הרחבה כדי לרקוד, מול הבמה כדי לבקש את הדרופ. המדרגות ליד הדלת עולות למרפסות, ל־VIP ולבר העליון', 'info', 5.5);
    }
    if (!inP && dist > 50) this.welcomed = false;
    if (this.led) this.led.visible = !this.dancing;
    // the pictures, repainted as the music goes; the ceiling and the rings, moving
    if (inCam || (dd < 16 && on)) {
      this.paintT = (this.paintT || 0) + dt;
      if (this.paintT >= (g.touch ? 0.11 : 0.06)) {
        this.paint();
        this.paintT = 0;
      }
      this.animateRig();
    }
    this.animate(dt, here);
  }

  paint() {
    const s = { t: this.t, beat: this.beat, part: this.part === 'off' ? 'break' : this.part, prog: this.prog || 0, dropT: this.dropT, name: this.F.name, hue: this.hue };
    paintLED(this.ledC.getContext('2d'), this.ledC.width, this.ledC.height, s);
    this.ledTex.needsUpdate = true;
    const [nx, ny, px] = this.floorN;
    paintFloor(this.floorC.getContext('2d'), nx, ny, px, s);
    this.floorTex.needsUpdate = true;
    paintBand(this.bandC.getContext('2d'), this.bandC.width, this.bandC.height, s);
    this.bandTex.needsUpdate = true;
  }

  // the kinetic ceiling: its bars rising and falling (waves in the groove, drifting in the break,
  // all the way up in the build, crashing down at the drop and rippling out from the middle);
  // the rings turning, tilting, coloured with the music
  animateRig() {
    if (!this.barsMesh) return;
    const P = this.P;
    const rg = P.rig;
    const part = this.part;
    const b = this.beat;
    const t = this.t;
    const ph = b - Math.floor(b);
    const pulse = Math.pow(1 - ph, 2);
    const span = rg.hi - rg.lo;
    const ceil = this.F.y1;
    let i = 0;
    for (const q of this.rigPts) {
      let k;
      if (part === 'break') k = 0.55 + 0.25 * Math.sin(t * 0.7 + q.u * 0.25 + q.d * 0.18);
      else if (part === 'build') k = 0.3 + 0.7 * Math.min(1, this.prog * 1.15) + 0.03 * Math.sin(t * 9 + q.r);
      else if (part === 'drop') {
        const slam = Math.max(0, 1 - this.dropT * 2.5);
        k = slam > 0 ? 0.95 * slam : 0.5 + 0.45 * Math.sin(b * Math.PI * 0.5 - q.r * 0.55);
      } else if (part === 'groove') k = 0.5 + 0.4 * Math.sin(t * 1.1 + (q.u + q.d) * 0.3);
      else k = 0.9;
      const y = rg.lo + span * Math.max(0, Math.min(1, k));
      let l;
      let hh = this.hue;
      if (part === 'off') l = 0.05;
      else if (part === 'break') l = 0.25 + 0.15 * Math.sin(t + q.r);
      else if (part === 'build') {
        const rate = this.prog < 0.5 ? 1 : this.prog < 0.75 ? 2 : 4;
        l = (b * rate) % 1 < 0.25 ? 0.5 + 0.4 * this.prog : 0.18;
        hh = this.hue + this.prog * 0.5;
        if (this.prog > 0.94) l = 0.02;
      } else if (part === 'drop') {
        l = 0.3 + 0.4 * pulse * (0.6 + 0.4 * Math.sin(q.r - b * 2));
        hh = this.hue + Math.floor(b) * 0.17 + q.r * 0.02;
      } else l = 0.25 + 0.2 * Math.sin(t * 1.1 + (q.u + q.d) * 0.3);
      hsl(hh, 0.9, Math.min(0.75, l), _c);
      this.barsMesh.set(i, q.x, y, q.z, 0.12, 0.12, 1.4, _c.r, _c.g, _c.b);
      this.wiresMesh.set(i, q.x, (y + ceil) / 2, q.z, 0.012, ceil - y, 0.012, 0.05, 0.05, 0.06);
      i++;
    }
    this.barsMesh.done();
    this.wiresMesh.done();
    // the frames round the LED: their colour chasing round them, white on the drop's beats
    if (this.frameMesh) {
      for (const f of this.frames) {
        const l = part === 'off' ? 0.05 : part === 'drop' && ph < 0.15 ? 0.85 : part === 'build' ? 0.3 + 0.4 * this.prog : 0.45;
        hsl(this.hue + f.k * 0.08 + b * 0.05, 0.95, l, _c);
        this.frameMesh.set(f.k, f.x, f.y, f.z, f.sx, f.sy, f.sz, _c.r, _c.g, _c.b);
      }
      this.frameMesh.done();
    }
    // the rings
    if (!this.rings) return;
    const drop = part === 'drop';
    this.rings.forEach((m, k) => {
      const lift = part === 'break' ? -0.8 : part === 'build' ? 1.6 * this.prog : drop && this.dropT < 0.6 ? 1.6 * (1 - this.dropT / 0.6) : 0;
      m.position.y = P.ring.y + k * 0.4 + lift + Math.sin(t * 0.5 + k) * 0.15;
      const tilt = drop ? 0.22 : part === 'build' ? 0.05 : 0.14;
      m.rotation.x = Math.sin(t * 0.6 + k * 1.3) * tilt;
      m.rotation.z = Math.cos(t * 0.5 + k * 0.9) * tilt;
      m.rotation.y = t * 0.25 * (k % 2 ? 1 : -1);
      let l;
      if (part === 'off') l = 0.05;
      else if (part === 'build') l = (b * (this.prog < 0.5 ? 1 : this.prog < 0.75 ? 2 : 4)) % 1 < 0.3 ? 0.85 : 0.35;
      else if (drop) l = 0.35 + 0.4 * Math.pow(1 - ((b + k * 0.33) % 1), 2);
      else if (part === 'break') l = 0.55;
      else l = 0.45 + 0.15 * Math.sin(t * 2 + k);
      hsl(part === 'break' ? 0.6 : this.hue + k * 0.18 + (drop ? Math.floor(b) * 0.25 : 0), part === 'break' ? 0.15 : 0.95, l, _c);
      const c = m.userData.colors;
      for (let v = 0; v < c.length; v += 3) {
        c[v] = _c.r;
        c[v + 1] = _c.g;
        c[v + 2] = _c.b;
      }
      m.userData.ca.needsUpdate = true;
    });
  }

  // the drop: the flames, the cannons blast, the confetti comes down, the hall jumps
  drop(first) {
    const g = this.game;
    const fx = g.fx;
    const F = this.F;
    const P = this.P;
    if (fx) {
      for (const [x, y, z] of this.co2) {
        fx.spray(x, y, z, 0, 1, 0, g.touch ? 8 : 18, 12, [0.92, 0.95, 1], { cone: 0.1, len: 0.7, wide: 10, life: 0.9, grav: false });
        for (let k = 0; k < (g.touch ? 1 : 3); k++) fx.sprite(R() < 0.5 ? 'smoke0' : 'smoke1', x + (R() - 0.5) * 0.2, y + 0.6 + k * 0.9, z + (R() - 0.5) * 0.2, { size: 0.6 + k * 0.3, grow: 1.6, life: 0.9 + R() * 0.4, vy: 3.6, alpha: 0.5, tint: [1.15, 1.15, 1.25] });
      }
      if (first) {
        for (const [du, dv] of [[-6, 0.25], [6, 0.25], [-6, 0.75], [6, 0.75], [0, 0.5], [-3, 0.5], [3, 0.5]]) {
          const [x, , z] = F.P(P.mid + du, 0, P.floor.d0 + (P.floor.d1 - P.floor.d0) * dv);
          fx.confetti(x, F.y1 - 1.6, z, g.touch ? 14 : 34, 2.6);
        }
      }
    }
    if (first) {
      this.flames('all');
      g.audio.play('cheer', 0.6);
    }
    g.audio.play('whoosh', 0.35);
  }

  // the flames from the stage's lip: all of them, or every other
  flames(which) {
    this.flameT = 0.95;
    this.flameSet = which;
    const g = this.game;
    g.audio.play('boom', 0.22);
    if (g.fx) {
      this.pyro.forEach(([x, y, z], i) => {
        if (!this.flameOn(i)) return;
        g.fx.spray(x, y + 0.3, z, 0, 1, 0, g.touch ? 3 : 7, 7, [[1, 0.6, 0.15], [1, 0.85, 0.3], [1, 0.4, 0.1]], { cone: 0.5, len: 0.12, life: 0.5, wide: 3 });
      });
    }
  }

  flameOn(i) {
    const w = this.flameSet;
    return w === 'all' || (w === 'outer' ? i === 0 || i === 5 || i === 1 || i === 4 : i === 2 || i === 3);
  }

  animate(dt, near) {
    const b = this.beat;
    const ph = b - Math.floor(b);
    const part = this.part;
    const prog = this.prog;
    const t = this.t;
    const P = this.P;
    const F = this.F;
    for (const w of this.crowd) {
      if (w.at === 'stairs') {
        // (up and down the stairs, a step at a time)
        if (!near) continue;
        const sr = P.stairs[w.stair];
        w.d += w.dir * w.v * dt;
        if (w.d > sr.d1 + 1.6) w.dir = -1;
        if (w.d < sr.d0 - 1.4) w.dir = 1;
        const [x, , z] = F.P(w.u, 0, w.d);
        w.x = x;
        w.z = z;
        w.y = this.stairY(sr, w.d);
        w.yaw = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        w.speed = 2.6 * w.v;
        w.phase += dt * 3.4 * w.v;
        continue;
      }
      if (part === 'off') {
        w.cheer = 0;
        w.y = w.y0;
        continue;
      }
      if (!near) continue;
      const bounce = Math.abs(Math.sin(Math.PI * (b + w.hop * 0.3)));
      if (w.at === 'dance' || w.at === 'gogo') {
        const go = w.at === 'gogo' ? 1.3 : 1;
        w.sit = 0;
        if (part === 'groove') {
          w.y = w.y0 + bounce * 0.07 * w.feel * go;
          w.cheer = (Math.floor(b + w.hop * 4) % 4 === 0 ? 0.9 : 0.15) * w.feel * (w.hop > 0.5 ? 1 : 0.4);
          w.yaw = w.yaw0 + Math.sin(t * 1.3 + w.seed) * 0.25;
        } else if (part === 'break') {
          w.y = w.y0 + Math.abs(Math.sin(t * 1.6 + w.seed)) * 0.03;
          w.cheer = w.hop > 0.85 ? 0.5 + 0.3 * Math.sin(t * 2 + w.seed) : 0;
          w.yaw = w.yaw0 + Math.sin(t * 0.7 + w.seed) * 0.4;
        } else if (part === 'build') {
          // (the hands going up as it rises; the last beats: down low, waiting)
          const low = prog > 0.88 ? 1 : 0;
          w.sit = low * (0.3 + 0.1 * w.hop);
          w.y = w.y0 + (low ? 0 : bounce * 0.05 * (1 + prog * 2));
          w.cheer = low ? 0 : Math.min(1, prog * 1.3 * (0.6 + w.feel * 0.4));
          w.yaw = w.yaw0 + Math.sin(t * 2 + w.seed) * 0.15;
        } else {
          // the drop: everyone jumping, hands up
          const big = this.dropT < this.barSec * 4 ? 1 : 0.55;
          w.y = w.y0 + Math.pow(bounce, 0.8) * (0.12 + 0.22 * big * w.feel) * go;
          w.cheer = big > 0.9 ? 1 : (Math.floor(b * 2 + w.hop * 4) % 2 ? 1 : 0.3) * w.feel;
          w.yaw = w.yaw0 + Math.sin(t * 2.6 + w.seed) * 0.3;
        }
        if (w.at === 'gogo') w.yaw = w.yaw0 + Math.sin(t * 0.8 + w.seed) * 1.6;
      } else if (w.at === 'rail' || w.at === 'vipStand') {
        // (up on the balconies: dancing where they stand, the hands up at the drop)
        w.y = w.y0 + (part === 'drop' ? bounce * 0.08 * w.feel : part === 'groove' ? bounce * 0.03 : 0);
        w.cheer = part === 'drop' ? (this.dropT < this.barSec * 4 ? 1 : (Math.floor(b + w.hop * 4) % 2 ? 0.8 : 0.2)) : part === 'build' ? prog * 0.9 : Math.sin(t * 0.7 + w.seed * 3) > 0.9 ? 0.6 : 0;
        w.yaw = w.yaw0 + Math.sin(t * 0.9 + w.seed) * 0.2;
      } else if (w.at === 'vip') {
        w.cheer = part === 'drop' && this.dropT < 3 ? 1 : Math.sin(t * 0.6 + w.seed * 4) > 0.9 ? 0.55 : 0;
      } else if (w.at === 'bar') {
        w.cheer = Math.sin(t * 0.7 + w.seed * 3) > 0.9 ? 0.55 : part === 'drop' && this.dropT < 3 ? 1 : 0;
        w.y = w.y0 + (part === 'drop' ? bounce * 0.03 : 0);
      } else if (w.at === 'staff') {
        w.cheer = 0.4 + 0.2 * Math.sin(t * 3 + w.seed);
      } else if (w.at === 'mc' || w.at === 'dj') {
        w.cheer = part === 'build' ? 1 : part === 'drop' ? (ph < 0.5 ? 1 : 0.6) : w.at === 'dj' ? 0.45 : 0.3 * bounce;
        w.y = w.y0 + bounce * (part === 'drop' ? 0.16 : 0.05);
      } else if (w.at === 'guard') {
        w.yaw = w.yaw0 + Math.sin(t * 0.3 + w.seed) * 0.4;
      } else if (w.at === 'talk') {
        w.cheer = Math.sin(t * 0.9 + w.seed * 5) > 0.85 ? 0.5 : 0;
        w.y = w.y0 + (part === 'drop' ? bounce * 0.04 : 0);
        w.yaw = w.yaw0 + Math.sin(t * 0.5 + w.seed) * 0.2;
      } else if (w.at === 'pose') {
        w.cheer = Math.sin(t * 0.4 + w.seed) > 0 ? 0.7 : 0.25;
      } else if (w.at === 'shoot') {
        w.cheer = 0.45;
      }
    }
    // the hosts with the bottles: along their way, a wait at the sofa, back to the bar
    const g = this.game;
    for (const s of this.servers) {
      if (s.lag > 0) {
        s.lag -= dt;
        continue;
      }
      if (s.wait > 0) {
        s.wait -= dt;
        s.speed = 0;
        if (s.wait <= 0) {
          s.back = true;
          s.path.reverse();
          s.leg = 0;
          s.cheer = 0.2;
        }
      } else {
        const tg = s.path[Math.min(s.leg + 1, s.path.length - 1)];
        const [tx, , tz] = F.P(tg[0], 0, tg[1]);
        const dx = tx - s.x;
        const dz = tz - s.z;
        const d = Math.hypot(dx, dz);
        const v = 1.2;
        if (d < 0.08) {
          s.leg++;
          if (s.leg >= s.path.length - 1) {
            if (s.back) s.done = true;
            else {
              s.wait = 7;
              if (s.toYou && !this.servedYou) {
                this.servedYou = true;
                this.served();
              }
            }
          }
        } else {
          s.x += (dx / d) * Math.min(d, v * dt);
          s.z += (dz / d) * Math.min(d, v * dt);
          s.yaw = Math.atan2(dx, dz);
          s.speed = 3.2 * v;
        }
      }
      s.phase += dt * 4 * (s.speed > 0 ? 1 : 0);
      // (the sparkler over the bottle, fizzing)
      if (!s.back && g.fx && near) g.fx.spray(s.x + Math.sin(s.yaw) * 0.08, s.y + s.scale * 2.08, s.z + Math.cos(s.yaw) * 0.08, 0, 1, 0, g.touch ? 1 : 3, 2.6, SPARK, { cone: 1.3, len: 0.07, life: 0.32, wide: 2 });
    }
    if (this.servers.some((s) => s.done)) this.servers = this.servers.filter((s) => !s.done);
  }

  // the bottles at your side: the balcony looks, cheers
  served() {
    const g = this.game;
    const p = g.player;
    p.hp = Math.min(p.maxHp, p.hp + 30);
    p.fig.belly = Math.min(1, p.fig.belly + 0.2);
    p.fig.bellyColor = [0.95, 0.9, 0.6];
    if (g.fx) g.fx.confetti(p.pos.x, p.pos.y + 2.2, p.pos.z, 30, 3);
    g.audio.play('cheer', 0.5);
    g.hud.toast('הבקבוקים הגיעו עם הזיקוקים! כל המרפסת מריעה לכם. +30 חיים', 'good', 3.5);
    for (const w of this.crowd) if (Math.hypot(w.x - p.pos.x, w.z - p.pos.z) < 6) w.cheer = 1;
  }

  // ------------------------------------------------------------------ drawing (game/game.js)
  draw(fr) {
    if (!this.set) return;
    const g = this.game;
    const F = this.F;
    const P = this.P;
    const cam = g.camera.position;
    const inCam = this.inCam;
    const dc = Math.hypot(cam.x - F.cx, cam.z - F.cz);
    if (inCam || dc < 34) {
      drawPeople(g, this.crowd, g.touch ? 30 : 48);
      drawPeople(g, this.servers, 48);
    }
    if (!inCam || this.part === 'off') return;
    const b = this.beat;
    const ph = b - Math.floor(b);
    const pulse = Math.pow(1 - ph, 2);
    const t = this.t;
    const part = this.part;
    const { mid } = P;
    const { y0, y1 } = F;
    const fl = P.floor;
    const fc = [(fl.u0 + fl.u1) / 2, (fl.d0 + fl.d1) / 2];
    const drop = part === 'drop';
    const build = part === 'build';
    const brk = part === 'break';
    let id = 7300;
    // the moving heads' beams: up over the hall from the stage's lip, down onto the floor from the
    // balconies, sweeping
    const hk = drop ? 1 : brk ? 0.35 : build ? 0.5 + this.prog * 0.5 : 0.7;
    for (const h of this.heads) {
      if (brk && h.i % 3) continue;
      const sw = Math.sin(t * (drop ? 1.5 : 0.7) + h.i * 0.9);
      const sw2 = Math.cos(t * (drop ? 1.2 : 0.55) + h.i * 1.3);
      let tu;
      let td;
      let ty;
      if (h.up) {
        tu = h.u + sw * 7;
        td = fc[1] + 6 + sw2 * 8;
        ty = y1 - 0.4;
      } else {
        tu = fc[0] + sw * 7;
        td = fc[1] + sw2 * 6;
        ty = y0 + 0.05;
      }
      const [ex, , ez] = F.P(tu, 0, td);
      const c = brk ? [0.85, 0.9, 1] : BEAM_C[pm(h.i + Math.floor(b / (drop ? 1 : 4)), BEAM_C.length)];
      const al = (0.11 + 0.26 * (drop ? pulse : 0.5)) * hk;
      const [x, y, z] = h.at;
      for (let k = -1; k <= 1; k++) {
        const o = k * 0.28;
        fr.lineXYZ(x, y, z, ex + o, ty, ez + o * 0.6, c, 7 - Math.abs(k) * 2, id++, al * (k ? 0.5 : 1), 0.001, 0);
      }
    }
    // the lasers: fans of thin lines, sweeping
    if (!brk) {
      const n = g.touch ? 5 : drop ? 12 : 7;
      const spread = drop ? 0.95 : 0.65;
      for (const L of this.lasers) {
        if (build && L.n === 1 && this.prog < 0.5) continue;
        const c = LASER_C[pm(L.s + 2 + L.n + Math.floor(b / 8), LASER_C.length)];
        const sweep = Math.sin(t * (drop ? 1.7 : 0.8) + L.s + L.n) * 0.45;
        const tilt = L.rise + Math.sin(t * 0.7 + L.s * 2) * 0.08;
        for (let k = 0; k < n; k++) {
          const a = L.base + sweep + (k / (n - 1) - 0.5) * spread * 2;
          // (in the room's frame: along d, fanned across u)
          const du = Math.sin(a);
          const dv = Math.cos(a);
          const len = this.clip(L.at, du, tilt, dv);
          const [lx, ly, lz] = L.at;
          fr.lineXYZ(lx, ly, lz, lx + dv * len, ly + tilt * len, lz - du * len, c, drop ? 2.4 : 1.8, id++, drop ? 0.85 : 0.6, 0.0005, 0);
        }
      }
    }
    // the strobes: in the build on the snare, in the drop on the beat
    let strobe = 0;
    if (build) {
      const rate = this.prog < 0.5 ? 1 : this.prog < 0.75 ? 2 : 4;
      if ((b * rate) % 1 < 0.18 && this.prog < 0.94) strobe = 0.5 + this.prog * 0.8;
    } else if (drop && this.dropT < this.barSec * 4 && ph < 0.12) strobe = 1;
    if (strobe > 0) {
      for (const [x, y, z] of this.strobes) fr.lineXYZ(x, y, z - 0.42, x, y, z + 0.42, [1, 1, 1], 12, id++, strobe, 0, 0);
      flashLight(F.x(fc[1]), y1 - 2, F.z(mid), 24, _white, 2.8 * strobe);
    }
    // the flames: columns of fire from the stage's lip, rising, falling, flickering
    if (this.flameT > 0) {
      const life = 1 - this.flameT / 0.95;
      const env = life < 0.2 ? life / 0.2 : 1 - ((life - 0.2) / 0.8) * 0.85;
      this.pyro.forEach(([x, y, z], i) => {
        if (!this.flameOn(i)) return;
        const h = 4.6 * env;
        const segs = 4;
        for (const [col, w, a] of [[[1, 0.3, 0.05], 34, 0.35], [[1, 0.58, 0.1], 22, 0.6], [[1, 0.88, 0.35], 12, 0.85], [[1, 1, 0.85], 5, 0.9]]) {
          let px = x;
          let py = y;
          let pz = z;
          for (let k = 1; k <= segs; k++) {
            const s = k / segs;
            const nx = x + Math.sin(t * 31 + i * 3 + k * 1.7) * 0.18 * s;
            const ny = y + h * s * (w < 6 ? 0.55 : 1);
            const nz = z + Math.cos(t * 27 + i + k) * 0.18 * s;
            fr.lineXYZ(px, py, pz, nx, ny, nz, col, w * (1.1 - s * 0.5), id++, a * env, 0.003, 0);
            px = nx;
            py = ny;
            pz = nz;
          }
        }
      });
      flashLight(F.x(P.stage.d1 + 2), y0 + 3, F.z(mid), 26, _fire, 3.4 * env);
    }
    // the rings' cables up to the ceiling
    if (this.rings) {
      const m = this.rings[0];
      const r = P.ring.r[0];
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + m.rotation.y;
        const x = m.position.x + Math.cos(a) * r;
        const z = m.position.z - Math.sin(a) * r;
        fr.lineXYZ(x, m.position.y, z, x, y1, z, [0.1, 0.1, 0.12], 1.5, id++, 0.9, 0, 0);
      }
    }
    // the colours on the floor: two washes chasing each other; the LED's glow on the stage
    const c1 = BEAM_C[pm(Math.floor(b / (drop ? 1 : 2)), BEAM_C.length)];
    const c2 = BEAM_C[pm(Math.floor(b / (drop ? 1 : 2)) + 2, BEAM_C.length)];
    _c1.setRGB(c1[0], c1[1], c1[2]);
    _c2.setRGB(c2[0], c2[1], c2[2]);
    const wk = brk ? 0.5 : 1;
    flashLight(F.x(fc[1] + Math.sin(t * 0.9) * 5), y0 + 5, F.z(fc[0] + Math.cos(t * 0.7) * 6), 13, _c1, (1.2 + 0.9 * pulse) * wk);
    flashLight(F.x(fc[1] - Math.sin(t * 0.8) * 5), y0 + 5, F.z(fc[0] - Math.cos(t * 0.6) * 6), 13, _c2, (1.2 + 0.9 * pulse) * wk);
    _led.setHSL(this.hue, 0.9, 0.55);
    if (this.flameT <= 0) flashLight(F.x(P.stage.d1 + 1), y0 + 4, F.z(mid), 16, _led, 1.4 + (drop ? 1.0 * pulse : 0.3));
    if (drop && this.dropT < 1.2) flashLight(F.x(fc[1]), y0 + 4, F.z(mid), 26, _white, 3.2 * (1 - this.dropT / 1.2));
    // (the ring light on the photo wall; its camera's flash now and then)
    if (this.photoWall && Math.hypot(cam.x - this.photoWall.ring[0], cam.z - this.photoWall.ring[2]) < 18) {
      const W = this.photoWall;
      flashLight(W.ring[0], W.ring[1], W.ring[2], 4, _white, 0.9);
      if ((t * 0.31) % 1 < 0.03) flashLight(W.cam[0], W.cam[1], W.cam[2], 5, _white, 2.4);
    }
  }

  // how far a laser goes from p along (du across, rise up, dv along) before it meets the room's walls
  clip(p, du, rise, dv) {
    const F = this.F;
    const [x, y, z] = p;
    let tMax = 60;
    const lim = (pos, dir, lo, hi) => {
      if (dir > 1e-4) tMax = Math.min(tMax, (hi - pos) / dir);
      else if (dir < -1e-4) tMax = Math.min(tMax, (lo - pos) / dir);
    };
    lim(x, dv, F.x(F.db), F.x(F.da));
    lim(y, rise, F.y0, F.y1);
    lim(z, -du, F.z(F.ub), F.z(F.ua));
    return Math.max(0.5, tMax);
  }

  // ------------------------------------------------------------------ what you can do there
  target() {
    if (!this.set || this.part === 'off' || (this.game.minigames && this.game.minigames.isOpen)) return null;
    const F = this.F;
    const P = this.P;
    const p = this.game.player.pos;
    if (!F.inside(p.x, p.z)) return null;
    const u = F.U(p.z);
    const d = F.D(p.x);
    const up = p.y > P.by - 1;
    if (!up) {
      if (Math.abs(u - P.mid) < 3 && d > P.barrier.d && d < P.barrier.d + 1.7) return { kind: 'dj', label: 'E — לבקש מהדי ג׳יי את הדרופ ($20)' };
      const fl = P.floor;
      if (u > fl.u0 && u < fl.u1 && d > fl.d0 && d < fl.d1) return { kind: 'dance', label: 'E — לרקוד על הרחבה (Ink Beat)' };
      return null;
    }
    if (d > P.upbar.d0 - 1.4 && Math.abs(u - P.mid) < 6.2) return { kind: 'upbar', label: 'E — הבר העליון: משקאות מעל הרחבה' };
    for (const v of P.vip) if (Math.abs(d - v.d) < 2.2 && Math.abs(u - v.u) < 4.2) return { kind: 'vip', label: 'E — שירות בקבוקים VIP עם זיקוקים ($150)' };
    return null;
  }

  interact() {
    const tg = this.target();
    if (!tg) return false;
    const g = this.game;
    const F = this.F;
    const P = this.P;
    if (tg.kind === 'dj') {
      if (this.part === 'build' || (this.part === 'drop' && this.dropT < 8)) {
        g.hud.toast('הדי ג׳יי מצביע על הרחבה: זה כבר קורה!', 'info', 2.5);
        return true;
      }
      if (g.money && !g.money.pay(20, 'DJ')) {
        g.money.refuse(F.name, 20);
        return true;
      }
      this.toBuild();
      g.audio.play('coins', 0.5);
      g.hud.toast('הדי ג׳יי מחייך ומרים יד אל הקהל: הדרופ בדרך!', 'good', 3);
      return true;
    }
    if (tg.kind === 'dance') {
      if (!g.minigames) return false;
      const p = g.player;
      p.fig.dance = 1;
      this.dancing = true;
      const le = P.led;
      const w = 10.5;
      const h = (w * 3) / 5;
      const at = F.P(P.mid, le.y0 + 1.6 + h / 2, le.d + 0.02);
      const u = Math.max(P.mid - 6, Math.min(P.mid + 6, F.U(p.pos.z)));
      const sd = P.floor.d0 + 4;
      const world = worldAt({ at, n: [1, 0], w, h, stand: sd - (le.d + 0.02), side: u - P.mid, y0: F.y0, back: 3.4, up: 2.8, camSide: 0, exit: [F.x(sd), F.z(u), -Math.PI / 2] });
      g.minigames.play(new DanceGame({ venue: F.name, style: 'disco', tips: true }), (r) => {
        p.fig.dance = 0;
        this.dancing = false;
        if (r && (r.grade === 'S' || r.grade === 'A')) {
          for (const q of this.crowd) if (q.at === 'dance') q.cheer = 1;
          g.audio.play('cheer', 0.5);
          g.hud.toast('כל הרחבה עצרה להסתכל עליכם!', 'good', 2.8);
        } else if (r && r.grade) g.hud.toast('רקדתם עם כל המועדון', 'good', 2.4);
      }, { world });
      return true;
    }
    if (tg.kind === 'vip') {
      if (this.servers.length) {
        g.hud.toast('המארחים כבר בדרך עם הבקבוקים', 'info', 2.2);
        return true;
      }
      if (g.money && !g.money.pay(150, 'VIP')) {
        g.money.refuse('VIP', 150);
        return true;
      }
      this.servedYou = false;
      this.service(true);
      g.audio.play('coins', 0.6);
      g.hud.toast('הזמנתם שירות בקבוקים! המארחים יוצאים מהבר העליון עם הזיקוקים', 'good', 3);
      return true;
    }
    if (tg.kind === 'upbar') {
      const menu = [['מוקטייל ניאון (+15 חיים)', 9, 15, [0.4, 0.85, 0.9]], ['אנרגיה קרה (+20 חיים)', 12, 20, [0.9, 0.95, 0.3]], ['לימונדה ורודה (+10 חיים)', 6, 10, [1, 0.6, 0.75]]];
      g.dialog.show('NEON INK', 'Best view of the floor. What can I get you?', menu.map(([label, price, hp, colr]) => ({
        label: `${label} · $${price}`,
        fn: () => {
          if (!g.money || g.money.pay(price, label)) {
            const pl = g.player;
            pl.hp = Math.min(pl.maxHp, pl.hp + hp);
            pl.fig.belly = Math.min(1, pl.fig.belly + 0.15);
            pl.fig.bellyColor = colr;
            g.audio.play('coins', 0.5);
            g.hud.toast(`${label.split(' (')[0]}! +${hp} חיים`, 'good', 2);
          } else g.money.refuse(F.name, price);
        },
      })));
      return true;
    }
    return false;
  }

  // the DJ takes it to the build now (the drop four bars later)
  toBuild() {
    const S = this.sound;
    if (S.band && S.c && S.c.state === 'running') S.jump(20);
    else this.clock = (this.songN * BARS + 20) * ((4 * 60) / BPM);
  }
}

const _white = new THREE.Color(1, 1, 1);
const _fire = new THREE.Color(1, 0.55, 0.15);
const _c = new THREE.Color();
const _c1 = new THREE.Color();
const _c2 = new THREE.Color();
const _led = new THREE.Color();
