import { shapeOf } from './drawncar.js';

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
  { k: 'move', name: 'תנועה', t: ['wheel', 'rotor', 'prop', 'jet', 'wing', 'sail', 'balloon', 'hull', 'spring'] },
  { k: 'fire', name: 'נשק', t: ['barrel', 'blade', 'head', 'scope', 'mag', 'silencer'] },
  { k: 'gear', name: 'הגנה וציוד', t: ['armor', 'chute', 'fin', 'skid', 'tail'] },
  { k: 'body', name: 'מבנה', t: ['body', 'cabin', 'frame', 'mast', 'rope', 'window', 'deco'] },
  { k: 'hand', name: 'אחיזה', t: ['grip', 'stock', 'guard'] },
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
      if (sh.w > sh.h * 2.4 && q.long > (q.BW || 1) * 0.4 && q.v < 0.42) return V('track', 'זחל', 'זחל: איטי, לא מחליק, מסתובב במקום ועולה על מכוניות');
      if (q.top && q.u > -0.05 && q.u < 1.05 && (sh.w + sh.h) / 4 < (q.BW || 1) * 0.6) return V('roof', 'גלגל גג', ctx.wheels ? 'על הגג: כשהוא מתהפך — ממשיך לנסוע' : 'על הגג: נוסע הפוך, על הגב');
      // (ROADMAP 11.16: a wheel scribbled round and round fills its box twice over - round, not square)
      if (q.closed && !q.round && q.fill > 0.86 && q.fill < 1.08 && sh.len < (sh.w + sh.h) * 2.5 && Math.max(sh.w, sh.h) < Math.min(sh.w, sh.h) * 1.6) return V('square', 'גלגל מרובע', 'מרובע: מקפץ ואיטי יותר, אבל נאחז ומטפס');
      if ((sh.w + sh.h) / 4 > (q.BH || 1) * 0.42) return V('big', 'גלגל ענק', 'ענק: עולה על מדרכות ומכוניות, אבל כבד');
      return V('wheel', 'גלגל', air ? 'גלגל נחיתה: נוסע על הקרקע' : 'נוסע — גדול יותר, מהיר יותר');
    }
    case 'rotor':
    case 'prop': {
      // (ROADMAP 11.13) at a helicopter's tail, small: its tail rotor - it holds it straight
      if (fam === 'copter' && q.back && !q.top && (sh.w + sh.h) / 2 < (q.BH || 1) * 1.3) return V('tail', 'רוטור זנב', 'בזנב: מחזיק את המסוק ישר — בלעדיו הוא מסתובב סביב עצמו');
      if (q.upright) {
        if (q.back) return V('pusher', 'מדחף דוחף', fam === 'boat' ? 'עומד מאחור: דוחף — סירת ביצות מהירה' : fam === 'balloon' ? 'מאחור: דוחף את ספינת האוויר קדימה, והיא פונה לאן שמסתכלים' : ctx.wings ? 'עומד מאחור: דוחף את המטוס' : 'עומד מאחור: דוחף קדימה — עוד מהירות, גם במים');
        return V('puller', 'מדחף', ctx.wings ? 'עומד מלפנים: מושך את המטוס' : 'עומד: מושך קדימה — עוד מהירות');
      }
      if (q.under) return V('hover', 'מאוורר ריחוף', 'שוכב מתחת: רחפת — מחליקה על היבשה ועל המים');
      // (round, at an end - a fan facing out of it: it pushes, it pulls)
      if (!q.top && !q.flat && (q.front || q.back)) return q.back ? V('pusher', 'מדחף דוחף', 'מאחור: דוחף קדימה — עוד מהירות, גם במים') : V('puller', 'מדחף', 'מלפנים: מושך קדימה — עוד מהירות');
      return V('lift', t === 'prop' ? 'מדחף מרים' : 'רוטור', 'שוכב מעל: מרים — טס כמו מסוק, אם הוא גדול מספיק');
    }
    case 'jet': {
      // (an engine slung under a wing, lying along it: it pushes - pointing down under it: it lifts)
      // (ROADMAP 11.13: a rocket's, under its foot - it stands up, its back is down: it lifts)
      if (q.under && (ctx.rocket || (!q.back && !(ctx.wings && sh.w > sh.h * 1.15)))) return V('vtol', 'סילון אנכי', 'מתחת, כלפי מטה: ממריא ונוחת במקום');
      if (q.front && q.dx > -0.2) return V('retro', 'סילון הפוך', 'מלפנים: בלם חזק בבת אחת');
      return V('jet', 'סילון', fam === 'plane' || ctx.wings ? 'מאחור: דוחף את המטוס' : 'מאחור: טורבו (Shift)');
    }
    case 'wing': {
      if (q.upright) return V('fin', 'כנף עומדת', air ? 'עומדת: מייצבת את הטיסה' : 'עומדת: ספוילר — אחיזה בפניות מהירות');
      return V('wing', 'כנף', ctx.thrust ? 'מרימה: טס כשיש מספיק מהירות' : ctx.wheels ? 'גולש אחרי קפיצה' : 'צריכה מדחף או סילון כדי לטוס');
    }
    case 'barrel': {
      if (q.big) return V('giant', 'תותח ענק', 'ענק: פגז כבד ופיצוץ גדול, טעינה איטית — והרתיעה הודפת אותו אחורה');
      if (q.dy < -0.6) return V('down', 'קנה למטה', 'כלפי מטה: מטיל פצצות');
      if (q.dy > 0.6) return V('up', 'קנה למעלה', 'כלפי מעלה: יורה על מסוקים ועל גגות');
      if (q.dx < -0.5) return V('rear', 'קנה אחורי', 'לאחור: יורה על מי שרודף');
      return q.closed && q.thick > (q.BH || 1) * 0.17 ? V('cannon', 'תותח', 'עבה: תותח — פגז שמתפוצץ') : V('mg', 'מקלע', 'דק: מקלע — צרורות מהירים');
    }
    case 'blade':
      if (q.front) return V('ram', 'איל', 'מלפנים: מנגח ומרסק מכוניות');
      if (q.back) return V('rear', 'להב אחורי', 'מאחור: מי שנצמד מאחור — נהרס');
      return V('side', 'להבי צד', 'בצדדים: חותך את מי שעוברים לידו');
    case 'head':
      return q.front ? V('ram', 'ראש מנגח', 'מלפנים: ניגוח כבד — מעיף מכוניות') : V('weight', 'משקולת', 'משקל: יציב בפניות, איטי יותר');
    case 'spring':
      if (q.front) return V('bumper', 'פגוש קפיץ', 'מלפנים: מעיף את מי שנתקלים בו, בלי נזק');
      if (q.back) return V('kick', 'קפיץ זינוק', 'מאחור: זינוק קדימה (רווח)');
      if (q.top) return V('righter', 'קפיץ עליון', 'על הגג: כשמתהפך — קופץ בחזרה על הגלגלים');
      return V('jump', 'קפיץ', 'מתחת: קופץ (רווח) — יותר ליפופים, גבוה יותר');
    case 'sail':
      if (ctx.wheels && fam !== 'boat') return V('land', 'מפרש יבשה', 'על גלגלים: יאכטת יבשה — שקטה ומהירה בישר, איטית לצאת');
      return V('sail', 'מפרש', 'שט ברוח — בלי מנוע, בשקט');
    case 'balloon':
      return V('balloon', 'בלון', 'מרים לאוויר לאט — קטן מדי למשקל: רק מאט נפילה');
    case 'hull':
      return V('hull', 'גוף צף', 'צף: נכנס למים וממשיך לשוט');
    case 'chute':
      return V('chute', 'מצנח', 'באוויר (G): נפתח ויורד לאט');
    case 'armor':
      return q.front ? V('front', 'שריון קדמי', 'מלפנים: מנגח בלי להינזק') : V('armor', 'שריון', 'פגיעות כואבות פחות — אבל כבד');
    case 'fin':
      return air ? V('fin', 'סנפיר', 'מייצב את הטיסה') : fam === 'boat' ? V('keel', 'קיל', 'יציב בפניות, לא מחליק') : V('spoiler', 'ספוילר', 'אחיזה בפניות מהירות');
    case 'skid':
      return air ? V('skid', 'מגלש', 'נוחת על מגלשים') : V('sled', 'מגלש', 'מחליק בפניות — דריפט');
    case 'tail':
      return V('tail', 'זנב', fam === 'copter' ? 'זנב מסוק: מייצב' : 'קישוט');
    case 'mast':
      return ctx.sail ? V('mast', 'תורן', 'מחזיק את המפרש') : V('aerial', 'תורן', 'קישוט');
    case 'rope':
      return V('rope', 'חבל', 'קישוט');
    case 'window':
      return V('window', 'חלון', 'קישוט — רואים דרכו');
    case 'deco':
      return V('deco', 'קישוט', 'רק מראה — בלי משקל ובלי השפעה');
    case 'body':
      return V('body', 'גוף', 'חלק מהגוף: עוד משקל ועוד עמידות');
    case 'cabin':
      return V('cabin', 'תא', 'תא על הגוף: הגוף עולה מעליו');
    case 'frame':
      return V('frame', 'שלדה', 'צינורות: קל ופתוח');
    case 'scope':
      return V('scope', 'כוונת', ctx.guns ? 'כל הקנים מדייקים יותר' : 'אין קנה — לא משנה כלום');
    case 'mag':
      return V('mag', 'מחסנית', ctx.guns ? 'הקנים נטענים מהר יותר' : 'אין קנה — לא משנה כלום');
    case 'silencer':
      return V('silencer', 'משתיק', ctx.guns ? 'ירי שקט — לא מושך משטרה' : 'אין קנה — לא משנה כלום');
    case 'grip':
    case 'stock':
    case 'guard':
      return V('hand', t === 'grip' ? 'ידית' : t === 'stock' ? 'קת' : 'מגן יד', 'הופך את כל הציור לנשק שמחזיקים ביד');
    default:
      return V(t, t, '');
  }
}

// ------------------------------------------------------------------ the part's menu
// (on a thing for the hand: what each part does to it - game/handparts.js handSpec)
const HAND_SAY = {
  barrel: 'יורה — ארוך יותר: רחוק ומדויק יותר',
  grip: 'מחזיקים כאן — שתי ידיות: יציב יותר',
  mag: 'יותר כדורים בכל מחסנית',
  scope: 'זום ודיוק כשמכוונים',
  stock: 'בועט פחות',
  silencer: 'אף אחד לא שומע את הירי',
  blade: 'על רובה: כידון. לבד: חותך',
  guard: 'חוסם חלק מהמכה',
  head: 'הודף חזק',
  spring: 'הקליעים קופצים מהקירות',
  wing: 'הקליעים טסים ומוצאים את המטרה',
  prop: 'משב רוח שהודף אנשים',
  chute: 'מחזיקים אותו — נופלים לאט',
  jet: 'הקליעים מהירים יותר',
  fin: 'הקליעים יציבים — מדויק יותר',
  armor: 'מגן: חוסם קצת מהפגיעות',
  body: 'חלק מהנשק',
  deco: 'רק מראה — בלי השפעה',
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
    const say = HAND_SAY[t] || (ride(t) ? 'הופך את הציור לכלי רכב' : 'רק מראה — בלי השפעה');
    return { t, v: t, name: null, say };
  };
  const out = [];
  if (likely.length) out.push({ k: 'likely', name: 'מתאים כאן', items: likely.map(item) });
  for (const g of ROLE_GROUPS) out.push({ k: g.k, name: g.name, items: g.t.map(item) });
  return out;
}
