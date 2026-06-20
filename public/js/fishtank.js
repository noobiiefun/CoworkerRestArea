// public/js/fishtank.js
// Fish Tank — Mini Game Akuarium Bersama
// FIX: canvas gambar sekarang transparan murni (PNG), panduan ikan
// dipindah ke overlay HTML terpisah supaya tidak ikut tersimpan
// sebagai bagian dari gambar ikan permanen.

(function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────────────────────
  let socket = null;
  let meUser = null;
  let fishes = [];
  let foodParticles = [];
  let bubbles = [];
  let plants = [];
  let animId = null;
  let canvas = null;
  let ctx = null;
  let _container = null;

  let drawCanvas = null;
  let drawCtx = null;
  let isDrawing = false;
  let lastX = 0, lastY = 0;
  let drawColor = '#e05555';
  let drawSize = 6;
  let drawHistory = [];
  let isEraserActive = false;

  const FISH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

  // ── HTML ──────────────────────────────────────────────────────────────────
  function renderHTML() {
    return `
<div class="ft-root" id="ft-root">

  <div class="ft-tank-wrap">
    <canvas class="ft-tank-canvas" id="ft-tank-canvas"></canvas>
    <div class="ft-fish-tooltip" id="ft-fish-tooltip" style="display:none">
      <span id="ft-tooltip-name"></span>
      <span id="ft-tooltip-age"></span>
    </div>
  </div>

  <div class="ft-sidebar">
    <div class="ft-sidebar-header">🐠 Fish Tank</div>
    <div class="ft-actions">
      <button class="ft-btn ft-btn--primary" id="ft-draw-btn">🎨 Gambar Ikanku</button>
      <button class="ft-btn ft-btn--feed" id="ft-feed-btn">🍬 Beri Makan</button>
    </div>
    <div class="ft-info-box" id="ft-info-box">
      Klik <strong>🎨 Gambar Ikanku</strong> untuk menambahkan ikanmu ke akuarium.<br>
      Ikan hidup selama <strong>7 hari</strong>, lalu akan pergi.
    </div>
    <div class="ft-fish-list-header">🐟 Penghuni Akuarium</div>
    <div class="ft-fish-list" id="ft-fish-list">
      <div class="ft-empty-hint">Akuarium masih kosong…</div>
    </div>
  </div>

  <!-- Modal: gambar ikan -->
  <div class="ft-draw-modal" id="ft-draw-modal" style="display:none">
    <div class="ft-draw-card">
      <div class="ft-draw-header">
        <span>🎨 Gambar Ikanmu</span>
        <button class="ft-draw-close" id="ft-draw-close">✕</button>
      </div>

      <div class="ft-draw-hint">
        Gambar bebas di kanvas di bawah — ikan apapun yang kamu mau!<br>
        Ikan ini akan hidup di akuarium selama 7 hari atas namamu.
      </div>

      <div class="ft-draw-toolbar">
        <div class="ft-color-palette" id="ft-color-palette">
          ${['#1a1a2e','#e05555','#f5a623','#4caf50','#2a6edd','#9b59b6','#00bcd4','#ff69b4','#fff','#8b4513'].map(c =>
            `<button class="ft-color-btn" data-color="${c}" style="background:${c}" title="${c}"></button>`
          ).join('')}
          <input type="color" id="ft-custom-color" title="Warna kustom" value="#2a6edd">
        </div>
        <div class="ft-brush-sizes">
          ${[3,6,10,16].map(s =>
            `<button class="ft-size-btn ${s===6?'active':''}" data-size="${s}">
              <span style="width:${s}px;height:${s}px;background:currentColor;border-radius:50%;display:inline-block;"></span>
            </button>`
          ).join('')}
        </div>
        <button class="ft-tool-btn" id="ft-eraser-btn" title="Penghapus">🧹</button>
        <button class="ft-tool-btn" id="ft-undo-btn" title="Undo">↩</button>
        <button class="ft-tool-btn" id="ft-clear-btn" title="Bersihkan">🗑️</button>
      </div>

      <!-- Kanvas gambar: canvas asli TRANSPARAN, guide-overlay terpisah di atasnya -->
      <div class="ft-draw-canvas-wrap" style="position:relative;background:#12243a">
        <canvas id="ft-draw-canvas" width="360" height="220" style="position:relative;z-index:2"></canvas>
        <svg class="ft-draw-guide-svg" id="ft-draw-guide-svg"
             viewBox="0 0 360 220" width="360" height="220"
             style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1">
          <ellipse cx="190" cy="105" rx="88" ry="52" fill="none" stroke="rgba(100,180,255,0.18)" stroke-width="1.5" stroke-dasharray="5 7"/>
          <path d="M103,105 L65,68 L65,142 Z" fill="none" stroke="rgba(100,180,255,0.18)" stroke-width="1.5" stroke-dasharray="5 7"/>
          <circle cx="262" cy="95" r="7" fill="none" stroke="rgba(100,180,255,0.18)" stroke-width="1.5" stroke-dasharray="5 7"/>
          <text x="180" y="200" text-anchor="middle" font-size="11" font-family="Segoe UI, system-ui, sans-serif" fill="rgba(100,180,255,0.18)">← gambar ikanmu di sini →</text>
        </svg>
      </div>

      <div class="ft-draw-actions">
        <button class="ft-btn ft-btn--ghost" id="ft-draw-cancel">Batal</button>
        <button class="ft-btn ft-btn--primary" id="ft-draw-submit">🐟 Lepaskan ke Akuarium!</button>
      </div>
    </div>
  </div>

</div>`;
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init(container) {
    _container = container;
    container.innerHTML = renderHTML();

    socket = window._theaterSocket || (typeof io !== 'undefined' ? io() : null);
    meUser = window.ME || { id: null, nickname: 'Anonim', avatar: '🐠' };

    canvas = container.querySelector('#ft-tank-canvas');
    ctx = canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    initDecorations();
    bindTankEvents(container);
    bindSidebar(container);
    bindDrawModal(container);
    registerSocketEvents(container);

    socket?.emit('fishtank:get-fish');
    startAnimation();
  }

  function resizeCanvas() {
    if (!canvas) return;
    const wrap = canvas.parentElement;
    canvas.width  = wrap.clientWidth  || 600;
    canvas.height = wrap.clientHeight || 400;
    initDecorations();
  }

  // ── Dekorasi akuarium ─────────────────────────────────────────────────────
  function initDecorations() {
    if (!canvas) return;
    const W = canvas.width, H = canvas.height;

    plants = [];
    const plantCount = Math.max(3, Math.floor(W / 120));
    for (let i = 0; i < plantCount; i++) {
      plants.push({
        x: 40 + (i * (W - 80)) / (plantCount - 1 || 1),
        h: 30 + Math.random() * 50,
        sway: Math.random() * Math.PI * 2,
        swaySpeed: 0.008 + Math.random() * 0.006,
        color: `hsl(${120 + Math.random()*40},${50+Math.random()*30}%,${25+Math.random()*15}%)`
      });
    }

    bubbles = [];
    for (let i = 0; i < 12; i++) {
      bubbles.push(makeBubble(W, H));
    }
  }

  function makeBubble(W, H) {
    return {
      x: Math.random() * W,
      y: H + Math.random() * 40,
      r: 2 + Math.random() * 5,
      speed: 0.3 + Math.random() * 0.6,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.02 + Math.random() * 0.03,
      opacity: 0.3 + Math.random() * 0.4
    };
  }

  // ── Loop animasi ──────────────────────────────────────────────────────────
  function startAnimation() {
    if (animId) cancelAnimationFrame(animId);
    function loop() {
      animId = requestAnimationFrame(loop);
      if (!canvas || !ctx) return;
      drawFrame();
    }
    loop();
  }

  function stopAnimation() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
  }

  function drawFrame() {
    const W = canvas.width, H = canvas.height;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a1628');
    bg.addColorStop(0.5, '#0d2444');
    bg.addColorStop(1, '#081830');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const lightGrad = ctx.createRadialGradient(W/2, 0, 0, W/2, 0, W * 0.7);
    lightGrad.addColorStop(0, 'rgba(100,180,255,0.08)');
    lightGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lightGrad;
    ctx.fillRect(0, 0, W, H);

    const sandGrad = ctx.createLinearGradient(0, H - 28, 0, H);
    sandGrad.addColorStop(0, '#3a2a10');
    sandGrad.addColorStop(1, '#1e1408');
    ctx.fillStyle = sandGrad;
    ctx.fillRect(0, H - 28, W, 28);

    drawPlants(W, H);
    drawRocks(W, H);
    drawBubbles(W, H);
    updateAndDrawFood(H);
    updateAndDrawFishes(W, H);

    ctx.strokeStyle = 'rgba(100,160,255,0.15)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1, 1, W - 2, H - 2);

    const glare = ctx.createLinearGradient(0, 0, 80, 0);
    glare.addColorStop(0, 'rgba(255,255,255,0.04)');
    glare.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glare;
    ctx.fillRect(0, 0, 80, H);
  }

  function drawPlants(W, H) {
    plants.forEach(p => {
      p.sway += p.swaySpeed;
      const swayAmt = Math.sin(p.sway) * 6;

      ctx.save();
      ctx.translate(p.x, H - 28);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(swayAmt * 0.5, -p.h * 0.5, swayAmt, -p.h);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      for (let i = 0; i < 3; i++) {
        const leafY = -p.h * (0.3 + i * 0.25);
        const leafX = (swayAmt * (0.3 + i * 0.25));
        const side = i % 2 === 0 ? 1 : -1;
        ctx.beginPath();
        ctx.ellipse(leafX + side * 10, leafY, 10, 5, side * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    });
  }

  function drawRocks(W, H) {
    const rng = mulberry32(W * 13 + H * 7);
    for (let i = 0; i < 5; i++) {
      const rx = 30 + rng() * (W - 60);
      const rw = 14 + rng() * 20;
      const rh = 8 + rng() * 12;
      ctx.beginPath();
      ctx.ellipse(rx, H - 22, rw, rh, rng() * 0.5, 0, Math.PI * 2);
      const shade = Math.floor(30 + rng() * 30);
      ctx.fillStyle = `rgb(${shade},${shade+5},${shade+10})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function mulberry32(seed) {
    return function() {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function drawBubbles(W, H) {
    if (Math.random() < 0.015) bubbles.push(makeBubble(W, H));

    bubbles = bubbles.filter(b => b.y > -10);
    bubbles.forEach(b => {
      b.y -= b.speed;
      b.wobble += b.wobbleSpeed;
      b.x += Math.sin(b.wobble) * 0.4;

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(150,210,255,${b.opacity})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${b.opacity * 0.6})`;
      ctx.fill();
    });
  }

  function updateAndDrawFood(H) {
    foodParticles = foodParticles.filter(f => f.y < H - 30 || f.eaten);
    foodParticles.forEach(f => {
      if (f.eaten) return;
      f.y += f.speed;
      f.x += Math.sin(f.wobble) * 0.5;
      f.wobble += 0.05;

      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fillStyle = '#f5a623';
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  // ── Ikan ──────────────────────────────────────────────────────────────────
  function updateAndDrawFishes(W, H) {
    const now = Date.now();
    fishes.forEach(fish => {
      if (!fish._state) initFishState(fish, W, H);
      const s = fish._state;

      const age = now - fish.createdAt;
      if (age > FISH_TTL_MS) {
        fish._dead = true;
        return;
      }

      updateFishTarget(fish, s, W, H);
      moveFish(fish, s, W, H);
      drawFish(fish, s, W, H, age);
    });
    fishes = fishes.filter(f => !f._dead);
  }

  function initFishState(fish, W, H) {
    fish._state = {
      x: 60 + Math.random() * (W - 120),
      y: 60 + Math.random() * (H - 130),
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 0.8,
      targetX: null,
      targetY: null,
      tail: 0,
      tailSpeed: 0.08 + Math.random() * 0.06,
      wobble: Math.random() * Math.PI * 2,
      scared: 0,
      scaredDirX: 0,
      scaredDirY: 0,
      idleTimer: 0,
      img: null
    };
    if (fish.imageData) {
      const img = new Image();
      img.onload = () => { fish._state.img = img; };
      img.onerror = () => { fish._state.img = null; }; // fallback ke ikan generik kalau gagal load
      img.src = fish.imageData;
    }
  }

  function updateFishTarget(fish, s, W, H) {
    if (s.scared > 0) {
      s.scared--;
      const speed = 3.5;
      s.vx = s.scaredDirX * speed;
      s.vy = s.scaredDirY * speed;
      return;
    }

    const nearby = foodParticles.filter(f => !f.eaten && Math.hypot(f.x - s.x, f.y - s.y) < 120);
    if (nearby.length > 0) {
      const closest = nearby.sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y))[0];
      s.targetX = closest.x;
      s.targetY = closest.y;
      if (Math.hypot(closest.x - s.x, closest.y - s.y) < 12) {
        closest.eaten = true;
        s.targetX = null;
        s.targetY = null;
      }
    } else {
      s.idleTimer--;
      if (s.idleTimer <= 0) {
        s.targetX = 60 + Math.random() * (W - 120);
        s.targetY = 60 + Math.random() * (H - 130);
        s.idleTimer = 120 + Math.random() * 180;
      }
    }
  }

  function moveFish(fish, s, W, H) {
    const speed = 0.9;
    if (s.targetX !== null) {
      const dx = s.targetX - s.x;
      const dy = s.targetY - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 5) {
        s.vx += (dx / dist) * 0.12;
        s.vy += (dy / dist) * 0.08;
      }
    }

    const v = Math.hypot(s.vx, s.vy);
    const maxV = s.scared > 0 ? 4 : speed;
    if (v > maxV) { s.vx = s.vx / v * maxV; s.vy = s.vy / v * maxV; }

    s.vx *= 0.96;
    s.vy *= 0.96;

    s.x += s.vx;
    s.y += s.vy;

    const margin = 30;
    if (s.x < margin) { s.vx += 0.3; }
    if (s.x > W - margin) { s.vx -= 0.3; }
    if (s.y < margin) { s.vy += 0.2; }
    if (s.y > H - 60) { s.vy -= 0.2; }

    s.x = Math.max(10, Math.min(W - 10, s.x));
    s.y = Math.max(10, Math.min(H - 40, s.y));

    s.tail += s.tailSpeed;
  }

  function drawFish(fish, s, W, H, age) {
    ctx.save();
    ctx.translate(s.x, s.y);

    const angle = Math.atan2(s.vy, s.vx);
    ctx.rotate(angle);

    const growRatio = Math.min(1, age / (2 * 24 * 3600 * 1000));
    const fishW = 48 + growRatio * 16;
    const fishH = 28 + growRatio * 8;

    const fadeStart = FISH_TTL_MS * 0.85;
    const alpha = age > fadeStart ? 1 - (age - fadeStart) / (FISH_TTL_MS - fadeStart) : 1;
    ctx.globalAlpha = Math.max(0.1, alpha);

    if (s.img) {
      const scaleX = s.vx < -0.1 ? -1 : 1;
      ctx.scale(scaleX, 1);
      ctx.drawImage(s.img, -fishW/2, -fishH/2, fishW, fishH);
      ctx.scale(scaleX, 1);
    } else {
      const hue = (parseInt(fish.id.slice(-4), 36) % 360) || 200;
      drawGenericFish(ctx, fishW, fishH, hue, s.tail, s.vx);
    }

    ctx.globalAlpha = 1;
    ctx.restore();

    drawFishLabel(fish, s, alpha);
  }

  function drawGenericFish(ctx, W, H, hue, tail, vx) {
    const flip = vx < -0.1 ? -1 : 1;
    ctx.scale(flip, 1);

    const tailWag = Math.sin(tail) * 8;
    ctx.beginPath();
    ctx.moveTo(-W * 0.3, 0);
    ctx.lineTo(-W * 0.55, -H * 0.4 + tailWag);
    ctx.lineTo(-W * 0.55, H * 0.4 + tailWag);
    ctx.closePath();
    ctx.fillStyle = `hsl(${hue}, 70%, 35%)`;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(0, 0, W * 0.45, H * 0.38, 0, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(W * 0.05, 0, W * 0.25, H * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${hue+20}, 60%, 60%)`;
    ctx.globalAlpha = 0.4;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.arc(W * 0.28, -H * 0.08, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W * 0.29, -H * 0.08, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-W * 0.05, -H * 0.35);
    ctx.quadraticCurveTo(W * 0.1, -H * 0.6, W * 0.25, -H * 0.35);
    ctx.fillStyle = `hsl(${hue}, 70%, 40%)`;
    ctx.globalAlpha = 0.6;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.scale(flip, 1);
  }

  function drawFishLabel(fish, s, alpha) {
    const label = fish.nickname;
    if (!label) return;

    const fontSize = 11;
    ctx.save();
    ctx.globalAlpha = Math.max(0.2, alpha);
    ctx.font = `600 ${fontSize}px 'Segoe UI', system-ui, sans-serif`;
    ctx.textAlign = 'center';

    const textW = ctx.measureText(label).width;
    const padding = 5;
    const rx = s.x - textW/2 - padding;
    const ry = s.y - 38;
    const rw = textW + padding * 2;
    const rh = fontSize + 6;

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, rh, 6);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.fillText(label, s.x, ry + fontSize);
    ctx.restore();
  }

  // ── Interaksi tank ────────────────────────────────────────────────────────
  function bindTankEvents(container) {
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      checkFishClick(cx, cy);
    });

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      showFishTooltip(container, cx, cy, e.clientX, e.clientY);
    });

    canvas.addEventListener('mouseleave', () => {
      const tt = container.querySelector('#ft-fish-tooltip');
      if (tt) tt.style.display = 'none';
    });

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      checkFishClick(t.clientX - rect.left, t.clientY - rect.top);
    }, { passive: false });
  }

  function checkFishClick(cx, cy) {
    let hit = false;
    fishes.forEach(fish => {
      if (!fish._state) return;
      const s = fish._state;
      const dist = Math.hypot(cx - s.x, cy - s.y);
      if (dist < 32) {
        const dx = s.x - cx;
        const dy = s.y - cy;
        const len = Math.hypot(dx, dy) || 1;
        s.scared = 60;
        s.scaredDirX = dx / len;
        s.scaredDirY = dy / len;
        hit = true;
        socket?.emit('fishtank:poke-fish', fish.id);
      }
    });
    return hit;
  }

  function showFishTooltip(container, cx, cy, clientX, clientY) {
    const tt = container.querySelector('#ft-fish-tooltip');
    if (!tt) return;
    let found = null;
    fishes.forEach(fish => {
      if (!fish._state) return;
      const dist = Math.hypot(cx - fish._state.x, cy - fish._state.y);
      if (dist < 36) found = fish;
    });
    if (found) {
      const age = Date.now() - found.createdAt;
      const daysLeft = Math.max(0, Math.ceil((FISH_TTL_MS - age) / (24*3600*1000)));
      container.querySelector('#ft-tooltip-name').textContent = found.nickname;
      container.querySelector('#ft-tooltip-age').textContent = `Sisa ${daysLeft} hari`;
      tt.style.display = 'flex';
      tt.style.left = (clientX - canvas.getBoundingClientRect().left + 14) + 'px';
      tt.style.top  = (clientY - canvas.getBoundingClientRect().top  - 10) + 'px';
    } else {
      tt.style.display = 'none';
    }
  }

  // ── Sidebar ───────────────────────────────────────────────────────────────
  function bindSidebar(container) {
    container.querySelector('#ft-draw-btn')?.addEventListener('click', () => {
      openDrawModal(container);
    });

    container.querySelector('#ft-feed-btn')?.addEventListener('click', () => {
      dropFood(container);
      socket?.emit('fishtank:feed');
    });
  }

  function renderFishList(container) {
    const list = container.querySelector('#ft-fish-list');
    if (!list) return;
    if (fishes.length === 0) {
      list.innerHTML = '<div class="ft-empty-hint">Akuarium masih kosong…</div>';
      return;
    }
    const now = Date.now();
    list.innerHTML = fishes.map(f => {
      const age = now - f.createdAt;
      const daysLeft = Math.max(0, Math.ceil((FISH_TTL_MS - age) / (24*3600*1000)));
      const pct = Math.max(0, 100 - (age / FISH_TTL_MS * 100));
      return `
      <div class="ft-fish-item">
        <div class="ft-fish-item-preview" style="background:#0a1628;border-radius:6px;overflow:hidden;width:44px;height:28px;flex-shrink:0">
          ${f.imageData ? `<img src="${f.imageData}" style="width:100%;height:100%;object-fit:contain">` : '<span style="font-size:20px;line-height:28px;text-align:center;display:block">🐠</span>'}
        </div>
        <div class="ft-fish-item-info">
          <div class="ft-fish-item-name">${escHtml(f.nickname)}</div>
          <div class="ft-fish-item-bar">
            <div class="ft-fish-item-fill" style="width:${pct}%"></div>
          </div>
          <div class="ft-fish-item-days">${daysLeft} hari lagi</div>
        </div>
      </div>`;
    }).join('');
  }

  function dropFood(container) {
    if (!canvas) return;
    const W = canvas.width;
    const count = 6 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      foodParticles.push({
        x: 40 + Math.random() * (W - 80),
        y: 5 + Math.random() * 20,
        r: 2 + Math.random() * 2,
        speed: 0.4 + Math.random() * 0.5,
        wobble: Math.random() * Math.PI * 2,
        eaten: false
      });
    }
  }

  // ── Modal gambar ikan ─────────────────────────────────────────────────────
  function openDrawModal(container) {
    const modal = container.querySelector('#ft-draw-modal');
    if (!modal) return;
    modal.style.display = 'flex';

    isEraserActive = false;
    drawColor = '#e05555';

    bindDrawCanvasEvents(container); // assign drawCanvas/drawCtx + clone untuk hapus listener lama
    clearDrawCanvas();

    const myFish = fishes.find(f => f.ownerId === meUser?.id);
    const infoBox = container.querySelector('#ft-info-box');
    if (myFish) {
      if (infoBox) infoBox.innerHTML = '⚠️ Kamu sudah punya ikan di akuarium. Menggambar lagi akan <strong>menggantikan</strong> ikanmu yang lama.';
    } else {
      if (infoBox) infoBox.innerHTML = 'Gambar ikanmu lalu klik <strong>🐟 Lepaskan ke Akuarium!</strong><br>Ikan hidup selama <strong>7 hari</strong>.';
    }
  }

  function bindDrawModal(container) {
    container.querySelector('#ft-draw-close')?.addEventListener('click', () => closeDrawModal(container));
    container.querySelector('#ft-draw-cancel')?.addEventListener('click', () => closeDrawModal(container));
    container.querySelector('#ft-draw-submit')?.addEventListener('click', () => submitFish(container));

    container.querySelectorAll('.ft-size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        drawSize = parseInt(btn.dataset.size);
        container.querySelectorAll('.ft-size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    container.querySelector('#ft-undo-btn')?.addEventListener('click', () => {
      if (!drawCtx || drawHistory.length === 0) return;
      drawHistory.pop();
      drawCtx.clearRect(0, 0, 360, 220);
      if (drawHistory.length > 0) {
        const img = new Image();
        img.onload = () => { drawCtx.drawImage(img, 0, 0); };
        img.src = drawHistory[drawHistory.length - 1];
      }
    });

    container.querySelector('#ft-clear-btn')?.addEventListener('click', clearDrawCanvas);
  }

  // Dipanggil setiap kali modal dibuka — pasang ulang listener pada canvas baru
  function bindDrawCanvasEvents(container) {
    const fresh = container.querySelector('#ft-draw-canvas');
    if (!fresh) return;

    // Ganti elemen canvas dengan clone-nya supaya listener lama tidak menumpuk
    const old = fresh.cloneNode(true);
    fresh.parentNode.replaceChild(old, fresh);
    drawCanvas = old;
    drawCtx = drawCanvas.getContext('2d');

    container.querySelectorAll('.ft-color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        drawColor = btn.dataset.color;
        container.querySelectorAll('.ft-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        container.querySelector('#ft-eraser-btn')?.classList.remove('active');
        isEraserActive = false;
      });
    });

    container.querySelector('#ft-custom-color')?.addEventListener('input', (e) => {
      drawColor = e.target.value;
      container.querySelector('#ft-eraser-btn')?.classList.remove('active');
      isEraserActive = false;
    });

    container.querySelector('#ft-eraser-btn')?.addEventListener('click', () => {
      isEraserActive = !isEraserActive;
      container.querySelector('#ft-eraser-btn')?.classList.toggle('active', isEraserActive);
    });

    function getPos(e) {
      const rect = drawCanvas.getBoundingClientRect();
      const scaleX = drawCanvas.width  / rect.width;
      const scaleY = drawCanvas.height / rect.height;
      const src = e.touches ? e.touches[0] : e;
      return [(src.clientX - rect.left) * scaleX, (src.clientY - rect.top) * scaleY];
    }

    function startDraw(e) {
      e.preventDefault();
      isDrawing = true;
      [lastX, lastY] = getPos(e);
      drawHistory.push(drawCanvas.toDataURL()); // PNG, otomatis transparan
      if (drawHistory.length > 30) drawHistory.shift();
    }

    function draw(e) {
      if (!isDrawing) return;
      e.preventDefault();
      const [x, y] = getPos(e);
      drawCtx.beginPath();
      drawCtx.moveTo(lastX, lastY);
      drawCtx.lineTo(x, y);
      if (isEraserActive) {
        drawCtx.globalCompositeOperation = 'destination-out';
        drawCtx.strokeStyle = 'rgba(0,0,0,1)';
        drawCtx.lineWidth = drawSize * 3;
      } else {
        drawCtx.globalCompositeOperation = 'source-over';
        drawCtx.strokeStyle = drawColor;
        drawCtx.lineWidth = drawSize;
      }
      drawCtx.lineCap = 'round';
      drawCtx.lineJoin = 'round';
      drawCtx.stroke();
      drawCtx.globalCompositeOperation = 'source-over';
      [lastX, lastY] = [x, y];
    }

    function endDraw() { isDrawing = false; }

    drawCanvas.addEventListener('mousedown', startDraw);
    drawCanvas.addEventListener('mousemove', draw);
    drawCanvas.addEventListener('mouseup', endDraw);
    drawCanvas.addEventListener('mouseleave', endDraw);
    drawCanvas.addEventListener('touchstart', startDraw, { passive: false });
    drawCanvas.addEventListener('touchmove', draw, { passive: false });
    drawCanvas.addEventListener('touchend', endDraw);
  }

  // FIX: canvas gambar dibiarkan transparan murni — TIDAK ada background
  // solid yang dilukis ke dalamnya. Panduan ikan sekarang berupa SVG overlay
  // terpisah (#ft-draw-guide-svg) yang tidak ikut diekspor ke imageData.
  function clearDrawCanvas() {
    if (!drawCtx) return;
    drawCtx.clearRect(0, 0, 360, 220);
    drawHistory = [];
  }

  function closeDrawModal(container) {
    const modal = container.querySelector('#ft-draw-modal');
    if (modal) modal.style.display = 'none';
    drawHistory = [];
  }

  function submitFish(container) {
    if (!drawCanvas || !drawCtx) return;

    // Validasi: cek channel alpha — canvas transparan murni,
    // jadi ada gambar kalau ada pixel dengan alpha > 10
    const pixels = drawCtx.getImageData(0, 0, 360, 220).data;
    let hasDrawing = false;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] > 10) { hasDrawing = true; break; }
    }
    if (!hasDrawing) {
      alert('Gambar ikanmu dulu sebelum dilepaskan! 🎨');
      return;
    }

    // Export sebagai PNG agar transparansi tetap terjaga di akuarium
    const imageData = drawCanvas.toDataURL('image/png');

    socket?.emit('fishtank:add-fish', {
      imageData,
      nickname: meUser?.nickname || 'Anonim',
      ownerId: meUser?.id
    });

    closeDrawModal(container);
  }

  // ── Socket events ─────────────────────────────────────────────────────────
  function registerSocketEvents(container) {
    socket?.on('fishtank:all-fish', (list) => {
      fishes = list.map(f => ({ ...f, _state: null }));
      renderFishList(container);
    });

    socket?.on('fishtank:fish-added', (fish) => {
      const existing = fishes.findIndex(f => f.id === fish.id);
      if (existing !== -1) fishes.splice(existing, 1);
      fishes.push({ ...fish, _state: null });
      renderFishList(container);
    });

    socket?.on('fishtank:fish-removed', (fishId) => {
      fishes = fishes.filter(f => f.id !== fishId);
      renderFishList(container);
    });

    socket?.on('fishtank:fish-replaced', ({ oldId, fish }) => {
      fishes = fishes.filter(f => f.id !== oldId);
      fishes.push({ ...fish, _state: null });
      renderFishList(container);
    });

    socket?.on('fishtank:feed', () => {
      dropFood(container);
    });

    socket?.on('fishtank:poke-fish', (fishId) => {
      const fish = fishes.find(f => f.id === fishId);
      if (fish?._state) {
        const s = fish._state;
        const angle = Math.random() * Math.PI * 2;
        s.scared = 50;
        s.scaredDirX = Math.cos(angle);
        s.scaredDirY = Math.sin(angle);
      }
    });
  }

  // ── Destroy ───────────────────────────────────────────────────────────────
  function destroy() {
    stopAnimation();
    window.removeEventListener('resize', resizeCanvas);
    socket?.off('fishtank:all-fish');
    socket?.off('fishtank:fish-added');
    socket?.off('fishtank:fish-removed');
    socket?.off('fishtank:fish-replaced');
    socket?.off('fishtank:feed');
    socket?.off('fishtank:poke-fish');
  }

  // ── Utils ─────────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Register ke Desktop ───────────────────────────────────────────────────
  window.addEventListener('DOMContentLoaded', () => {
    if (typeof Desktop === 'undefined') return;
    Desktop.registerApp('fishtank', {
      icon: '🐠',
      title: 'Fish Tank',
      render(container) {
        init(container);
      }
    });
  });
})();
