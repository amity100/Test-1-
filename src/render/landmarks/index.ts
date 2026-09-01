import * as THREE from 'three';
import type { ObjState, PlaceObject } from '../objects';
import { bake } from '../bake';
import { makeKit, type Landmark } from './kit';

/**
 * Which real Tel Aviv landmark stands at which place in the game.
 *
 * The place ids on the left are older than the map — 'radio' was a radio studio
 * before the city was surveyed and is now Neve Tzedek — and they are kept
 * because every save, gate and reference in the game uses them. What changed is
 * that each one now names a real building with a real model, instead of being
 * handed whichever generic shape its `kind` happened to imply. That is how the
 * player ended up flying to Old Jaffa and finding a server shed on a road.
 */
const AT: Record<string, string> = {
  jaffa: 'jaffa_old',
  jaffa_port: 'jaffa_port',
  carmel: 'carmel_market',
  radio: 'neve_tzedek',
  trains: 'ta_port',
  ta_power: 'reading',
  city_hall: 'city_hall',
  roth_lights: 'dizengoff',
  roth_towers: 'rothschild',
  roth_young: 'habima',
  ichilov: 'ichilov',
  ta_uni: 'ta_university',
  center_roads: 'ayalon',
  bank: 'bursa',
  florentin: 'florentin',
  ta_water: 'sarona',
  beach: 'tayelet',
  bavli: 'bavli',
  atidim: 'atidim',
  across: 'azrieli',
  gvirol_lights: 'ibn_gvirol',
};

/**
 * Every landmark module in the folder, found at build time.
 *
 * Globbed rather than listed so that a landmark is added to the city by putting
 * its file next to this one, and nothing else has to be told.
 */
const FILES = import.meta.glob<{ size: Landmark['size']; build: Landmark['build'] }>(
  './*.ts', { eager: true },
);

function moduleFor(name: string) {
  const m = FILES[`./${name}.ts`];
  return m && typeof m.build === 'function' && m.size ? m : null;
}

/** Is there a hand-built model of the real place standing at this place id? */
export function hasLandmark(placeId: string): boolean {
  const name = AT[placeId];
  return !!name && !!moduleFor(name);
}

/** How wide the real thing is, for the click box and for framing the camera. */
export function landmarkSize(placeId: string): number {
  const name = AT[placeId];
  const m = name ? moduleFor(name) : null;
  return m ? Math.max(m.size.w, m.size.d) : 0;
}

/**
 * Build the real place. Returns null when nothing has been authored for it yet,
 * so the caller can fall back to the generic shape for its kind.
 */
export function makeLandmark(placeId: string): PlaceObject | null {
  const name = AT[placeId];
  const mod = name ? moduleFor(name) : null;
  if (!mod) return null;

  const { kit, group, glow, ticks } = makeKit(placeId);
  mod.build(kit);

  // Weld it down. A landmark is two or three hundred little boxes when it is
  // built and about half a dozen meshes when it is finished — everything that
  // does not move gets merged by material, and what does move is found by
  // running the animation and watching.
  const baked = bake(group, glow, ticks);

  // One invisible block round the whole thing is what the pointer tests
  // against, so a landmark made of two hundred little meshes is still one thing
  // to press.
  return {
    group,
    glowParts: baked.glowParts,
    movers: baked.movers,
    hit: makeHit(group, mod.size),
    tick: (t: number, st: ObjState) => { for (const f of ticks) f(t, st); },
  };
}

function makeHit(group: THREE.Group, size: Landmark['size']): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(size.w, size.h, size.d),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  m.position.y = size.h / 2;
  group.add(m);
  return m;
}
