import json, re, sys

# the tests' waits without pictures: the game's updates alone (10-17 ms) while a test waits for
# something to happen, and a picture drawn only for a shot (the tests' software graphics card takes
# 6-8 s a picture: tD1). F(n, k): k times n updates and a picture; G(n, k): the same, no picture
FDEF = "const F = async (n, k = 1) => { for (let i = 0; i < k; i++) { window.__frame(n); await new Promise(r => setTimeout(r, 20)); } }; "
# (the graphics card caught up every 150 updates - left alone, what the updates give it piles up in
# its queue and the browser grows to 10 GB in a minute: tD2, tD3)
GDEF = "const G = async (n, k = 1) => { for (let j = 0; j < k; j++) { for (let i = 0; i < n; i++) { g.update(1 / 30); window.__gN = (window.__gN || 0) + 1; if (window.__gN % 150 === 0) { g.pipe.syncGpu(); g.renderer.setRenderTarget(null); } } await new Promise(r => setTimeout(r, 0)); } }; "

def fix(js):
    if FDEF not in js:
        return js
    js = js.replace(FDEF, FDEF + GDEF, 1)
    # (a wait in a loop: six times as many checks, a sixth as long each - the same time in all, and
    # what it waits for caught within a sixth of a second)
    def loop(m):
        n, cond, a = int(m.group(1)), m.group(2), int(m.group(3))
        k = {30: 6, 10: 2, 5: 1}.get(a)
        if not k:
            return m.group(0)
        return 'while (n++ < %d && %s) await G(%d);' % (n * k, cond, a // k)
    js = re.sub(r'while \(n\+\+ < (\d+) && (.+?)\) await F\((\d+)\);', loop, js)
    # (a long wait not in a loop: its updates without pictures, then the one picture at its end)
    def wait(m):
        a = int(m.group(1))
        k = int(m.group(2)) if m.group(2) else 1
        if a * k < 30:
            return m.group(0)
        return 'await G(%d); await F(1)' % (a * k - 1)
    js = re.sub(r'await F\((\d+)(?:, (\d+))?\)', wait, js)
    return js

for src, dst in zip(sys.argv[1::2], sys.argv[2::2]):
    steps = json.load(open(src))
    out = [dict(s, js=fix(s['js'])) for s in steps]
    json.dump(out, open(dst, 'w'))
    n0 = sum(len(re.findall(r'await F\(', s['js'])) for s in steps)
    n1 = sum(len(re.findall(r'await G\(', s['js'])) for s in out)
    print(dst.split('/')[-1], len(out), 'steps;', n1, 'waits without pictures')
