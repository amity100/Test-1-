export function h(tag: string, cls = '', html = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

export function nl2br(s: string): string {
  return esc(s).replace(/\n/g, '<br/>');
}

/** Renders a labelled 0..1 bar. */
export function bar(value: number, cls = '', label = ''): string {
  const w = Math.max(0, Math.min(1, value)) * 100;
  return `<div class="bar ${cls}"><i style="width:${w.toFixed(1)}%"></i>${label ? `<b>${esc(label)}</b>` : ''}</div>`;
}

export function chipRow(items: Array<{ label: string; value: string; cls?: string }>): string {
  return `<div class="chips">${items.map((i) =>
    `<span class="chip ${i.cls ?? ''}"><em>${esc(i.label)}</em><b>${esc(i.value)}</b></span>`).join('')}</div>`;
}
