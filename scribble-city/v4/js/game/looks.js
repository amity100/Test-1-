// Appearance of doodle characters: who they are (clothes, hair, face) and how they were drawn
// (as if a different kid had doodled each one in the margin: pen colour, line, fill, proportions).
// (how each character was drawn: kept for the code that reads it; the people are all drawn with
// the same pens now)
const FILL = { PENCIL: 0, MARKER: 1, HATCH: 2, SCRIBBLE: 3, FLAT: 4, PAPER: 5 };
const OUTLINE = { SOLID: 0, BROKEN: 1, DOUBLE: 2, SKETCHY: 3 };
export { FILL, OUTLINE };

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

// Every woman in the city dresses the way women dress in a city today - jeans and wide trousers,
// hoodies, blazers, denim and trench coats, sneakers and boots - and nothing revealing: sleeves
// to the wrist, never shorts, a tank top or a bare midriff. (No old-fashioned long dresses: a
// skirt is a midi skirt, worn with boots.)
const BOOT_COLS = [[0.12, 0.1, 0.1], [0.36, 0.24, 0.17], [0.55, 0.4, 0.26], [0.92, 0.9, 0.86]];
export function modest(L) {
  if (!L || !L.fem) return L;
  const t = L.top;
  const b = L.bottom;
  if (t) {
    if (t.kind === 'tank') t.kind = 'tee';
    if (t.kind === 'dress') {
      // (a dress becomes a blouse of its colour over wide trousers)
      t.kind = 'blouse';
      L.bottom = { kind: 'wide', color: pick([[0.12, 0.12, 0.14], [0.92, 0.9, 0.84], [0.33, 0.42, 0.6], [0.5, 0.45, 0.4]]) };
    }
    t.sleeves = 'long';
  }
  if (b && L.bottom === b) {
    if (b.kind === 'shorts') L.bottom = { kind: 'wide', color: b.color };
    else if (b.kind === 'skirt' || b.kind === 'dress') L.bottom = { kind: 'midi', color: b.color };
  }
  if (L.bottom.kind === 'midi' && !L.boots) L.boots = pick(BOOT_COLS);
  if (L.boots) L.shoes = L.boots;
  return L;
}

// ------------------------------------------------------------------ the hero
export function heroLook() {
  // the hero of the evening: white tee, grey cargo trousers, white sneakers, a black cap
  const L = baseLook({ pen: 'fineliner' });
  L.pen.width = 3.0;
  L.skin = [0.62, 0.43, 0.32];
  L.hair = { style: 'short', color: [0.1, 0.08, 0.07] };
  L.top = { kind: 'tee', color: [0.97, 0.96, 0.93], sleeves: 'short' };
  L.bottom = { kind: 'baggy', color: [0.36, 0.36, 0.39] };
  L.shoes = [0.96, 0.96, 0.95];
  L.hat = { kind: 'cap', color: [0.09, 0.09, 0.11] };
  L.face = { eyes: 'dot', brows: 'flat', mouth: 'line', beard: null, glasses: null };
  L.acc = [];
  L.hero = true;
  return modest(L);
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
    return modest(L);
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
    return modest(L);
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
    return modest(L);
  }
  // (ROADMAP 6.5) the Erasers: in a school eraser's colours - pink and white, a blue stripe
  if (kind === 'eraser') {
    const L = baseLook({ pen: pick(['fineliner', 'marker', 'comic']), build: pick(['normal', 'stocky', 'lanky']), fem: chance(0.25) });
    L.top = { kind: 'hoodie', color: pick([[0.98, 0.62, 0.7], [0.96, 0.96, 0.94]]), sleeves: 'long', hoodUp: chance(0.35) };
    L.bottom = { kind: 'baggy', color: pick([[0.3, 0.45, 0.85], [0.96, 0.96, 0.94]]) };
    L.shoes = [0.98, 0.62, 0.7];
    L.hair = { style: pick(['buzz', 'short', 'none']), color: pick(HAIR.slice(0, 4)) };
    if (!L.top.hoodUp) L.hat = chance(0.6) ? { kind: pick(['beanie', 'capBack']), color: [0.98, 0.62, 0.7] } : null;
    L.bandana = [0.3, 0.45, 0.85];
    if (chance(0.5)) L.acc.push('bandanaMouth');
    L.face = { eyes: pick(['dot', 'angry', 'narrow']), brows: 'angry', mouth: pick(['line', 'smirk']), beard: null, glasses: chance(0.2) ? 'shades' : null };
    return modest(L);
  }
  // masked robbers
  const L = baseLook({ pen: pick(['fineliner', 'comic']), build: pick(['normal', 'lanky']) });
  L.top = { kind: 'jacket', color: pick([[0.16, 0.16, 0.2], [0.3, 0.3, 0.33], [0.25, 0.3, 0.22]]), sleeves: 'long', inner: [0.9, 0.9, 0.88] };
  L.bottom = { kind: 'pants', color: pick(DARK) };
  L.shoes = [0.15, 0.15, 0.17];
  L.hat = { kind: 'skimask', color: pick([[0.12, 0.12, 0.14], [0.55, 0.15, 0.15], [0.2, 0.3, 0.2]]) };
  L.hair = { style: 'none', color: L.skin };
  L.face = { eyes: 'dot', brows: 'none', mouth: 'none', beard: null, glasses: null };
  return modest(L);
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
  return modest(L);
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
  return modest(L);
}

// ------------------------------------------------------------------ city people
// The way people dress in a city now: blazers and trench coats, oversized hoodies and bomber
// jackets, denim, wide-leg trousers and long pleated skirts, white sneakers, crossbody bags,
// caps and bucket hats. The women dress modestly (long sleeves, skirts and dresses to the ankle,
// never a bare midriff) and in fashion.
const NEUTRAL = [[0.95, 0.94, 0.9], [0.12, 0.12, 0.14], [0.78, 0.66, 0.5], [0.5, 0.45, 0.4], [0.36, 0.4, 0.3], [0.62, 0.64, 0.66], [0.22, 0.24, 0.34], [0.9, 0.84, 0.72]];
const PASTEL = [[0.8, 0.72, 0.92], [0.7, 0.9, 0.82], [0.72, 0.84, 0.96], [0.98, 0.9, 0.62], [0.98, 0.78, 0.82], [0.95, 0.82, 0.7]];
const MODERN = [[0.56, 0.66, 0.52], [0.8, 0.42, 0.3], [0.2, 0.25, 0.42], [0.62, 0.46, 0.72], [0.86, 0.66, 0.26], [0.52, 0.16, 0.22], [0.25, 0.48, 0.5], [0.12, 0.12, 0.14]];
const CAMEL = [[0.78, 0.6, 0.4], [0.86, 0.76, 0.6], [0.12, 0.12, 0.14], [0.5, 0.52, 0.4], [0.9, 0.86, 0.78]];
const SNEAKERS = [[0.97, 0.97, 0.96], [0.97, 0.97, 0.96], [0.97, 0.97, 0.96], [0.12, 0.12, 0.14], [0.9, 0.45, 0.4], [0.5, 0.62, 0.9]];
const BOOTS = [[0.12, 0.1, 0.1], [0.45, 0.3, 0.2], [0.55, 0.4, 0.26]];
const BAGS = [[0.12, 0.11, 0.13], [0.6, 0.42, 0.28], [0.92, 0.88, 0.8], [0.62, 0.2, 0.26], [0.8, 0.72, 0.92]];

export function civilianLook(o = {}) {
  const fem = o.fem !== undefined ? o.fem : chance(0.5);
  const pen = o.pen || pick(['fineliner', 'fineliner', 'ballpoint', 'marker', 'pencil', 'comic']);
  const L = baseLook({ pen, build: o.build || pick(['normal', 'normal', 'normal', 'lanky', 'stocky']), fem });
  // (the older wardrobe's names still work, dressed the new way)
  const OLD = { casual: 'street', dress: fem ? 'chic' : 'smart', artsy: fem ? 'knit' : 'denim', worker: fem ? 'street' : 'worker', summer: fem ? 'street' : 'summer', bomber: fem ? 'puffer' : 'bomber' };
  let kind = o.kind || pick(fem ? ['street', 'street', 'chic', 'denim', 'trench', 'knit', 'puffer', 'sporty', 'office', 'smart'] : ['street', 'street', 'smart', 'denim', 'bomber', 'office', 'sporty', 'summer', 'worker', 'puffer']);
  kind = OLD[kind] || kind;
  L.shoes = pick(SNEAKERS);
  // jeans in every wash, black jeans, cargo, chinos
  const JEANS = [...DENIM, [0.12, 0.12, 0.14], [0.55, 0.65, 0.8]];
  const TROUSERS = [[0.12, 0.12, 0.14], [0.92, 0.9, 0.84], [0.78, 0.7, 0.56], [0.5, 0.45, 0.4], [0.36, 0.4, 0.3], [0.45, 0.46, 0.5]];
  // what a modern woman wears below: mostly jeans and wide trousers, now and then a midi skirt
  // with boots
  const herBottom = (skirtChance = 0.15) => {
    if (chance(skirtChance)) {
      L.boots = pick(BOOTS);
      return { kind: 'midi', color: pick([...NEUTRAL, ...MODERN]) };
    }
    return chance(0.5) ? { kind: 'wide', color: pick(chance(0.5) ? JEANS : TROUSERS) } : { kind: chance(0.25) ? 'cargo' : 'pants', color: pick(JEANS) };
  };
  if (kind === 'chic') {
    L.top = { kind: 'blazer', color: pick(CAMEL), sleeves: 'long', inner: pick([[0.96, 0.95, 0.92], [0.12, 0.12, 0.14], [0.9, 0.84, 0.72]]) };
    L.bottom = fem ? herBottom(0.2) : { kind: 'pants', color: pick(TROUSERS) };
    L.shoes = chance(0.6) ? [0.97, 0.97, 0.96] : [0.12, 0.1, 0.1];
    L.acc.push(fem ? 'handbag' : 'bag');
    if (chance(0.35)) L.face.glasses = 'shades';
  } else if (kind === 'street') {
    L.top = { kind: pick(['hoodie', 'sweatshirt', 'oversized']), color: pick(fem ? [...PASTEL, ...NEUTRAL, ...MODERN] : [...NEUTRAL, ...MODERN]), sleeves: fem ? 'long' : pick(['long', 'short']) };
    L.bottom = fem ? herBottom(0.08) : { kind: pick(['cargo', 'pants', 'baggy']), color: pick([[0.36, 0.4, 0.3], [0.12, 0.12, 0.14], [0.78, 0.7, 0.56], [0.45, 0.46, 0.5], ...DENIM]) };
    if (chance(0.45)) L.acc.push('crossbody');
    if (chance(0.35)) L.hat = { kind: pick(['cap', 'bucket', 'beanie', 'capBack']), color: pick([...NEUTRAL, ...MODERN]) };
    if (chance(0.2)) L.acc.push('headphones');
  } else if (kind === 'denim') {
    L.top = { kind: 'denim', color: pick(DENIM), sleeves: 'long', inner: pick([[0.96, 0.95, 0.92], [0.12, 0.12, 0.14], ...PASTEL]) };
    if (fem) {
      L.bottom = chance(0.6) ? { kind: 'pants', color: pick([[0.12, 0.12, 0.14], [0.92, 0.9, 0.84]]) } : { kind: 'wide', color: pick(TROUSERS) };
      L.acc.push('tote');
    } else {
      L.bottom = { kind: 'pants', color: pick([[0.12, 0.12, 0.14], [0.78, 0.7, 0.56]]) };
      L.shoes = pick(BOOTS);
    }
  } else if (kind === 'trench') {
    L.top = { kind: 'trench', color: pick([[0.78, 0.66, 0.48], [0.86, 0.78, 0.62], [0.12, 0.12, 0.14], [0.5, 0.52, 0.4]]), sleeves: 'long', inner: pick([[0.96, 0.95, 0.92], [0.12, 0.12, 0.14]]) };
    L.bottom = chance(0.55) ? { kind: 'pants', color: pick(JEANS) } : { kind: 'wide', color: pick(TROUSERS) };
    L.shoes = pick(BOOTS);
    L.acc.push(fem ? 'handbag' : 'bag');
    if (chance(0.3)) L.face.glasses = 'shades';
  } else if (kind === 'knit') {
    L.top = { kind: 'cardigan', color: pick([...PASTEL, [0.9, 0.84, 0.72], [0.62, 0.46, 0.36]]), sleeves: 'long', inner: pick([[0.96, 0.95, 0.92], ...PASTEL]) };
    L.bottom = fem ? herBottom(0.25) : { kind: 'pants', color: pick(JEANS) };
    L.shoes = pick([[0.12, 0.1, 0.1], [0.97, 0.97, 0.96], [0.6, 0.42, 0.28]]);
    L.acc.push('tote');
    L.face.glasses = chance(0.3) ? 'round' : null;
  } else if (kind === 'puffer') {
    L.top = { kind: 'puffer', color: pick([[0.12, 0.12, 0.14], [0.92, 0.9, 0.84], ...PASTEL, [0.36, 0.4, 0.3], [0.86, 0.66, 0.26]]), sleeves: 'long' };
    L.bottom = fem ? herBottom(0.05) : { kind: 'pants', color: pick([[0.12, 0.12, 0.14], [0.45, 0.46, 0.5], ...DENIM]) };
    if (chance(0.35)) L.hat = { kind: 'beanie', color: pick([...NEUTRAL, ...MODERN]) };
    if (chance(0.4)) L.acc.push('crossbody');
  } else if (kind === 'smart') {
    L.top = { kind: 'overshirt', color: pick([[0.5, 0.52, 0.4], [0.78, 0.6, 0.4], [0.22, 0.24, 0.34], [0.52, 0.16, 0.22], [0.45, 0.46, 0.5], [0.95, 0.94, 0.9], [0.72, 0.84, 0.96]]), sleeves: 'long', inner: pick([[0.96, 0.95, 0.92], [0.12, 0.12, 0.14]]) };
    L.bottom = fem ? { kind: 'wide', color: pick(JEANS) } : { kind: 'pants', color: pick([[0.86, 0.78, 0.62], [0.22, 0.24, 0.34], [0.12, 0.12, 0.14]]) };
    L.shoes = chance(0.5) ? [0.97, 0.97, 0.96] : pick(BOOTS);
    if (fem && chance(0.4)) L.acc.push('crossbody');
  } else if (kind === 'bomber') {
    L.top = { kind: 'bomber', color: pick([[0.12, 0.12, 0.14], [0.36, 0.4, 0.3], [0.2, 0.25, 0.42], [0.52, 0.16, 0.22]]), sleeves: 'long', inner: pick([[0.96, 0.95, 0.92], [0.45, 0.46, 0.5]]) };
    L.bottom = { kind: 'pants', color: pick([[0.12, 0.12, 0.14], [0.45, 0.46, 0.5], ...DENIM]) };
    if (chance(0.3)) L.hat = { kind: 'beanie', color: pick(NEUTRAL) };
  } else if (kind === 'summer') {
    L.top = { kind: pick(['polo', 'tee', 'oversized']), color: pick([...PASTEL, ...BRIGHT, [0.96, 0.95, 0.92]]), sleeves: 'short' };
    L.bottom = chance(0.5) ? { kind: 'shorts', color: pick([[0.86, 0.78, 0.62], [0.22, 0.24, 0.34], [0.5, 0.52, 0.4]]) } : { kind: 'pants', color: pick([[0.86, 0.78, 0.62], [0.95, 0.94, 0.9]]) };
    if (chance(0.5)) L.face.glasses = 'shades';
    if (chance(0.3)) L.hat = { kind: pick(['cap', 'bucket']), color: pick(NEUTRAL) };
  } else if (kind === 'office') {
    const suit = pick([[0.2, 0.22, 0.3], [0.3, 0.3, 0.33], [0.5, 0.45, 0.4], [0.16, 0.16, 0.18], [0.78, 0.66, 0.5]]);
    L.top = { kind: fem ? 'blazer' : 'suit', color: suit, sleeves: 'long', shirt: pick([[0.95, 0.95, 0.94], [0.72, 0.84, 0.96]]), tie: fem || chance(0.5) ? null : pick(MODERN) };
    L.bottom = fem ? (chance(0.25) ? { kind: 'midi', color: suit } : { kind: 'wide', color: suit }) : { kind: 'pants', color: suit };
    if (L.bottom.kind === 'midi') L.boots = pick(BOOTS);
    L.shoes = pick([[0.1, 0.08, 0.07], [0.3, 0.2, 0.14], [0.97, 0.97, 0.96]]);
    L.acc.push(fem ? 'handbag' : 'bag');
  } else if (kind === 'sporty') {
    const c = pick([...MODERN, ...BRIGHT]);
    L.top = { kind: 'track', color: c, sleeves: 'long' };
    L.bottom = { kind: 'pants', color: chance(0.5) ? c : pick(DARK) };
    L.hat = chance(0.4) ? { kind: 'cap', color: pick(BRIGHT) } : null;
    if (chance(0.4)) L.acc.push('headphones');
  } else {
    L.top = { kind: 'vest', color: [0.95, 0.55, 0.15], sleeves: 'short', under: pick([[0.9, 0.9, 0.88], [0.3, 0.42, 0.6]]) };
    L.bottom = { kind: 'pants', color: pick(DENIM) };
    L.hat = chance(0.6) ? { kind: 'hardhat', color: [0.96, 0.8, 0.2] } : null;
    L.shoes = [0.4, 0.3, 0.2];
  }
  L.bagColor = pick(BAGS);
  L.hair = fem
    ? { style: pick(['long', 'long', 'ponytail', 'bun', 'bob', 'curly', 'long', 'braids']), color: pick(HAIR) }
    : { style: pick(['short', 'short', 'buzz', 'curly', 'messy', 'pompadour', 'short', 'afro']), color: pick(HAIR) };
  L.face = {
    eyes: pick(fem ? ['oval', 'lashes', 'dot'] : ['dot', 'oval', 'dot', 'narrow']),
    brows: pick(['flat', 'up', 'flat']),
    mouth: pick(['line', 'smile', 'smile', 'smirk']),
    beard: !fem && chance(0.3) ? pick(['stubble', 'full', 'goatee', 'stubble']) : null,
    glasses: L.face.glasses || (chance(0.12) ? pick(['round', 'square']) : null),
  };
  if (fem && chance(0.5)) L.acc.push('earrings');
  if (fem && chance(0.5)) L.face.lips = pick([[0.78, 0.2, 0.26], [0.65, 0.3, 0.35]]);
  return modest(L);
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
  return modest(L);
}

export const BAR_STYLE_NAMES = Object.keys(BAR_STYLES);

// the club's bouncer: big, all in black, shades after dark
export function bouncerLook() {
  const L = baseLook({ pen: 'marker', build: 'big' });
  L.top = { kind: 'bomber', color: [0.08, 0.08, 0.1], sleeves: 'long', inner: [0.1, 0.1, 0.12] };
  L.bottom = { kind: 'pants', color: [0.08, 0.08, 0.1] };
  L.shoes = [0.06, 0.06, 0.08];
  L.hair = { style: 'buzz', color: [0.1, 0.08, 0.07] };
  L.skin = pick(SKIN);
  L.face = { eyes: 'narrow', brows: 'angry', mouth: 'line', beard: chance(0.5) ? 'stubble' : null, glasses: 'shades' };
  L.acc = [];
  return L;
}

// the bartender: white shirt, black vest, a proud moustache
export function bartenderLook() {
  const L = baseLook({ pen: 'fineliner', build: 'stocky' });
  L.top = { kind: 'vest', color: [0.12, 0.12, 0.14], sleeves: 'long', under: [0.96, 0.95, 0.92] };
  L.bottom = { kind: 'pants', color: [0.14, 0.14, 0.16] };
  L.shoes = [0.1, 0.08, 0.07];
  L.hair = { style: 'slick', color: [0.15, 0.12, 0.1] };
  L.face = { eyes: 'dot', brows: 'up', mouth: 'smile', beard: 'mustache', glasses: null };
  return modest(L);
}

// ------------------------------------------------------------------ people at work on the street
const WHITE = [0.97, 0.96, 0.93];
export function shopkeeperLook(kind) {
  const fem = chance(0.45);
  const L = civilianLook({ fem, kind: 'casual', pen: pick(['fineliner', 'ballpoint', 'marker', 'comic', 'sepia']) });
  L.acc = L.acc.filter((a) => a === 'earrings');
  const apron = (c) => {
    L.apron = c;
  };
  switch (kind) {
    case 'pizza':
    case 'bagel':
      L.top = { kind: 'tee', color: WHITE, sleeves: 'short' };
      L.bottom = { kind: 'pants', color: [0.2, 0.2, 0.24] };
      L.hat = { kind: 'toque', color: WHITE };
      apron([0.95, 0.94, 0.9]);
      if (!fem) L.face.beard = 'mustache';
      break;
    case 'cafe':
      L.top = { kind: 'tee', color: [0.16, 0.16, 0.19], sleeves: 'short' };
      L.bottom = { kind: 'pants', color: [0.16, 0.16, 0.19] };
      L.hat = chance(0.5) ? { kind: 'beanie', color: pick(BRIGHT) } : null;
      apron([0.55, 0.36, 0.22]);
      break;
    case 'grocery':
    case 'deli':
    case 'falafel':
      L.top = { kind: 'tee', color: pick(BRIGHT), sleeves: 'short' };
      L.hat = { kind: 'cap', color: pick(BRIGHT) };
      apron(kind === 'deli' ? WHITE : [0.3, 0.55, 0.32]);
      break;
    case 'flowers':
      L.top = { kind: 'sweater', color: pick(BRIGHT), sleeves: 'long' };
      apron([0.35, 0.58, 0.36]);
      break;
    case 'barber':
      L.top = { kind: 'tee', color: WHITE, sleeves: 'short' };
      L.bottom = { kind: 'pants', color: [0.14, 0.14, 0.16] };
      L.hair = { style: 'pompadour', color: pick([[0.12, 0.1, 0.09], [0.22, 0.15, 0.1]]) };
      if (!fem) L.face.beard = pick(['mustache', 'goatee']);
      break;
    case 'books':
      L.top = { kind: 'sweater', color: pick([[0.45, 0.36, 0.28], [0.3, 0.4, 0.32], [0.55, 0.25, 0.25]]), sleeves: 'long' };
      L.face.glasses = 'round';
      break;
    case 'icecream':
      L.top = { kind: 'tee', color: [0.98, 0.72, 0.8], sleeves: 'short' };
      L.hat = { kind: 'cap', color: WHITE };
      apron(WHITE);
      break;
    case 'hardware':
      L.top = { kind: 'vest', color: [0.95, 0.55, 0.15], sleeves: 'short', under: [0.3, 0.42, 0.6] };
      L.hat = { kind: 'hardhat', color: [0.96, 0.8, 0.2] };
      break;
    case 'gym':
      L.build = { height: 1.05, head: 0.98, bulk: 1.4, limbs: 1.35 };
      L.top = { kind: 'tank', color: pick(BRIGHT), sleeves: 'none' };
      L.bottom = { kind: 'pants', color: [0.16, 0.16, 0.19] };
      L.hair = { style: 'buzz', color: pick(HAIR) };
      break;
    case 'music':
      L.top = { kind: 'jacket', color: pick([[0.3, 0.3, 0.34], [0.45, 0.3, 0.2]]), sleeves: 'long', inner: pick(BRIGHT) };
      L.hat = { kind: 'beanie', color: pick(BRIGHT) };
      if (!fem) L.face.beard = 'stubble';
      break;
    case 'sushi':
      L.top = { kind: 'tee', color: WHITE, sleeves: 'short' };
      L.hat = { kind: 'bandanaHead', color: [0.75, 0.15, 0.18] };
      apron([0.2, 0.2, 0.3]);
      break;
    case 'friends':
      // the girl who sells the magic pencils: a pink sweater, a beret, an apron of every colour
      L.fem = true;
      L.top = { kind: 'sweater', color: [0.98, 0.68, 0.78], sleeves: 'long' };
      L.bottom = { kind: 'wide', color: [0.42, 0.5, 0.72] };
      L.hat = { kind: 'beret', color: [0.85, 0.2, 0.35] };
      L.hair = { style: pick(['long', 'ponytail', 'curly']), color: pick(HAIR) };
      L.face.beard = null;
      L.face.mouth = 'smile';
      apron([0.98, 0.94, 0.86]);
      break;
    case 'lobby':
      L.top = { kind: fem ? 'blazer' : 'suit', color: [0.16, 0.2, 0.32], sleeves: 'long', shirt: [0.95, 0.95, 0.94], tie: fem ? null : [0.62, 0.12, 0.14] };
      L.bottom = { kind: 'pants', color: [0.16, 0.2, 0.32] };
      L.hat = { kind: 'cap', color: [0.16, 0.2, 0.32] };
      break;
    case 'pharmacy':
    case 'optics':
      L.top = { kind: 'blazer', color: WHITE, sleeves: 'long', shirt: [0.6, 0.75, 0.9] };
      L.face.glasses = kind === 'optics' ? pick(['round', 'square']) : L.face.glasses;
      break;
    default:
      L.top = { kind: 'tee', color: pick(BRIGHT), sleeves: 'short' };
      apron(pick([[0.3, 0.42, 0.6], [0.55, 0.36, 0.22]]));
      break;
  }
  return modest(L);
}

// somebody drawn with a magic pencil at a DRAW YOURSELF A FRIEND stand: a nice, ordinary woman,
// dressed like everybody else (in fashion, nothing revealing)
export function friendLook() {
  const L = civilianLook({ fem: true, kind: pick(['chic', 'street', 'knit', 'denim', 'trench', 'puffer']) });
  L.face.mouth = 'smile';
  L.face.eyes = pick(['lashes', 'oval', 'anime']);
  L.hair = { style: pick(['long', 'long', 'ponytail', 'bun', 'curly', 'bob']), color: L.hair.color };
  return modest(L);
}

// a kid (drawn with fewer, rounder lines)
export function kidLook(fem = chance(0.5)) {
  const L = civilianLook({ fem, kind: 'casual', build: 'chibi', pen: pick(['fineliner', 'gelPurple', 'ballpoint', 'marker']) });
  L.face.beard = null;
  L.face.lips = null;
  L.face.eyes = fem ? pick(['oval', 'anime']) : pick(['dot', 'oval']);
  L.face.mouth = 'smile';
  L.top = { kind: chance(0.5) ? 'tee' : 'hoodie', color: pick(BRIGHT), sleeves: 'short' };
  L.bottom = fem ? { kind: 'pants', color: pick([...DENIM, [0.95, 0.55, 0.65], [0.6, 0.45, 0.8]]) } : { kind: chance(0.5) ? 'shorts' : 'pants', color: pick(DENIM) };
  L.hair = fem ? { style: 'short', color: pick(HAIR.slice(0, 5)) } : { style: pick(['short', 'messy', 'curly']), color: pick(HAIR.slice(0, 5)) };
  L.acc = [];
  L.hat = null;
  return modest(L);
}

// grandma and grandpa
export function elderLook(fem) {
  const L = civilianLook({ fem, kind: 'casual', pen: pick(['pencil', 'sepia', 'ballpoint']) });
  const grey = pick([[0.78, 0.78, 0.8], [0.9, 0.9, 0.88], [0.62, 0.62, 0.65]]);
  L.top = { kind: 'sweater', color: pick([[0.55, 0.45, 0.35], [0.45, 0.5, 0.6], [0.6, 0.35, 0.38], [0.4, 0.5, 0.4]]), sleeves: 'long' };
  L.top.kind = fem ? 'cardigan' : 'sweater';
  L.top.inner = [0.95, 0.94, 0.9];
  L.bottom = fem ? (chance(0.5) ? { kind: 'midi', color: pick([[0.3, 0.3, 0.38], [0.4, 0.3, 0.3]]) } : { kind: 'wide', color: pick([[0.3, 0.3, 0.38], [0.5, 0.45, 0.4]]) }) : { kind: 'pants', color: pick([[0.4, 0.38, 0.35], [0.3, 0.3, 0.34]]) };
  if (fem) L.boots = [0.2, 0.16, 0.14];
  L.hair = fem ? { style: 'bun', color: grey } : { style: pick(['short', 'none']), color: grey };
  L.face = { eyes: 'dot', brows: 'up', mouth: 'smile', beard: !fem && chance(0.6) ? 'mustache' : null, glasses: fem ? 'round' : null };
  L.hat = !fem && chance(0.5) ? { kind: 'cap', color: [0.45, 0.42, 0.38] } : null;
  L.acc = fem ? ['earrings'] : [];
  return modest(L);
}

// the street painter: beret, striped shirt, paint on the apron
export function painterLook() {
  const L = civilianLook({ fem: chance(0.4), kind: 'artsy', pen: 'marker' });
  L.top = { kind: 'tee', color: [0.95, 0.95, 0.92], sleeves: 'long' };
  L.bottom = { kind: 'pants', color: [0.25, 0.28, 0.4] };
  L.hat = { kind: 'beret', color: [0.75, 0.18, 0.2] };
  L.apron = [0.85, 0.8, 0.7];
  L.acc = ['scarf'];
  return modest(L);
}
