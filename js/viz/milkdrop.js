import { Visualization } from './base.js';

// Milkdrop: the legendary Winamp visualizer, via Butterchurn (MIT), a WebGL
// port that runs the original preset files. The library and preset pack are
// self-hosted in /vendor and only downloaded when this visualization is used.
// Butterchurn reads the audio itself from the engine's input node, renders to
// its own WebGL canvas, and we copy that canvas onto the stage each frame.
// Presets blend to a new random one every ~20 s, timed to land on a beat.

const BASE = new URL('vendor/butterchurn/', document.baseURI).href;
const PRESET_SECONDS = 20;
const BLEND_SECONDS = 2.7;
let loading = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}

function loadLibrary() {
  if (!loading) {
    loading = Promise.all([loadScript(BASE + 'butterchurn.min.js'), loadScript(BASE + 'butterchurnPresets.min.js')])
      .then(() => {
        const bc = window.butterchurn && (window.butterchurn.default || window.butterchurn);
        const packs = window.butterchurnPresets && (window.butterchurnPresets.default || window.butterchurnPresets);
        if (!bc || !packs) throw new Error('Milkdrop library did not initialise');
        return { bc, presets: packs.getPresets() };
      });
    loading.catch(() => { loading = null; });            // allow a retry later
  }
  return loading;
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (_) { return false; }
}

export class Milkdrop extends Visualization {
  static id = 'milkdrop';
  static title = 'Milkdrop Presets';
  static group = 'Milkdrop';

  constructor() {
    super();
    this.engine = null;          // set by main.js
    this.lib = null;
    this.viz = null;
    this.canvas = null;
    this.audioCtx = null;
    this.connectedTo = null;
    this.keys = [];
    this.order = [];
    this.presetName = '';
    this.timer = 0;
    this.status = 'Loading Milkdrop presets…';
    this.failed = false;
  }

  activate() {
    this.timer = 0;
    this.preload();
  }

  // Called by main.js soon after the page loads, so the library is already
  // here the first time Milkdrop comes up.
  preload() {
    if (this.lib || this.failed) return;
    if (!webglAvailable()) {
      this.failed = true;
      this.status = 'Milkdrop needs WebGL, which this browser has turned off.';
      return;
    }
    loadLibrary().then((lib) => {
      this.lib = lib;
      this.keys = Object.keys(lib.presets);
      if (this.engine && this.engine.active) this.warm();   // a source started while loading
    }).catch((err) => {
      this.status = `Milkdrop could not load (${err.message}).`;
    });
  }

  // Called by main.js when an audio source starts: builds the renderer and
  // first preset ahead of time, so switching to Milkdrop shows it at once.
  warm() {
    if (this.lib) this._ensureVisualizer();
  }

  _renderSize() {
    // cap the GL resolution so heavy presets stay smooth
    const s = Math.min(1, 1280 / Math.max(this.w, this.h, 1));
    return [Math.max(2, Math.round(this.w * s)), Math.max(2, Math.round(this.h * s))];
  }

  resize(w, h, dpr) {
    super.resize(w, h, dpr);
    if (this.viz) {
      const [rw, rh] = this._renderSize();
      this.canvas.width = rw;
      this.canvas.height = rh;
      this.viz.setRendererSize(rw, rh);
    }
  }

  _ensureVisualizer() {
    const eng = this.engine;
    if (!this.lib || !eng || !eng.ctx || !eng.input) return false;
    if (!this.viz || this.audioCtx !== eng.ctx) {
      const [rw, rh] = this._renderSize();
      this.canvas = document.createElement('canvas');
      this.canvas.width = rw;
      this.canvas.height = rh;
      this.viz = this.lib.bc.createVisualizer(eng.ctx, this.canvas, { width: rw, height: rh, pixelRatio: 1, textureRatio: 1 });
      this.audioCtx = eng.ctx;
      this.connectedTo = null;
      this._nextPreset(0);
    }
    if (this.connectedTo !== eng.input) {
      this.viz.connectAudio(eng.input);
      this.connectedTo = eng.input;
    }
    return true;
  }

  _nextPreset(blend = BLEND_SECONDS) {
    if (!this.keys.length) return;
    if (!this.order.length) {
      this.order = this.keys.slice();
      for (let i = this.order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
      }
    }
    const key = this.order.pop();
    this.presetName = key;
    this.viz.loadPreset(this.lib.presets[key], blend);
    this.timer = 0;
  }

  // Public: lets the UI skip to another preset (bound to the N key).
  skip() { if (this.viz) this._nextPreset(1); }

  draw(ctx, f, dt) {
    const { w, h } = this;
    if (!this._ensureVisualizer()) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '16px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.lib && !(this.engine && this.engine.ctx) ? 'Choose an audio source to start Milkdrop.' : this.status, w / 2, h / 2);
      ctx.textAlign = 'start';
      return;
    }
    this.timer += dt;
    if (this.timer > PRESET_SECONDS && (f.beat || this.timer > PRESET_SECONDS + 4)) this._nextPreset();
    try {
      this.viz.render();
    } catch (err) {
      // a broken preset should not kill the stage; move on to another
      console.warn('Milkdrop preset failed, skipping:', this.presetName, err);
      this._nextPreset(0);
      return;
    }
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.canvas, 0, 0, w, h);
    // preset name, small and dim, like Milkdrop's own overlay
    if (this.timer < 4) {
      ctx.globalAlpha = Math.min(1, (4 - this.timer)) * 0.75;
      ctx.fillStyle = '#fff';
      ctx.font = '13px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText(this.presetName.slice(0, 90), w - 12, h - 10);
    }
    ctx.restore();
  }
}
