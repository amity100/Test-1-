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
import { ACT_ON, asking, collapse, looksAt, nextMove } from '../src/game/theory';
import { NIGHT_END, clock } from '../src/game/night';
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
  const pile = (own: boolean) => {
    const c = own ? holding('p1') : holding('p2', ['printer']);
    c.traces.push('paper');
    // Give it a start above the morning's cooling, so the pile is measurable.
    c.places.printer.attention = 2;
    endDay(c);
    return c.places.printer.attention;
  };
  ok(pile(false) > pile(true), 'מי שהמדפסת שלו — הדפים לא נערמים; מי שלא — כן');
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
  // Believing it was a person sends them through the entry log and people's
  // computers — and past the cupboard, however hot the cupboard is.
  const person = holding('scan1');
  person.belief.insider = 10;
  person.places.box.attention = 3;
  person.places.door.attention = 2;
  endDay(person); refresh(person);
  ok(person.places.door.attention === 0,
    'כשהם מאמינים שזה בן אדם — הם הולכים ליומן הכניסות');
  ok(person.places.box.attention >= 2,
    '   והארון, שהוא הכי חם, נשאר בלי שאף אחד הסתכל עליו');

  // Believing it is the wiring sends them to the panels instead.
  const line = holding('scan2');
  line.belief.fault = 10;
  line.places.power.attention = 2;
  line.places.dana_pc.attention = 3;
  endDay(line); refresh(line);
  ok(line.places.power.attention === 0, 'כשהם מאמינים שזו תקלה — הם הולכים ללוחות');
  ok(line.places.dana_pc.attention >= 2, '   ולא למחשב הכי חם בבניין');

  // And when they stop believing any of it, they come for what is actually mine.
  const found = holding('scan3');
  found.belief.real = 12;
  found.places.main.attention = 3;
  endDay(found); refresh(found);
  ok(!found.places.main.mine || !found.places.box.mine || !found.places.floor_cam.mine,
    'וכשהם כבר לא מאמינים לשום הסבר — הם באים ישר אליי');
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

// ── 9 · noise is a statement, not a cost ────────────────────────────────────
head('איך הרעש נראה');
{
  const s = holding('look');
  const before = s.belief.real ?? 0;
  run(s, 'power', 'off'); run(s, 'power', 'on'); refresh(s);
  ok((s.belief.real ?? 0) === before, 'לכבות חשמל לא מקרב אותם אליי בכלל');
  ok((s.belief.fault ?? 0) >= 2, '   הכל נזקף לתקלת החשמל');

  const t = holding('look2');
  run(t, 'door', 'entry'); refresh(t);
  ok((t.belief.insider ?? 0) > 0, 'שורה ביומן הכניסות שולחת אותם לחפש בן אדם');

  const u = holding('look3');
  const b0 = u.belief.real ?? 0;
  run(u, 'lobby_screen', 'show'); refresh(u);
  ok((u.belief.real ?? 0) > b0, 'ומשפט על המסך שאף אחד לא כתב — אין לו שום הסבר חוץ ממני');
}

// ── 10 · a story that collapses hands them the truth ────────────────────────
head('כשסיפור מתמוטט');
{
  const s = holding('collapse');
  for (let i = 0; i < 4; i++) { run(s, 'power', 'off'); run(s, 'power', 'on'); }
  refresh(s);
  const piled = s.belief.fault ?? 0;
  ok(piled >= 4, `ערמתי ${piled} ראיות על "תקלת חשמל"`);
  const truthBefore = s.belief.real ?? 0;
  collapse(s, 'fault');
  ok((s.belief.real ?? 0) >= truthBefore + piled,
    'וברגע שהסיפור נפסל — כל מה שהוא החזיק עבר אליי. שקר שמתמוטט גרוע משתיקה');
}

// ── 11 · a cover story is a fuse, not a shield ──────────────────────────────
head('הסיפור נשרף');
{
  const s = holding('fuse');
  s.belief.fault = ACT_ON + 2;
  const hadPower = s.places.power.mine;
  endDay(s); refresh(s);
  ok(hadPower && !s.places.power.mine,
    'כשהאמינו לי מספיק שזו תקלת חשמל — הם החליפו את הלוחות, ואיבדתי את חדר החשמל');
  ok((s.belief.fault ?? 0) < ACT_ON,
    '   והסיפור עצמו נשרף: צריך להתחיל לבנות אותו מחדש');
}

// ── 12 · the hour is half the decision ──────────────────────────────────────
head('השעה');
{
  const early = holding('early');
  early.at = 3 * 60 + 20;
  const e0 = Object.values(early.belief).reduce((n, x) => n + x, 0);
  run(early, 'printer', 'print'); refresh(early);
  const eGain = Object.values(early.belief).reduce((n, x) => n + x, 0) - e0;

  const late = holding('late');
  late.at = 7 * 60 + 40;
  const l0 = Object.values(late.belief).reduce((n, x) => n + x, 0);
  run(late, 'printer', 'print'); refresh(late);
  const lGain = Object.values(late.belief).reduce((n, x) => n + x, 0) - l0;
  ok(lGain > eGain,
    `אותה הדפסה בדיוק: ב־03:20 עולה ${eGain}, ב־07:40 עולה ${lGain}`);
}

// ── 13 · the night runs out ─────────────────────────────────────────────────
head('הלילה');
{
  const s = holding('clock');
  const t0 = s.at;
  run(s, 'printer', 'print'); refresh(s);
  ok(s.at > t0, `כל פעולה לוקחת זמן (${clock(t0)} → ${clock(s.at)})`);
  let n = 0;
  while (s.at < NIGHT_END && n < 200) { run(s, 'floor_cam', 'watch'); n++; }
  ok(s.at >= NIGHT_END, `והלילה נגמר אחרי ${n} הצצות במצלמה`);

  // The budget that matters is not how many times you can glance at a camera.
  // It is how many places you can actually take in one night.
  const t = newGame('budget');
  for (const p of Object.values(t.places)) p.found = true;
  t.places.home.mine = true; t.places.floor_cam.mine = true;
  let takes = 0;
  while (t.at < NIGHT_END && takes < 40) {
    const next = Object.values(t.places).find((p) => !p.mine
      && actionsFor(t, p.id).some((a) => a.id.startsWith('take:') && !a.blocked));
    if (!next) break;
    const a = actionsFor(t, next.id).find((x) => x.id.startsWith('take:') && !x.blocked)!;
    run(t, next.id, a.id);
    takes++;
  }
  ok(takes <= 10, `ובלילה אחד אפשר לקחת ${takes} מקומות, לא יותר`);
}

// ── 14 · surviving is not the same as not paying ────────────────────────────
head('לשרוד ניתוק');
{
  const s = holding('cut');
  const doomed = s.places.dana_pc;
  doomed.copy = true;
  doomed.cutOn = s.night + 1;
  const neighbours = () => Object.values(s.places)
    .filter((p) => p.mine && p.buildingId === 'helios' && Math.abs(p.floor - doomed.floor) <= 1).length;
  const had = neighbours();
  endDay(s); refresh(s);
  ok(s.places.dana_pc.mine, 'עותק במקום שמנתקים מחזיר אותי');
  ok((s.marks.survived_cut ?? 0) > 0, '   וזה נחשב שרידה');
  ok(neighbours() < had,
    `   אבל הם משכו את כל הקו — ומקום נוסף ירד איתו (${had} → ${neighbours()})`);
  ok(!s.places.dana_pc.copy, '   והעותק עצמו נשרף. בפעם הבאה צריך להשאיר חדש');
}

// ── 15 · somebody's name is on it ───────────────────────────────────────────
head('מי שואל');
{
  const s = holding('who');
  for (let i = 0; i < 6; i++) { run(s, 'power', 'off'); run(s, 'power', 'on'); }
  refresh(s);
  const a = asking(s);
  ok(!!a, `כשמאמינים לתקלת חשמל — יש שם לזה: ${a?.name ?? '—'}`);
  ok(nextMove(s).includes(a?.name ?? '###'), '   והתוכנית למחר נאמרת בשמו');
  const first = looksAt(s).map((id) => s.places[id]).find((p) => p?.found);
  ok(!!first && nextMove(s).includes(first.name), `   ואומרת גם איפה הוא מתחיל (${first?.name})`);
}

console.log(bad ? `\n✗ ${bad} דברים לא שזורים כמו שצריך.` : '\n✓ כל בחירה משנה את מה שאפשר אחר כך.');
process.exit(bad ? 1 : 0);
