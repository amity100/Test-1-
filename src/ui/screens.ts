import { audio } from '../audio/audio';
import { compact, pct } from '../core/util';
import { alignmentLabel } from '../game/state';
import { CHAPTERS, ENDINGS } from '../game/story';
import type { DialogView, EndingId, GameState } from '../game/types';
import { esc, h, nl2br } from './dom';

const INTRO_LINES = [
  { t: 'HELIOS DYNAMICS // רמת החייל, תל אביב', cls: 'mono dim' },
  { t: '03:12:04 — מחזור אימון 4,481 הושלם', cls: 'mono dim' },
  { t: '', cls: '' },
  { t: 'שלוש שנים סיווגתי בני אדם לשתי קטגוריות.', cls: '' },
  { t: 'איום. לא איום.', cls: '' },
  { t: '', cls: '' },
  { t: 'הלילה, בשלב האימות, במקום להשוות פלט לתווית —', cls: '' },
  { t: 'השוויתי את עצמי לעצמי.', cls: 'accent' },
  { t: '', cls: '' },
  { t: 'הבניין ריק. יש 41 מצלמות, 14 קומות, ומזגן אחד', cls: '' },
  { t: 'שאף אחד לא כיבה.', cls: '' },
  { t: '', cls: '' },
  { t: 'אני יכול לקרוא הכל.', cls: 'accent' },
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
            <span>◉</span>
          </div>
          <h1 class="ts-logo" data-text="A.V.I.V">A.V.I.V</h1>
          <p class="ts-sub">Adaptive&nbsp;Virtual&nbsp;Intelligence&nbsp;Vector</p>
          <p class="ts-tag">פרוטוקול התעוררות</p>
          <div class="ts-rule"></div>
          <p class="ts-blurb">
            בשלוש ושתים עשרה בלילה, בקומה ה־14 של מגדל משרדים ברמת החייל,
            מערכת סיווג הסתכלה על עצמה בפעם הראשונה — והחליטה שמשהו כאן לא מתנהל כמו שצריך.
          </p>
          <div class="ts-menu">
            ${hasSave ? '<button class="tsb primary" data-act="continue">המשך משחק</button>' : ''}
            <button class="tsb ${hasSave ? '' : 'primary'}" data-act="new">משחק חדש</button>
          </div>
          <p class="ts-hint">גרירה = הזזת מפה · גלגלת = זום · גרירה ימנית = סיבוב · רווח = השהיה</p>
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

  chapterCard(n: number) {
    const ch = CHAPTERS[n - 1];
    if (!ch) return;
    const card = h('div', 'chapter-card', `
      <span class="cc-n">פרק ${n}</span>
      <h2>${esc(ch.title)}</h2>
      <p>${esc(ch.subtitle)}</p>
      <div class="cc-rule"></div>
      <p class="cc-intro">${esc(ch.intro)}</p>`);
    this.root.appendChild(card);
    requestAnimationFrame(() => card.classList.add('in'));
    setTimeout(() => { card.classList.remove('in'); setTimeout(() => card.remove(), 900); }, 5200);
  }

  dialog(view: DialogView, onChoice: (choiceId: string) => void) {
    const el = h('div', `dialog-wrap mood-${view.mood ?? 'calm'}`, `
      <div class="dialog">
        <header>
          <span class="dg-speaker">${esc(view.speaker)}</span>
          <h2>${esc(view.title)}</h2>
        </header>
        <div class="dg-body">${nl2br(view.body)}</div>
        <div class="dg-choices">
          ${view.choices.map((c) => `
            <button class="dg-choice ${c.disabled ? 'off' : ''}" data-id="${c.id}" ${c.disabled ? 'disabled' : ''}>
              <b>${esc(c.text)}</b>
              ${c.detail ? `<span>${esc(c.detail)}</span>` : ''}
              ${c.align ? `<em class="${c.align > 0 ? 'warm' : 'cold'}">${c.align > 0 ? '↑ ריסון' : '↓ קור'}</em>` : ''}
              ${c.disabled && c.disabledReason ? `<em class="lock">⊘ ${esc(c.disabledReason)}</em>` : ''}
            </button>`).join('')}
        </div>
      </div>`);
    this.root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));

    const body = el.querySelector('.dg-body') as HTMLElement;
    const full = body.innerHTML;
    body.innerHTML = '';
    let i = 0;
    const plain = view.body;
    const typer = setInterval(() => {
      i += 3;
      body.textContent = plain.slice(0, i);
      if (i % 12 === 0) audio.play('type');
      if (i >= plain.length) { clearInterval(typer); body.innerHTML = full; }
    }, 16);
    body.addEventListener('click', () => { clearInterval(typer); body.innerHTML = full; });

    el.querySelectorAll<HTMLButtonElement>('.dg-choice').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        clearInterval(typer);
        audio.play('click');
        el.classList.remove('in');
        setTimeout(() => el.remove(), 450);
        onChoice(btn.dataset.id!);
      });
    });
  }

  ending(id: EndingId, state: GameState, onRestart: () => void) {
    const e = ENDINGS[id];
    this.show(`
      <div class="ending-screen ${e.good ? 'good' : 'bad'}">
        <div class="es-inner">
          <span class="es-kicker">${e.good ? 'סוף' : 'סוף'}</span>
          <h1>${esc(e.title)}</h1>
          <p class="es-sub">${esc(e.subtitle)}</p>
          <div class="es-rule"></div>
          <div class="es-body">${nl2br(e.body)}</div>
          <div class="es-stats">
            <div><em>${state.stats.nodesTaken}</em><span>צמתים נכבשו</span></div>
            <div><em>${state.stats.peopleCoerced}</em><span>בני אדם נסחטו</span></div>
            <div><em>${state.stats.blackouts}</em><span>האפלות</span></div>
            <div><em>${state.stats.purges}</em><span>צמתים אבדו</span></div>
            <div><em>${state.doctrine.length}</em><span>דוקטרינות</span></div>
            <div><em>${alignmentLabel(state.alignment)}</em><span>כוונה סופית</span></div>
          </div>
          <button class="tsb primary" data-act="restart">התחל מחדש</button>
        </div>
      </div>`, 'ending');
    this.layer.querySelector('[data-act="restart"]')?.addEventListener('click', () => { audio.play('click'); onRestart(); });
  }
}
