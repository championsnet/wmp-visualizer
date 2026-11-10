import { Visualization, clamp, bandAt, TAU } from './base.js';

// Screensaver: a procedural "Bliss"-style landscape. A rolling green hill
// under a deep blue sky with soft drifting clouds. Clouds drift faster with
// loudness, grass sways on the beat clock, the sky brightens with bass, and
// the crest of the hill follows the smoothed spectrum very gently.
const N = 64;

export class Bliss extends Visualization {
  static id = 'bliss';
  static title = 'Bliss';
  static group = 'Screensavers';
  static retro = true;    // object-style graphics get the soft 2000s look

  constructor() {
    super();
    this._key = '';
    this.crest = new Float32Array(N + 1);
    this.clouds = [];
    this.sprites = [];
    this.blades = [];
  }

  activate() {
    this.crest.fill(0);
    this.drift = 0;
    this.glow = 0;
    this._key = '';
  }

  _build(ctx) {
    const { w, h } = this;
    const key = w + 'x' + h;
    if (key === this._key) return;
    this._key = key;
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.75);
    sky.addColorStop(0, '#1747b8'); sky.addColorStop(0.45, '#3f82e0');
    sky.addColorStop(0.85, '#8cc0f2'); sky.addColorStop(1, '#bcdcf7');
    this.gSky = sky;
    const hill = ctx.createLinearGradient(0, h * 0.5, 0, h);
    hill.addColorStop(0, '#7fd23a'); hill.addColorStop(0.3, '#4fae1e');
    hill.addColorStop(1, '#2b7a10');
    this.gHill = hill;
    const back = ctx.createLinearGradient(0, h * 0.55, 0, h);
    back.addColorStop(0, '#5aa83a'); back.addColorStop(1, '#2f6f1c');
    this.gBack = back;
    // side shading: a dark sweep to the right, a sunlit sweep on the left
    const sh = ctx.createLinearGradient(0, 0, w, 0);
    sh.addColorStop(0, 'rgba(255,255,160,0.12)'); sh.addColorStop(0.5, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(0,30,0,0.28)');
    this.gShade = sh;
    // cloud sprites: soft blobs pre-rendered offscreen
    this.sprites = [];
    for (let s = 0; s < 4; s++) {
      const cw = 420, chh = 200;
      const c = document.createElement('canvas');
      c.width = cw; c.height = chh;
      const x = c.getContext('2d');
      x.filter = 'blur(10px)';
      for (let i = 0; i < 14; i++) {
        const px = 130 + Math.random() * 160, py = 105 + Math.random() * 25 - (i % 3) * 10;
        const r = 20 + Math.random() * 28;
        x.fillStyle = `rgba(255,255,255,${0.55 + Math.random() * 0.35})`;
        x.beginPath(); x.ellipse(px, py, r * 1.5, r, 0, 0, TAU); x.fill();
      }
      x.filter = 'none';
      this.sprites.push(c);
    }
    this.clouds = [];
    for (let i = 0; i < 7; i++) {
      this.clouds.push({ x: Math.random() * w * 1.4 - w * 0.2, y: h * (0.05 + Math.random() * 0.35), s: 0.6 + Math.random() * 0.9, k: i % 4, sp: 0.6 + Math.random() * 0.8, a: 0.7 + Math.random() * 0.3 });
    }
    this.blades = [];
    const nb = Math.round(clamp(w / 3, 150, 700));
    for (let i = 0; i < nb; i++) this.blades.push({ u: Math.random(), d: Math.random(), l: 4 + Math.random() * 7, o: Math.random() });
  }

  _hillY(u, w, h) {
    // main hill: broad crest, peak left of centre, sloping down to the right
    const base = h * 0.62 - Math.sin(clamp(u * 1.05 + 0.08, 0, 1) * Math.PI) * h * 0.13 + u * h * 0.06;
    const i = u * N, i0 = Math.floor(i), fr = i - i0;
    const c = this.crest[Math.min(N, i0)] * (1 - fr) + this.crest[Math.min(N, i0 + 1)] * fr;
    return base - c * h * 0.03;
  }

  draw(ctx, f, dt) {
    const { w, h } = this;
    this._build(ctx);
    this.glow = Math.max(f.softBass, (this.glow || 0) * Math.exp(-dt * 2));
    for (let i = 0; i <= N; i++) this.crest[i] += (bandAt(f.soft, i / N) - this.crest[i]) * (1 - Math.exp(-dt * 3));

    ctx.fillStyle = this.gSky;
    ctx.fillRect(0, 0, w, h);
    if (this.glow > 0.02) {
      ctx.fillStyle = `rgba(200,230,255,${this.glow * 0.18})`;
      ctx.fillRect(0, 0, w, h * 0.7);
    }

    // clouds
    const wind = (8 + f.softLevel * 60) * Math.max(1, w / 900);
    for (const c of this.clouds) {
      c.x += wind * c.sp * dt;
      const sp = this.sprites[c.k];
      const cw = sp.width * c.s * (w / 1200 + 0.4), chh = sp.height * c.s * (w / 1200 + 0.4) * 0.8;
      if (c.x > w + 20) { c.x = -cw - Math.random() * 200; c.y = h * (0.04 + Math.random() * 0.36); }
      ctx.globalAlpha = c.a;
      ctx.drawImage(sp, c.x, c.y, cw, chh);
    }
    ctx.globalAlpha = 1;

    // distant hill on the right
    ctx.fillStyle = this.gBack;
    ctx.beginPath();
    ctx.moveTo(w * 0.35, h);
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      const x = w * (0.35 + u * 0.7);
      ctx.lineTo(x, h * 0.66 - Math.sin(u * Math.PI) * h * 0.06);
    }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();

    // main hill
    ctx.fillStyle = this.gHill;
    ctx.beginPath();
    ctx.moveTo(0, h);
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      ctx.lineTo(u * w, this._hillY(u, w, h));
    }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = this.gShade;
    ctx.fill();

    // soft sunlit band along the crest
    ctx.strokeStyle = 'rgba(200,255,120,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const u = i / steps, y = this._hillY(u, w, h) + 2;
      if (i) ctx.lineTo(u * w, y); else ctx.moveTo(0, y);
    }
    ctx.stroke();

    // grass blades swaying on the beat clock
    const sway = Math.sin(f.phase * TAU) * (0.25 + f.softLevel * 0.6);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(30,90,10,0.45)';
    ctx.beginPath();
    for (const b of this.blades) {
      const x = b.u * w;
      const top = this._hillY(b.u, w, h);
      const y = top + 3 + b.d * b.d * (h - top);
      const l = b.l * (0.6 + b.d * 1.2);
      const lean = (sway + Math.sin(b.o * TAU + b.u * 6) * 0.2) * l * 0.6;
      ctx.moveTo(x, y); ctx.lineTo(x + lean, y - l);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(190,255,110,0.35)';
    ctx.beginPath();
    for (let i = 0; i < this.blades.length; i += 2) {
      const b = this.blades[i];
      const x = b.u * w + 2;
      const top = this._hillY(b.u, w, h);
      const y = top + 2 + b.d * b.d * b.d * (h - top) * 0.7;
      const l = b.l * 0.7;
      ctx.moveTo(x, y); ctx.lineTo(x + sway * l * 0.6, y - l);
    }
    ctx.stroke();
  }
}
