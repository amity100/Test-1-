/** Tiny DOM helpers. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function btn(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', `btn ${cls}`.trim(), label);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

export function segmented<T extends string | number>(options: { value: T; label: string }[], current: T, onChange: (v: T) => void): HTMLDivElement {
  const wrap = el('div', 'seg');
  for (const o of options) {
    const b = el('button', o.value === current ? 'active' : '', o.label);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      for (const c of Array.from(wrap.children)) c.classList.remove('active');
      b.classList.add('active');
      onChange(o.value);
    });
    wrap.appendChild(b);
  }
  return wrap;
}

export function field(label: string, control: HTMLElement): HTMLDivElement {
  const f = el('div', 'field');
  const l = el('label', '', label);
  f.append(l, control);
  return f;
}

export function slider(min: number, max: number, step: number, value: number, onChange: (v: number) => void, format: (v: number) => string = (v) => String(v)): HTMLDivElement {
  const wrap = el('div', 'row');
  const input = el('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  const val = el('span', 'muted', format(value));
  val.style.minWidth = '44px';
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    val.textContent = format(v);
    onChange(v);
  });
  input.style.flex = '1';
  wrap.append(input, val);
  return wrap;
}
