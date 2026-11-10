# The comic treatment of a frame rendered from the game: flattened colour (cel bands), bold ink where
# the shapes change, halftone dots in the shade, a little paper and grain - the panel's art.
import sys, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd

def load(p):
    return np.asarray(Image.open(p).convert('RGB')).astype(np.float32) / 255.0

def lum(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114

def cel(a, bands=5, soft=0.35):
    # smooth inside shapes, keep edges (a few passes of a small median), then the light in bands
    img = Image.fromarray((a * 255).astype(np.uint8))
    for _ in range(2):
        img = img.filter(ImageFilter.MedianFilter(5))
    b = np.asarray(img).astype(np.float32) / 255.0
    L = lum(b) + 1e-4
    q = np.floor(L * bands) / bands + 0.5 / bands
    # soft step between bands (not a hard posterize: a painted look)
    f = (L * bands) % 1.0
    t = np.clip((f - (1 - soft)) / soft, 0, 1)
    q = q + t / bands
    k = (q / L)[..., None]
    out = np.clip(b * (0.55 + 0.45 * k), 0, 1)
    return out, b

def ink(b, a, strength=1.0, thr=0.10, width=1.2):
    L = lum(b)
    gx = nd.sobel(L, 1); gy = nd.sobel(L, 0)
    g = np.hypot(gx, gy)
    # and the colour edges (a red against a pink of the same light)
    for c in range(3):
        cx = nd.sobel(b[..., c], 1); cy = nd.sobel(b[..., c], 0)
        g = np.maximum(g, 0.7 * np.hypot(cx, cy))
    e = np.clip((g - thr) / thr, 0, 1)
    e = nd.gaussian_filter(e, width * 0.6)
    e = np.clip(e * 1.6, 0, 1) * strength
    # (the game's own dark outlines kept and thickened a touch)
    dark = np.clip((0.16 - lum(a)) / 0.16, 0, 1)
    dark = nd.grey_dilation(dark, size=(2, 2))
    return np.maximum(e, dark)

def halftone(L, cell=6, angle=0.38, shade=0.42):
    h, w = L.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    ca, sa = np.cos(angle), np.sin(angle)
    u = (xx * ca + yy * sa) / cell; v = (-xx * sa + yy * ca) / cell
    du = (u % 1.0) - 0.5; dv = (v % 1.0) - 0.5
    d = np.hypot(du, dv)
    # dot radius grows with the dark; only in the shade
    r = np.clip((shade - L) / shade, 0, 1) * 0.55
    return (d < r).astype(np.float32) * np.clip((shade - L) * 3, 0, 1)

def grade(a, warm=0.06, contrast=1.12, sat=1.12):
    m = a.mean(axis=(0, 1), keepdims=True)
    a = np.clip((a - m) * contrast + m, 0, 1)
    g = lum(a)[..., None]
    a = np.clip(g + (a - g) * sat, 0, 1)
    a[..., 0] = np.clip(a[..., 0] * (1 + warm), 0, 1)
    a[..., 2] = np.clip(a[..., 2] * (1 - warm * 0.6), 0, 1)
    return a

def vignette(a, k=0.28):
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.hypot((xx - w / 2) / (w / 2), (yy - h / 2) / (h / 2))
    return a * (1 - k * np.clip(d - 0.55, 0, 1))[..., None]

def paper(a, seed=3, amt=0.035):
    rng = np.random.default_rng(seed)
    n = rng.normal(0, 1, a.shape[:2]).astype(np.float32)
    n = nd.gaussian_filter(n, 0.8) * amt + nd.gaussian_filter(rng.normal(0, 1, a.shape[:2]).astype(np.float32), 6) * amt
    return np.clip(a + n[..., None], 0, 1)

def treat(src, out, bands=5, ink_k=1.0, dots=True, inkc=(0.10, 0.06, 0.12)):
    a = load(src)
    c, b = cel(a, bands)
    c = grade(c)
    e = ink(b, a, ink_k)
    L = lum(c)
    if dots:
        ht = halftone(L)
        c = c * (1 - 0.35 * ht[..., None])
    inkcol = np.array(inkc, np.float32)
    c = c * (1 - e[..., None]) + inkcol * e[..., None]
    c = vignette(c)
    c = paper(c)
    Image.fromarray((np.clip(c, 0, 1) * 255).astype(np.uint8)).save(out, quality=92)

if __name__ == '__main__':
    treat(sys.argv[1], sys.argv[2], *(float(x) for x in sys.argv[3:4]))
