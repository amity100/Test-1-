"""Side-by-side comparison: reference image (full + head crop) next to a harness render.

usage: python3 tools/hair/compare.py <reference.png> <render.png> <out.png> [crop x0 y0 x1 y1 in reference pixels]
"""
import sys
from PIL import Image, ImageDraw, ImageFont


def main():
    ref_p, ren_p, out_p = sys.argv[1:4]
    crop = tuple(int(v) for v in sys.argv[4:8]) if len(sys.argv) >= 8 else None
    ref = Image.open(ref_p).convert("RGB")
    ren = Image.open(ren_p).convert("RGB")
    H = ren.height
    panels = [ref.resize((round(ref.width * H / ref.height), H), Image.LANCZOS)]
    if crop is None:
        # David's head in the provided reference (1122 x 1402)
        s = ref.width / 1122
        crop = (int(250 * s), int(10 * s), int(560 * s), int(395 * s))
    c = ref.crop(crop)
    panels.append(c.resize((round(c.width * H / c.height), H), Image.LANCZOS))
    panels.append(ren)
    gap = 8
    W = sum(p.width for p in panels) + gap * (len(panels) - 1)
    out = Image.new("RGB", (W, H + 30), (18, 18, 18))
    d = ImageDraw.Draw(out)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 16)
    except OSError:
        font = ImageFont.load_default()
    x = 0
    for p, label in zip(panels, ["reference", "reference (head)", "render: createGroom(david, 'david', high)"]):
        out.paste(p, (x, 30))
        d.text((x + 8, 6), label, fill=(230, 230, 230), font=font)
        x += p.width + gap
    out.save(out_p, quality=92)
    print(out_p, out.size)


if __name__ == "__main__":
    main()
