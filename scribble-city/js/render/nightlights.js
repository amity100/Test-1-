import * as THREE from 'three';
import { shared } from './materials.js';
import { COMMON } from './shaders.js';
import { CURB } from '../world/layout.js';

// Light drawn on the night page: a soft cone of gel-pen light under every street lamp, the beams
// of the cars' headlights on the road, the police lights flashing red and blue on the asphalt.
// All of it is added on top of the drawing and is gone by day.

const MAX_BEAMS = 64;

const CONE_VERT = /* glsl */ `
varying vec3 vWP;
varying vec2 vRad;
varying float vH;
varying float vAng;
varying float vSeed;
varying float vDist;
void main() {
  vH = position.y;
  vAng = atan(position.z, position.x);
  vRad = normalize(position.xz + vec2(1e-5));
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vSeed = fract(instanceMatrix[3].x * 0.137 + instanceMatrix[3].z * 0.311);
  vec4 mv = viewMatrix * wp;
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const CONE_FRAG = /* glsl */ `
varying vec3 vWP;
varying vec2 vRad;
varying float vH;
varying float vAng;
varying float vSeed;
varying float vDist;
void main() {
  vec2 tc = normalize(cameraPosition.xz - vWP.xz + vec2(1e-4));
  // soft at the silhouette, like light seen through the air
  float edge = pow(abs(dot(vRad, tc)), 1.4);
  float grad = 0.1 + 0.9 * vH * vH;
  // the light is drawn: long gel strokes down the cone
  float st = n2(vec2(vAng * 9.0 + vSeed * 70.0, vH * 0.7 + vSeed * 13.0));
  float streak = 0.5 + 0.7 * smoothstep(0.42, 0.8, st);
  // a few old lamps flicker
  float flick = 1.0 - step(0.9, vSeed) * step(0.6, fract(sin(uTime * 7.0 + vSeed * 50.0) * 43.7)) * 0.6;
  float a = edge * grad * streak * flick * uNight * 0.15;
  a *= 1.0 + uMist * 1.6 + uRain * 0.8;
  a *= 1.0 - fogFactor(vDist);
  if (a < 0.003) discard;
  gl_FragColor = vec4(1.0, 0.8, 0.46, a);
}`;

const BEAM_VERT = /* glsl */ `
attribute vec4 iBeam; // x, z, yaw, strength
attribute vec4 iCol;  // rgb, kind (0 headlights, 1 police lights)
varying vec2 vL;
varying vec4 vCol;
varying float vK;
varying float vDist;
void main() {
  vec2 f = vec2(sin(iBeam.z), cos(iBeam.z));
  vec2 r = vec2(f.y, -f.x);
  vec2 xz;
  if (iCol.w < 0.5) {
    // a widening wedge of light on the road ahead of the car
    float along = position.y;
    float hw = mix(0.85, 4.4, along);
    xz = iBeam.xy + f * (1.9 + along * 15.0) + r * position.x * hw;
  } else {
    // a disc of flashing light around the car
    xz = iBeam.xy + (f * position.y * 2.0 - f + r * position.x) * 6.5;
  }
  vL = position.xy;
  vCol = iCol;
  vK = iBeam.w;
  vec4 mv = viewMatrix * vec4(xz.x, 0.07, xz.y, 1.0);
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const BEAM_FRAG = /* glsl */ `
varying vec2 vL;
varying vec4 vCol;
varying float vK;
varying float vDist;
void main() {
  float a;
  if (vCol.w < 0.5) {
    float along = vL.y;
    float ac = abs(vL.x);
    a = smoothstep(0.0, 0.1, along) * (1.0 - smoothstep(0.3, 1.0, along)) * (1.0 - smoothstep(0.45, 1.0, ac));
    // drawn rays fanning out from the lamps
    float ray = n2(vec2(vL.x / (0.25 + along) * 7.0 + vK * 31.0, along * 0.8));
    a *= 0.6 + 0.6 * smoothstep(0.4, 0.78, ray);
    a *= 0.5;
  } else {
    vec2 q = vec2(vL.x, vL.y * 2.0 - 1.0);
    float d = length(q);
    a = (1.0 - smoothstep(0.1, 1.0, d)) * 0.42;
  }
  a *= vK * uNight * (1.0 - fogFactor(vDist));
  if (a < 0.003) discard;
  gl_FragColor = vec4(vCol.rgb, a);
}`;

export class NightLights {
  constructor(scene, world) {
    this.world = world;
    // lamp cones: one instanced open cone per street lamp
    const cone = new THREE.CylinderGeometry(0.17, 2.9, 1, 18, 3, true);
    cone.translate(0, 0.5, 0);
    const coneMat = new THREE.ShaderMaterial({
      uniforms: { ...shared },
      vertexShader: COMMON + CONE_VERT,
      fragmentShader: COMMON + CONE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const lamps = world.lamps || [];
    this.cones = new THREE.InstancedMesh(cone, coneMat, Math.max(1, lamps.length));
    this.cones.frustumCulled = false;
    this.cones.renderOrder = 5;
    this.cones.visible = false;
    scene.add(this.cones);
    this.refresh();
    // car beams and police lights
    const g = new THREE.InstancedBufferGeometry();
    const pos = [];
    const idx = [];
    const NX = 4;
    const NY = 6;
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) pos.push((i / NX) * 2 - 1, j / NY, 0);
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const a = j * (NX + 1) + i;
        idx.push(a, a + 1, a + NX + 1, a + 1, a + NX + 2, a + NX + 1);
      }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    this.beamData = new Float32Array(MAX_BEAMS * 4);
    this.beamCol = new Float32Array(MAX_BEAMS * 4);
    this.aBeam = new THREE.InstancedBufferAttribute(this.beamData, 4);
    this.aCol = new THREE.InstancedBufferAttribute(this.beamCol, 4);
    this.aBeam.setUsage(THREE.DynamicDrawUsage);
    this.aCol.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iBeam', this.aBeam);
    g.setAttribute('iCol', this.aCol);
    g.instanceCount = 0;
    const beamMat = new THREE.ShaderMaterial({
      uniforms: { ...shared },
      vertexShader: COMMON + BEAM_VERT,
      fragmentShader: COMMON + BEAM_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });
    this.beams = new THREE.Mesh(g, beamMat);
    this.beams.frustumCulled = false;
    this.beams.renderOrder = 4;
    this.beams.visible = false;
    scene.add(this.beams);
  }

  // lamps that were rubbed out lose their cone
  refresh() {
    const lamps = this.world.lamps || [];
    const objects = this.world.objects;
    const m = new THREE.Matrix4();
    lamps.forEach((l, i) => {
      const gone = l.obj && objects && objects.list[l.obj] && objects.list[l.obj].state === 'gone';
      if (gone) m.makeScale(0, 0, 0);
      else m.makeScale(1, 5.2, 1).setPosition(l.x, CURB, l.z);
      this.cones.setMatrixAt(i, m);
    });
    this.cones.instanceMatrix.needsUpdate = true;
  }

  update(game) {
    const dn = game.daynight;
    const on = dn.on && dn.night > 0.01 && !game.inBar;
    this.cones.visible = on;
    this.beams.visible = on;
    if (!on) return;
    let n = 0;
    const B = this.beamData;
    const C = this.beamCol;
    const cam = game.camera.position;
    const add = (x, z, yaw, k, r, g, b, kind) => {
      if (n >= MAX_BEAMS) return;
      if ((x - cam.x) ** 2 + (z - cam.z) ** 2 > 230 * 230) return;
      B.set([x, z, yaw, k], n * 4);
      C.set([r, g, b, kind], n * 4);
      n++;
    };
    const t = game.time;
    for (const c of game.traffic.list) {
      if (c.gone || c.wrecked || c.poofT !== undefined) continue;
      add(c.pos.x, c.pos.z, c.yaw, 1, 1, 0.93, 0.74, 0);
      if (c.police && c.siren) {
        const red = Math.sin(t * 9 + c.pos.x) > 0;
        add(c.pos.x, c.pos.z, c.yaw, 1, red ? 1 : 0.25, red ? 0.2 : 0.4, red ? 0.25 : 1, 1);
      }
    }
    for (const v of game.vehicles.list) {
      if (v.dead || v.kind === 'ufo' || (!v.driver && v !== game.player.inVehicle)) continue;
      add(v.pos.x, v.pos.z, v.yaw, 1.1, 1, 0.95, 0.8, 0);
    }
    this.beams.geometry.instanceCount = n;
    this.aBeam.needsUpdate = true;
    this.aCol.needsUpdate = true;
  }
}
