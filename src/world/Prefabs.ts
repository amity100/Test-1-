import type { BlockRole } from './Styles';

export type PrefabId =
  | 'wall'
  | 'tower'
  | 'roundTower'
  | 'arch'
  | 'stairs'
  | 'spiral'
  | 'door'
  | 'window'
  | 'roof'
  | 'dome'
  | 'column'
  | 'floor'
  | 'battlement'
  | 'bridge'
  | 'gate'
  | 'pyramid'
  | 'house'
  | 'keep'
  | 'gazebo'
  | 'balcony'
  | 'buttress'
  | 'spire'
  | 'ramp'
  | 'tunnel'
  | 'curvedWall'
  | 'hedge'
  | 'fountain'
  | 'hall'
  | 'maze'
  | 'watchtower';

export const PREFAB_IDS: PrefabId[] = [
  'wall', 'door', 'window', 'curvedWall', 'hedge', 'battlement', 'buttress',
  'tower', 'roundTower', 'watchtower', 'spire', 'gate', 'arch', 'column',
  'stairs', 'spiral', 'ramp', 'bridge', 'balcony', 'floor', 'roof', 'dome',
  'house', 'keep', 'hall', 'gazebo', 'tunnel', 'maze', 'fountain', 'pyramid',
];

export interface PrefabBlock {
  x: number;
  y: number;
  z: number;
  role: BlockRole | 'air';
}

export interface PrefabDef {
  id: PrefabId;
  nameKey: string;
  /** Number of size steps available. */
  sizes: number;
  build(size: number): PrefabBlock[];
}

type Builder = (put: (x: number, y: number, z: number, role: BlockRole | 'air') => void, size: number) => void;

function make(id: PrefabId, nameKey: string, sizes: number, fn: Builder): PrefabDef {
  return {
    id,
    nameKey,
    sizes,
    build(size: number): PrefabBlock[] {
      const out: PrefabBlock[] = [];
      const seen = new Map<string, number>();
      fn((x, y, z, role) => {
        const key = `${x},${y},${z}`;
        const idx = seen.get(key);
        if (idx !== undefined) out[idx] = { x, y, z, role };
        else {
          seen.set(key, out.length);
          out.push({ x, y, z, role });
        }
      }, Math.max(0, Math.min(sizes - 1, size)));
      return out;
    },
  };
}

const pick = <T>(arr: T[], i: number): T => arr[Math.min(arr.length - 1, i)];

export const PREFABS = {
  wall: make('wall', 'pWall', 3, (put, s) => {
    const L = pick([6, 10, 16], s);
    const H = pick([4, 6, 8], s);
    const half = Math.floor(L / 2);
    for (let x = -half; x < L - half; x++) {
      for (let y = 0; y < H; y++) put(x, y, 0, y === H - 1 ? 'trim' : 'wall');
      if ((x + half) % 2 === 0) put(x, H, 0, 'trim');
    }
  }),
  door: make('door', 'pDoor', 2, (put, s) => {
    const W = pick([5, 7], s);
    const H = pick([5, 7], s);
    const half = Math.floor(W / 2);
    const dw = s === 0 ? 1 : 1;
    const dh = pick([3, 4], s);
    for (let x = -half; x <= half; x++) {
      for (let y = 0; y < H; y++) {
        const inDoor = Math.abs(x) <= dw && y < dh;
        put(x, y, 0, inDoor ? 'air' : x === 0 && y === dh ? 'trim' : Math.abs(x) === dw + 1 && y < dh ? 'pillar' : 'wall');
      }
    }
    for (let x = -dw - 1; x <= dw + 1; x++) put(x, dh, 0, 'trim');
  }),
  window: make('window', 'pWindow', 2, (put, s) => {
    const W = pick([5, 9], s);
    const H = pick([4, 6], s);
    const half = Math.floor(W / 2);
    for (let x = -half; x <= half; x++) {
      for (let y = 0; y < H; y++) {
        const win = y >= 1 && y < H - 1 && (x + half) % 2 === 1;
        put(x, y, 0, win ? 'glass' : y === H - 1 ? 'trim' : 'wall');
      }
    }
  }),
  tower: make('tower', 'pTower', 3, (put, s) => {
    const W = pick([3, 5, 7], s);
    const H = pick([8, 12, 16], s);
    const half = Math.floor(W / 2);
    for (let x = -half; x <= half; x++) {
      for (let z = -half; z <= half; z++) {
        const edge = Math.abs(x) === half || Math.abs(z) === half;
        for (let y = 0; y < H; y++) {
          if (edge) put(x, y, z, y % 4 === 3 ? 'wallAlt' : 'wall');
          else if (y === H - 1) put(x, y, z, 'floor');
        }
        if (edge) {
          const corner = Math.abs(x) === half && Math.abs(z) === half;
          if (corner || (x + z + half * 2) % 2 === 0) put(x, H, z, 'trim');
        }
      }
    }
    // Doorway on -Z face and interior stairs (spiral along walls).
    put(0, 0, -half, 'air');
    put(0, 1, -half, 'air');
    put(0, 2, -half, 'trim');
    if (W >= 5) {
      const inner = half - 1;
      const ring: [number, number][] = [];
      for (let x = -inner; x <= inner; x++) ring.push([x, -inner]);
      for (let z = -inner + 1; z <= inner; z++) ring.push([inner, z]);
      for (let x = inner - 1; x >= -inner; x--) ring.push([x, inner]);
      for (let z = inner - 1; z > -inner; z--) ring.push([-inner, z]);
      let y = 0;
      let idx = ring.findIndex(([x, z]) => x === 1 && z === -inner);
      if (idx < 0) idx = 0;
      for (let step = 0; step < H - 2; step++) {
        const [x, z] = ring[(idx + step) % ring.length];
        put(x, y, z, 'stairs');
        y++;
        if (y >= H - 1) break;
      }
      // Hole in the top floor above the last stair
      const [lx, lz] = ring[(idx + Math.min(H - 3, ring.length * 4)) % ring.length];
      put(lx, H - 1, lz, 'air');
    }
    // Windows
    for (let y = 3; y < H - 2; y += 4) {
      put(0, y, half, 'glass');
      put(half, y, 0, 'glass');
      put(-half, y, 0, 'glass');
    }
    put(0, H, 0, 'light');
  }),
  roundTower: make('roundTower', 'pRoundTower', 3, (put, s) => {
    const R = pick([2.5, 3.5, 4.5], s);
    const H = pick([9, 13, 17], s);
    const r = Math.ceil(R);
    for (let x = -r; x <= r; x++) {
      for (let z = -r; z <= r; z++) {
        const d = Math.sqrt(x * x + z * z);
        const shell = d <= R && d > R - 1.1;
        const inside = d <= R - 1.1;
        for (let y = 0; y < H; y++) {
          if (shell) put(x, y, z, y % 5 === 4 ? 'wallAlt' : 'wall');
          else if (inside && y === H - 1) put(x, y, z, 'floor');
        }
        if (shell && (x + z) % 2 === 0) put(x, H, z, 'trim');
      }
    }
    put(0, 0, -r, 'air');
    put(0, 1, -r, 'air');
    put(0, 0, -r + 1, 'air');
    put(0, 1, -r + 1, 'air');
    // Interior spiral
    let ang = -Math.PI / 2;
    for (let y = 0; y < H - 1; y++) {
      const rr = R - 1.6;
      const x = Math.round(Math.cos(ang) * rr);
      const z = Math.round(Math.sin(ang) * rr);
      put(x, y, z, 'stairs');
      ang += 0.75;
    }
    const tx = Math.round(Math.cos(ang) * (R - 1.6));
    const tz = Math.round(Math.sin(ang) * (R - 1.6));
    put(tx, H - 1, tz, 'air');
    put(0, H, 0, 'light');
  }),
  gate: make('gate', 'pGate', 2, (put, s) => {
    const W = pick([9, 13], s);
    const H = pick([6, 8], s);
    const half = Math.floor(W / 2);
    const tw = 1;
    for (let x = -half; x <= half; x++) {
      const towerCol = Math.abs(x) >= half - tw * 2;
      for (let z = -1; z <= 1; z++) {
        for (let y = 0; y < H + (towerCol ? 3 : 0); y++) {
          if (towerCol) {
            const edge = Math.abs(z) === 1 || Math.abs(x) === half || Math.abs(x) === half - tw * 2;
            if (edge) put(x, y, z, 'wall');
          } else if (z === 0) {
            const opening = Math.abs(x) <= 1 && y < 4;
            const archTop = Math.abs(x) <= 2 && y === 4;
            if (!opening) put(x, y, z, archTop ? 'trim' : y === H - 1 ? 'trim' : 'wall');
          }
        }
        if (towerCol && (x + z) % 2 === 0) put(x, H + 3, z, 'trim');
      }
      if (!towerCol && x % 2 === 0) put(x, H, 0, 'trim');
    }
  }),
  arch: make('arch', 'pArch', 3, (put, s) => {
    const W = pick([3, 5, 7], s);
    const H = pick([4, 6, 8], s);
    const half = Math.floor(W / 2);
    for (let y = 0; y < H - 1; y++) {
      put(-half, y, 0, 'pillar');
      put(half, y, 0, 'pillar');
    }
    for (let x = -half; x <= half; x++) {
      const lift = Math.round(Math.abs(x) / Math.max(1, half) * (half > 1 ? 1 : 0));
      put(x, H - 1 - lift, 0, 'trim');
      if (Math.abs(x) === half - 1 && half > 1) put(x, H - 2, 0, 'trim');
    }
  }),
  stairs: make('stairs', 'pStairs', 3, (put, s) => {
    const W = pick([2, 3, 4], s);
    const N = pick([4, 6, 9], s);
    const half = Math.floor(W / 2);
    for (let i = 0; i < N; i++) {
      for (let x = -half; x < W - half; x++) {
        for (let y = 0; y <= i; y++) put(x, y, -i, y === i ? 'stairs' : 'wallAlt');
      }
    }
  }),
  spiral: make('spiral', 'pSpiral', 2, (put, s) => {
    const H = pick([8, 14], s);
    const R = pick([2, 2.5], s);
    for (let y = 0; y < H; y++) put(0, y, 0, 'pillar');
    let ang = 0;
    for (let y = 0; y < H; y++) {
      for (let k = 0; k < 2; k++) {
        const a = ang + k * 0.35;
        const x = Math.round(Math.cos(a) * R);
        const z = Math.round(Math.sin(a) * R);
        put(x, y, z, 'stairs');
        const x2 = Math.round(Math.cos(a) * (R - 1));
        const z2 = Math.round(Math.sin(a) * (R - 1));
        if (x2 !== 0 || z2 !== 0) put(x2, y, z2, 'stairs');
      }
      ang += 0.7;
    }
  }),
  floor: make('floor', 'pFloor', 3, (put, s) => {
    const W = pick([5, 8, 12], s);
    const half = Math.floor(W / 2);
    for (let x = -half; x < W - half; x++) for (let z = -half; z < W - half; z++) put(x, 0, z, 'floor');
  }),
  roof: make('roof', 'pRoof', 3, (put, s) => {
    const W = pick([7, 9, 13], s);
    const D = pick([7, 11, 15], s);
    const hw = Math.floor(W / 2);
    const hd = Math.floor(D / 2);
    for (let x = -hw; x <= hw; x++) {
      const y = hw - Math.abs(x);
      for (let z = -hd; z <= hd; z++) {
        put(x, y, z, 'roof');
        if (y > 0 && Math.abs(z) === hd) for (let yy = 0; yy < y; yy++) put(x, yy, z, 'wallAlt');
      }
    }
  }),
  dome: make('dome', 'pDome', 3, (put, s) => {
    const R = pick([3.5, 4.5, 6.5], s);
    const r = Math.ceil(R);
    for (let x = -r; x <= r; x++) {
      for (let z = -r; z <= r; z++) {
        for (let y = 0; y <= r; y++) {
          const d = Math.sqrt(x * x + y * y + z * z);
          if (d <= R + 0.2 && d > R - 1.0) put(x, y, z, y === Math.round(R) ? 'accent' : 'roof');
        }
      }
    }
    put(0, r, 0, 'light');
  }),
  column: make('column', 'pColumn', 3, (put, s) => {
    const H = pick([4, 7, 10], s);
    put(0, 0, 0, 'trim');
    for (let y = 1; y < H - 1; y++) put(0, y, 0, 'pillar');
    put(0, H - 1, 0, 'trim');
  }),
  battlement: make('battlement', 'pBattlement', 3, (put, s) => {
    const L = pick([6, 10, 16], s);
    const half = Math.floor(L / 2);
    for (let x = -half; x < L - half; x++) {
      put(x, 0, 0, 'trim');
      if ((x + half) % 2 === 0) put(x, 1, 0, 'trim');
    }
  }),
  bridge: make('bridge', 'pBridge', 3, (put, s) => {
    const L = pick([6, 10, 16], s);
    const half = Math.floor(L / 2);
    for (let x = -half; x < L - half; x++) {
      for (let z = -1; z <= 1; z++) put(x, 0, z, 'accent');
      if ((x + half) % 3 === 0) {
        put(x, 1, -1, 'pillar');
        put(x, 1, 1, 'pillar');
      }
    }
  }),
  pyramid: make('pyramid', 'pPyramid', 3, (put, s) => {
    const W = pick([7, 11, 15], s);
    const half = Math.floor(W / 2);
    for (let y = 0; y <= half; y++) {
      const r = half - y;
      for (let x = -r; x <= r; x++) {
        for (let z = -r; z <= r; z++) {
          const edge = Math.abs(x) === r || Math.abs(z) === r;
          if (edge || y === half) put(x, y, z, y === half ? 'accent' : 'wall');
        }
      }
    }
    // Entrance tunnel to the centre chamber
    for (let z = -half; z <= 0; z++) {
      put(0, 0, z, 'air');
      put(0, 1, z, 'air');
    }
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) for (let y = 0; y < 3; y++) put(x, y, z, 'air');
  }),
} as Record<PrefabId, PrefabDef>;


// ---------------- v2 prefabs ----------------
Object.assign(PREFABS, {
  house: make('house', 'pHouse', 3, (put, s) => {
    const W = pick([5, 7, 9], s);
    const D = pick([5, 7, 9], s);
    const H = pick([3, 4, 5], s);
    const hw = Math.floor(W / 2);
    const hd = Math.floor(D / 2);
    for (let x = -hw; x <= hw; x++) {
      for (let z = -hd; z <= hd; z++) {
        const edge = Math.abs(x) === hw || Math.abs(z) === hd;
        for (let y = 0; y < H; y++) {
          if (edge) put(x, y, z, y === 0 ? 'wallAlt' : 'wall');
          else if (y === 0) put(x, y, z, 'floor');
        }
      }
    }
    // Door on -Z, windows on the sides
    put(0, 0, -hd, 'air');
    put(0, 1, -hd, 'air');
    put(0, 2, -hd, 'trim');
    for (let y = 1; y < H - 1; y++) {
      if (W >= 7) {
        put(hw, y, 0, 'glass');
        put(-hw, y, 0, 'glass');
      }
      put(2, y, hd, 'glass');
      put(-2, y, hd, 'glass');
    }
    // Pitched roof along X
    for (let x = -hw - 1; x <= hw + 1; x++) {
      const yy = H + (hw + 1 - Math.abs(x));
      for (let z = -hd - 1; z <= hd + 1; z++) {
        put(x, yy, z, 'roof');
        if (Math.abs(z) === hd + 1 || Math.abs(z) === hd) {
          // gable fill
          for (let y2 = H; y2 < yy; y2++) if (Math.abs(x) <= hw && Math.abs(z) === hd) put(x, y2, z, 'wallAlt');
        }
      }
    }
    put(0, H + hw + 1, 0, 'light');
  }),
  keep: make('keep', 'pKeep', 2, (put, s) => {
    const W = pick([9, 13], s);
    const H = pick([9, 12], s);
    const half = Math.floor(W / 2);
    const mid = Math.floor(H / 2);
    for (let x = -half; x <= half; x++) {
      for (let z = -half; z <= half; z++) {
        const edge = Math.abs(x) === half || Math.abs(z) === half;
        for (let y = 0; y < H; y++) {
          if (edge) put(x, y, z, y === mid ? 'trim' : 'wall');
          else if (y === 0 || y === mid || y === H - 1) put(x, y, z, 'floor');
        }
        if (edge) {
          const corner = Math.abs(x) === half && Math.abs(z) === half;
          if (corner) for (let y = H; y < H + 3; y++) put(x, y, z, 'wall');
          else if ((x + z + half * 2) % 2 === 0) put(x, H, z, 'trim');
        }
      }
    }
    // Gate on -Z and stairs between floors along the +X inner wall
    for (let dx = -1; dx <= 1; dx++) for (let y = 0; y < 3; y++) put(dx, y, -half, 'air');
    put(0, 3, -half, 'trim');
    let sy = 0;
    for (let z = -half + 2; z <= half - 2 && sy < mid; z++, sy++) {
      put(half - 1, sy, z, 'stairs');
      put(half - 1, mid, z, 'air');
    }
    let sy2 = mid;
    for (let z = half - 2; z >= -half + 2 && sy2 < H - 1; z--, sy2++) {
      put(-half + 1, sy2, z, 'stairs');
      put(-half + 1, H - 1, z, 'air');
    }
    // Windows
    for (let y = 2; y < H - 1; y += 3) {
      put(half, y, 0, 'glass');
      put(-half, y, 0, 'glass');
      put(0, y, half, 'glass');
    }
    put(0, H, 0, 'light');
  }),
  gazebo: make('gazebo', 'pGazebo', 2, (put, s) => {
    const R = pick([2.5, 3.5], s);
    const r = Math.ceil(R);
    const H = pick([4, 5], s);
    for (let x = -r; x <= r; x++)
      for (let z = -r; z <= r; z++) {
        const d = Math.sqrt(x * x + z * z);
        if (d <= R + 0.3) put(x, 0, z, 'floor');
      }
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.round(Math.cos(a) * R);
      const z = Math.round(Math.sin(a) * R);
      for (let y = 1; y < H; y++) put(x, y, z, 'pillar');
    }
    for (let x = -r - 1; x <= r + 1; x++)
      for (let z = -r - 1; z <= r + 1; z++) {
        const d = Math.sqrt(x * x + z * z);
        if (d <= R + 1.2) put(x, H, z, 'roof');
        if (d <= R - 0.8) put(x, H + 1, z, 'roof');
      }
    put(0, H + 2, 0, 'accent');
    put(0, H - 1, 0, 'light');
  }),
  balcony: make('balcony', 'pBalcony', 3, (put, s) => {
    const L = pick([3, 5, 7], s);
    const half = Math.floor(L / 2);
    const D = pick([2, 3, 3], s);
    for (let x = -half; x <= half; x++)
      for (let z = 0; z < D; z++) {
        put(x, 0, z, 'floor');
        if (z === D - 1 || Math.abs(x) === half) put(x, 1, z, 'trim');
      }
    for (let x = -half; x <= half; x++) put(x, -1, 0, 'accent');
  }),
  buttress: make('buttress', 'pButtress', 3, (put, s) => {
    const H = pick([4, 6, 8], s);
    for (let y = 0; y < H; y++) {
      const reach = Math.max(0, Math.round(((H - 1 - y) / (H - 1)) * (H / 2)));
      for (let z = 0; z <= reach; z++) put(0, y, -z, z === reach ? 'stairs' : 'wallAlt');
    }
    put(0, H, 0, 'trim');
  }),
  spire: make('spire', 'pSpire', 3, (put, s) => {
    const H = pick([8, 12, 16], s);
    const base = pick([1, 2, 2], s);
    for (let y = 0; y < H; y++) {
      const r = Math.max(0, Math.round(base * (1 - y / H)));
      for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) put(x, y, z, y % 3 === 2 ? 'wallAlt' : 'wall');
    }
    put(0, H, 0, 'accent');
    put(0, H + 1, 0, 'light');
  }),
  ramp: make('ramp', 'pRamp', 3, (put, s) => {
    const W = pick([2, 3, 4], s);
    const N = pick([4, 6, 9], s);
    const half = Math.floor(W / 2);
    for (let i = 0; i < N; i++) {
      for (let x = -half; x < W - half; x++) {
        for (let y = 0; y <= i; y++) put(x, y, -i, y === i ? 'stairs' : 'wallAlt');
        // Side rails
        if (x === -half || x === W - half - 1) put(x, i + 1, -i, 'trim');
      }
    }
  }),
  tunnel: make('tunnel', 'pTunnel', 3, (put, s) => {
    const L = pick([5, 8, 12], s);
    const W = pick([3, 3, 5], s);
    const H = pick([3, 4, 4], s);
    const hw = Math.floor(W / 2);
    for (let z = 0; z < L; z++) {
      for (let x = -hw; x <= hw; x++) {
        put(x, 0, z, 'floor');
        for (let y = 1; y <= H; y++) {
          if (Math.abs(x) === hw) put(x, y, z, y === H ? 'trim' : z % 3 === 1 ? 'wallAlt' : 'wall');
          else if (y === H) put(x, y, z, 'roof');
          else put(x, y, z, 'air');
        }
      }
      if (z % 4 === 2) put(0, H - 1, z, 'light');
    }
  }),
  curvedWall: make('curvedWall', 'pCurvedWall', 3, (put, s) => {
    const R = pick([4, 6, 9], s);
    const H = pick([4, 5, 7], s);
    const steps = Math.ceil(R * Math.PI * 0.5) * 2;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * (Math.PI / 2);
      const x = Math.round(Math.cos(a) * R) - R;
      const z = Math.round(Math.sin(a) * R);
      for (let y = 0; y < H; y++) put(x, y, z, y === H - 1 ? 'trim' : 'wall');
      if (i % 2 === 0) put(x, H, z, 'trim');
    }
  }),
  hedge: make('hedge', 'pHedge', 3, (put, s) => {
    const L = pick([4, 7, 10], s);
    const half = Math.floor(L / 2);
    const H = pick([1, 2, 2], s);
    for (let x = -half; x < L - half; x++) for (let y = 0; y < H; y++) put(x, y, 0, 'accent');
    if (L >= 7) for (let z = 1; z <= 2; z++) for (let y = 0; y < H; y++) { put(-half, y, z, 'accent'); put(L - half - 1, y, z, 'accent'); }
  }),
  fountain: make('fountain', 'pFountain', 2, (put, s) => {
    const R = pick([2.5, 3.5], s);
    const r = Math.ceil(R);
    for (let x = -r; x <= r; x++)
      for (let z = -r; z <= r; z++) {
        const d = Math.sqrt(x * x + z * z);
        if (d <= R + 0.3) put(x, 0, z, 'trim');
        if (d <= R + 0.3 && d > R - 0.9) put(x, 1, z, 'trim');
        else if (d <= R - 0.9) put(x, 1, z, 'glass');
      }
    put(0, 1, 0, 'pillar');
    put(0, 2, 0, 'pillar');
    put(0, 3, 0, 'light');
  }),
  hall: make('hall', 'pHall', 2, (put, s) => {
    const W = pick([7, 9], s);
    const L = pick([9, 13], s);
    const H = pick([5, 6], s);
    const hw = Math.floor(W / 2);
    const hl = Math.floor(L / 2);
    for (let x = -hw; x <= hw; x++)
      for (let z = -hl; z <= hl; z++) {
        put(x, 0, z, 'floor');
        const colRow = Math.abs(x) === hw - 1 && (z + hl) % 3 === 0;
        if (colRow) for (let y = 1; y < H; y++) put(x, y, z, 'pillar');
        if (Math.abs(x) === hw || Math.abs(z) === hl) {
          for (let y = 1; y < H; y++) {
            const win = y >= 2 && y < H - 1 && (z + hl) % 3 === 1 && Math.abs(x) === hw;
            const door = Math.abs(z) === hl && Math.abs(x) <= 1 && y <= 2;
            if (door) put(x, y, z, 'air');
            else put(x, y, z, win ? 'glass' : 'wall');
          }
        }
        put(x, H, z, 'roof');
        if ((x + z) % 4 === 0 && Math.abs(x) < hw - 1 && Math.abs(z) < hl) put(x, H - 1, z, 'light');
      }
    for (let x = -hw; x <= hw; x++) { put(x, H + 1, -hl, 'trim'); put(x, H + 1, hl, 'trim'); }
  }),
  maze: make('maze', 'pMaze', 2, (put, s) => {
    const N = pick([7, 11], s);
    const half = Math.floor(N / 2);
    const H = 3;
    // Deterministic maze: walls on even rows with gaps shifting each row.
    for (let x = -half; x <= half; x++)
      for (let z = -half; z <= half; z++) {
        put(x, 0, z, 'floor');
        const gx = ((z + half) * 3 + 1) % N - half;
        const wallRow = (z + half) % 2 === 1 && x !== gx && x !== gx + 1;
        const border = Math.abs(x) === half || Math.abs(z) === half;
        const gate = border && ((z === -half && Math.abs(x) <= 0) || (z === half && x === half - 1));
        if ((wallRow || border) && !gate) for (let y = 1; y <= H; y++) put(x, y, z, y === H ? 'trim' : 'wallAlt');
      }
  }),
  watchtower: make('watchtower', 'pWatchtower', 2, (put, s) => {
    const H = pick([7, 10], s);
    // Four stilts, a platform with railing and a small roof
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (let y = 0; y < H; y++) put(x, y, z, 'pillar');
    for (let x = -2; x <= 2; x++)
      for (let z = -2; z <= 2; z++) {
        put(x, H, z, 'floor');
        if (Math.abs(x) === 2 || Math.abs(z) === 2) put(x, H + 1, z, 'trim');
        if (Math.abs(x) <= 1 && Math.abs(z) <= 1) put(x, H + 4, z, 'roof');
      }
    for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) for (let y = H + 1; y < H + 4; y++) put(x, y, z, 'pillar');
    // Ladder-like stairs up one stilt
    for (let y = 0; y < H; y++) put(y % 2 === 0 ? 0 : -1, y, -2, 'stairs');
    put(0, H + 3, 0, 'light');
  }),
} as Record<PrefabId, PrefabDef>);

/** Rotates local prefab coordinates by 90° steps around the Y axis. */
export function rotateBlocks(blocks: PrefabBlock[], rot: number): PrefabBlock[] {
  const r = ((rot % 4) + 4) % 4;
  if (r === 0) return blocks;
  return blocks.map((b) => {
    let { x, z } = b;
    for (let i = 0; i < r; i++) {
      const nx = -z;
      const nz = x;
      x = nx;
      z = nz;
    }
    return { x, y: b.y, z, role: b.role };
  });
}

export function prefabCost(blocks: PrefabBlock[]): number {
  let n = 0;
  for (const b of blocks) if (b.role !== 'air') n++;
  return n;
}
