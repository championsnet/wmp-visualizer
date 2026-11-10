// Audio capture and analysis. One AnalyserNode is shared by every source;
// per frame it is reduced to a small "frame" object that visualizations read.
import { DemoSynth, STYLES } from './demo.js';
import { PulseTracker } from './beat.js';

export const NUM_BANDS = 64;
const MIN_FREQ = 35;
const MAX_FREQ = 16000;
const BEAT_HISTORY = 43;          // ~0.7 s at 60 fps
const FFT_SIZE = 2048;
const DISPLAY_DELAY = 0.025;      // seconds from drawing a frame to seeing it

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.input = null;            // every source connects here
    this.analyser = null;         // smoothed, for the visuals
    this.beatAnalyser = null;     // barely smoothed, for transient (beat) detection
    this.beatFreq = new Uint8Array(FFT_SIZE / 2);
    this.tap = null;              // raw samples for the beat tracker
    this.pulse = null;            // the predictive beat tracker (null on browsers that cannot feed it)
    this.classicBeat = false;     // true: use the older onset-interval tempo clock instead
    this.outGain = null;
    this.current = null;          // { kind, label, teardown }
    this.audioEl = null;
    this.elSource = null;
    this.objectUrl = null;
    this.demo = null;
    this.volume = 0.8;
    this.micDeviceId = null;
    this.listeners = {};

    this.frame = {
      freq: new Uint8Array(FFT_SIZE / 2),
      time: new Uint8Array(FFT_SIZE),
      bands: new Float32Array(NUM_BANDS),
      soft: new Float32Array(NUM_BANDS),   // bands smoothed over time (fast rise, slow fall): use for shapes
      softBass: 0, softMid: 0, softTreble: 0, softLevel: 0,
      bass: 0, mid: 0, treble: 0,
      rms: 0, level: 0,
      beat: false, beatStrength: 0,
      // Tempo: a beat clock that follows the predicted beats (see beat.js).
      bpm: 120,          // estimated tempo
      phase: 0,          // 0..1 position inside the current beat (0 = on the beat)
      beatCount: 0,      // whole beats elapsed on the clock (use parity for left/right moves)
      tick: false,       // true on the frame the clock crosses a beat
      tempoConfident: false,
      pulse: 0,          // 0..1 predicted beat pulse, 1 on the beat
      stability: 0,      // 0..1 how well the tracker's predictions agree
      active: false,
    };

    this.frame.time.fill(128);     // silence sits at the midpoint for byte time-domain data

    this._bandRanges = null;
    this._tilt = new Float32Array(NUM_BANDS);
    this._gainEnv = 0.3;
    this._levelEnv = 0.05;
    this._history = new Float32Array(BEAT_HISTORY);
    this._hi = 0;
    this._lastBeatAt = -10;
    this._prevBeatEnergy = 0;
    this._lastT = 0;
    this._onsets = [];
    this._bpmScore = new Float32Array(181);
    this._tapBuf = null;
    this._tapPos = -1;            // audio fed to the tracker so far, in samples of context time
    this._beatCost = 0;
  }

  // ---- events -----------------------------------------------------------
  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); return this; }
  emit(evt, data) { for (const fn of this.listeners[evt] || []) fn(data); }

  // ---- state ------------------------------------------------------------
  get kind() { return this.current ? this.current.kind : null; }
  get label() { return this.current ? this.current.label : ''; }
  get active() { return !!this.current; }
  get running() { return !!this.ctx && this.ctx.state === 'running'; }
  get playing() {
    if (!this.current) return false;
    if (this.current.kind === 'file') return !!this.audioEl && !this.audioEl.paused;
    if (this.current.kind === 'demo' || this.current.kind === 'style') return !!this.demo && this.demo.running;
    return true;
  }
  // Seconds of audio the beat tracker has not been fed yet (under one hop while frames keep coming).
  get pulseAge() { return this.ctx && this._tapPos >= 0 ? this.ctx.currentTime - this._tapPos / this.ctx.sampleRate : 0; }
  get canPause() { return this.kind === 'file' || this.kind === 'demo' || this.kind === 'style'; }
  get duration() { return this.kind === 'file' && this.audioEl && isFinite(this.audioEl.duration) ? this.audioEl.duration : 0; }
  get position() { return this.kind === 'file' && this.audioEl ? this.audioEl.currentTime : 0; }

  // ---- context ----------------------------------------------------------
  // Call synchronously inside a user gesture when possible: the context is
  // created here and resume() is started (not awaited, as browsers may keep
  // the promise pending until a gesture arrives).
  ensureContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('Web Audio is not supported in this browser.');
      this.ctx = new AC();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = FFT_SIZE;
      this.analyser.smoothingTimeConstant = 0.8;
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -20;
      this.beatAnalyser = this.ctx.createAnalyser();
      this.beatAnalyser.fftSize = FFT_SIZE;
      this.beatAnalyser.smoothingTimeConstant = 0.2;
      this.beatAnalyser.minDecibels = -90;
      this.beatAnalyser.maxDecibels = -20;
      this.input = this.ctx.createGain();
      this.input.connect(this.analyser);
      this.input.connect(this.beatAnalyser);
      // The beat tracker reads raw samples from a third analyser, used as a
      // ring buffer: long, so a few slow frames lose no audio. Browsers too
      // old for this keep the older tempo clock.
      try {
        const tap = this.ctx.createAnalyser();
        tap.fftSize = 16384;
        this._tapBuf = new Float32Array(tap.fftSize);
        tap.getFloatTimeDomainData(this._tapBuf);
        this.input.connect(tap);
        this.tap = tap;
        this.pulse = new PulseTracker(this.ctx.sampleRate);
      } catch (_) { this.tap = null; this.pulse = null; }
      this.outGain = this.ctx.createGain();
      this.outGain.gain.value = this.volume;
      this.outGain.connect(this.ctx.destination);
      this.ctx.addEventListener('statechange', () => this.emit('state', this.ctx.state));
      this._computeBandRanges();
    }
    this.resume();
    return this.ctx;
  }

  resume() {
    if (this.ctx && this.ctx.state !== 'running') {
      this.ctx.resume().catch(() => {});
    }
  }

  _computeBandRanges() {
    const binCount = this.analyser.frequencyBinCount;
    const binHz = (this.ctx.sampleRate / 2) / binCount;
    this._bandRanges = [];
    for (let i = 0; i < NUM_BANDS; i++) {
      const f0 = MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, i / NUM_BANDS);
      const f1 = MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, (i + 1) / NUM_BANDS);
      let b0 = Math.min(binCount - 1, Math.floor(f0 / binHz));
      let b1 = Math.min(binCount, Math.max(b0 + 1, Math.floor(f1 / binHz)));
      this._bandRanges.push([b0, b1]);
      // Music has far less energy up high; lift the top end so it still shows.
      this._tilt[i] = 1 + 0.7 * (i / (NUM_BANDS - 1));
    }
  }

  _requireMedia() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(window.isSecureContext
        ? 'This browser does not support audio capture.'
        : 'Audio capture needs a secure page. Open the app via http://localhost or https.');
    }
  }

  // ---- sources ----------------------------------------------------------
  _setCurrent(next) {
    const prev = this.current;
    this.current = next;
    if (prev && prev.teardown) {
      try { prev.teardown(); } catch (_) { /* ignore */ }
    }
    this._resetAnalysis();
    this.emit('source', next);
  }

  _attachStream(stream, kind, label) {
    const node = this.ctx.createMediaStreamSource(stream);
    node.connect(this.input);
    const track = stream.getAudioTracks()[0];
    const teardown = () => {
      node.disconnect();
      for (const t of stream.getTracks()) t.stop();
    };
    const src = { kind, label, teardown, stream };
    this._setCurrent(src);
    if (track) {
      track.addEventListener('ended', () => {
        if (this.current === src) {
          this.stop();
          this.emit('ended', { reason: 'The audio source stopped.' });
        }
      });
    }
  }

  async useMic(deviceId) {
    this._requireMedia();
    this.ensureContext();
    const audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    if (deviceId) audio.deviceId = { exact: deviceId };
    const stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
    const track = stream.getAudioTracks()[0];
    const name = track && track.label ? track.label : 'Microphone';
    this.micDeviceId = deviceId || (track && track.getSettings ? track.getSettings().deviceId : null) || null;
    this._attachStream(stream, 'mic', name);
  }

  async listInputs() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'audioinput');
  }

  async useDisplay() {
    this._requireMedia();
    if (!navigator.mediaDevices.getDisplayMedia) {
      throw new Error('Screen / tab capture is not supported in this browser. Try Chrome or Edge.');
    }
    this.ensureContext();
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      selfBrowserSurface: 'exclude',
      systemAudio: 'include',
    });
    for (const t of stream.getVideoTracks()) t.stop();
    if (stream.getAudioTracks().length === 0) {
      for (const t of stream.getTracks()) t.stop();
      throw new Error('No audio was shared. In the picker choose a tab (or screen) and tick "Share audio".');
    }
    const track = stream.getAudioTracks()[0];
    const name = track.label && !/^(system|screen)/i.test(track.label) ? `Shared audio: ${track.label}` : 'Shared tab / screen audio';
    this._attachStream(stream, 'display', name);
  }

  _ensureElement() {
    if (this.audioEl) return;
    const el = new Audio();
    el.preload = 'auto';
    el.addEventListener('ended', () => this.emit('ended', { reason: 'Track finished.' }));
    el.addEventListener('play', () => this.emit('play'));
    el.addEventListener('pause', () => this.emit('play'));
    el.addEventListener('error', () => this.emit('error', new Error('This file could not be decoded by the browser.')));
    this.audioEl = el;
    this.elSource = this.ctx.createMediaElementSource(el);
  }

  async useFile(file) {
    this.ensureContext();
    this._ensureElement();
    const el = this.audioEl;
    const elSource = this.elSource;
    this._setCurrent({
      kind: 'file',
      label: file.name,
      teardown: () => {
        el.pause();
        el.removeAttribute('src');
        el.load();
        elSource.disconnect();
      },
    });
    const old = this.objectUrl;
    this.objectUrl = URL.createObjectURL(file);
    if (old) URL.revokeObjectURL(old);
    el.src = this.objectUrl;
    elSource.connect(this.input);
    elSource.connect(this.outGain);
    try {
      await el.play();
    } catch (err) {
      // Autoplay may be blocked when there was no gesture (e.g. drag and drop); the Play button still works.
      this.emit('warning', 'Press Play to start the track.');
    }
  }

  // A music style runs the same generator silently: the visuals react as if
  // that kind of music were playing, with no mic and nothing audible.
  useStyle(style) {
    if (!STYLES[style] || style === 'demo') throw new Error(`Unknown music style "${style}".`);
    this.useDemo(style);
  }

  useDemo(style = 'demo') {
    this.ensureContext();
    const demo = new DemoSynth(this.ctx, style);
    const silent = style !== 'demo';
    demo.output.connect(this.input);
    if (!silent) demo.output.connect(this.outGain);
    this._setCurrent({
      kind: silent ? 'style' : 'demo',
      style,
      label: silent ? `${STYLES[style].label} (silent)` : 'Demo track',
      teardown: () => { demo.stop(); demo.output.disconnect(); if (this.demo === demo) this.demo = null; },
    });
    this.demo = demo;
    demo.start();
  }

  stop() {
    if (!this.current) return;
    this._setCurrent(null);
    this.demo = null;
  }

  // ---- transport --------------------------------------------------------
  togglePlay() {
    this.resume();
    if (this.kind === 'file' && this.audioEl) {
      if (this.audioEl.paused) this.audioEl.play().catch(() => {});
      else this.audioEl.pause();
    } else if ((this.kind === 'demo' || this.kind === 'style') && this.demo) {
      if (this.demo.running) this.demo.pause();
      else this.demo.resume();
      this.emit('play');
    }
  }

  seek(fraction) {
    if (this.kind !== 'file' || !this.audioEl || !this.duration) return;
    this.audioEl.currentTime = Math.max(0, Math.min(1, fraction)) * this.duration;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.outGain) {
      this.outGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  // ---- per-frame analysis ----------------------------------------------
  _resetAnalysis() {
    this._tapPos = -1;
    this._gainEnv = 0.3;
    this._levelEnv = 0.05;
    this._history.fill(0);
    this._hi = 0;
    this._prevBeatEnergy = 0;
    this.frame.bands.fill(0);
    this.frame.soft.fill(0);
    this.frame.freq.fill(0);
    this.frame.time.fill(128);
  }

  update(t) {
    const f = this.frame;
    const dt = Math.min(0.1, Math.max(0, t - this._lastT));
    this._lastT = t;
    this._smooth(dt);
    f.beat = false;
    f.beatStrength = 0;
    if (!this.analyser || !this.current || this.ctx.state !== 'running') {
      f.active = false;
      // let the visuals settle instead of freezing on the last frame
      for (let i = 0; i < NUM_BANDS; i++) f.bands[i] *= 0.9;
      f.bass *= 0.9; f.mid *= 0.9; f.treble *= 0.9; f.level *= 0.9; f.rms *= 0.9;
      for (let i = 0; i < NUM_BANDS; i++) f.soft[i] *= 0.92;
      f.softBass *= 0.92; f.softMid *= 0.92; f.softTreble *= 0.92; f.softLevel *= 0.92;
      return f;
    }
    f.active = true;
    this.analyser.getByteFrequencyData(f.freq);
    this.analyser.getByteTimeDomainData(f.time);

    const bands = f.bands;
    const ranges = this._bandRanges;
    let maxRaw = 0;
    for (let i = 0; i < NUM_BANDS; i++) {
      const b0 = ranges[i][0], b1 = ranges[i][1];
      let sum = 0, mx = 0;
      for (let b = b0; b < b1; b++) {
        const v = f.freq[b];
        sum += v;
        if (v > mx) mx = v;
      }
      const avg = sum / (b1 - b0);
      const raw = ((avg * 0.6 + mx * 0.4) / 255) * this._tilt[i];
      bands[i] = raw;
      if (raw > maxRaw) maxRaw = raw;
    }
    // Slow automatic gain so quiet mics and loud files both fill the display.
    this._gainEnv = Math.max(maxRaw, this._gainEnv * 0.998, 0.3);
    const g = 1 / this._gainEnv;
    let bass = 0, mid = 0, treble = 0;
    for (let i = 0; i < NUM_BANDS; i++) {
      const v = Math.min(1, bands[i] * g);
      bands[i] = v;
      if (i < 20) bass += v;
      else if (i < 44) mid += v;
      else treble += v;
    }
    f.bass = bass / 20;
    f.mid = mid / 24;
    f.treble = treble / 20;

    let sq = 0;
    const time = f.time;
    for (let i = 0; i < time.length; i++) {
      const v = (time[i] - 128) / 128;
      sq += v * v;
    }
    f.rms = Math.sqrt(sq / time.length);
    this._levelEnv = Math.max(f.rms, this._levelEnv * 0.998, 0.05);
    f.level = Math.min(1, f.rms / this._levelEnv);

    // Beat: low-frequency energy (about 30-180 Hz, barely smoothed) rises
    // sharply above its own recent average.
    this.beatAnalyser.getByteFrequencyData(this.beatFreq);
    let e = 0;
    for (let b = 1; b <= 8; b++) {
      const v = this.beatFreq[b] / 255;
      e += v * v;
    }
    e /= 8;
    const hist = this._history;
    let avg = 0;
    for (let i = 0; i < BEAT_HISTORY; i++) avg += hist[i];
    avg /= BEAT_HISTORY;
    const rising = e > this._prevBeatEnergy * 1.05;
    if (rising && e > avg * 1.4 + 0.01 && e > 0.02 && t - this._lastBeatAt > 0.2) {
      f.beat = true;
      f.beatStrength = Math.min(1, (e / Math.max(avg, 0.01) - 1) / 1.5);
      this._lastBeatAt = t;
      this._onsets.push(t);
    }
    hist[this._hi] = e;
    this._hi = (this._hi + 1) % BEAT_HISTORY;
    this._prevBeatEnergy = e;
    this._smooth(0, true);
    if (this.pulse && !this.classicBeat) this._predict();
    else this._tempo(t, f.beat);
    return f;
  }

  // How far ahead of the analysed audio the beat clock runs, in seconds, so
  // that a beat is on screen when it is heard. A microphone hears the sound
  // late; our own playback is analysed a little before it leaves the speakers.
  _lookahead() {
    const kind = this.kind;
    if (kind === 'mic' || kind === 'display') {
      const track = this.current.stream && this.current.stream.getAudioTracks()[0];
      const latency = track && track.getSettings ? track.getSettings().latency : 0;
      return DISPLAY_DELAY + Math.min(0.1, latency > 0 ? latency : 0.02);
    }
    if (kind === 'file' || kind === 'demo') return DISPLAY_DELAY - Math.min(0.05, this.ctx.outputLatency || this.ctx.baseLatency || 0);
    return DISPLAY_DELAY;
  }

  // Feeds the beat tracker the audio that arrived since the last frame, one
  // hop at a time, then reads its beat clock.
  _predict() {
    const f = this.frame, tr = this.pulse, sr = this.ctx.sampleRate;
    const hop = tr.hop, n = tr.fftSize, buf = this._tapBuf;
    const now = this.ctx.currentTime;
    const target = Math.floor(now * sr);
    if (this._tapPos < 0 || target - this._tapPos > sr * 2) {      // a new source, or a long stall
      tr.reset();
      // when the music is our own, its tempo is no secret
      const style = this.current.style && STYLES[this.current.style];
      if (style) tr.setPrior(style.bpm, 0.35); else tr.setPrior();
      this._tapPos = target;
      this._lastPredict = now;
    }
    let avail = target - this._tapPos;
    if (avail >= hop) {
      this.tap.getFloatTimeDomainData(buf);
      const reach = buf.length - n;                // the oldest frame start still in the buffer
      if (avail - hop > reach) {                   // slow frames: that audio is gone
        const lost = Math.ceil((avail - hop - reach) / hop);
        tr.skip(lost);
        this._tapPos += lost * hop;
        avail -= lost * hop;
      }
      const t0 = performance.now();
      while (avail >= hop) {
        avail -= hop;
        this._tapPos += hop;
        tr.process(buf, buf.length - avail - n);
      }
      // a slow device estimates the tempo less often instead of dropping frames
      this._beatCost += (performance.now() - t0 - this._beatCost) * 0.05;
      if (this._beatCost > 3 && tr.every < 8) { tr.every *= 2; this._beatCost = 0; }
    }
    tr.update(Math.min(0.1, Math.max(0, now - this._lastPredict)), now - this._tapPos / sr + this._lookahead());
    this._lastPredict = now;
    f.phase = tr.phase;
    f.tick = tr.tick;
    if (tr.tick) f.beatCount++;
    f.bpm = tr.bpm;
    f.tempoConfident = tr.confident;
    f.pulse = Math.max(0, tr.pulse);
    f.stability = tr.stability;
  }

  // The older tempo clock, kept for browsers that cannot feed the tracker and
  // for comparison (?beat=classic).
  // Tempo from inter-onset intervals: every pair of recent onsets votes for
  // the tempo its gap implies (folded into 75-170 BPM). Votes decay, so the
  // estimate follows tempo changes. A phase-locked clock then advances at
  // that tempo and is nudged towards each detected beat.
  _tempo(t, onset) {
    const f = this.frame;
    const dt = this._dt || 0;
    const score = this._bpmScore;
    const decay = Math.exp(-dt / 6);
    for (let i = 0; i < score.length; i++) score[i] *= decay;
    const on = this._onsets;
    while (on.length && t - on[0] > 8) on.shift();
    if (onset && on.length > 1) {
      const last = on[on.length - 1];
      for (let i = on.length - 2; i >= 0; i--) {
        let gap = last - on[i];
        if (gap > 4) break;
        if (gap < 0.2) continue;
        let bpm = 60 / gap;
        while (bpm < 75) bpm *= 2;
        while (bpm > 170) bpm /= 2;
        const w = 1 / (1 + (on.length - 2 - i) * 0.3);
        for (let k = -3; k <= 3; k++) {
          const b = Math.round(bpm) + k;
          if (b >= 0 && b < score.length) score[b] += w * Math.exp(-(k * k) / 2);
        }
      }
    }
    let best = 0, bestB = 0, total = 0;
    for (let b = 75; b <= 170; b++) { total += score[b]; if (score[b] > best) { best = score[b]; bestB = b; } }
    if (best > 1.5) {
      f.bpm += (bestB - f.bpm) * (1 - Math.exp(-dt * 2));
      f.tempoConfident = best / (total + 1e-6) > 0.12;
    }
    const prev = f.phase;
    f.phase += dt * f.bpm / 60;
    if (onset) {
      // pull the clock towards the beat: error in -0.5..0.5 of a beat
      let err = f.phase - Math.round(f.phase);
      f.phase -= err * 0.35;
    }
    f.tick = Math.floor(f.phase) > Math.floor(prev);
    if (f.tick) f.beatCount++;
    f.phase -= Math.floor(f.phase);
  }

  // Frame-rate independent smoothing: rises in ~40 ms, falls in ~250 ms.
  _smooth(dt, apply = false) {
    if (!apply) { this._dt = dt; return; }
    const f = this.frame;
    const up = 1 - Math.exp(-this._dt * 25);
    const down = 1 - Math.exp(-this._dt * 4);
    const s = (cur, v) => cur + (v - cur) * (v > cur ? up : down);
    for (let i = 0; i < NUM_BANDS; i++) f.soft[i] = s(f.soft[i], f.bands[i]);
    f.softBass = s(f.softBass, f.bass);
    f.softMid = s(f.softMid, f.mid);
    f.softTreble = s(f.softTreble, f.treble);
    f.softLevel = s(f.softLevel, f.level);
  }
}
