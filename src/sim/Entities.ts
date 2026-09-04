import * as THREE from 'three';
import { WEAPONS, GRENADE, type WeaponId } from './Weapons';

export interface WeaponSlot {
  id: WeaponId;
  ammo: number;
  reserve: number;
}

export type Role = 'defender' | 'attacker' | 'none';

export interface ScoreSheet {
  total: number;
  defenseSeconds: number;
  holdBonuses: number;
  captures: number;
  kills: number;
  killsAsDefender: number;
  deaths: number;
}

export function emptyScore(): ScoreSheet {
  return { total: 0, defenseSeconds: 0, holdBonuses: 0, captures: 0, kills: 0, killsAsDefender: 0, deaths: 0 };
}

let nextEntityId = 1;

/** A player or bot. Position is the feet centre. */
export class Entity {
  readonly id = nextEntityId++;
  name = 'Player';
  isBot = false;
  /** Palette colour index used for team accents. */
  colorIndex = 53;
  colorHex = '#00e5ff';
  plotIndex = -1;
  role: Role = 'none';

  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  radius = 0.32;
  standHeight = 1.8;
  crouchHeight = 1.25;
  crouching = false;
  sliding = false;
  slideTimer = 0;
  grounded = false;
  wasGrounded = false;
  jumpBuffered = false;
  coyoteTimer = 0;
  mantleTimer = 0;
  landImpact = 0;

  hp = 100;
  maxHp = 100;
  alive = true;
  deadSince = -1;
  respawnAt = 0;
  lastDamageTime = -100;
  lastAttackerId = -1;
  regenDelay = 6;

  weapons: WeaponSlot[] = [];
  weaponIndex = 0;
  fireCooldown = 0;
  reloading = false;
  reloadTimer = 0;
  ads = 0;
  wantsAds = false;
  triggerHeld = false;
  triggerReleased = true;
  grenades = GRENADE.startCount;
  grenadeCooldown = 0;
  grappleCooldown = 0;
  grapplePoint: THREE.Vector3 | null = null;
  grappleTime = 0;
  /** Accumulated view recoil (degrees) that decays. */
  recoilPitch = 0;
  recoilYaw = 0;
  /** Visual: last shot time for muzzle flash. */
  lastShotTime = -10;
  footstepAcc = 0;
  /** Animation phase for limbs. */
  animPhase = 0;
  speedSmoothed = 0;

  score = emptyScore();
  /** Time this entity started defending in the current round. */
  captureProgress = 0;

  get height(): number {
    return this.crouching || this.sliding ? this.crouchHeight : this.standHeight;
  }
  get eyeHeight(): number {
    return this.height - 0.18;
  }
  get eyePos(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);
  }
  get center(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.pos.y + this.height * 0.5, this.pos.z);
  }
  get weapon(): WeaponSlot | undefined {
    return this.weapons[this.weaponIndex];
  }

  forward(out = new THREE.Vector3()): THREE.Vector3 {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }
  forwardFlat(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }
  right(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  giveWeapon(id: WeaponId, replaceIndex = -1): number {
    const def = WEAPONS[id];
    const existing = this.weapons.findIndex((w) => w.id === id);
    if (existing >= 0) {
      const w = this.weapons[existing];
      w.reserve = Math.min(def.maxReserve, w.reserve + def.reserveStart);
      return existing;
    }
    const slot: WeaponSlot = { id, ammo: def.magSize, reserve: def.reserveStart };
    if (replaceIndex >= 0 && replaceIndex < this.weapons.length) {
      this.weapons[replaceIndex] = slot;
      return replaceIndex;
    }
    if (this.weapons.length >= 3) {
      this.weapons[this.weaponIndex] = slot;
      return this.weaponIndex;
    }
    this.weapons.push(slot);
    return this.weapons.length - 1;
  }

  setLoadout(primary: WeaponId, secondary: WeaponId = 'pistol'): void {
    this.weapons = [];
    this.giveWeapon(primary);
    this.giveWeapon(secondary);
    this.weaponIndex = 0;
    this.reloading = false;
    this.fireCooldown = 0;
    this.grenades = GRENADE.startCount;
  }

  reset(): void {
    this.hp = this.maxHp;
    this.alive = true;
    this.vel.set(0, 0, 0);
    this.crouching = false;
    this.sliding = false;
    this.grapplePoint = null;
    this.grappleCooldown = 0;
    this.reloading = false;
    this.fireCooldown = 0;
    this.ads = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.captureProgress = 0;
    this.lastDamageTime = -100;
    this.lastAttackerId = -1;
  }
}

export type ProjectileKind = 'rocket' | 'grenade';

export class Projectile {
  readonly id = nextEntityId++;
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  prev = new THREE.Vector3();
  age = 0;
  dead = false;
  constructor(public kind: ProjectileKind, public ownerId: number, public fuse: number) {}
}

export type PickupKind = 'ammo' | 'health' | 'weapon';

export class Pickup {
  readonly id = nextEntityId++;
  pos = new THREE.Vector3();
  active = true;
  respawnTimer = 0;
  constructor(public kind: PickupKind, public weaponId: WeaponId | null = null) {}
}
