import * as THREE from 'three';
import type { Engine } from '../core/Engine';
import type { Input } from '../core/Input';
import { clamp, damp } from '../core/noise';
import { shared } from '../core/Shared';
import type { UI, KeyHint } from '../ui/UI';
import type { Animal, Flock } from '../characters/Flock';
import { CameraRig, orbit, type Shot } from './CameraRig';
import type { Player } from './Player';
import type { BearActor } from './BearActor';
import type { Props, Candidate } from './Props';
import type { Projectiles, ShotInfo } from './Projectiles';
import type { GameAudio } from './GameAudio';
import type { SfxName } from '../audio/AudioEngine';
import { Range, ROUNDS, type RoundStats } from './Range';
import { STONE_BEATS, THROW_RELEASE } from '../characters/DavidModel';
import { Intro } from './Intro';
import { BearHook } from './BearHook';
import { BearFight, FightBot, type FightResult } from './BearFight';
import { BEAR_MOVES } from '../characters/BearModel';
import { LAYOUT, SUN } from '../world/Layout';
import { quoteText, sourceRef, verseArgs } from '../content/sources';

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
  /** the bear's hook (CUT v4: the opening film's thicket and eyes open the bear's attack) */
  private hook: BearHook | null = null;

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
    // (play1) the sling's targets: the range (src/gameplay/Range.ts) registers its own jars, gourds, the cord and its
    // solids when it is built (lazily, at the stones objective); every release is read out on the reticle, and while
    // a round is live a miss says where the stone went (high / low / left / right)
    player.onShot = (shot) => {
      const kind = shot.perfect ? 'perfect' : shot.sweet ? 'sweet' : shot.timing < 0 ? 'early' : 'late';
      this.ui.slingRelease(kind, shot.timing);
      this.range?.onShot(shot);
    };
    player.onNoStones = () => this.ui.hint('<span class="h-item rh">הַיַּלְקוּט רֵיק — מַלֵּא אוֹתוֹ מֵעֲרֵמַת הָאֲבָנִים שֶׁלְּיַד סִמַּן הַקְּלִיעָה, אוֹ בַּנַּחַל</span>', 4);
    projectiles.onResolve = (shot) => this.onShotResolved(shot);
    if (new URLSearchParams(location.search).get('jump') === 'stones') this.jump = 'stones';
    // bear hit zones
    const pts: THREE.Vector3[] = [];
    const zone = (i: number, r: number) => ({
      id: 'bear',
      center: () => this.bear.model.hitPoints(pts)[i],
      radius: r,
      enabled: () => this.bear.visible && this.bear.alive && this.bearVulnerable,
      // (bear1) zone 2 is the head, 0 the hindquarters, 1 the chest
      onHit: (at: THREE.Vector3) => this.hitBear(at, 'sling', i === 2 ? 'head' : i === 0 ? 'rump' : 'body'),
    });
    projectiles.targets.push(zone(1, 0.55), zone(2, 0.32), zone(0, 0.5));
    projectiles.onGroundHit = (at, speed, material) => {
      if (speed > 6) {
        // (play1) a stone on rock / wood / earth
        const n = material === 'rock' ? 'stoneOnRock' : material === 'wood' ? 'stoneOnWood' : 'stoneOnEarth';
        this.audio.at(n as SfxName, at, 0.8);
        // at the range a miss must show where it came down, from the aim lens 20-35 m away: a bigger, paler puff
        if (this.practicing) this.engine.particles.dustBurst(at, material === 'earth' ? 14 : 9, material === 'earth' ? 1.2 : 0.8, _dustPale);
        else this.engine.particles.dustBurst(at, material === 'earth' ? 6 : 4, material === 'earth' ? 0.7 : 0.45);
      }
    };
    player.onStrikeImpact = (tip, _fwd, kind) => this.onStaffImpact(tip, kind);
  }

  jarsBroken = 0;
  bearVulnerable = false;
  private bearHitCB: ((kind: 'sling' | 'staff', zone: 'head' | 'rump' | 'body', at: THREE.Vector3) => void) | null = null;
  /** (bear1) the fight in progress (BearFight: the bear's moves, David's counters, fatigue) */
  fightRun: BearFight | null = null;
  /** (bear1) test bots for the fight (?bot=careful|average|careless) and the stats of the last fights */
  private bot: FightBot | null = null;
  readonly fightLog: { attempt: number; result: string; time: number; fatigue: number; counters: number; knockdowns: number; stats: unknown }[] = [];

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
  jump: '' | 'sling' | 'bear' | 'fight' | 'end' | 'stones' = '';

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
    let introSkipped = false;
    if (!skipIntro) introSkipped = await this.intro();
    else {
      this.cam.stop();
      this.ui.fade(0, 1.5);
      this.cam.snapBehind(this.player.heading, 0.15);
    }
    this.check();

    // (cut8, CUT v5) the film ends with David AMONG his flock (D4: the lamb back with its ewe, the flock grazing round
    // him), so the chapter goes on from there: 1. call the flock; 2. lead it down to the stream bed — where the five
    // smooth stones begin (play1). No objective that the film has already fulfilled.
    // ---------------------------------------------------------------- 1. call the flock
    this.cinematic(false);
    // after a skipped film the score's title statement plays under the title card first
    if (introSkipped) this.after(3.4, () => this.audio.music('pastoral', 4), true);
    else this.audio.music('pastoral', 4);
    this.ui.objective('קְרָא לַצֹּאן', 'אֱסֹף אֶת הָעֵדֶר אֵלֶיךָ');
    this.ui.hint([K.call, K.move, K.look]);
    this.setMarker(null);
    let calls = 0;
    const callFlock = () => {
      calls++;
      this.player.model.play('call');
      this.audio.sfx('shepherdCall', { volume: 0.9 });
      this.after(0.35, () => this.flock.call(this.player.pos));
    };
    this.beh = () => {
      if (calls === 0 && this.input.take('call')) callFlock();
    };
    await this.until(() => calls > 0);
    this.check();
    this.ui.hint(null);
    this.audio.sfx('uiObjective');
    await this.wait(1.6);
    this.check();

    // ---------------------------------------------------------------- 2. lead the flock down to the stream bed
    // (Ex 3:1 "וַיִּנְהַג אֶת־הַצֹּאן": the flock follows its shepherd — Flock.call keeps it following while he walks; a
    // second call gathers the stragglers; when he reaches the stream bed the pasture moves to the wadi's meadow)
    const wadi = this.groundV(L.stones.x + 14, L.stones.z - 16, 0);
    this.ui.objective('נְהַג אֶת הַצֹּאן אֶל הַנַּחַל', 'הָעֵדֶר הוֹלֵךְ אַחֲרֶיךָ — קְרָא שׁוּב אִם יִתְפַּזֵּר');
    this.ui.hint([K.move, K.run, K.call], 10);
    this.setMarker(() => wadi.clone().add(new THREE.Vector3(0, 1.4, 0)), 'הַנַּחַל');
    let arrivedT = -1;
    let told = false;
    this.beh = () => {
      if (this.input.take('call')) callFlock();
      // the flock keeps following while he leads it (a call lasts ~13 s; refreshed while he walks on with it)
      if (calls > 0 && Math.hypot(this.player.pos.x - wadi.x, this.player.pos.z - wadi.z) > 26 && this.flock.countNear(this.player.pos, 14) >= 4) {
        for (const a of this.flock.animals) if (a.state === 'follow') a.followT = Math.max(a.followT, 4);
      }
      if (!told && this.time > 0) {
        told = true;
        this.after(2.5, () => this.ui.toast('מִדְרָשׁ', `${quoteText('shr_2_2_flock')}<small>${sourceRef('shr_2_2_flock')}</small>`, 16));
      }
      const atWadi = Math.hypot(this.player.pos.x - wadi.x, this.player.pos.z - wadi.z) < 26;
      if (atWadi && arrivedT < 0) arrivedT = this.time;
    };
    await this.until(() => arrivedT >= 0 && (this.flock.countNear(this.player.pos, 20) >= 3 || this.time - arrivedT > 40));
    this.check();
    // the flock grazes on the wadi's bank while he chooses his stones
    this.flock.setPasture(wadi.clone().add(new THREE.Vector3(10, 0, -8)), 20);
    this.setMarker(null);
    this.ui.hint(null);
    this.audio.sfx('uiObjective');
    await this.wait(1.2);
    this.check();

    // ---------------------------------------------------------------- 3. five smooth stones (play1)
    void L;
    await this.stonesObjective();
    this.check();
    // ---------------------------------------------------------------- 4. sling practice (play1)
    await this.practiceObjective();
    this.check();
    // ---------------------------------------------------------------- 5. back to the flock (play1)
    await this.returnObjective();
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

  // ============================================================================ (play1) objectives 3-5
  // the five smooth stones, the sling practice, back to the flock (docs/gameplay-v2.md §2-3); helpers below
  private range: Range | null = null;
  /** a round of the range is being played (the practice or a replay) */
  private practicing = false;
  /** after the practice the range can be played again from its mark (back to the flock; free roam) */
  private rangeOpen = false;
  private rangePrompt = false;
  private pickMove: ((dt: number) => void) | null = null;
  private followShot: ShotInfo | null = null;
  private followT = 0;
  private static readonly GOOD_LINES = ['חָלָק וְעָגֹל', 'זֶה יָעוּף יָשָׁר', 'חַלּוּק טוֹב'];
  private static readonly REJECT_LINES: Record<string, string> = { flat: 'שָׁטוּחַ מִדַּי', rough: 'לֹא חָלָק דַּיּוֹ', angular: 'חַד וְשָׁבוּר', smooth: '' };

  /** the sling range (built lazily: small steps, a frame between them) */
  private ensureRange() {
    if (!this.range) {
      this.range = new Range(this.engine, this.projectiles, {
        slowMo: (s, sec) => {
          this.slowMo(s);
          this.after(sec, () => this.slowMo(1), true);
        },
        shake: (a) => this.cam.addShake(a),
        sfx: (n, v, p) => this.player.sfx(n, v, p),
        sfxAt: (n, at, v, p) => this.audio.at(n as SfxName, at, v ?? 1, p ?? 1),
        hitMarker: (s) => this.ui.hitMarker(s),
        praise: (t) => this.ui.praise(t),
        followStone: (shot) => this.followStone(shot),
        later: (s, fn) => this.after(s, fn, true),
      }, this.props.jars);
      this.props.group.add(this.range.group);
    }
    return this.range;
  }

  private atStation() {
    const R = this.range;
    return !!R && Math.hypot(this.player.pos.x - R.station.x, this.player.pos.z - R.station.z) < 2.6;
  }

  /** 3. "וַיִּבְחַר־לוֹ חֲמִשָּׁה חַלֻּקֵי־אֲבָנִים מִן־הַנַּחַל" — he chooses them: only good stones count */
  private async stonesObjective() {
    const L = LAYOUT;
    const bed = this.props.bed;
    const tier = this.engine.quality.tier;
    void this.props.buildBed(tier === 'mobile-low' ? 0.45 : tier === 'mobile-high' ? 0.65 : tier === 'desktop-medium' ? 0.8 : 1);
    // the range is set up meanwhile, in the background
    void this.ensureRange().build();
    this.range?.stop();
    this.practicing = this.rangeOpen = false;
    this.player.canSling = false;
    // the shepherd's bag is empty until he chooses his stones
    this.player.bag.smooth = this.player.bag.plain = 0;
    this.player.bag.preferSmooth = false;
    this.ui.objective('בְּחַר חָמֵשׁ אֲבָנִים לַקֶּלַע בַּנַּחַל', 'רַק חֲלָקוֹת וַעֲגֻלּוֹת, שֶׁהַמַּיִם לִטְּשׁוּ — כְּפִי שֶׁיַּעֲשֶׂה יוֹם אֶחָד בְּעֵמֶק הָאֵלָה');
    const bedPos = this.groundV(L.stones.x, L.stones.z, 0.6);
    const bedMarker = () => (Math.hypot(this.player.pos.x - bedPos.x, this.player.pos.z - bedPos.z) > 10 ? bedPos : null);
    this.setMarker(bedMarker, 'הַנַּחַל');
    let taken = 0, busy = false, searchT = 0, hinted = 0;
    const count = () => this.ui.counter(`חַלֻּקֵי אֲבָנִים <b>${taken} / 5</b>`);
    count();
    this.beh = (dt) => {
      const inBed = Math.hypot(this.player.pos.x - bedPos.x, this.player.pos.z - bedPos.z) < 15;
      bed.update(inBed ? this.player.pos : null, this.time);
      this.pickMove?.(dt);
      if (!bed.built || busy) {
        this.ui.prompt(null);
        return;
      }
      if (inBed) searchT += dt;
      // a gentle hint after a long search; later the nearest good stone is pointed at for a few seconds
      if (searchT > 40 && hinted === 0) {
        hinted = 1;
        this.ui.hint('<span class="h-item">חַפֵּשׂ חַלּוּקִים עֲגֻלִּים וּמַבְרִיקִים — לְיַד הַמַּיִם הֵם הַחֲלָקִים בְּיוֹתֵר</span>', 9);
      }
      if (searchT > 80 && hinted === 1) {
        hinted = 2;
        const g = bed.nearestGood(this.player.pos);
        if (g) {
          this.setMarker(g.pos.clone().add(new THREE.Vector3(0, 0.45, 0)), '');
          this.after(6, () => this.setMarker(bedMarker, 'הַנַּחַל'));
        }
      }
      const c = bed.nearest(this.player.pos, this.player.forward, 1.45);
      this.ui.prompt(c ? withLabel(K.interact, 'בְּחַן אֶת הָאֶבֶן') : null);
      this.player.model.lookTarget = c ? c.pos : null;
      if (c && this.input.take('interact') && !this.player.model.busy) {
        busy = true;
        this.ui.prompt(null);
        void this.pickStone(c).then((good) => {
          busy = false;
          if (good) {
            taken++;
            searchT = 0;
            count();
          }
        });
      }
    };
    await this.until(() => taken >= 5 && !busy);
    this.check();
    this.beh = null;
    this.player.model.lookTarget = null;
    this.ui.prompt(null);
    this.ui.counter(null);
    this.setMarker(null);
    this.audio.sfx('uiObjective');
    this.ui.verse(...verseArgs('s1_17_40_stones'), 6);
    await this.wait(2);
  }

  /**
   * One stone examined (≈1.6-2 s): he steps to it, goes down on one knee, reaches into the gravel (or the trickle),
   * lifts it and turns it in his fingers; a smooth one is rubbed clean and goes into the bag (the flap lifts); a
   * flat / rough / broken one is tossed back with a word. Resolves true for a good stone.
   */
  private pickStone(c: Candidate): Promise<boolean> {
    const p = this.player, m = p.model, bed = this.props.bed;
    const good = c.kind === 'smooth';
    p.stowSling(true);
    p.controlEnabled = false;
    this.cam.close = 1;
    // kneel at arm's length: the stone ≈0.5 m ahead of him, a little to his right
    const to = new THREE.Vector3(c.pos.x - p.pos.x, 0, c.pos.z - p.pos.z);
    if (to.lengthSq() < 1e-4) to.copy(p.forward);
    to.normalize();
    const right = new THREE.Vector3(-to.z, 0, to.x);
    const spot = c.pos.clone().addScaledVector(to, -0.5).addScaledVector(right, -0.1);
    const from = p.pos.clone();
    let k = 0;
    this.pickMove = (dt) => {
      k = Math.min(1, k + dt / 0.3);
      const e = k * k * (3 - 2 * k);
      p.pos.lerpVectors(from, spot, e);
      p.pos.y = this.engine.terrain.heightAt(p.pos.x, p.pos.z);
      p.faceToward(c.pos, dt, 16);
    };
    m.pickTarget = c.pos.clone();
    const look = bed.look(c);
    m.setHeldStone(look.geo, look.mat, look.scale);
    const B = STONE_BEATS;
    const ev: { t: number; fn: () => void }[] = [
      { t: 0.24, fn: () => p.sfx('pebblesKneel', 0.7) },
      { t: B.grasp - 0.1, fn: () => p.sfx(c.wet ? 'waterRinse' : 'gravelReach', 0.7) },
      { t: B.grasp, fn: () => bed.take(c) },
    ];
    if (good) {
      ev.push({ t: B.look + 0.22, fn: () => this.ui.praise(Story.GOOD_LINES[Math.floor(Math.random() * Story.GOOD_LINES.length)], 1.3) });
      ev.push({ t: B.rub, fn: () => p.sfx('stoneRub', 0.6) });
      ev.push({ t: B.bag, fn: () => {
        p.sfx('stoneToBag', 0.8);
        p.bag.smooth++;
      } });
    } else {
      ev.push({ t: B.look + 0.2, fn: () => this.ui.praise(Story.REJECT_LINES[c.kind] || 'לֹא זֶה', 1.5, true) });
      ev.push({ t: B.toss, fn: () => {
        const hand = m.handSocketR.getWorldPosition(new THREE.Vector3());
        const vel = right.clone().multiplyScalar(1.3 + Math.random() * 0.6).addScaledVector(to, 0.8).add(new THREE.Vector3(0, 1.7, 0));
        this.props.toss(look.geo, look.mat, hand, vel, (at) => {
          p.sfx('stoneToss', 0.6);
          bed.putBack(c, at.clone());
        });
      } });
    }
    m.play(good ? 'stone' : 'stoneToss', ev);
    return new Promise((resolve) => {
      this.after((good ? B.end : B.tossEnd) + 0.02, () => {
        m.pickTarget = null;
        m.setHeldStone(null);
        this.pickMove = null;
        p.controlEnabled = true;
        this.cam.close = 0;
        resolve(good);
      });
    });
  }

  /** 4. the sling practice: to the throwing mark, then the four rounds (each with its rating; retry or go on) */
  private async practiceObjective(startRound = 1) {
    const R = this.ensureRange();
    await R.build();
    const p = this.player;
    p.canSling = true;
    p.bag.plain = Math.max(p.bag.plain, 8);
    p.bag.preferSmooth = false;
    this.ui.objective('הִתְאַמֵּן בַּקֶּלַע', 'עֲמֹד עַל סִמַּן הַקְּלִיעָה שֶׁעַל שְׂפַת הַנַּחַל, לְיַד עֲרֵמַת הָאֲבָנִים');
    this.ui.hint([K.sling, withLabel(K.look, 'כַּוֵּן')]);
    this.setMarker(R.station.clone().add(new THREE.Vector3(0, 0.9, 0)), 'סִמַּן הַקְּלִיעָה');
    this.beh = () => this.ui.stoneBag({ smooth: p.bag.smooth, plain: p.bag.plain, pouch: p.pouchKind });
    await this.until(() => this.atStation());
    this.check();
    this.ui.hint(null);
    this.setMarker(null);
    this.ui.objective(null); // the round's panel says what to do
    this.practicing = true;
    try {
      for (let r = Math.max(1, Math.min(ROUNDS.length, startRound)); r <= ROUNDS.length; ) {
        const res = await this.playRound(r);
        this.check();
        if (res === 'retry') continue;
        r++;
      }
    } finally {
      this.practicing = false;
      R.stop();
      this.ui.rangePanel(null);
    }
    this.rangeOpen = true;
    // he fills his bag at the heap before he goes back up (the smooth stones he chose are still in it)
    p.bag.plain = Math.max(p.bag.plain, 6);
    p.bag.preferSmooth = true;
    this.ui.stoneBag(null);
    this.audio.sfx('uiObjective');
    p.canStrike = true;
    p.canDodge = true;
    this.ui.hint([K.strike, K.dodge], 9);
    await this.wait(1.5);
  }

  private async playRound(r: number): Promise<'next' | 'retry'> {
    const R = this.range!;
    const def = ROUNDS[r - 1];
    const p = this.player;
    R.startRound(r);
    p.bag.preferSmooth = r === 4; // the finale: his chosen smooth stones first
    p.sfx('roundStart', 0.8);
    this.ui.praise(def.title, 1.8);
    if (r === 1) this.ui.hint('<span class="h-item rh">הַחְזֵק — הַקֶּלַע מִסְתּוֹבֵב · שַׁחְרֵר כְּשֶׁהַכִּיס עוֹבֵר בָּאוֹר שֶׁבְּרֹאשׁ הַטַּבַּעַת</span>', 10);
    else if (r === 2) this.ui.hint('<span class="h-item rh">בַּמֶּרְחָק הָאֶבֶן יוֹרֶדֶת — כַּוֵּן מֵעַל הַמַּטָּרָה, וְהָרוּחַ מְסִיטָה אוֹתָהּ</span>', 10);
    else if (r === 3) this.ui.hint('<span class="h-item rh">כַּוֵּן לְאָן שֶׁהַמַּטָּרָה תַּגִּיעַ — לֹא לְאָן שֶׁהִיא עַכְשָׁו</span>', 9);
    else this.ui.verse(...verseArgs('jdg_20_16_slingers'), 8);
    let done = false, skip = false;
    R.onRoundDone = () => {
      done = true;
    };
    const focus = new THREE.Vector3();
    this.setMarker(() => (p.aiming || p.hud.aim > 0.05 || R.stats.stones > 0 ? null : R.focus(focus).add(new THREE.Vector3(0, 0.8, 0))), 'הַמַּטָּרוֹת');
    this.beh = () => {
      const at = this.atStation();
      R.offMark = !at;
      // the heap beside the mark: he refills his bag when it runs low
      if (at && p.bag.plain < 4) {
        p.bag.plain = 8;
        p.sfx('stoneToBag', 0.6);
      }
      this.ui.rangePanel({
        round: r, rounds: ROUNDS.length, title: def.title, targets: R.targetStates(), streak: R.stats.streak, time: R.stats.time,
        wind: R.windText(),
        note: !at ? 'חֲזֹר אֶל סִמַּן הַקְּלִיעָה' : R.canSkip ? `${this.ui.touch ? K.interact.touch : K.interact.key} — הַמְשֵׁךְ הָלְאָה, אוֹ נַסֵּה עוֹד` : undefined,
      });
      this.ui.stoneBag({ smooth: p.bag.smooth, plain: p.bag.plain, pouch: p.pouchKind });
      if (R.canSkip && this.input.take('interact')) skip = true;
    };
    await this.until(() => done || skip);
    this.check();
    this.beh = null;
    this.setMarker(null);
    if (r === ROUNDS.length) this.ui.hideVerse(); // the slingers' verse of the finale never outlives its round
    if (!R.stats.done) R.live = false;
    return this.showRating(R.stats, r);
  }

  private async showRating(st: RoundStats, r: number): Promise<'next' | 'retry'> {
    const def = ROUNDS[r - 1];
    const marks = st.done ? st.marks : 0;
    this.player.sfx(marks >= 3 ? 'rating3' : marks === 2 ? 'rating2' : marks === 1 ? 'rating1' : 'roundComplete', 0.9);
    const verdict = marks >= 3 ? 'יָד שֶׁל קַלָּע' : marks === 2 ? 'טוֹב — וְעוֹד יִהְיֶה טוֹב יוֹתֵר' : marks === 1 ? 'עָשִׂיתָ זֹאת — עַכְשָׁו בְּפָחוֹת אֲבָנִים' : 'נַמְשִׁיךְ — וְנָשׁוּב לָזֶה';
    const mm = Math.floor(st.time / 60), ss = Math.floor(st.time % 60);
    const lines: [string, string][] = [
      ['פְּגִיעוֹת', `${st.hits} / ${st.targets}`],
      ['אֲבָנִים', `${st.stones}`],
      ['שִׁחְרוּר מֻשְׁלָם', `${st.perfects}`],
      ['רֶצֶף', `${st.bestStreak}`],
      ['זְמַן', `${mm}:${String(ss).padStart(2, '0')}`],
    ];
    let choice: 'next' | 'retry' | null = null;
    const last = r === ROUNDS.length;
    this.ui.rangePanel(null);
    this.ui.rating({ title: def.title, marks, verdict, lines, retry: true, next: last ? 'סִיּוּם' : 'הַסִּבּוּב הַבָּא' }, () => (choice = 'next'), () => (choice = 'retry'));
    this.beh = () => {
      if (this.input.take('interact')) choice = 'next';
      else if (this.input.take('retry')) choice = 'retry';
    };
    await this.until(() => choice !== null);
    this.beh = null;
    this.ui.rating(null);
    return choice ?? 'next';
  }

  /** 5. back to the flock (the range stays open: its mark offers another go) */
  private async returnObjective() {
    const show = () => {
      this.ui.objective('חֲזֹר אֶל הָעֵדֶר', 'אַל תַּשְׁאִיר אֶת הַצֹּאן לְבַד זְמַן רַב');
      this.setMarker(() => this.flockCenter().add(new THREE.Vector3(0, 1.5, 0)), 'הַצֹּאן');
    };
    show();
    this.rangeOpen = true;
    this.onReplayEnd = show;
    const t0 = this.time;
    this.beh = null;
    await this.until(() => !this.practicing && (this.player.pos.distanceTo(this.flockCenter()) < 20 || this.time - t0 > 70));
    this.check();
    this.onReplayEnd = null;
    this.ui.prompt(null);
    this.rangePrompt = false;
  }
  private onReplayEnd: (() => void) | null = null;

  /** the range again from its mark: all four rounds (the best marks are kept) */
  private async replayRange() {
    const R = this.range;
    if (!R || this.practicing) return;
    const p = this.player;
    const prevBeh = this.beh;
    const canSling = p.canSling;
    this.practicing = true;
    p.canSling = true;
    p.bag.plain = Math.max(p.bag.plain, 8);
    this.ui.objective(null);
    this.setMarker(null);
    try {
      for (let r = 1; r <= ROUNDS.length; ) {
        const res = await this.playRound(r);
        if (res === 'retry') continue;
        r++;
      }
    } finally {
      R.stop();
      this.practicing = false;
      this.ui.rangePanel(null);
      this.ui.stoneBag(null);
      this.beh = prevBeh;
      p.canSling = canSling || this.freeRoam;
      p.bag.preferSmooth = true;
      if (this.freeRoam) this.ui.objective('שׁוֹטֵט בְּשָׂדוֹת בֵּית לֶחֶם', 'הַפֶּרֶק הַבָּא יַגִּיעַ בְּקָרוֹב');
      this.onReplayEnd?.();
    }
  }

  /** per frame: the range lives on; its replay prompt at the mark; the lens that follows a perfect long shot */
  private rangeTick(dt: number) {
    this.projectiles.pxScale = this.engine.renderer.getPixelRatio(); // the flight's dots: a few device px wide
    const R = this.range;
    if (!R) return;
    R.update(dt);
    if (this.followShot) {
      this.followT += dt;
      const s = this.followShot;
      if ((s.resolved && this.followT > s.flight + THROW_RELEASE + 0.4) || this.followT > 2.6 || this.input.take('skip')) {
        this.followShot = null;
        this.cam.skipShots();
        this.slowMo(1);
      }
    }
    const open = (this.rangeOpen || this.freeRoam) && !this.practicing && R.built && !this.cam.inCinematic && this.player.controlEnabled;
    const at = open && this.atStation();
    if (at) {
      this.ui.prompt(withLabel(K.interact, 'הִתְאַמֵּן שׁוּב בַּקֶּלַע'));
      this.rangePrompt = true;
      if (this.input.take('interact')) {
        this.ui.prompt(null);
        this.rangePrompt = false;
        void this.replayRange();
      }
    } else if (this.rangePrompt) {
      this.ui.prompt(null);
      this.rangePrompt = false;
    }
  }

  /** a perfect long shot: a lens behind the stone for its flight, in slow motion (brief; Enter / Esc skips) */
  private followStone(shot: ShotInfo) {
    if (this.cam.inCinematic || this.followShot) return;
    this.after(THROW_RELEASE + 0.03, () => {
      const f0 = this.projectiles.firstFlying();
      if (!f0 || this.cam.inCinematic) return;
      this.followShot = shot;
      this.followT = 0;
      this.slowMo(0.45);
      const pos = new THREE.Vector3(), look = new THREE.Vector3(), dir = new THREE.Vector3(), side = new THREE.Vector3();
      const end = new THREE.Vector3().copy(f0.pos);
      this.cam.playShots([{ duration: 3, ease: false, at: () => {
        const f = this.projectiles.firstFlying();
        if (f) {
          end.copy(f.pos);
          dir.copy(f.vel).normalize();
        }
        side.set(-dir.z, 0, dir.x).normalize();
        pos.copy(end).addScaledVector(dir, -1.7).addScaledVector(side, 0.35).add(_up35);
        pos.y = Math.max(pos.y, this.engine.terrain.heightAt(pos.x, pos.z) + 0.4);
        look.copy(end).addScaledVector(dir, 3);
        return { pos, look, fov: 40 };
      } }], () => this.slowMo(1));
    }, true);
  }

  /** a throw resolved: the range scores it; a miss near what he aimed at says where the stone went */
  private onShotResolved(shot: ShotInfo) {
    const R = this.range;
    R?.onResolve(shot);
    if (!R || !R.live || shot.hit || !shot.intent || shot.missDist > 4) return;
    const right = _missR.setFromMatrixColumn(this.engine.camera.matrixWorld, 0);
    const o = shot.missOffset;
    // along the throw: a stone that came down before the target (on the bank above it — the targets stand lower,
    // in the wadi) fell SHORT; one that passed over it went LONG; otherwise high / low, left / right
    const c = shot.intent.center();
    const dh = _missD.set(c.x - shot.from.x, 0, c.z - shot.from.z).normalize();
    const along = o.x * dh.x + o.z * dh.z;
    const up = o.y, side = o.dot(right);
    const words: string[] = [];
    if (along < -0.6) words.push('קָצָר');
    else if (along > 0.6) words.push('אָרֹךְ');
    else if (Math.abs(up) > 0.1 && Math.abs(up) >= Math.abs(side) * 0.5) words.push(up < 0 ? 'נָמוּךְ' : 'גָּבוֹהַּ');
    if (Math.abs(side) > 0.1 && Math.abs(side) >= Math.abs(up) * 0.5) words.push(side < 0 ? 'שְׂמֹאלָה' : 'יָמִינָה');
    if (!words.length) words.push('קָרוֹב');
    this.ui.praise(`${words.join(' · ')}${shot.missDist < 0.45 ? ' — כִּמְעַט' : ''}`, 1.3, true);
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
    // (play1) test jumps start with his bag filled (five smooth stones + practice stones)
    this.player.bag.smooth = 5;
    this.player.bag.plain = 6;
    this.player.bag.preferSmooth = true;
    if (j === 'sling' || j === 'stones') {
      // (play1) ?jump=stones: the stream bed; ?jump=sling: the sling practice with the five smooth stones in the bag
      // (?round=N starts at round N) — then the chapter goes on from there
      const R = LAYOUT.range;
      if (j === 'stones') {
        this.player.place(LAYOUT.stones.x - 6, LAYOUT.stones.z - 9, 0.5);
        this.cam.snapBehind(0.5, 0.15);
        await this.stonesObjective();
      } else {
        this.player.place(R.x + 1.5, R.z - 7, R.facing);
        this.cam.snapBehind(R.facing, 0.1);
        this.player.bag.smooth = 5;
      }
      await this.practiceObjective(Number(new URLSearchParams(location.search).get('round') ?? 1) || 1);
      await this.returnObjective();
      await this.bearAttack();
      await this.chase();
      await this.rescue();
      await this.rise();
      await this.fight();
      await this.clinch();
      await this.aftermath();
      await this.ending();
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
    // (cut6) a restart in the middle of the bear's hook: its light, bushes and eyes leave with it
    this.hook?.dispose();
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
  /**
   * The opening film "הַטּוֹב מִמֶּךָּ" (docs/intro-script.md; player src/gameplay/Intro.ts, shot sheet
   * src/content/introScript.ts, sets src/film/**). ?introAt=<s> starts the film at that time (tests); ?filmcast=0 /
   * ?filmcrowd=0 play it with the sets' stand-ins. Skip: the skip button, Enter / Esc, or any key / tap twice.
   */
  /** Resolves true when the film was skipped. */
  private async intro(): Promise<boolean> {
    this.cinematic(true);
    const q = new URLSearchParams(location.search);
    const intro = new Intro({ engine: this.engine, ui: this.ui, input: this.input, audio: this.audio, cam: this.cam, player: this.player, flock: this.flock, bear: this.bear });
    intro.startAt = Number(q.get('introAt') ?? 0) || 0;
    (window as unknown as Record<string, unknown>).__intro = intro;
    intro.begin();
    this.beh = (dt) => {
      if (this.input.take('skip') || this.input.take('pause')) intro.skip();
      intro.update(dt);
    };
    try {
      await this.until(() => intro.done);
    } finally {
      // also when the story restarts mid-film: world view, post settings and Saul's house are always cleaned up
      intro.finish();
      this.beh = null;
      this.ui.skip(false);
      this.ui.onSkip = undefined;
    }
    return intro.skipped;
  }

  // ============================================================================ the bear
  private async bearAttack() {
    const lamb = this.flock.lamb;
    const fc = this.flockCenter();
    const T = LAYOUT.thicket;
    const toThicket = new THREE.Vector3(T.x - fc.x, 0, T.z - fc.z).normalize();
    // THE HOOK (cut6, CUT v4 — the opening film's thicket and eyes, ≈5 s): the lamb has strayed to the edge of the scrub
    // toward the thicket and grazes; the birds fly up and fall silent; the light dims in the bushes' shade; two faint
    // amber eyes open in the dark between them (src/gameplay/BearHook.ts) — then the bear comes out of those bushes
    const hook = this.hook ?? (this.hook = new BearHook({ engine: this.engine, flock: this.flock, bear: this.bear }));
    hook.dispose();
    this.cinematic(true);
    hook.stage(fc, toThicket);
    hook.onCue = (c) => {
      if (c === 'birds') this.audio.sfx('birdsScatter');
      else if (c === 'hush') this.audio.music('hush', 1.2);
      else if (c === 'bleat') this.audio.at('lambBleat', lamb.position, 0.45);
      else if (c === 'eyes') this.audio.sfx('eyesSting');
    };
    this.beh = (dt) => hook.tick(dt);
    await this.shots(hook.shots());
    this.check();
    hook.end();
    // the bear comes out of the bushes at the lamb (it stands frozen at the edge, its head up): from just inside the
    // edge (the cut out of the dark hides the step), so it is out of the leaves in the first second of the stalk
    const lambSpot = lamb.position.clone();
    const start = hook.edge.clone().addScaledVector(hook.out, -1.0);
    // the attack's lenses beside and behind the bear as it runs off toward the thicket: no bush or tree in that corridor
    // for these shots (put back by hook.dispose(), while the lens is on David's face)
    hook.clearRun(lambSpot, toThicket, 34, -2.5, 6.5);
    this.bear.place(start.x, start.z, Math.atan2(-toThicket.x, -toThicket.z));
    this.bear.visible = true;
    this.bear.model.hold = 'none';
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
    // (cut6) the lenses keep their height over the ground where they stand: since CUT v4 the lamb is taken at the edge of
    // the scrub on the slope toward the thicket, and a lens a few metres uphill of it at its height + 1 m was in the grass
    const over = (p: THREE.Vector3, h: number) => {
      p.y = Math.max(p.y, this.engine.terrain.heightAt(p.x, p.z) + h);
      return p;
    };
    await this.shots([
      // from among the sheep toward the thicket
      { duration: 3.6, at: (u) => {
        // (over the tall grass of the scrub's edge, not through it: a lens at 1 m filled the frame's foot with blades)
        const p = over(lambAtStart.clone().addScaledVector(toThicket, -6).add(new THREE.Vector3(1.5, 1.55 + u * 0.25, 0)), 1.55 + u * 0.25);
        return { pos: p, look: bearPos().clone().add(new THREE.Vector3(0, 0.8, 0)), fov: 40 - u * 6 };
      } },
      { duration: 3.2, at: (u) => {
        hook.hideBushes(); // (the cut to the side of the bear: the hook's bushes are not in this angle)
        const b = bearPos();
        const side = new THREE.Vector3(-toThicket.z, 0, toThicket.x);
        return { pos: over(b.clone().addScaledVector(side, 5 - u).add(new THREE.Vector3(0, 0.9, 0)).addScaledVector(toThicket, 2), 0.9), look: b.clone().add(new THREE.Vector3(0, 0.7, 0)), fov: 42 };
      } },
      { duration: 3.4, at: (u) => {
        const b = bearPos();
        return { pos: over(b.clone().add(new THREE.Vector3(0, 1.3 + u * 0.4, 0)).addScaledVector(toThicket, -3.2).add(new THREE.Vector3(-toThicket.z * 1.8, 0, toThicket.x * 1.8)), 1.3 + u * 0.4), look: b.clone().add(new THREE.Vector3(0, 0.9, 0)), fov: 34 };
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
    // the lamb is the flock's again (in the bear's mouth now); the hook's bushes leave while the lens is on David's face
    hook.dispose();
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
      // close enough that both fists reach the lamb in the jaws (DavidModel aims them at pullTarget)
      const stand = this.bear.pos.clone().addScaledVector(bearF, 1.15);
      let prog = 0.15;
      let time = 0;
      const lambAt = new THREE.Vector3();
      this.ui.letterbox(true);
      this.beh = (dt) => {
        time += dt;
        this.player.model.pullTarget = lamb.object.getWorldPosition(lambAt);
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
        // side-on two-shot of the tug of war, wide enough (with the letterbox bars) for David's head and the lamb
        const side = new THREE.Vector3(-bearF.z, 0, bearF.x);
        const mid = this.player.pos.clone().lerp(this.bear.pos, 0.45);
        const pos = mid.clone().addScaledVector(side, 3.7).add(new THREE.Vector3(0, 1.3 + Math.sin(tt * 0.5) * 0.08, 0)).addScaledVector(bearF, 0.5);
        pos.y = Math.max(pos.y, this.engine.terrain.heightAt(pos.x, pos.z) + 0.6);
        return { pos, look: mid.clone().add(new THREE.Vector3(0, 1.0, 0)), fov: 40 };
      } }]);
      await this.until(() => prog >= 1 || time > 6.5);
      this.check();
      this.beh = null;
      this.player.model.pullTarget = null;
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
    const away = new THREE.Vector3();
    const side = new THREE.Vector3();
    await this.shots([
      { duration: 5.4, at: (u) => {
        // low angle over David's shoulder, up at the rearing bear. Framed from where David actually is (he steps
        // back from the rescue into his stand during the shot), so his head and the bear's both stay in frame.
        const b = bp();
        const d = this.player.pos;
        away.set(d.x - b.x, 0, d.z - b.z);
        if (away.lengthSq() < 1e-4) away.copy(bearF);
        away.normalize();
        side.set(-away.z, 0, away.x);
        const pos = d.clone().addScaledVector(away, 2.7 - u * 0.4).addScaledVector(side, 1.25);
        // low, but never under the hill's crest (the ground is back-face culled from below)
        pos.y = Math.max(d.y + 0.55, this.engine.terrain.heightAt(pos.x, pos.z) + 0.35);
        const look = b.clone().lerp(d, 0.3);
        look.y = b.y * 0.7 + d.y * 0.3 + 1.5 + u * 0.3;
        return { pos, look, fov: 46 - u * 4 };
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
    // the thanks (hand on the heart, face lifted) is played to a front three-quarter lens on the sun's side of him,
    // so the face is lit; the lamb is set down in front of him and walks off to the flock
    const hd = this.player.heading;
    const sd = shared.uSunDir.value;
    const s = Math.sin(hd + 0.62) * sd.x + Math.cos(hd + 0.62) * sd.z >= Math.sin(hd - 0.62) * sd.x + Math.cos(hd - 0.62) * sd.z ? 1 : -1;
    const lift = (p: THREE.Vector3, up: number) => {
      p.y = Math.max(p.y, this.engine.terrain.heightAt(p.x, p.z) + up);
      return p;
    };
    const front = orbit(6.5, () => D, 4.0, 2.7, hd + s * 1.55, hd + s * 0.62, 1.25, 1.5, 1.32, 34);
    await this.shots([
      { duration: front.duration, at: (u, tt) => {
        const fr = front.at(u, tt);
        lift(fr.pos, 0.9);
        return fr;
      } },
      // then the crane: up and back behind him, over his shoulder, to the flock he brought the lamb back to and the
      // hills beyond (the mirror of the opening film's title crane)
      { duration: 12, at: (u) => {
        const right = new THREE.Vector3(-f.z, 0, f.x);
        // (David stays in the lower third: the look point rides a few metres ahead of him, the horizon near the top)
        const pos = lift(D.clone().addScaledVector(f, -(2.4 + u * 9)).addScaledVector(right, s * (1.0 + u * 2.6)).add(new THREE.Vector3(0, 1.7 + u * 5, 0)), 1.5);
        const look = D.clone().addScaledVector(f, 2 + u * 8).add(new THREE.Vector3(0, 0.8, 0));
        return { pos, look, fov: 40 + u * 8 };
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
      this.jump = ''; // "play again" is the whole chapter, also after a ?jump= test start
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
    this.rangeTick(dt); // (play1) the range lives on (the swinging gourd, the rag in the wind), its replay, the stone lens
    // HUD
    const mp = this.markerFn ? this.markerFn() : this.markerPos;
    this.ui.marker(this.engine.camera, this.cam.inCinematic ? null : mp, this.markerLabel);
    // (play1) the sling's reticle and timing ring (it fades in with the aim lens)
    this.ui.crosshair((this.player.aiming || this.player.hud.aim > 0.02) && !this.cam.inCinematic, this.player.power, this.player.aimOnTarget, this.player.aimInRange, this.player.hud);
    this.ui.health(this.showHealth && !this.cam.inCinematic, this.player.health, this.player.maxHealth);
    this.ui.boss(this.showBoss, this.bossHP);
    const red = this.engine.post.grade.uniforms.uRed;
    red.value = damp(red.value, this.showHealth && this.player.health === 1 ? 0.35 + Math.sin(this.time * 4) * 0.1 : 0, 3, rawDt);
    this.engine.post.grade.uniforms.uDesat.value = (1 - this.timeScale) * 0.35;
    // bounds warning
    if (this.player.outOfBounds > 0 && !this.cam.inCinematic) this.ui.hint('<span class="h-item">הַצֹּאן זְקוּקִים לְךָ — חֲזֹר אֶל הַמִּרְעֶה</span>', 2);
    // shared pushers for grass
    const pu = shared.uPushers.value;
    // David parts the grass round his legs; the parted patch sits a little toward the camera (the grass between the lens
    // and his shins hid his legs in the tall straw — on a phone's small screen they seemed to vanish)
    const cp = this.engine.camera.position;
    const tx = cp.x - this.player.pos.x, tz = cp.z - this.player.pos.z, tl = Math.hypot(tx, tz) || 1;
    const off = this.cam.inCinematic ? 0 : 0.3;
    pu[0].set(this.player.pos.x + (tx / tl) * off, this.player.pos.y, this.player.pos.z + (tz / tl) * off, this.cam.inCinematic ? 0.7 : 0.95);
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

// (play1) scratch
const _up35 = new THREE.Vector3(0, 0.35, 0);
const _missR = new THREE.Vector3();
const _missD = new THREE.Vector3();
const _dustPale = new THREE.Color(0.86, 0.79, 0.66);
