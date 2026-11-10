import { Visualization, TAU } from './base.js';

// Screensaver: Windows "3D Pipes". Shiny pipes grow smoothly through a 3D
// grid, turning at ball joints. Farther pipes are smaller and darker, so the
// scene has depth. Growth speed follows the music and a beat may start a new
// pipe. When the scene is full it fades to black and starts again.
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const HUES = [0, 28, 52, 120, 175, 210, 270, 315];
const G = 12;                     // grid cells per axis
const MAX_SEGMENTS = 520;

export class Pipes extends Visualization {
  static id = 'pipes';
  static title = '3D Pipes';
  static group = 'Screensavers';
  static retro = true;    // object-style graphics get the soft 2000s look

  constructor() {
    super();
    this.layer = null;
    this.lctx = null;
    this.fadeOut = 0;
    this._reset();
  }

  _reset() {
    this.used = new Set();
    this.pipes = [];
    this.segments = 0;
    this.fadeOut = 0;
    if (this.lctx) { this.lctx.fillStyle = '#000'; this.lctx.fillRect(0, 0, this.layer.width, this.layer.height); }
    this._newPipe();
  }

  activate() { this._reset(); }

  resize(w, h, dpr) {
    super.resize(w, h, dpr);
    if (!this.layer) { this.layer = document.createElement('canvas'); this.lctx = this.layer.getContext('2d'); }
    this.layer.width = Math.max(2, Math.round(w));
    this.layer.height = Math.max(2, Math.round(h));
    this._reset();
  }

  _key(p) { return p.join(','); }

  _newPipe() {
    for (let tries = 0; tries < 60; tries++) {
      const p = [0, 1, 2].map(() => Math.floor(Math.random() * G));
      if (this.used.has(this._key(p))) continue;
      this.used.add(this._key(p));
      const used = new Set(this.pipes.filter((q) => !q.dead).map((q) => q.hue));
      const free = HUES.filter((hh) => !used.has(hh));
      const hue = free[Math.floor(Math.random() * free.length)] ?? HUES[0];
      const pipe = { p, d: DIRS[Math.floor(Math.random() * 6)], hue, next: null, prog: 0, dead: false };
      this.pipes.push(pipe);
      this._ball(this.lctx, p, hue);
      this._pickNext(pipe);
      return;
    }
  }

  // Perspective projection; also returns a depth shade (1 near .. ~0.45 far).
  _project(p) {
    const { w, h } = this;
    const s = Math.min(w, h) / (G * 0.8);
    const x = p[0] - (G - 1) / 2, y = p[1] - (G - 1) / 2, z = p[2] - (G - 1) / 2;
    const persp = 1 / (1 + (z + G) / (G * 2.5));
    const k = 1.15;
    const ax = Math.max(1, w / h), ay = Math.max(1, h / w);
    const shade = 0.45 + 0.55 * (1 - p[2] / (G - 1));
    return [w / 2 + x * s * persp * k * ax, h / 2 + y * s * persp * k * ay, persp * s, shade];
  }

  _ball(c, p, hue) {
    if (!c) return;
    const [x, y, s, sh] = this._project(p);
    const r = s * 0.3;
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
    g.addColorStop(0, `hsl(${hue},100%,${92 * sh}%)`);
    g.addColorStop(0.45, `hsl(${hue},90%,${52 * sh}%)`);
    g.addColorStop(1, `hsl(${hue},90%,${14 * sh}%)`);
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
  }

  // Tube from grid point a towards b, drawn up to fraction t (0..1).
  _tube(c, a, b, hue, t = 1) {
    const [x0, y0, s0, sh0] = this._project(a);
    const [xb, yb, s1, sh1] = this._project(b);
    const x1 = x0 + (xb - x0) * t, y1 = y0 + (yb - y0) * t;
    const r = ((s0 + s1) / 2) * 0.2;
    const sh = (sh0 + sh1) / 2;
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 0.5) return;
    // a pipe lit from the upper left: dark rim, bright body, specular streak
    const ang = Math.atan2(yb - y0, xb - x0);
    const nx = -Math.sin(ang) * r, ny = Math.cos(ang) * r;
    const flip = ny < 0 || (ny === 0 && nx < 0) ? -1 : 1;
    const g = c.createLinearGradient(x0 - nx * flip, y0 - ny * flip, x0 + nx * flip, y0 + ny * flip);
    g.addColorStop(0, `hsl(${hue},90%,${22 * sh}%)`);
    g.addColorStop(0.25, `hsl(${hue},95%,${60 * sh}%)`);
    g.addColorStop(0.38, `hsl(${hue},100%,${90 * sh}%)`);
    g.addColorStop(0.55, `hsl(${hue},90%,${48 * sh}%)`);
    g.addColorStop(1, `hsl(${hue},90%,${10 * sh}%)`);
    c.strokeStyle = g;
    c.lineWidth = r * 2;
    c.lineCap = 'butt';
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
  }

  _pickNext(pipe) {
    let d = pipe.d;
    if (Math.random() < 0.22) d = DIRS[Math.floor(Math.random() * 6)];
    const order = [d, ...DIRS.filter((x) => x !== d).sort(() => Math.random() - 0.5)];
    for (const dir of order) {
      const n = pipe.p.map((v, i) => v + dir[i]);
      if (n.some((v) => v < 0 || v >= G) || this.used.has(this._key(n))) continue;
      this.used.add(this._key(n));
      if (dir !== pipe.d) this._ball(this.lctx, pipe.p, pipe.hue);   // elbow joint
      pipe.d = dir;
      pipe.next = n;
      pipe.prog = 0;
      return;
    }
    this._ball(this.lctx, pipe.p, pipe.hue);                        // dead end cap
    pipe.next = null;
    pipe.dead = true;
  }

  draw(ctx, f, dt) {
    if (!this.layer) return;
    const live = this.pipes.filter((p) => !p.dead);

    if (this.fadeOut > 0) {
      this.fadeOut -= dt;
      ctx.drawImage(this.layer, 0, 0, this.w, this.h);
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, 1 - this.fadeOut / 1.2)})`;
      ctx.fillRect(0, 0, this.w, this.h);
      if (this.fadeOut <= 0) this._reset();
      return;
    }

    // one segment per beat, with most of the movement right on the beat
    // (a surge that eases off), so the pipes visibly grow in time
    const perBeat = f.bpm / 60;
    const rate = perBeat * (0.35 + 2.2 * Math.exp(-f.phase * 6));
    if (f.beat && f.beatStrength > 0.4 && live.length < 3 && Math.random() < 0.35) this._newPipe();
    if (!live.length) this._newPipe();

    for (const p of live) {
      p.prog += dt * rate;
      while (p.prog >= 1 && !p.dead) {
        this._tube(this.lctx, p.p, p.next, p.hue, 1);           // commit the finished segment
        p.p = p.next;
        this.segments++;
        const carry = p.prog - 1;
        this._pickNext(p);
        p.prog = carry;
      }
    }
    if (this.segments >= MAX_SEGMENTS) this.fadeOut = 1.2;

    ctx.drawImage(this.layer, 0, 0, this.w, this.h);
    // the segment currently growing, drawn live so the pipe extends smoothly
    for (const p of this.pipes) {
      if (p.dead || !p.next) continue;
      this._tube(ctx, p.p, p.next, p.hue, Math.min(1, p.prog));
    }
  }
}
