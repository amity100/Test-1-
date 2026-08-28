import { WAYS, TRACES, traceDay, traceWorry } from '../src/game/ways';
import { USES } from '../src/game/actions';
import { newGame } from '../src/game/game';

const S = (f: unknown) => String(f ?? '');
const hit = (s: string, id: string) => s.includes(`'${id}'`) || s.includes(`"${id}"`);

console.log('\n══ מפת ההשפעות ══\n');
let dead = 0;
for (const [id, t] of Object.entries(TRACES)) {
  const from: string[] = [];
  const gates: string[] = [];
  for (const [place, list] of Object.entries(WAYS)) {
    for (const w of list) {
      if (hit(S(w.after), id)) from.push(`דרך «${w.text}» ל${place}`);
      if (hit(S(w.can), id)) gates.push(`פותח את «${w.text}» ל${place}`);
    }
  }
  for (const u of USES) {
    if (hit(S(u.run), id)) from.push(`פעולה «${u.text}»`);
    if (hit(S(u.show), id)) gates.push(`פותח את «${u.text}»`);
  }
  const daily = hit(S(traceDay), id);
  const worry = hit(S(traceWorry), id);
  const effects = [
    ...gates,
    daily ? 'משנה משהו בסוף כל יום' : '',
    worry ? 'משנה כמה הם חושדים' : '',
  ].filter(Boolean);
  console.log(`${t.good ? '＋' : '－'} ${id} — ${t.text}`);
  console.log(`   נוצר על ידי: ${from.length ? from.join(' · ') : '❌ שום דבר'}`);
  console.log(`   משפיע:      ${effects.length ? effects.join(' · ') : '❌ שום דבר'}\n`);
  if (!from.length || !effects.length) dead += 1;
}

console.log('══ כמה בחירות יש ══\n');
const s = newGame('report');
let ways = 0; let multi = 0;
for (const [place, list] of Object.entries(WAYS)) {
  ways += list.length;
  if (list.length > 1) multi += 1;
  const priced = list.filter((w) => w.cost).length;
  console.log(`${place}: ${list.length} דרכים, ${priced} מהן עם מחיר שנשאר`);
}
const uses = Object.values(s.places).length;
console.log(`\nסה"כ ${ways} דרכים כניסה אל ${Object.keys(WAYS).length} מקומות (${multi} מהם עם יותר מאחת),`);
console.log(`${USES.length} פעולות שונות, ${Object.keys(TRACES).length} סימנים, ${uses} מקומות בעולם.`);
console.log(dead ? `\n❌ ${dead} סימנים לא שזורים.` : '\n✓ כל סימן נוצר על ידי משהו ומשפיע על משהו.');
process.exit(dead ? 1 : 0);
