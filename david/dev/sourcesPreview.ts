// Visual check of the verified quotations inside the real game UI (src/ui/UI.ts + style.css).
// Open dev/sources.html?scene=...  (scenes: verse, intro, toast, caption, end, loading)
//   ?id=<catalog id>   verse / toast source          ?cue=<n>   INTRO_CUES index (scene=intro)
//   ?touch=1           phone UI                       ?bg=<url>  backdrop image
// Sets window.__ready = true once fonts are loaded and the CSS transitions have finished.

import { UI } from '../src/ui/UI';
import { SOURCES, quoteText, sourceRef, verseArgs, quoteWithRefHtml, type SourceId } from '../src/content/sources';
import { INTRO_CUES } from '../src/content/introScript';

declare global {
  interface Window { __ready?: boolean }
}

const q = new URLSearchParams(location.search);
const scene = q.get('scene') ?? 'verse';
const touch = q.get('touch') === '1';
const bg = q.get('bg');
if (bg) (document.getElementById('bg') as HTMLDivElement).style.backgroundImage = `url(${bg})`;

const isId = (s: string | null): s is SourceId => !!s && s in SOURCES;
const app = document.getElementById('app') as HTMLDivElement;
const ui = new UI(app, touch);
ui.fade(0, 0);
ui.hud(false);

const loading = app.querySelector('.loading') as HTMLDivElement | null;
if (scene !== 'loading') loading?.remove();

switch (scene) {
  case 'verse': {
    const id = q.get('id');
    ui.letterbox(true);
    ui.verse(...verseArgs(isId(id) ? id : 's1_16_12_ruddy'), 600);
    break;
  }
  case 'intro': {
    const cue = INTRO_CUES[Math.min(INTRO_CUES.length - 1, Number(q.get('cue') ?? 0))];
    ui.letterbox(true);
    if (cue.caption) {
      const sub = cue.caption.sub;
      ui.caption(cue.caption.title, typeof sub === 'object' ? quoteWithRefHtml(sub.quote) : sub ?? '', 600);
    }
    if (cue.verse) ui.verse(...verseArgs(cue.verse), 600);
    break;
  }
  case 'caption': {
    ui.letterbox(true);
    ui.caption('מַצֶּבֶת קְבֻרַת רָחֵל', quoteWithRefHtml('gen_35_19_rachel_buried'), 600);
    break;
  }
  case 'toast': {
    const id = q.get('id');
    const sid: SourceId = isId(id) ? id : 'shr_2_2_flock';
    ui.hud(true);
    ui.toast('מִדְרָשׁ', `${quoteText(sid)}<small>${sourceRef(sid)}</small>`, 600);
    break;
  }
  case 'end': {
    ui.endCard(true);
    const verse = app.querySelector('.e-verse') as HTMLDivElement;
    const next = app.querySelector('.e-next-verse') as HTMLDivElement;
    verse.innerHTML = `"${quoteText('s1_17_36_37_endcard')}"<span>${sourceRef('s1_17_36_37_endcard')}</span>`;
    next.innerHTML = `"${quoteText('s1_16_1_fill_horn')}"<span>${sourceRef('s1_16_1_fill_horn')}</span>`;
    break;
  }
  case 'loading': {
    const quote = loading?.querySelector('.ld-quote') as HTMLDivElement | null;
    if (quote) quote.innerHTML = `"${quoteText('ps_23_1_2_loading')}"<span>${sourceRef('ps_23_1_2_loading')}</span>`;
    ui.setLoading(0.6, 'מכין את הצאן…');
    break;
  }
}

void document.fonts.ready.then(() => setTimeout(() => (window.__ready = true), 2200));
