import { Visualization, WaveSampler, bandMax, clamp } from './base.js';

// Classic 2000s mini-player look, blown up full screen: chunky segmented bars,
// green -> yellow -> red, gray falling peaks, black with a faint dotted grid.

// 16-step palette, bottom (index 0) to top
const PAL = [];
for (let i = 0; i < 16; i++) {
  const u = i / 15;
  let r, g;
  if (u < 0.5) { r = Math.round(u * 2 * 230); g = 210; } else { r = 230; g = Math.round((1 - (u - 0.5) * 2) * 210); }
  PAL.push(`rgb(${r},${g},${u > 0.85 ? 20 : 30})`);
}

function grid(ctx, w, h, cell) {
  ctx.fillStyle = 'rgb(48,48,58)';
  for (let y = cell; y < h; y += cell * 2) {
    for (let x = cell; x < w; x += cell * 2) ctx.fillRect(x, y, 1, 1);
  }
}

export class RetroSpectrum extends Visualization {
  static id = 'retrospectrum';
  static title = 'Classic Spectrum';
  static group = 'Retro Players';

  constructor() {
    super();
    this.N = 19;
    this.activate();
  }

  activate() {
    this.lv = new Float32Array(this.N);
    this.peak = new Float32Array(this.N);
    this.pv = new Float32Array(this.N);
  }

  draw(ctx, f, dt) {
    const W = this.w, H = this.h;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const N = this.N;
    const S = 16; // segments
    const px = Math.max(3, Math.floor(Math.min(W / (N * 4.5), H / (S * 2.2))));
    const seg = px * 2;
    const barW = px * 3;
    const gap = px;
    const totalW = N * barW + (N - 1) * gap;
    const totalH = S * seg;
    const x0 = Math.floor((W - totalW) / 2);
    const y0 = Math.floor((H + totalH) / 2);
    grid(ctx, W, H, px * 2);

    for (let i = 0; i < N; i++) {
      const u0 = i / N, u1 = (i + 1) / N;
      const raw = bandMax(f.bands, u0 * 0.9, u1 * 0.9);
      const target = clamp(raw * 1.1, 0, 1);
      // fast attack, gravity-like release
      if (target > this.lv[i]) this.lv[i] = target;
      else this.lv[i] = Math.max(target, this.lv[i] - dt * 1.6);
      if (this.lv[i] >= this.peak[i]) { this.peak[i] = this.lv[i]; this.pv[i] = 0; }
      else { this.pv[i] += dt * 2.2; this.peak[i] = Math.max(0, this.peak[i] - this.pv[i] * dt); }

      const x = x0 + i * (barW + gap);
      const n = Math.round(this.lv[i] * S);
      for (let s = 0; s < n; s++) {
        ctx.fillStyle = PAL[s];
        ctx.fillRect(x, y0 - (s + 1) * seg, barW, seg - px * 0.5 | 0 || seg - 1);
      }
      const ps = Math.min(S - 1, Math.round(this.peak[i] * S));
      if (ps > 0) {
        ctx.fillStyle = 'rgb(150,150,150)';
        ctx.fillRect(x, y0 - (ps + 1) * seg + seg - px, barW, px);
      }
    }
    ctx.restore();
  }
}

export class RetroScope extends Visualization {
  static id = 'retroscope';
  static title = 'Classic Oscilloscope';
  static group = 'Retro Players';

  constructor() {
    super();
    this.activate();
  }

  activate() {
    this.cols = 0;
    this.smooth = null;
    this.wave = new WaveSampler(512);
  }

  draw(ctx, f, dt) {
    const W = this.w, H = this.h;
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const px = Math.max(4, Math.floor(Math.min(W / 76, H / 34)));
    grid(ctx, W, H, px * 2);
    const cols = Math.floor((W * 0.9) / px);
    const rows = Math.floor((H * 0.8) / px / 2) * 2;
    if (cols !== this.cols) { this.cols = cols; this.smooth = new Float32Array(cols); }
    const x0 = Math.floor((W - cols * px) / 2);
    const yc = Math.floor(H / 2 / px) * px;
    const half = rows / 2;
    const pts = this.wave.sample(f.time, dt, 0.4);
    const k = 1 - Math.exp(-dt * 30);
    let prev = null;
    for (let i = 0; i < cols; i++) {
      const v = pts[Math.floor((i / cols) * pts.length)];
      this.smooth[i] += (clamp(v * 1.5, -1, 1) - this.smooth[i]) * k;
      const r = Math.round(this.smooth[i] * half);
      const a = Math.min(15, Math.round(Math.abs(r) / half * 15 * 1.3));
      const lo = prev === null ? r : Math.min(prev, r), hi = prev === null ? r : Math.max(prev, r);
      ctx.fillStyle = PAL[a];
      // connect to previous column with a vertical run of pixels (line mode)
      ctx.fillRect(x0 + i * px, yc - hi * px, px, (hi - lo + 1) * px);
      prev = r;
    }
    ctx.restore();
  }
}
