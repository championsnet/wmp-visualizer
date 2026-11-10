import { Visualization, FeedbackBuffer, WaveSampler, hsla, TAU } from './base.js';

// WMP "Ambience: Swirl": the waveform is wrapped into a loop and painted into
// a buffer that keeps rotating, zooming and blurring, so it smears into
// slowly turning smoke.
export class Ambience extends Visualization {
  static id = 'ambience';
  static title = 'Swirl';
  static group = 'Ambience';

  constructor() {
    super();
    this.fb = new FeedbackBuffer(640);
    this.hue = 0;
    this.spin = 0;
    this.wave = new WaveSampler(160);
  }

  activate() { this.fb.clear(); }

  draw(ctx, f, dt, t) {
    const fb = this.fb;
    fb.begin(this.w, this.h, dt);
    const { w, h } = fb;
    const c = fb.ctx;
    const m = Math.min(w, h);

    fb.transform({ zoom: 1.012 + f.softBass * 0.012, rotate: 0.012 + f.softMid * 0.01 });
    fb.blur(0.5, 0.5);
    fb.fade(0.03);

    this.hue += dt * (18 + f.softLevel * 30);
    this.spin -= dt * (0.4 + f.softTreble);
    const N = this.wave.n;
    const pts = this.wave.sample(f.time, dt, 0.5);

    c.save();
    c.translate(w / 2, h / 2);
    c.globalCompositeOperation = 'lighter';
    c.lineJoin = 'round';
    for (let k = 0; k < 2; k++) {
      const r0 = m * (0.12 + k * 0.1) * (1 + f.softBass * 0.5);
      c.beginPath();
      for (let i = 0; i <= N; i++) {
        const ang = this.spin * (k ? -1 : 1) + (i / N) * TAU;
        // join the ends so the loop closes without a seam
        const v = pts[i % N] * Math.sin((Math.PI * (i % N)) / N);
        const r = r0 + v * m * (0.05 + f.softLevel * 0.1);
        const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.strokeStyle = hsla(this.hue + k * 140 + Math.sin(t * 0.3) * 30, 100, 60, 0.55);
      c.lineWidth = 3;
      c.stroke();
    }
    c.restore();

    fb.blit(ctx, this.w, this.h);
  }
}
