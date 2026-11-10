import { Visualization, hsla, bandAt } from './base.js';

// Modern: synthwave terrain. Each frame the spectrum becomes a new ridge at
// the front; older ridges recede towards a glowing sun on the horizon.
export class Terrain extends Visualization {
  static id = 'terrain';
  static title = 'Neon Terrain';
  static group = 'Modern';

  constructor() {
    super();
    this.rows = 48;
    this.cols = 72;
    this.hist = [];
    for (let r = 0; r < this.rows; r++) this.hist.push(new Float32Array(this.cols));
    this.scroll = 0;
    this.sky = null;
    this.skyKey = '';
  }

  activate() { for (const r of this.hist) r.fill(0); this.scroll = 0; }

  draw(ctx, f, dt, t) {
    const { w, h, rows, cols } = this;
    const horizon = h * 0.46;

    const key = `${w}|${h}`;
    if (key !== this.skyKey) {
      const g = ctx.createLinearGradient(0, 0, 0, horizon);
      g.addColorStop(0, '#05010f');
      g.addColorStop(0.7, '#1a0633');
      g.addColorStop(1, '#3b0a4f');
      this.sky = g;
      this.skyKey = key;
    }
    ctx.fillStyle = this.sky;
    ctx.fillRect(0, 0, w, horizon + 1);
    ctx.fillStyle = '#05010f';
    ctx.fillRect(0, horizon, w, h - horizon);

    // sun with horizontal cut-outs
    const sr = Math.min(w, h) * (0.17 + f.softBass * 0.03);
    const sx = w / 2, sy = horizon - sr * 0.25;
    const sg = ctx.createLinearGradient(0, sy - sr, 0, sy + sr);
    sg.addColorStop(0, '#ffe76a');
    sg.addColorStop(0.55, '#ff6a8b');
    sg.addColorStop(1, '#b8238f');
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, horizon);
    ctx.clip();
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a0742';
    for (let k = 0; k < 6; k++) {
      const y = sy + sr * (0.1 + k * 0.16);
      ctx.fillRect(sx - sr, y, sr * 2, 2 + k * 1.6);
    }
    ctx.restore();

    // advance at a fixed rate in time; shift in a new ridge per step
    this.scroll += dt * 12 * (0.5 + 1.6 * Math.exp(-f.phase * 6));
    while (this.scroll >= 1) {
      this.scroll -= 1;
      const row = this.hist.pop();
      for (let i = 0; i < cols; i++) {
        const u = Math.abs(i / (cols - 1) - 0.5) * 2;       // bass in the middle
        const edge = Math.pow(u, 1.6);                       // sides rise like mountains
        row[i] = bandAt(f.soft, 1 - u) * (1 - edge * 0.4) + edge * 0.35;
      }
      this.hist.unshift(row);
    }

    // back to front, each ridge filled black so nearer ridges hide farther ones
    const camH = h * 0.62;
    ctx.lineJoin = 'round';
    for (let r = rows - 1; r >= 0; r--) {
      const z = 1 + r + this.scroll;                       // sub-step offset = smooth motion
      const p = 1 / z;
      const yBase = horizon + camH * p * 2.2;
      if (yBase > h + 40) continue;
      const spread = w * 1.6 * p * 2.2;
      const row = this.hist[r];
      ctx.beginPath();
      for (let i = 0; i < cols; i++) {
        const x = w / 2 + (i / (cols - 1) - 0.5) * spread * 2;
        const y = yBase - row[i] * h * 1.7 * p * 2.2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      const a = Math.min(1, 1.6 - r / rows * 1.4);
      ctx.lineTo(w / 2 + spread, h);
      ctx.lineTo(w / 2 - spread, h);
      ctx.closePath();
      ctx.fillStyle = '#05010f';
      ctx.fill();
      ctx.strokeStyle = hsla(300 - r * 2 + Math.sin(t * 0.3) * 20, 100, 62, a);
      ctx.lineWidth = Math.max(0.6, 2.2 * p * 3);
      ctx.stroke();
    }
  }
}
