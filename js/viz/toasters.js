import { Visualization, clamp, TAU } from './base.js';

// Screensaver: a tribute to After Dark's "Flying Toasters". Chrome toasters
// flap their wings on the beat and glide from the top right to the bottom
// left with slices of toast. Loudness sets the speed; beats launch more.
export class FlyingToasters extends Visualization {
  static id = 'toasters';
  static title = 'Flying Toasters';
  static group = 'Screensavers';
  static retro = true;    // object-style graphics get the soft 2000s look

  constructor() {
    super();
    this.items = [];
    this._gKey = '';
  }

  activate() {
    this.items.length = 0;
    this.speed = 1;
    this.extra = 0;
    this._seeded = false;
  }

  _spawn(onScreen) {
    const { w, h } = this;
    const size = 0.7 + Math.random() * 0.5;
    const toast = Math.random() < 0.3;
    let x, y;
    if (onScreen) { x = Math.random() * w * 1.3; y = Math.random() * h * 1.3 - h * 0.3; }
    else if (Math.random() < 0.5) { x = w + 80 + Math.random() * 120; y = Math.random() * h - 60; }
    else { x = Math.random() * w + w * 0.3; y = -80 - Math.random() * 120; }
    this.items.push({ x, y, size, toast, off: Math.random() * 0.4, done: Math.random() * 0.8 });
    this.items.sort((a, b) => a.size - b.size);
  }

  _grads(ctx) {
    if (this._gKey) return;
    this._gKey = 'ok';
    const body = ctx.createLinearGradient(0, -24, 0, 24);
    body.addColorStop(0, '#f4f6fa'); body.addColorStop(0.25, '#9aa3b0');
    body.addColorStop(0.5, '#e6e9ee'); body.addColorStop(0.75, '#5d6571'); body.addColorStop(1, '#c9ced6');
    this.gBody = body;
    const wing = ctx.createLinearGradient(0, 0, 0, -40);
    wing.addColorStop(0, '#d8dde5'); wing.addColorStop(1, '#ffffff');
    this.gWing = wing;
  }

  _toaster(ctx, flap) {
    // wing behind
    this._wing(ctx, flap, -1);
    ctx.fillStyle = this.gBody;
    ctx.strokeStyle = '#2b3038';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-30, -22, 60, 44, 10);
    ctx.fill(); ctx.stroke();
    // slots
    ctx.fillStyle = '#1b1e24';
    ctx.fillRect(-20, -22, 14, 3); ctx.fillRect(4, -22, 14, 3);
    // highlight and base
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(-24, -15, 3, 26);
    ctx.fillStyle = '#3a3f48';
    ctx.fillRect(-28, 19, 56, 4);
    // lever + dial
    ctx.fillStyle = '#222';
    ctx.fillRect(-36, -4, 7, 4);
    ctx.beginPath(); ctx.arc(14, 8, 4, 0, TAU); ctx.fill();
    this._wing(ctx, flap, 1);
  }

  _wing(ctx, flap, sideSign) {
    ctx.save();
    ctx.translate(sideSign > 0 ? 4 : 10, -14);
    const a = 0.75 - flap * 1.5 + (sideSign > 0 ? 0 : -0.15);
    ctx.rotate(a);
    ctx.fillStyle = sideSign > 0 ? this.gWing : '#9aa2ad';
    ctx.strokeStyle = '#59606b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(10, -24, 34, -38);
    ctx.lineTo(30, -28); ctx.lineTo(38, -26); ctx.lineTo(30, -16);
    ctx.lineTo(36, -12); ctx.lineTo(24, -6);
    ctx.quadraticCurveTo(12, 2, 0, 0);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(6, -4); ctx.lineTo(28, -30);
    ctx.moveTo(8, -2); ctx.lineTo(28, -18);
    ctx.stroke();
    ctx.restore();
  }

  _toast(ctx, done) {
    const path = (k) => {
      ctx.beginPath();
      ctx.moveTo(-16 * k, 16 * k); ctx.lineTo(-16 * k, -6 * k);
      ctx.bezierCurveTo(-22 * k, -22 * k, -4 * k, -24 * k, 0, -16 * k);
      ctx.bezierCurveTo(4 * k, -24 * k, 22 * k, -22 * k, 16 * k, -6 * k);
      ctx.lineTo(16 * k, 16 * k); ctx.closePath();
    };
    ctx.fillStyle = '#7a4a1c'; path(1); ctx.fill();
    ctx.fillStyle = `hsl(34,70%,${68 - done * 22}%)`; path(0.8); ctx.fill();
  }

  draw(ctx, f, dt) {
    const { w, h } = this;
    this._grads(ctx);
    if (!this._seeded && w > 0) {
      this._seeded = true;
      const n = Math.round(clamp(w * h / 70000, 6, 16));
      for (let i = 0; i < n; i++) this._spawn(true);
    }
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    this.speed = 0.6 + f.softLevel * 1.6;
    if (f.beat && f.beatStrength > 0.5 && this.items.length < 40) {
      this._spawn(false);
      if (f.beatStrength > 0.8) this._spawn(false);
    }
    const target = Math.round(clamp(w * h / 70000, 6, 16));
    const scale = clamp(Math.min(w, h) / 600, 0.6, 1.8);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      const v = 70 * scale * it.size * this.speed;
      it.x -= v * dt * 1.15;
      it.y += v * dt * 0.75;
      if (it.x < -120 * scale || it.y > h + 100 * scale) {
        this.items.splice(i, 1);
        if (this.items.length < target) this._spawn(false);
      }
    }
    for (const it of this.items) {
      ctx.save();
      ctx.translate(it.x, it.y);
      const s = scale * it.size;
      ctx.scale(s, s);
      if (it.toast) this._toast(ctx, it.done);
      else {
        const p = (f.phase + it.off) % 1;
        const flap = 0.5 + 0.5 * Math.cos(p * TAU);
        this._toaster(ctx, flap);
      }
      ctx.restore();
    }
  }
}
