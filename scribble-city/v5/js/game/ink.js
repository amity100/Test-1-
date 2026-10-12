// (ROADMAP 9.4, not with ?classic) Ink: what the drawings are drawn with.
//   - the pen holds so much ink (the bottle by the wallet, and a bar over the sheet while you
//     draw); every line drawn in the air uses some of it. Drawn about as long as the blueprint's
//     own lines, a drawing costs what the thing is worth: a stapler a little, a tank a lot.
//     Scribbling over and over costs more. Out of ink, the pen draws no more: finish what is
//     there, or fill it up.
//   - it comes back slowly by itself, a drop at a time; a bottle from a stationery shop fills it
//     up at once; and the Erasers leave some behind when they go.
//   - better tools, from the stationery shops: a soft 2B pencil, a set of markers, an artist's
//     kit. Each holds more ink and makes every drawing better (points onto its score).

export const TOOLS = [
  { id: 'hb', name: 'עיפרון HB', cap: 100, bonus: 0, price: 0 },
  { id: '2b', name: 'עיפרון 2B רך', cap: 125, bonus: 4, price: 90 },
  { id: 'markers', name: 'ערכת טושים', cap: 160, bonus: 8, price: 260 },
  { id: 'kit', name: 'ערכת אמן מקצועית', cap: 200, bonus: 12, price: 650 },
];
export const BOTTLE = 20; // $: a bottle of ink, the pen full again
const TRICKLE = 0.25; // ink a second, by itself
const ENEMY_INK = 12; // what an Eraser leaves behind
// what a drawing of its own length costs, by how hard the thing is (1..5)
const COST = [0, 16, 22, 30, 40, 50];

export class Ink {
  constructor(game) {
    this.game = game;
    this.tool = 0;
    this.level = TOOLS[0].cap;
    this.stats = { used: 0, bottles: 0, tools: 0, dry: 0, found: 0 };
    this.el = document.getElementById('ink');
    this.fillEl = document.getElementById('ink-fill');
    this.airEl = document.getElementById('air-ink');
    this.airFill = document.getElementById('air-ink-fill');
    if (this.el) this.el.classList.remove('hidden');
    this.shown = -1;
    this.render();
  }

  get cap() {
    return TOOLS[this.tool].cap;
  }

  get bonus() {
    return TOOLS[this.tool].bonus;
  }

  get toolName() {
    return TOOLS[this.tool].name;
  }

  // ------------------------------------------------------------------ drawing (ui/airdraw.js)
  // the ink a metre of line on the sheet takes, for blueprint bp whose own lines are len long
  rate(bp, len) {
    return (COST[bp.difficulty] || 30) / Math.max(0.5, len);
  }

  // the pen goes on by d metres on the sheet: false when there is not enough ink for it
  use(d, rate) {
    const n = d * rate;
    if (this.level <= 0) return false;
    this.level = Math.max(0, this.level - n);
    this.stats.used += n;
    this.render();
    if (this.level <= 0) {
      this.stats.dry++;
      this.game.audio.play('meh', 0.5);
    }
    return true;
  }

  get dry() {
    return this.level <= 0.01;
  }

  // ------------------------------------------------------------------ filling up
  fill(n, why = null) {
    const was = this.level;
    this.level = Math.min(this.cap, this.level + n);
    this.render();
    if (why && this.level - was >= 1) this.game.hud.toast(`+${Math.round(this.level - was)} דיו ${why}`, 'good', 1.8);
    return this.level - was;
  }

  // a bottle from the shop (paid for there: game/streetlife.js inkShelf): the pen full again
  refill() {
    const g = this.game;
    this.level = this.cap;
    this.stats.bottles++;
    this.render();
    g.audio.play('pour', 0.6);
    g.hud.toast('העט מלא דיו!', 'good', 2);
  }

  // a better tool (paid for in the shop): more ink, better drawings; full when bought
  upgrade(i) {
    const g = this.game;
    const T = TOOLS[i];
    if (!T || i <= this.tool) return false;
    this.tool = i;
    this.level = T.cap;
    this.stats.tools++;
    this.render();
    g.audio.play('ding', 0.6);
    g.hud.toast(`${T.name}! עד ${T.cap} דיו בעט, ו־${T.bonus}+ לכל ציור`, 'good', 3.4);
    return true;
  }

  // an Eraser gone: some ink left behind (game/game.js)
  fromEnemy(e) {
    const G = this.game.gangs;
    if (!e || !G || G.gangOf(e) !== 'erasers') return;
    if (this.fill(ENEMY_INK, 'מהמחק שנפל') > 0) this.stats.found++;
  }

  update(dt) {
    if (this.level < this.cap) {
      this.level = Math.min(this.cap, this.level + TRICKLE * dt);
      this.render();
    }
  }

  // the bottle by the wallet, and the bar over the sheet
  render() {
    const k = Math.round((this.level / this.cap) * 100);
    if (k === this.shown) return;
    this.shown = k;
    if (this.fillEl) this.fillEl.style.height = `${k}%`;
    if (this.airFill) this.airFill.style.width = `${k}%`;
    if (this.el) this.el.classList.toggle('low', k < 20);
    if (this.airEl) this.airEl.classList.toggle('low', k < 20);
  }

  // ------------------------------------------------------------------ the save (game/save.js)
  save() {
    return { level: Math.round(this.level * 10) / 10, tool: this.tool };
  }

  load(s) {
    if (!s) return;
    if (Number.isInteger(s.tool) && s.tool >= 0 && s.tool < TOOLS.length) this.tool = s.tool;
    if (Number.isFinite(s.level)) this.level = Math.max(0, Math.min(this.cap, s.level));
    this.shown = -1;
    this.render();
  }
}
