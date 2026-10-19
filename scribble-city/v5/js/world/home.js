import * as THREE from 'three';
import { srgb, hex, addLight } from '../render/materials.js';
import { nextId, Facade } from './kit.js';
import { fbox, fcol, flowerBox } from './deco.js';
import { shifted } from './kits.js';
import { CURB } from './layout.js';

// (v5, ROADMAP 11.17) A house to walk into: a family's, a painter's, a grandmother's, a villa's -
// and the one a drawn friend draws for herself on a plot (world/plot.js, game/friend.js). One
// floor under a gable roof turned to the street, the way a house is drawn: the door under a
// little porch roof, a window either side between its shutters over a box of flowers, a round
// window up in the gable, a chimney; and behind the front, all of it one room (world/rooms.js,
// furnished in world/mainland/furnish.js): the kitchen along the back, the table, the sofa
// before the television, the bed in the corner by the window.

// how each kind of house looks (its colours; how steep its roof)
export const HOME_STYLES = {
  beach: { heb: 'בית חוף תכלת', wall: '#bfe4f0', trim: '#ffffff', roof: '#3d6fb4', door: '#f2c14e', shut: '#2f8fb0', pitch: 0.62 },
  spanish: { heb: 'וילה ספרדית', wall: '#f6e7cd', trim: '#a45c3a', roof: '#c6563b', door: '#5c3a27', shut: '#2f7d5c', pitch: 0.5, tiles: true },
  cottage: { heb: 'בקתה ורודה', wall: '#f7c9d4', trim: '#fff8ef', roof: '#7c4b73', door: '#62b3a5', shut: '#e48aa6', pitch: 0.78 },
  modern: { heb: 'בית מודרני לבן', wall: '#f3f2ee', trim: '#2b2d33', roof: '#3b3e46', door: '#e07a5f', shut: null, pitch: 0.26, wide: true },
};

// who lives in the houses of the mainland: [the name the street knows, the name you hear]
export const RESIDENTS = {
  homeFamily: [['The Garcias', 'משפחת גרסיה'], ['The Lopezes', 'משפחת לופז'], ['The Chens', 'משפחת צ\'ן'], ['The O\'Connors', 'משפחת אוקונור'], ['The Rossis', 'משפחת רוסי'], ['The Nguyens', 'משפחת נגוין'], ['The Cohens', 'משפחת כהן'], ['The Silvas', 'משפחת סילבה']].map(([name, who]) => ({ name, who, ask: `לדבר עם ${who}` })),
  homeArtist: [['Lucia', 'לוסיה', true], ['Theo', 'תיאו', false], ['Isabel', 'איזבל', true], ['Noam', 'נועם', false], ['Paloma', 'פלומה', true]].map(([n, h, fem]) => ({ name: `${n}'s Studio`, who: `הסטודיו של ${h}`, ask: `לדבר עם ${h}`, fem })),
  homeGrandma: [['Rosa', 'רוזה'], ['Amelia', 'אמליה'], ['Carmen', 'כרמן'], ['Hannah', 'חנה'], ['Lola', 'לולה']].map(([n, h]) => ({ name: `Grandma ${n}`, who: `סבתא ${h}`, ask: `לדבר עם סבתא ${h}`, fem: true })),
  homeLux: [['Sterling', 'סטרלינג'], ['Belmont', 'בלמונט'], ['Monroe', 'מונרו'], ['Ashford', 'אשפורד']].map(([n, h]) => ({ name: `${n} Villa`, who: `וילת ${h}`, ask: 'לדבר עם בעלי הווילה' })),
};
// who lives where (by the district), and in which kind of house
const HOME_BY = {
  belcrest: [['homeLux', 5], ['homeFamily', 1]],
  havana: [['homeGrandma', 3], ['homeFamily', 2], ['homeArtist', 1]],
  valley: [['homeFamily', 4], ['homeGrandma', 1.5], ['homeArtist', 1]],
  inkwood: [['homeFamily', 2], ['homeArtist', 2], ['homeGrandma', 1]],
  paintwood: [['homeArtist', 4], ['homeFamily', 1]],
  beach: [['homeFamily', 2], ['homeArtist', 1]],
};
const STYLE_BY = {
  homeLux: ['modern', 'spanish', 'modern'],
  homeGrandma: ['spanish', 'cottage', 'beach'],
  homeFamily: ['beach', 'cottage', 'spanish', 'modern'],
  homeArtist: ['cottage', 'modern', 'beach'],
};

// a household for a house in a district: { kind, style, name, who } (the row's dice)
export function household(r, district) {
  const list = HOME_BY[district] || [['homeFamily', 1]];
  let t = r() * list.reduce((a, [, w]) => a + w, 0);
  let kind = list[0][0];
  for (const [k, w] of list) {
    t -= w;
    if (t <= 0) {
      kind = k;
      break;
    }
  }
  const who = r.pick(RESIDENTS[kind]);
  return { kind, style: r.pick(STYLE_BY[kind]), ...who };
}

const T = 0.25; // the walls (world/rooms.js)
const H = 3.0; // the room's height
const rgbOf = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

// where everything is on the lot (the house and the drawing of it: game/friend.js)
export function homeLayout(spec) {
  const { L, D } = spec;
  const st = HOME_STYLES[spec.style] || HOME_STYLES.beach;
  const front = spec.front;
  const W = Math.max(6.5, Math.min(L - 2.2, st.wide ? 11 : 10));
  const u0 = (L - W) / 2;
  const u1 = u0 + W;
  const depth = Math.max(6.5, Math.min(D - front - 2.5, 9));
  const y0 = CURB;
  const wt = y0 + H + 0.3;
  const ud = u0 + W * 0.42;
  const ww = st.wide && W >= 9 ? 2.2 : 1.3;
  const wa = Math.max(u0 + T + 0.3 + ww / 2, u0 + W * 0.17);
  const wb = Math.min(u1 - T - 0.3 - ww / 2, u0 + W * 0.74);
  const door = { kind: 'door', u0: ud - 0.7, u1: ud + 0.7, y0, y1: y0 + 2.35 };
  const wins = [wa, wb].map((uc) => ({ kind: 'window', u0: uc - ww / 2, u1: uc + ww / 2, y0: y0 + 0.95, y1: y0 + 2.3 }));
  const over = 0.45;
  const pitch = st.pitch;
  const uc = (u0 + u1) / 2;
  const rise = (W / 2) * pitch;
  return { st, front, W, u0, u1, uc, depth, y0, wt, ud, door, wins, over, pitch, rise, ve: wt - over * pitch, vr: wt + rise };
}

// a box laid from a to b (world points), h by d across it, d along the normal n
function beam(ctx, mat, a, b, h, d, n, color) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz) || 1e-3;
  const g = new THREE.BoxGeometry(len, h, d);
  const x = new THREE.Vector3(dx / len, dy / len, dz / len);
  const z = new THREE.Vector3(n[0], 0, n[2]).normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  z.crossVectors(x, y);
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  m.setPosition((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  g.applyMatrix4(m);
  ctx.B.add(mat, g, null, nextId(), { color });
}

// a side of the house as a front of its own (u from the front corner back, facing out)
function sideFace(f, uEdge, dir) {
  const p = f.p(uEdge, 0, 0);
  return new Facade(p[0], p[2], -f.nx, -f.nz, f.ux * dir, f.uz * dir);
}

/**
 * spec: { f (the lot's front, on the sidewalk), L, D, style (HOME_STYLES), kind (the room's:
 *   'homeFamily' | 'homeArtist' | 'homeGrandma' | 'homeLux' | 'homeFriend'), front (how far back
 *   it stands), name, who, ask, fem (who lives there: the shop the street knows - none for the
 *   friend's), rng (dice of its own), heart (hers: a heart over the door) }
 * returns info (f: its own front; doors; room: what the people in it need to know; uDoor)
 */
export function homeHouse(ctx, spec) {
  const M = ctx.M;
  const r = spec.rng || ctx.rng;
  const { f, L } = spec;
  const lay = homeLayout(spec);
  const { st, u0, u1, uc, depth, y0, wt, ud, door, wins, over, pitch, rise, ve, vr } = lay;
  const W = u1 - u0;
  const wall = hex(st.wall);
  const trim = hex(st.trim);
  const roof = hex(st.roof);
  const roofDark = roof.clone().multiplyScalar(0.82);
  const shut = st.shut ? hex(st.shut) : null;
  const hf = shifted(f, -lay.front);
  const info = { f: hf, L, D: depth, h: wt - CURB, top: wt, floors: 1, doors: [], shop: null, kit: 'home', pal: { wall, trim, acc: hex(st.door) } };
  if (ctx.roofs) ctx.roofs.cur = null;
  const wid = nextId();
  const tid = nextId();
  // ---- the walls: the front round its door and windows, the sides, the back
  const ops = [door, ...wins].sort((a, b) => a.u0 - b.u0);
  const piece = (a, b, ya, yb) => {
    if (b - a < 0.01 || yb - ya < 0.01) return;
    fbox(ctx, hf, M.wall, a, ya, -T, b, yb, 0, wall, wid);
  };
  let u = u0;
  for (const o of ops) {
    piece(u, o.u0, y0, wt);
    piece(o.u0, o.u1, y0, o.y0);
    piece(o.u0, o.u1, o.y1, wt);
    u = o.u1;
  }
  piece(u, u1, y0, wt);
  fbox(ctx, hf, M.wall, u0, y0, -depth - T, u0 + T, wt, -T, wall, wid);
  fbox(ctx, hf, M.wall, u1 - T, y0, -depth - T, u1, wt, -T, wall, wid);
  fbox(ctx, hf, M.wall, u0 + T, y0, -depth - T, u1 - T, wt, -depth, wall, wid);
  // (you walk in at the door; the windows' glass is a wall to bump into)
  fcol(ctx, hf, u0, y0, -T, door.u0, wt, 0.05);
  fcol(ctx, hf, door.u1, y0, -T, u1, wt, 0.05);
  fcol(ctx, hf, door.u0, door.y1, -T, door.u1, wt, 0.05);
  // the plinth round it, the boards at its corners, the band under the eaves
  const bh = 0.42;
  fbox(ctx, hf, M.wall, u0 - 0.05, y0, -0.02, door.u0, y0 + bh, 0.05, trim, tid);
  fbox(ctx, hf, M.wall, door.u1, y0, -0.02, u1 + 0.05, y0 + bh, 0.05, trim, tid);
  fbox(ctx, hf, M.wall, u0 - 0.05, y0, -depth - T - 0.05, u0, y0 + bh, -0.02, trim, tid);
  fbox(ctx, hf, M.wall, u1, y0, -depth - T - 0.05, u1 + 0.05, y0 + bh, -0.02, trim, tid);
  fbox(ctx, hf, M.wall, u0, y0, -depth - T - 0.05, u1, y0 + bh, -depth - T, trim, tid);
  for (const [a, b] of [[u0 - 0.07, u0 + 0.16], [u1 - 0.16, u1 + 0.07]]) fbox(ctx, hf, M.wall, a, y0 + bh, -0.07, b, wt, 0.07, trim, tid);
  for (const [a, b] of [[u0 - 0.06, u0], [u1, u1 + 0.06]]) fbox(ctx, hf, M.wall, a, wt - 0.28, -depth - T, b, wt, 0, trim, tid);
  // ---- the windows of the front: frames, a cross in each, the shutters, the flowers under them
  for (const o of wins) {
    const wc = (o.u0 + o.u1) / 2;
    const fid = nextId();
    fbox(ctx, hf, M.frame, o.u0 - 0.1, o.y0 - 0.1, 0, o.u1 + 0.1, o.y0, 0.1, trim, fid);
    fbox(ctx, hf, M.frame, o.u0 - 0.1, o.y1, 0, o.u1 + 0.1, o.y1 + 0.12, 0.1, trim, fid);
    fbox(ctx, hf, M.frame, o.u0 - 0.1, o.y0, 0, o.u0, o.y1, 0.1, trim, fid);
    fbox(ctx, hf, M.frame, o.u1, o.y0, 0, o.u1 + 0.1, o.y1, 0.1, trim, fid);
    fbox(ctx, hf, M.frame, wc - 0.03, o.y0, -0.07, wc + 0.03, o.y1, -0.01, trim, fid);
    fbox(ctx, hf, M.frame, o.u0, (o.y0 + o.y1) / 2 - 0.03, -0.07, o.u1, (o.y0 + o.y1) / 2 + 0.03, -0.01, trim, fid);
    ctx.B.add(M.glint, hf.quad(o.u0 + 0.08, o.y0 + 0.08, o.u1 - 0.08, o.y1 - 0.08, -0.09), null, nextId());
    if (shut) {
      const louvre = shut.clone().multiplyScalar(0.8);
      for (const s of [-1, 1]) {
        const a = s < 0 ? o.u0 - 0.64 : o.u1 + 0.14;
        fbox(ctx, hf, M.frame, a, o.y0 - 0.04, 0, a + 0.5, o.y1 + 0.04, 0.05, shut, fid);
        for (let v = o.y0 + 0.12; v < o.y1 - 0.06; v += 0.17) fbox(ctx, hf, M.frame, a + 0.06, v, 0.05, a + 0.44, v + 0.035, 0.08, louvre, fid);
      }
    }
    flowerBox(ctx, hf, wc, o.y0 - 0.12, o.u1 - o.u0 + 0.14, r);
  }
  // ---- the door's frame, the porch: a little roof on two posts, a step of stone, the mat, a lamp
  {
    const fid = nextId();
    fbox(ctx, hf, M.frame, door.u0 - 0.14, y0, -0.02, door.u0, door.y1 + 0.14, 0.1, trim, fid);
    fbox(ctx, hf, M.frame, door.u1, y0, -0.02, door.u1 + 0.14, door.y1 + 0.14, 0.1, trim, fid);
    fbox(ctx, hf, M.frame, door.u0, door.y1, -0.02, door.u1, door.y1 + 0.14, 0.1, trim, fid);
    const py = door.y1 + 0.42;
    fbox(ctx, hf, M.wall, ud - 1.25, py, 0, ud + 1.25, py + 0.14, 1.55, trim, tid);
    beam(ctx, M.awning, hf.p(ud - 1.4, py + 0.16, 1.68), hf.p(ud, py + 0.62, 1.68), 0.1, 3.4, [hf.nx, 0, hf.nz], roof);
    beam(ctx, M.awning, hf.p(ud, py + 0.62, 1.68), hf.p(ud + 1.4, py + 0.16, 1.68), 0.1, 3.4, [hf.nx, 0, hf.nz], roof);
    for (const s of [-1, 1]) {
      fbox(ctx, hf, M.wall, ud + s * 1.08 - 0.07, y0, 1.3, ud + s * 1.08 + 0.07, py, 1.44, trim, tid);
      fcol(ctx, hf, ud + s * 1.08 - 0.08, y0, 1.29, ud + s * 1.08 + 0.08, py, 1.45, 'pole');
    }
    fbox(ctx, hf, M.prop, ud - 1.3, y0, 0, ud + 1.3, y0 + 0.05, 1.6, srgb(0.86, 0.83, 0.78));
    fbox(ctx, hf, M.prop, ud - 0.5, y0 + 0.05, 0.22, ud + 0.5, y0 + 0.065, 0.82, srgb(0.62, 0.4, 0.3));
    const lp = hf.p(door.u1 + 0.42, y0 + 2.05, 0.25);
    addLight(lp[0], lp[1], lp[2], 6, srgb(1, 0.85, 0.6), 0.55);
    fbox(ctx, hf, M.lampGlass, door.u1 + 0.3, y0 + 1.9, 0.04, door.u1 + 0.54, y0 + 2.22, 0.24);
    // the mailbox at the gate, its little flag up
    const mu = Math.min(u1 + 0.4, L - 0.6);
    const mw = lay.front - 0.7;
    fbox(ctx, hf, M.prop, mu - 0.04, y0, mw - 0.04, mu + 0.04, y0 + 1.0, mw + 0.04, srgb(0.42, 0.3, 0.22));
    fbox(ctx, hf, M.prop, mu - 0.14, y0 + 1.0, mw - 0.24, mu + 0.14, y0 + 1.24, mw + 0.24, shut || roof);
    fbox(ctx, hf, M.prop, mu + 0.14, y0 + 1.08, mw - 0.05, mu + 0.17, y0 + 1.4, mw + 0.05, srgb(0.9, 0.2, 0.22));
  }
  // (hers: a heart over the door)
  if (spec.heart) {
    const sh = new THREE.Shape();
    for (let i = 0; i <= 20; i++) {
      const t = (i / 20) * Math.PI * 2;
      const x = ((16 * Math.pow(Math.sin(t), 3)) / 32) * 0.26;
      const y = ((13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 32) * 0.26;
      if (i === 0) sh.moveTo(x, y);
      else sh.lineTo(x, y);
    }
    const g = new THREE.ShapeGeometry(sh);
    g.rotateY(hf.yaw);
    const c = hf.p(ud, door.y1 + 0.27, 0.11);
    g.translate(c[0], c[1], c[2]);
    ctx.B.add(M.prop, g, null, nextId(), { color: srgb(0.92, 0.28, 0.4) });
  }
  info.doors.push(hf.p(ud, CURB, 1.2));
  info.uDoor = ud;
  // ---- the windows of the sides and the back (seen from the garden)
  const glassWin = (sf, wc, a, b) => {
    const fid = nextId();
    ctx.B.add(M.winGlass, sf.quad(wc - 0.55, a, wc + 0.55, b, 0.012), null, nextId());
    fbox(ctx, sf, M.frame, wc - 0.65, a - 0.1, 0, wc + 0.65, a, 0.08, trim, fid);
    fbox(ctx, sf, M.frame, wc - 0.65, b, 0, wc + 0.65, b + 0.1, 0.08, trim, fid);
    fbox(ctx, sf, M.frame, wc - 0.65, a, 0, wc - 0.55, b, 0.08, trim, fid);
    fbox(ctx, sf, M.frame, wc + 0.55, a, 0, wc + 0.65, b, 0.08, trim, fid);
    fbox(ctx, sf, M.frame, wc - 0.03, a, 0, wc + 0.03, b, 0.04, trim, fid);
  };
  for (const [uEdge, dir] of [[u0, -1], [u1, 1]]) {
    const sf = sideFace(hf, uEdge, dir);
    const n = Math.max(1, Math.floor((depth - 0.5) / 3.2));
    for (let k = 0; k < n; k++) glassWin(sf, ((depth + T) * (k + 0.5)) / n, y0 + 1.0, y0 + 2.2);
  }
  {
    const p0 = hf.p(u1, 0, -depth - T);
    const bf = new Facade(p0[0], p0[2], -hf.ux, -hf.uz, -hf.nx, -hf.nz);
    const bd = W * 0.3;
    fbox(ctx, bf, M.frame, bd - 0.5, y0, 0, bd + 0.5, y0 + 2.15, 0.06, hex(st.door).multiplyScalar(0.9));
    fbox(ctx, bf, M.frame, bd - 0.62, y0, 0, bd + 0.62, y0 + 2.27, 0.03, trim);
    fbox(ctx, bf, M.prop, bd - 0.8, y0, 0, bd + 0.8, y0 + 0.06, 0.9, srgb(0.86, 0.83, 0.78));
    glassWin(bf, W * 0.72, y0 + 1.0, y0 + 2.2);
  }
  // ---- the roof: two slopes from the ridge, its gables to the front and the back
  {
    const pos = [];
    const nor = [];
    const tri = (a, b, c, down = false) => {
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      let q = [a, b, c];
      if ((n[1] < 0) !== down) {
        q = [a, c, b];
        n = [-n[0], -n[1], -n[2]];
      }
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      for (const p of q) {
        pos.push(p[0], p[1], p[2]);
        nor.push(n[0] / l, n[1] / l, n[2] / l);
      }
    };
    const wf = over;
    const wb = -depth - T - over;
    const P = (uu, y, w) => hf.p(uu, y, w);
    for (const [dy, down] of [[0, false], [-0.14, true]]) {
      const a0 = P(u0 - over, ve + dy, wf);
      const a1 = P(u0 - over, ve + dy, wb);
      const r0 = P(uc, vr + dy, wf);
      const r1 = P(uc, vr + dy, wb);
      const b0 = P(u1 + over, ve + dy, wf);
      const b1 = P(u1 + over, ve + dy, wb);
      tri(a0, r0, r1, down);
      tri(a0, r1, a1, down);
      tri(r0, b0, b1, down);
      tri(r0, b1, r1, down);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    ctx.B.add(M.wallSolid, g, null, nextId(), { color: roof });
    // the gables: a triangle of wall over the front and the back
    const gp = [];
    const gn = [];
    const face = (a, b, c, n) => {
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const q = cr[0] * n[0] + cr[2] * n[2] >= 0 ? [a, b, c] : [a, c, b];
      for (const p of q) {
        gp.push(p[0], p[1], p[2]);
        gn.push(n[0], 0, n[2]);
      }
    };
    face(P(u0, wt - 0.01, 0), P(u1, wt - 0.01, 0), P(uc, vr - 0.08, 0), [hf.nx, 0, hf.nz]);
    face(P(u0, wt - 0.01, -depth - T), P(u1, wt - 0.01, -depth - T), P(uc, vr - 0.08, -depth - T), [-hf.nx, 0, -hf.nz]);
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    gg.setAttribute('normal', new THREE.Float32BufferAttribute(gn, 3));
    ctx.B.add(M.wall, gg, null, nextId(), { color: wall });
    // the edges: boards along the gables and the eaves, a cap on the ridge
    const n0 = [hf.nx, 0, hf.nz];
    for (const w of [wf, wb]) {
      beam(ctx, M.frame, P(u0 - over, ve - 0.07, w), P(uc, vr - 0.07, w), 0.2, 0.08, n0, trim);
      beam(ctx, M.frame, P(uc, vr - 0.07, w), P(u1 + over, ve - 0.07, w), 0.2, 0.08, n0, trim);
    }
    fbox(ctx, hf, M.frame, u0 - over - 0.05, ve - 0.18, wb, u0 - over + 0.03, ve + 0.02, wf, trim, tid);
    fbox(ctx, hf, M.frame, u1 + over - 0.03, ve - 0.18, wb, u1 + over + 0.05, ve + 0.02, wf, trim, tid);
    fbox(ctx, hf, M.awning, uc - 0.13, vr - 0.05, wb, uc + 0.13, vr + 0.09, wf, roofDark, tid);
    // the courses of its shingles (of its tiles, a villa's), the strokes the pen finds
    const step = st.tiles ? 0.28 : 0.36;
    const run = W / 2 + over;
    for (let t = step; t < run - 0.15; t += step) {
      const y = ve + t * pitch;
      for (const uu of [u0 - over + t, u1 + over - t]) fbox(ctx, hf, M.awning, uu - 0.035, y - 0.03, wb + 0.04, uu + 0.035, y + (st.tiles ? 0.07 : 0.045), wf - 0.04, roofDark, tid);
    }
    // the chimney (not on the new white house: its roof is a lid of steel)
    if (!st.wide) {
      const cu = u0 + W * 0.24;
      const cw = -depth * 0.62;
      const ys = ve + (cu - (u0 - over)) * pitch;
      const brick = st.tiles ? srgb(0.82, 0.62, 0.5) : srgb(0.72, 0.38, 0.32);
      fbox(ctx, hf, M.wall, cu - 0.32, ys - 0.7, cw - 0.32, cu + 0.32, ys + 1.0, cw + 0.32, brick, nextId());
      fbox(ctx, hf, M.wall, cu - 0.4, ys + 1.0, cw - 0.4, cu + 0.4, ys + 1.12, cw + 0.4, trim, tid);
    }
    // a round window up in the gable
    if (rise > 1.0) {
      const rw = Math.min(0.42, rise * 0.24);
      const c = hf.p(uc, wt + rise * 0.36, 0.015);
      const ring = new THREE.CircleGeometry(rw + 0.1, 18);
      ring.rotateY(hf.yaw);
      ring.translate(c[0], c[1], c[2]);
      ctx.B.add(M.frame, ring, null, nextId(), { color: trim });
      const gl = new THREE.CircleGeometry(rw, 18);
      gl.rotateY(hf.yaw);
      gl.translate(c[0] + hf.nx * 0.012, c[1], c[2] + hf.nz * 0.012);
      ctx.B.add(M.winGlass, gl, null, nextId());
      fbox(ctx, hf, M.frame, uc - rw, wt + rise * 0.36 - 0.025, 0.02, uc + rw, wt + rise * 0.36 + 0.025, 0.05, trim, tid);
      fbox(ctx, hf, M.frame, uc - 0.025, wt + rise * 0.36 - rw, 0.02, uc + 0.025, wt + rise * 0.36 + rw, 0.05, trim, tid);
    }
  }
  // (from afar: its body - world/mainland/far.json)
  if (ctx.footprints) {
    const [mn, mx] = hf.box(u0, 0, -depth - T, u1, 0, 0);
    ctx.footprints.push({ x0: mn[0], z0: mn[2], x1: mx[0], z1: mx[2], top: wt + rise * 0.55, color: wall, trim, awning: roof, nx: hf.nx, nz: hf.nz, kind: 'home' });
  }
  // ---- behind the front: the room (the people in it: game/streetlife.js, game/friend.js)
  const room = ctx.room
    ? ctx.room(hf, {
        u0, u1, depth, y0, h: H, kind: spec.kind,
        openings: [{ ...door, color: rgbOf(st.door) }, ...wins],
        outside: wall,
        shop: spec.name ? { kind: spec.kind, name: spec.name } : null,
      })
    : null;
  if (!room) {
    fcol(ctx, hf, u0, y0, -depth - T, u0 + T, wt, -T);
    fcol(ctx, hf, u1 - T, y0, -depth - T, u1, wt, -T);
    fcol(ctx, hf, u0, y0, -depth - T, u1, wt, -depth);
  }
  info.room = room;
  // (who lives there: the street knows the house as it knows a shop, its keeper the one at home)
  if (spec.name && room && ctx.shops) {
    const s = {
      kind: spec.kind,
      name: spec.name,
      who: spec.who,
      ask: spec.ask || null,
      fem: spec.fem,
      id: ctx.shops.length,
      f: hf,
      nx: hf.nx,
      nz: hf.nz,
      rx: hf.ux,
      rz: hf.uz,
      face: Math.atan2(hf.nx, hf.nz),
      door: hf.p(ud, CURB, 1.1),
      inside: hf.p(ud, CURB, -1.4),
      keeper: room.keeper ? [room.keeper.x, CURB, room.keeper.z] : hf.p(ud, CURB, -1.4),
      win: hf.p(ud, CURB, 0.9),
      signCol: st.door,
      building: info,
      room,
      spots: {},
      home: true,
    };
    ctx.shops.push(s);
    info.shops = [s];
    info.shop = s;
  }
  return info;
}

// (game/friend.js) the drawing of the house before it is real: its front as the pen draws it, in
// metres about the middle of the front (u along it, v up from the middle of its height)
const INK = [0.09, 0.09, 0.12];
export function houseSketch(spec) {
  const lay = homeLayout(spec);
  const { st, u0, u1, uc, y0, wt, ud, door, wins, over, ve, vr } = lay;
  const ym = (y0 + vr) / 2;
  const U = (u) => u - uc;
  const V = (y) => y - ym;
  const col = (h) => rgbOf(h).map((c) => c * 0.85);
  const line = (pts, c = INK, w = 1) => ({ pts: pts.map(([u, y]) => [U(u), V(y)]), col: c, w });
  const rect = (a, b, ya, yb, c, w) => line([[a, ya], [b, ya], [b, yb], [a, yb], [a, ya]], c, w);
  const out = [];
  out.push(rect(u0, u1, y0, wt, INK, 1.3));
  out.push(line([[u0 - over, ve], [uc, vr], [u1 + over, ve]], col(st.roof), 1.8));
  out.push(line([[u0 - over, ve], [u1 + over, ve]], col(st.roof), 1.1));
  // the shingles: a stroke or two across each slope
  for (const k of [0.33, 0.66]) {
    const y = ve + (vr - ve) * k;
    const du = (uc - (u0 - over)) * (1 - k);
    out.push(line([[uc - du, y], [uc + du, y]], col(st.roof), 0.8));
  }
  out.push(rect(door.u0, door.u1, y0, door.y1, col(st.door), 1.3));
  out.push(line([[door.u1 - 0.3, y0 + 1.15], [door.u1 - 0.22, y0 + 1.15]], INK, 1.4));
  for (const o of wins) {
    out.push(rect(o.u0, o.u1, o.y0, o.y1, [0.36, 0.56, 0.86], 1.2));
    out.push(line([[(o.u0 + o.u1) / 2, o.y0], [(o.u0 + o.u1) / 2, o.y1]], [0.36, 0.56, 0.86], 0.8));
    out.push(line([[o.u0, (o.y0 + o.y1) / 2], [o.u1, (o.y0 + o.y1) / 2]], [0.36, 0.56, 0.86], 0.8));
    if (st.shut) {
      for (const a of [o.u0 - 0.6, o.u1 + 0.1]) out.push(rect(a, a + 0.5, o.y0, o.y1, col(st.shut), 0.9));
    }
    // flowers in the box under it
    for (let uu = o.u0 + 0.15; uu < o.u1; uu += 0.32) {
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        pts.push([uu + Math.cos(a) * 0.1, o.y0 - 0.05 + Math.sin(a) * 0.1]);
      }
      out.push(line(pts, [[0.92, 0.32, 0.45], [0.98, 0.8, 0.3], [0.95, 0.55, 0.75]][Math.floor(uu * 3) % 3], 1.0));
    }
  }
  // the porch roof over the door
  out.push(line([[ud - 1.4, door.y1 + 0.55], [ud, door.y1 + 1.0], [ud + 1.4, door.y1 + 0.55]], col(st.roof), 1.2));
  // the round window
  const rise = vr - wt;
  if (rise > 1.0) {
    const rw = Math.min(0.42, rise * 0.24);
    const cy = wt + rise * 0.36;
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      pts.push([uc + Math.cos(a) * rw, cy + Math.sin(a) * rw]);
    }
    out.push(line(pts, [0.36, 0.56, 0.86], 1.1));
  }
  // the chimney, and its smoke
  if (!st.wide) {
    const cu = u0 + (u1 - u0) * 0.24;
    const ys = ve + (cu - (u0 - over)) * lay.pitch;
    out.push(line([[cu - 0.32, ys], [cu - 0.32, ys + 1.0], [cu + 0.32, ys + 1.0], [cu + 0.32, ys + 0.25]], INK, 1.1));
    out.push(line([[cu, ys + 1.2], [cu - 0.25, ys + 1.55], [cu + 0.1, ys + 1.9], [cu - 0.15, ys + 2.3]], [0.6, 0.6, 0.66], 0.9));
  }
  // a heart over the door: hers
  {
    const pts = [];
    const cy = door.y1 + 0.27;
    for (let i = 0; i <= 16; i++) {
      const t = (i / 16) * Math.PI * 2;
      pts.push([ud + ((16 * Math.pow(Math.sin(t), 3)) / 32) * 0.3, cy + ((13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 32) * 0.3]);
    }
    out.push(line(pts, [0.9, 0.25, 0.38], 1.2));
  }
  return { lines: out, at: [uc, ym], lay };
}
