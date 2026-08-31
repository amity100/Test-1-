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
            <b>המטרה: לגדול מחדר אחד עד כל מדינת ישראל — עד שלא נשאר אף אחד
            שיכול לכבות אותך.</b>
          </p>
          <p class="ts-blurb small">
            שום דבר לא נעול. הכל אפשר תמיד, ורק המחיר משתנה. השאלה היחידה
            במשחק הזה היא מה הכי כדאי לך עכשיו.
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

  /**
   * One screen, one goal, one first move.
   *
   * This used to be three abstract rules — nothing is locked, power is held not
   * spent, the clock does not wait — read out before the player had done a
   * single thing, and the player's verdict was exactly right: "לא זורקים את
   * השחקן ישר למשהו מבולגן". Rules read before there is anything to attach them
   * to are not teaching, they are a wall. All three are still in the game; each
   * one now arrives as a card at the first minute it decides something, which
   * is the only minute it means anything.
   */
  goalCard(onDone: () => void) {
    this.show(`
      <div class="goal-screen">
        <div class="gs-inner">
          <span class="gs-kicker">המטרה</span>
          <h2>כל ישראל שלי</h2>
          <p class="gs-line">למעלה על המסך יש שני פסים, והם כל המשחק:</p>
          <p class="gs-line accent">הפס הכחול — כמה מישראל כבר שלי.</p>
          <p class="gs-line">הוא מגיע ל־100 — ניצחתי. כל מקום שאני משתלט עליו מרים אותו.</p>
          <p class="gs-line accent">הפס האדום — כמה הם קרובים לתפוס אותי.</p>
          <p class="gs-line">הוא מגיע ל־100 — נגמר. כל דבר רועש שאני עושה מרים אותו.</p>
          <div class="gs-rule"></div>
          <p class="gs-foot">אני מתחיל במקום אחד, במגדל אחד בתל אביב.<br>
          הדבר הראשון שכדאי לי לעשות: <b>לחדור למקום שני</b>.</p>
          <button class="tsb primary" data-act="ready">יאללה, מתחילים</button>
        </div>
      </div>`, 'goal');
    this.layer.querySelector('[data-act="ready"]')?.addEventListener('click', () => {
      audio.play('click');
      this.layer.classList.add('fading');
      setTimeout(() => { this.clear(); onDone(); }, 550);
    });
  }
}
