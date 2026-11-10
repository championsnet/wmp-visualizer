// Shared pieces for visualizations: the base class, a feedback buffer for
// trail / zoom / blur effects, and small helpers.
//
// Timing: every per-frame effect in FeedbackBuffer is expressed "per 1/60 s"
// and scaled by the real frame time, so motion is the same speed at 30, 60,
// 120 or 144 Hz and does not stutter when a frame is dropped.

export class Visualization {
  static id = 'base';
  static title = 'Base';
  static group = '';

  constructor() {
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
  }

  resize(w, h, dpr) {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
  }

  activate() {}

  // ctx is scaled so 1 unit = 1 CSS pixel. dt: smoothed seconds since last frame.
  draw(ctx, frame, dt, t) {} // eslint-disable-line no-unused-vars
}

function makeCanvas() {
  const c = document.createElement('canvas');
  return [c, c.getContext('2d')];
}

export class FeedbackBuffer {
  constructor(maxDim = 960) {
    this.maxDim = maxDim;
    [this.canvas, this.ctx] = makeCanvas();
    [this.copy, this.cctx] = makeCanvas();       // previous frame, so we never draw a canvas onto itself
    [this.scratch, this.sctx] = makeCanvas();
    this.w = 0;
    this.h = 0;
    this.k = 1;                                  // frame time in 60 Hz frames
    this._diffAcc = 0;
  }

  // Call once at the start of each draw.
  begin(cssW, cssH, dt) {
    this.resize(cssW, cssH);
    this.k = Math.min(3, Math.max(0.1, dt * 60));
  }

  resize(cssW, cssH) {
    const s = Math.min(1, this.maxDim / Math.max(cssW, cssH, 1));
    const w = Math.max(2, Math.round(cssW * s));
    const h = Math.max(2, Math.round(cssH * s));
    if (w === this.w && h === this.h) return;
    const hadContent = this.w && this.h;
    if (hadContent) {
      this.copy.width = this.w;
      this.copy.height = this.h;
      this.cctx.drawImage(this.canvas, 0, 0);
    }
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, w, h);
    if (hadContent) this.ctx.drawImage(this.copy, 0, 0, w, h);
    this.w = w;
    this.h = h;
    this.copy.width = w;
    this.copy.height = h;
  }

  clear(color = '#000') {
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.globalAlpha = 1;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.w, this.h);
  }

  // Redraw the previous frame zoomed / rotated / shifted around the centre.
  // zoom, rotate (radians), dx, dy are amounts per 1/60 s.
  transform({ zoom = 1, rotate = 0, dx = 0, dy = 0, cx = 0.5, cy = 0.5 } = {}) {
    const k = this.k;
    const w = this.w, h = this.h;
    this.cctx.globalCompositeOperation = 'copy';
    this.cctx.drawImage(this.canvas, 0, 0);
    const c = this.ctx;
    c.save();
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'low';
    c.translate(w * cx + dx * k, h * cy + dy * k);
    c.rotate(rotate * k);
    const z = Math.pow(zoom, k);
    c.scale(z, z);
    c.translate(-w * cx, -h * cy);
    c.drawImage(this.copy, 0, 0);
    c.restore();
  }

  // Fade towards a colour; amount is the fraction removed per 1/60 s.
  fade(amount, color = '#000') {
    const a = 1 - Math.pow(1 - Math.min(0.999, amount), this.k);
    const c = this.ctx;
    c.save();
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = a;
    c.fillStyle = color;
    c.fillRect(0, 0, this.w, this.h);
    // 8-bit rounding can leave dim pixels stuck above black forever; nudge
    // them down at a fixed rate (once per 1/60 s, independent of frame rate).
    this._diffAcc += this.k;
    if (color === '#000' && this._diffAcc >= 1) {
      this._diffAcc %= 1;
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'difference';
      c.fillStyle = 'rgb(1,1,1)';
      c.fillRect(0, 0, this.w, this.h);
    }
    c.restore();
  }

  // Soft blur: downscale and back up with bilinear filtering, blended by strength.
  blur(factor = 0.5, strength = 1) {
    const sw = Math.max(1, Math.round(this.w * factor));
    const sh = Math.max(1, Math.round(this.h * factor));
    if (this.scratch.width !== sw || this.scratch.height !== sh) {
      this.scratch.width = sw;
      this.scratch.height = sh;
    }
    this.sctx.imageSmoothingQuality = 'medium';
    this.sctx.drawImage(this.canvas, 0, 0, sw, sh);
    const c = this.ctx;
    c.save();
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = Math.min(1, strength * Math.min(1, this.k));
    c.drawImage(this.scratch, 0, 0, this.w, this.h);
    c.restore();
  }

  blit(ctx, w, h) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(this.canvas, 0, 0, w, h);
    ctx.restore();
  }
}

export const TAU = Math.PI * 2;

export function hsla(h, s, l, a = 1) {
  return `hsla(${(((h % 360) + 360) % 360).toFixed(1)},${s}%,${l}%,${a})`;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Exponential approach that is frame-rate independent: rate is per second.
export function approach(cur, target, rate, dt) {
  return cur + (target - cur) * (1 - Math.exp(-rate * dt));
}

export function bandAt(bands, u) {
  const x = clamp(u, 0, 1) * (bands.length - 1);
  const i = Math.floor(x);
  const fr = x - i;
  const j = Math.min(i + 1, bands.length - 1);
  return bands[i] * (1 - fr) + bands[j] * fr;
}

export function bandMax(bands, u0, u1) {
  const n = bands.length;
  const i0 = clamp(Math.floor(u0 * n), 0, n - 1);
  const i1 = clamp(Math.ceil(u1 * n), i0 + 1, n);
  let m = 0;
  for (let i = i0; i < i1; i++) if (bands[i] > m) m = bands[i];
  return m;
}

// Steady waveform for scope-style drawing. Like an oscilloscope trigger, it
// starts each frame at a rising zero crossing so the trace does not jump
// sideways, smooths within the frame, and applies a slow auto-gain so quiet
// and loud sources both fill the shape. Output: `pts` in about -1..1.
export class WaveSampler {
  constructor(n = 256) {
    this.n = n;
    this.pts = new Float32Array(n);
    this.gain = 4;
  }

  sample(time, dt, span = 0.5) {
    const len = time.length;
    const win = Math.floor(len * span);
    let start = 0;
    for (let i = 1; i < len - win; i++) {
      if (time[i - 1] < 128 && time[i] >= 128) { start = i; break; }
    }
    const n = this.n;
    const step = win / n;
    let peak = 0;
    for (let i = 0; i < n; i++) {
      const j = start + Math.floor(i * step);
      const a = time[Math.max(0, j - 1)], b = time[j], c = time[Math.min(len - 1, j + 1)];
      const v = ((a + 2 * b + c) / 4 - 128) / 128;
      this.pts[i] = v;
      const av = v < 0 ? -v : v;
      if (av > peak) peak = av;
    }
    // gain targets a peak of ~0.9; rises slowly, drops quickly on loud input
    const target = Math.min(12, 0.9 / Math.max(peak, 0.02));
    const rate = target < this.gain ? 8 : 0.8;
    this.gain += (target - this.gain) * (1 - Math.exp(-rate * dt));
    for (let i = 0; i < n; i++) {
      const v = this.pts[i] * this.gain;
      this.pts[i] = v > 1.2 ? 1.2 : v < -1.2 ? -1.2 : v;
    }
    return this.pts;
  }
}
