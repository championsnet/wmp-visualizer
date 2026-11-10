// Scores the beat tracker (js/beat.js) on beat-annotated music, the way the
// beat-tracking literature does: F-measure with a 70 ms window, ignoring the
// first 5 s of each clip. Needs ffmpeg on the PATH and one of the datasets:
//
//   Ballroom  audio        https://mtg.upf.edu/ismir2004/contest/tempoContest/data1.tar.gz
//             annotations  https://github.com/CPJKU/BallroomAnnotations
//   GTZAN     audio        https://huggingface.co/datasets/marsyas/gtzan (genres.tar.gz)
//             annotations  https://github.com/TempoBeatDownbeat/gtzan_tempo_beat (beats/)
//
// usage: node scripts/beat-bench.mjs ballroom <BallroomData dir> <annotations dir> [all|tune|test] [new|classic] ['{"comb":false}']
//        node scripts/beat-bench.mjs gtzan    <genres dir>       <beats dir>       [all|tune|test] [new|classic] [tracker options]
//
// "tune" is every even-numbered clip (the tracker's settings were chosen on
// those), "test" every odd-numbered one. "classic" scores the tempo clock the
// visualizer used before (kept in js/audio.js as the fallback): an emulated
// AnalyserNode read at 60 fps, bass-energy onsets, inter-onset tempo voting.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PulseTracker } from '../js/beat.js';

const SR = 48000, WINDOW = 0.07, SKIP = 5, FPS = 60;
const [set, audioDir, annDir, part = 'all', which = 'new', optsJson = '{}', shard] = process.argv.slice(2);

function clips() {
  const out = [];
  for (const genre of readdirSync(audioDir).sort()) {
    let names;
    try { names = readdirSync(join(audioDir, genre)).sort(); } catch (_) { continue; }
    for (const name of names) {
      if (!name.endsWith('.wav')) continue;
      const ann = set === 'ballroom'
        ? join(annDir, name.replace('.wav', '.beats'))
        : join(annDir, 'gtzan_' + name.replace('.wav', '').replace('.', '_') + '.beats');
      if (existsSync(ann)) out.push({ name, genre: genre.replace(/-.*/, ''), audio: join(audioDir, genre, name), ann });
    }
  }
  if (part === 'tune') return out.filter((_, i) => i % 2 === 0);
  if (part === 'test') return out.filter((_, i) => i % 2 === 1);
  return out;
}

// The tracker driven the way the page drives it: audio fed hop by hop, the
// beat clock read once per display frame.
function trackNew(x, opts) {
  const tr = new PulseTracker(SR, opts), dt = 1 / FPS, beats = [];
  let fed = 0;
  for (let t = 0.05; t < x.length / SR; t += dt) {
    const target = Math.floor(t * SR);
    while (fed + tr.hop <= target) { fed += tr.hop; if (fed >= tr.fftSize) tr.process(x, fed - tr.fftSize); }
    tr.update(dt, t - fed / SR);
    if (tr.tick) beats.push(t - tr.phase * 60 / tr.bpm);       // the beat fell a fraction of a frame ago
  }
  return beats;
}

function trackClassic(x) {
  const N = 2048, HIST = 43, dt = 1 / FPS;
  const win = new Float32Array(N), cos = [], sin = [];
  for (let n = 0; n < N; n++) win[n] = 0.42 - 0.5 * Math.cos(2 * Math.PI * n / N) + 0.08 * Math.cos(4 * Math.PI * n / N);
  for (let b = 0; b <= 8; b++) {
    cos.push(Float32Array.from({ length: N }, (_, n) => Math.cos(2 * Math.PI * b * n / N)));
    sin.push(Float32Array.from({ length: N }, (_, n) => Math.sin(2 * Math.PI * b * n / N)));
  }
  const smooth = new Float32Array(9), hist = new Float32Array(HIST), score = new Float32Array(181), xw = new Float32Array(N);
  let hi = 0, lastBeatAt = -10, prevE = 0, bpm = 120, phase = 0;
  const onsets = [], beats = [];
  for (let t = N / SR + 0.01; t < x.length / SR; t += dt) {
    const start = Math.floor(t * SR) - N;
    for (let n = 0; n < N; n++) xw[n] = x[start + n] * win[n];
    let e = 0;
    for (let b = 1; b <= 8; b++) {
      let re = 0, im = 0;
      for (let n = 0; n < N; n++) { re += xw[n] * cos[b][n]; im -= xw[n] * sin[b][n]; }
      smooth[b] = 0.2 * smooth[b] + 0.8 * Math.sqrt(re * re + im * im) / N;
      const db = 20 * Math.log10(smooth[b]);
      const v = (db > -90 ? Math.min(255, Math.floor(255 / 70 * (db + 90))) : 0) / 255;
      e += v * v;
    }
    e /= 8;
    let avg = 0;
    for (let i = 0; i < HIST; i++) avg += hist[i];
    avg /= HIST;
    const onset = e > prevE * 1.05 && e > avg * 1.4 + 0.01 && e > 0.02 && t - lastBeatAt > 0.2;
    if (onset) { lastBeatAt = t; onsets.push(t); }
    hist[hi] = e; hi = (hi + 1) % HIST; prevE = e;
    const decay = Math.exp(-dt / 6);
    for (let i = 0; i < score.length; i++) score[i] *= decay;
    while (onsets.length && t - onsets[0] > 8) onsets.shift();
    if (onset && onsets.length > 1) {
      const last = onsets[onsets.length - 1];
      for (let i = onsets.length - 2; i >= 0; i--) {
        const gap = last - onsets[i];
        if (gap > 4) break;
        if (gap < 0.2) continue;
        let b = 60 / gap;
        while (b < 75) b *= 2;
        while (b > 170) b /= 2;
        const w = 1 / (1 + (onsets.length - 2 - i) * 0.3);
        for (let k = -3; k <= 3; k++) { const q = Math.round(b) + k; if (q >= 0 && q < score.length) score[q] += w * Math.exp(-(k * k) / 2); }
      }
    }
    let best = 0, bestB = 0;
    for (let b = 75; b <= 170; b++) if (score[b] > best) { best = score[b]; bestB = b; }
    if (best > 1.5) bpm += (bestB - bpm) * (1 - Math.exp(-dt * 2));
    const prev = phase;
    phase += dt * bpm / 60;
    if (onset) phase -= (phase - Math.round(phase)) * 0.35;
    const tick = Math.floor(phase) > Math.floor(prev);
    phase -= Math.floor(phase);
    if (tick) beats.push(t - phase * 60 / bpm);
  }
  return beats;
}

function fMeasure(ref, est) {
  ref = ref.filter((b) => b >= SKIP);
  est = est.filter((b) => b >= SKIP);
  let i = 0, j = 0, hit = 0;
  while (i < ref.length && j < est.length) {
    if (Math.abs(ref[i] - est[j]) <= WINDOW) { hit++; i++; j++; } else if (est[j] < ref[i]) j++; else i++;
  }
  const p = est.length ? hit / est.length : 0, r = ref.length ? hit / ref.length : 0;
  return { f: p + r ? 2 * p * r / (p + r) : 0, p };
}

if (shard) {
  const [k, n] = shard.split('/').map(Number);
  clips().forEach((clip, i) => {
    if (i % n !== k) return;
    try {
      const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', clip.audio, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
      const x = new Float32Array(raw.buffer, raw.byteOffset, raw.length >> 2);
      const ref = readFileSync(clip.ann, 'utf8').split('\n').map(parseFloat).filter(isFinite);
      const m = fMeasure(ref, which === 'classic' ? trackClassic(x) : trackNew(x, JSON.parse(optsJson)));
      console.log(JSON.stringify({ genre: clip.genre, f: m.f, p: m.p }));
    } catch (_) { /* an unreadable file (GTZAN has one) */ }
  });
} else {
  const n = cpus().length, rows = [];
  await Promise.all(Array.from({ length: n }, (_, k) => new Promise((done) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), set, audioDir, annDir, part, which, optsJson, `${k}/${n}`]);
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.pipe(process.stderr);
    child.on('close', () => { for (const line of out.split('\n')) if (line) rows.push(JSON.parse(line)); done(); });
  })));
  const pct = (a) => (100 * a.reduce((s, v) => s + v, 0) / (a.length || 1)).toFixed(1);
  console.log(`${set} (${part}), ${which} tracker: ${rows.length} clips, F-measure ${pct(rows.map((r) => r.f))}, beats on an annotated beat ${pct(rows.map((r) => r.p))}%`);
  for (const g of [...new Set(rows.map((r) => r.genre))].sort()) console.log(`  ${g.padEnd(14)} ${pct(rows.filter((r) => r.genre === g).map((r) => r.f))}`);
}
