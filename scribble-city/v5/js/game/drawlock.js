// (round 15) What a new player can draw, till the jump off the roof (the prologue's scene 8).
//
// On foot: a short list - a few weapons, a few things to ride. Nothing is given for a touch: each is
// drawn by hand first, in the air, the way everything else is drawn (ui/freedraw.js, read against its
// picture as precisely as the catalog always reads - game/catmatch.js), and only then is it in the
// library, made with a touch from then on (ui/album.js early). The rest opens after the jump.
//
// On the car: the machine gun, the turbo and the armour. And gone from the car's pen in the story for
// good (not in the lab): the water kit, and whatever makes the car fly - wings, the helicopter's rotor,
// the balloon, the parachute; the turbo stays. The jump's own rotor, drawn by the story, is its own.

export const EARLY_KIT = {
  weapon: ['paint', 'stapler', 'rifle'],
  vehicle: ['scooter', 'bicycle', 'car'],
};
export const EARLY_IDS = [...EARLY_KIT.weapon, ...EARLY_KIT.vehicle];
// (game/itemcat.js ids)
export const EARLY_GEAR = ['mg', 'turbo', 'armor'];
const GONE_GEAR = new Set(['water', 'wing', 'rotor', 'balloon', 'chute']);
// (game/inkparts.js: the propeller is the water kit's)
const GONE_PAR = new Set(['wing', 'rotor', 'prop']);

const story = (game) => !!game && !game.lab && !game.classic;

export function gearGone(game, id) {
  return story(game) && GONE_GEAR.has(id);
}

export function parGone(game, type) {
  if (!story(game) || !GONE_PAR.has(type)) return false;
  // (the jump off the roof: the rotor the story has drawn on the car in the air)
  return !(type === 'rotor' && game.prologue && game.prologue.drawingRotor);
}

// the early list while it holds (ui/album.js setEarly)
export function isEarly(game) {
  return !!(game && game.album && game.album.early);
}
