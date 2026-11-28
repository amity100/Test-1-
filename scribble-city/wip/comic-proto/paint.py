# painterly: a Kuwahara filter (each pixel takes the mean colour of the calmest of the four squares
# round it - the flat painted shapes of a brush, with the edges kept), twice, small and large; then
# brush-stroke texture along the image's own flow, the game's ink lines put back thin, a warm glow
import sys, numpy as np
from PIL import Image
from scipy import ndimage as nd

def kuwahara(a, r):
    h, w, _ = a.shape
    L = a.mean(axis=2)
    def box(x):
        c = np.cumsum(np.cumsum(np.pad(x, ((1, 0), (1, 0)) + ((0, 0),) * (x.ndim - 2)), 0), 1)
        return c
    S = box(a); S2 = box(L * L); SL = box(L)
    def rect(C, y0, x0, y1, x1):
        return C[y1, x1] - C[y0, x1] - C[y1, x0] + C[y0, x0]
    yy, xx = np.mgrid[0:h, 0:w]
    best_v = np.full((h, w), np.inf, np.float32); out = np.zeros_like(a)
    for dy, dx in ((-r, -r), (-r, 0), (0, -r), (0, 0)):
        y0 = np.clip(yy + dy, 0, h); x0 = np.clip(xx + dx, 0, w)
        y1 = np.clip(yy + dy + r + 1, 0, h); x1 = np.clip(xx + dx + r + 1, 0, w)
        n = np.maximum((y1 - y0) * (x1 - x0), 1).astype(np.float32)
        m = rect(SL, y0, x0, y1, x1) / n
        v = rect(S2, y0, x0, y1, x1) / n - m * m
        col = np.stack([rect(S[..., c], y0, x0, y1, x1) for c in range(3)], -1) / n[..., None]
        sel = v < best_v
        best_v = np.where(sel, v, best_v); out = np.where(sel[..., None], col, out)
    return out

def strokes(a, seed=5):
    # brush texture: noise smeared along the direction the colour flows (perpendicular to its gradient)
    L = a.mean(axis=2)
    gy, gx = np.gradient(nd.gaussian_filter(L, 3))
    ang = np.arctan2(gy, gx) + np.pi / 2
    rng = np.random.default_rng(seed)
    n = rng.random(L.shape).astype(np.float32)
    acc = np.zeros_like(n)
    h, w = L.shape; yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    for k in range(-6, 7):
        acc += nd.map_coordinates(n, [yy + np.sin(ang) * k, xx + np.cos(ang) * k], order=1, mode='reflect')
    acc /= 13
    return (acc - acc.mean()) * 2.2

def paint(src, out):
    a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255
    p = kuwahara(a, 5)
    p = kuwahara(p, 9)
    t = strokes(p)
    p = np.clip(p * (1 + 0.16 * t[..., None]), 0, 1)
    # the game's own dark lines, thin, back over the paint
    ink = np.clip((0.2 - a.mean(axis=2)) / 0.2, 0, 1)
    p = p * (1 - 0.6 * ink[..., None]) + np.array([0.1, 0.05, 0.14]) * 0.6 * ink[..., None]
    # a warm painted glow from the light parts, colour pushed
    glow = nd.gaussian_filter(np.clip(p - 0.72, 0, 1), (14, 14, 0)) * 1.4
    p = np.clip(p + glow, 0, 1)
    g = p.mean(axis=2, keepdims=True)
    p = np.clip(g + (p - g) * 1.25, 0, 1)
    Image.fromarray((p * 255).astype(np.uint8)).save(out, quality=90)

for s, o in zip(sys.argv[1::2], sys.argv[2::2]):
    paint(s, o)
