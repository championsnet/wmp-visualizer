import { Visualization, hsla, approach, TAU } from './base.js';

// Memes: an original round cartoon parrot doing the "party" head-roll, one
// full roll per beat (locked to the beat clock), colour cycling with it.
// More parrots join as the music gets louder, all rolling in sync.
const GRIDS = [[1, 1], [2, 1], [3, 1], [2, 2], [3, 2], [4, 2], [4, 3]];

export class PartyParrot extends Visualization {
  static id = 'parrot';
  static title = 'Party Parrot';
  static group = 'Memes';
  static retro = true;    // object-style graphics get the soft 2000s look

  constructor() {
    super();
    this.count = 1;
    this.flash = 0;
    this.loud = 0;
  }

  activate() { this.count = 1; this.flash = 0; this.loud = 0; }

  // Parrot centred at 0,0 with body radius ~1 (drawn in a scaled context).
  _parrot(ctx, a, hue, lw) {
    const dx = Math.cos(a) * 0.55, dy = (Math.sin(a) + 1) * 0.22;
    const tilt = Math.cos(a) * 0.35;
    const col = hsla(hue, 95, 58), dark = hsla(hue, 90, 38), light = hsla(hue + 20, 100, 75);
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a1020';
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(0, 1.08, 0.8, 0.12, 0, 0, TAU); ctx.fill();
    // feet
    ctx.fillStyle = '#f2a33a';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 0.28, 1.0, 0.16, 0.08, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
    // body: one blob, leaning towards the head
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-0.75, 0.95);
    ctx.bezierCurveTo(-0.95, 0.3, -0.7 + dx, -0.6 + dy, dx * 1.2, -0.95 + dy);
    ctx.bezierCurveTo(0.75 + dx, -1.05 + dy, 1.05 + dx * 0.6, 0.0, 0.8, 0.95);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // belly
    ctx.fillStyle = light;
    ctx.beginPath(); ctx.ellipse(dx * 0.4, 0.45, 0.42, 0.42, 0, 0, TAU); ctx.fill();
    // wing
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(-0.55 + dx * 0.3, 0.3, 0.22, 0.45, 0.35 + tilt, 0, TAU); ctx.fill(); ctx.stroke();
    // head features
    const hx = dx * 1.3 + 0.12, hy = -0.45 + dy * 1.2;
    ctx.save();
    ctx.translate(hx, hy); ctx.rotate(tilt);
    // crest feathers
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(-0.15, -0.45); ctx.quadraticCurveTo(-0.35, -0.85, -0.05, -0.75); ctx.quadraticCurveTo(0.0, -0.95, 0.15, -0.5); ctx.fill(); ctx.stroke();
    // eye
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0.0, -0.1, 0.17, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(0.04, -0.1, 0.09, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0.07, -0.14, 0.035, 0, TAU); ctx.fill();
    // cheek
    ctx.fillStyle = 'rgba(255,120,150,0.6)';
    ctx.beginPath(); ctx.ellipse(-0.25, 0.12, 0.12, 0.07, 0, 0, TAU); ctx.fill();
    // beak
    ctx.fillStyle = '#4a4a55';
    ctx.beginPath();
    ctx.moveTo(0.22, -0.12);
    ctx.quadraticCurveTo(0.6, -0.12, 0.55, 0.22);
    ctx.quadraticCurveTo(0.42, 0.12, 0.22, 0.14);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  draw(ctx, f, dt) {
    const { w, h } = this;
    this.loud = approach(this.loud, f.softLevel, 1.5, dt);
    const target = 1 + Math.min(6, Math.floor(this.loud * 9));
    this.count = approach(this.count, target, target > this.count ? 2 : 0.4, dt);
    const gi = Math.min(GRIDS.length - 1, Math.round(this.count) - 1);
    const [cols, rows] = GRIDS[gi];
    if (f.beat) this.flash = Math.max(this.flash, 0.3 + 0.7 * f.beatStrength);
    this.flash *= Math.exp(-dt * 6);

    ctx.fillStyle = hsla(270, 30, 12 + this.flash * 12);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.08})`;
    ctx.fillRect(0, 0, w, h);

    const a = f.phase * TAU - Math.PI / 2;  // head at top on the beat
    const hue = (f.beatCount * 47 + f.phase * 360) % 360;
    const cw = w / cols, ch = h / rows;
    const r = Math.min(cw, ch) * (cols * rows === 1 ? 0.27 : 0.33);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        ctx.save();
        ctx.translate(cw * (i + 0.5), ch * (j + 0.5) + r * 0.05);
        ctx.scale(r, r);
        this._parrot(ctx, a, hue + (i + j) * 30, Math.max(1.5, r * 0.035) / r);
        ctx.restore();
      }
    }
  }
}
