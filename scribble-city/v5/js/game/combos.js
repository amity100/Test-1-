import { clamp } from '../core/util.js';

import { tr } from '../core/lang.js';
// (ROADMAP 11.15) Parts that work together: more than each of them alone. A ride (game/partsum.js
// rideSpec) or a weapon (game/handparts.js handSpec) made of parts gets, besides what each part
// does, what some of them do together - a flying fortress (it flies, it is armoured, it fires: much
// harder to bring down), a ghost (silent, and in a cloud of ink or under the water: seen only from
// close by), a guided missile (wings and a jet on a gun: its shots chase what they are fired at)...
// Each is said on the card, with what it gives; one that lacks just one thing says what is missing.
// In the game (game/drawncar.js spawnDrawn): what it does to its numbers, and four things of its
// own - the police lose its trail sooner in the water and the air (escape, game/police.js), it is seen
// only from closer (stealth, game/enemies.js, game/police.js), landing from a jump knocks down
// what is round it (stomp, game/vehicles.js), and it lands from any height unhurt (safeFall). The
// first time each is made, it is found: a reward (ui/freedraw.js make).

// ------------------------------------------------------------------ a ride's
// what it has: what each of its ways and parts makes it (as rideSpec made it)
export function rideFeatures(spec) {
  const M = spec.modes || {};
  const guns = spec.guns || [];
  const els = new Set(guns.map((g) => g.el).filter(Boolean));
  const F = {
    drive: !!M.drive,
    fly: !!(M.copter || M.plane || M.balloon),
    float: !!M.boat,
    dive: !!(spec.boat && spec.boat.dive),
    guns: guns.length,
    els,
    armor: (spec.armor || 0) > 0,
    ram: !!spec.ram,
    bumper: !!spec.bumper,
    side: !!(spec.blades && spec.blades.side),
    rear: !!(spec.blades && spec.blades.rear),
    crush: !!spec.crush,
    jump: !!(spec.spring && spec.spring.jump),
    kick: !!(spec.spring && spec.spring.kick),
    chute: !!spec.chute,
    quiet: guns.some((g) => g.quiet) || !!(spec.handling && spec.handling.quiet),
    jets: (spec.jets || []).length,
    wings: !!(M.plane || spec.glide),
    hover: !!spec.hover,
    giant: guns.some((g) => g.giant),
    roof: !!(spec.roofWheels || spec.upside),
    // (heavy without armour: on tracks, or on giant wheels and no lightweight - a skateboard's big
    // wheels crush nothing when it lands)
    heavy: (spec.tracks || []).length > 0 || (!!spec.crush && (spec.mass || 0) >= 1.1),
    righter: !!spec.righter,
    brake: !!(spec.handling && spec.handling.brake),
  };
  // (each thing it can do that another ride cannot: how many it has)
  const adv = [];
  if (F.drive) adv.push('drive');
  if (F.fly) adv.push('fly');
  if (F.float) adv.push('float');
  if (F.dive) adv.push('dive');
  if (F.guns) adv.push('gun');
  for (const e of els) adv.push('el:' + e);
  for (const k of ['armor', 'ram', 'bumper', 'side', 'rear', 'crush', 'jump', 'kick', 'chute', 'quiet', 'hover', 'roof', 'righter', 'brake']) if (F[k]) adv.push(k);
  if (F.wings && !F.fly) adv.push('glide');
  F.adv = adv;
  return F;
}

// what each needs, as the card says it is missing
const RIDE_NEED = {
  fly: [tr('רוטור, או כנפיים ומנוע', 'A rotor, or wings and an engine'), (F) => F.fly],
  drive: [tr('גלגלים', 'Wheels'), (F) => F.drive],
  float: [tr('גוף של סירה', 'A boat\'s hull'), (F) => F.float],
  dive: [tr('צלילה (צוללת)', 'Diving (a submarine)'), (F) => F.dive],
  armor: [tr('שריון', 'Armor'), (F) => F.armor],
  gun: [tr('קנה', 'Barrel'), (F) => F.guns >= 1],
  guns2: [tr('עוד קנה', 'Another barrel'), (F) => F.guns >= 2, (F) => 2 - F.guns],
  guns3: [tr('עוד קנה', 'Another barrel'), (F) => F.guns >= 3, (F) => 3 - F.guns],
  ram: [tr('איל מקדימה (להב או ראש פטיש)', 'A ram in front (a blade or a hammer head)'), (F) => F.ram],
  quiet: [tr('משתיק', 'Silencer'), (F) => F.quiet],
  hide: [tr('קנה שיורה ענן דיו, או צלילה', 'A barrel that fires an ink cloud, or diving'), (F) => F.els.has('ink') || F.dive],
  jump: [tr('קפיץ מתחת', 'A spring underneath'), (F) => F.jump],
  wings: [tr('כנפיים', 'Wings'), (F) => F.wings],
  jet: [tr('סילון מאחור', 'A jet at the back'), (F) => F.jets > 0],
  wheels: [tr('גלגלים', 'Wheels'), (F) => F.drive && !F.hover],
  crush: [tr('זחלים או גלגלי ענק', 'Tracks or monster wheels'), (F) => F.crush],
  chute: [tr('מצנח', 'Parachute'), (F) => F.chute],
  heavy: [tr('שריון או זחלים', 'Armor or tracks'), (F) => F.armor || F.heavy],
  side: [tr('להבים בצדדים', 'Blades on the sides'), (F) => F.side],
  front: [tr('איל או פגוש קפיץ מקדימה', 'A ram or a spring bumper in front'), (F) => F.ram || F.bumper],
  six: [tr('עוד יתרונות (שישה לפחות)', 'More advantages (at least six)'), (F) => F.adv.length >= 6],
};

// (each: what it is called, what makes it, what it gives - and what it does to the ride's numbers)
export const RIDE_COMBOS = [
  {
    k: 'fortress',
    name: tr('מבצר מעופף', 'Flying fortress'),
    need: ['fly', 'armor', 'gun'],
    say: tr('שריון +12%, עמידות ×1.25', 'Armor +12%, toughness ×1.25'),
    fx(s) {
      s.armor = Math.min(0.65, s.armor + 0.12);
      s.hp *= 1.25;
    },
  },
  {
    k: 'raptor',
    name: tr('ציפור טרף', 'Bird of prey'),
    need: ['fly', 'guns2'],
    say: tr('הקנים טוענים מהר פי 1.25 ומדויקים יותר', 'The barrels reload 1.25 times faster and are more accurate'),
    fx(s) {
      for (const g of s.guns) {
        g.reload *= 0.8;
        g.spread *= 0.75;
      }
    },
  },
  {
    k: 'ironRam',
    name: tr('איל משוריין', 'Armored ram'),
    need: ['ram', 'armor'],
    say: tr('ניגוח חזק פי 1.4, והוא כמעט לא נפגע ממנו', 'A ram 1.4 times stronger, and it hardly gets hurt by it'),
    fx(s) {
      s.ram.k *= 1.4;
      s.ram.shield = true;
    },
  },
  {
    k: 'anywhere',
    name: tr('לכל מקום', 'Go anywhere'),
    need: ['drive', 'float', 'fly'],
    say: tr('במים ובאוויר המשטרה מאבדת את העקבות מהר פי 1.8', 'On water and in the air the police lose your trail 1.8 times faster'),
    fx(s) {
      s.escape = Math.max(s.escape || 1, 1.8);
    },
  },
  {
    k: 'subFly',
    name: tr('צוללת מעופפת', 'Flying submarine'),
    need: ['dive', 'fly'],
    say: tr('מתחת למים ובאוויר המשטרה מאבדת את העקבות מהר פי 2.5', 'Underwater and in the air the police lose your trail 2.5 times faster'),
    fx(s) {
      s.escape = Math.max(s.escape || 1, 2.5);
    },
  },
  {
    k: 'ghost',
    name: tr('רוח רפאים', 'Ghost'),
    need: ['quiet', 'hide'],
    say: tr('שוטרים וכנופיות רואים אותו רק מחצי המרחק', 'Cops and gangs only see it from half the distance'),
    fx(s) {
      s.stealth = Math.min(s.stealth || 1, 0.5);
    },
  },
  {
    k: 'eagle',
    name: tr('קפיצת נשר', 'Eagle leap'),
    need: ['jump', 'wings'],
    say: tr('קופץ גבוה פי 1.25 וגולש רחוק', 'Jumps 1.25 times higher and glides far'),
    fx(s) {
      s.spring.jump = Math.min(17, s.spring.jump * 1.25);
      if (s.handling) s.glide = Math.max(s.glide || 0, 0.6);
    },
  },
  {
    k: 'jetTurbo',
    name: tr('טורבו סילון', 'Jet turbo'),
    need: ['wheels', 'jet'],
    say: tr('מהירות מרבית +20%, תאוצה +15%', 'Top speed +20%, acceleration +15%'),
    ok: (s) => !!s.handling,
    fx(s) {
      s.handling.top = Math.min(62, s.handling.top * 1.2);
      s.handling.power *= 1.15;
    },
  },
  {
    k: 'firestorm',
    name: tr('סופת אש', 'Firestorm'),
    need: ['guns3'],
    say: tr('כל קנה פוגע חזק ב־20%', 'Every barrel hits 20% harder'),
    fx(s) {
      for (const g of s.guns) g.dmg = Math.round(g.dmg * 1.2);
    },
  },
  {
    k: 'warship',
    name: tr('ספינת קרב', 'Battleship'),
    need: ['float', 'guns2'],
    say: tr('טווח הקנים +20%, עמידות ×1.2', 'Barrel range +20%, toughness ×1.2'),
    fx(s) {
      for (const g of s.guns) {
        g.speed *= 1.2;
        g.range = Math.round(g.range * 1.2);
      }
      s.hp *= 1.2;
    },
  },
  {
    k: 'juggernaut',
    name: tr('כוח עליון', 'Superpower'),
    need: ['crush', 'armor', 'gun'],
    say: tr('עמידות ×1.4', 'Toughness ×1.4'),
    fx(s) {
      s.hp *= 1.4;
    },
  },
  {
    k: 'stomp',
    name: tr('נחיתה מועכת', 'Crushing landing'),
    need: ['jump', 'heavy'],
    say: tr('כשהוא נוחת מקפיצה — הודף ומועך את מה שסביבו', 'When it lands from a jump — it knocks back and crushes what\'s around it'),
    ok: (s) => !!s.handling,
    fx(s) {
      s.stomp = { r: 9, dmg: 70 };
    },
  },
  {
    k: 'softLand',
    name: tr('נוחת בכל מקום', 'Lands anywhere'),
    need: ['fly', 'chute'],
    say: tr('נוחת רך מכל גובה, בלי שום נזק', 'Lands softly from any height, without any damage'),
    fx(s) {
      s.safeFall = true;
      if (s.chute) s.chute.sink = Math.max(1.8, s.chute.sink * 0.7);
    },
  },
  {
    k: 'hedgehog',
    name: tr('קיפוד', 'Hedgehog'),
    need: ['side', 'front'],
    say: tr('להבי הצד חותכים חזק פי 1.5', 'The side blades cut 1.5 times harder'),
    fx(s) {
      s.blades.side = Math.round(s.blades.side * 1.5);
    },
  },
  {
    k: 'allInOne',
    name: tr('המצאת־על', 'Super invention'),
    need: ['six'],
    say: tr('שישה יתרונות ומעלה: עמידות ×1.15, ודיו זול ב־20%', 'Six advantages or more: toughness ×1.15, and ink 20% cheaper'),
    fx(s) {
      s.hp *= 1.15;
      s.cost = Math.round(s.cost * 0.8);
    },
  },
];

// what it does together, made so (spec: rideSpec's, its hp and cost already added up). Returns
// { list: the combos it has, adv: how many things it can do, near: those it lacks one thing for }
export function rideCombos(spec) {
  const F = rideFeatures(spec);
  const list = [];
  const near = [];
  for (const C of RIDE_COMBOS) {
    const miss = C.need.filter((n) => !RIDE_NEED[n][1](F));
    if (!miss.length && (!C.ok || C.ok(spec))) list.push(C);
    // (one thing short, and what it has of it already something: worth saying - a part to draw on
    // it before another way to go; a submarine's dive is no part)
    else if (miss.length === 1 && C.need.length > 1 && !HARD.has(miss[0]) && (!C.ok || C.ok(spec))) {
      // (one more of it, not two: one gun short of two)
      const N = RIDE_NEED[miss[0]];
      if (N[2] && N[2](F) > 1) continue;
      near.push({ k: C.k, name: C.name, miss: N[0], say: C.say, n: C.need.length, way: WAYS.has(miss[0]) });
    }
  }
  for (const C of list) C.fx(spec);
  spec.hp = Math.round(Math.min(900, spec.hp));
  spec.combos = list.map((C) => C.k);
  near.sort((a, b) => a.way - b.way || b.n - a.n);
  return { list: list.map((C) => ({ k: C.k, name: C.name, say: C.say })), adv: F.adv.length, near: near.slice(0, 2).map(({ k, name, miss, say }) => ({ k, name, miss, say })) };
}

// (what is no part to draw on it: a hint for none of them; and the ways it goes, after the parts)
const HARD = new Set(['dive', 'six']);
const WAYS = new Set(['fly', 'drive', 'float', 'wheels']);

// ------------------------------------------------------------------ a weapon's
// F (game/handparts.js handSpec): what is on it - { gun, scope, long, stock, wing, jet, spin,
// multi, mag, bayonet, bounce, quiet, prop, chute, guard, edge, saw, head, els (Set) }
const HAND_NEED = {
  scope: [tr('כוונת', 'Sight'), (F) => F.scope],
  long: [tr('קנה ארוך', 'A long barrel'), (F) => F.long],
  stock: [tr('קת', 'Stock'), (F) => F.stock],
  wing: [tr('כנפיים', 'Wings'), (F) => F.wing],
  jet: [tr('סילון', 'Jet'), (F) => F.jet],
  spin: [tr('שלושה קנים לפחות', 'At least three barrels'), (F) => F.spin],
  mag: [tr('מחסנית', 'Magazine'), (F) => F.mag],
  bayonet: [tr('כידון (להב בקצה)', 'A bayonet (a blade on the end)'), (F) => F.bayonet],
  multi: [tr('עוד קנה', 'Another barrel'), (F) => F.multi],
  bounce: [tr('קפיץ (או דיו קופצני)', 'A spring (or bouncy ink)'), (F) => F.bounce],
  blast: [tr('דיו נפץ', 'Explosive ink'), (F) => F.els.has('blast')],
  quiet: [tr('משתיק', 'Silencer'), (F) => F.quiet],
  prop: [tr('מדחף', 'Propeller'), (F) => F.prop],
  els3: [tr('עוד צבעי דיו (שלושה לפחות)', 'More ink colors (at least three)'), (F) => F.els.size >= 3],
  guard: [tr('מגן יד או שריון', 'A hand guard or armor'), (F) => F.guard],
  edge: [tr('להב', 'Blade'), (F) => F.edge],
  saw: [tr('להב משונן', 'A serrated blade'), (F) => F.saw],
  fire: [tr('דיו אש (אדום)', 'Fire ink (red)'), (F) => F.els.has('fire')],
  head: [tr('ראש כבד', 'A heavy head'), (F) => F.head],
  shock: [tr('דיו חשמל', 'Electric ink'), (F) => F.els.has('shock')],
  chute: [tr('מצנח', 'Parachute'), (F) => F.chute],
};

export const HAND_COMBOS = [
  {
    k: 'sniper',
    name: tr('צלף', 'Sniper'),
    need: ['scope', 'long', 'stock'],
    say: tr('נזק ×1.3, ודיוק מרבי', 'Damage ×1.3, and top accuracy'),
    fx(d) {
      d.damage = Math.round(d.damage * 1.3);
      d.spread *= 0.6;
    },
  },
  {
    k: 'guided',
    name: tr('טיל מונחה', 'Guided rocket'),
    need: ['wing', 'jet'],
    say: tr('רודף אחרי המטרה חזק פי 1.6, ונזק ×1.25', 'Homes in on the target 1.6 times harder, and damage ×1.25'),
    fx(d) {
      d.homing = (d.homing || 2.4) * 1.6;
      d.damage = Math.round(d.damage * 1.25);
    },
  },
  {
    k: 'shredder',
    name: tr('מטחנה', 'Grinder'),
    need: ['spin', 'mag'],
    say: tr('קצב ×1.2, מחסנית ×1.5', 'Rate ×1.2, magazine ×1.5'),
    fx(d) {
      d.rate *= 1.2;
      if (d.mag) {
        d.mag = Math.round(d.mag * 1.5);
        d.ammo = Math.max(d.ammo || 0, d.mag * 4);
      }
    },
  },
  {
    k: 'charger',
    name: tr('מסתער', 'Charger'),
    need: ['bayonet', 'multi'],
    say: tr('הכידון דוקר חזק פי 1.5', 'The bayonet stabs 1.5 times harder'),
    fx(d) {
      d.bayonet.damage = Math.round(d.bayonet.damage * 1.5);
    },
  },
  {
    k: 'pinball',
    name: tr('פינבול נפיץ', 'Explosive pinball'),
    need: ['bounce', 'blast'],
    say: tr('עוד שתי קפיצות, ונזק ×1.2', 'Two more bounces, and damage ×1.2'),
    fx(d) {
      d.bounce = (d.bounce || 0) + 2;
      d.damage = Math.round(d.damage * 1.2);
    },
  },
  {
    k: 'silent',
    name: tr('צלף שקט', 'Silent sniper'),
    need: ['quiet', 'scope'],
    say: tr('נזק ×1.25, ואף אחד לא שומע', 'Damage ×1.25, and nobody hears it'),
    fx(d) {
      d.damage = Math.round(d.damage * 1.25);
    },
  },
  {
    k: 'storm',
    name: tr('סערה', 'Storm'),
    need: ['prop', 'wing'],
    say: tr('משב הרוח חזק פי 1.6', 'The gust of wind is 1.6 times stronger'),
    fx(d) {
      d.wind = clamp((d.wind || 8) * 1.6, 8, 26);
    },
  },
  {
    k: 'rainbow',
    name: tr('קשת יסודות', 'Elemental bow'),
    need: ['els3'],
    say: tr('שלושה סוגי תחמושת ומעלה: קצב ×1.15', 'Three kinds of ammo or more: rate ×1.15'),
    fx(d) {
      d.rate *= 1.15;
    },
  },
  {
    k: 'spiky',
    name: tr('מגן קוצני', 'Spiked shield'),
    need: ['guard', 'edge'],
    say: tr('חוסם 45% ממכה מלפנים, ונזק ×1.1', 'Blocks 45% of a hit from the front, and damage ×1.1'),
    fx(d) {
      d.parry = Math.max(d.parry || 0, 0.45);
      d.damage = Math.round(d.damage * 1.1);
    },
  },
  {
    k: 'hotSaw',
    name: tr('מסור לוהט', 'Blazing saw'),
    need: ['saw', 'fire'],
    say: tr('נזק ×1.25', 'Damage ×1.25'),
    fx(d) {
      d.damage = Math.round(d.damage * 1.25);
    },
  },
  {
    k: 'thunder',
    name: tr('פטיש רעם', 'Thunder hammer'),
    need: ['head', 'shock'],
    say: tr('הודף חזק פי 1.5', 'Knocks back 1.5 times harder'),
    fx(d) {
      d.knock = (d.knock || 5) * 1.5;
    },
  },
  {
    k: 'glider',
    name: tr('רחפן', 'Drone'),
    need: ['chute', 'wing'],
    say: tr('כשמחזיקים אותו נופלים לאט כמעט פי שניים — וגולשים מגג לגג', 'While you hold it you fall almost twice as slowly — and glide from roof to roof'),
    fx(d) {
      d.glider = true;
    },
  },
];

// a weapon's: as a ride's (def: its numbers, made so)
export function handCombos(def, F) {
  const list = [];
  const near = [];
  for (const C of HAND_COMBOS) {
    const miss = C.need.filter((n) => !HAND_NEED[n][1](F));
    if (!miss.length) list.push(C);
    else if (miss.length === 1 && C.need.length > 1 && C.need.some((n) => HAND_NEED[n][1](F))) near.push({ k: C.k, name: C.name, miss: HAND_NEED[miss[0]][0], say: C.say });
  }
  for (const C of list) C.fx(def);
  def.combos = list.map((C) => C.k);
  return { list: list.map((C) => ({ k: C.k, name: C.name, say: C.say })), near: near.slice(0, 2) };
}

// ------------------------------------------------------------------ found
// (the reward the first time each is made: more for a ride's, most for the one of six and more)
export function comboReward(k) {
  if (k === 'allInOne') return 150;
  return RIDE_COMBOS.some((C) => C.k === k) ? 80 : 50;
}

export function comboName(k) {
  const C = RIDE_COMBOS.find((q) => q.k === k) || HAND_COMBOS.find((q) => q.k === k);
  return C ? C.name : k;
}
