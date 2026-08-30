import * as THREE from 'three';
import type { PlaceKind } from '../game/types';

/**
 * The things you press are things.
 *
 * A monitor has a keyboard in front of it and a cable behind it. A camera hangs
 * off a bracket and sweeps the corridor. A traffic light counts through red,
 * green and amber. A printer pushes a sheet out into its tray. Every one of them
 * is built out of boxes and cylinders at boot — nothing is loaded — and every
 * one of them moves, because a room where nothing moves is a photograph.
 */

const body = new THREE.MeshStandardMaterial({ color: 0x2b343d, roughness: 0.62, metalness: 0.3 });
const dark = new THREE.MeshStandardMaterial({ color: 0x14191f, roughness: 0.78 });
const pale = new THREE.MeshStandardMaterial({ color: 0x8b949c, roughness: 0.5, metalness: 0.45 });
const steel = new THREE.MeshStandardMaterial({ color: 0x5d6771, roughness: 0.35, metalness: 0.72 });
const rubber = new THREE.MeshStandardMaterial({ color: 0x0d1014, roughness: 0.95 });

/** What the game says about this place right now, for the things that move. */
export interface ObjState {
  mine: boolean;
  /** Switched off by the player. */
  off: boolean;
  /** The building's power is down. */
  dark: boolean;
  attention: number;
  /** 0..1, decaying — something just happened here. */
  busy: number;
}

export interface PlaceObject {
  group: THREE.Group;
  /** The lit faces — these turn cyan when the place becomes yours. */
  glowParts: THREE.Mesh[];
  /** The one mesh the pointer tests against. */
  hit: THREE.Mesh;
  /** Called every frame. */
  tick(t: number, st: ObjState): void;
}

function lit(color = 0x8fe9ff) {
  return new THREE.MeshBasicMaterial({ color });
}

/** A screen's worth of content, drawn once into a canvas at boot. */
function screenTexture(seed: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0b1620';
  g.fillRect(0, 0, 128, 256);
  let r = seed;
  const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  // Panels, and lines of text inside them. Close up it reads as somebody's work.
  for (let p = 0; p < 4; p++) {
    const x = 4 + rnd() * 26;
    const y = 6 + p * 62 + rnd() * 8;
    const w = 122 - x - rnd() * 14;
    const h = 40 + rnd() * 14;
    g.fillStyle = `rgba(${20 + rnd() * 30},${50 + rnd() * 60},${80 + rnd() * 70},0.85)`;
    g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(180,230,255,0.75)';
    for (let l = 0; l < 4 + rnd() * 4; l++) {
      const ly = y + 6 + l * 7;
      if (ly > y + h - 4) break;
      g.fillRect(x + 4, ly, 8 + rnd() * (w - 20), 2.4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let seeds = 0;

/**
 * Every place is a landmark now.
 *
 * The game used to be played against the objects on a desk, so this file drew
 * desks: a monitor with a keyboard in front of it, a camera on a bracket, a
 * printer pushing a sheet into its tray. The game is played against whole
 * companies, hospitals and power stations now, and a hospital is not a thing
 * that fits on a desk.
 *
 * So each kind gets a landmark instead — a shape you can tell apart from across
 * the city at a glance, built out of boxes and cylinders at boot like everything
 * else here, and lit along one face so that taking it is something you watch
 * happen rather than a number going up.
 */
export function makeObject(kind: PlaceKind): PlaceObject {
  const g = new THREE.Group();
  const glow: THREE.Mesh[] = [];
  let hit: THREE.Mesh;
  let tick: (t: number, st: ObjState) => void = () => {};

  const add = (m: THREE.Mesh) => { m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const face = (m: THREE.Mesh) => { glow.push(m); g.add(m); return m; };
  const box = (w: number, h: number, d: number, mat = body) =>
    add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
  const cyl = (r1: number, r2: number, h: number, seg: number, mat = body) =>
    add(new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat));
  const panel = (w: number, h: number, mat: THREE.Material) =>
    face(new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat));

  const seed = seeds++;

  switch (kind) {
    // ── a company: a block of racks, breathing ─────────────────────────────
    case 'company': {
      const shell = box(1.5, 2.2, 1.0);
      shell.position.y = 1.1;
      hit = shell;
      for (let i = 0; i < 5; i++) {
        const bar = panel(1.25, 0.14, lit(0x7fe4ff));
        bar.position.set(0, 0.35 + i * 0.42, 0.51);
        (bar.material as THREE.MeshBasicMaterial).opacity = 0.9;
      }
      tick = (t, st) => {
        for (let i = 0; i < glow.length; i++) {
          const m = glow[i].material as THREE.MeshBasicMaterial;
          m.opacity = st.dark ? 0.05
            : (st.mine ? 0.55 : 0.2) + Math.sin(t * 1.4 + i * 1.1) * 0.2 + st.busy * 0.35;
        }
      };
      break;
    }

    // ── a power station: three stacks and a hum ────────────────────────────
    case 'power': {
      const base = box(1.8, 0.5, 1.3);
      base.position.y = 0.25;
      hit = base;
      for (let i = 0; i < 3; i++) {
        const stack = cyl(0.22, 0.28, 2.6, 10, pale);
        stack.position.set(-0.5 + i * 0.5, 1.75, 0);
      }
      const bolt = panel(1.5, 0.3, lit(0xffd27f));
      bolt.position.set(0, 0.3, 0.66);
      tick = (t, st) => {
        const m = bolt.material as THREE.MeshBasicMaterial;
        m.opacity = st.dark ? 0.02 : (st.mine ? 0.8 : 0.3) + Math.sin(t * 6) * 0.15;
      };
      break;
    }

    // ── water: a low round tank ────────────────────────────────────────────
    case 'water': {
      const tank = cyl(1.0, 1.0, 0.9, 16, pale);
      tank.position.y = 0.45;
      hit = tank;
      const ring = panel(2.0, 0.16, lit(0x7fd4ff));
      ring.position.set(0, 0.8, 1.01);
      tick = (t, st) => {
        const m = ring.material as THREE.MeshBasicMaterial;
        m.opacity = (st.mine ? 0.7 : 0.25) + Math.sin(t * 1.1) * 0.18;
      };
      break;
    }

    // ── roads: a signal head on a mast ─────────────────────────────────────
    case 'roads': {
      const mast = cyl(0.07, 0.09, 3.0, 8, steel);
      mast.position.y = 1.5;
      const head = box(0.34, 0.9, 0.3, dark);
      head.position.set(0, 3.1, 0);
      hit = head;
      const lamps = [0xff4d5e, 0xffc94d, 0x53ff9e].map((c, i) => {
        const l = face(new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), lit(c)));
        l.position.set(0, 3.42 - i * 0.28, 0.16);
        return l;
      });
      tick = (t, st) => {
        const step = Math.floor(t * (st.mine ? 1.2 : 0.5)) % 3;
        lamps.forEach((l, i) => {
          (l.material as THREE.MeshBasicMaterial).opacity = st.dark ? 0.03 : (i === step ? 1 : 0.12);
        });
      };
      break;
    }

    // ── transport: a carriage on a rail ────────────────────────────────────
    case 'transport': {
      const car = box(2.4, 0.7, 0.9, pale);
      car.position.y = 0.75;
      hit = car;
      const rail = box(3.4, 0.06, 0.12, steel);
      rail.position.y = 0.34;
      for (let i = 0; i < 4; i++) {
        const w = panel(0.34, 0.28, lit(0xbfe9ff));
        w.position.set(-0.9 + i * 0.6, 0.82, 0.46);
      }
      tick = (t, st) => {
        g.children[0].position.x = Math.sin(t * 0.5) * 0.35;
        for (const m of glow) {
          (m.material as THREE.MeshBasicMaterial).opacity = st.dark ? 0.04 : st.mine ? 0.8 : 0.3;
        }
      };
      break;
    }

    // ── talk: a mast with a lit dish ───────────────────────────────────────
    case 'talk': {
      const mast = cyl(0.08, 0.14, 3.4, 8, steel);
      mast.position.y = 1.7;
      hit = mast;
      const dish = cyl(0.55, 0.1, 0.16, 14, pale);
      dish.position.set(0, 3.3, 0);
      dish.rotation.x = Math.PI * 0.3;
      for (let i = 0; i < 3; i++) {
        const ring = face(new THREE.Mesh(new THREE.RingGeometry(0.5 + i * 0.35, 0.56 + i * 0.35, 20), lit(0xa9d8ff)));
        ring.position.set(0, 3.3, 0);
        ring.rotation.x = -Math.PI / 2;
      }
      tick = (t, st) => {
        glow.forEach((m, i) => {
          const phase = (t * (st.mine ? 0.9 : 0.35) + i * 0.4) % 1;
          (m.material as THREE.MeshBasicMaterial).opacity = st.dark ? 0 : (1 - phase) * (st.mine ? 0.7 : 0.25);
        });
      };
      break;
    }

    // ── care: a low wide block with a lit cross ────────────────────────────
    case 'care': {
      const shell = box(2.2, 1.4, 1.2);
      shell.position.y = 0.7;
      hit = shell;
      const across = panel(0.9, 0.24, lit(0xd8f4ff));
      across.position.set(0, 0.9, 0.61);
      const down = panel(0.24, 0.9, lit(0xd8f4ff));
      down.position.set(0, 0.9, 0.61);
      tick = (t, st) => {
        for (const m of glow) {
          (m.material as THREE.MeshBasicMaterial).opacity = st.dark ? 0.08
            : (st.mine ? 0.9 : 0.35) + Math.sin(t * 0.9) * 0.08;
        }
      };
      break;
    }

    // ── study: stacked slabs, like books ───────────────────────────────────
    case 'study': {
      const base = box(2.0, 0.3, 1.4);
      base.position.y = 0.15;
      hit = base;
      for (let i = 0; i < 4; i++) {
        const slab = box(1.7 - i * 0.22, 0.24, 1.15 - i * 0.14, i % 2 ? pale : body);
        slab.position.y = 0.42 + i * 0.3;
        slab.rotation.y = (i % 2 ? 1 : -1) * 0.12;
      }
      const line = panel(1.4, 0.1, lit(0xc9b6ff));
      line.position.set(0, 1.62, 0.5);
      tick = (t, st) => {
        (line.material as THREE.MeshBasicMaterial).opacity = st.mine
          ? 0.6 + Math.sin(t * 1.6) * 0.3 : 0.2;
      };
      break;
    }

    // ── homes: a cluster of small lit windows ──────────────────────────────
    case 'homes': {
      const base = box(2.4, 0.2, 1.8, dark);
      base.position.y = 0.1;
      hit = base;
      let r = seed * 7 + 3;
      const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      for (let i = 0; i < 7; i++) {
        const h = 0.6 + rnd() * 1.1;
        const b = box(0.4 + rnd() * 0.2, h, 0.4 + rnd() * 0.2);
        b.position.set(-0.9 + rnd() * 1.8, 0.2 + h / 2, -0.6 + rnd() * 1.2);
        const w = panel(0.16, 0.16, lit(0xffe0a8));
        w.position.set(b.position.x, b.position.y + h * 0.2, b.position.z + 0.22);
      }
      tick = (t, st) => {
        glow.forEach((m, i) => {
          const on = Math.sin(t * 0.3 + i * 2.1) > (st.mine ? -0.7 : 0.2);
          (m.material as THREE.MeshBasicMaterial).opacity = st.dark ? 0 : on ? 0.85 : 0.06;
        });
      };
      break;
    }

    // ── money: a squat vault with a heavy door ─────────────────────────────
    case 'money': {
      const shell = box(1.8, 1.6, 1.4, steel);
      shell.position.y = 0.8;
      hit = shell;
      const door = cyl(0.55, 0.55, 0.14, 18, pale);
      door.position.set(0, 0.85, 0.72);
      door.rotation.x = Math.PI / 2;
      const seam = face(new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 20), lit(0xffe08a)));
      seam.position.set(0, 0.85, 0.8);
      tick = (t, st) => {
        (seam.material as THREE.MeshBasicMaterial).opacity = st.mine
          ? 0.75 + Math.sin(t * 2.2) * 0.2 : 0.18;
        door.rotation.z = st.mine ? t * 0.25 : 0;
      };
      break;
    }

    // ── city: a hall with columns ──────────────────────────────────────────
    case 'city': {
      const base = box(2.6, 0.28, 1.6, pale);
      base.position.y = 0.14;
      hit = base;
      for (let i = 0; i < 5; i++) {
        const col = cyl(0.11, 0.11, 1.5, 10, pale);
        col.position.set(-1.0 + i * 0.5, 1.03, 0.55);
      }
      const roof = box(2.8, 0.24, 1.8, pale);
      roof.position.y = 1.9;
      const band = panel(2.2, 0.14, lit(0x8fe9ff));
      band.position.set(0, 1.9, 0.92);
      tick = (t, st) => {
        (band.material as THREE.MeshBasicMaterial).opacity = st.dark ? 0.05
          : (st.mine ? 0.8 : 0.25) + Math.sin(t * 0.7) * 0.12;
      };
      break;
    }

    // ── state: a tall slab with a flag on it ───────────────────────────────
    case 'state': {
      const slab = box(1.6, 3.4, 1.2, pale);
      slab.position.y = 1.7;
      hit = slab;
      const pole = cyl(0.05, 0.05, 1.4, 6, steel);
      pole.position.set(0.6, 4.1, 0);
      const flag = panel(0.7, 0.42, lit(0xdff2ff));
      flag.position.set(0.98, 4.5, 0);
      for (let i = 0; i < 4; i++) {
        const w = panel(1.2, 0.1, lit(0x8fe9ff));
        w.position.set(0, 0.7 + i * 0.8, 0.61);
      }
      tick = (t, st) => {
        flag.rotation.y = Math.sin(t * 1.5) * 0.25;
        glow.forEach((m, i) => {
          (m.material as THREE.MeshBasicMaterial).opacity = st.dark ? 0.04
            : i === 0 ? 0.9 : (st.mine ? 0.7 : 0.2) + Math.sin(t * 0.8 + i) * 0.15;
        });
      };
      break;
    }

    default: {
      const shell = box(1.2, 1.4, 1.0);
      shell.position.y = 0.7;
      hit = shell;
      break;
    }
  }

  return { group: g, glowParts: glow, hit: hit!, tick };
}
