import { Visualization, FeedbackBuffer, hsla, TAU } from './base.js';

// Modern: thousands of particles drifting through a slowly morphing flow
// field. Loudness sets their speed, bass bends the field, beats push them out.
export class Flow extends Visualization {
  static id = 'flow';
  static title = 'Particle Flow';
  static group = 'Modern';

  constructor() {
    super();
    this.fb = new FeedbackBuffer(900);
    this.n = 1400;
    this.x = new Float32Array(this.n);
    this.y = new Float32Array(this.n);
    this.px = new Float32Array(this.n);
    this.py = new Float32Array(this.n);
    this.life = new Float32Array(this.n);
    this.hue = 180;
    this.kick = 0;
    this.seeded = false;
  }

  activate() { this.fb.clear(); this.seeded = false; }

  _respawn(i, w, h) {
    this.x[i] = this.px[i] = Math.random() * w;
    this.y[i] = this.py[i] = Math.random() * h;
    this.life[i] = 2 + Math.random() * 4;
  }

  draw(ctx, f, dt, t) {
    const fb = this.fb;
    fb.begin(this.w, this.h, dt);
    const { w, h } = fb;
    const c = fb.ctx;
    const m = Math.min(w, h);

    if (!this.seeded) {
      for (let i = 0; i < this.n; i++) { this._respawn(i, w, h); this.life[i] *= Math.random(); }
      this.seeded = true;
    }
    fb.fade(0.07);
    this.hue += dt * 12;
    this.kick = Math.max(f.beatStrength, this.kick * Math.exp(-dt * 4));

    const speed = m * (0.05 + f.softLevel * 0.25 + this.kick * 0.25);
    const scale = 3.2 / m;
    const warp = 1 + f.softBass * 1.5;
    const tt = t * 0.15;
    const cx = w / 2, cy = h / 2;

    c.save();
    c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round';
    c.lineWidth = 1.3;
    // four colour batches: one stroke call each (fast)
    for (let b = 0; b < 4; b++) {
      c.beginPath();
      for (let i = b; i < this.n; i += 4) {
        let x = this.x[i], y = this.y[i];
        const nx = x * scale, ny = y * scale;
        const a = Math.sin(nx * 1.3 + tt) * Math.cos(ny * 1.1 - tt * 1.3) * TAU * warp
          + Math.sin((nx + ny) * 0.7 + tt * 0.6) * 1.5;
        let vx = Math.cos(a), vy = Math.sin(a);
        // beat: brief push away from the centre
        const dx = x - cx, dy = y - cy;
        const d = Math.hypot(dx, dy) || 1;
        vx += (dx / d) * this.kick * 1.5;
        vy += (dy / d) * this.kick * 1.5;
        this.px[i] = x; this.py[i] = y;
        x += vx * speed * dt;
        y += vy * speed * dt;
        this.x[i] = x; this.y[i] = y;
        this.life[i] -= dt;
        if (this.life[i] <= 0 || x < -5 || y < -5 || x > w + 5 || y > h + 5) {
          this._respawn(i, w, h);
          continue;
        }
        c.moveTo(this.px[i], this.py[i]);
        c.lineTo(x, y);
      }
      c.strokeStyle = hsla(this.hue + b * 35, 95, 55 + f.softTreble * 20, 0.55);
      c.stroke();
    }
    c.restore();

    fb.blit(ctx, this.w, this.h);
  }
}
