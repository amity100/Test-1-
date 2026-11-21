import os
import sys
from PIL import Image, ImageDraw, ImageFont

# the report's sheets for stages 4 and 5: before/after, and the life in the shops
S = '/tmp/claude-0/-home-user-Test-1-/1f04fdad-ca96-5cb8-bcb1-fccf2f5dd162/scratchpad/shop2'
OUT = '/tmp/claude-0/-home-user-Test-1-/1f04fdad-ca96-5cb8-bcb1-fccf2f5dd162/scratchpad/report45'
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
        im = Image.new('RGB', (W, H), (60, 60, 64))
        return im
    return Image.open(p).convert('RGB').resize((W, H), Image.LANCZOS)


def sheet(out, rows, cols=2):
    n = len(rows)
    r = (n + cols - 1) // cols
    sh = Image.new('RGB', (W * cols + 12 * (cols - 1), (H + 12) * r - 12), (250, 248, 244))
    for i, (name, text) in enumerate(rows):
        sh.paste(lab(get(name), text), ((i % cols) * (W + 12), (i // cols) * (H + 12)))
    sh.save(f'{OUT}/{out}.jpg', quality=86)
    print('saved', out)


which = sys.argv[1] if len(sys.argv) > 1 else 'all'
if which in ('all', '4'):
    sheet('s4_before_after', [
        ('tB4_B1_247', 'לפני · 24/7'), ('t14_A1_247', 'אחרי · 24/7'),
        ('tB5_B2_deli_front', 'לפני · מעדנייה'), ('t20_d1_front', 'אחרי · מעדנייה'),
        ('tB5_B3_pharmacy', 'לפני · בית מרקחת'), ('t20_A3_pharmacy', 'אחרי · בית מרקחת'),
    ])
    sheet('s4_life', [
        ('t14_s2_bowls', 'מכונת ברד: הבורג מסתובב מעל הקרח'), ('t13_s4_till', 'כרטיסי גירוד בקופה'),
        ('t20_d6_screen', 'NOW SERVING, הלוח והשם מעליו'), ('t20_d3_slice', 'המוכר פורס סלמי במכונה'),
        ('t13_p4_kit', 'הרוקחת מאחורי הזכוכית'), ('t13_s6_scratch', 'גירוד: "לא זכיתם הפעם"'),
    ])
if which in ('all', '5'):
    sheet('s5_before_after', [
        ('tB6_B4_shoes', 'לפני · נעליים'), ('t21_a1_shoes', 'אחרי · נעליים'),
        ('tB6_B5_sports', 'לפני · ספורט'), ('t21_b1_sports', 'אחרי · ספורט'),
    ])
    sheet('s5_life', [
        ('t21_a2_bench', 'מחכים על הספסל עם הנעל לדוגמה'), ('t21_a5_box', 'הקיר המואר'),
        ('t21_a6_paid', 'הקופסה מהמחסן בידיים'), ('t21_b4_balls', 'סלי כדורים והליכון'),
        ('t21_b5_tread_on', 'הולכים על ההליכון'), ('t22_j1_jeweller', 'תכשיטים: ספוטים מעל הוויטרינות'),
    ])
