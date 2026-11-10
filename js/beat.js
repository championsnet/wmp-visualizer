// Predictive beat tracking: real-time PLP (predominant local pulse) in plain
// JavaScript, after Meier, Chiu & Müller, "A Real-Time Beat Tracking System
// with Zero Latency and Enhanced Controllability" (TISMIR, 2024) and their
// MIT-licensed reference code (github.com/groupmm/real_time_plp).
//
// For every ~10 ms hop of audio:
//   1. novelty: how much louder the spectrum just got (spectral flux);
//   2. a tempogram over the last 3 s of novelty picks the predominant tempo
//      and the phase of its pulse;
//   3. a windowed sinusoid with that tempo and phase, reaching 3 s into the
//      future, is overlap-added into the pulse buffer.
// The buffer at "now" is what hundreds of past predictions agree on, and the
// buffer after "now" says where the next beats fall before they sound.
//
// The paper feeds this a neural network's beat activation. Here it gets plain
// spectral flux, so that it runs anywhere, and these additions make up for it
// (each one measured on the Ballroom and GTZAN beat annotations, see README):
//   - flux in third-octave bands, so the treble does not outvote the bass;
//   - tempo salience = Fourier tempogram x autocorrelation of the novelty at
//     that beat period (after Peeters, 2007) x a preference for a comfortable
//     tapping pace, which keeps the pulse off faster and dotted levels;
//   - a comb of beat-spaced teeth slid over the novelty snaps each prediction
//     from the fitted sine onto the actual onsets;
//   - a kick-drum check moves the pulse by half a beat when a steady kick
//     lands between the predicted beats (off-beat bass and hi-hats otherwise
//     capture the phase in dance music);
//   - the buffer holds complex sinusoids, so the beat phase is read straight
//     from it, between frames too, and a beat clock follows that phase and
//     free-runs when the music stops.

const TAU = Math.PI * 2;
const GAMMA = 1000;               // log compression of the spectrum
const LOCAL_AVERAGE = 10;         // novelty frames in the running average
const TEMPO_STEP = 1.015;         // tempo candidates are 1.5 % apart
// Offset in frames between the pulse buffer's cursor and the present, measured
// on synthetic beats so that the clock's beats land on the sounds' onsets.
const CALIBRATION = -0.35;
const frac = (x) => x - Math.floor(x);

export class PulseTracker {
  constructor(sampleRate, {
    kernelSeconds = 6, bpmMin = 60, bpmMax = 200, every = 2,
    bands = true, autocorrelation = true, twoBeats = true, hold = 3, sticky = 0.3,
    priorBpm = 120, priorOctaves = 0.7, comb = true, combReach = 0.5, combPull = 0.4, kick = 3,
  } = {}) {
    this.combReach = combReach;                      // beats either side of the fit that the comb may move
    this.combPull = combPull;                        // how much being a whole beat from the fit would cost
    this.every = every;                              // estimate the tempo every n-th hop
    this.useBands = bands;
    this.autocorrelation = autocorrelation;
    this.twoBeats = twoBeats;
    this.sticky = sticky;
    this.useComb = comb;
    this.kickRatio = kick;

    // a hop of about 10 ms whatever the device's sample rate
    let hop = 512;
    while (sampleRate / hop > 140) hop *= 2;
    this.sampleRate = sampleRate;
    this.hop = hop;
    this.fftSize = hop * 2;
    this.rate = sampleRate / hop;                    // novelty frames per second

    // --- spectrum ---
    const n = this.fftSize;
    this._re = new Float32Array(n);
    this._im = new Float32Array(n);
    this._fftWin = new Float32Array(n);
    this._cos = new Float32Array(n / 2);
    this._sin = new Float32Array(n / 2);
    this._rev = new Uint16Array(n);
    const bits = Math.round(Math.log2(n));
    for (let i = 0; i < n; i++) {
      this._fftWin[i] = 0.5 - 0.5 * Math.cos(TAU * i / n);
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this._rev[i] = r;
    }
    for (let i = 0; i < n / 2; i++) {
      this._cos[i] = Math.cos(TAU * i / n);
      this._sin[i] = Math.sin(TAU * i / n);
    }
    // third-octave bands from 40 Hz up
    const binHz = sampleRate / n;
    const edges = [Math.max(1, Math.round(40 / binHz))];
    for (let f = 40 * Math.pow(2, 1 / 3); f < Math.min(16000, sampleRate / 2); f *= Math.pow(2, 1 / 3)) {
      const b = Math.round(f / binHz);
      if (b > edges[edges.length - 1]) edges.push(b);
    }
    this._edges = Uint16Array.from(edges);
    this._lastSpec = new Float32Array(n / 2 + 1);
    this._recent = new Float32Array(LOCAL_AVERAGE);
    this._lowA = 1 - Math.exp(-TAU * 100 / sampleRate);     // 100 Hz low-pass, twice
    this._envA = 1 - Math.exp(-1 / (0.008 * sampleRate));   // 8 ms energy follower

    // --- tempogram and pulse buffer ---
    // The kernel is `size` frames long and centred on now: its past half is
    // fitted to the novelty, its future half is the prediction.
    this.half = Math.round(kernelSeconds * this.rate / 2);
    this.size = this.half * 2;
    this.cursor = this.half;                         // "now" inside the pulse buffer
    this.bins = Math.ceil(Math.log(bpmMax / bpmMin) / Math.log(TEMPO_STEP)) + 1;
    const { size, half, bins } = this;
    this._win = new Float32Array(size);
    for (let i = 0; i < size; i++) this._win[i] = 0.5 - 0.5 * Math.cos(TAU * i / (size - 1));
    // weight a position holds once every kernel that reaches it has been added
    this._full = new Float32Array(size + 1);
    for (let i = size - 1; i >= 0; i--) this._full[i] = this._full[i + 1] + this._win[i];
    this.binBpm = new Float32Array(bins);            // tempo of each candidate
    this._kcos = new Float32Array(bins * half);
    this._ksin = new Float32Array(bins * half);
    this._lag = new Float32Array(bins);              // beat period in frames
    this._prior = new Float32Array(bins);
    for (let k = 0; k < bins; k++) {
      const bpm = bpmMin * Math.pow(TEMPO_STEP, k);
      const w = TAU * bpm / 60 / this.rate;
      for (let t = 0; t < half; t++) {
        this._kcos[k * half + t] = Math.cos(w * t);
        this._ksin[k * half + t] = Math.sin(w * t);
      }
      this.binBpm[k] = bpm;
      this._lag[k] = this.rate * 60 / bpm;
    }
    this.setPrior(priorBpm, priorOctaves);
    this._nov = new Float32Array(half);              // ring, oldest first from _novHead
    this._kick = new Float32Array(half);             // the same for the kick drum alone
    this._lin = new Float32Array(half);              // novelty unrolled,
    this._wn = new Float32Array(half);               // windowed,
    this._sm = new Float32Array(half + 1);           // and lightly smoothed
    this._klin = new Float32Array(half + 1);
    this._acf = new Float32Array(Math.ceil(this._lag[0] * 2) + 2);
    this._pr = new Float32Array(size);               // pulse buffer rings, from _head
    this._pi = new Float32Array(size);
    this._pw = new Float32Array(size);               // window weight added so far
    this.tempogram = new Float32Array(bins);         // tempo salience 0..1, for display
    this._sal = new Float32Array(bins);              // salience remembered for `hold` seconds
    this._xr = new Float32Array(bins);
    this._xi = new Float32Array(bins);
    this._hold = hold * this.rate;                   // frames the tempo salience is remembered for
    this._z = new Float32Array(4);
    this.reset();
  }

  // People tap along at a comfortable pace: of the pulse levels the music
  // offers (the beat, twice or half of it), prefer the one nearest `bpm`.
  // A player that knows the tempo of what it plays can say so here.
  setPrior(bpm = 120, octaves = 0.7) {
    for (let k = 0; k < this.bins; k++) {
      const oct = octaves > 0 ? Math.log2(this.binBpm[k] / bpm) / octaves : 0;
      this._prior[k] = Math.exp(-0.5 * oct * oct);
    }
  }

  reset() {
    this._lastSpec.fill(0);
    this._recent.fill(0);
    this._recentAt = 0;
    this._fresh = true;                              // no previous spectrum to compare with
    this._l1 = 0; this._l2 = 0; this._env = 0; this._lastLow = 0;
    this._kickNow = 0;
    this._between = false;
    this._nov.fill(0);
    this._kick.fill(0);
    this._novHead = 0;
    this._pr.fill(0); this._pi.fill(0); this._pw.fill(0);
    this._head = 0;
    this.tempogram.fill(0);
    this._sal.fill(0);
    this._period = 0;                                // the current prediction: beat period in frames (0 = none)
    this._crest = 0;                                 // and a beat's position in the novelty window
    this.frames = 0;                                 // hops fed since the last reset
    this.kernelBpm = 0;                              // tempo of the current prediction (0 = none)
    this.bpm = 120;
    this.clock = 0;
    this.phase = 0;                                  // 0..1 inside the beat, 0 = on the beat
    this.pulse = 0;                                  // -1..1, peaks at 1 on the beat
    this.stability = 0;                              // 0..1, how well the predictions agree
    this.confident = false;
    this.tick = false;
    this.beatCount = 0;
  }

  // Feeds one hop: `samples[offset .. offset + fftSize)` must end one hop after
  // the previous call's frame.
  process(samples, offset) {
    const nov = this._novelty(samples, offset);
    this._kick[this._novHead] = this._kickNow;
    this._push(nov);
  }

  // Time passed with no audio to feed (a stalled tab): the predictions keep
  // their place in time, nothing new is added.
  skip(frames) {
    for (let i = 0; i < frames; i++) { this._kick[this._novHead] = 0; this._push(0, true); }
    this._fresh = true;
    this._period = 0;
  }

  _novelty(samples, offset) {
    const n = this.fftSize, re = this._re, im = this._im;
    const win = this._fftWin, rev = this._rev, cos = this._cos, sin = this._sin;
    for (let i = 0; i < n; i++) { re[rev[i]] = samples[offset + i] * win[i]; im[i] = 0; }
    for (let len = 2, step = n >> 1; len <= n; len <<= 1, step >>= 1) {
      const h = len >> 1;
      for (let s = 0; s < n; s += len) {
        for (let j = 0, k = 0; j < h; j++, k += step) {
          const a = s + j, b = a + h;
          const xr = re[b] * cos[k] + im[b] * sin[k];
          const xi = im[b] * cos[k] - re[b] * sin[k];
          re[b] = re[a] - xr; im[b] = im[a] - xi;
          re[a] += xr; im[a] += xi;
        }
      }
    }
    // how much louder each band got since the previous frame
    const last = this._lastSpec;
    let flux = 0;
    if (this.useBands) {
      const edges = this._edges;
      for (let i = 0; i < edges.length - 1; i++) {
        let e = 0;
        for (let b = edges[i]; b < edges[i + 1]; b++) e += re[b] * re[b] + im[b] * im[b];
        const y = Math.log(1 + GAMMA * Math.sqrt(e));
        const d = y - last[i];
        if (d > 0) flux += d;
        last[i] = y;
      }
    } else {
      for (let b = 0; b <= n / 2; b++) {
        const y = Math.log(1 + GAMMA * Math.sqrt(re[b] * re[b] + im[b] * im[b]));
        const d = y - last[b];
        if (d > 0) flux += d;
        last[b] = y;
      }
    }
    // The kick drum on its own: how much the energy below about 100 Hz rose
    // during this hop. The spectrum is too coarse down there, so follow it
    // sample by sample with a small low-pass filter; in plain energy, so that
    // the loudest low hit stands out.
    let l1 = this._l1, l2 = this._l2, env = this._env;
    const a = this._lowA, r = this._envA;
    for (let i = offset + n - this.hop, end = offset + n; i < end; i++) {
      l1 += (samples[i] - l1) * a;
      l2 += (l1 - l2) * a;
      env += (l2 * l2 - env) * r;
    }
    this._l1 = l1; this._l2 = l2; this._env = env;
    this._kickNow = Math.max(0, env - this._lastLow);
    this._lastLow = env;
    if (this._fresh) { this._fresh = false; flux = 0; this._kickNow = 0; }

    const recent = this._recent;
    recent[this._recentAt] = flux;
    this._recentAt = (this._recentAt + 1) % LOCAL_AVERAGE;
    let avg = 0;
    for (let i = 0; i < LOCAL_AVERAGE; i++) avg += recent[i];
    return Math.max(0, flux - avg / LOCAL_AVERAGE);
  }

  _push(nov, quiet = false) {
    const { size, half } = this;
    this._nov[this._novHead] = nov;
    this._novHead = (this._novHead + 1) % half;
    // the pulse buffer moves one frame into the past
    this._pr[this._head] = 0; this._pi[this._head] = 0; this._pw[this._head] = 0;
    this._head = (this._head + 1) % size;
    this._crest -= 1;
    this.frames++;
    if (quiet) return;
    if (this.frames % this.every === 0 || !this._period) this._estimate();
    if (!this._period) return;

    // overlap-add this frame's prediction: a windowed sinusoid with a crest on
    // every expected beat, 3 s back and 3 s ahead
    const w = TAU / this._period, win = this._win;
    const rc = Math.cos(w), rs = Math.sin(w);
    let zr = Math.cos(-w * this._crest), zi = Math.sin(-w * this._crest);
    const pr = this._pr, pi = this._pi, pw = this._pw;
    for (let t = 0, j = this._head; t < size; t++) {
      const g = win[t];
      pr[j] += g * zr;
      pi[j] += g * zi;
      pw[j] += g;
      const nr = zr * rc - zi * rs;
      zi = zr * rs + zi * rc;
      zr = nr;
      if (++j === size) j = 0;
    }
  }

  // Tempo and beat position from the last 3 s of novelty, into _period and _crest.
  _estimate() {
    const { half, bins } = this;
    const lin = this._lin, wn = this._wn, win = this._win;
    let energy = 0;
    for (let m = 0, j = this._novHead; m < half; m++) {
      const v = this._nov[j];
      lin[m] = v;
      wn[m] = v * win[m];
      energy += wn[m];
      if (++j === half) j = 0;
    }
    if (energy < 1e-3) { this._period = 0; this.kernelBpm = 0; this.tempogram.fill(0); return; }   // silence predicts nothing

    // autocorrelation of the novelty at every lag one or two beat periods can have
    const acf = this._acf;
    const lagMin = Math.floor(this._lag[bins - 1]);
    let acf0 = 0;
    for (let m = 0; m < half; m++) acf0 += lin[m] * lin[m];
    if (this.autocorrelation) {
      for (let lag = lagMin; lag < acf.length; lag++) {
        let s = 0;
        for (let m = lag; m < half; m++) s += lin[m] * lin[m - lag];
        acf[lag] = s / (acf0 + 1e-9) * half / (half - lag);
      }
    }

    // Fourier tempogram of the past half-window, weighted by that. The tempo
    // is the strongest one over the last moments, not just in this frame, so
    // one odd bar does not flip the pulse to another level.
    const kcos = this._kcos, ksin = this._ksin, sal = this._sal, xr = this._xr, xi = this._xi;
    const keep = this._hold > 0 ? Math.exp(-this.every / this._hold) : 0;
    let total = 0;
    for (let k = 0; k < bins; k++) {
      const o = k * half;
      let re = 0, im = 0;
      for (let m = 0; m < half; m++) {
        re += wn[m] * kcos[o + m];
        im -= wn[m] * ksin[o + m];
      }
      xr[k] = re; xi[k] = im;
      let s = Math.sqrt(re * re + im * im) * this._prior[k];
      if (this.autocorrelation) {
        // a beat period lines the novelty up with itself, one and two beats on
        const lag = this._lag[k], l0 = Math.floor(lag), l2 = Math.floor(lag * 2);
        let a = Math.max(0, acf[l0] + (acf[l0 + 1] - acf[l0]) * (lag - l0));
        if (this.twoBeats) a = (a + Math.max(0, acf[l2] + (acf[l2 + 1] - acf[l2]) * (lag * 2 - l2))) / 2;
        s *= 0.1 + a;
      }
      if (this.kernelBpm > 0) {
        // and prefer the level it is already on
        const off = (this.binBpm[k] - this.kernelBpm) / (0.04 * this.kernelBpm);
        s *= 1 + this.sticky * Math.exp(-0.5 * off * off);
      }
      this.tempogram[k] = s;
      total += s;
    }
    let best = -1, bestK = 0;
    for (let k = 0; k < bins; k++) {
      // each estimate has the same say, however loud the music is
      sal[k] = sal[k] * keep + this.tempogram[k] / (total + 1e-9);
      if (sal[k] > best) { best = sal[k]; bestK = k; }
    }
    for (let k = 0; k < bins; k++) this.tempogram[k] = sal[k] / best;

    // The tempogram gives the tempo to the nearest candidate and the phase of
    // a sine fitted to the novelty, which syncopation pulls off the beat.
    let period = this._lag[bestK];
    let crest = -Math.atan2(xi[bestK], xr[bestK]) / (TAU / period);   // a crest of the fitted sine
    crest += Math.floor((half - 1 - crest) / period) * period;        // the last one so far

    // Slide a comb of beat-spaced teeth over the novelty and keep the tempo
    // and the position where the teeth land on the most of it: the actual
    // onsets. Positions far from the fit have to be clearly better.
    const sm = this._sm;
    if (this.useComb) {
      sm[0] = lin[0]; sm[half - 1] = lin[half - 1]; sm[half] = lin[half - 1];
      for (let m = 1; m < half - 1; m++) sm[m] = 0.25 * lin[m - 1] + 0.5 * lin[m] + 0.25 * lin[m + 1];
    }
    const teeth = (a, T) => {
      let sum = 0, weight = 0;
      for (let pos = a > half - 1 ? a - T : a; pos >= 0; pos -= T) {
        const i = Math.floor(pos);
        sum += (sm[i] + (sm[i + 1] - sm[i]) * (pos - i)) * win[i];
        weight += win[i];
      }
      return sum / (weight + 1e-9);
    };
    const snap = (reach) => {
      // first the position, at the fitted tempo
      const steps = Math.round(reach / 0.0125), fit = crest;
      let top = -1, topD = 0;
      for (let d = -steps; d <= steps; d++) {
        const score = teeth(fit + d * 0.0125 * period, period) * (1 - this.combPull * Math.abs(d) * 0.0125);
        if (score > top) { top = score; topD = d; }
      }
      // then tempo and position together, close by
      let topT = period, topA = fit + topD * 0.0125 * period;
      top = -1;
      for (let e = -4; e <= 4; e++) {
        const T = period * (1 + e * 0.005);
        for (let d = topD - 4; d <= topD + 4; d++) {
          const a = fit + d * 0.0125 * T;
          const score = teeth(a, T) * (1 - 0.02 * Math.abs(e));
          if (score > top) { top = score; topT = T; topA = a; }
        }
      }
      period = topT; crest = topA;
      if (crest > half - 1) crest -= period;
    };
    if (this.useComb) snap(this.combReach);

    if (this.kickRatio > 0) {
      // On the beat or half-way between? Off-beat bass and hi-hats can outweigh
      // the kick in the novelty, so ask the kick drum.
      const kl = this._klin;
      for (let m = 0, j = this._novHead; m < half; m++) { kl[m] = this._kick[j]; if (++j === half) j = 0; }
      // (the low end swells for a few frames after a hit, so look later rather than earlier)
      const early = Math.max(1, Math.round(period * 0.06)), late = Math.max(2, Math.round(period * 0.18));
      let steady = 0;                                // weakest tooth / average tooth of the last comb
      const comb = (a) => {
        let bestSum = 0;
        for (let d = -early; d <= late; d++) {
          let sum = 0, count = 0, low = Infinity;
          for (let pos = a + d; pos >= 0; pos -= period) {
            const i = Math.round(pos);
            if (i >= half) continue;
            sum += kl[i] * win[i];
            if (win[i] > 0.25) { count++; if (kl[i] < low) low = kl[i]; }
          }
          if (sum > bestSum) { bestSum = sum; steady = count > 2 ? low * count / (sum + 1e-12) : 0; }
        }
        return bestSum;
      };
      const on = comb(crest), between = comb(crest - period / 2);
      // Only a kick on every beat may move the crests (a syncopated bass line
      // is not a kick), and only with a clear lead. A clear lead the other way
      // moves them back; otherwise, or with no kick, keep the last answer.
      if (between > on * this.kickRatio && steady > 0.3) this._between = true;
      else if (on > between * this.kickRatio) this._between = false;
      if (this._between) {
        crest -= period / 2;
        if (this.useComb) snap(0.1);                 // and settle on the onsets there
      }
    }
    this._period = period;
    this._crest = crest;
    this.kernelBpm = this.rate * 60 / period;
  }

  // The pulse at buffer position p (the cursor is now), as [re, im, weight, usual weight].
  _at(p, out) {
    const { size } = this;
    p = Math.max(0, Math.min(size - 1.001, p));
    const i = Math.floor(p), f = p - i;
    let a = this._head + i; if (a >= size) a -= size;
    let b = a + 1; if (b >= size) b -= size;
    out[0] = this._pr[a] + (this._pr[b] - this._pr[a]) * f;
    out[1] = this._pi[a] + (this._pi[b] - this._pi[a]) * f;
    out[2] = this._pw[a] + (this._pw[b] - this._pw[a]) * f;
    out[3] = this._full[i] + (this._full[i + 1] - this._full[i]) * f;
    return out;
  }

  // Reads the pulse `ahead` seconds after the end of the audio fed so far and
  // moves the beat clock on by `dt` seconds. A positive `ahead` makes beats
  // fire early (to make up for input and display delay), a negative one late.
  update(dt, ahead) {
    const z = this._z;
    const p = this.cursor + CALIBRATION + ahead * this.rate;
    this._at(p, z);
    const re = z[0], im = z[1];
    const mag = Math.sqrt(re * re + im * im);
    // agreement between the overlapping predictions; needs at least half of
    // the usual amount of them before it counts as agreement
    const norm = Math.max(z[2], z[3] * 0.5, 1e-6);
    this.stability = Math.min(1, mag / norm);
    this.pulse = re / norm;
    if (this.stability > 0.6) this.confident = true;
    else if (this.stability < 0.4) this.confident = false;

    let inc = dt * this.bpm / 60;
    if (this.stability > 0.3) {
      // tempo: how fast the pulse's phase turns around the read position
      const d = 4;
      this._at(p - d, z);
      const r0 = z[0], i0 = z[1];
      this._at(p + d, z);
      const turn = Math.atan2(z[1] * r0 - z[0] * i0, z[0] * r0 + z[1] * i0) / TAU;
      const bpm = turn / (2 * d / this.rate) * 60;
      if (bpm > 40 && bpm < 260) this.bpm += (bpm - this.bpm) * (1 - Math.exp(-dt * 4));
      inc = dt * this.bpm / 60;
      // the clock is pulled onto the pulse, harder the more stable it is
      let err = frac(Math.atan2(im, re) / TAU) - frac(this.clock + inc);
      err -= Math.round(err);
      inc += err * (1 - Math.exp(-dt * 20 * this.stability));
    }
    if (inc < 0) inc = 0;
    this.clock += inc;
    this.tick = this.clock >= 1;
    if (this.tick) { this.clock -= Math.floor(this.clock); this.beatCount++; }
    this.phase = this.clock;
  }

  // For display: the last 3 s of novelty, and the pulse from 3 s ago to 3 s
  // ahead (index `cursor` is now), scaled to -1..1.
  readNovelty(out) {
    for (let m = 0, j = this._novHead; m < this.half; m++) { out[m] = this._nov[j]; if (++j === this.half) j = 0; }
    return out;
  }

  readPulse(out) {
    // the future fades out, as fewer predictions reach that far
    for (let t = 0, j = this._head; t < this.size; t++) { out[t] = this._pr[j] / this._full[Math.min(t, this.cursor)]; if (++j === this.size) j = 0; }
    return out;
  }
}
