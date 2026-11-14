import { dress } from './wardrobe.js';
import { fmt } from './money.js';

// (ROADMAP 6.3, not with ?classic) Arrested instead of killed.
//   - H (on a phone, the hands button) with the police after you: your hands go up. They hold
//     their fire and the nearest officer walks up and puts the cuffs on. Move, or H again, and it
//     is off (and they shoot again).
//   - with one or two stars they would rather take you than kill you: a blow from them that would
//     have finished you leaves you cuffed on the ground; an officer next to you for a moment takes
//     hold of you (unless you fight or run); stopped in a car with an officer at your door, you
//     are pulled out.
//   - busted: a night in the cells of the police station on the fountain plaza (world/station.js).
//     The guns you drew are taken (the album keeps them: draw them again) and the vest; in the
//     morning you walk out of its door, the stars gone.

const CUFF_T = 1.3; // the officer at your side, putting the cuffs on
const GRAB_T = 1.0; // an officer next to you this long (one or two stars) takes hold of you
const CAR_T = 1.6; // stopped in a car with an officer at the door
const OUT_HOUR = 8; // you come out in the morning
const SAY = ['You\'re under arrest!', 'Hands behind your back!', 'Don\'t move!', 'You have the right to remain silent.'];

export class Arrest {
  constructor(game) {
    this.game = game;
    this.state = null; // 'hands' | 'busted'
    this.cuffer = null;
    this.cuffT = 0;
    this.grabT = 0;
    this.carT = 0;
    this.reason = null;
    this.shownT = 0;
    this.told = false;
    this.stats = { surrenders: 0, busts: 0, released: 0 };
    this.btn = document.getElementById('btn-hands');
    this.btnOn = null;
    const out = document.getElementById('busted-btn');
    if (out) out.addEventListener('click', () => this.release());
  }

  // the police hold their fire (game/enemies.js, game/heli.js); you can't move or act
  // (game/player.js, game/weapons.js)
  get holdFire() {
    return this.state !== null;
  }

  get frozen() {
    return this.state !== null;
  }

  update(dt) {
    const game = this.game;
    const P = game.police;
    const p = game.player;
    this.button();
    if (this.state === 'busted') {
      this.cuffing(dt);
      return;
    }
    if (!P.hostile || p.mode === 'dead') {
      if (this.state) this.drop(false);
      this.grabT = 0;
      this.carT = 0;
      return;
    }
    // (the key, said once)
    if (!this.told && p.mode === 'foot' && !game.touch) {
      this.told = true;
      game.hud.toast('המשטרה אחריכם. H — להרים ידיים ולהיכנע', 'info', 3);
    }
    const input = game.input;
    if (game.state === 'play' && input.wasPressed('KeyH') && p.mode === 'foot' && !game.dialog.open && !game.airdraw.open) {
      if (this.state === 'hands') this.drop(true);
      else this.raise();
    }
    if (this.state === 'hands') {
      // moving off: it is over
      const mv = input.readMove();
      if (Math.hypot(mv.x, mv.y) > 0.35 || p.mode !== 'foot') {
        this.drop(true);
        return;
      }
      this.walkUp(dt);
      return;
    }
    // (one or two stars: they would rather take you alive)
    if (P.level > 2) {
      this.grabT = 0;
      this.carT = 0;
      return;
    }
    const W = game.weapons;
    const fighting = game.time - (W.lastFire || -100) < 1.5 || (W.fists && W.fists.busy);
    if (p.mode === 'foot' && !p.sprinting && !fighting) {
      const e = this.officerNear(p.pos, 1.4);
      this.grabT = e ? this.grabT + dt : 0;
      if (this.grabT > GRAB_T) this.bust('grab', e);
    } else this.grabT = 0;
    const v = p.inVehicle;
    if (v && Math.abs(v.speed || 0) < 0.8) {
      const e = this.officerNear(v.pos, 3.4);
      this.carT = e ? this.carT + dt : 0;
      if (this.carT > CAR_T) this.bust('car', e);
    } else this.carT = 0;
  }

  // the nearest officer on his feet, within r of a point
  officerNear(at, r) {
    let best = null;
    let bd = r;
    for (const e of this.game.enemies.list) {
      if (e.faction !== 'police' || !e.alive || e.headless || e.fig.rag || e.downT > 0) continue;
      const d = Math.hypot(e.pos.x - at.x, e.pos.z - at.z);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  // ------------------------------------------------------------------ hands up
  raise() {
    const game = this.game;
    this.state = 'hands';
    this.cuffer = null;
    this.cuffT = 0;
    this.stats.surrenders++;
    game.player.fig.surrender = 1;
    game.hud.toast('ידיים למעלה. השוטרים מפסיקים לירות ובאים לאזוק אתכם', 'info', 2.4);
  }

  drop(told) {
    this.state = null;
    this.cuffer = null;
    this.cuffT = 0;
    this.game.player.fig.surrender = 0;
    if (told) this.game.hud.toast('הורדתם את הידיים, והם יורים שוב!', 'bad', 1.8);
  }

  // the nearest officer comes up to you (game/enemies.js asks: Arrest.walk)
  walkUp(dt) {
    const p = this.game.player;
    if (!this.cuffer || !this.cuffer.alive || this.cuffer.headless) this.cuffer = this.officerNear(p.pos, 70);
    const e = this.cuffer;
    if (!e) return;
    const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
    this.cuffT = d < 1.6 ? this.cuffT + dt : 0;
    if (this.cuffT > 0.25) this.bust('hands', e);
  }

  // an officer's steps while you have your hands up: the one with the cuffs walks up to you, the
  // others stand with their guns on you (game/enemies.js, after the brain)
  walk(e, mv) {
    const p = this.game.player;
    const dx = p.pos.x - e.pos.x;
    const dz = p.pos.z - e.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    mv.face = Math.atan2(dx, dz);
    mv.aimYaw = 0;
    if (e === this.cuffer && d > 1.1) {
      mv.x = dx / d;
      mv.z = dz / d;
      mv.speed = d > 4 ? 3.6 : 1.8;
      mv.aim = d > 2.5;
    } else {
      mv.x = 0;
      mv.z = 0;
      mv.speed = 0;
      mv.aim = e !== this.cuffer;
    }
    mv.crouch = false;
  }

  // ------------------------------------------------------------------ busted
  // (true: the blow that would have finished you is the police's, with one or two stars - you
  // are taken instead; game/player.js)
  spare(src) {
    const P = this.game.police;
    if (this.state === 'busted' || !P.hostile || P.level > 2 || !src || src.faction !== 'police') return false;
    this.bust('down', src);
    return true;
  }

  bust(reason, e) {
    const game = this.game;
    if (this.state === 'busted') return;
    const p = game.player;
    if (p.inVehicle) game.exitVehicle(true);
    this.state = 'busted';
    this.reason = reason;
    this.cuffer = e || this.officerNear(p.pos, 80);
    this.shownT = 0;
    this.stats.busts++;
    // (ROADMAP 8.1) the fine: $50 a star
    this.fine = game.money ? 50 * Math.max(1, game.police.level) : 0;
    p.fig.surrender = 1;
    p.fig.crouch = reason === 'down' ? 1 : 0;
    game.state = 'busted';
    game.audio.siren(0);
    game.audio.play('fail');
    if (this.cuffer) game.bubbles.say(this.cuffer, SAY[Math.floor(Math.random() * SAY.length)], 'cop');
    game.input.releaseLock();
  }

  // the officer at your side; then the night in the cells (the page over the city)
  cuffing(dt) {
    const game = this.game;
    const p = game.player;
    const e = this.cuffer;
    if (e && e.alive) {
      // (beside you, a little behind)
      const fx = Math.sin(p.yaw);
      const fz = Math.cos(p.yaw);
      const tx = p.pos.x - fx * 0.75 + fz * 0.35;
      const tz = p.pos.z - fz * 0.75 - fx * 0.35;
      const k = 1 - Math.exp(-dt * 4);
      e.pos.x += (tx - e.pos.x) * k;
      e.pos.z += (tz - e.pos.z) * k;
      e.vel.set(0, 0, 0);
    }
    this.shownT += dt;
    if (this.shownT > 2.2 && !this.sheet) {
      this.sheet = document.getElementById('busted');
      const why = document.getElementById('busted-why');
      if (why) why.textContent = WHY[this.reason] || WHY.hands;
      const fine = document.getElementById('busted-fine');
      if (fine) fine.textContent = this.fine ? `הקנס: ${fmt(this.fine)}, מהמזומן (ואם אין מספיק, מהבנק).` : '';
      if (this.sheet) this.sheet.classList.remove('hidden');
    }
  }

  // morning: out of the station's door, the guns and the vest kept by the police
  release() {
    const game = this.game;
    if (this.state !== 'busted') return;
    if (this.sheet) this.sheet.classList.add('hidden');
    this.sheet = null;
    const W = game.weapons;
    const lost = W.slots.length - W.keep;
    while (W.slots.length > W.keep) W.removeModel(W.slots.pop());
    W.select(0);
    W.projectiles = [];
    const p = game.player;
    const vest = p.armor > 0;
    if (vest) {
      p.armor = 0;
      dress(p.fig.look, false);
    }
    game.enemies.reset();
    game.bubbles.clear();
    game.police.reset();
    for (const c of game.traffic.list) if (c.police) c.mode = c.crew && c.crew.length ? 'patrol' : 'leave';
    if (game.chase) for (const b of game.chase.blocks) game.chase.lift(b);
    if (game.daynight) game.daynight.setHour(OUT_HOUR);
    const S = game.world.station;
    const at = S ? S.door : game.world.spawn;
    p.spawn(at.x, at.z, at.yaw);
    game.camRig.yaw = at.yaw;
    game.camRig.pitch = -0.08;
    this.state = null;
    this.cuffer = null;
    p.fig.surrender = 0;
    p.fig.crouch = 0;
    this.stats.released++;
    game.state = 'play';
    if (!game.touch) game.input.requestLock(true);
    const what = lost > 0 && vest ? 'הנשק והאפוד הוחרמו' : lost > 0 ? 'הנשק הוחרם' : vest ? 'האפוד הוחרם' : 'לא היה מה להחרים';
    const paid = game.money && this.fine ? game.money.take(this.fine, 'קנס במשטרה') : 0;
    this.fine = 0;
    game.hud.toast(`שוחררתם מתחנת המשטרה. ${what}${paid ? `, ושילמתם קנס של ${fmt(paid)}` : ''}`, 'info', 3.4);
  }

  // ------------------------------------------------------------------ the hands button (phones)
  button() {
    const el = this.btn;
    if (!el || !this.game.touch) return;
    const p = this.game.player;
    const on = this.game.police.hostile && p.mode === 'foot' && this.state !== 'busted';
    if (on !== this.btnOn) {
      this.btnOn = on;
      el.classList.toggle('hidden', !on);
    }
    el.classList.toggle('on', this.state === 'hands');
  }
}

const WHY = {
  hands: 'נכנעתם, והשוטרים אזקו אתכם.',
  grab: 'שוטר תפס אתכם ואזק אתכם.',
  down: 'נפלתם, והשוטרים אזקו אתכם במקום לירות.',
  car: 'עצרתם, והשוטרים הוציאו אתכם מהרכב.',
};
