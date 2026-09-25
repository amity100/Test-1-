import { describe, expect, it } from 'vitest';
import { frameStats, shortGpuName } from '../../src/ui/perfhud';

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

describe('perf overlay GPU name', () => {
  it('drops the ANGLE wrapper and hex ids, keeps short names', () => {
    expect(shortGpuName('Apple GPU')).toBe('Apple GPU');
    expect(shortGpuName('ANGLE (Qualcomm, Adreno (TM) 740, OpenGL ES 3.2)')).toBe('Qualcomm, Adreno (TM) 740, OpenGL ES 3.2');
    expect(shortGpuName('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)')).not.toMatch(/0x/);
  });

  it('cuts a long name to one short line', () => {
    const s = shortGpuName('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002503) Direct3D11 vs_5_0 ps_5_0, D3D11)');
    expect(s.length).toBeLessThanOrEqual(44);
    expect(s.startsWith('NVIDIA, NVIDIA GeForce RTX 3060')).toBe(true);
    expect(s.endsWith('\u2026')).toBe(true);
  });
});
