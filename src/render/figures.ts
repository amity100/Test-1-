import * as THREE from 'three';
import { RNG } from '../core/rng';
import { BUILDINGS, FLOOR_H, WALKS, coreSpot, floorY, spotAt } from './city';
import { buildBody, idle, lookAt, randomBuild, sit, walk, type Joints } from './rig';
import type { Seat } from './interior';
import type { GameState, Person, Place } from '../game/types';

/**
 * The people in the building and on the street.
 *
 * Everyone here is a real body: a hip, a knee, an ankle, a spine that
 * counter-rotates against the hips, and a neck that can only turn as far as a
 * neck turns. They walk on their feet rather than sliding, they take the lift
 * between floors instead of drifting through the slab, they turn before they
 * set off, and when something happens in the room they stop and look at it.
 *
 * Nothing about them is loaded from anywhere. It is all angles.
 */

const D = Math.PI / 180;
/** Metres covered by one full two-step cycle. Feet match the floor because of this. */
const STRIDE = 1.52;

/** What the people can feel happening around them. */
export type Felt =
  | 'dark'    // the lights went out
  | 'light'   // they came back
  | 'ring'    // a phone
  | 'print'   // the printer woke up
  | 'screen'  // something appeared on a screen
  | 'door'    // a door moved on its own
  | 'noise'   // a sound
  | 'stop';   // a machine stopped

const REACH: Record<Felt, number> = {
  dark: 120, light: 120, ring: 16, print: 22, screen: 26, door: 22, noise: 26, stop: 9,
};
const SHOCK: Record<Felt, number> = {
  dark: 1, light: 0.5, ring: 0.5, print: 0.7, screen: 0.9, door: 0.8, noise: 0.6, stop: 0.55,
};

type Doing = 'sit' | 'stand' | 'walk' | 'lift';

interface Actor {
  id: string;
  root: THREE.Group;
  joints: Joints;
  seed: number;
  standH: number;
  doing: Doing;
  /** Where they are going, in order. Empty means they have arrived. */
  path: THREE.Vector3[];
  phase: number;
  speed: number;
  want: number;
  yaw: number;
  wantYaw: number;
  /** A world point the head is drawn to, and for how long. */
  look: THREE.Vector3 | null;
  lookFor: number;
  /** 1 the instant something startles them, falling back to 0. */
  shock: number;
  /** Seconds until they next fidget, glance about or shift their weight. */
  next: number;
  building: string;
  floor: number;
  /** Their chair, for the extras who work here. */
  home: THREE.Vector3;
  /** The actual chair they are on. Nobody sits without one. */
  seat: Seat | null;
  street: boolean;
  /** Named people are moved by the game; extras move themselves. */
  person?: Person;
  halo?: THREE.Sprite;
  /** Street walkers follow a pavement; this is which one and where along it. */
  lane?: THREE.Vector3[];
  legIndex: number;
}

function haloTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Figures {
  readonly group = new THREE.Group();
  private actors: Actor[] = [];
  private byPerson = new Map<string, Actor>();
  private halo = haloTexture();
  private rng = new RNG('people');
  private tmp = new THREE.Vector3();
  private seats: Seat[] = [];

  build(state: GameState, seats: Seat[] = []) {
    this.seats = seats;
    this.group.clear();
    this.actors = [];
    this.byPerson.clear();

    const free = seats.filter((x) => !x.named);
    for (const person of Object.values(state.people)) {
      const a = this.spawn(person.id, this.standSpot(state, person.atPlaceId));
      a.person = person;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.halo, color: 0xffd9a0, transparent: true,
        opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      halo.scale.set(1.7, 1.7, 1);
      halo.position.y = 1.15;
      a.root.add(halo);
      a.halo = halo;
      this.byPerson.set(person.id, a);
    }

    // The rest of the night shift — every one of them on a chair that exists.
    // Never more than a couple per floor, and never on a floor with nothing on it.
    // The tower across the plaza is a building in the street now, not a room
    // you walk into, so nobody is seated in it any more.
    const wanted = ['helios:14', 'helios:9', 'helios:11', 'helios:6', 'helios:0'];
    let n = 0;
    for (const key of wanted) {
      const [b, fs] = key.split(':');
      const f = Number(fs);
      const here = free.filter((x) => x.building === b && x.floor === f);
      this.rng.shuffle(here);
      for (const seat of here.slice(0, 2)) {
        const a = this.spawn(`w${n++}`, new THREE.Vector3(seat.x, seat.y - 0.34, seat.z));
        a.building = b;
        a.floor = f;
        a.standH = seat.y - 0.5;
        a.home.set(seat.x, a.standH, seat.z);
        a.seat = seat;
        a.doing = 'sit';
        a.yaw = a.wantYaw = seat.yaw;
        a.root.position.set(seat.x, a.standH, seat.z);
        a.root.rotation.y = seat.yaw;
      }
    }

    // And the ones out on the pavement at three in the morning.
    for (let i = 0; i < 9 && WALKS.length; i++) {
      const lane = WALKS[this.rng.int(0, WALKS.length - 1)];
      const t = this.rng.next();
      const at = lane[0].clone().lerp(lane[1], t);
      const a = this.spawn(`p${i}`, at);
      a.street = true;
      a.building = 'street';
      a.lane = lane;
      a.legIndex = 1;
      a.doing = 'walk';
      a.path = [lane[1].clone()];
    }
  }

  private spawn(id: string, at: THREE.Vector3): Actor {
    const b = randomBuild(() => this.rng.next());
    const { root, joints } = buildBody(b);
    root.position.copy(at);
    this.group.add(root);
    const a: Actor = {
      id, root, joints, seed: this.rng.range(0, 20), standH: at.y,
      doing: 'stand', path: [], phase: this.rng.next(), speed: 0, want: 0,
      yaw: this.rng.range(-Math.PI, Math.PI), wantYaw: 0,
      look: null, lookFor: 0, shock: 0, next: this.rng.range(1, 6),
      building: 'helios', floor: 0, home: at.clone(), seat: null, street: false,
      legIndex: 0,
    };
    a.wantYaw = a.yaw;
    a.root.rotation.y = a.yaw;
    this.actors.push(a);
    return a;
  }

  // ── where the game says a person is ───────────────────────────────────────

  /** The chair that belongs to a place, if it has one. */
  private seatFor(p: Place): Seat | null {
    const at = spotAt(p.buildingId, p.floor, p.x, p.z, 0);
    return this.seats.find((s) => s.named && s.building === p.buildingId && s.floor === p.floor
      && Math.hypot(s.x - at.x, s.z - at.z) < 2) ?? null;
  }

  private standSpot(state: GameState, placeId: string): THREE.Vector3 {
    const p = state.places[placeId];
    if (!p) return new THREE.Vector3();
    // If there is a chair here, that is where they go. Otherwise they stand
    // beside the thing — never inside it, and never on top of it.
    const seat = this.seatFor(p);
    if (seat) return new THREE.Vector3(seat.x, seat.y - 0.5, seat.z);
    const v = spotAt(p.buildingId, p.floor, p.x, p.z, 0);
    return v.add(new THREE.Vector3(1.15, 0.16, 0.9));
  }

  /**
   * The way from here to there. Nobody walks through a floor slab: you go to the
   * lift, you go up or down inside it, and you come out on the right floor.
   */
  private route(a: Actor, to: THREE.Vector3, place: Place): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    const fromB = a.building;
    const toB = place.buildingId;
    const fromF = a.floor;
    const toF = place.floor;

    const door = (id: string) => {
      const b = BUILDINGS.find((x) => x.id === id);
      return b ? new THREE.Vector3(b.x, 0.16, b.z + b.d / 2 + 6) : new THREE.Vector3(0, 0.16, 20);
    };

    if (fromB === toB && fromF === toF) return [to];

    if (fromB === toB) {
      out.push(coreSpot(fromB, fromF), coreSpot(toB, toF), to);
      return out;
    }
    // Out of one building, along the street, into the other.
    if (fromB !== 'street') out.push(coreSpot(fromB, fromF), coreSpot(fromB, 0), door(fromB));
    if (toB !== 'street') out.push(door(toB), coreSpot(toB, 0), coreSpot(toB, toF));
    out.push(to);
    return out;
  }

  /** The game moved somebody: send them walking, and never teleport them. */
  sync(state: GameState) {
    for (const [id, a] of this.byPerson) {
      const person = state.people[id];
      if (!person) continue;
      a.person = person;
      const place = state.places[person.atPlaceId];
      if (!place) continue;
      const to = this.standSpot(state, person.atPlaceId);
      const arrived = a.path.length === 0 && a.root.position.distanceTo(to) < 0.6;
      if (!arrived) {
        const last = a.path[a.path.length - 1];
        if (!last || last.distanceTo(to) > 0.6) {
          a.path = this.route(a, to, place);
          a.doing = 'walk';
          a.want = person.worry >= 30 ? 1.85 : 1.35;
        }
      }
      a.building = place.buildingId;
      a.floor = place.floor;
      a.seat = this.seatFor(place);
      // Already where they belong, and there is a chair there: sit on it.
      if (arrived && a.seat && a.doing !== 'walk') {
        a.doing = 'sit';
        a.standH = a.seat.y - 0.5;
      }
      if (arrived && !a.seat && a.doing === 'sit') a.doing = 'stand';

      if (a.halo) {
        const m = a.halo.material as THREE.SpriteMaterial;
        m.color.set(person.worry >= 30 ? 0xffb347 : 0xffd9a0);
        m.opacity = person.worry >= 30 ? 0.34 : 0.13;
      }
    }
  }

  // ── something happened in the room ────────────────────────────────────────

  /** Everyone close enough to feel it, feels it — and turns to look. */
  felt(at: THREE.Vector3, kind: Felt) {
    const reach = REACH[kind];
    for (const a of this.actors) {
      const d = a.root.position.distanceTo(at);
      if (d > reach) continue;
      const near = 1 - d / reach;
      a.look = at.clone();
      a.lookFor = 2.5 + near * 4;
      a.shock = Math.max(a.shock, SHOCK[kind] * (0.45 + near * 0.55));
      // A person sitting when the lights go out does not stay sitting.
      if ((kind === 'dark' || kind === 'screen') && a.doing === 'sit' && near > 0.4) {
        a.doing = 'stand';
      }
      // The extras are curious: some of them get up and go and look.
      if (!a.person && !a.street && d < reach * 0.55 && this.rng.chance(0.35)) {
        a.path = [at.clone().setY(a.standH).add(
          new THREE.Vector3(this.rng.range(-1.6, 1.6), 0, this.rng.range(1.2, 2.4)),
        )];
        a.doing = 'walk';
        a.want = kind === 'dark' ? 1.75 : 1.3;
      }
    }
  }

  // ── the frame ─────────────────────────────────────────────────────────────

  update(dt: number, camera?: THREE.Vector3, host?: string | null, floor = 0) {
    const t = performance.now() * 0.001;
    for (const a of this.actors) {
      // Only the people you could actually see are drawn or animated.
      const shown = a.street
        ? !camera || a.root.position.distanceTo(camera) < 300
        : host === a.building && Math.abs(a.floor - floor) <= 3;
      a.root.visible = shown;
      if (!shown) continue;

      this.step(a, dt, t);
    }
  }

  private step(a: Actor, dt: number, t: number) {
    const j = a.joints;

    // ── going somewhere ─────────────────────────────────────────────────────
    if (a.path.length) {
      const goal = a.path[0];
      const flat = this.tmp.set(goal.x - a.root.position.x, 0, goal.z - a.root.position.z);
      const dist = flat.length();
      const climb = goal.y - a.standH;

      if (dist < 0.9 && Math.abs(climb) > 0.5) {
        // Inside the lift. Standing still, going up.
        a.doing = 'lift';
        a.standH += Math.sign(climb) * Math.min(Math.abs(climb), dt * 4.2);
        a.speed *= 0.8;
        if (Math.abs(goal.y - a.standH) < 0.05) {
          a.standH = goal.y;
          a.path.shift();
        }
      } else if (dist < 0.35) {
        a.path.shift();
        if (!a.path.length) {
          a.doing = a.seat ? 'sit' : 'stand';
          if (a.seat) a.standH = a.seat.y - 0.5;
        }
      } else {
        a.doing = 'walk';
        a.wantYaw = Math.atan2(flat.x, flat.z);
        // You turn before you go. Facing the wrong way, you barely move.
        const off = Math.abs(shortest(a.wantYaw - a.yaw));
        const aim = off > 1.9 ? 0.12 : off > 0.9 ? 0.45 : 1;
        const want = Math.min(a.want || 1.35, dist * 1.6 + 0.25) * aim;
        a.speed += (want - a.speed) * Math.min(1, dt * 3.4);
        const move = Math.min(dist, a.speed * dt);
        a.root.position.x += (flat.x / dist) * move;
        a.root.position.z += (flat.z / dist) * move;
        // A ramp, a kerb, half a step: the ground under them, never a lift.
        a.standH += THREE.MathUtils.clamp(climb, -dt * 2, dt * 2);
        a.phase = (a.phase + move / STRIDE) % 1;
      }
    } else {
      a.speed += (0 - a.speed) * Math.min(1, dt * 5);
      if (a.doing === 'walk' || a.doing === 'lift') a.doing = a.seat ? 'sit' : 'stand';
    }

    // Turning is a rate, not a snap: about a third of a turn a second.
    const turn = shortest(a.wantYaw - a.yaw);
    a.yaw += THREE.MathUtils.clamp(turn, -dt * 2.6, dt * 2.6);
    a.root.rotation.y = a.yaw;

    // ── the pose ────────────────────────────────────────────────────────────
    if (a.doing === 'walk' && a.speed > 0.12) {
      walk(j, a.phase, a.speed, a.standH);
    } else if (a.doing === 'sit' && a.seat) {
      a.root.position.x = a.seat.x;
      a.root.position.z = a.seat.z;
      a.wantYaw = a.seat.yaw;
      sit(j, t, a.seat.y, a.seed);
    } else {
      idle(j, t, a.standH, a.seed);
    }

    // ── what they are looking at ────────────────────────────────────────────
    if (a.lookFor > 0 && a.look) {
      a.lookFor -= dt;
      lookAt(j, a.look, Math.min(1, dt * 5));
      // A real person turns their body to something behind them, not just their neck.
      if (a.doing !== 'walk') {
        const to = Math.atan2(a.look.x - a.root.position.x, a.look.z - a.root.position.z);
        if (Math.abs(shortest(to - a.yaw)) > 1.25) a.wantYaw = to;
      }
    } else {
      j.head.rotation.y *= 1 - Math.min(1, dt * 2.2);
      j.head.rotation.x *= 1 - Math.min(1, dt * 2.2);
    }

    // ── the flinch ──────────────────────────────────────────────────────────
    if (a.shock > 0) {
      const s = a.shock;
      j.chest.rotation.x -= 7 * D * s;
      j.armL.rotation.x -= 14 * D * s;
      j.armR.rotation.x -= 14 * D * s;
      j.armL.rotation.z += 10 * D * s;
      j.armR.rotation.z -= 10 * D * s;
      j.foreL.rotation.x -= 22 * D * s;
      j.foreR.rotation.x -= 22 * D * s;
      j.root.position.y += 0.014 * s;
      a.shock = Math.max(0, a.shock - dt * (a.shock > 0.7 ? 0.9 : 1.5));
    }

    // Somebody who has seen something they cannot explain keeps looking round.
    if ((a.person?.worry ?? 0) >= 30 && a.lookFor <= 0) {
      a.next -= dt;
      if (a.next <= 0) {
        a.next = 1.4 + this.rng.next() * 2.2;
        a.wantYaw = a.yaw + this.rng.range(-2.2, 2.2);
      }
    }

    // ── keeping busy ────────────────────────────────────────────────────────
    a.next -= dt;
    if (a.next <= 0 && !a.path.length) {
      a.next = 4 + this.rng.next() * 11;
      if (a.street && a.lane) {
        // Walk the length of the pavement, turn round at the end, walk back.
        a.legIndex = a.legIndex === 1 ? 0 : 1;
        a.path = [a.lane[a.legIndex].clone()];
        a.want = 1.15 + this.rng.next() * 0.5;
      } else if (!a.person) {
        // Get up, go and get water, come back and sit down again.
        if (a.doing === 'sit' && a.seat && this.rng.chance(0.4)) {
          const spec = BUILDINGS.find((x) => x.id === a.building);
          const to = this.rng.chance(0.5) && spec
            ? new THREE.Vector3(
              spec.x + this.rng.range(-spec.w * 0.3, spec.w * 0.3), a.home.y,
              spec.z + this.rng.range(-spec.d * 0.3, spec.d * 0.3),
            )
            : coreSpot(a.building, a.floor);
          a.path = [to, new THREE.Vector3(a.seat.x, a.seat.y - 0.5, a.seat.z)];
          a.want = 1.15;
          a.doing = 'walk';
        } else {
          a.wantYaw = a.yaw + this.rng.range(-1.1, 1.1);
        }
      }
    }

    // Street walkers loop for ever.
    if (a.street && a.lane && !a.path.length) {
      a.legIndex = a.legIndex === 1 ? 0 : 1;
      a.path = [a.lane[a.legIndex].clone()];
      a.want = 1.15 + this.rng.next() * 0.5;
    }
  }
}

/** The short way round a circle. */
function shortest(x: number): number {
  return Math.atan2(Math.sin(x), Math.cos(x));
}
