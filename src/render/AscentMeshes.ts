import * as THREE from 'three';
import type { AscentState, BrickDrop } from '../sim/Ascent';
import { ASCENT } from '../sim/Ascent';
import type { Entity } from '../sim/Entities';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { Terrain } from '../world/Terrain';
import type { AimResult } from '../build/SkyBuild';
import { FlagMesh } from './FlagMesh';
import { PRIM } from './PartBuilder';
import { clamp, smoothstep } from '../core/MathUtil';

function glowSprite(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** A vertical beam: additive, fading toward the top, brighter at the base. */
function beamMaterial(color: THREE.Color, opacity: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color.clone() }, uOpacity: { value: opacity }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; uniform float uTime; varying vec2 vUv;
      void main() {
        float edge = sin(vUv.x * 3.14159);
        float fade = pow(1.0 - vUv.y, 1.6);
        float flicker = 0.85 + 0.15 * sin(uTime * 3.0 + vUv.y * 20.0);
        gl_FragColor = vec4(uColor, uOpacity * edge * fade * flicker);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

interface DropView {
  root: THREE.Group;
  cubes: THREE.InstancedMesh;
  halo: THREE.Sprite;
  seed: number;
}

/**
 * Everything Sky Flag shows that is not a block: the flag on its floating golden disc with rings and
 * a beam to the sky, the marked leader's column of light and crown, the brick clusters that hover
 * where the fallen were, and the translucent ghost of the piece about to be placed.
 */
export class AscentMeshes {
  readonly group = new THREE.Group();
  private flag: FlagMesh;
  private flagRoot = new THREE.Group();
  private disc: THREE.Mesh;
  private rings: THREE.Mesh[] = [];
  private flagBeam: THREE.Mesh;
  private flagBeamMat: THREE.ShaderMaterial;
  private flagLight: THREE.PointLight;
  private markBeam: THREE.Mesh;
  private markBeamMat: THREE.ShaderMaterial;
  private crown: THREE.Group;
  private marked: Entity | null = null;
  private drops = new Map<number, DropView>();
  private ghost: THREE.InstancedMesh;
  private ghostMat: THREE.MeshBasicMaterial;
  private ghostEdges: THREE.LineSegments;
  private brickGeo = new THREE.BoxGeometry(0.36, 0.22, 0.24);
  private glow: THREE.CanvasTexture;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  private flagVel = new THREE.Vector3();
  private shown = new THREE.Vector3(0, ASCENT.flagStartY, 0);

  constructor(
    private scene: THREE.Scene,
    private world: VoxelWorld,
    private terrain: Terrain,
  ) {
    void this.world;
    void this.terrain;
    this.group.name = 'ascent';
    this.glow = glowSprite();
    const gold = new THREE.Color(0xffd36a);
    // The flag itself: a big banner in gold.
    this.flag = new FlagMesh(gold);
    this.flag.group.scale.setScalar(1.8);
    this.flag.group.position.y = 0.35;
    this.flagRoot.add(this.flag.group);
    // Floating disc under it.
    const discMat = new THREE.MeshStandardMaterial({ color: 0xf1e7d0, metalness: 0.35, roughness: 0.4, emissive: 0x6a4a10, emissiveIntensity: 0.25 });
    this.disc = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 1.6, 0.5, 24), discMat);
    this.disc.castShadow = true;
    this.disc.position.y = 0.1;
    this.flagRoot.add(this.disc);
    const goldMat = new THREE.MeshStandardMaterial({ color: gold, metalness: 1, roughness: 0.25, emissive: gold, emissiveIntensity: 0.9 });
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2 + i * 0.9, 0.07, 10, 64), goldMat);
      ring.position.y = 1.6;
      this.rings.push(ring);
      this.flagRoot.add(ring);
    }
    this.flagBeamMat = beamMaterial(gold, 0.42);
    this.flagBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.8, 120, 20, 1, true), this.flagBeamMat);
    this.flagBeam.position.y = 60;
    this.flagBeam.frustumCulled = false;
    this.flagRoot.add(this.flagBeam);
    this.flagLight = new THREE.PointLight(gold, 30, 40, 1.6);
    this.flagLight.position.y = 4;
    this.flagRoot.add(this.flagLight);
    this.group.add(this.flagRoot);
    // The marked leader's column of light and a crown over their head.
    this.markBeamMat = beamMaterial(new THREE.Color(0xffffff), 0.3);
    this.markBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.1, 80, 16, 1, true), this.markBeamMat);
    this.markBeam.frustumCulled = false;
    this.markBeam.visible = false;
    this.group.add(this.markBeam);
    this.crown = new THREE.Group();
    const crownMat = new THREE.MeshStandardMaterial({ color: gold, metalness: 1, roughness: 0.3, emissive: gold, emissiveIntensity: 1.2 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 8, 24), crownMat);
    band.rotation.x = Math.PI / 2;
    this.crown.add(band);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(PRIM.cone, crownMat);
      spike.scale.set(0.16, 0.34, 0.16);
      spike.position.set(Math.cos(a) * 0.32, 0.18, Math.sin(a) * 0.32);
      this.crown.add(spike);
    }
    const crownHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: gold, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    crownHalo.scale.set(2.2, 2.2, 1);
    this.crown.add(crownHalo);
    this.crown.visible = false;
    this.group.add(this.crown);
    // Ghost piece.
    this.ghostMat = new THREE.MeshBasicMaterial({ color: 0x66ff99, transparent: true, opacity: 0.3, depthWrite: false });
    this.ghost = new THREE.InstancedMesh(new THREE.BoxGeometry(0.98, 0.98, 0.98), this.ghostMat, 220);
    this.ghost.count = 0;
    this.ghost.frustumCulled = false;
    this.group.add(this.ghost);
    this.ghostEdges = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
    this.ghostEdges.frustumCulled = false;
    this.group.add(this.ghostEdges);
    scene.add(this.group);
  }

  setMarked(e: Entity | null): void {
    this.marked = e;
    if (e) {
      const c = new THREE.Color(e.colorHex);
      (this.markBeamMat.uniforms.uColor.value as THREE.Color).copy(c);
    }
    this.markBeam.visible = !!e;
    this.crown.visible = !!e;
  }

  update(dt: number, time: number, asc: AscentState, entities: Entity[], viewer: Entity, aim: AimResult | null, camPos: THREE.Vector3): void {
    // The flag glides rather than snaps (the sim moves it in steps when it changes hands).
    const target = asc.flagPos;
    const k = Math.min(1, dt * (asc.flagHeld ? 14 : 4));
    this.shown.lerp(target, k);
    this.flagRoot.position.copy(this.shown);
    this.flagRoot.position.y += Math.sin(time * 1.3) * 0.25;
    const held = asc.flagHeld;
    this.disc.visible = !held;
    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i];
      r.visible = !held;
      r.rotation.x = time * (0.3 + i * 0.17) + i;
      r.rotation.y = time * (0.21 - i * 0.05);
    }
    this.flagBeamMat.uniforms.uTime.value = time;
    this.flagBeamMat.uniforms.uOpacity.value = held ? 0.22 : 0.42;
    this.flagLight.intensity = held ? 12 : 26 + Math.sin(time * 2.2) * 4;
    this.flag.setAlert(held);
    this.flag.update(dt, camPos, false);
    this.flagVel.copy(target).sub(this.shown);

    // The marked leader.
    const m = this.marked;
    if (m && m.alive) {
      this.markBeam.visible = true;
      this.crown.visible = true;
      this.markBeam.position.set(m.pos.x, m.pos.y + 40, m.pos.z);
      this.markBeamMat.uniforms.uTime.value = time;
      this.markBeamMat.uniforms.uOpacity.value = m === viewer ? 0.12 : 0.3;
      this.crown.position.set(m.pos.x, m.pos.y + m.height + 0.55 + Math.sin(time * 2) * 0.06, m.pos.z);
      this.crown.rotation.y = time * 0.8;
      this.crown.visible = m !== viewer;
    } else {
      this.markBeam.visible = false;
      this.crown.visible = false;
    }

    this.syncDrops(asc.drops, time);
    this.syncGhost(aim);
    void entities;
  }

  private syncDrops(drops: BrickDrop[], time: number): void {
    const live = new Set<number>();
    for (const d of drops) {
      if (d.dead) continue;
      live.add(d.id);
      let v = this.drops.get(d.id);
      if (!v) {
        const root = new THREE.Group();
        const n = Math.min(9, 3 + Math.floor(d.count / 3));
        const c = new THREE.Color(d.colorHex);
        const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0xf1e7d0), metalness: 0.2, roughness: 0.5, emissive: c, emissiveIntensity: 0.9 });
        const cubes = new THREE.InstancedMesh(this.brickGeo, mat, n);
        cubes.castShadow = true;
        root.add(cubes);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: c, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
        halo.scale.set(3.2, 3.2, 1);
        root.add(halo);
        this.group.add(root);
        v = { root, cubes, halo, seed: d.id * 1.7 };
        this.drops.set(d.id, v);
      }
      v.root.position.copy(d.pos);
      const n = v.cubes.count;
      const spin = time * (d.falling ? 3 : 0.9) + v.seed;
      for (let i = 0; i < n; i++) {
        const a = spin + (i / n) * Math.PI * 2;
        const r = d.falling ? 0.25 : 0.55 + 0.1 * Math.sin(time * 2 + i);
        this.p.set(Math.cos(a) * r, Math.sin(time * 2.6 + i * 1.3) * 0.18 + (i % 3) * 0.12 - 0.15, Math.sin(a) * r);
        this.q.setFromEuler(new THREE.Euler(spin * 0.3 + i, a, i * 0.4));
        this.s.setScalar(1);
        this.m.compose(this.p, this.q, this.s);
        v.cubes.setMatrixAt(i, this.m);
      }
      v.cubes.instanceMatrix.needsUpdate = true;
      const urgency = !d.falling && d.hover < 3 ? 0.5 + 0.5 * Math.abs(Math.sin(time * 9)) : 1;
      (v.halo.material as THREE.SpriteMaterial).opacity = (0.35 + 0.15 * Math.sin(time * 3)) * urgency;
      v.halo.scale.setScalar(2.6 + Math.min(d.count, 24) * 0.06);
    }
    for (const [id, v] of this.drops) {
      if (live.has(id)) continue;
      this.group.remove(v.root);
      (v.cubes.material as THREE.Material).dispose();
      (v.halo.material as THREE.SpriteMaterial).dispose();
      this.drops.delete(id);
    }
  }

  private syncGhost(aim: AimResult | null): void {
    const stamp = aim?.stamp ?? null;
    if (!stamp) {
      this.ghost.count = 0;
      this.ghostEdges.visible = false;
      this.ghost.visible = false;
      return;
    }
    const ok = aim!.reason === 'ok';
    this.ghostMat.color.set(ok ? 0x6dffb0 : aim!.reason === 'bricks' ? 0xffd36a : 0xff5a6a);
    this.ghostMat.opacity = ok ? 0.28 : 0.22;
    const cells = stamp.cells;
    const n = Math.min(cells.length, 220);
    this.ghost.count = n;
    this.ghost.visible = true;
    this.q.identity();
    this.s.setScalar(1);
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < n; i++) {
      const c = cells[i];
      this.p.set(c.x + 0.5, c.y + 0.5, c.z + 0.5);
      this.m.compose(this.p, this.q, this.s);
      this.ghost.setMatrixAt(i, this.m);
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.z < minZ) minZ = c.z;
      if (c.x + 1 > maxX) maxX = c.x + 1;
      if (c.y + 1 > maxY) maxY = c.y + 1;
      if (c.z + 1 > maxZ) maxZ = c.z + 1;
    }
    this.ghost.instanceMatrix.needsUpdate = true;
    // Bounding box outline.
    const pts: number[] = [];
    const corner = (x: number, y: number, z: number): number[] => [x ? maxX : minX, y ? maxY : minY, z ? maxZ : minZ];
    const edges: [number, number, number][][] = [];
    for (const y of [0, 1]) {
      edges.push([[0, y, 0], [1, y, 0]], [[1, y, 0], [1, y, 1]], [[1, y, 1], [0, y, 1]], [[0, y, 1], [0, y, 0]]);
    }
    for (const x of [0, 1]) for (const z of [0, 1]) edges.push([[x, 0, z], [x, 1, z]]);
    for (const [a, b] of edges) pts.push(...corner(a[0], a[1], a[2]), ...corner(b[0], b[1], b[2]));
    this.ghostEdges.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    (this.ghostEdges.material as THREE.LineBasicMaterial).color.set(ok ? 0xbfffd8 : 0xffc0c8);
    this.ghostEdges.visible = true;
  }

  /** Distance-based reveal of the flag for HUD/sound use. */
  flagNear(camPos: THREE.Vector3): number {
    return smoothstep(30, 6, camPos.distanceTo(this.flagRoot.position));
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.flag.dispose();
    for (const v of this.drops.values()) {
      (v.cubes.material as THREE.Material).dispose();
      (v.halo.material as THREE.SpriteMaterial).dispose();
    }
    this.drops.clear();
    this.ghost.geometry.dispose();
    this.ghostMat.dispose();
    this.ghostEdges.geometry.dispose();
    this.brickGeo.dispose();
    this.glow.dispose();
    void clamp;
  }
}
