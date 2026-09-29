import * as THREE from 'three';

/*
 * Character lights for the court, added to the palace scene (film practice: the set's sun / lamps are the
 * motivation, these shape the faces).
 *
 *   key  — SpotLight: outdoors a soft warm "sun bounce / reflector" from the camera side (the tamarisk shades the
 *          king); in the evening hall a warm oil-lamp key from a niche lamp beside the seat (shadow-casting on
 *          high, so the brow and nose shape the face).
 *   rim  — SpotLight from behind: warm low sun outdoors, cool dusk from the west window in the hall.
 *   fill — PointLight (medium / high): warm floor / brazier bounce from below-front, keeps the eyes readable.
 *
 * The number of lights never changes after create() (three.js recompiles every program when the light count
 * changes): unused lights are set to intensity 0, never removed or hidden.
 */
export interface LightRig {
  key: { pos: THREE.Vector3; target: THREE.Vector3; color: THREE.ColorRepresentation; intensity: number; angle: number; distance: number };
  rim: { pos: THREE.Vector3; target: THREE.Vector3; color: THREE.ColorRepresentation; intensity: number; angle: number; distance: number };
  fill?: { pos: THREE.Vector3; color: THREE.ColorRepresentation; intensity: number; distance: number };
}

export class CastLights {
  readonly group = new THREE.Group();
  readonly key: THREE.SpotLight;
  readonly rim: THREE.SpotLight | null;
  readonly fill: THREE.PointLight | null;
  private baseKey = 0;
  private baseFill = 0;
  private flickerSeed = Math.random() * 10;
  /** 0 = steady (sun / reflector), 1 = oil-lamp flicker on the key and fill */
  flicker = 0;
  private time = 0;

  constructor(tier: 'low' | 'medium' | 'high') {
    this.group.name = 'cast:lights';
    this.key = new THREE.SpotLight(0xffffff, 0, 8, 0.5, 0.85, 2);
    this.key.name = 'cast:key';
    if (tier === 'high') {
      this.key.castShadow = true;
      this.key.shadow.mapSize.set(1024, 1024);
      this.key.shadow.bias = -0.0004;
      this.key.shadow.normalBias = 0.01;
      this.key.shadow.radius = 3;
      this.key.shadow.camera.near = 0.2;
      this.key.shadow.camera.far = 6;
    }
    this.group.add(this.key, this.key.target);
    this.rim = tier === 'low' ? null : new THREE.SpotLight(0xffffff, 0, 8, 0.45, 0.8, 2);
    if (this.rim) {
      this.rim.name = 'cast:rim';
      this.group.add(this.rim, this.rim.target);
    }
    this.fill = tier === 'high' ? new THREE.PointLight(0xffffff, 0, 5, 2) : null;
    if (this.fill) {
      this.fill.name = 'cast:fill';
      this.group.add(this.fill);
    }
  }

  apply(r: LightRig | null) {
    if (!r) {
      this.key.intensity = this.baseKey = 0;
      if (this.rim) this.rim.intensity = 0;
      if (this.fill) this.fill.intensity = this.baseFill = 0;
      return;
    }
    const k = this.key;
    k.position.copy(r.key.pos);
    k.target.position.copy(r.key.target);
    k.color.set(r.key.color);
    k.intensity = this.baseKey = r.key.intensity;
    k.angle = r.key.angle;
    k.distance = r.key.distance;
    k.target.updateMatrixWorld();
    if (this.rim) {
      const m = this.rim;
      m.position.copy(r.rim.pos);
      m.target.position.copy(r.rim.target);
      m.color.set(r.rim.color);
      m.intensity = r.rim.intensity;
      m.angle = r.rim.angle;
      m.distance = r.rim.distance;
      m.target.updateMatrixWorld();
    }
    if (this.fill) {
      if (r.fill) {
        this.fill.position.copy(r.fill.pos);
        this.fill.color.set(r.fill.color);
        this.fill.intensity = this.baseFill = r.fill.intensity;
        this.fill.distance = r.fill.distance;
      } else this.fill.intensity = this.baseFill = 0;
    }
  }

  update(dt: number) {
    this.time += dt;
    if (this.flicker <= 0) return;
    const t = this.time, s = this.flickerSeed;
    const f = 1 + this.flicker * (0.08 * Math.sin(t * 9.7 + s) + 0.05 * Math.sin(t * 23.1 + s * 2.1) + 0.035 * Math.sin(t * 4.3 + s * 0.6));
    this.key.intensity = this.baseKey * f;
    if (this.fill) this.fill.intensity = this.baseFill * (0.5 + 0.5 * f);
  }

  dispose() {
    this.key.shadow.map?.dispose();
    this.key.dispose();
    this.rim?.dispose();
    this.fill?.dispose();
    this.group.removeFromParent();
  }
}
