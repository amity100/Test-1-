import * as THREE from 'three';
import type { Engine } from '../core/Engine';
import type { Input } from '../core/Input';
import { clamp, damp } from '../core/noise';
import { shared } from '../core/Shared';
import type { UI, KeyHint } from '../ui/UI';
import type { Animal, Flock } from '../characters/Flock';
import { CameraRig, dolly, orbit, V, type Shot } from './CameraRig';
import type { Player } from './Player';
import type { BearActor } from './BearActor';
import type { Props } from './Props';
import type { Projectiles } from './Projectiles';
import type { GameAudio } from './GameAudio';
import { LAYOUT, SUN } from '../world/Layout';
import { quoteText, sourceRef, verseArgs, quoteWithRefHtml } from '../content/sources';

class Cancelled extends Error {}

const K = {
  move: { key: 'W A S D', touch: 'ג׳ויסטיק', label: 'תנועה' },
  look: { key: 'עכבר', touch: 'גרירה', label: 'מצלמה' },
  run: { key: 'Shift', touch: 'דחיפה לקצה', label: 'ריצה' },
  call: { key: 'Q', touch: 'קְרִיאָה', label: 'קריאה לצאן' },
  interact: { key: 'E', touch: 'פְּעֻלָּה', label: '' },
  sling: { key: 'לחצן שמאלי', touch: 'קֶלַע', label: 'החזק — סובב את הקלע · שחרר — קלע' },
  strike: { key: 'F', touch: 'מַקֵּל', label: 'הכאה במקל' },
  dodge: { key: 'Space', touch: 'הִתְחַמֵּק', label: 'התחמקות' },
} satisfies Record<string, KeyHint>;

const withLabel = (k: KeyHint, label: string): KeyHint => ({ ...k, label });

/**
 * Chapter I — "The Shepherd". A linear async script driven by game time, plus per-frame behaviours.
 * Story beats follow 1 Samuel 16:11-12 and 17:34-37.
 */
export class Story {
  timeScale = 1;
  private slowTarget = 1;
  private time = 0;
  private gen = 0;
  private waits: { until: () => boolean; resolve: () => void; reject: (e: Error) => void; gen: number }[] = [];
  private timers: { at: number; fn: () => void; gen: number; real: boolean }[] = [];
  private realTime = 0;
  /** Run fn after `seconds` of game time (or real time), cancelled on restart. */
  private after(seconds: number, fn: () => void, real = false) {
    this.timers.push({ at: (real ? this.realTime : this.time) + seconds, fn, gen: this.gen, real });
  }
  private markerPos: THREE.Vector3 | null = null;
  private markerLabel = '';
  private markerFn: (() => THREE.Vector3 | null) | null = null;
  private bossHP = 1;
  private showBoss = false;
  private showHealth = false;
  private beh: ((dt: number) => void) | null = null; // current per-frame behaviour
  private bearThreats: THREE.Vector3[] = [];
  paused = false;
  freeRoam = false;
  private lambHome = new THREE.Vector3();

  constructor(
    private engine: Engine,
    private ui: UI,
    private input: Input,
    private audio: GameAudio,
    private cam: CameraRig,
    private player: Player,
    private flock: Flock,
    private bear: BearActor,
    private props: Props,
    private projectiles: Projectiles,
  ) {
    // sling targets: jars
    for (const jar of props.jars) {
      projectiles.targets.push({
        id: 'jar',
        center: () => jar.center,
        radius: 0.26,
        enabled: () => jar.alive,
        onHit: (_at, vel) => {
          jar.shatter(vel);
          this.audio.at('jarShatter', jar.center, 1);
          this.engine.particles.dustBurst(jar.center, 10, 0.8, new THREE.Color(0.72, 0.45, 0.3));
          this.jarsBroken++;
        },
      });
    }
    // bear hit zones
    const pts: THREE.Vector3[] = [];
    const zone = (i: number, r: number) => ({
      id: 'bear',
      center: () => this.bear.model.hitPoints(pts)[i],
      radius: r,
      enabled: () => this.bear.visible && this.bear.alive && this.bearVulnerable,
      onHit: (at: THREE.Vector3) => this.hitBear(at, 'sling'),
    });
    projectiles.targets.push(zone(1, 0.55), zone(2, 0.32), zone(0, 0.5));
    projectiles.onGroundHit = (at, speed) => {
      if (speed > 6) {
        this.audio.at('stoneHit', at, 0.8);
        this.engine.particles.dustBurst(at, 5, 0.6);
      }
    };
    player.onStrikeImpact = (tip) => this.onStaffImpact(tip);
  }

  jarsBroken = 0;
  bearVulnerable = false;
  private bearHitCB: ((kind: 'sling' | 'staff') => void) | null = null;

  // ============================================================================ script plumbing
  private until(pred: () => boolean) {
    const gen = this.gen;
    return new Promise<void>((resolve, reject) => {
      if (pred()) return resolve();
      this.waits.push({ until: pred, resolve, reject, gen });
    });
  }
  private wait(seconds: number) {
    const end = this.time + seconds;
    return this.until(() => this.time >= end);
  }
  /** Pending waits are rejected on restart, so a superseded script run unwinds on its next await. */
  private check() {
    /* no-op marker for readability */
  }
  private runningGen = 0;

  start(skipIntro = false) {
    this.gen++;
    for (const w of this.waits) w.reject(new Cancelled());
    this.waits = [];
    this.runningGen = this.gen;
    this.run(skipIntro).catch((e) => {
      if (!(e instanceof Cancelled)) console.error(e);
    });
  }

  private setMarker(p: THREE.Vector3 | (() => THREE.Vector3 | null) | null, label = '') {
    this.markerFn = typeof p === 'function' ? p : null;
    this.markerPos = typeof p === 'function' ? null : p;
    this.markerLabel = label;
  }

  private slowMo(scale: number) {
    this.slowTarget = scale;
  }

  private flockCenter() {
    const c = new THREE.Vector3();
    let n = 0;
    for (const a of this.flock.animals) {
      if (a.state === 'carried') continue;
      c.add(a.position);
      n++;
    }
    return n ? c.multiplyScalar(1 / n) : this.flock.pastureCenter.clone();
  }

  private groundV(x: number, z: number, up = 0) {
    return new THREE.Vector3(x, this.engine.terrain.heightAt(x, z) + up, z);
  }

  private shots(list: Shot[]) {
    return new Promise<void>((resolve) => this.cam.playShots(list, resolve));
  }

  private cinematic(on: boolean) {
    this.ui.letterbox(on);
    this.ui.hud(!on);
    this.player.controlEnabled = !on;
    this.input.setTouchVisible(!on);
    if (on) {
      this.ui.prompt(null);
      this.ui.crosshair(false);
    }
  }

  // ============================================================================ main script
  jump: '' | 'sling' | 'bear' | 'fight' | 'end' = '';

  private async run(skipIntro: boolean) {
    const L = LAYOUT;
    this.resetWorld();
    this.ui.fade(1, 0);
    await this.wait(0.3);
    if (this.jump) {
      this.cam.stop();
      await this.debugJump(this.jump);
      return;
    }
    if (!skipIntro) await this.intro();
    else {
      this.cam.stop();
      this.ui.fade(0, 1.5);
      this.cam.snapBehind(this.player.heading, 0.15);
    }
    this.check();

    // ---------------------------------------------------------------- 1. walk to the flock
    this.cinematic(false);
    this.audio.music('pastoral', 4);
    this.ui.objective('לֵךְ אֶל הַצֹּאן', 'הָעֵדֶר רוֹעֶה בַּמִּרְעֶה שֶׁבְּמוֹרַד הַגִּבְעָה');
    this.ui.hint([K.move, K.look, K.run]);
    this.setMarker(() => this.flockCenter().add(new THREE.Vector3(0, 1.5, 0)), 'הַצֹּאן');
    await this.until(() => this.player.pos.distanceTo(this.flockCenter()) < 17 || this.flock.countNear(this.player.pos, 8) >= 3);
    this.check();
    this.ui.hint(null);
    this.audio.sfx('uiObjective');

    // ---------------------------------------------------------------- 2. call the flock
    this.ui.objective('קְרָא לַצֹּאן', 'אֱסֹף אֶת הָעֵדֶר אֵלֶיךָ');
    this.ui.hint([K.call]);
    this.setMarker(null);
    let called = false;
    this.beh = () => {
      if (!called && this.input.take('call')) {
        called = true;
        this.player.model.play('call');
        this.audio.sfx('shepherdCall', { volume: 0.9 });
        this.after(0.35, () => this.flock.call(this.player.pos));
      }
    };
    await this.until(() => called);
    this.check();
    this.ui.hint(null);
    await this.wait(2.5);
    this.ui.toast('מִדְרָשׁ', `${quoteText('shr_2_2_flock')}<small>${sourceRef('shr_2_2_flock')}</small>`, 16);
    await this.wait(3);
    this.check();

    // ---------------------------------------------------------------- 3. five smooth stones
    this.ui.objective('לַקֵּט חֲמִשָּׁה חַלֻּקֵי אֲבָנִים מִן הַנַּחַל', 'כְּפִי שֶׁיַּעֲשֶׂה יוֹם אֶחָד בְּעֵמֶק הָאֵלָה');
    const stonesArea = this.groundV(L.stones.x, L.stones.z, 0.6);
    const nearestStone = () => {
      let best: THREE.Vector3 | null = null;
      let bd = Infinity;
      for (const s of this.props.stones) {
        if (s.taken) continue;
        const d = s.mesh.position.distanceTo(this.player.pos);
        if (d < bd) { bd = d; best = s.mesh.position; }
      }
      return { pos: best, dist: bd };
    };
    // far away: point at the stream bed; close by: point at the nearest remaining stone
    this.setMarker(() => {
      const n = nearestStone();
      if (!n.pos) return null;
      return this.player.pos.distanceTo(stonesArea) > 28 ? stonesArea : n.pos.clone().add(new THREE.Vector3(0, 0.9, 0));
    }, 'הַנַּחַל');
    let taken = 0;
    let picking = false;
    this.ui.counter(`חַלֻּקֵי אֲבָנִים <b>0 / 5</b>`);
    this.beh = () => {
      this.props.setStoneGlint(true, this.time);
      let near: (typeof this.props.stones)[number] | null = null;
      let best = 2.4;
      for (const s of this.props.stones) {
        if (s.taken) continue;
        const d = Math.hypot(s.mesh.position.x - this.player.pos.x, s.mesh.position.z - this.player.pos.z);
        if (d < best) { best = d; near = s; }
      }
      this.ui.prompt(near && !picking ? withLabel(K.interact, 'אֱסֹף אֶבֶן חֲלָקָה') : null);
      if (near && !picking && this.input.take('interact')) {
        picking = true;
        const st = near;
        let done = false;
        const collect = () => {
          if (done) return;
          done = true;
          st.taken = true;
          st.setVisible(false);
          taken++;
          this.audio.sfx('pickup');
          this.ui.counter(`חַלֻּקֵי אֲבָנִים <b>${taken} / 5</b>`);
          picking = false;
        };
        this.player.faceToward(st.mesh.position, 1, 100);
        this.player.model.play('pick', [{ t: 0.5, fn: collect }]);
        // fail-safe: never leave the objective stuck if the animation gets interrupted
        this.after(1.1, collect, true);
      }
    };
    await this.until(() => taken >= 5);
    this.check();
    this.props.setStoneGlint(false, 0);
    this.ui.prompt(null);
    this.ui.counter(null);
    this.audio.sfx('uiObjective');
    this.ui.verse(...verseArgs('s1_17_40_stones'), 6);
    await this.wait(2);

    // ---------------------------------------------------------------- 4. sling practice
    this.player.canSling = true;
    this.ui.objective('הִתְאַמֵּן בַּקֶּלַע', 'נַפֵּץ אֶת שְׁלֹשֶׁת הַכַּדִּים שֶׁעַל הַגָּדֵר');
    this.ui.hint([K.sling, withLabel(K.look, 'כַּוֵּן')]);
    const jarC = this.props.jars[1].center.clone().add(new THREE.Vector3(0, 0.8, 0));
    this.setMarker(jarC, 'הַכַּדִּים');
    this.jarsBroken = 0;
    this.ui.counter(`כַּדִּים <b>0 / 3</b>`);
    let lastBroken = 0;
    this.beh = () => {
      if (this.jarsBroken !== lastBroken) {
        lastBroken = this.jarsBroken;
        this.ui.counter(`כַּדִּים <b>${this.jarsBroken} / 3</b>`);
        if (this.jarsBroken === 1) this.ui.verse(...verseArgs('jdg_20_16_slingers'), 6);
      }
      // gentle coaching if throws keep missing
      if (this.player.throws === 4 && this.jarsBroken === 0) {
        this.ui.hint('<span class="h-item">טיפ: סובב את הקלע זמן רב יותר — הטבעת מתמלאת — כדי שהאבן תגיע רחוק ובקו ישר יותר</span>', 8);
        this.player.throws++;
      }
    };
    await this.until(() => this.jarsBroken >= 3);
    this.check();
    this.ui.counter(null);
    this.audio.sfx('uiObjective');
    this.player.canStrike = true;
    this.player.canDodge = true;
    this.ui.hint([K.strike, K.dodge], 9);
    await this.wait(2.5);

    // ---------------------------------------------------------------- 5. back to the flock
    this.ui.objective('חֲזֹר אֶל הָעֵדֶר', 'אַל תַּשְׁאִיר אֶת הַצֹּאן לְבַד זְמַן רַב');
    this.setMarker(() => this.flockCenter().add(new THREE.Vector3(0, 1.5, 0)), 'הַצֹּאן');
    const t0 = this.time;
    this.beh = null;
    await this.until(() => this.player.pos.distanceTo(this.flockCenter()) < 20 || this.time - t0 > 70);
    this.check();

    // ---------------------------------------------------------------- 6. the bear takes a lamb
    await this.bearAttack();
    this.check();
    // ---------------------------------------------------------------- 7. chase + strike
    await this.chase();
    this.check();
    // ---------------------------------------------------------------- 8. rescue from its mouth
    await this.rescue();
    this.check();
    // ---------------------------------------------------------------- 9. it rose against me
    await this.rise();
    this.check();
    // ---------------------------------------------------------------- 10. fight → beard → strike
    await this.fight();
    this.check();
    await this.clinch();
    this.check();
    // ---------------------------------------------------------------- 11. carry the lamb home
    await this.aftermath();
    this.check();
    await this.ending();
  }

  /** Developer shortcut (?jump=...) to test later beats directly. */
  private async debugJump(j: string) {
    this.ui.fade(0, 0.5);
    this.cinematic(false);
    this.audio.music('pastoral', 1);
    const fc = this.flockCenter();
    this.player.place(fc.x - 12, fc.z - 12, 0.7);
    this.cam.snapBehind(0.7, 0.15);
    this.player.canSling = this.player.canStrike = this.player.canDodge = true;
    if (j === 'sling') {
      this.player.place(LAYOUT.targets.x - 10, LAYOUT.targets.z - 8, 0.9);
      this.cam.snapBehind(0.9, 0.1);
      return;
    }
    await this.bearAttack();
    if (j === 'bear') { await this.chase(); await this.rescue(); await this.rise(); await this.fight(); await this.clinch(); await this.aftermath(); await this.ending(); return; }
    // fight / end: fast-forward the chase
    this.bear.hits = 3;
    const bf = new THREE.Vector3(Math.sin(this.bear.heading), 0, Math.cos(this.bear.heading));
    this.player.place(this.bear.pos.x + bf.x * 2.4, this.bear.pos.z + bf.z * 2.4, this.bear.heading + Math.PI);
    await this.rescue();
    await this.rise();
    if (j === 'fight') { await this.fight(); await this.clinch(); await this.aftermath(); await this.ending(); return; }
    await this.clinch();
    await this.aftermath();
    await this.ending();
  }

  // ============================================================================ world reset
  private resetWorld() {
    const L = LAYOUT;
    this.player.place(L.start.x + 0.2, L.start.z + 2.3, 0.46);
    this.player.health = this.player.maxHealth;
    this.player.canSling = this.player.canStrike = this.player.canDodge = false;
    this.player.carrying = false;
    this.player.model.hold = 'none';
    this.player.model.staffMode = 'plant';
    this.bear.visible = false;
    this.bear.alive = true;
    this.bear.hits = 0;
    this.bear.model.hold = 'none';
    this.bear.model.roar = 0;
    this.bear.model.lookTarget = null;
    this.bear.place(L.bearLair.x, L.bearLair.z, Math.PI);
    this.bearVulnerable = false;
    this.showBoss = false;
    this.showHealth = false;
    this.bossHP = 1;
    this.beh = null;
    this.setMarker(null);
    this.ui.objective(null);
    this.ui.counter(null);
    this.ui.prompt(null);
    this.ui.qte(null);
    this.ui.endCard(false);
    this.freeRoam = false;
    this.props.reset();
    this.jarsBroken = 0;
    this.player.throws = 0;
    const lamb = this.flock.lamb;
    if (lamb.object.parent !== this.flock.group) {
      this.flock.group.attach(lamb.object);
      lamb.object.position.set(L.pasture.x, this.engine.terrain.heightAt(L.pasture.x, L.pasture.z), L.pasture.z);
      lamb.object.rotation.set(0, 0, 0);
      lamb.setCarried('none');
    }
    this.slowTarget = 1;
    this.timeScale = 1;
  }

  // ============================================================================ intro cinematic
  private async intro() {
    const L = LAYOUT;
    this.cinematic(true);
    this.ui.skip(true);
    this.audio.music('title', 1.5);
    this.audio.ambience(0.55, 0.7, 0.45);
    this.ui.fade(0, 3);
    const g = (x: number, z: number, up: number) => this.groundV(x, z, up);
    const dav = () => this.player.pos;
    const B = L.bethlehem;
    const R = L.rachel;
    const P = L.pasture;
    const lambP = () => this.flock.lamb.position;
    const heading = this.player.heading;
    const fwd = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    const D = this.player.pos.clone();
    const shots: Shot[] = [
      // 1. over the eastern wilderness, toward the low sun and the hills of Judah
      dolly(8.5, V(640, 150, 560), V(330, 85, 300), V(-120, 20, -200), V(-230, 20, -300), 40, 36),
      // 2. low glide over terraced olive groves below Bethlehem
      dolly(7, g(B.x + 205, B.z + 150, 16), g(B.x + 150, B.z + 95, 11), g(B.x, B.z, 12), g(B.x - 10, B.z - 10, 10), 40, 36),
      // 3. Rachel's pillar on the road to Ephrath
      dolly(6.5, g(R.x + 14, R.z + 9, 2.2), g(R.x + 6, R.z + 4, 1.8), g(R.x, R.z, 2.6), g(R.x - 30, R.z - 40, 10), 38, 34),
      // 4. the flock at pasture, the little lamb
      { duration: 7, at: (u) => {
        const c = lambP();
        const a = 1.25 + u * 0.55;
        return { pos: new THREE.Vector3(c.x + Math.sin(a) * (4.2 - u * 1.5), c.y + 0.7 + u * 0.2, c.z + Math.cos(a) * (4.2 - u * 1.5)), look: c.clone().add(new THREE.Vector3(0, 0.35, 0)), fov: 34 };
      } },
      // 5. David on his rock — low-angle orbit (like a portrait)
      orbit(10, dav, 5.2, 3.2, heading - 0.95, heading - 0.1, 0.5, 1.2, 1.35, 36),
      // 6. crane up behind him to reveal the land — title
      { duration: 9.5, at: (u) => {
        const back = D.clone().addScaledVector(fwd, -(2.6 + u * 7)).add(new THREE.Vector3(0.8 + u * 2, 1.8 + u * 5.5, 0));
        const look = D.clone().addScaledVector(fwd, 30 + u * 60).add(new THREE.Vector3(0, 1.2 - u * 4, 0));
        return { pos: back, look, fov: 44 + u * 6 };
      } },
    ];
    void P;
    let t = 0;
    const cues: [number, () => void][] = [
      [1.2, () => this.ui.caption('הָרֵי יְהוּדָה', 'אֶרֶץ יִשְׂרָאֵל · בִּימֵי שָׁאוּל הַמֶּלֶךְ')],
      [9.3, () => this.ui.caption('בֵּית לֶחֶם יְהוּדָה', 'עִירוֹ שֶׁל יִשַׁי בֶּן עוֹבֵד')],
      [11.2, () => this.ui.verse(...verseArgs('s1_17_12_ephrathite'), 4.6)],
      [16.2, () => this.ui.caption('מַצֶּבֶת קְבֻרַת רָחֵל', quoteWithRefHtml('gen_35_19_rachel_buried'))],
      [22.8, () => this.ui.verse(...verseArgs('s1_16_11_youngest'), 5)],
      [29.5, () => this.ui.verse(...verseArgs('s1_16_12_ruddy'), 6)],
      [39.2, () => { this.ui.hideVerse(); this.ui.titleCard(true); this.audio.sfx('titleHit'); }],
      [46.5, () => this.ui.titleCard(false)],
    ];
    const done = this.shots(shots);
    let finished = false;
    done.then(() => (finished = true));
    this.ui.onSkip = () => this.cam.skipShots();
    let ci = 0;
    this.beh = (dt) => {
      t += dt;
      while (ci < cues.length && t >= cues[ci][0]) cues[ci++][1]();
      if (this.input.take('skip') || this.input.take('pause')) this.cam.skipShots();
      this.player.model.lookTarget = this.engine.camera.position;
    };
    await this.until(() => finished);
    this.check();
    this.beh = null;
    this.ui.skip(false);
    this.player.model.lookTarget = null;
    if (t < 44) {
      // skipped: show a short title over gameplay
      this.ui.hideVerse();
      this.ui.titleCard(true);
      if (t < 39) this.audio.sfx('titleHit');
      setTimeout(() => this.ui.titleCard(false), 4200);
    } else {
      setTimeout(() => this.ui.titleCard(false), 800);
    }
    this.cam.snapBehind(this.player.heading, 0.15);
  }

  // ============================================================================ the bear
  private async bearAttack() {
    const lamb = this.flock.lamb;
    const fc = this.flockCenter();
    const T = LAYOUT.thicket;
    const toThicket = new THREE.Vector3(T.x - fc.x, 0, T.z - fc.z).normalize();
    // the lamb has strayed a little toward the thicket
    const lambSpot = fc.clone().addScaledVector(toThicket, 11);
    lamb.goTo(lambSpot, 1.0);
    const start = fc.clone().addScaledVector(toThicket, 52);
    this.bear.place(start.x, start.z, Math.atan2(-toThicket.x, -toThicket.z));
    this.bear.visible = true;
    this.bear.model.hold = 'none';
    this.cinematic(true);
    this.audio.music('tension', 1.5);
    this.audio.ambience(0.6, 0.15, 0.0);
    const bearPos = () => this.bear.pos;
    let phase: 'stalk' | 'charge' | 'grab' | 'away' = 'stalk';
    let t = 0;
    let grabbed = false;
    this.beh = (dt) => {
      t += dt;
      const lp = lamb.position;
      if (phase === 'stalk') {
        this.bear.moveTo(lp, 1.4, dt);
        if (t > 2.2) { phase = 'charge'; this.audio.at('bearGrowl', this.bear.pos, 1); this.flock.panic(this.bear.pos); }
      } else if (phase === 'charge') {
        if (this.bear.moveTo(lamb.object.getWorldPosition(new THREE.Vector3()), 8.5, dt, 1.1)) {
          phase = 'grab';
          this.grabLamb();
          grabbed = true;
          t = 0;
        }
      } else if (phase === 'grab') {
        this.bear.stop(dt);
        if (t > 1.3) phase = 'away';
      } else {
        const away = new THREE.Vector3(T.x, 0, T.z);
        this.bear.moveTo(away, 3.5, dt);
      }
      this.bearThreats[0] = this.bear.pos;
    };
    const lambAtStart = lambSpot.clone();
    await this.shots([
      // from among the sheep toward the thicket
      { duration: 3.6, at: (u) => {
        const p = lambAtStart.clone().addScaledVector(toThicket, -6).add(new THREE.Vector3(1.5, 1.0 + u * 0.3, 0));
        return { pos: p, look: bearPos().clone().add(new THREE.Vector3(0, 0.8, 0)), fov: 40 - u * 6 };
      } },
      { duration: 3.2, at: (u) => {
        const b = bearPos();
        const side = new THREE.Vector3(-toThicket.z, 0, toThicket.x);
        return { pos: b.clone().addScaledVector(side, 5 - u).add(new THREE.Vector3(0, 0.9, 0)).addScaledVector(toThicket, 2), look: b.clone().add(new THREE.Vector3(0, 0.7, 0)), fov: 42 };
      } },
      { duration: 3.4, at: (u) => {
        const b = bearPos();
        return { pos: b.clone().add(new THREE.Vector3(0, 1.3 + u * 0.4, 0)).addScaledVector(toThicket, -3.2).add(new THREE.Vector3(-toThicket.z * 1.8, 0, toThicket.x * 1.8)), look: b.clone().add(new THREE.Vector3(0, 0.9, 0)), fov: 34 };
      } },
      // David turns — his face as he sees it
      { duration: 3.2, at: (u) => {
        const d = this.player.pos;
        const f = new THREE.Vector3(Math.sin(this.player.heading), 0, Math.cos(this.player.heading));
        return { pos: d.clone().addScaledVector(f, 1.8 - u * 0.3).add(new THREE.Vector3(0.5, 1.55, 0)), look: d.clone().add(new THREE.Vector3(0, 1.55, 0)), fov: 32 };
      } },
    ]);
    this.check();
    if (!grabbed) this.grabLamb(true);
    this.ui.verse(...verseArgs('s1_17_34_bear'), 5);
    this.player.model.lookTarget = null;
  }

  private grabLamb(force = false) {
    const lamb = this.flock.lamb;
    const sock = this.bear.model.mouthSocket;
    if (force) this.bear.place(lamb.position.x + 1, lamb.position.z + 1, this.bear.heading);
    this.bear.model.root.updateMatrixWorld(true);
    lamb.object.updateMatrixWorld(true);
    const grip = lamb.object.worldToLocal(lamb.backGrip.getWorldPosition(new THREE.Vector3()));
    sock.add(lamb.object);
    lamb.setCarried('mouth');
    lamb.object.rotation.set(0, Math.PI / 2, 0);
    lamb.object.position.copy(grip.applyEuler(lamb.object.rotation).multiplyScalar(-1));
    this.bear.model.hold = 'carry';
    this.audio.at('lambBleat', this.bear.pos, 1);
    this.audio.at('bearGrowl', this.bear.pos, 0.8);
  }

  private hitBear(at: THREE.Vector3, kind: 'sling' | 'staff') {
    if (!this.bear.alive) return;
    this.bear.hits++;
    this.audio.at(kind === 'sling' ? 'stoneHitBear' : 'staffHit', at, 1);
    this.audio.at('bearHurt', this.bear.pos, 0.9);
    this.engine.particles.dustBurst(at, 6, 0.5, new THREE.Color(0.55, 0.42, 0.3));
    if (!this.bear.model.busy) this.bear.model.play('hurt');
    this.cam.addShake(kind === 'staff' ? 0.6 : 0.25);
    this.bearHitCB?.(kind);
  }

  private onStaffImpact(tip: THREE.Vector3) {
    // jars
    for (const jar of this.props.jars) {
      if (jar.alive && tip.distanceTo(jar.center) < 0.6) {
        jar.shatter(this.player.forward);
        this.audio.at('jarShatter', jar.center, 1);
        this.jarsBroken++;
      }
    }
    if (this.bear.visible && this.bear.alive && this.bearVulnerable) {
      const pts = this.bear.model.hitPoints([]);
      let d = Infinity;
      for (const p of pts) d = Math.min(d, p.distanceTo(tip));
      const flat = Math.hypot(this.bear.pos.x - this.player.pos.x, this.bear.pos.z - this.player.pos.z);
      if (d < 1.0 || flat < 1.9) this.hitBear(tip, 'staff');
    }
  }

  // ============================================================================ chase
  private async chase() {
    const T = LAYOUT.thicket;
    const clearing = new THREE.Vector3(T.x, 0, T.z);
    this.cinematic(false);
    this.audio.music('battle', 1.2);
    this.player.canSling = this.player.canStrike = this.player.canDodge = true;
    this.cam.snapBehind(Math.atan2(this.bear.pos.x - this.player.pos.x, this.bear.pos.z - this.player.pos.z), 0.12);
    this.ui.objective('רְדֹף אַחֲרֵי הַדֹּב!', '"וְיָצָאתִי אַחֲרָיו" — הַכֵּה אוֹתוֹ בַּקֶּלַע אוֹ בַּמַּקֵּל');
    this.ui.hint([K.run, K.sling, K.strike], 8);
    this.setMarker(() => this.bear.pos.clone().add(new THREE.Vector3(0, 1.8, 0)), 'הַדֹּב');
    this.showBoss = true;
    this.showHealth = true;
    this.bearVulnerable = true;
    this.bear.hits = 0;
    let stagger = 0;
    let atBay = false;
    let swipeCD = 2.5;
    this.bearHitCB = () => {
      stagger = 0.9;
      this.bossHP = Math.max(0.62, 1 - this.bear.hits * 0.12);
    };
    this.beh = (dt) => {
      const dist = this.bear.pos.distanceTo(this.player.pos);
      if (stagger > 0) {
        stagger -= dt;
        this.bear.stop(dt);
      } else if (!atBay) {
        const sp = dist > 42 ? 1.6 : dist > 22 ? 3.8 : 4.9;
        const arrived = this.bear.moveTo(clearing, sp, dt, 2.5);
        if (arrived || this.bear.hits >= 3) {
          atBay = true;
          this.audio.at('bearGrowl', this.bear.pos, 1);
          this.ui.objective('הַכֵּה אֶת הַדֹּב', '"וְהִכִּתִיו" — הוּא נִלְכַּד בַּסְּבַךְ, וְהַשֶּׂה עֲדַיִן בְּפִיו');
        }
      } else {
        this.bear.face(this.player.pos, dt, 3);
        this.bear.stop(dt);
        this.bear.model.lookTarget = this.player.pos;
        // a warning swipe if David comes too close before landing enough blows
        swipeCD -= dt;
        if (dist < 2.4 && swipeCD < 0 && this.bear.hits < 3 && !this.bear.model.busy) {
          swipeCD = 2.2;
          this.bearSwipe('swipe', 2.6);
        }
      }
      this.bearThreats[0] = this.bear.pos;
    };
    await this.until(() => atBay && this.bear.hits >= 3 && this.bear.pos.distanceTo(this.player.pos) < 2.8);
    this.check();
  }

  /** Bear swipe with telegraph; resolves hit/miss at the strike frame. */
  private bearSwipe(kind: 'swipe' | 'swipeHigh', reach: number, onResult?: (hit: boolean) => void) {
    const hitT = kind === 'swipe' ? 0.46 : 0.5;
    this.audio.at('bearGrowl', this.bear.pos, 0.9, 1.1);
    this.bear.model.play(kind, [{
      t: hitT,
      fn: () => {
        const d = this.bear.pos.distanceTo(this.player.pos);
        const toP = new THREE.Vector3(this.player.pos.x - this.bear.pos.x, 0, this.player.pos.z - this.bear.pos.z).normalize();
        const fwd = new THREE.Vector3(Math.sin(this.bear.heading), 0, Math.cos(this.bear.heading));
        const inArc = toP.dot(fwd) > 0.2;
        let hit = false;
        this.audio.at('whoosh', this.bear.pos, 0.9, 0.7);
        if (d < reach && inArc) hit = this.player.hurt(this.bear.pos);
        if (hit) {
          this.cam.addShake(1);
          this.engine.post.grade.uniforms.uRed.value = 1;
        }
        onResult?.(hit);
      },
    }]);
    return hitT;
  }

  // ============================================================================ rescue
  private async rescue() {
    const lamb = this.flock.lamb;
    for (;;) {
      this.ui.objective('הַצֵּל אֶת הַשֶּׂה מִפִּיו', '"וְהִצַּלְתִּי מִפִּיו"');
      let go = false;
      this.beh = (dt) => {
        this.bear.face(this.player.pos, dt, 3);
        this.bear.stop(dt);
        const d = this.bear.pos.distanceTo(this.player.pos);
        this.ui.prompt(d < 3.0 ? withLabel(K.interact, 'חֲטֹף אֶת הַשֶּׂה מִפִּי הַדֹּב') : null);
        if (d < 3.0 && this.input.take('interact')) go = true;
      };
      await this.until(() => go);
      this.check();
      this.beh = null;
      this.ui.prompt(null);
      // grapple: David seizes the lamb and pulls
      this.player.controlEnabled = false;
      this.player.aiming = false;
      this.player.model.hold = 'pull';
      this.bearVulnerable = false;
      const bearF = new THREE.Vector3(Math.sin(this.bear.heading), 0, Math.cos(this.bear.heading));
      const stand = this.bear.pos.clone().addScaledVector(bearF, 1.45);
      let prog = 0.15;
      let time = 0;
      this.ui.letterbox(true);
      this.beh = (dt) => {
        time += dt;
        this.player.moveToward(stand, 2, dt, 0.1);
        this.player.faceToward(this.bear.pos, dt, 12);
        this.bear.stop(dt);
        this.bear.model.lookTarget = this.player.pos;
        // the bear thrashes its head
        this.bear.heading += Math.sin(time * 9) * 0.6 * dt;
        prog = Math.max(0, prog - dt * 0.12);
        if (this.input.take('interact')) {
          prog += 0.09;
          this.audio.sfx('davidEffort', { volume: 0.6, pitch: 0.9 + Math.random() * 0.3 });
          this.cam.addShake(0.15);
        }
        this.ui.qte('mash', clamp(prog, 0, 1), 'מְשֹׁךְ אֶת הַשֶּׂה!', K.interact);
      };
      this.cam.playShots([{ duration: 30, ease: false, at: (_u, tt) => {
        const side = new THREE.Vector3(-bearF.z, 0, bearF.x);
        const mid = this.player.pos.clone().lerp(this.bear.pos, 0.45);
        return { pos: mid.clone().addScaledVector(side, 3.2).add(new THREE.Vector3(0, 1.1 + Math.sin(tt * 0.5) * 0.1, 0)).addScaledVector(bearF, 0.4), look: mid.clone().add(new THREE.Vector3(0, 0.8, 0)), fov: 38 };
      } }]);
      await this.until(() => prog >= 1 || time > 6.5);
      this.check();
      this.beh = null;
      this.ui.qte(null);
      if (prog >= 1) {
        this.ui.flashQte(true);
        // free the lamb
        const w = lamb.object.getWorldPosition(new THREE.Vector3());
        this.flock.group.attach(lamb.object);
        lamb.object.position.set(w.x, this.engine.terrain.heightAt(w.x, w.z), w.z);
        lamb.object.rotation.set(0, this.player.heading, 0);
        lamb.setCarried('none');
        const flee = this.player.pos.clone().addScaledVector(bearF, 7).add(new THREE.Vector3(2, 0, -1));
        lamb.goTo(flee, 2.6);
        this.lambHome.copy(flee);
        this.bear.model.hold = 'none';
        this.player.model.hold = 'none';
        this.audio.at('lambBleat', w, 1);
        this.audio.at('bearHurt', this.bear.pos, 1);
        this.ui.verse(...verseArgs('s1_17_35_smote_delivered'), 4);
        this.bossHP = 0.55;
        this.cam.skipShots();
        await this.wait(0.8);
        this.check();
        break;
      } else {
        // failed: the bear shakes free and swipes
        this.player.model.hold = 'none';
        this.cam.skipShots();
        this.ui.letterbox(false);
        this.player.controlEnabled = true;
        this.bearVulnerable = true;
        this.player.hurt(this.bear.pos);
        this.cam.addShake(0.8);
        this.engine.post.grade.uniforms.uRed.value = 1;
        this.ui.hint('<span class="h-item">לחץ מהר יותר כדי לחלץ את השה</span>', 4);
        if (this.player.health <= 0) this.player.health = this.player.maxHealth;
        await this.wait(1.5);
        this.check();
      }
    }
  }

  // ============================================================================ "and it rose against me"
  private async rise() {
    this.cinematic(true);
    this.bearVulnerable = false;
    this.player.model.lookTarget = this.bear.model.headCenter.getWorldPosition(new THREE.Vector3());
    const bearF = new THREE.Vector3(Math.sin(this.bear.heading), 0, Math.cos(this.bear.heading));
    // put a little space between them
    const stand = this.bear.pos.clone().addScaledVector(bearF, 3.2);
    this.bear.model.hold = 'rear';
    this.audio.music('silence', 0.6);
    let t = 0;
    this.beh = (dt) => {
      t += dt;
      this.player.moveToward(stand, 2.4, dt, 0.2);
      this.player.faceToward(this.bear.pos, dt, 10);
      this.bear.face(this.player.pos, dt, 3);
      this.bear.stop(dt);
      this.bear.model.roar = t > 1.0 && t < 3.6 ? Math.min(1, (t - 1.0) * 2) : damp(this.bear.model.roar, 0, 4, dt);
      if (t > 1.0 && t < 1.05) {
        this.audio.at('bearRoar', this.bear.pos, 1.2);
        this.cam.addShake(0.9);
        this.slowMo(0.45);
        this.audio.sfx('heartbeat', { volume: 0.8 });
      }
      if (t > 3.6 && this.slowTarget < 1) this.slowMo(1);
      this.player.model.lookTarget = this.bear.model.headCenter.getWorldPosition(new THREE.Vector3());
    };
    const bp = () => this.bear.pos;
    await this.shots([
      { duration: 5.4, at: (u) => {
        const b = bp();
        const side = new THREE.Vector3(-bearF.z, 0, bearF.x);
        const pos = b.clone().addScaledVector(bearF, 5.2 - u * 0.8).addScaledVector(side, 1.3).add(new THREE.Vector3(0, 0.45, 0));
        return { pos, look: b.clone().add(new THREE.Vector3(0, 1.4 + u * 0.4, 0)), fov: 42 - u * 4 };
      } },
    ]);
    this.check();
    this.ui.verse(...verseArgs('s1_17_35_rose'), 3.5);
    this.slowMo(1);
    this.audio.music('battle', 0.5);
  }

  // ============================================================================ fight
  private async fight() {
    this.cinematic(false);
    this.cam.snapBehind(Math.atan2(this.bear.pos.x - this.player.pos.x, this.bear.pos.z - this.player.pos.z), 0.05);
    this.player.canSling = this.player.canStrike = this.player.canDodge = true;
    this.bearVulnerable = true;
    this.ui.objective('עֲמֹד מוּלוֹ', 'הִתְחַמֵּק מִמַּכּוֹתָיו — וְחַכֵּה לְרֶגַע שֶׁיְּאַבֵּד שִׁוּוּי מִשְׁקָל');
    this.ui.hint([K.dodge, K.strike], 8);
    this.setMarker(null);
    let dodges = 0;
    let cd = 1.8;
    let opening = false;
    let openT = 0;
    let grabbed = false;
    let evadeWindow = 0;
    this.bearHitCB = (kind) => {
      if (kind === 'staff') dodges++;
    };
    const onDodge = () => {
      if (evadeWindow > 0) {
        dodges++;
        evadeWindow = 0;
        this.ui.flashQte(true);
      }
    };
    this.player.onDodge = onDodge;
    this.beh = (dt) => {
      const dist = this.bear.pos.distanceTo(this.player.pos);
      this.bear.model.lookTarget = this.player.pos;
      evadeWindow = Math.max(0, evadeWindow - dt);
      if (!opening) {
        this.bear.face(this.player.pos, dt, 2.5);
        // lumbers after David on its hind legs; drops its pace only when close
        if (dist > 2.3 && !this.bear.model.busy) this.bear.moveTo(this.player.pos, dist > 7 ? 3.4 : dist > 4 ? 2.2 : 1.2, dt, 2.2);
        else this.bear.stop(dt);
        cd -= dt;
        if (cd < 0 && dist < 3.6 && !this.bear.model.busy) {
          cd = 2.3 + Math.random() * 0.9;
          evadeWindow = 0.62;
          this.ui.qte('press', 0, 'הִתְחַמֵּק!', K.dodge);
          const hitT = this.bearSwipe('swipeHigh', 2.9, (hit) => {
            this.ui.qte(null);
            if (!hit && this.bear.pos.distanceTo(this.player.pos) < 4.2) {
              // missed David — counts as an evasion
              if (evadeWindow <= 0) return;
              dodges++;
              evadeWindow = 0;
            }
          });
          void hitT;
        }
        if (this.player.health <= 0) {
          // David is knocked down — rise again
          this.player.health = this.player.maxHealth;
          this.ui.verse(...verseArgs('ps_23_1_shepherd'), 3);
          this.player.model.play('hurt');
          dodges = Math.max(0, dodges - 1);
        }
        if (dodges >= 2 && !this.bear.model.busy) {
          opening = true;
          openT = 0;
          this.slowMo(0.3);
          this.audio.at('bearHurt', this.bear.pos, 1, 0.8);
          this.bear.model.play('hurt');
        }
      } else {
        openT += dt / Math.max(0.3, this.timeScale);
        this.bear.stop(dt);
        const close = dist < 3.8;
        this.ui.qte('press', 0, close ? 'תְּפֹס בִּזְקָנוֹ!' : 'הִתְקָרֵב — וּתְפֹס בִּזְקָנוֹ!', K.interact);
        if (this.input.take('interact') && close) grabbed = true;
        if (openT > 3.2 && !grabbed) {
          opening = false;
          dodges = 0;
          cd = 1.2;
          this.slowMo(1);
          this.ui.qte(null);
        }
      }
      this.showBoss = true;
    };
    await this.until(() => grabbed);
    this.check();
    this.player.onDodge = undefined;
    this.ui.qte(null);
  }

  // ============================================================================ "I caught it by its beard, struck it and killed it"
  private async clinch() {
    this.cinematic(true);
    this.slowMo(1);
    this.player.canSling = false;
    this.player.aiming = false;
    this.player.model.hold = 'grab';
    this.player.model.staffMode = 'strike';
    this.bear.model.hold = 'rear';
    this.bearVulnerable = false;
    this.ui.verse(...verseArgs('s1_17_35_beard'), 3.5);
    this.audio.sfx('grab');
    this.audio.at('bearRoar', this.bear.pos, 1, 1.1);
    const bearF = () => new THREE.Vector3(Math.sin(this.bear.heading), 0, Math.cos(this.bear.heading));
    let strikes = 0;
    let ringT = -0.8;
    const ringDur = 1.15;
    let resolved = false;
    this.beh = (dt) => {
      const stand = this.bear.pos.clone().addScaledVector(bearF(), 0.95);
      this.player.moveToward(stand, 3, dt, 0.08);
      this.player.faceToward(this.bear.pos, dt, 14);
      this.bear.face(this.player.pos, dt, 4);
      this.bear.stop(dt);
      this.bear.model.roar = 0.25 + Math.sin(this.time * 7) * 0.15;
      this.player.model.lookTarget = this.bear.model.headCenter.getWorldPosition(new THREE.Vector3());
      ringT += dt;
      if (ringT >= 0 && !resolved) {
        const u = clamp(1 - ringT / ringDur, -0.3, 1);
        this.ui.qte('timing', Math.max(0, u), 'הַכֵּה!', withLabel(K.strike, ''));
        const pressed = this.input.take('strike') || this.input.take('sling');
        if (pressed || u <= -0.25) {
          resolved = true;
          const good = pressed && u < 0.2 && u > -0.25;
          this.ui.flashQte(good);
          if (good) {
            strikes++;
            this.player.model.play('strikeHigh', [{
              t: 0.27,
              fn: () => {
                this.audio.at('staffHit', this.bear.pos, 1.2);
                this.audio.at('bearHurt', this.bear.pos, 1);
                this.bear.model.play('hurt');
                this.cam.addShake(1.1);
                this.slowMo(0.25);
                this.after(0.38, () => this.slowMo(1), true);
                this.bossHP = Math.max(0, 0.55 - strikes * 0.185);
                this.engine.particles.dustBurst(this.bear.model.headCenter.getWorldPosition(new THREE.Vector3()), 8, 0.6, new THREE.Color(0.6, 0.45, 0.3));
              },
            }]);
          } else {
            this.bear.model.play('hurt');
            this.cam.addShake(0.4);
          }
          this.after(0.7, () => {
            resolved = false;
            ringT = -0.55;
          }, true);
        }
      }
    };
    const side = () => new THREE.Vector3(-bearF().z, 0, bearF().x);
    this.cam.playShots([{ duration: 60, ease: false, at: (_u, tt) => {
      const mid = this.player.pos.clone().lerp(this.bear.pos, 0.5);
      const a = Math.sin(tt * 0.25) * 0.5;
      const s = side().multiplyScalar(Math.cos(a) * 3.4).addScaledVector(bearF(), Math.sin(a) * 3.4 + 1.2);
      return { pos: mid.clone().add(s).add(new THREE.Vector3(0, 1.0, 0)), look: mid.clone().add(new THREE.Vector3(0, 1.45, 0)), fov: 40 };
    } }]);
    await this.until(() => strikes >= 3 && !this.player.model.busy);
    this.check();
    this.ui.qte(null);
    this.beh = null;
    // death
    this.bear.alive = false;
    this.bear.model.roar = 0;
    this.bear.model.hold = 'down';
    this.player.model.hold = 'none';
    this.player.model.staffMode = 'plant';
    this.player.model.lookTarget = this.bear.pos.clone().add(new THREE.Vector3(0, 0.3, 0));
    this.audio.at('bearDeath', this.bear.pos, 1.1);
    this.slowMo(0.4);
    this.ui.verse(...verseArgs('s1_17_35_slew'), 5);
    this.bossHP = 0;
    this.cam.skipShots();
    await this.wait(0.05);
    const bp = this.bear.pos.clone();
    const dp = this.player.pos.clone();
    const mid = bp.clone().lerp(dp, 0.5);
    await this.shots([orbit(5.5, () => mid, 5.5, 4.2, this.bear.heading + 1.9, this.bear.heading + 1.2, 1.6, 2.4, 0.6, 40)]);
    this.check();
    this.slowMo(1);
    this.engine.particles.dustBurst(bp, 18, 1.2);
    this.showBoss = false;
    this.showHealth = false;
    this.audio.music('victory', 3);
    this.audio.ambience(0.5, 0.4, 0.2);
  }

  // ============================================================================ aftermath
  private async aftermath() {
    const lamb = this.flock.lamb;
    this.cinematic(false);
    this.player.canSling = this.player.canStrike = this.player.canDodge = false;
    this.ui.objective('הָרֵם אֶת הַשֶּׂה', 'הוּא רוֹעֵד מִפַּחַד — שָׂא אוֹתוֹ עַל כְּתֵפֶיךָ');
    this.setMarker(() => lamb.position.clone().add(new THREE.Vector3(0, 1.0, 0)), 'הַשֶּׂה');
    let lifted = false;
    this.beh = () => {
      if (lamb.state !== 'carried' && lamb.position.distanceTo(this.player.pos) > 6 && Math.random() < 0.01) lamb.goTo(this.lambHome, 0.6);
      const d = Math.hypot(lamb.position.x - this.player.pos.x, lamb.position.z - this.player.pos.z);
      this.ui.prompt(d < 1.9 ? withLabel(K.interact, 'הָרֵם אֶת הַשֶּׂה') : null);
      if (d < 1.9 && this.input.take('interact')) lifted = true;
    };
    await this.until(() => lifted);
    this.check();
    this.ui.prompt(null);
    this.player.model.play('pick', [{
      t: 0.5,
      fn: () => {
        this.player.model.root.updateMatrixWorld(true);
        lamb.object.updateMatrixWorld(true);
        const c = lamb.object.worldToLocal(lamb.bodyCenter.getWorldPosition(new THREE.Vector3()));
        this.player.model.shoulderSocket.add(lamb.object);
        lamb.setCarried('shoulders');
        lamb.object.rotation.set(0, 0, 0);
        lamb.object.position.copy(c.multiplyScalar(-1));
        this.player.carrying = true;
        this.player.model.hold = 'carry';
        this.audio.sfx('lambBleat', { volume: 0.6 });
      },
    }]);
    await this.wait(1.0);
    this.check();
    this.ui.objective('הָשֵׁב אֶת הַשֶּׂה אֶל הָעֵדֶר');
    this.setMarker(() => this.flockCenter().add(new THREE.Vector3(0, 1.5, 0)), 'הָעֵדֶר');
    this.beh = null;
    await this.until(() => this.player.pos.distanceTo(this.flockCenter()) < 9);
    this.check();
  }

  private async ending() {
    const lamb = this.flock.lamb;
    this.cinematic(true);
    this.setMarker(null);
    this.ui.objective(null);
    let t = 0;
    let setDown = false;
    this.beh = (dt) => {
      t += dt;
      this.player.speed = 0;
      if (t > 1.2 && !setDown) {
        setDown = true;
        const w = lamb.object.getWorldPosition(new THREE.Vector3());
        this.flock.group.attach(lamb.object);
        const f = this.player.forward;
        const p = this.player.pos.clone().addScaledVector(f, 1.1);
        lamb.object.position.set(p.x, this.engine.terrain.heightAt(p.x, p.z), p.z);
        lamb.object.rotation.set(0, this.player.heading, 0);
        lamb.setCarried('none');
        void w;
        this.player.carrying = false;
        this.player.model.hold = 'none';
        lamb.goTo(this.flockCenter(), 0.7);
        this.audio.sfx('lambBleat', { volume: 0.5 });
      }
      if (t > 3.4) this.player.model.hold = 'thanks';
    };
    const D = this.player.pos.clone();
    const f = this.player.forward;
    const setSunLower = () => {
      this.engine.sky.setSun(SUN.endElevation, SUN.azimuth, this.engine.scene);
    };
    this.after(0.6, setSunLower);
    const cues: [number, () => void][] = [
      [4.0, () => this.ui.verse(...verseArgs('s1_17_37_delivered_me'), 6.5)],
      [11.5, () => this.ui.verse(...verseArgs('ps_23_4_rod_staff'), 7)],
    ];
    let ci = 0;
    const prevBeh = this.beh;
    this.beh = (dt) => {
      prevBeh?.(dt);
      while (ci < cues.length && t >= cues[ci][0]) cues[ci++][1]();
    };
    await this.shots([
      orbit(6, () => D, 4.2, 3.2, this.player.heading + 2.4, this.player.heading + 1.4, 1.2, 1.4, 1.3, 36),
      { duration: 12, at: (u) => {
        const pos = D.clone().addScaledVector(f, 5 + u * 18).add(new THREE.Vector3(-3 - u * 10, 2 + u * 16, 0));
        return { pos, look: D.clone().add(new THREE.Vector3(0, 1.2 - u * 2, 0)), fov: 40 + u * 10 };
      } },
    ]);
    this.check();
    this.ui.fade(1, 2.5);
    await this.wait(2.8);
    this.check();
    this.audio.music('title', 2);
    this.ui.endCard(true, () => {
      this.ui.endCard(false);
      this.engine.sky.setSun(SUN.elevation, SUN.azimuth, this.engine.scene);
      this.start(true);
    }, () => {
      this.ui.endCard(false);
      this.freeRoam = true;
      this.cinematic(false);
      this.ui.fade(0, 2);
      this.cam.snapBehind(this.player.heading, 0.15);
      this.player.canSling = this.player.canStrike = this.player.canDodge = true;
      this.ui.objective('שׁוֹטֵט בְּשָׂדוֹת בֵּית לֶחֶם', 'הַפֶּרֶק הַבָּא יַגִּיעַ בְּקָרוֹב');
      this.audio.music('pastoral', 4);
      this.audio.ambience(0.45, 0.5, 0.2);
    });
    this.beh = null;
  }

  // ============================================================================ per-frame
  update(rawDt: number) {
    // slow motion
    this.timeScale = damp(this.timeScale, this.slowTarget, 6, rawDt);
    const dt = rawDt * this.timeScale;
    this.time += dt;
    this.realTime += rawDt;
    if (this.timers.length) {
      const due = this.timers.filter((t) => t.gen === this.gen && (t.real ? this.realTime : this.time) >= t.at);
      this.timers = this.timers.filter((t) => t.gen === this.gen && !due.includes(t));
      for (const t of due) t.fn();
    }
    this.audio.slowMo(clamp((1 - this.timeScale) * 1.4, 0, 1));
    // resolve waits
    const ready = this.waits.filter((w) => w.gen === this.gen && w.until());
    if (ready.length) {
      this.waits = this.waits.filter((w) => !ready.includes(w));
      for (const w of ready) w.resolve();
    }
    this.beh?.(dt);
    // HUD
    const mp = this.markerFn ? this.markerFn() : this.markerPos;
    this.ui.marker(this.engine.camera, this.cam.inCinematic ? null : mp, this.markerLabel);
    this.ui.crosshair(this.player.aiming && !this.cam.inCinematic, this.player.power, this.player.aimOnTarget, this.player.aimInRange);
    this.ui.health(this.showHealth && !this.cam.inCinematic, this.player.health, this.player.maxHealth);
    this.ui.boss(this.showBoss, this.bossHP);
    const red = this.engine.post.grade.uniforms.uRed;
    red.value = damp(red.value, this.showHealth && this.player.health === 1 ? 0.35 + Math.sin(this.time * 4) * 0.1 : 0, 3, rawDt);
    this.engine.post.grade.uniforms.uDesat.value = (1 - this.timeScale) * 0.35;
    // bounds warning
    if (this.player.outOfBounds > 0 && !this.cam.inCinematic) this.ui.hint('<span class="h-item">הַצֹּאן זְקוּקִים לְךָ — חֲזֹר אֶל הַמִּרְעֶה</span>', 2);
    // shared pushers for grass
    const pu = shared.uPushers.value;
    pu[0].set(this.player.pos.x, this.player.pos.y, this.player.pos.z, 0.7);
    if (this.bear.visible) pu[1].set(this.bear.pos.x, this.bear.pos.y, this.bear.pos.z, 1.3);
    else pu[1].set(0, -999, 0, 0);
    const lp = this.flock.lamb.position;
    pu[2].set(lp.x, lp.y, lp.z, 0.4);
    return dt;
  }

  get threats() {
    return this.bear.visible && this.bear.alive && this.bear.model.hold !== 'carry' ? [this.bear.pos] : this.bear.visible && this.bear.alive ? [this.bear.pos] : [];
  }

  get lamb(): Animal {
    return this.flock.lamb;
  }
}
