import * as THREE from 'three';
import { INKS, KINDS, WEAPON_ORDER, readFree, buildWeapon, statLine, keyKind } from '../game/freeform.js';
import { CATEGORY_ORDER, CATEGORY_NAME, CATEGORY_OF } from '../game/sketchnet.js';
import { spawnDrawn, jetFlames } from '../game/drawncar.js';
import { setMode } from '../game/hybrid.js';
import { makeFrame, findSpot, localBox } from '../game/materialize.js';
import { canopyModel } from '../game/parachute.js';
import { waterSpot } from '../game/rides.js';
import { angleDiff, clamp } from '../core/util.js';
import { groundHeight } from '../world/layout.js';
import { cleanStroke, joinStroke, morphPair } from '../game/inkclean.js';
import { readParts, rideEvidence, PART, RIDES_IT } from '../game/parts.js';
import { menuOf } from '../game/partrole.js';
import { look } from '../game/sketchnet.js';
import { rideDesign, rideSpec, toPage } from '../game/partsum.js';
import { engineer, ENG_LEVELS, EN_STEPS, TIDY_STEPS } from '../game/engineer.js';
import { readHandParts, handSpec } from '../game/handparts.js';
import { PartView } from './partview.js';
import { comboReward, comboName } from '../game/combos.js';
import { fmt } from '../game/money.js';

// (ROADMAP 11.6, 11.7) Drawing freehand in the air, on the run. Q (the pencil on a phone, up on a
// pad) and whatever is drawn goes straight on the screen, over the street - no page in the way.
// The game goes on all the while: WASD (the stick, under the left thumb) keep running, Shift still
// sprints, and the camera turns after where you run (the mouse is drawing). As it is drawn it is
// read (game/freeform.js, with game/sketchnet.js): a small tag by the drawing says what it is
// becoming and what it can do, and offers what else it could be. Q again (✓, a right click,
// Enter) and the drawing becomes the thing where it was drawn - a weapon hangs in the air beside
// you as it turns real, then flies into your hand; a vehicle stands in the street ahead.
// Esc (✕) puts the pen away, the drawing kept for later; Z (↶) takes the last line back. The
// inks: colour as you like (the mouse wheel; pencil is no colour - the thing gets one of its own;
// neon glows, and a gun drawn in it is a laser).

const $ = (id) => document.getElementById(id);
// (ROADMAP 11.8) what a pick is of: its category (a vehicle's by its kind)
const keyCat = (k) => (!k ? null : k.startsWith('v:') ? CATEGORY_OF(k.split(':')[1]) : k.startsWith('g:') ? 'gear' : k === 'vehicle' ? 'car' : 'weapon');
// several picks, one of each kind (a vehicle, gear, a weapon): '|' between them
const picksOf = (force) => (force ? force.split('|').filter(Boolean) : []);
const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();

// (ROADMAP 11.9) what was decided, as picks: read again from the steadied lines with these, it is
// the same thing (its weapon, its vehicle, its gear - and the gear with a weapon)
function forceOf(R) {
  if (!R || !R.cat) return null;
  const out = [];
  if (R.cat === 'weapon') {
    out.push(R.kind === 'shield' ? 'g:shield' : R.kind);
    const gear = R.extra ? R.extra.kind : R.knack;
    if (gear && R.kind !== 'shield') out.push(`g:${gear}`);
  } else if (R.choice) out.push(R.choice);
  return out.length ? out.join('|') : null;
}
// how long a line takes to turn into its steadied self (s)
const MORPH_T = 0.24;
// (ROADMAP 11.10) how long a changed number keeps its arrow (s)
const DELTA_T = 2.6;
// (ROADMAP 11.12) how long the drawing takes to turn into what the engineer made of it (s)
const ENG_T = 0.9;
// (ROADMAP 11.15) how long a press on a part's name opens its whole menu (s) - a tap is the next it
// could be
const LONG_PRESS = 0.45;
// (ROADMAP 11.15) the two looks of what is made: as drawn, or each part the game's own
const LOOKS = [
  ['faithful', 'כמו שציירתי'],
  ['polished', 'מלוטש'],
];
// (what the game adds when nothing drawn would do it - why, said by its toggle on the card)
const IMP_WHY = { rotor: 'רוטור — כדי שיטוס', wing: 'כנף — כדי שיטוס', prop: 'מדחף — כדי שיזוז באוויר', jet: 'מנוע — כדי שימריא', wheel: 'גלגלים בקשתות שצוירו', fin: 'זנב — לייצוב' };
// (ROADMAP 11.11) the gear whose model the card shows
const GEAR_VIEW = new Set(['parachute', 'umbrella', 'key', 'ladder', 'ramp', 'bridge', 'spring']);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// (ROADMAP 11.12) a line as n points along it, evenly
function resample(P, n) {
  if (P.length < 2) return new Array(n).fill(P[0] || [0, 0]);
  const L = [0];
  for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const T = L[L.length - 1] || 1;
  const out = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const d = (k / (n - 1)) * T;
    while (j < P.length - 2 && L[j + 1] < d) j++;
    const u = (d - L[j]) / Math.max(1e-9, L[j + 1] - L[j]);
    out.push([P[j][0] + (P[j + 1][0] - P[j][0]) * u, P[j][1] + (P[j + 1][1] - P[j][1]) * u]);
  }
  return out;
}

// what it can be made into instead (the tag's menu), by what the player says they draw (ROADMAP
// 11.8): the weapons, the vehicles by kind, on the water, in the air, the gear
const CHOICES = {
  weapon: WEAPON_ORDER.map((k) => [k, KINDS[k].name]),
  car: [['v:car', 'מכונית'], ['v:truck', 'משאית'], ['v:bus', 'אוטובוס'], ['v:moto', 'אופנוע'], ['v:bicycle', 'אופניים'], ['v:tank', 'טנק'], ['v:skate', 'סקייטבורד']],
  air: [['v:plane', 'מטוס'], ['v:copter', 'מסוק'], ['v:balloon', 'כדור פורח']],
  sea: [['v:boat:sailboat', 'סירת מפרש'], ['v:boat:speedboat', 'סירת מנוע'], ['v:boat:canoe', 'קאנו'], ['v:boat:submarine', 'צוללת'], ['v:boat:cruise ship', 'ספינה']],
  gear: [['g:shield', 'מגן'], ['g:parachute', 'מצנח'], ['g:umbrella', 'מטרייה'], ['g:ladder', 'סולם'], ['g:ramp', 'רמפה'], ['g:bridge', 'גשר'], ['g:key', 'מפתח'], ['g:spring', 'קפיץ']],
};

export class FreeDraw {
  constructor(game) {
    this.game = game;
    this.el = $('freedraw');
    this.isOpen = false;
    this.strokes = [];
    this.cur = null;
    this.ink = 0;
    this.force = null;
    // (ROADMAP 11.8) what the player says they draw: none - anything; one; or several together
    this.cats = new Set();
    this.catCursor = 0;
    this.R = null;
    this.presenting = null;
    this.shutAt = -1e9;
    this.U = 300;
    this.stats = { opened: 0, made: {}, failed: 0 };
    // (ROADMAP 11.10, the sample: a ride made of parts) what the player said a line is, which way it
    // faces (null: as its parts say), the parts read, the ride they add up to, its preview
    this.over = {};
    this.face = null;
    this.P = null;
    this.PR = null;
    // (ROADMAP 11.11, parts 2: a weapon made of parts - its parts read, what they add up to; gear,
    // a shield: the model it will be)
    this.PW = null;
    this.PG = null;
    this.bars0 = null;
    this.deltas = {};
    this.view = null;
    this.chips = [];
    this.pmenuAt = -1;
    // (ROADMAP 11.12) how much the engineer does to it (game/engineer.js): 'raw', 'tidy', 'eng'; the
    // drawing turning into its work. (ROADMAP 11.15) the hand's slips put right ('tidy') - and what
    // it would make better offered, each taken or not by the player (engOn: its steps taken); the
    // look of it: as drawn, or polished; the parts the game would add, taken away (noImp)
    this.engLevel = 'tidy';
    this.engOn = new Set();
    // (ROADMAP 11.20, the lab: polished first - your layout, built as the game's own parts; as drawn
    // is a choice)
    this.look = game.lab ? 'polished' : 'faithful';
    this.noImp = new Set();
    // (ROADMAP 11.15) the parts that work together that the player has made: each found once, a
    // reward (game/combos.js)
    this.found = new Set();
    this.engMorph = null;
    this.engSig = '';
    this.build();
    this.bind();
  }

  get open() {
    return this.isOpen;
  }

  // the drawing's own unit (px): half the screen's shorter side, as big as the page it once had
  unit() {
    return Math.max(150, Math.min(window.innerWidth, window.innerHeight) * 0.5);
  }

  build() {
    const sw = INKS.map((c, i) => `<button class="fd-sw${c.neon ? ' neon' : ''}${c.pencil ? ' pencil' : ''}" data-i="${i}" style="--c:${c.css}" title="${c.name}" aria-label="${c.name}"></button>`).join('');
    const cats = [['', 'כל דבר'], ...CATEGORY_ORDER.map((c) => [c, CATEGORY_NAME[c]])].map(([c, n], i) => `<button class="fd-cat" data-c="${c}"${i ? ` title="${i}"` : ' title="0"'}>${n}</button>`).join('');
    this.el.innerHTML = `<canvas id="fd-air"></canvas>
      <div class="fd-cats" id="fd-cats"><span class="fd-cats-t">מה מציירים?</span>${cats}</div>
      <div class="fd-zone" id="fd-zone-a"></div><div class="fd-zone" id="fd-zone-b"></div>
      <div class="fd-hint" id="fd-hint"></div>
      <div class="fd-signs hidden" id="fd-signs"><b>סימנים מהירים</b>
        <div><svg viewBox="0 0 24 24"><path d="M12 20 C4 14 2.5 8.5 6.2 6 C9 4.2 11.3 6 12 8.2 C12.7 6 15 4.2 17.8 6 C21.5 8.5 20 14 12 20 Z"/></svg>לב — ריפוי</div>
        <div><svg viewBox="0 0 24 24"><path d="M3 15 L4 11 L8 10 L10 7 L16 7 L18 10 L21 11 L21 15 Z M7 15.5 a1.8 1.8 0 1 0 0.01 0 M17 15.5 a1.8 1.8 0 1 0 0.01 0"/><path class="red" d="M7 4 L17 20 M17 4 L7 20"/></svg>איקס על מכונית — עוצרת</div>
        <div><svg viewBox="0 0 24 24"><path d="M12 5 a1.6 1.6 0 1 0 0.01 0 M12 8 L12 14 M9 10.5 L15 10.5 M12 14 L10 19 M12 14 L14 19"/><ellipse class="red" cx="12" cy="12" rx="7.5" ry="9.5"/></svg>לולאה סביב אויבים — קשורים</div>
        <div><svg viewBox="0 0 24 24"><path class="red" d="M6 15 C3 9 10 4 14 7 C18 10 11 18 7 14 C4 10 13 4 17 9 C21 14 13 21 9 17 C6 13 15 7 19 12 C21 16 15 20 12 18"/></svg>קשקוש — ענן דיו</div>
        <div><svg viewBox="0 0 24 24"><path d="M14 4 L21 4 L21 21 M14 4 L14 21"/><path d="M5 17 a1.4 1.4 0 1 0 0.01 0 M5 19 L5 22"/><path class="red" d="M6 18 L15 5"/></svg>קו מכם לגג — חבל</div>
      </div>
      <div class="fd-fuse hidden" id="fd-fuse"><b>הרכבה — חלק בקו אחד, על משהו</b>
        <div><svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7"/></svg>גלגל — עיגול, נמוך</div>
        <div><svg viewBox="0 0 24 24"><path d="M3 13 L21 9 L21 13 Z"/></svg>כנף — צורה צרה לצד</div>
        <div><svg viewBox="0 0 24 24"><path d="M3 6 L21 6 M12 6 L12 11"/><rect x="7" y="11" width="10" height="7" rx="2"/></svg>רוטור — קו ישר מעל</div>
        <div><svg viewBox="0 0 24 24"><path d="M4 12 L8 8 L11 15 L14 7 L17 15 L21 10"/></svg>סילון — זיגזג מאחור</div>
        <div><svg viewBox="0 0 24 24"><path d="M6 20 C2 18 7 15 12 16 C17 17 20 14 16 12 C12 10 7 12 6 10 C5 7 11 6 15 7 C19 8 19 4 15 3"/></svg>קפיץ — סליל לולאות מתחת</div>
        <div><svg viewBox="0 0 24 24"><rect x="3" y="13" width="9" height="6" rx="1.5"/><path d="M10 14 L21 9"/></svg>קנה — קו שיוצא ממנו</div>
        <div><svg viewBox="0 0 24 24"><path d="M4 18 C8 6 16 6 20 18"/></svg>להב — קשת</div>
        <div><svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="11" rx="2"/><path d="M6 15 L8 10 L10 15 L12 10 L14 15 L16 10 L18 15"/></svg>שריון — קווקוו עליו</div>
        <div><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="5"/><path d="M12 13 L12 21"/></svg>בלון — עיגול מעליו</div>
        <div><svg viewBox="0 0 24 24"><path d="M7 4 L7 13 C7 20 17 20 17 13 L17 4"/></svg>מגנט — U</div>
        <div><svg viewBox="0 0 24 24"><path d="M12 3 L14.6 9.2 L21 9.6 L16 13.8 L17.6 20.4 L12 16.8 L6.4 20.4 L8 13.8 L3 9.6 L9.4 9.2 Z"/></svg>כוכב — מעליה: בלתי פגיעה</div>
        <div><svg viewBox="0 0 24 24"><path d="M15 2 L8 12 L15 11 L9 22"/></svg>ברק — Z יוצא ממנה</div>
        <div><svg viewBox="0 0 24 24"><path d="M12 12 C12 10 14 10 14 12 C14 15 10 15 10 12 C10 8 16 8 16 12 C16 17 8 17 8 12 C8 6 19 6 19 12"/></svg>עשן — ספירלה מאחור</div>
        <div><svg viewBox="0 0 24 24"><path d="M3 11 C3 2 21 2 21 11 M3 11 L10 17 M21 11 L14 17"/><rect x="9" y="17" width="6" height="4" rx="1"/></svg>מצנח — קשת ∩ מעליה</div>
        <div><svg viewBox="0 0 24 24"><rect x="6" y="5" width="12" height="7" rx="2"/><rect x="2" y="15" width="20" height="4" rx="2"/></svg>מצופים — ארוך מתחת</div>
        <em>ציור בתוך המכונית — נשאר עליה כמו שציירתם · יוצא ממנה — חלק</em>
      </div>
      <div class="fd-parts" id="fd-parts"></div>
      <div class="fd-pmenu hidden" id="fd-pmenu"></div>
      <div class="fd-card hidden" id="fd-card">
        <div class="fd-card-top"><b id="fd-cname"></b><button class="fd-face" id="fd-face" title="הכיוון שלו" aria-label="הכיוון שלו">⇄</button></div>
        <canvas id="fd-view"></canvas>
        <div class="fd-look hidden" id="fd-look"></div>
        <div class="fd-eng hidden" id="fd-eng"></div>
        <div class="fd-abil" id="fd-abil"></div>
        <div class="fd-bars" id="fd-bars"></div>
        <div class="fd-lines hidden" id="fd-lines"></div>
        <div class="fd-engn hidden" id="fd-engn"></div>
        <div class="fd-warn" id="fd-warn"></div>
        <div class="fd-meta" id="fd-meta"></div>
        <div class="fd-alts fd-calts hidden" id="fd-calts"></div>
      </div>
      <div class="fd-tag hidden" id="fd-tag">
        <button class="fd-kind" id="fd-kind" title="משהו אחר"><b id="fd-name"></b><span id="fd-stats"></span><em id="fd-note"></em></button>
        <div class="fd-alts" id="fd-alts"></div>
        <div class="fd-menu hidden" id="fd-menu"></div>
      </div>
      <div class="fd-tools" id="fd-tools">
        <div class="fd-inks" id="fd-inks">${sw}</div>
        <button class="fd-btn fd-color" id="fd-color" aria-label="צבע"><i></i></button>
        <div class="fd-ink" aria-label="דיו"><i id="fd-ink-fill"></i><i id="fd-ink-cost"></i></div>
        <button class="fd-btn" id="fd-undo" title="ביטול הקו האחרון (Z)">↶</button>
        <button class="fd-btn" id="fd-clear" title="ניקוי (Delete)">נקה</button>
        <button class="fd-btn touch-only" id="fd-album">שרטוטים</button>
        <button class="fd-btn" id="fd-close" title="סגירה, הציור נשמר (Esc)">✕</button>
        <button class="fd-btn primary" id="fd-make">✓ צרו!</button>
      </div>`;
    this.cv = $('fd-air');
    this.g = this.cv.getContext('2d');
    this.tagEl = $('fd-tag');
    this.nameEl = $('fd-name');
    this.statsEl = $('fd-stats');
    this.noteEl = $('fd-note');
    this.altsEl = $('fd-alts');
    this.hintEl = $('fd-hint');
    this.signsEl = $('fd-signs');
    this.fuseEl = $('fd-fuse');
    this.toolsEl = $('fd-tools');
    this.makeBtn = $('fd-make');
    this.menuEl = $('fd-menu');
    this.inkFill = $('fd-ink-fill');
    this.inkCost = $('fd-ink-cost');
    this.colorBtn = $('fd-color');
    this.catsEl = $('fd-cats');
    this.partsEl = $('fd-parts');
    this.pmenuEl = $('fd-pmenu');
    this.cardEl = $('fd-card');
    this.pickInk(0);
    this.showCats();
  }

  bind() {
    const game = this.game;
    // the pen: on the whole screen (a phone: all of it but the stick's corner, the thumb's)
    const down = (e) => {
      if (!this.isOpen || this.cur) return;
      e.preventDefault();
      if (e.button === 2) {
        this.make();
        return;
      }
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (err) {
        // (synthetic pointers)
      }
      this.menu(false);
      this.autoShut = 0;
      // (on a part's name: a tap there is the next thing it could be, a long press - or its ▾ - its
      // whole menu (ROADMAP 11.15); drawn on from it, it is a line as any. On a name the game added:
      // taken away)
      const chip = this.chipAt(e.clientX, e.clientY);
      const imp = chip < 0 ? this.impAt(e.clientX, e.clientY) : null;
      this.partMenu(-1);
      this.cur = { p: [this.toPage(e)], c: this.ink, pid: e.pointerId, chip, imp, menuAt: chip >= 0 && this.chipArrow(chip, e.clientX), t0: performance.now() };
      // (the cards fade while the pen is down: the line under them shows. ROADMAP 11.21)
      if (chip < 0 && !imp) document.body.classList.add('fd-pen');
      if (chip >= 0) {
        clearTimeout(this.lpTimer);
        const c = this.cur;
        this.lpTimer = setTimeout(() => {
          if (this.cur !== c) return;
          let far = 0;
          for (const q of c.p) far = Math.max(far, Math.hypot(q[0] - c.p[0][0], q[1] - c.p[0][1]) * this.U);
          if (far >= 9) return;
          c.opened = true;
          this.partMenu(chip);
          this.render();
        }, LONG_PRESS * 1000);
      }
      this.hintEl.classList.add('gone');
      game.audio.scratchStart();
      this.render();
    };
    const move = (e) => {
      if (!this.cur || e.pointerId !== this.cur.pid) return;
      e.preventDefault();
      let evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      if (!evs.length) evs = [e];
      let moved = 0;
      for (const ev of evs) moved += this.penTo(this.toPage(ev));
      if (moved) game.audio.scratch(moved * 300);
      this.render();
    };
    const up = (e) => {
      if (!this.cur || e.pointerId !== this.cur.pid) return;
      this.penUp();
    };
    for (const t of [this.cv, $('fd-zone-a'), $('fd-zone-b')]) {
      t.addEventListener('pointerdown', down);
      t.addEventListener('pointermove', move);
      t.addEventListener('pointerup', up);
      t.addEventListener('pointercancel', up);
    }
    // (the mouse wheel: the next ink)
    this.cv.addEventListener('wheel', (e) => {
      if (!this.isOpen) return;
      e.preventDefault();
      if (Math.abs(e.deltaY) > 2) this.cycleInk(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });
    // (nothing drawn here reaches the game under it)
    for (const ev of ['mousedown', 'mouseup', 'click', 'contextmenu', 'touchstart', 'wheel']) this.el.addEventListener(ev, (e) => e.stopPropagation());
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    // the buttons: a finger works them as it touches them - with the thumb on the stick a
    // phone sees two fingers, and a tap of the other one makes no click; the mouse clicks (and
    // the click a finger's tap may still make after is not a second press, here or beside it)
    let pressed = -1e9;
    const press = (el, fn) => {
      el.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        pressed = performance.now();
        fn(e);
      });
      el.addEventListener('click', (e) => {
        if (performance.now() - pressed > 800) fn(e);
      });
    };
    press($('fd-inks'), (e) => {
      const b = e.target.closest('.fd-sw');
      if (b) this.pickInk(+b.dataset.i);
    });
    press(this.colorBtn, () => this.cycleInk(1));
    press($('fd-undo'), () => this.undo());
    press($('fd-clear'), () => this.clear());
    press($('fd-close'), () => this.close());
    // (in a car: back to driving - ROADMAP 11.21)
    press($('fd-make'), () => (this.carOpen ? this.close() : this.make()));
    press($('fd-album'), () => {
      this.close();
      game.openDraw();
    });
    press(this.catsEl, (e) => {
      const b = e.target.closest('.fd-cat');
      if (b) this.toggleCat(b.dataset.c || null);
    });
    press($('fd-kind'), () => this.menu(this.menuEl.classList.contains('hidden')));
    // (ROADMAP 11.10) a part's menu: what else that line could be; which way it faces
    press(this.pmenuEl, (e) => {
      const b = e.target.closest('.fd-pc');
      if (b) this.setPart(this.pmenuAt, b.dataset.t || null);
    });
    // (ROADMAP 11.12) the pointer over a part in the menu: what it would do there
    this.pmenuEl.addEventListener('pointerover', (e) => {
      const b = e.target.closest('.fd-pc');
      if (b && b.dataset.t && e.pointerType !== 'touch') this.pmenuShow(b.dataset.t);
    });
    this.pmenuEl.addEventListener('pointerleave', () => this.pmenuShow(this.pmenuType));
    // (ROADMAP 11.12) how much the engineer does to it
    press($('fd-eng'), (e) => {
      const b = e.target.closest('.fd-eb');
      if (!b || b.dataset.k === this.engLevel) return;
      this.engLevel = b.dataset.k;
      this.game.audio.play('click', 0.4);
      this.read();
      this.render();
    });
    // (ROADMAP 11.15) its look: as drawn, or polished
    press($('fd-look'), (e) => {
      const b = e.target.closest('.fd-lk');
      if (!b || b.dataset.l === this.look) return;
      this.look = b.dataset.l;
      this.game.audio.play('click', 0.4);
      this.read();
      this.render();
    });
    // (ROADMAP 11.15) what the engineer offers, taken or not - one, or all of them; a part the game
    // added, taken away or back
    press($('fd-engn'), (e) => {
      const b = e.target.closest('.fd-sg');
      if (!b) return;
      if (b.dataset.imp) {
        if (this.noImp.has(b.dataset.imp)) this.noImp.delete(b.dataset.imp);
        else this.noImp.add(b.dataset.imp);
      } else if (b.dataset.k === 'all') {
        const offered = this.PR ? this.PR.sugg.map((q) => q.k) : [];
        const all = offered.length && offered.every((k) => this.engOn.has(k));
        for (const k of offered) {
          if (all) this.engOn.delete(k);
          else this.engOn.add(k);
        }
      } else if (b.dataset.k) {
        if (this.engOn.has(b.dataset.k)) this.engOn.delete(b.dataset.k);
        else this.engOn.add(b.dataset.k);
      } else return;
      this.game.audio.play('click', 0.4);
      this.read();
      this.render();
    });
    press($('fd-face'), () => {
      this.face = !(this.P && this.P.flip);
      this.read();
      this.render();
    });
    press(this.altsEl, (e) => {
      const b = e.target.closest('.fd-chip');
      if (!b) return;
      if (b.dataset.k === '…') {
        this.menu(this.menuEl.classList.contains('hidden'));
        return;
      }
      this.choose(b.dataset.k || null);
    });
    press(this.menuEl, (e) => {
      const b = e.target.closest('.fd-chip');
      if (b) this.choose(b.dataset.k || null);
    });
    // (ROADMAP 11.11) a weapon of parts: what else it could be, on its card
    press($('fd-calts'), (e) => {
      const b = e.target.closest('.fd-chip');
      if (b) this.choose(b.dataset.k || null);
    });
    // its own keys while it is out (after the game's own listener: core/input.js); the game does
    // not see them (Esc is no pause here)
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen || e.repeat) return;
      const k = e.code;
      const mine = () => game.input.pressed.delete(k);
      if (k === 'Escape') {
        mine();
        this.close();
      } else if (k === 'Enter' || k === 'NumpadEnter') {
        mine();
        this.make();
      } else if (k === 'KeyZ' || k === 'Backspace') {
        mine();
        e.preventDefault();
        this.undo();
      } else if (k === 'Delete') {
        mine();
        this.clear();
      } else if (/^(Digit|Numpad)[0-5]$/.test(k)) {
        // (what is drawn: 1-5 each of the five, together; 0 anything - the weapons wait)
        mine();
        const i = +k.slice(-1);
        this.toggleCat(i ? CATEGORY_ORDER[i - 1] : null);
      }
    });
    window.addEventListener('resize', () => {
      if (this.isOpen) {
        this.layout();
        this.chipsDirty = true;
        this.info();
        this.render();
        this.partMenu(-1);
      }
    });
  }

  // ------------------------------------------------------------------ the pen out, and away
  show() {
    const game = this.game;
    const p = game.player;
    if (this.isOpen) return;
    // (ROADMAP 11.20: in a car, the pen draws parts onto it - game/fuse.js)
    const inCar = !!(game.fuse && p.inVehicle && p.mode === 'vehicle');
    if (p.inVehicle && !inCar) {
      game.hud.toast('צריך לצאת מהרכב כדי לצייר', 'info');
      return;
    }
    if ((p.mode !== 'foot' && !inCar) || game.state !== 'play') return;
    this.isOpen = true;
    this.stats.opened++;
    this.el.classList.remove('hidden');
    document.body.classList.add('fd-open');
    // (ROADMAP 11.21: in a car - the time to draw on it: no kinds to pick, a button back to driving)
    this.carOpen = inCar;
    this.autoShut = 0;
    document.body.classList.toggle('fd-car', inCar);
    if (!game.touch) game.input.releaseLock();
    game.input.fire = false;
    this.layout();
    this.read();
    this.render();
    if (game.pad) game.pad.startFree({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight });
    game.audio.play('pageflip', 0.4);
  }

  close() {
    if (!this.isOpen) return;
    const game = this.game;
    this.isOpen = false;
    this.shutAt = performance.now();
    if (this.cur) this.penUp(true);
    this.menu(false);
    this.partMenu(-1);
    this.el.classList.add('hidden');
    document.body.classList.remove('fd-open');
    document.body.classList.remove('fd-car');
    document.body.classList.remove('fd-pen');
    this.carOpen = false;
    this.autoShut = 0;
    if (game.pad) game.pad.pen = false;
    if (!game.touch && game.state === 'play') game.input.requestLock();
  }

  toggle() {
    if (!this.isOpen) this.show();
    else if (this.strokes.length) this.make();
    else this.close();
  }

  layout() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cw = Math.max(1, window.innerWidth);
    this.ch = Math.max(1, window.innerHeight);
    this.cv.width = Math.round(this.cw * dpr);
    this.cv.height = Math.round(this.ch * dpr);
    this.dpr = dpr;
    this.U = this.unit();
    this.bake();
  }

  // screen px -> the drawing's units
  toPage(e) {
    return [e.clientX / this.U, e.clientY / this.U];
  }

  // the pen on to p: how far it went
  penTo(p) {
    const c = this.cur;
    const q = c.p[c.p.length - 1];
    const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < 0.006) return 0;
    c.p.push([Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000]);
    return d;
  }

  penUp(drop = false) {
    const c = this.cur;
    this.cur = null;
    document.body.classList.remove('fd-pen');
    this.game.audio.scratchStop();
    if (drop || !c) return;
    // (a tap on a part's name: the next thing it could be - its menu, if pressed long or on its ▾;
    // no line. ROADMAP 11.15)
    clearTimeout(this.lpTimer);
    if ((c.chip >= 0 || c.imp) && (c.opened || performance.now() - c.t0 < 900)) {
      const U = this.U;
      let far = 0;
      for (const q of c.p) far = Math.max(far, Math.hypot(q[0] - c.p[0][0], q[1] - c.p[0][1]) * U);
      if (far < 9 || c.opened) {
        if (c.imp) {
          // (a part the game added: taken away - on the card, to have back)
          this.noImp.add(c.imp);
          this.game.audio.play('click', 0.4);
          this.read();
        } else if (c.opened) {
          // (its menu is open already)
        } else if (c.menuAt) this.partMenu(c.chip);
        else this.cyclePart(c.chip);
        this.render();
        return;
      }
    }
    let len = 0;
    for (let i = 1; i < c.p.length; i++) len += Math.hypot(c.p[i][0] - c.p[i - 1][0], c.p[i][1] - c.p[i - 1][1]);
    // (a dot: a little round one)
    if (len < 0.012) {
      const [x, y] = c.p[0];
      c.p = [];
      for (let i = 0; i <= 8; i++) c.p.push([x + Math.cos((i / 8) * Math.PI * 2) * 0.008, y + Math.sin((i / 8) * Math.PI * 2) * 0.008]);
    }
    if (this.game.lab) {
      this.steady(c);
      return;
    }
    this.strokes.push({ p: c.p, c: c.c });
    this.bake();
    this.read();
    this.render();
  }

  // (ROADMAP 11.9) the line just lifted: a quick sign (game/signs.js) - it acts, and goes; else
  // it stays on the page, drawn again steadier (game/inkclean.js), turning into that
  steady(c) {
    const raw = c.p;
    this.strokes.push({ p: raw, raw, c: c.c });
    const sg = this.game.signs;
    const m = sg && sg.match(this.strokes.map((s) => s.raw || s.p), this.U);
    if (m) {
      this.flyAway();
      this.strokes = [];
      this.force = null;
      this.bake();
      this.read();
      this.render();
      sg.run(m);
      return;
    }
    // (ROADMAP 11.20) a part drawn onto a thing - your car, you, your gun, a police car: on at once
    const fz = this.game.fuse;
    const inCar = !!(fz && this.game.player.inVehicle);
    // (in a car: the pen away by itself a few seconds after the last line - the city back up to
    // speed, the driving buttons back under the thumbs; another line before that keeps it out, as
    // many as you like. The button back to driving shows the time running out)
    const shut = () => {
      if (!inCar) return;
      this.autoShutLen = this.game.touch ? 4200 : 4600;
      this.autoShut = performance.now() + this.autoShutLen;
    };
    const fm = fz && fz.match(this.strokes.map((s) => s.raw || s.p), this.U);
    if (fm) {
      this.flyAway();
      this.strokes = [];
      this.force = null;
      this.bake();
      this.read();
      this.render();
      if (fz.run(fm, c.c)) shut();
      return;
    }
    // (ROADMAP 11.21: in a car, a line that is no part stays on what it was drawn on, as drawn - ink
    // on it; one drawn off everything goes)
    if (inCar) {
      const stuck = fz.stick(this.strokes.map((s) => s.raw || s.p), this.U, c.c);
      if (!stuck) this.flyAway();
      this.strokes = [];
      this.bake();
      this.read();
      this.render();
      if (stuck) shut();
      else fz.say('ציירו על המכונית, או חלק צמוד אליה', 'bad');
      return;
    }
    const s = this.strokes[this.strokes.length - 1];
    const unit = 1 / this.U;
    const prev = this.strokes.slice(0, -1).map((o) => ({ p: o.p, kind: o.k || 'curve', closed: !!o.closed, c: o.circ }));
    const C = joinStroke(cleanStroke(raw, { unit }), prev, { unit });
    s.p = C.p;
    s.k = C.kind;
    s.closed = C.closed;
    s.circ = C.c;
    if (C.kind !== 'dot' && C.kind !== 'scribble') s.morph = { ...morphPair(raw, C.p, C.closed), t: 0 };
    this.bake();
    this.read();
    this.render();
  }

  // (the pad's pencil, core/gamepad.js: in screen pixels)
  padPen(x, y, down) {
    const inside = x >= 0 && y >= 0 && x <= window.innerWidth && y <= window.innerHeight;
    const p = [x / this.U, y / this.U];
    if (down && !this.cur && inside) {
      this.cur = { p: [p], c: this.ink, pid: -2 };
      this.game.audio.scratchStart();
    } else if (down && this.cur) {
      const m = this.penTo(p);
      if (m) this.game.audio.scratch(m * 300);
      this.render();
    } else if (!down && this.cur) this.penUp();
  }

  undo() {
    if (this.cur) return;
    // (ROADMAP 11.20: nothing on the page - the part just drawn onto a thing comes off, its ink back)
    if (!this.strokes.length && this.game.fuse && this.game.fuse.undo()) return;
    this.strokes.pop();
    delete this.over[this.strokes.length];
    if (!this.strokes.length) this.face = null;
    this.partMenu(-1);
    this.bake();
    this.read();
    this.render();
  }

  clear() {
    this.strokes = [];
    this.force = null;
    this.over = {};
    this.face = null;
    // (a new drawing: the engineer's offers, what the game adds - as they come again)
    this.engOn.clear();
    this.noImp.clear();
    this.gaveWheels = false;
    this.partMenu(-1);
    this.bake();
    this.read();
    this.render();
  }

  pickInk(i) {
    this.ink = i;
    this.el.querySelectorAll('.fd-sw').forEach((b) => b.classList.toggle('on', +b.dataset.i === i));
    const ink = INKS[i];
    this.colorBtn.style.setProperty('--c', ink.css);
    this.colorBtn.classList.toggle('pencil', !!ink.pencil);
    this.colorBtn.classList.toggle('neon', !!ink.neon);
  }

  // the choices there are: those of what is drawn (all of them, when anything)
  choices() {
    const cs = this.cats.size ? CATEGORY_ORDER.filter((c) => this.cats.has(c)) : CATEGORY_ORDER;
    return cs.flatMap((c) => CHOICES[c]);
  }

  menu(on) {
    this.menuEl.classList.toggle('hidden', !on);
    if (on) {
      const on = picksOf(this.force);
      this.menuEl.innerHTML = [['', 'אוטומטי'], ...this.choices()].map(([k, n]) => `<button class="fd-chip${(k ? on.includes(k) : !on.length) ? ' on' : ''}" data-k="${k}">${n}</button>`).join('');
    }
    if (this.isOpen) this.place();
  }

  // ------------------------------------------------------------------ what is drawn (ROADMAP 11.8)
  // a category on or off (several on: a thing of them all together); null: anything
  toggleCat(c) {
    if (!c) this.cats.clear();
    else if (this.cats.has(c)) this.cats.delete(c);
    else this.cats.add(c);
    // (a pick of something none of them is: let go)
    const keep = picksOf(this.force).filter((k) => !this.cats.size || this.cats.has(keyCat(k)));
    this.force = keep.length ? keep.join('|') : null;
    this.showCats();
    this.menu(false);
    this.read();
    this.render();
  }

  showCats() {
    const cur = this.padCats ? this.catCursor : -1;
    this.catsEl.querySelectorAll('.fd-cat').forEach((b, i) => {
      const c = b.dataset.c || null;
      b.classList.toggle('on', c ? this.cats.has(c) : this.cats.size === 0);
      b.classList.toggle('cur', i === cur);
    });
    this.catsEl.classList.toggle('combo', this.cats.size > 1);
  }

  // (the pad's d-pad: left and right along them, down turns one on or off)
  padCat(d) {
    this.padCats = true;
    if (d) this.catCursor = (this.catCursor + d + CATEGORY_ORDER.length + 1) % (CATEGORY_ORDER.length + 1);
    else this.toggleCat(this.catCursor ? CATEGORY_ORDER[this.catCursor - 1] : null);
    this.showCats();
  }

  // it is something else: what the player picked (null: what it looks like)
  choose(k) {
    // (several kinds of thing together: a pick of each - the vehicle, its gear, its weapon)
    if (k && this.cats.size > 1) this.force = [...picksOf(this.force).filter((x) => keyKind(x) !== keyKind(k)), k].join('|');
    else this.force = k;
    this.menu(false);
    this.read();
    this.render();
  }

  cycleInk(d) {
    this.pickInk((this.ink + d + INKS.length) % INKS.length);
  }

  // (the pad's Y) it is something else: the next of what it could be, then the rest
  cycleKind() {
    const alts = this.R && this.R.alts ? this.R.alts.map((a) => a.key) : [];
    const list = [...new Set([null, ...alts, ...this.choices().map((v) => v[0])])];
    this.force = list[(list.indexOf(this.force) + 1) % list.length];
    this.read();
    this.render();
  }

  // ------------------------------------------------------------------ reading it
  read() {
    this.R = null;
    this.R0 = null;
    this.readRide();
    if (!this.PR) this.R = this.R0 || (this.strokes.length ? this.readNow() : null);
    this.readHand();
    this.readGear();
    this.chipsDirty = true;
    this.info();
  }

  // ------------------------------------------------------------------ (ROADMAP 11.11, parts 2) a weapon of parts
  // What it is, read as it always was (game/freeform.js); then each line, which part of it it is
  // (game/handparts.js), its name on it - and what each part makes it do, on the card by the
  // drawing with the model it will be (a red barrel fires fire, a sight zooms, wings make its shots
  // fly after them...)
  readHand() {
    const was = this.PW;
    this.PW = null;
    const R = this.R;
    if (!this.game.lab || this.PR || !R || R.cat !== 'weapon' || !R.grid || R.kind === 'shield') {
      if (was) this.cardDirty = true;
      return;
    }
    let P = null;
    try {
      P = readHandParts(this.strokes.map((s) => ({ p: s.p, c: s.c, k: s.k, r: s.raw })), this.over, this.cats, R);
    } catch (err) {
      console.warn('handparts', err);
    }
    if (!P) {
      if (was) this.cardDirty = true;
      return;
    }
    this.P = P;
    this.PW = { P, R, spec: handSpec(P) };
    this.cardDirty = true;
  }

  // (ROADMAP 11.11) gear, a shield: no parts to name - but its model by the drawing, as it will be
  readGear() {
    const was = this.PG;
    this.PG = null;
    const R = this.R;
    const shield = R && R.cat === 'weapon' && R.kind === 'shield';
    const gear = R && R.cat === 'gear' && GEAR_VIEW.has(R.kind);
    if (!this.game.lab || this.PR || this.PW || !(shield || gear)) {
      if (was) this.cardDirty = true;
      return;
    }
    this.PG = { R };
    this.cardDirty = true;
  }

  // gear's model, as it is made (ui/partview.js)
  gearModel(R) {
    if (R.cat === 'weapon') return buildWeapon(R).group;
    if (R.kind === 'parachute') return canopyModel(R.grade, R.colors && R.colors.length ? R.colors : null);
    const G = this.game.gadgets;
    return G ? G.model(R.kind, R.grade, null, R.kind === 'umbrella' && R.colors && R.colors.length ? R.colors[0] : null).group : null;
  }

  // as a made thing is read (make): the weapon, its numbers what its parts made them
  handR() {
    const { P, R, spec } = this.PW;
    return Object.assign({}, R, {
      def: spec.def,
      name: spec.sum.name,
      cost: spec.def.cost + (R.extra ? R.extra.cost : 0),
      muzzlePts: P.muzzles,
      say: spec.sum.abil.map(([, t]) => t).join(' · '),
      parts: true,
    });
  }

  // ------------------------------------------------------------------ (ROADMAP 11.10) a ride of parts
  // Each line a part (game/parts.js), its name on it as it is drawn; what the ride does, the parts
  // added up (game/partsum.js) - on the card by the drawing, with the model it will be. A drawing
  // that is no ride (held by a grip, no body to it - or no way to move, and the network sure it is
  // a weapon or gear) is read as before.
  readRide() {
    this.P = null;
    const was = this.PR;
    this.PR = null;
    if (!this.game.lab || !this.strokes.length) {
      if (was) this.cardDirty = true;
      return;
    }
    // (the player said it is a weapon, gear - and nothing that moves: as before)
    if (this.cats.size && ![...this.cats].some((c) => c === 'car' || c === 'air' || c === 'sea')) {
      if (was) this.cardDirty = true;
      return;
    }
    // (what the network sees in it: only to tell a ride from a weapon or gear drawn - and that a
    // body drawn alone is a boat's hull)
    let net = null;
    try {
      net = look(this.strokes.map((s) => s.raw || s.p));
    } catch (err) {
      net = null;
    }
    // (each line as steadied, and as the hand drew it; what kind of thing it likely is: what the
    // network sees, what the player said they draw)
    const relook = (keep) => {
      try {
        return look(keep.map((i) => this.strokes[i].raw || this.strokes[i].p));
      } catch (err) {
        return null;
      }
    };
    // (ROADMAP 11.12: what it was a moment ago - a ride the player names a part of is a ride still,
    // unless they named what is held; a weapon, a weapon - unless what they named makes it a ride)
    const frame = was ? 'ride' : this.PW ? 'hand' : null;
    const P = readParts(this.strokes.map((s) => ({ p: s.p, c: s.c, k: s.k, r: s.raw })), this.over, this.face, null, { net, cats: this.cats.size ? this.cats : null, relook: net ? relook : null, frame, noImplicit: this.noImp });
    this.P = P;
    if (!P || P.frame !== 'ride' || !P.R) return;
    // (ROADMAP 11.15: made as it was drawn - or polished, as the player says)
    const drawn = rideDesign(P, this.strokes, INKS, this.look);
    if (!drawn) return;
    // (ROADMAP 11.12) what the engineer makes of it: game/engineer.js - the card shows it, the drawing
    // turns into it, and it is what is made. (ROADMAP 11.15) the hand's slips put right; what else it
    // would do, offered - each step done only when the player takes it
    let E = { design: drawn, notes: [], changes: [], steps: [] };
    let all = E;
    try {
      const noTidy = this.engLevel === 'raw';
      all = engineer(drawn, 'eng', { noTidy });
      const only = new Set([...this.engOn].filter((k) => EN_STEPS.includes(k)));
      E = only.size ? engineer(drawn, 'eng', { only, noTidy }) : engineer(drawn, this.engLevel);
    } catch (err) {
      console.warn('engineer', err);
    }
    // (what it offers: each step, its notes and the lines it moves - as that step would)
    const sugg = new Map();
    for (const st of all.steps || []) {
      if (!st.k || TIDY_STEPS.includes(st.k)) continue;
      const g = sugg.get(st.k) || { k: st.k, notes: [], srcs: new Set(), added: [] };
      g.notes.push(st.t);
      for (const q of st.srcs) if (q !== null) g.srcs.add(q);
      g.added.push(...(st.added || []));
      sugg.set(st.k, g);
    }
    const design = E.design;
    const spec = rideSpec(design);
    const ok = spec.ok !== false && !!spec.base;
    const picked = Object.values(this.over);
    // (ROADMAP 11.13: the player said it is a ride - an aircraft, a car, a boat, armed or not: one it
    // is, whatever weapon or gear the network sees in it - a rocket is no ladder)
    const rideSaid = this.cats.size > 0 && [...this.cats].some((c) => c === 'car' || c === 'air' || c === 'sea');
    if (net && !rideSaid && (!picked.length || (frame === 'hand' && !picked.some((t) => RIDES_IT.has(t))))) {
      // (plainly something else - a weapon, a shield: read as before - unless its parts are surely
      // a ride's, and the network not that sure)
      const other = net.weapon + net.gear;
      const ev = rideEvidence(P);
      if (other > 0.5 && net.vehicle < 0.3 && (ev < 2 || other > 0.8 || !ok)) return;
    }
    this.PR = { design, spec, sum: spec.sum, ok, why: spec.why, eng: E, all, sugg: [...sugg.values()] };
    this.cardDirty = true;
    // (a change in what the engineer did: the drawing turns into it again)
    const sig = E.changes.map((c) => c.to.reduce((a, p) => a + p[0] * 3.1 + p[1], 0).toFixed(2)).join(',');
    if (sig !== this.engSig) {
      this.engSig = sig;
      this.engMorph = E.changes.length && design.page ? { t: 0 } : null;
    }
  }

  // what a line is: the player's say (null: as the game reads it)
  setPart(i, t, menu = true) {
    if (i < 0) return;
    if (t && t !== '') this.over[i] = t;
    else delete this.over[i];
    this.partMenu(-1);
    this.game.audio.play('click', 0.4);
    this.read();
    this.render();
    // (ROADMAP 11.12: the menu stays - another tried, the card says what each makes of it)
    if (menu && this.P && this.P.parts.some((q) => q.i === i)) this.partMenu(i);
  }

  // (ROADMAP 11.15) a tap on a part's name: the next thing it likely is (as the game read it first,
  // then the likely ones, then only a line); round again to as the game reads it
  cyclePart(i) {
    const part = this.P ? this.P.parts.find((q) => q.i === i) : null;
    if (!part) return;
    const list = [...new Set([part.auto, ...(part.choices || []).filter((t) => PART[t] && t !== 'deco').slice(0, 4), 'deco'])].filter((t) => PART[t]);
    const next = list[(list.indexOf(part.type) + 1) % list.length];
    this.setPart(i, next === part.auto ? null : next, false);
    const chip = this.chips.find((c) => c.i === i);
    if (chip) {
      chip.el.classList.remove('flip');
      void chip.el.offsetWidth;
      chip.el.classList.add('flip');
    }
  }

  // (ROADMAP 11.15) on a part's ▾: its whole menu
  chipArrow(i, x) {
    const chip = this.chips.find((c) => c.i === i);
    if (!chip) return false;
    const r = chip.el.getBoundingClientRect();
    return x <= r.left + 15;
  }

  // (ROADMAP 11.15) which part the game added has its name at (x, y) on the screen (its kind, or null)
  impAt(x, y) {
    for (const c of this.impChips || []) {
      const r = c.el.getBoundingClientRect();
      if (x >= r.left - 4 && x <= r.right + 4 && y >= r.top - 4 && y <= r.bottom + 4) return c.type;
    }
    return null;
  }

  // the menu of a part's name (-1: none). (ROADMAP 11.12) Every part it could be, in groups - the
  // likely ones first - each with what it would be there (a wheel along its bottom: a track); at its
  // foot, what the part it is now does there (and, the pointer over another, what that would). A
  // tap: it is that - the card says what it made of the whole, its numbers' arrows what changed
  partMenu(i) {
    this.pmenuAt = i;
    const el = this.pmenuEl;
    const P = this.P;
    const part = i >= 0 && P ? P.parts.find((q) => q.i === i) : null;
    if (!part) {
      el.classList.add('hidden');
      return;
    }
    const mine = this.over[i];
    const likely = (part.choices || []).filter((t) => t !== 'deco' && PART[t]).slice(0, 4);
    const groups = menuOf(P, i, likely, (t) => RIDES_IT.has(t));
    this.pmenuSay = new Map();
    this.pmenuType = part.type;
    const btn = (it) => {
      this.pmenuSay.set(it.t, it);
      const sub = it.name && it.name !== PART[it.t].name ? `<small>${esc(it.name)}</small>` : '';
      return `<button class="fd-pc r-${PART[it.t].role}${it.t === part.type ? ' on' : ''}" data-t="${it.t}">${PART[it.t].name}${sub}</button>`;
    };
    const rows = groups.map((g) => `<div class="fd-pg${g.k === 'likely' ? ' likely' : ''}"><span>${g.name}</span>${g.items.map(btn).join('')}</div>`).join('');
    const auto = mine ? `<button class="fd-pc auto" data-t="">אוטומטי (${PART[part.auto].name})</button>` : '';
    el.innerHTML = `<div class="fd-pm-top"><b>מה הקו הזה?</b>${auto}</div><div class="fd-pm-say" id="fd-pm-say"></div>${rows}`;
    this.pmenuShow(part.type);
    el.classList.remove('hidden');
    const chip = this.chips.find((c) => c.i === i);
    const r = chip ? chip.el.getBoundingClientRect() : { left: 20, bottom: 20, top: 20 };
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const x = clamp(r.left, 8, window.innerWidth - w - 8);
    let y = r.bottom + 6;
    if (y + h > window.innerHeight - 8) y = Math.max(8, r.top - h - 6);
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  // the menu's foot: what part t does there (now: the one it is; else the one the pointer is over)
  pmenuShow(t) {
    const it = this.pmenuSay && this.pmenuSay.get(t);
    const el = $('fd-pm-say');
    if (!el || !it) return;
    const now = t === this.pmenuType;
    const name = it.name && it.name !== PART[t].name ? `${PART[t].name}: ${it.name}` : PART[t].name;
    el.innerHTML = `<b>${now ? 'עכשיו' : 'אם יהיה'} ${esc(name)}</b> — ${esc(it.say || '')}`;
  }

  // which part's name is at (x, y) on the screen (-1: none)
  chipAt(x, y) {
    if (!this.PR && !this.PW) return -1;
    for (const c of this.chips) {
      const r = c.el.getBoundingClientRect();
      if (x >= r.left - 4 && x <= r.right + 4 && y >= r.top - 4 && y <= r.bottom + 4) return c.i;
    }
    return -1;
  }

  // each line's name, on it (big shapes: in their middle; the rest just over their top), clear of
  // one another
  showChips() {
    this.chipsDirty = false;
    const P = this.P;
    const on = !!((this.PR || this.PW) && P);
    this.partsEl.classList.toggle('hidden', !on);
    if (!on) {
      this.partsEl.innerHTML = '';
      this.chips = [];
      this.impChips = [];
      return;
    }
    const U = this.U;
    const b = this.bounds();
    const big = b ? Math.max(b.x1 - b.x0, b.y1 - b.y0) / U : 1;
    // (and what no one line is: the wheels in its arches, a plane's wings in its outline - faint)
    const imp = P.implicit || [];
    // (ROADMAP 11.15: each its ▾ - its menu; what the game added, its ✕ - taken away)
    this.partsEl.innerHTML = P.parts.map((q) => `<span class="fd-pchip r-${PART[q.type].role}${this.over[q.i] ? ' mine' : ''}" data-i="${q.i}"><i class="dd">▾</i>${PART[q.type].name}</span>`).join('') + imp.map((q) => `<span class="fd-pchip r-${PART[q.type].role} implicit" title="המשחק הוסיף — נגיעה מורידה">${PART[q.type].name}<i class="x">✕</i></span>`).join('');
    const els = [...this.partsEl.children];
    const placed = [];
    this.chips = [];
    const order = P.parts.map((q, k) => ({ q, el: els[k] }));
    for (const { q, el } of order) {
      const s = this.strokes[q.i];
      if (!s) continue;
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const [x, y] of s.p) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const inBig = q.sh.closed && Math.max(x1 - x0, y1 - y0) > big * 0.4;
      let cx = ((x0 + x1) / 2) * U;
      let top = inBig ? ((y0 + y1) / 2) * U - h / 2 : y0 * U - h - 5;
      // (clear of the names already placed: up a little, then down)
      for (let k = 0; k < 6; k++) {
        const hit = placed.find((r) => Math.abs(r.cx - cx) < (r.w + w) / 2 + 3 && Math.abs(r.top - top) < h + 2);
        if (!hit) break;
        top = k < 3 ? hit.top - h - 3 : hit.top + h + 3;
      }
      cx = clamp(cx, w / 2 + 4, window.innerWidth - w / 2 - 4);
      top = clamp(top, 4, window.innerHeight - h - 4);
      placed.push({ cx, top, w });
      el.style.transform = `translate(${Math.round(cx - w / 2)}px, ${Math.round(top)}px)`;
      this.chips.push({ i: q.i, el });
    }
    this.impChips = [];
    imp.forEach((q, k) => {
      const el = els[P.parts.length + k];
      if (!el) return;
      this.impChips.push({ type: q.type, el });
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      let cx = q.at[0] * U;
      let top = q.at[1] * U - h / 2;
      for (let n = 0; n < 4; n++) {
        const hit = placed.find((r) => Math.abs(r.cx - cx) < (r.w + w) / 2 + 3 && Math.abs(r.top - top) < h + 2);
        if (!hit) break;
        top = hit.top + h + 3;
      }
      cx = clamp(cx, w / 2 + 4, window.innerWidth - w / 2 - 4);
      top = clamp(top, 4, window.innerHeight - h - 4);
      placed.push({ cx, top, w });
      el.style.transform = `translate(${Math.round(cx - w / 2)}px, ${Math.round(top)}px)`;
    });
    if (this.pmenuAt >= 0) this.partMenu(this.pmenuAt);
  }

  // the card by the drawing: what it is called, the model it will be, what it does, its numbers
  // (an arrow by each that the last line changed), what is wrong with it, how much ink
  card() {
    this.cardDirty = false;
    const PR = this.PR;
    const PW = this.PW;
    const PG = this.PG;
    this.cardEl.classList.toggle('hidden', !PR && !PW && !PG);
    if (!PR && !PW && !PG) {
      this.bars0 = null;
      if (this.view) this.view.set(null);
      return;
    }
    // (gear: its name, what it does, the model)
    const sum = PR ? PR.sum : PW ? PW.spec.sum : { name: PG.R.name, abil: statLine(PG.R).split(' · ').map((t) => ['gear', t]), bars: [], lines: [], warn: [] };
    $('fd-cname').textContent = sum ? sum.name : '…';
    // (ROADMAP 11.15) what its parts do together (game/combos.js), in the same row as what it can do -
    // the card no taller for it: how many things it can do, in stars; each combo in gold (new: never
    // made yet), what each gives in the lines below; one part short of another, what to draw for it
    const cbs = sum && sum.combos ? sum.combos : [];
    const near = sum && sum.near ? sum.near : [];
    const adv = sum && sum.adv ? sum.adv : 0;
    const made = PR ? PR.ok : !!PW;
    const chips = sum ? sum.abil.map(([r, t]) => `<span class="fd-ab r-${r}">${esc(t)}</span>`) : [];
    if (made && (cbs.length || near.length || adv >= 3)) {
      const stars = clamp(Math.ceil((adv + cbs.length * 2) / 3), 1, 5);
      chips.unshift(`<span class="fd-cbh" title="${adv} יתרונות${cbs.length ? ` · ${cbs.length} שילובים` : ''}"><b>${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</b></span>`);
      for (const c of cbs) chips.push(this.found.has(c.k) ? `<span class="fd-cbc found" data-k="${c.k}">🏆 ${esc(c.name)}<i>✓</i></span>` : `<span class="fd-cbc" data-k="${c.k}">🏆 ${esc(c.name)}<i>חדש!</i></span>`);
      for (const c of near) chips.push(`<span class="fd-cbc near" data-k="${c.k}" title="${esc(c.say)}">💡 + ${esc(c.miss)} = ${esc(c.name)}</span>`);
    }
    $('fd-abil').innerHTML = chips.join('');
    // (what changed since the last line: an arrow, up green, down red)
    const now = performance.now() / 1000;
    const bars = sum ? sum.bars : [];
    if (this.bars0) {
      for (const b of bars) {
        const o = this.bars0.find((q) => q.k === b.k);
        const d = o ? b.v - o.v : 1;
        if (Math.abs(d) > 0.012) this.deltas[b.k] = { up: d > 0, t: now };
      }
    }
    this.bars0 = bars;
    $('fd-bars').innerHTML = bars
      .map((b) => {
        const dl = this.deltas[b.k];
        const arrow = dl && now - dl.t < DELTA_T ? `<em class="${dl.up ? 'up' : 'down'}">${dl.up ? '▲' : '▼'}</em>` : '<em></em>';
        return `<div class="fd-bar${b.bad ? ' bad' : ''}"><span class="n">${b.name}</span><i><b style="width:${Math.round(clamp(b.v, 0.03, 1) * 100)}%"></b></i><span class="v">${esc(b.txt)}</span>${arrow}</div>`;
      })
      .join('');
    // (ROADMAP 11.11) what each of its parts does (a ride's: what no number says - its nose, a
    // barrel's ink, one that points down)
    // (ROADMAP 11.15: what its parts do together first, in gold - each, what it gives)
    const lines = [...(sum && sum.combos ? sum.combos.map((c) => ['combo', `🏆 ${c.name}`, c.say]) : []), ...(sum && sum.lines ? sum.lines : [])];
    const lEl = $('fd-lines');
    lEl.innerHTML = lines.map(([r, t, x]) => `<div class="fd-ln"><span class="fd-ab r-${r}">${esc(t)}</span><span>${esc(x)}</span></div>`).join('');
    lEl.classList.toggle('hidden', !lines.length);
    // (ROADMAP 11.15) its look: as drawn, or each part the game's own
    const lkEl = $('fd-look');
    lkEl.innerHTML = PR ? `<span>מראה</span>${LOOKS.map(([k, n]) => `<button class="fd-lk${k === this.look ? ' on' : ''}" data-l="${k}">${n}</button>`).join('')}` : '';
    lkEl.classList.toggle('hidden', !PR);
    // (ROADMAP 11.12) the engineer: its lines as drawn, or the hand's slips put right - (ROADMAP 11.15)
    // and what it would make better, offered: each a ✓ to take; the parts the game added, each a ✕
    const eEl = $('fd-eng');
    eEl.innerHTML = PR ? ENG_LEVELS.filter(([k]) => k !== 'eng').map(([k, n]) => `<button class="fd-eb${k === this.engLevel ? ' on' : ''}" data-k="${k}">${n}</button>`).join('') : '';
    eEl.classList.toggle('hidden', !PR);
    const nEl = $('fd-engn');
    const rows = [];
    if (PR) {
      const sg = PR.sugg || [];
      if (sg.length) {
        const allOn = sg.every((q) => this.engOn.has(q.k));
        rows.push(`<div class="fd-sgh"><b>💡 המהנדס מציע</b>${sg.length > 1 ? `<button class="fd-sg all${allOn ? ' on' : ''}" data-k="all">${allOn ? 'לבטל הכל' : '✓ הכל'}</button>` : ''}</div>`);
        for (const q of sg) {
          const on = this.engOn.has(q.k);
          rows.push(`<button class="fd-sg${on ? ' on' : ''}" data-k="${q.k}"><i>${on ? '✓' : '+'}</i><span>${esc(q.notes.join(' · '))}</span></button>`);
        }
      }
      // (what the game adds - each with its ✕; taken away, a + to have it back)
      const imp = [...new Set((this.P && this.P.implicit ? this.P.implicit : []).map((q) => q.type))];
      const gone = [...this.noImp];
      // (ROADMAP 11.15: wheels the game gave it - nothing drawn moved it - said so)
      const given = this.P && this.P.implicit && this.P.implicit.some((q) => q.type === 'wheel' && q.given);
      const why = (t) => (t === 'wheel' && (given || (!imp.includes('wheel') && this.gaveWheels)) ? 'גלגלים — כדי שייסע' : IMP_WHY[t] || (PART[t] ? PART[t].name : t));
      if (given) this.gaveWheels = true;
      if (imp.length || gone.length) {
        rows.push('<div class="fd-sgh"><b>המשחק הוסיף</b></div>');
        for (const t of imp) rows.push(`<button class="fd-sg imp on" data-imp="${t}"><i>✕</i><span>${esc(why(t))}</span></button>`);
        for (const t of gone) if (!imp.includes(t)) rows.push(`<button class="fd-sg imp" data-imp="${t}"><i>+</i><span>${esc(why(t))} (הוסר)</span></button>`);
      }
    }
    nEl.innerHTML = rows.join('');
    nEl.classList.toggle('hidden', !rows.length);
    const warn = [];
    if (PR && !PR.ok && PR.why) warn.push(PR.why);
    if (sum) warn.push(...sum.warn);
    const wEl = $('fd-warn');
    wEl.textContent = warn.join(' · ');
    wEl.classList.toggle('hidden', !warn.length);
    // (ROADMAP 11.15: how many things it can do, and of them together - by the stars)
    const advSay = made && (cbs.length || adv >= 3) ? ` · ${adv} יתרונות${cbs.length ? `, ${cbs.length === 1 ? 'שילוב אחד' : `${cbs.length} שילובים`}` : ''}` : '';
    if (PR) $('fd-meta').textContent = sum ? `אורך ${sum.L.toFixed(1)} מ׳ · משקל ${sum.mass.toFixed(1)} טון${PR.ok ? ` · ${PR.spec.cost} דיו` : ''}${advSay}${PR.ok && PR.spec.com && PR.design.page ? ' · ◐ מרכז הכובד' : ''}` : '';
    else if (PG) {
      $('fd-meta').textContent = `${PG.R.cost} דיו`;
      // (gear that needs its place: why it would not go here)
      const why = this.cannotMake(PG.R);
      if (why) {
        wEl.textContent = why;
        wEl.classList.remove('hidden');
      }
    } else {
      const len = PW.R.len || (KINDS[PW.R.kind] ? KINDS[PW.R.kind].len : 0.5);
      $('fd-meta').textContent = `אורך ${len.toFixed(2)} מ׳ · ${this.handR().cost} דיו${advSay}`;
    }
    // (which way it faces: a ride's to say; a weapon's, as its parts say)
    $('fd-face').classList.toggle('hidden', !PR);
    // (a weapon: what else it could be, the network's next guesses)
    const cEl = $('fd-calts');
    const AR = PW ? PW.R : PG ? PG.R : null;
    const alts = AR && AR.alts ? AR.alts.filter((a) => a.key !== (AR.choice || null)).slice(0, 3) : [];
    cEl.innerHTML = alts.map((a) => `<button class="fd-chip" data-k="${a.key}">${a.name}?</button>`).join('');
    cEl.classList.toggle('hidden', !alts.length);
    // the model it will be
    if (!this.view) this.view = new PartView($('fd-view'));
    if (PR) this.view.set(PR.ok ? PR.design : null, PR.ok ? PR.spec : null);
    else if (PW) this.view.setModel(() => buildWeapon(this.handR()).group);
    else this.view.setModel(() => this.gearModel(PG.R), PG.R.cat === 'weapon' || PG.R.kind === 'umbrella' || PG.R.kind === 'key');
    $('fd-view').classList.toggle('none', (PR && !PR.ok) || this.view.dead);
    // (a ride's, more than the screen holds - it scrolls: on a phone a finger on it moving it, not
    // drawing; on a computer the wheel)
    const C = this.cardEl;
    C.classList.toggle('scroll', !!PR && C.scrollHeight > C.clientHeight + 2);
  }

  // as a made thing is read (ui/freedraw.js make): the ride, as R is
  partsR() {
    const PR = this.PR;
    if (!PR.ok) return { cat: null, why: PR.why || 'עוד לא זז' };
    return { cat: 'vehicle', kind: PR.spec.kind, name: PR.sum.name, design: PR.design, spec: PR.spec, cost: PR.spec.cost, mirror: !!(this.P && this.P.flip) };
  }

  readNow() {
    if (!this.game.lab) return readFree(this.strokes, this.force, this.cats);
    // (ROADMAP 11.9) what it is: read off the lines as they were drawn, as it always was...
    const R0 = readFree(this.strokes.map((s) => ({ p: s.raw || s.p, c: s.c })), this.force, this.cats);
    const force = forceOf(R0);
    if (!force) return R0;
    // ...and built from the steadied lines: the same thing (else as it was)
    const R1 = readFree(this.strokes, force, this.cats);
    if (!R1 || R1.cat !== R0.cat || R1.kind !== R0.kind) return R0;
    R1.alts = R0.alts;
    R1.choice = R0.choice;
    R1.decided = force;
    return R1;
  }

  // what the tag says of it: what it is becoming, what it can do, the ink it takes, what else
  // it could be
  info() {
    const game = this.game;
    const PR = this.PR;
    const PW = this.PW;
    const PG = this.PG;
    const R = PR ? this.partsR() : PW ? this.handR() : this.R;
    const ink = game.ink;
    const level = ink ? ink.level : 1e9;
    const cost = R && R.cat ? R.cost : 0;
    const has = this.strokes.length > 0;
    if (this.cardDirty || (!PR && !this.cardEl.classList.contains('hidden'))) this.card();
    if (this.chipsDirty) this.showChips();
    this.tagEl.classList.toggle('hidden', !has || !!PR || !!PW || !!PG);
    this.hintEl.classList.toggle('gone', has || !!this.cur);
    this.signsEl.classList.toggle('hidden', !this.game.lab || has || !!this.cur || !!this.game.player.inVehicle);
    // (ROADMAP 11.20) the parts you can draw onto things, how each is drawn
    this.fuseEl.classList.toggle('hidden', !this.game.fuse || has || !!this.cur);
    this.hintEl.textContent = game.fuse && game.player.inVehicle
      ? game.touch
        ? 'ציירו על המכונית — נשאר עליה · קו שיוצא ממנה — חלק (גלגל, כנף, כוכב...)'
        : 'ציירו על המכונית — כל קו נשאר עליה · קו שיוצא ממנה הופך לחלק · WASD ממשיכים לנהוג · Q חוזרים לנסוע'
      : game.lab
      ? game.touch
        ? 'ציירו באוויר · כל קו מקבל שם: נגיעה בשם — התפקיד הבא, לחיצה ארוכה — כל האפשרויות · נבנה בדיוק כמו שציירתם'
        : 'ציירו באוויר · כל קו מקבל שם: לחיצה על השם — התפקיד הבא, ▾ — כל האפשרויות · נבנה בדיוק כמו שציירתם · Q יוצרים'
      : game.touch
        ? 'ציירו באוויר · בחרו מה מציירים (אפשר כמה ביחד) · האגודל ממשיך לרוץ'
        : 'ציירו באוויר · 1–5 או למעלה: מה מציירים (אפשר כמה ביחד) · WASD ממשיכים לרוץ · Q יוצרים';
    // (what was chosen and is not in the drawing yet: on a line of its own)
    this.noteEl.textContent = has && R && R.cat && R.note ? R.note : '';
    if (has && !PR && !PW && !PG) {
      if (!R || !R.cat) {
        this.nameEl.textContent = '…';
        this.statsEl.textContent = R && R.why ? R.why : 'עוד קצת';
      } else {
        this.nameEl.textContent = (this.force ? '✎ ' : '') + R.name;
        // (gear that needs its place: why it would not go here, before the ink is spent)
        const why = this.cannotMake(R);
        this.statsEl.textContent = why ? `⚠ ${why}` : `${statLine(R)} · ${cost} דיו`;
        this.nowhere = !!why;
      }
      // what else it could be (the network's next guesses), and the rest of the list
      const alts = R && R.alts ? R.alts.filter((a) => a.key !== (R.choice || null)).slice(0, 2) : [];
      this.altsEl.innerHTML = alts.map((a) => `<button class="fd-chip" data-k="${a.key}">${a.name}?</button>`).join('') + '<button class="fd-chip more" data-k="…">עוד…</button>';
    }
    const short = R && R.cat && cost > level;
    if (PR || PW) this.nowhere = false;
    else if (PG) this.nowhere = !!this.cannotMake(R);
    const nowhere = has && R && R.cat && this.nowhere;
    this.makeBtn.textContent = short ? 'אין מספיק דיו' : nowhere ? 'אין כאן מקום' : R && R.cat ? `✓ ${R.name}!` : PR ? 'עוד לא זז' : '✓ צרו!';
    this.makeBtn.classList.toggle('off', !R || !R.cat || short || nowhere);
    if (this.carOpen) {
      this.makeBtn.textContent = '▶ לנסוע';
      this.makeBtn.classList.remove('off');
    }
    if (ink) {
      this.inkFill.style.width = `${clamp((level / ink.cap) * 100, 0, 100)}%`;
      const c = Math.min(cost, level);
      this.inkCost.style.width = `${clamp((c / ink.cap) * 100, 0, 100)}%`;
      this.inkCost.style.right = `${clamp(((level - c) / ink.cap) * 100, 0, 100)}%`;
      this.inkCost.classList.toggle('over', !!short);
    }
    if (has && !PR && !PW && !PG) this.place();
  }

  // the tag by the drawing: over it, or under it when there is no room (never under the tools,
  // or the bar of what is drawn - at the top, or at the bottom on a phone)
  place() {
    const b = this.bounds();
    if (!b) return;
    const tag = this.tagEl;
    const w = tag.offsetWidth;
    const h = tag.offsetHeight;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const tr = this.toolsEl.getBoundingClientRect();
    const cr = this.catsEl.getBoundingClientRect();
    const top = cr.height && cr.top < H / 2 ? cr.bottom + 6 : 8;
    const bottom = cr.height && cr.top >= H / 2 ? cr.top - 8 : H - 8;
    const right = this.game.touch ? tr.left - 8 : W - 8;
    let x = clamp(b.x0, 8, Math.max(8, right - w));
    let y = b.y0 - h - 14;
    if (y < top) y = Math.min(b.y1 + 14, bottom - h);
    if (!this.game.touch) y = Math.min(y, tr.top - h - 8);
    tag.style.transform = `translate(${Math.round(x)}px, ${Math.round(Math.max(top, y))}px)`;
  }

  // the drawing's box on the screen (px)
  bounds() {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const s of this.strokes) {
      for (const [x, y] of s.p) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
    if (!(x1 >= x0)) return null;
    const U = this.U;
    return { x0: x0 * U, x1: x1 * U, y0: y0 * U, y1: y1 * U };
  }

  // one line in the air (g: in the drawing's units): a pale edge round it, so it shows over any
  // street, then its ink
  line(g, s) {
    const U = this.U;
    const ink = INKS[s.c] || INKS[0];
    const w = (ink.pencil ? 3.2 : 4) / U;
    g.beginPath();
    s.p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    if (s.p.length === 1) g.lineTo(s.p[0][0] + 0.001, s.p[0][1]);
    g.strokeStyle = ink.css === '#f4efe4' ? 'rgba(40, 36, 48, 0.75)' : 'rgba(255, 252, 244, 0.82)';
    g.lineWidth = w + 3.4 / U;
    g.globalAlpha = 1;
    g.stroke();
    g.strokeStyle = ink.css;
    g.lineWidth = w;
    if (ink.neon) {
      g.shadowColor = ink.css;
      g.shadowBlur = 12 * (this.dpr || 1);
    }
    g.stroke();
    g.shadowBlur = 0;
  }

  // the lines already drawn, on a picture of their own: as the pen moves only its own line is
  // drawn again (the neon's glow is slow to draw, and a phone draws the game at the same time)
  bake() {
    if (!this.baked) this.baked = document.createElement('canvas');
    const b = this.baked;
    b.width = this.cv.width;
    b.height = this.cv.height;
    const g = b.getContext('2d');
    const U = this.U;
    const dpr = this.dpr || 1;
    g.setTransform(dpr * U, 0, 0, dpr * U, 0, 0);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const s of this.strokes) if (!s.morph) this.line(g, s);
  }

  render() {
    const g = this.g;
    const dpr = this.dpr || 1;
    const U = this.U;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.cv.width, this.cv.height);
    if (!this.baked || this.baked.width !== this.cv.width || this.baked.height !== this.cv.height) this.bake();
    g.drawImage(this.baked, 0, 0);
    g.setTransform(dpr * U, 0, 0, dpr * U, 0, 0);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // (ROADMAP 11.9) the lines turning into their steadied selves
    for (const s of this.strokes) {
      if (!s.morph) continue;
      const k = Math.min(1, s.morph.t / MORPH_T);
      const e = k * k * (3 - 2 * k);
      const { a, b } = s.morph;
      this.line(g, { p: a.map((q, i) => [q[0] + (b[i][0] - q[0]) * e, q[1] + (b[i][1] - q[1]) * e]), c: s.c });
    }
    if (this.cur) this.line(g, this.cur);
    // (ROADMAP 11.12) the engineer's work - the drawing turning into it, then a faint line of it - and
    // where its weight is, over what it stands on
    const PR = this.PR;
    if (PR && PR.eng && PR.eng.changes.length && PR.design.page && !this.cur) this.drawEng(g);
    // (ROADMAP 11.15) what the engineer offers, faint - and what the game added, dashed
    if (PR && PR.design.page && !this.cur) this.drawOffers(g);
    if (PR && PR.ok && PR.spec.com && PR.design.page && !this.cur) this.drawCom(g);
    // (the parts' names: faint while a line is drawn)
    this.partsEl.classList.toggle('drawing', !!this.cur);
    // which way it points (its muzzle, its tip, its nose)
    const R = this.PR ? { cat: 'vehicle', mirror: !!(this.P && this.P.flip) } : this.R;
    if (R && R.cat && !this.cur) {
      const b = this.bounds();
      const x0 = b.x0 / U;
      const x1 = b.x1 / U;
      const y0 = b.y0 / U;
      const y1 = b.y1 / U;
      let dirX;
      if (R.cat === 'vehicle') dirX = R.mirror ? -1 : 1;
      else if (R.theta) dirX = 0;
      else dirX = R.front;
      if (dirX) {
        const y = R.cat === 'vehicle' ? y1 + 0.05 : (y0 + y1) / 2;
        const x = dirX > 0 ? x1 + 0.03 : x0 - 0.03;
        const l = 0.05;
        const arrow = (style, w) => {
          g.strokeStyle = style;
          g.lineWidth = w / U;
          g.beginPath();
          if (R.cat === 'vehicle') {
            const cx = (x0 + x1) / 2;
            g.moveTo(cx - dirX * 0.06, y);
            g.lineTo(cx + dirX * 0.06, y);
            g.moveTo(cx + dirX * 0.06 - dirX * 0.025, y - 0.02);
            g.lineTo(cx + dirX * 0.06, y);
            g.lineTo(cx + dirX * 0.06 - dirX * 0.025, y + 0.02);
          } else {
            g.moveTo(x, y);
            g.lineTo(x + dirX * l, y);
            g.moveTo(x + dirX * l - dirX * 0.02, y - 0.018);
            g.lineTo(x + dirX * l, y);
            g.lineTo(x + dirX * l - dirX * 0.02, y + 0.018);
          }
          g.stroke();
        };
        arrow('rgba(255, 252, 244, 0.85)', 6);
        arrow('#e2335f', 3);
      }
    }
  }

  // (ROADMAP 11.12) what the engineer did, on the drawing: each line it moved, from where it was
  // drawn to where it is now (ENG_T), then a faint dashed line of where it is
  drawEng(g) {
    const page = this.PR.design.page;
    const U = this.U;
    const k = this.engMorph ? Math.min(1, this.engMorph.t / ENG_T) : 1;
    const e = k * k * (3 - 2 * k);
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.setLineDash([7 / U, 5 / U]);
    g.lineWidth = 2.6 / U;
    g.strokeStyle = `rgba(43, 125, 224, ${(0.9 - 0.55 * e).toFixed(3)})`;
    for (const c of this.PR.eng.changes) {
      let a = c.from;
      let b = c.to;
      if (a.length !== b.length) {
        a = resample(a, 40);
        b = resample(b, 40);
      }
      g.beginPath();
      for (let i = 0; i < b.length; i++) {
        const [x, y] = toPage(page, [a[i][0] + (b[i][0] - a[i][0]) * e, a[i][1] + (b[i][1] - a[i][1]) * e]);
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
    }
    g.restore();
  }

  // (ROADMAP 11.15) on the drawing, before it is taken: where each line the engineer offers to move
  // would be (faint, green, dotted), the lines it would add; and each part the game added (dashed,
  // orange) - nothing it does that is not drawn on the drawing
  drawOffers(g) {
    const PR = this.PR;
    const page = PR.design.page;
    const U = this.U;
    const path = (pts) => {
      g.beginPath();
      pts.forEach((p, i) => {
        const [x, y] = toPage(page, p);
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      });
      g.stroke();
    };
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = 2.4 / U;
    g.setLineDash([2.5 / U, 5 / U]);
    g.strokeStyle = 'rgba(27, 158, 85, 0.75)';
    for (const q of PR.sugg || []) {
      if (this.engOn.has(q.k)) continue;
      for (const c of PR.all.changes || []) if (q.srcs.has(c.src)) path(c.to);
      for (const a of q.added) path(a);
    }
    g.setLineDash([6 / U, 4 / U]);
    g.strokeStyle = 'rgba(232, 128, 30, 0.85)';
    for (const s of PR.design.strokes) if (s.implicit && !s.edge) path(s.pts.length > 2 ? s.pts.concat([s.pts[0]]) : s.pts);
    g.restore();
  }

  // (ROADMAP 11.12) where its weight is - the old sign for it, a circle in quarters - a plumb line from
  // it to the ground, and on the ground what it stands on, its first wheel to its last: green, its
  // weight between them; red, not
  drawCom(g) {
    const { spec, design } = this.PR;
    const page = design.page;
    const U = this.U;
    const [x, y] = toPage(page, spec.com);
    const r = 7 / U;
    const bad = (spec.balance !== undefined && (spec.balance < 0.14 || spec.balance > 0.86)) || !!spec.lean || !!spec.pitchy || !!(spec.handling && spec.handling.tipA);
    const col = bad ? '#e2335f' : '#1b9e55';
    g.save();
    const W = spec.wheels || [];
    if (W.length && !spec.upside) {
      const gy = toPage(page, [0, Math.min(...W.map((w) => w.y - w.r))])[1];
      const xs = W.map((w) => toPage(page, [w.z, 0])[0]);
      g.lineWidth = 2 / U;
      g.strokeStyle = col;
      g.setLineDash([4 / U, 4 / U]);
      g.beginPath();
      g.moveTo(x, y + r);
      g.lineTo(x, gy);
      g.stroke();
      g.setLineDash([]);
      if (xs.length > 1) {
        g.lineWidth = 4 / U;
        g.globalAlpha = 0.75;
        g.beginPath();
        g.moveTo(Math.min(...xs), gy + 4 / U);
        g.lineTo(Math.max(...xs), gy + 4 / U);
        g.stroke();
        g.globalAlpha = 1;
      }
    }
    g.lineWidth = 2 / U;
    g.fillStyle = '#fffdf6';
    g.strokeStyle = col;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = col;
    for (const a0 of [0, Math.PI]) {
      g.beginPath();
      g.moveTo(x, y);
      g.arc(x, y, r, a0, a0 + Math.PI / 2);
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  // ------------------------------------------------------------------ making it
  make() {
    const game = this.game;
    if (this.cur) this.penUp();
    const R = !this.strokes.length ? null : this.game.lab && this.PR ? this.partsR() : this.game.lab && this.PW ? this.handR() : this.readNow();
    const shake = (why) => {
      this.stats.failed++;
      this.tagEl.classList.remove('shake');
      void this.tagEl.offsetWidth;
      this.tagEl.classList.add('shake');
      if (why) game.hud.toast(why, 'bad', 2.4);
      game.audio.play('meh', 0.5);
    };
    if (!R || !R.cat) {
      shake(!this.strokes.length ? 'עוד לא צויר כלום — ציירו נשק, רכב או ציוד' : R && R.why ? R.why : 'זה עוד לא נראה כמו כלום — עוד כמה קווים');
      return;
    }
    const p = game.player;
    if (p.inVehicle || p.mode !== 'foot') return;
    const ink = game.ink;
    if (ink && ink.level < R.cost) {
      shake(`אין מספיק דיו (צריך ${R.cost}) — הדיו חוזר לאט, או בקבוק מחנות כלי כתיבה`);
      if (ink.el) {
        ink.el.classList.remove('flash');
        void ink.el.offsetWidth;
        ink.el.classList.add('flash');
      }
      return;
    }
    // (gear put up somewhere - a ladder, a ramp, a bridge, a spring - needs its place here: said
    // before any ink is spent)
    const why = this.cannotMake(R);
    if (why) {
      shake(why);
      return;
    }
    const where = this.drawnAt();
    let ok;
    if (R.cat === 'vehicle') ok = this.makeVehicle(R);
    else if (R.cat === 'gear') ok = this.makeGear(R, where);
    else {
      ok = this.makeWeapon(R, where);
      // (drawn with gear: that too - a shield in the other hand, a parachute on the back...)
      if (ok && R.extra) this.makeExtra(R.extra, where);
    }
    if (!ok) return;
    if (ink) ink.spend(R.cost);
    // (ROADMAP 11.15) parts that work together, made for the first time: found - a reward
    this.foundNew(R.cat === 'vehicle' && R.spec ? R.spec.combos : R.def ? R.def.combos : null);
    this.stats.made[R.kind] = (this.stats.made[R.kind] || 0) + 1;
    if (game.skills) game.skills.add('draw', 1);
    game.goalFlags.drew = true;
    if (R.cat === 'vehicle') {
      game.goalFlags.car = true;
      if (R.spec.cannon || R.spec.base === 'copter') game.goalFlags.heavyDrawn = true;
    }
    game.updateGoals();
    this.flyAway();
    this.strokes = [];
    this.force = null;
    this.R = null;
    this.over = {};
    this.face = null;
    this.P = null;
    this.PR = null;
    this.PW = null;
    this.PG = null;
    this.cardDirty = true;
    this.bake();
    this.close();
    this.info();
  }

  // (ROADMAP 11.15) each of what its parts do together (game/combos.js) made for the first time:
  // money for it, and said
  foundNew(list) {
    const game = this.game;
    const fresh = (list || []).filter((k) => !this.found.has(k));
    if (!fresh.length) return;
    let n = 0;
    for (const k of fresh) {
      this.found.add(k);
      n += comboReward(k);
    }
    if (game.money) game.money.earn(n, 'שילוב חדש');
    game.hud.toast(`🏆 שילוב חדש: ${fresh.map(comboName).join(', ')}! +${fmt(n)}`, 'good', 3.6);
    game.audio.play('cheer', 0.5);
  }

  // where the drawing is on the screen: its middle (px) and its size (px)
  drawnAt() {
    const b = this.bounds() || { x0: 0, x1: 10, y0: 0, y1: 10 };
    return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, w: Math.max(10, b.x1 - b.x0), h: Math.max(10, b.y1 - b.y0) };
  }

  // the screen's axes in the street: its right (level), into it (level), and the turn that shows a
  // thing side on with its front to the right (face 1) or the left (-1)
  sideOn(face) {
    const cam = this.game.camera;
    const an = new THREE.Vector3();
    cam.getWorldDirection(an);
    an.y = 0;
    if (an.lengthSq() < 1e-6) an.set(0, 0, -1);
    an.normalize();
    const ax = new THREE.Vector3().crossVectors(an, UP).normalize();
    const z = ax.clone().multiplyScalar(face);
    const x = new THREE.Vector3().crossVectors(UP, z);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, UP, z));
    return { an, ax, q, yaw: Math.atan2(z.x, z.z) };
  }

  makeWeapon(R, where) {
    const game = this.game;
    const W = game.weapons;
    const m = buildWeapon(R);
    const def = R.def;
    W.add(def, 'good', m, undefined);
    const slot = W.current;
    // (the HUD's picture of it, and the drawing again for a save: game/save.js)
    slot.strokes = this.strokes.map((s) => s.p);
    slot.free = { s: this.strokes.map((s) => ({ p: s.p, c: s.c })), force: R.decided || this.force, cats: [...this.cats] };
    // (ROADMAP 11.11: made of parts - read so again when loaded, with what the player said of each)
    if (R.parts) {
      slot.free.parts = true;
      if (Object.keys(this.over).length) slot.free.over = { ...this.over };
    }
    // it hangs in the air where it was drawn, beside you, as it turns real; then into the hand
    const cam = game.camera;
    const D = 2.3;
    const ndc = _v.set((where.x / window.innerWidth) * 2 - 1, -(where.y / window.innerHeight) * 2 + 1, 0.5).unproject(cam);
    const dir = ndc.sub(cam.position).normalize();
    const C = cam.position.clone().addScaledVector(dir, D);
    const perPx = (2 * D * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) / window.innerHeight;
    const box = localBox(m.group);
    const size = box.getSize(new THREE.Vector3());
    const so = this.sideOn(R.theta ? 1 : R.front);
    const sc = clamp((Math.max(where.w, where.h * 0.6) * perPx) / Math.max(0.05, size.z), 0.3, 5);
    const centre = box.getCenter(new THREE.Vector3()).multiplyScalar(sc).applyQuaternion(so.q);
    const frame = makeFrame(cam, C.sub(centre), so.q, sc, box);
    slot.present = { matrix: frame.matrix.clone(), k: 0 };
    const follow = new THREE.Vector3();
    this.presenting = { slot, base: frame.matrix.clone(), follow, from: game.player.pos.clone() };
    const say = `${def.name}! ${R.say || statLine(R)}`;
    game.materialize.begin({ frame, root: m.group, held: slot, follow, onReal: () => game.hud.toast(say, 'good', 2.6) });
    game.hud.updateWeapon();
    return true;
  }

  makeVehicle(R) {
    const game = this.game;
    const V = game.vehicles;
    const v = spawnDrawn(game, R.design, 0, 0, 0, false);
    if (!v) return false;
    const so = this.sideOn(R.mirror ? -1 : 1);
    v.group.position.set(0, 0, 0);
    v.group.rotation.set(0, 0, 0);
    v.group.updateMatrixWorld(true);
    // (ROADMAP 11.14, the sample: one that floats and flies with no wheels - a flying boat, on its
    // hull: it waits on the water, where it takes off from, not stranded on the sand)
    const M = v.modes || {};
    if (game.lab && v.kind !== 'boat' && M.boat && !M.drive && !M.copter && !M.balloon) setMode(v, 'boat', true);
    const box = localBox(v.group);
    const spot = findSpot(game, v, so, box);
    const boat = v.kind === 'boat';
    if (spot) v.pos.set(spot.x, v.flies ? 0 : boat ? -0.8 - (v.draft || 0) : groundHeight(spot.x, spot.z) * 0.5, spot.z);
    else if (boat) {
      // (drawn away from the water: it waits in the bay, by the beach nearest you - ROADMAP 11.8)
      const p = game.player.pos;
      const w = waterSpot(p.x, p.z, v.halfWid || 1) || { x: 116, z: Math.max(-380, Math.min(300, p.z)) };
      v.pos.set(w.x, -0.8 - (v.draft || 0), w.z);
      if (Math.hypot(w.x - p.x, w.z - p.z) > 15) this.farBoat = true;
    } else V.placeNear(v);
    v.yaw = so.yaw;
    if (v.kind === 'copter') v.pos.y = Math.max(0, groundHeight(v.pos.x, v.pos.z)) + v.alt - 1.0;
    if (v.kind === 'balloon') v.pos.y = Math.max(0, groundHeight(v.pos.x, v.pos.z));
    V.add(v);
    const frame = makeFrame(game.camera, v.pos, so.q, 1, box);
    const getIn = game.touch ? 'כפתור הרכב הירוק — לעלות' : 'E — לעלות';
    const say = this.farBoat ? `${v.label} מחכה לכם במים, ליד החוף` : `${v.label}! ${getIn}`;
    this.farBoat = false;
    game.materialize.begin({ frame, root: v.group, vehicle: v, onReal: () => game.hud.toast(say, 'good', 3) });
    v.strokes = this.strokes.map((s) => s.p);
    return true;
  }

  // (ROADMAP 11.8) why what is drawn cannot be made here (a ladder needs a wall, a ramp the road...)
  cannotMake(R) {
    const G = this.game.gadgets;
    const g = R.cat === 'gear' ? R : R.extra && R.extra.cat === 'gear' ? R.extra : null;
    if (!G || !g || !g.place) return null;
    return G.cannot(g.kind, g.params);
  }

  // gear: a parachute onto your back, an umbrella or a key into your hands; a ladder, a ramp, a
  // bridge, a spring put up where it goes from here (game/gadgets.js)
  makeGear(R, where) {
    const game = this.game;
    const G = game.gadgets;
    const k = R.kind;
    if (k === 'parachute') {
      return this.toHero(canopyModel(R.grade, R.colors), where, 'back', () => {
        game.player.parachute = { grade: R.grade, colours: R.colors.length ? R.colors : null };
        game.hud.toast(game.touch ? 'יש לכם מצנח! בקפיצה מגובה הוא נפתח לבד, או בכפתור הקפיצה' : 'יש לכם מצנח! בקפיצה מגובה הוא נפתח לבד, או ברווח', 'good', 3.6);
        game.audio.play('cheer', 0.6);
      });
    }
    if (!G) return false;
    if (k === 'umbrella' || k === 'key') {
      const colour = k === 'umbrella' && R.colors.length ? R.colors[0] : null;
      return this.toHero(G.model(k, R.grade, null, colour).group, where, 'chest', () => G.take(k, R.grade, colour));
    }
    const sp = G.spot(k, R.params);
    if (!sp.ok) {
      game.hud.toast(sp.why, 'bad', 3);
      return false;
    }
    const m = G.model(k, R.grade, sp);
    const frame = makeFrame(game.camera, m.O, m.q, 1, localBox(m.group));
    m.group.matrix.copy(frame.matrix);
    m.group.matrixWorldNeedsUpdate = true;
    game.scene.add(m.group);
    const say = `${R.name}! ${R.line}`;
    game.materialize.begin({ frame, root: m.group, onReal: () => game.hud.toast(say, 'good', 2.8) });
    G.place(k, R.grade, sp, m.group);
    return true;
  }

  // what came with a weapon: a shield into the other hand; other gear as gear is made
  makeExtra(E, where) {
    const game = this.game;
    if (E.cat === 'weapon' && E.kind === 'shield') {
      const free = { s: E.strokes.map((s) => ({ p: s.p, c: s.c })), force: 'g:shield', cats: ['gear'] };
      game.weapons.setOff(E.def, 'good', buildWeapon(E), free);
      game.hud.toast(`ו${E.def.name} ביד השנייה: חוסם ${Math.round(E.def.block * 100)}% מפגיעה מלפנים`, 'good', 3);
      return true;
    }
    if (E.cat === 'gear') return this.makeGear(E, where);
    return false;
  }

  // a thing that hangs in the air where it was drawn, as big, turns real and flies to you (onto
  // your back, into your hands), then: then
  toHero(root, where, to, then) {
    const game = this.game;
    const cam = game.camera;
    const D = 2.3;
    const ndc = _v.set((where.x / window.innerWidth) * 2 - 1, -(where.y / window.innerHeight) * 2 + 1, 0.5).unproject(cam);
    const dir = ndc.sub(cam.position).normalize();
    const C = cam.position.clone().addScaledVector(dir, D);
    const perPx = (2 * D * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) / window.innerHeight;
    root.updateMatrixWorld(true);
    const box = localBox(root);
    const size = box.getSize(new THREE.Vector3());
    const so = this.sideOn(1);
    const sc = clamp((Math.max(where.w, where.h) * perPx) / Math.max(0.05, size.x, size.y, size.z), 0.2, 5);
    const centre = box.getCenter(new THREE.Vector3()).multiplyScalar(sc).applyQuaternion(so.q);
    const frame = makeFrame(cam, C.sub(centre), so.q, sc, box);
    root.matrixAutoUpdate = false;
    root.matrix.copy(frame.matrix);
    root.matrixWorldNeedsUpdate = true;
    game.scene.add(root);
    game.materialize.begin({ frame, root, toHero: to, onArrive: then });
    return true;
  }

  // the drawing in the air gives way to the thing (a copy of it, fading as it swells a little)
  flyAway() {
    try {
      const c = document.createElement('canvas');
      c.width = this.cv.width;
      c.height = this.cv.height;
      c.getContext('2d').drawImage(this.cv, 0, 0);
      c.className = 'fd-fly';
      document.body.appendChild(c);
      requestAnimationFrame(() => {
        c.style.transform = 'scale(1.04)';
        c.style.opacity = '0';
      });
      setTimeout(() => c.remove(), 700);
    } catch (err) {
      // (no copy: no matter)
    }
  }

  // a drawn vehicle got into (game/game.js enterVehicle): how it goes, the first time
  // (ROADMAP 11.8: told once for each kind of thing - a boat, a balloon, one that flies and drives...)
  onEnter(v) {
    const game = this.game;
    const s = v.spec;
    if (!s) return;
    const key = `${s.kind}:${v.hybrid ? Object.keys(v.modes || {}).filter((k) => v.modes[k]).join('') : ''}:${v.turret ? v.gunType : ''}:${v.turrets ? v.turrets.length : 0}:${v.paraP ? 'p' : ''}:${v.ram ? 'r' : ''}:${(s.tracks || []).length ? 't' : ''}${s.hover ? 'h' : ''}${v.bumper ? 'b' : ''}${v.blades ? 'x' : ''}${v.roofDrive ? 'u' : ''}${s.spring && s.spring.kick ? 'k' : ''}${(s.guns || []).some((gn) => gn.giant) ? 'g' : ''}${v.combos ? v.combos.join('') : ''}`;
    this.toldRides = this.toldRides || new Set();
    if (this.toldRides.has(key)) return;
    this.toldRides.add(key);
    const t = game.touch;
    const M = v.modes || {};
    const tips = [];
    if (v.canLift) tips.push(M.plane && !M.copter && !M.balloon ? (t ? 'במהירות, ▲: להמריא' : 'במהירות, רווח: להמריא') : t ? '▲: להמריא · ▼ עד למטה: לנחות' : 'רווח: להמריא · C עד למטה: לנחות');
    else if (s.base === 'balloon') tips.push(t ? '▲: המבער, למעלה · ▼: למטה · הרוח לוקחת אותו' : 'רווח: המבער, למעלה · C: למטה · הרוח לוקחת אותו');
    else if (s.base === 'copter') tips.push(t ? 'כפתורי ▲▼: גובה' : 'רווח ו־C: למעלה ולמטה');
    else if (s.base === 'plane') tips.push(t ? `${game.settings.get('touchDrive') !== 'stick' ? 'גז' : 'קדימה'}: מצערת · צריך כביש ארוך להמראה` : 'W: מצערת · צריך כביש ארוך, ואז רווח: האף למעלה');
    if (M.drive && M.boat) tips.push('נוסעים ישר לתוך המים ושטים, ועולים לחוף');
    if (v.dive) tips.push(t ? '▼: לצלול, אף אחד לא רואה אתכם · ▲: לעלות' : 'C: לצלול, אף אחד לא רואה אתכם · רווח: לעלות');
    if (v.spring && !v.canLift) tips.push(s.kind === 'skate' ? (t ? '▲: קפיצה' : 'רווח: קפיצה') : t ? '▲: קפיצה על הקפיץ' : 'רווח: קפיצה על הקפיץ');
    if (v.chute) tips.push('המצנח: נוחת לאט מכל גובה');
    if (v.armor) tips.push('משוריין: פגיעות כואבות לו פחות');
    // (ROADMAP 11.10: made of parts - each barrel fires; its parachute opens when you say)
    if (v.turrets && v.turrets.length > 1) tips.push(t ? `ירי: כל ${v.turrets.length} הקנים` : `קליק (להחזיק): יורים מכל ${v.turrets.length} הקנים`);
    else if (v.turret) tips.push(v.gunType === 'mg' ? (t ? 'ירי: המקלע' : 'קליק (להחזיק): המקלע') : t ? 'ירי: התותח' : 'קליק: התותח');
    else if (s.base === 'copter') tips.push(t ? 'ירי: מטוסי נייר' : 'קליק: מטוסי נייר');
    if (v.paraP) tips.unshift(t ? 'באוויר, כפתור המצנח: הוא נפתח' : 'באוויר, G: המצנח נפתח');
    if (v.ram) tips.push('הלהב מקדימה: ניגוח');
    // (ROADMAP 11.12: what its parts are where they are)
    if ((s.tracks || []).length) tips.unshift('זחלים: מסתובב במקום ודורס מכוניות בדרך');
    if (s.hover) tips.unshift('רחפת: עוברת מהכביש למים בלי לעצור — ומחליקה בפניות');
    if (s.spring && s.spring.kick) tips.push(t ? '▲: זינוק קדימה' : 'רווח: זינוק קדימה');
    if (v.bumper) tips.push('פגוש הקפיץ: מעיף את מי שנתקלים בו');
    if (v.blades && v.blades.side) tips.push('להבי הצד: מי שעוברים לידו נחתך');
    if ((s.guns || []).some((gn) => gn.giant)) tips.push('התותח הענק: כל ירייה הודפת אחורה');
    if (v.roofDrive) tips.push('גלגלי הגג: אם מתהפכים — ממשיכים לנסוע');
    else if (s.handling && s.handling.tipA) tips.push(t ? 'גבוה וצר — בפנייה חדה מתהפך. ▲: להפוך בחזרה' : 'גבוה וצר — בפנייה חדה מתהפך. רווח: להפוך בחזרה');
    // (a phone: its turbo button over the gas - or the stick all the way, with the stick in the settings)
    if (s.jets.length && s.base === 'car') tips.push(!t ? 'Shift: טורבו מהסילון' : game.settings.get('touchDrive') !== 'stick' ? 'טורבו מהסילון: הכפתור מעל הגז' : 'ג׳ויסטיק עד הסוף: טורבו');
    // (ROADMAP 11.15: what its parts do together - first of all)
    if (v.stomp) tips.unshift(t ? 'נחיתה מועכת: ▲ לקפוץ — והנחיתה הודפת את מי שסביב' : 'נחיתה מועכת: רווח לקפוץ — והנחיתה הודפת את מי שסביב');
    if (v.combos) tips.unshift('🏆 ' + v.combos.map(comboName).join(' · '));
    else if (s.glide && !v.canLift) tips.push('הכנפיים: אחרי קפיצה מרמפה הוא גולש');
    if (tips.length) game.hud.toast(tips.slice(0, 3).join(' · '), 'info', 4);
  }

  // ------------------------------------------------------------------ each frame
  update(dt) {
    const game = this.game;
    const p = game.player;
    // (a weapon drawn on the run: it goes along with you while it turns real)
    const pr = this.presenting;
    if (pr) {
      if (!pr.slot.present) this.presenting = null;
      else {
        pr.follow.copy(p.pos).sub(pr.from);
        pr.slot.present.matrix.copy(pr.base).premultiply(_m.makeTranslation(pr.follow.x, pr.follow.y, pr.follow.z));
      }
    }
    // (the jets' flames on a drawn one you ride)
    const v = p.inVehicle;
    if (v && v.drawn) jetFlames(game, v, dt);
    if (!this.isOpen) return;
    if (this.autoShut && performance.now() > this.autoShut) {
      this.autoShut = 0;
      if (!this.cur && !this.strokes.length) {
        this.close();
        return;
      }
    }
    if (this.carOpen) {
      const left = this.autoShut && !this.cur ? clamp((this.autoShut - performance.now()) / (this.autoShutLen || 3800), 0, 1) : 1;
      if (Math.abs(left - (this.goLeft ?? -1)) > 0.004) {
        this.goLeft = left;
        this.makeBtn.style.setProperty('--left', left.toFixed(3));
        this.makeBtn.classList.toggle('timing', left < 1);
      }
    }
    // (ROADMAP 11.9) the lines turning: on with it, and onto the page when done
    let turning = false;
    let done = false;
    for (const s of this.strokes) {
      if (!s.morph) continue;
      s.morph.t += dt;
      turning = true;
      if (s.morph.t >= MORPH_T) {
        s.morph = null;
        done = true;
      }
    }
    if (done) this.bake();
    // (ROADMAP 11.12) the drawing turning into what the engineer made of it
    if (this.engMorph) {
      this.engMorph.t += dt;
      if (this.engMorph.t >= ENG_T) this.engMorph = null;
      turning = true;
    }
    if (turning) this.render();
    // (ROADMAP 11.10) the model by the drawing, turning
    if (this.view && ((this.PR && this.PR.ok) || this.PW || this.PG)) this.view.frame(dt);
    // not on foot any more (in a car, swimming, down...), or the game stopped: the pen goes
    const inCar = !!(game.fuse && p.inVehicle && p.mode === 'vehicle');
    if ((p.mode !== 'foot' && !inCar) || (p.inVehicle && !inCar) || game.state !== 'play' || (game.dialog && game.dialog.open)) {
      this.close();
      return;
    }
    // the camera turns after where you run (the mouse is drawing; in a car it follows the car)
    const vx = p.vel.x;
    const vz = p.vel.z;
    if (!inCar && Math.hypot(vx, vz) > 1.2) {
      const d = angleDiff(game.camRig.yaw, Math.atan2(vx, vz));
      if (Math.abs(d) < 2.3) game.camRig.yaw += d * (1 - Math.exp(-1.7 * dt));
    }
    if (!inCar) game.camRig.pitch += (-0.12 - game.camRig.pitch) * (1 - Math.exp(-2 * dt));
    // (the ink bar moves while it fills back up; the drawing is not read again for it)
    if (game.ink && Math.floor(game.time * 4) !== this.inkTick) {
      this.inkTick = Math.floor(game.time * 4);
      this.info();
    }
  }

  // ------------------------------------------------------------------ the save (game/save.js)
  save() {
    return { s: this.strokes.map((s) => ({ p: s.p, c: s.c, r: s.raw || undefined, k: s.k || undefined })), ink: this.ink, cats: [...this.cats], over: Object.keys(this.over).length ? this.over : undefined, face: this.face === null ? undefined : this.face, eng: this.engLevel, engOn: this.engOn.size ? [...this.engOn] : undefined, look: this.look, lookV: this.game.lab ? 2 : undefined, noImp: this.noImp.size ? [...this.noImp] : undefined, found: this.found.size ? [...this.found] : undefined };
  }

  load(o) {
    if (!o) return;
    this.strokes = Array.isArray(o.s) ? o.s.filter((s) => Array.isArray(s.p) && s.p.length).map((s) => ({ p: s.p, c: Number.isInteger(s.c) && INKS[s.c] ? s.c : 0, raw: Array.isArray(s.r) && s.r.length ? s.r : undefined, k: typeof s.k === 'string' ? s.k : undefined })) : [];
    if (Number.isInteger(o.ink) && INKS[o.ink]) this.pickInk(o.ink);
    this.cats = new Set(Array.isArray(o.cats) ? o.cats.filter((c) => CATEGORY_ORDER.includes(c)) : []);
    this.over = {};
    if (o.over && typeof o.over === 'object') for (const [k, t] of Object.entries(o.over)) if (PART[t] && +k < this.strokes.length) this.over[+k] = t;
    this.face = typeof o.face === 'boolean' ? o.face : null;
    // (ROADMAP 11.15: one saved engineered - the hand's slips put right, and all it offered taken)
    this.engLevel = o.eng === 'raw' ? 'raw' : 'tidy';
    this.engOn = new Set(Array.isArray(o.engOn) ? o.engOn.filter((k) => EN_STEPS.includes(k)) : o.eng === 'eng' || o.eng === undefined ? EN_STEPS : []);
    // (ROADMAP 11.20: polished by default now - a choice saved after it stays)
    if (this.game.lab) this.look = o.lookV === 2 && LOOKS.some(([k]) => k === o.look) ? o.look : 'polished';
    else this.look = LOOKS.some(([k]) => k === o.look) ? o.look : o.look === undefined && o.eng !== undefined ? 'polished' : 'faithful';
    this.noImp = new Set(Array.isArray(o.noImp) ? o.noImp.filter((t) => PART[t]) : []);
    this.found = new Set(Array.isArray(o.found) ? o.found.filter((k) => typeof k === 'string') : []);
    this.showCats();
  }
}
