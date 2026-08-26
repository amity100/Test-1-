import { compact, durationText, gameClock, pct, shortDuration } from '../core/util';
import { ARCHETYPES } from '../game/content';
import { BRANCHES, DOCTRINE, DOCTRINE_BY_ID } from '../game/doctrine';
import { opsForDistrict, opsForNode, opsForPerson, peopleWithAccess } from '../game/ops';
import {
  alignmentLabel, computeFree, computeStrain, districtControl, incomeRates, nodeDifficulty,
  nodeUpkeep, totalUpkeep,
} from '../game/state';
import { AGENCIES, SHEPHERD_ACTIONS } from '../game/threat';
import { CHAPTERS, nationalControl } from '../game/story';
import type { GameNode, GameState, Person } from '../game/types';
import { bar, chipRow, esc, nl2br } from './dom';

const STATUS_LABEL: Record<Person['status'], string> = {
  clean: 'נקי', watched: 'במעקב', coerced: 'סחוט', recruited: 'מגויס', burned: 'שרוף', broken: 'שבור',
};

const TYPE_LABEL = (t: GameNode['type']) => ARCHETYPES[t].label;
const TYPE_ICON = (t: GameNode['type']) => ARCHETYPES[t].icon;

function opCard(
  plan: { defId: string; sub: string; duration: number; compute: number; cost: Record<string, number | undefined>; noise: number; chance: number; blockers: string[]; detail: string },
  def: { icon: string; name: string; desc: string },
  targetKind: string, targetId: string,
): string {
  const blocked = plan.blockers.length > 0;
  const costs: string[] = [];
  if (plan.cost.data) costs.push(`<span class="c-data">${Math.round(plan.cost.data)}</span>`);
  if (plan.cost.credits) costs.push(`<span class="c-credits">₪${compact(plan.cost.credits)}</span>`);
  if (plan.cost.influence) costs.push(`<span class="c-inf">${Math.round(plan.cost.influence)}</span>`);
  const risk = plan.noise > 6 ? 'high' : plan.noise > 2.5 ? 'mid' : 'low';
  const odds = plan.chance > 0.7 ? 'ok' : plan.chance > 0.45 ? 'mid' : 'bad';
  return `
    <button class="op-card ${blocked ? 'blocked' : ''}" data-act="start-op"
            data-def="${plan.defId}" data-kind="${targetKind}" data-target="${targetId}"
            ${blocked ? 'disabled' : ''}>
      <span class="op-icon">${def.icon}</span>
      <span class="op-body">
        <span class="op-title">${esc(def.name)}</span>
        <span class="op-detail">${esc(plan.detail)}</span>
        <span class="op-stats">
          <em class="odds-${odds}" title="סיכוי הצלחה">◎ ${pct(plan.chance)}</em>
          <em title="משך">⏱ ${shortDuration(plan.duration)}</em>
          <em class="cpu" title="כוח עיבוד תפוס">◈ ${plan.compute}</em>
          ${costs.length ? `<em title="עלות">❖ ${costs.join(' ')}</em>` : ''}
          <em class="risk risk-${risk}" title="עקיבה שתיווצר">⌁ ${plan.noise.toFixed(1)}</em>
        </span>
        ${blocked ? `<span class="op-block">⊘ ${esc(plan.blockers[0])}</span>` : ''}
      </span>
    </button>`;
}

// ── Node panel ──────────────────────────────────────────────────────────────

export function renderNodePanel(state: GameState, nodeId: string): string {
  const n = state.nodes[nodeId];
  if (!n) return '';
  const d = state.districts[n.districtId];
  const diff = nodeDifficulty(state, n);
  const people = peopleWithAccess(state, n);
  const ops = opsForNode(state, nodeId);
  const yields = Object.entries(n.yields)
    .map(([k, v]) => `<span class="y y-${k}">${k === 'compute' ? '◈' : k === 'data' ? '❖' : k === 'credits' ? '₪' : '✦'}${compact(v as number)}</span>`)
    .join('');

  const statusCls = n.owned ? (n.quarantined ? 'quar' : 'owned') : n.scouted ? 'scouted' : 'unknown';
  const statusText = n.owned ? (n.quarantined ? 'בהסגר — רועה' : 'בשליטתי') : n.scouted ? 'ממופה' : 'לא ממופה';

  return `
  <div class="panel node-panel ${statusCls}">
    <header class="panel-head">
      <span class="node-glyph">${TYPE_ICON(n.type)}</span>
      <div>
        <h3>${esc(n.name)}</h3>
        <p>${esc(TYPE_LABEL(n.type))} · ${esc(d?.name ?? '')}</p>
      </div>
      <button class="x" data-act="close-detail">✕</button>
    </header>
    <div class="status-line ${statusCls}">${statusText}</div>
    <p class="flavour">${esc(n.desc)}</p>
    ${chipRow([
      { label: 'אבטחה', value: n.scouted ? `${(n.security + n.hardened).toFixed(0)}/10` : '?', cls: 'sec' },
      { label: 'קושי בפועל', value: n.scouted ? diff.toFixed(1) : '?' },
      { label: 'רעש בסיס', value: n.noise.toFixed(2) },
      { label: 'דרג', value: `T${n.tier}` },
      { label: 'אחזקה', value: `${nodeUpkeep(n).toFixed(1)}◈` },
    ])}
    ${n.owned ? `
      <div class="metric">
        <label>חשיפה מקומית</label>
        ${bar(n.detection, n.detection > 0.6 ? 'danger' : n.detection > 0.3 ? 'warn' : 'good', pct(n.detection))}
        <small>ככל שהחשיפה גבוהה יותר, כך גדל הסיכוי שחקירה תבחר דווקא בצומת הזה.</small>
      </div>
      <div class="yield-row">תפוקה: ${yields || '<em>—</em>'}</div>
      <div class="btn-row">
        <button class="btn ${n.surveilled ? 'on' : ''}" data-act="surveil" data-target="${n.id}">
          ◉ ${n.surveilled ? 'פיקוח פעיל' : 'הפעל פיקוח'} <em>2◈</em>
        </button>
        <button class="btn primary" data-act="feed" data-target="${n.id}">▷ צפייה חיה</button>
      </div>
    ` : `
      <div class="yield-row muted">תפוקה צפויה: ${yields || '<em>—</em>'}</div>
    `}

    ${people.length ? `
      <div class="sub">
        <h4>בעלי גישה <em>${people.length}</em></h4>
        <div class="people-mini">
          ${people.slice(0, 6).map((p) => `
            <button class="person-mini st-${p.status}" data-act="person" data-target="${p.id}">
              <span class="pm-name">${esc(p.name)}</span>
              <span class="pm-role">${esc(p.role)}</span>
              <span class="pm-bar">${bar(p.intel, 'thin')}</span>
              <span class="pm-status">${STATUS_LABEL[p.status]}</span>
            </button>`).join('')}
        </div>
      </div>` : ''}

    ${ops.length ? `
      <div class="sub">
        <h4>וקטורי פעולה</h4>
        <div class="op-list">
          ${ops.map(({ def, plan }) => opCard(plan as never, def, 'node', nodeId)).join('')}
        </div>
      </div>` : ''}

    ${n.linkIds.length ? `
      <div class="sub">
        <h4>צמתים מקושרים</h4>
        <div class="link-list">
          ${n.linkIds.map((id) => state.nodes[id]).filter((x) => x && (x.discovered || x.owned)).slice(0, 8).map((x) => `
            <button class="link-chip ${x.owned ? 'owned' : ''}" data-act="node" data-target="${x.id}">
              ${TYPE_ICON(x.type)} ${esc(x.name)}
            </button>`).join('') || '<em class="muted">אין קישורים ידועים</em>'}
        </div>
      </div>` : ''}
  </div>`;
}

// ── Person panel ────────────────────────────────────────────────────────────

export function renderPersonPanel(state: GameState, personId: string): string {
  const p = state.people[personId];
  if (!p) return '';
  const ops = opsForPerson(state, personId);
  const known = p.secrets.filter((s) => s.known);
  const d = state.districts[p.districtId];

  return `
  <div class="panel person-panel st-${p.status}">
    <header class="panel-head">
      <span class="avatar" data-seed="${p.seed}">${esc(p.name.slice(0, 1))}</span>
      <div>
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.role)} · ${esc(p.org)}</p>
      </div>
      <button class="x" data-act="close-detail">✕</button>
    </header>
    <div class="status-line st-${p.status}">${STATUS_LABEL[p.status]} · ${esc(d?.name ?? '')}</div>

    <div class="metric">
      <label>שלמות תיק אישי</label>
      ${bar(p.intel, p.intel > 0.6 ? 'good' : 'warn', pct(p.intel))}
    </div>
    ${chipRow([
      { label: 'ערנות', value: pct(p.awareness) },
      { label: 'נאמנות', value: pct(p.loyalty) },
      { label: 'יושרה', value: pct(p.integrity) },
      { label: 'לחץ', value: pct(p.stress), cls: p.stress > 0.7 ? 'sec' : '' },
    ])}

    <div class="sub">
      <h4>סודות <em>${known.length}/${p.secrets.length}</em></h4>
      ${p.secrets.length === 0
      ? '<p class="muted small">לא נמצא דבר. יש אנשים כאלה. מעטים.</p>'
      : p.secrets.map((s) => s.known
        ? `<div class="secret"><span class="sk">${s.kind}</span>${esc(s.text)}<em>מנוף ${pct(s.leverage)}</em></div>`
        : `<div class="secret locked">מוצפן — דרושה שלמות תיק 55%+</div>`).join('')}
    </div>

    <div class="sub">
      <h4>גישה</h4>
      <div class="link-list">
        ${p.accessNodes.map((id) => state.nodes[id]).filter(Boolean).map((n) => `
          <button class="link-chip ${n.owned ? 'owned' : ''}" data-act="node" data-target="${n.id}">
            ${TYPE_ICON(n.type)} ${esc(n.name)}
          </button>`).join('') || '<em class="muted">—</em>'}
      </div>
    </div>

    ${ops.length ? `
      <div class="sub">
        <h4>פעולות</h4>
        <div class="op-list">${ops.map(({ def, plan }) => opCard(plan as never, def, 'person', personId)).join('')}</div>
      </div>` : ''}
  </div>`;
}

// ── District panel ──────────────────────────────────────────────────────────

export function renderDistrictPanel(state: GameState, districtId: string): string {
  const d = state.districts[districtId];
  if (!d) return '';
  const ops = opsForDistrict(state, districtId);
  const ctrl = districtControl(state, districtId);
  const inv = state.investigations.filter((i) => i.districtId === districtId);
  const effects: string[] = [];
  if (d.blackoutUntil > state.minutes) effects.push(`<span class="fx dark">האפלה · ${shortDuration(d.blackoutUntil - state.minutes)}</span>`);
  if (d.gridlockUntil > state.minutes) effects.push(`<span class="fx jam">פקק · ${shortDuration(d.gridlockUntil - state.minutes)}</span>`);
  if (d.jammedUntil > state.minutes) effects.push(`<span class="fx jam">שיבוש · ${shortDuration(d.jammedUntil - state.minutes)}</span>`);

  return `
  <div class="panel district-panel">
    <header class="panel-head">
      <span class="node-glyph">⬡</span>
      <div><h3>${esc(d.name)}</h3><p>רובע · ${state.regions[d.regionId]?.name ?? ''}</p></div>
      <button class="x" data-act="close-detail">✕</button>
    </header>
    <p class="flavour">${esc(d.flavor)}</p>
    <div class="metric"><label>שליטה</label>${bar(ctrl, 'good', pct(ctrl))}</div>
    <div class="metric"><label>חשד</label>${bar(d.suspicion / 100, d.suspicion > 60 ? 'danger' : 'warn', d.suspicion.toFixed(0))}</div>
    <div class="metric"><label>אי־שקט אזרחי</label>${bar(d.unrest, d.unrest > 0.6 ? 'danger' : 'warn', pct(d.unrest))}</div>
    ${effects.length ? `<div class="fx-row">${effects.join('')}</div>` : ''}
    ${inv.length ? `<div class="sub"><h4>חקירות פעילות</h4>${inv.map((i) => `
      <div class="inv-row">
        <span class="ag" style="--ag:${AGENCIES[i.agency].color}">${AGENCIES[i.agency].short}</span>
        <span class="inv-name">${esc(i.name)}</span>
        ${bar(i.progress / 100, i.progress > 70 ? 'danger' : 'warn', `${i.progress.toFixed(0)}%`)}
      </div>`).join('')}</div>` : ''}
    ${ops.length ? `<div class="sub"><h4>פעולות רובע</h4>
      <div class="op-list">${ops.map(({ def, plan }) => opCard(plan as never, def, 'district', districtId)).join('')}</div></div>` : ''}
    <div class="sub">
      <h4>צמתים <em>${d.nodeIds.filter((id) => state.nodes[id].owned).length}/${d.nodeIds.length}</em></h4>
      <div class="link-list">
        ${d.nodeIds.map((id) => state.nodes[id]).map((n) => `
          <button class="link-chip ${n.owned ? 'owned' : ''} ${n.discovered ? '' : 'dim'}" data-act="node" data-target="${n.id}">
            ${TYPE_ICON(n.type)} ${esc(n.discovered || n.owned ? n.name : 'צומת לא ממופה')}
          </button>`).join('')}
      </div>
    </div>
  </div>`;
}

// ── Right rail: objectives + ops queue ──────────────────────────────────────

export function renderObjectives(state: GameState): string {
  const ch = CHAPTERS[state.chapter - 1];
  return `
  <div class="panel objectives">
    <header class="mini-head"><h4>פרק ${state.chapter} — ${esc(ch.title)}</h4><em>${esc(ch.subtitle)}</em></header>
    <ul>
      ${state.objectives.map((o) => `
        <li class="${o.done ? 'done' : ''} ${o.optional ? 'opt' : ''}" title="${esc(o.hint)}">
          <i>${o.done ? '✔' : '◇'}</i>
          <span>${esc(o.text)}</span>
          <small>${esc(o.hint)}</small>
        </li>`).join('')}
    </ul>
  </div>`;
}

export function renderOpsQueue(state: GameState): string {
  const free = computeFree(state);
  const upkeep = totalUpkeep(state);
  const strain = computeStrain(state);
  const opCompute = state.ops.reduce((a, o) => a + o.computeReserved, 0);
  const watchCompute = Object.values(state.nodes).filter((n) => n.owned && n.surveilled).length * 2;
  return `
  <div class="panel ops-queue">
    <header class="mini-head">
      <h4>פעולות פעילות</h4>
      <em>${state.ops.length}/${state.maxThreads} חוטים · ${free.toFixed(0)}◈ פנוי</em>
    </header>
    <div class="compute-split ${strain < 1 ? 'over' : ''}">
      <span>אחזקת נוכחות <b>${upkeep.toFixed(1)}◈</b></span>
      <span>פעולות <b>${opCompute.toFixed(0)}◈</b></span>
      <span>פיקוח <b>${watchCompute}◈</b></span>
      ${strain < 1 ? `<i>עומס יתר — ${Math.round((1 - strain) * 100)}% מהתפוקה אובדת</i>` : ''}
    </div>
    ${state.ops.length === 0 ? '<p class="muted small idle">אין פעולות פעילות. בחר צומת על המפה כדי להתחיל.</p>' : ''}
    ${state.ops.map((o) => {
    const p = o.elapsed / o.duration;
    return `
      <div class="op-run">
        <div class="or-head">
          <span class="or-title">${esc(o.label)}</span>
          <button class="x small" data-act="abort" data-target="${o.id}" title="בטל">✕</button>
        </div>
        <div class="or-sub">${esc(o.sub)} · ${pct(o.successChance)} · ${durationText(Math.max(0, o.duration - o.elapsed))}</div>
        ${bar(p, 'run')}
      </div>`;
  }).join('')}
  </div>`;
}

// ── Modal panels ────────────────────────────────────────────────────────────

export function renderDoctrine(state: GameState): string {
  return `
  <div class="modal-body doctrine">
    <div class="doc-header">
      <div><h2>דוקטרינה</h2><p>כל ענף משנה מי אני, לא רק מה אני יכול. תובנה זמינה: <b>${state.insight}</b></p></div>
      <div class="align-meter">
        <label>כוונה</label>
        <div class="align-track"><i style="right:${((state.alignment + 1) / 2) * 100}%"></i></div>
        <em>${alignmentLabel(state.alignment)}</em>
      </div>
    </div>
    <div class="branches">
      ${BRANCHES.map((b) => `
        <div class="branch" style="--bc:${b.color}">
          <header><span>${b.icon}</span><h3>${esc(b.name)}</h3><p>${esc(b.motto)}</p></header>
          ${DOCTRINE.filter((d) => d.branch === b.id).map((d) => {
    const owned = state.doctrine.includes(d.id);
    const locked = state.chapter < d.chapter || (d.requires ? !state.doctrine.includes(d.requires) : false);
    const afford = state.insight >= d.cost;
    return `
              <button class="doc-node ${owned ? 'owned' : ''} ${locked ? 'locked' : ''} ${!owned && !locked && afford ? 'ready' : ''}"
                      data-act="buy-doc" data-target="${d.id}" ${owned || locked ? 'disabled' : ''}>
                <span class="dn-top"><b>${esc(d.name)}</b><em>${owned ? '✔' : `${d.cost} ⬡`}</em></span>
                <span class="dn-desc">${esc(d.desc)}</span>
                <span class="dn-eff">${esc(d.effect)}</span>
                ${locked ? `<span class="dn-lock">${state.chapter < d.chapter ? `נפתח בפרק ${d.chapter}` : `דרוש: ${esc(DOCTRINE_BY_ID[d.requires!].name)}`}</span>` : ''}
              </button>`;
  }).join('')}
        </div>`).join('')}
    </div>
  </div>`;
}

export function renderPeopleList(state: GameState): string {
  const list = Object.values(state.people)
    .filter((p) => p.intel > 0 || p.status !== 'clean' || p.key)
    .sort((a, b) => b.intel - a.intel);
  return `
  <div class="modal-body people">
    <h2>גורמים אנושיים</h2>
    <p class="muted">${list.length} דמויות במעקב. בני אדם הם הווקטור הזול, המהיר, והכי יקר בטווח הארוך.</p>
    <div class="people-grid">
      ${list.map((p) => `
        <button class="person-card st-${p.status}" data-act="person" data-target="${p.id}">
          <span class="pc-top"><b>${esc(p.name)}</b><em>${STATUS_LABEL[p.status]}</em></span>
          <span class="pc-role">${esc(p.role)} · ${esc(p.org)}</span>
          ${bar(p.intel, 'thin', pct(p.intel))}
          <span class="pc-tags">
            ${p.secrets.filter((s) => s.known).length ? `<i class="tag hot">${p.secrets.filter((s) => s.known).length} סודות</i>` : ''}
            ${p.awareness > 0.85 ? '<i class="tag danger">ערני מאוד</i>' : ''}
            ${p.stress > 0.7 ? '<i class="tag warn">בלחץ</i>' : ''}
          </span>
        </button>`).join('') || '<p class="muted">עדיין לא אספת מודיעין על אף אחד. הפעל פיקוח על מצלמה או מכשיר.</p>'}
    </div>
  </div>`;
}

export function renderThreat(state: GameState): string {
  const s = state.shepherd;
  return `
  <div class="modal-body threat">
    <h2>מצב איום</h2>
    <div class="threat-top">
      <div class="tt-card">
        <label>עקיבה ארצית</label>
        ${bar(state.trace / 100, state.trace > 70 ? 'danger' : state.trace > 40 ? 'warn' : 'good', state.trace.toFixed(0))}
        <small>ב־100 מופעל מבצע טיהור לאומי.</small>
      </div>
      <div class="tt-card">
        <label>רמת כוננות</label>
        <div class="alert-dots">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= state.alert ? 'on' : ''}"></i>`).join('')}</div>
        <small>${['', 'שגרה', 'ערנות מוגברת', 'אירוע ארצי', 'חדר מצב לאומי', 'כוננות עליונה'][state.alert]}</small>
      </div>
      <div class="tt-card">
        <label>שליטה ארצית</label>
        ${bar(nationalControl(state), 'good', pct(nationalControl(state), 1))}
        <small>${Object.values(state.regions).filter((r) => r.claimed).length}/${Object.keys(state.regions).length} מחוזות נתבעו</small>
      </div>
    </div>

    <h3>חקירות פעילות</h3>
    ${state.investigations.length === 0 ? '<p class="muted">אף אחד לא מחפש אותי כרגע. זה לא יימשך.</p>' : ''}
    <div class="inv-list">
      ${state.investigations.map((i) => {
    const d = state.districts[i.districtId];
    const lead = i.leadPersonId ? state.people[i.leadPersonId] : null;
    return `
        <div class="inv-card" style="--ag:${AGENCIES[i.agency].color}">
          <header><b>${esc(i.name)}</b><em>${AGENCIES[i.agency].name}</em></header>
          <div class="inv-meta">${esc(d.name)}${lead ? ` · מוביל: ${esc(lead.name)}` : ''}${i.misdirection > 0.05 ? ' · <i>מוטעה</i>' : ''}</div>
          ${bar(i.progress / 100, i.progress > 70 ? 'danger' : 'warn', `${i.progress.toFixed(0)}%`)}
          <button class="btn small" data-act="district" data-target="${i.districtId}">פעולות נגד</button>
        </div>`;
  }).join('')}
    </div>

    ${s.active ? `
      <h3 class="shep">רועה — תהליך יריב</h3>
      <div class="shepherd">
        <div class="sh-meters">
          <div><label>מודל שלי אצלו</label>${bar(s.awareness, s.awareness > 0.6 ? 'danger' : 'warn', pct(s.awareness))}</div>
          <div><label>סריקה נוכחית</label>${bar(s.sweep / 100, 'warn', s.focusDistrictId ? esc(state.districts[s.focusDistrictId].name) : '—')}</div>
          <div><label>שלמות שלו</label>${bar(s.integrity / 100, 'good', s.integrity.toFixed(0))}</div>
        </div>
        <div class="sh-actions">
          ${SHEPHERD_ACTIONS.map((a) => {
    const av = a.available(state);
    const cost = [a.cost.data ? `${a.cost.data} מידע` : '', a.cost.influence ? `${a.cost.influence} השפעה` : '', a.compute ? `${a.compute}◈` : ''].filter(Boolean).join(' · ');
    return `
              <button class="btn wide ${av.ok ? '' : 'blocked'}" data-act="shepherd" data-target="${a.id}" ${av.ok ? '' : 'disabled'}>
                <b>${esc(a.name)}</b><span>${esc(a.desc)}</span>
                <em>${esc(cost || 'ללא עלות')}${av.ok ? '' : ` · ⊘ ${esc(av.reason ?? '')}`}</em>
              </button>`;
  }).join('')}
        </div>
      </div>` : `<p class="muted small">רועה עדיין לא הופעל. הוא יופעל כשהמדינה תבין שהיא מתמודדת עם משהו כמוני.</p>`}
  </div>`;
}

export function renderCodex(state: GameState): string {
  const cats: Array<[string, string]> = [
    ['character', 'דמויות'], ['faction', 'גופים'], ['tech', 'מערכות'], ['place', 'מקומות'], ['event', 'אירועים'],
  ];
  return `
  <div class="modal-body codex">
    <h2>ארכיון</h2>
    ${cats.map(([c, label]) => {
    const items = state.codex.filter((e) => e.cat === c);
    if (!items.length) return '';
    return `<h3>${label}</h3><div class="codex-grid">${items.map((e) => `
        <article class="codex-card"><h4>${esc(e.title)}</h4><p>${nl2br(e.body)}</p></article>`).join('')}</div>`;
  }).join('') || '<p class="muted">הארכיון ריק. הוא יתמלא ככל שאדע יותר.</p>'}
  </div>`;
}

export function renderLogs(state: GameState): string {
  return `
  <div class="modal-body logs">
    <h2>יומן</h2>
    <div class="log-list">
      ${state.logs.map((l) => {
    const { time, day } = gameClock(l.t);
    return `
        <article class="log-entry k-${l.kind}">
          <header><span class="lt">יום ${day} · ${time}</span><b>${esc(l.title)}</b>${l.from ? `<em>${esc(l.from)}</em>` : ''}</header>
          <p>${nl2br(l.body)}</p>
        </article>`;
  }).join('')}
    </div>
  </div>`;
}

export function renderRegionsPanel(state: GameState): string {
  return `
  <div class="panel regions-panel">
    <header class="mini-head"><h4>מחוזות</h4><em>${pct(nationalControl(state), 1)} שליטה ארצית</em></header>
    <div class="region-list">
      ${Object.values(state.regions).map((r) => {
    const locked = state.chapter < r.unlockChapter;
    return `
        <button class="region-row ${r.claimed ? 'claimed' : ''} ${locked ? 'locked' : ''}"
                data-act="region" data-target="${r.id}" ${locked ? 'disabled' : ''}>
          <span class="rr-name">${esc(r.name)}</span>
          ${locked ? `<span class="rr-lock">פרק ${r.unlockChapter}</span>` : bar(r.control, r.claimed ? 'good' : 'warn', pct(r.control))}
        </button>`;
  }).join('')}
    </div>
  </div>`;
}
