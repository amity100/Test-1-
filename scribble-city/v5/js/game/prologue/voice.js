import { LINES } from './lines.js';

// (v5, ROADMAP 18) The prologue's voices: every line recorded (v5/audio/prologue/<id>.mp3, made with
// an open neural voice model - one voice for each of them), loaded as soon as there is sound, played
// as it is said, the speaker's mouth saying the words with it (render/people.js reads them off the
// text at the voice's own pace) and the words under the picture. Also the sound of the kids up on the
// wheel - their calls and their laughing, cut off at once when it goes - and the memory of two of
// them, coming back in the silence after.

// (the game's folder as main.js tells it - the same whether the code comes one file at a time or
// all in one; without it, from this file's own place)
const url = (name) => new URL(`${window.__gameBase ? '' : '../../../'}audio/prologue/${name}.mp3`, window.__gameBase || import.meta.url).href;
// (lines seen and not heard: a laugh a voice model would only make sound false - her face laughs)
const SILENT = new Set(['L05']);

export class PrologueVoices {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.buf = new Map();
    this.loading = null;
    this.playing = new Set();
    this.bedSrc = null;
    this.bedGain = null;
  }

  get ctx() {
    return this.game.audio && this.game.audio.ctx;
  }

  // everything fetched and decoded (in the background: the opening does not wait for it)
  load() {
    if (this.loading) return this.loading;
    const c = this.ctx;
    if (!c) return Promise.resolve();
    const names = [...Object.keys(LINES), 'kids_bed', 'kids_memory'];
    this.loading = Promise.all(
      names.map((n) =>
        fetch(url(n))
          .then((r) => (r.ok ? r.arrayBuffer() : null))
          .then((ab) => (ab ? c.decodeAudioData(ab) : null))
          .then((b) => {
            if (b) this.buf.set(n, b);
          })
          .catch(() => {}),
      ),
    );
    return this.loading;
  }

  out() {
    const a = this.game.audio;
    return a.fx || a.master;
  }

  // a line said by who (a figure: Danny's, Lily's, somebody's - or null for a voice on the phone):
  // its voice, its words on the speaker's mouth, its subtitle. Returns how long it lasts (seconds)
  say(id, fig = null, o = {}) {
    const L = LINES[id];
    if (!L) return 0;
    const dur = L.dur;
    const c = this.ctx;
    const b = this.buf.get(id);
    if (c && b && this.game.audio.enabled && !SILENT.has(id)) {
      const s = c.createBufferSource();
      s.buffer = b;
      const g = c.createGain();
      g.gain.value = o.gain !== undefined ? o.gain : 1.15;
      s.connect(g).connect(this.out());
      s.start();
      const rec = { s, g };
      this.playing.add(rec);
      s.onended = () => this.playing.delete(rec);
    }
    if (fig) fig.say = { text: L.en, tone: o.tone || 'talk', at: 0, atT: this.game.time, cps: L.en.length / Math.max(0.4, dur), wait: false, done: false };
    if (this.ui && o.sub !== false) this.ui.sub(L.who, L.en, L.he, dur + 0.35);
    return dur;
  }

  // the kids on the wheel: on (a loop, as loud as near as you are - k), or cut dead
  bed(on, k = 1) {
    const c = this.ctx;
    if (!c) return;
    if (on) {
      const b = this.buf.get('kids_bed');
      if (!b) return;
      if (!this.bedSrc) {
        const s = c.createBufferSource();
        s.buffer = b;
        s.loop = true;
        const g = c.createGain();
        g.gain.value = 0;
        s.connect(g).connect(this.out());
        s.start();
        this.bedSrc = s;
        this.bedGain = g;
      }
      this.bedGain.gain.setTargetAtTime(0.55 * k, c.currentTime, 0.3);
    } else if (this.bedSrc) {
      // (cut: no fade at all)
      this.bedGain.gain.cancelScheduledValues(c.currentTime);
      this.bedGain.gain.setValueAtTime(0, c.currentTime);
      try {
        this.bedSrc.stop();
      } catch (e) {
        // already stopped
      }
      this.bedSrc = null;
      this.bedGain = null;
    }
  }

  memory(gain = 0.5) {
    const c = this.ctx;
    const b = this.buf.get('kids_memory');
    if (!c || !b) return 0;
    const s = c.createBufferSource();
    s.buffer = b;
    const g = c.createGain();
    g.gain.value = gain;
    s.connect(g).connect(this.out());
    s.start();
    return b.duration;
  }

  // quiet (skipped, or over)
  stop() {
    for (const r of this.playing) {
      try {
        r.s.stop();
      } catch (e) {
        // already stopped
      }
    }
    this.playing.clear();
    this.bed(false);
  }
}
