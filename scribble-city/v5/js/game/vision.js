import { tr } from '../core/lang.js';
import { clamp } from '../core/util.js';

// (R27, the owner's word: "a special vision - a button, like the eagle's sight in Assassin's Creed but in colours: an acid,
// dreamy look - strong contrast, strong full colours, a little blurred; time slows; and the blueprint near you glows")
// The picture: the game's canvas through a colour filter (saturated, contrasted, a slow drift of hue, a touch of blur) under
// a ring of colour round the edges; the city's clock slowed (game.js timeK); the nearest hidden blueprint lit up where it is
// (game/finds.js draw) and marked on the screen through walls, with its distance - an arrow at the edge when it is behind.
// A few seconds of it, then it recharges: a ring round the button fills back up.
const DUR = 7; // seconds (the real clock's) it lasts
const COOL = 9; // seconds to charge again after
const SLOW = 0.38; // the city's pace while it is on
export const FAR = 160; // a blueprint as near as this is shown

const CSS = `
#vision-fx{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:0;transition:opacity .35s}
#vision-fx.on{opacity:1}
#vision-fx .vv{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,transparent 42%,rgba(255,40,190,.28) 70%,rgba(40,230,255,.5) 100%);mix-blend-mode:screen}
#vision-fx .vc{position:absolute;inset:-30%;background:conic-gradient(from 0deg,rgba(255,0,170,.16),rgba(255,230,0,.12),rgba(0,255,200,.16),rgba(90,80,255,.16),rgba(255,0,170,.16));mix-blend-mode:overlay;filter:blur(30px)}
#vision-mark{position:fixed;left:0;top:0;z-index:5;pointer-events:none;display:none;transform:translate(-50%,-50%);text-align:center;font:700 12px/1.1 system-ui,sans-serif;color:#fff;text-shadow:0 0 6px #ff2fb8,0 0 2px #000}
#vision-mark .vr{width:46px;height:46px;margin:0 auto 3px;border-radius:50%;border:3px solid #ffe14d;box-shadow:0 0 14px 4px #ff2fb8,inset 0 0 12px 2px #3cf2ff;animation:vpulse 1s ease-in-out infinite}
#vision-mark .vr.edge{width:30px;height:30px;border-radius:6px;transform:rotate(45deg)}
#vision-mark .vd{white-space:nowrap}
@keyframes vpulse{0%,100%{transform:scale(.86)}50%{transform:scale(1.12)}}
#btn-vision{position:fixed;z-index:5;display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;border:2px solid #1b1430;padding:0;background:conic-gradient(#ff4fd8 var(--vk,100%),rgba(255,253,246,.9) 0);box-shadow:0 2px 0 #1b1430;cursor:pointer;left:calc(max(10px,env(safe-area-inset-left)) + 212px);top:max(8px,env(safe-area-inset-top))}
@media (max-height:520px){#btn-vision{width:36px;height:36px;left:calc(max(10px,env(safe-area-inset-left)) + 230px)}body.touch #saving{left:calc(max(12px,env(safe-area-inset-left)) + 274px)}}
#btn-vision .ico{width:22px;height:22px;border-radius:50%;background:rgba(255,253,246,.95);display:flex;align-items:center;justify-content:center}
#btn-vision svg{width:18px;height:18px;fill:none;stroke:#1b1430;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#btn-vision.ready{animation:vready 1.6s ease-in-out infinite}
#btn-vision.on .ico{background:#ffe14d}
@keyframes vready{0%,100%{box-shadow:0 2px 0 #1b1430}50%{box-shadow:0 2px 0 #1b1430,0 0 10px 3px #ff4fd8}}
body:not(.touch) #btn-vision{display:none}
#btn-vision.off{display:none}
body.prologue-film #btn-vision,body.paused #btn-vision,body.fd-open #btn-vision,body.phone-cam #btn-vision,body.boxing #btn-vision,body.prologue-film #vision-fx,body.prologue-film #vision-mark{display:none !important}
`;

export class Vision {
  constructor(game) {
    this.game = game;
    this.on = false;
    this.k = 0; // how much of it is in the picture, 0..1
    this.t = 0;
    this.cool = 0;
    this.filterSet = '';
    this.uses = 0;
    if (typeof document === 'undefined') return;
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    this.fx = document.createElement('div');
    this.fx.id = 'vision-fx';
    this.fx.innerHTML = '<div class="vc"></div><div class="vv"></div>';
    // (right over the picture, under everything drawn over it - the HUD, the buttons)
    const vp = document.getElementById('viewport');
    if (vp) vp.after(this.fx);
    else document.body.appendChild(this.fx);
    this.mark = document.createElement('div');
    this.mark.id = 'vision-mark';
    this.mark.innerHTML = '<div class="vr"></div><div class="vd"></div>';
    document.body.appendChild(this.mark);
    this.cone = this.fx.querySelector('.vc');
    this.ring = this.mark.querySelector('.vr');
    this.dEl = this.mark.querySelector('.vd');
    // (a phone: an eye beside the pause and the phone, up top; a keyboard: O)
    const b = document.createElement('button');
    b.id = 'btn-vision';
    b.className = 'tbtn small off';
    this.off = true;
    b.setAttribute('aria-label', tr('ראייה מיוחדת', 'Special vision'));
    b.innerHTML = '<span class="ico"><svg viewBox="0 0 24 24"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3.2"/></svg></span>';
    b.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.toggle();
    }, { passive: false });
    b.addEventListener('click', () => this.toggle());
    document.body.appendChild(b);
    this.btn = b;
  }

  // (not over the film, the pause, the pen, the phone's camera, the ring)
  can() {
    const g = this.game;
    if (g.state !== 'play') return false;
    if (typeof document !== 'undefined' && document.body.classList.contains('prologue-film')) return false;
    if (g.phoneCam || (g.freedraw && g.freedraw.isOpen) || (g.boxing && g.boxing.active)) return false;
    const cv = g.renderer && g.renderer.domElement;
    // (another of the game's own looks on the picture - the rewind's sepia, the comic's ink: not over it)
    if (cv && cv.style.filter && cv.style.filter !== this.filterSet) return false;
    return true;
  }

  toggle() {
    if (this.on) {
      this.stop();
      return;
    }
    if (this.cool > 0) {
      if (this.game.hud) this.game.hud.toast(tr(`הראייה נטענת — עוד ${Math.ceil(this.cool)} שניות`, `Vision recharging — ${Math.ceil(this.cool)} s`), 'info', 1.6);
      return;
    }
    if (!this.can()) return;
    this.on = true;
    this.t = 0;
    this.uses++;
    const g = this.game;
    if (g.audio) g.audio.play('pageflip', 0.5);
    const s = this.nearest();
    if (g.hud && !s) g.hud.toast(tr('אין שרטוט מוסתר קרוב כאן', 'No hidden blueprint near here'), 'info', 2.2);
  }

  stop() {
    if (!this.on) return;
    this.on = false;
    // (stopped early: the charge back by how much of it was used)
    this.cool = COOL * clamp(this.t / DUR, 0.35, 1);
  }

  // the city's clock while it is on (game.js)
  timeK() {
    return 1 - (1 - SLOW) * this.k;
  }

  // the nearest hidden blueprint not yet his (in the story's lessons, only the one the lesson is about - game/finds.js mayTell)
  nearest() {
    const F = this.game.finds;
    if (!F || !F.on || !F.spots) return null;
    const p = this.game.player;
    const at = p.inVehicle ? p.inVehicle.pos : p.pos;
    let best = null;
    let bd = FAR;
    for (const s of F.spots) {
      if (s.gone || F.has(s.f.id) || (F.mayTell && !F.mayTell(s.f))) continue;
      const d = Math.hypot(s.x - at.x, s.y - at.y, s.z - at.z);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    this.nearD = bd;
    return best;
  }

  update(realDt) {
    const g = this.game;
    if (typeof document === 'undefined') return;
    const dt = Math.min(0.1, realDt || 0);
    if (this.on) {
      this.t += dt;
      if (this.t > DUR || !this.can()) this.stop();
    } else if (this.cool > 0) this.cool = Math.max(0, this.cool - dt);
    const want = this.on ? 1 : 0;
    this.k += (want - this.k) * Math.min(1, dt * (this.on ? 5 : 3));
    if (Math.abs(this.k - want) < 0.004) this.k = want;
    // (the button: the charge round it, and a slow glow when it is ready; only in the game itself - not on the start screen)
    if (this.btn) {
      const off = !(g.state === 'play' || g.state === 'paused') || !g.finds || !g.finds.on;
      if (off !== this.off) {
        this.off = off;
        this.btn.classList.toggle('off', off);
      }
      const left = this.on ? 1 - this.t / DUR : 1 - this.cool / COOL;
      const pct = Math.round(clamp(left, 0, 1) * 100);
      if (pct !== this.pct) {
        this.pct = pct;
        this.btn.style.setProperty('--vk', pct + '%');
      }
      const cls = `${this.on}|${!this.on && this.cool <= 0}`;
      if (cls !== this.cls) {
        this.cls = cls;
        this.btn.classList.toggle('on', this.on);
        this.btn.classList.toggle('ready', !this.on && this.cool <= 0);
      }
    }
    // (the picture)
    const cv = g.renderer && g.renderer.domElement;
    if (cv) {
      let f = '';
      if (this.k > 0.002) {
        const k = this.k;
        const hue = Math.sin(performance.now() / 1400) * 28 * k;
        f = `saturate(${(1 + 1.9 * k).toFixed(2)}) contrast(${(1 + 0.5 * k).toFixed(2)}) brightness(${(1 + 0.08 * k).toFixed(2)}) hue-rotate(${hue.toFixed(1)}deg) blur(${(0.9 * k).toFixed(2)}px)`;
      }
      // (only its own: what another look put on the picture is not taken off)
      if (f !== this.filterSet && (cv.style.filter === this.filterSet || cv.style.filter === '')) {
        cv.style.filter = f;
        this.filterSet = f;
      }
    }
    const fxOn = this.k > 0.02;
    if (fxOn !== this.fxOn) {
      this.fxOn = fxOn;
      this.fx.classList.toggle('on', fxOn);
    }
    if (fxOn && this.cone) this.cone.style.transform = `rotate(${((performance.now() / 40) % 360).toFixed(1)}deg)`;
    // (the blueprint: marked where it is, through walls; at the edge of the screen when it is out of sight)
    const s = this.k > 0.3 ? this.nearest() : null;
    if (!s) {
      if (this.markOn) {
        this.markOn = false;
        this.mark.style.display = 'none';
      }
      this.target = null;
      return;
    }
    this.target = s;
    const cam = g.camera;
    const v = this.v || (this.v = cam.position.clone());
    v.set(s.x, s.y, s.z).project(cam);
    const W = window.innerWidth;
    const H = window.innerHeight;
    let x = (v.x * 0.5 + 0.5) * W;
    let y = (-v.y * 0.5 + 0.5) * H;
    const behind = v.z > 1;
    const m = 40;
    const edge = behind || x < m || x > W - m || y < m || y > H - m;
    if (edge) {
      // (behind: the other way round)
      let dx = x - W / 2;
      let dy = y - H / 2;
      if (behind) {
        dx = -dx;
        dy = -dy;
      }
      const sc = Math.min((W / 2 - m) / Math.max(1e-3, Math.abs(dx)), (H / 2 - m) / Math.max(1e-3, Math.abs(dy)));
      x = W / 2 + dx * sc;
      y = H / 2 + dy * sc;
    }
    if (!this.markOn) {
      this.markOn = true;
      this.mark.style.display = 'block';
    }
    this.ring.classList.toggle('edge', edge);
    this.mark.style.left = x.toFixed(0) + 'px';
    this.mark.style.top = y.toFixed(0) + 'px';
    const dm = Math.round(this.nearD);
    const txt = `${tr('שרטוט', 'Blueprint')} · ${dm} ${tr('מ׳', 'm')}${s.ny > 0.7 ? ' ' + tr('(גג)', '(roof)') : ''}`;
    if (txt !== this.txt) {
      this.txt = txt;
      this.dEl.textContent = txt;
    }
  }
}
