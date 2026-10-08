// Street-fight smarts shared by gangs and police: cover points around the city's
// obstacles, A* paths on the nav grid and the personalities that drive behaviour.

import { BOUNDS, groundHeight } from '../world/layout.js';

// How each kind of fighter tends to act.
//  aggro:    how readily they push forward instead of holding cover
//  courage:  how much fire they take before falling back or running
//  aim:      spread multiplier (lower is more accurate)
//  patience: how long they stay hidden between peeks
//  react:    seconds before the first shot after spotting you
export const PERSONAS = {
  standard: { aggro: 0.5, courage: 0.6, aim: 1, patience: 0.5, react: 0.55 },
  hothead: { aggro: 0.9, courage: 0.85, aim: 1.3, patience: 0.15, react: 0.4, taunts: true },
  veteran: { aggro: 0.55, courage: 0.9, aim: 0.7, patience: 0.7, react: 0.32, flanker: true },
  coward: { aggro: 0.15, courage: 0.25, aim: 1.4, patience: 0.9, react: 0.75, blindfire: true },
  lookout: { aggro: 0.35, courage: 0.5, aim: 1.1, patience: 0.6, react: 0.5, caller: true },
};

const COVER_TAGS = new Set(['car', 'cover', 'prop']);
const GRID = 8;
const GX0 = BOUNDS.minX - 8;
const GZ0 = BOUNDS.minZ - 8;
const GW = Math.ceil((BOUNDS.maxX - BOUNDS.minX + 16) / GRID);
const GH = Math.ceil((BOUNDS.maxZ - BOUNDS.minZ + 16) / GRID);

/**
 * Points next to obstacles a fighter can hide behind. Low obstacles (parked cars,
 * dumpsters, sandbags) are crouch cover you pop up from; building corners and
 * containers are tall cover you lean out from (peek point beside the corner).
 */
export class CoverMap {
  constructor(collision) {
    this.collision = collision;
    this.points = [];
    this.cells = new Array(GW * GH);
    for (let i = 0; i < this.cells.length; i++) this.cells[i] = [];
    for (const b of collision.boxes) this.addBox(b);
  }

  addBox(b) {
    const w = b.x1 - b.x0;
    const d = b.z1 - b.z0;
    const h = b.y1 - Math.max(0, b.y0);
    if (b.x0 < BOUNDS.minX || b.x1 > BOUNDS.maxX || b.z0 < BOUNDS.minZ || b.z1 > BOUNDS.maxZ) return;
    const off = 0.68;
    if (COVER_TAGS.has(b.tag) && h >= 0.95 && h < 2.2 && Math.max(w, d) >= 0.9 && Math.min(w, d) >= 0.5) {
      // low cover: points along every side
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const len = nx ? d : w;
        const n = Math.max(1, Math.floor(len / 1.6));
        for (let i = 0; i < n; i++) {
          const u = (i + 0.5) / n;
          const x = nx ? (nx > 0 ? b.x1 + off : b.x0 - off) : b.x0 + w * u;
          const z = nz ? (nz > 0 ? b.z1 + off : b.z0 - off) : b.z0 + d * u;
          this.add({ x, z, nx, nz, low: true, h: b.y1, box: b, px: x, pz: z });
        }
      }
      return;
    }
    const tall = (b.tag === 'wall' || b.tag === 'cover') && h >= 2.2 && w >= 1.5 && d >= 1.5;
    if (!tall) return;
    // tall cover: two points at each corner, one on each face, leaning out past the edge
    for (const [cx, cz, sx, sz] of [[b.x0, b.z0, -1, -1], [b.x1, b.z0, 1, -1], [b.x0, b.z1, -1, 1], [b.x1, b.z1, 1, 1]]) {
      // on the face whose normal is along x (side sx): slide along z toward the corner
      this.add({ x: cx + sx * off, z: cz - sz * 0.5, nx: sx, nz: 0, low: false, h: b.y1, box: b, px: cx + sx * off, pz: cz + sz * 0.75 });
      // on the face whose normal is along z
      this.add({ x: cx - sx * 0.5, z: cz + sz * off, nx: 0, nz: sz, low: false, h: b.y1, box: b, px: cx + sx * 0.75, pz: cz + sz * off });
    }
  }

  add(p) {
    const col = this.collision;
    if (p.x < BOUNDS.minX + 1 || p.x > BOUNDS.maxX - 1 || p.z < BOUNDS.minZ + 1 || p.z > BOUNDS.maxZ - 1) return;
    if (col.pointInside(p.x, 1, p.z, 0.32)) return;
    if (!p.low && col.pointInside(p.px, 1, p.pz, 0.3)) return;
    p.y = groundHeight(p.x, p.z);
    p.id = this.points.length;
    p.owner = null;
    this.points.push(p);
    const ci = Math.floor((p.x - GX0) / GRID);
    const cj = Math.floor((p.z - GZ0) / GRID);
    if (ci >= 0 && cj >= 0 && ci < GW && cj < GH) this.cells[cj * GW + ci].push(p);
  }

  // every live cover point within r of (x, z)
  near(x, z, r, out = []) {
    out.length = 0;
    const i0 = Math.max(0, Math.floor((x - r - GX0) / GRID));
    const i1 = Math.min(GW - 1, Math.floor((x + r - GX0) / GRID));
    const j0 = Math.max(0, Math.floor((z - r - GZ0) / GRID));
    const j1 = Math.min(GH - 1, Math.floor((z + r - GZ0) / GRID));
    const r2 = r * r;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        for (const p of this.cells[j * GW + i]) {
          if (!p.box.alive) continue;
          const dx = p.x - x;
          const dz = p.z - z;
          if (dx * dx + dz * dz <= r2) out.push(p);
        }
      }
    }
    return out;
  }

  // Is this point shielded from someone standing at (tx, ty, tz)? The obstacle must be on
  // the far side of the point: the point's outward normal faces away from the threat.
  shields(p, tx, ty, tz) {
    const dx = p.x - tx;
    const dz = p.z - tz;
    const d = Math.hypot(dx, dz) || 1;
    if ((dx * p.nx + dz * p.nz) / d < 0.25) return false;
    const hy = p.y + (p.low ? 0.95 : 1.45);
    const hit = this.collision.raycast(tx, ty, tz, p.x - tx, hy - ty, p.z - tz, Math.hypot(p.x - tx, hy - ty, p.z - tz) - 0.35);
    return !!hit;
  }

  // From the point's peek spot, is there a clear shot at (tx, ty, tz)?
  canShoot(p, tx, ty, tz) {
    const hy = p.y + 1.45;
    return this.collision.lineOfSight(p.px, hy, p.pz, tx, ty, tz);
  }
}

/** A* over the nav grid, with line-of-walk smoothing. */
export class PathFinder {
  constructor(nav) {
    this.nav = nav;
    const n = nav.w * nav.h;
    this.g = new Float32Array(n);
    this.came = new Int32Array(n);
    this.seen = new Uint32Array(n);
    this.done = new Uint32Array(n);
    this.heapId = new Int32Array(n);
    this.heapF = new Float32Array(n);
    this.stamp = 0;
    this.budget = 0; // expansions left this frame
  }

  resetBudget() {
    this.budget = 6000;
  }

  push(id, f) {
    let i = this.size++;
    const hid = this.heapId;
    const hf = this.heapF;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hf[p] <= f) break;
      hid[i] = hid[p];
      hf[i] = hf[p];
      i = p;
    }
    hid[i] = id;
    hf[i] = f;
  }

  pop() {
    const hid = this.heapId;
    const hf = this.heapF;
    const top = hid[0];
    const n = --this.size;
    if (n > 0) {
      const lid = hid[n];
      const lf = hf[n];
      let i = 0;
      for (;;) {
        let c = i * 2 + 1;
        if (c >= n) break;
        if (c + 1 < n && hf[c + 1] < hf[c]) c++;
        if (hf[c] >= lf) break;
        hid[i] = hid[c];
        hf[i] = hf[c];
        i = c;
      }
      hid[i] = lid;
      hf[i] = lf;
    }
    return top;
  }

  // Returns a list of [x, z] waypoints ending at the goal, null when there is no way,
  // or false when this frame's search budget is spent (ask again next frame).
  find(sx, sz, gx, gz, maxExpand = 2500) {
    const nav = this.nav;
    const start = nav.nearestWalkable(sx, sz, 2);
    const goal = nav.nearestWalkable(gx, gz, 3);
    if (start < 0 || goal < 0) return null;
    if (start === goal) return [[gx, gz]];
    if (this.budget <= 0) return false;
    const st = ++this.stamp;
    const w = nav.w;
    const bl = nav.blocked;
    const gi = goal % w;
    const gj = (goal - gi) / w;
    const g = this.g;
    this.size = 0;
    g[start] = 0;
    this.seen[start] = st;
    this.came[start] = -1;
    this.push(start, 0);
    let found = false;
    let n = 0;
    while (this.size > 0) {
      const id = this.pop();
      if (this.done[id] === st) continue;
      this.done[id] = st;
      if (id === goal) {
        found = true;
        break;
      }
      if (++n > maxExpand) break;
      const i = id % w;
      const j = (id - i) / w;
      const gc = g[id];
      for (let k = 0; k < 8; k++) {
        const di = k < 3 ? k - 1 : k < 5 ? (k === 3 ? -1 : 1) : k - 6;
        const dj = k < 3 ? -1 : k < 5 ? 0 : 1;
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= w || nj >= nav.h) continue;
        const nid = nj * w + ni;
        if (bl[nid] || this.done[nid] === st) continue;
        if (di && dj && (bl[j * w + ni] || bl[nj * w + i])) continue;
        const ng = gc + (di && dj ? 1.414 : 1);
        if (this.seen[nid] !== st || ng < g[nid]) {
          this.seen[nid] = st;
          g[nid] = ng;
          this.came[nid] = id;
          const hx = Math.abs(ni - gi);
          const hz = Math.abs(nj - gj);
          this.push(nid, ng + Math.max(hx, hz) + 0.414 * Math.min(hx, hz));
        }
      }
    }
    this.budget -= n;
    if (!found) return null;
    const cells = [];
    for (let id = goal; id >= 0; id = this.came[id]) cells.push(id);
    cells.reverse();
    // string pulling: keep a waypoint only where the straight walk from the last one breaks
    const out = [];
    let anchor = 0;
    let [ax, az] = nav.center(cells[0]);
    let lastOk = 0;
    for (let m = 1; m < cells.length; ) {
      const [cx, cz] = nav.center(cells[m]);
      if (this.clearWalk(ax, az, cx, cz)) {
        lastOk = m++;
        continue;
      }
      const keep = lastOk > anchor ? lastOk : m;
      [ax, az] = nav.center(cells[keep]);
      out.push([ax, az]);
      anchor = lastOk = keep;
      if (keep === m) m++;
    }
    out.push([gx, gz]);
    return out;
  }

  // no blocked nav cell along the segment (sampled every half cell)
  clearWalk(ax, az, bx, bz) {
    const nav = this.nav;
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.ceil(d / (nav.cell * 0.5));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (!nav.walkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }
}

// What they shout (in-world text stays English).
export const LINES = {
  gang: {
    spot: ['There he is!', 'Over there!', 'Hey! You!', 'Got eyes on him!', 'Yo, that\'s him!'],
    huh: ['Huh?', 'Who\'s there?', 'You hear that?', 'Somebody there?'],
    cover: ['Get down!', 'Find cover!', 'Taking cover!', 'Behind the car!'],
    flank: ['I\'ll go around!', 'Flanking!', 'Cut him off!'],
    reload: ['Reloading!', 'Cover me!', 'Gimme a sec!'],
    hit: ['Agh!', 'I\'m hit!', 'Ow, man!'],
    arm: ['My arm!!', 'Where\'s my arm?!'],
    leg: ['My leg!', 'I can\'t walk!'],
    down: ['Man down!', 'They got Vinnie!', 'No, Sal!', 'Oh no...'],
    lost: ['Where\'d he go?', 'Lost him!', 'He\'s hiding...'],
    check: ['Check the bins.', 'Look around!', 'Spread out!'],
    giveup: ['Forget it.', 'He\'s gone.', 'Must\'ve been rats.'],
    backup: ['Yo! Backup!', 'Need help here!', 'Call the boys!'],
    flee: ['I\'m outta here!', 'Not worth it!', 'Nope!'],
    taunt: ['Come on!', 'That all you got?', 'Get over here!'],
    car: ['Whoa!', 'Watch it!'],
    suppress: ['Keep him down!', 'Light him up!'],
  },
  police: {
    spot: ['Freeze!', 'SCPD! Don\'t move!', 'Suspect sighted!', 'Hands up!'],
    huh: ['What was that?', 'Hello?', 'Shots fired?'],
    cover: ['Take cover!', 'Get down!', 'Covering!'],
    flank: ['Moving to flank!', 'Going wide!', 'Cut him off!'],
    reload: ['Reloading!', 'Cover me!'],
    hit: ['I\'m hit!', 'Ugh!', 'Officer hit!'],
    arm: ['My arm!!'],
    leg: ['My leg!'],
    down: ['Officer down!', 'Man down!'],
    lost: ['Lost visual!', 'Where\'d he go?'],
    check: ['Search the area!', 'Check behind there!'],
    giveup: ['Suspect lost.', 'All clear.'],
    backup: ['Requesting backup!', 'Need units here!', '10-13!'],
    flee: ['Fall back!'],
    taunt: ['Drop it!', 'Give it up!', 'You\'re surrounded!'],
    car: ['Look out!', 'Whoa!'],
    suppress: ['Suppressing!', 'Keep his head down!'],
  },
};

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function pickPersona(weights) {
  let sum = 0;
  for (const k in weights) sum += weights[k];
  let r = Math.random() * sum;
  for (const k in weights) {
    r -= weights[k];
    if (r <= 0) return k;
  }
  return 'standard';
}
