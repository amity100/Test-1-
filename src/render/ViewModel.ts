import * as THREE from 'three';
import { buildWeaponModel, type ModelId } from './WeaponModels';
import type { Entity } from '../sim/Entities';
import { WEAPONS } from '../sim/Weapons';
import { clamp, damp } from '../core/MathUtil';

/** First-person weapon with sway, bob, recoil, ADS, reload and switch animations. */
export class ViewModel {
  readonly root = new THREE.Group();
  private model: THREE.Group | null = null;
  private modelId: ModelId | null = null;
  private swayX = 0;
  private swayY = 0;
  private bobPhase = 0;
  private kickBack = 0;
  private kickUp = 0;
  private switchT = 1;
  private reloadAnim = 0;
  private landDip = 0;
  private pendingId: ModelId | null = null;
  private lastAccent = new THREE.Color();
  private hiddenFlag = false;
  get hidden(): boolean {
    return this.hiddenFlag;
  }
  set hidden(v: boolean) {
    this.hiddenFlag = v;
    if (v) this.root.visible = false;
  }

  constructor(private camera: THREE.Camera, private accent: THREE.Color) {
    this.root.name = 'viewmodel';
    this.camera.add(this.root);
    this.lastAccent.copy(accent);
  }

  setAccent(c: THREE.Color): void {
    if (c.equals(this.lastAccent)) return;
    this.accent = c.clone();
    this.lastAccent.copy(c);
    const id = this.modelId;
    this.modelId = null;
    if (id) this.show(id, true);
  }

  /** Switches to a weapon with a lower/raise animation. */
  show(id: ModelId | null, instant = false): void {
    if (id === this.modelId && !this.pendingId) return;
    if (instant) {
      this.apply(id);
      this.switchT = 1;
      return;
    }
    this.pendingId = id;
    this.switchT = 0;
  }

  private apply(id: ModelId | null): void {
    if (this.model) {
      this.root.remove(this.model);
      this.model = null;
    }
    this.modelId = id;
    if (id) {
      this.model = buildWeaponModel(id, this.accent, true);
      this.root.add(this.model);
    }
  }

  kick(weaponId: string): void {
    const def = WEAPONS[weaponId as keyof typeof WEAPONS];
    const k = def ? def.kick : 0.08;
    this.kickBack = Math.min(0.35, this.kickBack + k);
    this.kickUp = Math.min(0.5, this.kickUp + k * 1.8);
  }

  land(strength: number): void {
    this.landDip = Math.max(this.landDip, strength * 0.12);
  }

  getMuzzleWorld(out: THREE.Vector3): THREE.Vector3 {
    if (!this.model) return this.camera.getWorldPosition(out);
    const mz = this.model.userData.muzzle as THREE.Vector3;
    return this.model.localToWorld(out.copy(mz));
  }

  update(dt: number, e: Entity, mouseDX: number, mouseDY: number, reloadProgress: number): void {
    // Switch animation
    if (this.pendingId !== null || this.switchT < 1) {
      this.switchT = Math.min(1, this.switchT + dt / 0.22);
      if (this.pendingId !== null && this.switchT >= 0.5) {
        this.apply(this.pendingId);
        this.pendingId = null;
      }
    }
    if (!this.model) {
      this.root.visible = false;
      return;
    }
    this.root.visible = !this.hiddenFlag;
    const hip = this.model.userData.hip as THREE.Vector3;
    const ads = this.model.userData.ads as THREE.Vector3;
    const pos = new THREE.Vector3().copy(hip).lerp(ads, e.ads);

    // Sway from mouse (lagging).
    this.swayX = damp(this.swayX, clamp(-mouseDX * 0.0012, -0.05, 0.05), 10, dt);
    this.swayY = damp(this.swayY, clamp(mouseDY * 0.0012, -0.05, 0.05), 10, dt);
    const swayScale = 1 - e.ads * 0.85;
    pos.x += this.swayX * swayScale;
    pos.y += this.swayY * swayScale;

    // Bob
    const speed = Math.sqrt(e.vel.x * e.vel.x + e.vel.z * e.vel.z);
    if (e.grounded && speed > 0.5) this.bobPhase += dt * (6 + speed * 0.9);
    const bobAmp = clamp(speed / 8, 0, 1) * 0.012 * (1 - e.ads * 0.8) * (e.grounded ? 1 : 0.3);
    pos.x += Math.sin(this.bobPhase) * bobAmp;
    pos.y += Math.abs(Math.cos(this.bobPhase)) * bobAmp * 0.8;

    // Recoil
    this.kickBack = damp(this.kickBack, 0, 14, dt);
    this.kickUp = damp(this.kickUp, 0, 12, dt);
    pos.z += this.kickBack;
    pos.y += this.kickBack * 0.15;

    // Landing dip
    this.landDip = damp(this.landDip, 0, 8, dt);
    pos.y -= this.landDip;

    // Switch lower/raise (0..0.5 lowers, 0.5..1 raises)
    const sw = this.switchT < 0.5 ? this.switchT * 2 : (1 - this.switchT) * 2;
    pos.y -= sw * 0.35;

    // Reload: tilt and drop
    const r = reloadProgress;
    let reloadTilt = 0;
    if (r > 0 && r < 1) {
      const k = Math.sin(r * Math.PI);
      pos.y -= k * 0.12;
      pos.x += k * 0.04;
      reloadTilt = k * 0.7;
    }
    // Sprint pose
    const sprint = clamp((speed - 6) / 2, 0, 1) * (1 - e.ads);
    pos.x += sprint * 0.08;
    pos.y -= sprint * 0.05;
    pos.z += sprint * 0.06;

    this.model.position.copy(pos);
    this.model.rotation.set(-this.kickUp * 0.6 + reloadTilt - sprint * 0.3, sw * 0.5 + this.swayX * 4 + sprint * 0.5, -this.swayX * 2 + reloadTilt * 0.4);
  }
}
