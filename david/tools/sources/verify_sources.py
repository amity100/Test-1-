#!/usr/bin/env python3
"""Verify that every scripture / rabbinic quotation in DAVID is identical to its source.

  1. Re-fetches the source texts from Sefaria's export (GCS bucket) - `--cache-only` to skip.
  2. Checks every entry of src/content/sources.ts and src/content/sourcesReference.ts:
       * `text` equals the freshly normalized source at `refEn`,
       * every `quote` piece is an exact contiguous substring of `text` (pieces in order),
       * the Hebrew `ref` label matches `refEn`.
  3. Scans src/**/*.ts, *.html and README.md for Hebrew (pointed) strings presented as quotations:
       ui.verse(text, ref) / ui.caption(title, '"quote" · ref') / ui.toast(title, 'quote<small>ref</small>')
       / '"quote"<span>ref</span>' HTML / README '"quote" (ref)' / any other "quoted" pointed fragment,
     and reports every string that is not an exact substring of its cited verse(s), with the exact
     corrected text when it can be derived.
Exit status: 0 = all quotations exact (warnings allowed), 1 = at least one mismatch, 2 = setup error.

usage: python3 tools/sources/verify_sources.py [--cache-only] [--cache DIR] [--quiet] [--json FILE]
"""
from __future__ import annotations

import argparse
import difflib
import json
import re
import subprocess
import sys
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import sourcelib as L  # noqa: E402

ROOT = HERE.parents[1]
CATALOGS = [('src/content/sources.ts', 'SOURCES'), ('src/content/sourcesReference.ts', 'REFERENCE_SOURCES')]
NFC = lambda s: unicodedata.normalize('NFC', s)  # noqa: E731


# ============================================================================ catalog loading
def load_catalog(rel: str, export: str) -> dict:
    path = ROOT / rel
    if not path.exists():
        return {}
    js = (f"import(process.argv[1]).then(m => process.stdout.write(JSON.stringify(m[{json.dumps(export)}])))"
          ".catch(e => { console.error(e); process.exit(3); })")
    for flags in (['--experimental-strip-types', '--no-warnings'], []):
        try:
            r = subprocess.run(['node', *flags, '-e', js, path.as_uri()], capture_output=True, text=True,
                               timeout=60, cwd=ROOT)
            if r.returncode == 0 and r.stdout.strip():
                return json.loads(r.stdout)
        except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError):
            pass
    return parse_catalog_fallback(path.read_text(encoding='utf-8'))


def parse_catalog_fallback(src: str) -> dict:
    """Minimal parser for the generated format (used only if node is unavailable)."""
    out: dict = {}
    for m in re.finditer(r'\n  (\w+): \{\n(.*?)\n  \},', src, re.S):
        body = m.group(2)
        e: dict = {}
        for k, v in re.findall(r'^    (\w+): ("(?:[^"\\]|\\.)*"),$', body, re.M):
            e[k] = json.loads(v)
        q = re.search(r'^    quote: \[\n(.*?)\n    \],$', body, re.S | re.M)
        if q:
            e['quote'] = [json.loads(x.strip().rstrip(',')) for x in q.group(1).split('\n') if x.strip()]
        out[m.group(1)] = e
    return out


def parse_ref_en(ref_en: str):
    m = re.match(r'^(.*?) (\d+)([ab])?(?::(\d+))?(?:-(\d+))?(?::(\d+))?$', ref_en)
    if not m:
        return None
    title = m.group(1)
    if title not in L.WORKS:
        return None
    return title, int(m.group(2)), m.group(3), int(m.group(4)) if m.group(4) else None, \
        int(m.group(5)) if m.group(5) else None, int(m.group(6)) if m.group(6) else None


def source_for_entry(C: L.Corpus, e: dict) -> tuple[str, str]:
    """Return (fresh normalized text, expected Hebrew label) for a catalog entry."""
    p = parse_ref_en(e['refEn'])
    if not p:
        raise ValueError(f'unparseable refEn {e["refEn"]!r}')
    title, a, side, b, c, d = p
    w = L.WORKS[title]
    if w.kind == 'tanakh':
        v1, v2 = b, c or b
        return C.verses(title, a, v1, v2), L.tanakh_label(w, a, v1, v2 if v2 != v1 else None)
    if w.kind == 'midrash':
        return C.section(title, a, b), f'{w.he} {L.heb_num(a)}, {L.heb_num(b)}'
    if w.kind == 'talmud':
        return C.daf(title, a, side, b), L.daf_label(w, a, side)
    seg = d
    return C.comment(title, a, b, seg), f'{w.he} {L.heb_num(a)}, {L.heb_num(b)}'


# ============================================================================ TS literal scanning
@dataclass
class Lit:
    start: int
    end: int
    value: str
    line: int


def ts_literals(src: str) -> list[Lit]:
    """String / template literals of a TS file (template `${...}` parts become U+FFFC)."""
    out: list[Lit] = []
    i, n = 0, len(src)
    esc = {'n': '\n', 't': '\t', 'r': '\r', '\\': '\\', "'": "'", '"': '"', '`': '`', '0': '\0'}

    def line_of(pos: int) -> int:
        return src.count('\n', 0, pos) + 1

    while i < n:
        c = src[i]
        if src.startswith('//', i):
            j = src.find('\n', i)
            i = n if j < 0 else j
            continue
        if src.startswith('/*', i):
            j = src.find('*/', i + 2)
            i = n if j < 0 else j + 2
            continue
        if c in '\'"`':
            q, j, buf = c, i + 1, []
            ok = False
            while j < n:
                ch = src[j]
                if ch == '\\' and j + 1 < n:
                    nx = src[j + 1]
                    if nx == 'u' and src.startswith('{', j + 2):
                        k = src.index('}', j + 2)
                        buf.append(chr(int(src[j + 3:k], 16)))
                        j = k + 1
                        continue
                    if nx == 'u':
                        buf.append(chr(int(src[j + 2:j + 6], 16)))
                        j += 6
                        continue
                    buf.append(esc.get(nx, nx))
                    j += 2
                    continue
                if ch == q:
                    ok = True
                    break
                if q != '`' and ch == '\n':
                    break  # not a real string (regex literal etc.) - resync
                if q == '`' and src.startswith('${', j):
                    depth, j = 1, j + 2
                    while j < n and depth:
                        if src[j] == '{':
                            depth += 1
                        elif src[j] == '}':
                            depth -= 1
                        elif src[j] in '\'"`':
                            qq, j = src[j], j + 1
                            while j < n and src[j] != qq:
                                j += 2 if src[j] == '\\' else 1
                        j += 1
                    buf.append('￼')
                    continue
                buf.append(ch)
                j += 1
            if ok:
                out.append(Lit(i, j + 1, ''.join(buf), line_of(i)))
                i = j + 1
            else:
                i += 1
            continue
        i += 1
    return out


# ============================================================================ checking
@dataclass
class Finding:
    file: str
    line: int
    kind: str
    text: str
    ref: str = ''
    verdict: str = 'OK'          # OK | FAIL | WARN
    message: str = ''
    expected: str = ''
    found_in: str = ''
    catalog_id: str = ''


@dataclass
class Checker:
    C: L.Corpus
    catalog: dict
    findings: list = field(default_factory=list)

    def cited_text(self, ref_label: str):
        r = L.parse_ref(ref_label)
        if not r:
            return None, None
        return r, self.C.text_for_ref(r)

    @staticmethod
    def clean(q: str) -> str:
        q = re.sub(r'<[^>]+>', ' ', q)
        q = q.replace('&nbsp;', ' ')
        q = re.sub(r'\s+', ' ', q).strip()
        q = q.strip('"“”״„ ')
        return NFC(q)

    @staticmethod
    def pieces(q: str) -> list[str]:
        return [p.strip() for p in re.split(r'\s*(?:\.\.\.|…)\s*', q) if p.strip()]

    def exact(self, q: str, text: str) -> bool:
        pos = 0
        for p in self.pieces(q):
            k = NFC(text).find(p, pos)
            if k < 0:
                return False
            pos = k + len(p)
        return True

    def suggest(self, q: str, text: str) -> str:
        out = []
        for p in self.pieces(q):
            ex = L.find_exact(text, p)
            if ex is None:
                words = text.split(' ')
                n = len(p.split(' '))
                best, best_r = '', 0.0
                for size in range(max(1, n - 2), n + 3):
                    for i in range(0, max(1, len(words) - size + 1)):
                        cand = ' '.join(words[i:i + size])
                        r = difflib.SequenceMatcher(None, L.skeleton(p), L.skeleton(cand)).ratio()
                        if r > best_r:
                            best, best_r = cand, r
                ex = f'{best} (~{best_r:.0%})' if best_r >= 0.6 else '?'
            out.append(ex)
        return L.ELLIPSIS.join(out)

    def catalog_match(self, q: str) -> str:
        q = re.sub(r' \(~\d+%\)', '', q)
        for cid, e in self.catalog.items():
            if e.get('quote') and L.ELLIPSIS.join(e['quote']) == q:
                return cid
        return ''

    def check_quote(self, file: str, line: int, kind: str, raw_q: str, ref: str) -> Finding:
        q = self.clean(raw_q)
        f = Finding(file, line, kind, q, ref)
        r, text = self.cited_text(ref)
        if r is None:
            f.verdict, f.message = 'FAIL', f'cannot parse reference {ref!r}'
        elif text is None:
            f.verdict, f.message = 'FAIL', f'cannot resolve reference {ref!r}'
        elif self.exact(q, text):
            f.verdict = 'OK'
            if r.work.kind == 'tanakh' and r.v1 is None:
                f.verdict, f.message = 'WARN', 'reference gives the chapter only; cite the verse(s)'
                f.expected = self.best_label(q, r)
        else:
            f.verdict = 'FAIL'
            f.message = 'not an exact substring of the cited source'
            f.expected = self.suggest(q, text)
            if r.work.kind == 'tanakh' and r.ch is not None:
                where = self.best_label(q, r)
                if where:
                    f.message = f'the text is exact but belongs to {where}'
                    f.expected = q
        f.catalog_id = self.catalog_match(q if f.verdict != 'FAIL' else f.expected)
        self.findings.append(f)
        return f

    def best_label(self, q: str, r: L.Ref) -> str:
        chapter = self.C.raw(r.work.key)[r.ch - 1]
        verses = [self.C.verse(r.work.key, r.ch, v) for v in range(1, len(chapter) + 1)]
        for size in range(1, 4):
            for a in range(len(verses) - size + 1):
                b = a + size - 1
                if self.exact(q, ' '.join(verses[a:b + 1])):
                    return L.tanakh_label(r.work, r.ch, a + 1, b + 1 if b != a else None)
        return ''

    def check_fragment(self, file: str, line: int, raw_q: str, corpus: list[tuple[str, str]]) -> Finding:
        q = self.clean(raw_q)
        f = Finding(file, line, 'quoted fragment (no reference)', q)
        for label, text in corpus:
            if self.exact(q, text):
                f.verdict, f.found_in = 'OK', label
                break
        else:
            if len(q.split()) == 1:
                # one quoted word that is not in the cited sources: a UI label ("קֶלַע"), not a quotation
                f.verdict, f.message = 'WARN', 'single quoted word not found in the cited sources (label?)'
            else:
                f.verdict, f.message = 'FAIL', 'quoted fragment not found verbatim in any cited source'
            for label, text in corpus:
                ex = L.find_exact(text, q)
                if ex:
                    f.expected, f.found_in = ex, label
                    break
        f.catalog_id = self.catalog_match(f.expected if f.verdict == 'FAIL' and f.expected else q)
        self.findings.append(f)
        return f


REF_TAIL = r'([^"<>]{3,40})'


def chapter_corpus(C: L.Corpus, refs: list[str], catalog: dict) -> list[tuple[str, str]]:
    out, seen = [], set()
    for ref in refs:
        r = L.parse_ref(ref)
        if not r or r.ch is None:
            continue
        key = (r.work.key, r.ch)
        if key in seen:
            continue
        seen.add(key)
        if r.work.kind == 'tanakh':
            raw = C.raw(r.work.key)
            if not 1 <= r.ch <= len(raw):
                continue
            chapter = raw[r.ch - 1]
            for v in range(1, len(chapter) + 1):
                out.append((L.tanakh_label(r.work, r.ch, v), C.verse(r.work.key, r.ch, v)))
        else:
            t = C.text_for_ref(L.Ref(r.work, r.ch))
            if t:
                out.append((f'{r.work.he} {L.heb_num(r.ch)}', t))
    for cid, e in catalog.items():
        out.append((f'{e["ref"]} [{cid}]', e['text']))
    return out


def scan_ts(ck: Checker, path: Path, rel: str) -> None:
    src = path.read_text(encoding='utf-8')
    lits = ts_literals(src)
    by_start = {l.start: l for l in lits}
    handled: set[int] = set()
    cited: list[str] = []

    def next_lit(pos: int):
        m = re.compile(r'\s*').match(src, pos)
        return by_start.get(m.end())

    def after_comma(lit: Lit):
        m = re.compile(r'\s*,\s*').match(src, lit.end)
        return by_start.get(m.end()) if m else None

    # A0) catalog use: ui.verse(quoteText('id'), 'literal ref') - the literal ref must equal the catalog ref
    for m in re.finditer(r"\.verse\(\s*quoteText\(\s*['\"](\w+)['\"]\s*\)\s*,\s*", src):
        b = by_start.get(m.end())
        e = ck.catalog.get(m.group(1))
        line = src.count('\n', 0, m.start()) + 1
        if e is not None and b is not None:
            handled.add(b.start)
            ok = NFC(b.value) == NFC(e['ref'])
            ck.findings.append(Finding(rel, line, 'catalog use', L.ELLIPSIS.join(e.get('quote') or []), b.value,
                                       'OK' if ok else 'FAIL', '' if ok else 'reference differs from the catalog',
                                       expected='' if ok else e['ref'], catalog_id=m.group(1)))
    for m in re.finditer(r"(?:quoteText|verseArgs|sourceRef|quoteWithRef|sourceEntry)\(\s*['\"](\w+)['\"]", src):
        if m.group(1) not in ck.catalog:
            ck.findings.append(Finding(rel, src.count('\n', 0, m.start()) + 1, 'catalog use', m.group(1), '', 'FAIL',
                                       'unknown catalog id'))
    # A) ui.verse(text, ref)
    for m in re.finditer(r'\.verse\(', src):
        a = next_lit(m.end())
        if not a:
            continue
        b = after_comma(a)
        handled.add(a.start)
        if b:
            handled.add(b.start)
            cited.append(b.value)
            ck.check_quote(rel, a.line, 'ui.verse', a.value, b.value)
        else:
            ck.findings.append(Finding(rel, a.line, 'ui.verse', ck.clean(a.value), '', 'FAIL', 'verse without a literal reference'))
    # B) ui.caption(title, '"quote" · ref'),  C) ui.toast(title, 'quote<small>ref</small>')
    for m in re.finditer(r'\.(caption|toast)\(', src):
        a = next_lit(m.end())
        b = after_comma(a) if a else None
        if not b:
            continue
        if m.group(1) == 'caption':
            mm = re.match(r'^\s*["“״](.+?)["”״]\s*[·•|\-—]\s*(.+)$', b.value)
            if mm:
                handled.add(b.start)
                cited.append(mm.group(2))
                ck.check_quote(rel, b.line, 'ui.caption', mm.group(1), mm.group(2))
        else:
            mm = re.match(r'^(.*?)<small>(.*?)</small>\s*$', b.value, re.S)
            if mm and L.has_niqqud(mm.group(1)):
                handled.add(b.start)
                ref = mm.group(2)
                if re.match(r'^\s*(עַל פִּי|על פי|ע"פ|ע״פ|עַל־פִּי)', ref):
                    r = L.parse_ref(ref)
                    alt = ''
                    if r is not None:
                        want = f'{r.work.en} {r.ch}:{r.v1}' if r.v1 else f'{r.work.en} {r.ch}'
                        alt = next((cid for cid, e in ck.catalog.items()
                                    if e.get('refEn') == want and e.get('status') == 'in-game'), '')
                    ck.findings.append(Finding(rel, b.line, 'ui.toast', ck.clean(mm.group(1)), ref, 'FAIL',
                                               'paraphrase labelled "according to" a source - replace with an exact quotation',
                                               expected=L.ELLIPSIS.join(ck.catalog[alt]['quote']) if alt else '(see catalog)',
                                               catalog_id=alt))
                else:
                    cited.append(ref)
                    ck.check_quote(rel, b.line, 'ui.toast', mm.group(1), ref)
    # D) HTML '"quote"<span>ref</span>'
    for l in lits:
        for mm in re.finditer(r'["“״]([^"<>”״]+)["”״]\s*<span>([^<]+)</span>', l.value):
            if L.has_niqqud(mm.group(1)):
                handled.add(l.start)
                cited.append(mm.group(2))
                ck.check_quote(rel, l.line + l.value[:mm.start()].count('\n'), 'html quote', mm.group(1), mm.group(2))
    # E) other quoted pointed fragments, F) unmarked scripture in narration
    corpus = None
    for l in lits:
        if l.start in handled or not L.has_niqqud(l.value):
            continue
        frags = [mm for mm in re.finditer(r'["“״]([^"”״<>]{2,})["”״]', l.value)
                 if L.has_niqqud(mm.group(1))]
        if frags:
            corpus = corpus or chapter_corpus(ck.C, cited, ck.catalog)
            for mm in frags:
                ck.check_fragment(rel, l.line, mm.group(1), corpus)
    # remember narration strings for the unmarked-quote heuristic
    for l in lits:
        if l.start in handled or not L.has_niqqud(l.value):
            continue
        plain = re.sub(r'["“”״][^"“”״]*["“”״]', ' ', l.value)
        plain = re.sub(r'<[^>]+>', ' ', plain)
        sk = L.skeleton(plain)
        if len(sk.split()) >= 4:
            ck_narration.append((rel, l.line, NFC(re.sub(r'\s+', ' ', plain).strip()), cited[:]))


ck_narration: list = []


def scan_markdown(ck: Checker, path: Path, rel: str) -> None:
    src = path.read_text(encoding='utf-8')
    refs_in_file = [m.group(0) for m in re.finditer(r'(?:שמ״א|שמ״ב|שמואל [אב]׳?|בראשית|שופטים|תהלים|רות)\s+[א-ת]{1,3}(?:,\s*[א-ת]{1,3}(?:[–-][א-ת]{1,3})?)?', src)]
    corpus = None
    for ln, line in enumerate(src.split('\n'), 1):
        for mm in re.finditer(r'"([^"]+)"(\s*(?:\(([^)]+)\)|,\s*([^)]+)\)))?', line):
            q = mm.group(1)
            if not L.has_niqqud(q):
                continue
            if line.lstrip().startswith('|') and len(q.split()) == 1:
                continue  # button label in a markdown table
            ref = mm.group(3) or mm.group(4)
            if ref and L.parse_ref(ref):
                ck.check_quote(rel, ln, 'markdown quote', q, ref)
            else:
                corpus = corpus or chapter_corpus(ck.C, refs_in_file, ck.catalog)
                ck.check_fragment(rel, ln, q, corpus)


def narration_warnings(ck: Checker) -> None:
    """Warn when an unquoted narration string reproduces (consonantally) 4+ words of a cited verse."""
    for rel, line, text, cited in ck_narration:
        corpus = chapter_corpus(ck.C, cited, {}) if cited else []
        sk = L.skeleton(text)
        words = sk.split()
        for label, verse in corpus:
            vs = ' ' + L.skeleton(verse) + ' '
            for n in range(len(words), 3, -1):
                hit = next((' '.join(words[i:i + n]) for i in range(len(words) - n + 1)
                            if ' ' + ' '.join(words[i:i + n]) + ' ' in vs), None)
                if hit:
                    ck.findings.append(Finding(rel, line, 'narration', text, label, 'WARN',
                                               f'narration reproduces scripture wording ("{hit}") without quotation marks'))
                    break
            else:
                continue
            break


# ============================================================================ main
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--cache-only', action='store_true', help='use cached sources, do not download')
    ap.add_argument('--cache', default=L.DEFAULT_CACHE)
    ap.add_argument('--quiet', action='store_true', help='print only problems and the summary')
    ap.add_argument('--json', help='also write the findings as JSON to this file')
    args = ap.parse_args()

    fetch_log: list[str] = []
    fetcher = L.Fetcher(args.cache, 'offline' if args.cache_only else 'refresh', log=fetch_log.append)
    C = L.Corpus(fetcher)
    fails = warns = 0

    # ---- 1. catalogs
    catalog: dict = {}
    print('== catalog entries (src/content/sources*.ts)')
    for rel, export in CATALOGS:
        cat = load_catalog(rel, export)
        if not cat:
            print(f'  {rel}: not found or empty')
            continue
        for cid, e in cat.items():
            probs = []
            if e.get('id') != cid:
                probs.append(f'id {e.get("id")!r} != key')
            try:
                fresh, label = source_for_entry(C, e)
            except Exception as ex:  # noqa: BLE001
                probs.append(f'cannot load source: {ex}')
                fresh, label = None, None
            if fresh is not None and NFC(e.get('text', '')) != fresh:
                sm = difflib.SequenceMatcher(None, e.get('text', ''), fresh)
                d = [f'{e["text"][a:b]!r}->{fresh[c:dd]!r}' for t, a, b, c, dd in sm.get_opcodes() if t != 'equal'][:3]
                probs.append('text differs from the source: ' + '; '.join(d))
            if label and e.get('ref') != label:
                probs.append(f'ref label {e.get("ref")!r} != {label!r}')
            pos = 0
            for p in e.get('quote') or []:
                k = e.get('text', '').find(p, pos)
                if k < 0:
                    probs.append(f'quote piece not in text (or out of order): {p}')
                else:
                    pos = k + len(p)
            status = 'FAIL' if probs else 'OK'
            fails += bool(probs)
            if probs or not args.quiet:
                print(f'  [{status}] {cid:32s} {e.get("refEn", "")}' + ''.join(f'\n         - {x}' for x in probs))
        catalog.update(cat)

    # ---- 2. game strings
    ck = Checker(C, catalog)
    files = sorted((ROOT / 'src').rglob('*.ts')) + sorted(ROOT.glob('*.html')) + sorted((ROOT / 'src').rglob('*.html'))
    for p in files:
        rel = str(p.relative_to(ROOT))
        if rel.startswith('src/content/'):
            continue
        if p.suffix == '.html':
            scan_markdown(ck, p, rel)
        else:
            scan_ts(ck, p, rel)
    if (ROOT / 'README.md').exists():
        scan_markdown(ck, ROOT / 'README.md', 'README.md')
    narration_warnings(ck)

    print('\n== quotations found in game files (src/**/*.ts, *.html, README.md)')
    for f in ck.findings:
        if f.verdict == 'FAIL':
            fails += 1
        elif f.verdict == 'WARN':
            warns += 1
        if args.quiet and f.verdict == 'OK':
            continue
        head = f'  [{f.verdict}] {f.file}:{f.line} ({f.kind})'
        body = f'\n         text:     {f.text}'
        if f.ref:
            body += f'\n         ref:      {f.ref}'
        if f.found_in:
            body += f'\n         found in: {f.found_in}'
        if f.message:
            body += f'\n         problem:  {f.message}'
        if f.expected:
            body += f'\n         exact:    {f.expected}'
        if f.catalog_id:
            body += f'\n         catalog:  {f.catalog_id}'
        print(head + body)

    fetched = sorted({f'{k[0]} / {k[1]}: {v}' for k, v in fetcher.status.items()})
    print('\n== sources used')
    for s in fetched:
        print('  ' + s)
    for s in fetch_log:
        print('  ' + s)
    print(f'\nSUMMARY: {len(catalog)} catalog entries, {len(ck.findings)} game strings checked, '
          f'{fails} mismatch(es), {warns} warning(s)')
    if args.json:
        Path(args.json).write_text(json.dumps([f.__dict__ for f in ck.findings], ensure_ascii=False, indent=1),
                                   encoding='utf-8')
    return 1 if fails else 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except RuntimeError as e:
        print(f'ERROR: {e}', file=sys.stderr)
        sys.exit(2)
