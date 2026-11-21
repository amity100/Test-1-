# weights.npz -> js/game/sketchnet_w.js: each layer's weights as int8 (a scale per output
# channel), base64; the biases as they are.
import base64, json, sys, numpy as np

W = np.load(sys.argv[2] if len(sys.argv) > 2 else 'weights.npz')
CL = json.load(open('classes.json'))
out = {'classes': CL, 'size': 32, 'layers': {}}
err = 0
for name in ['c1', 'c2', 'c3', 'f1', 'f2']:
    w = W[f'{name}_w'].astype(np.float64)
    b = W[f'{name}_b'].astype(np.float64)
    co = w.shape[-1]
    s = np.abs(w.reshape(-1, co)).max(0) / 127.0 + 1e-12
    q = np.clip(np.round(w / s), -127, 127).astype(np.int8)
    err = max(err, float(np.abs(q * s - w).max() / (np.abs(w).max() + 1e-12)))
    out['layers'][name] = {
        'shape': list(w.shape),
        'q': base64.b64encode(q.tobytes()).decode(),
        's': [float(f'{v:.6g}') for v in s],
        'b': [float(f'{v:.6g}') for v in b],
    }
dst = sys.argv[1]
with open(dst, 'w') as f:
    f.write('// (ROADMAP 11.7) The weights of game/sketchnet.js, learned from people\'s doodles: the\n')
    f.write('// Quick, Draw! dataset by Google (CC BY 4.0, quickdraw.withgoogle.com/data), and drawings made\n')
    f.write('// for what it lacks (pistols, machine pistols, shotguns, miniguns, rocket launchers, bombs,\n')
    f.write('// tanks). Made by a script, not by hand.\n')
    f.write('export const NET = ' + json.dumps(out, separators=(',', ':')) + ';\n')
print('wrote', dst, 'max relative quantization error', round(err, 4))
