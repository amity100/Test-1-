import * as THREE from 'three';
import { spotAt } from './city';
import type { GameState, Person } from '../game/types';

/**
 * The people. Small, simple bodies — head, torso, two legs — that stand where
 * they are and walk when something moves them. Close up you can tell who is
 * who; from above they are the moving lights in a dark building.
 */

interface Body {
  group: THREE.Group;
  head: THREE.Mesh;
  legs: [THREE.Mesh, THREE.Mesh];
  target: THREE.Vector3;
  walk: number;
  person: Person;
  halo: THREE.Sprite;
}

function haloTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Figures {
  readonly group = new THREE.Group();
  private bodies = new Map<string, Body>();
  private halo = haloTexture();

  build(state: GameState) {
    this.group.clear();
    this.bodies.clear();
    for (const person of Object.values(state.people)) {
      this.bodies.set(person.id, this.makeBody(person, state));
    }
  }

  private makeBody(person: Person, state: GameState): Body {
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xdcc4ad, roughness: 0.85 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x6d7d8c, roughness: 0.9 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.42, 4, 8), cloth);
    torso.position.y = 1.12;
    torso.castShadow = true;
    g.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), skin);
    head.position.y = 1.52;
    head.castShadow = true;
    g.add(head);

    const legGeo = new THREE.CapsuleGeometry(0.075, 0.5, 3, 6);
    const legs: [THREE.Mesh, THREE.Mesh] = [
      new THREE.Mesh(legGeo, cloth), new THREE.Mesh(legGeo, cloth),
    ];
    legs[0].position.set(-0.1, 0.42, 0);
    legs[1].position.set(0.1, 0.42, 0);
    for (const l of legs) { l.castShadow = true; g.add(l); }

    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.42, 3, 6), cloth);
      arm.position.set(sx * 0.25, 1.12, 0);
      g.add(arm);
    }

    // A soft light so a person is findable from the top of the block.
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.halo, color: 0xffd9a0, transparent: true,
      opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    halo.scale.set(1.5, 1.5, 1);
    halo.position.y = 1.1;
    g.add(halo);

    const at = this.spotOf(person, state);
    g.position.copy(at);
    this.group.add(g);
    return { group: g, head, legs, target: at.clone(), walk: 0, person, halo };
  }

  private spotOf(person: Person, state: GameState): THREE.Vector3 {
    const p = state.places[person.atPlaceId];
    if (!p) return new THREE.Vector3(0, 0, 0);
    const v = spotAt(p.buildingId, p.floor, p.x, p.z, 0);
    // Stand beside the thing, not inside it.
    return v.add(new THREE.Vector3(1.1, 0, 0.8));
  }

  /** Called whenever the game state changes: people walk to where they now are. */
  sync(state: GameState) {
    for (const [id, body] of this.bodies) {
      const person = state.people[id];
      if (!person) continue;
      body.person = person;
      body.target.copy(this.spotOf(person, state));
      const m = body.halo.material as THREE.SpriteMaterial;
      m.color.set(person.wondering ? 0xffb347 : 0xffd9a0);
      m.opacity = person.wondering ? 0.4 : 0.15;
    }
  }

  update(dt: number) {
    for (const body of this.bodies.values()) {
      const d = body.target.clone().sub(body.group.position);
      const dist = d.length();
      if (dist > 0.05) {
        const step = Math.min(dist, dt * 3.4);
        body.group.position.add(d.normalize().multiplyScalar(step));
        body.group.rotation.y = Math.atan2(d.x, d.z);
        body.walk += dt * 9;
        body.legs[0].rotation.x = Math.sin(body.walk) * 0.6;
        body.legs[1].rotation.x = -Math.sin(body.walk) * 0.6;
      } else {
        body.legs[0].rotation.x *= 0.86;
        body.legs[1].rotation.x *= 0.86;
        // Standing people still shift a little; a frozen body reads as a bug.
        body.head.position.y = 1.52 + Math.sin(performance.now() * 0.0011 + body.person.id.length) * 0.006;
      }
    }
  }
}
