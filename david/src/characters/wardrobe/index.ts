import * as THREE from 'three';
import type { Prop } from './Outfit';

/*
 * Wardrobe — clothing, accessories and hand props for the realistic humans (src/characters/human).
 *
 *   import { dressDavid, dressSaul, dressMan, attachProp } from './characters/wardrobe';
 *   const human = await HumanModel.load({ preset: 'david', quality: engine.quality.name });
 *   const outfit = await dressDavid(human, { quality: engine.quality.name });
 *   human.root.position.y = outfit.groundOffset;              // sandal soles
 *   attachProp(outfit.props.staff!, human.sockets.handGripL);  // props are NOT pre-attached
 *   human.setGripRadius(outfit.props.staff!.object.userData.radiusAtGrip);
 *   engine.enforceTextureBudget(human.root);
 *   // per frame, after human.update(dt, camera, h):
 *   outfit.update(dt, { velocity, wind });
 *
 * See README.md in this folder.
 */

export { dressDavid, type DressOptions } from './david';
export { dressSaul } from './saul';
export { dressMan, type CourtRole } from './court';
export { Outfit, type Prop, type OutfitProps, type OutfitStats } from './Outfit';

/** Parent a prop to a hand socket so that the prop's grip frame coincides with the socket frame. */
export function attachProp(prop: Prop, socket: THREE.Object3D, flip = false) {
  const o = prop.object;
  const gq = prop.grip.quaternion.clone();
  if (flip) gq.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI));
  const inv = gq.clone().invert();
  o.quaternion.copy(inv);
  o.position.copy(prop.grip.position).applyQuaternion(inv).negate();
  socket.add(o);
  return o;
}
export { dressSamuel, dressSaulGilgal, dressSoldier, dressArmourBearer, dressElder, dressPhilistine, soldierKitFor, type FilmDressOptions, type SoldierKit, type SoldierResult } from './film';
export { MeilTear, skinnedWorld } from './tear';
