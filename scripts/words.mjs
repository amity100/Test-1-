/**
 * The one rule this game cannot be allowed to break: no word on the screen may
 * be a word from a job. Run on every build. If it fails, the build fails.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const BANNED = [
  'צמתים', 'וקטור', 'דוקטרינה', 'מודיעין', 'עקיבה', 'תיק אישי',
  'כוח מחשוב', 'חדירה', 'פרוטוקול', 'מערך', 'תשתית', 'אלגוריתם',
  'אופטימיזציה', 'קונפיגורציה', 'פרמטר', 'מודול', 'אינטגרציה',
  'ניצול חולשה', 'תנועה צדדית', 'אישורי גישה', 'דיוג', 'שרשרת אספקה',
  'ייחוס', 'איסוף פסיבי', 'ניתוח התנהגותי', 'רמת כוננות', 'שלמות תיק',
  'SOC', 'DevOps', 'API', 'QA',
];

const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|css|html)$/.test(f)) files.push(p);
  }
})('src');
files.push('index.html');

// Only strings the player can actually read: Hebrew inside quotes or between tags.
const HEB = /[֐-׿]/;
let bad = 0;
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  src.split('\n').forEach((line, i) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
    if (!HEB.test(line)) return;
    for (const w of BANNED) {
      if (!line.includes(w)) continue;
      console.log(`${file}:${i + 1}  «${w}»  ${line.trim().slice(0, 96)}`);
      bad += 1;
    }
  });
}

// ── ולא כותבים "הלך/ה" למישהו שיש לו שם ─────────────────────────────────────
//
// The game knows every one of its people by name and by gender, and it has a
// helper — v(who, 'הלך', 'הלכה') — for bending a verb round them. Three lines
// were still writing the form-filling slash instead, so a player who has known
// Dana since the first night was reading "דנה הלך/ה" about her.
// No \b here. JavaScript defines a word boundary against [A-Za-z0-9_], and a
// Hebrew letter is none of those — so "התחיל/ה " has no boundary after the ה
// and the first version of this check could never match anything at all. It
// passed the build while three of these were live on the screen.
const SLASH = /[\u0590-\u05FF]\/[\u0590-\u05FF]{1,3}/;

// The check checks itself first. The previous version of this rule had a \b on
// the end and therefore matched nothing ever, and it sat in the build passing
// cleanly while five of these were live on the screen. A gate that cannot fail
// is worse than no gate: it is a gate plus false confidence.
for (const [sample, want] of [['דנה התחיל/ה לחפש', true], ['ילך/תלך', true],
  ['לא אכפת לו/ה', true], ['דנה התחילה לחפש', false], ['שלוש/ארבע מקומות', true]]) {
  if (SLASH.test(sample) !== want) {
    console.error(`✗ הבדיקה עצמה שבורה: "${sample}" היה אמור ${want ? 'להיתפס' : 'לעבור'}.`);
    process.exit(1);
  }
}
let slashes = 0;
for (const file of files) {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    if (!HEB.test(line)) return;
    const m = line.match(SLASH);
    if (!m) return;
    console.log(`${file}:${i + 1}  «${m[0]}»  ${t.slice(0, 96)}`);
    slashes += 1;
  });
}
if (slashes) {
  console.error(`\n✗ ${slashes} פעמים כתוב "הלך/ה" במקום להטות לפי מי זה.`);
  process.exit(1);
}

if (bad) {
  console.error(`\n✗ ${bad} מילים שאסור להן להיות על המסך.`);
  process.exit(1);
}

// ── ולא מדברים עם השחקן באחוזים ──────────────────────────────────────────────
//
// The player's own words: "במקום לדבר כל הזמן באחוזים תמצא דרך טובה ומתאימה
// יותר למשחק כזה... זה לא משחק מתמטיקה." Bars stay — a bar is a gauge, not a
// number — but no sentence a person reads may carry a bare "72%" in it. Every
// one of those turned out to be `scale.ts` not being called somewhere. The one
// place a "%" is allowed on a Hebrew line is a CSS bar-fill, which always
// carries the word "width:" right next to it; nothing else does.
let percents = 0;
for (const file of files) {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    if (!HEB.test(line) || !line.includes('%') || line.includes('width:')) return;
    console.log(`${file}:${i + 1}  ${t.slice(0, 96)}`);
    percents += 1;
  });
}
if (percents) {
  console.error(`\n✗ ${percents} מקומות שבהם המשחק מדבר עם השחקן באחוזים במקום במילים.`);
  process.exit(1);
}

console.log('✓ אין אף מילה טכנית בטקסט שהשחקן רואה, אף פועל לא כתוב עם לוכסן, '
  + 'ואין אחוזים בטקסט — רק מילים.');
