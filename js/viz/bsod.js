import { Visualization, clamp } from './base.js';

// Joke visual: a Windows 9x-style Blue Screen of Death that glitches to the
// music. Beats shift slices sideways, split the colours and re-roll the
// error codes; the cursor blinks on the beat clock; big drops "crash" the
// screen with heavy tearing and static that decays back to readable text.
const BLUE = '#0000AA';
const hex = (n) => Array.from({ length: n }, () => '0123456789ABCDEF'[(Math.random() * 16) | 0]).join('');
const VXDS = ['VMM(01)', 'VWIN32(05)', 'VFAT(03)', 'BASS(0B)', 'SUBWOOF(07)', 'VDJ(02)', 'DRUMKIT(0C)'];
const EXC = ['0E', '0D', '06', '0C', '0F'];

export class BlueScreen extends Visualization {
  static id = 'bsod';
  static title = 'Blue Screen';
  static group = 'Screensavers';

  constructor() {
    super();
    this.layer = document.createElement('canvas');
    this.lctx = this.layer.getContext('2d');
    this.activate();
  }

  activate() {
    this.glitch = 0;
    this.crash = 0;
    this._roll();
  }

  _roll() {
    this.exc = EXC[(Math.random() * EXC.length) | 0];
    this.addr = `0028:${hex(8)}`;
    this.vxd = VXDS[(Math.random() * VXDS.length) | 0];
    this.off = hex(8);
  }

  _render(f) {
    const { w, h } = this;
    const L = this.layer, c = this.lctx;
    const dpr = Math.min(2, this.dpr || 1);
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (L.width !== pw || L.height !== ph) { L.width = pw; L.height = ph; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = BLUE;
    c.fillRect(0, 0, w, h);
    const fs = clamp(Math.min(w / 46, h / 20), 10, 34);
    c.font = `700 ${fs}px "Lucida Console", "Courier New", monospace`;
    c.textBaseline = 'top';
    const cw = c.measureText('M').width;
    const lines = [
      `A fatal exception ${this.exc} has occurred at ${this.addr} in VXD`,
      `${this.vxd} + ${this.off}. The current tune will be terminated.`,
      '',
      '*  Press any key to terminate the current tune.',
      '*  Press CTRL+ALT+DEL to restart the party. You will',
      '   lose any unsaved dance moves in all applications.',
    ];
    const blockW = 54 * cw;
    const x0 = Math.max(8, (w - blockW) / 2);
    const lh = fs * 1.35;
    const total = lh * (lines.length + 4);
    let y = Math.max(8, (h - total) / 2);
    // title block
    const title = ' Windows ';
    const tw = c.measureText(title).width;
    c.fillStyle = '#AAAAAA';
    c.fillRect((w - tw) / 2, y - 2, tw, lh);
    c.fillStyle = BLUE;
    c.fillText(title, (w - tw) / 2, y);
    y += lh * 2;
    c.fillStyle = '#FFFFFF';
    for (const s of lines) { c.fillText(s, x0, y); y += lh; }
    y += lh;
    const prompt = '                Press any key to continue ';
    c.fillText(prompt, x0, y);
    if (f.phase < 0.5) c.fillRect(x0 + c.measureText(prompt).width, y + fs * 0.8, cw, fs * 0.18);
  }

  draw(ctx, f, dt) {
    const { w, h } = this;
    if (f.beat) {
      this.glitch = Math.max(this.glitch, 0.4 + f.beatStrength * 0.6);
      this._roll();
      if (f.beatStrength > 0.85) this.crash = 1;
    }
    this.glitch *= Math.exp(-dt * 7);
    this.crash *= Math.exp(-dt * 2.5);
    this._render(f);

    const L = this.layer, sx = L.width / w;
    const g = this.glitch + this.crash;
    ctx.fillStyle = BLUE;
    ctx.fillRect(0, 0, w, h);
    if (g < 0.03) { ctx.drawImage(L, 0, 0, w, h); return; }

    // horizontal slice offsets
    const slices = 6 + Math.round(g * 14);
    let y = 0;
    while (y < h) {
      const sh = Math.max(4, (Math.random() * 2 + 0.3) * h / slices);
      const hit = Math.random() < 0.25 + this.crash * 0.6;
      const off = hit ? (Math.random() - 0.5) * w * 0.12 * g : 0;
      ctx.drawImage(L, 0, y * sx, L.width, sh * sx, off, y, w, sh);
      y += sh;
    }
    // RGB split: tinted copies blended on top
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(g * 0.5, 0, 0.6);
    const d = 2 + g * 8;
    ctx.drawImage(L, d, 0, w, h);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgb(140,0,0)';
    ctx.globalAlpha = clamp(g * 0.6, 0, 0.7);
    for (let i = 0; i < 3; i++) ctx.fillRect(0, Math.random() * h, w, h * 0.08 * g);
    ctx.restore();
    // scanline tear
    const ty = (Math.random() * h) | 0;
    ctx.drawImage(L, 0, ty * sx, L.width, 3 * sx, (Math.random() - 0.5) * 40 * g, ty, w, 3 + g * 6);
    // crash: static noise + tearing bands
    if (this.crash > 0.05) {
      const n = Math.round(400 * this.crash);
      for (let i = 0; i < n; i++) {
        const v = (Math.random() * 255) | 0;
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 30 * this.crash, 2);
      }
      ctx.fillStyle = `rgba(255,255,255,${this.crash * 0.25})`;
      for (let i = 0; i < 4; i++) ctx.fillRect(0, Math.random() * h, w, 2 + Math.random() * 20 * this.crash);
    }
  }
}
