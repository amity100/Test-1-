import { clamp } from '../core/util.js';

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
  fly: ['רוטור, או כנפיים ומנוע', (F) => F.fly],
  drive: ['גלגלים', (F) => F.drive],
  float: ['גוף של סירה', (F) => F.float],
  dive: ['צלילה (צוללת)', (F) => F.dive],
  armor: ['שריון', (F) => F.armor],
  gun: ['קנה', (F) => F.guns >= 1],
  guns2: ['עוד קנה', (F) => F.guns >= 2, (F) => 2 - F.guns],
  guns3: ['עוד קנה', (F) => F.guns >= 3, (F) => 3 - F.guns],
  ram: ['איל מקדימה (להב או ראש פטיש)', (F) => F.ram],
  quiet: ['משתיק', (F) => F.quiet],
  hide: ['קנה שיורה ענן דיו, או צלילה', (F) => F.els.has('ink') || F.dive],
  jump: ['קפיץ מתחת', (F) => F.jump],
  wings: ['כנפיים', (F) => F.wings],
  jet: ['סילון מאחור', (F) => F.jets > 0],
  wheels: ['גלגלים', (F) => F.drive && !F.hover],
  crush: ['זחלים או גלגלי ענק', (F) => F.crush],
  chute: ['מצנח', (F) => F.chute],
  heavy: ['שריון או זחלים', (F) => F.armor || F.heavy],
  side: ['להבים בצדדים', (F) => F.side],
  front: ['איל או פגוש קפיץ מקדימה', (F) => F.ram || F.bumper],
  six: ['עוד יתרונות (שישה לפחות)', (F) => F.adv.length >= 6],
};

// (each: what it is called, what makes it, what it gives - and what it does to the ride's numbers)
export const RIDE_COMBOS = [
  {
    k: 'fortress',
    name: 'מבצר מעופף',
    need: ['fly', 'armor', 'gun'],
    say: 'שריון +12%, עמידות ×1.25',
    fx(s) {
      s.armor = Math.min(0.65, s.armor + 0.12);
      s.hp *= 1.25;
    },
  },
  {
    k: 'raptor',
    name: 'ציפור טרף',
    need: ['fly', 'guns2'],
    say: 'הקנים טוענים מהר פי 1.25 ומדויקים יותר',
    fx(s) {
      for (const g of s.guns) {
        g.reload *= 0.8;
        g.spread *= 0.75;
      }
    },
  },
  {
    k: 'ironRam',
    name: 'איל משוריין',
    need: ['ram', 'armor'],
    say: 'ניגוח חזק פי 1.4, והוא כמעט לא נפגע ממנו',
    fx(s) {
      s.ram.k *= 1.4;
      s.ram.shield = true;
    },
  },
  {
    k: 'anywhere',
    name: 'לכל מקום',
    need: ['drive', 'float', 'fly'],
    say: 'במים ובאוויר המשטרה מאבדת את העקבות מהר פי 1.8',
    fx(s) {
      s.escape = Math.max(s.escape || 1, 1.8);
    },
  },
  {
    k: 'subFly',
    name: 'צוללת מעופפת',
    need: ['dive', 'fly'],
    say: 'מתחת למים ובאוויר המשטרה מאבדת את העקבות מהר פי 2.5',
    fx(s) {
      s.escape = Math.max(s.escape || 1, 2.5);
    },
  },
  {
    k: 'ghost',
    name: 'רוח רפאים',
    need: ['quiet', 'hide'],
    say: 'שוטרים וכנופיות רואים אותו רק מחצי המרחק',
    fx(s) {
      s.stealth = Math.min(s.stealth || 1, 0.5);
    },
  },
  {
    k: 'eagle',
    name: 'קפיצת נשר',
    need: ['jump', 'wings'],
    say: 'קופץ גבוה פי 1.25 וגולש רחוק',
    fx(s) {
      s.spring.jump = Math.min(17, s.spring.jump * 1.25);
      if (s.handling) s.glide = Math.max(s.glide || 0, 0.6);
    },
  },
  {
    k: 'jetTurbo',
    name: 'טורבו סילון',
    need: ['wheels', 'jet'],
    say: 'מהירות מרבית +20%, תאוצה +15%',
    ok: (s) => !!s.handling,
    fx(s) {
      s.handling.top = Math.min(62, s.handling.top * 1.2);
      s.handling.power *= 1.15;
    },
  },
  {
    k: 'firestorm',
    name: 'סופת אש',
    need: ['guns3'],
    say: 'כל קנה פוגע חזק ב־20%',
    fx(s) {
      for (const g of s.guns) g.dmg = Math.round(g.dmg * 1.2);
    },
  },
  {
    k: 'warship',
    name: 'ספינת קרב',
    need: ['float', 'guns2'],
    say: 'טווח הקנים +20%, עמידות ×1.2',
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
    name: 'כוח עליון',
    need: ['crush', 'armor', 'gun'],
    say: 'עמידות ×1.4',
    fx(s) {
      s.hp *= 1.4;
    },
  },
  {
    k: 'stomp',
    name: 'נחיתה מועכת',
    need: ['jump', 'heavy'],
    say: 'כשהוא נוחת מקפיצה — הודף ומועך את מה שסביבו',
    ok: (s) => !!s.handling,
    fx(s) {
      s.stomp = { r: 9, dmg: 70 };
    },
  },
  {
    k: 'softLand',
    name: 'נוחת בכל מקום',
    need: ['fly', 'chute'],
    say: 'נוחת רך מכל גובה, בלי שום נזק',
    fx(s) {
      s.safeFall = true;
      if (s.chute) s.chute.sink = Math.max(1.8, s.chute.sink * 0.7);
    },
  },
  {
    k: 'hedgehog',
    name: 'קיפוד',
    need: ['side', 'front'],
    say: 'להבי הצד חותכים חזק פי 1.5',
    fx(s) {
      s.blades.side = Math.round(s.blades.side * 1.5);
    },
  },
  {
    k: 'allInOne',
    name: 'המצאת־על',
    need: ['six'],
    say: 'שישה יתרונות ומעלה: עמידות ×1.15, ודיו זול ב־20%',
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
  scope: ['כוונת', (F) => F.scope],
  long: ['קנה ארוך', (F) => F.long],
  stock: ['קת', (F) => F.stock],
  wing: ['כנפיים', (F) => F.wing],
  jet: ['סילון', (F) => F.jet],
  spin: ['שלושה קנים לפחות', (F) => F.spin],
  mag: ['מחסנית', (F) => F.mag],
  bayonet: ['כידון (להב בקצה)', (F) => F.bayonet],
  multi: ['עוד קנה', (F) => F.multi],
  bounce: ['קפיץ (או דיו קופצני)', (F) => F.bounce],
  blast: ['דיו נפץ', (F) => F.els.has('blast')],
  quiet: ['משתיק', (F) => F.quiet],
  prop: ['מדחף', (F) => F.prop],
  els3: ['עוד צבעי דיו (שלושה לפחות)', (F) => F.els.size >= 3],
  guard: ['מגן יד או שריון', (F) => F.guard],
  edge: ['להב', (F) => F.edge],
  saw: ['להב משונן', (F) => F.saw],
  fire: ['דיו אש (אדום)', (F) => F.els.has('fire')],
  head: ['ראש כבד', (F) => F.head],
  shock: ['דיו חשמל', (F) => F.els.has('shock')],
  chute: ['מצנח', (F) => F.chute],
};

export const HAND_COMBOS = [
  {
    k: 'sniper',
    name: 'צלף',
    need: ['scope', 'long', 'stock'],
    say: 'נזק ×1.3, ודיוק מרבי',
    fx(d) {
      d.damage = Math.round(d.damage * 1.3);
      d.spread *= 0.6;
    },
  },
  {
    k: 'guided',
    name: 'טיל מונחה',
    need: ['wing', 'jet'],
    say: 'רודף אחרי המטרה חזק פי 1.6, ונזק ×1.25',
    fx(d) {
      d.homing = (d.homing || 2.4) * 1.6;
      d.damage = Math.round(d.damage * 1.25);
    },
  },
  {
    k: 'shredder',
    name: 'מטחנה',
    need: ['spin', 'mag'],
    say: 'קצב ×1.2, מחסנית ×1.5',
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
    name: 'מסתער',
    need: ['bayonet', 'multi'],
    say: 'הכידון דוקר חזק פי 1.5',
    fx(d) {
      d.bayonet.damage = Math.round(d.bayonet.damage * 1.5);
    },
  },
  {
    k: 'pinball',
    name: 'פינבול נפיץ',
    need: ['bounce', 'blast'],
    say: 'עוד שתי קפיצות, ונזק ×1.2',
    fx(d) {
      d.bounce = (d.bounce || 0) + 2;
      d.damage = Math.round(d.damage * 1.2);
    },
  },
  {
    k: 'silent',
    name: 'צלף שקט',
    need: ['quiet', 'scope'],
    say: 'נזק ×1.25, ואף אחד לא שומע',
    fx(d) {
      d.damage = Math.round(d.damage * 1.25);
    },
  },
  {
    k: 'storm',
    name: 'סערה',
    need: ['prop', 'wing'],
    say: 'משב הרוח חזק פי 1.6',
    fx(d) {
      d.wind = clamp((d.wind || 8) * 1.6, 8, 26);
    },
  },
  {
    k: 'rainbow',
    name: 'קשת יסודות',
    need: ['els3'],
    say: 'שלושה סוגי תחמושת ומעלה: קצב ×1.15',
    fx(d) {
      d.rate *= 1.15;
    },
  },
  {
    k: 'spiky',
    name: 'מגן קוצני',
    need: ['guard', 'edge'],
    say: 'חוסם 45% ממכה מלפנים, ונזק ×1.1',
    fx(d) {
      d.parry = Math.max(d.parry || 0, 0.45);
      d.damage = Math.round(d.damage * 1.1);
    },
  },
  {
    k: 'hotSaw',
    name: 'מסור לוהט',
    need: ['saw', 'fire'],
    say: 'נזק ×1.25',
    fx(d) {
      d.damage = Math.round(d.damage * 1.25);
    },
  },
  {
    k: 'thunder',
    name: 'פטיש רעם',
    need: ['head', 'shock'],
    say: 'הודף חזק פי 1.5',
    fx(d) {
      d.knock = (d.knock || 5) * 1.5;
    },
  },
  {
    k: 'glider',
    name: 'רחפן',
    need: ['chute', 'wing'],
    say: 'כשמחזיקים אותו נופלים לאט כמעט פי שניים — וגולשים מגג לגג',
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
