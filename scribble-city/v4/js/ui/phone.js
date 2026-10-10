import { sticker } from './mapglyphs.js';
import { districtName } from '../world/layout.js';
import * as store from '../core/store.js';
import { fmt } from '../game/money.js';

// The phone (ROADMAP 2.6): a phone drawn in the notebook's pen, out of your pocket with P (the
// d-pad's left, or the phone button on a touch screen). Its apps:
//   the map      the city's map (ui/citymap.js); closing it comes back to the phone
//   the camera   a viewfinder over the game: look around, walk, and take a drawn picture of what
//                you see. It is kept in the phone with where and when it was taken.
//   the photos   the pictures, big, to keep on the device or to throw away
//   settings     the pause menu's settings
//   skills       (ROADMAP 5.6, not with ?classic) what the hero got better at (game/skills.js)
//   the bank     (ROADMAP 8.1, not with ?classic) the bank and the cash, what came in and went
//                out (game/money.js)
//   properties   (ROADMAP 8.2, not with ?classic) the places that can be yours: buy one, or find
//                it on the map (game/properties.js)
// Contacts and missions come later. The game waits while the phone is in your hand (not while
// the camera is up).

const MAX_PHOTOS = 24;
const SKY = { clear: 'בהיר', cloudy: 'מעונן', drizzle: 'טפטוף', rain: 'גשם', storm: 'סערה', fog: 'ערפל' };
const APPS = [
  { id: 'map', name: 'מפה', glyph: 'mapApp', fill: '#a6e5e1' },
  { id: 'camera', name: 'מצלמה', glyph: 'camera', fill: '#ffc580' },
  { id: 'photos', name: 'תמונות', glyph: 'photos', fill: '#ff9ccc' },
  { id: 'settings', name: 'הגדרות', glyph: 'gear', fill: '#d2c0f3' },
];

const $ = (id) => document.getElementById(id);

export class Phone {
  constructor(game) {
    this.game = game;
    this.isOpen = false;
    this.cam = false;
    this.pageName = 'home';
    this.viewKey = null;
    this.el = $('phone');
    this.vf = $('phone-cam');
    for (const a of APPS) this.addApp(a);
    for (const b of this.el.querySelectorAll('.phone-back')) b.addEventListener('click', () => this.back());
    $('phone-home-btn').addEventListener('click', () => this.close());
    $('phone-del').addEventListener('click', () => this.deleteViewed());
    // keeping a photo on the device: a plain link in a browser of its own; in the claude.ai viewer
    // the page asks the viewer through its downloads capability (and shows no button without it)
    this.framed = !!(window.claude && window.claude.use);
    this.dlCap = null;
    if (this.framed) {
      window.claude
        .use('downloads')
        .then((d) => (this.dlCap = d))
        .catch(() => (this.dlCap = null));
    }
    $('phone-dl').addEventListener('click', (e) => {
      if (!this.framed) return;
      e.preventDefault();
      this.saveViewed();
    });
    $('vf-shoot').addEventListener('click', (e) => {
      e.stopPropagation();
      this.shoot();
    });
    $('vf-back').addEventListener('click', (e) => {
      e.stopPropagation();
      this.camBack();
    });
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      const k = e.code;
      const eat = () => {
        e.preventDefault();
        const inp = this.game.input;
        if (inp && inp.pressed) inp.pressed.delete(k);
      };
      if (k === 'Escape' || k === 'KeyP' || k === 'Backspace') {
        eat();
        if (k === 'KeyP') this.close();
        else this.back();
      } else if (k.startsWith('Arrow')) {
        eat();
        this.step(k === 'ArrowLeft' || k === 'ArrowDown' ? 1 : -1);
      }
    });
  }

  addApp(a) {
    const b = document.createElement('button');
    b.className = 'app';
    b.dataset.app = a.id;
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    g.scale(4, 4);
    sticker(g, 16, 15.5, a.glyph, a.fill, 13, { square: true, scale: 1.15 });
    b.appendChild(c);
    const s = document.createElement('span');
    s.textContent = a.name;
    b.appendChild(s);
    b.addEventListener('click', () => this.app(a.id));
    $('phone-apps').appendChild(b);
  }

  // ------------------------------------------------------------------ in and out of the pocket
  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.page('home');
    this.el.classList.remove('hidden');
    this.el.classList.remove('up');
    void this.el.offsetWidth;
    this.el.classList.add('up');
    this.status();
    clearInterval(this.statusT);
    this.statusT = setInterval(() => this.status(), 1000);
    this.game.audio.play('click', 0.5);
    const first = this.el.querySelector('.app');
    if (first && !this.game.touch) first.focus({ preventScroll: true });
  }

  // put away (closed by the game when an app takes the screen: then quietly)
  close(quiet = false) {
    if (!this.isOpen) return;
    this.isOpen = false;
    clearInterval(this.statusT);
    this.el.classList.add('hidden');
    if (!quiet && this.game.onPhoneClosed) this.game.onPhoneClosed();
  }

  back() {
    if (this.pageName === 'view') this.page('photos');
    else if (this.pageName !== 'home') this.page('home');
    else this.close();
  }

  page(name) {
    this.pageName = name;
    for (const p of this.el.querySelectorAll('.phone-page')) p.classList.toggle('hidden', p.id !== `phone-${name}`);
    if (name === 'photos') this.fillPhotos();
    if (name === 'skills') this.fillSkills();
    if (name === 'bank') this.fillBank();
    if (name === 'props') this.fillProps();
  }

  status() {
    const g = this.game;
    $('phone-clock').textContent = g.daynight ? g.daynight.clock : '';
    $('phone-sky').textContent = g.weather ? SKY[g.weather.kind] || '' : '';
  }

  // arrows go through the buttons of the page (in their order on the page)
  step(d) {
    const page = this.el.querySelector('.phone-page:not(.hidden)');
    const list = [...page.querySelectorAll('button, a')].filter((b) => b.offsetParent !== null);
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    const next = list[(i + d + list.length) % list.length] || list[0];
    next.focus({ preventScroll: false });
  }

  app(id) {
    const g = this.game;
    g.audio.play('click', 0.5);
    if (id === 'map') {
      this.close(true);
      g.openMap('phone');
    } else if (id === 'camera') this.startCam();
    else if (id === 'photos') this.page('photos');
    else if (id === 'skills') this.page('skills');
    else if (id === 'bank') this.page('bank');
    else if (id === 'props') this.page('props');
    else if (id === 'graffiti') {
      // (ROADMAP 9.3: over the wall in front of you)
      this.close(true);
      g.spray(true);
    }
    else if (id === 'settings') {
      this.close(true);
      g.showPauseMenu();
    }
  }

  // ------------------------------------------------------------------ the camera
  startCam() {
    const g = this.game;
    this.close(true);
    this.cam = true;
    g.phoneCam = true;
    document.body.classList.add('phone-cam');
    this.vf.classList.remove('hidden');
    $('vf-hint').textContent = g.pad && g.pad.active ? 'Ⓐ / RT — צילום · Ⓑ — חזרה לטלפון' : g.touch ? '' : 'קליק או רווח — צילום · Esc — חזרה לטלפון';
    g.state = 'play';
    if (!g.touch) g.input.requestLock(true);
  }

  camBack() {
    if (!this.cam) return;
    const g = this.game;
    this.cam = false;
    g.phoneCam = false;
    document.body.classList.remove('phone-cam');
    this.vf.classList.add('hidden');
    g.state = 'paused';
    g.input.releaseLock();
    this.open();
  }

  // the camera's keys, every frame it is up (the weapons wait: a click takes a picture)
  camKeys(input) {
    if (input.firePressed || input.wasPressed('Space') || input.wasPressed('Enter')) this.shoot();
    input.fire = false;
    input.firePressed = false;
    if (input.wasPressed('Escape') || input.wasPressed('KeyP')) this.camBack();
  }

  // a drawn picture of what is on the screen: drawn again now and copied before the browser shows
  // it (and lets it go), in a white frame with where and when, written by hand
  shoot() {
    const g = this.game;
    if (!this.cam || this.shooting) return;
    this.shooting = true;
    const src = g.renderer.domElement;
    g.renderFrame();
    const W = 960;
    const H = Math.round((W * src.height) / Math.max(1, src.width));
    const pad = 28;
    const cap = 92;
    const c = document.createElement('canvas');
    c.width = W + pad * 2;
    c.height = H + pad + cap;
    const x = c.getContext('2d');
    x.fillStyle = '#fbf7ee';
    x.fillRect(0, 0, c.width, c.height);
    x.drawImage(src, pad, pad, W, H);
    x.strokeStyle = '#1b1430';
    x.lineWidth = 3;
    x.strokeRect(pad, pad, W, H);
    const p = g.player.inVehicle ? g.player.inVehicle.pos : g.player.pos;
    const where = districtName(p.x, p.z) || 'עיר השרבוטים';
    const clock = g.daynight ? g.daynight.clock : '';
    x.fillStyle = '#1b1430';
    x.font = '46px "Gveret Levin", "Rubik", sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.direction = 'rtl';
    x.fillText(`${where} · ${clock}`, c.width / 2, H + pad + cap * 0.52);
    const url = c.toDataURL('image/jpeg', 0.86);
    const at = Date.now();
    // the flash and the shutter
    const fl = $('phone-flash');
    fl.classList.remove('on');
    void fl.offsetWidth;
    fl.classList.add('on');
    g.audio.play('shutter', 0.8);
    store
      .put('photos', String(at), { at, where, clock, url })
      .then(() => this.prune())
      .then(() => g.hud.toast('התמונה נשמרה בתמונות שבטלפון', 'good', 1.8))
      .catch(() => g.hud.toast('אין מקום לתמונה', 'bad', 1.8))
      .finally(() => (this.shooting = false));
  }

  async prune() {
    const ks = await store.keys('photos');
    for (let i = 0; i < ks.length - MAX_PHOTOS; i++) await store.del('photos', ks[i]);
  }

  // ------------------------------------------------------------------ the skills (ROADMAP 5.6)
  fillSkills() {
    const sk = this.game.skills;
    const box = $('phone-skill-list');
    box.innerHTML = '';
    if (!sk) return;
    for (const r of sk.rows()) {
      const d = document.createElement('div');
      d.className = 'skill';
      const top = document.createElement('div');
      top.className = 'skill-top';
      const b = document.createElement('b');
      b.textContent = r.name;
      const lv = document.createElement('span');
      lv.textContent = `רמה ${r.level} מתוך 5`;
      top.append(b, lv);
      const bars = document.createElement('div');
      bars.className = 'skill-lv';
      for (let i = 0; i < 5; i++) {
        const k = document.createElement('i');
        if (i < r.level) k.className = 'on';
        else if (i === r.level && r.next > 0) {
          k.className = 'part';
          k.style.setProperty('--k', `${Math.round(r.next * 100)}%`);
        }
        bars.appendChild(k);
      }
      const what = document.createElement('div');
      what.className = 'skill-what';
      what.textContent = r.what;
      d.append(top, bars, what);
      box.appendChild(d);
    }
  }

  // ------------------------------------------------------------------ the bank (ROADMAP 8.1)
  fillBank() {
    const M = this.game.money;
    const sum = $('phone-bank-sum');
    const box = $('phone-bank-list');
    sum.innerHTML = '';
    box.innerHTML = '';
    if (!M) return;
    for (const [name, n] of [['בבנק', M.bank], ['בכיס', M.cash]]) {
      const d = document.createElement('div');
      d.className = 'bank-sum';
      const b = document.createElement('b');
      b.textContent = name;
      const s = document.createElement('span');
      s.textContent = fmt(n);
      d.append(b, s);
      sum.appendChild(d);
    }
    if (!M.log.length) {
      box.innerHTML = '<p class="phone-empty">עוד לא היו תנועות</p>';
      return;
    }
    for (const it of M.log) {
      const d = document.createElement('div');
      d.className = `bank-row ${it.move ? 'move' : it.n > 0 ? 'in' : 'out'}`;
      const w = document.createElement('span');
      w.textContent = it.what;
      const n = document.createElement('b');
      n.textContent = `${it.move ? '' : it.n > 0 ? '+' : '−'}${fmt(Math.abs(it.n))}`;
      const via = document.createElement('span');
      via.className = 'bank-via';
      via.textContent = `${it.at ? `${it.at} · ` : ''}${it.via}`;
      d.append(w, n, via);
      box.appendChild(d);
    }
  }

  // ------------------------------------------------------------------ the properties (ROADMAP 8.2)
  fillProps() {
    const g = this.game;
    const PR = g.props;
    const box = $('phone-prop-list');
    box.innerHTML = '';
    if (!PR) return;
    for (const p of PR.list) {
      const d = document.createElement('div');
      d.className = `prop${p.owned ? ' owned' : ''}`;
      const top = document.createElement('div');
      top.className = 'prop-top';
      const b = document.createElement('b');
      b.textContent = p.name;
      const s = document.createElement('span');
      s.textContent = p.owned ? 'שלכם' : fmt(p.price);
      top.append(b, s);
      const what = document.createElement('div');
      what.className = 'prop-what';
      what.textContent = `${p.he} · ${fmt(p.income)} לבנק בכל בוקר`;
      const row = document.createElement('div');
      row.className = 'prop-btns';
      if (!p.owned) {
        const buy = document.createElement('button');
        buy.className = 'btn mini';
        const can = g.money.can(p.price);
        buy.textContent = can ? 'לקנות' : `חסרים ${fmt(p.price - g.money.total)}`;
        buy.disabled = !can;
        buy.addEventListener('click', () => {
          if (PR.buy(p)) this.fillProps();
        });
        row.appendChild(buy);
      }
      const go = document.createElement('button');
      go.className = 'btn mini';
      go.textContent = 'לסמן במפה';
      go.addEventListener('click', () => {
        g.gps.set(p.x, p.z, p.name);
        g.hud.toast(`${p.name} מסומן במפה`, 'info', 2);
      });
      row.appendChild(go);
      d.append(top, what, row);
      box.appendChild(d);
    }
  }

  // ------------------------------------------------------------------ the photos
  async fillPhotos() {
    const box = $('phone-grid');
    box.innerHTML = '';
    const ks = (await store.keys('photos')).reverse();
    if (!ks.length) {
      box.innerHTML = '<p class="phone-empty">עוד אין תמונות. המצלמה מחכה!</p>';
      return;
    }
    for (const k of ks) {
      const ph = await store.get('photos', k);
      if (!ph) continue;
      const b = document.createElement('button');
      b.className = 'photo';
      const img = document.createElement('img');
      img.src = ph.url;
      img.alt = ph.where;
      b.appendChild(img);
      b.addEventListener('click', () => this.view(k, ph));
      box.appendChild(b);
    }
  }

  view(key, ph) {
    this.viewKey = key;
    this.page('view');
    $('phone-view-img').src = ph.url;
    $('phone-view-title').textContent = `${ph.where} · ${ph.clock}`;
    const dl = $('phone-dl');
    const d = new Date(ph.at);
    this.viewed = ph;
    this.viewedName = `scribble-city-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}.jpg`;
    if (this.framed) {
      dl.removeAttribute('href');
      dl.classList.toggle('hidden', !this.dlCap);
    } else {
      dl.href = ph.url;
      dl.download = this.viewedName;
    }
  }

  // the viewer is asked to keep the photo (they may say no: then nothing happens)
  async saveViewed() {
    const ph = this.viewed;
    if (!ph || !this.dlCap) return;
    const b64 = ph.url.slice(ph.url.indexOf(',') + 1);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    try {
      await this.dlCap.save({ filename: this.viewedName, data: new Blob([bytes], { type: 'image/jpeg' }) });
    } catch (err) {
      const code = err && err.code;
      if (code === 'declined') return;
      if (code === 'rate_limited') this.game.hud.toast('רגע, עוד שאלה פתוחה', 'info', 1.6);
      else if (code === 'too_large' || code === 'bad_request' || code === 'transform_error' || code === 'rejected_extension') this.game.hud.toast('לא הצלחנו לשמור את התמונה', 'bad', 1.8);
      else {
        // (saving is not possible in this view: the button goes)
        this.dlCap = null;
        $('phone-dl').classList.add('hidden');
      }
    }
  }

  async deleteViewed() {
    if (!this.viewKey) return;
    await store.del('photos', this.viewKey);
    this.viewKey = null;
    this.page('photos');
  }
}
