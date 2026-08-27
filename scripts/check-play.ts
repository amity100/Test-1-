/**
 * Plays the five stages the way the game asks you to, with no browser.
 * If any of these stop working, the game is broken and the build should not ship.
 */
import { endDay, newGame, refresh } from '../src/game/game';
import { actionsFor, run } from '../src/game/actions';
import { currentStep } from '../src/game/stages';
import type { GameState } from '../src/game/types';

let bad = 0;
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '✓' : '✗'} ${what}`);
  if (!cond) bad += 1;
};
const can = (s: GameState, place: string, act: string) =>
  actionsFor(s, place).some((a) => a.id === act && !a.blocked);

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

// ── stage 2: the technician opens the cupboard for you ──────────────────────
ok(!can(s, 'box', 'take'), 'הארון סגור כל עוד אין טכנאי');
run(s, 'main', 'off'); refresh(s);
ok(s.people.ron.atPlaceId === 'box', 'כיבוי המחשב הראשי מזמן את הטכנאי');
run(s, 'box', 'take'); refresh(s);
run(s, 'power', 'take'); refresh(s);
ok(s.places.box.mine && s.places.power.mine, 'הארון וחדר החשמל נתפסו');
ok(s.stage === 3, 'שלב 2 נגמר');

// ── stage 3: a phone only carries you while its owner is walking ────────────
run(s, 'eitan_phone', 'take'); refresh(s);
ok(s.places.eitan_phone.mine, 'הטלפון של השומר נתפס דרך רשת הבניין');
ok(!can(s, 'street_cam', 'take'), 'הטלפון לא מוציא אותך החוצה כל עוד הוא יושב');
run(s, 'eitan_phone', 'ring'); refresh(s);
ok(s.people.eitan.atPlaceId !== s.people.eitan.homePlaceId, 'צלצול מזיז אותו מהדלפק');
ok(can(s, 'street_cam', 'take'), 'ועכשיו אפשר לצאת איתו לרחוב');
run(s, 'street_cam', 'take'); refresh(s);
run(s, 'street_light', 'take'); refresh(s);
ok(s.places.street_light.mine && s.stage === 4, 'הרמזור נתפס ושלב 3 נגמר');

// ── stage 4: be loud, they unplug, a copy brings you back ───────────────────
run(s, 'street_light', 'jam');
run(s, 'power', 'off');
endDay(s); refresh(s);
ok(s.hunt.level >= 2, 'רעש בשני מקומות באותו יום מביא אותם לנתק');
const doomed = Object.values(s.places).find((p) => p.cutOn !== undefined);
ok(!!doomed, 'מקום מסוים מסומן לניתוק, ורואים מתי');
if (doomed) {
  run(s, doomed.id, 'copy'); refresh(s);
  const held = Object.values(s.places).filter((p) => p.mine).length;
  endDay(s); endDay(s); refresh(s);
  ok(s.places[doomed.id].mine, 'העותק החזיר אותי אחרי הניתוק');
  ok(Object.values(s.places).filter((p) => p.mine).length >= held - 1, 'ולא איבדתי את כל הבניין');
}

// ── stage 5: wait for the update, take the block ────────────────────────────
while (s.stage === 4 && s.day < 20) { endDay(s); refresh(s); }
run(s, 'across_main', 'take'); refresh(s);
ok(s.places.across_main.mine, 'החברה ממול נתפסה דרך המצלמה של העירייה');
for (let i = 0; i < 8 && !s.places.block_a.mine; i++) {
  run(s, 'block_a', 'take'); refresh(s);
  if (!s.places.block_a.mine) { endDay(s); refresh(s); }
}
ok(s.places.block_a.mine, 'הרובע נתפס דרך העדכון');
ok(s.over === 'won', 'והמשחק נגמר כמו שצריך');

console.log(bad ? `\n✗ ${bad} דברים לא עובדים.` : '\n✓ כל חמשת השלבים עוברים.');
process.exit(bad ? 1 : 0);
