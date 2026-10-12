// (ROADMAP 6.5, not with ?classic) The city's gangs.
//   - two gangs own the alleys of the west blocks (world/streets.js): the INKBLOTS in the north, in
//     purple, and the ERASERS in the south, in a school eraser's pink and white, with erasers for
//     clubs and rubber machine guns whose shots rub the city out. Their turf is on the city map in
//     their colours, with their names (ui/citymap.js).
//   - turf wars: now and then, while you are near one gang's turf, a crew of the other comes to
//     take it and they shoot it out in the street. Keep out of it - or join in, and both sides turn
//     on you.
//   - the Erasers rub out what is yours: a blow from one of them can rub the drawn weapon out of
//     your hands, and a vehicle of yours left by their turf is rubbed out while you are away.

export const GANGS = {
  inkblots: { name: 'הכתמים', sign: 'INKBLOTS', color: '#7b45d6', fill: 'rgba(123, 69, 214, 0.1)', line: 'rgba(123, 69, 214, 0.75)', hatch: 'rgba(123, 69, 214, 0.32)', crew: [0.52, 0.28, 0.78] },
  erasers: { name: 'המוחקים', sign: 'ERASERS', color: '#f0508a', fill: 'rgba(255, 111, 154, 0.12)', line: 'rgba(240, 80, 138, 0.8)', hatch: 'rgba(240, 80, 138, 0.34)', crew: [0.98, 0.62, 0.7] },
};

const WAR_EVERY = [75, 150]; // seconds between two raids while you are near a turf
const NEAR_TURF = 120; // (metres from a turf's middle)
const WAR_LONG = 50; // a war is over after this long
const FIRE_RANGE = 24; // they shoot it out from this close
const HIT = 0.3; // the chance a shot in a war hits
const RUB_CAR_T = 9; // a vehicle of yours by the Erasers' turf: gone this long after you leave it
const RUB_WEAPON = 0.35; // the chance a blow of theirs rubs out the weapon in your hands

export class Gangs {
  constructor(game) {
    this.game = game;
    this.turfs = [];
    // the gang blocks' turf (world/streets.js), north to south
    const T = (game.world.territories || []).filter((t) => t.name === 'gang').sort((a, b) => a.z - b.z);
    if (T.length) this.claim(T[0], 'inkblots');
    if (T.length > 1) this.claim(T[T.length - 1], 'erasers');
    this.war = null;
    this.warT = 45;
    this.tagT = 0;
    this.carT = new Map();
    this.carCheckT = 0;
    this.stats = { wars: 0, down: 0, weapons: 0, cars: 0 };
  }

  claim(t, id) {
    t.gang = id;
    if (id === 'erasers') t.kinds = ['eraser', 'eraserGun', 'eraserGun'];
    this.turfs.push(t);
  }

  gangOf(e) {
    return e.gang || (e.territory && e.territory.gang) || null;
  }

  update(dt) {
    const game = this.game;
    // the Inkblots in their purple (the city's own street crews, given their colour)
    this.tagT -= dt;
    if (this.tagT <= 0) {
      this.tagT = 0.5;
      for (const e of game.enemies.list) {
        if (e.gangTagged || e.faction !== 'gang' || e.isMonster) continue;
        e.gangTagged = true;
        e.gang = this.gangOf(e);
        if (e.gang === 'inkblots') this.dress(e, GANGS.inkblots.crew);
      }
    }
    this.updateWar(dt);
    this.carCheckT -= dt;
    if (this.carCheckT <= 0) {
      this.rubCars(0.5 - this.carCheckT);
      this.carCheckT = 0.5;
    }
  }

  dress(e, crew) {
    const L = e.fig.look;
    if (L.bandana) L.bandana = crew;
    if (L.hat && ['cap', 'capBack', 'beanie', 'bandanaHead'].includes(L.hat.kind)) L.hat = { ...L.hat, color: crew };
    if (L.top && L.top.kind === 'hoodie' && Math.random() < 0.5) L.top = { ...L.top, color: crew };
  }

  // ------------------------------------------------------------------ turf wars
  updateWar(dt) {
    const game = this.game;
    if (this.war) {
      this.fight(dt);
      return;
    }
    if (this.turfs.length < 2 || game.police.hostile) return;
    this.warT -= dt;
    if (this.warT > 0) return;
    const pp = game.anchorPos();
    const home = this.turfs.find((t) => Math.hypot(t.x - pp.x, t.z - pp.z) < NEAR_TURF);
    if (!home) {
      this.warT = 5;
      return;
    }
    this.warT = WAR_EVERY[0] + Math.random() * (WAR_EVERY[1] - WAR_EVERY[0]);
    this.start(home);
  }

  start(home) {
    const game = this.game;
    const E = game.enemies;
    const raidId = home.gang === 'inkblots' ? 'erasers' : 'inkblots';
    const raidTurf = this.turfs.find((t) => t.gang === raidId);
    if (!raidTurf) return null;
    const war = { home, raidId, homeId: home.gang, raiders: [], defenders: [], t: 0, t0: game.time, joined: false, hits: [] };
    // the defenders: who is about on the turf (a couple more if there are too few)
    for (const e of E.list) if (e.alive && !e.headless && e.territory === home && e.state !== 'combat') war.defenders.push(e);
    const nav = game.world.nav;
    const pp = game.anchorPos();
    const spot = (r0, r1, n, out) => {
      const a0 = Math.random() * Math.PI * 2;
      for (let i = 0; i < 30 && out.length < n; i++) {
        const a = a0 + i * 0.7;
        const r = r0 + Math.random() * (r1 - r0);
        const x = home.x + Math.cos(a) * r;
        const z = home.z + Math.sin(a) * r;
        if (!nav.walkable(x, z) || Math.hypot(x - pp.x, z - pp.z) < 18) continue;
        out.push([x, z]);
      }
      return out;
    };
    for (const [x, z] of spot(4, home.r * 0.5, Math.max(0, 2 - war.defenders.length), [])) {
      war.defenders.push(E.spawnAt(E.typeFor(home.kinds[war.defenders.length % home.kinds.length]), x, z, home));
    }
    // the raiders: in from the street at the edge of the turf
    const kinds = raidTurf.kinds;
    spot(home.r + 6, home.r + 16, 3, []).forEach(([x, z], i) => {
      const e = E.spawnAt(E.typeFor(kinds[i % kinds.length]), x, z, raidTurf);
      e.gang = raidId;
      war.raiders.push(e);
    });
    if (!war.raiders.length || !war.defenders.length) return null;
    for (const e of war.raiders) this.enlist(e, war, 'raid');
    for (const e of war.defenders) this.enlist(e, war, 'home');
    this.war = war;
    this.stats.wars++;
    game.hud.toast(`מלחמת כנופיות! ${GANGS[raidId].name} פושטים על השטח של ${GANGS[home.gang].name}`, 'bad', 3);
    return war;
  }

  enlist(e, war, side) {
    e.war = war;
    e.warSide = side;
    e.warFireT = 0.5 + Math.random() * 1.5;
    e.gang = side === 'raid' ? war.raidId : war.homeId;
    e.gangTagged = true;
    // (after it, home: their own turf)
    if (e.territory) e.home.set(e.territory.x, 0, e.territory.z);
    if (e.gang === 'inkblots') this.dress(e, GANGS.inkblots.crew);
    e.leaveCover();
  }

  // an officer-free fight between two crews: the steps of one of them (game/enemies.js, after its
  // brain): face the nearest of the others, close in, shoot (or swing)
  warStep(e, mv, dt) {
    const war = e.war;
    const game = this.game;
    if (war.joined || this.war !== war) {
      e.war = null;
      return;
    }
    // you in it: you hurt one of them, or came too close - both sides turn on you
    const pp = game.anchorPos();
    if (e.hurtT > war.t0 || Math.hypot(e.pos.x - pp.x, e.pos.z - pp.z) < 6) {
      this.join(war);
      return;
    }
    const foes = e.warSide === 'raid' ? war.defenders : war.raiders;
    let foe = null;
    let fd = Infinity;
    for (const f of foes) {
      if (!f.alive || f.headless) continue;
      const d = Math.hypot(f.pos.x - e.pos.x, f.pos.z - e.pos.z);
      if (d < fd) {
        fd = d;
        foe = f;
      }
    }
    mv.x = 0;
    mv.z = 0;
    mv.speed = 0;
    mv.crouch = false;
    mv.aim = false;
    if (!foe) return;
    const dx = foe.pos.x - e.pos.x;
    const dz = foe.pos.z - e.pos.z;
    mv.face = Math.atan2(dx, dz);
    mv.aimYaw = 0;
    const cfg = e.cfg;
    e.warFireT -= dt;
    if (cfg.melee) {
      // a club: run in, and swing
      if (fd > 1.5) this.approach(e, foe, mv, cfg.run);
      else if (e.warFireT <= 0) {
        e.warFireT = cfg.interval * (1 + Math.random() * 0.4);
        e.attackT = 0;
        game.audio.play('punch', 0.5);
        if (Math.random() < 0.4) this.down(foe, 0.25);
      }
      return;
    }
    // a gun: from close enough, and only what it can see (the raiders close in faster)
    const hand = e.fig.j.handR;
    const ty = foe.pos.y + 1.2;
    const sees = fd < FIRE_RANGE && game.world.collision.lineOfSight(hand.x, hand.y, hand.z, foe.pos.x, ty, foe.pos.z);
    if (!sees) {
      this.approach(e, foe, mv, e.warSide === 'raid' ? cfg.walk * 1.5 : cfg.walk * 1.1);
      return;
    }
    mv.aim = true;
    mv.crouch = e.warSide === 'home' && fd > 10;
    if (e.warFireT > 0) return;
    e.warFireT = 1.1 + Math.random() * 0.8;
    const sx = foe.pos.x - hand.x + (Math.random() - 0.5) * 0.8;
    const sy = ty - hand.y;
    const sz = foe.pos.z - hand.z + (Math.random() - 0.5) * 0.8;
    const l = Math.hypot(sx, sy, sz) || 1;
    const kind = cfg.rubber ? 'rubber' : cfg.gun === 'pen' ? 'ink' : cfg.gun === 'm4' ? 'paintball' : 'enemy';
    const W = game.weapons;
    W.spawnEnemyShot(hand.x, hand.y, hand.z, sx / l, sy / l, sz / l, cfg.dmg, 42, null, kind, e);
    // (the war's rubber leaves the city as it is: game/weapons.js)
    W.projectiles[W.projectiles.length - 1].soft = true;
    game.fx.muzzle(hand.x, hand.y, hand.z, 0.5);
    const cam = game.camera.position;
    game.audio.play('enemyShot', Math.max(0.12, Math.min(0.6, 1 - Math.hypot(hand.x - cam.x, hand.z - cam.z) / 60)));
    if (Math.random() < HIT) this.down(foe, fd / 42);
  }

  // towards a foe round the buildings (the path finder's way, found again every two seconds)
  approach(e, foe, mv, speed) {
    const game = this.game;
    // (a way not found is looked for again only in two seconds too)
    if (!(game.time < e.warPathT)) {
      e.warPathT = game.time + 2 + Math.random() * 0.5;
      e.warPath = game.enemies.pf.find(e.pos.x, e.pos.z, foe.pos.x, foe.pos.z, 1500) || null;
      e.warPathI = 0;
    }
    let tx = foe.pos.x;
    let tz = foe.pos.z;
    const P = e.warPath;
    if (P && P.length) {
      while (e.warPathI < P.length - 1 && Math.hypot(P[e.warPathI][0] - e.pos.x, P[e.warPathI][1] - e.pos.z) < 2) e.warPathI++;
      tx = P[e.warPathI][0];
      tz = P[e.warPathI][1];
    }
    const dx = tx - e.pos.x;
    const dz = tz - e.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    mv.x = dx / d;
    mv.z = dz / d;
    mv.speed = speed;
    mv.face = Math.atan2(dx, dz);
  }

  // one of them hit: down when the shot gets there
  down(e, after) {
    this.war.hits.push({ e, t: this.game.time + after });
  }

  fight(dt) {
    const game = this.game;
    const war = this.war;
    war.t += dt;
    if (war.hits.length) {
      for (const h of war.hits) if (game.time >= h.t) this.fall(h.e);
      war.hits = war.hits.filter((h) => game.time < h.t);
    }
    const left = (l) => l.some((e) => e.alive && !e.headless && e.war === war);
    if (war.joined || war.t > WAR_LONG || !left(war.raiders) || !left(war.defenders)) this.end();
  }

  // down for good, in the war (not your doing: no crime, no score)
  fall(e) {
    if (!e.alive) return;
    e.dying = 0;
    e.leaveCover();
    if (e.squad.flanker === e) e.squad.flanker = null;
    this.game.fx.crumbs(e.pos.x, e.pos.y + 1.1, e.pos.z, 26, 3);
    this.game.audio.play('erase', 0.6);
    this.stats.down++;
    // (their cash, for whoever comes by: ROADMAP 8.1)
    if (this.game.money) this.game.money.fromEnemy(e);
  }

  join(war) {
    war.joined = true;
    const p = this.game.anchorPos();
    for (const e of [...war.raiders, ...war.defenders]) {
      if (!e.alive) continue;
      e.war = null;
      e.lastSeen.copy(p);
      e.squad.lastKnown.copy(p);
      e.squad.knowT = this.game.time;
      e.awareness = 1;
      e.enterCombat(false);
    }
    this.game.hud.toast('נכנסתם למלחמה: שתי הכנופיות אחריכם!', 'bad', 2.4);
  }

  // over: the raiders go back to their turf, the defenders to theirs
  end() {
    const war = this.war;
    this.war = null;
    for (const e of [...war.raiders, ...war.defenders]) {
      if (!e.alive || e.war !== war) continue;
      e.war = null;
      e.setState('return');
    }
  }

  // ------------------------------------------------------------------ what the Erasers rub out
  // a blow from one of them (game/player.js): now and then the drawn weapon in your hands
  rubbedBy() {
    if (Math.random() > RUB_WEAPON) return false;
    const W = this.game.weapons;
    const slot = W.current;
    if (W.slots.indexOf(slot) < W.keep) return false;
    W.drop(slot, `המוחקים מחקו לכם את ה${slot.def.name}!`);
    this.stats.weapons++;
    return true;
  }

  // a vehicle of yours left by their turf while you are away
  rubCars(dt) {
    const game = this.game;
    const T = this.turfs.find((t) => t.gang === 'erasers');
    if (!T) return;
    const pp = game.player.pos;
    for (const v of game.vehicles.list) {
      const near = !v.driver && !v.dead && !v.kept && Math.hypot(v.pos.x - T.x, v.pos.z - T.z) < T.r + 20 && Math.hypot(v.pos.x - pp.x, v.pos.z - pp.z) > 35;
      if (!near) {
        this.carT.delete(v);
        continue;
      }
      const t = (this.carT.get(v) || 0) + dt;
      if (t < RUB_CAR_T) {
        this.carT.set(v, t);
        continue;
      }
      this.carT.delete(v);
      game.fx.crumbs(v.pos.x, 1, v.pos.z, 60, 4);
      game.fx.smoke(v.pos.x, 1, v.pos.z, 2);
      v.dead = true;
      v.removeAt = game.time;
      this.stats.cars++;
      game.hud.toast('המוחקים מחקו את הרכב שהשארתם ליד השטח שלהם!', 'bad', 3);
    }
  }
}
