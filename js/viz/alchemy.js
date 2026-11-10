import { Visualization, FeedbackBuffer, hsla, TAU } from './base.js';

// WMP "Alchemy": sparks flung from the centre, mirrored into a kaleidoscope
// and swirled outward by a slowly rotating zoom.
export class Alchemy extends Visualization {
  static id = 'alchemy';
  static title = 'Random';
  static group = 'Alchemy';

  constructor() {
    super();
    this.fb = new FeedbackBuffer(800);
    this.particles = [];
    this.hue = 0;
    this.rot = 0;
    this.acc = 0;
    this.symmetry = 3;
    this.beats = 0;
  }

  activate() { this.fb.clear(); this.particles.length = 0; }

  draw(ctx, f, dt, t) {
    const fb = this.fb;
    fb.begin(this.w, this.h, dt);
    const { w, h } = fb;
    const c = fb.ctx;
    const m = Math.min(w, h);

    this.rot += dt * 0.15 * (1 + f.softMid);
    this.hue += dt * 25 + f.beatStrength * 20;
    fb.transform({ zoom: 1.016 + f.softBass * 0.01, rotate: 0.004 * Math.sin(t * 0.37) });
    fb.fade(0.045);

    if (f.beat && ++this.beats % 16 === 0) this.symmetry = [2, 3, 4, 5][(this.beats / 16) % 4];

    // emission is per second, so it is the same at any frame rate
    this.acc += (f.beat ? 25 + f.beatStrength * 45 : 0) + f.softLevel * 150 * dt;
    while (this.acc >= 1 && this.particles.length < 400) {
      this.acc -= 1;
      const a = Math.random() * TAU;
      const sp = m * (0.05 + Math.random() * 0.25 + f.softBass * 0.3);
      this.particles.push({ x: 0, y: 0, px: 0, py: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 + Math.random() });
    }
    this.acc = Math.min(this.acc, 1);

    const ps = this.particles;
    const limit = Math.max(w, h);
    const drag = Math.exp(-dt * 0.5);
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.px = p.x; p.py = p.y;
      p.vx += -p.y * dt * 0.8;
      p.vy += p.x * dt * 0.8;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= drag;
      p.vy *= drag;
      p.life -= dt;
      if (p.life <= 0 || Math.abs(p.x) > limit || Math.abs(p.y) > limit) ps.splice(i, 1);
    }

    c.save();
    c.translate(w / 2, h / 2);
    c.rotate(this.rot);
    c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round';
    for (let s = 0; s < this.symmetry; s++) {
      for (const mirror of [1, -1]) {
        c.save();
        c.rotate((s * TAU) / this.symmetry);
        c.scale(1, mirror);
        c.beginPath();
        for (const p of ps) { c.moveTo(p.px, p.py); c.lineTo(p.x, p.y); }
        c.strokeStyle = hsla(this.hue + s * 25, 100, 65, 0.8);
        c.lineWidth = 1.6;
        c.stroke();
        c.restore();
      }
    }
    c.restore();

    fb.blit(ctx, this.w, this.h);
  }
}
