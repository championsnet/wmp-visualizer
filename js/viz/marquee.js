import { Visualization, hsla, clamp } from './base.js';

// Screensaver: Windows "3D Text". Big extruded text spins and wobbles in 3D
// (faked with scale + skew), bounces to the beat and cycles colour.
const DEFAULT = 'WMP';
const LAYERS = 16;

export class Marquee extends Visualization {
  static id = 'marquee';
  static title = '3D Text';
  static group = 'Screensavers';
  static retro = true;    // object-style graphics get the soft 2000s look
  static textOption = true;

  constructor() {
    super();
    this.text = DEFAULT;
    try { const q = new URLSearchParams(location.search).get('text'); if (q) this.setText(q); } catch { /* no location */ }
    this.activate();
  }

  setText(str) {
    const s = String(str ?? '').trim().slice(0, 24);
    this.text = s || DEFAULT;
    this._mw = 0;
  }

  activate() { this.ry = 0; this.rx = 0; this.hue = 200; this.bump = 0; this.px = 0; this.py = 0; this.vx = 0.07; this.vy = 0.05; }

  draw(ctx, f, dt, t) {
    const { w, h } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    if (f.beat) this.bump = Math.max(this.bump, 0.4 + f.beatStrength * 0.6);
    this.bump *= Math.exp(-5 * dt);
    const spin = 0.6 + f.softLevel * 1.6 + this.bump;
    this.ry += dt * spin;
    this.rx = Math.sin(t * 0.7) * 0.45;
    this.hue += dt * 30 + (f.beat ? 25 : 0);
    // gentle drift around the screen
    this.px += this.vx * dt; this.py += this.vy * dt;
    if (Math.abs(this.px) > 0.15) { this.px = clamp(this.px, -0.15, 0.15); this.vx = -this.vx; }
    if (Math.abs(this.py) > 0.15) { this.py = clamp(this.py, -0.15, 0.15); this.vy = -this.vy; }

    const size = Math.min(h * 0.32, w * 1.5 / Math.max(2, this.text.length));
    ctx.font = `900 ${size.toFixed(0)}px Impact, "Arial Black", Arial, sans-serif`;
    if (this._mw !== size) { this._mw = size; this._tw = ctx.measureText(this.text).width; }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const pulse = 1 + 0.12 * Math.exp(-(f.phase || 0) * 5) + this.bump * 0.15;
    const cy = Math.cos(this.ry), sy = Math.sin(this.ry);
    const cxr = Math.cos(this.rx), sxr = Math.sin(this.rx);
    // abs(): on the back half of the spin the text turns to face you again,
    // so it always reads correctly instead of mirrored
    const sx = Math.max(0.08, Math.abs(cy)) * pulse;
    const sv = cxr * pulse;
    const depth = size * 0.28;
    const ex = -sy * depth, ey = sxr * depth;   // extrusion direction on screen

    ctx.save();
    ctx.translate(w / 2 + this.px * w, h / 2 + this.py * h);
    // scale for rotation, skew for a bit of perspective lean
    ctx.transform(sx, sy * sxr * 0.25, -sy * 0.15, sv, 0, 0);
    const hue = this.hue;
    for (let i = LAYERS; i >= 1; i--) {
      const k = i / LAYERS;
      ctx.fillStyle = hsla(hue, 80, 12 + 22 * (1 - k), 1);
      ctx.fillText(this.text, ex * k / sx, ey * k / sv);
    }
    const tw = this._tw;
    const g = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5);
    const facing = 0.5 + 0.5 * Math.abs(cy);
    g.addColorStop(0, hsla(hue, 100, 85 * facing + 10, 1));
    g.addColorStop(0.45, hsla(hue, 100, 55 * facing + 5, 1));
    g.addColorStop(1, hsla(hue + 30, 100, 30 * facing + 5, 1));
    ctx.fillStyle = g;
    ctx.fillText(this.text, 0, 0);
    // moving specular sweep, clipped to the glyphs by filling the text again
    const sp = (((this.ry * 0.3) % 1) + 1) % 1 * 2 - 0.5;
    const hg = ctx.createLinearGradient(-tw / 2, 0, tw / 2, 0);
    const a0 = clamp(sp - 0.12, 0, 1), a1 = clamp(sp, 0, 1), a2 = clamp(sp + 0.12, 0, 1);
    hg.addColorStop(0, 'rgba(255,255,255,0)');
    if (a1 > 0 && a1 < 1) { hg.addColorStop(a0, 'rgba(255,255,255,0)'); hg.addColorStop(a1, `rgba(255,255,255,${(0.45 + this.bump * 0.4).toFixed(2)})`); hg.addColorStop(a2, 'rgba(255,255,255,0)'); }
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg;
    ctx.fillText(this.text, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
