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
const SLASH = /[\u0590-\u05FF]\/[\u0590-\u05FF]{1,3}\b/;
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
console.log('✓ אין אף מילה טכנית בטקסט שהשחקן רואה, ואף פועל לא כתוב עם לוכסן.');
