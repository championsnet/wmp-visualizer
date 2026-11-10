import { Visualization, TAU, clamp } from './base.js';

// Beat Radar: the beat tracker's view of the music (see ../beat.js), drawn
// like a lab instrument. Left of the "now" line is what it heard, as spikes
// of novelty; right of it is what it expects: the predicted pulse, with a
// marker on every beat to come. The markers slide in from the future and
// reach the line as the beat sounds. Below, how strongly each tempo fits.

const GREEN = 'rgb(90,255,130)';
const DIM = 'rgba(90,255,130,0.28)';
const LABEL = 'rgba(90,255,130,0.6)';
const AMBER = 'rgb(255,205,70)';
const FONT = '"Lucida Console", Monaco, Menlo, monospace';

export class BeatRadar extends Visualization {
  static id = 'beatradar';
  static title = 'Beat Radar';
  static group = 'Modern';

  constructor() {
    super();
    this.engine = null;          // set by main.js
    this.nov = null;
    this.pulse = null;
    this.gain = 1;
    this.flash = 0;
    this.shownBpm = 0;
    this.fresh = true;
  }

  activate() { this.fresh = true; }

  draw(ctx, f, dt) {
    const W = this.w, H = this.h;
    const tr = this.engine && !this.engine.classicBeat ? this.engine.pulse : null;
    ctx.save();
    ctx.fillStyle = '#020603';
    ctx.fillRect(0, 0, W, H);
    const u = Math.max(1, Math.min(W / 900, H / 520));       // size unit
    ctx.lineJoin = 'round';

    const top = H * 0.1, mid = H * 0.44, bottom = H * 0.64;  // timeline box
    const nowX = W * 0.36;
    // faint grid
    ctx.strokeStyle = 'rgba(90,255,130,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = nowX % (W / 12); x < W; x += W / 12) { ctx.moveTo(x, top); ctx.lineTo(x, bottom); }
    for (let y = top; y <= bottom + 1; y += (bottom - top) / 4) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();

    ctx.font = `${Math.round(11 * u)}px ${FONT}`;
    ctx.textBaseline = 'alphabetic';
    if (!tr) {
      ctx.fillStyle = GREEN;
      ctx.textAlign = 'center';
      ctx.fillText('The beat tracker is not available in this browser.', W / 2, H / 2);
      ctx.restore();
      return;
    }
    if (!this.nov) { this.nov = new Float32Array(tr.half); this.pulse = new Float32Array(tr.size); }
    tr.readNovelty(this.nov);
    tr.readPulse(this.pulse);
    const nov = this.nov, pulse = this.pulse;

    // time axis: 3 s of future fill the right side; buffers move one frame per
    // hop, so slide by the time since the last hop to scroll smoothly
    const px = (W - nowX) / tr.half;                         // pixels per frame
    const age = f.active ? clamp(this.engine.pulseAge * tr.rate, 0, 4) : 0;
    const xNov = (m) => nowX - (tr.half - 1 - m + age) * px;
    const xPulse = (t) => nowX + (t - tr.cursor - age) * px;

    // heard: novelty spikes
    let peak = 0;
    for (let m = 0; m < tr.half; m++) if (nov[m] > peak) peak = nov[m];
    this.gain += (Math.max(peak, 1e-3) - this.gain) * (1 - Math.exp(-dt * (peak > this.gain ? 20 : 1)));
    const spike = (bottom - mid) * 0.92;
    ctx.fillStyle = GREEN;
    const bw = Math.max(1, px * 0.7);
    for (let m = 0; m < tr.half; m++) {
      const x = xNov(m);
      if (x < -bw) continue;
      const v = Math.min(1, nov[m] / this.gain);
      if (v > 0.02) ctx.fillRect(x - bw / 2, bottom - v * spike, bw, v * spike);
    }

    // expected: the pulse, solid where it has been, dashed where it will be
    const amp = (mid - top) * 0.85;
    const yPulse = (v) => mid - Math.max(0, v) * amp;
    const trace = (from, to) => {
      ctx.beginPath();
      for (let t = from; t <= to; t++) {
        const x = xPulse(t), y = yPulse(pulse[t]);
        if (t === from) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    const first = Math.max(0, Math.floor(tr.cursor - nowX / px - 1));
    ctx.lineWidth = 2 * u;
    ctx.strokeStyle = AMBER;
    ctx.globalAlpha = 0.45;
    trace(first, tr.cursor);
    ctx.globalAlpha = 1;
    ctx.setLineDash([6 * u, 4 * u]);
    trace(tr.cursor, tr.size - 1);
    ctx.setLineDash([]);

    // a marker on every beat still to come
    ctx.fillStyle = AMBER;
    ctx.strokeStyle = 'rgba(255,205,70,0.35)';
    ctx.lineWidth = 1;
    for (let t = tr.cursor + 1; t < tr.size - 1; t++) {
      const v = pulse[t];
      if (v > 0.12 && v >= pulse[t - 1] && v > pulse[t + 1]) {
        const x = xPulse(t), y = yPulse(v), r = (3 + 5 * Math.min(1, v)) * u;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, bottom); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
      }
    }

    // now
    if (f.tick && f.tempoConfident) this.flash = 1;
    this.flash *= Math.exp(-dt * 7);
    ctx.strokeStyle = '#fff';
    ctx.globalAlpha = 0.55 + 0.45 * this.flash;
    ctx.lineWidth = (1.5 + 3 * this.flash) * u;
    ctx.beginPath(); ctx.moveTo(nowX, top - 6 * u); ctx.lineTo(nowX, bottom + 6 * u); ctx.stroke();
    if (this.flash > 0.02) {
      ctx.globalAlpha = this.flash;
      ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.arc(nowX, mid - amp, (10 + 46 * (1 - this.flash)) * u, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = LABEL;
    ctx.textAlign = 'right';
    ctx.fillText('HEARD', nowX - 10 * u, top - 10 * u);
    ctx.textAlign = 'left';
    ctx.fillText('PREDICTED', nowX + 10 * u, top - 10 * u);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('NOW', nowX, bottom + 20 * u);
    ctx.fillStyle = LABEL;
    for (let s = 1; s <= 2; s++) ctx.fillText(`+${s} s`, nowX + s * tr.rate * px, bottom + 20 * u);
    ctx.fillText('-1 s', nowX - tr.rate * px, bottom + 20 * u);

    // tempo fit, 60 to 200 BPM on a ratio scale
    const gx = W * 0.06, gw = W * 0.56, gy = H * 0.93, gh = H * 0.17;
    const bins = tr.bins, cw = gw / bins;
    const at = tr.kernelBpm > 0 ? Math.log(tr.kernelBpm / tr.binBpm[0]) / Math.log(tr.binBpm[1] / tr.binBpm[0]) : -9;
    for (let k = 0; k < bins; k++) {
      const v = tr.tempogram[k];
      ctx.fillStyle = Math.abs(k - at) < 1.5 ? AMBER : GREEN;
      ctx.globalAlpha = 0.35 + 0.65 * v;
      ctx.fillRect(gx + k * cw, gy - v * gh, Math.max(1, cw - 1), v * gh + 1);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = LABEL;
    ctx.textAlign = 'center';
    for (const bpm of [60, 80, 100, 120, 150, 200]) {
      ctx.fillText(String(bpm), gx + Math.log(bpm / tr.binBpm[0]) / Math.log(tr.binBpm[bins - 1] / tr.binBpm[0]) * (gw - cw) + cw / 2, gy + 16 * u);
    }
    ctx.textAlign = 'left';
    ctx.fillText('TEMPO FIT', gx, gy - gh - 8 * u);

    // read-out
    const locked = f.active && f.tempoConfident;
    // the read-out glides, except on arrival, when the old number means nothing
    if (this.fresh) { this.shownBpm = locked ? f.bpm : 0; this.fresh = false; }
    this.shownBpm += ((locked ? f.bpm : 0) - this.shownBpm) * (1 - Math.exp(-dt * 6));
    const rx = W * 0.94;
    ctx.textAlign = 'right';
    ctx.fillStyle = locked ? AMBER : DIM;
    ctx.font = `${Math.round(54 * u)}px ${FONT}`;
    ctx.fillText(locked ? this.shownBpm.toFixed(1) : '---.-', rx, gy - gh * 0.42);
    ctx.font = `${Math.round(13 * u)}px ${FONT}`;
    ctx.fillText('BPM', rx, gy - gh * 0.42 + 20 * u);
    ctx.fillStyle = locked ? GREEN : DIM;
    ctx.fillText(locked ? 'LOCKED' : f.active ? 'LISTENING' : 'NO SIGNAL', rx, gy + 16 * u);
    // agreement meter
    const mw = W * 0.2, mh = 6 * u, mx = rx - mw, my = gy - 4 * u;
    ctx.strokeStyle = DIM;
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my - mh, mw, mh);
    ctx.fillStyle = locked ? GREEN : DIM;
    ctx.fillRect(mx, my - mh, mw * clamp(f.active ? f.stability : 0, 0, 1), mh);
    ctx.restore();
  }
}
