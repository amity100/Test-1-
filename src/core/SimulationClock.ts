export class SimulationClock {
  private accumulator = 0;
  private last = performance.now();
  constructor(private readonly fixedDelta = 1 / 60, private readonly maxSteps = 4) {}
  tick(step: (dt: number) => void) {
    const now = performance.now();
    this.accumulator += Math.min(0.08, (now - this.last) / 1000);
    this.last = now;
    let steps = 0;
    while (this.accumulator >= this.fixedDelta && steps < this.maxSteps) {
      step(this.fixedDelta);
      this.accumulator -= this.fixedDelta;
      steps++;
    }
    return this.accumulator / this.fixedDelta;
  }
}
