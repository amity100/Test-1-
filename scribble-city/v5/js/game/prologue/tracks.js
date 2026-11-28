// (v5, ROADMAP 18.9) The prologue's recorded sound: the music and the air made for it (ElevenLabs:
// v5/audio/prologue/music/, v5/audio/prologue/sfx/), played from files where the score and the
// soundscape had only their own synthesis - which stays as it was for whatever is not loaded (yet,
// or at all: offline, or the file missing).
//
//   loadTrack(ctx, path)        the file decoded, once for all (a promise of the buffer, or null)
//   trackBuf(path)              the buffer if it is in already, or null
//   new Looper(c, buf, out, o)  a stretch of a buffer played over and over, each time into the next
//                               with a crossfade - no seam, whatever the file's own ends (an mp3's
//                               are a few milliseconds of silence): o.a, o.b the stretch (seconds),
//                               o.x the crossfade, o.from where the first time starts in it, o.rate,
//                               o.once (just the one time, from o.from to o.b). pump(now) writes the
//                               next time in ahead of it; stop(t) ends it.

const url = (path) => new URL(`${window.__gameBase ? '' : '../../../'}audio/prologue/${path}`, window.__gameBase || import.meta.url).href;

const loading = new Map();
const loaded = new Map();

export function loadTrack(c, path) {
  if (!c || typeof fetch === 'undefined') return Promise.resolve(null);
  if (!loading.has(path)) {
    const p = fetch(url(path))
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((ab) => (ab ? new Promise((res) => c.decodeAudioData(ab, res, () => res(null))) : null))
      .catch(() => null)
      .then((b) => {
        if (b) loaded.set(path, b);
        return b;
      });
    loading.set(path, p);
  }
  return loading.get(path);
}

export function trackBuf(path) {
  return loaded.get(path) || null;
}

export class Looper {
  constructor(c, buf, out, o = {}) {
    this.c = c;
    this.buf = buf;
    this.out = out;
    this.a = o.a || 0;
    this.b = Math.min(o.b || buf.duration, buf.duration);
    this.x = Math.min(o.x !== undefined ? o.x : 1.5, (this.b - this.a) / 3);
    this.rate = o.rate || 1;
    this.once = !!o.once;
    this.from = o.from !== undefined ? o.from : this.a;
    this.next = o.t0 !== undefined ? o.t0 : c.currentTime;
    this.first = true;
    this.until = Infinity;
    this.srcs = [];
  }

  // the times due in the next ahead seconds written in
  pump(now, ahead = 2) {
    while (this.next < now + ahead && this.next < this.until) {
      const c = this.c;
      const from = this.first ? this.from : this.a;
      const len = (this.b - from) / this.rate;
      if (len <= 0.05) break;
      const s = c.createBufferSource();
      s.buffer = this.buf;
      s.playbackRate.value = this.rate;
      const g = c.createGain();
      const t = this.next;
      const x = this.x / this.rate;
      // (in over the crossfade - but the very first at once: its cue fades it in - and out over it)
      if (this.first) g.gain.setValueAtTime(1, t);
      else {
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(1, t + x);
      }
      if (!this.once) {
        g.gain.setValueAtTime(1, t + len - x);
        g.gain.linearRampToValueAtTime(0, t + len);
      }
      s.connect(g).connect(this.out);
      s.start(t, from);
      s.stop(t + len + 0.05);
      const rec = { s, g };
      this.srcs.push(rec);
      s.onended = () => {
        g.disconnect();
        const i = this.srcs.indexOf(rec);
        if (i >= 0) this.srcs.splice(i, 1);
      };
      this.first = false;
      if (this.once) {
        this.until = 0;
        break;
      }
      this.next = t + len - x;
    }
  }

  // (slower and lower from t, over secs: a music box winding down)
  sag(t, rate, secs) {
    for (const { s } of this.srcs) {
      const p = s.playbackRate;
      p.cancelScheduledValues(t);
      p.setValueAtTime(p.value, t);
      p.linearRampToValueAtTime(rate, t + secs);
    }
    this.until = Math.min(this.until, t);
  }

  stop(t) {
    this.until = Math.min(this.until, t);
    for (const { s } of this.srcs) {
      try {
        s.stop(t);
      } catch (e) {
        // (stopped already)
      }
    }
  }
}
