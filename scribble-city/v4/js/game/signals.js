import * as THREE from 'three';
import { makeSurface, srgb } from '../render/materials.js';
import { NODES, lightAt } from '../world/roads.js';

// The traffic lights' lit lenses. The heads are built dark into the city (world/streets.js); the
// one lens of each that is on - red, amber or green, by the same clock the cars and the people
// wait by (game/traffic.js) - glows here, on the lights near the camera.

const COLOR = { r: [3.4, 0.28, 0.22], y: [3.2, 1.9, 0.22], g: [0.3, 3.0, 0.95] };
const ROW = { r: 0, y: 1, g: 2 }; // a head's lenses top to bottom
const NEAR = 170;
const _c = new THREE.Color();

export class Signals {
  constructor(game) {
    this.game = game;
    this.list = game.world.signals || [];
    let n = 0;
    for (const s of this.list) n += s.lamps.length;
    this.cap = Math.max(1, n);
    const g = new THREE.CylinderGeometry(0.118, 0.118, 0.02, 14).rotateX(Math.PI / 2).toNonIndexed();
    g.setAttribute('aId', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count), 1));
    // (the instanced surface reads an owner and a clip per instance: none here)
    g.setAttribute('iX', new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 4), 4));
    g.setAttribute('iClip', new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 4), 4));
    const mat = makeSurface({ kind: 'neon', color: srgb(1, 1, 1), emissive: new THREE.Color(1, 1, 1), emVColor: true, line: 0.35, noShadow: true });
    this.mesh = new THREE.InstancedMesh(g, mat, this.cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.userData.dynamic = true;
    game.scene.add(this.mesh);
  }

  draw(cam) {
    const objs = this.game.world.objects;
    const time = this.game.traffic ? this.game.traffic.time : 0;
    const m = this.mesh;
    let n = 0;
    for (const s of this.list) {
      if (Math.abs(s.x - cam.x) > NEAR || Math.abs(s.z - cam.z) > NEAR) continue;
      // (a light rubbed out of the page is out)
      const o = s.obj ? objs.list[s.obj] : null;
      if (o && o.state !== 'here') continue;
      const light = lightAt(NODES[s.node], s.axis, time);
      const c = COLOR[light];
      for (const head of s.lamps) {
        if (n >= this.cap) break;
        m.setMatrixAt(n, head[ROW[light]]);
        m.setColorAt(n, _c.setRGB(c[0], c[1], c[2]));
        n++;
      }
    }
    m.count = n;
    m.visible = n > 0;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
}
