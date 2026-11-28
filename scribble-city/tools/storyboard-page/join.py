# joins the frames' cards into columns: one picture to look the whole board over
import glob, sys
from PIL import Image

pre = sys.argv[1]
per = int(sys.argv[2]) if len(sys.argv) > 2 else 6
out = sys.argv[3] if len(sys.argv) > 3 else pre + '-all.jpg'
ims = [Image.open(f).convert('RGB') for f in sorted(glob.glob(pre + '-f*.png'))]
w = max(i.width for i in ims)
BG = (21, 16, 26)


def col(lst):
    h = sum(i.height for i in lst) + 16 * len(lst)
    s = Image.new('RGB', (w, h), BG)
    y = 0
    for i in lst:
        s.paste(i, (0, y))
        y += i.height + 16
    return s


cols = [col(ims[i:i + per]) for i in range(0, len(ims), per)]
H = max(c.height for c in cols)
S = Image.new('RGB', (w * len(cols) + 24 * (len(cols) - 1), H), BG)
for k, c in enumerate(cols):
    # (Hebrew reads from the right: the first column is the rightmost)
    S.paste(c, ((len(cols) - 1 - k) * (w + 24), 0))
S.save(out, quality=88)
print(out, S.size)
