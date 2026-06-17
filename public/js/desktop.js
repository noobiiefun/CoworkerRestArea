// desktop.js
// Window manager generik ala Windows: buka/tutup/minimize/maximize,
// drag, resize, taskbar, start menu. Aplikasi (chat, dll) cukup
// "mendaftar" lewat Desktop.registerApp() lalu Desktop.openApp().

const Desktop = (() => {
  const windowsLayer = document.getElementById('windows-layer');
  const taskbarRunning = document.getElementById('taskbar-running');
  const tplWindow = document.getElementById('tpl-window');

  const apps = new Map();   // appId -> { icon, title, render }
  const openWindows = new Map(); // appId -> { el, taskbarEl, maximized, prevRect }

  let zCounter = 10;
  let cascadeOffset = 0;

  function registerApp(appId, { icon, title, render }) {
    apps.set(appId, { icon, title, render });
  }

  function focusWindow(appId) {
    openWindows.forEach((w, id) => {
      const isThis = id === appId;
      w.el.classList.toggle('is-focused', isThis);
      w.taskbarEl.classList.toggle('active', isThis);
    });
    const w = openWindows.get(appId);
    if (w) w.el.style.zIndex = ++zCounter;
  }

  function openApp(appId) {
    const app = apps.get(appId);
    if (!app) return;

    // Mode mobile: tampilkan full-screen tanpa window manager
    if (window.matchMedia('(max-width: 768px)').matches) {
      openAppMobile(appId, app);
      return;
    }

    if (openWindows.has(appId)) {
      const w = openWindows.get(appId);
      w.el.classList.remove('is-minimized');
      focusWindow(appId);
      return;
    }

    const winEl = tplWindow.content.firstElementChild.cloneNode(true);
    winEl.querySelector('.window-icon').textContent = app.icon;
    winEl.querySelector('.window-title').textContent = app.title;

    cascadeOffset = (cascadeOffset + 1) % 6;
    const left = 130 + cascadeOffset * 26;
    const top = 60 + cascadeOffset * 22;
    const w0 = Math.min(880, window.innerWidth - left - 24);
    const h0 = Math.min(560, window.innerHeight - top - 90);
    Object.assign(winEl.style, {
      left: left + 'px', top: top + 'px',
      width: Math.max(w0, 360) + 'px', height: Math.max(h0, 320) + 'px',
      zIndex: ++zCounter
    });

    const bodyEl = winEl.querySelector('.window-body');
    windowsLayer.appendChild(winEl);
    app.render(bodyEl, { close: () => closeApp(appId) });

    const taskbarEl = document.createElement('button');
    taskbarEl.className = 'taskbar-app active';
    taskbarEl.innerHTML = `<span>${app.icon}</span><span>${app.title}</span>`;
    taskbarEl.addEventListener('click', () => {
      const w = openWindows.get(appId);
      if (!w) return;
      const isMin = w.el.classList.contains('is-minimized');
      const isFocused = w.el.classList.contains('is-focused');
      if (isMin) { w.el.classList.remove('is-minimized'); focusWindow(appId); }
      else if (isFocused) { w.el.classList.add('is-minimized'); taskbarEl.classList.remove('active'); }
      else { focusWindow(appId); }
    });
    taskbarRunning.appendChild(taskbarEl);

    openWindows.set(appId, { el: winEl, taskbarEl, maximized: false, prevRect: null });

    // ---- window controls ----
    winEl.querySelector('.win-close').addEventListener('click', () => closeApp(appId));
    winEl.querySelector('.win-min').addEventListener('click', () => {
      winEl.classList.add('is-minimized');
      taskbarEl.classList.remove('active');
    });
    winEl.querySelector('.win-max').addEventListener('click', () => toggleMaximize(appId));
    winEl.addEventListener('mousedown', () => focusWindow(appId));

    makeDraggable(winEl, winEl.querySelector('.window-titlebar'), appId);
    makeResizable(winEl, winEl.querySelector('.window-resize-handle'));

    focusWindow(appId);
  }

  function openAppMobile(appId, app) {
    // Tutup overlay lama jika ada
    const existing = document.getElementById('mobile-app-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'mobile-app-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9999',
      'background:var(--bg-base, #1a1a2e)',
      'display:flex', 'flex-direction:column',
      'overflow:hidden'
    ].join(';');

    const header = document.createElement('div');
    header.style.cssText = [
      'display:flex', 'align-items:center', 'gap:8px',
      'padding:8px 12px', 'background:var(--bg-bar, #0f0f23)',
      'border-bottom:1px solid rgba(255,255,255,0.1)',
      'flex-shrink:0', 'min-height:44px'
    ].join(';');
    header.innerHTML = `
      <button id="mobile-back-btn" style="background:rgba(255,255,255,0.12);border:none;color:#fff;
        padding:4px 14px;border-radius:6px;font-size:14px;cursor:pointer;">← Kembali</button>
      <span style="color:#fff;font-size:15px;font-weight:600;">${app.icon} ${app.title}</span>`;

    const body = document.createElement('div');
    body.id = 'mobile-app-body';
    body.style.cssText = 'flex:1;overflow:auto;min-height:0;';

    overlay.appendChild(header);
    overlay.appendChild(body);
    document.body.appendChild(overlay);

    header.querySelector('#mobile-back-btn').addEventListener('click', () => {
      overlay.remove();
    });

    app.render(body, { close: () => overlay.remove() });
  }

  function closeApp(appId) {
    const w = openWindows.get(appId);
    if (!w) return;
    w.el.remove();
    w.taskbarEl.remove();
    openWindows.delete(appId);
  }

  function toggleMaximize(appId) {
    const w = openWindows.get(appId);
    if (!w) return;
    if (!w.maximized) {
      w.prevRect = {
        left: w.el.style.left, top: w.el.style.top,
        width: w.el.style.width, height: w.el.style.height
      };
      Object.assign(w.el.style, { left: '0px', top: '0px', width: '100vw', height: 'calc(100vh - 52px)' });
      w.el.classList.add('is-maximized');
      w.maximized = true;
    } else {
      Object.assign(w.el.style, w.prevRect);
      w.el.classList.remove('is-maximized');
      w.maximized = false;
    }
  }

  function makeDraggable(winEl, handle, appId) {
    let startX, startY, startLeft, startTop, dragging = false;
    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest('.win-btn')) return;
      if (winEl.classList.contains('is-maximized')) return;
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      startLeft = winEl.offsetLeft; startTop = winEl.offsetTop;
      focusWindow(appId);
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      const newLeft = Math.max(-40, startLeft + dx);
      const newTop = Math.max(0, Math.min(window.innerHeight - 80, startTop + dy));
      winEl.style.left = newLeft + 'px';
      winEl.style.top = newTop + 'px';
    });
    window.addEventListener('mouseup', () => { dragging = false; });
  }

  function makeResizable(winEl, handle) {
    let startX, startY, startW, startH, resizing = false;
    handle.addEventListener('mousedown', (e) => {
      resizing = true;
      startX = e.clientX; startY = e.clientY;
      startW = winEl.offsetWidth; startH = winEl.offsetHeight;
      e.preventDefault(); e.stopPropagation();
    });
    window.addEventListener('mousemove', (e) => {
      if (!resizing) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      winEl.style.width = Math.max(320, startW + dx) + 'px';
      winEl.style.height = Math.max(220, startH + dy) + 'px';
    });
    window.addEventListener('mouseup', () => { resizing = false; });
  }

  // ---- taskbar / start menu / clock ----
  function initShell() {
    const startBtn = document.getElementById('start-btn');
    const startMenu = document.getElementById('start-menu');

    startBtn.addEventListener('click', (e) => {
      startMenu.classList.toggle('hidden');
      e.stopPropagation();
    });
    document.addEventListener('click', (e) => {
      if (!startMenu.contains(e.target) && e.target !== startBtn) startMenu.classList.add('hidden');
    });
    startMenu.querySelectorAll('.start-menu-item').forEach((item) => {
      if (item.classList.contains('disabled')) return;
      item.addEventListener('click', () => {
        openApp(item.dataset.app);
        startMenu.classList.add('hidden');
      });
    });

    document.querySelectorAll('.desktop-icon').forEach((icon) => {
      if (icon.classList.contains('is-soon')) return;
      icon.style.cursor = 'pointer';

      // Single click untuk semua perangkat (fix: double-click tidak reliable)
      let lastClick = 0;
      icon.addEventListener('click', (e) => {
        e.stopPropagation();
        const now = Date.now();
        document.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('is-selected'));
        icon.classList.add('is-selected');
        // Buka langsung jika: touch device, atau klik kedua dalam 400ms (double-click manual)
        const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
        if (isTouchDevice || (now - lastClick < 400)) {
          openApp(icon.dataset.app);
        }
        lastClick = now;
      });
      // Tetap support dblclick native
      icon.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        openApp(icon.dataset.app);
      });
    });

    // ---- Jam analog + tanggal (pojok kanan atas) ----
    const clockWidget = document.getElementById('desktop-clock-widget');
    if (clockWidget) {
      function tickClock() {
        const now = new Date();
        const h = now.getHours() % 12;
        const m = now.getMinutes();
        const s = now.getSeconds();
        // Jarum
        const secDeg  = s * 6;
        const minDeg  = m * 6 + s * 0.1;
        const hourDeg = h * 30 + m * 0.5;
        const secsHand  = clockWidget.querySelector('.clock-hand-sec');
        const minsHand  = clockWidget.querySelector('.clock-hand-min');
        const hoursHand = clockWidget.querySelector('.clock-hand-hour');
        if (secsHand)  secsHand.setAttribute('transform',  `rotate(${secDeg},  80, 80)`);
        if (minsHand)  minsHand.setAttribute('transform',  `rotate(${minDeg},  80, 80)`);
        if (hoursHand) hoursHand.setAttribute('transform', `rotate(${hourDeg}, 80, 80)`);
        // Tanggal
        const dateEl = document.getElementById('desktop-date');
        if (dateEl) {
          dateEl.textContent = now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
        }
      }
      tickClock();
      setInterval(tickClock, 1000);
    }

    // Tetap update #clock di taskbar (hidden tapi dipakai komponen lain)
    const clockEl = document.getElementById('clock');
    if (clockEl) {
      function tick() {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      }
      tick();
      setInterval(tick, 15000);
    }

    // ---- Wallpaper changer ----
    function applyWallpaper(src) {
      const wp = document.getElementById('wallpaper');
      const overlay = document.getElementById('wallpaper-overlay');
      if (!wp) return;
      try { localStorage.setItem('cra_wallpaper', src); } catch(e) {}
      if (src === 'default') {
        wp.style.backgroundImage = '';
        wp.style.backgroundSize  = '';
        wp.style.backgroundPosition = '';
        const svg = wp.querySelector('svg');
        if (svg) svg.style.display = '';
        if (overlay) overlay.style.display = 'none';
        return;
      }
      // Sembunyikan SVG, tampilkan gambar
      const svg = wp.querySelector('svg');
      if (svg) svg.style.display = 'none';
      wp.style.cssText += ';background-image:url("' + src + '") !important;background-size:cover !important;background-position:center !important;background-repeat:no-repeat !important;';
      // Overlay tipis agar ikon tetap terbaca
      if (overlay) overlay.style.display = 'block';
    }

    // Restore wallpaper dari localStorage saat load
    try {
      const saved = localStorage.getItem('cra_wallpaper');
      if (saved) applyWallpaper(saved);
    } catch(e) {}

    // Panel ganti wallpaper
    const wpPanel = document.getElementById('wallpaper-panel');
    const wpInput = document.getElementById('wallpaper-url-input');
    const wpFileInput = document.getElementById('wallpaper-file-input');

    function openWallpaperPanel() {
      if (wpPanel) wpPanel.classList.toggle('hidden');
    }

    // Tombol di taskbar
    document.getElementById('wallpaper-btn')?.addEventListener('click', openWallpaperPanel);

    // Klik kanan desktop
    document.getElementById('desktop')?.addEventListener('contextmenu', (e) => {
      // Jangan intercept klik kanan di dalam window
      if (e.target.closest('.window')) return;
      e.preventDefault();
      if (wpPanel) {
        wpPanel.classList.remove('hidden');
        // Posisikan di dekat kursor
        wpPanel.style.left = Math.min(e.clientX, window.innerWidth - 300) + 'px';
        wpPanel.style.top  = Math.min(e.clientY, window.innerHeight - 200) + 'px';
      }
    });

    // Tutup panel saat klik di luar
    document.addEventListener('click', (e) => {
      if (wpPanel && !wpPanel.contains(e.target) &&
          e.target.id !== 'wallpaper-btn') {
        wpPanel.classList.add('hidden');
      }
    });

    // Tombol Apply URL
    document.getElementById('wallpaper-apply-url')?.addEventListener('click', () => {
      const url = wpInput?.value?.trim();
      if (!url) return;
      applyWallpaper(url);
      if (wpPanel) wpPanel.classList.add('hidden');
    });
    wpInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('wallpaper-apply-url')?.click();
    });

    // Upload file lokal
    wpFileInput?.addEventListener('change', () => {
      const file = wpFileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        applyWallpaper(ev.target.result);
        if (wpPanel) wpPanel.classList.add('hidden');
      };
      reader.readAsDataURL(file);
    });
    document.getElementById('wallpaper-upload-btn')?.addEventListener('click', () => {
      wpFileInput?.click();
    });

    // Tombol Reset ke default
    document.getElementById('wallpaper-reset')?.addEventListener('click', () => {
      applyWallpaper('default');
      if (wpInput) wpInput.value = '';
      if (wpPanel) wpPanel.classList.add('hidden');
    });

    document.getElementById('lan-address').textContent = '🌐 ' + window.location.host;
  }

  return { registerApp, openApp, closeApp, initShell };
})();

document.addEventListener('DOMContentLoaded', () => {
  Desktop.initShell();
});
