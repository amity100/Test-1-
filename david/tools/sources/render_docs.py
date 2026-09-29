#!/usr/bin/env python3
"""Render docs/sources.md from tools/sources/sources_doc.md.tmpl.

Every Hebrew quotation in the dossier is inserted from the verified catalog, so the document is
exact by construction.  Placeholders:
  {{q:ID}}       exact display quote (pieces joined with ' … ')
  {{text:ID}}    full normalized source text
  {{ref:ID}}     Hebrew reference label        {{refen:ID}}  English reference
  {{quote:ID}}   blockquote: quote, reference, gloss, note
  {{AUDIT}}      audit table (from tools/sources/audit_snapshot.json)
  {{CATALOG}}    table of the display catalog (src/content/sources.ts)
  {{REFERENCE}}  table of the research catalog (src/content/sourcesReference.ts)
usage: python3 tools/sources/render_docs.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import verify_sources as V  # noqa: E402

ROOT = HERE.parents[1]
TEMPLATE = HERE / 'sources_doc.md.tmpl'
OUT = ROOT / 'docs' / 'sources.md'
JOIN = ' \u2026 '


def cell(s: str) -> str:
    return (s or '').replace('|', '\\|').replace('\n', ' ')


def main() -> None:
    cat = {}
    for rel, export in V.CATALOGS:
        cat.update(V.load_catalog(rel, export))
    if not cat:
        raise SystemExit('catalog not found - run build_catalog.py first')

    def q(cid: str) -> str:
        e = cat[cid]
        return JOIN.join(e['quote']) if e.get('quote') else e['text']

    def block(cid: str) -> str:
        e = cat[cid]
        lines = [f'> {q(cid)}', f'>', f'> — **{e["ref"]}** · {e["refEn"]} · `{cid}`']
        if e.get('gloss'):
            lines.append(f'>\n> _{e["gloss"]}_')
        if e.get('note'):
            lines.append(f'>\n> Note: {e["note"]}')
        return '\n'.join(lines)

    def audit() -> str:
        path = HERE / 'audit_snapshot.json'
        rows = json.loads(path.read_text(encoding='utf-8'))
        out = ['| # | Location | Kind | Current text (as shipped) | Verdict | Exact text to display | Reference | Catalog id |',
               '|---|---|---|---|---|---|---|---|']
        for i, r in enumerate(rows, 1):
            exact = r['text'] if r['verdict'] == 'OK' else (r.get('expected') or '')
            if r.get('catalog_id') and r['catalog_id'] in cat and r['verdict'] != 'OK':
                exact = q(r['catalog_id'])
            ref = r.get('ref') or r.get('found_in') or ''
            if r.get('catalog_id') in cat:
                ref = cat[r['catalog_id']]['ref']
            verdict = r['verdict'] + (f' — {r["message"]}' if r.get('message') else '')
            out.append(f'| {i} | `{r["file"]}:{r["line"]}` | {r["kind"]} | {cell(r["text"])} | {cell(verdict)} | '
                       f'{cell(exact)} | {cell(ref)} | {("`" + r["catalog_id"] + "`") if r.get("catalog_id") else ""} |')
        return '\n'.join(out)

    def table(export_rel: str, export: str) -> str:
        c = V.load_catalog(export_rel, export)
        out = ['| id | status | reference | displayed text / note |', '|---|---|---|---|']
        for cid, e in c.items():
            shown = q(cid) if e.get('quote') else '(full text; no display quote)'
            out.append(f'| `{cid}` | {e["status"]} | {e["ref"]} · {e["refEn"]} | {cell(shown)} |')
        return '\n'.join(out)

    tmpl = TEMPLATE.read_text(encoding='utf-8')

    def sub(m: re.Match) -> str:
        kind, cid = m.group(1), m.group(2)
        if kind in ('AUDIT', 'CATALOG', 'REFERENCE'):
            return {'AUDIT': audit, 'CATALOG': lambda: table(*V.CATALOGS[0]),
                    'REFERENCE': lambda: table(*V.CATALOGS[1])}[kind]()
        if cid not in cat:
            raise SystemExit(f'unknown catalog id in template: {cid}')
        e = cat[cid]
        return {'q': lambda: q(cid), 'text': lambda: e['text'], 'ref': lambda: e['ref'],
                'refen': lambda: e['refEn'], 'quote': lambda: block(cid)}[kind]()

    out = re.sub(r'\{\{(q|text|ref|refen|quote|AUDIT|CATALOG|REFERENCE)(?::([\w]+))?\}\}', sub, tmpl)
    left = re.findall(r'\{\{[^}]*\}\}', out)
    if left:
        raise SystemExit(f'unresolved placeholders: {left}')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(out, encoding='utf-8')
    print(f'wrote {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
