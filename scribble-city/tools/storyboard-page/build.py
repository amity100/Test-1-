# builds the storyboard page: the engine's stills + the special style's mock-ups (SVG / CSS over them), Hebrew captions
#   python3 tools/storyboard-page/build.py <out.html> <stillsDir>     (the stills: node tools/storyboard.mjs <stillsDir>)
#   the page's fonts: its own copies when a fonts/ folder is beside this file, else the web's (Google Fonts)
#   then: node tools/storyboard-page/shotpage.mjs <out.html> <outPrefix> 400 2   (each frame's card, as a phone shows it)
import base64, io, math, random, sys, os
from PIL import Image
SP = os.path.dirname(os.path.abspath(__file__))
FIN = sys.argv[2] if len(sys.argv) > 2 else os.path.join(SP, '..', 'final')
def img(name, q=84):
    im = Image.open(os.path.join(FIN, name + '.png')).convert('RGB')
    b = io.BytesIO(); im.save(b, 'JPEG', quality=q, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
def font(f):
    return 'data:font/woff2;base64,' + base64.b64encode(open(os.path.join(SP, 'fonts', f), 'rb').read()).decode()
IM = {n: img(n) for n in ['01-evening','03-danny-comes','04-lily-sees','05a-lily-runs','05b-danny-kneels','06-hug','07-lily-face','08-danny-face','09-two-shot','10-giggle','11-the-board','12-under-board','13-danny-up','14-lily-up','16-laugh','17-to-the-wheel']}

random.seed(7)
# ---- her drawing: me + dad (the page the scene opens on, and the one its last frame becomes)
def band(y, col, x0=96, x1=846, w=21, op=.86):
    j = lambda: random.uniform(-3, 3)
    return f'<path d="M{x0+j():.0f} {y+j():.0f} L{x1+j():.0f} {y+j():.0f}" stroke="{col}" stroke-width="{w}" stroke-linecap="round" opacity="{op}"/>'
def page_svg():
    o = []
    o.append('<rect width="882" height="411" fill="#fbf6e8"/>')
    for y in range(64, 411, 24): o.append(f'<path d="M0 {y}H882" stroke="rgba(80,130,200,.24)" stroke-width="1.2"/>')
    o.append('<path d="M62 0V411" stroke="rgba(220,80,90,.34)" stroke-width="1.2"/>')
    for x in range(26, 882, 40): o.append(f'<circle cx="{x}" cy="15" r="6" fill="#d8d0bc"/>')
    g = []
    for y in (74, 98, 122): g.append(band(y, '#a985e6'))
    for y in (148, 172): g.append(band(y, '#f76aa3'))
    for y in (198, 222, 246, 270): g.append(band(y, '#ffb64f'))
    for y in (322, 346): g.append(band(y, '#52abdc'))
    for y in (372, 396): g.append(band(y, '#3f83c6'))
    # the pier's line and its posts
    g.append('<path d="M92 300 L850 302" stroke="#3a3048" stroke-width="3.2" stroke-linecap="round"/>')
    for x in range(110, 850, 46): g.append(f'<path d="M{x} 301 L{x+2} 352" stroke="#3a3048" stroke-width="2.2" stroke-linecap="round"/>')
    # the wheel
    cx, cy, r = 652, 176, 96
    g.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#fbf6e8"/>')
    g.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="#e8457a" stroke-width="11"/>')
    g.append(f'<circle cx="{cx}" cy="{cy}" r="{r+6}" fill="none" stroke="#3a3048" stroke-width="2"/><circle cx="{cx}" cy="{cy}" r="{r-6}" fill="none" stroke="#3a3048" stroke-width="2"/>')
    for i in range(12):
        a = i * math.pi / 6 + 0.12
        g.append(f'<path d="M{cx} {cy} L{cx+math.cos(a)*r:.0f} {cy+math.sin(a)*r:.0f}" stroke="#3a3048" stroke-width="2"/>')
    cols = ['#ffc83d', '#8a5fe0', '#62c24a', '#ff8f2e', '#ff5d7e', '#45c2b8']
    for i in range(10):
        a = i * math.pi / 5 + 0.3
        x = cx + math.cos(a) * (r + 3); y = cy + math.sin(a) * (r + 3)
        g.append(f'<rect x="{x-13:.0f}" y="{y-6:.0f}" width="26" height="17" fill="{cols[i % 6]}" stroke="#3a3048" stroke-width="2" transform="rotate({random.uniform(-5,5):.1f} {x:.0f} {y:.0f})"/>')
    g.append(f'<circle cx="{cx}" cy="{cy}" r="10" fill="#fbf6e8" stroke="#3a3048" stroke-width="2.4"/>')
    g.append(f'<path d="M{cx} {cy} L{cx-58} 300 M{cx} {cy} L{cx+58} 300" stroke="#3a3048" stroke-width="4" stroke-linecap="round"/>')
    # the sun
    g.append('<circle cx="812" cy="92" r="30" fill="#ffd23f" stroke="#3a3048" stroke-width="2.6"/>')
    # dad
    d = []
    d.append('<path d="M287 238 L282 296 M313 238 L318 296" stroke="#77665a" stroke-width="13" stroke-linecap="round"/>')
    d.append('<path d="M272 298 h20 M308 298 h22" stroke="#2c2530" stroke-width="8" stroke-linecap="round"/>')
    d.append('<path d="M274 160 L326 160 L330 240 L270 240 Z" fill="#30457c" stroke="#232a45" stroke-width="2.6" stroke-linejoin="round"/>')
    for i in range(7): d.append(f'<path d="M{276+i*8} {166+random.uniform(-2,2):.0f} L{273+i*8} {236+random.uniform(-2,2):.0f}" stroke="#25376a" stroke-width="3.4" stroke-linecap="round" opacity=".8"/>')
    d.append('<path d="M293 160 L300 196 L307 160 Z" fill="#f6eeda" stroke="#232a45" stroke-width="1.6"/>')
    d.append('<path d="M276 166 L250 216" stroke="#30457c" stroke-width="12" stroke-linecap="round"/><circle cx="248" cy="221" r="7" fill="#cf9a78" stroke="#3a3048" stroke-width="1.8"/>')
    d.append('<path d="M324 166 L366 214" stroke="#30457c" stroke-width="12" stroke-linecap="round"/>')
    d.append('<circle cx="300" cy="134" r="24" fill="#cf9a78" stroke="#3a3048" stroke-width="2.6"/>')
    d.append('<path d="M276 130 q4 -30 22 -26 q-2 -8 8 -4 q12 -6 14 8 q8 6 4 24 q-6 -16 -16 -14 q-10 6 -18 2 q-8 2 -14 10 Z" fill="#3b2a22" stroke="#2a1d17" stroke-width="2"/>')
    for (x, y) in [(289,150),(294,154),(300,156),(306,154),(311,150),(291,146),(309,146),(297,151),(303,151)]: d.append(f'<path d="M{x} {y} l1 3" stroke="#4a372e" stroke-width="1.6" stroke-linecap="round"/>')
    d.append('<circle cx="292" cy="134" r="2.4" fill="#2a1d17"/><circle cx="308" cy="134" r="2.4" fill="#2a1d17"/><path d="M291 143 q9 8 18 0" fill="none" stroke="#2a1d17" stroke-width="2.4" stroke-linecap="round"/>')
    # lily
    l = []
    l.append('<path d="M402 262 L399 296 M420 262 L423 296" stroke="#77665a" stroke-width="10" stroke-linecap="round"/>')
    l.append('<path d="M391 298 h16 M416 298 h17" stroke="#f1ece4" stroke-width="7" stroke-linecap="round"/><path d="M391 298 h16 M416 298 h17" stroke="#3a3048" stroke-width="1.2" fill="none"/>')
    l.append('<path d="M394 216 L428 216 L434 266 L388 266 Z" fill="#8f52b0" stroke="#4d2c63" stroke-width="2.4" stroke-linejoin="round"/>')
    for i in range(5): l.append(f'<path d="M{397+i*8} {221+random.uniform(-2,2):.0f} L{394+i*9} {262+random.uniform(-2,2):.0f}" stroke="#7a419c" stroke-width="3" stroke-linecap="round" opacity=".8"/>')
    l.append('<path d="M396 222 L366 214" stroke="#8f52b0" stroke-width="10" stroke-linecap="round"/><circle cx="366" cy="214" r="7.5" fill="#c58f6e" stroke="#3a3048" stroke-width="1.8"/>')
    l.append('<path d="M426 222 L452 196" stroke="#8f52b0" stroke-width="10" stroke-linecap="round"/><circle cx="455" cy="192" r="6.5" fill="#c58f6e" stroke="#3a3048" stroke-width="1.8"/>')
    l.append('<circle cx="411" cy="194" r="19" fill="#c58f6e" stroke="#3a3048" stroke-width="2.4"/>')
    for i in range(15):
        a = math.pi * (1.02 + i / 14 * 0.96) if i < 11 else 0
        if i < 11: x = 411 + math.cos(a) * 20; y = 192 + math.sin(a) * 20
        else: x, y = [(389, 200), (433, 200), (387, 211), (435, 211)][i - 11]
        l.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{random.uniform(5.5,7.5):.1f}" fill="none" stroke="#4a2f22" stroke-width="3.2"/>')
    l.append('<circle cx="405" cy="194" r="2.2" fill="#2a1d17"/><circle cx="418" cy="194" r="2.2" fill="#2a1d17"/><path d="M402 201 q9 10 19 0" fill="#fbf6e8" stroke="#2a1d17" stroke-width="2.2" stroke-linejoin="round"/>')
    # a heart over their hands
    h = '<path d="M352 118 c-9 -15 -30 -3 -17 13 l17 17 l17 -17 c13 -16 -8 -28 -17 -13 Z" fill="#ff5d8f" stroke="#b5325f" stroke-width="2.2" transform="rotate(-6 352 126)"/>'
    o.append('<g filter="url(#cray)">' + ''.join(g) + ''.join(d) + ''.join(l) + h + '</g>')
    o.append('<text x="92" y="52" class="hw" font-size="31" fill="#c2385f" transform="rotate(-3 92 52)">me + dad</text>')
    o.append('<text x="770" y="398" class="hw" font-size="27" fill="#8455d6" transform="rotate(-4 770 398)">Lily ♥</text>')
    return ''.join(o)

def scribble(x0, y0, x1, y1, n, col, w, op=.72):
    # a child's colouring: back and forth between two edges, down the patch
    pts = []
    for i in range(n + 1):
        y = y0 + (y1 - y0) * i / n
        x = (x0 if i % 2 == 0 else x1) + random.uniform(-7, 7)
        pts.append(f'{x:.0f} {y + random.uniform(-3, 3):.0f}')
    return f'<path d="M{" L".join(pts)}" fill="none" stroke="{col}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" opacity="{op}"/>'
def spill_svg():
    # colour past the outlines: a child's crayon strokes going out from the two of them, all the way round -
    # her violet on her side, his navy on his, the evening's yellow and pink over all
    o = []
    cx, cy, rx, ry = 478, 248, 112, 162
    n = 58
    for k in range(n):
        a = 2 * math.pi * k / n + random.uniform(-0.04, 0.04)
        c, sn = math.cos(a), math.sin(a)
        if sn > 0.8: continue
        r0 = random.uniform(1.0, 1.1); ln = random.uniform(28, 86) * (0.6 if sn > 0.4 else 1)
        x0, y0 = cx + c * rx * r0, cy + sn * ry * r0
        x1, y1 = x0 + c * ln, y0 + sn * ln
        px, py = -sn * 4, c * 4
        if c < -0.35: col = random.choice(['#a45fd6', '#a45fd6', '#ffe45e', '#ff8fb8'])
        elif c > 0.35: col = random.choice(['#34488a', '#34488a', '#ffe45e', '#ffb24f'])
        else: col = random.choice(['#ffe45e', '#ff8fb8', '#ffb24f'])
        o.append(f'<path d="M{x0:.0f} {y0:.0f} L{x1:.0f} {y1:.0f} L{x0+px:.0f} {y0+py:.0f} L{x1+px*1.4:.0f} {y1+py*1.4:.0f}" fill="none" stroke="{col}" stroke-width="{random.uniform(6,9):.1f}" stroke-linecap="round" stroke-linejoin="round" opacity="{random.uniform(.7,.88):.2f}"/>')
    return '<g filter="url(#cray)">' + ''.join(o) + '</g>'
def speed_svg():
    o = []
    for i in range(26):
        y = random.uniform(74, 356); x1 = random.uniform(60, 158); ln = random.uniform(40, 150)
        o.append(f'<path d="M{x1-ln:.0f} {y:.0f} L{x1:.0f} {y+random.uniform(-1.5,1.5):.0f}" stroke="#fff" stroke-width="{random.uniform(1.2,3.6):.1f}" stroke-linecap="round" opacity="{random.uniform(.55,.95):.2f}"/>')
    for i in range(9):
        y = random.uniform(240, 372); x0 = random.uniform(290, 330)
        o.append(f'<path d="M{x0:.0f} {y:.0f} L{x0+random.uniform(30,90):.0f} {y:.0f}" stroke="#fff" stroke-width="{random.uniform(1,2.4):.1f}" stroke-linecap="round" opacity=".5"/>')
    o.append('<text x="352" y="118" class="shout" font-size="104" transform="rotate(-8 352 118)" text-anchor="middle" direction="rtl">אבא!</text>')
    return ''.join(o)

FR = []   # (shot html, who, line, what, chips)
def shot(inner, cls=''):
    return f'<div class="shot {cls}">{inner}</div>'
def pic(n, extra=''):
    return f'<img src="{IM[n]}" alt="" loading="lazy">{extra}'
def ov(svg):
    return f'<svg class="ov" viewBox="0 0 882 411" preserveAspectRatio="none" aria-hidden="true">{svg}</svg>'

FR.append((shot(ov(page_svg()), 'paper'), '', '', 'פותחים על דף במחברת של לילי: היא ואבא, יד ביד, והגלגל. שקט — רק עיפרון על נייר.', 'א'))
FR.append((shot(pic('01-evening')), '', '', 'המצלמה עולה מהדף: לילי לבד ליד הדוכן, מחכה. הגלגל הענק מולה.', 'ז'))
FR.append((shot(pic('03-danny-comes')), '', '', 'דני מגיע מהטיילת, רואה אותה ומחייך. עדשה ארוכה, מהמקום שבו היא יושבת.', ''))
FR.append((shot(pic('04-lily-sees')), 'לילי', 'אבא! סוף סוף!', 'היא קופצת מהכיסא. השמש הנמוכה מאחוריה, בתלתלים.', 'ז'))
FR.append((shot(f'<div class="pan pl"><img src="{IM["05a-lily-runs"]}" alt="" loading="lazy"></div><div class="pan pr"><img src="{IM["05b-danny-kneels"]}" alt="" loading="lazy"></div>' + ov(speed_svg()), 'panels'), '', '', 'היא רצה, הוא יורד על ברך. שני פאנלים בפריים אחד — והרווח ביניהם נסגר ככל שהיא מתקרבת.', 'בג'))
FR.append((shot(pic('06-hug') + ov(spill_svg())), '', '', 'הפאנלים נפגשים: החיבוק, מול הגלגל. לרגע אחד הצבע יוצא מהקווים, כמו בציור שלה.', 'גדז'))
FR.append((shot(pic('07-lily-face') + '<div class="scrap s1"><b>לילי</b><i>בת 9 · מציירת כל מה שהיא רואה</i></div>'), '', '', 'עיניים עצומות. השם שלה מופיע על פתק קרוע מהמחברת, בכתב היד שלה.', 'ה'))
FR.append((shot(pic('08-danny-face') + '<div class="scrap s2"><b>דני</b><i>אבא שלה · זה מסובך</i></div>'), '', '', 'היא מתכרבלת לצד השני ורואים אותו. מאחוריו, בלי שהוא שם לב — הדוד מהשלט מסתכל.', 'ה'))
FR.append((shot(pic('09-two-shot')), 'דני', 'מה סוף סוף? עברו שתי דקות.', 'הוא מחזיק אותה לאורך יד ומסתכל עליה. הגלגל ביניהם.', 'ז'))
FR.append((shot(pic('10-giggle')), 'לילי', 'זה מה שאתה אומר תמיד.', 'היא מצחקקת, היד שלו בתלתלים שלה.', ''))
FR.append((shot(f'<img class="base" src="{IM["11-the-board"]}" alt="" loading="lazy"><div class="tint"></div><div class="dots"></div><img class="warm" src="{IM["11-the-board"]}" alt="">', 'cold'), 'לילי', 'אבא, דוד מייקל באמת יהיה ראש העיר?', 'מעבר לכתף שלו היא רואה את השלט. לשנייה החום יורד מהתמונה: השלט בדפוס קר, רק התלתלים שלה נשארים חמים.', 'ו'))
FR.append((shot(pic('12-under-board')), '', '', 'שניהם קטנים מתחת לשלט הענק. היא מצביעה.', ''))
FR.append((shot(pic('13-danny-up')), 'דני', 'אם יש דבר אחד שהוא יודע לעשות, זה לגרום לאנשים להצביע לו.', 'דני מרים מבט אל השלט. יבש. אורות המלונות מאחוריו.', ''))
FR.append((shot(pic('14-lily-up')), 'לילי', 'אז הוא יהיה הבוס של כולם?', 'היא מסתכלת עליו מלמטה — מהגובה שלה.', 'ז'))
FR.append((shot(pic('16-laugh')), 'דני', 'הוא כבר חושב שהוא הבוס של כולם.', 'היא מתפקעת מצחוק, והוא נשבר ומחייך.', ''))
FR.append((shot(pic('17-to-the-wheel')), '', '', 'יד ביד אל המזח. הגלגל נפתח מולם.', 'ז'))
FR.append((shot(f'<img src="{IM["17-to-the-wheel"]}" alt="" loading="lazy"><div class="pg"><img class="cr" src="{IM["17-to-the-wheel"]}" alt=""><div class="gaps"></div><div class="hatch"></div><div class="rules"></div><div class="holes"></div><span class="hw t1">me + dad</span><span class="hw t2">Lily ♥</span></div><div class="curl"></div>', 'freeze'), '', '', 'הפריים קופא והופך לדף במחברת — הציור מההתחלה התגשם. הדף מתהפך, והמשחק ממשיך.', 'א'))

IDEAS = [
 ('א', 'המחברת של לילי פותחת וסוגרת', 'הסצנה מתחילה מציור שלה ונגמרת כשהפריים האחרון הופך לאותו ציור.', '1, 17'),
 ('ב', 'צעקה מצוירת וקווי מהירות', '״אבא!״ באותיות קומיקס, רק ברגע הריצה.', '5'),
 ('ג', 'שני פאנלים שנסגרים', 'הריצה והכריעה באותו פריים, והרווח ביניהם נסגר לחיבוק.', '5, 6'),
 ('ד', 'צבע שיוצא מהקווים', 'בשיא החיבוק, לשנייה אחת. בסצנה הבאה, כשדברים נמחקים — הצבע יֵצא החוצה.', '6'),
 ('ה', 'שמות על פתקים מהמחברת', 'כרטיסי השם של לילי ודני, באותו טקסט כמו היום, אבל כפתק קרוע בכתב ידה.', '7, 8'),
 ('ו', 'הדוד בדפוס קר', 'כל פעם שהשלט שלו בפריים, החום יורד: נקודות דפוס, כחול-אפור.', '11'),
 ('ז', 'מצלמה בגובה של לילי, והגלגל תמיד שם', 'כמעט כל פריים מצולם מגובה העיניים שלה, והגלגל ברקע — עד שייעלם.', '2, 4, 6, 9, 14, 16'),
]
def chips(s): return ''.join(f'<span class="chip c{"אבגדהוז".index(c)}">{c}</span>' for c in s)
items = []
for i, (sh, who, line, what, ch) in enumerate(FR, 1):
    say = f'<p class="say"><b>{who}</b>{line}</p>' if line else ''
    items.append(f'<li class="fr">{sh}<div class="cap"><span class="n">{i}</span><div class="tx">{say}<p class="what">{what}</p>{("<p class=chips>" + chips(ch) + "</p>") if ch else ""}</div></div></li>')
ideas = ''.join(f'<li><span class="chip c{i}">{k}</span><div><h3>{t}</h3><p>{d}</p><p class="where">פריימים {w}</p></div></li>' for i, (k, t, d, w) in enumerate(IDEAS))

FONTS = {
 'heebo_he': 'heebo_v28_NGS6v5_NC0k9P9H0TbFhsqMA6aw.woff2', 'heebo_la': 'heebo_v28_NGS6v5_NC0k9P9H2TbFhsqMA.woff2',
 'kar_he': 'karantina_v13_buExpo24ccnh31GVMABxTC8v_fRPSC8ocrZI.woff2',
 'gl_he': 'gveretlevin_v4_0QInMXVI5YS9Rnn7ar449p--9pzT0gBOspBX.woff2', 'gl_la': 'gveretlevin_v4_0QInMXVI5YS9Rnn7ar449p--9JzT0gBOsg.woff2',
 'cav': 'caveatbrush_v12_EYq0maZfwr9S9-ETZc3fKXt8XLOS8XlNQg.woff2'}
LOCAL = all(os.path.exists(os.path.join(SP, 'fonts', v)) for v in FONTS.values())
F = {k: font(v) for k, v in FONTS.items()} if LOCAL else {}
HE = 'U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F'
LA = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'
html = open(os.path.join(SP, 'template.html'), encoding='utf8').read()
html = html.replace('{{FRAMES}}', ''.join(items)).replace('{{IDEAS}}', ideas).replace('{{HE}}', HE).replace('{{LA}}', LA)
if LOCAL:
    for k, v in F.items(): html = html.replace('{{F_' + k + '}}', v)
else:
    a = html.index('@font-face'); b = html.index('/* one look, on purpose')
    html = html[:a] + html[b:]
    html = html.replace('<style>', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700&family=Karantina:wght@700&family=Gveret+Levin&family=Caveat+Brush&display=swap">\n<style>', 1)
out = sys.argv[1]
open(out, 'w', encoding='utf8').write(html)
print(out, round(len(html) / 1e6, 2), 'MB')
