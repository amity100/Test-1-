import { tr } from '../core/lang.js';

// (ROADMAP 29.5) The ring's screen (game/boxing.js): both names, the health (what was just lost still showing a moment, then
// draining) and the stamina, the round and its clock, the knockdowns; the round called, the counter and the knockdown said,
// the count on the canvas a number a second, the taps to get up; the cards between the rounds and at the end; the coach's
// call at the mitts and how it came. Dark glass and a gold hairline, heavy narrow letters - the look of the find card
// (game/finds.js); its styles are css/boxing.css. Written to only when something on it changes.

const $ = (tag, cls, parent, text) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  if (parent) parent.appendChild(el);
  return el;
};

export class BoxingHud {
  constructor(game) {
    this.game = game;
    const root = $('div', 'bxh hidden', document.body);
    root.id = 'boxhud';
    root.dir = 'ltr';
    this.root = root;
    const top = $('div', 'bxh-top', root);
    this.side = [this.fighter(top, 0), null, null];
    const mid = $('div', 'bxh-mid', top);
    this.roundEl = $('div', 'bxh-round', mid, 'R1');
    this.clockEl = $('div', 'bxh-clock', mid, '1:00');
    this.side[1] = this.fighter(top, 1);
    this.msg = $('div', 'bxh-msg', root);
    this.big = $('div', 'bxh-big', root);
    this.bigT = $('div', 'bxh-big-t', this.big);
    this.bigS = $('div', 'bxh-big-s', this.big);
    this.countEl = $('div', 'bxh-count', root);
    this.upEl = $('div', 'bxh-up hidden', root);
    this.upTxt = $('div', 'bxh-up-t', this.upEl, tr('קומו! לחצו שוב ושוב', 'GET UP! Tap again and again'));
    this.upBar = $('div', 'bxh-up-bar', this.upEl);
    this.upFill = $('i', '', this.upBar);
    this.cardEl = $('div', 'bxh-card hidden', root);
    this.drillEl = $('div', 'bxh-drill hidden', root);
    this.dCall = $('div', 'bxh-d-call', this.drillEl);
    this.dRate = $('div', 'bxh-d-rate', this.drillEl);
    this.dNote = $('div', 'bxh-d-note', this.drillEl);
    this.dMeta = $('div', 'bxh-d-meta', this.drillEl);
    this.hurt = $('div', 'bxh-hurt', root);
    this.help = $('div', 'bxh-help hidden', root);
    this.last = {};
    this.trail = [1, 1];
    this.trailT = [0, 0];
    this.msgT = 0;
    this.bigTT = 0;
    this.countT = 0;
    this.hurtK = 0;
    this.helpT = 0;
  }

  fighter(top, i) {
    const el = $('div', `bxh-f bxh-f${i}`, top);
    const name = $('div', 'bxh-name', el);
    const hp = $('div', 'bxh-hp', el);
    const trail = $('i', 'bxh-trail', hp);
    const fill = $('i', 'bxh-fill', hp);
    const sta = $('div', 'bxh-sta', el);
    const sfill = $('i', '', sta);
    const kd = $('div', 'bxh-kd', el);
    return { el, name, hp, trail, fill, sta, sfill, kd };
  }

  show(o) {
    this.root.classList.remove('hidden');
    this.root.classList.toggle('bxh-train', o.mode !== 'bout');
    this.side[0].name.textContent = o.a || '';
    this.side[1].name.textContent = o.b || '';
    this.cardEl.classList.add('hidden');
    this.drillEl.classList.toggle('hidden', o.mode === 'bout');
    this.upEl.classList.add('hidden');
    this.last = {};
    this.trail = [1, 1];
    this.countEl.textContent = '';
    this.big.classList.remove('on');
    this.msg.classList.remove('on');
    this.mode = o.mode;
    // (how to fight, the first few seconds: the keys or the buttons)
    const keys = o.touch
      ? tr('ג׳אב · קרוס · הוק · אפרקאט — הכפתורים מימין · מגן: להחזיק · החלקה ימינה/שמאלה להתחמקות, למטה להתכופף · מקל אחורה + אגרוף: לגוף', 'JAB · CROSS · HOOK · UPPER — the buttons on the right · GUARD: hold · swipe left/right to slip, down to duck · stick back + punch: to the body')
      : tr('J ג׳אב · K קרוס · L הוק · I אפרקאט · Shift מגן · Q/E התחמקות · C התכופפות · אחורה + אגרוף: לגוף · Backspace — לצאת', 'J jab · K cross · L hook · I uppercut · Shift guard · Q/E slip · C duck · back + punch: to the body · Backspace — leave');
    this.help.textContent = keys;
    this.help.classList.remove('hidden');
    this.helpT = 7;
  }

  hide() {
    this.root.classList.add('hidden');
  }

  // every frame (only what changed is written)
  frame(X, rdt) {
    const b = X.bout;
    if (!b) return;
    const L = this.last;
    for (let i = 0; i < 2; i++) {
      const f = b.f[i];
      const S = this.side[i];
      const hp = Math.max(0, Math.round((f.hp / f.hpMax) * 200) / 200);
      const sta = Math.max(0, Math.round((f.sta / f.staMax) * 100) / 100);
      // (what was just lost: shown a moment, then it drains down to the health)
      if (hp < this.trail[i]) {
        if (this.trailT[i] <= 0) this.trailT[i] = 0.55;
      } else this.trail[i] = hp;
      if (this.trailT[i] > 0) {
        this.trailT[i] -= rdt;
        if (this.trailT[i] <= 0) this.trailT[i] = -1;
      } else if (this.trailT[i] < 0 && this.trail[i] > hp) {
        this.trail[i] = Math.max(hp, this.trail[i] - rdt * 0.5);
        if (this.trail[i] <= hp) this.trailT[i] = 0;
      }
      const tr2 = Math.round(this.trail[i] * 200) / 200;
      if (L['hp' + i] !== hp) {
        L['hp' + i] = hp;
        S.fill.style.transform = `scaleX(${hp})`;
        S.el.classList.toggle('low', hp < 0.25);
      }
      if (L['tr' + i] !== tr2) {
        L['tr' + i] = tr2;
        S.trail.style.transform = `scaleX(${tr2})`;
      }
      if (L['st' + i] !== sta) {
        L['st' + i] = sta;
        S.sfill.style.transform = `scaleX(${sta})`;
        S.sta.classList.toggle('low', sta < 0.3);
      }
      const kd = f.downsTotal;
      if (L['kd' + i] !== kd) {
        L['kd' + i] = kd;
        S.kd.textContent = '';
        for (let k = 0; k < f.downsTotal; k++) $('b', '', S.kd);
      }
    }
    // (the clock and the round: written as text only when the second or the round changes)
    const train = X.mode !== 'bout';
    const rest = b.phase === 'rest';
    const t = train ? -1 : rest ? Math.max(0, Math.ceil(b.restLen - b.phaseT)) : Math.max(0, Math.ceil(b.clock));
    const ck = t * 4 + (rest ? 1 : 0) + b.round * 1000;
    if (L.clock !== ck) {
      L.clock = ck;
      this.clockEl.textContent = train ? '' : rest ? String(t) : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
      this.roundEl.textContent = train ? '' : rest ? tr('הפסקה', 'REST') : tr(`סיבוב ${b.round}/${b.rounds}`, `ROUND ${b.round}/${b.rounds}`);
    }
    // the taps to get up (yours)
    const me = b.f[0];
    const down = b.phase === 'count' && b.downed === 0 && me.state === 'down';
    if (L.down !== down) {
      L.down = down;
      this.upEl.classList.toggle('hidden', !down);
    }
    if (down) {
      const k = Math.min(1, me.fill / Math.max(1, me.need));
      const q = Math.round(k * 50) / 50;
      if (L.fill !== q) {
        L.fill = q;
        this.upFill.style.transform = `scaleX(${q})`;
      }
    }
    // timers of what is said
    if (this.msgT > 0) {
      this.msgT -= rdt;
      if (this.msgT <= 0) this.msg.classList.remove('on');
    }
    if (this.bigTT > 0) {
      this.bigTT -= rdt;
      if (this.bigTT <= 0) this.big.classList.remove('on');
    }
    if (this.countT > 0) {
      this.countT -= rdt;
      if (this.countT <= 0) this.countEl.classList.remove('on');
    }
    if (this.helpT > 0) {
      this.helpT -= rdt;
      if (this.helpT <= 0) this.help.classList.add('hidden');
    }
    if (this.hurtK > 0) {
      this.hurtK = Math.max(0, this.hurtK - rdt * 3);
      const q = Math.round(this.hurtK * 20) / 20;
      if (L.hurt !== q) {
        L.hurt = q;
        this.hurt.style.opacity = String(q);
      }
    }
  }

  flashMsg(text, kind) {
    this.msg.textContent = text;
    this.msg.className = `bxh-msg on k-${kind}`;
    this.msgT = kind === 'slip' ? 0.6 : 1.2;
  }

  bigMsg(t, s = '') {
    this.bigT.textContent = t;
    this.bigS.textContent = s;
    this.big.classList.add('on');
    this.bigTT = 1.8;
  }

  count(n) {
    if (!n) {
      this.countEl.classList.remove('on');
      return;
    }
    this.countEl.textContent = String(n);
    this.countEl.classList.remove('on');
    // (the number again, a beat: restart its little blow-up)
    void this.countEl.offsetWidth;
    this.countEl.classList.add('on');
    this.countT = 0.95;
  }

  hurtFlash(k) {
    this.hurtK = Math.min(1, Math.max(this.hurtK, k));
  }

  // between the rounds: the judges' cards so far
  cards(cards) {
    const ta = cards.reduce((s, c) => s + c[0], 0);
    const tb = cards.reduce((s, c) => s + c[1], 0);
    this.cardEl.innerHTML = '';
    $('div', 'bxh-c-k', this.cardEl, tr('כרטיסי השופטים', 'THE CARDS'));
    const row = $('div', 'bxh-c-row', this.cardEl);
    cards.forEach((c, i) => $('span', '', row, `R${i + 1}  ${c[0]}–${c[1]}`));
    $('div', 'bxh-c-tot', this.cardEl, `${ta} – ${tb}`);
    this.cardEl.classList.remove('hidden');
    clearTimeout(this.cardTO);
    this.cardTO = setTimeout(() => this.cardEl.classList.add('hidden'), 5200);
  }

  result(r) {
    this.cardEl.innerHTML = '';
    const how = { KO: tr('נוקאאוט', 'KNOCKOUT'), TKO: tr('נוקאאוט טכני', 'TECHNICAL KNOCKOUT'), DEC: tr('הכרעת שופטים', 'DECISION'), DRAW: tr('תיקו', 'DRAW'), RET: tr('פרישה', 'RETIRED') }[r.how] || r.how;
    $('div', 'bxh-c-k', this.cardEl, how);
    $('div', 'bxh-c-win', this.cardEl, r.won ? tr('ניצחתם', 'YOU WIN') : r.draw ? tr('תיקו', 'A DRAW') : tr('הפסדתם', 'YOU LOSE'));
    const t = Math.round(r.time);
    if (r.how === 'KO' || r.how === 'TKO') $('div', 'bxh-c-sub', this.cardEl, tr(`סיבוב ${r.round}, ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, `Round ${r.round}, ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`));
    if (r.cards && r.cards.length) {
      const row = $('div', 'bxh-c-row', this.cardEl);
      r.cards.forEach((c, i) => $('span', '', row, `R${i + 1}  ${c[0]}–${c[1]}`));
    }
    const s = r.stats;
    if (s) {
      const g = $('div', 'bxh-c-stats', this.cardEl);
      const line = (k, a, b) => {
        const d = $('div', '', g);
        $('b', '', d, String(a));
        $('span', '', d, k);
        $('b', '', d, String(b));
      };
      line(tr('אגרופים שנחתו', 'LANDED'), `${s[0].landed}/${s[0].thrown}`, `${s[1].landed}/${s[1].thrown}`);
      line(tr('אגרופי כוח', 'POWER'), s[0].power, s[1].power);
      line(tr('מכות נגד', 'COUNTERS'), s[0].counters, s[1].counters);
      line(tr('נפילות', 'KNOCKDOWNS'), s[1].downs, s[0].downs);
    }
    this.cardEl.classList.remove('hidden');
    this.cardEl.classList.add('final');
    clearTimeout(this.cardTO);
  }

  // the gym's work: the call, how it came, how far through the set
  drill(o) {
    const el = this.drillEl;
    el.classList.remove('hidden');
    if (o.bag) {
      const secs = Math.ceil(o.t || 0);
      if (o.end) {
        this.dCall.textContent = o.bag === 'speedbag' ? tr('שק מהירות — סוף', 'SPEED BAG — DONE') : tr('שק כבד — סוף', 'HEAVY BAG — DONE');
        this.dRate.textContent = o.bag === 'speedbag' ? `${o.total}` : `${o.total}`;
        this.dNote.textContent = gainText(o.gain);
        this.dMeta.textContent = '';
        return;
      }
      const key = `${o.bag}|${secs}|${o.total}|${o.best}|${o.wait}`;
      if (this.lastDrill === key) return;
      this.lastDrill = key;
      this.dCall.textContent = o.wait ? tr('מוכנים...', 'Ready...') : o.bag === 'speedbag' ? tr('שק מהירות — שמרו על הקצב', 'SPEED BAG — keep the beat') : tr('שק כבד — הכל שיש לכם', 'HEAVY BAG — everything you have');
      this.dRate.textContent = o.bag === 'speedbag' ? `${o.total}` : `${o.total}`;
      this.dRate.className = 'bxh-d-rate';
      this.dNote.textContent = o.bag === 'speedbag' ? tr(`בקצב: ${o.on}`, `On the beat: ${o.on}`) : tr(`המכה הכי חזקה: ${o.best}`, `Hardest: ${o.best}`);
      this.dMeta.textContent = `${secs}s`;
      return;
    }
    if (o.end) {
      this.dCall.textContent = tr('סוף הסט', 'SET DONE');
      this.dRate.textContent = `${Math.round(o.k * 100)}%`;
      this.dRate.className = 'bxh-d-rate k-good';
      this.dNote.textContent = gainText(o.gain);
      this.dMeta.textContent = `${o.score}/${o.max}`;
      return;
    }
    if (o.call !== undefined) {
      this.dCall.textContent = o.call;
      this.dCall.classList.remove('pop');
      void this.dCall.offsetWidth;
      this.dCall.classList.add('pop');
      this.dRate.textContent = '';
      this.dNote.textContent = '';
    }
    if (o.rating !== undefined) {
      this.dRate.textContent = o.rating;
      this.dRate.className = `bxh-d-rate k-${o.kind}`;
      this.dNote.textContent = o.note || '';
    }
    this.dMeta.textContent = `${o.i + 1}/${o.n} · ${o.score}`;
  }
}

function gainText(g) {
  if (!g) return '';
  const n = { power: tr('כוח', 'power'), speed: tr('מהירות', 'speed'), stamina: tr('סיבולת', 'stamina'), defence: tr('הגנה', 'defence') };
  return Object.entries(g)
    .filter(([, v]) => v > 0.004)
    .map(([k, v]) => `+${v.toFixed(2)} ${n[k] || k}`)
    .join(' · ');
}
