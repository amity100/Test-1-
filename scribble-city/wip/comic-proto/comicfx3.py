# the light comic print: the render's own lines and colour kept, a little more contrast and colour,
# halftone dots only in the deepest shade, paper grain, a soft vignette
import sys, numpy as np
from PIL import Image
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from comicfx import load, lum, halftone, vignette, paper
def treat(src, out):
    a = load(src)
    m = a.mean(axis=(0, 1), keepdims=True)
    c = np.clip((a - m) * 1.07 + m, 0, 1)
    g = lum(c)[..., None]
    c = np.clip(g + (c - g) * 1.16, 0, 1)
    ht = halftone(lum(c), cell=4, shade=0.24)
    c = c * (1 - 0.18 * ht[..., None])
    c = vignette(c, 0.18)
    c = paper(c, amt=0.018)
    Image.fromarray((np.clip(c, 0, 1) * 255).astype(np.uint8)).save(out, quality=88, optimize=True)
for s, o in zip(sys.argv[1::2], sys.argv[2::2]):
    treat(s, o)
