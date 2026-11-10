import { Visualization, hsla } from './base.js';

// Screensaver: Windows "Starfield". Stars fly towards you; the music sets
// the warp speed and beats give a short boost and a colour tint.
export class Starfield extends Visualization {
  static id = 'starfield';
  static title = 'Starfield';
  static group = 'Screensavers';

  constructor() {
    super();
    this.n = 700;
    this.sx = new Float32Array(this.n);
    this.sy = new Float32Array(this.n);
    this.sz = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) this._spawn(i, Math.random());
    this.boost = 0;
    this.hue = 200;
  }

  _spawn(i, z) {
    this.sx[i] = (Math.random() * 2 - 1);
    this.sy[i] = (Math.random() * 2 - 1);
    this.sz[i] = z;
  }

  draw(ctx, f, dt) {
    const { w, h } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, w, h);
    this.boost = Math.max(f.beatStrength, this.boost * Math.exp(-dt * 4));
    this.hue += dt * 15;
    const speed = 0.1 + f.softLevel * 0.4 + this.boost * 0.6 + 0.5 * Math.exp(-f.phase * 6) * f.softLevel;
    const cx = w / 2, cy = h / 2, s = Math.max(w, h) * 0.5;
    ctx.lineCap = 'round';
    for (let i = 0; i < this.n; i++) {
      const z0 = this.sz[i];
      const z1 = z0 - speed * dt;
      if (z1 <= 0.02) { this._spawn(i, 1); continue; }
      this.sz[i] = z1;
      const x0 = cx + (this.sx[i] / z0) * s * 0.5, y0 = cy + (this.sy[i] / z0) * s * 0.5;
      const x1 = cx + (this.sx[i] / z1) * s * 0.5, y1 = cy + (this.sy[i] / z1) * s * 0.5;
      if (x1 < -10 || x1 > w + 10 || y1 < -10 || y1 > h + 10) { this._spawn(i, 1); continue; }
      const b = 1 - z1;
      ctx.strokeStyle = this.boost > 0.05
        ? hsla(this.hue + i % 60, 80, 60 + b * 35, b)
        : `rgba(255,255,255,${b})`;
      ctx.lineWidth = 0.5 + b * 2.5;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  }
}
