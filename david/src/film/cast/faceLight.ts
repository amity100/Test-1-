/**
 * Film face lighting (face pass): a small cinematographer's rig - KEY, RIM (kick) and FILL - aimed at one actor's
 * face per shot, so close-ups are sculpted (soft wrapped key with a catch-light in the eyes, a bright rim that
 * separates the head and hair from the background, a controlled fill that keeps the shadow side readable) instead
 * of flat.
 *
 * Positions are given RELATIVE TO THE CAMERA -> FACE AXIS, so a preset works for any camera angle:
 *   az   degrees around the face, 0 = at the camera, +90 = camera right, 180 = straight behind the actor
 *   el   degrees above the eye line
 *   dist metres from the eyes;  lux = illuminance on the face in the sun's units (golden-hour sun ≈ 3-7)
 * Every light is a shadowless SpotLight with a tight cone around the head and a distance cut-off (≈ 2.4 × dist), so it
 * reaches the actor (face, hair, beard, collar) but not the set behind him. Its specular in the corneas is the eye
 * catch-light: the key's az/el place it (az ±25-45°, el 15-30° → the classic 10 / 2 o'clock highlight).
 *
 * COST: every light in the scene is compiled into every lit shader. The rig therefore has a FIXED light count per
 * quality ('low' 1: key only - phones; 'medium' 2: key + rim; 'high' 3: key + rim + fill) and never toggles
 * `visible` - off is intensity 0. Create it ONCE for the whole film, add it before the scene is precompiled, re-aim
 * it per shot, dispose it after the film. Per-fragment cost ≈ one spot light (a few ALU + no shadow lookups) per
 * light on every lit pixel.
 */
import * as THREE from 'three';

export type FaceLightPresetName = 'goldenBack' | 'afternoonKing' | 'verdict' | 'tearProfile' | 'soft' | 'off';

export interface FaceLightSpot {
  az: number;
  el: number;
  dist: number;
  lux: number;
  color: THREE.ColorRepresentation;
  /** cone half-angle (rad); default: the head and shoulders at `dist` */
  angle?: number;
  penumbra?: number;
}

export interface FaceLightSpec {
  key: FaceLightSpot;
  rim: FaceLightSpot;
  fill: FaceLightSpot;
}

/**
 * Presets for the opening film (docs/intro-script.md):
 *  goldenBack    shot 16 - David above his flock, golden-hour sun BEHIND him: the sun already rims him; the key is a
 *                warm low bounce from the camera side (the sunlit grass), the rim is a kick that makes the curls and
 *                the cheek edge glow, a faint cool sky fill keeps the shadow side from going dead.
 *  afternoonKing shots 7 / 12 - Saul at his peak, late-afternoon high side sun: a hard-ish 3/4 key from above (strong
 *                brow, deep-set eyes, cheekbones modelled by shadow), a warm rim from the opposite back side, very
 *                little fill - a commanding, sculpted face.
 *  verdict       shot 11 - Samuel's verdict (1 Sam 15:28), low sun behind him: a 3/4 key from the side (the lines of
 *                age need modelling - a flat fill erases them), a strong golden rim on the white hair and beard.
 *  soft          neutral portrait light for other close-ups.
 */
export const FACE_LIGHT_PRESETS: Record<Exclude<FaceLightPresetName, 'off'>, FaceLightSpec> = {
  goldenBack: {
    key: { az: -32, el: 12, dist: 1.2, lux: 1.35, color: 0xffcf9a, penumbra: 1 },
    rim: { az: 158, el: 24, dist: 1.4, lux: 3.2, color: 0xffb566, penumbra: 0.8 },
    fill: { az: 55, el: 30, dist: 1.3, lux: 0.35, color: 0xa9c4ff, penumbra: 1 },
  },
  afternoonKing: {
    key: { az: 42, el: 32, dist: 1.25, lux: 2.1, color: 0xffe2bd, penumbra: 0.7 },
    rim: { az: -150, el: 28, dist: 1.4, lux: 2.6, color: 0xffc47e, penumbra: 0.8 },
    fill: { az: -35, el: 2, dist: 1.3, lux: 0.28, color: 0xc4d2ff, penumbra: 1 },
  },
  // (cut4, G6 v6: the tear's cheated sun now really stands behind him on the frame-left side — the key is a soft warm
  //  bounce near the lens (the eyes read, a catch-light), the rim a strong kick on his face side through the hair and
  //  beard; the face sits in the fill, not in a flat front light)
  verdict: {
    key: { az: 26, el: 12, dist: 1.2, lux: 1.0, color: 0xffd9ae, penumbra: 1 },
    rim: { az: -150, el: 20, dist: 1.4, lux: 3.6, color: 0xffb35c, penumbra: 0.8 },
    fill: { az: -40, el: 4, dist: 1.3, lux: 0.3, color: 0xbfd0ff, penumbra: 1 },
  },
  // tearProfile  G5b (cut4) - Saul on his knee in profile (facing frame right), the cheated sun behind the two men:
  //              a warm low key from the camera's right (the side his face points to) so the anguish reads inside the
  //              backlit silhouette, a kick from behind on the sun side, a faint cool fill
  tearProfile: {
    key: { az: 48, el: 10, dist: 1.3, lux: 1.15, color: 0xffd7aa, penumbra: 1 },
    rim: { az: 150, el: 18, dist: 1.4, lux: 2.2, color: 0xffb566, penumbra: 0.8 },
    fill: { az: -35, el: 4, dist: 1.3, lux: 0.3, color: 0xbfd0ff, penumbra: 1 },
  },
  soft: {
    key: { az: 30, el: 20, dist: 1.2, lux: 1.4, color: 0xfff0dc, penumbra: 1 },
    rim: { az: 165, el: 25, dist: 1.4, lux: 1.4, color: 0xffe0b8, penumbra: 1 },
    fill: { az: -40, el: 5, dist: 1.3, lux: 0.5, color: 0xdce6ff, penumbra: 1 },
  },
};

const ORDER: (keyof FaceLightSpec)[] = ['key', 'rim', 'fill'];
const _eye = new THREE.Vector3(), _cam = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3();
const _p = new THREE.Vector3(), _c = new THREE.Color();

export class FaceLightRig {
  /** the rig's lights in the order key, rim, fill (fixed count: low 1, medium 2, high 3) */
  readonly lights: THREE.SpotLight[] = [];
  readonly group = new THREE.Group();
  /** current spec (a preset or a custom one) and a 0..1 master level (animate it for fades / cuts) */
  spec: FaceLightSpec | null = null;
  amount = 1;

  constructor(opts: { quality: 'low' | 'medium' | 'high'; name?: string }) {
    const n = opts.quality === 'low' ? 1 : opts.quality === 'medium' ? 2 : 3;
    this.group.name = opts.name ?? 'faceLightRig';
    for (let i = 0; i < n; i++) {
      const l = new THREE.SpotLight(0xffffff, 0, 3, 0.4, 1, 2);
      l.name = `${this.group.name}:${ORDER[i]}`;
      l.castShadow = false;
      this.lights.push(l);
      this.group.add(l, l.target);
    }
  }

  /** add the rig to the scene - BEFORE engine.precompileView / renderer.compile (a new light recompiles shaders) */
  addTo(scene: THREE.Object3D) {
    scene.add(this.group);
    return this;
  }

  /** select a preset (or a custom spec); `amount` scales every light (0 = off, the light count is unchanged) */
  setPreset(p: FaceLightPresetName | FaceLightSpec, amount = 1) {
    this.spec = typeof p === 'string' ? (p === 'off' ? null : FACE_LIGHT_PRESETS[p]) : p;
    this.amount = amount;
    if (!this.spec) for (const l of this.lights) l.intensity = 0;
  }

  /**
   * Re-aim the rig at a face every frame (cheap): `eyes` = world midpoint between the eyes (e.g. from
   * human.sockets.eyeL/eyeR), `camera` = the shot camera. On the 1-light (phone) rig the key also carries the rim's
   * and fill's share of light so the face exposure matches the desktop rig.
   */
  update(eyes: THREE.Vector3, camera: THREE.Camera) {
    const s = this.spec;
    if (!s || this.amount <= 0) {
      for (const l of this.lights) l.intensity = 0;
      return;
    }
    _eye.copy(eyes);
    camera.getWorldPosition(_cam);
    _f.copy(_cam).sub(_eye).setY(0);
    if (_f.lengthSq() < 1e-8) _f.set(0, 0, 1);
    _f.normalize(); // face -> camera, horizontal
    _r.set(_f.z, 0, -_f.x); // the camera's right (camera forward = -_f; right = forward x up)
    for (let i = 0; i < this.lights.length; i++) {
      const spot = s[ORDER[i]];
      const l = this.lights[i];
      const az = THREE.MathUtils.degToRad(spot.az), el = THREE.MathUtils.degToRad(spot.el);
      // direction from the face: rotate the to-camera vector by az around +y (toward camera-right for az > 0)
      _p.copy(_f).multiplyScalar(Math.cos(az)).addScaledVector(_r, Math.sin(az));
      _p.multiplyScalar(Math.cos(el)).setY(Math.sin(el)).normalize();
      l.position.copy(_eye).addScaledVector(_p, spot.dist);
      l.target.position.copy(_eye);
      l.target.updateMatrixWorld();
      l.angle = spot.angle ?? Math.atan2(0.3, spot.dist);
      l.penumbra = spot.penumbra ?? 0.9;
      l.distance = spot.dist * 2.4;
      let lux = spot.lux;
      if (this.lights.length === 1) lux = spot.lux + 0.25 * s.rim.lux + s.fill.lux; // phones: key carries the fill
      else if (this.lights.length === 2 && i === 0) lux = spot.lux + 0.7 * s.fill.lux;
      l.color.copy(_c.set(spot.color));
      // SpotLight with decay 2: illuminance at the eyes = intensity / d² (the distance cut-off softens it a little)
      const cut = 1 - (1 / 2.4) ** 4;
      l.intensity = (this.amount * lux * spot.dist * spot.dist) / (cut * cut);
    }
  }

  dispose() {
    this.group.removeFromParent();
    for (const l of this.lights) l.dispose();
  }
}

/** world midpoint between a human's eyes (HumanModel sockets) - the point the rig aims at */
export function eyesMidpoint(sockets: { eyeL: THREE.Object3D; eyeR: THREE.Object3D }, out = new THREE.Vector3()) {
  sockets.eyeL.getWorldPosition(out);
  sockets.eyeR.getWorldPosition(_p);
  return out.add(_p).multiplyScalar(0.5);
}

/**
 * HERO SHADOW for a face close-up in a WORLD set (face pass 2). The world sun's shadow box is 110 m wide (src/world/Sky.ts)
 * - ~2.7 cm per texel at 4096², 5.4 cm at 2048² - so the hair's and the head's own shadow on a face turns into blocky
 * steps. For the few seconds of a close-up the box is shrunk around the actor's head (the background is out of focus,
 * and outside the box the world shaders fall back to their baked long shadows - Sky publishes the box every frame),
 * then restored. Zero extra cost: same map, same pass.
 *
 *   const hs = heroShadow(sky.sun, 1.6);   // on the cut INTO the close-up (half-size in metres)
 *   ...                                    // Sky.update(camera, focus) keeps the box centred: pass the head as focus
 *   hs.restore();                          // on the cut OUT
 *
 * `halfSize` 1.2-2 m keeps the actor's shoulders and staff in the box; bias / normalBias are scaled to the finer texel.
 */
export function heroShadow(sun: THREE.DirectionalLight, halfSize = 1.6): { restore(): void } {
  const sc = sun.shadow.camera;
  const saved = { l: sc.left, r: sc.right, t: sc.top, b: sc.bottom, bias: sun.shadow.bias, nb: sun.shadow.normalBias, rad: sun.shadow.radius };
  const k = halfSize / Math.max(1e-3, saved.r);
  sc.left = -halfSize;
  sc.right = halfSize;
  sc.top = halfSize;
  sc.bottom = -halfSize;
  sc.updateProjectionMatrix();
  // a finer texel needs proportionally less normal offset (3.5 cm on the world box would detach every contact shadow)
  sun.shadow.normalBias = Math.max(0.004, saved.nb * k);
  sun.shadow.bias = saved.bias;
  sun.shadow.radius = Math.max(saved.rad, 2);
  sun.shadow.needsUpdate = true;
  let done = false;
  return {
    restore() {
      if (done) return;
      done = true;
      sc.left = saved.l;
      sc.right = saved.r;
      sc.top = saved.t;
      sc.bottom = saved.b;
      sc.updateProjectionMatrix();
      sun.shadow.bias = saved.bias;
      sun.shadow.normalBias = saved.nb;
      sun.shadow.radius = saved.rad;
      sun.shadow.needsUpdate = true;
    },
  };
}
