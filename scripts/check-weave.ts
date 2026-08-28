/**
 * Does a choice actually change the rest of the game?
 *
 * Every scenario here is one claim about the weave, written so it can fail: take
 * this way rather than that one, and something specific happens later that would
 * not otherwise have happened. If the choices ever stop mattering, these break.
 */
import { endDay, newGame, refresh } from '../src/game/game';
import { actionsFor, run } from '../src/game/actions';
import { waysTo } from '../src/game/ways';
import type { GameState } from '../src/game/types';

let bad = 0;
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '✓' : '✗'} ${what}`);
  if (!cond) bad += 1;
};
const head = (t: string) => console.log(`\n── ${t}`);

/** Hand somebody everything except one place, so a single way can be tested. */
const holding = (seed: string, except: string[] = []) => {
  const s = newGame(seed);
  for (const p of Object.values(s.places)) {
    p.found = true;
    if (!except.includes(p.id)) p.mine = true;
  }
  return s;
};
const open = (s: GameState, place: string, way: string) =>
  waysTo(s, place).find((w) => w.id === way)?.ready ?? false;
const why = (s: GameState, place: string, way: string) =>
  waysTo(s, place).find((w) => w.id === way)?.why ?? '';

// ── 1 · a borrowed name is a name somebody can take back ────────────────────
head('השם של דנה');
{
  const s = newGame('name');
  s.marks.looked = 1; refresh(s);
  ok(!open(s, 'main', 'name'), 'בלי השם שלה, הדרך למחשב הראשי דרך השם סגורה');
  run(s, 'dana_pc', 'take:shoulder'); refresh(s);
  ok(open(s, 'main', 'name'), 'אחרי שלקחתי את השם — הדרך נפתחה');
  ok(!open(s, 'dana_pc', 'empty'), 'ובמקביל נסגרה הדרך של החדר הריק — היא נועלת מסך עכשיו');
  ok(why(s, 'dana_pc', 'empty').includes('נועלת'), '   והמשחק מסביר למה');
  run(s, 'main', 'take:name'); refresh(s);
  const held = Object.values(s.places).filter((p) => p.mine).length;
  s.people.dana.wondering = true;
  endDay(s); refresh(s);
  ok(!s.places.main.mine && !s.places.dana_pc.mine, 'וכשהיא חשדה — שני המקומות נעלמו');
  ok(Object.values(s.places).filter((p) => p.mine).length === held - 2, '   בדיוק שניים, לא יותר');
}

// ── 2 · the technician you trained opens doors, until he stops believing ─────
head('רון הטכנאי');
{
  const s = holding('ron', ['box', 'power', 'street_light']);
  s.people.ron.atPlaceId = 'box';
  ok(!open(s, 'power', 'wall'), 'לפני שנכנסתי אחרי רון — אין קיצור לחדר החשמל');
  run(s, 'box', 'take:ron'); refresh(s);
  ok(s.traces.includes('ron_comes'), 'הכניסה אחריו השאירה סימן');
  ok(open(s, 'power', 'wall'), 'והסימן פתח את הקיצור');

  // Now make him suspicious, and the door he used to hold open closes.
  const t = holding('ron2', ['box', 'street_light']);
  t.people.ron.atPlaceId = 'street_light';
  t.marks.seen_me = 1; t.hunt.level = 2;
  run(t, 'street_light', 'take:ron'); refresh(t);
  ok(t.traces.includes('ron_tired'), 'לקחת את הרמזור דרכו כשכבר חושדים — עייף אותו');
  t.people.ron.atPlaceId = 'box';
  ok(!open(t, 'box', 'ron'), 'ומאז הוא לא נשאר לבד מול הארון');
  ok(why(t, 'box', 'ron').includes('לבד'), '   והמשחק מסביר בדיוק למה');
}

// ── 3 · forcing your way out is a mark that never stops costing ─────────────
head('לפרוץ בכוח');
{
  const a = holding('force', ['box']);
  run(a, 'box', 'take:force'); refresh(a);
  ok(a.traces.includes('loose_line'), 'הפריצה השאירה סימן על הקו');
  ok(!open(a, 'main', 'night'), 'ומאז אי אפשר להיכנס למחשב הראשי לאט בלילה');
  const before = a.places.main.attention;
  endDay(a); refresh(a);
  ok(a.places.main.attention >= before, 'והקו ממשיך להראות משהו כל בוקר');

  const b = holding('quiet', ['box']);
  b.people.ron.atPlaceId = 'box';
  run(b, 'box', 'take:ron'); refresh(b);
  ok(!b.traces.includes('loose_line'), 'מי שחיכה לטכנאי לא השאיר את הסימן הזה');
  ok(b.traces.join() !== a.traces.join(), 'שתי הדרכים לאותו ארון מובילות לשני משחקים שונים');
}

// ── 4 · two stories that cannot both be true ────────────────────────────────
head('סיפור שסותר את עצמו');
{
  const s = holding('story');
  run(s, 'door', 'entry'); refresh(s);
  ok(s.traces.includes('blamed_person'), 'רשמתי שנכנס מישהו — הם מחפשים בן אדם');
  run(s, 'power', 'off'); refresh(s);
  endDay(s); refresh(s);
  ok(!s.traces.includes('blamed_person'),
    'ואז כיביתי את כל הבניין. בן אדם לא עושה את זה — הסיפור התמוטט');

  const t = holding('story2');
  run(t, 'street_light', 'drift'); run(t, 'street_light', 'drift'); run(t, 'street_light', 'drift');
  refresh(t);
  ok(t.traces.includes('blamed_cable'), 'הזזתי את הרמזור לאט־לאט, וכולם האמינו שזה כבל');
  run(t, 'street_light', 'jam'); refresh(t);
  endDay(t); refresh(t);
  ok(!t.traces.includes('blamed_cable'),
    'ואז תקעתי את הצומת. כבל בבניין לא עוצר צומת — הסיפור נגמר');
}

// ── 5 · the pages stop piling up once the printer is yours ──────────────────
head('הדפים');
{
  const s = holding('paper', ['main']);
  s.places.printer.mine = true;
  run(s, 'main', 'take:paper'); refresh(s);
  ok(s.traces.includes('paper'), 'הכניסה דרך המדפסת משאירה דפים');
  const withPrinter = (() => {
    const c = holding('p1'); c.traces.push('paper');
    const a0 = c.places.printer.attention;
    endDay(c);
    return c.places.printer.attention - a0;
  })();
  const without = (() => {
    const c = holding('p2', ['printer']); c.traces.push('paper');
    const a0 = c.places.printer.attention;
    endDay(c);
    return c.places.printer.attention - a0;
  })();
  ok(without > withPrinter, 'מי שהמדפסת שלו — הדפים לא נערמים; מי שלא — כן');
}

// ── 6 · riding a phone ends the day its owner starts writing things down ────
head('הטלפון של איתן');
{
  const s = holding('phone', ['street_cam']);
  s.people.eitan.atPlaceId = 'door';
  ok(open(s, 'street_cam', 'pocket'), 'כשהוא זז — אפשר לצאת בכיס שלו');
  run(s, 'street_cam', 'take:pocket'); refresh(s);
  ok(s.traces.includes('on_phone'), 'והיציאה משאירה אותי תלוי בטלפון שלו');

  const t = holding('phone2', ['eitan_phone', 'street_cam']);
  run(t, 'eitan_phone', 'take:charge'); refresh(t);
  ok(t.traces.includes('eitan_writes'), 'הכניסה דרך המטען גורמת לו לרשום דברים');
  t.people.eitan.atPlaceId = 'door';
  ok(!open(t, 'street_cam', 'pocket'), 'ומאז אי אפשר לצאת בכיס שלו יותר');
}

// ── 7 · what they believe decides where they look ───────────────────────────
head('לאן הם מסתכלים');
{
  const person = holding('scan1');
  person.traces.push('blamed_person');
  person.marks.seen_me = 1;   // they have seen something they cannot write off
  person.places.dana_pc.attention = 1;
  person.places.box.attention = 3;
  endDay(person); refresh(person);
  ok(!person.places.dana_pc.mine || !person.places.home.mine || !person.places.main.mine,
    'כשהם מחפשים בן אדם — הסורק הולך למחשבים של אנשים');
  ok(person.places.box.mine, '   והארון, שהוא הכי חם, נשאר שלי');

  const line = holding('scan2');
  line.traces.push('loose_line');
  line.marks.seen_me = 1;
  line.places.dana_pc.attention = 3;
  endDay(line); refresh(line);
  ok(!line.places.main.mine || !line.places.box.mine || !line.places.printer.mine,
    'כשהסימן הוא על הקו — הסורק הולך לקו, ולא למחשב הכי חם');
}

// ── 8 · the same place, three ways, three different games ───────────────────
head('אותו מקום, שלושה משחקים');
{
  const marks = (way: string) => {
    const s = holding(`w-${way}`, ['street_cam']);
    s.people.eitan.atPlaceId = 'door';
    s.people.ron.atPlaceId = 'box';
    s.marks.power_off = 1;
    run(s, 'street_cam', `take:${way}`); refresh(s);
    return `${s.traces.slice().sort().join(',')}|${s.places.street_cam.attention}`;
  };
  const a = marks('pocket'); const b = marks('cable'); const c = marks('car');
  ok(a !== b && b !== c && a !== c,
    `שלוש הדרכים למצלמה ברחוב משאירות שלושה מצבים שונים (${a} / ${b} / ${c})`);
}

console.log(bad ? `\n✗ ${bad} דברים לא שזורים כמו שצריך.` : '\n✓ כל בחירה משנה את מה שאפשר אחר כך.');
process.exit(bad ? 1 : 0);
