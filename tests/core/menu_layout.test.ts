import { describe, expect, it } from 'vitest';

// Node built-ins are imported dynamically so the strict tsconfig (no @types/node) stays happy; the CSS can't be
// imported with ?raw here because vitest strips stylesheets.
interface NodeFs {
  readFileSync(p: URL, enc: 'utf8'): string;
}
const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as NodeFs;
const css = fs.readFileSync(new URL('../../src/ui/style.css', import.meta.url), 'utf8');
const menu = fs.readFileSync(new URL('../../src/ui/menu.ts', import.meta.url), 'utf8');

// A CSS / markup contract for the phone menus (no DOM here): the PLAY button must never be pushed off
// the top of a scroller, and must stay in reach while the menu scrolls.

const rules = (sel: string) => [...css.matchAll(/(^|\n)\s*([^{}\n@][^{}]*)\{([^}]*)\}/g)].filter((m) => m[2].split(',').some((x: string) => x.trim() === sel)).map((m) => m[3]);

describe('phone menu layout', () => {
  it('never centres an overflowing menu with justify-content (the top becomes unreachable)', () => {
    for (const body of rules('.menu.on')) expect(body).not.toMatch(/justify-content:\s*center/);
    expect(rules('.menu.main')).toEqual(expect.not.arrayContaining([expect.stringMatching(/justify-content:\s*center/)]));
    expect(css).toMatch(/\.menu\.on > :first-child \{ margin-top: auto; \}/);
    expect(css).toMatch(/\.menu\.on > :last-child \{ margin-bottom: auto; \}/);
  });
  it('the main and pause menus put their primary button in a sticky lead row', () => {
    expect(menu.match(/class="btns lead"><button type="button" class="primary" data-go="(start|resume)"/g)?.length).toBe(2);
    expect(css).toMatch(/\.btns\.lead \{ position: sticky;/);
  });
  it('touch targets in short landscape are at least 44px', () => {
    expect(css).toMatch(/@media \(max-height: 520px\) \{[\s\S]*\.btns button[^{]*\{ min-height: 44px; \}/);
  });
  it('the result cards keep their buttons in reach', () => {
    expect(css).toMatch(/\.m-labend > \.btns\.row[^{]*\{ position: sticky; bottom:/);
  });
  it('the portrait rotate hint never swallows taps', () => {
    expect(css).toMatch(/\.is-touch \.ui::after \{[^}]*pointer-events: none/);
  });
});

describe('phone HUD layout', () => {
  it('the lab chip (top right) stops short of the centred pause button on a narrow screen', () => {
    expect(css).toMatch(/max-width: min\(260px, calc\(50vw - 36px - var\(--sr\)\)\)/);
  });
  it('the one-column menu cannot grow wider than the screen', () => {
    expect(css).toMatch(/\.m-main, \.m-pause \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  });
});
