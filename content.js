const api = globalThis.browser ?? globalThis.chrome;

let glow = null;
let ctx = null;
let src = null;
let srcCtx = null;
let running = false;
let queued = false;
let drawing = false;
let pending = false;
let frameToken = 0;
let vfcId = 0;
let nextDrawAt = 0;
let settings = { ...AMBIENT_DEFAULTS };
let pinned = null;
let panelOpen = false;
let currentPad = 0;
let lastKey = "";
let descTimer = 0;
let boundVideo = null;

function ensureGlow() {
  if (glow) return;
  glow = document.createElement("canvas");
  glow.id = "vibe-ambient";
  glow.style.cssText = "pointer-events:none;display:block;";
  ctx = glow.getContext("2d", { alpha: true });
  src = document.createElement("canvas");
  srcCtx = src.getContext("2d", { alpha: false });
}

function videoEl() {
  return document.querySelector("video.html5-main-video");
}

function onWatch() {
  return location.hostname === "www.youtube.com" && location.pathname === "/watch";
}

function viewMode(player) {
  if (document.fullscreenElement) return "full";
  const flex = document.querySelector("ytd-watch-flexy");
  if (flex && flex.hasAttribute("theater")) return "theater";
  if (player.classList.contains("ytp-big-mode")) return "theater";
  return "small";
}

function viewAllowed(player) {
  const modeName = viewMode(player);
  const value = Number(settings.enableInViews);
  if (value === 0) return true;
  if (value === 1) return modeName === "small";
  if (value === 2) return modeName === "small" || modeName === "theater";
  if (value === 3) return modeName === "theater";
  if (value === 4) return modeName === "theater" || modeName === "full";
  return modeName === "full";
}

function bufferSize(video) {
  const sw = video.videoWidth || 16;
  const sh = video.videoHeight || 9;
  const resolution = Number(settings.resolution) || 100;
  const relativeBlur = (resolution / 100) * Number(settings.blur2 || 0);
  let pMin =
    (resolution / 100) *
    (relativeBlur >= 20 ? 128 : relativeBlur >= 10 ? 192 : 256);
  if (Number(settings.spread) > 200) pMin /= 2;
  const pScale = Math.min(
    0.5,
    Math.max(pMin / sw, pMin / sh),
    Math.min(1024 / sw, 1024 / sh)
  );
  return [Math.max(2, Math.ceil(sw * pScale)), Math.max(2, Math.ceil(sh * pScale))];
}

function fadeStops(pad, size) {
  const band = size > 0 ? (pad / size) * 100 : 0;
  const start = Number(settings.spreadFadeStart) / 100;
  const curve = Number(settings.spreadFadeCurve) / 100;
  const opaqueAt = Math.min(50, Math.max(0, band * (1 - start)));
  const fadeFrom = Math.min(opaqueAt, Math.max(0, opaqueAt - band * curve));
  return { fadeFrom, opaqueAt };
}

function fadeMask(pad, width, height) {
  const x = fadeStops(pad, width);
  const y = fadeStops(pad, height);
  const across = (stops) =>
    `linear-gradient(to right, transparent ${stops.fadeFrom}%, #000 ${stops.opaqueAt}%, #000 ${100 - stops.opaqueAt}%, transparent ${100 - stops.fadeFrom}%)`;
  const down = (stops) =>
    `linear-gradient(to bottom, transparent ${stops.fadeFrom}%, #000 ${stops.opaqueAt}%, #000 ${100 - stops.opaqueAt}%, transparent ${100 - stops.fadeFrom}%)`;
  return `${across(x)}, ${down(y)}`;
}

function applyLook(pad, width, height) {
  if (!glow) return;
  const vibrance = Number(settings.vibrance) / 100;
  const saturation = (Number(settings.saturation) / 100) * (0.5 + vibrance * 0.5);
  const playerH = Math.max(1, height - pad * 2);
  const blurPx = Math.round(playerH * 0.0025 * Number(settings.blur2 || 0));
  glow.style.filter = [
    blurPx > 0 ? `blur(${blurPx}px)` : "",
    Number(settings.brightness) !== 100 ? `brightness(${settings.brightness}%)` : "",
    Number(settings.contrast) !== 100 ? `contrast(${settings.contrast}%)` : "",
    saturation !== 1 ? `saturate(${saturation})` : "",
  ].filter(Boolean).join(" ") || "none";
  const mask = fadeMask(pad, width, height);
  glow.style.maskImage = mask;
  glow.style.webkitMaskImage = mask;
  glow.style.maskComposite = "intersect";
  glow.style.webkitMaskComposite = "source-in";
  const inset = (on, edge) => (on ? "0%" : edge);
  glow.style.clipPath = `inset(${inset(settings.directionTopEnabled, "42%")} ${inset(settings.directionRightEnabled, "42%")} ${inset(settings.directionBottomEnabled, "42%")} ${inset(settings.directionLeftEnabled, "42%")})`;
}


function descriptionColor() {
  const value = Number(settings.surroundingContentFillOpacity);
  const fill = Number.isFinite(value) ? (value + 100) / 200 : 0.55;
  const alpha = Math.abs(fill - 0.5) * 2;
  const channel = Math.round(Math.max(0, Math.min(255, 255 * (-99 + fill * 200))));
  return `rgba(${channel}, ${channel}, ${channel}, ${alpha})`;
}

function clearBox(el) {
  if (!el?.dataset.vibeBox) return;
  el.style.removeProperty("background");
  el.style.removeProperty("background-color");
  delete el.dataset.vibeBox;
}

function applyDescription(on) {
  for (const el of document.querySelectorAll("#description-inline-expander[data-vibe-box]")) clearBox(el);
  const card = document.querySelector("#primary #description.ytd-watch-metadata");
  const dark = document.documentElement.matches("[dark]");
  if (!card || !on || !dark) {
    clearBox(card);
    return;
  }
  const color = descriptionColor();
  card.dataset.vibeBox = "1";
  card.style.setProperty("background", color, "important");
  card.style.setProperty("background-color", color, "important");
}

function applyDescriptionLater() {
  applyDescription(!!settings.enabled);
  requestAnimationFrame(() => applyDescription(!!settings.enabled));
  clearTimeout(descTimer);
  descTimer = setTimeout(() => applyDescription(!!settings.enabled), 80);
}

function place(player) {
  const parent = player.parentElement;
  if (!parent) return;
  if (glow.parentElement !== parent) parent.insertBefore(glow, player);
  const r = player.getBoundingClientRect();
  const pad = (r.width * Number(settings.spread)) / 100 + Number(settings.edge);
  currentPad = pad;
  const scroll = window.scrollY;
  if (!settings.fixedPosition || !pinned || pinned.scroll === scroll) {
    pinned = {
      left: r.left - pad,
      top: r.top - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
      scroll,
    };
  }
  Object.assign(glow.style, {
    position: "fixed",
    left: `${pinned.left}px`,
    top: `${pinned.top}px`,
    width: `${pinned.width}px`,
    height: `${pinned.height}px`,
    zIndex: "auto",
    display: settings.enabled && viewAllowed(player) ? "block" : "none",
  });
  player.style.zIndex = "1";
  applyLook(pad, pinned.width, pinned.height);
}

function frameKey(video, w, h) {
  return [
    video.currentTime,
    w,
    h,
    pinned?.width,
    pinned?.height,
    settings.blur2,
    settings.resolution,
    settings.spread,
    settings.edge,
    settings.brightness,
    settings.contrast,
    settings.saturation,
    settings.vibrance,
  ].join("|");
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("capture"));
    image.src = url;
  });
}

async function captureEdge(player) {
  const url = await api.runtime.sendMessage({ type: "capture" });
  if (typeof url !== "string") return false;
  const image = await loadImage(url);
  const r = player.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  srcCtx.drawImage(
    image,
    Math.max(0, r.left * dpr),
    Math.max(0, r.top * dpr),
    Math.max(1, r.width * dpr),
    Math.max(1, r.height * dpr),
    0,
    0,
    src.width,
    src.height
  );
  return true;
}

async function drawVideo(video, player) {
  const sw = video.videoWidth;
  const sh = video.videoHeight;
  if (!sw || !sh) return;
  const [w, h] = bufferSize(video);
  if (src.width !== w || src.height !== h) {
    src.width = w;
    src.height = h;
  }
  let fromVideo = false;
  try {
    srcCtx.drawImage(video, 0, 0, sw, sh, 0, 0, w, h);
    fromVideo = true;
  } catch {
    fromVideo = false;
  }
  if (!fromVideo) {
    try {
      if (!(await captureEdge(player))) return;
    } catch {
      return;
    }
  }
  const viewW = Math.max(1, pinned?.width || w);
  const viewH = Math.max(1, pinned?.height || h);
  const playerW = Math.max(1, viewW - currentPad * 2);
  const playerH = Math.max(1, viewH - currentPad * 2);
  const glowW = Math.max(2, Math.round(w * viewW / playerW));
  const glowH = Math.max(2, Math.round(h * viewH / playerH));
  if (glow.width !== glowW || glow.height !== glowH) {
    glow.width = glowW;
    glow.height = glowH;
  }
  paintContinue();
}

function paintContinue() {
  const sw = src.width;
  const sh = src.height;
  const w = glow.width;
  const h = glow.height;
  const viewW = Math.max(1, pinned?.width || w);
  const viewH = Math.max(1, pinned?.height || h);
  const pad = Math.max(0, currentPad);
  const dx = (pad / viewW) * w;
  const dy = (pad / viewH) * h;
  const dw = Math.max(1, w - dx * 2);
  const dh = Math.max(1, h - dy * 2);
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  if (dx > 0.5) {
    ctx.drawImage(src, 0, 0, 1, sh, 0, dy, dx, dh);
    ctx.drawImage(src, sw - 1, 0, 1, sh, w - dx, dy, dx, dh);
  }
  if (dy > 0.5) {
    ctx.drawImage(src, 0, 0, sw, 1, dx, 0, dw, dy);
    ctx.drawImage(src, 0, sh - 1, sw, 1, dx, h - dy, dw, dy);
  }
  if (dx > 0.5 && dy > 0.5) {
    ctx.drawImage(src, 0, 0, 1, 1, 0, 0, dx, dy);
    ctx.drawImage(src, sw - 1, 0, 1, 1, w - dx, 0, dx, dy);
    ctx.drawImage(src, 0, sh - 1, 1, 1, 0, h - dy, dx, dy);
    ctx.drawImage(src, sw - 1, sh - 1, 1, 1, w - dx, h - dy, dx, dy);
  }
}

function bindVideo(video) {
  if (!video || boundVideo === video) return;
  boundVideo = video;
  video.addEventListener("pause", () => {
    frameToken += 1;
    queued = false;
    if (vfcId && typeof video.cancelVideoFrameCallback === "function") {
      video.cancelVideoFrameCallback(vfcId);
    }
    vfcId = 0;
    lastKey = "";
    tick();
  });
  video.addEventListener("play", () => {
    lastKey = "";
    queued = false;
    nextDrawAt = 0;
    schedule(video);
  });
  video.addEventListener("seeked", () => {
    lastKey = "";
    queued = false;
    nextDrawAt = 0;
    tick();
  });
}

function limitMs() {
  const fps = Math.min(60, Math.max(1, Number(settings.framerateLimit) || 60));
  return 1000 / fps;
}

function schedule(video) {
  if (!running || queued) return;
  queued = true;
  const token = ++frameToken;
  const fire = () => {
    if (token !== frameToken) return;
    const wait = Math.max(0, nextDrawAt - performance.now());
    if (wait > 0) {
      setTimeout(() => {
        if (token !== frameToken) return;
        queued = false;
        tick();
      }, wait);
      return;
    }
    queued = false;
    tick();
  };
  if (video && !video.paused && typeof video.requestVideoFrameCallback === "function") {
    vfcId = video.requestVideoFrameCallback(() => {
      if (token !== frameToken) return;
      vfcId = 0;
      fire();
    });
    return;
  }
  setTimeout(fire, Math.max(limitMs(), nextDrawAt - performance.now()));
}

async function tick() {
  if (!running) return;
  if (drawing) {
    pending = true;
    return;
  }
  const video = videoEl();
  const player = document.getElementById("movie_player");
  ensureButton();
  bindVideo(video);
  if (!onWatch() || !video || !player || video.readyState < 2 || !settings.enabled || !viewAllowed(player)) {
    if (!settings.enabled) applyDescription(false);
    if (glow) glow.style.display = "none";
    if (video && !video.paused) schedule(video);
    return;
  }
  ensureGlow();
  place(player);
  const [w, h] = bufferSize(video);
  const key = frameKey(video, w, h);
  if (key !== lastKey) {
    drawing = true;
    try {
      await drawVideo(video, player);
      lastKey = key;
      nextDrawAt = performance.now() + limitMs();
    } catch {
      // Кадр ролика недоступен, второй попытки в этом кадре нет.
    } finally {
      drawing = false;
    }
  }
  applyDescriptionLater();
  if (pending) {
    pending = false;
    tick();
    return;
  }
  if (!video.paused) schedule(video);
}

function start() {
  frameToken += 1;
  queued = false;
  drawing = false;
  pinned = null;
  lastKey = "";
  nextDrawAt = 0;
  running = true;
  tick();
}

function ensureButton() {
  const controls = document.querySelector(".ytp-right-controls");
  if (!controls || document.getElementById("vibe-ambient-btn")) return;
  const btn = document.createElement("button");
  btn.id = "vibe-ambient-btn";
  btn.type = "button";
  btn.className = "ytp-button";
  btn.setAttribute("aria-label", "Ambient light");
  btn.textContent = "AL";
  btn.style.cssText = "width:48px;min-width:48px;flex:0 0 48px;padding:0;margin:0 0 0 8px;display:inline-flex;align-items:center;justify-content:center;position:relative;overflow:hidden;font:600 12px -apple-system,sans-serif;";
  let tip = null;
  const hideTip = () => {
    tip?.remove();
    tip = null;
  };
  btn.addEventListener("mouseenter", () => {
    hideTip();
    tip = document.createElement("div");
    tip.textContent = "Ambient light";
    tip.style.cssText = "position:fixed;z-index:10001;padding:4px 8px;background:rgba(28,28,28,.94);color:#fff;border-radius:4px;font:12px -apple-system,sans-serif;white-space:nowrap;pointer-events:none;";
    document.documentElement.append(tip);
    const r = btn.getBoundingClientRect();
    const w = tip.offsetWidth;
    tip.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8)) + "px";
    tip.style.top = Math.max(8, r.top - tip.offsetHeight - 8) + "px";
  });
  btn.addEventListener("mouseleave", hideTip);
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    hideTip();
    togglePanel();
  });
  controls.append(btn);
}

function invalidate() {
  lastKey = "";
  pinned = null;
  nextDrawAt = 0;
}

function togglePanel() {
  let panel = document.getElementById("vibe-ambient-panel");
  if (panel) {
    panel.remove();
    panelOpen = false;
    return;
  }
  panel = document.createElement("div");
  panel.id = "vibe-ambient-panel";
  panel.style.cssText = [
    "position:fixed",
    "top:64px",
    "right:16px",
    "z-index:10000",
    "width:300px",
    "max-height:70vh",
    "overflow:auto",
    "padding:12px",
    "background:#0f0f0f",
    "color:#f1f1f1",
    "border-radius:12px",
    "font:13px/1.3 -apple-system,sans-serif",
  ].join(";");
  const style = document.createElement("style");
  style.textContent = "#vibe-ambient-panel h2{margin:14px 0 6px;font-size:12px;color:#aaa;text-transform:uppercase;white-space:normal}#vibe-ambient-panel .row{display:flex;align-items:center;gap:8px;margin:6px 0}#vibe-ambient-panel .row span{flex:1;min-width:7.5em;white-space:normal}#vibe-ambient-panel input[type=range]{width:100px;flex:0 0 100px}#vibe-ambient-panel input[type=checkbox]{flex:0 0 auto;margin-left:auto}";
  panel.append(style);
  const mount = document.createElement("div");
  panel.append(mount);
  document.documentElement.append(panel);
  panelOpen = true;
  const draw = () => renderAmbientSettings(mount, settings, (name, value) => {
    settings = { ...settings, [name]: value };
    invalidate();
    api.storage.local.set({ ambientSettings: settings });
    if (name === "advancedSettings") draw();
    tick();
  });
  draw();
}

function loadSettings() {
  const stored = api.storage.local.get("ambientSettings");
  Promise.resolve(stored).then((data) => {
    settings = { ...AMBIENT_DEFAULTS, ...(data && data.ambientSettings) };
    invalidate();
  });
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.ambientSettings) return;
    settings = { ...AMBIENT_DEFAULTS, ...changes.ambientSettings.newValue };
    invalidate();
    tick();
  });
}

loadSettings();
document.addEventListener("yt-navigate-finish", start);
start();
