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
      // Single click: highlight saja
      icon.addEventListener('click', () => {
        document.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('is-selected'));
        icon.classList.add('is-selected');
      });
      // Double click: buka app
      icon.addEventListener('dblclick', () => {
        openApp(icon.dataset.app);
      });
    });

    const clockEl = document.getElementById('clock');
    function tick() {
      const now = new Date();
      clockEl.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    tick();
    setInterval(tick, 15000);

    document.getElementById('lan-address').textContent = '🌐 ' + window.location.host;
  }

  return { registerApp, openApp, closeApp, initShell };
})();

document.addEventListener('DOMContentLoaded', () => {
  Desktop.initShell();
});
