import * as THREE from 'three';
import { ZONE_RADIUS } from '../world/Layout';

const BEAM_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  vUv = uv;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uStrength;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  float rim = pow(1.0 - abs(dot(vN, vV)), 1.5);
  float fadeTop = 1.0 - smoothstep(0.2, 1.0, vUv.y);
  float bands = 0.75 + 0.25 * sin(vUv.y * 40.0 - uTime * 2.5);
  float a = rim * fadeTop * bands * uStrength * 0.6;
  gl_FragColor = vec4(uColor * (1.2 + rim), a);
}`;

const DOME_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uStrength;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  float rim = pow(1.0 - abs(dot(vN, vV)), 3.0);
  float grid = smoothstep(0.96, 1.0, abs(sin(vUv.x * 120.0))) + smoothstep(0.96, 1.0, abs(sin(vUv.y * 60.0 + uTime * 0.3)));
  float a = (rim * 0.22 + grid * 0.03) * uStrength;
  gl_FragColor = vec4(uColor * 0.9, a);
}`;

/** Light pillar, holographic dome and ground ring marking the fortress under attack. */
export class FocusZone {
  readonly group = new THREE.Group();
  private beam: THREE.Mesh;
  private dome: THREE.Mesh;
  private ring: THREE.Mesh;
  private uniforms = { uColor: { value: new THREE.Color(0x00e5ff) }, uTime: { value: 0 }, uStrength: { value: 1 } };
  private domeUniforms = { uColor: { value: new THREE.Color(0x00e5ff) }, uTime: { value: 0 }, uStrength: { value: 1 } };
  private strength = 0;
  private target = 0;

  constructor() {
    const beamGeo = new THREE.CylinderGeometry(3.5, 5, 240, 24, 1, true);
    beamGeo.translate(0, 120, 0);
    this.beam = new THREE.Mesh(
      beamGeo,
      new THREE.ShaderMaterial({ vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    this.beam.renderOrder = 15;
    this.group.add(this.beam);
    const domeGeo = new THREE.SphereGeometry(ZONE_RADIUS, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
    this.dome = new THREE.Mesh(
      domeGeo,
      new THREE.ShaderMaterial({ vertexShader: BEAM_VERT, fragmentShader: DOME_FRAG, uniforms: this.domeUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    this.dome.renderOrder = 14;
    this.group.add(this.dome);
    const ringGeo = new THREE.RingGeometry(ZONE_RADIUS - 0.6, ZONE_RADIUS, 96);
    ringGeo.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.ring.position.y = 0.05;
    this.group.add(this.ring);
    this.group.visible = false;
    this.group.name = 'focusZone';
  }

  show(center: THREE.Vector3, color: THREE.Color): void {
    this.group.position.copy(center);
    this.uniforms.uColor.value.copy(color);
    this.domeUniforms.uColor.value.copy(color);
    (this.ring.material as THREE.MeshBasicMaterial).color.copy(color);
    this.group.visible = true;
    this.target = 1;
  }

  hide(): void {
    this.target = 0;
  }

  update(dt: number, time: number): void {
    this.strength += (this.target - this.strength) * Math.min(1, dt * 3);
    if (this.strength < 0.01 && this.target === 0) {
      this.group.visible = false;
      return;
    }
    this.uniforms.uTime.value = time;
    this.domeUniforms.uTime.value = time;
    this.uniforms.uStrength.value = this.strength * (0.8 + 0.2 * Math.sin(time * 2));
    this.domeUniforms.uStrength.value = this.strength;
    (this.ring.material as THREE.MeshBasicMaterial).opacity = this.strength * (0.6 + 0.3 * Math.sin(time * 3));
    this.beam.rotation.y = time * 0.2;
  }
}
