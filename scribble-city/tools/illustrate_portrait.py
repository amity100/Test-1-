# (v5, ROADMAP 18) Michael's portrait, illustrated in the game's way - for his campaign boards:
#   python3 scribble-city/tools/illustrate_portrait.py <photo.jpg> <out.jpg>
# The crayon ground kept as it is; on him,
# flat painted planes (an edge-keeping smoothing, then the light in a few soft bands), clean ink
# where the shapes turn, pen hatching in the shadows, the paper's grain.
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, dst = sys.argv[1], sys.argv[2]
dbg = len(sys.argv) > 3
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255.0
H, W, _ = im.shape

def lum(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114

def bilateral(img, r, ss, sc):
    out = np.zeros_like(img)
    wsum = np.zeros(img.shape[:2], np.float32)
    pad = np.pad(img, ((r, r), (r, r), (0, 0)), mode='reflect')
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            ws = np.exp(-(dx * dx + dy * dy) / (2 * ss * ss))
            sh = pad[r + dy:r + dy + img.shape[0], r + dx:r + dx + img.shape[1]]
            d2 = ((sh - img) ** 2).sum(-1)
            w = ws * np.exp(-d2 / (2 * sc * sc))
            out += sh * w[..., None]
            wsum += w
    return out / wsum[..., None]

# --- where he is: the crayon ground is pinks, magentas and violets; he is skin, hair, a dark suit
mx = im.max(-1)
mn = im.min(-1)
sat = (mx - mn) / (mx + 1e-4)
r_, g_, b_ = im[..., 0], im[..., 1], im[..., 2]
# hue in degrees
hue = np.zeros_like(mx)
d = mx - mn + 1e-6
hue = np.where(mx == r_, ((g_ - b_) / d) % 6, np.where(mx == g_, (b_ - r_) / d + 2, (r_ - g_) / d + 4)) * 60
bgSeed = (((hue > 255) | (hue < 8)) & (sat > 0.18) & (b_ > 0.35)) | ((mn > 0.78))
bgSeed = ndi.binary_closing(bgSeed, iterations=4)
# him: the biggest piece that is not ground, its holes filled
fg = ~bgSeed
fg = ndi.binary_opening(fg, iterations=3)
lab, n = ndi.label(fg)
if n:
    sizes = ndi.sum(fg, lab, range(1, n + 1))
    fg = lab == (1 + int(np.argmax(sizes)))
fg = ndi.binary_fill_holes(fg)
fg = ndi.binary_closing(fg, iterations=6)
fg = ndi.binary_fill_holes(fg)
fg = ndi.binary_opening(fg, iterations=9)
fg = ndi.gaussian_filter(fg.astype(np.float32), 3.5) > 0.5
lab, n = ndi.label(fg)
if n:
    sizes = ndi.sum(fg, lab, range(1, n + 1))
    fg = lab == (1 + int(np.argmax(sizes)))
fg = ndi.binary_fill_holes(fg)
# a soft edge
fgS = ndi.gaussian_filter(fg.astype(np.float32), 1.2)

# --- him, painted: smoothing that keeps edges, three times, then a little median
p = im.copy()
for _ in range(3):
    p = bilateral(p, 4, 3.0, 0.09)
p = np.stack([ndi.median_filter(p[..., c], size=5) for c in range(3)], -1)

# the light in soft bands, colour kept
L0 = lum(p)
L = ndi.gaussian_filter(L0, 3.0) * 0.75 + L0 * 0.25
bands = 5.0
q = np.floor(L * bands) / bands
f = L * bands - np.floor(L * bands)
soft = q + (1.0 / bands) * np.clip((f - 0.7) / 0.3, 0, 1) ** 1.5
ratio = (soft + 0.05) / (L0 + 0.05)
cel = np.clip(p * ratio[..., None], 0, 1)
gl = lum(cel)[..., None]
cel = np.clip(gl + (cel - gl) * 1.25, 0, 1)
# a warm rim of sunset on the light side
cel = np.clip(cel * np.array([1.04, 1.0, 0.95], np.float32), 0, 1)

# --- at twice the size for the lines
S = 2
def up(a):
    if a.ndim == 2:
        return np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).resize((W * S, H * S), Image.BICUBIC)).astype(np.float32) / 255.0
    return np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).resize((W * S, H * S), Image.BICUBIC)).astype(np.float32) / 255.0
cel2 = up(cel)
p2 = up(p)
fg2 = up(fgS)
orig2 = up(im)
H2, W2 = fg2.shape

# ink: XDoG of the painted light (not the photo's pores)
Lp = ndi.gaussian_filter(lum(p2), 1.2)
s1 = 2.0
D = ndi.gaussian_filter(Lp, s1) - 0.99 * ndi.gaussian_filter(Lp, s1 * 1.6)
eps = -0.006
ink = np.where(D >= eps, 1.0, 1.0 + np.tanh(140.0 * (D - eps)))
dark = (ink < 0.45) & (fg2 > 0.5)
lab, n = ndi.label(dark)
if n:
    sizes = ndi.sum(dark, lab, range(1, n + 1))
    keep = np.zeros(n + 1, bool)
    keep[1:] = sizes > 160
    dark = keep[lab]
inkm = ndi.gaussian_filter(dark.astype(np.float32), 0.8)
# his outline, drawn round him (a pen line, a little heavier)
edge = fg2 > 0.5
outline = edge ^ ndi.binary_erosion(edge, iterations=4, border_value=1)
outline = ndi.gaussian_filter(outline.astype(np.float32), 1.0)
inkm = np.clip(inkm, 0, 1)
inkcol = np.array([0.09, 0.06, 0.08], np.float32)

# hatching in his shadows: diagonal pen lines, a second layer across in the darkest
yy, xx = np.mgrid[0:H2, 0:W2].astype(np.float32)
rng = np.random.default_rng(3)
wob = ndi.gaussian_filter(rng.standard_normal((H2, W2)).astype(np.float32), 8) * 9
period = 10.0
h1 = (np.abs(((xx + yy + wob) % period) - period / 2) < 0.85).astype(np.float32)
h2 = (np.abs(((xx - yy + wob) % period) - period / 2) < 0.75).astype(np.float32)
Lc = ndi.gaussian_filter(lum(cel2), 2)
w1 = np.clip((0.40 - Lc) / 0.1, 0, 1)
w2 = np.clip((0.22 - Lc) / 0.08, 0, 1)
hatch = np.clip(h1 * w1 * 0.5 + h2 * w2 * 0.45, 0, 1) * (fg2 > 0.5)
hatch = ndi.gaussian_filter(hatch, 0.6)

him = cel2 * (1 - hatch[..., None] * 0.7) + inkcol * hatch[..., None] * 0.7
# the ground: the crayon as it is, a touch richer
gl = lum(orig2)[..., None]
ground = np.clip(gl + (orig2 - gl) * 1.1, 0, 1)
out = ground * (1 - fg2[..., None]) + him * fg2[..., None]
out = out * (1 - inkm[..., None]) + inkcol * inkm[..., None]
grain = ndi.gaussian_filter(rng.standard_normal((H2, W2)).astype(np.float32), 0.8) * 0.02
out = np.clip(out + grain[..., None], 0, 1)
res = Image.fromarray((out * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS)
res.save(dst, quality=90)
if dbg:
    Image.fromarray((fg * 255).astype(np.uint8)).save(dst.replace('.jpg', '_mask.png'))
print('saved', dst, res.size, 'fg', round(float(fg.mean()), 3))
