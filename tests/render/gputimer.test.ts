import { describe, expect, it } from 'vitest';
import { GpuTimer } from '../../src/render/gputimer';

/** A WebGL2 context with a timer query extension whose results arrive when `ready` says so. */
function fakeGl() {
  const canvas = new EventTarget();
  let lost = false;
  const state = { ready: true, created: 0 };
  const ext = { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 };
  const gl: any = {
    canvas,
    QUERY_RESULT_AVAILABLE: 10,
    QUERY_RESULT: 11,
    getExtension: () => ext,
    isContextLost: () => lost,
    createQuery: () => ({ id: ++state.created }),
    beginQuery() {},
    endQuery() {},
    deleteQuery() {},
    getParameter: () => false,
    getQueryParameter: (_q: unknown, p: number) => (lost ? null : p === 10 ? state.ready : 8e6),
  };
  return { gl, canvas, state, lose: () => (lost = true), restore: () => (lost = false) };
}

describe('GPU timer', () => {
  it('reads results a frame later without stalling', () => {
    const f = fakeGl();
    const t = new GpuTimer(f.gl);
    expect(t.available).toBe(true);
    t.begin();
    t.end();
    t.begin();
    t.end();
    expect(t.ms).toBe(8);
  });

  it('forgets its queries and reading when the context is lost, and times again once restored', () => {
    const f = fakeGl();
    const t = new GpuTimer(f.gl);
    f.state.ready = false;
    for (let i = 0; i < 10; i++) {
      t.begin();
      t.end();
    }
    const made = f.state.created;
    t.ms = 30;
    f.lose();
    f.canvas.dispatchEvent(new Event('webglcontextlost'));
    expect(t.ms).toBeNull();
    t.begin();
    t.end();
    expect(f.state.created).toBe(made);
    f.restore();
    f.canvas.dispatchEvent(new Event('webglcontextrestored'));
    f.state.ready = true;
    t.begin();
    t.end();
    // (new queries: the old ones belonged to the lost context)
    expect(f.state.created).toBe(made + 1);
    t.begin();
    t.end();
    expect(t.ms).toBe(8);
  });
});
