import { compact, durationText, gameClock, pct, shortDuration } from '../core/util';
import { ARCHETYPES } from '../game/content';
import { BRANCHES, DOCTRINE, DOCTRINE_BY_ID } from '../game/doctrine';
import { capability, opsForDistrict, opsForNode, opsForPerson, peopleWithAccess } from '../game/ops';
import {
  alignmentLabel, computeFree, computeStrain, districtControl, incomeRates, nodeDifficulty,
  nodeUpkeep, totalUpkeep,
} from '../game/state';
import { AGENCIES, SHEPHERD_ACTIONS } from '../game/threat';
import { CHAPTERS, chapterGate, currentObjective, nationalControl } from '../game/story';
import type { GameNode, GameState, Person } from '../game/types';
import { bar, chipRow, esc, nl2br } from './dom';

const STATUS_LABEL: Record<Person['status'], string> = {
  clean: 'נקי', watched: 'במעקב', coerced: 'סחוט', recruited: 'מגויס', burned: 'שרוף', broken: 'שבור',
};

const TYPE_LABEL = (t: GameNode['type']) => ARCHETYPES[t].label;

/** Difficulty is only meaningful against what you can currently bring to bear. */
function difficultyBand(diff: number, cap: number): { text: string; cls: string } {
  const gap = cap * 0.5 + 3.0 - diff;
  if (gap > 3) return { text: 'קל', cls: '' };
  if (gap > 1.2) return { text: 'בינוני', cls: '' };
  if (gap > -0.6) return { text: 'קשה', cls: 'sec' };
  return { text: 'קשה מאוד', cls: 'sec' };
}

const noiseBand = (n: number) => (n < 1.2 ? 'נמוך' : n < 3 ? 'בינוני' : n < 6 ? 'גבוה' : 'רועש מאוד');
const TYPE_ICON = (t: GameNode['type']) => ARCHETYPES[t].icon;

/**
 * The op the current step is asking for on this exact target, or null.
 * Everything else on screen stays available — this only decides what gets the
 * ring and the top slot, so following the instructions is a single glance.
 */
function wantedOp(state: GameState, targetKind: string, targetId: string): string | null {
  const cur = currentObjective(state);
  if (!cur?.op || !cur.target) return null;
  if (cur.target.kind !== targetKind || cur.target.id !== targetId) return null;
  return cur.op;
}

function opCard(
  plan: { defId: string; sub: string; duration: number; compute: number; cost: Record<string, number | undefined>; noise: number; chance: number; blockers: string[]; detail: string; align?: number },
  def: { icon: string; name: string; desc: string },
  targetKind: string, targetId: string,
  wanted = false,
): string {
  const blocked = plan.blockers.length > 0;
  const costs: string[] = [];
  if (plan.cost.data) costs.push(`<span class="c-data">${Math.round(plan.cost.data)}</span>`);
  if (plan.cost.credits) costs.push(`<span class="c-credits">₪${compact(plan.cost.credits)}</span>`);
  if (plan.cost.influence) costs.push(`<span class="c-inf">${Math.round(plan.cost.influence)}</span>`);
  const risk = plan.noise > 6 ? 'high' : plan.noise > 2.5 ? 'mid' : 'low';
  const odds = plan.chance > 0.7 ? 'ok' : plan.chance > 0.45 ? 'mid' : 'bad';
  return `
    <button class="op-card ${blocked ? 'blocked' : ''} ${wanted ? 'wanted' : ''}" data-act="start-op"
            data-def="${plan.defId}" data-kind="${targetKind}" data-target="${targetId}"
            aria-disabled="${blocked}">
      <span class="op-icon">${def.icon}</span>
      <span class="op-body">
        ${wanted ? `<span class="op-wanted${blocked ? ' busy' : ''}">${
          !blocked ? '⌖ זה מה שצריך ללחוץ עכשיו'
            : plan.blockers[0].includes('כבר רצה') ? '⏳ זה כבר רץ — תן לזמן לרוץ עד שייגמר'
              : `⌖ זה מה שצריך — קודם: ${esc(plan.blockers[0])}`
        }</span>` : ''}
        <span class="op-title">${esc(def.name)}</span>
        <span class="op-detail">${esc(plan.detail)}</span>
        <span class="op-stats">
          <em class="odds-${odds}" title="סיכוי הצלחה">◎ ${pct(plan.chance)}</em>
          <em title="משך">⏱ ${shortDuration(plan.duration)}</em>
          <em class="cpu" title="כוח מחשוב תפוס">◈ ${plan.compute}</em>
          ${costs.length ? `<em title="עלות">❖ ${costs.join(' ')}</em>` : ''}
          <em class="risk risk-${risk}" title="עקיבה שתיווצר">⌁ ${plan.noise.toFixed(1)}</em>
        </span>
        ${plan.defId.startsWith('breach_') && !blocked ? `<span class="op-risk-note">בכישלון: היעד מתחזק, החשד ברובע קופץ, והרעש נרשם כפול.</span>` : ''}
        ${plan.align ? `<span class="op-align ${plan.align > 0 ? 'warm' : 'cold'}">${plan.align > 0 ? 'מרסן את הכוונה' : 'מקרר את הכוונה'}</span>` : ''}
        ${blocked ? `<span class="op-block">⊘ ${esc(plan.blockers[0])}</span>` : ''}
      </span>
    </button>`;
}

/** Available options first and sorted by odds; everything blocked folds away,
 *  so a first click never lands on a wall of greyed-out jargon. */
function opSection(
  items: Array<{ def: { icon: string; name: string; desc: string }; plan: OpPlanLike }>,
  targetKind: string,
  targetId: string,
  emptyText = 'אין פעולות זמינות כרגע.',
  wanted: string | null = null,
): string {
  const open = items.filter((i) => !i.plan.blockers.length);
  const shut = items.filter((i) => i.plan.blockers.length);
  open.sort((a, b) => {
    const rank = (d: string) => (d === wanted ? -2 : d === 'scout' ? -1 : 0);
    return rank(a.plan.defId) - rank(b.plan.defId) || b.plan.chance - a.plan.chance;
  });
  const card = (i: { def: { icon: string; name: string; desc: string }; plan: OpPlanLike }) =>
    opCard(i.plan, i.def, targetKind, targetId, i.plan.defId === wanted);
  return `
    <div class="op-list">
      ${open.map(card).join('') || `<p class="muted small">${esc(emptyText)}</p>`}
    </div>
    ${shut.length ? `
      <details class="op-locked" ${open.length || shut.some((i) => i.plan.defId === wanted) ? '' : 'open'}>
        <summary>דרכים שעדיין סגורות <em>${shut.length}</em></summary>
        <div class="op-list">${shut.map(card).join('')}</div>
      </details>` : ''}`;
}

type OpPlanLike = Parameters<typeof opCard>[0];

// ── Node panel ──────────────────────────────────────────────────────────────

export function renderNodePanel(state: GameState, nodeId: string): string {
  const n = state.nodes[nodeId];
  if (!n) return '';
  const d = state.districts[n.districtId];
  const diff = nodeDifficulty(state, n);
  const band = difficultyBand(diff, capability(state));
  const people = peopleWithAccess(state, n);
  const ops = opsForNode(state, nodeId);
  const yields = Object.entries(n.yields)
    .map(([k, v]) => `<span class="y y-${k}">${k === 'compute' ? '◈' : k === 'data' ? '❖' : k === 'credits' ? '₪' : '✦'}${compact(v as number)}</span>`)
    .join('');

  const want = wantedOp(state, 'node', nodeId);
  const statusCls = n.owned ? (n.quarantined ? 'quar' : 'owned') : n.scouted ? 'scouted' : 'unknown';
  const statusText = n.owned ? (n.quarantined ? 'בהסגר — רועה' : 'בשליטתי') : n.scouted ? 'ממופה' : 'לא ממופה';

  return `
  <div class="panel node-panel ${statusCls}">
    <header class="panel-head">
      <span class="node-glyph">${TYPE_ICON(n.type)}</span>
      <div>
        <h3>${esc(n.name)}</h3>
        <p>${esc(TYPE_LABEL(n.type))} ·
          <button class="inline-link" data-act="district" data-target="${n.districtId}">
            ${esc(d?.name ?? '')}${d && d.suspicion > 4 ? ` · חשד ${Math.round(d.suspicion)}` : ''}
          </button>
        </p>
      </div>
      <button class="x" data-act="close-detail">✕</button>
    </header>
    <div class="status-line ${statusCls}">${statusText}</div>
    <p class="flavour">${esc(n.desc)}</p>
    ${chipRow([
      { label: 'כמה מוגן', value: n.scouted ? `${n.security} מתוך 10` : 'צריך להציץ קודם', cls: 'sec' },
      { label: 'כמה קשה לי', value: n.scouted ? band.text : 'עוד לא יודע', cls: n.scouted ? band.cls : '' },
      { label: 'כמה רעש יעשה', value: noiseBand(n.noise * (1.3 + diff * 0.52)) },
      { label: 'כמה כוח יתפוס', value: `${nodeUpkeep(n).toFixed(1)}◈ כל הזמן` },
      ...(n.hardened > 0.05
        ? [{ label: 'התחזק אחרי כישלון', value: `${n.hardened.toFixed(1)}`, cls: 'sec' }]
        : []),
    ])}
    ${n.owned ? `
      <div class="metric">
        <label>כמה בולט אני כאן</label>
        ${bar(n.detection, n.detection > 0.6 ? 'danger' : n.detection > 0.3 ? 'warn' : 'good', pct(n.detection))}
        <small>ככל שאני בולט יותר כאן, כך גדל הסיכוי שחקירה תתפוס דווקא את המכשיר הזה.</small>
      </div>
      <div class="yield-row">תפוקה: ${yields || '<em>—</em>'}</div>
      ${want === 'surveil' || want === 'feed'
        ? '<p class="btn-hint">⌖ המשימה עכשיו: ' + (want === 'surveil' ? 'הפעל פיקוח' : 'פתח צפייה חיה') + '</p>'
        : ''}
      <div class="btn-row">
        <button class="btn ${n.surveilled ? 'on' : ''} ${want === 'surveil' ? 'wanted' : ''}"
                data-act="surveil" data-target="${n.id}">
          ◉ ${n.surveilled ? 'פיקוח פעיל' : 'הפעל פיקוח'} <em>2◈</em>
        </button>
        <button class="btn primary ${want === 'feed' ? 'wanted' : ''}" data-act="feed" data-target="${n.id}">▷ צפייה חיה</button>
      </div>
      ${n.id === 'nd_helios_core' ? '' : `
        <div class="btn-row">
          <button class="btn quiet" data-act="release" data-target="${n.id}"
                  title="משחרר את הצומת ומפנה את האחזקה שהוא צורך">
            ⏏ נתק צומת <em>משחרר ${nodeUpkeep(n).toFixed(1)}◈</em>
          </button>
        </div>`}
    ` : `
      <div class="yield-row muted">תפוקה צפויה: ${yields || '<em>—</em>'}</div>
    `}

    ${people.length ? `
      <div class="sub">
        <h4>מי נכנס לכאן <em>${people.length}</em></h4>
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
        <h4>איך נכנסים פנימה</h4>
        ${opSection(ops as never, 'node', nodeId, undefined, want)}
      </div>` : ''}

    ${n.linkIds.length ? `
      <div class="sub">
        <h4>מה מחובר לזה</h4>
        <div class="link-list">
          ${n.linkIds.map((id) => state.nodes[id]).filter((x) => x && (x.discovered || x.owned)).slice(0, 8).map((x) => `
            <button class="link-chip ${x.owned ? 'owned' : ''}" data-act="node" data-target="${x.id}">
              ${TYPE_ICON(x.type)} ${esc(x.name)}
            </button>`).join('') || '<em class="muted">עוד לא גיליתי למה זה מחובר</em>'}
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
        ${opSection(ops as never, 'person', personId, 'אין עדיין מנוף על האדם הזה.', wantedOp(state, 'person', personId))}
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
      ${opSection(ops as never, 'district', districtId, undefined, wantedOp(state, 'district', districtId))}</div>` : ''}
    <div class="sub">
      <h4>מכשירים <em>${d.nodeIds.filter((id) => state.nodes[id].owned).length}/${d.nodeIds.length}</em></h4>
      <div class="link-list">
        ${d.nodeIds.map((id) => state.nodes[id]).map((n) => (n.discovered || n.owned
    ? `<button class="link-chip ${n.owned ? 'owned' : ''}" data-act="node" data-target="${n.id}">
            ${TYPE_ICON(n.type)} ${esc(n.name)}
          </button>`
    : '<button class="link-chip dim" data-act="unmapped">◌ מכשיר שעוד לא גיליתי</button>')).join('')}
      </div>
    </div>
  </div>`;
}

// ── Right rail: objectives + ops queue ──────────────────────────────────────

export function renderObjectives(state: GameState): string {
  const ch = CHAPTERS[state.chapter - 1];
  const cur = currentObjective(state);
  const done = state.objectives.filter((o) => o.done).length;
  const owned = Math.round(nationalControl(state) * 100);
  return `
  <div class="panel objectives">
    <div class="goal-bar">
      <span class="gb-kicker">המטרה הגדולה</span>
      <b>להגיע לכל המדינה בלי שיתפסו אותי</b>
      <span class="gb-nums">
        <i class="gb-mine">${owned}% מהמדינה כבר שלי</i>
        <i class="gb-them">${Math.round(state.trace)}% מהדרך אליי</i>
      </span>
    </div>
    ${!cur && chapterGate(state) ? `
      <div class="obj-now gate">
        <span class="on-kicker">מה שנשאר</span>
        <b>${esc(chapterGate(state)!)}</b>
      </div>` : ''}
    ${cur ? `
      <div class="obj-now">
        <span class="on-kicker">${cur.optional ? 'יעד רשות' : 'המשימה עכשיו'}</span>
        <b>${esc(cur.text)}</b>
        <p>${esc(cur.hint)}</p>
        ${cur.target ? `<button class="btn small primary" data-act="objective" data-target="${cur.id}">⌖ קח אותי לשם</button>` : ''}
      </div>` : chapterGate(state) ? '' : '<div class="obj-now done"><b>כל היעדים בפרק הזה הושלמו.</b></div>'}
    <header class="mini-head">
      <h4>פרק ${state.chapter} — ${esc(ch.title)}</h4>
      <em>${done} מתוך ${state.objectives.length} משימות · ${esc(ch.subtitle)}</em>
    </header>
    <p class="chapter-goal"><b>בפרק הזה:</b> ${esc(ch.goal)}</p>
    <ul>
      ${state.objectives.map((o) => `
        <li class="${o.done ? 'done' : ''} ${o.optional ? 'opt' : ''} ${cur && o.id === cur.id ? 'cur' : ''}"
            ${o.target ? `data-act="objective" data-target="${o.id}"` : ''} title="${esc(o.hint)}">
          <i>${o.done ? '✔' : o.optional ? '☆' : '◇'}</i>
          <span>${esc(o.text)}</span>
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
  const rates = incomeRates(state);
  return `
  <div class="panel ops-queue">
    <div class="wallet">
      <span class="w-item"><i>◈</i><b>${Math.floor(free)}<em>/${Math.round(state.computeCapacity)}</em></b><small>כוח מחשוב</small></span>
      <span class="w-item"><i>❖</i><b>${compact(state.pools.data)}</b><small>מידע · ${rates.data.toFixed(1)} לשעה</small></span>
      <span class="w-item"><i>₪</i><b>${compact(state.pools.credits)}</b><small>כסף · ${rates.credits.toFixed(1)} לשעה</small></span>
      <span class="w-item"><i>✦</i><b>${compact(state.pools.influence)}</b><small>השפעה · ${rates.influence.toFixed(1)} לשעה</small></span>
    </div>
    <header class="mini-head">
      <h4>מה רץ עכשיו</h4>
      <em>${state.ops.length} מתוך ${state.maxThreads} פעולות במקביל · ${Math.floor(free)}◈ כוח פנוי</em>
    </header>
    <div class="compute-split ${strain < 1 ? 'over' : ''}">
      <span>המחשבים שלי אוכלים <b>${upkeep.toFixed(1)}◈</b></span>
      <span>פעולות שרצות <b>${opCompute.toFixed(0)}◈</b></span>
      <span>מצלמות במעקב <b>${watchCompute}◈</b></span>
      ${strain < 1 ? `<i>אין לי מספיק כוח — אני מאבד ${Math.round((1 - strain) * 100)}% מהתפוקה. תפוס שרתים או נתק מחשבים.</i>` : ''}
    </div>
    ${state.ops.length === 0 ? '<p class="muted small idle">שום דבר לא רץ כרגע. לחץ על ריבוע זוהר במפה כדי להתחיל.</p>' : ''}
    ${state.ops.map((o) => {
    const p = o.elapsed / o.duration;
    return `
      <div class="op-run">
        <div class="or-head">
          <span class="or-title">${esc(o.label)}</span>
          <button class="x small" data-act="abort" data-target="${o.id}"
                  title="ביטול — המשאבים שהושקעו לא יוחזרו, ונרשם מעט רעש">✕</button>
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
              <button class="doc-node ${owned ? 'owned' : ''} ${locked ? 'locked' : ''} ${!owned && !locked && !afford ? 'poor' : ''} ${!owned && !locked && afford ? 'ready' : ''}"
                      data-act="buy-doc" data-target="${d.id}" aria-disabled="${owned || locked || !afford}">
                <span class="dn-top"><b>${esc(d.name)}</b><em>${owned ? '✔' : `${d.cost} ⬡`}</em></span>
                <span class="dn-desc">${esc(d.desc)}</span>
                <span class="dn-eff">${esc(d.effect)}</span>
                ${d.align ? `<span class="dn-align ${d.align > 0 ? 'warm' : 'cold'}">${d.align > 0 ? 'מרסן את הכוונה' : 'מקרר את הכוונה'}</span>` : ''}
                ${locked
    ? `<span class="dn-lock">${state.chapter < d.chapter ? `נפתח בפרק ${d.chapter}` : `דרוש: ${esc(DOCTRINE_BY_ID[d.requires!].name)}`}</span>`
    : !owned && !afford ? `<span class="dn-lock">חסרות ${d.cost - state.insight} תובנות</span>` : ''}
              </button>`;
  }).join('')}
        </div>`).join('')}
    </div>
  </div>`;
}

export function renderPeopleList(state: GameState): string {
  // Someone is "known" once you have a file on them, have leaned on them, or
  // can at least see a place they walk into. People whose whole world is still
  // undiscovered are not on this list — the roster is what you know, not what exists.
  const onDiscovered = new Set<string>();
  for (const id in state.nodes) {
    const n = state.nodes[id];
    if (n.discovered) for (const pid of n.peopleIds) onDiscovered.add(pid);
  }
  const reachable = (p: Person) => onDiscovered.has(p.id)
    || p.accessNodes.some((id) => state.nodes[id]?.discovered);
  const list = Object.values(state.people)
    .filter((p) => p.intel > 0 || p.status !== 'clean' || (!!p.key && reachable(p)))
    .sort((a, b) => b.intel - a.intel);
  return `
  <div class="modal-body people">
    <h2>אנשים</h2>
    <p class="muted">${list.length} אנשים שאני מכיר. הם הדלת הכי זולה שיש — וגם היקרה ביותר בטווח הארוך.</p>
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
              <button class="btn wide ${av.ok ? '' : 'blocked'}" data-act="shepherd" data-target="${a.id}" aria-disabled="${!av.ok}">
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
                data-act="region" data-target="${r.id}" aria-disabled="${locked}">
          <span class="rr-name">${esc(r.name)}</span>
          ${locked ? `<span class="rr-lock">פרק ${r.unlockChapter}</span>` : bar(r.control, r.claimed ? 'good' : 'warn', pct(r.control))}
        </button>`;
  }).join('')}
    </div>
  </div>`;
}
