# The training set: every class's drawings (the dataset's, or made here for pistol, bomb, tank),
# each rendered twice with a different augmentation; a held-out set rendered plainly.
import json, sys, time, numpy as np
from multiprocessing import Pool
from render import render, normalize, augment, qd, SYNTH, SYNTH_NEW

REAL = [l.strip() for l in open('classes.txt') if l.strip()]
REAL2 = [l.strip() for l in open("classes2.txt") if l.strip()]
CLASSES = REAL + [c for c in SYNTH if c not in SYNTH_NEW] + REAL2 + list(SYNTH_NEW)
NVAL = 1500
NTRAIN = 19500
COPIES = 2

def load(c, n):
    out = []
    with open('raw/' + c.replace(' ', '_') + '.part') as f:
        for line in f:
            try:
                d = json.loads(line)
            except Exception:
                continue
            if not d.get('recognized'):
                continue
            st = [np.array(s, np.float32).T for s in d['drawing'] if len(s[0])]
            if st:
                out.append(st)
            if len(out) >= n:
                break
    return out

def job(args):
    ci, part, seed = args
    rng = np.random.default_rng(seed)
    c = CLASSES[ci]
    if c in SYNTH:
        nv = NVAL if part == 'val' else NTRAIN
        drs = [qd(SYNTH[c](rng)) for _ in range(nv)]
    else:
        alld = load(c, NVAL + NTRAIN)
        drs = alld[:NVAL] if part == 'val' else alld[NVAL:]
        if c == 'airplane' and part == 'train':
            # (a fifth of them drawn from the side, as a player making one to fly may: the
            # dataset's are mostly seen from above)
            from render import gen_plane_side
            drs = drs[: int(len(drs) * 0.8)] + [qd(gen_plane_side(rng)) for _ in range(len(drs) - int(len(drs) * 0.8))]
    X = []
    for d in drs:
        if part == 'val':
            X.append(render(d))
        else:
            for _ in range(COPIES):
                a, r = augment(d, rng, c)
                X.append(render(a, r))
    X = (np.stack(X) * 255).round().astype(np.uint8)
    return ci, part, X

if __name__ == '__main__':
    t0 = time.time()
    tasks = [(ci, p, 1000 + ci * 7 + (p == 'val')) for ci in range(len(CLASSES)) for p in ('train', 'val')]
    out = {'train': [], 'val': []}
    with Pool(4) as pool:
        for ci, p, X in pool.imap_unordered(job, tasks):
            out[p].append((ci, X))
            print(f'{CLASSES[ci]:14s} {p:5s} {len(X):6d}  {time.time() - t0:6.0f}s', flush=True)
    for p in ('train', 'val'):
        out[p].sort(key=lambda t: t[0])
        X = np.concatenate([x for _, x in out[p]])
        y = np.concatenate([np.full(len(x), ci, np.int16) for ci, x in out[p]])
        np.savez(f'data_{p}.npz', X=X, y=y)
        print(p, X.shape, np.bincount(y))
    json.dump(CLASSES, open('classes.json', 'w'))
