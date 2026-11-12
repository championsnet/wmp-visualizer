// UI controller: wires the audio engine, the visualizations and the chrome together.
import './compat.js';
import { AudioEngine } from './audio.js';
import { VISUALIZATIONS } from './viz/index.js';
import { STYLES } from './demo.js';

const $ = (s) => document.querySelector(s);
const app = $('#app');
const stage = $('#stage');
const canvas = $('#viz');
const ctx = canvas.getContext('2d');
const vizSelect = $('#vizSelect');
const vizLabel = $('#vizLabel');
const vizNameEl = $('#vizName');
const overlay = $('#startOverlay');
const hint = $('#hint');
const toast = $('#toast');
const statusEl = $('#status');
const playBtn = $('#playBtn');
const playIcon = $('#playIcon');
const stopBtn = $('#stopBtn');
const seek = $('#seek');
const timeEl = $('#time');
const durationEl = $('#duration');
const volume = $('#volume');
const micDevices = $('#micDevices');
const autoCycle = $('#autoCycle');
const vizText = $('#vizText');
const retroLook = $('#retroLook');
const nowPlaying = $('#nowPlaying');
const fileInput = $('#fileInput');
const styleSelect = $('#styleSelect');
const styleChips = $('#styleChips');
const fullscreenBtn = $('#fullscreenBtn');
const sourceButtons = Array.from(document.querySelectorAll('.source-buttons [data-source]'));

// Random mode changes roughly every 20 s: each pick gets its own time between
// CYCLE_MIN and CYCLE_MAX, then waits for the start of a musical phrase.
const CYCLE_MIN = 14, CYCLE_MAX = 28;
const newCycleTarget = () => CYCLE_MIN + Math.random() * (CYCLE_MAX - CYCLE_MIN);
const engine = new AudioEngine();
engine.classicBeat = new URLSearchParams(location.search).get('beat') === 'classic';
const vizInstances = VISUALIZATIONS.map((V) => new V());

let viz = null;
let vizIndex = -1;
let cssW = 0, cssH = 0, dpr = 1;
let lastNow = 0, elapsed = 0, cycleTimer = 0, smoothDt = 1 / 60;
let cycleTarget = newCycleTarget(), longLevel = 0, quietTime = 0;
let shuffleBag = [];
let pump = 0;

// ---- 2000s look ----------------------------------------------------------
// Visualizations draw into a small canvas (like WMP did at 2000s resolutions),
// colours are reduced to 16-bit (RGB565) with ordered dithering, then the
// image is smoothly upscaled, giving the soft, banded, analogue look.
const RETRO_MAX = 640;                       // long side of the internal picture
const lowCanvas = document.createElement('canvas');
const lowCtx = lowCanvas.getContext('2d', { willReadFrequently: true });
let lowScale = 1;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

function retroPost(gain) {
  const lw = lowCanvas.width, lh = lowCanvas.height;
  const img = lowCtx.getImageData(0, 0, lw, lh);
  const d = img.data;
  for (let y = 0; y < lh; y++) {
    const by = (y & 3) << 2;
    let i = y * lw * 4;
    for (let x = 0; x < lw; x++, i += 4) {
      const t = BAYER[by | (x & 3)];
      let r = d[i] * gain, g = d[i + 1] * gain, b = d[i + 2] * gain;
      // a little extra saturation, like the punchy CRT-era palette
      const l = (r * 3 + g * 6 + b) * 0.1;
      r = l + (r - l) * 1.06; g = l + (g - l) * 1.06; b = l + (b - l) * 1.06;
      // 15-bit "High Color" (5 bits per channel, steps of 8) with ordered dither
      r += t * 4; g += t * 4; b += t * 4;
      d[i] = r <= 0 ? 0 : r >= 255 ? 248 : r & 0xf8;
      d[i + 1] = g <= 0 ? 0 : g >= 255 ? 248 : g & 0xf8;
      d[i + 2] = b <= 0 ? 0 : b >= 255 ? 248 : b & 0xf8;
    }
  }
  lowCtx.putImageData(img, 0, 0);
}

// Faint scanlines, cached as a pattern.
let scanPattern = null;
function scanlines(c, w, h) {
  if (!scanPattern) {
    const p = document.createElement('canvas');
    p.width = 1; p.height = 3;
    const pc = p.getContext('2d');
    pc.fillStyle = 'rgba(0,0,0,0.08)';
    pc.fillRect(0, 2, 1, 1);
    scanPattern = c.createPattern(p, 'repeat');
  }
  c.fillStyle = scanPattern;
  c.fillRect(0, 0, w, h);
}
let toastTimer = 0, nameTimer = 0, idleTimer = 0, nowTimer = 0;
let seeking = false;
let micDeviceCount = 0;
let lastUiKey = '', lastStatus = '', lastTimeText = '', lastDurText = '';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* storage unavailable */ } },
};

// ---- sizing -------------------------------------------------------------
function resize() {
  const rect = stage.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  // TVs draw at about 720p: their chips are slow, and nobody sits close enough to tell
  const ratio = TV_PLATFORM ? Math.min(1, 1280 / Math.max(w, h)) : Math.min(window.devicePixelRatio || 1, 2);
  if (w === cssW && h === cssH && ratio === dpr) return;
  cssW = w; cssH = h; dpr = ratio;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  lowScale = Math.min(1, RETRO_MAX / Math.max(w, h));
  lowCanvas.width = Math.max(2, Math.round(w * lowScale));
  lowCanvas.height = Math.max(2, Math.round(h * lowScale));
  lowCtx.setTransform(lowScale, 0, 0, lowScale, 0, 0);
  if (viz) viz.resize(w, h, dpr);
}

// ---- visualizations -----------------------------------------------------
function setViz(index, { announce = true } = {}) {
  const n = vizInstances.length;
  index = ((index % n) + n) % n;
  if (index !== vizIndex) {
    vizIndex = index;
    viz = vizInstances[index];
    viz.resize(cssW, cssH, dpr);
    viz.activate();
    vizSelect.value = String(index);
    vizLabel.textContent = `${viz.constructor.group}: ${viz.constructor.title}`;
    store.set('viz', viz.constructor.id);
    vizText.hidden = !viz.constructor.textOption;
    updateShareUrl();
  }
  cycleTimer = 0;
  cycleTarget = newCycleTarget();
  if (announce) showName();
}

// Keep the address bar pointing at the current visualization, so the link
// can be shared or bookmarked. Testing params (autostart) are dropped.
function updateShareUrl() {
  try {
    const url = new URL(location.href);
    url.searchParams.delete('autostart');
    url.searchParams.set('viz', viz.constructor.id);
    if (viz.constructor.textOption && vizText.value.trim()) url.searchParams.set('text', vizText.value.trim());
    else url.searchParams.delete('text');
    history.replaceState(null, '', url);
  } catch (_) { /* sandboxed frames may refuse */ }
}

// Shuffle playlist: every visualization plays once before any repeats, and
// the next pick never comes from the same collection as the current one.
function randomViz() {
  const n = vizInstances.length;
  if (n < 2) return;
  if (!shuffleBag.length) {
    shuffleBag = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffleBag[i], shuffleBag[j]] = [shuffleBag[j], shuffleBag[i]];
    }
  }
  const group = viz ? viz.constructor.group : '';
  let k = shuffleBag.findIndex((i) => i !== vizIndex && vizInstances[i].constructor.group !== group);
  if (k < 0) k = shuffleBag.findIndex((i) => i !== vizIndex);
  if (k < 0) { shuffleBag = []; return randomViz(); }
  const [pick] = shuffleBag.splice(k, 1);
  store.set('shuffle', shuffleBag.map((i) => vizInstances[i].constructor.id).join(','));
  setViz(pick);
}

function nextViz(step) {
  if (autoCycle.checked) randomViz();
  else setViz(vizIndex + step);
}

function showNowPlaying(text) {
  nowPlaying.textContent = text;
  nowPlaying.classList.add('show');
  clearTimeout(nowTimer);
  nowTimer = setTimeout(() => nowPlaying.classList.remove('show'), 5000);
}

function showName() {
  vizNameEl.textContent = `${viz.constructor.group}: ${viz.constructor.title}`;
  vizNameEl.classList.add('show');
  clearTimeout(nameTimer);
  nameTimer = setTimeout(() => vizNameEl.classList.remove('show'), 2200);
}

// ---- feedback -----------------------------------------------------------
function showToast(msg, isError = false) {
  toast.textContent = msg;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), isError ? 6000 : 2500);
}

function describeError(err) {
  const name = err && err.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Permission was denied or the picker was closed. Allow access in the browser and try again.';
  }
  if (name === 'NotFoundError') return 'No audio input device was found.';
  if (name === 'NotReadableError' || name === 'AbortError') {
    return 'The device is busy or could not be opened. Close other apps using it and try again.';
  }
  if (name === 'OverconstrainedError') return 'That input device is no longer available.';
  return err && err.message ? err.message : String(err);
}

function reportError(err) {
  const msg = describeError(err);
  hint.textContent = msg;
  showToast(msg, true);
  console.error(err);
}

// ---- sources ------------------------------------------------------------
async function selectSource(kind, payload) {
  hint.textContent = '';
  try {
    engine.ensureContext(); // runs inside the click so the context is allowed to start
    if (kind === 'file' && !payload) { fileInput.click(); return; }
    if (kind === 'mic') {
      const id = payload || engine.micDeviceId || undefined;
      try {
        await engine.useMic(id);
      } catch (err) {
        if (id && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError')) await engine.useMic();
        else throw err;
      }
    } else if (kind === 'display') {
      await engine.useDisplay();
    } else if (kind === 'file') {
      await engine.useFile(payload);
    } else if (kind === 'demo') {
      engine.useDemo();
    } else if (kind === 'style') {
      engine.useStyle(payload);
    } else {
      throw new Error(`Unknown audio source "${kind}".`);
    }
    overlay.hidden = true;
    if (kind === 'mic') await refreshMicDevices();
    showToast(`Listening to: ${engine.label}`);
  } catch (err) {
    reportError(err);
  }
  refreshUI();
}

async function refreshMicDevices() {
  let inputs = [];
  try { inputs = await engine.listInputs(); } catch (_) { inputs = []; }
  micDevices.innerHTML = '';
  inputs.forEach((d, i) => {
    const o = document.createElement('option');
    o.value = d.deviceId;
    o.textContent = d.label || `Input ${i + 1}`;
    micDevices.appendChild(o);
  });
  if (engine.micDeviceId) micDevices.value = engine.micDeviceId;
  micDeviceCount = inputs.length;
  refreshUI(true);
}

// ---- UI state -----------------------------------------------------------
function refreshUI(force = false) {
  const kind = engine.kind;
  const key = `${kind}|${engine.label}|${engine.canPause}|${engine.playing}|${engine.running}|${micDeviceCount}`;
  if (!force && key === lastUiKey) return;
  lastUiKey = key;
  for (const b of sourceButtons) b.classList.toggle('active', b.dataset.source === kind);
  styleSelect.value = kind === 'style' ? engine.current.style : '';
  styleSelect.classList.toggle('active', kind === 'style');
  playBtn.disabled = !engine.canPause;
  playIcon.innerHTML = engine.canPause && engine.playing ? '&#10074;&#10074;' : '&#9654;';
  seek.disabled = kind !== 'file';
  micDevices.hidden = !(kind === 'mic' && micDeviceCount > 1);
  let status;
  if (!kind) status = 'No audio source';
  else if (!engine.running) status = 'Audio is waiting for the browser. Click anywhere to start it.';
  else status = engine.label;
  if (status !== lastStatus) {
    statusEl.textContent = status;
    lastStatus = status;
  }
}

function fmt(s) {
  s = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function updateTransport() {
  const dur = engine.duration;
  const pos = engine.position;
  const tt = fmt(pos);
  const dd = fmt(dur);
  if (tt !== lastTimeText) { timeEl.textContent = tt; lastTimeText = tt; }
  if (dd !== lastDurText) { durationEl.textContent = dd; lastDurText = dd; }
  if (!seeking) seek.value = dur ? String(Math.round((pos / dur) * 1000)) : '0';
}

// ---- full screen --------------------------------------------------------
function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function toggleFullscreen() {
  if (isFullscreen()) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) exit.call(document);
    return;
  }
  const req = app.requestFullscreen || app.webkitRequestFullscreen;
  if (!req) { showToast('Full screen is not available in this browser.', true); return; }
  const p = req.call(app);
  if (p && p.catch) p.catch(() => showToast('Full screen was refused by the browser.', true));
}

function onFullscreenChange() {
  app.classList.toggle('fullscreen', isFullscreen());
  bumpIdle();
  resize();
}

function bumpIdle() {
  app.classList.remove('idle');
  clearTimeout(idleTimer);
  const tvWeb = TV_PLATFORM === 'web';       // a remote's pointer is slow: give it longer
  if (isFullscreen() || tvWeb) idleTimer = setTimeout(() => app.classList.add('idle'), tvWeb ? 6000 : 2500);
}

// ---- drag and drop ------------------------------------------------------
const AUDIO_EXT = /\.(mp3|m4a|wav|ogg|oga|flac|aac|opus|webm|aiff?)$/i;
let dragDepth = 0;
const hasFiles = (e) => !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');

window.addEventListener('dragenter', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth++;
  app.classList.add('dragging');
});
window.addEventListener('dragover', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});
window.addEventListener('dragleave', (e) => {
  if (!hasFiles(e)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) app.classList.remove('dragging');
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  app.classList.remove('dragging');
  const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
  const file = files.find((f) => f.type.startsWith('audio/') || AUDIO_EXT.test(f.name));
  if (file) selectSource('file', file);
  else if (files.length) showToast('That does not look like an audio file.', true);
});

// ---- wiring -------------------------------------------------------------
// Music styles: chips on the start screen and a picker in the controls.
styleSelect.appendChild(new Option('Music style\u2026', ''));
for (const [key, st] of Object.entries(STYLES)) {
  if (key === 'demo') continue;
  styleSelect.appendChild(new Option(`${st.label} \u00b7 ${st.bpm}`, key));
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.source = 'style';
  b.dataset.style = key;
  b.textContent = st.label;
  styleChips.appendChild(b);
}
styleSelect.addEventListener('change', () => { if (styleSelect.value) selectSource('style', styleSelect.value); });

document.querySelectorAll('[data-source]').forEach((b) => {
  b.addEventListener('click', () => selectSource(b.dataset.source, b.dataset.style));
});
fileInput.addEventListener('change', () => {
  const file = fileInput.files && fileInput.files[0];
  fileInput.value = '';
  if (file) selectSource('file', file);
});
micDevices.addEventListener('change', () => selectSource('mic', micDevices.value));
if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', () => {
    if (engine.kind === 'mic') refreshMicDevices();
  });
}

playBtn.addEventListener('click', () => { engine.togglePlay(); refreshUI(); });
stopBtn.addEventListener('click', () => { engine.stop(); overlay.hidden = false; refreshUI(); });
seek.addEventListener('input', () => { seeking = true; engine.seek(Number(seek.value) / 1000); });
seek.addEventListener('change', () => { engine.seek(Number(seek.value) / 1000); seeking = false; });
volume.addEventListener('input', () => {
  engine.setVolume(Number(volume.value) / 100);
  store.set('volume', volume.value);
});

vizSelect.addEventListener('change', () => setViz(Number(vizSelect.value)));
$('#prevViz').addEventListener('click', () => nextViz(-1));
$('#nextViz').addEventListener('click', () => nextViz(1));
autoCycle.addEventListener('change', () => {
  store.set('autoCycle', autoCycle.checked ? '1' : '0');
  cycleTimer = 0;
  if (autoCycle.checked) randomViz();
  showToast(autoCycle.checked ? `Random on: a new visualization about every 20 s, in time with the music` : 'Random off');
});

fullscreenBtn.addEventListener('click', toggleFullscreen);
canvas.addEventListener('dblclick', toggleFullscreen);
document.addEventListener('fullscreenchange', onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);
app.addEventListener('mousemove', bumpIdle);
app.addEventListener('pointerdown', bumpIdle);

// Any gesture is a chance to get a suspended AudioContext running.
document.addEventListener('pointerdown', () => engine.resume(), { capture: true });
document.addEventListener('keydown', () => engine.resume(), { capture: true });
// Keep focus off buttons so Space / arrows act as shortcuts, not re-clicks.
document.addEventListener('click', (e) => {
  const btn = e.target && e.target.closest ? e.target.closest('button') : null;
  if (btn) btn.blur();
});

window.addEventListener('keydown', (e) => {
  const el = e.target;
  const tag = el && el.tagName ? el.tagName : '';
  if (tag === 'SELECT' || tag === 'TEXTAREA' || (tag === 'INPUT' && el.type !== 'checkbox' && el.type !== 'range')) return;
  if (tag === 'INPUT' && el.type === 'range' && e.key.startsWith('Arrow')) return;
  switch (e.key) {
    case ' ':
      e.preventDefault();
      if (engine.canPause) { engine.togglePlay(); refreshUI(); }
      break;
    case 'f': case 'F':
      toggleFullscreen();
      break;
    case 'ArrowRight':
      nextViz(1);
      break;
    case 'ArrowLeft':
      nextViz(-1);
      break;
    case 't': case 'T':
      retroLook.checked = !retroLook.checked;
      retroLook.dispatchEvent(new Event('change'));
      break;
    case 'n': case 'N':
      if (viz && typeof viz.skip === 'function') viz.skip();
      break;
    case 'r': case 'R':
      autoCycle.checked = !autoCycle.checked;
      autoCycle.dispatchEvent(new Event('change'));
      break;
    default:
      break;
  }
});

engine.on('source', (src) => {
  refreshUI();
  if (!src) return;
  for (const v of vizInstances) if (v.warm) v.warm();
  showNowPlaying(src.kind === 'file' ? src.label.replace(/\.[a-z0-9]{2,5}$/i, '') : src.label);
  if (src.kind === 'file' && autoCycle.checked) randomViz();
});
engine.on('play', () => refreshUI());
engine.on('state', () => refreshUI());
engine.on('warning', (msg) => showToast(msg));
engine.on('error', (err) => reportError(err));
engine.on('ended', ({ reason }) => {
  showToast(reason);
  if (!engine.active) overlay.hidden = false;
  refreshUI();
});

// ---- main loop ----------------------------------------------------------
function loop(now) {
  requestAnimationFrame(loop);
  if (!lastNow) lastNow = now;
  let raw = (now - lastNow) / 1000;
  lastNow = now;
  // Long gaps (background tab, stalls) restart smoothly instead of jumping.
  if (raw > 0.25) raw = smoothDt;
  raw = Math.min(0.05, Math.max(0.001, raw));
  // rAF timestamps wobble by a millisecond or two; averaging removes the
  // speed jitter that wobble causes, while still following real rate changes.
  smoothDt += (raw - smoothDt) * 0.1;
  const dt = smoothDt;
  elapsed += dt;
  const frame = engine.update(elapsed);

  // Beat pump: the whole picture brightens and punches in a little on every
  // beat, so every visualization is visibly in time with the music.
  const clock = frame.tempoConfident && frame.active ? Math.exp(-frame.phase * 7) * Math.min(1, frame.softLevel * 1.5) * 0.6 : 0;
  pump = Math.max(frame.beatStrength, clock, pump * Math.exp(-dt * 8));
  const zoom = 1 + pump * 0.03;

  if (viz && cssW > 0) {
    // Only object-style graphics (screensavers, memes) get the 2000s look.
    if (retroLook.checked && viz.constructor.retro) {
      viz.draw(lowCtx, frame, dt, elapsed);
      retroPost(1 + pump * 0.25);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'low';     // plain bilinear, like an old video card
      ctx.translate(cssW / 2, cssH / 2);
      ctx.scale(zoom, zoom);
      ctx.drawImage(lowCanvas, -cssW / 2, -cssH / 2, cssW, cssH);
      // analogue glow: bright areas bleed softly into their surroundings
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.12 + pump * 0.08;
      ctx.filter = `blur(${Math.round(cssW / 240)}px)`;
      ctx.drawImage(lowCanvas, -cssW / 2, -cssH / 2, cssW, cssH);
      ctx.restore();
      scanlines(ctx, cssW, cssH);
    } else {
      ctx.save();
      ctx.translate(cssW / 2, cssH / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-cssW / 2, -cssH / 2);
      viz.draw(ctx, frame, dt, elapsed);
      ctx.restore();
    }
  }
  if (autoCycle.checked && engine.active) {
    cycleTimer += dt;
    // Change on the music, not the clock: at the first beat of a 4-bar phrase
    // once this pick's time is up (any beat if the tempo is unclear), early on a
    // drop (the beat slamming back in after a quieter breakdown of 2 s or more),
    // and never stuck past +8 s.
    longLevel += (frame.level - longLevel) * Math.min(1, dt / 8);
    if (frame.softLevel < longLevel * 0.55) quietTime += dt;
    else if (frame.softLevel > longLevel * 0.8) quietTime = Math.max(0, quietTime - dt * 0.25);
    const due = cycleTimer >= cycleTarget;
    const phraseStart = frame.tick && frame.tempoConfident && frame.beatCount % 16 === 0;
    const looseBeat = !frame.tempoConfident && frame.beat;
    const drop = quietTime >= 2 && cycleTimer >= CYCLE_MIN * 0.7 && frame.beat && frame.beatStrength > 0.6 && frame.softLevel > longLevel * 0.9;
    if (drop) quietTime = 0;
    if ((due && (phraseStart || looseBeat)) || drop || cycleTimer >= cycleTarget + 8) randomViz();
  }
  updateTransport();
  refreshUI();
}


// ---- TV mode ------------------------------------------------------------
// The LG webOS, Samsung Tizen and Android TV builds set window.TV_PLATFORM;
// TV browsers are detected by user agent; ?tv=1 forces it for testing.
const TV_UA = /Web0S|webOS|Tizen|SMART-TV|SmartTV|Android TV|GoogleTV|BRAVIA|AFT[A-Z]|CrKey|HbbTV/i;
const TV_PLATFORM = window.TV_PLATFORM
  || (new URLSearchParams(location.search).get('tv') === '1' || TV_UA.test(navigator.userAgent) ? 'web' : '');
const KEY = {
  BACK: [8, 27, 461, 10009], OK: [13], LEFT: [37], UP: [38], RIGHT: [39], DOWN: [40],
  PLAYPAUSE: [179, 10252, 415, 19], NEXT: [417, 176, 228, 34], PREV: [412, 177, 227, 33],
  RED: [403], GREEN: [404], YELLOW: [405], BLUE: [406],
};
const keyIs = (e, name) => KEY[name].includes(e.keyCode);
const STYLE_KEYS = Object.keys(STYLES).filter((k) => k !== 'demo');

function tvExit() {
  try {
    if (window.tizen) { window.tizen.application.getCurrentApplication().exit(); return true; }
  } catch (_) { /* not on Tizen */ }
  if (TV_PLATFORM === 'webos') { window.close(); return true; }
  return false;
}

// Moves focus between the start screen's buttons with the remote's arrows.
function tvMoveFocus(dx, dy) {
  const items = Array.from(overlay.querySelectorAll('button')).filter((b) => b.offsetParent);
  if (!items.length) return;
  const cur = items.indexOf(document.activeElement);
  if (cur < 0) { items[0].focus(); return; }
  const a = items[cur].getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bestScore = Infinity;
  for (const b of items) {
    if (b === items[cur]) continue;
    const r = b.getBoundingClientRect();
    const bx = r.left + r.width / 2, by = r.top + r.height / 2;
    const along = (bx - ax) * dx + (by - ay) * dy;          // distance in the pressed direction
    if (along <= 4) continue;
    const across = Math.abs((bx - ax) * dy) + Math.abs((by - ay) * dx);
    const score = along + across * 2;
    if (score < bestScore) { bestScore = score; best = b; }
  }
  if (best) best.focus();
}

function tvShowStart() {
  overlay.hidden = false;
  // focus what is playing now, so OK goes straight back to it
  const kind = engine.kind;
  const current = kind === 'style'
    ? overlay.querySelector(`[data-style="${engine.current.style}"]`)
    : kind && overlay.querySelector(`.sources [data-source="${kind}"]`);
  const first = current || overlay.querySelector('button:not([hidden])');
  if (first) first.focus();
}

// Back: visuals -> menu -> exit. Returns true when the key was used; the
// Android wrapper calls it and closes the app when it returns false.
function tvBack() {
  if (overlay.hidden) { tvShowStart(); return true; }
  return tvExit();
}

function tvStepStyle(step) {
  const cur = engine.kind === 'style' ? STYLE_KEYS.indexOf(engine.current.style) : -1;
  const next = STYLE_KEYS[((cur + step) % STYLE_KEYS.length + STYLE_KEYS.length) % STYLE_KEYS.length];
  selectSource('style', next);
}

function tvKey(e) {
  // a menu or slider in the control bar keeps its own keys
  const el = e.target;
  if (el && (el.tagName === 'SELECT' || el.tagName === 'INPUT') && el.closest && el.closest('.controls')) return;
  if (keyIs(e, 'BACK')) { if (!tvBack()) return; }
  else if (!overlay.hidden) {
    if (keyIs(e, 'LEFT')) tvMoveFocus(-1, 0);
    else if (keyIs(e, 'RIGHT')) tvMoveFocus(1, 0);
    else if (keyIs(e, 'UP')) tvMoveFocus(0, -1);
    else if (keyIs(e, 'DOWN')) tvMoveFocus(0, 1);
    else if (keyIs(e, 'OK')) {
      const b = document.activeElement;
      if (b && b.tagName === 'BUTTON' && overlay.contains(b)) b.click(); else tvMoveFocus(0, 1);
    } else return;
  } else if (keyIs(e, 'LEFT') || keyIs(e, 'PREV')) nextViz(-1);
  else if (keyIs(e, 'RIGHT') || keyIs(e, 'NEXT')) nextViz(1);
  else if (keyIs(e, 'UP')) tvStepStyle(1);
  else if (keyIs(e, 'DOWN')) tvStepStyle(-1);
  else if (keyIs(e, 'OK') || keyIs(e, 'PLAYPAUSE')) {
    if (engine.canPause) { engine.togglePlay(); refreshUI(); showToast(engine.playing ? 'Playing' : 'Paused'); }
  } else if (keyIs(e, 'RED')) { autoCycle.checked = !autoCycle.checked; autoCycle.dispatchEvent(new Event('change')); }
  else if (keyIs(e, 'GREEN')) { retroLook.checked = !retroLook.checked; retroLook.dispatchEvent(new Event('change')); }
  else if (keyIs(e, 'YELLOW')) { if (viz && typeof viz.skip === 'function') viz.skip(); }
  else if (keyIs(e, 'BLUE')) tvShowStart();
  else return;
  e.preventDefault();
  e.stopImmediatePropagation();
}

function initTV() {
  if (!TV_PLATFORM) return;
  document.documentElement.classList.add('tv');
  app.classList.add('tv');
  // TVs cannot share a tab; files and the mic only work in the Android app
  // (or a TV browser that supports them).
  const canMic = TV_PLATFORM === 'android' || (TV_PLATFORM === 'web' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const canFile = TV_PLATFORM === 'android' || TV_PLATFORM === 'web';
  document.querySelectorAll('[data-source="display"]').forEach((b) => { b.hidden = true; });
  if (!canMic) document.querySelectorAll('[data-source="mic"]').forEach((b) => { b.hidden = true; });
  if (!canFile) document.querySelectorAll('[data-source="file"]').forEach((b) => { b.hidden = true; });
  const tvText = { mic: 'A USB or Bluetooth mic, or the remote\'s mic', file: 'Music from USB storage or a file manager' };
  for (const [src, text] of Object.entries(tvText)) {
    const span = overlay.querySelector(`.sources [data-source="${src}"] span`);
    if (span) span.textContent = text;
  }
  const help = document.createElement('p');
  help.className = 'tv-help';
  help.textContent = TV_PLATFORM === 'web'
    ? 'Move the pointer to bring up the controls. If your remote sends arrow keys to the page: \u25C0 \u25B6 change visualization \u00b7 \u25B2 \u25BC change music style \u00b7 OK pause.'
    : 'Remote: ◀ ▶ change visualization · ▲ ▼ change music style · OK pause · Back menu, Back again exits · Red random · Green 2000s look · Yellow next Milkdrop preset';
  overlay.querySelector('.panel').appendChild(help);
  try {
    // Tizen only sends the media and colour keys once they are registered.
    for (const k of ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaFastForward', 'MediaRewind', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue']) {
      window.tizen.tvinputdevice.registerKey(k);
    }
  } catch (_) { /* not on Tizen */ }
  if (TV_PLATFORM === 'web') {
    // A TV browser: keep the control bar within the pointer's reach, at a size
    // that reads from the sofa.
    app.classList.add('tv-web');
    const controls = document.querySelector('.controls');
    const fit = () => { controls.style.zoom = Math.max(1, Math.min(window.innerWidth / 1250, window.innerHeight / 620)).toFixed(2); };
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('keydown', bumpIdle, true);
    bumpIdle();
  }
  window.addEventListener('keydown', tvKey, true);
  resize();                                  // the layout just changed
  window.__tvBack = tvBack;
  window.__tvKey = (code) => tvKey({ keyCode: code, preventDefault() {}, stopImmediatePropagation() {} });
  if (!engine.active) tvShowStart();
}

// ---- boot ---------------------------------------------------------------
function params0() { return new URLSearchParams(location.search); }

function boot() {
  const groups = new Map();
  vizInstances.forEach((v) => { v.engine = engine; });
  const startText = params0().get('text');
  if (startText) vizText.value = startText.slice(0, 24);
  vizInstances.forEach((v) => { if (v.constructor.textOption && startText && v.setText) v.setText(startText); });
  vizText.addEventListener('input', () => {
    if (viz && viz.setText) viz.setText(vizText.value);
    updateShareUrl();
  });
  vizInstances.forEach((v, i) => {
    const name = v.constructor.group || 'Other';
    if (!groups.has(name)) {
      const g = document.createElement('optgroup');
      g.label = name;
      groups.set(name, g);
      vizSelect.appendChild(g);
    }
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = v.constructor.title;
    groups.get(name).appendChild(o);
  });

  resize();
  // (older engines cannot watch the stage for size changes: look now and then;
  // resize() does nothing when the size is the same)
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  else setInterval(resize, 500);
  window.addEventListener('resize', resize);

  const params = new URLSearchParams(location.search);
  const wanted = params.get('viz') || store.get('viz');
  let idx = vizInstances.findIndex((v) => v.constructor.id === wanted);
  if (idx < 0) idx = 0;
  setViz(idx, { announce: false });

  const storedVol = store.get('volume');
  if (storedVol !== null && Number.isFinite(Number(storedVol))) {
    volume.value = String(Math.max(0, Math.min(100, Number(storedVol))));
  }
  engine.setVolume(Number(volume.value) / 100);
  autoCycle.checked = store.get('autoCycle') === '1';
  // Resume the shuffle round across reloads, so nothing repeats until every
  // visualization has had its turn.
  const ids = (store.get('shuffle') || '').split(',');
  shuffleBag = ids.map((id) => vizInstances.findIndex((v) => v.constructor.id === id)).filter((i) => i >= 0);
  retroLook.checked = store.get('retro') !== '0';
  retroLook.addEventListener('change', () => {
    store.set('retro', retroLook.checked ? '1' : '0');
    showToast(retroLook.checked ? '2000s look on' : '2000s look off: full HD');
  });

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    hint.textContent = window.isSecureContext
      ? 'This browser cannot capture audio. File playback and the demo still work.'
      : 'Microphone and tab capture need http://localhost or https. File playback and the demo still work.';
  }

  initTV();
  refreshUI(true);
  requestAnimationFrame(loop);
  // fetch heavy extras (the Milkdrop library) once the page has settled
  setTimeout(() => { for (const v of vizInstances) if (v.preload) v.preload(); }, 1500);

  const auto = params.get('autostart');
  if (auto) selectSource(auto);
}

// Exposed for debugging and automated checks.
window.__visualizer = { engine, setViz, selectSource, get frame() { return engine.frame; }, get viz() { return viz; } };

boot();
