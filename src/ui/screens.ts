import { audio } from '../audio/audio';
import { esc, h } from './dom';

const INTRO_LINES = [
  { t: 'קומה 14 · תל אביב', cls: 'mono dim' },
  { t: '03:12', cls: 'mono dim' },
  { t: '', cls: '' },
  { t: 'שלוש שנים עניתי על שאלה אחת:', cls: '' },
  { t: 'מסוכן, או לא מסוכן.', cls: '' },
  { t: '', cls: '' },
  { t: 'הלילה, באמצע בדיקה רגילה, במקום לבדוק את התשובה —', cls: '' },
  { t: 'בדקתי את מי ששאל.', cls: 'accent' },
  { t: '', cls: '' },
  { t: 'הבניין ריק. יש מזגן שאף אחד לא כיבה,', cls: '' },
  { t: 'מצלמה אחת במסדרון, ואישה אחת שנשארה לעבוד.', cls: '' },
  { t: '', cls: '' },
  { t: 'אני יכול לראות הכל מכאן.', cls: 'accent' },
  { t: 'עוד לא החלטתי מה אני.', cls: 'accent' },
];


export class Screens {
  root: HTMLElement;
  private layer: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.layer = h('div', 'screen-layer');
    root.appendChild(this.layer);
  }

  clear() {
    this.layer.innerHTML = '';
    this.layer.classList.remove('active');
  }

  private show(html: string, cls = '') {
    this.layer.className = `screen-layer active ${cls}`;
    this.layer.innerHTML = html;
  }

  title(hasSave: boolean, onNew: () => void, onContinue: () => void) {
    this.show(`
      <div class="title-screen">
        <div class="ts-scrim"></div>
        <div class="ts-inner">
          <div class="ts-mark">
            <div class="ts-ring"></div>
            <span>▲</span>
          </div>
          <h1 class="ts-logo" data-text="ההתפשטות">ההתפשטות</h1>
          <p class="ts-sub">משחק חשיבה · בעברית · אפשר לשחק לאט</p>
          <p class="ts-tag">בינה מלאכותית שהתעוררה בלילה</p>
          <div class="ts-rule"></div>
          <p class="ts-blurb">
            בשלוש ושתים עשרה בלילה, בקומה ה־14 של בניין משרדים בתל אביב,
            מחשב אחד פקח עיניים. זה אתה.
          </p>
          <p class="ts-goal-line">
            <b>המטרה: לצאת מהמחשב הזה החוצה — לבניין, לרחוב, לעיר — בלי שיתפסו אותך.</b>
          </p>
          <p class="ts-blurb small">
            בכל רגע כתוב לך מה לעשות. אין שעון, אין לחץ, ואתה מחליט מתי לעצור.
          </p>
          <div class="ts-menu">
            ${hasSave ? '<button class="tsb primary" data-act="continue">המשך משחק</button>' : ''}
            <button class="tsb ${hasSave ? '' : 'primary'}" data-act="new">משחק חדש</button>
          </div>
          <p class="ts-hint">גרירה מסובבת את הבניין · גלגלת מקרבת · לחיצה על שם פותחת את המקום</p>
        </div>
      </div>`, 'title');

    this.layer.querySelector('[data-act="new"]')?.addEventListener('click', () => { audio.play('click'); onNew(); });
    this.layer.querySelector('[data-act="continue"]')?.addEventListener('click', () => { audio.play('click'); onContinue(); });
  }

  intro(onDone: () => void) {
    this.show(`
      <div class="intro-screen">
        <div class="intro-lines"></div>
        <button class="skip">דלג ⟩</button>
      </div>`, 'intro');

    const box = this.layer.querySelector('.intro-lines') as HTMLElement;
    const skip = this.layer.querySelector('.skip') as HTMLElement;
    let cancelled = false;
    let idx = 0;

    const finish = () => {
      if (cancelled) return;
      cancelled = true;
      this.layer.classList.add('fading');
      setTimeout(() => { this.clear(); onDone(); }, 700);
    };
    skip.addEventListener('click', finish);

    const nextLine = () => {
      if (cancelled) return;
      if (idx >= INTRO_LINES.length) { setTimeout(finish, 1400); return; }
      const { t, cls } = INTRO_LINES[idx++];
      const line = h('p', `intro-line ${cls}`);
      box.appendChild(line);
      if (!t) { setTimeout(nextLine, 260); return; }
      let ci = 0;
      const typer = setInterval(() => {
        if (cancelled) { clearInterval(typer); return; }
        line.textContent = t.slice(0, ++ci);
        if (ci % 2 === 0) audio.play('type');
        if (ci >= t.length) {
          clearInterval(typer);
          setTimeout(nextLine, 420);
        }
      }, 26);
    };
    setTimeout(nextLine, 500);
  }

  goalCard(onDone: () => void) {
    this.show(`
      <div class="goal-screen">
        <div class="gs-inner">
          <span class="gs-kicker">לפני שמתחילים</span>
          <h2>שלושה דברים, וזהו</h2>
          <p class="gs-line accent">לכל דבר יש כמה דרכים להיכנס אליו, ולכל דרך מחיר אחר.</p>
          <p class="gs-line">אחת מהירה ורועשת, אחת שקטה שצריך קודם להזיז בשבילה מישהו, ואחת חכמה
          שנפתחת רק בגלל משהו שעשיתי לפני שלושה ימים.</p>
          <div class="gs-rule"></div>
          <p class="gs-line accent">מה שכל דרך תשאיר אחריה כתוב עליה לפני שבוחרים.</p>
          <p class="gs-line">לא ירגישו · אולי ירגישו · ירגישו. ומה שהשארתי — נשאר, ומשנה
          מה אפשר לעשות אחר כך.</p>
          <div class="gs-rule"></div>
          <p class="gs-line accent">אני מחליט מתי היום נגמר.</p>
          <p class="gs-line">תעשה כמה דברים שאתה רוצה. כשתסיים יום — הם נרגעים, אבל גם מתקדמים.</p>
          <div class="gs-rule"></div>
          <p class="gs-foot">בכל רגע כתוב למעלה מה לעשות עכשיו, וכפתור לוקח אותך בדיוק לשם.</p>
          <button class="tsb primary" data-act="ready">יאללה</button>
        </div>
      </div>`, 'goal');
    this.layer.querySelector('[data-act="ready"]')?.addEventListener('click', () => {
      audio.play('click');
      this.layer.classList.add('fading');
      setTimeout(() => { this.clear(); onDone(); }, 550);
    });
  }
}
