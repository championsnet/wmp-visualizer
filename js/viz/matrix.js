import { Visualization, bandAt, clamp } from './base.js';

// Screensaver: Matrix-style digital rain. Each column falls at a speed tied to
// the spectrum band under it; beats make columns flare and spawn new drops,
// and the beat clock gently pulses the overall brightness.
const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFZ:.=*+-<>';
const CELL = 18;

export class DigitalRain extends Visualization {
  static id = 'matrix';
  static title = 'Digital Rain';
  static group = 'Screensavers';

  constructor() { super(); this.cols = []; this.rows = 0; this.flash = 0; }

  resize(w, h, dpr) { super.resize(w, h, dpr); this.build(); }
  activate() { this.build(); }

  build() {
    const nc = Math.max(1, Math.ceil(this.w / CELL)), nr = Math.max(1, Math.ceil(this.h / CELL) + 1);
    this.rows = nr;
    this.cols = Array.from({ length: nc }, () => ({
      head: Math.random() * nr * 1.5 - nr * 0.5,
      len: 8 + Math.random() * 22,
      base: 4 + Math.random() * 8,
      glow: 0,
      chars: Array.from({ length: nr }, () => GLYPHS[(Math.random() * GLYPHS.length) | 0]),
    }));
  }

  draw(ctx, f, dt) {
    const { w, h } = this;
    if (!this.cols.length) this.build();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.font = `bold ${CELL - 2}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    if (f.beat) this.flash = Math.max(this.flash, f.beatStrength);
    this.flash *= Math.exp(-4 * dt);
    const pulse = 0.85 + 0.15 * Math.exp(-(f.phase || 0) * 6) + this.flash * 0.2;
    const nc = this.cols.length, nr = this.rows;
    for (let c = 0; c < nc; c++) {
      const col = this.cols[c];
      const band = bandAt(f.soft, c / nc);
      col.head += dt * (col.base + band * 30 + f.softLevel * 6);
      if (f.beat && Math.random() < 0.15 + f.beatStrength * 0.35) {
        col.glow = 1;
        if (col.head - col.len > nr * 0.3 && Math.random() < 0.5) col.head = 0;
      }
      col.glow *= Math.exp(-3 * dt);
      if (col.head - col.len > nr) { col.head = -Math.random() * 10; col.len = 8 + Math.random() * 22; col.base = 4 + Math.random() * 8; }
      // flicker: occasionally swap a glyph (rate per second)
      if (Math.random() < dt * 6) col.chars[(Math.random() * nr) | 0] = GLYPHS[(Math.random() * GLYPHS.length) | 0];
      const hr = Math.floor(col.head);
      const x = c * CELL + CELL / 2;
      const top = Math.max(0, Math.ceil(hr - col.len));
      for (let r = Math.min(hr, nr - 1); r >= top; r--) {
        const age = (hr - r) / col.len;
        let a = clamp((1 - age) * pulse, 0, 1);
        if (r === hr) ctx.fillStyle = `rgba(220,255,225,${clamp(pulse, 0, 1)})`;
        else {
          const l = 35 + 25 * (1 - age) + col.glow * 30;
          ctx.fillStyle = `hsla(${125 - col.glow * 10},100%,${clamp(l, 0, 90).toFixed(0)}%,${a.toFixed(2)})`;
        }
        ctx.fillText(col.chars[r], x, r * CELL);
      }
    }
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }
}
