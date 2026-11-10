import { Visualization, hsla } from './base.js';

// Screensaver: Windows "Bezier". Bouncing cubic Bezier curves leave echo
// trails while their colour cycles. Loudness sets control-point speed; beats
// kick the points and shift the hue.
const NPTS = 7; // two joined cubic segments per curve

export class Bezier extends Visualization {
  static id = 'bezier';
  static title = 'Bezier';
  static group = 'Screensavers';

  constructor() {
    super();
    this.curves = [0, 1, 2].map((k) => ({
      pts: Array.from({ length: NPTS }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5 })),
      hue: k * 120,
      trail: [],
    }));
    this.acc = 0;
    this.kick = 0;
  }

  activate() { for (const c of this.curves) c.trail.length = 0; this.kick = 0; }

  draw(ctx, f, dt) {
    const { w, h } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    if (f.beat) this.kick = Math.max(this.kick, f.beatStrength);
    this.kick *= Math.exp(-4 * dt);
    const speed = 0.4 + f.softLevel * 1.8 + this.kick * 2.5;
    this.acc += dt;
    const record = this.acc >= 1 / 30;
    if (record) this.acc %= 1 / 30;
    ctx.lineCap = 'round';
    for (const c of this.curves) {
      c.hue += dt * 25 + (f.beat ? 30 + f.beatStrength * 40 : 0);
      for (const p of c.pts) {
        p.x += p.vx * speed * dt; p.y += p.vy * speed * dt;
        if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx); } else if (p.x > 1) { p.x = 1; p.vx = -Math.abs(p.vx); }
        if (p.y < 0) { p.y = 0; p.vy = Math.abs(p.vy); } else if (p.y > 1) { p.y = 1; p.vy = -Math.abs(p.vy); }
      }
      if (record) {
        c.trail.unshift({ pts: c.pts.map((p) => [p.x * w, p.y * h]), hue: c.hue });
        if (c.trail.length > 18) c.trail.pop();
      }
      const n = c.trail.length;
      for (let i = n - 1; i >= 0; i--) {
        const e = c.trail[i], P = e.pts;
        ctx.beginPath();
        ctx.moveTo(P[0][0], P[0][1]);
        for (let j = 1; j + 2 < NPTS; j += 3) ctx.bezierCurveTo(P[j][0], P[j][1], P[j + 1][0], P[j + 1][1], P[j + 2][0], P[j + 2][1]);
        ctx.strokeStyle = hsla(e.hue, 100, i === 0 ? 65 + this.kick * 25 : 55, 1 - i / n);
        ctx.lineWidth = i === 0 ? 2.2 + this.kick * 2 : 1.3;
        ctx.stroke();
      }
    }
  }
}
