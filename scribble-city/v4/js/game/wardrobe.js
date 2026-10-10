// (ROADMAP 5.7, not with ?classic) The wardrobe. The boutique dresses the hero: shirts, trousers,
// shoes, hats and the little things; the barber draws a tattoo on his forearm; the hardware store
// sells a vest of old notebook covers that takes most of a blow until it is worn through. Modest
// and modern: sleeves, and trousers to the shoes. What he wears is kept (the hero's look in
// game/streetlife.js, and the saves).

// what goes where on the body, and the sketch the shopkeeper draws of it (game/airsketch.js)
export const TOPS = [
  { name: 'טישרט לבנה', top: { kind: 'tee', color: [0.97, 0.96, 0.93], sleeves: 'short' } },
  { name: 'טישרט שחורה', top: { kind: 'tee', color: [0.13, 0.13, 0.15], sleeves: 'short' } },
  { name: 'טישרט אדומה', top: { kind: 'tee', color: [0.82, 0.2, 0.22], sleeves: 'short' } },
  { name: 'קפוצ\'ון אפור', top: { kind: 'hoodie', color: [0.55, 0.56, 0.6], sleeves: 'long' } },
  { name: 'סוודר ירוק', top: { kind: 'sweater', color: [0.3, 0.52, 0.38], sleeves: 'long' } },
  { name: 'ז\'קט ג\'ינס', top: { kind: 'jacket', color: [0.3, 0.42, 0.62], sleeves: 'long', inner: [0.95, 0.94, 0.9] } },
  { name: 'בלייזר כחול', top: { kind: 'blazer', color: [0.2, 0.22, 0.32], sleeves: 'long', inner: [0.96, 0.95, 0.92] } },
];
export const BOTTOMS = [
  { name: 'מכנסי דגמ"ח אפורים', bottom: { kind: 'baggy', color: [0.36, 0.36, 0.39] } },
  { name: 'ג\'ינס כחול', bottom: { kind: 'pants', color: [0.24, 0.33, 0.52] } },
  { name: 'מכנסיים שחורים', bottom: { kind: 'pants', color: [0.12, 0.12, 0.14] } },
  { name: 'צ\'ינו בז\'', bottom: { kind: 'pants', color: [0.78, 0.68, 0.5] } },
  { name: 'ג\'ינס רחב', bottom: { kind: 'baggy', color: [0.3, 0.4, 0.6] } },
];
export const SHOES = [
  { name: 'סניקרס לבנות', shoes: [0.96, 0.96, 0.95] },
  { name: 'סניקרס אדומות', shoes: [0.85, 0.2, 0.22] },
  { name: 'נעלי עור שחורות', shoes: [0.1, 0.08, 0.07] },
  { name: 'מגפיים חומים', shoes: [0.42, 0.28, 0.16] },
];
export const HATS = [
  { name: 'כובע מצחייה שחור', hat: { kind: 'cap', color: [0.09, 0.09, 0.11] } },
  { name: 'כובע מצחייה הפוך', hat: { kind: 'capBack', color: [0.95, 0.3, 0.45] } },
  { name: 'כובע גרב', hat: { kind: 'beanie', color: [0.85, 0.55, 0.2] } },
  { name: 'כובע רחב שוליים', hat: { kind: 'fedora', color: [0.94, 0.9, 0.82] } },
  { name: 'כומתה', hat: { kind: 'beret', color: [0.62, 0.42, 0.85] } },
  { name: 'בלי כובע', hat: null },
];
export const ACCS = [
  { name: 'שרשרת זהב', acc: 'chain' },
  { name: 'תיק צד', acc: 'crossbody' },
  { name: 'אוזניות', acc: 'headphones' },
  { name: 'צעיף', acc: 'scarf' },
  { name: 'בלי אביזרים', acc: null },
];
// tattoos: a little drawing on the right forearm (game/doodle.js); the sketch the barber draws
export const TATTOOS = [
  { name: 'עוגן', tattoo: 'anchor' },
  { name: 'לב', tattoo: 'heart' },
  { name: 'כוכב', tattoo: 'star' },
  { name: 'עיפרון', tattoo: 'pencil' },
  { name: 'להסיר את הקעקוע', tattoo: null },
];
// the strokes of each tattoo, across (u: from the elbow to the wrist, 0..1) and around (v: -1..1)
export const TATTOO_LINES = {
  anchor: [[[0.35, 0], [0.75, 0]], [[0.75, -0.7], [0.68, 0], [0.75, 0.7]], [[0.42, -0.45], [0.42, 0.45]], [[0.3, -0.18], [0.34, 0], [0.3, 0.18], [0.26, 0], [0.3, -0.18]]],
  heart: [[[0.72, 0], [0.5, -0.75], [0.36, -0.5], [0.42, 0], [0.36, 0.5], [0.5, 0.75], [0.72, 0]]],
  star: [[[0.3, 0], [0.72, 0.45], [0.48, -0.75], [0.48, 0.75], [0.72, -0.45], [0.3, 0]]],
  pencil: [[[0.3, -0.25], [0.66, -0.25], [0.78, 0], [0.66, 0.25], [0.3, 0.25], [0.3, -0.25]], [[0.66, -0.25], [0.66, 0.25]], [[0.38, -0.25], [0.38, 0.25]]],
};
export const TATTOO_INK = [0.16, 0.24, 0.5];

// the vest: over whatever the hero wears; the sleeves stay his shirt's
const VEST = [0.34, 0.37, 0.44];
export const ARMOR_MAX = 100;

// the top the hero shows: his own, or the vest over it
export function dress(L, armored) {
  const worn = L.wornTop || L.top;
  if (!L.wornTop) L.wornTop = worn;
  L.top = armored ? { kind: 'vest', color: VEST, sleeves: worn.sleeves, under: worn.color, armor: true } : worn;
}

// put something on (part: top, bottom, shoes, hat, acc, tattoo); the look is kept
export function wear(game, part, item) {
  const p = game.player;
  const L = p.fig.look;
  if (part === 'top') {
    L.wornTop = { ...item.top };
    dress(L, p.armor > 0);
  } else if (part === 'bottom') L.bottom = { ...item.bottom };
  else if (part === 'shoes') L.shoes = item.shoes.slice();
  else if (part === 'hat') L.hat = item.hat ? { ...item.hat } : null;
  else if (part === 'acc') {
    L.acc = L.acc.filter((a) => !ACCS.some((x) => x.acc === a));
    if (item.acc) L.acc.push(item.acc);
  } else if (part === 'tattoo') {
    L.tattoo = item.tattoo;
    L.acc = L.acc.filter((a) => a !== 'tattoo');
    if (item.tattoo) L.acc.push('tattoo');
  }
  game.streetlife.saveHero();
}

// the vest of notebook covers: on, and full
export function armorUp(game) {
  const p = game.player;
  p.armor = ARMOR_MAX;
  dress(p.fig.look, true);
  game.streetlife.saveHero();
}

// the hero's outfit for keeping, and back on from it
export function outfitOf(L) {
  const worn = L.wornTop || L.top;
  return { top: worn, bottom: L.bottom, shoes: L.shoes, acc: L.acc.filter((a) => a === 'tattoo' || ACCS.some((x) => x.acc === a)), tattoo: L.tattoo || null };
}

export function putOn(game, o) {
  if (!o) return;
  const p = game.player;
  const L = p.fig.look;
  if (o.top) L.wornTop = o.top;
  if (o.bottom) L.bottom = o.bottom;
  if (o.shoes) L.shoes = o.shoes;
  if (o.acc) L.acc = L.acc.filter((a) => a !== 'tattoo' && !ACCS.some((x) => x.acc === a)).concat(o.acc);
  L.tattoo = o.tattoo || null;
  dress(L, p.armor > 0);
}

// the HUD's row for the vest: there while there is some of it left
export function armorBar(game) {
  const el = game._armorEl || (game._armorEl = document.getElementById('armor'));
  if (!el) return;
  const a = game.player.armor;
  const w = Math.round(a);
  if (w === game._armorW) return;
  game._armorW = w;
  el.classList.toggle('hidden', w <= 0);
  el.querySelector('.fill').style.width = `${Math.round((100 * a) / ARMOR_MAX)}%`;
}
