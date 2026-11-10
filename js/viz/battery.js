import { Visualization, FeedbackBuffer, WaveSampler, hsla, approach, TAU } from './base.js';

// WMP "Battery": a kaleidoscope. The waveform is drawn as a mirrored star and
// the whole picture keeps growing and turning outward from the centre, so
// every frame leaves a trail of nested copies, like a tunnel.
export class Battery extends Visualization {
  static id = 'battery';
  static title = 'Kaleidovision';
  static group = 'Battery';

  constructor() {
    super();
    this.fb = new FeedbackBuffer(800);
    this.hue = 200;
    this.spin = 0;
    this.spinVel = 0.25;
    this.spinTarget = 0.25;
    this.symmetry = 6;
    this.beats = 0;
    this.wave = new WaveSampler(96);
  }

  activate() { this.fb.clear(); }

  draw(ctx, f, dt) {
    const fb = this.fb;
    fb.begin(this.w, this.h, dt);
    const { w, h } = fb;
    const c = fb.ctx;
    const m = Math.min(w, h);

    if (f.beat) {
      this.beats++;
      this.hue += 25 + f.beatStrength * 35;
      // reverse direction occasionally; eased below so it never snaps
      if (this.beats % 8 === 0) this.spinTarget = -this.spinTarget;
      if (this.beats % 32 === 0) this.symmetry = [4, 5, 6, 8][(this.beats / 32) % 4];
    }
    this.spinVel = approach(this.spinVel, this.spinTarget * (1 + f.softBass), 2, dt);
    this.spin += dt * this.spinVel;

    fb.transform({ zoom: 1.03 + f.softBass * 0.02, rotate: this.spinVel * 0.02 });
    fb.fade(0.05);

    const N = this.wave.n;
    const pts = this.wave.sample(f.time, dt, 0.5);

    const sym = this.symmetry;
    const inner = m * 0.04;
    const len = m * (0.18 + f.softLevel * 0.12);
    c.save();
    c.translate(w / 2, h / 2);
    c.rotate(this.spin);
    c.globalCompositeOperation = 'lighter';
    c.lineJoin = 'round';
    for (let s = 0; s < sym; s++) {
      for (const mirror of [1, -1]) {
        c.save();
        c.rotate((s * TAU) / sym);
        c.scale(1, mirror);
        c.beginPath();
        for (let i = 0; i < N; i++) {
          const u = i / (N - 1);
          const x = inner + u * len;
          const y = pts[i] * m * (0.03 + f.softLevel * 0.06) * Math.sin(Math.PI * u);
          if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.strokeStyle = hsla(this.hue + s * (360 / sym) * 0.25, 100, 60, 0.7);
        c.lineWidth = 2;
        c.stroke();
        c.restore();
      }
    }
    const glow = c.createRadialGradient(0, 0, 0, 0, 0, inner * 3);
    glow.addColorStop(0, hsla(this.hue + 180, 100, 80, 0.15 + f.softBass * 0.35));
    glow.addColorStop(1, hsla(this.hue + 180, 100, 60, 0));
    c.fillStyle = glow;
    c.fillRect(-inner * 3, -inner * 3, inner * 6, inner * 6);
    c.restore();

    fb.blit(ctx, this.w, this.h);
  }
}
