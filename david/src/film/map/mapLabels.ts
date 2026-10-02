import * as THREE from 'three';
import { MAP_NAMES, type MapNameId, type MapName } from '../../content/mapNames';

/**
 * The map's place names (src/content/mapNames.ts — pointed biblical names, each verified against its verse): DOM labels
 * in the film's typography (Frank Ruhl Libre; src/ui/style.css block "map labels (map1)") pinned to points of the
 * land, projected every frame through the map camera. DOM text stays crisp at any size (no texture shimmer) and is
 * never part of the canvas crossfades: the layer fades itself with the shot and hides when the view is left.
 *
 * Every label's opacity is a pure function of shot time (seek-safe); labels fade out near the frame edges, in the
 * letterbox bars and over the lower band where the film's own text events sit (P4's lines / verse, P5's verse).
 */
export interface LabelSpec {
  id: MapNameId;
  /** the world point it is pinned to */
  pos: THREE.Vector3;
  /** where the text sits around the point: above (default for places / cities), centred (regions, seas, tribes), or
   *  to the west / east / south of it (crowded corners: Jericho, Gilgal, the plains of Moab) */
  at?: 'n' | 'c' | 'w' | 'e' | 's';
  /** places and cities carry a small dot on their point (false: the name alone) */
  dot?: boolean;
}

interface Live {
  spec: LabelSpec;
  name: MapName;
  el: HTMLElement;
  /** current opacity target (set every frame by the set) */
  a: number;
  shown: boolean;
  /** half the text's width (px), measured once shown — the edge fade keeps the whole name inside the picture */
  hw: number;
}

const _v = new THREE.Vector3();

export class MapLabels {
  readonly layer: HTMLDivElement;
  private readonly live = new Map<MapNameId, Live>();
  private visible = false;

  constructor(parent: HTMLElement, specs: LabelSpec[]) {
    this.layer = document.createElement('div');
    this.layer.className = 'map-labels';
    this.layer.style.display = 'none';
    for (const s of specs) {
      const n = MAP_NAMES[s.id];
      const el = document.createElement('div');
      el.className = `ml ml-${n.kind}${s.at ? ` ml-at-${s.at}` : ''}`;
      el.setAttribute('dir', 'rtl');
      el.setAttribute('lang', 'he');
      const t = document.createElement('span');
      t.className = 'ml-t';
      t.textContent = n.he;
      if ((n.kind === 'place' || n.kind === 'city') && s.dot !== false) {
        const d = document.createElement('i');
        d.className = 'ml-dot';
        el.appendChild(d);
      }
      el.appendChild(t);
      this.layer.appendChild(el);
      this.live.set(s.id, { spec: s, name: n, el, a: 0, shown: false, hw: -1 });
    }
    parent.appendChild(this.layer);
  }

  /** set a label's opacity for this frame (0 hides it) */
  set(id: MapNameId, a: number) {
    const l = this.live.get(id);
    if (l) l.a = a;
  }

  setAll(a: number) {
    for (const l of this.live.values()) l.a = a;
  }

  show(on: boolean) {
    if (on === this.visible) return;
    this.visible = on;
    this.layer.style.display = on ? '' : 'none';
  }

  /**
   * Project and place every label for the camera of this frame. `bars` = letterbox bar height (fraction of the
   * canvas height per bar), `bottomBand` = the fraction of the picture at its bottom kept clear for the film's text.
   */
  update(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement, bars: number, bottomBand: number) {
    if (!this.visible) return;
    const r = canvas.getBoundingClientRect();
    const W = r.width, H = r.height;
    if (W < 2 || H < 2) return;
    const top = bars * H, bot = H - bars * H;
    const ph = bot - top;
    const clearY = bot - bottomBand * ph;
    const edge = Math.min(W, ph) * 0.06;
    for (const l of this.live.values()) {
      let a = l.a;
      if (a > 0.003) {
        _v.copy(l.spec.pos).project(camera);
        if (_v.z > 1 || _v.z < -1) a = 0;
        const x = r.left + (_v.x * 0.5 + 0.5) * W;
        const y = r.top + (-_v.y * 0.5 + 0.5) * H;
        // frame edges (the whole name inside), letterbox, the film-text band
        if (l.hw < 0 && l.shown) l.hw = ((l.el.lastChild as HTMLElement | null)?.offsetWidth ?? 0) / 2;
        const hw = Math.max(0, l.hw);
        const ex = Math.min(x - r.left, r.left + W - x) - hw, ey = Math.min(y - r.top - top, r.top + bot - y);
        a *= smooth01(ex / edge) * smooth01(ey / edge);
        a *= 1 - smooth01((y - r.top - (clearY - 0.07 * ph)) / (0.07 * ph));
        if (a > 0.003) {
          l.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
          l.el.style.opacity = a.toFixed(3);
          if (!l.shown) {
            l.el.style.visibility = 'visible';
            l.shown = true;
          }
          continue;
        }
      }
      if (l.shown) {
        l.el.style.visibility = 'hidden';
        l.el.style.opacity = '0';
        l.shown = false;
      }
    }
  }

  dispose() {
    this.layer.remove();
    this.live.clear();
  }
}

function smooth01(x: number) {
  const u = Math.max(0, Math.min(1, x));
  return u * u * (3 - 2 * u);
}
