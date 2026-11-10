import { Visualization, clamp } from './base.js';

// Screensaver: the Windows 95/98 "3D Maze". A raycast first-person walk
// through a random maze with red-brick walls. The walker follows the
// right-hand rule; each step or turn starts on the beat clock and eases.
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];   // 0=E 1=S 2=W 3=N
const ease = (p) => p * p * (3 - 2 * p);

export class Maze extends Visualization {
  static id = 'maze';
  static title = '3D Maze';
  static group = 'Screensavers';
  static retro = true;    // object-style graphics get the soft 2000s look

  constructor() {
    super();
    this.cells = 9;
    this._bgKey = '';
    this._newMaze();
  }

  activate() { this._newMaze(); }

  _newMaze() {
    const n = this.cells, S = n * 2 + 1;
    this.S = S;
    const g = new Uint8Array(S * S).fill(1);
    const seen = new Uint8Array(n * n);
    const stack = [[0, 0]];
    seen[0] = 1; g[S + 1] = 0;
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const opts = [];
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d], ny = cy + DY[d];
        if (nx >= 0 && ny >= 0 && nx < n && ny < n && !seen[ny * n + nx]) opts.push(d);
      }
      if (!opts.length) { stack.pop(); continue; }
      const d = opts[(Math.random() * opts.length) | 0];
      const nx = cx + DX[d], ny = cy + DY[d];
      seen[ny * n + nx] = 1;
      g[(2 * cy + 1 + DY[d]) * S + 2 * cx + 1 + DX[d]] = 0;
      g[(2 * ny + 1) * S + 2 * nx + 1] = 0;
      stack.push([nx, ny]);
    }
    this.grid = g;
    // Right-hand rule plan from (0,0) to (n-1,n-1).
    const open = (x, y, d) => g[(2 * y + 1 + DY[d]) * S + 2 * x + 1 + DX[d]] === 0;
    let x = 0, y = 0, d = open(0, 0, 0) ? 0 : 1;
    const acts = [];
    for (let guard = 0; guard < 4000 && !(x === n - 1 && y === n - 1); guard++) {
      const r = (d + 1) & 3;
      if (open(x, y, r)) { acts.push(1); d = r; acts.push(0); x += DX[d]; y += DY[d]; }
      else if (open(x, y, d)) { acts.push(0); x += DX[d]; y += DY[d]; }
      else { acts.push(-1); d = (d + 3) & 3; }
    }
    this.acts = acts;
    this.ai = 0;
    this.px = 1.5; this.py = 1.5;
    const d0 = open(0, 0, 0) ? 0 : 1;
    this.ang = Math.atan2(DY[d0], DX[d0]);
    this.dir = d0;
    this.cur = null;      // {type, p, dur, x0,y0,x1,y1,a0,a1}
    this.idle = 0;
    this.pulse = 0;
    this.bob = 0;
    this.fadeIn = 1;
  }

  _start(f) {
    if (this.ai >= this.acts.length) { this._newMaze(); return; }
    const a = this.acts[this.ai++];
    const beat = 60 / clamp(f.bpm || 120, 60, 200);
    const fast = beat > 0.55;                    // slow songs: step per half beat feels better
    const dur = (fast ? beat * 0.5 : beat) * 0.92;
    if (a === 0) {
      const x1 = this.px + DX[this.dir] * 2, y1 = this.py + DY[this.dir] * 2;
      this.cur = { type: 0, p: 0, dur, x0: this.px, y0: this.py, x1, y1 };
    } else {
      this.dir = (this.dir + (a > 0 ? 1 : 3)) & 3;
      this.cur = { type: 1, p: 0, dur: dur * 1.3, a0: this.ang, a1: this.ang + a * Math.PI / 2 };
    }
    this.half = fast;
  }

  _bg(w, h, ctx) {
    const key = w + 'x' + h;
    if (key === this._bgKey) return;
    this._bgKey = key;
    const c = ctx.createLinearGradient(0, 0, 0, h / 2);
    c.addColorStop(0, '#4a4a4a'); c.addColorStop(1, '#1c1c1c');
    const fl = ctx.createLinearGradient(0, h / 2, 0, h);
    fl.addColorStop(0, '#202020'); fl.addColorStop(1, '#7a7a7a');
    this._ceil = c; this._floor = fl;
  }

  draw(ctx, f, dt) {
    const { w, h } = this;
    this._bg(w, h, ctx);

    // advance the walk on the beat clock
    if (this.cur) {
      this.cur.p += dt / this.cur.dur;
      const e = ease(Math.min(1, this.cur.p));
      if (this.cur.type === 0) {
        this.px = this.cur.x0 + (this.cur.x1 - this.cur.x0) * e;
        this.py = this.cur.y0 + (this.cur.y1 - this.cur.y0) * e;
        this.bob = Math.sin(Math.min(1, this.cur.p) * Math.PI);
      } else {
        this.ang = this.cur.a0 + (this.cur.a1 - this.cur.a0) * e;
      }
      if (this.cur.p >= 1) this.cur = null;
    } else {
      this.bob *= Math.exp(-dt * 8);
    }
    this.idle += dt;
    const halfTick = this.half && this._lastPhase < 0.5 && f.phase >= 0.5;
    this._lastPhase = f.phase;
    if (!this.cur && (f.tick || halfTick || this.idle > 1.2)) { this.idle = 0; this._start(f); }
    this.pulse = Math.max(f.softBass * 0.6 + (f.beat ? f.beatStrength : 0), this.pulse * Math.exp(-dt * 6));
    this.fadeIn *= Math.exp(-dt * 3);

    const horizon = h / 2 + this.bob * h * 0.012 + this.pulse * h * 0.01;
    ctx.fillStyle = this._ceil; ctx.fillRect(0, 0, w, h / 2 + 2);
    ctx.fillStyle = this._floor; ctx.fillRect(0, h / 2 - 2, w, h / 2 + 2);

    const S = this.S, g = this.grid;
    const col = Math.max(2, Math.round(w / 420));
    const fov = 0.66;
    const dirX = Math.cos(this.ang), dirY = Math.sin(this.ang);
    const plX = -dirY * fov, plY = dirX * fov;
    const bright = 1 + this.pulse * 0.25;
    const rows = 8;
    for (let sx = 0; sx < w; sx += col) {
      const cam = 2 * (sx + col / 2) / w - 1;
      const rx = dirX + plX * cam, ry = dirY + plY * cam;
      let mx = Math.floor(this.px), my = Math.floor(this.py);
      const ddx = Math.abs(1 / (rx || 1e-9)), ddy = Math.abs(1 / (ry || 1e-9));
      const stx = rx < 0 ? -1 : 1, sty = ry < 0 ? -1 : 1;
      let sdx = (rx < 0 ? this.px - mx : mx + 1 - this.px) * ddx;
      let sdy = (ry < 0 ? this.py - my : my + 1 - this.py) * ddy;
      let side = 0;
      for (let k = 0; k < 64; k++) {
        if (sdx < sdy) { sdx += ddx; mx += stx; side = 0; } else { sdy += ddy; my += sty; side = 1; }
        if (mx < 0 || my < 0 || mx >= S || my >= S || g[my * S + mx]) break;
      }
      const dist = Math.max(0.05, side ? sdy - ddy : sdx - ddx);
      let wx = side ? this.px + dist * rx : this.py + dist * ry;
      wx -= Math.floor(wx);
      const lh = h / dist;
      const top = horizon - lh / 2;
      const shade = clamp((side ? 0.72 : 1) * bright * (1.25 / (1 + dist * 0.35)), 0, 1.3);
      const r = Math.min(255, 170 * shade) | 0, gg = Math.min(255, 52 * shade) | 0, b = Math.min(255, 36 * shade) | 0;
      ctx.fillStyle = `rgb(${r},${gg},${b})`;
      ctx.fillRect(sx, top, col, lh);
      // mortar
      const m = Math.min(255, 150 * shade * 0.9) | 0;
      ctx.fillStyle = `rgb(${m},${m * 0.92 | 0},${m * 0.85 | 0})`;
      const rh = lh / rows, mt = Math.max(1, rh * 0.12);
      const u = wx * 2;
      for (let i = 0; i < rows; i++) {
        const y = top + i * rh;
        ctx.fillRect(sx, y, col, mt);
        const fu = (u + (i & 1) * 0.5) % 1;
        if (fu < 0.05 || fu > 0.97) ctx.fillRect(sx, y, col, rh);
      }
      if (lh > h * 1.5) continue;
      // subtle dark line at floor for depth
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(sx, top + lh - 1, col, 2);
    }

    if (this.fadeIn > 0.01) {
      ctx.fillStyle = `rgba(0,0,0,${this.fadeIn})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}
