import { Visualization, FeedbackBuffer, hsla, bandAt, TAU } from './base.js';

// Rings shaped by the spectrum rush out towards the viewer, forming a tunnel.
export class Plenoptic extends Visualization {
  static id = 'plenoptic';
  static title = 'Spectrum Tunnel';
  static group = 'Plenoptic';

  constructor() {
    super();
    this.fb = new FeedbackBuffer(960);
    this.hue = 200;
    this.rot = 0;
  }

  activate() { this.fb.clear(); }

  draw(ctx, f, dt) {
    const fb = this.fb;
    fb.begin(this.w, this.h, dt);
    const { w, h } = fb;
    const c = fb.ctx;
    const m = Math.min(w, h);

    this.rot += dt * (0.2 + f.softMid * 0.5);
    this.hue += dt * 20 + f.beatStrength * 12;
    fb.transform({ zoom: 1.035 + f.softBass * 0.025, rotate: 0.004 + f.softTreble * 0.008 });
    fb.fade(0.045);

    const N = 128;
    const r0 = m * 0.1;
    const ring = (scale, width, color, lift) => {
      c.beginPath();
      for (let i = 0; i <= N; i++) {
        const u = (i % N) / N;
        const spec = u < 0.5 ? u * 2 : (1 - u) * 2;
        const e = bandAt(f.soft, spec);
        const r = r0 * scale * (1 + e * lift);
        const ang = u * TAU;
        const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.closePath();
      c.strokeStyle = color;
      c.lineWidth = width;
      c.stroke();
    };

    c.save();
    c.translate(w / 2, h / 2);
    c.rotate(this.rot);
    c.globalCompositeOperation = 'lighter';
    c.lineJoin = 'round';
    ring(1, 8, hsla(this.hue, 100, 55, 0.14), 1.2);
    ring(1, 2.5, hsla(this.hue, 100, 75, 0.85), 1.2);
    ring(0.6, 1.5, hsla(this.hue + 140, 100, 70, 0.8), 1.6);

    const glow = c.createRadialGradient(0, 0, 0, 0, 0, r0 * 0.6);
    glow.addColorStop(0, hsla(this.hue + 60, 100, 80, 0.12 + f.softBass * 0.3));
    glow.addColorStop(1, hsla(this.hue + 60, 100, 60, 0));
    c.fillStyle = glow;
    c.beginPath();
    c.arc(0, 0, r0 * 0.6, 0, TAU);
    c.fill();
    c.restore();

    fb.blit(ctx, this.w, this.h);
  }
}
