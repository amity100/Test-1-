import { describe, expect, it } from 'vitest';
import { frameStats } from '../../src/ui/perfhud';

describe('perf overlay stats', () => {
  it('fps, mean, p95 and worst frame from rAF intervals', () => {
    const iv = [...Array(95).fill(16), ...Array(5).fill(40)];
    const s = frameStats(iv);
    expect(s.mean).toBeCloseTo(17.2, 5);
    expect(s.fps).toBeCloseTo(1000 / 17.2, 5);
    expect(s.p95).toBe(40);
    expect(s.worst).toBe(40);
  });

  it('no frames yet: zeros', () => {
    expect(frameStats([])).toEqual({ fps: 0, mean: 0, p95: 0, worst: 0 });
  });
});
