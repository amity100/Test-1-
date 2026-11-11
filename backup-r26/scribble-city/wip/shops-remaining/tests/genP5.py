import json

# tP5: phone emulation (MOBILE=1, 640x300): the CPU time a frame takes in the shops of stages 5-9,
# after 8 s of their life; run on this code and on the v76 copy (ROOT=...) for before/after
S = '/tmp/claude-0/-home-user-Test-1-/1f04fdad-ca96-5cb8-bcb1-fccf2f5dd162/scratchpad/shop2'
t21 = json.load(open(f'{S}/t21.json'))
HEAD = "const g = window.__game, s = window.__shop, P = g.player; const F = async (n, k = 1) => { for (let i = 0; i < k; i++) { window.__frame(n); await new Promise(r => setTimeout(r, 20)); } }; "

def W(body):
    return {'js': '(async () => { ' + HEAD + body + ' })()'}

def goKind(re_):
    return W("window.__camOverride = null; if (g.events) g.events.t = 1e9; const st = g.world.mainland.stream; const re = %s; let r = window.__goShop(re, 1.8, 0.3); let n = 0; if (r === 'none') { st.scale = 1; while (n++ < 60 && !g.world.shops.some(q => re.test(q.kind) && q.room && q.door)) await F(30); st.scale = 0.45; r = window.__goShop(re, 1.8, 0.3); } await F(30, 2); await F(60, 4); return r + ' (' + n + ')';" % re_)

def measure(tag):
    return W("const med = (a) => { const b = a.slice().sort((x, y) => x - y); return +b[Math.floor(b.length / 2)].toFixed(2); }; const up = [], re = []; for (let i = 0; i < 10; i++) { window.__frame(1); up.push(g.perf.lastUpd); re.push(g.perf.lastRen); await new Promise(r => setTimeout(r, 10)); } const s2 = window.__shop; const a = s2 && g.streetlife.active.get(s2.id); return { tag: '%s', kind: s2 && s2.kind, upd: med(up), updMax: +Math.max(...up).toFixed(2), ren: med(re), people: a ? a.visitors.length + a.extras.length : null, life2: !!(a && a.life2), dpr: window.devicePixelRatio, w: innerWidth };" % tag)

steps = [{'js': '(() => { const h = document.getElementById("hud"); if (h) h.style.visibility = "hidden"; window.__game.world.shops.forEach(s => s.muralChance = 0); return 1; })()', 'frames': 1}, t21[1]]
steps.append({'js': "(() => { const g = window.__game; if (g.world.mainland && g.world.mainland.stream) g.world.mainland.stream.scale = 0.45; if (g.events) g.events.t = 1e9; return 'capped, events off'; })()"})
for k in ['shoes', 'sports', 'electronics', 'perfume', 'optics', 'barber', 'books', 'music', 'toys', 'flowers', 'hardware', 'laundry', 'gym']:
    steps.append(goKind('/^%s$/' % k))
    steps.append(measure(k))
json.dump(steps, open(f'{S}/tP5.json', 'w'))
print(len(steps), 'steps')
