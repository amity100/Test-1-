#!/usr/bin/env python3
"""Shared helpers for the DAVID source-text tooling.

  * fetching Sefaria's public export (JSON files in the `sefaria-export` GCS bucket,
    indexed by https://raw.githubusercontent.com/Sefaria/Sefaria-Export/master/books.json)
  * the display normalization rules for Hebrew source texts (documented in docs/sources.md)
  * Hebrew numerals and reference labels ("שְׁמוּאֵל א׳ טז, יב")
  * locating an exact quotation inside a normalized text from its unpointed skeleton

Pure standard library (Python 3.9+).
"""
from __future__ import annotations

import html
import json
import os
import re
import subprocess
import sys
import unicodedata
import urllib.parse
import urllib.request
from dataclasses import dataclass, field

BUCKET = 'https://storage.googleapis.com/sefaria-export/json/'
BOOKS_INDEX = 'https://raw.githubusercontent.com/Sefaria/Sefaria-Export/master/books.json'
DEFAULT_CACHE = os.environ.get('DAVID_SOURCES_CACHE') or os.path.join(
    os.path.expanduser('~'), '.cache', 'david-sources')

# Edition (Sefaria "versionTitle") names
MAM = 'Miqra according to the Masorah'          # Aleppo-Codex based; Sefaria's default Hebrew Tanakh
WLC = "Tanach with Ta'amei Hamikra"             # Westminster Leningrad Codex (tanach.us), public domain
TE = 'Midrash Rabbah -- TE'                     # Torat Emet, vocalized
DAAT_SR = 'Daat Shemot Rabbah'                  # daat.ac.il, unvocalized, public domain
DAVIDSON = 'William Davidson Edition - Vocalized Aramaic'   # Koren / Steinsaltz, vocalized by Dicta
WIKI_BAVLI = 'Wikisource Talmud Bavli'          # unvocalized (Vilna text)
MERGED = 'merged'

GERESH = '׳'
GERSHAYIM = '״'
MAQAF = '־'
ELLIPSIS = ' … '    # joiner between two exact pieces of one quotation


@dataclass(frozen=True)
class Work:
    key: str            # Sefaria title
    path: str           # category path inside the bucket
    he: str             # Hebrew label (pointed) used in on-screen references
    en: str             # English label used in refEn
    kind: str           # tanakh | midrash | talmud | targum | commentary
    primary: str        # edition used for the catalog text
    cross: tuple = ()   # editions used for cross-checking
    names: tuple = field(default_factory=tuple)  # unpointed Hebrew names accepted when parsing refs


WORKS: dict[str, Work] = {w.key: w for w in [
    Work('Genesis', 'Tanakh/Torah/Genesis', 'בְּרֵאשִׁית', 'Genesis', 'tanakh', MAM, (WLC,), ('בראשית',)),
    Work('Exodus', 'Tanakh/Torah/Exodus', 'שְׁמוֹת', 'Exodus', 'tanakh', MAM, (WLC,), ('שמות',)),
    Work('Numbers', 'Tanakh/Torah/Numbers', 'בְּמִדְבַּר', 'Numbers', 'tanakh', MAM, (WLC,), ('במדבר',)),
    Work('Leviticus', 'Tanakh/Torah/Leviticus', 'וַיִּקְרָא', 'Leviticus', 'tanakh', MAM, (WLC,), ('ויקרא',)),
    Work('Deuteronomy', 'Tanakh/Torah/Deuteronomy', 'דְּבָרִים', 'Deuteronomy', 'tanakh', MAM, (WLC,), ('דברים',)),
    Work('Joshua', 'Tanakh/Prophets/Joshua', 'יְהוֹשֻׁעַ', 'Joshua', 'tanakh', MAM, (WLC,), ('יהושע',)),
    Work('Judges', 'Tanakh/Prophets/Judges', 'שׁוֹפְטִים', 'Judges', 'tanakh', MAM, (WLC,), ('שופטים',)),
    Work('I Samuel', 'Tanakh/Prophets/I Samuel', 'שְׁמוּאֵל א׳', 'I Samuel', 'tanakh', MAM, (WLC,),
         ('שמואל א', 'שמ״א', 'שמ"א', 'ש"א', 'ש״א')),
    Work('II Samuel', 'Tanakh/Prophets/II Samuel', 'שְׁמוּאֵל ב׳', 'II Samuel', 'tanakh', MAM, (WLC,),
         ('שמואל ב', 'שמ״ב', 'שמ"ב', 'ש"ב', 'ש״ב')),
    Work('Isaiah', 'Tanakh/Prophets/Isaiah', 'יְשַׁעְיָהוּ', 'Isaiah', 'tanakh', MAM, (WLC,), ('ישעיהו', 'ישעיה')),
    Work('Amos', 'Tanakh/Prophets/Amos', 'עָמוֹס', 'Amos', 'tanakh', MAM, (WLC,), ('עמוס',)),
    Work('Psalms', 'Tanakh/Writings/Psalms', 'תְּהִלִּים', 'Psalms', 'tanakh', MAM, (WLC,), ('תהלים', 'תהילים')),
    Work('Ruth', 'Tanakh/Writings/Ruth', 'רוּת', 'Ruth', 'tanakh', MAM, (WLC,), ('רות',)),
    Work('I Chronicles', 'Tanakh/Writings/I Chronicles', 'דִּבְרֵי הַיָּמִים א׳', 'I Chronicles', 'tanakh', MAM, (WLC,),
         ('דברי הימים א', 'דה״א', 'דה"א')),
    Work('Shemot Rabbah', 'Midrash/Aggadah/Midrash Rabbah/Shemot Rabbah', 'שְׁמוֹת רַבָּה', 'Shemot Rabbah',
         'midrash', TE, (DAAT_SR,), ('שמות רבה',)),
    Work('Bereshit Rabbah', 'Midrash/Aggadah/Midrash Rabbah/Bereshit Rabbah', 'בְּרֵאשִׁית רַבָּה', 'Bereshit Rabbah',
         'midrash', TE, (), ('בראשית רבה',)),
    Work('Seder Olam Rabbah', 'Midrash/Aggadah/Seder Olam Rabbah/Seder Olam Rabbah', 'סֵדֶר עוֹלָם רַבָּה',
         'Seder Olam Rabbah', 'midrash', 'Seder Olam, Warsaw 1904', (), ('סדר עולם רבה', 'סדר עולם')),
    Work('Yoma', 'Talmud/Bavli/Seder Moed/Yoma', 'יוֹמָא', 'Yoma', 'talmud', DAVIDSON, (WIKI_BAVLI,), ('יומא',)),
    Work('Megillah', 'Talmud/Bavli/Seder Moed/Megillah', 'מְגִלָּה', 'Megillah', 'talmud', DAVIDSON, (WIKI_BAVLI,),
         ('מגילה',)),
    Work('Taanit', 'Talmud/Bavli/Seder Moed/Taanit', 'תַּעֲנִית', 'Taanit', 'talmud', DAVIDSON, (WIKI_BAVLI,),
         ('תענית',)),
    Work('Moed Katan', 'Talmud/Bavli/Seder Moed/Moed Katan', 'מוֹעֵד קָטָן', 'Moed Katan', 'talmud', DAVIDSON,
         (WIKI_BAVLI,), ('מועד קטן',)),
    Work('Targum Jonathan on I Samuel', 'Tanakh/Targum/Targum Jonathan/Prophets/Targum Jonathan on I Samuel',
         'תַּרְגּוּם יוֹנָתָן, שְׁמוּאֵל א׳', 'Targum Jonathan on I Samuel', 'targum', 'Mikraot Gedolot', (), ()),
    Work('Rashi on I Samuel', 'Tanakh/Rishonim on Tanakh/Rashi/Prophets/Rashi on I Samuel',
         'רַשִׁ״י, שְׁמוּאֵל א׳', 'Rashi on I Samuel', 'commentary', 'Sefaria vocalized edition', (), ()),
    Work('Radak on I Samuel', 'Tanakh/Rishonim on Tanakh/Radak/Prophets/Radak on I Samuel',
         'רַדַ״ק, שְׁמוּאֵל א׳', 'Radak on I Samuel', 'commentary', 'Radak on Nach', (), ()),
]}


# --------------------------------------------------------------------------- fetching
def _safe(name: str) -> str:
    return re.sub(r'[^A-Za-z0-9._-]+', '_', name)


def version_url(work: Work, version: str) -> str:
    return BUCKET + urllib.parse.quote(f'{work.path}/Hebrew/{version}.json')


class Fetcher:
    """Downloads Sefaria export files. mode: 'refresh' (always download, fall back to cache on
    network error), 'cache' (use cache if present, else download), 'offline' (cache only)."""

    def __init__(self, cache_dir: str = DEFAULT_CACHE, mode: str = 'refresh', log=None):
        self.cache_dir = cache_dir
        self.mode = mode
        self.log = log or (lambda msg: print(msg, file=sys.stderr))
        self.mem: dict[tuple[str, str], dict] = {}
        self.status: dict[tuple[str, str], str] = {}
        os.makedirs(cache_dir, exist_ok=True)

    def _download(self, url: str) -> bytes:
        try:
            with urllib.request.urlopen(url, timeout=90) as r:
                return r.read()
        except Exception as e:  # fall back to curl (honours the same proxy / CA settings)
            try:
                return subprocess.run(['curl', '-sSfL', '--max-time', '120', url], check=True,
                                      capture_output=True).stdout
            except Exception:
                raise e

    def get(self, work_key: str, version: str) -> dict:
        k = (work_key, version)
        if k in self.mem:
            return self.mem[k]
        work = WORKS[work_key]
        path = os.path.join(self.cache_dir, _safe(f'{work_key}__{version}') + '.json')
        data = None
        if self.mode in ('cache', 'offline') and os.path.exists(path):
            data = open(path, 'rb').read()
            self.status[k] = 'cache'
        elif self.mode != 'offline':
            url = version_url(work, version)
            try:
                data = self._download(url)
                json.loads(data)
                with open(path, 'wb') as f:
                    f.write(data)
                self.status[k] = 'fetched'
            except Exception as e:
                if os.path.exists(path):
                    self.log(f'WARN network fetch failed for {work_key} / {version} ({e}); using cache')
                    data = open(path, 'rb').read()
                    self.status[k] = 'cache (network failed)'
                else:
                    raise RuntimeError(f'cannot fetch {url}: {e}')
        if data is None:
            raise RuntimeError(f'{work_key} / {version} not in cache {self.cache_dir} (offline mode)')
        doc = json.loads(data)
        self.mem[k] = doc
        return doc


# --------------------------------------------------------------------------- normalization
_CANTILLATION = re.compile('[֑-֯]')
_INVISIBLE = re.compile('[͏​-‏‪-‮⁠﻿]')
_POINT = '[ְ-ׇּׁׂ]'
_LETTER = '[א-ת]'
# The Tetragrammaton (any pointing), optionally preceded by up to two one-letter prefixes (ו ב כ ל מ ה).
_DIVINE = re.compile(
    r'(?<![\u05D0-\u05EA\u05B0-\u05BC\u05C1\u05C2\u05C4\u05C5\u05C7])((?:[\u05D5\u05D1\u05DB\u05DC\u05DE\u05D4\u05E9]' + _POINT + r'*){0,2}?)'
    r'י' + _POINT + r'*ה' + _POINT + r'*ו' + _POINT + r'*ה' + _POINT + r'*'
    r'(?![א-ת])')
_ACC = '[֑-ֽ֯]*'
_TRIVIAL_AV = re.compile('(ָ' + _ACC + ')(ו' + _ACC + ')$')          # עָלָו  -> עָלָיו
_TRIVIAL_OH = re.compile('ֹ(' + _ACC + ')ה(' + _ACC + ')$')          # עִירֹה -> עִירוֹ
_TRIVIAL_A = re.compile('(ָ' + _ACC + ')$')                               # שַׁתָּ  -> שַׁתָּה

trivial_log: list[str] = []      # trivial ketiv/qere forms no rule could resolve (kept as printed)
kq_log: list[tuple[str, str]] = []   # (ketiv, qere) pairs met by the last normalize_tanakh() call


def _trivial_qere(inner: str) -> str:
    """MAM prints some 'trivial' ketiv/qere pairs as the ketiv letters with the qere's vowels
    (e.g. עָלָו read עָלָיו). Produce the qere spelling (R1b in docs/sources.md)."""
    m0 = re.match(r'([^&<]*)(.*)$', inner, re.S)
    word, tail = m0.group(1), m0.group(2)
    m = _TRIVIAL_AV.search(word)
    if m:
        out = word[:m.start()] + m.group(1) + 'י' + m.group(2)
    elif _TRIVIAL_OH.search(word):
        m = _TRIVIAL_OH.search(word)
        out = word[:m.start()] + m.group(1) + 'וֹ' + m.group(2)
    elif _TRIVIAL_A.search(word):
        out = word + 'ה'
    else:
        trivial_log.append(word)
        out = word
    kq_log.append((strip_points(word), out))
    return out + tail


def _kq(ketiv: str, qere: str) -> str:
    kq_log.append((strip_points(ketiv or ''), qere or ''))
    return qere or ''


def divine_name(s: str) -> str:
    """Write the Tetragrammaton as ה׳ (common Jewish printing convention); keep prefixes (וַה׳, לַה׳)."""
    return _DIVINE.sub(lambda m: m.group(1) + 'ה' + GERESH, s)


def finish(s: str) -> str:
    s = re.sub(r'\s+', ' ', s).strip()
    return unicodedata.normalize('NFC', s)


def normalize_tanakh(raw: str, edition: str = MAM) -> str:
    """Display normalization for Tanakh verses (rules R1-R9 in docs/sources.md)."""
    s = raw
    kq_log.clear()
    # R1 ketiv / qere -> qere (as read)
    kq = r'<span class="mam-kq-k">\((.*?)\)</span>'
    qq = r'<span class="mam-kq-q">\[(.*?)\]</span>'
    s = re.sub(r'<span class="mam-kq">' + kq + r'\s*' + qq + '</span>', lambda m: _kq(m.group(1), m.group(2)), s)
    s = re.sub(r'<span class="mam-kq">' + qq + r'\s*' + kq + '</span>', lambda m: _kq(m.group(2), m.group(1)), s)
    s = re.sub(r'<span class="mam-kq">' + kq + '</span>', lambda m: _kq(m.group(1), ''), s)
    s = re.sub(r'<span class="mam-kq">' + qq + '</span>', lambda m: _kq('', m.group(1)), s)
    s = re.sub(r'<span class="mam-kq-k">.*?</span>', '', s)          # any remaining (defensive)
    s = re.sub(r'<span class="mam-kq-q">\[(.*?)\]</span>', r'\1', s)
    s = re.sub(r'<span class="mam-kq-trivial">(.*?)</span>', lambda m: _trivial_qere(m.group(1)), s)
    if edition == WLC:  # WLC on Sefaria: unpointed ketiv followed by [pointed qere]
        s = re.sub(r'(?<![^\s\u05BE])([\u05D0-\u05EA\u05BE]+(?: [\u05D0-\u05EA\u05BE]+)?) ?\[([^\]]*)\]',
                   lambda m: _kq(m.group(1), m.group(2)), s)
        s = re.sub(r'\[([^\]]*)\]', r'\1', s)
        s = re.sub(r'\((?:ס|פ)\)', ' ', s)
    # R2 section markers, line breaks, markup, entities
    s = s.replace('<br>', ' ')
    s = re.sub(r'\{[^}]*\}', ' ', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s)
    # R3 cantillation, meteg, paseq/legarmeh, rafe, nun hafukha, sof pasuq, invisible controls
    s = _CANTILLATION.sub('', s)
    s = s.replace('ֽ', '').replace('ֿ', '').replace('׆', '').replace('׃', '')
    s = s.replace('׀', ' ')
    s = _INVISIBLE.sub('', s)
    # R4 fold reader-aid variants to the standard points used by printed Tanakhs
    s = s.replace('ׇ', 'ָ').replace('ֺ', 'ֹ')
    # R5 divine name
    s = divine_name(s)
    # R6 whitespace (none after a maqaf) + NFC
    s = re.sub('־\\s+', '־', s)
    return finish(s)


def normalize_rabbinic(raw: str) -> str:
    """Display normalization for midrash / Talmud / commentary segments (rules M1-M3)."""
    s = raw
    s = re.sub(r'\s*<small>\([^<]*\)</small>', '', s)   # editorial inline citations "(תהלים עח, ע)"
    s = s.replace('<br>', ' ')
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s)
    s = _CANTILLATION.sub('', s).replace('ֽ', '')
    s = _INVISIBLE.sub('', s)
    s = s.replace('ׇ', 'ָ').replace('ֺ', 'ֹ')
    return finish(s)


def strip_points(s: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', s) if not ('֑' <= c <= 'ׇ' and c not in '־׀׃׆'))


def has_niqqud(s: str) -> bool:
    return re.search('[ְ-ׇּׁׂ]', s) is not None


# --------------------------------------------------------------------------- skeleton search
def _is_letter(c: str) -> bool:
    return 'א' <= c <= 'ת'


def skeleton_map(s: str):
    """Return (skeleton, starts, ends): letters kept (geresh/ASCII apostrophe -> ׳ inside words),
    every run of non-letters collapsed to one space; starts[i]/ends[i] = span of skeleton char i in s."""
    sk, st, en = [], [], []
    i, n = 0, len(s)
    while i < n:
        c = s[i]
        if _is_letter(c) or (c in (GERESH, "'") and sk and sk[-1] != ' '):
            j = i + 1
            while j < n and unicodedata.combining(s[j]):
                j += 1
            sk.append(GERESH if c == "'" else c)
            st.append(i)
            en.append(j)
            i = j
        elif unicodedata.combining(c):
            i += 1
        else:
            if sk and sk[-1] != ' ':
                sk.append(' ')
                st.append(i)
                en.append(i + 1)
            i += 1
    while sk and sk[-1] == ' ':
        sk.pop(); st.pop(); en.pop()
    return ''.join(sk), st, en


def skeleton(s: str) -> str:
    return skeleton_map(s)[0]


def find_exact(text: str, skel_query: str, occurrence: int = 1) -> str | None:
    """Find the exact (pointed) substring of `text` whose skeleton equals the skeleton of `skel_query`,
    aligned on word boundaries. Returns None if not found."""
    sk, st, en = skeleton_map(text)
    q = skeleton(skel_query)
    if not q:
        return None
    pos, count = 0, 0
    while True:
        k = sk.find(q, pos)
        if k < 0:
            return None
        e = k + len(q)
        if (k == 0 or sk[k - 1] == ' ') and (e == len(sk) or sk[e] == ' '):
            count += 1
            if count == occurrence:
                return text[st[k]:en[e - 1]]
        pos = k + 1


# --------------------------------------------------------------------------- numerals & references
_UNITS = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט']
_TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ']
_HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק']
_VAL = {**{c: i for i, c in enumerate(_UNITS) if c}, **{c: i * 10 for i, c in enumerate(_TENS) if c},
        'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400, 'ך': 20, 'ם': 40, 'ן': 50, 'ף': 80, 'ץ': 90}


def heb_num(n: int) -> str:
    out = _HUNDREDS[n // 100]
    r = n % 100
    if r == 15:
        return out + 'טו'
    if r == 16:
        return out + 'טז'
    return out + _TENS[r // 10] + _UNITS[r % 10]


def parse_heb_num(s: str) -> int | None:
    s = re.sub(f"[{GERESH}{GERSHAYIM}'\"]", '', s)
    if not s or any(c not in _VAL for c in s):
        return None
    return sum(_VAL[c] for c in s)


DASH = '–'


def tanakh_label(work: Work, ch: int, v1: int | None = None, v2: int | None = None) -> str:
    if v1 is None:
        return f'{work.he} {heb_num(ch)}'
    if v2 is None or v2 == v1:
        return f'{work.he} {heb_num(ch)}, {heb_num(v1)}'
    return f'{work.he} {heb_num(ch)}, {heb_num(v1)}{DASH}{heb_num(v2)}'


def tanakh_label_en(work: Work, ch: int, v1: int | None = None, v2: int | None = None) -> str:
    if v1 is None:
        return f'{work.en} {ch}'
    if v2 is None or v2 == v1:
        return f'{work.en} {ch}:{v1}'
    return f'{work.en} {ch}:{v1}-{v2}'


def daf_label(work: Work, daf: int, side: str) -> str:
    return f'{work.he} {heb_num(daf)} ע{GERSHAYIM}{"א" if side == "a" else "ב"}'


@dataclass
class Ref:
    work: Work
    ch: int | None = None        # chapter / daf
    v1: int | None = None        # verse / section
    v2: int | None = None
    side: str | None = None      # talmud: 'a' / 'b'


def _unpointed_ref(s: str) -> str:
    s = strip_points(html.unescape(re.sub(r'<[^>]+>', ' ', s)))
    s = s.replace("'", GERESH).replace('"', GERSHAYIM).replace('’', GERESH)
    s = s.replace('־', ' ')
    return re.sub(r'\s+', ' ', s).strip(' ·—-')


def parse_ref(label: str) -> Ref | None:
    """Parse an on-screen Hebrew reference such as 'שְׁמוּאֵל א׳ יז, לו–לז', 'תהלים כג',
    'עַל פִּי שְׁמוֹת רַבָּה ב, ב', 'יומא כב ע״ב'."""
    s = _unpointed_ref(label)
    s = re.sub(r'^(?:על פי|ע״פ|ראו|עיין|וראו)\s+', '', s)
    names = sorted(((n, w) for w in WORKS.values() for n in w.names), key=lambda x: -len(x[0]))
    for name, w in names:
        nm = name.replace('"', GERSHAYIM)
        m = re.match(re.escape(nm) + GERESH + r'?(?:\s+|$)(.*)$', s)
        if not m:
            continue
        rest = m.group(1).strip()
        if w.kind == 'talmud':
            m2 = re.match(r'([א-ת' + GERESH + r']+)\s*(?:ע' + GERSHAYIM + r'?([אב])|([.:]))?', rest)
            if not m2:
                return Ref(w)
            side = m2.group(2) or ('a' if m2.group(3) == '.' else 'b' if m2.group(3) == ':' else None)
            side = {'א': 'a', 'ב': 'b'}.get(side, side)
            return Ref(w, parse_heb_num(m2.group(1)), side=side)
        m2 = re.match(r'([א-ת' + GERESH + GERSHAYIM + r']+)(?:\s*[,:]\s*([א-ת' + GERESH +
                      GERSHAYIM + r']+)(?:\s*[-–—]\s*([א-ת' + GERESH + GERSHAYIM + r']+))?)?', rest)
        if not m2:
            return Ref(w)
        ch = parse_heb_num(m2.group(1))
        v1 = parse_heb_num(m2.group(2)) if m2.group(2) else None
        v2 = parse_heb_num(m2.group(3)) if m2.group(3) else None
        return Ref(w, ch, v1, v2)
    return None


# --------------------------------------------------------------------------- text access
class Corpus:
    """Normalized access to verses / sections / Talmud segments."""

    def __init__(self, fetcher: Fetcher):
        self.f = fetcher

    def raw(self, work_key: str, version: str | None = None) -> list:
        w = WORKS[work_key]
        t = self.f.get(work_key, version or w.primary)['text']
        if isinstance(t, dict):  # complex schema (e.g. Seder Olam: {'Introduction': [], '': [...]})
            t = t.get('') or next(v for v in t.values() if v)
        return t

    def meta(self, work_key: str, version: str | None = None) -> dict:
        w = WORKS[work_key]
        d = self.f.get(work_key, version or w.primary)
        return {k: d.get(k) for k in ('versionTitle', 'versionSource', 'license')}

    def verse(self, work_key: str, ch: int, v: int, version: str | None = None) -> str:
        w = WORKS[work_key]
        ed = version or w.primary
        raw = self.raw(work_key, ed)[ch - 1][v - 1]
        return normalize_tanakh(raw, ed)

    def verses(self, work_key: str, ch: int, v1: int | None, v2: int | None = None,
               version: str | None = None) -> str:
        chapter = self.raw(work_key, version)[ch - 1]
        if v1 is None:
            v1, v2 = 1, len(chapter)
        v2 = v2 or v1
        return ' '.join(self.verse(work_key, ch, v, version) for v in range(v1, v2 + 1))

    def section(self, work_key: str, ch: int, sec: int, version: str | None = None) -> str:
        return normalize_rabbinic(self.raw(work_key, version)[ch - 1][sec - 1])

    def comment(self, work_key: str, ch: int, v: int, seg: int | None = None, version: str | None = None) -> str:
        x = self.raw(work_key, version)[ch - 1][v - 1]
        if isinstance(x, list):
            x = x[(seg or 1) - 1]
        return normalize_rabbinic(x)

    def daf(self, work_key: str, daf: int, side: str, seg: int | None = None, version: str | None = None) -> str:
        idx = (daf - 1) * 2 + (0 if side == 'a' else 1)
        page = self.raw(work_key, version)[idx]
        if seg is None:
            return ' '.join(normalize_rabbinic(x) for x in page)
        return normalize_rabbinic(page[seg - 1])

    def text_for_ref(self, ref: Ref) -> str | None:
        w = ref.work
        try:
            if w.kind == 'tanakh':
                if ref.ch is None:
                    return None
                return self.verses(w.key, ref.ch, ref.v1, ref.v2)
            if w.kind == 'midrash':
                if ref.ch is None:
                    return None
                chapter = self.raw(w.key)[ref.ch - 1]
                secs = range(1, len(chapter) + 1) if ref.v1 is None else range(ref.v1, (ref.v2 or ref.v1) + 1)
                return ' '.join(self.section(w.key, ref.ch, s) for s in secs)
            if w.kind == 'talmud':
                if ref.ch is None:
                    return None
                sides = [ref.side] if ref.side else ['a', 'b']
                return ' '.join(self.daf(w.key, ref.ch, sd) for sd in sides)
        except (IndexError, KeyError, TypeError):
            return None
        return None
