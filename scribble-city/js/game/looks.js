// Appearance of doodle characters: who they are (clothes, hair, face) and how they were drawn
// (as if a different kid had doodled each one in the margin: pen colour, line, fill, proportions).
import { FILL, OUTLINE } from '../render/bodies.js';

const R = Math.random;
const pick = (a) => a[Math.floor(R() * a.length)];
const chance = (p) => R() < p;
const jit = (c, a = 0.05) => c.map((v) => Math.max(0, Math.min(1, v + (R() - 0.5) * a)));

export const SKIN = [
  [0.97, 0.86, 0.75], [0.93, 0.78, 0.64], [0.86, 0.68, 0.52], [0.76, 0.56, 0.4],
  [0.63, 0.44, 0.31], [0.5, 0.34, 0.24], [0.98, 0.9, 0.82], [0.9, 0.75, 0.58],
];
const HAIR = [[0.12, 0.1, 0.09], [0.22, 0.15, 0.1], [0.42, 0.28, 0.16], [0.7, 0.55, 0.32], [0.86, 0.72, 0.45], [0.55, 0.22, 0.14], [0.6, 0.6, 0.62], [0.9, 0.9, 0.88]];
const DENIM = [[0.33, 0.42, 0.6], [0.25, 0.3, 0.45], [0.45, 0.55, 0.72], [0.18, 0.2, 0.26]];
const DARK = [[0.16, 0.16, 0.19], [0.22, 0.22, 0.26], [0.3, 0.29, 0.32]];
const HOODIE = [[0.45, 0.46, 0.5], [0.16, 0.16, 0.19], [0.62, 0.18, 0.18], [0.2, 0.26, 0.45], [0.3, 0.42, 0.3], [0.85, 0.85, 0.82]];
const BRIGHT = [[0.86, 0.3, 0.32], [0.95, 0.72, 0.25], [0.3, 0.6, 0.85], [0.5, 0.75, 0.45], [0.7, 0.45, 0.8], [0.95, 0.55, 0.65], [0.95, 0.95, 0.92], [0.25, 0.65, 0.65]];
const GOLD = [0.86, 0.66, 0.18];

// How the character was drawn.
export const PENS = {
  fineliner: { ink: [0.06, 0.06, 0.08], width: 2.6, outline: OUTLINE.SOLID, fill: FILL.PENCIL, wobble: 0.018 },
  ballpoint: { ink: [0.13, 0.2, 0.55], width: 2.2, outline: OUTLINE.SOLID, fill: FILL.PENCIL, wobble: 0.025 },
  marker: { ink: [0.05, 0.05, 0.07], width: 3.4, outline: OUTLINE.SOLID, fill: FILL.MARKER, wobble: 0.012 },
  pencil: { ink: [0.3, 0.3, 0.33], width: 1.8, outline: OUTLINE.SKETCHY, fill: FILL.HATCH, wobble: 0.03 },
  gelPurple: { ink: [0.42, 0.2, 0.62], width: 2.3, outline: OUTLINE.DOUBLE, fill: FILL.PENCIL, wobble: 0.022 },
  gelGreen: { ink: [0.1, 0.42, 0.3], width: 2.3, outline: OUTLINE.DOUBLE, fill: FILL.SCRIBBLE, wobble: 0.025 },
  redPen: { ink: [0.72, 0.12, 0.16], width: 2.2, outline: OUTLINE.BROKEN, fill: FILL.SCRIBBLE, wobble: 0.03 },
  comic: { ink: [0.04, 0.04, 0.05], width: 3.8, outline: OUTLINE.SOLID, fill: FILL.FLAT, wobble: 0.01, hatch: 0.8 },
  manga: { ink: [0.08, 0.08, 0.1], width: 2.0, outline: OUTLINE.SOLID, fill: FILL.FLAT, wobble: 0.012, hatch: 0.6 },
  sepia: { ink: [0.32, 0.2, 0.12], width: 2.4, outline: OUTLINE.SKETCHY, fill: FILL.MARKER, wobble: 0.02 },
};

const BUILDS = {
  normal: { height: 1, head: 1, bulk: 1, limbs: 1 },
  chibi: { height: 0.86, head: 1.45, bulk: 1.05, limbs: 0.92 },
  lanky: { height: 1.1, head: 0.95, bulk: 0.82, limbs: 0.8 },
  stocky: { height: 0.95, head: 1.02, bulk: 1.32, limbs: 1.25 },
  big: { height: 1.12, head: 1.05, bulk: 1.45, limbs: 1.4 },
};

function baseLook(o = {}) {
  const pen = PENS[o.pen || 'fineliner'];
  const build = BUILDS[o.build || 'normal'];
  return {
    pen: { ...pen },
    build: { ...build },
    fem: !!o.fem,
    skin: o.skin || pick(SKIN),
    hair: { style: 'short', color: pick(HAIR) },
    top: { kind: 'tee', color: pick(BRIGHT), sleeves: 'short' },
    bottom: { kind: 'pants', color: pick(DENIM) },
    shoes: [0.95, 0.95, 0.92],
    hat: null,
    face: { eyes: 'dot', brows: 'flat', mouth: 'line', beard: null, glasses: null },
    acc: [],
  };
}

// ------------------------------------------------------------------ the hero
export function heroLook() {
  const L = baseLook({ pen: 'fineliner' });
  L.pen.width = 3.3;
  L.pen.fill = FILL.PAPER;
  L.skin = [0.98, 0.97, 0.93];
  L.hair = { style: 'none', color: L.skin };
  L.top = { kind: 'tee', color: [0.98, 0.97, 0.93], sleeves: 'none' };
  L.bottom = { kind: 'pants', color: [0.98, 0.97, 0.93] };
  L.shoes = [0.1, 0.1, 0.12];
  L.face = { eyes: 'dot', brows: 'flat', mouth: 'line', beard: null, glasses: null };
  L.acc = ['headband'];
  L.hero = true;
  return L;
}

// ------------------------------------------------------------------ gangs (NY street crime, GTA flavour)
export function gangLook(kind = 'street') {
  if (kind === 'street') {
    const L = baseLook({ pen: pick(['fineliner', 'marker', 'comic', 'ballpoint']), build: pick(['normal', 'normal', 'stocky', 'lanky']) });
    const crew = pick([[0.72, 0.12, 0.14], [0.15, 0.3, 0.7]]); // red or blue crew
    L.top = chance(0.6) ? { kind: 'hoodie', color: pick(HOODIE), sleeves: 'long', hoodUp: chance(0.4) } : { kind: 'tank', color: pick([[0.95, 0.95, 0.93], [0.16, 0.16, 0.19]]), sleeves: 'none' };
    L.bottom = { kind: 'baggy', color: pick(DENIM) };
    L.shoes = pick([[0.96, 0.96, 0.94], [0.95, 0.95, 0.95], [0.2, 0.2, 0.22]]);
    L.hair = { style: pick(['buzz', 'short', 'cornrows', 'none']), color: pick(HAIR.slice(0, 3)) };
    if (!L.top.hoodUp) L.hat = chance(0.6) ? { kind: pick(['capBack', 'cap', 'beanie']), color: chance(0.5) ? crew : pick(DARK) } : null;
    if (chance(0.45)) L.acc.push('bandanaMouth');
    L.bandana = crew;
    if (chance(0.55)) L.acc.push('chain');
    if (chance(0.35)) L.acc.push('tattoo');
    L.face = { eyes: pick(['dot', 'angry', 'narrow']), brows: 'angry', mouth: pick(['line', 'frown', 'smirk']), beard: chance(0.3) ? 'stubble' : null, glasses: chance(0.25) ? 'shades' : null };
    return L;
  }
  if (kind === 'mob') {
    const L = baseLook({ pen: pick(['fineliner', 'sepia', 'comic']), build: pick(['normal', 'stocky', 'big']) });
    const suit = pick([[0.15, 0.15, 0.18], [0.3, 0.3, 0.34], [0.36, 0.28, 0.22]]);
    L.top = { kind: 'suit', color: suit, sleeves: 'long', shirt: [0.95, 0.94, 0.9], tie: pick([[0.7, 0.12, 0.15], [0.15, 0.15, 0.18], [0.85, 0.7, 0.2]]) };
    L.bottom = { kind: 'pants', color: suit };
    L.shoes = [0.1, 0.08, 0.07];
    L.hat = chance(0.65) ? { kind: 'fedora', color: pick([[0.18, 0.17, 0.18], [0.4, 0.33, 0.25]]) } : null;
    L.hair = { style: 'slick', color: pick(HAIR.slice(0, 3)) };
    L.face = { eyes: pick(['narrow', 'dot']), brows: 'angry', mouth: pick(['frown', 'smirk']), beard: chance(0.3) ? 'mustache' : null, glasses: chance(0.4) ? 'shades' : null };
    if (chance(0.4)) L.acc.push('cigar');
    if (chance(0.5)) L.acc.push('ring');
    return L;
  }
  if (kind === 'biker') {
    const L = baseLook({ pen: pick(['marker', 'comic', 'fineliner']), build: pick(['big', 'stocky']) });
    L.top = { kind: 'vest', color: [0.14, 0.12, 0.12], sleeves: 'none', under: pick([[0.9, 0.9, 0.88], [0.2, 0.2, 0.22]]) };
    L.bottom = { kind: 'pants', color: pick(DENIM) };
    L.shoes = [0.12, 0.1, 0.09];
    L.hair = { style: pick(['none', 'long', 'short']), color: pick(HAIR) };
    L.hat = chance(0.5) ? { kind: 'bandanaHead', color: pick([[0.72, 0.12, 0.14], [0.15, 0.15, 0.18]]) } : null;
    L.face = { eyes: 'narrow', brows: 'angry', mouth: 'frown', beard: pick(['full', 'goatee', 'full']), glasses: chance(0.5) ? 'shades' : null };
    L.acc.push('tattoo');
    if (chance(0.5)) L.acc.push('chain');
    return L;
  }
  // masked robbers
  const L = baseLook({ pen: pick(['fineliner', 'comic']), build: pick(['normal', 'lanky']) });
  L.top = { kind: 'jacket', color: pick([[0.16, 0.16, 0.2], [0.3, 0.3, 0.33], [0.25, 0.3, 0.22]]), sleeves: 'long', inner: [0.9, 0.9, 0.88] };
  L.bottom = { kind: 'pants', color: pick(DARK) };
  L.shoes = [0.15, 0.15, 0.17];
  L.hat = { kind: 'skimask', color: pick([[0.12, 0.12, 0.14], [0.55, 0.15, 0.15], [0.2, 0.3, 0.2]]) };
  L.hair = { style: 'none', color: L.skin };
  L.face = { eyes: 'dot', brows: 'none', mouth: 'none', beard: null, glasses: null };
  return L;
}

// ------------------------------------------------------------------ police
export function copLook() {
  const L = baseLook({ pen: pick(['fineliner', 'ballpoint', 'marker']), build: pick(['normal', 'stocky', 'normal', 'big']), fem: chance(0.3) });
  const navy = jit([0.16, 0.2, 0.38], 0.04);
  L.top = { kind: 'uniform', color: navy, sleeves: chance(0.5) ? 'short' : 'long' };
  L.bottom = { kind: 'pants', color: [0.12, 0.13, 0.2] };
  L.shoes = [0.08, 0.08, 0.1];
  L.hat = { kind: 'police', color: [0.12, 0.14, 0.26] };
  L.hair = L.fem ? { style: 'bun', color: pick(HAIR) } : { style: 'short', color: pick(HAIR) };
  L.face = { eyes: pick(['dot', 'narrow']), brows: 'angry', mouth: pick(['line', 'frown']), beard: !L.fem && chance(0.3) ? 'mustache' : null, glasses: chance(0.35) ? 'shades' : null };
  L.acc.push('badge', 'belt');
  return L;
}

// riot unit: helmet with a visor, padded vest
export function swatLook() {
  const L = baseLook({ pen: pick(['marker', 'fineliner', 'comic']), build: pick(['stocky', 'big', 'normal']), fem: chance(0.2) });
  const navy = jit([0.14, 0.16, 0.26], 0.03);
  L.top = { kind: 'vest', color: [0.2, 0.22, 0.3], under: navy, sleeves: 'long' };
  L.bottom = { kind: 'pants', color: [0.12, 0.13, 0.18] };
  L.shoes = [0.06, 0.06, 0.08];
  L.hat = { kind: 'helmet', color: [0.16, 0.18, 0.26] };
  L.hair = { style: 'short', color: pick(HAIR) };
  L.face = { eyes: 'narrow', brows: 'angry', mouth: 'line', beard: null, glasses: null };
  L.acc.push('badge', 'belt');
  return L;
}

// ------------------------------------------------------------------ city people
export function civilianLook(o = {}) {
  const fem = o.fem !== undefined ? o.fem : chance(0.5);
  const pen = o.pen || pick(['fineliner', 'fineliner', 'ballpoint', 'marker', 'pencil', 'comic']);
  const L = baseLook({ pen, build: o.build || pick(['normal', 'normal', 'normal', 'lanky', 'stocky']), fem });
  const kind = o.kind || pick(fem ? ['casual', 'dress', 'office', 'sporty', 'artsy'] : ['casual', 'office', 'sporty', 'artsy', 'worker']);
  if (kind === 'casual') {
    L.top = { kind: pick(['tee', 'tee', 'sweater', 'jacket']), color: pick(BRIGHT), sleeves: chance(0.5) ? 'short' : 'long', inner: pick(BRIGHT) };
    L.bottom = { kind: fem && chance(0.4) ? 'skirt' : 'pants', color: chance(0.6) ? pick(DENIM) : pick(BRIGHT) };
  } else if (kind === 'dress') {
    L.top = { kind: 'dress', color: pick(BRIGHT), sleeves: pick(['none', 'short']) };
    L.bottom = { kind: 'dress', color: L.top.color };
  } else if (kind === 'office') {
    const suit = pick([[0.2, 0.22, 0.3], [0.3, 0.3, 0.33], [0.5, 0.45, 0.4], [0.16, 0.16, 0.18]]);
    L.top = { kind: fem ? 'blazer' : 'suit', color: suit, sleeves: 'long', shirt: [0.95, 0.95, 0.94], tie: fem ? null : pick(BRIGHT) };
    L.bottom = { kind: fem && chance(0.5) ? 'skirt' : 'pants', color: suit };
    L.shoes = pick([[0.1, 0.08, 0.07], [0.3, 0.2, 0.14]]);
    if (chance(0.4)) L.acc.push('bag');
  } else if (kind === 'sporty') {
    const c = pick(BRIGHT);
    L.top = { kind: 'track', color: c, sleeves: 'long' };
    L.bottom = { kind: 'pants', color: chance(0.5) ? c : pick(DARK) };
    L.hat = chance(0.4) ? { kind: 'cap', color: pick(BRIGHT) } : null;
    if (chance(0.4)) L.acc.push('headphones');
  } else if (kind === 'artsy') {
    L.top = { kind: pick(['sweater', 'tee']), color: pick(BRIGHT), sleeves: 'long' };
    L.bottom = { kind: fem && chance(0.4) ? 'skirt' : 'pants', color: pick(DARK) };
    L.hat = chance(0.5) ? { kind: 'beanie', color: pick(BRIGHT) } : null;
    L.face.glasses = chance(0.6) ? 'round' : null;
    if (chance(0.5)) L.acc.push('scarf');
  } else {
    L.top = { kind: 'vest', color: [0.95, 0.55, 0.15], sleeves: 'short', under: pick([[0.9, 0.9, 0.88], [0.3, 0.42, 0.6]]) };
    L.bottom = { kind: 'pants', color: pick(DENIM) };
    L.hat = chance(0.6) ? { kind: 'hardhat', color: [0.96, 0.8, 0.2] } : null;
    L.shoes = [0.4, 0.3, 0.2];
  }
  L.hair = fem
    ? { style: pick(['long', 'long', 'ponytail', 'bun', 'bob', 'curly', 'afro']), color: pick(HAIR) }
    : { style: pick(['short', 'short', 'buzz', 'curly', 'afro', 'none', 'messy', 'long']), color: pick(HAIR) };
  L.face = {
    eyes: pick(fem ? ['oval', 'lashes', 'dot', 'anime'] : ['dot', 'oval', 'dot', 'narrow']),
    brows: pick(['flat', 'up', 'flat']),
    mouth: pick(['line', 'smile', 'smile', 'o', 'smirk']),
    beard: !fem && chance(0.25) ? pick(['stubble', 'full', 'goatee', 'mustache']) : null,
    glasses: L.face.glasses || (chance(0.15) ? pick(['round', 'square']) : null),
  };
  if (fem && chance(0.4)) L.acc.push('earrings');
  if (fem && chance(0.5)) L.face.lips = pick([[0.78, 0.2, 0.26], [0.65, 0.3, 0.35]]);
  return L;
}

// Bar crowd: every patron drawn by a different hand.
export function patronLook(o = {}) {
  const pen = pick(Object.keys(PENS));
  const build = pick(['normal', 'normal', 'chibi', 'lanky', 'stocky']);
  return civilianLook({ ...o, pen, build, kind: o.kind || pick(['casual', 'casual', 'dress', 'artsy', 'office', 'sporty']) });
}

export { GOLD };

// ------------------------------------------------------------------ the bar crowd
// Each one looks like a different kid doodled them in the margin of their notebook.
const BAR_STYLES = {
  // a teenage girl's gel pens: big sparkly eyes, cute proportions
  gelGirl: () => {
    const L = civilianLook({ fem: true, pen: pick(['gelPurple', 'gelGreen']), build: 'chibi', kind: pick(['dress', 'casual', 'artsy']) });
    L.face.eyes = 'anime';
    L.face.mouth = pick(['smile', 'o']);
    L.face.lips = pick([[0.85, 0.3, 0.5], [0.7, 0.25, 0.45]]);
    L.hair = { style: pick(['long', 'ponytail', 'bun']), color: pick([[0.62, 0.32, 0.72], [0.95, 0.55, 0.7], [0.3, 0.2, 0.15], [0.9, 0.78, 0.45]]) };
    L.acc.push('earrings');
    return L;
  },
  // a teenage boy's comic-book marker: heavy outline, flat colours, cap backwards
  comicBoy: () => {
    const L = civilianLook({ fem: false, pen: 'comic', build: pick(['normal', 'stocky']), kind: pick(['sporty', 'casual']) });
    L.hat = { kind: 'capBack', color: pick(BRIGHT) };
    L.face.mouth = 'smirk';
    L.face.brows = 'up';
    return L;
  },
  // a guy sketching in blue ballpoint during class
  ballpointGuy: () => {
    const L = civilianLook({ fem: false, pen: 'ballpoint', build: pick(['lanky', 'normal']), kind: pick(['casual', 'artsy', 'office']) });
    L.face.beard = pick(['stubble', null, 'goatee']);
    return L;
  },
  // clean manga lines
  manga: () => {
    const fem = chance(0.6);
    const L = civilianLook({ fem, pen: 'manga', build: 'lanky', kind: 'office' });
    L.face.eyes = fem ? 'anime' : 'oval';
    L.hair = { style: fem ? pick(['long', 'bob']) : 'messy', color: pick([[0.12, 0.1, 0.12], [0.2, 0.25, 0.6], [0.9, 0.88, 0.85]]) };
    return L;
  },
  // art-school marker sketch
  artsy: () => {
    const fem = chance(0.5);
    const L = civilianLook({ fem, pen: 'marker', build: 'normal', kind: 'artsy' });
    L.face.glasses = pick(['round', 'square', null]);
    return L;
  },
  // grey pencil, a bit old-fashioned
  pencil: () => {
    const L = civilianLook({ fem: chance(0.4), pen: 'pencil', build: pick(['normal', 'stocky']), kind: 'office' });
    if (!L.fem && chance(0.6)) L.hat = { kind: 'fedora', color: [0.3, 0.28, 0.3] };
    return L;
  },
  // red pen punk
  punk: () => {
    const fem = chance(0.5);
    const L = civilianLook({ fem, pen: 'redPen', build: 'lanky', kind: 'casual' });
    L.top = { kind: 'jacket', color: [0.12, 0.12, 0.14], sleeves: 'long', inner: [0.85, 0.2, 0.25] };
    L.bottom = { kind: 'pants', color: [0.16, 0.16, 0.18] };
    L.hair = { style: fem ? 'bob' : 'messy', color: pick([[0.9, 0.2, 0.45], [0.2, 0.75, 0.6], [0.1, 0.1, 0.1]]) };
    L.acc.push('chain');
    return L;
  },
  // sepia, like an old sketchbook
  sepia: () => civilianLook({ fem: chance(0.5), pen: 'sepia', build: 'normal', kind: pick(['dress', 'office', 'casual']) }),
};

export function barLook(style, o = {}, tries = 0) {
  const L = (BAR_STYLES[style] || BAR_STYLES.ballpointGuy)();
  if (o.fem !== undefined && L.fem !== o.fem && tries < 8) return barLook(style, o, tries + 1);
  return L;
}

export const BAR_STYLE_NAMES = Object.keys(BAR_STYLES);

// the bartender: white shirt, black vest, a proud moustache
export function bartenderLook() {
  const L = baseLook({ pen: 'fineliner', build: 'stocky' });
  L.top = { kind: 'vest', color: [0.12, 0.12, 0.14], sleeves: 'long', under: [0.96, 0.95, 0.92] };
  L.bottom = { kind: 'pants', color: [0.14, 0.14, 0.16] };
  L.shoes = [0.1, 0.08, 0.07];
  L.hair = { style: 'slick', color: [0.15, 0.12, 0.1] };
  L.face = { eyes: 'dot', brows: 'up', mouth: 'smile', beard: 'mustache', glasses: null };
  return L;
}
