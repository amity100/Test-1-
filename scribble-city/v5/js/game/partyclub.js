import * as THREE from 'three';
import { Kit, linC } from './items.js';
import { clubMats, pictureGeo } from './venuekit.js';
import { flashLight, makeSurface, canvasTexture } from '../render/materials.js';
import { worldAt } from '../ui/minigame.js';
import { barLook, BAR_STYLE_NAMES, bouncerLook, civilianLook, modest } from './looks.js';
import { DanceGame } from './minigames/dance.js';
import { venueFrame, floorQuad, canvas, PartySound, drawPeople } from './partykit.js';
import { paintLED, paintFloor, paintNeon, paintBackdrop } from './partyart.js';

// (v5, ROADMAP 12.9) NEON INK's night: the club the way a real one goes on a big night. Its room and
// its furniture are the city's (world/venues2.js: the stage and the decks, the floor of light, the
// truss, the bar, the VIP booths); here, the show over it all, built when you come near:
// - the wall of LED behind the DJ playing to the music (game/partyart.js), the floor's squares lit
//   in patterns to the beat, the moving heads on the truss throwing their beams down through the
//   haze, lasers fanning out over the crowd from the stage, strobes, the mirror ball's spots
//   wheeling round the walls;
// - the line arrays hung either side of the stage, the CO2 cannons on its lip, two go-go dancers
//   on their lit podiums, neon on the walls;
// - the music in its parts (game/partykit.js): the groove; the break - the beat gone, the hands
//   down, the haze rolling; the build - the snare rolling faster and faster, the hands going up,
//   the lights strobing, the countdown on the wall, everyone crouching for the last beat; and the
//   drop: the CO2 jets blasting, confetti over the floor, the whole room jumping;
// - and a crowd packed onto the floor, the bar three deep, the bottle service going by to the VIP
//   booths with its sparklers held high.
// You can dance on the floor (Ink Beat on the wall of LED), tip the DJ for the drop, and have the
// bottles brought to you with the sparklers.

const BARS = 40;
// (the song: sixteen bars of groove, four of break, four of build - its snare rolling in fours,
// then twos, then every step - a breath of nothing, then sixteen bars of the drop)
export const CLUB_FORM = (bar, k) => (bar >= 16 && bar < 20 ? 'break' : bar >= 20 && bar < 22 ? 'roll4' : bar === 22 ? 'roll2' : bar === 23 ? (k >= 12 ? 'gap' : 'roll1') : null);
const partOf = (bar) => (bar < 16 ? 'groove' : bar < 20 ? 'break' : bar < 24 ? 'build' : 'drop');
const BPM = 126;
const NEAR = 64;
const HUES = [0.9, 0.52, 0.76, 0.12];
const LASER_C = [[0.3, 1, 0.4], [0.2, 0.9, 1], [1, 0.25, 0.5], [0.8, 0.35, 1]];
const BEAM_C = [[1, 0.35, 0.75], [0.3, 0.9, 1], [1, 0.9, 0.35], [0.55, 1, 0.6], [0.75, 0.5, 1]];
const SPARK = [[1, 0.95, 0.75], [1, 0.8, 0.4], [1, 1, 1]];
const pm = (a, n) => ((Math.floor(a) % n) + n) % n;
const R = Math.random;

export class ClubNight {
  constructor(game, key) {
    this.game = game;
    this.F = venueFrame(key);
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
    const touch = g.touch;
    const CM = clubMats('club');
    const K = new Kit();
    const col = g.world.collision;
    const { mid, db, da, f0, f1, y0, y1, ty, ua } = F;
    // (a box in the room's frame: u along the front, d out of it)
    const B = (u0, ya, d0, u1, yb, d1, mat, c) => K.box(mat, F.x(Math.min(d0, d1)), ya, F.z(Math.max(u0, u1)), F.x(Math.max(d0, d1)), yb, F.z(Math.min(u0, u1)), c);
    const CYL = (u, d, r, ya, yb, mat, c, segs = 10, r1 = r) => K.cyl(mat, r, r1, ya, yb, c, { axis: 'y', x: F.x(d), z: F.z(u), segs });
    const BLACK = linC(0.03, 0.03, 0.04);
    const GRILLE = linC(0.12, 0.12, 0.14);
    const STEEL = linC(0.4, 0.41, 0.45);
    // the line arrays hung either side of the stage, curving in at the bottom
    for (const s of [-1, 1]) {
      const u = mid + s * 4.9;
      for (let k = 0; k < 6; k++) {
        const yt = y1 - 0.75 - k * 0.34;
        const dd = k * k * 0.014;
        B(u - 0.5, yt - 0.32, db + 2.15 + dd, u + 0.5, yt, db + 2.7 + dd, CM.matte, BLACK);
        B(u - 0.44, yt - 0.28, db + 2.7 + dd, u + 0.44, yt - 0.04, db + 2.712 + dd, CM.matte, GRILLE);
      }
      for (const du of [-0.4, 0.4]) CYL(u + du, db + 2.42, 0.012, y1 - 0.75, y1, CM.metal, STEEL, 4);
    }
    // the CO2 cannons on the stage's lip
    this.co2 = [];
    for (const du of [-3.2, -1.7, 1.7, 3.2]) {
      CYL(mid + du, db + 2.38, 0.1, y0 + 0.6, y0 + 0.74, CM.matte, BLACK, 10);
      CYL(mid + du, db + 2.38, 0.045, y0 + 0.74, y0 + 1.04, CM.metal, STEEL, 8);
      this.co2.push(F.P(mid + du, y0 + 1.06, db + 2.38));
    }
    // the lasers: two on the stage's speakers (over the crowd, to the back of the room), two on the
    // truss's far corners (down and back over the floor)
    this.lasers = [];
    for (const s of [-1, 1]) {
      // (on top of the speakers' stacks: over the heads of the crowd)
      B(mid + s * 3.0 - 0.17, y0 + 3.0, db + 0.5, mid + s * 3.0 + 0.17, y0 + 3.24, db + 0.87, CM.matte, BLACK);
      K.sphere(CM.glow, 0.035, ...F.P(mid + s * 3.0, y0 + 3.12, db + 0.88), linC(0.4, 1, 0.5), 1, 1, 1, 6);
      this.lasers.push({ at: F.P(mid + s * 3.0, y0 + 3.12, db + 0.9), dd: 1, s, rise: -0.04 });
      B(mid + s * 4.6 - 0.17, ty - 0.62, f1 - 0.18, mid + s * 4.6 + 0.17, ty - 0.36, f1 + 0.18, CM.matte, BLACK);
      this.lasers.push({ at: F.P(mid + s * 4.6, ty - 0.5, f1 - 0.2), dd: -1, s, rise: -0.25 });
    }
    // the go-go dancers' podiums, lit round their rims
    this.podiums = [];
    for (const s of [-1, 1]) {
      const u = mid + s * 6.7;
      const d = f0 + 1.6;
      CYL(u, d, 0.62, y0, y0 + 0.92, CM.paint, linC(0.07, 0.06, 0.09), 22, 0.72);
      CYL(u, d, 0.65, y0 + 0.92, y0 + 0.98, CM.glow, linC(1, 0.3, 0.72), 22);
      CYL(u, d, 0.74, y0 + 0.03, y0 + 0.09, CM.glow, linC(0.3, 0.9, 1), 22);
      const [x, , z] = F.P(u, 0, d);
      this.cols.push(col.addBox(x - 0.7, z - 0.7, x + 0.7, z + 0.7, -1, y0 + 0.98, 'prop'));
      this.podiums.push({ u, d, y: y0 + 0.98 });
    }
    // the strobes on the truss (lit when they flash: draw())
    this.strobes = [];
    for (const d of [f0, f1]) for (const du of [-2.2, 2.2]) {
      B(mid + du - 0.35, ty - 0.42, d - 0.08, mid + du + 0.35, ty - 0.3, d + 0.08, CM.matte, BLACK);
      this.strobes.push(F.P(mid + du, ty - 0.45, d));
    }
    // the moving heads (the room's own, on the truss: world/venues2.js) - where their beams start
    this.heads = [];
    let i = 0;
    for (const d of [f0, f1]) for (let u = mid - 4.5; u <= mid + 4.5 + 1e-6; u += touch ? 3 : 1.5) this.heads.push({ i: i++, u, d, at: F.P(u, ty - 0.57, d) });
    const group = K.build({ seed: 0.37 });
    // ---- the wall of LED (over the room's bands of light)
    const LW = touch ? 256 : 512;
    const LH = Math.round(LW * 0.47);
    this.ledC = canvas(LW, LH);
    this.ledTex = canvasTexture(this.ledC, { mips: false });
    this.ledMat = makeSurface({ kind: 'uv', map: this.ledTex, uvScale: 1, ang: 0.3, wash: 1, line: 0.06, indoor: 'club', emissive: new THREE.Color(1.5, 1.5, 1.5), emMap: this.ledTex });
    const lw = 10.6;
    const lh = y1 - 0.7 - (y0 + 0.8);
    const la = F.P(mid, y0 + 0.8 + lh / 2, db + 0.135);
    this.led = new THREE.Mesh(pictureGeo(lw, lh, la[0], la[1], la[2], 1, 0), this.ledMat);
    this.led.frustumCulled = false;
    group.add(this.led);
    // ---- the floor's squares (over the room's own)
    const NX = 9;
    const NY = Math.max(1, Math.round(f1 - f0));
    const PX = touch ? 12 : 24;
    this.floorN = [NX, NY, PX];
    this.floorC = canvas(NX * PX, NY * PX);
    this.floorTex = canvasTexture(this.floorC, { mips: false });
    this.floorMat = makeSurface({ kind: 'uv', map: this.floorTex, uvScale: 1, ang: 0.3, wash: 1, line: 0.05, indoor: 'club', emissive: new THREE.Color(1.25, 1.25, 1.25), emMap: this.floorTex });
    {
      const c = (u, d) => { const p = F.P(u, 0, d); return [p[0], p[2]]; };
      const geo = floorQuad([c(mid - 4.5, f0), c(mid + 4.5, f0), c(mid + 4.5, f1), c(mid - 4.5, f1)], y0 + 0.022);
      const m = new THREE.Mesh(geo, this.floorMat);
      m.frustumCulled = false;
      group.add(m);
    }
    // ---- the neon on the walls
    const signs = [
      { text: 'DANCE ALL NIGHT', color: '#3fe8ff' },
      { text: 'NO SLEEP TILL SUNRISE', color: '#ff4fb0' },
      { text: 'GOOD VIBES ONLY', color: '#ffe14f' },
      { text: 'love', color: '#ff3f6a', heart: true },
    ];
    const ng = paintNeon(signs, touch ? 512 : 1024, touch ? 64 : 128);
    this.neonTex = canvasTexture(ng.c, { mips: true });
    this.neonMat = makeSurface({ kind: 'uv', map: this.neonTex, uvScale: 1, ang: 0.3, wash: 1, line: 0.05, indoor: 'club', emissive: new THREE.Color(1.4, 1.4, 1.4), emMap: this.neonTex });
    const sign = (text, u, y, d, h, nx, nz, wmax = 9) => {
      const bx = ng.boxes[text];
      const w = Math.min(wmax, h * bx.aspect);
      const p = F.P(u, y, d);
      const m = new THREE.Mesh(pictureGeo(w, h, p[0], p[1], p[2], nx, nz, bx.uv), this.neonMat);
      m.frustumCulled = false;
      group.add(m);
    };
    // (on the back wall in its corners, clear of the columns; on the front wall over the floor; the
    // heart over the bar)
    sign('DANCE ALL NIGHT', ua + 2.7, y0 + 4.2, db + 0.05, 0.72, 1, 0, 4.6);
    sign('NO SLEEP TILL SUNRISE', F.ub - 2.7, y0 + 4.2, db + 0.05, 0.6, 1, 0, 4.6);
    sign('GOOD VIBES ONLY', mid + 3.5, y0 + 4.2, da - 0.04, 0.9, -1, 0, 6.5);
    sign('love', F.ub - 0.04, y0 + 4.3, (f0 + f1) / 2 - 2, 1.3, 0, 1);
    // ---- the photo wall by the door: the backdrop of the club's name, the ring light before it
    {
      const pu = F.ub - 4.7;
      const bw = 4.0;
      const bh = 2.5;
      this.backTex = canvasTexture(paintBackdrop(F.name, ['#ff4fb0', '#3fe8ff', '#ffffff']), { mips: true });
      this.backMat = makeSurface({ kind: 'uv', map: this.backTex, uvScale: 1, ang: 0.4, wash: 0.95, line: 0.1, indoor: 'club', emissive: new THREE.Color(0.55, 0.55, 0.55), emMap: this.backTex });
      const p = F.P(pu, y0 + 0.15 + bh / 2, da - 0.06);
      const m = new THREE.Mesh(pictureGeo(bw, bh, p[0], p[1], p[2], -1, 0), this.backMat);
      m.frustumCulled = false;
      group.add(m);
      const KR = new Kit();
      // (its frame, the ring light on its stand, the photographer's camera on its tripod)
      KR.box(CM.metal, ...F.P(pu + bw / 2 + 0.05, y0, da - 0.12).map((v, k) => v - (k === 1 ? 0 : 0.04)), ...F.P(pu + bw / 2, y0 + bh + 0.25, da - 0.02), STEEL);
      KR.box(CM.metal, ...F.P(pu - bw / 2, y0, da - 0.12).map((v, k) => v - (k === 1 ? 0 : 0.04)), ...F.P(pu - bw / 2 - 0.05, y0 + bh + 0.25, da - 0.02), STEEL);
      const [rx, , rz] = F.P(pu - 1.0, 0, da - 2.6);
      KR.cyl(CM.metal, 0.02, 0.02, y0, y0 + 1.55, STEEL, { axis: 'y', x: rx, z: rz, segs: 6 });
      const ring = new THREE.TorusGeometry(0.32, 0.035, 6, 24);
      ring.rotateY(Math.PI / 2);
      ring.translate(rx, y0 + 1.85, rz);
      KR.add(CM.glow, ring, linC(1, 0.97, 0.92));
      const [cx, , cz] = F.P(pu + 0.6, 0, da - 3.3);
      for (const [ox, oz] of [[-0.25, -0.15], [0.25, -0.15], [0, 0.25]]) KR.cyl(CM.metal, 0.012, 0.012, y0, y0 + 1.45, BLACK, { axis: 'y', x: cx + ox * 0.6, z: cz + oz * 0.6, segs: 4 });
      KR.box(CM.matte, cx - 0.06, y0 + 1.45, cz - 0.1, cx + 0.12, y0 + 1.6, cz + 0.1, BLACK);
      for (const mm of KR.build({ seed: 0.4 }).children.slice()) group.add(mm);
      this.photoWall = { u: pu, d: da - 1.0, ring: [rx, y0 + 1.85, rz], cam: [cx, y0 + 1.5, cz] };
    }
    this.mats = [this.ledMat, this.floorMat, this.neonMat, this.backMat];
    this.texs = [this.ledTex, this.floorTex, this.neonTex, this.backTex];
    group.updateMatrix();
    g.scene.add(group);
    this.set = group;
    // the way into the VIP booths through their rope (world/venues2.js: the gap at its middle)
    const vd0 = f0 + 0.2;
    const vd1 = da - 2.8;
    const n = Math.floor((vd1 + 0.21 - (vd0 - 0.2)) / 1.4) + 1;
    const gi = Math.floor(n / 2) - 1;
    this.vipGap = [ua + 2.65 + 0.7, vd0 - 0.2 + (gi + 0.5) * 1.4];
    this.booths = [];
    for (let d = vd0 + 1.1; d < vd1 - 0.8; d += 2.7) this.booths.push(d);
    this.makeCrowd();
    this.paint(0);
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
    this.crowd = [];
    this.servers = [];
    this.sound.stop();
  }

  // ------------------------------------------------------------------ the people
  makeCrowd() {
    const g = this.game;
    const F = this.F;
    const N = g.touch ? 0.38 : 1;
    const night = this.nightK();
    const list = [];
    const { mid, f0, f1, y0, ub } = F;
    const person = (u, d, yaw, at, o = {}) => {
      const look = o.look || barLook(BAR_STYLE_NAMES[Math.floor(R() * BAR_STYLE_NAMES.length)]);
      const [x, y, z] = F.P(u, o.y || y0, d);
      list.push({ x, z, y, y0: y, u, d, look, scale: look.build.height, yaw, yaw0: yaw, speed: 0, phase: R() * 6, seed: R() * 100, cheer: 0, sit: 0, at, indoor: 3, hop: R(), feel: 0.4 + R() * 0.6, ...o });
    };
    // (facing the stage: the room's back is -d, the world's -x)
    const STAGE = -Math.PI / 2;
    // the room's own dancers stand at these: the crowd round them
    const own = [];
    for (let i = 0; i < 14; i++) own.push([mid - 3.8 + (i % 4) * 2.5 + (Math.floor(i / 4) % 2) * 0.9, f0 + 1.0 + Math.floor(i / 4) * 2.3]);
    const free = (u, d) => own.every(([a, b]) => Math.hypot(u - a, d - b) > 0.65) && this.podiums.every((q) => Math.hypot(u - q.u, d - q.d) > 1.0);
    const fill = (night * 0.55 + 0.2) * N;
    for (let u = mid - 4.2; u <= mid + 4.2; u += 0.82) {
      for (let d = f0 + 0.55; d < f1 - 0.2; d += 0.92) {
        if (R() > fill) continue;
        const uu = u + (R() - 0.5) * 0.4;
        const dd = d + (R() - 0.5) * 0.4;
        if (!free(uu, dd)) continue;
        // (the nearer the stage, the more of them facing it; at the back some face each other)
        const yaw = STAGE + (R() < 0.8 ? (R() - 0.5) * 0.7 : (R() - 0.5) * 3);
        person(uu, dd, yaw, 'dance');
      }
    }
    // the back of the crowd, between the floor and the tall tables
    for (let u = mid - 5; u <= mid + 5; u += 0.9) if (R() < 0.35 * fill) person(u + (R() - 0.5) * 0.4, f1 + 0.4 + R() * 1.0, STAGE + (R() - 0.5) * 0.8, 'dance');
    // round the podiums, looking up
    for (const q of this.podiums) {
      for (let k = 0; k < 4; k++) {
        if (R() > 0.7 * N + 0.2) continue;
        const a = R() * Math.PI * 2;
        const u = q.u + Math.cos(a) * 1.25;
        const d = q.d + Math.sin(a) * 1.25;
        if (Math.abs(u - mid) < 4.6 && d > f0 && d < f1) continue;
        person(u, d, Math.atan2(-(Math.sin(a) * 1), Math.cos(a) * 1), 'dance');
      }
    }
    // the go-go dancers on the podiums (sequins, sleeves)
    for (const q of this.podiums) {
      const L = modest(civilianLook({ fem: R() < 0.7, kind: 'dress', pen: 'gelPurple' }));
      L.top = { kind: 'jacket', color: [0.95, 0.85, 0.3], sleeves: 'long', inner: [0.95, 0.3, 0.7] };
      person(q.u, q.d, STAGE + Math.PI, 'gogo', { look: L, y: q.y });
    }
    // the bar: standing behind the stools, three deep in the middle
    for (let d = f0 + 0.8; d < F.da - 3.2; d += 0.75) {
      for (let row = 0; row < 3; row++) {
        if (R() > (row === 0 ? 0.5 : row === 1 ? 0.3 : 0.15) * N + 0.05) continue;
        person(ub - 3.25 - row * 0.7 + (R() - 0.5) * 0.2, d + (R() - 0.5) * 0.3, Math.PI + (R() - 0.5) * 0.8, 'bar');
      }
    }
    // between the floor and the doors: friends standing about in their groups, a drink in hand
    const groups = g.touch ? 3 : 7;
    for (let k = 0; k < groups; k++) {
      const cu = F.ua + 7.5 + R() * (F.ub - F.ua - 16);
      const cd = f1 + 1.6 + R() * (F.da - 2.2 - (f1 + 1.6));
      const n = 2 + Math.floor(R() * 3);
      for (let q = 0; q < n; q++) {
        const a = (q / n) * Math.PI * 2 + R() * 0.5;
        const u = cu + Math.cos(a) * 0.55;
        const d = cd + Math.sin(a) * 0.55;
        // (facing the middle of their group: in the world, the way from them to it)
        person(u, d, Math.atan2(-Math.sin(a), Math.cos(a)), 'talk');
      }
    }
    // the photo wall: two posing, a third taking it
    if (this.photoWall) {
      const W = this.photoWall;
      for (const du of [-0.45, 0.45]) person(W.u + du, W.d, -Math.PI / 2, 'pose');
      person(W.u + 0.6, F.da - 3.6, Math.PI / 2, 'shoot');
    }
    // the MC on the stage beside the decks; the bouncer at the VIP rope; the photographer
    person(mid + 1.9, F.db + 1.3, Math.PI / 2, 'mc', { y: y0 + 0.6, look: modest(civilianLook({ kind: 'street', pen: 'comic' })) });
    if (this.vipGap) person(this.vipGap[0] + 0.5, this.vipGap[1] + 1.1, Math.PI, 'guard', { look: bouncerLook() });
    person(mid - 5.4, f1 + 1.0, STAGE + 0.3, 'photo');
    this.crowd = list;
  }

  nightK() {
    const h = this.game.daynight ? this.game.daynight.hour : 23;
    // (the afternoon's day party a few; the floor full from ten)
    return h >= 22 || h < 4 ? 1 : h >= 19 ? 0.7 : 0.35;
  }

  // the bottles carried in: two hosts from the bar's end, the bottles held high, sparklers fizzing;
  // to a VIP booth (or to you, when you asked)
  service(toYou) {
    const F = this.F;
    const g = this.game;
    const start = [F.ub - 2.2, F.f1 + 2.8];
    let path;
    if (toYou) {
      const u = F.U(g.player.pos.z);
      const d = F.D(g.player.pos.x);
      path = [start, [u + 0.8, F.f1 + 2.8], [u + 0.8, d + 0.9]];
    } else {
      const bd = this.booths[Math.floor(R() * this.booths.length)] || F.f1;
      const gp = this.vipGap;
      path = [start, [gp[0] + 0.6, F.f1 + 2.8], [gp[0] + 0.6, gp[1]], [F.ua + 2.2, gp[1]], [F.ua + 2.2, bd]];
    }
    for (let k = 0; k < 2; k++) {
      const L = modest(civilianLook({ fem: k === 0, kind: 'office', pen: 'fineliner' }));
      L.top = { kind: 'vest', color: [0.08, 0.08, 0.1], sleeves: 'long', under: [0.95, 0.95, 0.92] };
      const [x, y, z] = F.P(start[0], F.y0, start[1] - k * 0.9);
      this.servers.push({ x, z, y, y0: y, look: L, scale: L.build.height, yaw: 0, speed: 0, phase: R() * 6, seed: R() * 100, cheer: 1, sit: 0, indoor: 3, path: path.map(([u, d], i) => (i === path.length - 1 ? [u + k * 0.5, d - k * 0.3] : [u, d - k * 0.9])), leg: 0, wait: 0, back: false, toYou, lag: k * 0.9 });
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
      S.update(playing ? 0 : inCam ? 0.36 : 0.16 * Math.max(0, 1 - dd / 32), cut);
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
    if (this.part === 'drop' && this.dropped !== this.songN) {
      this.dropped = this.songN;
      if (inCam || inP) this.drop(true);
    }
    // (half way through the drop, the cannons again)
    if (this.part === 'drop' && this.bar >= 32 && this.dropped2 !== this.songN) {
      this.dropped2 = this.songN;
      if (inCam || inP) this.drop(false);
    }
    // the bottles go by now and then (every other song, in its drop)
    if (this.part === 'drop' && this.bar > 26 && this.parade !== this.songN && this.songN % 2 === 0 && this.servers.length === 0) {
      this.parade = this.songN;
      this.service(false);
    }
    if (inP && !this.welcomed && on) {
      this.welcomed = true;
      g.hud.big(F.name, 2000);
      g.hud.toast('הרחבה מלאה! E על הרחבה כדי לרקוד, ליד הבמה כדי לבקש מהדי ג׳יי את הדרופ, ובחבל של ה־VIP לבקבוק עם זיקוקים', 'info', 5);
    }
    if (!inP && dist > 40) this.welcomed = false;
    if (this.led) this.led.visible = !this.dancing;
    // the walls' pictures, repainted as the music goes
    if (inCam || (dd < 14 && on)) {
      this.paintT = (this.paintT || 0) + dt;
      if (this.paintT >= (g.touch ? 0.11 : 0.06)) {
        this.paint(this.paintT);
        this.paintT = 0;
      }
    }
    this.animate(dt, inCam || inP);
  }

  paint() {
    const s = { t: this.t, beat: this.beat, part: this.part === 'off' ? 'break' : this.part, prog: this.prog || 0, dropT: this.dropT, name: this.F.name, hue: this.hue };
    paintLED(this.ledC.getContext('2d'), this.ledC.width, this.ledC.height, s);
    this.ledTex.needsUpdate = true;
    const [nx, ny, px] = this.floorN;
    paintFloor(this.floorC.getContext('2d'), nx, ny, px, s);
    this.floorTex.needsUpdate = true;
  }

  // the drop: the cannons blast, the confetti comes down, the room jumps
  drop(first) {
    const g = this.game;
    const fx = g.fx;
    const F = this.F;
    if (fx) {
      for (const [x, y, z] of this.co2) {
        fx.spray(x, y, z, 0, 1, 0, g.touch ? 10 : 22, 11, [0.92, 0.95, 1], { cone: 0.1, len: 0.6, wide: 9, life: 0.85, grav: false });
        for (let k = 0; k < (g.touch ? 2 : 3); k++) fx.sprite(R() < 0.5 ? 'smoke0' : 'smoke1', x + (R() - 0.5) * 0.2, y + 0.5 + k * 0.8, z + (R() - 0.5) * 0.2, { size: 0.55 + k * 0.25, grow: 1.6, life: 0.9 + R() * 0.4, vy: 3.4, alpha: 0.5, tint: [1.15, 1.15, 1.25] });
      }
      if (first) {
        for (const [du, dv] of [[-2.5, 0.3], [2.5, 0.3], [-2.5, 0.7], [2.5, 0.7]]) {
          const [x, , z] = F.P(F.mid + du, 0, F.f0 + (F.f1 - F.f0) * dv);
          fx.confetti(x, F.y1 - 0.6, z, g.touch ? 18 : 40, 2.5);
        }
      }
    }
    g.audio.play('whoosh', 0.35);
    if (first) g.audio.play('cheer', 0.55);
  }

  animate(dt, near) {
    const b = this.beat;
    const ph = b - Math.floor(b);
    const part = this.part;
    const prog = this.prog;
    const t = this.t;
    for (const w of this.crowd) {
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
      } else if (w.at === 'bar') {
        w.cheer = Math.sin(t * 0.7 + w.seed * 3) > 0.9 ? 0.55 : part === 'drop' && this.dropT < 3 ? 1 : 0;
        w.y = w.y0 + (part === 'drop' ? bounce * 0.03 : 0);
      } else if (w.at === 'mc') {
        w.cheer = part === 'build' ? 1 : part === 'drop' ? (ph < 0.5 ? 1 : 0.6) : 0.3 * bounce;
        w.y = w.y0 + bounce * (part === 'drop' ? 0.18 : 0.05);
      } else if (w.at === 'talk') {
        // (a word, a laugh, the glass raised now and then; nodding to the beat)
        w.cheer = Math.sin(t * 0.9 + w.seed * 5) > 0.85 ? 0.5 : 0;
        w.y = w.y0 + (part === 'drop' ? bounce * 0.04 : 0);
        w.yaw = w.yaw0 + Math.sin(t * 0.5 + w.seed) * 0.2;
      } else if (w.at === 'pose') {
        w.cheer = Math.sin(t * 0.4 + w.seed) > 0 ? 0.7 : 0.25;
      } else if (w.at === 'shoot') {
        w.cheer = 0.45;
      } else if (w.at === 'photo') {
        w.cheer = 0.45;
        w.yaw = w.yaw0 + Math.sin(t * 0.3 + w.seed) * 0.8;
      }
    }
    // the hosts with the bottles: along their way, a wait at the booth, back to the bar
    const F = this.F;
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
        const v = 1.15;
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
      if (!s.back && g.fx && near) {
        const hx = s.x + Math.sin(s.yaw) * 0.08;
        const hz = s.z + Math.cos(s.yaw) * 0.08;
        g.fx.spray(hx, s.y + s.scale * 2.08, hz, 0, 1, 0, g.touch ? 1 : 3, 2.6, SPARK, { cone: 1.3, len: 0.07, life: 0.32, wide: 2 });
      }
    }
    if (this.servers.some((s) => s.done)) this.servers = this.servers.filter((s) => !s.done);
  }

  // the bottles at your side: the room looks, cheers
  served() {
    const g = this.game;
    const p = g.player;
    p.hp = Math.min(p.maxHp, p.hp + 30);
    p.fig.belly = Math.min(1, p.fig.belly + 0.2);
    p.fig.bellyColor = [0.95, 0.9, 0.6];
    if (g.fx) g.fx.confetti(p.pos.x, p.pos.y + 2.2, p.pos.z, 30, 3);
    g.audio.play('cheer', 0.5);
    g.hud.toast('הבקבוקים הגיעו עם הזיקוקים! כל המועדון מסתכל עליכם. +30 חיים', 'good', 3.5);
    for (const w of this.crowd) if (Math.hypot(w.x - p.pos.x, w.z - p.pos.z) < 5) w.cheer = 1;
  }

  // ------------------------------------------------------------------ drawing (game/game.js)
  draw(fr) {
    if (!this.set) return;
    const g = this.game;
    const F = this.F;
    const cam = g.camera.position;
    const inCam = this.inCam;
    const dc = Math.hypot(cam.x - F.cx, cam.z - F.cz);
    if (inCam || dc < 30) {
      drawPeople(g, this.crowd, g.touch ? 26 : 40);
      drawPeople(g, this.servers, 40);
    }
    if (!inCam || this.part === 'off') return;
    const b = this.beat;
    const ph = b - Math.floor(b);
    const pulse = Math.pow(1 - ph, 2);
    const t = this.t;
    const part = this.part;
    const { mid, f0, f1, y0, y1, db } = F;
    const drop = part === 'drop';
    const build = part === 'build';
    const brk = part === 'break';
    // the moving heads' beams down through the haze, sweeping the floor
    let id = 7300;
    const hk = drop ? 1 : brk ? 0.35 : build ? 0.5 + this.prog * 0.5 : 0.7;
    for (const h of this.heads) {
      if (brk && h.i % 3) continue;
      const sw = Math.sin(t * (drop ? 1.6 : 0.8) + h.i * 0.9);
      const sw2 = Math.cos(t * (drop ? 1.3 : 0.6) + h.i * 1.3);
      const tu = h.u + sw * 2.6;
      const td = (f0 + f1) / 2 + sw2 * 3.6;
      const [ex, , ez] = F.P(tu, 0, td);
      const c = brk ? [0.85, 0.9, 1] : BEAM_C[pm(h.i + Math.floor(b / (drop ? 1 : 4)), BEAM_C.length)];
      const al = (0.12 + 0.28 * (drop ? pulse : 0.5)) * hk;
      const [x, y, z] = h.at;
      for (let k = -1; k <= 1; k++) {
        const o = k * 0.22;
        fr.lineXYZ(x, y, z, ex + o, y0 + 0.05, ez + o * 0.6, c, 6 - Math.abs(k) * 2, id++, al * (k ? 0.5 : 1), 0.001, 0);
      }
    }
    // the lasers: fans of thin lines, sweeping
    if (!brk) {
      const n = g.touch ? 4 : drop ? 9 : 6;
      const spread = drop ? 1.1 : 0.7;
      for (const L of this.lasers) {
        if (build && L.dd < 0 && this.prog < 0.5) continue;
        const c = LASER_C[pm(L.s + 2 + Math.floor(b / 8), LASER_C.length)];
        const sweep = Math.sin(t * (drop ? 1.7 : 0.9) + L.s) * 0.5;
        const tilt = L.rise + Math.sin(t * 0.7 + L.s * 2) * 0.1;
        for (let k = 0; k < n; k++) {
          const a = sweep + (k / (n - 1) - 0.5) * spread * 2;
          // (in the room's frame: along d, fanned across u)
          const du = Math.sin(a);
          const dv = Math.cos(a) * L.dd;
          const len = this.clip(L.at, du, tilt, dv);
          const [x0, y0a, z0] = L.at;
          const ex = x0 + dv * len;
          const ey = y0a + tilt * len;
          const ez = z0 - du * len;
          fr.lineXYZ(x0, y0a, z0, ex, ey, ez, c, drop ? 2.4 : 1.8, id++, drop ? 0.85 : 0.6, 0.0005, 0);
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
      for (const [x, y, z] of this.strobes) fr.lineXYZ(x - 0.3, y, z, x + 0.3, y, z, [1, 1, 1], 10, id++, strobe, 0, 0);
      flashLight(F.x((f0 + f1) / 2), y1 - 1.2, F.z(mid), 16, _white, 2.6 * strobe);
    }
    // the mirror ball's spots wheeling round the walls (in the break, and the groove's quiet bars)
    if (brk || (part === 'groove' && Math.floor(b / 16) % 2 === 1)) this.mirrorDots(fr, id);
    // the colours on the floor: two washes chasing each other; the LED's glow on the stage
    const c1 = BEAM_C[pm(Math.floor(b / (drop ? 1 : 2)), BEAM_C.length)];
    const c2 = BEAM_C[pm(Math.floor(b / (drop ? 1 : 2)) + 2, BEAM_C.length)];
    _c1.setRGB(c1[0], c1[1], c1[2]);
    _c2.setRGB(c2[0], c2[1], c2[2]);
    const wk = brk ? 0.5 : 1;
    flashLight(F.x((f0 + f1) / 2 + Math.sin(t * 0.9) * 3), y0 + 3.6, F.z(mid + Math.cos(t * 0.7) * 3), 8, _c1, (1.0 + 0.8 * pulse) * wk);
    flashLight(F.x((f0 + f1) / 2 - Math.sin(t * 0.8) * 3), y0 + 3.6, F.z(mid - Math.cos(t * 0.6) * 3), 8, _c2, (1.0 + 0.8 * pulse) * wk);
    _led.setHSL(this.hue, 0.9, 0.55);
    flashLight(F.x(db + 2.6), y0 + 3, F.z(mid), 9, _led, 1.1 + (drop ? 0.9 * pulse : 0.3));
    if (drop && this.dropT < 1.2) flashLight(F.x((f0 + f1) / 2), y0 + 3, F.z(mid), 18, _white, 3 * (1 - this.dropT / 1.2));
    // (the ring light on the photo wall; its camera's flash now and then)
    if (this.photoWall) {
      const W = this.photoWall;
      flashLight(W.ring[0], W.ring[1], W.ring[2], 4, _white, 0.9);
      if ((t * 0.31) % 1 < 0.03) flashLight(W.cam[0], W.cam[1], W.cam[2], 5, _white, 2.4);
    }
    // (the photographer's flash now and then)
    const ph2 = (t * 0.23) % 1;
    if (ph2 < 0.02) {
      const w = this.crowd.find((q) => q.at === 'photo');
      if (w) flashLight(w.x, w.y + 1.7, w.z, 6, _white, 2.2);
    }
  }

  // how far a laser goes from p along (du across, rise up, dv along) before it meets the room's walls
  clip(p, du, rise, dv) {
    const F = this.F;
    const [x, y, z] = p;
    let tMax = 30;
    const lim = (pos, dir, lo, hi) => {
      if (dir > 1e-4) tMax = Math.min(tMax, (hi - pos) / dir);
      else if (dir < -1e-4) tMax = Math.min(tMax, (lo - pos) / dir);
    };
    lim(x, dv, F.x(F.db), F.x(F.da));
    lim(y, rise, F.y0, F.y1);
    lim(z, -du, F.z(F.ub), F.z(F.ua));
    return Math.max(0.5, tMax);
  }

  // the mirror ball: its spots of light thrown round the room's walls, turning
  mirrorDots(fr, id) {
    const F = this.F;
    const [bx, by, bz] = F.P(F.mid, F.y1 - 1.35, (F.f0 + F.f1) / 2);
    const n = this.game.touch ? 18 : 40;
    const rot = this.t * 0.35;
    for (let i = 0; i < n; i++) {
      // (directions spread round the ball, the same each frame, turned)
      const a = i * 2.39996 + rot;
      const yv = 1 - ((i + 0.5) / n) * 1.6;
      const r = Math.sqrt(Math.max(0, 1 - yv * yv));
      const dx = Math.cos(a) * r;
      const dz = Math.sin(a) * r;
      let tMax = 40;
      const lim = (pos, dir, lo, hi) => {
        if (dir > 1e-4) tMax = Math.min(tMax, (hi - pos) / dir);
        else if (dir < -1e-4) tMax = Math.min(tMax, (lo - pos) / dir);
      };
      lim(bx, dx, F.x(F.db) + 0.05, F.x(F.da) - 0.05);
      lim(by, yv, F.y0 + 0.03, F.y1 - 0.03);
      lim(bz, dz, F.z(F.ub) + 0.05, F.z(F.ua) - 0.05);
      const x = bx + dx * tMax;
      const y = by + yv * tMax;
      const z = bz + dz * tMax;
      // (a short dash along the way it turns)
      const tx = -Math.sin(a) * 0.07;
      const tz = Math.cos(a) * 0.07;
      fr.lineXYZ(x - tx, y, z - tz, x + tx, y, z + tz, [1, 1, 0.95], 4, id + i, 0.85, 0, 0);
    }
  }

  // ------------------------------------------------------------------ what you can do there
  target() {
    if (!this.set || this.part === 'off' || (this.game.minigames && this.game.minigames.isOpen)) return null;
    const F = this.F;
    const p = this.game.player.pos;
    if (!F.inside(p.x, p.z)) return null;
    const u = F.U(p.z);
    const d = F.D(p.x);
    if (Math.abs(u - F.mid) < 2.6 && d < F.f0 + 0.6 && d > F.f0 - 1.3) return { kind: 'dj', label: 'E — לבקש מהדי ג׳יי את הדרופ ($20)' };
    if (Math.abs(u - F.mid) < 4.5 && d > F.f0 && d < F.f1) return { kind: 'dance', label: 'E — לרקוד על הרחבה (Ink Beat)' };
    if (this.vipGap && Math.hypot(u - this.vipGap[0], d - this.vipGap[1]) < 1.4) return { kind: 'vip', label: 'E — שירות בקבוקים VIP עם זיקוקים ($150)' };
    return null;
  }

  interact() {
    const tg = this.target();
    if (!tg) return false;
    const g = this.game;
    if (tg.kind === 'dj') {
      if (this.part === 'build' || (this.part === 'drop' && this.dropT < 8)) {
        g.hud.toast('הדי ג׳יי מצביע על הרחבה: זה כבר קורה!', 'info', 2.5);
        return true;
      }
      if (g.money && !g.money.pay(20, 'DJ')) {
        g.money.refuse(this.F.name, 20);
        return true;
      }
      this.toBuild();
      g.audio.play('coins', 0.5);
      g.hud.toast('הדי ג׳יי מחייך ומרים יד אל הקהל: הדרופ בדרך!', 'good', 3);
      return true;
    }
    if (tg.kind === 'dance') {
      if (!g.minigames) return false;
      const F = this.F;
      const p = g.player;
      p.fig.dance = 1;
      this.dancing = true;
      const w = 5.6;
      const h = (w * 3) / 5;
      const at = F.P(F.mid, F.y0 + 2.05 + h / 2, F.db + 0.15);
      const u = Math.max(F.mid - 3, Math.min(F.mid + 3, F.U(p.pos.z)));
      const stand = F.f0 + 3.6 - (F.db + 0.15);
      const world = worldAt({ at, n: [1, 0], w, h, stand, side: u - F.mid, y0: F.y0, back: 2.8, up: 2.5, camSide: 0, exit: [F.x(F.f0 + 3.6), F.z(u), -Math.PI / 2] });
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
      g.hud.toast('הזמנתם שירות בקבוקים! המארחים יוצאים מהבר עם הזיקוקים', 'good', 3);
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
const _c1 = new THREE.Color();
const _c2 = new THREE.Color();
const _led = new THREE.Color();
