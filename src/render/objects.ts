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

  switch (kind) {
    // ── a desk, a monitor, a keyboard, and somebody's work on the screen ────
    case 'computer': {
      const desk = box(1.5, 0.045, 0.75, new THREE.MeshStandardMaterial({ color: 0x8a765c, roughness: 0.72 }));
      desk.position.set(0, -0.03, 0.06);
      for (const [lx, lz] of [[-0.68, 0.3], [0.68, 0.3], [-0.68, -0.24], [0.68, -0.24]] as const) {
        box(0.05, 0.74, 0.05, steel).position.set(lx, -0.4, lz);
      }
      // The monitor: a panel on a neck on a foot, tilted back the way they are.
      const stand = box(0.26, 0.02, 0.17, dark); stand.position.set(0, 0.0, -0.1);
      const neck = box(0.055, 0.17, 0.05, dark); neck.position.set(0, 0.09, -0.1);
      const panel = new THREE.Group();
      panel.position.set(0, 0.19, -0.1);
      panel.rotation.x = -0.09;
      g.add(panel);
      const shell = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.35, 0.022), dark);
      shell.position.y = 0.16;
      shell.castShadow = true;
      panel.add(shell);
      const tex = screenTexture(seeds++);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.31),
        new THREE.MeshBasicMaterial({ map: tex }));
      glass.position.set(0, 0.16, 0.013);
      panel.add(glass);
      hit = face(new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.31),
        new THREE.MeshBasicMaterial({ color: 0x8fe9ff, transparent: true, opacity: 0.16 })));
      hit.position.set(0, 0.16, 0.014);
      panel.add(hit);
      glow.pop(); glow.push(hit);
      // A keyboard and a mouse in front of it, and a cable behind.
      const kb = box(0.42, 0.016, 0.14, dark); kb.position.set(0, 0.03, 0.2);
      for (let row = 0; row < 4; row++) {
        const keys = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.004, 0.022), pale);
        keys.position.set(0, 0.04, 0.155 + row * 0.03);
        g.add(keys);
      }
      const mouse = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), dark);
      mouse.scale.set(1, 0.6, 1.5);
      mouse.position.set(0.3, 0.038, 0.2);
      g.add(mouse);
      const cable = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.007, 4, 10, Math.PI), rubber);
      cable.rotation.set(Math.PI / 2, 0, 0);
      cable.position.set(0, 0.0, -0.22);
      g.add(cable);

      const gm = glass.material as THREE.MeshBasicMaterial;
      tick = (t, st) => {
        const on = !st.off && !st.dark;
        glass.visible = on;
        if (!on) return;
        // The screen scrolls a little, and flickers when somebody is working on it.
        tex.offset.y = (t * 0.012) % 1;
        gm.color.setScalar(0.86 + Math.sin(t * 9.1) * 0.05 + (st.busy > 0 ? 0.14 : 0));
      };
      break;
    }

    // ── the company's main computer: a rack that breathes ──────────────────
    case 'mainframe': {
      box(0.78, 1.9, 0.9).position.y = 0.95;
      box(0.82, 0.06, 0.94, steel).position.y = 1.93;
      box(0.86, 0.04, 0.98, dark).position.y = 0.02;
      // Slotted front, with a light on every slot.
      const leds: THREE.Mesh[] = [];
      for (let i = 0; i < 8; i++) {
        const slot = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.15, 0.03), dark);
        slot.position.set(0, 0.3 + i * 0.2, 0.455);
        g.add(slot);
        for (let k = 0; k < 3; k++) {
          const led = new THREE.Mesh(new THREE.CircleGeometry(0.012, 6), lit(k === 0 ? 0x5affa8 : 0x8fe9ff));
          led.position.set(-0.28 + k * 0.05, 0.3 + i * 0.2, 0.472);
          g.add(led);
          leds.push(led);
        }
      }
      // A fan behind a grille at the top, turning.
      const fan = new THREE.Group();
      fan.position.set(0, 1.78, 0.455);
      g.add(fan);
      for (let i = 0; i < 5; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.05), steel);
        blade.rotation.z = (i / 5) * Math.PI * 2;
        blade.position.set(Math.cos(blade.rotation.z) * 0.05, Math.sin(blade.rotation.z) * 0.05, 0);
        fan.add(blade);
      }
      hit = face(new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.12),
        new THREE.MeshBasicMaterial({ color: 0x9ff2ff, transparent: true, opacity: 0.75 })));
      hit.position.set(0, 1.6, 0.47);
      tick = (t, st) => {
        const on = !st.off && !st.dark;
        fan.rotation.z = on ? t * 6 : fan.rotation.z * 0.98;
        leds.forEach((led, i) => {
          const m = led.material as THREE.MeshBasicMaterial;
          const blink = Math.sin(t * (2 + (i % 7)) + i * 1.7) > (st.busy > 0 ? -0.6 : 0.35);
          m.opacity = on ? (blink ? 1 : 0.12) : 0.04;
          m.transparent = true;
        });
      };
      break;
    }

    // ── a camera on a bracket, sweeping the corridor ───────────────────────
    case 'camera': {
      // The bracket stays still; only the head turns.
      box(0.1, 0.1, 0.05, steel).position.set(0, 0, -0.24);
      const arm = box(0.05, 0.05, 0.26, steel);
      arm.position.set(0, -0.03, -0.11);
      arm.rotation.x = 0.35;
      const head = new THREE.Group();
      head.position.set(0, -0.11, 0.02);
      g.add(head);
      const shell = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.3), body);
      shell.castShadow = true;
      head.add(shell);
      const hood = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.2), body);
      hood.position.set(0, 0.07, 0.04);
      head.add(hood);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.09, 12), dark);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0, 0.18);
      head.add(barrel);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.036, 14),
        new THREE.MeshStandardMaterial({ color: 0x0a1218, roughness: 0.08, metalness: 0.9 }));
      lens.position.set(0, 0, 0.226);
      head.add(lens);
      // The ring of infra-red lamps round the lens, and the little red light.
      const ring: THREE.Mesh[] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const l = new THREE.Mesh(new THREE.CircleGeometry(0.007, 6), lit(0xff5470));
        l.position.set(Math.cos(a) * 0.043, Math.sin(a) * 0.043, 0.227);
        (l.material as THREE.MeshBasicMaterial).transparent = true;
        (l.material as THREE.MeshBasicMaterial).opacity = 0.5;
        head.add(l);
        ring.push(l);
      }
      hit = face(new THREE.Mesh(new THREE.CircleGeometry(0.052, 14),
        new THREE.MeshBasicMaterial({ color: 0xff9a6a, transparent: true, opacity: 0.42 })));
      hit.position.set(0, 0, 0.232);
      head.add(hit);
      glow.pop(); glow.push(hit);
      tick = (t, st) => {
        // A camera nobody owns sweeps. A camera showing an old recording is frozen.
        const sweeping = !st.dark && !(st.mine && st.busy > 0.01);
        head.rotation.y = sweeping ? Math.sin(t * 0.22) * 0.42 : head.rotation.y;
        head.rotation.x = sweeping ? Math.sin(t * 0.11) * 0.06 : head.rotation.x;
        for (const l of ring) {
          (l.material as THREE.MeshBasicMaterial).opacity =
            st.dark ? 0.05 : 0.35 + Math.sin(t * 1.6) * 0.2;
        }
      };
      break;
    }

    // ── a phone on a desk ──────────────────────────────────────────────────
    case 'phone': {
      const slab = new THREE.Group();
      g.add(slab);
      const shell = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.009, 0.148), dark);
      shell.castShadow = true;
      slab.add(shell);
      const tex = screenTexture(seeds++);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.064, 0.134),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9 }));
      glass.rotation.x = -Math.PI / 2;
      glass.position.y = 0.0055;
      slab.add(glass);
      hit = face(new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.17),
        new THREE.MeshBasicMaterial({ color: 0xa8f0ff, transparent: true, opacity: 0.14 })));
      hit.rotation.x = -Math.PI / 2;
      hit.position.y = 0.007;
      slab.add(hit);
      glow.pop(); glow.push(hit);
      const gm = glass.material as THREE.MeshBasicMaterial;
      tick = (t, st) => {
        // Asleep it is a dark slab. Ringing, it lights up and walks across the desk.
        const awake = st.busy > 0.02;
        gm.opacity = awake ? 0.95 : 0.12 + Math.sin(t * 0.7) * 0.03;
        slab.position.x = awake ? Math.sin(t * 42) * 0.004 * st.busy : 0;
        slab.position.z = awake ? Math.sin(t * 37 + 1) * 0.004 * st.busy : 0;
        slab.rotation.y = awake ? Math.sin(t * 31) * 0.05 * st.busy : 0;
      };
      break;
    }

    // ── a traffic light that actually counts through its colours ───────────
    case 'traffic': {
      cyl(0.09, 0.13, 5.2, 10, steel).position.y = 2.6;
      cyl(0.2, 0.24, 0.2, 10, steel).position.y = 0.1;
      const headG = new THREE.Group();
      headG.position.y = 5.55;
      g.add(headG);
      const shell = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.92, 0.28), body);
      shell.castShadow = true;
      headG.add(shell);
      const lamps: THREE.Mesh[] = [];
      const colours = [0xff5470, 0xffb347, 0x5affa8];
      for (let i = 0; i < 3; i++) {
        // A hood over each lamp, the way they all have.
        const hood = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.13), body);
        hood.position.set(0, 0.36 - i * 0.3 + 0.09, 0.2);
        headG.add(hood);
        const l = new THREE.Mesh(new THREE.CircleGeometry(0.095, 14), lit(colours[i]));
        (l.material as THREE.MeshBasicMaterial).transparent = true;
        l.position.set(0, 0.36 - i * 0.3, 0.145);
        headG.add(l);
        lamps.push(l);
      }
      hit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.5),
        new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 5.55;
      g.add(hit);
      glow.push(lamps[2]);
      tick = (t, st) => {
        // Jammed on red, or the ordinary cycle: red, green, amber, round again.
        const phase = st.busy > 0.01 || st.dark ? 0 : Math.floor((t % 12) / 12 * 3);
        const stuck = st.busy > 0.01;
        lamps.forEach((l, i) => {
          const m = l.material as THREE.MeshBasicMaterial;
          const on = stuck ? i === 0 : i === [0, 2, 1][phase];
          m.opacity = st.dark ? 0.06 : on ? 1 : 0.13;
        });
      };
      break;
    }

    // ── a breaker panel, with a lever that goes down ───────────────────────
    case 'power': {
      box(1.15, 1.95, 0.22).position.y = 0.98;
      box(1.2, 0.05, 0.26, steel).position.y = 1.98;
      const doorG = new THREE.Group();
      doorG.position.set(-0.575, 0.98, 0.11);
      g.add(doorG);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 0.03), pale);
      leaf.position.x = 0.55;
      leaf.castShadow = true;
      doorG.add(leaf);
      doorG.rotation.y = -1.15;   // left standing open, as they always are
      // Forty little switches in rows, and one big lever.
      const switches: THREE.Mesh[] = [];
      for (let r0 = 0; r0 < 4; r0++) {
        for (let c0 = 0; c0 < 10; c0++) {
          const sw = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, 0.05), pale);
          sw.position.set(-0.42 + c0 * 0.094, 1.44 - r0 * 0.3, 0.13);
          g.add(sw);
          switches.push(sw);
        }
      }
      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.08), lit(0xff5470));
      lever.position.set(0, 0.3, 0.15);
      g.add(lever);
      hit = face(new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.6), lit(0xffb347)));
      (hit.material as THREE.MeshBasicMaterial).transparent = true;
      (hit.material as THREE.MeshBasicMaterial).opacity = 0.14;
      hit.position.set(0, 1.0, 0.115);
      glow.pop(); glow.push(hit);
      g.add(hit);
      tick = (_t, st) => {
        lever.rotation.x = st.off || st.dark ? 0.9 : 0;
        (lever.material as THREE.MeshBasicMaterial).color.setHex(st.off || st.dark ? 0xff5470 : 0x5affa8);
        switches.forEach((sw, i) => { sw.rotation.x = st.off || st.dark ? 0.5 : (i % 9 === 0 ? 0.5 : 0); });
      };
      break;
    }

    // ── a door with two leaves that swing ──────────────────────────────────
    case 'door': {
      box(0.1, 2.35, 0.14, steel).position.set(-0.82, 1.17, 0);
      box(0.1, 2.35, 0.14, steel).position.set(0.82, 1.17, 0);
      box(1.74, 0.12, 0.14, steel).position.set(0, 2.35, 0);
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x9fd8ee, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.24,
      });
      const leaves: THREE.Group[] = [];
      for (const s of [-1, 1]) {
        const hinge = new THREE.Group();
        hinge.position.set(s * 0.77, 0, 0);
        g.add(hinge);
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.72, 2.2, 0.05), glassMat);
        leaf.position.set(-s * 0.36, 1.1, 0);
        hinge.add(leaf);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.09, 0.07), steel);
        rail.position.set(-s * 0.36, 1.05, 0.03);
        hinge.add(rail);
        leaves.push(hinge);
      }
      // The card reader beside it, with its little light.
      const reader = box(0.09, 0.14, 0.05, dark);
      reader.position.set(-0.95, 1.15, 0.06);
      const led = new THREE.Mesh(new THREE.CircleGeometry(0.015, 8), lit(0x5affa8));
      led.position.set(-0.95, 1.21, 0.09);
      g.add(led);
      hit = face(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2),
        new THREE.MeshBasicMaterial({ color: 0x7fdcff, transparent: true, opacity: 0.1 })));
      hit.position.set(0, 1.15, 0.02);
      glow.pop(); glow.push(hit);
      g.add(hit);
      tick = (_t, st) => {
        const open = st.busy > 0.02 ? st.busy : 0;
        leaves[0].rotation.y += (open * 1.15 - leaves[0].rotation.y) * 0.14;
        leaves[1].rotation.y += (-open * 1.15 - leaves[1].rotation.y) * 0.14;
        (led.material as THREE.MeshBasicMaterial).color.setHex(st.dark ? 0x555555 : 0x5affa8);
      };
      break;
    }

    // ── a printer that puts a sheet in the tray ────────────────────────────
    case 'printer': {
      box(0.56, 0.36, 0.48).position.y = 0.18;
      box(0.5, 0.05, 0.42, dark).position.set(0, 0.385, -0.01);
      // The output tray, sloping out of the front.
      const tray = box(0.42, 0.02, 0.2, pale);
      tray.position.set(0, 0.3, 0.24);
      tray.rotation.x = -0.16;
      // The paper drawer underneath.
      box(0.5, 0.09, 0.06, pale).position.set(0, 0.07, 0.245);
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29),
        new THREE.MeshStandardMaterial({ color: 0xf2f0e8, roughness: 0.95, side: THREE.DoubleSide }));
      sheet.rotation.x = -Math.PI / 2 - 0.16;
      sheet.position.set(0, 0.315, 0.16);
      sheet.visible = false;
      g.add(sheet);
      hit = face(new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.06),
        new THREE.MeshBasicMaterial({ color: 0x8fe9ff, transparent: true, opacity: 0.7 })));
      hit.position.set(0.16, 0.3, 0.245);
      hit.rotation.x = -0.5;
      tick = (_t, st) => {
        // It wakes, and a sheet slides out into the tray.
        if (st.busy > 0.02) {
          sheet.visible = true;
          sheet.position.z = 0.06 + (1 - st.busy) * 0.16;
        }
      };
      break;
    }

    // ── the screen in the lobby ────────────────────────────────────────────
    case 'screen': {
      box(1.95, 1.15, 0.06, dark).position.y = 0.58;
      box(0.5, 0.06, 0.2, steel).position.set(0, 0.02, 0);
      const tex = screenTexture(seeds++);
      tex.repeat.set(1, 0.55);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.84, 1.04),
        new THREE.MeshBasicMaterial({ map: tex }));
      glass.position.set(0, 0.58, 0.035);
      g.add(glass);
      hit = face(new THREE.Mesh(new THREE.PlaneGeometry(1.84, 1.04),
        new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.12 })));
      hit.position.set(0, 0.58, 0.04);
      glow.pop(); glow.push(hit);
      g.add(hit);
      tick = (t, st) => {
        glass.visible = !st.dark && !st.off;
        tex.offset.y = (t * 0.03) % 1;
        (glass.material as THREE.MeshBasicMaterial).color.setScalar(st.busy > 0.02 ? 1.4 : 0.9);
      };
      break;
    }

    // ── the building's internet cupboard ───────────────────────────────────
    case 'box': {
      box(0.56, 0.78, 0.2, pale).position.y = 0.39;
      box(0.6, 0.04, 0.24, steel).position.y = 0.8;
      // A patch panel with a row of ports, and a bundle of cables under it.
      box(0.46, 0.1, 0.03, dark).position.set(0, 0.6, 0.105);
      const leds: THREE.Mesh[] = [];
      for (let i = 0; i < 8; i++) {
        const led = new THREE.Mesh(new THREE.CircleGeometry(0.012, 6), lit(0x5affa8));
        (led.material as THREE.MeshBasicMaterial).transparent = true;
        led.position.set(-0.2 + i * 0.057, 0.6, 0.122);
        g.add(led);
        leds.push(led);
      }
      for (let i = 0; i < 5; i++) {
        const loop = new THREE.Mesh(new THREE.TorusGeometry(0.07 + i * 0.012, 0.006, 4, 10, Math.PI * 1.3), rubber);
        loop.position.set(-0.12 + i * 0.05, 0.36, 0.1);
        loop.rotation.set(0.2, 0, i * 0.4);
        g.add(loop);
      }
      hit = face(new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.6), lit(0x7dffc4)));
      (hit.material as THREE.MeshBasicMaterial).transparent = true;
      (hit.material as THREE.MeshBasicMaterial).opacity = 0.16;
      hit.position.set(0, 0.4, 0.104);
      glow.pop(); glow.push(hit);
      g.add(hit);
      tick = (t, st) => {
        // The lights flicker with traffic — slowly, once you have slowed the line.
        const rate = st.busy > 0.02 ? 1.1 : 7;
        leds.forEach((led, i) => {
          const m = led.material as THREE.MeshBasicMaterial;
          m.opacity = st.dark ? 0.04 : Math.sin(t * rate + i * 2.1) > 0 ? 1 : 0.15;
        });
      };
      break;
    }

    // ── the technician's van ───────────────────────────────────────────────
    case 'car': {
      const shell = new THREE.MeshStandardMaterial({ color: 0xd8d5cd, roughness: 0.45, metalness: 0.3 });
      box(1.94, 0.7, 4.5, shell).position.y = 0.78;
      // A van: a low bonnet in front and a tall box behind.
      box(1.9, 0.62, 1.5, shell).position.set(0, 1.32, -1.3);
      box(1.86, 1.15, 2.6, shell).position.set(0, 1.55, 0.75);
      const windows = new THREE.MeshStandardMaterial({
        color: 0x1b2732, roughness: 0.1, metalness: 0.7,
      });
      box(1.72, 0.46, 0.05, windows).position.set(0, 1.42, -2.02);
      for (const s of [-1, 1]) box(0.04, 0.42, 1.2, windows).position.set(s * 0.94, 1.42, -1.2);
      for (const [wx, wz] of [[-0.94, 1.42], [0.94, 1.42], [-0.94, -1.5], [0.94, -1.5]] as const) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 12), rubber);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, 0.36, wz);
        g.add(w);
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.26, 10), steel);
        rim.rotation.z = Math.PI / 2;
        rim.position.set(wx, 0.36, wz);
        g.add(rim);
      }
      const lamps: THREE.Mesh[] = [];
      for (const s of [-1, 1]) {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), lit(0xfff0c0));
        (hl.material as THREE.MeshBasicMaterial).transparent = true;
        hl.position.set(s * 0.66, 0.82, -2.26);
        g.add(hl);
        lamps.push(hl);
      }
      hit = face(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.14 })));
      hit.position.set(0, 1.4, -2.28);
      glow.pop(); glow.push(hit);
      g.add(hit);
      tick = (t, st) => {
        for (const l of lamps) {
          (l.material as THREE.MeshBasicMaterial).opacity =
            st.busy > 0.02 ? 1 : 0.08 + Math.sin(t * 0.6) * 0.02;
        }
      };
      break;
    }

    // ── the speaker over the lobby desk ────────────────────────────────────
    case 'speaker': {
      box(0.06, 0.06, 0.14, steel).position.set(0, 0, -0.09);
      const horn = cyl(0.19, 0.09, 0.24, 14);
      horn.rotation.x = Math.PI / 2;
      horn.position.set(0, 0, 0.02);
      const cone = new THREE.Mesh(new THREE.CircleGeometry(0.17, 16), dark);
      cone.position.set(0, 0, 0.14);
      g.add(cone);
      hit = face(new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), lit(0xffc98a)));
      (hit.material as THREE.MeshBasicMaterial).transparent = true;
      (hit.material as THREE.MeshBasicMaterial).opacity = 0.2;
      hit.position.set(0, 0, 0.145);
      glow.pop(); glow.push(hit);
      g.add(hit);
      tick = (t, st) => {
        // It breathes when it is saying something.
        const k = st.busy > 0.02 ? 1 + Math.sin(t * 40) * 0.05 * st.busy : 1;
        cone.scale.set(k, k, 1);
        cone.position.z = 0.14 + (k - 1) * 0.1;
      };
      break;
    }

    default: {
      box(0.34, 0.34, 0.34).position.y = 0.17;
      hit = face(new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), lit()));
      hit.position.set(0, 0.17, 0.18);
      break;
    }
  }

  if (!glow.includes(hit)) glow.push(hit);
  // Only adopt it if nothing else already did: several of these hang their target
  // inside a moving part, and stealing it back here would leave it behind.
  if (!hit.parent) g.add(hit);
  return { group: g, glowParts: glow, hit, tick };
}
