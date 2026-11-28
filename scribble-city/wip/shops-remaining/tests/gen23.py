import json

# t23: the shoe shop's seller with several boxes a trip, the hero's pair paid for (no random
# robbery: the city's events off), then the sports shop (found with the stream let out a while)
S = '/tmp/claude-0/-home-user-Test-1-/1f04fdad-ca96-5cb8-bcb1-fccf2f5dd162/scratchpad/shop2'
t21 = json.load(open(f'{S}/t21.json'))

HEAD = "const g = window.__game, s = window.__shop, P = g.player; const F = async (n, k = 1) => { for (let i = 0; i < k; i++) { window.__frame(n); await new Promise(r => setTimeout(r, 20)); } }; const A = () => g.streetlife.active.get(window.__shop.id); "
INFO = "const _a = A(); const _L = _a && _a.life2; if (!_L) return 'no life2'; const _T = _L.tries; const _J = _L.S && _L.S.job; return { vis: _a.visitors.map(v => (v.L ? v.L.st + (v.L.svc ? '/' + v.L.svc + (v.L.S ? ':' + v.L.S.st : '') : '') : v.phase)).join(' '), staff: _L.S ? _L.S.st : null, job: _J && _J.reqs ? _J.reqs.length + ' reqs, k ' + _J.k + ', boxes ' + (_J.boxes || []).length : null, tries: _T ? { q: _T.queue.map(q => (q.v ? 'npc' : 'you') + ':' + q.st).join(','), left: _T.left.length, seats: _T.seats.filter(x => x.v).length, tread: !!_T.tread, belt: +_T.belt.toFixed(2), mine: !!_T.mine } : null, items: _L.you.items.map(r => r.what).join(','), money: g.money ? g.money.cash : null, runShoes: !!P.runShoes, wanted: g.police ? g.police.level : null, events: g.events ? Math.round(g.events.t) : null };"


def W(body, shot=None, frames=None):
    s = {'js': '(async () => { ' + HEAD + body + ' })()'}
    if shot:
        s['shot'] = shot
    if frames:
        s['frames'] = frames
    return s


def hud(v):
    return {'js': '(() => { const h = document.getElementById("hud"); if (h) h.style.visibility = "%s"; return %d; })()' % ('visible' if v else 'hidden', 1 if v else 0), 'frames': 1}


# camera on a mark: back from where one stands there (b: metres behind them, sd: to the side), at
# eye height h, looking ahead of them (ahead) at height lh
def markCam(name, b, sd, h, ahead, lh):
    return ("const R = s.room; const m = R.marks['%s']; if (!m) return 'no mark %s'; const y = m.yaw; "
            "window.__camOverride = { pos: [m.x - Math.sin(y) * %s + Math.cos(y) * %s, R.floor + %s, m.z - Math.cos(y) * %s - Math.sin(y) * %s], "
            "look: [m.x + Math.sin(y) * %s, R.floor + %s, m.z + Math.cos(y) * %s] }; await F(10, 1); "
            % (name, name, b, sd, h, b, sd, ahead, lh, ahead))


steps = [hud(False), t21[1]]
steps.append({'js': "(() => { const g = window.__game; g.world.shops.forEach(s => s.muralChance = 0); if (g.world.mainland && g.world.mainland.stream) g.world.mainland.stream.scale = 0.45; if (g.events) g.events.t = 1e9; return 'capped, events off'; })()"})

# ---- the shoe shop
steps.append(W("window.__camOverride = null; const r = window.__goShop(/^shoes$/, 1.8, 0.3); await F(30, 2); return r;"))
steps.append(W("g.events.t = 1e9; await F(60, 4); " + INFO))
# the seller out of the stock room with two or three boxes
steps.append(W("g.events.t = 1e9; const L = A().life2; const R = s.room; let n = 0; "
               "while (n++ < 160 && !(L.S && L.S.st === 'tryBring' && L.S.job && L.S.job.reqs && L.S.job.reqs.length >= 2)) await F(10); "
               "const c = L.S && L.S.c; if (c) { const y = c.yaw; window.__camOverride = { pos: [c.pos.x + Math.sin(y) * 2.2 + Math.cos(y) * 0.9, R.floor + 1.55, c.pos.z + Math.cos(y) * 2.2 - Math.sin(y) * 0.9], look: [c.pos.x, R.floor + 1.0, c.pos.z] }; } "
               "await F(2); const out = " + "(() => { " + INFO + " })(); return { n, ...out };", shot='c1_boxes'))
steps.append(W("g.events.t = 1e9; const L = A().life2; let n = 0; while (n++ < 120 && L.S && L.S.st && L.S.st.startsWith('try')) await F(10); window.__camOverride = null; " + INFO))
steps.append(W(markCam('try.0', 2.6, 0.8, 1.8, 0, 0.7) + INFO, shot='c2_bench'))
# you: your size from the stock room, brought to you, paid for at the till
steps.append(hud(True))
steps.append(t21[10] | {'shot': 'c3_ask'})
steps.append(t21[11] | {'shot': 'c4_box'})
steps.append(W("g.events.t = 1e9; const L = A().life2; const ps = s.room.pay; P.spawn(ps.x, ps.z, ps.yaw); await F(2); const t = g.streetlife.target(); const tl = t ? t.label : null; if (t && t.pay) L.you.checkout(); let n = 0; while (n++ < 80 && !g.dialog.open) await F(10); const dl = g.dialog.open; if (g.dialog.open) g.dialog.pick(0); await F(30, 4); const out = (() => { " + INFO + " })(); return { tl, n, dl, ...out, sprint: P.runShoes ? 1.1 : 1 };", shot='c5_paid'))
steps.append(hud(False))

# ---- the sports shop: the stream let out till one is built, then held in again
steps.append(W("window.__camOverride = null; const st = g.world.mainland.stream; let r = window.__goShop(/^sports$/, 1.8, 0.3); let n = 0; if (r === 'none') { st.scale = 1; while (n++ < 80 && !g.world.shops.some(q => q.kind === 'sports' && q.room && q.door)) await F(30); st.scale = 0.45; r = window.__goShop(/^sports$/, 1.8, 0.3); } await F(30, 2); return r + ' (' + n + ')';"))
steps.append(W("g.events.t = 1e9; await F(60, 3); return window.__shop.kind + ':' + window.__shop.name + ' ' + window.__shop.id;"))
steps.append(t21[16] | {'shot': 'd1_sports'})
steps.append(W(markCam('bikes', 2.4, 0.3, 1.65, 1.0, 1.55) + INFO, shot='d2_bikes'))
steps.append(W(markCam('bin.0', 1.9, 0.7, 1.7, 0.6, 0.55) + INFO, shot='d3_balls'))
steps.append(W("g.events.t = 1e9; await F(60, 5); " + INFO))
# someone on the treadmill: from the side
steps.append(W("const T = A().life2.tries; let n = 0; while (n++ < 60 && !T.tread) await F(20); const R = s.room; const m = R.marks['tread.on']; const y = m.yaw; "
               "window.__camOverride = { pos: [m.x + Math.cos(y) * 2.3 - Math.sin(y) * 0.5, R.floor + 1.6, m.z - Math.sin(y) * 2.3 - Math.cos(y) * 0.5], look: [m.x + Math.sin(y) * 0.3, R.floor + 1.0, m.z + Math.cos(y) * 0.3] }; await F(6, 1); " + INFO, shot='d4_tread_on'))
# someone bouncing a ball
steps.append(W("const L = A().life2; let n = 0; const find = () => A().visitors.find(v => v.L && v.L.S && v.L.S.st === 'bounce'); while (n++ < 90 && !find()) await F(10); const v = find(); const R = s.room; "
               "if (v) { const c = v.c; const y = c.yaw; window.__camOverride = { pos: [c.pos.x + Math.sin(y) * 2.3 + Math.cos(y) * 0.8, R.floor + 1.5, c.pos.z + Math.cos(y) * 2.3 - Math.sin(y) * 0.8], look: [c.pos.x, R.floor + 0.7, c.pos.z] }; } await F(3); const out = (() => { " + INFO + " })(); return { n, found: !!v, ...out };", shot='d5_bounce'))
steps.append(hud(True))
# a new top while the police look for you: a star off
steps.append(t21[23] | {'shot': 'd6_star'})
# running shoes from the sports shop's lit wall
steps.append(W("g.events.t = 1e9; window.__camOverride = null; const L = A().life2; const z = L.zones.find(z => z.slots.some(q => q.what === 'shoe' && q.state === 'shelf')); if (!z) return 'no shoe zone'; const sl = z.slots.find(q => q.what === 'shoe' && q.state === 'shelf'); const dx = z.x - sl.x, dz = z.z - sl.z; const l = Math.hypot(dx, dz) || 1; P.spawn(sl.x + dx / l * 0.8, sl.z + dz / l * 0.8, Math.atan2(-dx, -dz)); await F(3); L.inspect(sl); await F(1); const lab = g.dialog.open && g.dialog.choices ? g.dialog.choices.map(c => c.label).join(' | ') : null; if (g.dialog.open) g.dialog.pick(0); await F(2); const ps = s.room.pay; P.spawn(ps.x, ps.z, ps.yaw); await F(2); const t = g.streetlife.target(); if (t && t.pay) L.you.checkout(); let n = 0; while (n++ < 80 && !g.dialog.open) await F(10); if (g.dialog.open) g.dialog.pick(0); await F(30, 4); const out = (() => { " + INFO + " })(); return { lab, ...out, sprint: P.runShoes ? 1.1 : 1 };", shot='d7_run'))

json.dump(steps, open(f'{S}/t23.json', 'w'))
print(len(steps), 'steps')
