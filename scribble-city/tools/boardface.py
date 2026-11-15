# (ROADMAP 23.13, 23.18) Michael's campaign boards carry his face as the game itself draws him. tools/castposter.mjs photographs
# him twice from each place - with him (posterLook.png) and the same street without him (posterLook_bg.png); here he is cut out
# of the street by the difference of the two, set on a poster's own ground (a deep blue, lighter behind his head), cut to the
# boards' frame and saved where game/prologue/set.js reads them.
#   WHO=michael QUERY="look=1" HOUR=11.5 node tools/castposter.mjs <dir>
#   python3 tools/boardface.py <dir> [outDir]        LOOK=posterLook SMILE=posterSmile  (which picture for which board)
import os
import sys
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else 'v5/img/prologue'
# the boards' frame is 450 x 414
OW, OH = 900, 828


def cutout(name):
    a = Image.open(f'{src}/{name}.png').convert('RGB')
    b = Image.open(f'{src}/{name}_bg.png').convert('RGB')
    d = ImageChops.difference(a, b)
    r, g, bl = d.split()
    m = ImageChops.lighter(ImageChops.lighter(r, g), bl).point(lambda v: 255 if v > 10 else 0)
    # (small gaps in him closed; then whatever the outside cannot reach is him too)
    m = m.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7))
    W, H = m.size
    pad = Image.new('L', (W + 2, H + 2), 0)
    pad.paste(m, (1, 1))
    ImageDraw.floodfill(pad, (0, 0), 128)
    m = pad.crop((1, 1, W + 1, H + 1)).point(lambda v: 0 if v == 128 else 255)
    # (specks of the street that changed between the two pictures: opened away)
    m = m.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
    m = m.filter(ImageFilter.GaussianBlur(1.2))
    return a, m


def ground(w, h):
    g = Image.new('RGB', (w, h))
    px = g.load()
    cx, cy = w * 0.5, h * 0.4
    R = (w * w + h * h) ** 0.5 * 0.62
    c0 = (64, 92, 190)
    c1 = (20, 30, 86)
    for y in range(h):
        for x in range(w):
            t = min(1.0, (((x - cx) ** 2 + ((y - cy) * 1.15) ** 2) ** 0.5) / R)
            t = t * t * (3 - 2 * t)
            px[x, y] = tuple(int(c0[i] + (c1[i] - c0[i]) * t) for i in range(3))
    # (a few broad rays up from behind him, faint)
    rays = Image.new('L', (w, h), 0)
    dr = ImageDraw.Draw(rays)
    import math
    for k in range(9):
        a0 = -math.pi / 2 + (k - 4) * 0.36
        for s in (-0.07, 0.07):
            pass
        p = [(cx, cy + h * 0.25), (cx + math.cos(a0 - 0.07) * R * 2, cy + h * 0.25 + math.sin(a0 - 0.07) * R * 2), (cx + math.cos(a0 + 0.07) * R * 2, cy + h * 0.25 + math.sin(a0 + 0.07) * R * 2)]
        dr.polygon(p, fill=26)
    rays = rays.filter(ImageFilter.GaussianBlur(6))
    g = Image.composite(Image.new('RGB', (w, h), (150, 170, 235)), g, rays)
    return g


which = {'look': os.environ.get('LOOK', 'posterLook'), 'smile': os.environ.get('SMILE', 'posterSmile')}
for key, name in which.items():
    a, m = cutout(name)
    W, H = a.size
    # (the frame's shape, from the top of the picture: his head's top a little under its edge)
    w = W
    h = int(w * OH / OW)
    y0 = max(0, int(H * 0.018))
    box = (0, y0, w, min(H, y0 + h))
    a = a.crop(box)
    m = m.crop(box)
    # (a board in the evening's light washes its picture out: him a little deeper and fuller than he was photographed)
    a = ImageEnhance.Color(a).enhance(float(os.environ.get('SAT', 1.12)))
    gm = float(os.environ.get('GAMMA', 1.12))
    a = a.point(lambda v: int(255 * (v / 255) ** gm))
    g = ground(a.size[0] // 4, a.size[1] // 4).resize(a.size, Image.BICUBIC)
    im = Image.composite(a, g, m).resize((OW, OH), Image.LANCZOS)
    to = f'michael_{key}_game.jpg'
    im.save(f'{out}/{to}', quality=90)
    m.resize((OW // 3, OH // 3)).save(f'{src}/{name}_mask.png')
    print(to, im.size)
