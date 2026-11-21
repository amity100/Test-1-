import json

# t24: the electronics shop (ROADMAP 16.6) - the news on the televisions, the phones on their pucks
# and their cords, the seller's selfie on the screens, headphones nodding, the scanners' case; the
# seller's offers (scanner, MAP PRO, the call), the phone, the laptop, the headphones bought
S = '/tmp/claude-0/-home-user-Test-1-/1f04fdad-ca96-5cb8-bcb1-fccf2f5dd162/scratchpad/shop2'
t21 = json.load(open(f'{S}/t21.json'))

HEAD = "const g = window.__game, s = window.__shop, P = g.player; const F = async (n, k = 1) => { for (let i = 0; i < k; i++) { window.__frame(n); await new Promise(r => setTimeout(r, 20)); } }; const A = () => g.streetlife.active.get(window.__shop.id); "
INFO = "const _a = A(); const _L = _a && _a.life2; if (!_L) return 'no life2'; const _X = _L.tech; return { vis: _a.visitors.map(v => (v.L ? v.L.st : v.phase)).join(' '), staff: _L.S ? _L.S.st + (_L.S.selfie !== undefined ? ':selfie ' + (_L.S.selfie === null ? 'no' : _L.S.selfie.toFixed(1)) : '') : null, tech: _X ? { tvs: _X.tvs.length, screen: !!_X.screen, story: _X.stories[_X.story] ? _X.stories[_X.story].head : null, photo: _X.photo ? +(g.time - _X.photo.t).toFixed(1) : null, held: _L.movers.items.filter(it => it.slot && it.slot.what === 'phone' && it.at && it.at.c).length } : null, items: _L.you.items.map(r => r.what).join(','), money: g.money ? g.money.cash : null, perks: { zoom: !!P.zoomCam, radio: !!P.copRadio, map: !!P.mapPages, music: !!P.music, scan: Math.round(P.scannerT || 0) }, wanted: g.police ? g.police.level : null };"


def W(body, shot=None):
    s = {'js': '(async () => { ' + HEAD + body + ' })()'}
    if shot:
        s['shot'] = shot
    return s


def hud(v):
    return {'js': '(() => { const h = document.getElementById("hud"); if (h) h.style.visibility = "%s"; return %d; })()' % ('visible' if v else 'hidden', 1 if v else 0), 'frames': 1}


# a camera before a mark (in front of where it faces: out into the room), looking at it
def frontCam(name, dist, side, h, lh):
    return ("const R = s.room; const m = R.marks['%s']; if (!m) return 'no mark %s'; const y = m.yaw; "
            "window.__camOverride = { pos: [m.x + Math.sin(y) * %s + Math.cos(y) * %s, R.floor + %s, m.z + Math.cos(y) * %s - Math.sin(y) * %s], look: [m.x, %s, m.z] }; await F(10, 1); "
            % (name, name, dist, side, h, dist, side, lh))


steps = [hud(False), t21[1]]
steps.append({'js': "(() => { const g = window.__game; g.world.shops.forEach(s => s.muralChance = 0); if (g.world.mainland && g.world.mainland.stream) g.world.mainland.stream.scale = 0.45; if (g.events) g.events.t = 1e9; return 'capped, events off'; })()"})
# the nearest electronics shop (the stream let out a while if none is built yet)
steps.append(W("window.__camOverride = null; const st = g.world.mainland.stream; const re = /^(electronics|phones)$/; let r = window.__goShop(re, 1.8, 0.3); let n = 0; if (r === 'none') { st.scale = 1; while (n++ < 80 && !g.world.shops.some(q => re.test(q.kind) && q.room && q.door)) await F(30); st.scale = 0.45; r = window.__goShop(re, 1.8, 0.3); } await F(30, 2); return r + ' (' + n + ') ' + (window.__shop ? window.__shop.id : '');"))
steps.append(W("g.events.t = 1e9; await F(60, 4); " + INFO))
steps.append(t21[16] | {'shot': 'e1_overview'})
# the wall of televisions: the news
steps.append(W(frontCam('tv.0', 2.4, 0.6, 1.35, 'm.y + 0.25') + INFO, shot='e2_tv'))
# a demo table close: the phones on their pucks, the cords
steps.append(W("const L = A().life2; const z = L.zones.find(z => z.slots.some(q => q.what === 'phone' && q.state === 'shelf')); if (!z) return 'no phone zone'; const sl = z.slots.find(q => q.what === 'phone' && q.state === 'shelf'); const dx = z.x - sl.x, dz = z.z - sl.z; const l = Math.hypot(dx, dz) || 1; const R = s.room; "
               "window.__camOverride = { pos: [sl.x + dx / l * 0.55 + dz / l * 0.25, sl.y + 0.28, sl.z + dz / l * 0.55 - dx / l * 0.25], look: [sl.x - dz / l * 0.05, sl.y - 0.02, sl.z + dx / l * 0.05] }; await F(10, 1); " + INFO, shot='e3_phones'))
# someone trying a phone: the cord from the puck to the hand
steps.append(W("const L = A().life2; let n = 0; const held = () => L.movers.items.find(it => it.slot && it.slot.what === 'phone' && it.at && it.at.c); while (n++ < 120 && !held()) await F(10); const it = held(); const R = s.room; "
               "if (it) { const c = it.at.c; const y = c.yaw; window.__camOverride = { pos: [c.pos.x + Math.sin(y) * 1.3 + Math.cos(y) * 0.9, R.floor + 1.55, c.pos.z + Math.cos(y) * 1.3 - Math.sin(y) * 0.9], look: [it.pos.x, it.pos.y - 0.1, it.pos.z] }; } await F(3); const out = (() => { " + INFO + " })(); return { n, ...out };", shot='e4_cord'))
# the seller's selfie with someone, and the picture up on the screens
steps.append(W("const L = A().life2; const X = L.tech; let n = 0; while (n++ < 260 && !(X.photo && g.time - X.photo.t < 4)) await F(10); const R = s.room; const m = R.marks['tv.0']; const y = m.yaw; "
               "window.__camOverride = { pos: [m.x + Math.sin(y) * 2.6 + Math.cos(y) * 1.2, R.floor + 1.4, m.z + Math.cos(y) * 2.6 - Math.sin(y) * 1.2], look: [m.x, m.y + 0.3, m.z] }; await F(8); const out = (() => { " + INFO + " })(); return { n, ...out };", shot='e5_selfie'))
# someone listening: the head nodding
steps.append(W("let n = 0; const find = () => A().visitors.find(v => v.L && v.L.st === 'listen'); while (n++ < 160 && !find()) await F(10); const v = find(); const R = s.room; "
               "if (v) { const c = v.c; const y = c.yaw; window.__camOverride = { pos: [c.pos.x + Math.sin(y) * 1.4 + Math.cos(y) * 0.5, R.floor + 1.65, c.pos.z + Math.cos(y) * 1.4 - Math.sin(y) * 0.5], look: [c.pos.x, R.floor + 1.5, c.pos.z] }; } await F(3); const out = (() => { " + INFO + " })(); return { n, found: !!v, ...out };", shot='e6_listen'))
# the scanners' case by the till
steps.append(W(frontCam('case', 0.9, 0.25, 1.45, 'm.y') + INFO, shot='e7_case'))
steps.append(hud(True))
# the seller: the scanner, MAP PRO; then the call (wanted)
steps.append(W("window.__camOverride = null; const L = A().life2; const k = A().keeper; if (!k) return 'no keeper'; const ps = s.room.pay; P.spawn(ps.x, ps.z, ps.yaw); await F(3); const t = g.streetlife.target(); const tl = t ? t.label : null; if (t && !t.pay) g.streetlife.interact(); let n = 0; while (n++ < 40 && !g.dialog.open) await F(5); const labels = g.dialog.open && g.dialog.choices ? g.dialog.choices.map(c => c.label) : null; const m0 = g.money.cash; if (g.dialog.open) g.dialog.pick(0); await F(30, 6); const m1 = g.money.cash; const out = (() => { " + INFO + " })(); return { tl, labels, m0, m1, ...out };", shot='e8_scanner'))
steps.append(W("const A2 = A(); A2.cool = 0; const ps = s.room.pay; P.spawn(ps.x, ps.z, ps.yaw); await F(3); g.streetlife.interact(); let n = 0; while (n++ < 40 && !g.dialog.open) await F(5); const labels = g.dialog.open && g.dialog.choices ? g.dialog.choices.map(c => c.label) : null; const m0 = g.money.cash; if (g.dialog.open) g.dialog.pick(1); await F(30, 6); const m1 = g.money.cash; const out = (() => { " + INFO + " })(); return { labels, m0, m1, ...out };"))
steps.append(W("const A2 = A(); A2.cool = 0; g.police.level = 2; g.police.heat = 40; g.hud.setWanted(2, false); const ps = s.room.pay; P.spawn(ps.x, ps.z, ps.yaw); await F(3); g.streetlife.interact(); let n = 0; while (n++ < 40 && !g.dialog.open) await F(5); const labels = g.dialog.open && g.dialog.choices ? g.dialog.choices.map(c => c.label) : null; const m0 = g.money.cash; if (g.dialog.open) g.dialog.pick(2); await F(30, 6); const m1 = g.money.cash; const out = (() => { " + INFO + " })(); return { labels, m0, m1, ...out };", shot='e9_call'))
# wanted again: the news says so
steps.append(hud(False))
steps.append(W("g.police.level = 2; g.police.heat = 40; g.police.seenT = g.time; g.hud.setWanted(2, false); const X = A().life2.tech; X.storyT = 0; await F(20, 2); " + frontCam('tv.1', 2.2, -0.5, 1.6, 'm.y') + INFO, shot='e10_news_wanted'))
steps.append(W("g.police.level = 0; g.police.heat = 0; if (g.police.clear) g.police.clear(); return 'cleared';"))
steps.append(hud(True))
# a phone, a laptop, headphones bought: each from its place, paid at the till
for what, shot in [('phone', 'e11_phone'), ('laptop', None), ('headphones', 'e12_bought')]:
    steps.append(W("g.events.t = 1e9; window.__camOverride = null; const L = A().life2; const z = L.zones.find(z => z.slots.some(q => q.what === '%s' && q.state === 'shelf')); if (!z) return 'no %s zone'; const sl = z.slots.find(q => q.what === '%s' && q.state === 'shelf'); const dx = z.x - sl.x, dz = z.z - sl.z; const l = Math.hypot(dx, dz) || 1; P.spawn(sl.x + dx / l * 0.8, sl.z + dz / l * 0.8, Math.atan2(-dx, -dz)); await F(3); L.inspect(sl); await F(1); const lab = g.dialog.open && g.dialog.choices ? g.dialog.choices.map(c => c.label).join(' | ') : null; if (g.dialog.open) g.dialog.pick(0); await F(2); const ps = s.room.pay; P.spawn(ps.x, ps.z, ps.yaw); await F(2); const t = g.streetlife.target(); if (t && t.pay) L.you.checkout(); let n = 0; while (n++ < 80 && !g.dialog.open) await F(10); if (g.dialog.open) g.dialog.pick(0); await F(30, 4); const out = (() => { " % (what, what, what) + INFO + " })(); return { lab, ...out };", shot=shot))
# the city map: MAP PRO's pages, the scanner's police
steps.append(W("window.__camOverride = null; g.citymap.show(); await F(20, 2); const out = (() => { " + INFO + " })(); return out;", shot='e13_citymap'))
steps.append(W("g.citymap.hide(); await F(5); return { photoRange: P.zoomCam ? 153 : 85, stamina: g.skills ? Math.round(g.skills.stamina) : null };"))

json.dump(steps, open(f'{S}/t24.json', 'w'))
print(len(steps), 'steps')
