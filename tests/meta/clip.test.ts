import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  ClipExporter, CLIP_MIME_TYPES, clipOutputSize, extensionFor, fitRect, pickMimeType, shareOrDownload,
} from '../../src/meta/clip';

describe('clip helpers', () => {
  it('output size: landscape 1280×720, portrait 720×1280', () => {
    expect(clipOutputSize(1920, 1080)).toEqual({ width: 1280, height: 720 });
    expect(clipOutputSize(390, 844)).toEqual({ width: 720, height: 1280 });
    expect(clipOutputSize(800, 800)).toEqual({ width: 1280, height: 720 });
  });

  it('fitRect letterboxes (contain) and crops (cover)', () => {
    expect(fitRect(1600, 1000, 1280, 720)).toEqual({ x: (1280 - 1152) / 2, y: 0, w: 1152, h: 720 });
    const phone = fitRect(390, 844, 720, 1280);
    expect(phone.h).toBeCloseTo(1280, 6);
    expect(phone.w).toBeLessThan(720);
    expect(phone.x).toBeGreaterThan(0);
    const cover = fitRect(390, 844, 720, 1280, 'cover');
    expect(cover.w).toBeCloseTo(720, 6);
    expect(cover.h).toBeGreaterThan(1280);
    expect(fitRect(0, 0, 10, 10)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
  });

  it('picks the first supported mime type', () => {
    expect(CLIP_MIME_TYPES[0]).toBe('video/mp4;codecs=avc1');
    expect(pickMimeType((t) => t.startsWith('video/webm'))).toBe('video/webm;codecs=vp9');
    expect(pickMimeType((t) => t === 'video/mp4')).toBe('video/mp4');
    expect(pickMimeType(() => false)).toBeNull();
    expect(pickMimeType(() => { throw new Error('x'); })).toBeNull();
  });

  it('extensions', () => {
    expect(extensionFor('video/mp4;codecs=avc1')).toBe('mp4');
    expect(extensionFor('video/webm')).toBe('webm');
    expect(extensionFor('image/png')).toBe('png');
    expect(extensionFor('')).toBe('bin');
  });
});

describe('ClipExporter in node', () => {
  it('is unsupported and never throws', async () => {
    const c = new ClipExporter();
    expect(c.supported()).toBe(false);
    expect(c.begin({} as HTMLCanvasElement, null)).toBe(false);
    expect(c.recording).toBe(false);
    expect(() => c.frame()).not.toThrow();
    expect(await c.end()).toBeNull();
    expect(await shareOrDownload(new Blob(['x']), 'clip')).toBe('failed');
    expect(await c.share(new Blob(['x']), 'clip')).toBe('failed');
  });
});

describe('ClipExporter with a mocked browser', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockBrowser(opts: { share?: 'ok' | 'abort' | 'denied' | 'none' } = {}) {
    const draws: unknown[][] = [];
    const clicks: string[] = [];
    const ctx = {
      imageSmoothingEnabled: false,
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: (...a: unknown[]) => draws.push(a),
    };
    const trackStop = vi.fn();
    class FakeCanvas {
      width = 0;
      height = 0;
      getContext() { return ctx; }
      captureStream(fps: number) {
        return { fps, getTracks: () => [{ stop: trackStop }] };
      }
    }
    class FakeRecorder {
      static isTypeSupported(t: string) { return t === 'video/webm;codecs=vp9' || t === 'video/webm'; }
      static last: FakeRecorder | null = null;
      state = 'inactive';
      mimeType: string;
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public stream: unknown, public options: { mimeType?: string; videoBitsPerSecond?: number }) {
        this.mimeType = options.mimeType ?? '';
        FakeRecorder.last = this;
      }
      start() { this.state = 'recording'; }
      stop() {
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob(['frame-data'], { type: 'video/webm' }) });
        this.onstop?.();
      }
    }
    const anchors: { href: string; download: string; click: () => void; remove: () => void; style: Record<string, string>; rel: string }[] = [];
    const doc = {
      createElement: (tag: string) => {
        if (tag === 'canvas') return new FakeCanvas();
        const a = { href: '', download: '', rel: '', style: {} as Record<string, string>, click: () => clicks.push(a.download), remove: () => {} };
        anchors.push(a);
        return a;
      },
      body: { appendChild: () => {} },
    };
    vi.stubGlobal('document', doc);
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    vi.stubGlobal('HTMLCanvasElement', FakeCanvas);
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} });
    const shared: unknown[] = [];
    const nav: Record<string, unknown> = {};
    if (opts.share && opts.share !== 'none') {
      nav.canShare = () => true;
      nav.share = async (d: unknown) => {
        if (opts.share === 'abort') throw Object.assign(new Error('cancel'), { name: 'AbortError' });
        if (opts.share === 'denied') throw Object.assign(new Error('no gesture'), { name: 'NotAllowedError' });
        shared.push(d);
      };
    }
    vi.stubGlobal('navigator', nav);
    return { draws, clicks, shared, FakeRecorder, trackStop, ctx };
  }

  it('records composited frames and returns a blob', async () => {
    const m = mockBrowser();
    const c = new ClipExporter();
    expect(c.supported()).toBe(true);
    const gl = { width: 1600, height: 1000 } as HTMLCanvasElement;
    const overlay = { width: 1280, height: 720 } as HTMLCanvasElement;
    expect(c.begin(gl, overlay)).toBe(true);
    expect(c.recording).toBe(true);
    expect(c.mimeType).toBe('video/webm;codecs=vp9');
    expect(m.FakeRecorder.last!.options.videoBitsPerSecond).toBe(6_000_000);
    expect(c.outputCanvas!.width).toBe(1280);
    expect(c.outputCanvas!.height).toBe(720);
    c.frame();
    c.frame();
    // gl letterboxed, then the overlay full-frame.
    expect(m.draws.length).toBe(4);
    expect(m.draws[0]).toEqual([gl, 64, 0, 1152, 720]);
    expect(m.draws[1]).toEqual([overlay, 0, 0, 1280, 720]);
    const blob = await c.end();
    expect(blob).not.toBeNull();
    expect(blob!.type).toBe('video/webm');
    expect(blob!.size).toBeGreaterThan(0);
    expect(c.recording).toBe(false);
    expect(m.trackStop).toHaveBeenCalled();
    expect(await c.end()).toBeNull();
  });

  it('portrait canvases record portrait video', () => {
    mockBrowser();
    const c = new ClipExporter();
    expect(c.begin({ width: 390, height: 844 } as HTMLCanvasElement, null, { fps: 24 })).toBe(true);
    expect(c.outputCanvas!.width).toBe(720);
    expect(c.outputCanvas!.height).toBe(1280);
    c.cancel();
    expect(c.recording).toBe(false);
  });

  it('shares files when the platform can, else downloads', async () => {
    let m = mockBrowser({ share: 'ok' });
    const blob = new Blob(['x'], { type: 'video/mp4' });
    expect(await shareOrDownload(blob, 'threshold clip!')).toBe('shared');
    expect(m.shared.length).toBe(1);
    vi.unstubAllGlobals();

    m = mockBrowser({ share: 'none' });
    expect(await shareOrDownload(blob, 'threshold-clip')).toBe('downloaded');
    expect(m.clicks).toEqual(['threshold-clip.mp4']);
    vi.unstubAllGlobals();

    m = mockBrowser({ share: 'denied' });
    expect(await shareOrDownload(blob, 'x')).toBe('downloaded');
    vi.unstubAllGlobals();

    mockBrowser({ share: 'abort' });
    const c = new ClipExporter();
    expect(await c.share(blob, 'x')).toBe('failed');
    expect(c.shareCancelled).toBe(true);
  });
});
