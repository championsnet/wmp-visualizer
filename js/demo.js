// A small generated loop so the visuals can be tried with nothing connected.
// Everything is scheduled a little ahead on the AudioContext clock.
// Each style is an "average" track of that genre: tempo, drum pattern, swing,
// bass and harmony. Styles also drive the visuals silently (no sound output).
const AM_F_C_G = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]];
const MINOR = [[57, 60, 64], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
const DARK = [[45, 48, 52], [45, 48, 52], [43, 46, 50], [41, 45, 48]];
const JAZZY = [[57, 60, 64, 67], [50, 53, 57, 60], [55, 59, 62, 65], [52, 55, 59, 62]];

export const STYLES = {
  demo: {
    label: 'Demo track', bpm: 122, chords: AM_F_C_G, swing: 0, lead: 1, pad: 1,
    kick:  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,1,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hat:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1],
    bass:  [1,0,1,0, 1,0,0,1, 0,0,1,0, 1,0,1,1],
  },
  techno: {
    label: 'Techno', bpm: 130, chords: DARK, swing: 0, lead: 0.3, pad: 0.4, bassLen: 0.5,
    kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hat:   [0,0,2,0, 0,0,2,0, 0,0,2,0, 0,0,2,1],
    bass:  [0,1,1,1, 0,1,1,1, 0,1,1,1, 0,1,1,1],
  },
  house: {
    label: 'House', bpm: 124, chords: JAZZY, swing: 0.08, lead: 0.5, pad: 1,
    kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hat:   [0,0,2,0, 0,0,2,0, 0,0,2,0, 0,0,2,0],
    bass:  [0,0,1,0, 0,0,1,1, 0,0,1,0, 0,1,1,0],
  },
  hiphop: {
    label: 'Hip-hop', bpm: 90, chords: JAZZY, swing: 0.22, lead: 0.25, pad: 0.8, bassLen: 1.8,
    kick:  [1,0,0,0, 0,0,0,1, 0,0,1,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
    hat:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    bass:  [1,0,0,0, 0,0,0,1, 0,0,1,0, 0,0,0,0],
  },
  trap: {
    label: 'Trap', bpm: 140, chords: MINOR, swing: 0, lead: 0.4, pad: 0.6, bassLen: 3, halfTime: true,
    kick:  [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
    snare: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    hat:   [1,1,1,0, 1,1,1,1, 1,0,1,1, 1,1,1,1],
    bass:  [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
  },
  dnb: {
    label: 'Drum & bass', bpm: 174, chords: MINOR, swing: 0, lead: 0.3, pad: 1, bassLen: 1.6,
    kick:  [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hat:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1],
    bass:  [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
  },
  party: {
    label: 'Party / pop', bpm: 120, chords: AM_F_C_G, swing: 0, lead: 1, pad: 1, bassLen: 0.5,
    kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hat:   [0,0,2,0, 0,0,2,0, 0,0,2,0, 0,0,2,0],
    bass:  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
  },
  rock: {
    label: 'Rock', bpm: 128, chords: AM_F_C_G, swing: 0, lead: 0.6, pad: 1.4, bassLen: 0.9,
    kick:  [1,0,0,0, 0,0,0,0, 1,0,1,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hat:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    bass:  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
  },
  chill: {
    label: 'Chill / lo-fi', bpm: 80, chords: JAZZY, swing: 0.25, lead: 0.3, pad: 1.4, bassLen: 2, soft: true,
    kick:  [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hat:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    bass:  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
  },
};
const ARP   = [0,1,2,1, 2,0,1,2, 0,2,1,0, 1,2,0,2];

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class DemoSynth {
  constructor(ctx, style = 'demo') {
    this.ctx = ctx;
    this.style = STYLES[style] || STYLES.demo;
    // half-time styles (trap) count their 16 steps over two beats' worth of 8ths
    this.stepDur = 60 / this.style.bpm / (this.style.halfTime ? 2 : 4);
    this.output = ctx.createGain();
    this.output.gain.value = 0;

    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -16;
    this.comp.ratio.value = 4;
    this.comp.connect(this.output);

    this.master = ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.comp);

    // echo for the lead
    this.delay = ctx.createDelay(1);
    this.delay.delayTime.value = this.stepDur * 3;
    this.delayFb = ctx.createGain();
    this.delayFb.gain.value = 0.35;
    this.delayWet = ctx.createGain();
    this.delayWet.gain.value = 0.5;
    this.delay.connect(this.delayFb);
    this.delayFb.connect(this.delay);
    this.delay.connect(this.delayWet);
    this.delayWet.connect(this.master);

    const len = Math.floor(ctx.sampleRate * 1);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.running = false;
  }

  start() { this.resume(); }

  resume() {
    if (this.running) return;
    this.running = true;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.output.gain.cancelScheduledValues(this.ctx.currentTime);
    this.output.gain.setTargetAtTime(1, this.ctx.currentTime, 0.08);
    this._schedule();
    this.timer = setInterval(() => this._schedule(), 40);
  }

  pause() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this.timer);
    this.timer = null;
    this.output.gain.cancelScheduledValues(this.ctx.currentTime);
    this.output.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  }

  stop() {
    this.pause();
    this.output.gain.setValueAtTime(0, this.ctx.currentTime);
  }

  _schedule() {
    const ctx = this.ctx;
    if (ctx.state !== 'running') {
      // keep the clock from racing ahead while suspended
      this.nextTime = ctx.currentTime + 0.05;
      return;
    }
    while (this.nextTime < ctx.currentTime + 0.16) {
      // swing delays every second 16th
      const late = this.step % 2 ? this.style.swing * this.stepDur : 0;
      this._playStep(this.step, this.nextTime + late);
      this.step++;
      this.nextTime += this.stepDur;
    }
  }

  _playStep(step, t) {
    const st = this.style;
    const STEP = this.stepDur;
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const chord = st.chords[bar % st.chords.length];
    const phrase = Math.floor(bar / 4) % 2;        // alternate 4-bar phrases
    const soft = st.soft ? 0.6 : 1;

    if (st.kick[s]) this._kick(t, soft);
    if (st.snare[s]) this._snare(t, soft);
    if (st.hat[s]) this._hat(t, st.hat[s] === 2 || s % 4 === 2 ? 0.14 : 0.045, soft);
    if (st.bass[s]) this._bass(t, mtof(chord[0] - 24), STEP * (st.bassLen || (s % 4 === 3 ? 0.5 : 0.9)));
    // the lead plays a share of the 16ths set by the style
    const leadOn = st.lead >= 1 ? (phrase === 0 ? s % 2 === 0 : true) : ((s * 7 + bar * 3) % 16) / 16 < st.lead;
    if (leadOn) {
      const octave = 12 * (1 + ((s + bar) % 3 === 0 ? 1 : 0));
      this._lead(t, mtof(chord[ARP[s] % chord.length] + octave), STEP * 0.8);
    }
    if (s === 0 && st.pad) this._pad(t, chord, STEP * 16, st.pad);
  }

  _env(gain, t, peak, dur, attack = 0.005) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  _kick(t, v = 1) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(170, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    this._env(g, t, v, 0.38, 0.003);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  _snare(t, v = 1) {
    const ctx = this.ctx;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    this._env(g, t, 0.55 * v, 0.2, 0.002);
    n.connect(bp).connect(g).connect(this.master);
    n.start(t);
    n.stop(t + 0.22);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.1);
    const g2 = ctx.createGain();
    this._env(g2, t, 0.4 * v, 0.12, 0.002);
    osc.connect(g2).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  _hat(t, dur, v = 1) {
    const ctx = this.ctx;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    const g = ctx.createGain();
    this._env(g, t, 0.16 * v, dur, 0.002);
    n.connect(hp).connect(g).connect(this.master);
    n.start(t);
    n.stop(t + dur + 0.02);
  }

  _bass(t, freq, dur) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(1100, t);
    lp.frequency.exponentialRampToValueAtTime(160, t + dur);
    const g = ctx.createGain();
    this._env(g, t, 0.38, dur, 0.004);
    osc.connect(lp).connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _lead(t, freq, dur) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = freq * 1.005;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    const g = ctx.createGain();
    this._env(g, t, 0.07, dur, 0.01);
    osc.connect(lp);
    osc2.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    g.connect(this.delay);
    osc.start(t);
    osc2.start(t);
    osc.stop(t + dur + 0.02);
    osc2.stop(t + dur + 0.02);
  }

  _pad(t, chord, dur, level = 1) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045 * level, t + 0.4);
    g.gain.setValueAtTime(0.045 * level, t + dur - 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    lp.connect(g).connect(this.master);
    for (const m of chord) {
      for (const det of [-6, 6]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = mtof(m);
        osc.detune.value = det;
        osc.connect(lp);
        osc.start(t);
        osc.stop(t + dur + 0.05);
      }
    }
  }
}
