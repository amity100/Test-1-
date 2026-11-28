# The sketch -> 32x32 picture, exactly as game/sketchnet.js does it in the game, plus the
# training's augmentation and the drawings the dataset lacks (pistol, bomb, tank).
import numpy as np

G = 32
MARGIN = 2.0


def render(strokes, r=0.9, aa=0.8):
    """strokes: list of (n, 2) arrays (any units, y down). Returns (G, G) float32 in 0..1."""
    pts = np.concatenate([s for s in strokes if len(s)], 0)
    mn = pts.min(0)
    mx = pts.max(0)
    w, h = mx - mn
    s = max(w, h, 1e-6)
    k = (G - 2 * MARGIN) / s
    ox = (G - w * k) / 2 - mn[0] * k
    oy = (G - h * k) / 2 - mn[1] * k
    segs = []
    for st in strokes:
        if not len(st):
            continue
        P = st * k + np.array([ox, oy])
        if len(P) == 1:
            segs.append(np.concatenate([P[0], P[0]])[None])
        else:
            segs.append(np.concatenate([P[:-1], P[1:]], 1))
    S = np.concatenate(segs, 0).astype(np.float32)
    A = S[:, :2]
    B = S[:, 2:]
    AB = B - A
    L2 = np.maximum((AB * AB).sum(1), 1e-9)
    ys, xs = np.mgrid[0:G, 0:G].astype(np.float32)
    C = np.stack([xs.ravel() + 0.5, ys.ravel() + 0.5], 1)
    d = np.full(G * G, 1e9, np.float32)
    # in chunks of segments (memory)
    for i in range(0, len(S), 256):
        a = A[i:i + 256]
        ab = AB[i:i + 256]
        l2 = L2[i:i + 256]
        AP = C[:, None, :] - a[None]
        t = np.clip((AP * ab[None]).sum(2) / l2[None], 0, 1)
        D = AP - t[..., None] * ab[None]
        d = np.minimum(d, np.sqrt((D * D).sum(2)).min(1))
    img = np.clip(1 - (d - r) / aa, 0, 1)
    return img.reshape(G, G)


def normalize(strokes):
    """Like the dataset's simplified drawings: top-left at 0, the longer side 255."""
    pts = np.concatenate(strokes, 0)
    mn = pts.min(0)
    s = max((pts.max(0) - mn).max(), 1e-6)
    return [(st - mn) * (255.0 / s) for st in strokes]


# how far each kind is turned in training: a blade, a hammer, a bat are drawn any way up (the
# dataset's mostly stand upright); a boomerang, a bomb any way round; guns and planes now and then
# aimed up or down; the rest as they come, a little crooked
SPIN = {'sword': 100, 'knife': 100, 'axe': 100, 'hammer': 100, 'baseball bat': 100, 'boomerang': 180, 'bomb': 180, 'key': 100, 'spring': 20}
GUN_CLASSES = {'rifle', 'pistol', 'smg', 'shotgun', 'minigun', 'launcher'}


def spin(rng, cls):
    if cls in SPIN:
        return rng.uniform(-SPIN[cls], SPIN[cls])
    if cls in GUN_CLASSES and rng.random() < 0.25:
        return rng.uniform(-40, 40)
    if cls == 'airplane' and rng.random() < 0.3:
        return rng.uniform(-45, 45)
    if cls == 'helicopter':
        return rng.uniform(-20, 20)
    return rng.uniform(-12, 12)


def augment(strokes, rng, cls=None):
    S = [st.astype(np.float32).copy() for st in strokes]
    if len(S) >= 4 and rng.random() < 0.12:
        lens = [np.linalg.norm(np.diff(st, axis=0), axis=1).sum() if len(st) > 1 else 0 for st in S]
        order = np.argsort(lens)
        # drop a short-to-middling one, never the longest two
        j = order[rng.integers(0, max(1, len(S) - 2))]
        S.pop(j)
    flip = rng.random() < 0.5
    a = np.deg2rad(spin(rng, cls))
    sx, sy = rng.uniform(0.85, 1.15, 2)
    sh = rng.uniform(-0.12, 0.12)
    ca, sa = np.cos(a), np.sin(a)
    out = []
    for st in S:
        x = st[:, 0] * (-1 if flip else 1)
        y = st[:, 1]
        x, y = sx * x + sh * y, sy * y
        x, y = ca * x - sa * y, sa * x + ca * y
        P = np.stack([x, y], 1) + rng.normal(0, 1.3, (len(st), 2))
        out.append(P)
    return out, rng.uniform(0.72, 1.1)


# ------------------------------------------------------------------ drawings the dataset lacks
def wobble(P, rng, amp=0.012, step=0.03):
    """A line through P as a hand draws it: a slow wander (some hands steadier than others),
    bending gently every few steps - never the fine jitter no drawing in the dataset has."""
    P = np.asarray(P, np.float32)
    out = [P[0]]
    for a, b in zip(P[:-1], P[1:]):
        n = max(1, int(np.linalg.norm(b - a) / step))
        for i in range(1, n + 1):
            out.append(a + (b - a) * (i / n))
    Q = np.array(out)
    if len(Q) > 2:
        # the wander's knots every ~0.1 (a few steps), straight between them
        k = max(2, int(round(len(Q) * step / 0.1)) + 1)
        knots = np.cumsum(rng.normal(0, amp * rng.uniform(0.0, 1.6), (k, 2)), 0)
        knots -= np.linspace(0, 1, k)[:, None] * knots[-1]
        t = np.linspace(0, k - 1, len(Q))
        noise = np.stack([np.interp(t, np.arange(k), knots[:, j]) for j in range(2)], 1)
        Q = Q + noise
    return Q


def rdp(P, eps):
    """Ramer-Douglas-Peucker: the fewest points within eps of the line."""
    if len(P) < 3:
        return P
    keep = np.zeros(len(P), bool)
    keep[0] = keep[-1] = True
    stack = [(0, len(P) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        a, b = P[i], P[j]
        ab = b - a
        l = np.hypot(*ab)
        seg = P[i + 1:j] - a
        if l < 1e-9:
            d = np.hypot(seg[:, 0], seg[:, 1])
        else:
            d = np.abs(seg[:, 0] * ab[1] - seg[:, 1] * ab[0]) / l
        m = int(np.argmax(d))
        if d[m] > eps:
            keep[i + 1 + m] = True
            stack.append((i, i + 1 + m))
            stack.append((i + 1 + m, j))
    return P[keep]


def qd(strokes):
    """As the dataset's own drawings were made ready (and the game makes the player's -
    game/sketchnet.js): top-left at 0, the longer side 255, each line through points a pixel
    apart, then only the points that matter (Ramer-Douglas-Peucker, 2 pixels)."""
    S = normalize([np.asarray(st, np.float64) for st in strokes if len(st)])
    out = []
    for st in S:
        if len(st) > 1:
            seg = np.hypot(*np.diff(st, axis=0).T)
            cum = np.concatenate([[0], np.cumsum(seg)])
            if cum[-1] > 0:
                t = np.arange(0, cum[-1], 1.0)
                t = np.append(t, cum[-1]) if t[-1] < cum[-1] else t
                st = np.stack([np.interp(t, cum, st[:, 0]), np.interp(t, cum, st[:, 1])], 1)
        out.append(rdp(st, 2.0).astype(np.float32))
    return out


def arc(cx, cy, rx, ry, a0, a1, n=24):
    t = np.linspace(a0, a1, n)
    return np.stack([cx + rx * np.cos(t), cy + ry * np.sin(t)], 1)


def gen_pistol(rng):
    L = 1.0
    H = rng.uniform(0.15, 0.3)
    gl = rng.uniform(0.35, 0.65)
    gw = rng.uniform(0.13, 0.24)
    ga = np.deg2rad(rng.uniform(-3, 28))
    gx0 = rng.uniform(0.0, 0.12)
    gx1 = gx0 + gw
    dx = np.tan(ga) * gl
    strokes = []
    style = rng.choice(['outline', 'parts', 'parts', 'revolver', 'simple'], p=[0.35, 0.25, 0.0, 0.2, 0.2])
    if style == 'outline':
        P = [(0, 0), (L, 0), (L, H), (gx1, H), (gx1 - dx, H + gl), (gx0 - dx, H + gl), (gx0, H), (0, H), (0, 0)]
        if rng.random() < 0.3:
            P = [(0, 0), (L, 0), (L, H), (gx1, H), (gx1 - dx, H + gl), (gx0 - dx, H + gl), (0, H), (0, 0)]
        strokes.append(P)
    elif style == 'parts':
        strokes.append([(0, 0), (L, 0), (L, H), (0, H), (0, 0)])
        strokes.append([(gx0, H), (gx1, H), (gx1 - dx, H + gl), (gx0 - dx, H + gl), (gx0, H)])
    elif style == 'revolver':
        bh = H * rng.uniform(0.45, 0.7)
        cx0 = rng.uniform(0.18, 0.3)
        cw = rng.uniform(0.18, 0.28)
        strokes.append([(cx0 + cw, (H - bh) / 2), (L, (H - bh) / 2), (L, (H + bh) / 2), (cx0 + cw, (H + bh) / 2)])
        strokes.append([(cx0, -0.03), (cx0 + cw, -0.03), (cx0 + cw, H + 0.05), (cx0, H + 0.05), (cx0, -0.03)])
        # a curved grip
        g = arc(gx0 + 0.02, H + gl * 0.5, gw * 0.9, gl * 0.55, -np.pi / 2, np.pi / 2 + 0.6, 14)
        strokes.append([(cx0, H * 0.3)] + [tuple(p) for p in g[::-1]] + [(cx0 + 0.02, H)])
    else:
        # an L, a few lines
        strokes.append([(L, 0), (0, 0), (gx0 - dx, H + gl)])
        strokes.append([(L, H), (gx1, H), (gx1 - dx, H + gl)])
        if rng.random() < 0.6:
            strokes.append([(L, 0), (L, H)])
        if rng.random() < 0.6:
            strokes.append([(gx1 - dx, H + gl), (gx0 - dx, H + gl)])
    if rng.random() < 0.7:
        # the trigger guard (and the trigger)
        tg = rng.uniform(0.06, 0.11)
        tx = gx1 + tg * 1.1
        strokes.append([tuple(p) for p in arc(tx, H, tg, tg * rng.uniform(0.9, 1.4), 0.0, np.pi, 10)])
        if rng.random() < 0.5:
            strokes.append([(tx - 0.01, H), (tx - 0.03, H + tg * 0.8)])
    if rng.random() < 0.35:
        strokes.append([(0.02, 0), (0.0, -0.06), (0.08, -0.05), (0.08, 0)])
    if rng.random() < 0.35:
        strokes.append([(L - 0.05, 0), (L - 0.04, -0.05), (L - 0.02, 0)])
    if rng.random() < 0.25:
        y = rng.uniform(0.25, 0.6) * H
        strokes.append([(0.35, y), (L - 0.08, y)])
    return [wobble(s, rng) for s in strokes]


def gen_bomb(rng):
    strokes = []
    asp = rng.uniform(0.85, 1.15)
    if rng.random() < 0.75:
        a0 = rng.uniform(0, 2 * np.pi)
        gap = rng.uniform(-0.2, 0.35)
        strokes.append(arc(0, 0, 1, asp, a0, a0 + 2 * np.pi - gap, int(rng.integers(18, 36))))
        fa = np.deg2rad(rng.uniform(-80, -25))
        bx, by = np.cos(fa), np.sin(fa) * asp
        if rng.random() < 0.6:
            # the cap
            n = np.array([np.cos(fa), np.sin(fa)])
            t = np.array([-n[1], n[0]])
            c = np.array([bx, by])
            w = rng.uniform(0.12, 0.22)
            h = rng.uniform(0.1, 0.2)
            P = [c + t * w, c + t * w + n * h, c - t * w + n * h, c - t * w]
            strokes.append(np.array(P))
            bx, by = (c + n * h)
        if rng.random() < 0.92:
            ln = rng.uniform(0.35, 0.9)
            k = int(rng.integers(6, 12))
            tt = np.linspace(0, 1, k)
            dirx, diry = np.cos(fa), np.sin(fa)
            wav = np.sin(tt * np.pi * rng.uniform(1, 2.5)) * rng.uniform(0.04, 0.15)
            F = np.stack([bx + dirx * ln * tt - diry * wav, by + diry * ln * tt + dirx * wav], 1)
            strokes.append(F)
            if rng.random() < 0.6:
                e = F[-1]
                for j in range(int(rng.integers(3, 7))):
                    q = rng.uniform(0, 2 * np.pi)
                    rr = rng.uniform(0.08, 0.2)
                    strokes.append(np.array([e + 0.03 * np.array([np.cos(q), np.sin(q)]), e + rr * np.array([np.cos(q), np.sin(q)])]))
        if rng.random() < 0.3:
            strokes.append(arc(-0.1, -0.1, 0.55, 0.55 * asp, np.pi * 1.05, np.pi * 1.45, 6))
    else:
        # a grenade: an oval with ridges, the lever and the ring on top
        asp = rng.uniform(1.15, 1.45)
        strokes.append(arc(0, 0, 1, asp, 0, 2 * np.pi, 30))
        for y in np.linspace(-0.5, 0.5, int(rng.integers(1, 4))) * asp:
            w = np.sqrt(max(0.05, 1 - (y / asp) ** 2))
            strokes.append(np.array([(-w, y), (w, y)]))
        if rng.random() < 0.6:
            for x in np.linspace(-0.45, 0.45, int(rng.integers(1, 3))):
                h = np.sqrt(max(0.05, 1 - x * x)) * asp
                strokes.append(np.array([(x, -h), (x, h)]))
        top = -asp
        strokes.append(np.array([(-0.25, top), (-0.25, top - 0.25), (0.25, top - 0.25), (0.25, top)]))
        strokes.append(np.array([(0.25, top - 0.2), (0.9, top + 0.1), (0.8, top + 0.6)]))
        strokes.append(arc(-0.45, top - 0.3, 0.2, 0.2, 0, 2 * np.pi, 12))
    return [wobble(s, rng, amp=0.02, step=0.06) for s in strokes]


def gen_tank(rng):
    strokes = []
    W = rng.uniform(1.5, 2.2)
    hh = rng.uniform(0.25, 0.45)
    th = rng.uniform(0.25, 0.42)
    # the hull (a trapezoid or a box) over the tracks
    s1 = rng.uniform(0.0, 0.25)
    hull = [(s1, 0), (W - s1 * 0.6, 0), (W, hh), (0, hh), (s1, 0)]
    strokes.append(hull)
    # the tracks: a long round-ended band under it, wheels inside (or just wheels under it)
    y0 = hh
    y1 = hh + th
    r = th / 2
    band = rng.random() < 0.6
    if band:
        tr = list(arc(r, y0 + r, r, r, np.pi / 2, 3 * np.pi / 2, 8)) + list(arc(W - r, y0 + r, r, r, -np.pi / 2, np.pi / 2, 8)) + [(r, y1)]
        strokes.append(np.array(tr)[::-1] if rng.random() < 0.5 else np.array(tr))
    nw = int(rng.integers(0 if band else 3, 7))
    if nw:
        for x in np.linspace(r, W - r, nw):
            rw = r * rng.uniform(0.55, 0.85)
            strokes.append(arc(x, y0 + r, rw, rw, 0, 2 * np.pi, 10))
    # the turret
    tw = rng.uniform(0.5, 0.85)
    tx = rng.uniform(0.35, 0.7) * (W - tw)
    tht = rng.uniform(0.22, 0.4)
    if rng.random() < 0.5:
        strokes.append(arc(tx + tw / 2, 0, tw / 2, tht, np.pi, 2 * np.pi, 14))
        tyc = -tht * 0.45
    else:
        strokes.append(np.array([(tx, 0), (tx + 0.05, -tht), (tx + tw - 0.05, -tht), (tx + tw, 0)]))
        tyc = -tht * 0.5
    # the barrel, forward (to +x), a little up
    bl = rng.uniform(0.6, 1.2)
    ang = np.deg2rad(rng.uniform(-4, 18))
    bx = tx + tw * 0.92
    bw = rng.uniform(0.04, 0.09)
    d = np.array([np.cos(ang), -np.sin(ang)])
    nn = np.array([-d[1], d[0]])
    b0 = np.array([bx, tyc])
    if rng.random() < 0.5:
        strokes.append(np.array([b0 + nn * bw, b0 + nn * bw + d * bl, b0 - nn * bw + d * bl, b0 - nn * bw]))
    else:
        strokes.append(np.array([b0, b0 + d * bl]))
    if rng.random() < 0.3:
        strokes.append(np.array([(tx + tw * 0.3, -tht), (tx + tw * 0.2, -tht - rng.uniform(0.3, 0.6))]))
    if rng.random() < 0.3:
        strokes.append(np.array([(tx + tw * 0.35, -tht), (tx + tw * 0.35, -tht - 0.07), (tx + tw * 0.6, -tht - 0.07), (tx + tw * 0.6, -tht)]))
    return [wobble(s, rng, amp=0.012, step=0.04) for s in strokes]


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]


def guard_and_grip(rng, gx, top, gl, gw, ga):
    """a grip hanging from (gx, top), leaning back by ga; the trigger guard in front of it"""
    dx = np.tan(ga) * gl
    out = [[(gx, top), (gx + gw, top), (gx + gw - dx, top + gl), (gx - dx, top + gl), (gx, top)]]
    if rng.random() < 0.7:
        tg = gw * rng.uniform(0.45, 0.7)
        out.append([tuple(p) for p in arc(gx + gw + tg, top, tg, tg * 1.2, 0.0, np.pi, 9)])
    return out


def gen_smg(rng):
    """a machine pistol: a box, a stub of a barrel, a grip, a magazine down in front of (or in) it"""
    L = 1.0
    H = rng.uniform(0.2, 0.32)
    strokes = [rect(0.12, 0, L * 0.85, H)]
    bh = H * rng.uniform(0.25, 0.45)
    strokes.append(rect(L * 0.85, H * 0.3, L, H * 0.3 + bh))
    gx = rng.uniform(0.25, 0.4)
    gw = rng.uniform(0.1, 0.15)
    gl = rng.uniform(0.3, 0.45)
    strokes += guard_and_grip(rng, gx, H, gl, gw, np.deg2rad(rng.uniform(0, 20)))
    # the magazine: in front of the grip (or through it, an Uzi's)
    mx = gx + gw + rng.uniform(0.08, 0.2) if rng.random() < 0.75 else gx + 0.02
    ml = rng.uniform(0.45, 0.75)
    mw = rng.uniform(0.07, 0.11)
    ma = np.deg2rad(rng.uniform(-8, 12))
    strokes.append([(mx, H), (mx + mw, H), (mx + mw + np.tan(ma) * ml, H + ml), (mx + np.tan(ma) * ml, H + ml), (mx, H)])
    if rng.random() < 0.5:
        # a stock, folded or out back
        st = rng.uniform(0.2, 0.4)
        strokes.append([(0.12, H * 0.3), (0.12 - st, H * 0.4), (0.12 - st, H * 1.2), (0.12, H * 0.9)])
    if rng.random() < 0.4:
        strokes.append([(L * 0.55, 0), (L * 0.57, -0.06), (L * 0.66, -0.06), (L * 0.68, 0)])
    return [wobble(s, rng) for s in strokes]


def gen_shotgun(rng):
    """a long gun with two barrels side by side (or one and a pump under it), a stock"""
    L = 1.0
    bh = rng.uniform(0.035, 0.06)
    y0 = 0.0
    body0 = rng.uniform(0.25, 0.35)
    strokes = []
    if rng.random() < 0.7:
        # two barrels, one over the other
        strokes.append(rect(body0, y0, L, y0 + bh))
        strokes.append(rect(body0, y0 + bh, L, y0 + 2 * bh + rng.uniform(0, 0.01)))
        bot = y0 + 2 * bh
    else:
        strokes.append(rect(body0, y0, L, y0 + bh))
        px = rng.uniform(0.55, 0.7)
        strokes.append(rect(px, y0 + bh, px + rng.uniform(0.14, 0.22), y0 + bh + rng.uniform(0.04, 0.07)))
        bot = y0 + bh
    # the receiver and the stock going down and back
    rh = rng.uniform(0.07, 0.12)
    strokes.append([(body0, y0), (body0 - 0.1, y0), (0.0, y0 + rng.uniform(0.04, 0.1)), (0.0, y0 + rh + rng.uniform(0.1, 0.18)), (body0 - 0.12, bot + rh * 0.6), (body0, bot + rh * 0.4), (body0, y0)])
    if rng.random() < 0.6:
        tg = rng.uniform(0.03, 0.05)
        strokes.append([tuple(p) for p in arc(body0 + 0.04, bot + rh * 0.3, tg, tg, 0.0, np.pi, 9)])
    return [wobble(s, rng, amp=0.008, step=0.025) for s in strokes]


def gen_minigun(rng):
    """a drum of a body, three to six barrels bundled out in front, a handle on top, a belt"""
    strokes = []
    bw = rng.uniform(0.3, 0.45)
    bh = rng.uniform(0.25, 0.4)
    strokes.append(rect(0, 0, bw, bh))
    n = int(rng.integers(3, 7))
    bl = rng.uniform(0.55, 0.9)
    y0 = bh * 0.12
    y1 = bh * 0.88
    for y in np.linspace(y0, y1, n):
        if rng.random() < 0.5:
            strokes.append([(bw, y), (bw + bl, y)])
        else:
            strokes.append(rect(bw, y - 0.012, bw + bl, y + 0.012))
    for x in sorted(rng.uniform(bw + 0.1, bw + bl - 0.05, int(rng.integers(0, 3)))):
        strokes.append(rect(x, y0 - 0.03, x + 0.05, y1 + 0.03))
    if rng.random() < 0.7:
        strokes.append([tuple(p) for p in arc(bw * 0.5, 0, bw * 0.35, bh * 0.5, np.pi, 2 * np.pi, 10)])
    if rng.random() < 0.6:
        strokes += guard_and_grip(rng, bw * 0.3, bh, rng.uniform(0.2, 0.35), rng.uniform(0.08, 0.12), np.deg2rad(rng.uniform(0, 15)))
    if rng.random() < 0.5:
        t = np.linspace(0, 1, 10)
        strokes.append(np.stack([bw * 0.6 - t * 0.25 + np.sin(t * 9) * 0.03, bh + t * 0.5], 1))
    return [wobble(s, rng, amp=0.01, step=0.03) for s in strokes]


def gen_launcher(rng):
    """a fat tube on the shoulder: a grip (two) under it, a sight on it, a warhead or a flare"""
    L = 1.0
    H = rng.uniform(0.13, 0.22)
    strokes = [rect(0.08, 0, L * 0.86, H)]
    if rng.random() < 0.55:
        # a warhead out front: a cone, a diamond
        w = rng.uniform(0.12, 0.22)
        bulge = H * rng.uniform(0.25, 0.6)
        strokes.append([(L * 0.86, -bulge * 0.3), (L * 0.86 + w * 0.5, -bulge), (L * 0.86 + w, H / 2), (L * 0.86 + w * 0.5, H + bulge), (L * 0.86, H + bulge * 0.3)])
    else:
        strokes.append([(L * 0.86, 0), (L * 0.95, -H * 0.15), (L * 0.95, H * 1.15), (L * 0.86, H)])
    # the back end, flared
    strokes.append([(0.08, 0), (0.0, -H * 0.2), (0.0, H * 1.2), (0.08, H)])
    gx = rng.uniform(0.35, 0.5)
    strokes += guard_and_grip(rng, gx, H, rng.uniform(0.2, 0.32), rng.uniform(0.07, 0.1), np.deg2rad(rng.uniform(0, 15)))
    if rng.random() < 0.5:
        strokes.append(rect(gx + 0.2, H, gx + 0.27, H + rng.uniform(0.12, 0.2)))
    if rng.random() < 0.7:
        sx = rng.uniform(0.4, 0.6)
        strokes.append(rect(sx, -rng.uniform(0.06, 0.1), sx + rng.uniform(0.08, 0.14), 0))
    return [wobble(s, rng, amp=0.008, step=0.03) for s in strokes]


def gen_plane_side(rng):
    """a plane from the side: a long body, its nose round, its tail rising to a fin; a wing across
    its middle; a propeller or a jet; windows, wheels now and then"""
    L = 1.0
    h = rng.uniform(0.1, 0.18)
    strokes = []
    t = np.linspace(0, 1, 18)
    top = h * (0.5 + 0.5 * np.sqrt(np.clip(t * 6, 0, 1))) - np.clip(0.25 - t, 0, None) * rng.uniform(0.0, 0.4)
    bot = -h * 0.5 * np.sqrt(np.clip(t * 6, 0, 1)) * (1 - np.clip(0.3 - t, 0, None) * 2)
    # (the body: its tail at x=0 a little up, its nose at x=L)
    body = [(x, -y) for x, y in zip(t * L, top)] + [(x, -y) for x, y in zip((t * L)[::-1], bot[::-1])]
    strokes.append(np.array(body + [body[0]]))
    # the fin over its tail, the tailplane
    fh = rng.uniform(0.12, 0.25)
    strokes.append(np.array([(0.02, -h * 0.8), (0.05, -h * 0.8 - fh), (0.14, -h * 0.8 - fh * 0.9), (0.22, -h * 0.9)]))
    if rng.random() < 0.6:
        strokes.append(np.array([(0.0, -h * 0.55), (0.16, -h * 0.55)]))
    # the wing: a line, a thin slanted shape
    wx = rng.uniform(0.4, 0.55)
    wc = rng.uniform(0.18, 0.3)
    if rng.random() < 0.5:
        strokes.append(np.array([(wx - wc / 2, 0.0), (wx + wc / 2, 0.0)]))
    else:
        d = rng.uniform(0.05, 0.15)
        strokes.append(np.array([(wx - wc / 2, 0.0), (wx + wc / 2 - 0.05, d), (wx + wc / 2, d * 0.6), (wx + wc / 2 + 0.02, 0.0), (wx - wc / 2, 0.0)]))
    if rng.random() < 0.55:
        # a propeller up its nose
        ph = rng.uniform(0.12, 0.25)
        strokes.append(np.array([(L + 0.02, -h * 0.25 - ph / 2), (L + 0.02, -h * 0.25 + ph / 2)]))
    elif rng.random() < 0.6:
        strokes.append(np.array([(wx - 0.06, 0.02), (wx + 0.06, 0.02), (wx + 0.06, 0.06), (wx - 0.06, 0.06), (wx - 0.06, 0.02)]))
    if rng.random() < 0.5:
        for x in np.linspace(0.35, 0.85, int(rng.integers(3, 8))):
            strokes.append(arc(x, -h * 0.55, 0.012, 0.012, 0, 2 * np.pi, 7))
    if rng.random() < 0.35:
        for x in [0.3, 0.75]:
            strokes.append(arc(x, h * 0.62, 0.025, 0.025, 0, 2 * np.pi, 8))
    return [wobble(s, rng, amp=0.008, step=0.025) for s in strokes]



def gen_shield(rng):
    """a shield, as held to the front: round (a boss in its middle), a knight's (pointed at the
    bottom), a riot shield (tall, a window), or a kite; a cross or a band on it now and then"""
    strokes = []
    r = rng.random()
    if r < 0.32:
        asp = rng.uniform(0.9, 1.1)
        strokes.append(arc(0, 0, 1, asp, 0, 2 * np.pi, int(rng.integers(20, 34))))
        if rng.random() < 0.7:
            b = rng.uniform(0.15, 0.32)
            strokes.append(arc(0, 0, b, b * asp, 0, 2 * np.pi, 12))
        if rng.random() < 0.4:
            rr = rng.uniform(0.7, 0.85)
            strokes.append(arc(0, 0, rr, rr * asp, 0, 2 * np.pi, 22))
        top, bot, half = -asp, asp, 1.0
    elif r < 0.62:
        # the knight's: a flat (or curved) top, sides down, to a point
        w = rng.uniform(0.75, 1.0)
        h = rng.uniform(1.15, 1.5)
        mid = rng.uniform(0.15, 0.45) * h
        bow = rng.uniform(0, 0.12)
        pts = [(-w, -h / 2), (-w, -h / 2 + mid)]
        for t in np.linspace(0.15, 1, 7):
            pts.append((-w * (1 - t) ** 1.4, -h / 2 + mid + (h - mid) * t))
        for t in np.linspace(0.85, 0, 7):
            pts.append((w * (1 - t) ** 1.4, -h / 2 + mid + (h - mid) * t))
        pts.append((w, -h / 2))
        for x in np.linspace(w, -w, 9)[1:]:
            pts.append((x, -h / 2 - bow * np.sin(np.pi * (x + w) / (2 * w))))
        strokes.append(np.array(pts))
        top, bot, half = -h / 2, h / 2, w
    elif r < 0.85:
        # a riot shield: tall, rounded, a window near its top
        w = rng.uniform(0.5, 0.7)
        h = rng.uniform(1.4, 2.0)
        rr = rng.uniform(0.08, 0.2)
        strokes.append(np.array([(-w + rr, -h / 2), (w - rr, -h / 2), (w, -h / 2 + rr), (w, h / 2 - rr), (w - rr, h / 2), (-w + rr, h / 2), (-w, h / 2 - rr), (-w, -h / 2 + rr), (-w + rr, -h / 2)]))
        if rng.random() < 0.75:
            y0 = -h / 2 + h * rng.uniform(0.12, 0.2)
            strokes.append(np.array(rect(-w * 0.6, y0, w * 0.6, y0 + h * rng.uniform(0.1, 0.16))))
        top, bot, half = -h / 2, h / 2, w
    else:
        # a kite: round top, long point down
        w = rng.uniform(0.6, 0.85)
        h = rng.uniform(1.6, 2.1)
        cap = arc(0, -h / 2 + w, w, w, np.pi, 2 * np.pi, 12)
        strokes.append(np.concatenate([cap, [(w, -h / 2 + w), (0, h / 2), (-w, -h / 2 + w)]]))
        top, bot, half = -h / 2, h / 2, w
    if rng.random() < 0.35:
        # a cross on it
        strokes.append(np.array([(0, top + 0.18 * (bot - top)), (0, bot - 0.2 * (bot - top))]))
        y = top + rng.uniform(0.3, 0.45) * (bot - top)
        strokes.append(np.array([(-half * 0.6, y), (half * 0.6, y)]))
    elif rng.random() < 0.3:
        y = top + rng.uniform(0.35, 0.55) * (bot - top)
        strokes.append(np.array([(-half * 0.85, y), (half * 0.85, y)]))
    return [wobble(s, rng, amp=0.02, step=0.06) for s in strokes]


def gen_spring(rng):
    """a spring: a coil (loops, or a zigzag) standing up or lying down, a plate at an end or both
    now and then (a spring to jump on)"""
    strokes = []
    n = int(rng.integers(4, 10))
    L = rng.uniform(1.4, 3.0)
    W = rng.uniform(0.35, 0.7)
    if rng.random() < 0.55:
        # loops: a helix seen from the side
        t = np.linspace(0, n * 2 * np.pi, n * 14)
        tilt = rng.uniform(0.15, 0.45)
        x = W * np.sin(t)
        y = -L / 2 + L * t / t[-1] + tilt * W * np.cos(t)
        strokes.append(np.stack([x, y], 1))
    else:
        ys = np.linspace(-L / 2, L / 2, n * 2 + 1)
        xs = np.array([(-W if i % 2 else W) if 0 < i < len(ys) - 1 else 0 for i in range(len(ys))])
        strokes.append(np.stack([xs, ys], 1))
    plates = rng.random()
    if plates < 0.6:
        pw = W * rng.uniform(1.3, 2.2)
        strokes.append(np.array([(-pw, -L / 2 - 0.05), (pw, -L / 2 - 0.05)]))
        if plates < 0.35:
            strokes.append(np.array([(-pw, L / 2 + 0.05), (pw, L / 2 + 0.05)]))
    out = [wobble(s, rng, amp=0.015, step=0.05) for s in strokes]
    if rng.random() < 0.45:
        # lying down
        out = [s[:, ::-1] for s in out]
    return out

SYNTH = {'pistol': gen_pistol, 'bomb': gen_bomb, 'tank': gen_tank, 'smg': gen_smg, 'shotgun': gen_shotgun, 'minigun': gen_minigun, 'launcher': gen_launcher, 'shield': gen_shield, 'spring': gen_spring}
# (made up after the first ones: after the dataset's second lot in the classes' order - build.py)
SYNTH_NEW = ('shield', 'spring')
