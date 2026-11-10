import { Visualization, FeedbackBuffer, hsla, TAU } from './base.js';

// iTunes-style light ribbons: translucent strands that twist through space
// (a twisting band whose width follows a fake 3D rotation), additive and
// blurred for glow. Bass swells them, mids speed the twist, treble adds
// shimmer, and beats flash them bright.
const R = 5;
const SEG = 64;

export class LightRibbons extends Visualization {
  static id = 'lightribbons';
  static title = 'Light Ribbons';
  static group = 'Retro Players';

  constructor() {
    super();
    this.fb = new FeedbackBuffer(720);
    this.ax = new Float32Array(SEG + 1);
    this.ay = new Float32Array(SEG + 1);
    this.bx = new Float32Array(SEG + 1);
    this.by = new Float32Array(SEG + 1);
    this.activate();
  }

  activate() {
    this.fb.clear();
    this.clock = 0;
    this.twist = 0;
    this.hue = 200;
    this.flash = 0;
  }

  draw(ctx, f, dt) {
    const fb = this.fb;
    fb.begin(this.w, this.h, dt);
    const { w, h } = fb;
    const c = fb.ctx;
    const m = Math.min(w, h);

    fb.transform({ zoom: 1.004 });
    fb.blur(0.25, 0.35);
    fb.fade(0.3);

    this.flash = Math.max(f.beatStrength || 0, this.flash * Math.exp(-dt * 4));
    this.clock += dt * (0.35 + f.softLevel * 0.6);
    this.twist += dt * (0.8 + f.softMid * 2.5);
    this.hue += dt * (12 + f.softTreble * 40);
    const swell = Math.exp(-f.phase * 3);
    const T = this.clock;

    c.save();
    c.globalCompositeOperation = 'lighter';
    for (let r = 0; r < R; r++) {
      const ph = r * 1.37;
      const amp = h * (0.12 + f.softBass * 0.18 + swell * 0.03) * (1 - r * 0.08);
      const width = m * (0.035 + f.softMid * 0.05 + this.flash * 0.03);
      for (let i = 0; i <= SEG; i++) {
        const u = i / SEG;
        const x = -w * 0.1 + u * w * 1.2;
        const y = h / 2 + Math.sin(u * 5.0 + T * 1.3 + ph) * amp * Math.sin(T * 0.37 + ph + u * 1.7)
          + Math.sin(u * 13 + T * 3.1 + ph * 2) * h * 0.02 * (1 + f.softTreble * 2)
          + Math.cos(T * 0.23 + ph) * h * 0.12;
        // twist: band edge rotates around the centreline
        const tw = Math.cos(u * 7 + this.twist + ph * 1.9);
        const hw = width * (0.15 + 0.85 * Math.abs(tw));
        const ox = Math.sin(u * 7 + this.twist + ph) * hw * 0.4;
        this.ax[i] = x - ox; this.ay[i] = y - hw;
        this.bx[i] = x + ox; this.by[i] = y + hw;
      }
      c.beginPath();
      c.moveTo(this.ax[0], this.ay[0]);
      for (let i = 1; i <= SEG; i++) c.lineTo(this.ax[i], this.ay[i]);
      for (let i = SEG; i >= 0; i--) c.lineTo(this.bx[i], this.by[i]);
      c.closePath();
      const hue = this.hue + r * 55;
      c.fillStyle = hsla(hue, 90, 50, 0.07 + this.flash * 0.08);
      c.fill();
      // bright edges
      c.lineWidth = 1.5;
      c.strokeStyle = hsla(hue + 20, 100, 70 + this.flash * 20, 0.22 + this.flash * 0.25);
      c.beginPath();
      c.moveTo(this.ax[0], this.ay[0]);
      for (let i = 1; i <= SEG; i++) c.lineTo(this.ax[i], this.ay[i]);
      c.moveTo(this.bx[0], this.by[0]);
      for (let i = 1; i <= SEG; i++) c.lineTo(this.bx[i], this.by[i]);
      c.stroke();
    }
    c.restore();

    fb.blit(ctx, this.w, this.h);
  }
}
