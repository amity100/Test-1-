import * as THREE from 'three';
import type { CharacterAPI, CharacterPose, ClipName, DeathKind, LocomotionInput } from '../core/contracts';

/**
 * Bolted-down Kessler turret: base + rotating head + barrel with a red eye.
 * It speaks CharacterAPI so the enemy system drives it like everyone else:
 * root yaw is the head yaw (the round base doesn't care), loco.aim carries
 * the gun pitch (rad, + = up), play('shoot') kicks the barrel.
 */

let shared: {
  base: THREE.BufferGeometry;
  column: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  barrel: THREE.BufferGeometry;
  eye: THREE.BufferGeometry;
  metal: THREE.Material;
  dark: THREE.Material;
  eyeOn: THREE.Material;
  eyeOff: THREE.Material;
} | null = null;

function parts() {
  if (shared) return shared;
  const barrel = new THREE.CylinderGeometry(0.06, 0.075, 0.9, 10);
  barrel.rotateX(Math.PI / 2);
  shared = {
    base: new THREE.CylinderGeometry(0.42, 0.55, 0.4, 16),
    column: new THREE.CylinderGeometry(0.16, 0.2, 0.55, 12),
    head: new THREE.BoxGeometry(0.62, 0.4, 0.72),
    barrel,
    eye: new THREE.SphereGeometry(0.085, 12, 8),
    metal: new THREE.MeshStandardMaterial({ color: 0x3b4048, metalness: 0.7, roughness: 0.45 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x17191d, metalness: 0.6, roughness: 0.5 }),
    eyeOn: new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff2414, emissiveIntensity: 2.6 }),
    eyeOff: new THREE.MeshStandardMaterial({ color: 0x1a0808, emissive: 0x000000 }),
  };
  return shared;
}

const HEAD_Y = 1.1;

export class TurretRig implements CharacterAPI {
  readonly root = new THREE.Group();
  /** Gun pitch (rad, + = up). */
  pitch = 0;
  private readonly pivot = new THREE.Group();
  private readonly barrel: THREE.Mesh;
  private readonly eye: THREE.Mesh;
  private recoil = 0;
  private dead = false;
  private deathKind: DeathKind | null = null;
  private slump = 0;

  constructor() {
    const p = parts();
    this.root.name = 'turret';
    const base = new THREE.Mesh(p.base, p.dark);
    base.position.y = 0.2;
    const column = new THREE.Mesh(p.column, p.metal);
    column.position.y = 0.66;
    this.pivot.position.y = HEAD_Y;
    const head = new THREE.Mesh(p.head, p.metal);
    this.barrel = new THREE.Mesh(p.barrel, p.dark);
    this.barrel.position.set(0, -0.02, 0.62);
    this.eye = new THREE.Mesh(p.eye, p.eyeOn);
    this.eye.position.set(0, 0.08, 0.37);
    this.pivot.add(head, this.barrel, this.eye);
    this.root.add(base, column, this.pivot);
    for (const m of [base, column, head, this.barrel]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  }

  /** Muzzle height above the feet. */
  static readonly headY = HEAD_Y;

  update(dt: number, s: LocomotionInput) {
    this.pitch = s.aim;
    this.recoil = Math.max(0, this.recoil - dt * 8);
    if (this.dead) this.slump = Math.min(1, this.slump + dt * 2.5);
    this.pivot.rotation.x = -this.pitch + this.slump * 0.55;
    this.barrel.position.z = 0.62 - this.recoil * 0.14;
  }

  play(name: ClipName) {
    if (name === 'shoot') this.recoil = 1;
  }

  stop() {}

  setTumble() {}

  die(kind: DeathKind) {
    this.dead = true;
    this.deathKind = kind;
    this.eye.material = parts().eyeOff;
  }

  revive() {
    this.dead = false;
    this.deathKind = null;
    this.slump = 0;
    this.eye.material = parts().eyeOn;
  }

  getPose(): CharacterPose {
    return {
      loco: { speed: 0, grounded: true, vy: 0, crouch: 0, aim: this.pitch, downed: false, weaponUp: 1 },
      clip: this.recoil > 0 ? 'shoot' : null,
      clipT: this.recoil,
      clipW: 1,
      tumble: null,
      dead: this.dead,
      deathKind: this.deathKind,
      mixerT: this.slump,
    };
  }

  setPose(p: CharacterPose) {
    this.pitch = p.loco.aim;
    this.recoil = p.clip === 'shoot' ? p.clipT : 0;
    if (p.dead && !this.dead) this.die(p.deathKind ?? 'shot');
    else if (!p.dead && this.dead) this.revive();
    this.slump = p.dead ? p.mixerT : 0;
    this.pivot.rotation.x = -this.pitch + this.slump * 0.55;
    this.barrel.position.z = 0.62 - this.recoil * 0.14;
  }

  setOpacity(o: number) {
    this.root.visible = o > 0.02;
  }

  dispose() {
    this.root.removeFromParent();
  }
}
