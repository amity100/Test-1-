#!/usr/bin/env python3
# Before over after, each with its label (Hebrew, right to left), for a phone's screen.
# Usage: compose.py <before.png> <after.png> <out.png> <label before> <label after> [width]
import sys
from PIL import Image, ImageDraw, ImageFont

a, b, out, la, lb = sys.argv[1:6]
W = int(sys.argv[6]) if len(sys.argv) > 6 else 1266
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 44)
bar = 74
gap = 18


def panel(path, label, colour):
    im = Image.open(path).convert('RGB')
    h = round(im.height * W / im.width)
    im = im.resize((W, h), Image.LANCZOS)
    p = Image.new('RGB', (W, bar + h), (250, 246, 236))
    d = ImageDraw.Draw(p)
    d.rectangle([0, 0, W, bar], fill=colour)
    tw = d.textlength(label, font=font, direction='rtl', language='he')
    d.text((W - 24 - tw, 12), label, font=font, fill=(255, 255, 255), direction='rtl', language='he')
    p.paste(im, (0, bar))
    return p


pa = panel(a, la, (120, 110, 130))
pb = panel(b, lb, (40, 140, 90))
img = Image.new('RGB', (W, pa.height + gap + pb.height), (250, 246, 236))
img.paste(pa, (0, 0))
img.paste(pb, (0, pa.height + gap))
img.save(out, optimize=True, **({'quality': 88} if out.endswith('.jpg') else {}))
print(out, img.size)
