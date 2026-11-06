// (ROADMAP 15.5) Your inventions: a car with the parts you drew on it - their sizes, places, ways -
// kept under a name, every version of it, and made again whole in a moment (ui/freedraw.js: the
// pen's "inventions" shelf; game/partpen.js: kept from the car's pen). What you know how to draw (the
// album, ui/album.js) and what you made of it are two libraries: this is the second.

const KEY = 'scribble-city-v5-inventions';
const MAX = 24;

// the ink a part takes, made again with its invention
const PART_INK = { wing: 4, rotor: 6, jet: 4, prop: 3, wheel: 3, armor: 4 };

export class Inventions {
  constructor(game) {
    this.game = game;
    // { id, name, base: { bp }, parts: [{ type, v, n, at, dir, ink }], v, t, versions: [...] }
    this.list = [];
    this.load();
  }

  load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (Array.isArray(d)) this.list = d.filter((o) => o && typeof o.name === 'string' && Array.isArray(o.parts)).slice(0, MAX);
    } catch (e) {
      this.list = [];
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.list));
    } catch (e) {
      // (no room: they last as long as the page)
    }
  }

  // the car v as an invention: what it is underneath, and every part drawn on it
  capture(v) {
    const parts = (v && v.fuse ? v.fuse.parts : []).filter((p) => p.par).map((p) => ({ type: p.type, v: p.v, n: { ...p.n }, at: p.at ? p.at.slice() : null, dir: p.dir ? p.dir.slice() : null, ink: p.ink }));
    return { base: { bp: v && v.bp ? v.bp.id : 'car' }, parts };
  }

  // kept under a name - a name it already has: a new version of it, the old ones kept
  store(name, v) {
    const c = this.capture(v);
    if (!c.parts.length) return { why: 'עוד אין עליה חלקים מצוירים — ציירו טורבו, גלגלי שטח, שריון...' };
    name = String(name || '').trim().slice(0, 28) || 'המצאה';
    let o = this.list.find((x) => x.name === name);
    if (o) {
      o.versions = (o.versions || []).slice(-5);
      o.versions.push({ base: o.base, parts: o.parts, v: o.v, t: o.t });
      o.base = c.base;
      o.parts = c.parts;
      o.v = (o.v || 1) + 1;
      o.t = Date.now();
    } else {
      o = { id: Math.random().toString(36).slice(2, 8), name, base: c.base, parts: c.parts, v: 1, t: Date.now() };
      this.list.unshift(o);
      if (this.list.length > MAX) this.list.length = MAX;
    }
    this.save();
    return { ok: true, o };
  }

  remove(id) {
    const i = this.list.findIndex((o) => o.id === id);
    if (i < 0) return false;
    this.list.splice(i, 1);
    this.save();
    return true;
  }

  // the ink to make it again: its car's, and each part's
  inkOf(o, baseInk) {
    return baseInk + o.parts.reduce((s, p) => s + (PART_INK[p.type] || 4), 0);
  }

  // names to offer for what is on the car now (its parts say what it is)
  names(v) {
    const t = new Set((v && v.fuse ? v.fuse.parts : []).filter((p) => p.par).map((p) => p.type));
    const out = [];
    if (t.has('wing') && t.has('rotor') && t.has('jet')) out.push('השד המעופף');
    if (t.has('wing') && t.has('jet')) out.push('טיל הכביש');
    if (t.has('wing') && t.has('rotor')) out.push('הדאון המרחף');
    if (t.has('rotor')) out.push('המסוק של השכונה');
    if (t.has('armor') && t.has('wheel')) out.push('מפלצת הכביש');
    if (t.has('armor')) out.push('הטנק הוורוד');
    if (t.has('wheel')) out.push('קופץ השטח');
    if (t.has('jet')) out.push('הטורבו המשוגע');
    if (t.has('prop')) out.push('סירת הכביש');
    if (t.has('wing')) out.push('הציפור');
    out.push('ההמצאה שלי');
    return [...new Set(out)].filter((n) => !this.list.some((o) => o.name === n)).slice(0, 3);
  }
}
