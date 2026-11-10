import { Visualization, hsla } from './base.js';

// Screensaver: Windows "Mystify". Two four-cornered polygons bounce around,
// each leaving a trail of echoes. Loudness sets the speed, beats shift colour.
export class Mystify extends Visualization {
  static id = 'mystify';
  static title = 'Mystify';
  static group = 'Screensavers';

  constructor() {
    super();
    this.shapes = [0, 1].map((k) => ({
      pts: Array.from({ length: 4 }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6 })),
      hue: k ? 300 : 160,
      trail: [],
    }));
    this.acc = 0;
  }

  activate() { for (const s of this.shapes) s.trail.length = 0; }

  draw(ctx, f, dt) {
    const { w, h } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    const speed = 0.4 + f.softLevel * 1.2 + 2.2 * Math.exp(-f.phase * 6) * (0.4 + f.softLevel);
    // record an echo at a fixed rate so the trail spacing is frame-rate independent
    this.acc += dt;
    const record = this.acc >= 1 / 30;
    if (record) this.acc %= 1 / 30;
    ctx.lineJoin = 'round';
    for (const s of this.shapes) {
      s.hue += dt * 20 + f.beatStrength * 40;
      for (const p of s.pts) {
        p.x += p.vx * speed * dt;
        p.y += p.vy * speed * dt;
        if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx); }
        if (p.x > 1) { p.x = 1; p.vx = -Math.abs(p.vx); }
        if (p.y < 0) { p.y = 0; p.vy = Math.abs(p.vy); }
        if (p.y > 1) { p.y = 1; p.vy = -Math.abs(p.vy); }
      }
      if (record) {
        s.trail.unshift({ pts: s.pts.map((p) => [p.x, p.y]), hue: s.hue });
        if (s.trail.length > 14) s.trail.pop();
      }
      s.trail.forEach((e, i) => {
        ctx.beginPath();
        e.pts.forEach(([x, y], j) => (j ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
        ctx.closePath();
        ctx.strokeStyle = hsla(e.hue, 100, 60, 1 - i / s.trail.length);
        ctx.lineWidth = i === 0 ? 2 : 1.2;
        ctx.stroke();
      });
    }
  }
}
