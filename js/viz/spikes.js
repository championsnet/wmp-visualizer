import { Visualization, FeedbackBuffer, hsla, bandAt, TAU } from './base.js';

// WMP "Spikes": a ring of spectrum spikes shooting out from the centre, drawn
// into a zooming, slowly spinning feedback buffer so each pulse leaves a
// colourful afterglow. Beats punch the spikes out and flash the core.
export class Spikes extends Visualization {
  static id = 'spikes';
  static title = 'Spike';
  static group = 'Spikes';

  constructor() {
    super();
    this.fb = new FeedbackBuffer(800);
    this.activate();
  }

  activate() {
    this.fb.clear();
    this.rot = 0;
    this.hue = 0;
    this.flash = 0;
    this.spin = 1;
  }

  draw(ctx, f, dt) {
    const fb = this.fb;
    fb.begin(this.w, this.h, dt);
    const { w, h } = fb;
    const c = fb.ctx;
    const m = Math.min(w, h);

    this.flash = Math.max(f.beatStrength || 0, this.flash * Math.exp(-dt * 6));
    if (f.tick && f.beatCount % 8 === 0) this.spin = -this.spin;
    fb.transform({ zoom: 1.012 + f.softBass * 0.02 + this.flash * 0.01, rotate: 0.004 * this.spin });
    fb.fade(0.12);

    this.rot += dt * (0.25 + f.softMid * 0.6) * this.spin;
    this.hue += dt * (20 + f.softTreble * 60);
    const pulse = Math.exp(-f.phase * 4); // rhythmic swell on each beat

    const N = 48;
    const r0 = m * (0.05 + f.softBass * 0.04 + pulse * 0.015);
    const maxL = m * 0.42;
    c.save();
    c.translate(w / 2, h / 2);
    c.rotate(this.rot);
    c.globalCompositeOperation = 'lighter';
    // two colour passes, each one batched path
    for (let pass = 0; pass < 2; pass++) {
      c.beginPath();
      for (let i = 0; i < N; i++) {
        if ((i & 1) !== pass) continue;
        const u = i / N;
        const mir = u < 0.5 ? u * 2 : (1 - u) * 2;
        const e = bandAt(f.soft, mir * 0.85);
        const L = r0 + m * 0.02 + e * maxL * (0.8 + this.flash * 0.4);
        const a = u * TAU;
        const hw = (TAU / N) * 0.45;
        c.moveTo(Math.cos(a - hw) * r0, Math.sin(a - hw) * r0);
        c.lineTo(Math.cos(a) * L, Math.sin(a) * L);
        c.lineTo(Math.cos(a + hw) * r0, Math.sin(a + hw) * r0);
        c.closePath();
      }
      c.fillStyle = hsla(this.hue + pass * 150, 100, 50 + this.flash * 10, 0.32);
      c.fill();
      c.strokeStyle = hsla(this.hue + pass * 150 + 30, 100, 65, 0.55);
      c.lineWidth = 1;
      c.stroke();
    }
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r0 * 1.6);
    g.addColorStop(0, hsla(this.hue + 60, 100, 70, 0.25 + this.flash * 0.35));
    g.addColorStop(1, hsla(this.hue + 60, 100, 50, 0));
    c.fillStyle = g;
    c.fillRect(-r0 * 1.6, -r0 * 1.6, r0 * 3.2, r0 * 3.2);
    c.restore();

    fb.blit(ctx, this.w, this.h);
  }
}
