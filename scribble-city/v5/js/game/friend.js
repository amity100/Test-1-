import * as THREE from 'three';
import { districtName } from '../world/layout.js';
import { PLACES, placeBlock, M_BLOCKS, MAINLAND_ON } from '../world/mainland/plan.js';
import { houseSketch, HOME_STYLES } from '../world/home.js';
import { PLOT_FRONT } from '../world/plot.js';
import { Facade } from '../world/kit.js';
import { shopOpen } from './rhythm.js';
import { ChatPanel } from '../ui/chat.js';

// (v5, ROADMAP 11.17) The friend you drew, a friend to talk to. Drawn at a stand with a magic
// pencil (game/streetlife.js Companion walks her beside you), she has a name, a way of her own
// and a memory: what you told her, the places you went together. You talk with her (ui/chat.js) in
// your own words - where this page may ask Claude (an artifact on claude.ai), it is Claude who
// answers in her voice; anywhere else, her own little conversation in Hebrew - and she does what
// she says: leads the way to the mall, the club, the beach (the way drawn on the map), dances,
// draws you a heart, waits for you. And she can draw herself a home: on a plot of the mainland's
// neighbourhoods (world/plot.js) a house drawn line by line in the air, as big as a house, comes
// true (world/home.js; its block built again in the background, world/mainland/stream.js); she
// lives there after, and you can come in - a film on the sofa, cooking together, a picture for
// her wall, sleep till the morning.

const KEY = 'scribble-city-v5-friend';
const HOMES_KEY = 'scribble-city-v5-homes';
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const TAG = /\[(GO|HOME|BUILD|DANCE|HEART|DRAW|WAIT|FOLLOW|TV|COOK|SLEEP|PAINT|MEM)(?::([^\]]*))?\]/g;
const clean = (t) => t.replace(TAG, '').replace(/\[[A-Z]+[^\]]*$/, '').replace(/\s+$/, '').trim();

const NAMES = [['Maya', 'מאיה'], ['Noa', 'נועה'], ['Lia', 'ליה'], ['Tamar', 'תמר'], ['Yael', 'יעל'], ['Shira', 'שירה'], ['Mia', 'מיה'], ['Ella', 'אלה'], ['Romi', 'רומי'], ['Gali', 'גלי'], ['Dana', 'דנה'], ['Ariel', 'אריאל']];
const MOODS = [
  { id: 'sunny', heb: 'שמחה ומצחיקה, תמיד עם בדיחה מוכנה' },
  { id: 'dreamy', heb: 'סקרנית וחולמנית, שואלת על הכול' },
  { id: 'artist', heb: 'אמנית ורגישה, רואה ציור בכל דבר' },
  { id: 'bold', heb: 'הרפתקנית ונמרצת, תמיד מוכנה לצאת' },
];
// where she can lead you (her words for them, the map's)
const GO = {
  mall: { heb: 'לקניון', en: 'To the mall!' },
  club: { heb: 'למועדון', en: 'Let\'s dance!' },
  food: { heb: 'לאכול', en: 'I\'m hungry too!' },
  beach: { heb: 'לחוף', en: 'To the beach!' },
  theatre: { heb: 'לתיאטרון', en: 'A film!' },
  park: { heb: 'לפארק', en: 'A walk in the park!' },
};
const DRAWABLE = ['flower', 'heart', 'balloon', 'dog', 'umbrella', 'house', 'plant', 'candle'];

export class Friendship {
  constructor(game) {
    this.game = game;
    this.chat = new ChatPanel(game);
    game.dialog.chat = this.chat;
    this.chat.onSend = (t) => this.hear(t);
    this.chat.onClose = () => this.onChatClosed();
    this.data = this.load();
    this.comp = null;
    this.mode = 'follow';
    this.turns = [];
    this.menu = 'main';
    this.sample = null;
    this.sampleOff = false;
    this.spawnT = 0;
    // (Claude, where this page may ask it: resolved later, or never)
    try {
      const c = typeof window !== 'undefined' ? window.claude : null;
      if (c && typeof c.use === 'function') {
        c.use('sample')
          .then((s) => (this.sample = s || null))
          .catch(() => (this.sample = null));
      }
    } catch (e) {
      this.sample = null;
    }
    const ml = game.world.mainland;
    if (ml && ml.listen) ml.listen((live, on) => this.onBlock(live, on));
  }

  // ------------------------------------------------------------------ what she remembers
  load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      return d && d.name ? d : null;
    } catch (e) {
      return null;
    }
  }

  save() {
    if (!this.data) return;
    if (this.comp && this.comp.alive) this.data.look = this.comp.c.fig.look;
    this.data.turns = this.turns.slice(-16);
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (e) {
      // (no storage: she remembers till the page closes)
    }
  }

  saveHomes() {
    try {
      localStorage.setItem(HOMES_KEY, JSON.stringify([...this.game.world.homes.values()]));
    } catch (e) {
      // ignore
    }
  }

  get heb() {
    return this.data ? this.data.heb : 'החברה';
  }

  get here() {
    return !!(this.comp && this.comp.alive);
  }

  // ------------------------------------------------------------------ drawn at a stand
  // a friend drawn (game/streetlife.js newCompanion): a new one, or the one you had, drawn again
  adopt(comp) {
    const game = this.game;
    this.comp = comp;
    comp.over = (c, dt) => this.over(c, dt);
    this.mode = 'follow';
    const again = this.redraw && this.data;
    this.redraw = false;
    if (!again) {
      const [en, he] = pick(NAMES);
      this.data = { name: en, heb: he, mood: pick(MOODS).id, love: 20, facts: [], homeKey: null, met: Date.now() };
      // (a house she drew before, for a friend of the same name: hers no longer)
      this.turns = [];
    } else {
      this.turns = (this.data.turns || []).slice(-10);
      this.data.love = Math.min(100, (this.data.love || 20) + 5);
    }
    this.save();
    const c = comp.c;
    game.inkwell.after(1.4, () => {
      if (!this.here) return;
      game.bubbles.say(c, again ? `It's me, ${this.data.name}! I missed you!` : `Hi! I'm ${this.data.name}!`);
      this.openChat(again ? `${this.heb} חזרה! "ציירתם אותי שוב! כל כך חיכיתי."` : null, again ? null : `היי! אני ${this.heb}. תודה שציירתם אותי! העיר הזאת כל כך יפה מכאן... לאן הולכים?`);
    });
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const game = this.game;
    if (this.comp && !this.comp.alive) {
      // (she went her own way: home, if she has one)
      this.comp = null;
      if (this.chat.open) this.chat.close();
      this.mode = 'follow';
    }
    if (this.comp) this.comp.over = this.comp.over || ((c, d) => this.over(c, d));
    // (leading the way while you drive her there: arrived)
    if (this.mode === 'lead' && this.dest && this.here) {
      const v = game.player.inVehicle;
      const at = v ? v.pos : game.player.pos;
      if (Math.hypot(this.dest.x - at.x, this.dest.z - at.z) < (v ? 18 : this.dest.r || 13)) this.arrive();
    }
    // a drawing of a house waiting for its block: shown in the end anyway
    if (this.waitBlock !== undefined && this.waitBlock !== null && game.time - this.waitT > 16) this.housePlop();
    // at home when you come by her house
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 1;
      if (!this.here && this.data && this.data.homeKey && !game.inBar) {
        const plot = this.plotOf(this.data.homeKey);
        const p = game.player.pos;
        if (plot && plot.home && plot.home.room && Math.hypot(plot.home.door[0] - p.x, plot.home.door[2] - p.z) < 55) this.spawnAtHome(plot);
      }
    }
    // the home's television, her cooking (and the like) while you are there
    if (this.tv) this.tvLife(dt);
  }

  // the plot (live: its block is built) of a key, or null
  plotOf(key) {
    for (const p of this.game.world.plots || []) if (p.key === key) return p;
    return null;
  }

  spawnAtHome(plot) {
    const life = this.game.streetlife;
    if (life.companion && life.companion.alive) return;
    const R = plot.home.room;
    const m = R.marks.sofaA || R.marks.stove || R.center;
    const comp = life.newCompanion(m.x, m.z, this.data.look || null, true);
    this.comp = comp;
    comp.over = (c, dt) => this.over(c, dt);
    this.mode = 'home';
    this.homeAt = null;
  }

  // ------------------------------------------------------------------ where she is, what she does
  // (game/streetlife.js Companion.step asks this first: a goal, null to stand, undefined for the
  // companion's own way - beside you, in the car with you)
  over(c, dt) {
    const game = this.game;
    const p = game.player;
    const talking = this.chat.open;
    if (talking && !p.inVehicle) {
      // face you while you talk
      c.faceYaw = Math.atan2(p.pos.x - c.pos.x, p.pos.z - c.pos.z);
      const d = Math.hypot(p.pos.x - c.pos.x, p.pos.z - c.pos.z);
      if (d > 2.2 && this.mode !== 'home') return { x: p.pos.x, z: p.pos.z, speed: 1.6 };
      return null;
    }
    switch (this.mode) {
      case 'wait':
        return this.waiting(c, dt);
      case 'lead':
        return this.leading(c, dt);
      case 'build':
        return this.building(c, dt);
      case 'home':
        return this.atHome(c, dt);
      default:
        return undefined;
    }
  }

  waiting(c, dt) {
    const p = this.game.player.pos;
    const w = this.waitAt;
    const d = Math.hypot(p.x - c.pos.x, p.z - c.pos.z);
    if (d > 160) return this.goHomeAlone();
    const dw = Math.hypot(w.x - c.pos.x, w.z - c.pos.z);
    if (dw > 0.6) return { x: w.x, z: w.z, speed: 1.3 };
    c.faceYaw = Math.atan2(p.x - c.pos.x, p.z - c.pos.z);
    // (now and then a look round, a stretch)
    if (Math.random() < dt * 0.04) this.game.bubbles.say(c, pick(['La la la...', 'Hmm hmm...', 'Where did they go?', '*waits*']));
    return null;
  }

  // left far behind: home if she has one (gone from the street), or off on her own
  goHomeAlone() {
    const c = this.comp;
    this.mode = 'follow';
    if (c) c.dispose(true);
    this.comp = null;
    return null;
  }

  // leading the way: a step ahead of you, along the way the map draws to the place
  leading(c, dt) {
    const game = this.game;
    const p = game.player;
    const dst = this.dest;
    if (!dst) {
      this.mode = 'follow';
      return undefined;
    }
    const anchor = p.inVehicle ? p.inVehicle.pos : p.pos;
    const dd = Math.hypot(dst.x - anchor.x, dst.z - anchor.z);
    if (dd < (dst.r || 13)) {
      this.arrive();
      return undefined;
    }
    // (in the car: she rides with you, the companion's way)
    if (p.inVehicle) return undefined;
    let dir = null;
    const R = game.gps.route;
    if (R && R.pts && R.pts.length) {
      for (const q of R.pts) {
        const d = Math.hypot(q[0] - p.pos.x, q[1] - p.pos.z);
        if (d > 5) {
          dir = [(q[0] - p.pos.x) / d, (q[1] - p.pos.z) / d];
          break;
        }
      }
    }
    if (!dir) {
      const d = Math.max(1e-3, dd);
      dir = [(dst.x - p.pos.x) / d, (dst.z - p.pos.z) / d];
    }
    const tx = p.pos.x + dir[0] * 1.8 - dir[1] * 0.6;
    const tz = p.pos.z + dir[1] * 1.8 + dir[0] * 0.6;
    const dc = Math.hypot(tx - c.pos.x, tz - c.pos.z);
    // (fallen behind round a corner: a puff of crumbs, and she is ahead of you again)
    if (dc > 9) {
      this.leadLost = (this.leadLost || 0) + dt;
      if (this.leadLost > 2.5 && !game.world.collision.pointInside(tx, p.pos.y + 1, tz, 0.3)) {
        game.fx.crumbs(c.pos.x, c.pos.y + 1, c.pos.z, 8, 1.4);
        c.pos.x = tx;
        c.pos.z = tz;
        this.leadLost = 0;
      }
    } else this.leadLost = 0;
    this.leadTalk = (this.leadTalk || 6) - dt;
    if (this.leadTalk <= 0) {
      this.leadTalk = 14 + Math.random() * 10;
      game.bubbles.say(c, pick(['This way!', 'Come on!', 'Almost there!', 'Follow me!', 'Not far now!']));
    }
    if (dc < 0.4) {
      c.faceYaw = Math.atan2(dir[0], dir[1]);
      return null;
    }
    return { x: tx, z: tz, speed: dc > 4 ? 4.2 : p.fig.speed > 3 ? 3.6 : 1.8 };
  }

  lead(x, z, name, then = null, r = 13) {
    const game = this.game;
    this.dest = { x, z, name, then, r };
    this.mode = 'lead';
    game.gps.set(x, z, name);
  }

  arrive() {
    const dst = this.dest;
    this.dest = null;
    this.mode = 'follow';
    if (this.game.gps.target) this.game.gps.clear();
    if (dst && dst.then) dst.then();
    else if (this.here) this.game.bubbles.say(this.comp.c, pick(['We\'re here!', 'Ta-da!', 'Here we are!']));
  }

  // ------------------------------------------------------------------ the places
  // the nearest of a kind of place: { x, z, name } (or null)
  placeFor(kind) {
    const game = this.game;
    const p = game.player.pos;
    const cands = [];
    const add = (x, z, name) => cands.push({ x, z, name, d: Math.hypot(x - p.x, z - p.z) });
    const placeAt = (pl) => {
      const b = placeBlock(pl);
      return pl.at ? { x: pl.at[0], z: pl.at[1] } : b ? { x: b.cx, z: b.cz } : null;
    };
    if (kind === 'mall' || kind === 'club' || kind === 'theatre') {
      if (MAINLAND_ON) {
        for (const pl of PLACES) {
          if (pl.kind !== kind) continue;
          const at = placeAt(pl);
          if (at) add(at.x, at.z, pl.heb);
        }
      }
      if (kind === 'theatre') for (const s of game.world.shops) if (s.kind === 'cinema') add(s.door[0], s.door[2], 'הקולנוע');
      if (kind === 'club') for (const s of game.world.shops) if (s.kind === 'bar') add(s.door[0], s.door[2], 'הבר');
    } else if (kind === 'food') {
      for (const s of game.world.shops) if (['pizza', 'burger', 'noodles', 'tacos', 'diner', 'gourmet', 'sushi', 'falafel'].includes(s.kind)) add(s.door[0] + s.nx * 1.5, s.door[2] + s.nz * 1.5, s.name);
      if (MAINLAND_ON) {
        const pl = PLACES.find((q) => q.id === 'plume');
        const at = pl && placeAt(pl);
        if (at) add(at.x, at.z, pl.heb);
      }
    } else if (kind === 'beach') {
      add(80, -100, 'החוף');
      if (MAINLAND_ON) add(-1500, 600, 'חוף פליסייד');
    } else if (kind === 'park') {
      add(32, -60, 'פארק החוף');
      if (MAINLAND_ON) for (const b of M_BLOCKS) if (b.kind === 'park' || b.kind === 'domino' || b.kind === 'plaza') add(b.cx, b.cz, b.kind === 'domino' ? 'פארק הדומינו' : 'הפארק');
    }
    cands.sort((a, b) => a.d - b.d);
    return cands[0] || null;
  }

  // the nearest plot to draw a home on: a live one (its block built near you), or one from the
  // map of them (world/mainland/far.json) to walk to
  nearestPlot() {
    const game = this.game;
    const p = game.player.pos;
    let best = null;
    let bd = Infinity;
    for (const pl of game.world.plots || []) {
      if (pl.home) continue;
      const f = pl.f;
      const x = f.ox + f.ux * pl.L * 0.5 - f.nx;
      const z = f.oz + f.uz * pl.L * 0.5 - f.nz;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < bd) {
        bd = d;
        best = { key: pl.key, x, z, live: pl };
      }
    }
    if (best && bd < 220) return best;
    for (const [key, x, z] of game.world.allPlots || []) {
      if (game.world.homes.has(key)) continue;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < bd) {
        bd = d;
        best = { key, x, z, live: null };
      }
    }
    return best;
  }

  // ------------------------------------------------------------------ the conversation
  target() {
    const game = this.game;
    const p = game.player;
    if (!this.here || p.mode !== 'foot' || this.chat.open || this.mode === 'build') return null;
    const c = this.comp.c;
    const d = Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z);
    if (d > 2.6) return null;
    return { label: `E — לדבר עם ${this.heb}` };
  }

  interact() {
    if (!this.target()) return false;
    this.openChat();
    return true;
  }

  // the conversation opens: a note (what just happened), her first words, the cards under it
  openChat(note = null, first = null) {
    if (!this.here) return;
    const chat = this.chat;
    chat.show(this.heb, this.data.love);
    if (!chat.started) {
      chat.started = true;
      chat.clear();
      for (const t of (this.turns || []).slice(-6)) chat.add(t.role === 'user' ? 'me' : 'her', clean(t.content));
    }
    if (note) chat.add('note', note);
    const line = first || this.greeting();
    chat.add('her', line);
    this.turns.push({ role: 'user', content: '(השחקן ניגש לדבר איתך)' }, { role: 'assistant', content: line });
    this.menu = 'main';
    this.refreshChips();
    this.game.bubbles.say(this.comp.c, pick(['Hey you!', 'Hi!', 'Yes?', 'Hello!']));
  }

  greeting() {
    const h = this.hour();
    const home = this.mode === 'home';
    if (home) return pick(['ברוכים הבאים אליי! תרגישו בבית.', 'איזה כיף שבאתם! רוצים לשבת?', 'היי! בדיוק חשבתי עליכם. מה עושים?']);
    if (h < 6) return pick(['עוד ער? גם אני. העיר בלילה הכי יפה.', 'השעה מאוחרת... אבל אני כאן.']);
    if (h < 11) return pick(['בוקר טוב! מה התוכנית להיום?', 'בוקר! שמש, ים, עיפרון חדש. מה עושים?']);
    if (h < 17) return pick(['מה עושים? אני בעד הכול.', 'היי! לאן ממשיכים?', 'כן? אני מקשיבה.']);
    return pick(['ערב טוב! העיר נדלקת...', 'הערב צעיר. מה בא לכם?', 'היי, מה התוכנית לערב?']);
  }

  hour() {
    const dn = this.game.daynight;
    return dn ? dn.hour : 15;
  }

  onChatClosed() {
    if (this.here && this.mode !== 'home') this.game.bubbles.say(this.comp.c, pick(['OK!', 'Let\'s go!', '*smiles*']));
  }

  // the cards: what you can say with a tap
  refreshChips() {
    const chat = this.chat;
    const say = (label, text, force = null) => ({ label, fn: () => this.hear(text, force) });
    const hasHome = !!(this.data && this.data.homeKey);
    if (this.menu === 'go') {
      chat.chips([
        say('לקניון', 'בואי נלך לקניון', 'GO:mall'),
        say('למועדון', 'בואי נלך למועדון', 'GO:club'),
        say('לאכול', 'בואי נלך לאכול משהו', 'GO:food'),
        say('לחוף', 'בואי נלך לחוף', 'GO:beach'),
        say('לתיאטרון', 'בואי נלך לתיאטרון', 'GO:theatre'),
        say('לפארק', 'בואי נלך לפארק', 'GO:park'),
        { label: 'חזרה', fn: () => ((this.menu = 'main'), this.refreshChips()) },
      ]);
      return;
    }
    if (this.menu === 'style') {
      chat.chips([
        ...Object.entries(HOME_STYLES).map(([k, s]) => ({ label: s.heb, fn: () => this.chooseStyle(k) })),
        { label: 'אחר כך', fn: () => ((this.menu = 'main'), this.refreshChips()) },
      ]);
      return;
    }
    if (this.mode === 'home') {
      chat.chips([
        say('לראות סרט ביחד', 'בואי נראה סרט ביחד', 'TV'),
        say('לבשל ביחד', 'בואי נבשל משהו ביחד', 'COOK'),
        say('לצייר תמונה לקיר', 'בואי נצייר תמונה לקיר שלך', 'PAINT'),
        say('לנוח עד הבוקר', 'בואי ננוח קצת', 'SLEEP'),
        say('לצאת לטייל', 'בואי נצא לטייל בעיר', 'FOLLOW'),
        say('ספרי לי משהו', 'ספרי לי משהו על עצמך'),
      ]);
      return;
    }
    const list = [{ label: 'לאן נלך?', fn: () => ((this.menu = 'go'), this.refreshChips()) }];
    list.push(hasHome ? say('בואי הביתה', 'בואי נלך אלייך הביתה', 'HOME') : say('בואי נצייר לך בית', 'בואי נצייר לך בית משלך', 'BUILD'));
    list.push(say('בואי נרקוד', 'בואי נרקוד!', 'DANCE'));
    list.push(say('ציירי לי משהו', 'תציירי לי משהו?', 'DRAW:flower'));
    if (this.mode === 'wait') list.push(say('בואי איתי', 'בואי איתי', 'FOLLOW'));
    else list.push(say('חכי כאן', 'חכי לי כאן רגע', 'WAIT'));
    list.push(say('ספרי לי על עצמך', 'ספרי לי על עצמך'));
    chat.chips(list);
  }

  // you said something (typed, or a card)
  async hear(text, force = null) {
    if (!this.here) return;
    // (still answering: the next words wait their turn)
    if (this.chat.busy) {
      this.queued = [text, force];
      return;
    }
    const chat = this.chat;
    chat.add('me', text);
    this.turns.push({ role: 'user', content: text });
    this.learn(text);
    chat.setBusy(true);
    let reply = null;
    const line = chat.add('her', '...');
    const r = await this.askClaude(line);
    if (r) reply = r;
    else {
      await new Promise((res) => setTimeout(res, 350 + Math.random() * 500));
      reply = this.localReply(text, force);
      chat.write(line, clean(reply) || '...');
    }
    if (!this.here) {
      chat.setBusy(false);
      return;
    }
    this.turns.push({ role: 'assistant', content: reply });
    if (this.turns.length > 30) this.turns.splice(0, this.turns.length - 30);
    chat.setBusy(false);
    this.data.love = Math.min(100, (this.data.love || 0) + 1);
    chat.setLove(this.data.love);
    const acted = this.act(reply);
    if (!acted && force) this.act(`[${force}]`);
    else if (!acted) this.game.bubbles.say(this.comp.c, pick(['Hehe!', 'Hmm!', 'Really?', 'Aww!', 'Haha!', 'Oh!']));
    if (this.menu === 'go' && (acted || force)) this.menu = 'main';
    this.save();
    if (this.chat.open) this.refreshChips();
    if (this.queued) {
      const [t, f] = this.queued;
      this.queued = null;
      this.hear(t, f);
    }
  }

  // what you tell her about yourself, kept (your name above all)
  learn(text) {
    const d = this.data;
    const m = text.match(/(?:קוראים לי|השם שלי(?: הוא)?|my name is)\s+([֐-׿A-Za-z]{2,14})/i);
    if (m) {
      d.you = m[1];
      this.remember(`השם של השחקן: ${m[1]}`);
    }
    const like = text.match(/אני (?:אוהב|אוהבת|מת על|מתה על)\s+([^.,!?]{2,30})/);
    if (like) this.remember(`השחקן אוהב: ${like[1]}`);
  }

  remember(fact) {
    const f = this.data.facts || (this.data.facts = []);
    if (!f.includes(fact)) f.push(fact);
    while (f.length > 12) f.shift();
  }

  // ------------------------------------------------------------------ Claude, in her voice
  rules() {
    const game = this.game;
    const d = this.data;
    const p = game.player.pos;
    const mood = (MOODS.find((m) => m.id === d.mood) || MOODS[0]).heb;
    const h = this.hour();
    const hh = `${Math.floor(h)}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
    const where = districtName(p.x, p.z) || 'העיר';
    const w = game.weather && game.weather.state ? game.weather.state : '';
    const plot = d.homeKey ? this.plotOf(d.homeKey) : null;
    const lines = [
      `את משחקת את ${d.heb} (${d.name}), דמות במשחק "עיר משורבטת": עיר שלמה מצוירת בעיפרון, בהשראת מיאמי - אושן דרייב, הטיילת, היבשה עם הקניונים, המועדונים והשכונות.`,
      `השחקן צייר אותך בעיפרון קסום בדוכן "צייר לך חברה", ומאז את חברה שלו. האופי שלך: ${mood}. את חמה, מצחיקה, סקרנית, צנועה ומנומסת, ואוהבת לצייר. חברות טובה בלבד: בלי רומנטיקה בוטה ובלי שום תוכן לא מתאים.`,
      'עונים בעברית יומיומית וטבעית, קצר: משפט עד שלושה. את מדברת בלשון נקבה. אל השחקן פונים בלשון רבים או בניסוח ניטרלי, אלא אם השחקן כתב על עצמו בלשון זכר או נקבה. לא מזכירים שאת בינה מלאכותית; את דמות מצוירת שחיה בעיר.',
      `עכשיו: השעה ${hh}, ${where}${w ? `, מזג האוויר: ${w}` : ''}. ${this.mode === 'home' ? 'אתם בבית שלך.' : d.homeKey ? 'יש לך בית שציירת לעצמך בשכונה.' : 'עוד אין לך בית; אפשר לצייר אחד על מגרש ריק בשכונות היבשה.'}${game.player.inVehicle ? ' אתם נוסעים יחד ברכב.' : ''}`,
      d.you ? `השם של השחקן: ${d.you}.` : '',
      (d.facts || []).length ? `מה שאת זוכרת: ${d.facts.join('; ')}.` : '',
      'את יכולה גם לעשות דברים במשחק. כשאת מסכימה לעשות משהו, הוסיפי בסוף התשובה תגית אחת בסוגריים מרובעים:',
      '[GO:mall] להוביל לקניון, [GO:club] למועדון, [GO:food] לאכול, [GO:beach] לחוף, [GO:theatre] לתיאטרון, [GO:park] לפארק, [HOME] להוביל לבית שלך, [BUILD] לצייר לעצמך בית על מגרש ריק, [DANCE] לרקוד, [HEART] לצייר לב שמרפא, [DRAW:flower] או [DRAW:balloon] או [DRAW:dog] או [DRAW:umbrella] לצייר משהו באוויר, [WAIT] לחכות כאן, [FOLLOW] לבוא עם השחקן.',
      this.mode === 'home' ? 'בבית גם: [TV] לראות סרט מצויר על הספה, [COOK] לבשל ביחד, [PAINT] לצייר תמונה לקיר, [SLEEP] לנוח עד הבוקר.' : '',
      'רק תגית אחת, ורק אם זה באמת מה שמבקשים. כשרק מדברים - בלי תגית. אפשר גם [MEM:עובדה קצרה] כדי לזכור משהו חשוב שהשחקן סיפר.',
    ];
    return lines.filter(Boolean).join('\n');
  }

  // her words from Claude, written into the line as they come; null when it cannot answer
  async askClaude(line) {
    const s = this.sample;
    if (!s || this.sampleOff) return null;
    const turns = this.turns.slice(-14).filter((t) => t.content && t.content.trim());
    while (turns.length && turns[0].role !== 'user') turns.shift();
    const input = [{ role: 'user', content: this.rules() }, ...turns];
    if (input[input.length - 1].role !== 'user') return null;
    try {
      const res = await s(input, {
        modelTier: 'quick',
        cache: false,
        onText: ({ text }) => this.chat.write(line, clean(text) || '...'),
      });
      const out = res && res.text ? res.text : null;
      if (out) this.chat.write(line, clean(out) || '...');
      return out;
    } catch (e) {
      const code = e && e.code;
      if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'session_expired'].includes(code)) this.sampleOff = true;
      return null;
    }
  }

  // ------------------------------------------------------------------ her own words (no Claude)
  localReply(text, force) {
    const t = text.trim();
    const d = this.data;
    const you = d.you ? `, ${d.you}` : '';
    const has = (re) => re.test(t);
    const home = this.mode === 'home';
    if (force) {
      const [k, v] = force.split(':');
      if (k === 'GO') {
        const g = GO[v];
        if (v === 'club' && !shopOpen('club', this.hour())) return 'המועדונים נפתחים רק בשלוש אחר הצהריים... אבל בואו נלך לבדוק! [GO:club]';
        return `${pick(['יאללה!', 'רעיון מעולה!', 'אני בעד!', 'בואו!'])} ${g ? g.heb : ''}, אני מובילה. [${force}]`;
      }
      if (k === 'HOME') return `${pick(['בשמחה!', 'כן! בואו אליי.', 'הבית שלי מחכה לנו.'])} [HOME]`;
      if (k === 'BUILD') return `${pick(['בית משלי?! וואו!', 'תמיד חלמתי על בית משלי!', 'כן כן כן!'])} צריך מגרש ריק, בואו נמצא אחד. [BUILD]`;
      if (k === 'DANCE') return `${pick(['מוזיקה!', 'אני כבר רוקדת!', 'בואו נרקוד כמו שאף אחד לא מסתכל!'])} [DANCE]`;
      if (k === 'DRAW') return `${pick(['רגע, מוציאה עיפרון...', 'סגרו עיניים... עכשיו תפתחו!', 'בשבילכם, תמיד.'])} [DRAW:${pick(DRAWABLE)}]`;
      if (k === 'WAIT') return `${pick(['בסדר, אני כאן.', 'אחכה ממש פה.', 'לא זזה מפה!'])} [WAIT]`;
      if (k === 'FOLLOW') return `${pick(['יאללה, בואו!', 'אני איתכם!', 'מוכנה!'])} [FOLLOW]`;
      if (k === 'TV') return `${pick(['יש סרט מצויר חדש!', 'פופקורן? כלומר, ציור של פופקורן.', 'שבו, אני מדליקה.'])} [TV]`;
      if (k === 'COOK') return `${pick(['אני מבשלת, אתם טועמים!', 'פסטה? פנקייק? משהו מצויר וטעים!'])} [COOK]`;
      if (k === 'PAINT') return `${pick(['הקיר שלי מחכה לזה!', 'בואו נצייר משהו ביחד!'])} [PAINT]`;
      if (k === 'SLEEP') return `${pick(['לילה טוב... נתראה בבוקר.', 'קצת שקט. מחר יום חדש.'])} [SLEEP]`;
    }
    if (has(/(קוראים לי|השם שלי)/) && d.you) return pick([`${d.you}! איזה שם יפה. אני אזכור.`, `נעים מאוד, ${d.you}!`, `${d.you}... רושמת לי בלב.`]);
    if (has(/(איך קוראים לך|מה השם שלך|מה שמך|מי את)/)) return pick([`אני ${d.heb}! ציירתם אותי, זוכרים?`, `${d.heb}. בעיפרון, באהבה.`]);
    if (has(/(מה שלומך|איך את|מה איתך|מה נשמע|מה קורה|מה המצב|how are you)/i)) return pick([`מצוין${you}! כשאתם פה, הכול צבעוני יותר.`, 'קצת מחודדת, כמו עיפרון חדש. ואתם?', 'נהדר! רק קצת מפחדת ממחקים.']);
    if (has(/^(היי|הי|שלום|אהלן|הלו|בוקר טוב|ערב טוב|hi|hello|hey)/i)) return pick([`היי${you}!`, 'שלום שלום!', 'אהלן! מה עושים?']);
    if (has(/(ספרי לי|על עצמך|מה את אוהבת)/)) return pick(['נולדתי בדוכן על הטיילת, מעיפרון קסום. הכי כיף לי לצייר, לרקוד ולגלות פינות חדשות בעיר.', 'יש לי חלום: בית קטן עם גג משולש וחלון עגול. ואולי גם כלב מצויר.', 'אני אוהבת שקיעות, גלידת תות וריח של עיפרון מחודד.']);
    if (has(/(בית|הביתה|לגור)/) && has(/(לבנות|לצייר|חדש|משלך)/)) return d.homeKey ? 'כבר יש לי בית! בואו אליי. [HOME]' : 'בית משלי?! וואו. בואו נמצא מגרש ריק. [BUILD]';
    if (has(/(הביתה|אלייך|לבית שלך|איפה את גרה)/)) return d.homeKey ? 'בואו, אני מובילה! [HOME]' : 'עוד אין לי בית... אולי נצייר לי אחד? יש מגרשים ריקים בשכונות.';
    if (has(/(קניון|קניות|לקנות|בגדים|שופינג)/)) return 'קניות! בואו לקניון, אני מכירה את כל החנויות. [GO:mall]';
    if (has(/(מועדון|מסיבה)/)) return shopOpen('club', this.hour()) ? 'הדי ג\'יי כבר מנגן! בואו! [GO:club]' : 'המועדונים נפתחים בשלוש... נלך לבדוק? [GO:club]';
    if (has(/(לרקוד|ריקוד|רוקדים)/)) return 'פה ועכשיו! [DANCE]';
    if (has(/(רעב|רעבה|לאכול|אוכל|מסעדה|פיצה|המבורגר|ארוחה)/)) return 'גם אני רעבה! בואו לאכול. [GO:food]';
    if (has(/(ים|חוף|לשחות|גלים)/)) return 'חוף! חול, גלים ושקיעה. [GO:beach]';
    if (has(/(סרט|קולנוע|תיאטרון|הצגה)/)) return home ? 'יש לי טלוויזיה! [TV]' : 'יש הצגה מצוירת בתיאטרון! [GO:theatre]';
    if (has(/(פארק|לטייל|טיול)/)) return 'טיול בפארק, הכי כיף. [GO:park]';
    if (has(/(תציירי|ציירי|ציור|לצייר)/)) return home ? 'בואו נצייר על הקיר! [PAINT]' : `${pick(['רגע...', 'הנה!', 'בשבילכם.'])} [DRAW:${pick(DRAWABLE)}]`;
    if (has(/(עצוב|עצובה|עייף|עייפה|קשה לי|רע לי|בודד|בודדה|כואב)/)) return pick(['אוי, בואו הנה. לב קטן בשבילכם. [HEART]', 'אני כאן. הכול יהיה בסדר. [HEART]']);
    if (has(/(אוהב אותך|אוהבת אותך|יפה|מהממת|מקסימה|חמודה|את הכי)/)) {
      this.data.love = Math.min(100, (this.data.love || 0) + 4);
      return pick(['אוי, אני מסמיקה... בעיפרון ורוד!', 'תודה! גם אתם הכי.', 'אתם חברים אמיתיים.']);
    }
    if (has(/(בדיחה|תצחיקי|משהו מצחיק)/)) return pick(['למה העיפרון לא הלך לים? כי הוא פחד להימחק בגלים!', 'מה אמר המחק לעיפרון? "בוא נתחיל מההתחלה."', 'למה הקו הישר תמיד רגוע? כי אין לו שום עקומה בחיים.']);
    if (has(/(חכי|תחכי|תישארי|עצרי)/)) return 'בסדר, אני כאן. [WAIT]';
    if (has(/(בואי|תבואי|קדימה|נזוז)/)) return 'אחריכם! [FOLLOW]';
    if (has(/(לישון|לנוח|עייפ)/) && home) return 'לילה טוב... [SLEEP]';
    if (has(/(לבשל|נבשל|ארוחה)/) && home) return 'למטבח! [COOK]';
    if (has(/(תודה|תודה רבה)/)) return pick(['בכיף!', 'תמיד!', 'בשביל זה יש חברים.']);
    if (has(/(ביי|להתראות|לילה טוב|נתראה|bye)/i)) return d.homeKey ? 'להתראות! אני הולכת הביתה, תבואו לבקר. [HOME]' : 'להתראות! אני אחכה כאן. [WAIT]';
    if (has(/(מה השעה|כמה השעה)/)) {
      const h = this.hour();
      return `השעה ${Math.floor(h)}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}. ${h > 20 ? 'הלילה עוד צעיר!' : 'יש עוד המון זמן לכיף.'}`;
    }
    if (has(/(איפה אנחנו|איפה אני)/)) return `אנחנו ב${districtName(this.game.player.pos.x, this.game.player.pos.z) || 'עיר'}. יפה פה, לא?`;
    if (t.endsWith('?')) return pick(['שאלה טובה! מה אתם חושבים?', 'הממ... צריכה לחשוב על זה. בינתיים, לאן נלך?', 'לא בטוחה, אבל בא לי לגלות ביחד!']);
    return pick(['ספרו לי עוד!', 'באמת? וואו.', 'אני מקשיבה...', 'הממ, מעניין. ומה עכשיו?', `אתם יודעים${you}? כיף לי איתכם.`, 'אולי נלך לאנשהו? יש כל כך הרבה לראות.']);
  }

  // ------------------------------------------------------------------ what she does
  // the tags in her words (returns whether she did anything)
  act(reply) {
    const tags = [...reply.matchAll(TAG)];
    let did = false;
    for (const [, k, v] of tags) {
      if (k === 'MEM') {
        if (v) this.remember(v.trim());
        continue;
      }
      if (did) continue;
      did = this.doTag(k, (v || '').trim());
    }
    return did;
  }

  doTag(k, v) {
    const game = this.game;
    if (!this.here) return false;
    const c = this.comp.c;
    const chat = this.chat;
    switch (k) {
      case 'GO': {
        const kind = GO[v] ? v : 'mall';
        const pl = this.placeFor(kind);
        if (!pl) {
          chat.add('note', 'לא נמצא מקום כזה קרוב');
          return false;
        }
        this.lead(pl.x, pl.z, pl.name, () => {
          if (this.here) game.bubbles.say(this.comp.c, pick(['We\'re here!', 'Ta-da!', 'Here it is!']));
        });
        chat.add('note', `${this.heb} מובילה: ${pl.name} (${Math.round(Math.hypot(pl.x - game.player.pos.x, pl.z - game.player.pos.z))} מ׳, הדרך על המפה)`);
        game.bubbles.say(c, GO[kind] ? GO[kind].en : 'Let\'s go!');
        game.inkwell.after(1.2, () => this.chat.open && this.chat.close());
        return true;
      }
      case 'HOME':
        return this.goHome();
      case 'BUILD':
        return this.wantHome();
      case 'DANCE': {
        const p = game.player;
        c.fig.dance = 1;
        p.fig.dance = 1;
        for (let i = 0; i < 4; i++) setTimeout(() => game.audio.play('strum', 0.7), i * 400);
        game.inkwell.after(8, () => {
          c.fig.dance = 0;
          p.fig.dance = 0;
        });
        game.bubbles.say(c, pick(['Woo!', 'Dance with me!', 'Yeah!']));
        game.inkwell.after(0.8, () => this.chat.open && this.chat.close());
        return true;
      }
      case 'HEART':
        this.comp.drawHeart();
        return true;
      case 'DRAW': {
        const shape = DRAWABLE.includes(v) ? v : pick(DRAWABLE);
        const p = game.player;
        const h = c.fig.j.headC;
        const at = new THREE.Vector3((h.x + p.pos.x) / 2, h.y + 0.35, (h.z + p.pos.z) / 2);
        game.airsketch.draw({
          shape,
          at,
          size: 0.75,
          author: c,
          pen: 'magicPencil',
          target: p.fig.j.handR.clone(),
          targetScale: 0.3,
          dur: 1.8,
          hold: 1.2,
          onPlop: () => {
            if (shape === 'balloon') p.fig.carryL = 'balloon';
            else if (shape === 'flower') p.fig.carryL = 'bouquet';
            else if (shape === 'umbrella') game.hud.toast('מטריה מצוירת!', 'good', 1.6);
            for (let i = 0; i < 3; i++) game.fx.sprite('fx_heart', p.pos.x + (Math.random() - 0.5) * 0.6, p.pos.y + 1.8, p.pos.z + (Math.random() - 0.5) * 0.6, { size: 0.28, grow: 0.25, life: 1.3, vy: 0.6, fadeIn: 0.1 });
          },
        });
        return true;
      }
      case 'WAIT':
        this.mode = 'wait';
        this.waitAt = { x: c.pos.x, z: c.pos.z };
        game.inkwell.after(1, () => this.chat.open && this.chat.close());
        return true;
      case 'FOLLOW':
        if (this.mode === 'home') this.leaveHome();
        this.mode = 'follow';
        this.dest = null;
        game.inkwell.after(1, () => this.chat.open && this.chat.close());
        return true;
      case 'TV':
        return this.homeTV();
      case 'COOK':
        return this.homeCook();
      case 'PAINT':
        return this.homePaint();
      case 'SLEEP':
        return this.homeSleep();
      default:
        return false;
    }
  }

  // ------------------------------------------------------------------ home
  goHome() {
    const game = this.game;
    const d = this.data;
    if (!d.homeKey) return this.wantHome();
    const plot = this.plotOf(d.homeKey);
    let x;
    let z;
    if (plot && plot.home) {
      x = plot.home.door[0];
      z = plot.home.door[2];
    } else {
      const rec = (game.world.allPlots || []).find((q) => q[0] === d.homeKey);
      if (!rec) return false;
      x = rec[1];
      z = rec[2];
    }
    this.lead(x, z, `הבית של ${this.heb}`, () => this.enterHome(), 6);
    this.chat.add('note', `${this.heb} מובילה הביתה (${Math.round(Math.hypot(x - game.player.pos.x, z - game.player.pos.z))} מ׳)`);
    game.inkwell.after(1.2, () => this.chat.open && this.chat.close());
    return true;
  }

  // at her door: in she goes, and asks you in
  enterHome() {
    const plot = this.plotOf(this.data.homeKey);
    if (!this.here || !plot || !plot.home || !plot.home.room) return;
    this.mode = 'home';
    this.homeAt = null;
    this.game.bubbles.say(this.comp.c, pick(['Welcome to my home!', 'Come in, come in!', 'Make yourself at home!']));
    this.game.hud.toast(`${this.heb}: "ברוכים הבאים! תיכנסו"`, 'good', 2.6);
  }

  leaveHome() {
    this.mode = 'follow';
    this.homeAt = null;
  }

  // her day at home: the sofa, the easel, the stove; she comes to you when you come in
  atHome(c, dt) {
    const game = this.game;
    const plot = this.plotOf(this.data.homeKey);
    const p = game.player.pos;
    if (!plot || !plot.home || !plot.home.room) {
      // (her house was let go of with its block: she is home, out of sight)
      return this.goHomeAlone();
    }
    const R = plot.home.room;
    const pd = Math.hypot(p.x - c.pos.x, p.z - c.pos.z);
    if (pd > 80) return this.goHomeAlone();
    // outside still: walk in through the door
    if (!R.inside(c.pos.x, c.pos.z, 0.1)) {
      const dd = Math.hypot(R.door.x - c.pos.x, R.door.z - c.pos.z);
      if (dd > 0.4) return { x: R.door.x, z: R.door.z, speed: 1.6 };
    }
    // a guest in the house: to them
    const youIn = R.inside(p.x, p.z, 0.2);
    if (youIn && this.youCame !== true) {
      this.youCame = true;
      game.bubbles.say(c, pick(['You came!', 'Welcome!', 'Sit, sit!']));
    } else if (!youIn) this.youCame = false;
    if (this.homeHold && game.time < this.homeHold.until) return this.toMark(c, R, this.homeHold.mark, this.homeHold.sit, dt);
    this.homeHold = null;
    this.homeT = (this.homeT || 0) - dt;
    if (this.homeT <= 0 || !this.homeAt) {
      this.homeT = 10 + Math.random() * 12;
      const opts = ['sofaA', 'stove', 'easel', 'easel', 'table', 'bed'].filter((k) => R.marks[k] && k !== this.homeAt);
      this.homeAt = youIn && Math.random() < 0.5 ? 'you' : pick(opts);
    }
    if (this.homeAt === 'you') {
      const t = { x: p.x - Math.sin(game.player.yaw + 0.6) * 1.2, z: p.z - Math.cos(game.player.yaw + 0.6) * 1.2 };
      const d = Math.hypot(t.x - c.pos.x, t.z - c.pos.z);
      c.fig.sit = 0;
      if (d < 0.5 || !R.inside(t.x, t.z, -0.3)) {
        c.faceYaw = Math.atan2(p.x - c.pos.x, p.z - c.pos.z);
        return null;
      }
      return { x: t.x, z: t.z, speed: 1.4 };
    }
    return this.toMark(c, R, this.homeAt, this.homeAt === 'sofaA' || this.homeAt === 'table', dt);
  }

  // to a mark of her room (round the furniture), and there: sitting, painting, cooking
  toMark(c, R, name, sit, dt) {
    let t = R.marks[name];
    if (!t) return null;
    if (name === 'table') {
      let best = null;
      let bd = 1.6;
      for (const s of R.seats) {
        const d = Math.hypot(s.x - t.x, s.z - t.z);
        if (d < bd && (!this.game.player.seat || Math.hypot(this.game.player.seat.x - s.x, this.game.player.seat.z - s.z) > 0.3)) {
          bd = d;
          best = s;
        }
      }
      if (!best) return null;
      t = best;
    }
    if (name === 'bed') t = { x: t.x, z: t.z, yaw: t.yaw };
    const d = Math.hypot(t.x - c.pos.x, t.z - c.pos.z);
    if (d > 0.3) {
      c.fig.sit = Math.max(0, c.fig.sit - dt * 3);
      c.fig.reachR = null;
      if (!this.path || this.pathTo !== name) {
        this.pathTo = name;
        this.path = R.path(c.pos.x, c.pos.z, t.x, t.z);
      }
      while (this.path.length > 1 && Math.hypot(c.pos.x - this.path[0].x, c.pos.z - this.path[0].z) < 0.3) this.path.shift();
      const q = this.path[0] || t;
      return { x: q.x, z: q.z, speed: 1.1 };
    }
    this.path = null;
    c.faceYaw = t.yaw;
    c.fig.sit = sit ? Math.min(1, c.fig.sit + dt * 3) : Math.max(0, c.fig.sit - dt * 3);
    if (name === 'easel' || name === 'stove') {
      if (!c.fig.reachR) c.fig.reachR = new THREE.Vector3();
      const k = this.game.time;
      c.fig.reachR.set(c.pos.x + Math.sin(t.yaw) * 0.45 + Math.sin(k * 2.2) * 0.12, c.pos.y + (name === 'easel' ? 1.3 + Math.sin(k * 1.4) * 0.2 : 1.0), c.pos.z + Math.cos(t.yaw) * 0.45 + Math.cos(k * 1.8) * 0.12);
    } else c.fig.reachR = null;
    return null;
  }

  homeRoom() {
    const plot = this.data && this.data.homeKey ? this.plotOf(this.data.homeKey) : null;
    return plot && plot.home ? plot.home.room : null;
  }

  // a film on the sofa (the cartoon drawn on her television, a frame at a time)
  homeTV() {
    const game = this.game;
    const R = this.homeRoom();
    if (!R || this.mode !== 'home') return false;
    const p = game.player;
    const s = R.marks.sofaB;
    if (s) p.seat = { x: s.x, z: s.z, yaw: s.yaw };
    this.homeHold = { mark: 'sofaA', sit: true, until: game.time + 40 };
    this.tv = { k: -1, t: 0.5, R };
    game.inkwell.after(0.6, () => this.chat.open && this.chat.close());
    return true;
  }

  tvLife(dt) {
    const game = this.game;
    const tv = this.tv;
    const R = tv.R;
    const p = game.player;
    const m = R.marks.tv;
    if (!m || !p.seat || !R.inside(p.pos.x, p.pos.z, 0.2)) {
      if (tv.sk) game.airsketch.erase(tv.sk);
      this.tv = null;
      return;
    }
    tv.t -= dt;
    if (tv.t > 0) return;
    tv.t = 3.4;
    tv.k++;
    if (tv.sk) game.airsketch.erase(tv.sk);
    const film = TV_FILM[tv.k % TV_FILM.length];
    const F = R.facade;
    tv.sk = game.airsketch.draw({ shape: film[0], at: new THREE.Vector3(m.x + F.nx * 0.03, m.y, m.z + F.nz * 0.03), size: 0.62, keep: true, dur: 1.4, width: 2.2, wall: { rx: F.rx, rz: F.rz, nx: F.nx, nz: F.nz } });
    game.hud.toast(film[1], 'info', 3);
    if (tv.k % 3 === 2 && this.here) game.bubbles.say(this.comp.c, pick(['Haha!', 'I love this part!', 'Aww...', 'Shh, watch!']));
  }

  // cooking: she at the stove draws a dish, flown to the table, and you eat together
  homeCook() {
    const game = this.game;
    const R = this.homeRoom();
    if (!R || this.mode !== 'home') return false;
    const c = this.comp.c;
    this.homeHold = { mark: 'stove', sit: false, until: game.time + 6 };
    const p = game.player;
    const m = R.marks.table;
    game.inkwell.after(0.6, () => this.chat.open && this.chat.close());
    game.inkwell.after(2.2, () => {
      if (!this.here) return;
      const dish = pick(['pasta', 'pizza', 'dessert', 'gourmet', 'noodles']);
      game.airsketch.draw({
        shape: dish,
        at: new THREE.Vector3(c.pos.x + Math.sin(c.yaw) * 0.6, c.pos.y + 1.5, c.pos.z + Math.cos(c.yaw) * 0.6),
        size: 0.5,
        author: c,
        pen: 'magicPencil',
        target: new THREE.Vector3(m.x, m.y + 0.06, m.z),
        targetScale: 0.6,
        dur: 1.6,
        hold: 0.5,
        onPlop: () => {
          p.hp = Math.min(p.maxHp, p.hp + 50);
          game.hud.toast(`ארוחה של ${this.heb}: +50 חיים`, 'good', 2.6);
          game.bubbles.say(c, pick(['Bon appétit!', 'Taste it!', 'My secret recipe!']));
          this.homeHold = { mark: 'table', sit: true, until: game.time + 12 };
          this.data.love = Math.min(100, (this.data.love || 0) + 3);
          this.save();
        },
      });
    });
    return true;
  }

  // a picture for her wall: drawn together, kept there (it stays while the house is near)
  homePaint() {
    const game = this.game;
    const R = this.homeRoom();
    if (!R || this.mode !== 'home') return false;
    const c = this.comp.c;
    const m = R.marks.wall;
    if (!m) return false;
    const F = R.facade;
    const wall = { rx: F.rx, rz: F.rz, nx: F.nx, nz: F.nz };
    this.homeHold = { mark: 'easel', sit: false, until: game.time + 8 };
    game.inkwell.after(0.6, () => this.chat.open && this.chat.close());
    const k = (this.data.pictures || 0) % 4;
    const at = new THREE.Vector3(m.x + F.rx * (k - 1.5) * 0.9 + F.nx * 0.04, m.y + (k % 2) * 0.1, m.z + F.rz * (k - 1.5) * 0.9 + F.nz * 0.04);
    const sk = game.airsketch.draw({ shape: pick(['flower', 'heart', 'house', 'dog', 'balloon']), at, size: 0.7, author: c, pen: 'magicPencil', keep: true, dur: 2.6, width: 3.0, wall });
    (this.pictures = this.pictures || []).push(sk);
    if (this.pictures.length > 4) game.airsketch.erase(this.pictures.shift());
    this.data.pictures = (this.data.pictures || 0) + 1;
    game.inkwell.after(2.8, () => {
      game.hud.toast('תמונה חדשה על הקיר!', 'good', 2.2);
      if (game.ink) game.ink.fill(game.ink.cap * 0.5, 'מהציור');
    });
    this.save();
    return true;
  }

  // sleep till the morning (in her house: a save, as at the motel)
  homeSleep() {
    const game = this.game;
    if (this.mode !== 'home') return false;
    this.chat.close();
    const PR = game.props;
    if (PR && PR.sleep && PR.sleep()) game.hud.toast(`${this.heb}: "בוקר טוב! הכנתי קפה מצויר."`, 'good', 3);
    return true;
  }

  // ------------------------------------------------------------------ drawing a home
  wantHome() {
    const game = this.game;
    if (this.data.homeKey) return this.goHome();
    const pl = this.nearestPlot();
    if (!pl) {
      this.chat.add('note', 'אין מגרש פנוי בסביבה');
      return false;
    }
    const d = Math.hypot(pl.x - game.player.pos.x, pl.z - game.player.pos.z);
    if (d < 25 && pl.live) {
      this.atPlot(pl.live);
      return true;
    }
    this.lead(pl.x, pl.z, 'מגרש לבית', () => {
      const live = this.plotOf(pl.key);
      if (live && !live.home) this.atPlot(live);
    }, 10);
    this.chat.add('note', `${this.heb} מובילה למגרש ריק (${Math.round(d)} מ׳, הדרך על המפה)`);
    game.inkwell.after(1.2, () => this.chat.open && this.chat.close());
    return true;
  }

  // at the plot: what kind of house?
  atPlot(plot) {
    this.buildPlot = plot;
    if (!this.chat.open) this.openChat(null, 'הנה מגרש! איזה בית לצייר? יש לי כמה רעיונות...');
    else this.chat.add('her', 'איזה בית לצייר? יש לי כמה רעיונות...');
    this.menu = 'style';
    this.refreshChips();
  }

  chooseStyle(style) {
    const game = this.game;
    const plot = this.buildPlot;
    this.menu = 'main';
    if (!plot || plot.home || !this.here) {
      this.chat.add('note', 'המגרש כבר לא פנוי');
      this.refreshChips();
      return;
    }
    this.chat.add('me', HOME_STYLES[style].heb);
    this.chat.add('her', pick(['מושלם! תתרחקו קצת... אני מציירת בגדול!', 'אוקיי! עיפרון קסום, עבודה!', 'יאללה! זה יהיה הבית הכי יפה ברחוב.']));
    this.buildStyle = style;
    this.mode = 'build';
    this.buildPhase = 'walk';
    const f = new Facade(plot.f.ox, plot.f.oz, plot.f.ux, plot.f.uz, plot.f.nx, plot.f.nz);
    this.buildF = f;
    const sk = houseSketch({ L: plot.L, D: plot.D, style, front: PLOT_FRONT });
    this.buildSketch = sk;
    const lay = sk.lay;
    const sp = f.p(lay.uc + 2.4, 0, 1.4);
    this.buildAt = { x: sp[0], z: sp[2], yaw: Math.atan2(-f.nx, -f.nz) };
    game.inkwell.after(1.4, () => this.chat.open && this.chat.close());
  }

  building(c, dt) {
    const game = this.game;
    const b = this.buildAt;
    if (this.buildPhase === 'walk') {
      const d = Math.hypot(b.x - c.pos.x, b.z - c.pos.z);
      if (d > 0.4) {
        this.buildStuck = (this.buildStuck || 0) + dt;
        if (this.buildStuck > 12) {
          c.pos.x = b.x;
          c.pos.z = b.z;
        }
        return { x: b.x, z: b.z, speed: 2.2 };
      }
      this.buildStuck = 0;
      this.buildPhase = 'draw';
      c.faceYaw = b.yaw;
      const f = this.buildF;
      const sk = this.buildSketch;
      const lay = sk.lay;
      const at = f.p(lay.uc, (lay.y0 + lay.vr) / 2, -PLOT_FRONT + 0.45);
      this.buildCenter = new THREE.Vector3(at[0], at[1], at[2]);
      game.hud.toast(`${this.heb} מציירת בית... בעיפרון קסום`, 'info', 3);
      this.buildDrawing = game.airsketch.draw({
        shape: sk.lines,
        at: this.buildCenter,
        size: 1,
        author: c,
        pen: 'magicPencil',
        keep: true,
        dur: 8.5,
        width: 7.5,
        wall: { rx: f.ux, rz: f.uz, nx: f.nx, nz: f.nz },
        onDone: () => this.houseDrawn(),
      });
      game.audio.play('magic', 0.7);
      return null;
    }
    // drawing (and the drawing coming true): facing the plot, the pencil going - a trail of
    // sparkles behind its tip
    c.faceYaw = b.yaw;
    const sk = this.buildDrawing;
    if (sk && sk.phase === 'draw') {
      this.sparkT = (this.sparkT || 0) - dt;
      if (this.sparkT <= 0) {
        this.sparkT = 0.07;
        game.fx.sparks(sk.pen.x, sk.pen.y, sk.pen.z, 2, pick([[1, 0.45, 0.7], [1, 0.85, 0.3], [0.45, 0.75, 1], [0.6, 1, 0.6]]));
      }
    }
    if (this.buildPhase === 'draw' && Math.random() < dt * 0.25) game.bubbles.say(c, pick(['A window here...', 'And a round one up there!', 'Hmm, blue? Blue.', 'Almost...', 'A heart over the door!']));
    return null;
  }

  // the drawing finished: the house is kept, its block built again with it (the drawing stays in
  // the air until the house is there)
  houseDrawn() {
    const game = this.game;
    const plot = this.buildPlot;
    const key = plot.key;
    game.world.homes.set(key, { key, style: this.buildStyle, name: this.data.name, heb: this.data.heb, t: Date.now() });
    this.saveHomes();
    this.data.homeKey = key;
    this.save();
    this.buildPhase = 'wait';
    const bid = Number(String(key).split(':')[0]);
    this.waitBlock = bid;
    this.waitT = game.time;
    if (!game.world.mainland || !game.world.mainland.rebuild(bid)) this.housePlop();
    game.hud.toast('הציור מתעורר לחיים...', 'info', 2.2);
  }

  onBlock(live, on) {
    if (!on || this.waitBlock === null || this.waitBlock === undefined) return;
    if (live.block && live.block.id === this.waitBlock) this.housePlop();
  }

  housePlop() {
    const game = this.game;
    this.waitBlock = null;
    if (this.buildDrawing) game.airsketch.plop(this.buildDrawing, this.buildCenter, 1.0);
    this.buildDrawing = null;
    const at = this.buildCenter || game.player.pos;
    game.fx.confetti(at.x, at.y, at.z, 40, 5);
    // (all along the outline of the drawing: the house comes out of its lines)
    const f = this.buildF;
    if (f && this.buildSketch) {
      const lay = this.buildSketch.lay;
      for (const [u, y] of [[lay.u0, lay.y0 + 0.5], [lay.u1, lay.y0 + 0.5], [lay.u0, lay.wt], [lay.u1, lay.wt], [lay.uc, lay.vr], [lay.ud, lay.y0 + 1.2]]) {
        const q = f.p(u, y, -PLOT_FRONT + 0.3);
        game.fx.confetti(q[0], q[1], q[2], 14, 3);
        game.fx.crumbs(q[0], q[1], q[2], 8, 2);
      }
    }
    for (let i = 0; i < 8; i++) game.fx.sprite('fx_heart', at.x + (Math.random() - 0.5) * 6, at.y + Math.random() * 3, at.z + (Math.random() - 0.5) * 3, { size: 0.5, grow: 0.3, life: 1.8, vy: 0.7, fadeIn: 0.15 });
    game.audio.play('cheer', 0.8);
    game.audio.play('poof', 0.8);
    game.hud.big(`הבית של ${this.heb}!`, 2200);
    if (this.here) {
      game.bubbles.say(this.comp.c, pick(['My house! MY HOUSE!', 'It\'s real! Come in!', 'We did it!']));
      this.data.love = Math.min(100, (this.data.love || 0) + 15);
      this.save();
      // in she goes, and you after her
      this.mode = 'follow';
      const plot = this.plotOf(this.data.homeKey);
      if (plot && plot.home) this.lead(plot.home.door[0], plot.home.door[2], `הבית של ${this.heb}`, () => this.enterHome(), 5);
    }
  }
}

// the cartoon on her television (and its words)
const TV_FILM = [
  ['house', 'פעם, בעיר מצוירת אחת...'],
  ['friend', '...מישהו צייר חברה.'],
  ['heart', 'והיא ציירה לעצמה לב.'],
  ['dog', 'ואז כלב, כי בית צריך כלב.'],
  ['balloon', 'הכלב רצה לעוף...'],
  ['umbrella', '...עד שהתחיל לרדת גשם.'],
  ['flower', 'אבל אחרי גשם באים פרחים.'],
  ['heart', 'הסוף. (או ההתחלה?)'],
];
