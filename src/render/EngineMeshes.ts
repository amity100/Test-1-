import * as THREE from 'three';
import { PRIM } from './PartBuilder';
import type { EngineSystem, Engine } from '../sim/Engines';

interface EngineView {
  root: THREE.Group;
  head: THREE.Group;
  arm: THREE.Object3D | null;
  string: THREE.Object3D[];
  dead: boolean;
}

/**
 * Siege engine models: a ballista on a post that turns and pitches with its aim, and a catapult whose
 * throwing arm slams forward on a shot and cranks back over the reload. Timber, iron and a banner in
 * the crew's colour.
 */
export class EngineMeshes {
  readonly group = new THREE.Group();
  private views = new Map<number, EngineView>();
  private wood = new THREE.MeshStandardMaterial({ color: 0x7a5230, metalness: 0, roughness: 0.95 });
  private woodDark = new THREE.MeshStandardMaterial({ color: 0x4e3218, metalness: 0, roughness: 0.95 });
  private iron = new THREE.MeshStandardMaterial({ color: 0x2f333a, metalness: 0.75, roughness: 0.5 });
  private steel = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.9, roughness: 0.35 });
  private rope = new THREE.MeshStandardMaterial({ color: 0x9c8a5c, metalness: 0, roughness: 1 });
  private stone = new THREE.MeshStandardMaterial({ color: 0x6f6a62, metalness: 0, roughness: 1 });
  private banners = new Map<string, THREE.MeshStandardMaterial>();

  constructor(
    private engines: EngineSystem,
    private teamColor: (team: number) => string,
  ) {
    this.group.name = 'engines';
  }

  private banner(team: number): THREE.MeshStandardMaterial {
    const hex = this.teamColor(team);
    let m = this.banners.get(hex);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).multiplyScalar(0.8), emissive: new THREE.Color(hex), emissiveIntensity: 0.35, roughness: 0.9, side: THREE.DoubleSide });
      this.banners.set(hex, m);
    }
    return m;
  }

  private mesh(geo: THREE.BufferGeometry, mat: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    return m;
  }

  private build(e: Engine): EngineView {
    const root = new THREE.Group();
    root.position.copy(e.pos);
    const head = new THREE.Group();
    const view: EngineView = { root, head, arm: null, string: [], dead: false };
    const banner = this.banner(e.team);
    if (e.kind === 'ballista') {
      // Base: two skids, a cross beam and a stout post with iron bands.
      root.add(this.mesh(PRIM.box, this.wood, 1.7, 0.14, 0.22, 0, 0.07, 0.45));
      root.add(this.mesh(PRIM.box, this.wood, 1.7, 0.14, 0.22, 0, 0.07, -0.45));
      root.add(this.mesh(PRIM.box, this.wood, 0.24, 0.14, 1.0, 0, 0.14, 0));
      root.add(this.mesh(PRIM.cyl12, this.woodDark, 0.24, 1.15, 0.24, 0, 0.72, 0));
      root.add(this.mesh(PRIM.cyl12, this.iron, 0.27, 0.06, 0.27, 0, 0.45, 0));
      root.add(this.mesh(PRIM.cyl12, this.iron, 0.27, 0.06, 0.27, 0, 1.2, 0));
      // Banner on the post.
      root.add(this.mesh(PRIM.box, banner, 0.03, 0.55, 0.36, 0.13, 0.85, 0));
      // Head: the stock with its groove, the bow arms, the string and a loaded bolt.
      head.position.y = 1.3;
      head.add(this.mesh(PRIM.box, this.wood, 0.16, 0.14, 1.9, 0, 0, -0.25));
      head.add(this.mesh(PRIM.box, this.iron, 0.2, 0.06, 0.3, 0, -0.06, -1.05));
      for (const sx of [-1, 1]) {
        head.add(this.mesh(PRIM.box, this.steel, 0.9, 0.06, 0.08, sx * 0.5, 0.02, -1.0, 0, sx * 0.28, 0));
        const str = this.mesh(PRIM.box, this.rope, 0.02, 0.02, 1.0, sx * 0.45, 0.06, -0.55, 0, sx * 0.55, 0);
        head.add(str);
        view.string.push(str);
      }
      head.add(this.mesh(PRIM.cyl8, this.wood, 0.05, 1.3, 0.05, 0, 0.1, -0.5, Math.PI / 2, 0, 0));
      head.add(this.mesh(PRIM.cone, this.iron, 0.07, 0.2, 0.07, 0, 0.1, -1.22, -Math.PI / 2, 0, 0));
      head.add(this.mesh(PRIM.box, this.iron, 0.08, 0.16, 0.12, 0, -0.1, 0.4));
      root.add(head);
    } else {
      // Catapult: a heavy frame on four wheels, two uprights with a padded crossbar, and the throwing arm.
      for (const sx of [-1, 1]) {
        root.add(this.mesh(PRIM.box, this.wood, 0.18, 0.22, 2.6, sx * 0.62, 0.32, 0.1));
        root.add(this.mesh(PRIM.box, this.wood, 0.16, 1.3, 0.18, sx * 0.62, 0.95, -0.5));
        for (const z of [-0.9, 1.0]) root.add(this.mesh(PRIM.cyl12, this.woodDark, 0.5, 0.12, 0.5, sx * 0.76, 0.25, z, 0, 0, Math.PI / 2));
      }
      for (const z of [-0.9, 0.2, 1.1]) root.add(this.mesh(PRIM.box, this.wood, 1.42, 0.14, 0.16, 0, 0.32, z));
      root.add(this.mesh(PRIM.box, this.wood, 1.5, 0.18, 0.2, 0, 1.6, -0.5));
      root.add(this.mesh(PRIM.box, this.rope, 1.3, 0.24, 0.26, 0, 1.6, -0.5));
      // Windlass and rope bundle at the back, banner on an upright.
      root.add(this.mesh(PRIM.cyl8, this.woodDark, 0.16, 1.5, 0.16, 0, 0.6, 1.1, 0, 0, Math.PI / 2));
      root.add(this.mesh(PRIM.cyl12, this.rope, 0.6, 0.9, 0.6, 0, 0.55, 0.3, 0, 0, Math.PI / 2));
      root.add(this.mesh(PRIM.box, banner, 0.03, 0.5, 0.4, -0.72, 1.15, -0.5));
      // The arm pivots at the frame's middle: its bucket lies low behind when cocked and slams forward on a shot.
      const pivot = new THREE.Group();
      pivot.position.set(0, 0.55, 0.3);
      pivot.add(this.mesh(PRIM.box, this.wood, 0.14, 0.14, 2.3, 0, 0, 1.0));
      pivot.add(this.mesh(PRIM.hemi, this.iron, 0.6, 0.36, 0.6, 0, 0.08, 2.05));
      pivot.add(this.mesh(PRIM.sphereLo, this.stone, 0.42, 0.42, 0.42, 0, 0.3, 2.05));
      pivot.rotation.x = -1.15;
      root.add(pivot);
      view.arm = pivot;
    }
    root.rotation.y = e.yaw;
    return view;
  }

  update(dt: number): void {
    void dt;
    const live = new Set<number>();
    for (const e of this.engines.engines) {
      live.add(e.id);
      let v = this.views.get(e.id);
      if (!v) {
        v = this.build(e);
        this.group.add(v.root);
        this.views.set(e.id, v);
      }
      v.root.rotation.y = e.yaw;
      if (e.kind === 'ballista') {
        v.head.rotation.x = e.pitch;
        // The string snaps forward on a shot and is drawn back over the reload.
        const k = e.anim;
        for (const s of v.string) s.position.z = -0.55 - (1 - k) * 0.0 - k * 0.35;
      } else if (v.arm) {
        const k = e.anim;
        v.arm.rotation.x = k > 0.6 ? THREE.MathUtils.lerp(0.55, -1.15, (k - 0.6) / 0.4) : THREE.MathUtils.lerp(-1.15, 0.55, k / 0.6) * (k > 0 ? 1 : 0) + (k > 0 ? 0 : -1.15) * 0;
        if (k <= 0) v.arm.rotation.x = -1.15;
      }
      if (e.dead && !v.dead) {
        v.dead = true;
        v.root.rotation.z = 0.32;
        v.root.scale.y = 0.75;
        v.root.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = this.woodDark;
        });
      }
    }
    for (const [id, v] of this.views) {
      if (!live.has(id)) {
        this.group.remove(v.root);
        this.views.delete(id);
      }
    }
  }
}
