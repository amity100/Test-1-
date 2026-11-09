import json

# t25: stage 7 (ROADMAP 16.7) - the perfumery, the optician, the barber: their rooms, their people at
# work (a scent sprayed on a strip, frames tried on at a mirror, the eyes tested, a cut with the cape,
# the mirror, the hair swept up), and what the hero buys there (a scent, glasses, sunglasses, pomade)
S = '/tmp/claude-0/-home-user-Test-1-/1f04fdad-ca96-5cb8-bcb1-fccf2f5dd162/scratchpad/shop2'
t21 = json.load(open(f'{S}/t21.json'))

HEAD = "const g = window.__game, s = window.__shop, P = g.player; const F = async (n, k = 1) => { for (let i = 0; i < k; i++) { window.__frame(n); await new Promise(r => setTimeout(r, 20)); } }; const A = () => g.streetlife.active.get(window.__shop.id); "
INFO = "const _a = A(); const _L = _a && _a.life2; if (!_L) return 'no life2'; const _B = _L.beauty; return { vis: _a.visitors.map(v => (v.L ? v.L.st + (v.L.svc ? '/' + v.L.svc + (v.L.S ? ':' + v.L.S.st : '') : '') : v.mode + ':' + v.phase)).join(' '), staff: _L.S ? _L.S.st : null, keeper: _a.npcJob ? 'cut:' + _a.npcJob.phase : null, beauty: _B ? { mists: _B.mists.length, clips: _B.clips.length, exam: _B.exam ? { ready: !!_B.exam.ready, over: !!_B.exam.over } : null } : null, items: _L.you.items.map(r => r.what + ':' + r.price).join(','), money: g.money ? g.money.cash : null, perks: { charm: Math.round(P.charmT || 0), glasses: P.fig.look.face ? P.fig.look.face.glasses : null, hair: P.fig.look.hair ? P.fig.look.hair.style : null, spread: g.skills ? +g.skills.spreadMul.toFixed(3) : null } };"


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
    return W("window.__camOverride = null; g.events.t = 1e9; const st = g.world.mainland.stream; const re = %s; let r = window.__goShop(re, 1.8, 0.3); let n = 0; if (r === 'none') { st.scale = 1; while (n++ < 80 && !g.world.shops.some(q => re.test(q.kind) && q.room && q.door)) await F(30); st.scale = 0.45; r = window.__goShop(re, 1.8, 0.3); } await F(30, 2); await F(60, 4); return r + ' (' + n + ') ' + (window.__shop ? window.__shop.id : '');" % re_)


# a camera on whoever is in a state, near them, looking at their hands/head
def watch(cond, n, dist, side, h, lh, shot):
    return W("let n = 0; const find = () => A().visitors.find(v => %s); while (n++ < %d && !find()) await F(10); const v = find(); const R = s.room; "
             "if (v) { const c = v.c; const y = c.yaw; window.__camOverride = { pos: [c.pos.x + Math.sin(y) * %s + Math.cos(y) * %s, R.floor + %s, c.pos.z + Math.cos(y) * %s - Math.sin(y) * %s], look: [c.pos.x, R.floor + %s, c.pos.z] }; } await F(3); const out = (() => { " % (cond, n, dist, side, h, dist, side, lh) + INFO + " })(); return { n, found: !!v, ...out };", shot=shot)


# the hero takes one of what, pays at the till
def buy(what, shot=None):
    return W("g.events.t = 1e9; window.__camOverride = null; const L = A().life2; const z = L.zones.find(z => z.slots.some(q => q.what === '%s' && q.state === 'shelf')); if (!z) return 'no %s zone'; const sl = z.slots.find(q => q.what === '%s' && q.state === 'shelf'); const dx = z.x - sl.x, dz = z.z - sl.z; const l = Math.hypot(dx, dz) || 1; P.spawn(sl.x + dx / l * 0.8, sl.z + dz / l * 0.8, Math.atan2(-dx, -dz)); await F(3); L.inspect(sl); await F(1); const lab = g.dialog.open && g.dialog.choices ? g.dialog.choices.map(c => c.label).join(' | ') : null; if (g.dialog.open) g.dialog.pick(0); await F(2); const ps = s.room.pay; P.spawn(ps.x, ps.z, ps.yaw); await F(2); const t = g.streetlife.target(); if (t && t.pay) L.you.checkout(); let n = 0; while (n++ < 80 && !g.dialog.open) await F(10); if (g.dialog.open) g.dialog.pick(0); await F(30, 4); const out = (() => { " % (what, what, what) + INFO + " })(); return { lab, ...out };", shot=shot)


steps = [hud(False), t21[1]]
steps.append({'js': "(() => { const g = window.__game; g.world.shops.forEach(s => s.muralChance = 0); if (g.world.mainland && g.world.mainland.stream) g.world.mainland.stream.scale = 0.45; if (g.events) g.events.t = 1e9; return 'capped, events off'; })()"})

# ---- the perfumery
steps.append(goKind('/^perfume$/'))
steps.append(t21[16] | {'shot': 'f1_perfume'})
steps.append(W(frontCam('island', 1.5, 0.7, 1.7, 'R.floor + 0.95') + INFO, shot='f2_island'))
steps.append(watch("v.L && v.L.svc === 'spray' && v.L.S && v.L.S.t > 0.75 && v.L.S.t < 1.5", 260, 1.0, 0.6, 1.45, 1.2, 'f3_spray'))
steps.append(watch("v.L && v.L.svc === 'spray' && v.L.S && v.L.S.t > 3.1 && v.L.S.t < 4.5", 200, 1.0, -0.5, 1.6, 1.45, 'f4_sniff'))
steps.append(hud(True))
steps.append(buy('perfume', 'f5_bought'))
# with the scent on: the next price a tenth off
steps.append(W("const L = A().life2; const z = L.zones.find(z => z.slots.some(q => q.what === 'perfume' && q.state === 'shelf')); const sl = z.slots.find(q => q.what === 'perfume' && q.state === 'shelf'); L.inspect(sl); await F(1); const lab = g.dialog.open && g.dialog.choices ? g.dialog.choices.map(c => c.label).join(' | ') : null; if (g.dialog.open) g.dialog.close ? g.dialog.close() : g.dialog.pick(g.dialog.choices.length - 1); await F(2); return { lab, charm: Math.round(P.charmT || 0) };"))
steps.append(hud(False))

# ---- the optician
steps.append(goKind('/^optics$/'))
steps.append(t21[16] | {'shot': 'g1_optics'})
steps.append(W("const L = A().life2; const z = L.zones.find(z => z.slots.some(q => (q.what === 'glasses' || q.what === 'sunglasses'))); if (!z) return 'no frames'; const sl = z.slots[0]; const dx = z.x - sl.x, dz = z.z - sl.z; const l = Math.hypot(dx, dz) || 1; window.__camOverride = { pos: [sl.x + dx / l * 0.9 + dz / l * 0.3, sl.y + 0.15, sl.z + dz / l * 0.9 - dx / l * 0.3], look: [sl.x, sl.y, sl.z] }; await F(10); " + INFO, shot='g2_frames'))
steps.append(watch("v.L && v.L.svc === 'tryon' && v.L.S && v.L.S.st === 'look'", 260, 1.1, 0.6, 1.65, 1.55, 'g3_tryon'))
steps.append(W("const B = A().life2.beauty; let n = 0; while (n++ < 260 && !(B.exam && B.exam.ready)) await F(10); " + frontCam('exam', 1.6, -1.0, 1.7, 'R.floor + 1.1') + "const out = (() => { " + INFO + " })(); return { n, ...out };", shot='g4_exam'))
steps.append(hud(True))
steps.append(buy('glasses', 'g5_glasses'))
steps.append(buy('sunglasses', None))
steps.append(hud(False))

# ---- the barber
steps.append(goKind('/^barber$/'))
steps.append(t21[16] | {'shot': 'h1_barber'})
steps.append(W(frontCam('station.0', 2.2, 0.8, 1.6, 'R.floor + 1.0') + INFO, shot='h2_station'))
steps.append(W("const a = A(); let n = 0; while (n++ < 300 && !(a.npcJob && (a.npcJob.phase === 'erase' || a.npcJob.phase === 'draw'))) await F(10); const R = s.room; const j = a.npcJob; if (j) { const c = j.who; const y = c.yaw; window.__camOverride = { pos: [c.pos.x + Math.sin(y) * 1.6 + Math.cos(y) * 0.9, R.floor + 1.7, c.pos.z + Math.cos(y) * 1.6 - Math.sin(y) * 0.9], look: [c.pos.x, R.floor + 1.1, c.pos.z] }; } await F(3); const out = (() => { " + INFO + " })(); return { n, ...out };", shot='h3_cut'))
steps.append(W("const a = A(); let n = 0; while (n++ < 200 && !(a.npcJob && a.npcJob.phase === 'admire' && a.npcJob.t > 0.5)) await F(5); await F(2); const out = (() => { " + INFO + " })(); return { n, ...out };", shot='h4_mirror'))
steps.append(W("const B = A().life2.beauty; let n = 0; while (n++ < 120 && !B.clips.length) await F(10); const R = s.room; const q = B.clips[0]; if (q) window.__camOverride = { pos: [q.it.pos.x + 1.2, R.floor + 1.5, q.it.pos.z + 1.2], look: [q.it.pos.x, R.floor, q.it.pos.z] }; await F(3); const out = (() => { " + INFO + " })(); return { n, ...out };", shot='h5_clips'))
steps.append(W("const L = A().life2; let n = 0; while (n++ < 300 && !(L.S && L.S.st === 'bSweep')) await F(10); const R = s.room; const c = L.S && L.S.c; if (c) { const y = c.yaw; window.__camOverride = { pos: [c.pos.x + Math.sin(y) * 1.8 + Math.cos(y) * 1.0, R.floor + 1.6, c.pos.z + Math.cos(y) * 1.8 - Math.sin(y) * 1.0], look: [c.pos.x, R.floor + 0.6, c.pos.z] }; } await F(5); const out = (() => { " + INFO + " })(); return { n, ...out };", shot='h6_sweep'))
steps.append(hud(True))
steps.append(buy('pomade', 'h7_pomade'))
steps.append(W("window.__camOverride = null; const tv = A().life2.tech; return { tv: !!tv, screen: !!(tv && tv.screen), lookKey: g.lose ? JSON.stringify(g.lose.known || null).slice(0, 80) : null };"))

json.dump(steps, open(f'{S}/t25.json', 'w'))
print(len(steps), 'steps')
