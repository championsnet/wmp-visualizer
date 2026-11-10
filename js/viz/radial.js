import { Visualization, FeedbackBuffer, hsla, bandAt, TAU } from './base.js';

// Modern: a mirrored circular spectrum with rounded bars, a breathing core
// and soft afterglow.
export class Radial extends Visualization {
  static id = 'radial';
  static title = 'Radial Pulse';
  static group = 'Modern';

  constructor() {
    super();
    this.fb = new FeedbackBuffer(900);
    this.rot = 0;
    this.hue = 190;
    this.flash = 0;
  }

  activate() { this.fb.clear(); }

  draw(ctx, f, dt) {
    const fb = this.fb;
    fb.begin(this.w, this.h, dt);
    const { w, h } = fb;
    const c = fb.ctx;
    const m = Math.min(w, h);

    fb.transform({ zoom: 1.006 + f.softBass * 0.01 });
    fb.fade(0.14);

    this.rot += dt * 0.12;
    this.hue += dt * 10;
    this.flash = Math.max(f.beatStrength, this.flash * Math.exp(-dt * 5));

    const N = 120;
    const r0 = m * (0.18 + f.softBass * 0.05 + this.flash * 0.02);
    const maxL = m * 0.24;
    c.save();
    c.translate(w / 2, h / 2);
    c.rotate(this.rot);
    c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round';
    const bw = Math.max(1.5, (TAU * r0 / N) * 0.55);
    for (let i = 0; i < N; i++) {
      const u = i / N;
      const mirrored = u < 0.5 ? u * 2 : (1 - u) * 2;      // symmetric left / right
      const e = bandAt(f.soft, mirrored * 0.92);
      const L = 2 + e * maxL;
      const ang = u * TAU - Math.PI / 2;
      const cos = Math.cos(ang), sin = Math.sin(ang);
      c.beginPath();
      c.moveTo(cos * r0, sin * r0);
      c.lineTo(cos * (r0 + L), sin * (r0 + L));
      c.strokeStyle = hsla(this.hue + mirrored * 120, 100, 50 + e * 25, 0.9);
      c.lineWidth = bw;
      c.stroke();
    }
    // core
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r0 * 0.95);
    g.addColorStop(0, hsla(this.hue + 40, 100, 75, 0.25 + this.flash * 0.4));
    g.addColorStop(0.7, hsla(this.hue + 60, 100, 50, 0.08));
    g.addColorStop(1, hsla(this.hue + 60, 100, 50, 0));
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, r0 * 0.95, 0, TAU);
    c.fill();
    c.strokeStyle = hsla(this.hue, 100, 80, 0.6);
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(0, 0, r0 - 4, 0, TAU);
    c.stroke();
    c.restore();

    fb.blit(ctx, this.w, this.h);
  }
}
