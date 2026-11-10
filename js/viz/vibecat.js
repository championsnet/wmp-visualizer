import { Visualization, approach, TAU } from './base.js';

// Memes: an original cartoon cat in headphones, eyes half-closed in bliss,
// nodding hard on every beat (peak nod exactly at phase 0), nod depth growing
// with loudness. A speaker in the cosy room pumps with the bass.
const INK = '#2a1e1a';

export class VibingCat extends Visualization {
  static id = 'vibecat';
  static title = 'Vibing Cat';
  static group = 'Memes';
  static retro = true;    // object-style graphics get the soft 2000s look

  constructor() { super(); this.depth = 0.4; this.kick = 0; }
  activate() { this.depth = 0.4; this.kick = 0; }

  draw(ctx, f, dt) {
    const { w, h } = this;
    const m = Math.min(w, h);
    this.depth = approach(this.depth, 0.3 + f.softLevel * 1.2, 2, dt);
    this.kick = Math.max(f.beat ? f.beatStrength : 0, this.kick * Math.exp(-dt * 8));

    // room: wall, window with night city, floor
    ctx.fillStyle = '#2c3a5e'; ctx.fillRect(0, 0, w, h);
    const floorY = h * 0.5 + m * 0.33;
    ctx.fillStyle = '#4a2f2a'; ctx.fillRect(0, floorY, w, h - floorY);
    const wx = w * 0.5 - m * 0.75, wy = h * 0.5 - m * 0.4, ww = m * 0.42, wh = m * 0.42;
    ctx.fillStyle = '#121a33'; ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = '#ffe9a0';
    for (let i = 0; i < 14; i++) ctx.fillRect(wx + ((i * 37) % 90) / 100 * ww, wy + wh * 0.5 + ((i * 53) % 45) / 100 * wh, 4, 6);
    ctx.fillStyle = '#f5f1d0'; ctx.beginPath(); ctx.arc(wx + ww * 0.75, wy + wh * 0.25, ww * 0.1, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8b6b4a'; ctx.lineWidth = 6; ctx.strokeRect(wx, wy, ww, wh);
    ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke();
    // speaker
    const sx = w * 0.5 + m * 0.45, sw = m * 0.2, sh = m * 0.34, sy = floorY - sh;
    ctx.fillStyle = '#1b1b1f'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.fillRect(sx, sy, sw, sh); ctx.strokeRect(sx, sy, sw, sh);
    const cone = 1 + f.softBass * 0.12 + this.kick * 0.1;
    ctx.fillStyle = '#44444c';
    ctx.beginPath(); ctx.arc(sx + sw / 2, sy + sh * 0.65, sw * 0.32 * cone, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + sw / 2, sy + sh * 0.22, sw * 0.15, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(sx + sw / 2, sy + sh * 0.65, sw * 0.1 * cone, 0, TAU); ctx.fill();

    // nod: peak at the beat, smooth between
    const c = (1 + Math.cos(TAU * f.phase)) / 2;
    const nod = Math.pow(c, 2) * this.depth;
    const S = m * 0.55;
    const cx = w / 2, baseY = floorY;

    ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2.5, S * 0.012);
    const fur = '#f2a65a', furD = '#d9823a', cream = '#fff1dc';
    // tail swishing on half-beats
    ctx.lineCap = 'round';
    const tsw = Math.sin(TAU * f.phase) * 0.3;
    for (const [col, lw] of [[INK, S * 0.075], [fur, S * 0.055]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(cx + S * 0.25, baseY - S * 0.05);
      ctx.quadraticCurveTo(cx + S * (0.5 + tsw * 0.2), baseY - S * 0.1, cx + S * (0.45 + tsw * 0.3), baseY - S * 0.4);
      ctx.stroke();
    }
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2.5, S * 0.012);
    // body (sitting)
    ctx.fillStyle = fur;
    ctx.beginPath(); ctx.ellipse(cx, baseY - S * 0.22, S * 0.3, S * 0.25, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = cream;
    ctx.beginPath(); ctx.ellipse(cx, baseY - S * 0.2, S * 0.16, S * 0.18, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = fur;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * S * 0.12, baseY - S * 0.03, S * 0.08, S * 0.045, 0, 0, TAU); ctx.fill(); ctx.stroke(); }

    // head
    ctx.save();
    ctx.translate(cx, baseY - S * 0.48 + nod * S * 0.12);
    ctx.rotate(nod * 0.12); ctx.scale(1, 1 - nod * 0.06);
    ctx.translate(0, -S * 0.15);
    const R = S * 0.27;
    // ears
    for (const s of [-1, 1]) {
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.moveTo(s * R * 0.3, -R * 0.75); ctx.lineTo(s * R * 0.85, -R * 1.25); ctx.lineTo(s * R * 0.95, -R * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f7b7b0';
      ctx.beginPath(); ctx.moveTo(s * R * 0.45, -R * 0.72); ctx.lineTo(s * R * 0.8, -R * 1.05); ctx.lineTo(s * R * 0.85, -R * 0.5); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = fur;
    ctx.beginPath(); ctx.ellipse(0, 0, R * 1.08, R * 0.9, 0, 0, TAU); ctx.fill(); ctx.stroke();
    // stripes
    ctx.fillStyle = furD;
    for (const dx of [-0.2, 0, 0.2]) { ctx.beginPath(); ctx.ellipse(dx * R, -R * 0.72, R * 0.05, R * 0.15, 0, 0, TAU); ctx.fill(); }
    // muzzle
    ctx.fillStyle = cream;
    ctx.beginPath(); ctx.ellipse(-R * 0.17, R * 0.38, R * 0.24, R * 0.2, 0, 0, TAU); ctx.ellipse(R * 0.17, R * 0.38, R * 0.24, R * 0.2, 0, 0, TAU); ctx.fill();
    // blissful half-closed eyes: lid line + lower arc
    for (const s of [-1, 1]) {
      const ex = s * R * 0.42, ey = R * 0.02;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(ex, ey, R * 0.17, R * 0.09, 0, 0, Math.PI); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3b8a3b';
      ctx.beginPath(); ctx.ellipse(ex, ey, R * 0.09, R * 0.08, 0, 0, Math.PI); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = Math.max(3, S * 0.014);
      ctx.beginPath(); ctx.moveTo(ex - R * 0.2, ey - R * 0.01); ctx.lineTo(ex + R * 0.2, ey - R * 0.01); ctx.stroke();
      ctx.lineWidth = Math.max(2, S * 0.008);
      ctx.beginPath(); ctx.ellipse(ex, ey, R * 0.17, R * 0.09, 0, 0, Math.PI); ctx.stroke();
    }
    // nose + smile + whiskers
    ctx.fillStyle = '#e57a8a';
    ctx.beginPath(); ctx.moveTo(-R * 0.08, R * 0.24); ctx.lineTo(R * 0.08, R * 0.24); ctx.lineTo(0, R * 0.33); ctx.closePath(); ctx.fill();
    ctx.lineWidth = Math.max(2, S * 0.009); ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.arc(-R * 0.1, R * 0.36, R * 0.1, 0.1, Math.PI - 0.3); ctx.moveTo(R * 0.2, R * 0.36); ctx.arc(R * 0.1, R * 0.36, R * 0.1, 0.3, Math.PI - 0.1); ctx.stroke();
    for (const s of [-1, 1]) for (const k of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * R * 0.4, R * 0.38 + k * R * 0.05); ctx.lineTo(s * R * 0.95, R * 0.32 + k * R * 0.14); ctx.stroke();
    }
    // headphones
    ctx.strokeStyle = '#222'; ctx.lineWidth = R * 0.12;
    ctx.beginPath(); ctx.arc(0, -R * 0.05, R * 1.02, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    ctx.fillStyle = '#e8384f'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2.5, S * 0.012);
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * R * 1.02, -R * 0.05, R * 0.17, R * 0.3, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.restore();

    // floating notes on beats-ish
    ctx.fillStyle = `rgba(255,255,255,${0.3 + this.kick * 0.6})`;
    ctx.font = `${m * 0.07}px serif`;
    ctx.textAlign = 'center';
    const np = f.phase;
    ctx.fillText('♪', cx - S * 0.55, baseY - S * (0.8 + np * 0.15));
    ctx.fillText('♫', cx + S * 0.6, baseY - S * (0.9 + ((np + 0.5) % 1) * 0.15));
  }
}
