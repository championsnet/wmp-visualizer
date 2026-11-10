import { Visualization, FeedbackBuffer, WaveSampler, hsla } from './base.js';

// WMP "Bars and Waves: Ocean Mist" (and its sibling "Fire Storm"): a waveform
// near the bottom whose trace drifts upward, blurring and fading into mist.
class RisingMist extends Visualization {
  static group = 'Bars and Waves';
  constructor(opts) {
    super();
    this.o = opts;
    this.fb = new FeedbackBuffer(640);
    this.hue = opts.hue;
    this.wave = new WaveSampler(192);
  }

  activate() { this.fb.clear(); }

  draw(ctx, f, dt, t) {
    const fb = this.fb;
    fb.begin(this.w, this.h, dt);
    const { w, h } = fb;
    const c = fb.ctx;
    const o = this.o;

    // rise, spread sideways a touch, shimmer, blur, fade
    const wobble = Math.sin(t * o.shimmerRate) * o.shimmer * w;
    fb.transform({ zoom: o.spread, dy: -h * (o.rise + f.softLevel * o.rise), dx: wobble, cy: 1 });
    fb.blur(0.5, 0.6);
    fb.fade(o.fade);

    this.hue = o.hue + Math.sin(t * 0.2) * o.hueRange;
    const N = this.wave.n;
    const pts = this.wave.sample(f.time, dt, 0.6);
    const yc = h * o.baseline;
    const amp = h * (0.06 + f.softLevel * 0.1) * (0.8 + 0.6 * Math.exp(-f.phase * 6));
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.lineJoin = 'round';
    c.beginPath();
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * w;
      const y = yc + pts[i] * amp;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.strokeStyle = hsla(this.hue, 100, o.light, 0.35);
    c.lineWidth = 6;
    c.stroke();
    c.strokeStyle = hsla(this.hue + o.coreShift, 100, o.coreLight, 0.95);
    c.lineWidth = 2;
    c.stroke();
    c.restore();

    fb.blit(ctx, this.w, this.h);
  }
}

export class OceanMist extends RisingMist {
  static id = 'oceanmist';
  static title = 'Ocean Mist';
  constructor() {
    super({ hue: 200, hueRange: 18, light: 55, coreLight: 78, coreShift: -10, baseline: 0.72,
      rise: 0.0045, spread: 1.003, fade: 0.025, shimmer: 0.0008, shimmerRate: 0.7 });
  }
}

// "Fire Storm": unlike Ocean Mist's single drifting line, this is a wall of
// flames. Each slice of the spectrum feeds a flame tongue along the bottom;
// the picture rises fast with a sideways flicker and burns from white-yellow
// through orange and red to black. Beats throw up embers.
export class FireStorm extends Visualization {
  static id = 'firestorm';
  static title = 'Fire Storm';
  static group = 'Bars and Waves';

  constructor() {
    super();
    this.fb = new FeedbackBuffer(560);
    this.embers = [];
    this.flick = new Float32Array(48);
  }

  activate() { this.fb.clear(); this.embers.length = 0; }

  draw(ctx, f, dt, t) {
    const fb = this.fb;
    fb.begin(this.w, this.h, dt);
    const { w, h } = fb;
    const c = fb.ctx;

    // heat rises quickly, licks sideways, and cools (fades) as it goes
    fb.transform({ zoom: 1.006, dy: -h * (0.012 + f.softLevel * 0.01), dx: Math.sin(t * 7.3) * w * 0.0015, cy: 1 });
    fb.blur(0.4, 0.55);
    fb.fade(0.1);

    const N = this.flick.length;
    const slot = w / N;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < N; i++) {
      // low notes in the middle, highs at the edges, like a campfire
      const u = Math.abs(i / (N - 1) - 0.5) * 2;
      const e = f.soft[Math.min(63, Math.floor(u * 50))];
      this.flick[i] += ((Math.random() - 0.5) * 0.6 - this.flick[i]) * (1 - Math.exp(-dt * 12));
      const fh = h * (0.05 + e * 0.32) * (1 + this.flick[i] * 0.4);
      const x = (i + 0.5) * slot;
      const g = c.createRadialGradient(x, h, 0, x, h, fh);
      g.addColorStop(0, `hsla(45,100%,${55 + e * 20}%,${0.08 + e * 0.16})`);
      g.addColorStop(0.4, `hsla(25,100%,48%,${0.06 + e * 0.1})`);
      g.addColorStop(0.75, 'hsla(5,100%,35%,0.04)');
      g.addColorStop(1, 'hsla(0,100%,20%,0)');
      c.fillStyle = g;
      c.fillRect(x - fh, h - fh, fh * 2, fh);
    }

    if (f.beat) {
      const n = 10 + Math.floor(f.beatStrength * 25);
      for (let k = 0; k < n; k++) {
        this.embers.push({ x: w * (0.2 + Math.random() * 0.6), y: h, vx: (Math.random() - 0.5) * w * 0.15,
          vy: -h * (0.4 + Math.random() * 0.6), life: 0.8 + Math.random() * 0.8 });
      }
    }
    for (let k = this.embers.length - 1; k >= 0; k--) {
      const p = this.embers[k];
      p.x += p.vx * dt + Math.sin(t * 9 + k) * 0.6;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0 || p.y < 0) { this.embers.splice(k, 1); continue; }
      c.fillStyle = `hsla(${30 + p.life * 20},100%,${55 + p.life * 20}%,${Math.min(1, p.life)})`;
      c.fillRect(p.x, p.y, 2.5, 2.5);
    }
    c.restore();

    fb.blit(ctx, this.w, this.h);
  }
}
