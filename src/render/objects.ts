import * as THREE from 'three';
import type { PlaceKind } from '../game/types';

/**
 * The things you click on are things, not dots: a monitor on a desk, a camera
 * on a bracket, a traffic light on a pole. Each is built out of a handful of
 * boxes so it reads at arm's length and still reads as a shape from above.
 */

const body = new THREE.MeshStandardMaterial({ color: 0x2b343d, roughness: 0.65, metalness: 0.25 });
const dark = new THREE.MeshStandardMaterial({ color: 0x161c23, roughness: 0.8 });

/** The lit face of a thing — this is what turns cyan when it becomes yours. */
export interface PlaceObject {
  group: THREE.Group;
  glowParts: THREE.Mesh[];
  /** The one mesh the mouse tests against. */
  hit: THREE.Mesh;
}

function lit(color = 0x8fe9ff) {
  return new THREE.MeshBasicMaterial({ color });
}

export function makeObject(kind: PlaceKind): PlaceObject {
  const g = new THREE.Group();
  const glow: THREE.Mesh[] = [];
  let hit: THREE.Mesh;

  const add = (m: THREE.Mesh) => { m.castShadow = true; g.add(m); return m; };
  const face = (m: THREE.Mesh) => { glow.push(m); g.add(m); return m; };

  switch (kind) {
    case 'computer': {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.05), body)).position.set(0, 0.34, 0);
      hit = face(new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.34), lit()));
      hit.position.set(0, 0.34, 0.028);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.1), body)).position.set(0, 0.09, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.22), body)).position.set(0, 0.015, 0);
      break;
    }
    case 'mainframe': {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.7, 0.8), body)).position.y = 0.85;
      for (let i = 0; i < 7; i++) {
        const slot = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.02), dark);
        slot.position.set(0, 0.35 + i * 0.2, 0.41);
        g.add(slot);
      }
      hit = face(new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.1), lit(0x9ff2ff)));
      hit.position.set(0, 1.6, 0.41);
      break;
    }
    case 'camera': {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.34), body)).position.set(0, 0, -0.16);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.36), body)).position.set(0, -0.04, 0.08);
      hit = face(new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), lit(0xff9a6a)));
      hit.position.set(0, -0.04, 0.27);
      break;
    }
    case 'phone': {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.18), body));
      hit = face(new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.155), lit(0xa8f0ff)));
      hit.rotation.x = -Math.PI / 2;
      hit.position.y = 0.008;
      break;
    }
    case 'traffic': {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 5.4, 8), body)).position.y = 2.7;
      add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.95, 0.3), body)).position.y = 5.7;
      for (let i = 0; i < 3; i++) {
        const c = [0xff5470, 0xffb347, 0x5affa8][i];
        const l = new THREE.Mesh(new THREE.CircleGeometry(0.1, 10), lit(c));
        l.position.set(0, 6.05 - i * 0.29, 0.16);
        g.add(l);
        if (i === 0) glow.push(l);
      }
      hit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 5.7;
      g.add(hit);
      break;
    }
    case 'power': {
      add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.9, 0.45), body)).position.y = 0.95;
      hit = face(new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.5), lit(0xffb347)));
      hit.position.set(0, 0.98, 0.23);
      for (let i = 0; i < 5; i++) {
        const sw = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.05), dark);
        sw.position.set(-0.3 + (i % 3) * 0.3, 1.3 - Math.floor(i / 3) * 0.4, 0.25);
        g.add(sw);
      }
      break;
    }
    case 'door': {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.3, 0.14), body)).position.set(-0.7, 1.15, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.3, 0.14), body)).position.set(0.7, 1.15, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 0.14), body)).position.set(0, 2.3, 0);
      hit = face(new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.2), lit(0x7fdcff)));
      (hit.material as THREE.MeshBasicMaterial).transparent = true;
      (hit.material as THREE.MeshBasicMaterial).opacity = 0.28;
      hit.position.set(0, 1.15, 0);
      break;
    }
    case 'printer': {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.5), body)).position.y = 0.21;
      add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.3), dark)).position.set(0, 0.44, 0.05);
      hit = face(new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.07), lit(0x8fe9ff)));
      hit.position.set(0.18, 0.36, 0.26);
      break;
    }
    case 'screen': {
      add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.1, 0.08), body)).position.y = 0.55;
      hit = face(new THREE.Mesh(new THREE.PlaneGeometry(1.78, 1.0), lit(0x9fe8ff)));
      hit.position.set(0, 0.55, 0.05);
      break;
    }
    case 'box': {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.24), body)).position.y = 0.35;
      hit = face(new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.56), lit(0x7dffc4)));
      hit.position.set(0, 0.35, 0.13);
      for (let i = 0; i < 4; i++) {
        const led = new THREE.Mesh(new THREE.CircleGeometry(0.022, 6), lit(0x5affa8));
        led.position.set(-0.13 + i * 0.09, 0.56, 0.135);
        g.add(led);
      }
      break;
    }
    case 'car': {
      add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), body)).position.y = 0.72;
      add(new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.55, 2.0), dark)).position.set(0, 1.28, -0.2);
      for (const [wx, wz] of [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]] as const) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.22, 10), dark);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, 0.36, wz);
        g.add(w);
      }
      hit = face(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.24), lit(0xfff0c0)));
      hit.position.set(0, 0.78, 2.21);
      break;
    }
    default: {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), body)).position.y = 0.17;
      hit = face(new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), lit()));
      hit.position.set(0, 0.17, 0.18);
      break;
    }
  }

  hit.userData.pickable = true;
  return { group: g, glowParts: glow, hit };
}
