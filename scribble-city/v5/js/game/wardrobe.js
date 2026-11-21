import { tr } from '../core/lang.js';
// (ROADMAP 5.7, not with ?classic) The wardrobe. The boutique dresses the hero: shirts, trousers,
// shoes, hats and the little things; the barber draws a tattoo on his forearm; the hardware store
// sells a vest of old notebook covers that takes most of a blow until it is worn through. Modest
// and modern: sleeves, and trousers to the shoes. What he wears is kept (the hero's look in
// game/streetlife.js, and the saves).

// what goes where on the body, and the sketch the shopkeeper draws of it (game/airsketch.js)
export const TOPS = [
  { name: tr('טישרט לבנה', 'A white T-shirt'), top: { kind: 'tee', color: [0.97, 0.96, 0.93], sleeves: 'short' } },
  { name: tr('טישרט שחורה', 'A black T-shirt'), top: { kind: 'tee', color: [0.13, 0.13, 0.15], sleeves: 'short' } },
  { name: tr('טישרט אדומה', 'A red T-shirt'), top: { kind: 'tee', color: [0.82, 0.2, 0.22], sleeves: 'short' } },
  { name: tr('קפוצ\'ון אפור', 'A gray hoodie'), top: { kind: 'hoodie', color: [0.55, 0.56, 0.6], sleeves: 'long' } },
  { name: tr('סוודר ירוק', 'A green sweater'), top: { kind: 'sweater', color: [0.3, 0.52, 0.38], sleeves: 'long' } },
  { name: tr('ז\'קט ג\'ינס', 'A denim jacket'), top: { kind: 'jacket', color: [0.3, 0.42, 0.62], sleeves: 'long', inner: [0.95, 0.94, 0.9] } },
  { name: tr('בלייזר כחול', 'A navy blazer'), top: { kind: 'blazer', color: [0.2, 0.22, 0.32], sleeves: 'long', inner: [0.96, 0.95, 0.92] } },
];
export const BOTTOMS = [
  { name: tr('מכנסי דגמ"ח אפורים', 'Gray cargo pants'), bottom: { kind: 'baggy', color: [0.36, 0.36, 0.39] } },
  { name: tr('ג\'ינס כחול', 'Blue jeans'), bottom: { kind: 'pants', color: [0.24, 0.33, 0.52] } },
  { name: tr('מכנסיים שחורים', 'Black pants'), bottom: { kind: 'pants', color: [0.12, 0.12, 0.14] } },
  { name: tr('צ\'ינו בז\'', 'Beige chinos'), bottom: { kind: 'pants', color: [0.78, 0.68, 0.5] } },
  { name: tr('ג\'ינס רחב', 'Wide jeans'), bottom: { kind: 'baggy', color: [0.3, 0.4, 0.6] } },
];
export const SHOES = [
  { name: tr('סניקרס לבנות', 'White sneakers'), shoes: [0.96, 0.96, 0.95] },
  { name: tr('סניקרס אדומות', 'Red sneakers'), shoes: [0.85, 0.2, 0.22] },
  { name: tr('נעלי עור שחורות', 'Black leather shoes'), shoes: [0.1, 0.08, 0.07] },
  { name: tr('מגפיים חומים', 'Brown boots'), shoes: [0.42, 0.28, 0.16] },
];
export const HATS = [
  { name: tr('כובע מצחייה שחור', 'A black cap'), hat: { kind: 'cap', color: [0.09, 0.09, 0.11] } },
  { name: tr('כובע מצחייה הפוך', 'A backwards cap'), hat: { kind: 'capBack', color: [0.95, 0.3, 0.45] } },
  { name: tr('כובע גרב', 'A beanie'), hat: { kind: 'beanie', color: [0.85, 0.55, 0.2] } },
  { name: tr('כובע רחב שוליים', 'A wide-brimmed hat'), hat: { kind: 'fedora', color: [0.94, 0.9, 0.82] } },
  { name: tr('כומתה', 'A beret'), hat: { kind: 'beret', color: [0.62, 0.42, 0.85] } },
  { name: tr('בלי כובע', 'No hat'), hat: null },
];
export const ACCS = [
  { name: tr('שרשרת זהב', 'A gold chain'), acc: 'chain' },
  { name: tr('תיק צד', 'A shoulder bag'), acc: 'crossbody' },
  { name: tr('אוזניות', 'Headphones'), acc: 'headphones' },
  { name: tr('צעיף', 'A scarf'), acc: 'scarf' },
  { name: tr('בלי אביזרים', 'No accessories'), acc: null },
];
// (v5, ROADMAP 11.17) the mainland's stores: a whole floor of clothes (a store of fashion), a wall
// of shoes, the sports store's tracksuits, the jeweller's counter
export const FASHION_TOPS = [
  { name: tr('טרנץ\' בז\'', 'A beige trench coat'), top: { kind: 'trench', color: [0.8, 0.68, 0.5], sleeves: 'long', inner: [0.96, 0.95, 0.92] } },
  { name: tr('מעיל פוך שחור', 'A black puffer jacket'), top: { kind: 'puffer', color: [0.12, 0.12, 0.14], sleeves: 'long' } },
  { name: tr('ג\'קט בומבר זית', 'An olive bomber jacket'), top: { kind: 'bomber', color: [0.36, 0.4, 0.3], sleeves: 'long', inner: [0.96, 0.95, 0.92] } },
  { name: tr('חולצה מכופתרת תכלת', 'A light blue button-down shirt'), top: { kind: 'overshirt', color: [0.72, 0.84, 0.96], sleeves: 'long', inner: [0.96, 0.95, 0.92] } },
  { name: tr('פולו לבנה', 'A white polo'), top: { kind: 'polo', color: [0.97, 0.96, 0.93], sleeves: 'short' } },
  { name: tr('קרדיגן ורוד', 'A pink cardigan'), top: { kind: 'cardigan', color: [0.95, 0.72, 0.78], sleeves: 'long', inner: [0.96, 0.95, 0.92] } },
  { name: tr('סווטשירט אוברסייז', 'An oversized sweatshirt'), top: { kind: 'oversized', color: [0.62, 0.72, 0.88], sleeves: 'long' } },
  { name: tr('חליפה כחולה', 'A blue suit'), top: { kind: 'suit', color: [0.18, 0.22, 0.34], sleeves: 'long', shirt: [0.95, 0.95, 0.94], tie: [0.62, 0.12, 0.14] } },
  ...TOPS,
];
export const FASHION_BOTTOMS = [
  { name: tr('מכנסיים רחבים שמנת', 'Wide cream pants'), bottom: { kind: 'wide', color: [0.92, 0.9, 0.84] } },
  { name: tr('מכנסי דגמ"ח זית', 'Olive cargo pants'), bottom: { kind: 'cargo', color: [0.36, 0.4, 0.3] } },
  { name: tr('מכנסי חליפה כחולים', 'Blue suit pants'), bottom: { kind: 'pants', color: [0.18, 0.22, 0.34] } },
  ...BOTTOMS,
];
export const SHOE_WALL = [
  ...SHOES,
  { name: tr('סניקרס כחולות', 'Blue sneakers'), shoes: [0.3, 0.45, 0.85] },
  { name: tr('נעלי ריצה צהובות', 'Yellow running shoes'), shoes: [0.98, 0.82, 0.25] },
  { name: tr('מוקסינים חומים', 'Brown moccasins'), shoes: [0.55, 0.36, 0.22] },
  { name: tr('נעלי בד ורודות', 'Pink canvas shoes'), shoes: [0.95, 0.6, 0.72] },
];
export const SPORT_TOPS = [
  { name: tr('חליפת ספורט אדומה', 'A red tracksuit'), top: { kind: 'track', color: [0.84, 0.22, 0.24], sleeves: 'long' } },
  { name: tr('חליפת ספורט כחולה', 'A blue tracksuit'), top: { kind: 'track', color: [0.22, 0.36, 0.72], sleeves: 'long' } },
  { name: tr('גופיית ריצה', 'A running tank top'), top: { kind: 'tank', color: [0.3, 0.7, 0.45], sleeves: 'none' } },
  { name: tr('קפוצ\'ון ספורט שחור', 'A black sports hoodie'), top: { kind: 'hoodie', color: [0.12, 0.12, 0.14], sleeves: 'long' } },
];
export const JEWELS = [
  { name: tr('שרשרת זהב', 'A gold chain'), acc: 'chain' },
  { name: tr('צעיף משי', 'A silk scarf'), acc: 'scarf' },
  { name: tr('תיק צד מעור', 'A leather shoulder bag'), acc: 'crossbody' },
  { name: tr('בלי אביזרים', 'No accessories'), acc: null },
];
// tattoos: a little drawing on the right forearm (game/doodle.js); the sketch the barber draws
export const TATTOOS = [
  { name: tr('עוגן', 'An anchor'), tattoo: 'anchor' },
  { name: tr('לב', 'A heart'), tattoo: 'heart' },
  { name: tr('כוכב', 'Star'), tattoo: 'star' },
  { name: tr('עיפרון', 'Pencil'), tattoo: 'pencil' },
  { name: tr('להסיר את הקעקוע', 'Remove the tattoo'), tattoo: null },
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
  const o = { top: worn, bottom: L.bottom, shoes: L.shoes, acc: L.acc.filter((a) => a === 'tattoo' || ACCS.some((x) => x.acc === a)), tattoo: L.tattoo || null };
  // (one of your own drawing: ROADMAP 9.3)
  if (L.tattoo === 'custom' && L.tattooLines) o.tattooLines = L.tattooLines;
  return o;
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
  L.tattooLines = o.tattoo === 'custom' && Array.isArray(o.tattooLines) ? o.tattooLines : null;
  dress(L, p.armor > 0);
}

// (ROADMAP 9.3) a tattoo of your own: the strokes drawn on the sheet (u along the forearm, v
// round it, 0..1) onto the forearm, from the elbow to the wrist
export function ownTattoo(game, strokes) {
  const L = game.player.fig.look;
  L.tattooLines = strokes.map((s) => {
    const out = [];
    for (const [u, v] of s.pts) {
      const q = [Math.round((0.22 + u * 0.62) * 1000) / 1000, Math.round((v - 0.5) * 1.7 * 1000) / 1000];
      const prev = out[out.length - 1];
      if (!prev || Math.hypot(q[0] - prev[0], (q[1] - prev[1]) * 0.25) > 0.012) out.push(q);
    }
    return out;
  }).filter((l) => l.length >= 2).slice(0, 40);
  L.tattoo = 'custom';
  L.acc = L.acc.filter((a) => a !== 'tattoo');
  L.acc.push('tattoo');
  game.streetlife.saveHero();
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
