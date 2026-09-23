/**
 * Clip export: composites the WebGL canvas + the replay overlay into a 2D
 * canvas, records it with MediaRecorder and shares / downloads the result.
 *
 * Node-safe to import: every DOM access is guarded and nothing ever throws
 * into the game loop.
 */

/** Preferred container / codec order (first supported wins). */
export const CLIP_MIME_TYPES: readonly string[] = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

export const CLIP_BITRATE = { desktop: 6_000_000, phone: 3_500_000 } as const;

/** Output video size for a source canvas: 1280×720 landscape, 720×1280 portrait. */
export function clipOutputSize(srcW: number, srcH: number, long = 1280, short = 720): { width: number; height: number } {
  const portrait = srcH > srcW;
  return portrait ? { width: short, height: long } : { width: long, height: short };
}

/** Where a srcW×srcH image lands inside dstW×dstH: 'contain' letterboxes, 'cover' crops. */
export function fitRect(
  srcW: number, srcH: number, dstW: number, dstH: number, mode: 'contain' | 'cover' = 'contain',
): { x: number; y: number; w: number; h: number } {
  if (!(srcW > 0) || !(srcH > 0)) return { x: 0, y: 0, w: dstW, h: dstH };
  const s = mode === 'cover' ? Math.max(dstW / srcW, dstH / srcH) : Math.min(dstW / srcW, dstH / srcH);
  const w = srcW * s;
  const h = srcH * s;
  return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h };
}

/** First mime type the predicate accepts, or null. */
export function pickMimeType(isSupported: (t: string) => boolean, list: readonly string[] = CLIP_MIME_TYPES): string | null {
  for (const t of list) {
    try {
      if (isSupported(t)) return t;
    } catch { /* ignore */ }
  }
  return null;
}

/** File extension for a blob type. */
export function extensionFor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('mp4')) return 'mp4';
  if (t.includes('webm')) return 'webm';
  if (t.includes('png')) return 'png';
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
  if (t.includes('gif')) return 'gif';
  return 'bin';
}

/** Coarse phone / tablet detection (lower bitrate). */
export function isPhoneLike(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    const small = typeof screen !== 'undefined' && Math.min(screen.width, screen.height) < 900;
    return coarse && small;
  } catch {
    return false;
  }
}

function hasDom(): boolean {
  return typeof document !== 'undefined' && typeof window !== 'undefined';
}

/** Did the last shareOrDownload() end because the user closed the share sheet? */
export let lastShareCancelled = false;

/**
 * Share a blob with the Web Share API (files) when the platform can, else
 * download it. Call it from a user gesture (a click/tap handler): browsers
 * refuse navigator.share() without transient activation.
 */
export async function shareOrDownload(blob: Blob, baseName: string): Promise<'shared' | 'downloaded' | 'failed'> {
  lastShareCancelled = false;
  if (!hasDom()) return 'failed';
  const safeBase = (baseName || 'threshold').replace(/[^\w.-]+/g, '-').slice(0, 80) || 'threshold';
  const name = `${safeBase}.${extensionFor(blob.type || '')}`;
  try {
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (typeof File !== 'undefined' && typeof nav.share === 'function' && typeof nav.canShare === 'function') {
      const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
      const data: ShareData = { files: [file], title: 'THRESHOLD', text: '#THRESHOLD' };
      if (nav.canShare(data)) {
        try {
          await nav.share(data);
          return 'shared';
        } catch (err) {
          const n = (err as { name?: string } | null)?.name;
          if (n === 'AbortError') {
            lastShareCancelled = true;
            return 'failed';
          }
          // NotAllowedError (no user activation) and friends: fall back to a download.
        }
      }
    }
  } catch { /* fall through to download */ }
  return download(blob, name);
}

function download(blob: Blob, name: string): 'downloaded' | 'failed' {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { a.remove(); } catch { /* ignore */ }
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    }, 60_000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

export interface ClipBeginOptions {
  width?: number;
  height?: number;
  fps?: number;
  /** 'contain' letterboxes the game image (default), 'cover' crops it to fill. */
  fit?: 'contain' | 'cover';
  /** Override the bitrate (bits per second). */
  bitrate?: number;
}

type CaptureCanvas = HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream };

export class ClipExporter {
  /** Chosen mime type of the running / last recording. */
  mimeType: string | null = null;
  /** Human-readable reason of the last failure (for logs / toasts). */
  lastError: string | null = null;
  /** The compositing canvas (valid while recording). */
  outputCanvas: HTMLCanvasElement | null = null;

  private rec: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private gl: HTMLCanvasElement | null = null;
  private overlay: HTMLCanvasElement | null = null;
  private chunks: Blob[] = [];
  private fit: 'contain' | 'cover' = 'contain';
  private failed = false;
  /** Cached letterbox rect (recomputed when the source size changes). */
  private rect = { x: 0, y: 0, w: 0, h: 0 };
  private rectW = -1;
  private rectH = -1;

  get recording(): boolean {
    return !!this.rec && !this.failed;
  }

  supported(): boolean {
    try {
      if (!hasDom()) return false;
      if (typeof MediaRecorder === 'undefined') return false;
      if (typeof HTMLCanvasElement === 'undefined') return false;
      return typeof (HTMLCanvasElement.prototype as CaptureCanvas).captureStream === 'function';
    } catch {
      return false;
    }
  }

  begin(glCanvas: HTMLCanvasElement, overlay: HTMLCanvasElement | null, opts: ClipBeginOptions = {}): boolean {
    this.lastError = null;
    if (this.rec) this.cancel();
    if (!this.supported()) {
      this.lastError = 'unsupported';
      return false;
    }
    try {
      const size = opts.width && opts.height
        ? { width: Math.round(opts.width), height: Math.round(opts.height) }
        : clipOutputSize(glCanvas.width, glCanvas.height);
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        this.lastError = 'no-2d-context';
        return false;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, size.width, size.height);

      const fps = opts.fps ?? 30;
      const stream = (canvas as CaptureCanvas).captureStream!(fps);
      const mime = pickMimeType((t) => MediaRecorder.isTypeSupported(t));
      const bitrate = opts.bitrate ?? (isPhoneLike() ? CLIP_BITRATE.phone : CLIP_BITRATE.desktop);
      const recOpts: MediaRecorderOptions = { videoBitsPerSecond: bitrate };
      if (mime) recOpts.mimeType = mime;
      const rec = new MediaRecorder(stream, recOpts);
      this.chunks = [];
      rec.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) this.chunks.push(ev.data);
      };
      rec.onerror = () => {
        this.failed = true;
        this.lastError = 'recorder-error';
      };
      rec.start();

      this.rec = rec;
      this.stream = stream;
      this.ctx = ctx;
      this.outputCanvas = canvas;
      this.gl = glCanvas;
      this.overlay = overlay;
      this.fit = opts.fit ?? 'contain';
      this.failed = false;
      this.mimeType = rec.mimeType || mime || 'video/webm';
      this.rectW = -1;
      return true;
    } catch (err) {
      this.lastError = String((err as Error)?.message ?? err);
      this.cleanup();
      return false;
    }
  }

  /** Call right after each rendered replay frame (same task as the WebGL render). */
  frame(): void {
    const ctx = this.ctx;
    const gl = this.gl;
    const out = this.outputCanvas;
    if (!ctx || !gl || !out || this.failed) return;
    try {
      const W = out.width;
      const H = out.height;
      if (gl.width !== this.rectW || gl.height !== this.rectH) {
        const r = fitRect(gl.width, gl.height, W, H, this.fit);
        this.rect.x = r.x; this.rect.y = r.y; this.rect.w = r.w; this.rect.h = r.h;
        this.rectW = gl.width;
        this.rectH = gl.height;
      }
      const r = this.rect;
      if (r.x > 0.5 || r.y > 0.5) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
      }
      if (gl.width > 0 && gl.height > 0) ctx.drawImage(gl, r.x, r.y, r.w, r.h);
      const ov = this.overlay;
      if (ov && ov.width > 0 && ov.height > 0) ctx.drawImage(ov, 0, 0, W, H);
    } catch (err) {
      this.lastError = String((err as Error)?.message ?? err);
    }
  }

  /** Stop recording and resolve the finished video (null on failure / no data). */
  end(): Promise<Blob | null> {
    const rec = this.rec;
    if (!rec) return Promise.resolve(null);
    const mime = (this.mimeType || 'video/webm').split(';')[0];
    return new Promise<Blob | null>((resolve) => {
      let done = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish = () => {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        let blob: Blob | null = null;
        try {
          if (this.chunks.length && !this.failed) blob = new Blob(this.chunks, { type: mime });
        } catch { blob = null; }
        this.cleanup();
        resolve(blob && blob.size > 0 ? blob : null);
      };
      try {
        timer = setTimeout(finish, 5000);
        rec.onstop = () => setTimeout(finish, 0); // let a trailing dataavailable land first
        if (rec.state !== 'inactive') rec.stop();
        else finish();
      } catch {
        finish();
      }
    });
  }

  /** Abort without producing a file. */
  cancel(): void {
    try {
      if (this.rec) {
        this.rec.ondataavailable = null;
        this.rec.onstop = null;
        if (this.rec.state !== 'inactive') this.rec.stop();
      }
    } catch { /* ignore */ }
    this.cleanup();
  }

  share(blob: Blob, baseName: string): Promise<'shared' | 'downloaded' | 'failed'> {
    return shareOrDownload(blob, baseName).catch(() => 'failed' as const);
  }

  /** True when the last share() ended because the user dismissed the share sheet. */
  get shareCancelled(): boolean {
    return lastShareCancelled;
  }

  private cleanup(): void {
    try {
      if (this.stream) for (const tr of this.stream.getTracks()) tr.stop();
    } catch { /* ignore */ }
    this.rec = null;
    this.stream = null;
    this.ctx = null;
    this.gl = null;
    this.overlay = null;
    this.outputCanvas = null;
    this.chunks = [];
    this.failed = false;
  }
}
