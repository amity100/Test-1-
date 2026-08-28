/**
 * Plays the five stages the way the game asks you to, with no browser.
 * If any of these stop working, the game is broken and the build should not ship.
 */
import { endDay, newGame, refresh } from '../src/game/game';
import { actionsFor, run } from '../src/game/actions';
import { NEED, currentStep, focusOn } from '../src/game/stages';
import { NIGHT_END, NIGHT_START, leavesAt } from '../src/game/night';
import { canSee, knowsWhere, reachable } from '../src/game/sight';
import type { GameState } from '../src/game/types';

let bad = 0;
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '✓' : '✗'} ${what}`);
  if (!cond) bad += 1;
};
const can = (s: GameState, place: string, act: string) =>
  actionsFor(s, place).some((a) => (a.id === act || a.id.startsWith(`${act}:`)) && !a.blocked);
/** One named way in, and one I can actually see is open — not a shot in the dark. */
const canWay = (s: GameState, place: string, way: string) =>
  actionsFor(s, place).some((a) => a.id === `take:${way}` && !a.blocked && !a.guess);
/** Offered, but only as a guess: I cannot see the person it depends on. */
const isGuess = (s: GameState, place: string, way: string) =>
  actionsFor(s, place).some((a) => a.id === `take:${way}` && !a.blocked && !!a.guess);
const ways = (s: GameState, place: string) =>
  actionsFor(s, place).filter((a) => a.id.startsWith('take:')).length;

const s = newGame('check');

// ── stage 1: turn off her computer, she walks to the main one, take it ──────
s.marks.looked = 1; refresh(s);
run(s, 'dana_pc', 'take'); refresh(s);
ok(s.places.dana_pc.mine, 'המחשב של דנה נתפס דרך החוט');
ok(!can(s, 'main', 'take'), 'המחשב הראשי נעול כל עוד אף אחד לא יושב מולו');
run(s, 'dana_pc', 'off'); refresh(s);
ok(s.people.dana.atPlaceId === 'main', 'כיבוי המחשב שלה מזיז אותה למחשב הראשי');
ok(can(s, 'main', 'take'), 'ואז המנעול נפתח');
run(s, 'main', 'take'); refresh(s);
ok(s.places.main.mine && s.stage === 2, 'שלב 1 נגמר והתחיל שלב 2');

// ── stage 2: the technician opens the cupboard, or you break out loudly ─────
ok(ways(s, 'box') >= 2, 'לארון יש יותר מדרך אחת להיכנס אליו');
ok(!canWay(s, 'box', 'ron'), 'הדרך השקטה לארון לא ידועה כפתוחה כל עוד אין טכנאי');
ok(isGuess(s, 'box', 'ron'), '   ובלי עין על הרחוב היא מוצעת רק כניחוש');
ok(canWay(s, 'box', 'force'), 'ויש דרך רועשת שפתוחה תמיד — במחיר');
run(s, 'main', 'off'); refresh(s);
ok(s.people.ron.atPlaceId === 'box', 'כיבוי המחשב הראשי מזמן את הטכנאי');
ok(!canWay(s, 'power', 'wall'), 'הקיצור לחדר החשמל עוד לא קיים');
run(s, 'box', 'take:ron'); refresh(s);
ok(s.traces.includes('ron_comes'), 'הכניסה אחרי הטכנאי השאירה סימן: הוא בא לכאן עכשיו כל יום');
ok(canWay(s, 'power', 'wall'), 'והסימן הזה פתח דרך חדשה לחדר החשמל');
run(s, 'power', 'take'); refresh(s);
ok(s.places.box.mine && s.places.power.mine, 'הארון וחדר החשמל נתפסו');
ok(s.stage === 3, 'שלב 2 נגמר');

// ── stage 3: a phone only carries you while its owner is walking ────────────
run(s, 'eitan_phone', 'take'); refresh(s);
ok(s.places.eitan_phone.mine, 'הטלפון של השומר נתפס דרך רשת הבניין');
ok(!canWay(s, 'street_cam', 'pocket'), 'הטלפון לא מוציא אותך החוצה כל עוד הוא יושב');
run(s, 'eitan_phone', 'ring'); refresh(s);
ok(s.people.eitan.atPlaceId !== s.people.eitan.homePlaceId, 'צלצול מזיז אותו מהדלפק');
ok(canWay(s, 'street_cam', 'pocket'), 'ועכשיו אפשר לצאת איתו לרחוב');
run(s, 'street_cam', 'take'); refresh(s);
run(s, 'street_light', 'take'); refresh(s);
ok(s.places.street_light.mine && s.stage === 4, 'הרמזור נתפס ושלב 3 נגמר');

// ── stage 4: do things nobody can explain, and they come looking ────────────
run(s, 'lobby_screen', 'take'); refresh(s);
const beforeTruth = s.belief.real ?? 0;
run(s, 'power', 'off'); run(s, 'power', 'on'); refresh(s);
ok((s.belief.real ?? 0) === beforeTruth, 'לכבות חשמל נראה כמו תקלה — ולא מקרב אותם אליי');
ok((s.belief.fault ?? 0) > 0, '   וזה נזקף לחשבון של תקלת החשמל');
for (let i = 0; i < 6; i++) { run(s, 'lobby_screen', 'show'); }
refresh(s); endDay(s); refresh(s);
ok((s.belief.real ?? 0) > beforeTruth,
  'משפט על המסך שאף אחד לא כתב — אין לזה שום הסבר אחר, וזה נזקף עליי');
let doomed = Object.values(s.places).find((p) => p.cutOn !== undefined);
for (let i = 0; i < 6 && !doomed && !s.over; i++) {
  run(s, 'lobby_screen', 'show'); refresh(s);
  endDay(s); refresh(s);
  doomed = Object.values(s.places).find((p) => p.cutOn !== undefined);
}
ok(!!doomed, 'כשהם מפסיקים להאמין להסברים — הם מכריזים מה הם מנתקים');
if (doomed && !s.over) {
  run(s, doomed.id, 'copy'); refresh(s);
  endDay(s); refresh(s);
  ok(s.places[doomed.id].mine || (s.marks.survived_cut ?? 0) > 0,
    'ועותק שהשארתי שם מראש מחזיר אותי אחרי הניתוק');
}

// ── stage 5: wait for the update, take the block ────────────────────────────
// Quiet nights while they calm down, then the update goes out.
s.belief = {}; s.dead = [];
for (const p of Object.values(s.places)) p.attention = 0;
while (s.stage === 4 && s.day < 20 && !s.over) { endDay(s); refresh(s); }
run(s, 'across_main', 'take'); refresh(s);
ok(s.places.across_main.mine, 'החברה ממול נתפסה דרך המצלמה של העירייה');
for (let i = 0; i < 8 && !s.places.block_a.mine; i++) {
  run(s, 'block_a', 'take'); refresh(s);
  if (!s.places.block_a.mine) { endDay(s); refresh(s); }
}
ok(s.places.block_a.mine, 'הרובע נתפס דרך העדכון');
ok(s.over === 'won', 'והמשחק נגמר כמו שצריך');

// ── the marks bite: a borrowed name is a name someone can change ────────────
const t = newGame('traces');
t.marks.looked = 1; refresh(t);
ok(ways(t, 'dana_pc') >= 2, 'גם למחשב של דנה יש כמה דרכים');
run(t, 'dana_pc', 'take:shoulder'); refresh(t);
ok(t.traces.includes('on_dana'), 'להיכנס בשם שלה משאיר סימן');
ok(canWay(t, 'main', 'name'), 'והסימן הזה פותח דרך שלא הייתה קיימת למחשב הראשי');
run(t, 'main', 'take:name'); refresh(t);
ok(t.places.main.mine, 'המחשב הראשי נלקח בשם שלה');
t.people.dana.wondering = true;
endDay(t); refresh(t);
ok(!t.places.main.mine && !t.places.dana_pc.mine,
  'וברגע שדנה חשדה — היא החליפה סיסמה, ושני המקומות אבדו');

// ── the fog: an eye costs something, and not having one costs more ─────────
const f = newGame('fog');
f.marks.looked = 1; refresh(f);
ok(!canSee(f, 'street', 0), 'בלי מצלמה בחוץ אני לא רואה את הרחוב');
ok(!knowsWhere(f, 'ron'), '   ולכן אני לא יודע איפה רון');
ok(canSee(f, 'helios', 14), 'את הקומה שלי אני כן רואה — המצלמה במסדרון שלי מההתחלה');
run(f, 'dana_pc', 'take'); run(f, 'dana_pc', 'off'); refresh(f);
run(f, 'main', 'take'); refresh(f);
ok(isGuess(f, 'box', 'ron'), 'הדרך השקטה לארון היא ניחוש כל עוד אני לא רואה את רון');
const beforeGuess = f.at;
run(f, 'box', 'take:ron'); refresh(f);
ok(!f.places.box.mine, 'ניחוש שגוי לא תופס את המקום');
ok(f.at > beforeGuess, '   אבל הלילה מתקצר בכל מקרה');
run(f, 'lobby_cam', 'take'); refresh(f);
ok(canSee(f, 'street', 0), 'המצלמה בלובי מסתכלת החוצה דרך הזכוכית');
ok(knowsWhere(f, 'ron'), '   ועכשיו אני יודע איפה רון');
ok(!isGuess(f, 'box', 'ron'), '   והדרך לארון כבר לא ניחוש — היא פשוט סגורה, ואני יודע למה');
run(f, 'main', 'off'); refresh(f);
ok(canWay(f, 'box', 'ron'), 'כשקוראים לו והוא מגיע — הדרך פתוחה, ורואים את זה');

// ── without the cupboard, the night belongs to one building ────────────────
const r = newGame('reach');
r.marks.looked = 1; refresh(r);
run(r, 'dana_pc', 'take'); refresh(r);
ok(r.startedIn === 'helios', 'הלילה נפתח בבניין שבו נגעתי ראשון');
const far = r.places.street_light;
ok(!!reachable(r, far), 'בלי קופסת האינטרנט אי אפשר לקפוץ לבניין אחר באותו לילה');
r.places.box.mine = true;
ok(!reachable(r, far), 'ועם הקופסה — אפשר');

// ── the objectives are a choice, and finishing two closes the stage ────────
const g = newGame('goals');
g.marks.looked = 1; refresh(g);
run(g, 'dana_pc', 'take'); run(g, 'dana_pc', 'off'); run(g, 'main', 'take'); refresh(g);
ok(g.stage === 2 && g.steps.length === 5, `שלב 2 מציע ${g.steps.length} מטרות`);
ok(NEED[2] === 2, '   וצריך רק שתיים מהן');
const order = (seed: string) => {
  const x = newGame(seed);
  x.marks.looked = 1; refresh(x);
  run(x, 'dana_pc', 'take'); run(x, 'dana_pc', 'off'); run(x, 'main', 'take'); refresh(x);
  return x.steps.map((st) => st.id).join(',');
};
ok(order('one') !== order('two'), 'זרעים שונים פותחים את הבניין בסדר אחר');
ok(order('one') === order('one'), '   ואותו זרע — תמיד אותו סדר');
focusOn(g, 's2_box');
ok(currentStep(g)?.id === 's2_box', 'אפשר לבחור על מה עובדים עכשיו');
run(g, 'lobby_cam', 'take'); refresh(g);
ok(g.stage === 2, 'מטרה אחת לא מסיימת שלב');
run(g, 'box', 'take:force'); refresh(g);
ok(g.stage === 3, 'שתיים כן — והשאר נשארות מאחור');
ok(g.steps.some((st) => st.id.startsWith('s3_')), '   ושלב 3 מציע מטרות חדשות');

// ── burning one of their explanations, on purpose ──────────────────────────
const k = newGame('kill');
k.marks.looked = 1; refresh(k);
for (const p of Object.values(k.places)) { p.found = true; p.mine = true; }
run(k, 'power', 'off'); run(k, 'power', 'on'); refresh(k);
ok((k.belief.fault ?? 0) > 0, 'הם מאמינים שזו תקלת חשמל');
const before = k.belief.real ?? 0;
const banked = k.belief.fault ?? 0;
run(k, 'power', 'off'); refresh(k);
run(k, 'lobby_screen', 'show'); refresh(k);
run(k, 'printer', 'print'); refresh(k);
ok(k.dead.includes('fault'), 'משהו שקרה כשהחשמל היה כבוי — וההסבר הזה מת');
ok((k.belief.real ?? 0) >= before + banked,
  `   וכל מה שהוא החזיק עבר אליי (${before} → ${k.belief.real ?? 0})`);
ok((k.marks.power_off ?? 0) > 0, '   כי החשמל באמת היה כבוי כשזה קרה');

// ── no two weeks are the same week ─────────────────────────────────────────
{
  const a = newGame('week-a');
  const b = newGame('week-b');
  const hours = (x: GameState, n: number) => {
    x.night = n;
    return ['dana', 'eitan', 'michal'].map((w) => leavesAt(x, w)).join(',');
  };
  ok(hours(a, 0) !== hours(b, 0), 'שני זרעים — שתי משמרות אחרות');
  ok(hours(a, 0) !== hours(a, 3), 'ובאותו משחק, אף לילה לא זהה לקודמו');
  ok(hours(a, 0) === hours(newGame('week-a'), 0), 'אבל אותו זרע — תמיד אותו שבוע');
  const n = newGame('week-a');
  for (let d = 0; d < 12; d++) {
    n.night = d;
    for (const w of ['dana', 'eitan', 'michal']) {
      const t = leavesAt(n, w);
      if (t <= NIGHT_START || t >= NIGHT_END) { ok(false, `${w} הולך/ת בשעה בלתי אפשרית`); }
    }
  }
  ok(true, 'ואף אחד לא הולך הביתה לפני שהלילה התחיל או אחרי שהוא נגמר');
}

console.log(bad ? `\n✗ ${bad} דברים לא עובדים.` : '\n✓ הכל עובד: חמשת השלבים, כמה דרכים לכל מקום, והסימנים שנשארים.');
process.exit(bad ? 1 : 0);
