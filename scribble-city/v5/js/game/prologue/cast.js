import { FOLK, FOLK_ON, LILY, SKINS, hexRGB } from '../../render/folkspec.js';
import { folkLook, civilianLook, modest } from '../looks.js';

// (v5, ROADMAP 18) The prologue's people: how each of them looks, for game/civilians.js
// spawnScripted(x, z, look, owner), and what they carry in their scenes.
//
// They are drawn as the city's people are (render/folkspec.js: LILY - her face, her hair and what is
// in it, her hoodie and her tee, her trousers, her shoes), each with a role of their own, so that the
// city never sends them walking its streets by themselves.

const LILY_K = FOLK.indexOf(LILY);
const BROWN = [0.5, 0.33, 0.2];

// Lily Cruz, nine, the hero's daughter, as her sheet has her. On top of her drawing, the rig's own
// shapes, as a hat or a bag is worn (game/doodle.js): her brown backpack, the patches sewn on it - a
// rocket's red, a yellow star, a blue one - and the little rabbit on its keyring. Far off she is the
// simple shapes of her look (render/people.js drawLow): a child's build, the ponytail, the purple
// hoodie open over the cream tee, the olive cargo trousers. (A phone makes only the first of the
// city's drawn people - render/folkspec.js FOLK_PHONE - she among them since round 11; the old way, dressed the
// same.)
export function lilyLook() {
  const L = LILY_K >= 0 && LILY_K < FOLK_ON.n ? folkLook(LILY_K) : lilyOldWay();
  L.hair.style = 'ponytail';
  L.bottom.kind = 'cargo';
  L.kid = true;
  L.backpack = {
    color: BROWN,
    flap: [0.42, 0.27, 0.16],
    strap: [0.36, 0.23, 0.14],
    patches: [[-0.055, 0.03, 0.024, 0.045, [0.86, 0.3, 0.24]], [0.06, -0.01, 0.03, 0.03, [0.95, 0.76, 0.19]], [0.0, -0.115, 0.032, 0.022, [0.29, 0.47, 0.82]]],
    toy: [0.94, 0.9, 0.84],
  };
  return L;
}

// (on a phone: the old way of drawing people, in her colours and her build)
function lilyOldWay() {
  const L = civilianLook({ fem: true, build: 'chibi', kind: 'casual', pen: 'fineliner', old: true });
  L.build = { ...LILY.build };
  L.skin = SKINS[LILY.skin].rgb.slice();
  L.hair = { style: 'ponytail', color: hexRGB(LILY.hair.base) };
  L.top = { kind: 'hoodie', color: hexRGB(LILY.top.base), sleeves: 'long', inner: hexRGB(LILY.inner.base) };
  L.bottom = { kind: 'cargo', color: hexRGB(LILY.bottom.base) };
  L.shoes = hexRGB(LILY.shoes.base);
  L.hat = null;
  L.face = { eyes: 'oval', brows: 'up', mouth: 'smile', beard: null, glasses: null };
  L.acc = [];
  return modest(L);
}

// (a Civilian or its figure)
const figOf = (who) => (who && who.fig ? who.fig : who);

// her sketchbook in her left hand, held shut by its edge in front of her hip, its cover out - violet,
// a spiral along its top, stars and a heart stuck on it, its pages' edges cream (game/carry.js
// 'sketchbook'); on false, put away
export function giveSketchbook(who, on = true) {
  const fig = figOf(who);
  if (!fig) return;
  if (on) {
    fig.carryL = 'sketchbook';
    fig.bookColor = [0.32, 0.3, 0.52];
  } else if (fig.carryL === 'sketchbook') fig.carryL = null;
}

// an ice cream cone in her right hand, held up in front of her (game/carry.js 'icecream'): a scoop of
// strawberry, or of the colour asked; on false, gone
export function giveIceCream(who, on = true, scoop = [0.98, 0.66, 0.74]) {
  const fig = figOf(who);
  if (!fig) return;
  if (on) {
    fig.carry = 'icecream';
    fig.scoopColor = scoop;
  } else if (fig.carry === 'icecream') fig.carry = null;
}
