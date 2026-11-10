import { Visualization, FeedbackBuffer, hsla, bandMax, TAU } from './base.js';

// Whole-screen washes of colour: six wedges, each lit by one slice of the spectrum.
export class MusicalColors extends Visualization {
  static id = 'colors';
  static title = 'Color Wheel';
  static group = 'Musical Colors';

  constructor() {
    super();
    this.fb = new FeedbackBuffer(640);
    this.rot = 0;
    this.hue = 0;
    this.smooth = new Float32Array(6);
    this.flash = 0;
  }

  activate() { this.fb.clear(); this.smooth.fill(0); }

  draw(ctx, f, dt) {
    const fb = this.fb;
    fb.begin(this.w, this.h, dt);
    const { w, h } = fb;
    const c = fb.ctx;
    const m = Math.hypot(w, h) / 2;

    this.rot += dt * (0.08 + f.softLevel * 0.3);
    this.hue += dt * 8 + f.beatStrength * 15;
    // beats light a pulse that fades over ~0.3 s instead of a one-frame flash
    this.flash = Math.max(f.beatStrength, this.flash * Math.exp(-dt * 6));
    fb.transform({ zoom: 1.01, rotate: 0.002 });
    fb.blur(0.35, 0.8);
    fb.fade(0.07);

    c.save();
    c.translate(w / 2, h / 2);
    c.rotate(this.rot);
    c.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 6; k++) {
      const e = bandMax(f.soft, k / 6, (k + 1) / 6);
      this.smooth[k] += (e - this.smooth[k]) * (1 - Math.exp(-dt * 8));
      const sm = this.smooth[k];
      const a0 = (k * TAU) / 6, a1 = a0 + TAU / 6;
      const hue = this.hue + k * 60;
      const g = c.createRadialGradient(0, 0, 0, 0, 0, m);
      g.addColorStop(0, hsla(hue, 90, 60, 0.12 * sm));
      g.addColorStop(0.7, hsla(hue + 20, 90, 45, 0.06 * sm));
      g.addColorStop(1, hsla(hue + 40, 90, 30, 0));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, m, a0, a1);
      c.closePath();
      c.fill();
    }

    const pulse = c.createRadialGradient(0, 0, 0, 0, 0, m * 0.35);
    pulse.addColorStop(0, hsla(this.hue + 180, 80, 85, 0.04 + this.flash * 0.25));
    pulse.addColorStop(1, hsla(this.hue + 180, 80, 70, 0));
    c.fillStyle = pulse;
    c.beginPath();
    c.arc(0, 0, m * 0.35, 0, TAU);
    c.fill();
    c.restore();

    fb.blit(ctx, this.w, this.h);
  }
}
