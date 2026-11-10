import { Visualization, approach, clamp } from './base.js';

// Memes: an original pixel-art cat with a pastry body, flying through a starry
// sky and leaving a stepped rainbow trail that waves on the beat clock.
const RAINBOW = ['#ff1a1a', '#ff9a00', '#ffee00', '#33ee22', '#0099ff', '#7a3cff'];
// Pastry body 22x18: o = outline, c = crust, f = frosting, s = sprinkle
const BODY = [
  '..oooooooooooooooooo..',
  '.occcccccccccccccccco.',
  'occffffffffffffffffcco',
  'ocffffsfffffffsfffffco',
  'ocfffffffffsffffffffco',
  'ocffsffffffffffffsffco',
  'ocffffffffffffffffffco',
  'ocffffffsfffffsfffffco',
  'ocffffffffffffffffffco',
  'ocfsffffffffffffffffco',
  'ocffffffffsfffffffsfco',
  'ocffffffffffffffffffco',
  'ocffffsffffffffsffffco',
  'ocffffffffffffffffffco',
  'occffffffffffffffffcco',
  '.occcccccccccccccccco.',
  '..oooooooooooooooooo..',
];
// Head 16x13: o outline, g grey, w white eye-shine, k black, p pink cheek
const HEAD = [
  '.oo........oo...',
  'oggo......oggo..',
  'oggg.oooooggggo.',
  'ogggggggggggggo.',
  'oggggggggggggggo',
  'oggwkggggwkggggo',
  'oggkkggggkkggggo',
  'oppgggkgkgggppgo',
  'oggggkgkgkggggo.',
  '.oggggggggggggo.',
  '..oooooooooooo..',
];
const COL = { o: '#000', c: '#f9c88a', f: '#ff99ee', s: '#e8248a', g: '#9a9a9a', w: '#fff', k: '#000', p: '#ff9aa8' };

export class RainbowCat extends Visualization {
  static id = 'rainbowcat';
  static title = 'Rainbow Cat';
  static group = 'Memes';
  static retro = true;    // object-style graphics get the soft 2000s look

  constructor() {
    super();
    this.stars = [];
    this.sparks = [];
    this.speed = 0;
    this.bob = 0;
  }

  activate() {
    this.stars = [];
    for (let i = 0; i < 40; i++) this.stars.push({ x: Math.random(), y: Math.random(), ph: Math.random() * 4, s: 0.5 + Math.random() });
    this.sparks = [];
    this.speed = 0.2;
  }

  _sprite(ctx, rows, x, y, P) {
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        const col = COL[ch] || (ch !== '.' ? COL.g : null);
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x + c * P, y + r * P, P + 0.5, P + 0.5);
      }
    }
  }

  _star(ctx, x, y, P, stage) {
    ctx.fillStyle = '#fff';
    const r = Math.round(x / P) * P, q = Math.round(y / P) * P;
    if (stage === 0) { ctx.fillRect(r, q, P, P); return; }
    for (let i = 1; i <= stage; i++) {
      ctx.fillRect(r + i * P, q, P, P); ctx.fillRect(r - i * P, q, P, P);
      ctx.fillRect(r, q + i * P, P, P); ctx.fillRect(r, q - i * P, P, P);
    }
    if (stage < 3) ctx.fillRect(r, q, P, P);
  }

  draw(ctx, f, dt) {
    const { w, h } = this;
    if (!this.stars.length) this.activate();
    ctx.fillStyle = '#0f3d72';
    ctx.fillRect(0, 0, w, h);
    const P = Math.max(2, Math.round(Math.min(w, h) * 0.5 / 34));

    // stars scroll leftwards, faster when loud
    this.speed = approach(this.speed, 0.15 + f.softLevel * 1.4, 3, dt);
    for (const s of this.stars) {
      s.x -= this.speed * s.s * dt;
      s.ph += dt * 3;
      if (s.x < -0.05) { s.x = 1.05; s.y = Math.random(); }
      this._star(ctx, s.x * w, s.y * h, P, Math.floor(s.ph) % 4);
    }

    // cat position: centre, bobbing one pixel-step per beat half
    const half = f.phase < 0.5;
    const bobPx = (half ? 0 : -1) * P * (1 + Math.round(f.softBass * 2));
    const bodyW = 22 * P, bodyH = 17 * P;
    const cx = Math.round((w * 0.55 - bodyW / 2) / P) * P;
    const cy = Math.round((h / 2 - bodyH / 2) / P) * P + bobPx;

    // rainbow: columns of 8P width stepping up/down alternately, flipped on the beat
    const stripeH = Math.round(bodyH / 6 / P) * P || P;
    const seg = 8 * P;
    const top0 = cy + 2 * P;
    for (let i = 0, x = cx + 2 * P; x > -seg; i++, x -= seg) {
      const up = ((i + f.beatCount + (half ? 0 : 1)) % 2) === 0;
      const off = (up ? -1 : 1) * P * (1 + Math.round(f.softLevel));
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = RAINBOW[k];
        ctx.fillRect(x - seg, top0 + off + k * stripeH, seg + 0.5, stripeH);
      }
    }

    // legs & tail (paddle on the half-beat)
    const step = half ? 0 : P;
    ctx.fillStyle = '#000';
    const legs = [[1, 0], [4, 0], [15, 0], [18, 0]];
    for (const [lx] of legs) {
      ctx.fillRect(cx + (lx - 1) * P + step, cy + bodyH - P, 4 * P, 3 * P);
      ctx.fillStyle = '#9a9a9a';
      ctx.fillRect(cx + lx * P + step, cy + bodyH - P, 2 * P, 2 * P);
      ctx.fillStyle = '#000';
    }
    ctx.fillRect(cx - 5 * P, cy + 9 * P - step, 6 * P, 4 * P);
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(cx - 4 * P, cy + 10 * P - step, 5 * P, 2 * P);

    this._sprite(ctx, BODY, cx, cy, P);
    this._sprite(ctx, HEAD, cx + 13 * P + step, cy + 7 * P - (half ? 0 : P), P);

    // beat sparkles
    if (f.beat) {
      const n = 3 + Math.round(f.beatStrength * 6);
      for (let i = 0; i < n; i++) this.sparks.push({ x: cx + Math.random() * bodyW * 1.6 - bodyW * 0.2, y: cy + (Math.random() - 0.5) * bodyH * 2.5, life: 0.6 });
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt; s.x -= this.speed * w * 0.5 * dt;
      if (s.life <= 0) { this.sparks.splice(i, 1); continue; }
      this._star(ctx, s.x, s.y, P, clamp(Math.floor((0.6 - s.life) / 0.15), 0, 3));
    }
  }
}
