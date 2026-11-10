import { Visualization, WaveSampler, hsla } from './base.js';

// WMP "Bars and Waves: Scope": a single oscilloscope line across the middle
// whose colour slowly drifts.
export class Wave extends Visualization {
  static id = 'wave';
  static title = 'Scope';
  static group = 'Bars and Waves';

  constructor() {
    super();
    this.hue = 120;
    this.wave = new WaveSampler(256);
  }

  draw(ctx, f, dt) {
    const { w, h } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    this.hue += dt * 20;

    const N = 256;
    const pts = this.wave.sample(f.time, dt, 0.5);
    const amp = h * 0.3 * (0.4 + 0.6 * f.softLevel);
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * w;
      const y = h / 2 + pts[i] * amp;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineJoin = 'round';
    ctx.strokeStyle = hsla(this.hue, 100, 50, 0.35);
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = hsla(this.hue, 100, 70, 1);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
