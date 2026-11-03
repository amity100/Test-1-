import json, re

# t26: stage 8 (ROADMAP 16.8) - the bookshop, the record shop, the toy shop, the florist, the hardware
# store: their rooms, their life (a book read, a record listened to, the platter turning, the train
# going round, a bear hugged, flowers smelled, paint shaken), what the hero buys there
S = '/tmp/claude-0/-home-user-Test-1-/1f04fdad-ca96-5cb8-bcb1-fccf2f5dd162/scratchpad/shop2'
t21 = json.load(open(f'{S}/t21.json'))

HEAD = "const g = window.__game, s = window.__shop, P = g.player; const F = async (n, k = 1) => { for (let i = 0; i < k; i++) { window.__frame(n); await new Promise(r => setTimeout(r, 20)); } }; const A = () => g.streetlife.active.get(window.__shop.id); "
INFO = "const _a = A(); const _L = _a && _a.life2; if (!_L) return 'no life2'; const _H = _L.hobby; return { vis: _a.visitors.map(v => (v.L ? v.L.st + (v.L.svc ? '/' + v.L.svc : '') : v.mode + ':' + v.phase)).join(' '), staff: _L.S ? _L.S.st : null, hobby: _H ? { platter: !!_H.platter, cars: _H.cars.length, shaking: !!_H.shaking, listener: !!_H.listener } : null, items: _L.you.items.map(r => r.what + ':' + r.price).join(','), money: g.money ? g.money.cash : null, perks: { music: !!P.music, gifts: (P.gifts || []).map(x => x.what).join(','), cans: P.paintCans || 0, tape: P.tape || 0, gps: g.gps && g.gps.target ? g.gps.target.name : null } };"


def W(body, shot=None):
    s = {'js': '(async () => { ' + HEAD + body + ' })()'}
    if shot:
        s['shot'] = shot
    return s


def hud(v):
    return {'js': '(() => { const h = document.getElementById("hud"); if (h) h.style.visibility = "%s"; return %d; })()' % ('visible' if v else 'hidden', 1 if v else 0), 'frames': 1}


def frontCam(name, dist, side, h, lh):
    return ("const R = s.room; const m = R.marks['%s']; if (!m) return 'no mark %s'; const y = m.yaw; "
            "window.__camOverride = { pos: [m.x + Math.sin(y) * %s + Math.cos(y) * %s, R.floor + %s, m.z + Math.cos(y) * %s - Math.sin(y) * %s], look: [m.x, %s, m.z] }; await F(10, 1); "
            % (name, name, dist, side, h, dist, side, lh))


def goKind(re_):
    return W("window.__camOverride = null; g.events.t = 1e9; const st = g.world.mainland.stream; const re = %s; let r = window.__goShop(re, 1.8, 0.3); let n = 0; if (r === 'none') { st.scale = 1; while (n++ < 60 && !g.world.shops.some(q => re.test(q.kind) && q.room && q.door)) await F(30); st.scale = 0.45; r = window.__goShop(re, 1.8, 0.3); } await F(30, 2); await F(60, 4); return r + ' (' + n + ') ' + (window.__shop ? window.__shop.id : '');" % re_)


def watch(cond, n, dist, side, h, lh, shot):
    return W("let n = 0; const find = () => A().visitors.find(v => %s); while (n++ < %d && !find()) await F(30); const v = find(); const R = s.room; "
             "if (v) { const c = v.c; const y = c.yaw; window.__camOverride = { pos: [c.pos.x + Math.sin(y) * %s + Math.cos(y) * %s, R.floor + %s, c.pos.z + Math.cos(y) * %s - Math.sin(y) * %s], look: [c.pos.x, R.floor + %s, c.pos.z] }; } await F(3); const out = (() => { " % (cond, n, dist, side, h, dist, side, lh) + INFO + " })(); return { n, found: !!v, ...out };", shot=shot)


def buy(what, shot=None):
    return W("g.events.t = 1e9; window.__camOverride = null; const L = A().life2; const z = L.zones.find(z => z.slots.some(q => q.what === '%s' && q.state === 'shelf')); if (!z) return 'no %s zone'; const sl = z.slots.find(q => q.what === '%s' && q.state === 'shelf'); const dx = z.x - sl.x, dz = z.z - sl.z; const l = Math.hypot(dx, dz) || 1; P.spawn(sl.x + dx / l * 0.8, sl.z + dz / l * 0.8, Math.atan2(-dx, -dz)); await F(3); L.inspect(sl); await F(1); const lab = g.dialog.open && g.dialog.choices ? g.dialog.choices.map(c => c.label).join(' | ') : null; if (g.dialog.open) g.dialog.pick(0); await F(2); const ps = s.room.pay; P.spawn(ps.x, ps.z, ps.yaw); await F(2); const t = g.streetlife.target(); if (t && t.pay) L.you.checkout(); let n = 0; while (n++ < 30 && !g.dialog.open) await F(10); if (g.dialog.open) g.dialog.pick(0); await F(30, 4); const out = (() => { " % (what, what, what) + INFO + " })(); return { lab, ...out };", shot=shot)


steps = [hud(False), t21[1]]
steps.append({'js': "(() => { const g = window.__game; g.world.shops.forEach(s => s.muralChance = 0); if (g.world.mainland && g.world.mainland.stream) g.world.mainland.stream.scale = 0.45; if (g.events) g.events.t = 1e9; return 'capped, events off'; })()"})

# ---- books
steps.append(goKind('/^books$/'))
steps.append(t21[16] | {'shot': 'k1_books'})
steps.append(watch("v.L && v.L.svc === 'read' && v.L.S && v.L.S.t > 1", 70, 1.1, 0.5, 1.6, 1.25, 'k2_read'))
steps.append(W(frontCam('armchair', 2.0, 0.6, 1.6, 'R.floor + 0.6') + INFO, shot='k3_corner'))
steps.append(hud(True))
steps.append(buy('book', 'k4_book'))
steps.append(hud(False))
# ---- records
steps.append(goKind('/^music$/'))
steps.append(t21[16] | {'shot': 'm1_records'})
steps.append(W(frontCam('platter', 0.9, 0.3, 1.5, 'R.floor + 0.95') + INFO, shot='m2_platter'))
steps.append(watch("v.L && v.L.svc === 'listen' && v.L.S && v.L.S.st === 'on'", 90, 1.2, 0.6, 1.65, 1.5, 'm3_listen'))
steps.append(buy('record', None))
# ---- toys
steps.append(goKind('/^toys$/'))
steps.append(t21[16] | {'shot': 'n1_toys'})
steps.append(W(frontCam('train', 1.4, 0.5, 1.4, 'R.floor + 0.7') + "await F(30, 2); " + INFO, shot='n2_train'))
steps.append(watch("v.L && v.L.svc === 'hug'", 90, 1.1, 0.4, 1.5, 1.2, 'n3_hug'))
steps.append(buy('toy', None))
# ---- flowers
steps.append(goKind('/^flowers$/'))
steps.append(t21[16] | {'shot': 'p1_flowers'})
steps.append(watch("v.L && v.L.svc === 'smell'", 90, 1.1, 0.4, 1.6, 1.4, 'p2_smell'))
steps.append(buy('flowers', None))
# ---- hardware
steps.append(goKind('/^hardware$/'))
steps.append(t21[16] | {'shot': 'q1_hardware'})
steps.append(W("const L = A().life2; let n = 0; while (n++ < 90 && !(L.hobby && L.hobby.shaking)) await F(30); " + frontCam('shaker', 1.4, 0.6, 1.5, 'R.floor + 0.85') + "const out = (() => { " + INFO + " })(); return { n, ...out };", shot='q2_shaker'))
steps.append(hud(True))
steps.append(buy('spray', None))
steps.append(buy('tape', 'q3_bought'))

json.dump(steps, open(f'{S}/t26.json', 'w'))
print(len(steps), 'steps')
