import { Visualization, approach, TAU } from './base.js';

// Memes: an original cartoon baby doing a cha-cha. The lean swings from one
// side to the other over each beat (beat parity picks the side) so the
// stepping foot plants exactly on the beat; the spotlight pulses with bass.
const SKIN = '#ffd2b0', SKIN_D = '#f0a988', INK = '#3a2418';

function limb(ctx, pts, w) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [col, lw] of [[INK, w + 5], [SKIN, w]]) {
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.stroke();
  }
}

export class DancingBaby extends Visualization {
  static id = 'baby';
  static title = 'Dancing Baby';
  static group = 'Memes';
  static retro = true;    // object-style graphics get the soft 2000s look

  constructor() { super(); this.spot = 0; this.amp = 0.5; }
  activate() { this.spot = 0; this.amp = 0.5; }

  draw(ctx, f, dt) {
    const { w, h } = this;
    const m = Math.min(w, h);
    this.spot = Math.max(f.softBass, this.spot * Math.exp(-dt * 4));
    if (f.beat) this.spot = Math.max(this.spot, f.beatStrength);
    this.amp = approach(this.amp, 0.6 + f.softLevel * 0.8, 2, dt);

    // stage
    ctx.fillStyle = '#140c22'; ctx.fillRect(0, 0, w, h);
    const floorY = h * 0.5 + m * 0.3;
    ctx.fillStyle = '#3a2340'; ctx.fillRect(0, floorY, w, h - floorY);
    ctx.fillStyle = '#5a3550'; ctx.fillRect(0, floorY, w, 4);
    // spotlight cone + pool
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const a = 0.12 + this.spot * 0.25;
    const g = ctx.createLinearGradient(0, 0, 0, floorY);
    g.addColorStop(0, `rgba(255,240,200,${a * 0.3})`); g.addColorStop(1, `rgba(255,240,200,${a})`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(w / 2 - m * 0.06, 0); ctx.lineTo(w / 2 + m * 0.06, 0);
    ctx.lineTo(w / 2 + m * 0.4, floorY); ctx.lineTo(w / 2 - m * 0.4, floorY); ctx.fill();
    ctx.fillStyle = `rgba(255,240,200,${a * 1.2})`;
    ctx.beginPath(); ctx.ellipse(w / 2, floorY + m * 0.02, m * 0.4, m * 0.06, 0, 0, TAU); ctx.fill();
    ctx.restore();

    // pose from the beat clock
    const side = f.beatCount % 2 ? 1 : -1;
    const p = f.phase;
    const lean = side * Math.cos(Math.PI * p) * this.amp;      // -1..1 continuous across beats
    const lift = Math.sin(Math.PI * p) * this.amp;              // moving foot up mid-beat
    const S = m * 0.62;
    const cx = w / 2, fy = floorY + m * 0.01;
    const hipX = cx + lean * S * 0.08, hipY = fy - S * 0.3 + Math.abs(lean) * S * 0.015;
    const bodyTilt = -lean * 0.12;

    // legs (the foot on the side we're moving away from steps across)
    const legW = S * 0.075;
    for (const s of [-1, 1]) {
      const moving = s === -side;
      const footX = cx + s * S * 0.11 + (moving ? -lean * S * 0.06 : 0);
      const footY = fy - (moving ? lift * S * 0.06 : 0);
      const kneeX = (hipX + s * S * 0.06 + footX) / 2 + s * S * 0.03, kneeY = (hipY + footY) / 2;
      limb(ctx, [hipX + s * S * 0.06, hipY, kneeX, kneeY, footX, footY - S * 0.02], legW);
      ctx.fillStyle = SKIN; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(footX + s * S * 0.02, footY - S * 0.01, S * 0.055, S * 0.028, 0, 0, TAU); ctx.fill(); ctx.stroke();
    }

    ctx.save();
    ctx.translate(hipX, hipY); ctx.rotate(bodyTilt);
    // arms: swing opposite to hips
    const armW = S * 0.06;
    for (const s of [-1, 1]) {
      const sw = -lean * s;
      const shX = s * S * 0.1, shY = -S * 0.2;
      const elX = s * S * (0.2 + 0.03 * sw), elY = -S * (0.16 + 0.05 * sw);
      const haX = s * S * (0.22 - 0.04 * sw), haY = -S * (0.3 + 0.1 * sw);
      limb(ctx, [shX, shY, elX, elY, haX, haY], armW);
      ctx.fillStyle = SKIN; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(haX, haY, armW * 0.75, 0, TAU); ctx.fill(); ctx.stroke();
    }
    // torso (chubby belly)
    ctx.fillStyle = SKIN; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, -S * 0.13, S * 0.13, S * 0.15, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = SKIN_D; ctx.beginPath(); ctx.arc(0, -S * 0.12, S * 0.008, 0, TAU); ctx.fill();
    // diaper
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-S * 0.135, -S * 0.06);
    ctx.quadraticCurveTo(0, -S * 0.03, S * 0.135, -S * 0.06);
    ctx.quadraticCurveTo(S * 0.13, S * 0.04, S * 0.05, S * 0.04);
    ctx.quadraticCurveTo(0, S * 0.07, -S * 0.05, S * 0.04);
    ctx.quadraticCurveTo(-S * 0.13, S * 0.04, -S * 0.135, -S * 0.06);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9fd3ff';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * S * 0.1, -S * 0.04, S * 0.012, 0, TAU); ctx.fill(); }

    // head bobs with a small counter-tilt
    ctx.translate(0, -S * 0.42);
    ctx.rotate(lean * 0.15);
    const R = S * 0.17;
    for (const s of [-1, 1]) { // ears
      ctx.fillStyle = SKIN; ctx.beginPath(); ctx.ellipse(s * R * 0.98, R * 0.1, R * 0.17, R * 0.22, 0, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.95, 0, 0, TAU); ctx.fill(); ctx.stroke();
    // hair curl
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(R * 0.05, -R * 0.85, R * 0.14, Math.PI * 0.9, Math.PI * 2.4); ctx.stroke();
    // eyes
    ctx.fillStyle = INK;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(s * R * 0.36, -R * 0.05, R * 0.1, R * 0.14, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * R * 0.36 + R * 0.03, -R * 0.1, R * 0.04, 0, TAU); ctx.fill(); ctx.fillStyle = INK;
    }
    // cheeks + happy open mouth
    ctx.fillStyle = 'rgba(255,110,120,0.45)';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * R * 0.6, R * 0.25, R * 0.15, R * 0.09, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#b5304a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    const mo = 0.12 + 0.1 * Math.sin(Math.PI * p);
    ctx.beginPath(); ctx.ellipse(0, R * 0.38, R * 0.18, R * mo, 0, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
