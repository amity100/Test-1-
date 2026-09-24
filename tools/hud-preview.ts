/**
 * UI preview harness: mounts HUD / Menu / TouchControls with fake data.
 *
 *   npx vite --port 4330   then open /tools/hud-preview.html?screen=hud&state=combat&lang=he&touch=1
 *
 * screen: hud | main | pause | end | fail | zones | challenges | controls | settings | clip | loading
 * state (hud): combat | calm | invalid | bank | vision | pad
 * touch=1 adds body.is-touch + TouchControls; cancel=1 shows the RIFT cancel zone.
 */
import '../src/ui/style.css';
import type { StyleState, TrickAward } from '../src/core/contracts';
import { HUD } from '../src/ui/hud';
import { Menu, type Settings } from '../src/ui/menu';
import { Input } from '../src/engine/input';
import { TouchControls } from '../src/engine/touch';
import { setDevice, setLang, t } from '../src/ui/i18n';

const qs = new URLSearchParams(location.search);
const lang = qs.get('lang') === 'he' ? 'he' : 'en';
const touch = qs.get('touch') === '1';
const screen = qs.get('screen') ?? 'hud';
const state = qs.get('state') ?? 'combat';
setLang(lang);

const app = document.getElementById('app')!;
const canvas = document.createElement('canvas');
canvas.className = 'view';
canvas.style.opacity = '0';
app.appendChild(canvas);
const ui = document.createElement('div');
ui.className = 'ui';
app.appendChild(ui);
if (touch) document.body.classList.add('is-touch');

const settings: Settings = { quality: 'high', sensitivity: 1, invertY: false, slowmo: true };
const menu = new Menu(ui, settings);
const input = new Input(canvas);
if (touch) input.lastDevice = 'touch';
if (state === 'pad') input.lastDevice = 'pad';
setDevice(input.lastDevice);
const hud = new HUD(ui);
const tc = touch ? new TouchControls(input, ui) : null;

const trick = (id: TrickAward['id'], points: number, extra: Partial<TrickAward> = {}): TrickAward => ({ id, key: `trick.${id}`, points, t: 0, ...extra });
const style = (p: Partial<StyleState>): StyleState => ({ rank: 'D', meter: 0, chainPoints: 0, variety: 0, chain: [], chainT: 0, total: 0, bestCombo: 0, lastCombo: 0, ...p });

function hudScene() {
  menu.hide();
  hud.show(true);
  tc?.show(true);
  const W = innerWidth,
    H = innerHeight;
  hud.setObjective(t('obj.clear'), lang === 'he' ? 'נשארו 3' : '3 left');
  if (state === 'calm') {
    hud.setHealth(100, 100);
    hud.setStyle(style({ total: 1850 }));
    hud.setGateHint({ mode: 'trapdoor', reason: null, targetKey: 'enemy:1' });
    hud.setRiftState({ exit: true, entrance: false, aiming: false, orientation: 'auto' });
    hud.zoneTitle(t('zone.pier.name'), t('zone.pier.sub'));
    hud.setMarkers([
      { x: W * 0.455, y: H * 0.6, onScreen: true, angle: 0, kind: 'target' },
      { x: 0, y: 0, onScreen: false, angle: 0.25, kind: 'objective', label: '42 m' },
      { x: W * 0.3, y: H * 0.5, onScreen: true, angle: 0, kind: 'gate', label: 'GATE' },
    ]);
    hud.setPrompt(t('prompt.hijack'));
    tc?.setPortalLabel(t('portal.grab'), 'grab');
    tc?.setAction(t('prompt.hijack'));
    return;
  }
  hud.setHealth(100, 100);
  hud.setHealth(58, 100);
  hud.damageFlash(state === 'invalid' ? 30 : 0);
  hud.setStyle(style({ rank: 'D' }));
  const chain = style({ rank: state === 'invalid' ? 'SSS' : 'S', meter: 0.62, chainPoints: 1250, variety: 4, chainT: 4, total: 45200 });
  hud.setStyle(chain);
  hud.setStyle({ ...chain, chainT: 2.6 });
  const tricks = [trick('splashdown', 200), trick('trapdoor', 100, { halved: true }), trick('loop', 300, { suffix: '×5' }), trick('returnToSender', 300)];
  if (state === 'bank') {
    // the chain just ended: feed empty, chain line gone, the bank pops under the panel
    hud.setStyle({ ...chain, chainPoints: 0, variety: 0, chainT: 0, total: 57600 });
    hud.comboBanked(12400, 'SS');
  } else for (const a of tricks) hud.popTrick(a);
  if (state === 'invalid') {
    hud.setAim({ valid: false, reason: 'aim.tooHigh', kind: 'air', distance: 31.6, outcome: 'safe', dropBelow: 2, orientation: 'auto' });
  } else {
    hud.setAim({ valid: true, reason: null, kind: 'air', distance: 24.3, outcome: 'void', dropBelow: Infinity, orientation: 'hatch' });
  }
  hud.setRiftState({ exit: true, entrance: true, aiming: true, orientation: 'hatch' });
  hud.setMarkers([
    { x: 0, y: 0, onScreen: false, angle: -2.6, kind: 'threat' },
    { x: 0, y: 0, onScreen: false, angle: 1.2, kind: 'threat' },
    { x: W * 0.72, y: H * 0.46, onScreen: true, angle: 0, kind: 'threat' },
    { x: 0, y: 0, onScreen: false, angle: 0.3, kind: 'objective', label: '42 m' },
  ]);
  hud.hint('trapdoor', t('hint.trapdoor'), 30);
  hud.toast(t('toast.checkpoint'), 'good');
  hud.setPrompt(t('prompt.blade'));
  hud.offerClip(true);
  hud.setAirtime(2.4);
  hud.setPlayerCharged(true);
  if (state === 'vision') hud.setVision(true);
  tc?.setAiming(true);
  tc?.setAction(t('prompt.blade'));
  tc?.setPortalLabel(t('portal.grab'), 'grab');
  tc?.offerClip(true);
  if (qs.get('cancel') === '1') tc?.el.classList.add('rift-held');
}

const stats = { time: 1234, kills: 47, bestCombo: 18450, styleTotal: 392100, tricks: 19, deaths: 3, challenges: 8 };
const challenges = [
  { id: 'daily-2026-09-23', title: lang === 'he' ? 'יומי: קו אש ×2' : 'Daily: Firing Line ×2', desc: lang === 'he' ? 'שתי הריגות בקרן של צלף, בלי לגעת בקרקע' : 'Two sniper-beam kills without touching the ground', done: false, progress: '1/2' },
  { id: 'pier.rts', title: lang === 'he' ? 'החזרה לשולח ×3' : 'Return to Sender ×3', desc: lang === 'he' ? 'שלושה רובאים שנהרגו מהכדורים של עצמם' : 'Three riflemen killed by their own bullets', done: true },
  { id: 'pier.splash', title: lang === 'he' ? 'שניים בפורטל אחד' : 'Two with one rift', desc: lang === 'he' ? 'הטבע שני שומרים דרך אותה יציאה' : 'Drown two guards through the same exit', done: false, progress: '0/2' },
  { id: 'yard.matador', title: lang === 'he' ? 'אולה!' : 'Olé!', desc: lang === 'he' ? 'שלח ענק לים באמצע הסתערות' : 'Send a brute into the sea mid-charge', done: false, progress: '0/1' },
];

function run() {
  switch (screen) {
    case 'hud':
      return hudScene();
    case 'loading':
      hud.show(false);
      menu.showLoading(0.62);
      return;
    case 'main':
      hud.show(false);
      tc?.show(false);
      menu.continueZone = 'yard';
      return menu.showMain();
    case 'pause':
      hudScene();
      tc?.show(false);
      return menu.showPause();
    case 'end':
      hud.show(false);
      tc?.show(false);
      return menu.showEnd(true, stats, 'SS');
    case 'fail':
      hud.show(false);
      tc?.show(false);
      return menu.showEnd(false, stats, 'B');
    case 'zones':
      hud.show(false);
      tc?.show(false);
      menu.unlockedZones = ['pier', 'yard', 'skeleton'];
      return menu.showZones();
    case 'challenges':
      hud.show(false);
      tc?.show(false);
      return menu.showChallenges(challenges);
    case 'controls':
      hud.show(false);
      tc?.show(false);
      if (qs.get('tab')) menu.setControlsTab(qs.get('tab') as 'kbm' | 'pad' | 'touch');
      return menu.controls();
    case 'settings':
      hud.show(false);
      tc?.show(false);
      return menu.openSettings();
    case 'clip':
      hud.show(false);
      tc?.show(false);
      menu.showClip({ saving: qs.get('saving') !== '0', onShare: () => {}, onDownload: () => {}, onClose: () => menu.hideClip() });
      return;
  }
}

// manual=1: a screenshot tool preloads fonts first, then calls window.__run() so timed
// elements (feed, toasts, titles) are fresh when the shot is taken
if (qs.get('manual') === '1') (window as unknown as Record<string, unknown>).__run = run;
else if (document.readyState === 'complete') run();
else window.addEventListener('load', () => run());
let last = performance.now();
const loop = (now: number) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  input.poll(dt);
  // __freeze: screenshot tools stop HUD timers (and pause CSS animations) before capturing
  if (!(window as unknown as Record<string, unknown>).__freeze) hud.update(dt);
  input.endFrame();
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
(window as unknown as Record<string, unknown>).__ui = { hud, menu, tc, input };
