import { Visualization, hsla, TAU } from './base.js';

// Screensaver: the bouncing DVD logo. It changes colour on every wall hit,
// swells on the beat, moves faster when the music is loud, and celebrates
// when it finally hits a corner exactly (as watched on The Office).
const COLORS = [0, 45, 90, 160, 200, 260, 300];

export class DvdBounce extends Visualization {
  static id = 'dvd';
  static title = 'DVD Bounce';
  static group = 'Screensavers';
  static retro = true;    // object-style graphics get the soft 2000s look

  constructor() {
    super();
    this.x = 40; this.y = 40;
    this.vx = 1; this.vy = 1;
    this.ci = 0;
    this.pulse = 0;
    this.corners = 0;
    this.party = 0;
    this.sparks = [];
    this.flash = 0;
  }

  activate() {
    this.x = Math.random() * Math.max(1, this.w * 0.5);
    this.y = Math.random() * Math.max(1, this.h * 0.5);
    const a = 0.6 + Math.random() * 0.4;
    this.vx = Math.cos(a); this.vy = Math.sin(a);
    this.sparks.length = 0;
    this.party = 0;
  }

  _logo(ctx, lw, lh, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `italic 900 ${lh * 0.6}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
    ctx.save();
    ctx.scale(1.15, 1);
    ctx.fillText('DVD', lw / 2 / 1.15, lh * 0.58);
    ctx.restore();
    // the disc underneath
    const cx = lw / 2, cy = lh * 0.8, rx = lw * 0.48, ry = lh * 0.15;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = `700 ${ry * 1.3}px Arial, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText('V I D E O', cx, cy + 1);
  }

  draw(ctx, f, dt) {
    const { w, h } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    this.pulse = Math.max(f.beatStrength, this.pulse * Math.exp(-dt * 7));
    const base = Math.min(w, h) * 0.24;
    const lw = base * (1 + this.pulse * 0.15);
    const lh = lw * 0.52;
    const speed = Math.min(w, h) * (0.18 + f.softLevel * 0.35);

    this.x += this.vx * speed * dt;
    this.y += this.vy * speed * dt;
    let hitX = false, hitY = false;
    if (this.x <= 0) { this.x = 0; this.vx = Math.abs(this.vx); hitX = true; }
    if (this.x + lw >= w) { this.x = w - lw; this.vx = -Math.abs(this.vx); hitX = true; }
    if (this.y <= 0) { this.y = 0; this.vy = Math.abs(this.vy); hitY = true; }
    if (this.y + lh >= h) { this.y = h - lh; this.vy = -Math.abs(this.vy); hitY = true; }
    if (hitX || hitY) this.ci = (this.ci + 1 + Math.floor(Math.random() * (COLORS.length - 1))) % COLORS.length;

    // A "corner" counts when both walls are touched within a few pixels.
    const tol = 4;
    const nearX = this.x <= tol || this.x + lw >= w - tol;
    const nearY = this.y <= tol || this.y + lh >= h - tol;
    if ((hitX || hitY) && nearX && nearY && this.party <= 0) {
      this.corners++;
      this.party = 3;
      this.flash = 1;
      const cx = this.x + lw / 2, cy = this.y + lh / 2;
      for (let i = 0; i < 160; i++) {
        const a = Math.random() * TAU, s = 120 + Math.random() * 520;
        this.sparks.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 200, life: 1.5 + Math.random(), hue: Math.random() * 360 });
      }
    }
    this.party -= dt;
    this.flash *= Math.exp(-dt * 3);

    if (this.flash > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.25})`;
      ctx.fillRect(0, 0, w, h);
    }

    const hue = COLORS[this.ci];
    const color = this.party > 0 ? hsla((performance.now() / 4) % 360, 100, 60) : hsla(hue, 100, 55);
    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y));
    ctx.shadowColor = color;
    ctx.shadowBlur = 10 + this.pulse * 30;
    this._logo(ctx, lw, lh, color);
    ctx.restore();

    // confetti
    const g = 600;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.vy += g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0 || p.y > h + 20) { this.sparks.splice(i, 1); continue; }
      ctx.fillStyle = hsla(p.hue, 100, 60, Math.min(1, p.life));
      ctx.fillRect(p.x, p.y, 4, 4);
    }

    if (this.party > 0 || this.corners) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.font = `600 ${Math.max(12, h * 0.025)}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillStyle = this.party > 0 ? '#fff' : 'rgba(255,255,255,0.35)';
      ctx.fillText(this.party > 0 ? 'IT HIT THE CORNER!' : `Corner hits: ${this.corners}`, w - 14, h - 10);
    }
  }
}
