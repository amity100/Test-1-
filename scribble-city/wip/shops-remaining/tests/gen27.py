import json

# t27: stage 9 (ROADMAP 16.9) - the laundromat and the gym
S = '/tmp/claude-0/-home-user-Test-1-/1f04fdad-ca96-5cb8-bcb1-fccf2f5dd162/scratchpad/shop2'
t21 = json.load(open(f'{S}/t21.json'))
HEAD = "const g = window.__game, s = window.__shop, P = g.player; const F = async (n, k = 1) => { for (let i = 0; i < k; i++) { window.__frame(n); await new Promise(r => setTimeout(r, 20)); } }; const A = () => g.streetlife.active.get(window.__shop.id); "
INFO = "const _a = A(); const _L = _a && _a.life2; if (!_L) return 'no life2'; const _V = _L.service; return { vis: _a.visitors.map(v => (v.L ? v.L.st + (v.L.svc ? '/' + v.L.svc + (v.L.S ? ':' + v.L.S.st : '') : '') : v.mode + ':' + v.phase)).join(' '), service: _V ? { running: _V.machines.filter(q => q.left > 0).length + '/' + _V.machines.length, drums: [..._V.machines, ..._V.dryers].filter(q => q.drum).length, bag: !!_V.bag, swing: +_V.swing.toFixed(2), bar: !!_V.bar, at: Object.entries(_V.at).filter(([k, v]) => v).map(([k]) => k).join(',') } : null, tread: _L.tries ? !!_L.tries.tread : null, money: g.money ? g.money.cash : null, hp: Math.round(P.hp) + '/' + P.maxHp, skills: g.skills ? g.skills.level('run') + '/' + g.skills.level('fight') : null };"

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
steps.append(goKind('/^laundry$/'))
steps.append(t21[16] | {'shot': 'r1_laundry'})
steps.append(watch("v.L && v.L.svc === 'wash' && v.L.S && v.L.S.st === 'load'", 80, 1.3, 0.7, 1.5, 0.6, 'r2_load'))
steps.append(W("const V = A().life2.service; let n = 0; while (n++ < 60 && !V.machines.some(q => q.drum)) await F(30); const q = V.machines.find(q => q.drum) || V.machines[0]; const R = s.room; if (q) window.__camOverride = { pos: [q.m.x + Math.sin(q.m.yaw) * 1.1, R.floor + 0.9, q.m.z + Math.cos(q.m.yaw) * 1.1], look: [q.m.x, q.m.y, q.m.z] }; await F(5); const out = (() => { " + INFO + " })(); return { n, ...out };", shot='r3_drum'))
steps.append(watch("v.L && v.L.svc === 'wash' && v.L.S && v.L.S.st === 'fold'", 120, 1.3, 0.5, 1.6, 0.9, 'r4_fold'))
steps.append(hud(True))
steps.append(buy('soap', None))
steps.append(hud(False))
steps.append(goKind('/^gym$/'))
steps.append(t21[16] | {'shot': 's1_gym'})
steps.append(watch("v.L && v.L.svc === 'punch' && v.L.S && v.L.S.st === 'hit'", 90, 1.6, 1.0, 1.5, 1.2, 's2_punch'))
steps.append(watch("v.L && v.L.svc === 'lift' && v.L.S && v.L.S.st === 'press'", 90, 1.8, 0.8, 1.5, 1.3, 's3_lift'))
steps.append(watch("v.L && v.L.svc === 'curl'", 90, 1.4, 0.6, 1.5, 1.2, 's4_curl'))
steps.append(hud(True))
steps.append(buy('water', None))
steps.append(W("const k = A().keeper; const ps = s.room.pay; P.spawn(ps.x, ps.z, ps.yaw); await F(3); g.streetlife.interact(); let n = 0; while (n++ < 30 && !g.dialog.open) await F(5); const labels = g.dialog.open && g.dialog.choices ? g.dialog.choices.map(c => c.label) : null; if (g.dialog.open) g.dialog.pick(2); await F(30, 4); const out = (() => { " + INFO + " })(); return { labels, ...out };", shot='s5_trainer'))
json.dump(steps, open(f'{S}/t27.json', 'w'))
print(len(steps), 'steps')
