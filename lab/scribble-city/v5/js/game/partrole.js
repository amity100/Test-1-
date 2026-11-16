import { shapeOf } from './drawncar.js';

import { tr } from '../core/lang.js';
// (ROADMAP 11.12) Any line can be any part - and what it does is what that part is, where it is on
// the thing, as it was drawn. A wheel is a wheel under it; drawn long and flat along its bottom it
// is a track (slow, it never slides, it turns on the spot); up on its roof, it is what it lands on
// when it rolls over; square, it bumps along. A rotor lying over it lifts it; standing at its back it
// pushes (an airboat); lying under it, it is a hovercraft. A jet at its back pushes, under it lifts
// it straight up, at its front it brakes. A barrel as long as it is, a giant cannon that throws it
// back as it fires; pointing back, it fires at whoever is after it. A blade at its front rams, at
// its sides it cuts whoever it passes. A spring under it jumps, at its front throws whatever it
// hits, at its back kicks it forward, on its roof rights it again. A sail on wheels is a land
// yacht; a wing standing up is a fin. The part's menu (ui/freedraw.js) says it of each, there;
// game/partsum.js adds it up - and game/partbuild.js, game/vehicles.js make it so.

// the parts, as the menu groups them
export const ROLE_GROUPS = [
  { k: 'move', name: tr('תנועה', 'Movement'), t: ['wheel', 'rotor', 'prop', 'jet', 'wing', 'sail', 'balloon', 'hull', 'spring'] },
  { k: 'fire', name: tr('נשק', 'Weapons'), t: ['barrel', 'blade', 'head', 'scope', 'mag', 'silencer'] },
  { k: 'gear', name: tr('הגנה וציוד', 'Protection and gear'), t: ['armor', 'chute', 'fin', 'skid', 'tail'] },
  { k: 'body', name: tr('מבנה', 'Structure'), t: ['body', 'cabin', 'frame', 'mast', 'rope', 'window', 'deco'] },
  { k: 'hand', name: tr('אחיזה', 'Grip'), t: ['grip', 'stock', 'guard'] },
];

// ------------------------------------------------------------------ where a line is on the thing
// pts: the line ([x, y]: x forward, y up - any units: only how it is to the body counts); B: the
// body's box ({ x0, x1, y0, y1 }; null: no body yet). Its box, its long way (and which of its ends
// is out away from the body: a barrel's muzzle), and where it is on the body
export function placeOf(pts, B) {
  const sh = shapeOf(pts);
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const [x, y] of pts) {
    sxx += (x - sh.cx) ** 2;
    sxy += (x - sh.cx) * (y - sh.cy);
    syy += (y - sh.cy) ** 2;
  }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let ux = Math.cos(ang);
  let uy = Math.sin(ang);
  let a0 = Infinity;
  let a1 = -Infinity;
  let b0 = Infinity;
  let b1 = -Infinity;
  for (const [x, y] of pts) {
    const a = (x - sh.cx) * ux + (y - sh.cy) * uy;
    const b = -(x - sh.cx) * uy + (y - sh.cy) * ux;
    a0 = Math.min(a0, a);
    a1 = Math.max(a1, a);
    b0 = Math.min(b0, b);
    b1 = Math.max(b1, b);
  }
  const q = { sh, long: a1 - a0, thick: b1 - b0, closed: sh.closed, round: sh.round };
  q.fill = sh.closed ? sh.area / Math.max(1e-9, sh.w * sh.h) : 0;
  q.upright = sh.h > sh.w * 1.3;
  q.flat = sh.w > sh.h * 1.6;
  if (!B) return Object.assign(q, { u: 0.5, v: 0.5, dx: 1, dy: 0 });
  const BW = Math.max(1e-6, B.x1 - B.x0);
  const BH = Math.max(1e-6, B.y1 - B.y0);
  const bcx = (B.x0 + B.x1) / 2;
  const bcy = (B.y0 + B.y1) / 2;
  q.BW = BW;
  q.BH = BH;
  // (along it, 0 its back, 1 its nose; up it, 0 its bottom, 1 its top)
  q.u = (sh.mx - B.x0) / BW;
  q.v = (sh.my - B.y0) / BH;
  q.front = q.u > 0.8 || sh.x0 > B.x1 - BW * 0.08;
  q.back = q.u < 0.2 || sh.x1 < B.x0 + BW * 0.08;
  // (all of it out past its back)
  q.past = sh.x1 < B.x0 + BW * 0.08;
  q.top = q.v > 0.72;
  q.under = q.v < 0.3;
  // (out of it, the end further from its middle is where it points)
  const ea = [sh.cx + ux * a0, sh.cy + uy * a0];
  const eb = [sh.cx + ux * a1, sh.cy + uy * a1];
  const far = (p) => Math.hypot((p[0] - bcx) / BW, (p[1] - bcy) / BH);
  if (far(ea) > far(eb)) {
    ux = -ux;
    uy = -uy;
  }
  q.dx = ux;
  q.dy = uy;
  // (for its size: as long as the body and thick, or as thick as it is high)
  q.big = q.closed && ((q.long > BW * 0.85 && q.thick > BH * 0.4) || (q.long > BW * 0.5 && q.thick > BH * 0.6));
  return q;
}

// ------------------------------------------------------------------ what it is, there
// t: the part; q: placeOf's; ctx: { fam ('ground', 'copter', 'plane', 'boat', 'balloon'), wheels
// (it has wheels under it), thrust (a propeller, a jet), wings, guns, sail, rocket }. Returns { v (which of
// its kinds - game/partsum.js goes by it), name, say (what it will do, there) }
export function roleOf(t, q, ctx = {}) {
  const fam = ctx.fam || 'ground';
  const air = fam === 'copter' || fam === 'plane' || fam === 'balloon';
  const V = (v, name, say) => ({ v, name, say });
  const sh = q.sh;
  switch (t) {
    case 'wheel': {
      // (long and flat along its bottom - not an oval wheel: a track)
      // (ROADMAP 11.16: or read as one along under it - a row of loops, two halves)
      if ((q.track || (sh.w > sh.h * 2.4 && q.long > (q.BW || 1) * 0.4)) && q.v < 0.42) return V('track', tr('זחל', 'Track'), tr('זחל: איטי, לא מחליק, מסתובב במקום ועולה על מכוניות', 'Track: slow, doesn\'t skid, turns on the spot and drives over cars'));
      if (q.top && q.u > -0.05 && q.u < 1.05 && (sh.w + sh.h) / 4 < (q.BW || 1) * 0.6) return V('roof', tr('גלגל גג', 'Roof wheel'), ctx.wheels ? tr('על הגג: כשהוא מתהפך — ממשיך לנסוע', 'On the roof: when it flips — it keeps driving') : tr('על הגג: נוסע הפוך, על הגב', 'On the roof: drives upside-down, on its back'));
      // (ROADMAP 11.16: a wheel scribbled round and round fills its box twice over - round, not square)
      if (q.closed && !q.round && q.fill > 0.86 && q.fill < 1.08 && sh.len < (sh.w + sh.h) * 2.5 && Math.max(sh.w, sh.h) < Math.min(sh.w, sh.h) * 1.6) return V('square', tr('גלגל מרובע', 'Square wheel'), tr('מרובע: מקפץ ואיטי יותר, אבל נאחז ומטפס', 'Square: bumpy and slower, but it grips and climbs'));
      if ((sh.w + sh.h) / 4 > (q.BH || 1) * 0.42) return V('big', tr('גלגל ענק', 'Giant wheel'), tr('ענק: עולה על מדרכות ומכוניות, אבל כבד', 'Giant: drives over curbs and cars, but heavy'));
      return V('wheel', tr('גלגל', 'Wheel'), air ? tr('גלגל נחיתה: נוסע על הקרקע', 'Landing wheel: drives on the ground') : tr('נוסע — גדול יותר, מהיר יותר', 'Drives — bigger, faster'));
    }
    case 'rotor':
    case 'prop': {
      // (ROADMAP 11.13) at a helicopter's tail, small: its tail rotor - it holds it straight
      // (ROADMAP 11.16: or a propeller out past its end, at the end of a tail boom drawn out of its
      // top - as high as its top, still its tail rotor)
      if ((fam === 'copter' || ctx.copter) && q.back && (!q.top || (t === 'prop' && q.past && q.v < 1.4)) && (sh.w + sh.h) / 2 < (q.BH || 1) * 1.3) return V('tail', tr('רוטור זנב', 'Tail rotor'), tr('בזנב: מחזיק את המסוק ישר — בלעדיו הוא מסתובב סביב עצמו', 'On the tail: keeps the helicopter straight — without it, it spins around itself'));
      if (q.upright) {
        if (q.back) return V('pusher', tr('מדחף דוחף', 'Pusher propeller'), fam === 'boat' ? tr('עומד מאחור: דוחף — סירת ביצות מהירה', 'Standing at the back: pushes — a fast airboat') : fam === 'balloon' ? tr('מאחור: דוחף את ספינת האוויר קדימה, והיא פונה לאן שמסתכלים', 'At the back: pushes the airship forward, and it turns where you look') : ctx.wings ? tr('עומד מאחור: דוחף את המטוס', 'Standing at the back: pushes the plane') : tr('עומד מאחור: דוחף קדימה — עוד מהירות, גם במים', 'Standing at the back: pushes forward — more speed, on water too'));
        return V('puller', tr('מדחף', 'Propeller'), ctx.wings ? tr('עומד מלפנים: מושך את המטוס', 'Standing in front: pulls the plane') : tr('עומד: מושך קדימה — עוד מהירות', 'Standing: pulls forward — more speed'));
      }
      if (q.under) return V('hover', tr('מאוורר ריחוף', 'Hover fan'), tr('שוכב מתחת: רחפת — מחליקה על היבשה ועל המים', 'Lying underneath: a hovercraft — slides over land and water'));
      // (round, at an end - a fan facing out of it: it pushes, it pulls)
      if (!q.top && !q.flat && (q.front || q.back)) return q.back ? V('pusher', tr('מדחף דוחף', 'Pusher propeller'), tr('מאחור: דוחף קדימה — עוד מהירות, גם במים', 'At the back: pushes forward — more speed, on water too')) : V('puller', tr('מדחף', 'Propeller'), tr('מלפנים: מושך קדימה — עוד מהירות', 'In front: pulls forward — more speed'));
      return V('lift', t === 'prop' ? tr('מדחף מרים', 'Lifting propeller') : tr('רוטור', 'Rotor'), tr('שוכב מעל: מרים — טס כמו מסוק, אם הוא גדול מספיק', 'Lying on top: lifts — flies like a helicopter, if it\'s big enough'));
    }
    case 'jet': {
      // (an engine slung under a wing, lying along it: it pushes - pointing down under it: it lifts)
      // (ROADMAP 11.13: a rocket's, under its foot - it stands up, its back is down: it lifts)
      if (q.under && (ctx.rocket || (!q.back && !(ctx.wings && sh.w > sh.h * 1.15)))) return V('vtol', tr('סילון אנכי', 'Vertical jet'), tr('מתחת, כלפי מטה: ממריא ונוחת במקום', 'Underneath, pointing down: takes off and lands on the spot'));
      if (q.front && q.dx > -0.2) return V('retro', tr('סילון הפוך', 'Reverse jet'), tr('מלפנים: בלם חזק בבת אחת', 'In front: a strong brake all at once'));
      return V('jet', tr('סילון', 'Jet'), fam === 'plane' || ctx.wings ? tr('מאחור: דוחף את המטוס', 'At the back: pushes the plane') : tr('מאחור: טורבו (Shift)', 'At the back: turbo (Shift)'));
    }
    case 'wing': {
      if (q.upright) return V('fin', tr('כנף עומדת', 'Upright wing'), air ? tr('עומדת: מייצבת את הטיסה', 'Upright: steadies the flight') : tr('עומדת: ספוילר — אחיזה בפניות מהירות', 'Upright: a spoiler — grip in fast turns'));
      return V('wing', tr('כנף', 'Wing'), ctx.thrust ? tr('מרימה: טס כשיש מספיק מהירות', 'Lift: it flies once it has enough speed') : ctx.wheels ? tr('גולש אחרי קפיצה', 'Glides after a jump') : tr('צריכה מדחף או סילון כדי לטוס', 'Needs a propeller or a jet to fly'));
    }
    case 'barrel': {
      if (q.big) return V('giant', tr('תותח ענק', 'Giant cannon'), tr('ענק: פגז כבד ופיצוץ גדול, טעינה איטית — והרתיעה הודפת אותו אחורה', 'Giant: a heavy shell and a big blast, slow to reload — and the recoil pushes it back'));
      if (q.dy < -0.6) return V('down', tr('קנה למטה', 'Barrel down'), tr('כלפי מטה: מטיל פצצות', 'Pointing down: drops bombs'));
      if (q.dy > 0.6) return V('up', tr('קנה למעלה', 'Barrel up'), tr('כלפי מעלה: יורה על מסוקים ועל גגות', 'Pointing up: fires at helicopters and rooftops'));
      if (q.dx < -0.5) return V('rear', tr('קנה אחורי', 'Rear barrel'), tr('לאחור: יורה על מי שרודף', 'Backward: fires at whoever\'s chasing'));
      return q.closed && q.thick > (q.BH || 1) * 0.17 ? V('cannon', tr('תותח', 'Cannon'), tr('עבה: תותח — פגז שמתפוצץ', 'Thick: a cannon — a shell that explodes')) : V('mg', tr('מקלע', 'Machine gun'), tr('דק: מקלע — צרורות מהירים', 'Thin: a machine gun — fast bursts'));
    }
    case 'blade':
      if (q.front) return V('ram', tr('איל', 'Ram'), tr('מלפנים: מנגח ומרסק מכוניות', 'In front: rams and smashes cars'));
      if (q.back) return V('rear', tr('להב אחורי', 'Rear blade'), tr('מאחור: מי שנצמד מאחור — נהרס', 'At the back: whoever sticks to your tail — wrecked'));
      return V('side', tr('להבי צד', 'Side blades'), tr('בצדדים: חותך את מי שעוברים לידו', 'On the sides: cuts whoever passes by'));
    case 'head':
      return q.front ? V('ram', tr('ראש מנגח', 'Battering head'), tr('מלפנים: ניגוח כבד — מעיף מכוניות', 'In front: a heavy ram — sends cars flying')) : V('weight', tr('משקולת', 'Weight'), tr('משקל: יציב בפניות, איטי יותר', 'Weight: steady in turns, slower'));
    case 'spring':
      if (q.front) return V('bumper', tr('פגוש קפיץ', 'Spring bumper'), tr('מלפנים: מעיף את מי שנתקלים בו, בלי נזק', 'In front: sends flying whoever it bumps into, without damage'));
      if (q.back) return V('kick', tr('קפיץ זינוק', 'Launch spring'), tr('מאחור: זינוק קדימה (רווח)', 'At the back: a leap forward (Space)'));
      if (q.top) return V('righter', tr('קפיץ עליון', 'Top spring'), tr('על הגג: כשמתהפך — קופץ בחזרה על הגלגלים', 'On the roof: when it flips — it bounces back onto its wheels'));
      return V('jump', tr('קפיץ', 'Spring'), tr('מתחת: קופץ (רווח) — יותר ליפופים, גבוה יותר', 'Underneath: jumps (Space) — more coils, higher'));
    case 'sail':
      if (ctx.wheels && fam !== 'boat') return V('land', tr('מפרש יבשה', 'Land sail'), tr('על גלגלים: יאכטת יבשה — שקטה ומהירה בישר, איטית לצאת', 'On wheels: a land yacht — quiet and fast on the straight, slow to get going'));
      return V('sail', tr('מפרש', 'Sail'), tr('שט ברוח — בלי מנוע, בשקט', 'Sails on the wind — no engine, quietly'));
    case 'balloon':
      return V('balloon', tr('בלון', 'Balloon'), tr('מרים לאוויר לאט — קטן מדי למשקל: רק מאט נפילה', 'Lifts slowly into the air — too small for the weight: it only slows a fall'));
    case 'hull':
      return V('hull', tr('גוף צף', 'Floating hull'), tr('צף: נכנס למים וממשיך לשוט', 'Floats: drives into the water and keeps sailing'));
    case 'chute':
      return V('chute', tr('מצנח', 'Parachute'), tr('באוויר (G): נפתח ויורד לאט', 'In the air (G): opens and floats down slowly'));
    case 'armor':
      return q.front ? V('front', tr('שריון קדמי', 'Front armor'), tr('מלפנים: מנגח בלי להינזק', 'In front: rams without getting hurt')) : V('armor', tr('שריון', 'Armor'), tr('פגיעות כואבות פחות — אבל כבד', 'Hits hurt less — but heavy'));
    case 'fin':
      return air ? V('fin', tr('סנפיר', 'Fin'), tr('מייצב את הטיסה', 'Steadies the flight')) : fam === 'boat' ? V('keel', tr('קיל', 'Keel'), tr('יציב בפניות, לא מחליק', 'Steady in turns, doesn\'t skid')) : V('spoiler', tr('ספוילר', 'Spoiler'), tr('אחיזה בפניות מהירות', 'Grip in fast turns'));
    case 'skid':
      return air ? V('skid', tr('מגלש', 'Skid'), tr('נוחת על מגלשים', 'Lands on skids')) : V('sled', tr('מגלש', 'Skid'), tr('מחליק בפניות — דריפט', 'Slides in the turns — drifting'));
    case 'tail':
      return V('tail', tr('זנב', 'Tail'), fam === 'copter' ? tr('זנב מסוק: מייצב', 'A helicopter\'s tail: steadies it') : tr('קישוט', 'Decoration'));
    case 'mast':
      return ctx.sail ? V('mast', tr('תורן', 'Mast'), tr('מחזיק את המפרש', 'Holds the sail')) : V('aerial', tr('תורן', 'Mast'), tr('קישוט', 'Decoration'));
    case 'rope':
      return V('rope', tr('חבל', 'A rope'), tr('קישוט', 'Decoration'));
    case 'window':
      return V('window', tr('חלון', 'Window'), tr('קישוט — רואים דרכו', 'Decoration — you can see through it'));
    case 'deco':
      return V('deco', tr('קישוט', 'Decoration'), tr('רק מראה — בלי משקל ובלי השפעה', 'Looks only — no weight and no effect'));
    case 'body':
      return V('body', tr('גוף', 'Body'), tr('חלק מהגוף: עוד משקל ועוד עמידות', 'Part of the body: more weight and more toughness'));
    case 'cabin':
      return V('cabin', tr('תא', 'Cabin'), tr('תא על הגוף: הגוף עולה מעליו', 'A cabin on the body: the body rises above it'));
    case 'frame':
      return V('frame', tr('שלדה', 'Chassis'), tr('צינורות: קל ופתוח', 'Tubes: light and open'));
    case 'scope':
      return V('scope', tr('כוונת', 'Sight'), ctx.guns ? tr('כל הקנים מדייקים יותר', 'Every barrel is more accurate') : tr('אין קנה — לא משנה כלום', 'No barrel — it changes nothing'));
    case 'mag':
      return V('mag', tr('מחסנית', 'Magazine'), ctx.guns ? tr('הקנים נטענים מהר יותר', 'The barrels reload faster') : tr('אין קנה — לא משנה כלום', 'No barrel — it changes nothing'));
    case 'silencer':
      return V('silencer', tr('משתיק', 'Silencer'), ctx.guns ? tr('ירי שקט — לא מושך משטרה', 'Quiet fire — doesn\'t draw the police') : tr('אין קנה — לא משנה כלום', 'No barrel — it changes nothing'));
    case 'grip':
    case 'stock':
    case 'guard':
      return V('hand', t === 'grip' ? tr('ידית', 'Handle') : t === 'stock' ? tr('קת', 'Stock') : tr('מגן יד', 'Hand guard'), tr('הופך את כל הציור לנשק שמחזיקים ביד', 'Turns the whole drawing into a weapon you hold in your hand'));
    default:
      return V(t, t, '');
  }
}

// ------------------------------------------------------------------ the part's menu
// (on a thing for the hand: what each part does to it - game/handparts.js handSpec)
const HAND_SAY = {
  barrel: tr('יורה — ארוך יותר: רחוק ומדויק יותר', 'Fires — longer: further and more accurate'),
  grip: tr('מחזיקים כאן — שתי ידיות: יציב יותר', 'You hold it here — two handles: steadier'),
  mag: tr('יותר כדורים בכל מחסנית', 'More bullets in every magazine'),
  scope: tr('זום ודיוק כשמכוונים', 'Zoom and accuracy when you aim'),
  stock: tr('בועט פחות', 'Kicks less'),
  silencer: tr('אף אחד לא שומע את הירי', 'Nobody hears the shots'),
  blade: tr('על רובה: כידון. לבד: חותך', 'On a rifle: a bayonet. On its own: it cuts'),
  guard: tr('חוסם חלק מהמכה', 'Blocks some of the hit'),
  head: tr('הודף חזק', 'Knocks back hard'),
  spring: tr('הקליעים קופצים מהקירות', 'The bullets bounce off walls'),
  wing: tr('הקליעים טסים ומוצאים את המטרה', 'The bullets fly and find the target'),
  prop: tr('משב רוח שהודף אנשים', 'A gust of wind that blows people back'),
  chute: tr('מחזיקים אותו — נופלים לאט', 'Hold on to it — you fall slowly'),
  jet: tr('הקליעים מהירים יותר', 'The bullets are faster'),
  fin: tr('הקליעים יציבים — מדויק יותר', 'The bullets are steady — more accurate'),
  armor: tr('מגן: חוסם קצת מהפגיעות', 'A shield: blocks some of the hits'),
  body: tr('חלק מהנשק', 'Part of the weapon'),
  deco: tr('רק מראה — בלי השפעה', 'Looks only — no effect'),
};

// what the player's thing is made of now, for what its parts are where they are (P: game/parts.js
// readParts')
export function ctxOf(P) {
  const T = P.parts.map((q) => q.type);
  return { fam: P.family, wheels: T.includes('wheel') || (P.arches || []).length > 0, thrust: T.includes('jet') || T.includes('prop'), wings: T.includes('wing'), guns: T.includes('barrel'), sail: T.includes('sail') };
}

// every part line i could be, each with what it would do there - the menu's groups (likely: what
// it most likely is, first). P: game/parts.js readParts' (a ride) or game/handparts.js' (a thing for
// the hand). [{ k, name, items: [{ t, v, name, say }] }]
export function menuOf(P, i, likely = [], ride = (t) => true) {
  const o = P.st ? P.st.find((q) => q.i === i) : null;
  const B = P.frame === 'ride' && P.R ? P.R.sh : null;
  const q = o && B ? placeOf(o.pts, B) : null;
  // (a plane drawn from above: no up or down, its front still its front - each part as on any)
  if (q && P.top) Object.assign(q, { upright: false, flat: false, top: false, under: false, u: 0.5, v: 0.5, big: false });
  const ctx = q ? ctxOf(P) : null;
  const item = (t) => {
    if (q) return Object.assign({ t }, roleOf(t, q, ctx));
    const say = HAND_SAY[t] || (ride(t) ? tr('הופך את הציור לכלי רכב', 'Turns the drawing into a vehicle') : tr('רק מראה — בלי השפעה', 'Looks only — no effect'));
    return { t, v: t, name: null, say };
  };
  const out = [];
  if (likely.length) out.push({ k: 'likely', name: tr('מתאים כאן', 'Fits here'), items: likely.map(item) });
  for (const g of ROLE_GROUPS) out.push({ k: g.k, name: g.name, items: g.t.map(item) });
  return out;
}
