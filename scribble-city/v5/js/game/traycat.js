import { tr } from '../core/lang.js';
import { clamp } from '../core/util.js';
import { ITEMS } from './itemcat.js';
import { PAR } from './inkparts.js';
// (ROADMAP 28) The parts tray's list: the 27 parts a game starts with, in four tabs - what moves it, what it fires,
// what keeps it whole, and what joins things. Most are the pen's own things (game/itemcat.js) under their new names;
// the jet engine and the propeller are the drawn parts (game/inkparts.js) put where they naturally go; the four that
// join things are new (game/fuse.js 'link').
//
// And the fusion book: two parts that make something of each other - a name, what it gives, and a hint for the ones
// not found yet. Each is real: fusionApply (game/fuse.js applyVeh, after every part has had its say) changes the
// car's numbers by it.

export const TABS = ['func', 'weapon', 'armor', 'link'];
export const TAB_NAME = { func: tr('תנועה', 'Movement'), weapon: tr('חימוש', 'Weapons'), armor: tr('הגנה', 'Defense'), link: tr('חיבור', 'Links') };
export const TAB_ICON = {
  func: '<path d="M3 13 L10 6 V10 H21 V16 H10 V20 Z"/>',
  weapon: '<circle cx="12" cy="12" r="7"/><path d="M12 2 V7 M12 17 V22 M2 12 H7 M17 12 H22"/>',
  armor: '<path d="M12 2 L20 5 V11 C20 16 16.5 19.5 12 22 C7.5 19.5 4 16 4 11 V5 Z"/>',
  link: '<path d="M9.5 14.5 L14.5 9.5 M8 11 L6 13 A3.5 3.5 0 0 0 11 18 L13 16 M16 13 L18 11 A3.5 3.5 0 0 0 13 6 L11 8"/>',
};

export const TRAY = {
  func: ['turbo', 'jet', 'prop', 'wing', 'rotor', 'balloon', 'jump', 'chute', 'water', 'tracks', 'monster', 'rewind'],
  weapon: ['mg', 'missiles', 'harpoon', 'net', 'tesla'],
  armor: ['armor', 'bullbar', 'smoke', 'repair', 'jammer', 'repaint'],
  link: ['coupler', 'modeshift', 'duallink', 'cargo'],
};
export const TRAY_IDS = TABS.flatMap((t) => TRAY[t]);

// the ones that are not the pen's own things
export const EXTRA = {
  jet: {
    cat: 'func', par: 'jet', name: tr('מנוע סילון', 'Jet Engine'), does: tr('דחיפה חזקה עם דלק משלו — גם באוויר', 'A hard push on its own fuel — in the air too'), use: 'turbo',
    icon: '<path d="M3 8 H13 L17 10 V14 L13 16 H3 Z M17 10 L21 9 V15 L17 14 M6 8 V16 M9 8 V16"/>',
  },
  prop: {
    cat: 'func', par: 'prop', name: tr('מדחף', 'Propeller'), does: tr('דוחף בעדינות כל הזמן — ביבשה, במים ובאוויר', 'A gentle push all the time — on land, on water, in the air'), use: 'always',
    icon: '<circle cx="12" cy="12" r="2"/><path d="M12 10 C9 6 9 3 12 2 C15 3 15 6 12 10 Z M12 14 C15 18 15 21 12 22 C9 21 9 18 12 14 Z M14 12 C18 9 21 9 22 12 C21 15 18 15 14 12 Z M10 12 C6 15 3 15 2 12 C3 9 6 9 10 12 Z"/>',
  },
  coupler: {
    cat: 'link', link: 'coupler', name: tr('מצמד אוניברסלי', 'Universal Coupler'), does: tr('כל רכיב על כל כלי — צריח על סירה, שריון על מסוק. מגיע עם הרכבים החדשים', 'Any part on any ride — a turret on a boat, armor on a helicopter. Comes with the new rides'), use: 'always', soon: true,
    icon: '<circle cx="8" cy="12" r="5"/><circle cx="16" cy="12" r="5"/><path d="M11 12 H13"/>',
  },
  modeshift: {
    cat: 'link', link: 'mode', name: tr('מחליף מצבים', 'Mode Shift'), does: tr('כפתור אחד מעביר בין כביש, אוויר ומים', 'One button switches between road, air and water'), use: 'mode',
    icon: '<path d="M4 8 H17 M14 5 L17 8 L14 11 M20 16 H7 M10 13 L7 16 L10 19"/>',
  },
  duallink: {
    cat: 'link', link: 'dual', name: tr('חיבור שלדה כפול', 'Dual Chassis Link'), does: tr('מחבר שני רכבים לאחד — מגיע עם החיבורים הגדולים', 'Joins two rides into one — comes with the big links'), use: 'always', soon: true,
    icon: '<rect x="2" y="7" width="8" height="10" rx="2"/><rect x="14" y="7" width="8" height="10" rx="2"/><path d="M10 10 H14 M10 14 H14"/>',
  },
  cargo: {
    cat: 'link', link: 'cargo', name: tr('מנשא מטען', 'Cargo Mount'), does: tr('נושא רכב קטן על הגג ומשגר אותו — מגיע עם החיבורים הגדולים', 'Carries a small ride on the roof and launches it — comes with the big links'), use: 'always', soon: true,
    icon: '<path d="M3 17 H21 M5 17 V13 H19 V17 M8 13 V8 H16 V13 M8 10.5 H16"/>',
  },
};

export function info(id) {
  if (EXTRA[id]) return EXTRA[id];
  return ITEMS[id] || (PAR[id] ? { cat: 'func', par: id, name: PAR[id].name, does: PAR[id].how, icon: PAR[id].icon, use: 'always' } : null);
}

// how big each is drawn at the car, in metres: [its long side, its short side] - what game/partpen.js nOf makes its
// numbers of. Sized so that each does its job on an ordinary car the moment it is on (a rotor that lifts it, wings
// that take off); the size handle goes from 0.6 to 1.7 of it
export const SIZE = {
  turbo: [1.2, 0.8], jet: [1.2, 0.6], prop: [1.3, 1.3], wing: [1.5, 0.95], rotor: [2.3, 2.3], balloon: [2.7, 2.5], jump: [1.2, 1.0], chute: [3.2, 2.2],
  water: [3.2, 1.2], tracks: [3.4, 0.9], monster: [0.9, 0.9], rewind: [0.9, 0.9], mg: [1.9, 0.7], missiles: [1.5, 0.9], harpoon: [1.4, 0.9], net: [1.2, 1.0],
  tesla: [1.0, 1.4], armor: [2.6, 1.4], bullbar: [1.9, 0.9], smoke: [1.1, 0.8], repair: [1.0, 1.0], jammer: [0.9, 1.5], repaint: [0.9, 1.1],
};
// the ones whose size changes what they do: these have the size handle
export const SIZED = new Set(['jet', 'prop', 'wing', 'rotor', 'balloon', 'chute', 'mg', 'armor', 'bullbar']);

// what a part needs of the ride it goes on: null (it fits), or why not in a few words
const DRIVES = new Set(['car', 'bike']);
// (on a boat, a helicopter, a plane, a tank: what fires and what protects - through the coupler)
const ANY_RIDE = new Set(['mg', 'missiles', 'harpoon', 'net', 'tesla', 'armor', 'smoke', 'repair', 'jammer', 'repaint', 'coupler', 'rewind']);
export function fits(id, v) {
  const it = info(id);
  if (!it) return tr('לא קיים', 'No such part');
  if (it.soon) return tr('בקרוב', 'Soon');
  if (!v) return tr('צריך רכב', 'Needs a ride');
  if (DRIVES.has(v.kind) && !v.hybrid) return null;
  // (ROADMAP 28: a boat, a helicopter, a plane take parts once they have places of their own for them - with the new
  // rides, through the coupler; till then the tray is a car's and a motorbike's)
  if (!COUPLER_ON || !ANY_RIDE.has(id)) return tr('רק על מכונית', 'Cars only');
  return null;
}
const COUPLER_ON = false;
export const buildsOn = (v) => !!v && ((DRIVES.has(v.kind) && !v.hybrid) || COUPLER_ON);
// (a ride that is not a car takes its parts through the coupler: it goes on with the first of them)
export const needsCoupler = (v) => COUPLER_ON && !!v && (!DRIVES.has(v.kind) || !!v.hybrid);

// ------------------------------------------------------------------ the fusion book
// has: the tray ids on the car. Each: its parts (any of a group in [..]), its name, what it gives, the hint
export const FUSIONS = [
  { id: 'skybeast', name: 'SKYBEAST', need: ['wing', ['turbo', 'jet']], gives: tr('ממריאה ב־20% פחות מהירות וטסה', 'Takes off 20% slower and flies'), hint: tr('כנפיים + משהו שדוחף חזק', 'Wings + something that pushes hard') },
  { id: 'hoverhawk', name: 'HOVERHAWK', need: ['rotor', 'mg'], gives: tr('הצריח יורה מהר יותר מהאוויר', 'The turret fires faster from the air'), hint: tr('רוטור + משהו שיורה', 'A rotor + something that fires') },
  { id: 'cloudsniper', name: 'CLOUD SNIPER', need: ['balloon', 'mg'], gives: tr('הצריח מדויק פי 2.5', 'The turret is 2.5 times as accurate'), hint: tr('משהו שמרחף לאט + משהו שיורה', 'Something that floats slowly + something that fires') },
  { id: 'ironram', name: 'IRON RAM', need: ['bullbar', ['turbo', 'jet']], gives: tr('האיל מעיף הכול בהאצה', 'The ram sends everything flying at speed'), hint: tr('איל + משהו שדוחף חזק', 'A ram + something that pushes hard') },
  { id: 'landfort', name: 'LAND FORTRESS', need: ['armor', 'tracks'], gives: tr('שריון חזק יותר, ומועכת מכוניות', 'Stronger armor, and it crushes cars'), hint: tr('שריון + משהו שזוחל', 'Armor + something that crawls') },
  { id: 'stomper', name: 'STOMPER', need: ['monster', 'jump'], gives: tr('הנחיתה מעיפה את כל מי שמסביב', 'The landing sends everyone around flying'), hint: tr('גלגלים גדולים + קפיצה', 'Big wheels + a jump') },
  { id: 'jumpjet', name: 'JUMP JET', need: ['jump', 'wing'], gives: tr('קפיצה גבוהה יותר וגלישה ארוכה', 'A higher jump and a long glide'), hint: tr('קפיצה + כנפיים', 'A jump + wings') },
  { id: 'rocketsled', name: 'ROCKET SLED', need: ['turbo', 'jet'], gives: tr('שני מנועים: דחיפה חזקה פי 1.3', 'Two engines: 1.3 times the push'), hint: tr('שני דברים שדוחפים', 'Two things that push') },
  { id: 'airship', name: 'AIRSHIP', need: ['balloon', 'prop'], gives: tr('ספינת אוויר: מרחפת ומתקדמת מהר פי 1.6', 'An airship: it floats and moves 1.6 times as fast'), hint: tr('כדור פורח + משהו שדוחף בעדינות', 'A balloon + something that pushes gently') },
  { id: 'wavecutter', name: 'WAVECUTTER', need: ['water', ['prop', 'jet', 'turbo']], gives: tr('מהירה במים פי 1.4', '1.4 times as fast on water'), hint: tr('ערכה אמפיבית + משהו שדוחף', 'An amphibious kit + something that pushes') },
  { id: 'ghostline', name: 'GHOSTLINE', need: ['smoke', 'jammer'], gives: tr('העשן נמשך פי 1.5', 'The smoke lasts 1.5 times as long'), hint: tr('שני דברים שמעלימים אתכם', 'Two things that make you vanish') },
  { id: 'stormcage', name: 'STORM CAGE', need: ['tesla', 'armor'], gives: tr('מי שנוגח בכם מתחשמל', 'Whoever rams you gets a shock'), hint: tr('חשמל + שריון', 'Electricity + armor') },
];
const BY_ID = Object.fromEntries(FUSIONS.map((f) => [f.id, f]));
export const fusionOf = (id) => BY_ID[id] || null;

// the tray ids on a car: the pen's things by their item, the drawn jet and propeller, the links
export function trayIdsOn(v) {
  const out = new Set();
  for (const p of (v && v.fuse ? v.fuse.parts : [])) {
    const id = trayIdOf(p);
    if (id) out.add(id);
  }
  return out;
}
export function trayIdOf(p) {
  if (p.tray) return p.tray;
  if (p.item) return p.item;
  if (p.par && (p.type === 'jet' || p.type === 'prop')) return p.type;
  return null;
}

export function fusionsOf(has) {
  return FUSIONS.filter((f) => f.need.every((n) => (Array.isArray(n) ? n.some((x) => has.has(x)) : has.has(n))));
}

// (game/fuse.js applyVeh, after every part and the pen's own finish) what the fusions on it give: H its handling,
// fz its parts' numbers. Their ids in fz.fusions
export function fusionApply(v, parts, H, fz) {
  const has = new Set();
  for (const p of parts) {
    const id = trayIdOf(p);
    if (id) has.add(id);
  }
  const F = fusionsOf(has);
  fz.fusions = F.map((f) => f.id);
  for (const f of F) {
    switch (f.id) {
      case 'skybeast':
        if (fz.takeoff) fz.takeoff *= 0.8;
        if (fz.takeoff) fz.wingFly = fz.wingFly || fz.takeoff <= H.top * 1.5;
        break;
      case 'ironram':
        if (v.ram && !fz.combos.includes('ironRam')) v.ram = { ...v.ram, k: v.ram.k * 1.5 };
        break;
      case 'landfort':
        v.armor = Math.min(0.8, (v.armor || 0) + 0.12);
        v.crush = true;
        break;
      case 'stomper':
        v.stomp = { r: 9, dmg: 70 };
        break;
      case 'jumpjet':
        if (fz.jump) fz.jump *= 1.25;
        v.glide = Math.min(0.9, (v.glide || 0) + 0.1);
        break;
      case 'rocketsled':
        fz.jetK = (fz.jetK || 1) * 1.3;
        if (fz.thrust) fz.thrust *= 1.3;
        break;
      case 'airship':
        if (fz.prop) fz.prop = fz.prop.map((x) => x * 1.6);
        break;
      case 'wavecutter':
        if (fz.float && fz.float.cap) fz.float = { ...fz.float, cap: fz.float.cap * 1.4 };
        break;
      case 'ghostline':
        if (fz.smoke) fz.smoke = { ...fz.smoke, charge: fz.smoke.charge * 1.5, max: fz.smoke.max * 1.5 };
        fz.smokeK = 1.5;
        break;
      case 'stormcage':
        v.spikes = v.spikes || { dmg: 45 };
        fz.shock = true;
        break;
      default:
    }
  }
}

// ------------------------------------------------------------------ the four meters
// weight (1: as it left the factory), power (1: as it left), lift (1: it flies), float (1: it floats)
export function metersOf(v) {
  const B = v.fzBase;
  const H0 = (B && B.handling) || v.handling || { mass: 1.25, power: 10, top: 28 };
  const H = v.handling || H0;
  const fz = v.fz || {};
  const m0 = H0.mass || 1.25;
  const m = H.mass || m0;
  const push = (H.power || 10) * (v.jets ? 1 + 0.6 * (fz.jetK || 1) : 1) + (fz.thrust || 0) * 0.3 + (fz.prop ? Math.hypot(fz.prop[0], fz.prop[2]) * 0.5 : 0);
  const power = push / m / ((H0.power || 10) / m0);
  let lift = Math.max(fz.rotor || 0, fz.balloon || 0, fz.vtol ? 1 : 0);
  let wings = 0;
  if (fz.takeoff) {
    wings = fz.wingFly ? 1 : clamp((H.top * 0.92 * (v.jets ? 1 + 0.4 * (fz.jetK || 1) : 1)) / fz.takeoff, 0, 0.95);
    lift = Math.max(lift, wings);
  }
  const float = fz.float ? clamp(fz.float.k || 1, 0, 1.5) : 0;
  return { weight: m / m0, power, lift, float, wings, rotor: fz.rotor || 0, balloon: fz.balloon || 0 };
}

// what it lacks, in a few words - the first that applies, or what it does
export function hintOf(v, M, has) {
  if (!has.size) return tr('נגיעה ברכיב — והוא על הרכב', 'Touch a part — and it is on the ride');
  if (M.rotor > 0 && M.rotor < 1 && M.lift < 1) return tr(`הרוטור מרים ${Math.round(M.rotor * 100)}% — הגדילו אותו והוא ממריא`, `The rotor lifts ${Math.round(M.rotor * 100)}% — make it bigger and it takes off`);
  if (M.balloon > 0 && M.balloon < 1 && M.lift < 1) return tr(`הכדור מרים ${Math.round(M.balloon * 100)}% — הגדילו אותו`, `The balloon lifts ${Math.round(M.balloon * 100)}% — make it bigger`);
  if (has.has('wing') && M.wings < 1 && M.lift < 1) return has.has('turbo') || has.has('jet') ? tr('הכנפיים קטנות למשקל הזה — הגדילו אותן', 'The wings are small for this weight — make them bigger') : tr('עוד ניטרו או מנוע סילון — והיא ממריאה', 'A nitro or a jet engine more — and it takes off');
  if (M.weight > 1.3 && M.power < 0.95) return tr('כבדה — מנוע סילון יחזיר לה כוח', 'Heavy — a jet engine gives the power back');
  if (M.lift >= 1 && !has.has('chute') && !has.has('balloon')) return tr('טסה. מצנח נחיתה ישמור עליה בנפילה', 'It flies. A landing parachute keeps it safe in a fall');
  if (has.has('water') && !has.has('prop') && !has.has('jet') && !has.has('turbo')) return tr('צפה. מדחף ייתן לה מהירות במים', 'It floats. A propeller gives it speed on water');
  if (M.lift >= 1) return tr('מוכנה לטיסה', 'Ready to fly');
  return tr('עוד רכיב? שילובים נותנים יכולות חדשות', 'One more part? Combinations give new abilities');
}
