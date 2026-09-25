/**
 * GPU time of a frame, from EXT_disjoint_timer_query_webgl2 where the browser
 * exposes it (desktop Chrome does; Safari doesn't: `available` is false and
 * `ms` stays null). One TIME_ELAPSED query brackets everything the frame
 * submits; results arrive a few frames later and are read without stalling.
 */
export class GpuTimer {
  readonly available: boolean;
  /** GPU ms of the latest frame whose result arrived (null: none yet, or no timer). */
  ms: number | null = null;
  private ext: any = null;
  private free: WebGLQuery[] = [];
  private pending: WebGLQuery[] = [];
  private active: WebGLQuery | null = null;

  constructor(private gl: WebGL2RenderingContext) {
    try {
      this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    } catch {
      this.ext = null;
    }
    this.available = !!this.ext;
  }

  begin() {
    if (!this.ext || this.active) return;
    this.poll();
    // (a pile-up of unread results means the GPU is far behind: skip rather than grow)
    if (this.pending.length >= 6) return;
    const q = this.free.pop() ?? this.gl.createQuery();
    if (!q) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.active = q;
  }

  end() {
    if (!this.ext || !this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  private poll() {
    const gl = this.gl;
    while (this.pending.length) {
      const q = this.pending[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      this.pending.shift();
      // (a disjoint event, e.g. a clock change, makes the result meaningless: drop it)
      const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT);
      if (!disjoint) this.ms = (gl.getQueryParameter(q, gl.QUERY_RESULT) as number) / 1e6;
      this.free.push(q);
    }
  }

  dispose() {
    if (this.active) this.end();
    for (const q of [...this.free, ...this.pending]) this.gl.deleteQuery(q);
    this.free = [];
    this.pending = [];
  }
}
