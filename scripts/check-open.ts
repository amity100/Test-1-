/**
 * The one rule the whole game rests on: nothing is ever locked.
 *
 * The old game asked "what does it want me to do" — ways in were shut until
 * somebody happened to stand in the right place, and the player's job was to
 * work out the trick. This build says the opposite: every option at every place
 * can be started at any moment, and the only thing that changes is the price.
 *
 * So this gate walks the entire catalogue against the entire world, in the
 * hardest conditions it can build, and refuses to ship if it ever finds a door.
 */
import { newGame, tick } from '../src/game/game';
import { TASKS, offersAt, priceOf, start } from '../src/game/jobs';
import type { GameState } from '../src/game/types';

let bad = 0;
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '✓' : '✗'} ${what}`);
  if (!cond) bad += 1;
};

const fresh = (seed = 'open') => {
  const s = newGame(seed);
  for (const p of Object.values(s.places)) p.found = true;
  return s;
};

// ── 1 · every task is offered wherever it makes sense, at any control ───────
{
  const cases: Array<[string, (s: GameState) => void]> = [
    ['בלי שום שליטה בכלל', (s) => { for (const p of Object.values(s.places)) p.control = 0; }],
    ['עם דריסת רגל קטנה', (s) => { for (const p of Object.values(s.places)) p.control = 5; }],
    ['עם שליטה מלאה', (s) => { for (const p of Object.values(s.places)) p.control = 100; }],
    ['כשכולם בבניין', (s) => { for (const q of Object.values(s.people)) { q.gone = false; q.atPlaceId = 'main'; } }],
    ['כשהחשד בשיא', (s) => { s.heat = 100; for (const p of Object.values(s.places)) p.heat = 100; }],
    ['כשהמקום שמור מאוד', (s) => { for (const p of Object.values(s.places)) p.guard = 100; }],
    ['כשאני לא יודע כלום', (s) => { s.info = 0; for (const p of Object.values(s.places)) p.seen = 0; }],
  ];

  let total = 0;
  let missing = 0;
  for (const [name, setup] of cases) {
    const s = fresh(`open-${name}`);
    setup(s);
    let here = 0;
    for (const p of Object.values(s.places)) {
      const offers = offersAt(s, p.id);
      here += offers.length;
      for (const o of offers) {
        // Every offer must be a price, never a refusal.
        if (o.minutes < 1 && o.task.minutes > 0) missing += 1;
        if (!Number.isFinite(o.minutes) || !Number.isFinite(o.noise)) missing += 1;
      }
    }
    total += here;
    ok(here > 0, `${name}: יש מה לעשות (${here} אפשרויות)`);
  }
  ok(missing === 0, `כל האפשרויות הן מחיר, אף אחת לא סירוב (${total} נבדקו)`);
}

// ── 2 · a place I have never touched still offers a way in ─────────────────
{
  const s = fresh('cold');
  for (const p of Object.values(s.places)) { p.control = 0; p.seen = 0; p.guard = 60; }
  s.power.all = 99;
  let cold = 0;
  for (const p of Object.values(s.places)) {
    const ways = offersAt(s, p.id).filter((o) => o.task.verb === 'connect');
    if (!ways.length) { console.log(`   ✗ ${p.name} — אין שום דרך להיכנס`); cold += 1; }
  }
  ok(cold === 0, 'לכל מקום בעולם יש דרך להיכנס אליו, גם כשאני לגמרי בחוץ');
}

// ── 3 · "not enough power" is about what is running, never a locked door ───
{
  const s = fresh('power');
  for (const p of Object.values(s.places)) p.control = 60;
  s.power.all = 1;
  s.power.used = 1;
  const o = offersAt(s, 'main').find((x) => x.power > 0)!;
  ok(!!o, 'האפשרות עדיין מוצעת כשאין כוח פנוי');
  ok(o.short > 0, `   וכתוב בדיוק כמה כוח חסר (${o.short})`);
  s.power.used = 0;
  const after = offersAt(s, 'main').find((x) => x.task.id === o.task.id)!;
  ok(after.short === 0, '   וברגע שמפנים כוח, אפשר להתחיל מיד');
  ok(start(s, 'main', after.task.id), '   וזה באמת מתחיל');
}

// ── 4 · the price really does move with the world ──────────────────────────
{
  const quiet = fresh('quiet');
  const busy = fresh('busy');
  for (const s of [quiet, busy]) for (const p of Object.values(s.places)) p.control = 50;
  for (const q of Object.values(quiet.people)) { q.gone = true; q.atPlaceId = 'gone'; }
  for (const q of Object.values(busy.people)) { q.gone = false; q.atPlaceId = 'dana_pc'; }
  const t = TASKS.find((x) => x.id === 'read')!;
  const a = priceOf(quiet, quiet.places.dana_pc, t);
  const b = priceOf(busy, busy.places.dana_pc, t);
  ok(b.minutes > a.minutes, `חדר מלא עולה יותר מחדר ריק (${a.minutes}׳ מול ${b.minutes}׳)`);
  ok(b.noise >= a.noise, '   וגם יותר אנשים ירגישו');
  ok(a.why.length > 0 && b.why.length > 0, 'ולכל מחיר יש הסבר בשפה רגילה');
  ok(!!b.cheaper, `ולכל מחיר יקר כתוב מה יוזיל אותו: "${b.cheaper}"`);
}

// ── 5 · a low `wants` is a curve, not a door ───────────────────────────────
{
  const t = TASKS.find((x) => x.wants);
  ok(!!t, 'יש משימות שמעדיפות שכבר אהיה חזק במקום');
  if (t) {
    const s = fresh('wants');
    const p = Object.values(s.places).find((x) => (t.kinds ?? []).includes(x.kind))!;
    p.control = 0;
    const out = priceOf(s, p, t);
    p.control = 100;
    const inside = priceOf(s, p, t);
    ok(out.minutes > inside.minutes,
      `מבחוץ זה עולה הרבה יותר, אבל אפשר (${out.minutes}׳ מול ${inside.minutes}׳)`);
    p.control = 0;
    s.power.all = 99;
    ok(offersAt(s, p.id).some((o) => o.task.id === t.id && o.short === 0),
      '   וזה מוצע ואפשר להתחיל אותו, גם מבחוץ');
  }
}

// ── 6 · nothing on screen is a word from a job ─────────────────────────────
{
  const BANNED = ['שרת', 'רשת', 'קוד', 'סייבר', 'האקר', 'וירוס', 'נתונים', 'פרוטוקול',
    'מערכת', 'אלגוריתם', 'צמתים'];
  const hits: string[] = [];
  for (const t of TASKS) {
    for (const line of [t.text, t.says, t.gives]) {
      for (const w of BANNED) if (line.includes(w)) hits.push(`${t.id}: «${w}» ב"${line}"`);
    }
  }
  for (const h of hits) console.log(`   ✗ ${h}`);
  ok(hits.length === 0, 'אין מילה אחת מעולם העבודה בשום כפתור');
}

// ── 7 · and it all still runs ──────────────────────────────────────────────
{
  const s = fresh('runs');
  for (const p of Object.values(s.places)) p.control = 40;
  s.power.all = 40;
  let started = 0;
  for (const p of Object.values(s.places)) {
    for (const o of offersAt(s, p.id)) {
      if (o.short > 0) continue;
      if (start(s, p.id, o.task.id)) started += 1;
    }
  }
  ok(started > 20, `אפשר להפעיל הרבה דברים בבת אחת (${started})`);
  for (let i = 0; i < 400; i++) tick(s, 3);
  ok(!Number.isNaN(s.heat) && !Number.isNaN(s.info), 'ואחרי עשרים שעות של ריצה שום מספר לא נשבר');
}

console.log(bad
  ? `\n✗ ${bad} דברים נעולים או שבורים.`
  : '\n✓ שום דבר לא נעול. הכל אפשר תמיד, ורק המחיר משתנה.');
process.exit(bad ? 1 : 0);
