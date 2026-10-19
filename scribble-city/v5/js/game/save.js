import { WEAPON_DEFS } from './weapons.js';
import { dress } from './wardrobe.js';
import { buildWeaponModel } from './items.js';
import { readFree, buildWeapon } from './freeform.js';
import { readHandParts, handSpec } from './handparts.js';
import { spawnDrawn } from './drawncar.js';
import { BLUEPRINTS, BLUEPRINT_MORE } from './blueprints.js';
import { openWall } from '../world/rooms.js';
import { districtName } from '../world/layout.js';
import * as store from '../core/store.js';

// The full save (ROADMAP 2.5): where you are, what you hold (every drawn weapon, its grade and
// what is left in it), the vehicles you drew or took and where you left them, your look, and the
// city as you left it: every prop you rubbed out, every spot rubbed back to paper, the walls you
// rubbed through. With the hour, the sky, your destination and how long you have played.
//
// Kept in the browser's IndexedDB (in localStorage if there is none): an autosave every couple of
// minutes and when the page is left, and three slots of your own. Every save carries the number
// of its shape (VERSION); an older one is brought up to date by migrate() before it is loaded.
//
// Loading in the middle of a game starts the page again and loads into a fresh city (nothing
// rubbed out yet, so the save's city is exactly the save's).

const VERSION = 1;
const PENDING = 'scribble-city-v5-load';
export const SLOTS = ['auto', 'slot1', 'slot2', 'slot3'];
export const SLOT_NAMES = { auto: 'שמירה אוטומטית', slot1: 'משבצת 1', slot2: 'משבצת 2', slot3: 'משבצת 3' };
const AUTO_EVERY = 120;

const put = (key, value) => store.put('saves', key, value);
const get = (key) => store.get('saves', key);

// an older save's shape brought up to this one (nothing to do yet: this is the first)
function migrate(s) {
  if (!s || typeof s !== 'object' || typeof s.v !== 'number' || s.v > VERSION) return null;
  return s;
}

function ago(at) {
  const m = Math.max(0, Math.round((Date.now() - at) / 60000));
  if (m < 1) return 'עכשיו';
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'לפני שעה' : `לפני ${h} שעות`;
  const d = Math.round(h / 24);
  return d === 1 ? 'אתמול' : `לפני ${d} ימים`;
}

export class SaveGame {
  constructor(game) {
    this.game = game;
    this.autoT = AUTO_EVERY;
    this.playTime = 0;
    this.busy = false;
    // leaving the page: what was done since the last save is kept
    const leave = () => {
      if (this.canSave()) this.save('auto', true);
    };
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') leave();
    });
  }

  // a moment that can be saved: playing, on your feet or in a seat, nobody after you
  canSave() {
    const g = this.game;
    if (g.state !== 'play' && g.state !== 'paused') return false;
    if (g.params.has('test') && !window.__saveTest) return false;
    const p = g.player;
    if (p.mode === 'dead' || p.mode === 'draw' || g.airdraw.open || g.chute.open) return false;
    return !(g.police && g.police.level > 0);
  }

  update(dt) {
    this.playTime += dt;
    this.autoT -= dt;
    if (this.autoT <= 0) {
      this.autoT = this.canSave() ? AUTO_EVERY : 15;
      if (this.autoT === AUTO_EVERY) this.save('auto', true);
    }
  }

  // ------------------------------------------------------------------ what is kept
  snapshot() {
    const g = this.game;
    const p = g.player;
    const v = p.inVehicle;
    const at = v ? v.pos : p.pos;
    const objs = g.world.objects;
    const gone = [];
    for (let i = 1; i < objs.list.length; i++) if (objs.list[i].state !== 'here') gone.push(i);
    const L = p.fig.look;
    return {
      v: VERSION,
      at: Date.now(),
      where: districtName(at.x, at.z) || '',
      clock: g.daynight ? g.daynight.clock : '',
      playTime: Math.round(this.playTime),
      player: { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, hp: p.hp, maxHp: p.maxHp, parachute: p.parachute ? { grade: p.parachute.grade, colours: p.parachute.colours || null } : null, armor: p.armor || 0 },
      hero: { hair: L.hair.style !== 'none' ? { style: L.hair.style, color: L.hair.color } : null, bald: L.hair.style === 'none', hat: L.hat || null, glasses: L.face.glasses, bulk: p.fig.bulk, maxHp: p.maxHp },
      // (one drawn freehand: its drawing, to make it again - ROADMAP 11.6)
      weapons: g.weapons.slots.slice(g.weapons.keep).map((s) => ({ id: s.def.id, grade: s.grade, ammo: Number.isFinite(s.ammo) ? s.ammo : -1, uses: s.uses === undefined ? null : s.uses, score: s.score === undefined ? null : s.score, free: s.free || null })),
      // (a shield drawn with a weapon, in the other hand: ROADMAP 11.8)
      offhand: g.weapons.off && g.weapons.off.free ? { free: g.weapons.off.free, uses: g.weapons.off.uses } : null,
      weapon: g.weapons.index,
      weaponId: g.weapons.current.def.id,
      // (what the hero got better at: ROADMAP 5.6)
      skills: g.skills ? g.skills.save() : null,
      // (the wallet and the bank: ROADMAP 8.1)
      money: g.money ? g.money.save() : null,
      // (the graffiti on the walls: ROADMAP 9.3)
      graffiti: g.graffiti ? g.graffiti.save() : null,
      ink: g.ink ? g.ink.save() : null,
      // (the ladders, ramps and bridges you drew; the umbrella, the key: ROADMAP 9.2)
      gadgets: g.gadgets ? g.gadgets.save() : null,
      // (the railing's broken stretches: ROADMAP 8.4)
      knock: g.knock ? g.knock.save() : null,
      // (the places that are yours: ROADMAP 8.2)
      props: g.props ? g.props.save() : null,
      // (what is on the free drawing's page: ROADMAP 11.6)
      free: g.freedraw ? g.freedraw.save() : null,
      vehicles: g.vehicles.list.filter((o) => !o.dead).map((o) => ({
        kind: o.model || o.kind, grade: o.grade, score: o.score, stock: o.stock ? { ...o.stock } : null,
        x: o.pos.x, y: o.pos.y, z: o.pos.z, yaw: o.yaw, hp: o.hp, alt: o.alt || 0, mine: o === v,
        // (the garage's work, the tank, the dust, your parking: ROADMAP 4.6)
        paint: o.kind === 'car' && o.color ? o.color.slice() : null, design: o.design || null, up: o.up || null,
        fuel: o.fuel === undefined ? null : o.fuel, dirt: o.dirt === undefined ? null : o.dirt, kept: !!o.kept,
        // (one drawn freehand: its drawing, to build it again - ROADMAP 11.6)
        drawn: o.drawn || null,
        // (the parts drawn onto it: ROADMAP 11.20)
        fz: g.fuse ? g.fuse.saveVeh(o) : undefined,
      })),
      world: { gone, spots: objs.spots.map((s) => ({ x: s.x, y: s.y, z: s.z, r: s.r })) },
      hour: g.daynight ? g.daynight.hour : 18.3,
      sky: g.weather ? g.weather.kind : 'clear',
      album: g.album.items ? [...g.album.items.entries()] : [],
      goals: { ...g.goalFlags },
      gps: g.gps && g.gps.target ? { ...g.gps.target } : null,
    };
  }

  async save(slot, quiet = false) {
    if (this.busy) return false;
    this.busy = true;
    let ok = true;
    try {
      await put(slot, this.snapshot());
    } catch (e) {
      ok = false;
    }
    this.busy = false;
    if (slot === 'auto') this.autoT = AUTO_EVERY;
    const hud = this.game.hud;
    if (!quiet || !ok) hud.toast(ok ? `נשמר: ${SLOT_NAMES[slot]}` : 'השמירה לא הצליחה', ok ? 'good' : 'bad', 2);
    else if (hud.saving) hud.saving();
    return ok;
  }

  async header(slot) {
    const s = migrate(await get(slot));
    if (!s) return null;
    return { slot, at: s.at, text: `${s.where || 'בעיר'} · ${s.clock} · ${ago(s.at)}` };
  }

  // the newest save there is (for "continue")
  async latest() {
    let best = null;
    for (const slot of SLOTS) {
      const h = await this.header(slot);
      if (h && (!best || h.at > best.at)) best = h;
    }
    return best;
  }

  // in the middle of a game: start the page again and load into a fresh city
  loadFresh(slot) {
    try {
      sessionStorage.setItem(PENDING, slot);
    } catch (e) {
      return;
    }
    location.reload();
  }

  // a load waiting from before the page started again (once)
  takePending() {
    try {
      const s = sessionStorage.getItem(PENDING);
      if (s) sessionStorage.removeItem(PENDING);
      return SLOTS.includes(s) ? s : null;
    } catch (e) {
      return null;
    }
  }

  async load(slot) {
    const s = migrate(await get(slot));
    if (!s) return false;
    this.apply(s);
    return true;
  }

  // ------------------------------------------------------------------ putting it all back
  apply(s) {
    const g = this.game;
    const p = g.player;
    if (p.inVehicle) g.exitVehicle(true);
    // the city as it was left
    const w = g.world;
    if (!w.nav && w.buildNav) w.buildNav();
    const objs = w.objects;
    for (const id of s.world.gone || []) {
      const o = objs.list[id];
      if (o && o.state === 'here') objs.remove(o, false);
    }
    const col = w.collision;
    for (const sp of s.world.spots || []) {
      const spot = objs.addSpot(sp.x, sp.y, sp.z, sp.r);
      if (!spot) continue;
      const walls = [];
      col.forEachIn(sp.x - sp.r, sp.z - sp.r, sp.x + sp.r, sp.z + sp.r, (b) => {
        if (b.tag === 'roomwall') walls.push(b);
      });
      for (const b of walls) openWall(col, w.nav, b, spot);
    }
    // you
    const P = s.player;
    // (v5, ROADMAP 11.17: saved out on the mainland: what is around you is built first)
    if (w.mainland) w.mainland.fill({ x: P.x, z: P.z });
    p.spawn(P.x, P.z, P.yaw);
    p.pos.y = Math.max(p.pos.y, P.y);
    if (s.hero && g.streetlife) {
      g.streetlife.applyHero(s.hero);
      g.streetlife.saveHero();
    }
    p.maxHp = P.maxHp || p.maxHp;
    p.hp = Math.max(1, Math.min(p.maxHp, P.hp));
    p.invuln = 3;
    p.parachute = P.parachute ? { grade: P.parachute.grade, colours: Array.isArray(P.parachute.colours) ? P.parachute.colours : null } : null;
    // (the vest, ROADMAP 5.7)
    if (!g.classic) {
      p.armor = P.armor || 0;
      dress(p.fig.look, p.armor > 0);
    }
    g.camRig.yaw = P.yaw;
    if (g.skills && s.skills) g.skills.load(s.skills);
    if (g.money && s.money) g.money.load(s.money);
    if (g.graffiti && s.graffiti) g.graffiti.load(s.graffiti);
    if (g.ink && s.ink) g.ink.load(s.ink);
    if (g.gadgets && s.gadgets) g.gadgets.load(s.gadgets);
    if (g.knock && s.knock) g.knock.load(s.knock);
    if (g.props && s.props) g.props.load(s.props);
    if (g.freedraw && s.free) g.freedraw.load(s.free);
    // what you held
    const W = g.weapons;
    while (W.slots.length > W.keep) W.removeModel(W.slots.pop());
    for (const it of s.weapons || []) {
      let slot;
      if (it.free && Array.isArray(it.free.s)) {
        // (drawn freehand: read and made again from its drawing, game/freeform.js)
        if (g.classic) continue;
        const cats = new Set(Array.isArray(it.free.cats) ? it.free.cats : []);
        const R = readFree(it.free.s, it.free.force || null, cats);
        if (!R || R.cat !== 'weapon') continue;
        // (ROADMAP 11.11: made of parts - what each did, again)
        if (it.free.parts && g.lab) {
          const over = {};
          if (it.free.over && typeof it.free.over === 'object') for (const [k, t] of Object.entries(it.free.over)) if (typeof t === 'string') over[+k] = t;
          const P = R.grid ? readHandParts(it.free.s.map((o) => ({ p: o.p, c: o.c })), over, cats, R) : null;
          if (P) {
            R.def = handSpec(P).def;
            R.muzzlePts = P.muzzles;
            R.parts = true;
          }
        }
        W.add(R.def, 'good', buildWeapon(R), undefined);
        slot = W.current;
        slot.free = it.free;
        slot.strokes = it.free.s.map((o) => o.p);
      } else {
        const def = WEAPON_DEFS[it.id];
        if (!def) continue;
        const model = buildWeaponModel(it.id, it.grade, { seed: it.score || 0 });
        W.add(def, it.grade, model, it.score === null ? undefined : it.score);
        slot = W.current;
      }
      slot.ammo = it.ammo < 0 ? Infinity : it.ammo;
      if (it.uses !== null && it.uses !== undefined) slot.uses = it.uses;
    }
    if (W.off) W.clearOff();
    if (s.offhand && s.offhand.free && Array.isArray(s.offhand.free.s) && !g.classic) {
      const R = readFree(s.offhand.free.s, 'g:shield', new Set(['gear']));
      if (R && R.cat === 'weapon' && R.kind === 'shield') {
        W.setOff(R.def, 'good', buildWeapon(R), s.offhand.free);
        if (typeof s.offhand.uses === 'number') W.off.uses = s.offhand.uses;
      }
    }
    // (by what it was: not with ?classic the fists come second, ROADMAP 5.4)
    const wi = s.weaponId ? W.slots.findIndex((sl) => sl.def.id === s.weaponId) : -1;
    W.select(wi >= 0 ? wi : Math.min((s.weapon || 0) + (s.weapon > 0 ? W.keep - 1 : 0), W.slots.length - 1));
    // the vehicles where they were left (and the one you sat in)
    const V = g.vehicles;
    for (const o of V.list) o.dispose();
    V.list.length = 0;
    let mine = null;
    for (const it of s.vehicles || []) {
      let v;
      if (it.drawn) {
        v = g.classic || !Array.isArray(it.drawn.strokes) ? null : spawnDrawn(g, it.drawn, it.x, it.z, it.yaw, true, it.alt || 0);
        if (!v) continue;
      } else if (it.stock) v = V.spawnStock(it.stock, { x: it.x, z: it.z }, it.yaw);
      else {
        // (the new rides, ROADMAP 4.8, are not in ?classic)
        if (!BLUEPRINTS[it.kind] || (g.classic && BLUEPRINT_MORE.includes(it.kind))) continue;
        v = V.create(it.kind, it.grade, it.score);
        v.pos.set(it.x, it.y, it.z);
        v.yaw = it.yaw;
        V.add(v);
      }
      if (it.paint) v.color = it.paint;
      if (it.design) v.design = it.design;
      if (it.up) {
        v.up = it.up;
        g.garage.applyUps(v);
      }
      if (typeof it.fuel === 'number') v.fuel = it.fuel;
      if (typeof it.dirt === 'number') v.dirt = it.dirt;
      v.kept = !!it.kept;
      v.hp = Math.min(v.maxHp, it.hp);
      v.alt = it.alt || 0;
      if (it.fz && g.fuse) g.fuse.loadVeh(v, it.fz);
      if (it.mine) mine = v;
    }
    if (mine) g.enterVehicle(mine);
    // the hour, the sky, the album, the goals, the destination
    if (g.daynight && typeof s.hour === 'number') g.daynight.setHour(s.hour);
    if (g.weather && g.weather.mode === 'auto' && s.sky) {
      g.weather.go(s.sky, true);
      g.weather.snap();
    }
    if (g.album.items && Array.isArray(s.album)) {
      for (const [id, val] of s.album) if (BLUEPRINTS[id] && !g.album.items.has(id)) g.album.items.set(id, val);
      g.album.save();
    }
    if (s.goals) {
      Object.assign(g.goalFlags, s.goals);
      g.updateGoals();
    }
    if (g.gps) {
      if (s.gps) g.gps.set(s.gps.x, s.gps.z, s.gps.name || null);
      else g.gps.clear();
    }
    this.playTime = s.playTime || 0;
    this.autoT = AUTO_EVERY;
    g.hud.toast(`נטען: ${s.where || 'העיר'} · ${s.clock}`, 'good', 2.4);
  }
}
