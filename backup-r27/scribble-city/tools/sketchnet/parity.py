# The network in numpy, with the int8 weights exactly as the game unpacks them: what it says of
# held-out drawings (for parity.mjs to compare with game/sketchnet.js).
import json, numpy as np
from render import render, normalize, qd, SYNTH
from build import load, CLASSES, NVAL

W = np.load('weights.npz')


def deq(name):
    w = W[f'{name}_w'].astype(np.float64)
    co = w.shape[-1]
    s = np.abs(w.reshape(-1, co)).max(0) / 127.0 + 1e-12
    s = np.array([float(f'{v:.6g}') for v in s])
    q = np.clip(np.round(w / s), -127, 127)
    b = np.array([float(f'{v:.6g}') for v in W[f'{name}_b']])
    return (q * s).astype(np.float32), b.astype(np.float32)


P = {n: deq(n) for n in ['c1', 'c2', 'c3', 'f1', 'f2']}


def conv(x, w, b):
    H, Wd, _ = x.shape
    xp = np.pad(x, ((1, 1), (1, 1), (0, 0)))
    out = np.zeros((H, Wd, w.shape[-1]), np.float32) + b
    for ky in range(3):
        for kx in range(3):
            out += xp[ky:ky + H, kx:kx + Wd, :] @ w[ky, kx]
    return np.maximum(out, 0)


def pool(x):
    H, Wd, C = x.shape
    return x.reshape(H // 2, 2, Wd // 2, 2, C).max((1, 3))


def forward(img):
    x = img[:, :, None].astype(np.float32)
    x = pool(conv(x, *P['c1']))
    x = pool(conv(x, *P['c2']))
    x = pool(conv(x, *P['c3']))
    x = x.reshape(-1)
    x = np.maximum(x @ P['f1'][0] + P['f1'][1], 0)
    z = x @ P['f2'][0] + P['f2'][1]
    e = np.exp(z - z.max())
    return e / e.sum()


if __name__ == '__main__':
    rng = np.random.default_rng(5)
    out = []
    right = 0
    for ci, c in enumerate(CLASSES):
        if c in SYNTH:
            drs = [qd(SYNTH[c](rng)) for _ in range(8)]
        else:
            drs = load(c, NVAL)[:8]
        for d in drs:
            p = forward(render(d))
            right += int(p.argmax() == ci)
            out.append({'cls': c, 'strokes': [s.round(2).tolist() for s in d], 'p': [round(float(v), 6) for v in p]})
    json.dump(out, open('parity.json', 'w'))
    print('drawings', len(out), 'numpy top-1', right / len(out))
