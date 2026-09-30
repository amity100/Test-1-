/*
 * Lazy clip library for src/assets/mocap/*.binz (built by tools/mocap/build_clips.py).
 * Only the small index is bundled eagerly; each clip is fetched + decoded on first use and cached.
 */
import { MocapClip, type MocapClipMeta } from './MocapClip';
import INDEX from '../../assets/mocap/index.json';

// eager URL strings (not the files): nothing is downloaded until a clip is requested
const URLS = import.meta.glob('../../assets/mocap/*.binz', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

export type MocapIndexEntry = Pick<MocapClipMeta, 'src' | 'desc' | 'tags' | 'duration' | 'frames' | 'fps' | 'loop' | 'speed' | 'distance' | 'turn' | 'cycle' | 'range'> & {
  file: string;
  bytes: number;
};

export const MOCAP_INDEX = INDEX as unknown as Record<string, MocapIndexEntry>;

export class MocapLibrary {
  private static _shared: MocapLibrary | null = null;
  /** process-wide library (clips are immutable and can be shared by every character) */
  static get shared() {
    return (this._shared ??= new MocapLibrary());
  }

  private cache = new Map<string, Promise<MocapClip>>();
  private ready = new Map<string, MocapClip>();

  /** names of every clip in the library */
  get names(): string[] {
    return Object.keys(MOCAP_INDEX);
  }
  /** clips carrying a tag (e.g. 'loco', 'film', 'idle', 'saul') */
  tagged(tag: string): string[] {
    return this.names.filter((n) => MOCAP_INDEX[n].tags.includes(tag));
  }
  info(name: string): MocapIndexEntry | undefined {
    return MOCAP_INDEX[name];
  }
  has(name: string) {
    return name in MOCAP_INDEX;
  }
  /** already decoded (synchronous access for the player) */
  get(name: string): MocapClip | undefined {
    return this.ready.get(name);
  }

  /** fetch + decode one clip (cached) */
  load(name: string): Promise<MocapClip> {
    let p = this.cache.get(name);
    if (!p) {
      const e = MOCAP_INDEX[name];
      const url = e ? URLS[`../../assets/mocap/${e.file}`] : undefined;
      if (!url) return Promise.reject(new Error(`mocap clip not found: ${name}`));
      p = fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`mocap: ${name}: HTTP ${r.status}`);
          return r.arrayBuffer();
        })
        .then((b) => MocapClip.decode(b))
        .then((c) => {
          this.ready.set(name, c);
          return c;
        });
      p.catch(() => this.cache.delete(name));
      this.cache.set(name, p);
    }
    return p;
  }

  /** load several clips in parallel */
  preload(names: string[]): Promise<MocapClip[]> {
    return Promise.all(names.map((n) => this.load(n)));
  }

  /** drop decoded clips (e.g. film-only clips after the opening film) */
  release(names?: string[]) {
    for (const n of names ?? [...this.cache.keys()]) {
      this.cache.delete(n);
      this.ready.delete(n);
    }
  }
}
