import { Visualization, hsla, approach, TAU } from './base.js';

// Memes: an original cartoon shiba face that bounces on the beat clock and
// zooms on detected beats, with Comic-Sans "doge speak" popping up around it.
// The phrase is chosen from what the music is doing (bass, loudness, treble).
const FONT = '"Comic Sans MS", "Comic Neue", "Chalkboard SE", cursive';
const GENERIC = ['wow', 'such music', 'very beat', 'much rhythm', 'so music', 'many vibe', 'amaze', 'such dance', 'very groove', 'wow'];
const INK = '#3a2412';

export class Doge extends Visualization {
  static id = 'doge';
  static title = 'Doge';
  static group = 'Memes';
  static retro = true;    // object-style graphics get the soft 2000s look

  constructor() { super(); this.words = []; this.zoom = 0; this.last = ''; }
  activate() { this.words = []; this.zoom = 0; this.last = ''; }

  _pick(f) {
    let opts = GENERIC;
    if (f.softBass > 0.55 && f.softBass > f.softTreble * 1.4) opts = ['such bass', 'much boom', 'very bass', 'such bass'];
    else if (f.softLevel > 0.6) opts = ['very loud', 'so loud', 'much volume', 'wow'];
    else if (f.softTreble > 0.45) opts = ['such sparkle', 'very treble', 'much tss'];
    else if (f.softLevel < 0.15) opts = ['so quiet', 'such calm', 'many chill'];
    let s;
    for (let i = 0; i < 4; i++) { s = opts[Math.floor(Math.random() * opts.length)]; if (s !== this.last) break; }
    this.last = s;
    return s;
  }

  _face(ctx, R) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(3, R * 0.025);
    const tan = '#e2a24f', cream = '#fbeedb';
    // ears
    for (const s of [-1, 1]) {
      ctx.fillStyle = tan;
      ctx.beginPath(); ctx.moveTo(s * R * 0.25, -R * 0.7); ctx.quadraticCurveTo(s * R * 0.6, -R * 1.35, s * R * 0.78, -R * 1.15); ctx.lineTo(s * R * 0.9, -R * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = cream;
      ctx.beginPath(); ctx.moveTo(s * R * 0.38, -R * 0.68); ctx.quadraticCurveTo(s * R * 0.6, -R * 1.12, s * R * 0.72, -R * 1.0); ctx.lineTo(s * R * 0.78, -R * 0.45); ctx.closePath(); ctx.fill();
    }
    // head
    ctx.fillStyle = tan;
    ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.85, 0, 0, TAU); ctx.fill(); ctx.stroke();
    // cream mask: cheeks + muzzle, clipped to the head
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.985, R * 0.835, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = cream;
    ctx.beginPath();
    ctx.ellipse(-R * 0.45, R * 0.35, R * 0.45, R * 0.38, 0.2, 0, TAU);
    ctx.ellipse(R * 0.45, R * 0.35, R * 0.45, R * 0.38, -0.2, 0, TAU);
    ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, R * 0.38, R * 0.42, R * 0.38, 0, 0, TAU); ctx.fill();
    ctx.restore();
    // eyebrow dots
    ctx.fillStyle = cream;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * R * 0.36, -R * 0.38, R * 0.1, R * 0.06, s * 0.3, 0, TAU); ctx.fill(); }
    // side-eye: whites with pupils glancing sideways
    for (const s of [-1, 1]) {
      const ex = s * R * 0.38, ey = -R * 0.12;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(ex, ey, R * 0.14, R * 0.11, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1e140c';
      ctx.beginPath(); ctx.arc(ex - R * 0.06, ey + R * 0.01, R * 0.075, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex - R * 0.08, ey - R * 0.02, R * 0.025, 0, TAU); ctx.fill();
    }
    // nose + mouth
    ctx.fillStyle = '#1e140c';
    ctx.beginPath(); ctx.ellipse(0, R * 0.2, R * 0.13, R * 0.09, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, R * 0.28); ctx.lineTo(0, R * 0.42);
    ctx.moveTo(-R * 0.22, R * 0.4); ctx.quadraticCurveTo(-R * 0.1, R * 0.5, 0, R * 0.42); ctx.quadraticCurveTo(R * 0.1, R * 0.5, R * 0.22, R * 0.4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,120,120,0.35)';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * R * 0.6, R * 0.2, R * 0.12, R * 0.07, 0, 0, TAU); ctx.fill(); }
  }

  draw(ctx, f, dt) {
    const { w, h } = this;
    const m = Math.min(w, h);
    if (f.beat) this.zoom = Math.max(this.zoom, 0.4 + 0.6 * f.beatStrength);
    this.zoom *= Math.exp(-dt * 6);

    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, hsla(200, 70, 75 + this.zoom * 8)); g.addColorStop(1, hsla(210, 60, 45));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // bounce: up between beats, landing on the beat
    const hop = Math.sin(Math.PI * f.phase);
    const R = m * 0.26 * (1 + this.zoom * 0.12);
    ctx.save();
    ctx.translate(w / 2, h / 2 + m * 0.04 - hop * m * 0.04 * (0.5 + f.softLevel));
    ctx.rotate((f.beatCount % 2 ? 1 : -1) * 0.08 * hop);
    ctx.scale(1 + (1 - hop) * 0.03, 1 - (1 - hop) * 0.03);
    this._face(ctx, R);
    ctx.restore();

    // spawn phrases on detected beats (and on the clock if beats are sparse)
    if (f.beat || (f.tick && f.beatCount % 2 === 0 && this.words.length < 2)) {
      let x, y, tries = 0;
      do {
        x = w * (0.1 + Math.random() * 0.8); y = h * (0.1 + Math.random() * 0.8); tries++;
      } while (tries < 12 && (Math.hypot((x - w / 2) / (m * 0.45), (y - h / 2) / (m * 0.42)) < 1 || this.words.some(o => Math.abs(o.x - x) < m * 0.3 && Math.abs(o.y - y) < m * 0.08)));
      this.words.push({ text: this._pick(f), x, y, life: 1.5, hue: Math.random() * 360, size: m * (0.055 + 0.03 * (f.beatStrength || 0.3)), rot: (Math.random() - 0.5) * 0.3 });
      if (this.words.length > 8) this.words.shift();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = this.words.length - 1; i >= 0; i--) {
      const p = this.words[i];
      p.life -= dt;
      if (p.life <= 0) { this.words.splice(i, 1); continue; }
      const age = 1.5 - p.life;
      const pop = age < 0.15 ? 0.6 + (age / 0.15) * 0.5 : 1.1 - Math.min(0.1, (age - 0.15));
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(pop, pop);
      ctx.globalAlpha = Math.min(1, p.life / 0.6);
      ctx.font = `bold ${p.size}px ${FONT}`;
      ctx.lineWidth = p.size * 0.12; ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = hsla(p.hue, 100, 55);
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
  }
}
