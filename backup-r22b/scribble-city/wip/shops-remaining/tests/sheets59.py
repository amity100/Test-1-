import os
import sys
from PIL import Image, ImageDraw, ImageFont

# the report's sheets for stages 5-9: before/after, and the life in the shops
S = '/tmp/claude-0/-home-user-Test-1-/1f04fdad-ca96-5cb8-bcb1-fccf2f5dd162/scratchpad/shop2'
OUT = '/tmp/claude-0/-home-user-Test-1-/1f04fdad-ca96-5cb8-bcb1-fccf2f5dd162/scratchpad/report59'
os.makedirs(OUT, exist_ok=True)
FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26)
W, H = 960, 540


def lab(im, text):
    d = ImageDraw.Draw(im)
    w = d.textlength(text, font=FONT, direction='rtl', language='he')
    d.rectangle([im.width - w - 34, 10, im.width - 10, 52], fill=(20, 20, 26))
    d.text((im.width - w - 22, 14), text, font=FONT, fill=(240, 214, 150), direction='rtl', language='he')
    return im


def get(name):
    p = f'{S}/{name}.png'
    if not os.path.exists(p):
        print('missing', name)
        return Image.new('RGB', (W, H), (60, 60, 64))
    return Image.open(p).convert('RGB').resize((W, H), Image.LANCZOS)


def sheet(out, rows, cols=2):
    n = len(rows)
    r = (n + cols - 1) // cols
    sh = Image.new('RGB', (W * cols + 12 * (cols - 1), (H + 12) * r - 12), (250, 248, 244))
    for i, (name, text) in enumerate(rows):
        sh.paste(lab(get(name), text), ((i % cols) * (W + 12), (i // cols) * (H + 12)))
    sh.save(f'{OUT}/{out}.jpg', quality=84)
    print('saved', out)


SHEETS = {
    '5': [
        ('s5_before_after', [
            ('tB6_B4_shoes', 'לפני · נעליים'), ('t21_a1_shoes', 'אחרי · נעליים'),
            ('tB7f_B5_sports', 'לפני · ספורט'), ('t23bf_d1_sports', 'אחרי · ספורט'),
        ]),
        ('s5_life', [
            ('t23bf_c2_bench', 'מחכים על הספסל עם הנעל לדוגמה'), ('t23bf_c4_box', 'המוכר מביא קופסאות מהמחסן'),
            ('t23bf_d2_bikes', 'אופניים על הקיר'), ('t23bf_d3_balls', 'סלי כדורים'),
            ('t23bf_d4_tread_on', 'הולכים על ההליכון'), ('t23bf_d7_run', 'נעלי ריצה: רצים מהר יותר'),
        ]),
    ],
    '6': [
        ('s6_before_after', [('tB8f_B6_tech', 'לפני · אלקטרוניקה'), ('t24f_e1_overview', 'אחרי · אלקטרוניקה')], ),
        ('s6_life', [
            ('t24f_e2_tv', 'חדשות העיר על קיר הטלוויזיות'), ('t24f_e4_cord', 'טלפונים קשורים בכבל אבטחה'),
            ('t24f_e5_selfie', 'סלפי שמופיע על המסכים'), ('t24f_e6_listen', 'מקשיבים באוזניות'),
            ('t24f_e8_scanner', 'סורק משטרה בוויטרינה'), ('t24f_e13_citymap', 'שוטרים ודפי שרטוט במפה'),
        ]),
    ],
    '7': [
        ('s7_before_after', [
            ('tB8f_B7_perfume', 'לפני · בשמים'), ('t25f_f1_perfume', 'אחרי · בשמים'),
            ('tB8f_B7_optics', 'לפני · אופטיקה'), ('t25f_g1_optics', 'אחרי · אופטיקה'),
            ('tB8f_B7_barber', 'לפני · מספרה'), ('t25f_h1_barber', 'אחרי · מספרה'),
        ]),
        ('s7_life', [
            ('t25f_f3_spray', 'המוכרת מרססת על פס נייר'), ('t25f_f4_sniff', 'מריחים'),
            ('t25f_g3_tryon', 'מודדים משקפיים מול המראה'), ('t25f_g4_exam', 'בדיקת ראייה'),
            ('t25f_h3_cut', 'תספורת'), ('t25f_h4_mirror', 'המספר מראה את העורף במראה'),
        ]),
    ],
    '8': [
        ('s8_before_after', [
            ('tB9f_B9_books', 'לפני · ספרים'), ('t26f_k1_books', 'אחרי · ספרים'),
            ('tB9f_B10_music', 'לפני · תקליטים'), ('t26f_m1_records', 'אחרי · תקליטים'),
            ('tB9f_B11_toys', 'לפני · צעצועים'), ('t26f_n1_toys', 'אחרי · צעצועים'),
            ('tB9f_B12_flowers', 'לפני · פרחים'), ('t26f_p1_flowers', 'אחרי · פרחים'),
            ('tB9f_B13_hardware', 'לפני · כלי עבודה'), ('t26f_q1_hardware', 'אחרי · כלי עבודה'),
        ]),
        ('s8_life', [
            ('t26f_k2_read', 'מעלעלים בספר'), ('t26f_k3_corner', 'פינת הקריאה'),
            ('t26f_m2_platter', 'הפטיפון מסתובב'), ('t26f_m3_listen', 'מקשיבים בעמדת ההאזנה'),
            ('t26f_n2_train', 'הרכבת נוסעת סביב'), ('t26f_n3_hug', 'מחבקים דובי'),
            ('t26f_p2_smell', 'מריחים פרחים'), ('t26f_q2_shaker', 'המכונה מנערת פחית צבע'),
        ]),
    ],
    '9': [
        ('s9_before_after', [
            ('tB9f_B14_laundry', 'לפני · מכבסה'), ('t27f_r1_laundry', 'אחרי · מכבסה'),
            ('tB9f_B15_gym', 'לפני · חדר כושר'), ('t27f_s1_gym', 'אחרי · חדר כושר'),
        ]),
        ('s9_life', [
            ('t27f_r2_load', 'מעמיסים כביסה'), ('t27f_r3_drum', 'הכביסה מסתובבת בחלון'),
            ('t27f_r4_fold', 'מקפלים על השולחן'), ('t27f_s2_punch', 'מכים בשק'),
            ('t27f_s3_lift', 'מרימים את המוט'), ('t27f_s4_curl', 'משקולות מול המראה'),
        ]),
    ],
}
which = sys.argv[1:] or list(SHEETS)
for k in which:
    for out, rows in SHEETS[k]:
        sheet(out, rows)
