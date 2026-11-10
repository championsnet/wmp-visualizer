import { Visualization, bandMax } from './base.js';

// WMP "Bars and Waves: Bars": a row of gradient bars with white peak caps
// that hang for a moment and then fall.
export class Bars extends Visualization {
  static id = 'bars';
  static title = 'Bars';
  static group = 'Bars and Waves';

  constructor() {
    super();
    this.n = 40;
    this.vals = new Float32Array(this.n);
    this.peaks = new Float32Array(this.n);
    this.hold = new Float32Array(this.n);
    this.peakVel = new Float32Array(this.n);
    this.grad = null;
    this.gradKey = '';
  }

  activate() {
    this.vals.fill(0); this.peaks.fill(0); this.hold.fill(0); this.peakVel.fill(0);
  }

  draw(ctx, f, dt) {
    const { w, h, n } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const base = Math.round(h * 0.9);
    const maxH = h * 0.8;
    const slot = w / n;
    const gap = Math.max(2, Math.round(slot * 0.18));
    const bw = Math.max(1, slot - gap);

    const key = `${base}|${maxH}`;
    if (key !== this.gradKey) {
      const g = ctx.createLinearGradient(0, base, 0, base - maxH);
      g.addColorStop(0, '#0a2a8a');
      g.addColorStop(0.35, '#1f6dff');
      g.addColorStop(0.65, '#33c8ff');
      g.addColorStop(0.88, '#b4f4ff');
      g.addColorStop(1, '#ffffff');
      this.grad = g;
      this.gradKey = key;
    }

    ctx.fillStyle = this.grad;
    for (let i = 0; i < n; i++) {
      const v = bandMax(f.bands, i / n, (i + 1) / n);
      // fast rise, smooth time-based fall: no frame-to-frame flicker
      this.vals[i] = v >= this.vals[i] ? v : Math.max(v, this.vals[i] - dt * 1.6);
      const bh = Math.round(this.vals[i] * maxH);
      const x = Math.round(gap / 2 + i * slot);
      ctx.fillRect(x, base - bh, Math.round(bw), bh);
    }

    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < n; i++) {
      if (this.vals[i] >= this.peaks[i]) {
        this.peaks[i] = this.vals[i];
        this.hold[i] = 0.35;
        this.peakVel[i] = 0;
      } else if (this.hold[i] > 0) {
        this.hold[i] -= dt;
      } else {
        this.peakVel[i] += dt * 2.5;
        this.peaks[i] = Math.max(this.vals[i], this.peaks[i] - this.peakVel[i] * dt);
      }
      const x = Math.round(gap / 2 + i * slot);
      ctx.fillRect(x, Math.round(base - this.peaks[i] * maxH) - 4, Math.round(bw), 3);
    }

    // faint reflection under the baseline
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.translate(0, base * 2 + 2);
    ctx.scale(1, -1);
    ctx.fillStyle = this.grad;
    for (let i = 0; i < n; i++) {
      const bh = Math.round(this.vals[i] * maxH);
      ctx.fillRect(Math.round(gap / 2 + i * slot), base - bh, Math.round(bw), bh);
    }
    ctx.restore();
  }
}
