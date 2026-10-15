# A small CNN for the 32x32 sketches (game/sketchnet.js runs it in the game).
import json, sys, time, numpy as np
import jax, jax.numpy as jnp, optax

CLASSES = json.load(open('classes.json'))
C = len(CLASSES)
GAME = {
    'airplane': 'plane', 'helicopter': 'copter',
    'car': 'car', 'police car': 'car', 'pickup truck': 'car', 'van': 'car', 'ambulance': 'car',
    'truck': 'truck', 'firetruck': 'truck', 'bus': 'bus', 'school bus': 'bus',
    'motorbike': 'moto', 'bicycle': 'bicycle', 'tractor': 'tractor', 'cannon': 'tank', 'tank': 'tank',
    'rifle': 'gun', 'pistol': 'gun', 'smg': 'gun', 'shotgun': 'gun', 'minigun': 'gun', 'launcher': 'gun', 'sword': 'sword', 'knife': 'sword',
    'axe': 'club', 'hammer': 'club', 'baseball bat': 'club', 'boomerang': 'boomerang', 'bomb': 'bomb',
}
gname = lambda c: GAME.get(c, 'other')

EPOCHS = int(sys.argv[1]) if len(sys.argv) > 1 else 4
# (optional) go on from saved weights (train.py <epochs> <weights.npz> <tag>)
FROM = sys.argv[2] if len(sys.argv) > 2 else None
TAG = sys.argv[3] if len(sys.argv) > 3 else 'w'
BATCH = 256
F1 = 128

d = np.load('data_train.npz')
Xtr, ytr = d['X'], d['y'].astype(np.int32)
v = np.load('data_val.npz')
Xva, yva = v['X'], v['y'].astype(np.int32)
print('train', Xtr.shape, 'val', Xva.shape, flush=True)


def init(key):
    k = jax.random.split(key, 5)
    conv = lambda k, a, b: {'w': jax.random.normal(k, (3, 3, a, b)) * np.sqrt(2 / (9 * a)), 'b': jnp.zeros(b)}
    dense = lambda k, a, b: {'w': jax.random.normal(k, (a, b)) * np.sqrt(2 / a), 'b': jnp.zeros(b)}
    return {'c1': conv(k[0], 1, 16), 'c2': conv(k[1], 16, 32), 'c3': conv(k[2], 32, 64), 'f1': dense(k[3], 1024, F1), 'f2': dense(k[4], F1, C)}


def conv(x, q):
    return jax.lax.conv_general_dilated(x, q['w'], (1, 1), 'SAME', dimension_numbers=('NHWC', 'HWIO', 'NHWC')) + q['b']


def pool(x):
    return jax.lax.reduce_window(x, -jnp.inf, jax.lax.max, (1, 2, 2, 1), (1, 2, 2, 1), 'VALID')


def forward(p, x, key=None):
    x = pool(jax.nn.relu(conv(x, p['c1'])))
    x = pool(jax.nn.relu(conv(x, p['c2'])))
    x = pool(jax.nn.relu(conv(x, p['c3'])))
    x = x.reshape(x.shape[0], -1)
    x = jax.nn.relu(x @ p['f1']['w'] + p['f1']['b'])
    if key is not None:
        x = x * jax.random.bernoulli(key, 0.7, x.shape) / 0.7
    return x @ p['f2']['w'] + p['f2']['b']


def loss_fn(p, x, y, key):
    logits = forward(p, x, key)
    lab = optax.smooth_labels(jax.nn.one_hot(y, C), 0.05)
    return optax.softmax_cross_entropy(logits, lab).mean()


steps_per_epoch = len(Xtr) // BATCH
total = steps_per_epoch * EPOCHS
sched = optax.warmup_cosine_decay_schedule(0.0, 2e-3, 500, total, 2e-5)
opt = optax.adamw(sched, weight_decay=1e-4)
params = init(jax.random.PRNGKey(0))
if FROM:
    W0 = np.load(FROM)
    params = {k: {n: jnp.asarray(W0[f'{k}_{n}']) for n in q} for k, q in params.items()}
    print('from', FROM, flush=True)
state = opt.init(params)


@jax.jit
def step(p, s, x, y, key):
    l, g = jax.value_and_grad(loss_fn)(p, x, y, key)
    u, s = opt.update(g, s, p)
    return optax.apply_updates(p, u), s, l


@jax.jit
def predict(p, x):
    return jax.nn.softmax(forward(p, x))


def evaluate(p):
    P = []
    for i in range(0, len(Xva), 2048):
        P.append(np.asarray(predict(p, (Xva[i:i + 2048, :, :, None] / 255.0).astype(np.float32))))
    P = np.concatenate(P)
    pred = P.argmax(1)
    acc = (pred == yva).mean()
    gn = np.array([gname(c) for c in CLASSES])
    gacc = (gn[pred] == gn[yva]).mean()
    return P, acc, gacc


rng = np.random.default_rng(0)
key = jax.random.PRNGKey(1)
t0 = time.time()
for ep in range(EPOCHS):
    perm = rng.permutation(len(Xtr))
    L = 0
    for i in range(steps_per_epoch):
        idx = np.sort(perm[i * BATCH:(i + 1) * BATCH])
        x = (Xtr[idx, :, :, None] / 255.0).astype(np.float32)
        key, k2 = jax.random.split(key)
        params, state, l = step(params, state, x, ytr[idx], k2)
        L += float(l) if i % 50 == 0 else 0
        if i % 1000 == 0:
            print(f'ep {ep} step {i}/{steps_per_epoch} loss {float(l):.3f} {time.time() - t0:.0f}s', flush=True)
    P, acc, gacc = evaluate(params)
    print(f'== epoch {ep}: val acc {acc:.4f}  game-category acc {gacc:.4f}  {time.time() - t0:.0f}s', flush=True)
    np.savez('weights.npz', **{f'{k}_{n}': np.asarray(v) for k, q in params.items() for n, v in q.items()})
    np.savez(f'{TAG}_ep{ep}.npz', **{f'{k}_{n}': np.asarray(v) for k, q in params.items() for n, v in q.items()})

# per class, and the game's categories' confusions
P, acc, gacc = evaluate(params)
pred = P.argmax(1)
gn = np.array([gname(c) for c in CLASSES])
for ci, c in enumerate(CLASSES):
    m = yva == ci
    wrong = np.bincount(pred[m], minlength=C)
    wrong[ci] = 0
    top = [(CLASSES[j], int(wrong[j])) for j in np.argsort(-wrong)[:3] if wrong[j]]
    print(f'{c:14s} acc {(pred[m] == ci).mean():.3f}  game {(gn[pred[m]] == gn[ci]).mean():.3f}  confused with {top}')
np.save('val_probs.npy', P)
