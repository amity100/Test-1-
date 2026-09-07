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
  /** Pendulum pivot, crusher block and chains, saw blade carriage. */
  pivot?: THREE.Group;
  block?: THREE.Group;
  chains?: THREE.Mesh[];
  carriage?: THREE.Group;
  spinner?: THREE.Mesh;
  state: string;
  flicker: number;
}

/**
 * Renders traps. Spikes rise out of a floor plate when they fire, flame vents throw up a column of
 * fire, spring pads pop, trapdoor leaves fold down, mines blink, saw blades run their rail, blades
 * swing from doorway lintels, crushers hang from the ceiling and slam, turrets track their target,
 * gates are bars in the builder's colour. Hidden traps are drawn only for their builder until they fire.
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
  private flameMat = new THREE.MeshStandardMaterial({ color: 0xff5a00, emissive: 0xff7a1a, emissiveIntensity: 2.6, transparent: true, opacity: 0.85, depthWrite: false, roughness: 1 });
  private flameCore = new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffd36a, emissiveIntensity: 3, transparent: true, opacity: 0.9, depthWrite: false, roughness: 1 });
  private ventMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, metalness: 0.6, roughness: 0.5, emissive: 0xff5a00, emissiveIntensity: 0 });
  private padMat = new THREE.MeshStandardMaterial({ color: 0x3f5a3f, metalness: 0.4, roughness: 0.6 });
  private coilMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.8, roughness: 0.35 });
  private steelMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.9, roughness: 0.3 });
  private ironMat = new THREE.MeshStandardMaterial({ color: 0x2a2e35, metalness: 0.75, roughness: 0.45 });
  private railMat = new THREE.MeshStandardMaterial({ color: 0x555c66, metalness: 0.8, roughness: 0.4 });
  private warnMat = new THREE.MeshStandardMaterial({ color: 0xffb300, emissive: 0xffb300, emissiveIntensity: 1.5 });
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

  private mesh(geo: THREE.BufferGeometry, mat: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number, shadow = false): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    return m;
  }

  private build(t: Trap): TrapView {
    const root = new THREE.Group();
    const c = t.cell;
    const view: TrapView = { root, moving: [], state: '', flicker: Math.random() * 10 };
    switch (t.kind) {
      case 'spikes': {
        root.position.set(c.x + 0.5, c.y, c.z + 0.5);
        root.add(this.mesh(PRIM.box, this.plateMat, 0.96, 0.05, 0.96, 0, 0.025, 0));
        for (let i = 0; i < 3; i++)
          for (let j = 0; j < 3; j++) {
            const s = this.mesh(PRIM.cone, this.spikeMat, 0.14, 0.55, 0.14, -0.3 + i * 0.3, -0.3, -0.3 + j * 0.3);
            root.add(s);
            view.moving.push(s);
          }
        break;
      }
      case 'flame': {
        root.position.set(c.x + 0.5, c.y, c.z + 0.5);
        root.add(this.mesh(PRIM.box, this.plateMat, 0.96, 0.05, 0.96, 0, 0.025, 0));
        // A round vent with a grille.
        const vent = this.mesh(PRIM.cyl12, this.ventMat.clone(), 0.62, 0.08, 0.62, 0, 0.06, 0);
        root.add(vent);
        view.led = vent;
        for (let i = -1; i <= 1; i++) root.add(this.mesh(PRIM.box, this.plateMat, 0.5, 0.03, 0.06, 0, 0.11, i * 0.16));
        // Flames: an outer tongue, a core and two side licks; heights animate.
        for (const [dx, dz, w, mat] of [
          [0, 0, 0.55, this.flameMat],
          [0, 0, 0.3, this.flameCore],
          [0.22, 0.12, 0.3, this.flameMat],
          [-0.2, -0.16, 0.26, this.flameMat],
        ] as [number, number, number, THREE.Material][]) {
          const f = this.mesh(PRIM.cone, mat, w, 0.001, w, dx, 0.1, dz);
          root.add(f);
          view.moving.push(f);
        }
        break;
      }
      case 'launcher': {
        root.position.set(c.x + 0.5, c.y, c.z + 0.5);
        root.add(this.mesh(PRIM.cyl12, this.plateMat, 0.9, 0.08, 0.9, 0, 0.04, 0));
        const coil = this.mesh(PRIM.torusThin, this.coilMat, 0.6, 0.6, 0.6, 0, 0.14, 0);
        coil.rotation.x = Math.PI / 2;
        root.add(coil);
        const pad = this.mesh(PRIM.cyl12, this.padMat, 0.8, 0.08, 0.8, 0, 0.2, 0);
        root.add(pad);
        view.moving.push(pad, coil);
        break;
      }
      case 'trapdoor': {
        root.position.set(c.x + 1, c.y, c.z + 1);
        for (const [sx, sz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
          const pivot = new THREE.Group();
          pivot.position.set(sx * 2 - Math.sign(sx) * 1, 0.02, sz);
          pivot.add(this.mesh(PRIM.box, this.leafMat, 0.98, 0.05, 0.98, Math.sign(sx) * 0.5, 0, 0));
          root.add(pivot);
          view.moving.push(pivot);
        }
        break;
      }
      case 'mine': {
        root.position.set(c.x + 0.5, c.y, c.z + 0.5);
        root.add(this.mesh(PRIM.cyl12, this.mineMat, 0.42, 0.1, 0.42, 0, 0.05, 0));
        const led = this.mesh(PRIM.sphereLo, this.ledMat, 0.08, 0.08, 0.08, 0, 0.13, 0);
        root.add(led);
        view.led = led;
        break;
      }
      case 'saw': {
        // Rail along the run, a carriage with a spinning octagonal blade.
        const a = t.cells[0];
        const b = t.cells[t.cells.length - 1];
        const along = t.axis === 0;
        const len = t.cells.length;
        const rail = this.mesh(PRIM.box, this.railMat, along ? len - 0.1 : 0.22, 0.06, along ? 0.22 : len - 0.1, (a.x + b.x + 1) / 2, c.y + 0.03, (a.z + b.z + 1) / 2);
        root.add(rail);
        for (const g of t.cells) root.add(this.mesh(PRIM.box, this.ironMat, along ? 0.12 : 0.5, 0.1, along ? 0.5 : 0.12, g.x + 0.5, c.y + 0.05, g.z + 0.5));
        const carriage = new THREE.Group();
        carriage.add(this.mesh(PRIM.box, this.ironMat, 0.5, 0.16, 0.5, 0, 0.1, 0, true));
        const spin = new THREE.Group();
        spin.position.y = 0.45;
        if (along) spin.rotation.x = Math.PI / 2;
        else spin.rotation.z = Math.PI / 2;
        const blade = this.mesh(PRIM.cyl8, this.steelMat, 1.2, 0.08, 1.2, 0, 0, 0, true);
        spin.add(blade);
        spin.add(this.mesh(PRIM.cyl12, this.ironMat, 0.4, 0.12, 0.4, 0, 0, 0));
        carriage.add(spin);
        root.add(carriage);
        view.carriage = carriage;
        view.spinner = blade;
        break;
      }
      case 'pendulum': {
        const { pivot: pv, length } = this.traps.bladePose(t);
        const pivot = new THREE.Group();
        pivot.position.copy(pv);
        const along = t.axis === 0;
        // Bracket in the lintel, rod, then the blade (a wide flat head with a bright edge).
        root.add(this.mesh(PRIM.box, this.ironMat, along ? 0.9 : 0.3, 0.16, along ? 0.3 : 0.9, pv.x, pv.y + 0.02, pv.z));
        pivot.add(this.mesh(PRIM.cyl8, this.ironMat, 0.1, length - 0.5, 0.1, 0, -(length - 0.5) / 2, 0));
        const head = this.mesh(PRIM.box, this.ironMat, along ? 1.0 : 0.16, 0.5, along ? 0.16 : 1.0, 0, -(length - 0.3), 0, true);
        pivot.add(head);
        const edge = this.mesh(PRIM.box, this.steelMat, along ? 1.08 : 0.1, 0.12, along ? 0.1 : 1.08, 0, -(length - 0.06), 0);
        pivot.add(edge);
        root.add(pivot);
        view.pivot = pivot;
        break;
      }
      case 'crusher': {
        root.position.set(c.x + 1, c.y, c.z + 1);
        const block = new THREE.Group();
        block.add(this.mesh(PRIM.box, this.ironMat, 1.9, 0.7, 1.9, 0, 0.35, 0, true));
        block.add(this.mesh(PRIM.box, this.warnMat, 1.94, 0.08, 1.94, 0, 0.5, 0));
        for (let i = 0; i < 3; i++)
          for (let j = 0; j < 3; j++) {
            const s = this.mesh(PRIM.cone, this.steelMat, 0.2, 0.3, 0.2, -0.6 + i * 0.6, -0.15, -0.6 + j * 0.6);
            s.rotation.x = Math.PI;
            block.add(s);
          }
        root.add(block);
        view.block = block;
        view.chains = [];
        for (const [sx, sz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
          const ch = this.mesh(PRIM.cyl6, this.railMat, 0.08, 1, 0.08, sx, 0, sz);
          root.add(ch);
          view.chains.push(ch);
        }
        break;
      }
      case 'turret': {
        root.position.set(c.x + 0.5, c.y, c.z + 0.5);
        root.add(this.mesh(PRIM.cyl12, this.turretMat, 0.62, 0.22, 0.62, 0, 0.11, 0, true));
        root.add(this.mesh(PRIM.cyl8, this.turretMat, 0.16, 0.5, 0.16, 0, 0.45, 0));
        const head = new THREE.Group();
        head.position.y = 0.78;
        head.add(this.mesh(PRIM.box, this.turretMat, 0.42, 0.3, 0.5, 0, 0, 0, true));
        head.add(this.mesh(PRIM.sphereLo, this.turretAccent, 0.12, 0.12, 0.12, 0, 0.08, -0.26));
        const barrel = this.mesh(PRIM.cyl8, this.turretMat, 0.1, 0.6, 0.1, 0.12, -0.04, -0.5);
        barrel.rotation.x = Math.PI / 2;
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
            const off = -0.36 + i * 0.24;
            root.add(this.mesh(PRIM.cyl8, mat, 0.07, 2, 0.07, cx + (along === 'x' ? off : 0), g.y + 1, cz + (along === 'z' ? off : 0), true));
          }
          for (const y of [0.15, 1.05, 1.9]) root.add(this.mesh(PRIM.box, mat, along === 'x' ? 1 : 0.1, 0.08, along === 'z' ? 1 : 0.1, cx, g.y + y, cz));
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
        case 'flame': {
          const on = t.state === 'triggered';
          v.flicker += dt * 9;
          v.moving.forEach((f, i) => {
            const base = on ? (i === 1 ? 1.3 : 1.9) + Math.sin(v.flicker * (1.3 + i * 0.4) + i) * 0.35 : 0.001;
            const h = f.scale.y + (base - f.scale.y) * Math.min(1, dt * (on ? 16 : 8));
            f.scale.y = Math.max(0.001, h);
            f.position.y = 0.1 + h / 2;
            f.rotation.y += dt * (2 + i);
          });
          if (v.led) (v.led.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 1.6 : t.stage === 'cool' ? 0.5 : mine ? 0.15 : 0;
          break;
        }
        case 'launcher': {
          const pop = t.anim;
          v.moving[0].position.y = 0.2 + pop * 0.45;
          v.moving[1].scale.y = 0.6 + pop * 3;
          v.moving[1].position.y = 0.14 + pop * 0.2;
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
        case 'saw': {
          if (v.carriage) {
            const p = this.traps.sawPos(t);
            v.carriage.position.set(p.x, t.cell.y, p.z);
          }
          if (v.spinner) v.spinner.rotation.y += dt * 22;
          break;
        }
        case 'pendulum': {
          if (v.pivot) {
            if (t.axis === 0) v.pivot.rotation.z = t.anim;
            else v.pivot.rotation.x = -t.anim;
          }
          break;
        }
        case 'crusher': {
          if (v.block && v.chains) {
            const gap = Math.max(3, t.span);
            const travel = gap - 0.75;
            let y = 0.05 + t.anim * travel;
            if (t.stage === 'warn') {
              y += Math.sin(time * 70) * 0.05;
              v.block.position.x = Math.sin(time * 90) * 0.04;
              v.block.position.z = Math.cos(time * 75) * 0.04;
            } else {
              v.block.position.x = 0;
              v.block.position.z = 0;
            }
            v.block.position.y = y;
            const top = y + 0.7;
            const len = Math.max(0.05, gap - top);
            for (const ch of v.chains) {
              ch.scale.y = len;
              ch.position.y = top + len / 2;
            }
          }
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
