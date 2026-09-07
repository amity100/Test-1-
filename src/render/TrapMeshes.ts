import * as THREE from 'three';
import type { TrapSystem, Trap } from '../sim/Traps';
import { PRIM } from './PartBuilder';

interface TrapView {
  root: THREE.Group;
  /** Parts animated per frame. */
  moving: THREE.Object3D[];
  led?: THREE.Mesh;
  head?: THREE.Group;
  barrel?: THREE.Mesh;
  state: string;
}

/**
 * Renders traps. Spikes rise out of a floor plate when they fire, trapdoor leaves fold down, mines
 * blink, turrets track their target and tilt when dead, gates are bars in the builder's colour that
 * shatter when shot open. Hidden traps are drawn only for their builder until they fire.
 */
export class TrapMeshes {
  readonly group = new THREE.Group();
  private views = new Map<number, TrapView>();
  private plateMat = new THREE.MeshStandardMaterial({ color: 0x30343b, metalness: 0.55, roughness: 0.55 });
  private spikeMat = new THREE.MeshStandardMaterial({ color: 0xb9c2cc, metalness: 0.85, roughness: 0.3 });
  private leafMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, metalness: 0.1, roughness: 0.85 });
  private mineMat = new THREE.MeshStandardMaterial({ color: 0x2f3a2f, metalness: 0.5, roughness: 0.6 });
  private ledMat = new THREE.MeshStandardMaterial({ color: 0xff2030, emissive: 0xff2030, emissiveIntensity: 2 });
  private turretMat = new THREE.MeshStandardMaterial({ color: 0x1c2128, metalness: 0.7, roughness: 0.4 });
  private turretAccent = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.2, roughness: 0.4 });
  private deadMat = new THREE.MeshStandardMaterial({ color: 0x0f1113, metalness: 0.2, roughness: 1 });
  private gateMats = new Map<string, THREE.MeshStandardMaterial>();

  constructor(private traps: TrapSystem, private ownerColor: (plotIndex: number) => string) {
    this.group.name = 'traps';
  }

  private gateMat(plotIndex: number): THREE.MeshStandardMaterial {
    const hex = this.ownerColor(plotIndex);
    let m = this.gateMats.get(hex);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).multiplyScalar(0.55), emissive: new THREE.Color(hex), emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.35 });
      this.gateMats.set(hex, m);
    }
    return m;
  }

  private build(t: Trap): TrapView {
    const root = new THREE.Group();
    const c = t.cell;
    const view: TrapView = { root, moving: [], state: '' };
    switch (t.kind) {
      case 'spikes': {
        root.position.set(c.x + 0.5, c.y, c.z + 0.5);
        const plate = new THREE.Mesh(PRIM.box, this.plateMat);
        plate.scale.set(0.96, 0.05, 0.96);
        plate.position.y = 0.025;
        root.add(plate);
        for (let i = 0; i < 3; i++)
          for (let j = 0; j < 3; j++) {
            const s = new THREE.Mesh(PRIM.cone, this.spikeMat);
            s.scale.set(0.14, 0.55, 0.14);
            s.position.set(-0.3 + i * 0.3, -0.3, -0.3 + j * 0.3);
            root.add(s);
            view.moving.push(s);
          }
        break;
      }
      case 'trapdoor': {
        root.position.set(c.x + 1, c.y, c.z + 1);
        for (const [sx, sz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
          const pivot = new THREE.Group();
          pivot.position.set(sx * 2 - Math.sign(sx) * 1, 0.02, sz);
          const leaf = new THREE.Mesh(PRIM.box, this.leafMat);
          leaf.scale.set(0.98, 0.05, 0.98);
          leaf.position.x = Math.sign(sx) * 0.5;
          pivot.add(leaf);
          root.add(pivot);
          view.moving.push(pivot);
        }
        break;
      }
      case 'mine': {
        root.position.set(c.x + 0.5, c.y, c.z + 0.5);
        const body = new THREE.Mesh(PRIM.cyl12, this.mineMat);
        body.scale.set(0.42, 0.1, 0.42);
        body.position.y = 0.05;
        root.add(body);
        const led = new THREE.Mesh(PRIM.sphereLo, this.ledMat);
        led.scale.setScalar(0.08);
        led.position.y = 0.13;
        root.add(led);
        view.led = led;
        break;
      }
      case 'turret': {
        root.position.set(c.x + 0.5, c.y, c.z + 0.5);
        const base = new THREE.Mesh(PRIM.cyl12, this.turretMat);
        base.scale.set(0.62, 0.22, 0.62);
        base.position.y = 0.11;
        base.castShadow = true;
        root.add(base);
        const post = new THREE.Mesh(PRIM.cyl8, this.turretMat);
        post.scale.set(0.16, 0.5, 0.16);
        post.position.y = 0.45;
        root.add(post);
        const head = new THREE.Group();
        head.position.y = 0.78;
        const box = new THREE.Mesh(PRIM.box, this.turretMat);
        box.scale.set(0.42, 0.3, 0.5);
        box.castShadow = true;
        head.add(box);
        const eye = new THREE.Mesh(PRIM.sphereLo, this.turretAccent);
        eye.scale.setScalar(0.12);
        eye.position.set(0, 0.08, -0.26);
        head.add(eye);
        const barrel = new THREE.Mesh(PRIM.cyl8, this.turretMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.scale.set(0.1, 0.6, 0.1);
        barrel.position.set(0.12, -0.04, -0.5);
        head.add(barrel);
        root.add(head);
        view.head = head;
        view.barrel = barrel;
        break;
      }
      case 'gate': {
        // Bars across the whole doorway span, in the builder's colour.
        const mat = this.gateMat(t.plotIndex);
        const along = t.axis === 0 ? 'x' : 'z';
        for (const g of t.cells) {
          const cx = g.x + 0.5;
          const cz = g.z + 0.5;
          for (let i = 0; i < 4; i++) {
            const bar = new THREE.Mesh(PRIM.cyl8, mat);
            bar.scale.set(0.07, 2, 0.07);
            const off = -0.36 + i * 0.24;
            bar.position.set(cx + (along === 'x' ? off : 0), g.y + 1, cz + (along === 'z' ? off : 0));
            bar.castShadow = true;
            root.add(bar);
          }
          for (const y of [0.15, 1.05, 1.9]) {
            const rail = new THREE.Mesh(PRIM.box, mat);
            rail.scale.set(along === 'x' ? 1 : 0.1, 0.08, along === 'z' ? 1 : 0.1);
            rail.position.set(cx, g.y + y, cz);
            root.add(rail);
          }
        }
        break;
      }
    }
    this.group.add(root);
    return view;
  }

  /** viewerPlot: the local player's plot; their own traps are always drawn. */
  update(dt: number, time: number, viewerPlot: number): void {
    const live = new Set<number>();
    for (const t of this.traps.traps) {
      live.add(t.id);
      let v = this.views.get(t.id);
      if (!v) {
        v = this.build(t);
        this.views.set(t.id, v);
      }
      const mine = t.plotIndex === viewerPlot;
      v.root.visible = mine || t.revealed;
      switch (t.kind) {
        case 'spikes': {
          const up = t.state === 'triggered' ? 0.34 : mine ? -0.22 : -0.3;
          for (const s of v.moving) s.position.y += (up - s.position.y) * Math.min(1, dt * 14);
          break;
        }
        case 'trapdoor': {
          const open = t.state === 'triggered';
          v.moving.forEach((p, i) => {
            const sign = i % 2 === 0 ? -1 : 1;
            const want = open ? sign * -1.45 : 0;
            p.rotation.z += (want - p.rotation.z) * Math.min(1, dt * 10);
          });
          break;
        }
        case 'mine': {
          if (v.led) v.led.visible = t.state !== 'dead' && Math.sin(time * 6) > 0.6;
          v.root.visible = v.root.visible && t.state !== 'dead';
          break;
        }
        case 'turret': {
          if (v.head) {
            v.head.rotation.y = t.yaw;
            v.head.rotation.x = -t.pitch;
            if (t.state === 'dead' && v.state !== 'dead') {
              v.root.traverse((o) => {
                if (o instanceof THREE.Mesh) o.material = this.deadMat;
              });
              v.head.rotation.x = 0.6;
              v.state = 'dead';
            }
          }
          break;
        }
        case 'gate': {
          v.root.visible = t.state !== 'dead';
          break;
        }
      }
    }
    for (const [id, v] of this.views) {
      if (live.has(id)) continue;
      this.group.remove(v.root);
      this.views.delete(id);
    }
  }

  clear(): void {
    for (const v of this.views.values()) this.group.remove(v.root);
    this.views.clear();
  }
}
