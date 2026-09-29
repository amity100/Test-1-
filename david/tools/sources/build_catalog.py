#!/usr/bin/env python3
"""Build src/content/sources.ts and src/content/sourcesReference.ts from catalog_spec.py.

Every text is taken from Sefaria's export and normalized with sourcelib.normalize_* ; every quote
piece in the spec is an unpointed skeleton that is resolved to the exact pointed substring of the
normalized text (word-aligned).  Anything that cannot be resolved aborts the build.

usage:  python3 tools/sources/build_catalog.py [--cache-only] [--cache DIR]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import sourcelib as L  # noqa: E402
import catalog_spec as S  # noqa: E402

ROOT = HERE.parents[1]
OUT_DISPLAY = ROOT / 'src' / 'content' / 'sources.ts'
OUT_REFERENCE = ROOT / 'src' / 'content' / 'sourcesReference.ts'


def resolve(C: L.Corpus, e: dict) -> dict:
    src = e['src']
    work = L.WORKS[src[0]]
    kq: list[dict] = []
    cross = ''
    if work.kind == 'tanakh':
        ch, v1 = src[1], src[2]
        v2 = src[3] if len(src) > 3 else v1
        parts, wlc_parts = [], []
        for v in range(v1, v2 + 1):
            parts.append(C.verse(work.key, ch, v))
            for k, q in L.kq_log:
                kq.append({'ketiv': k, 'qere': L.normalize_tanakh(q) if q else ''})
            wlc_parts.append(C.verse(work.key, ch, v, L.WLC))
        text = ' '.join(parts)
        wlc = ' '.join(wlc_parts)
        ref = L.tanakh_label(work, ch, v1, v2 if v2 != v1 else None)
        ref_en = L.tanakh_label_en(work, ch, v1, v2 if v2 != v1 else None)
        edition = work.primary
    elif work.kind == 'midrash':
        ch, sec = src[1], src[2]
        text = C.section(work.key, ch, sec)
        wlc = None
        ref = f'{work.he} {L.heb_num(ch)}, {L.heb_num(sec)}'
        ref_en = f'{work.en} {ch}:{sec}'
        edition = work.primary
    elif work.kind == 'talmud':
        daf, side, seg = src[1], src[2], src[3]
        text = C.daf(work.key, daf, side, seg)
        wlc = None
        ref = L.daf_label(work, daf, side)
        ref_en = f'{work.en} {daf}{side}:{seg}'
        edition = work.primary
    else:  # targum / commentary
        ch, v = src[1], src[2]
        seg = src[3] if len(src) > 3 else None
        text = C.comment(work.key, ch, v, seg)
        wlc = None
        ref = f'{work.he} {L.heb_num(ch)}, {L.heb_num(v)}'
        ref_en = f'{work.en} {ch}:{v}' + (f':{seg}' if seg else '')
        edition = work.primary

    pieces = None
    if e.get('q'):
        pieces = []
        occ = e.get('occ') or [1] * len(e['q'])
        for i, sk in enumerate(e['q']):
            exact = L.find_exact(text, sk, occ[i] if i < len(occ) else 1)
            if exact is None:
                raise SystemExit(f'[{e["id"]}] quote piece not found in {ref_en}:\n  skeleton: {sk}\n  text:     {text}')
            pieces.append(exact)
        # cross-edition check (information only)
        if wlc is not None:
            diffs = [p for p in pieces if p not in wlc]
            cross = 'WLC identical' if not diffs else 'WLC differs in: ' + ' | '.join(diffs)
        elif work.key == 'Shemot Rabbah':
            daat = ' '.join(L.normalize_rabbinic(x) for x in C.raw(work.key, L.DAAT_SR)[ch - 1])
            dsk = L.skeleton(daat)
            miss = [p for p in pieces if L.skeleton(p) not in dsk]
            cross = ('Daat (public domain) consonantal text identical' if not miss
                     else 'Daat differs in: ' + ' | '.join(miss))
    elif wlc is not None:
        cross = 'WLC identical' if text == wlc else 'WLC differs (whole text; no display quote)'

    meta = C.meta(work.key)
    out = {
        'id': e['id'], 'kind': work.kind, 'ref': ref, 'refEn': ref_en, 'edition': edition,
        'license': meta.get('license') or 'unknown', 'text': text,
    }
    if pieces:
        out['quote'] = pieces
    out['status'] = e['status']
    for k in ('use', 'gloss', 'note'):
        if e.get(k):
            out[k] = e[k]
    if kq:
        out['kq'] = kq
    if cross:
        out['crossCheck'] = cross
    return out


def ts_value(v, indent: str) -> str:
    if isinstance(v, str):
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, list):
        if all(isinstance(x, str) for x in v):
            inner = ',\n'.join(indent + '  ' + json.dumps(x, ensure_ascii=False) for x in v)
            return '[\n' + inner + ',\n' + indent + ']'
        inner = ',\n'.join(indent + '  ' + ts_value(x, indent + '  ') for x in v)
        return '[\n' + inner + ',\n' + indent + ']'
    if isinstance(v, dict):
        return '{ ' + ', '.join(f'{k}: {ts_value(x, indent)}' for k, x in v.items()) + ' }'
    raise TypeError(type(v))


def ts_entries(entries: list[dict]) -> str:
    out = []
    for e in entries:
        lines = [f'  {e["id"]}: {{']
        for k, v in e.items():
            lines.append(f'    {k}: {ts_value(v, "    ")},')
        lines.append('  },')
        out.append('\n'.join(lines))
    return '\n'.join(out)


HEADER = '''// ---------------------------------------------------------------------------------------------
// AUTO-GENERATED by tools/sources/build_catalog.py from tools/sources/catalog_spec.py.
// Do not edit by hand. Change the spec, then run:
//     python3 tools/sources/build_catalog.py && python3 tools/sources/verify_sources.py
// `text` is the exact normalized source (rules in docs/sources.md); every `quote` piece is an
// exact contiguous substring of `text`.
// ---------------------------------------------------------------------------------------------
'''

DISPLAY_TEMPLATE = HEADER + '''
export type SourceKind = 'tanakh' | 'midrash' | 'talmud' | 'targum' | 'commentary';

/**
 * in-game        - shown in the game today (use this corrected wording)
 * intro | ending - recommended for the new cinematic intro / the chapter end
 * reference      - research only (art direction); not meant to be displayed
 * avoid-in-intro - must NOT be shown or depicted in the chapter-1 intro (chronology)
 * docs           - quoted in README / docs
 */
export type SourceStatus = 'in-game' | 'intro' | 'ending' | 'reference' | 'avoid-in-intro' | 'docs';

export interface SourceEntry {
  /** Stable id - identical to the catalog key. */
  readonly id: string;
  readonly kind: SourceKind;
  /** Hebrew reference label for display, e.g. 'שְׁמוּאֵל א׳ טז, יב'. */
  readonly ref: string;
  /** English reference (Hebrew/Masoretic verse numbering), e.g. 'I Samuel 16:12'. */
  readonly refEn: string;
  /** Sefaria edition (versionTitle) the text was taken from. */
  readonly edition: string;
  /** License of that digital edition as declared by Sefaria. */
  readonly license: string;
  /** Exact normalized source text of the whole verse(s) / passage segment. */
  readonly text: string;
  /** Exact contiguous substring(s) of `text` that are displayed; pieces are joined with QUOTE_JOINER. */
  readonly quote?: readonly string[];
  readonly status: SourceStatus;
  /** Where / how it is (or should be) used. */
  readonly use?: string;
  /** Short English gloss - a translation aid, not a quotation. */
  readonly gloss?: string;
  /** Context, chronology and ketiv/qere caveats. */
  readonly note?: string;
  /** Ketiv/qere pairs inside `text` (ketiv unpointed; qere as printed in `text`). */
  readonly kq?: readonly { readonly ketiv: string; readonly qere: string }[];
  /** Result of the cross-edition check done at build time. */
  readonly crossCheck?: string;
}

/** Joiner shown between two non-contiguous exact pieces of one quotation. */
export const QUOTE_JOINER = ' \\u2026 ';

export const SOURCES = {
__ENTRIES__
} as const satisfies Record<string, SourceEntry>;

export type SourceId = keyof typeof SOURCES;

export function sourceEntry(id: SourceId): SourceEntry {
  return SOURCES[id];
}

/** The exact on-screen quotation (pieces joined with ' … '); falls back to the full text. */
export function quoteText(id: SourceId): string {
  const e: SourceEntry = SOURCES[id];
  return e.quote && e.quote.length ? e.quote.join(QUOTE_JOINER) : e.text;
}

/** Hebrew reference label, e.g. 'שְׁמוּאֵל א׳ יז, לד'. */
export function sourceRef(id: SourceId): string {
  return SOURCES[id].ref;
}

/** Arguments for UI.verse(text, ref, seconds): `ui.verse(...verseArgs('s1_17_34_bear'), 5)`. */
export function verseArgs(id: SourceId): [text: string, ref: string] {
  return [quoteText(id), SOURCES[id].ref];
}

/** '"quotation" · reference' - for caption subtitles. */
export function quoteWithRef(id: SourceId, sep = ' \\u00b7 '): string {
  return `"${quoteText(id)}"${sep}${SOURCES[id].ref}`;
}
'''

REFERENCE_TEMPLATE = HEADER + '''// Research catalog (art direction / fact checking). NOT imported by the game - keep it that way so
// these texts (some under non-commercial licenses) are not shipped in the bundle.

import type { SourceEntry } from './sources';

export const REFERENCE_SOURCES = {
__ENTRIES__
} as const satisfies Record<string, SourceEntry>;

export type ReferenceSourceId = keyof typeof REFERENCE_SOURCES;
'''


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache-only', action='store_true', help='do not download; use the cache')
    ap.add_argument('--cache', default=L.DEFAULT_CACHE)
    args = ap.parse_args()
    C = L.Corpus(L.Fetcher(args.cache, 'offline' if args.cache_only else 'cache'))
    ids = set()
    display, reference = [], []
    for group, sink in ((S.DISPLAY, display), (S.REFERENCE, reference)):
        for e in group:
            if e['id'] in ids:
                raise SystemExit(f'duplicate id {e["id"]}')
            ids.add(e['id'])
            sink.append(resolve(C, e))
    OUT_DISPLAY.parent.mkdir(parents=True, exist_ok=True)
    OUT_DISPLAY.write_text(DISPLAY_TEMPLATE.replace('__ENTRIES__', ts_entries(display)), encoding='utf-8')
    OUT_REFERENCE.write_text(REFERENCE_TEMPLATE.replace('__ENTRIES__', ts_entries(reference)), encoding='utf-8')
    print(f'wrote {OUT_DISPLAY.relative_to(ROOT)} ({len(display)} entries), '
          f'{OUT_REFERENCE.relative_to(ROOT)} ({len(reference)} entries)')
    for e in display + reference:
        cc = e.get('crossCheck', '')
        if cc and 'identical' not in cc:
            print(f'  cross-check {e["id"]}: {cc}')
    if L.trivial_log:
        print('  unresolved trivial ketiv/qere forms (kept as printed):', sorted(set(L.trivial_log)))


if __name__ == '__main__':
    main()
