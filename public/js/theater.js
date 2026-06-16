// public/js/theater.js
// Nonton Bareng — Step 2
// Mendaftar sebagai App di Desktop, mengelola UI theater dan sinkronisasi video.

(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // State lokal theater
  // -------------------------------------------------------------------------
  let socket = null;          // socket.io instance dari chat.js / global
  let meUser = null;          // {id, nickname, avatar} — diisi dari window.ME
  let videos = [];            // daftar video di server
  let viewers = [];           // daftar viewer saat ini di theater
  let theaterMessages = [];   // riwayat chat theater

  let currentState = {
    currentVideo: null,
    isPlaying: false,
    currentTime: 0,
    hostId: null
  };

  let videoEl = null;         // <video> element
  let suppressSync = false;   // cegah feedback loop saat apply state
  let syncInterval = null;
  let _container = null;      // referensi container window

  // -------------------------------------------------------------------------
  // Render HTML utama theater
  // -------------------------------------------------------------------------
  function renderHTML() {
    return `
<div class="theater-root">
  <!-- Sidebar kiri: daftar video -->
  <div class="theater-sidebar" id="theater-sidebar">
    <div class="theater-sidebar-header">
      <span class="theater-sidebar-title">🎬 Daftar Video</span>
      <button class="theater-upload-btn" id="theater-upload-btn" title="Upload video baru">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Upload
      </button>
    </div>
    <input type="file" id="theater-file-input" accept="video/*" style="display:none">
    <div class="theater-upload-progress" id="theater-upload-progress" style="display:none">
      <div class="theater-upload-bar"><div class="theater-upload-fill" id="theater-upload-fill"></div></div>
      <span id="theater-upload-label">Mengupload…</span>
    </div>
    <div class="theater-video-list" id="theater-video-list">
      <div class="theater-empty-hint">Belum ada video. Upload dulu!</div>
    </div>
  </div>

  <!-- Area utama: player + kontrol -->
  <div class="theater-main">
    <div class="theater-player-wrap" id="theater-player-wrap">
      <div class="theater-no-video" id="theater-no-video">
        <div class="theater-no-video-icon">🎬</div>
        <div class="theater-no-video-text">Pilih video dari daftar di kiri untuk mulai nonton bareng</div>
      </div>
      <video id="theater-video" preload="metadata" style="display:none"></video>
      <!-- Overlay reaction -->
      <div class="theater-reaction-overlay" id="theater-reaction-overlay"></div>
    </div>

    <!-- Custom controls -->
    <div class="theater-controls" id="theater-controls">
      <button class="theater-ctrl-btn" id="theater-play-btn" title="Play/Pause" disabled>
        <svg id="theater-play-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
      </button>
      <div class="theater-progress-wrap">
        <input type="range" id="theater-progress" min="0" max="100" value="0" step="0.1" disabled>
      </div>
      <span class="theater-time" id="theater-time">0:00 / 0:00</span>
      <input type="range" id="theater-volume" min="0" max="1" step="0.05" value="1" title="Volume" style="width:70px">
      <button class="theater-ctrl-btn" id="theater-mute-btn" title="Mute">🔊</button>
      <button class="theater-ctrl-btn" id="theater-fullscreen-btn" title="Fullscreen">⛶</button>
      <div class="theater-viewers-badge" id="theater-viewers-badge" title="Penonton">👀 0</div>
    </div>

    <!-- Emoji reactions -->
    <div class="theater-reactions-bar">
      ${['👍','❤️','😂','😮','😢','🔥','👏','🎉'].map(e =>
        `<button class="theater-react-btn" data-emoji="${e}">${e}</button>`
      ).join('')}
    </div>
  </div>

  <!-- Sidebar kanan: chat -->
  <div class="theater-chat-panel">
    <div class="theater-chat-header">
      <span>💬 Chat Nonton</span>
      <span class="theater-online-dot" id="theater-viewer-count">0 penonton</span>
    </div>
    <div class="theater-chat-messages" id="theater-chat-messages"></div>
    <div class="theater-chat-input-row">
      <input type="text" id="theater-chat-input" placeholder="Tulis komentar…" maxlength="200" autocomplete="off">
      <button id="theater-chat-send">Kirim</button>
    </div>
  </div>
</div>`;
  }

  // -------------------------------------------------------------------------
  // Init — dipanggil saat jendela Nonton Bareng dibuka
  // -------------------------------------------------------------------------
  function init(container) {
    _container = container;
    container.innerHTML = renderHTML();

    // Referensi elemen
    videoEl = container.querySelector('#theater-video');

    // Dapatkan socket & user dari namespace global (diset oleh chat.js)
    // Coba berbagai cara mendapatkan socket yang sudah terhubung
    socket = window._theaterSocket
          || (window.io ? window.io() : null);

    // Jika masih null, coba ambil dari instance socket.io yang sudah ada
    if (!socket && typeof io !== 'undefined') {
      socket = io();
    }

    meUser = window.ME || { id: null, nickname: 'Anonim', avatar: '👤' };

    if (!socket) {
      const hint = container.querySelector('.theater-no-video-text');
      if (hint) hint.textContent = 'Koneksi socket tidak tersedia. Buka Ruang Obrolan dulu, lalu buka Nonton Bareng.';
      return;
    }

    bindVideoEvents();
    bindControls(container);
    bindChat(container);
    bindUpload(container);
    bindReactions(container);

    // Bergabung ke theater room di server
    socket.emit('theater:join');

    // Socket events
    socket.on('theater:init', ({ state, videos: vids, viewers: vs, messages }) => {
      videos = vids || [];
      viewers = vs || [];
      theaterMessages = messages || [];
      renderVideoList(container);
      renderViewers(container);
      renderChatHistory(container);
      applyState(state, container);
    });

    socket.on('theater:state', (state) => {
      applyState(state, container);
    });

    socket.on('theater:video-added', (video) => {
      videos.push(video);
      renderVideoList(container);
    });

    socket.on('theater:video-removed', (videoId) => {
      videos = videos.filter(v => v.id !== videoId);
      renderVideoList(container);
    });

    socket.on('theater:viewer-joined', (user) => {
      if (!viewers.find(v => v.id === user.id)) viewers.push(user);
      renderViewers(container);
    });

    socket.on('theater:viewer-left', (userId) => {
      viewers = viewers.filter(v => v.id !== userId);
      renderViewers(container);
    });

    socket.on('theater:viewers-count', (count) => {
      const el = container.querySelector('#theater-viewer-count');
      if (el) el.textContent = count + ' penonton';
      const badge = container.querySelector('#theater-viewers-badge');
      if (badge) badge.textContent = '👀 ' + count;
    });

    socket.on('theater:user-updated', (user) => {
      const idx = viewers.findIndex(v => v.id === user.id);
      if (idx !== -1) viewers[idx] = user;
    });

    socket.on('theater:message', (msg) => {
      appendChatMessage(container, msg);
    });

    socket.on('theater:reaction', ({ nickname, emoji }) => {
      showFloatingReaction(container, emoji, nickname);
    });

    // Periodik sync kecil — jaga keselarasan waktu (toleransi 5 detik agar tidak ganggu tontonan)
    syncInterval = setInterval(() => {
      if (!currentState.isPlaying || !videoEl || videoEl.paused || videoEl.ended) return;
      if (!currentState.lastSyncAt) return; // belum ada state valid dari server
      const expected = expectedCurrentTime();
      const drift = videoEl.currentTime - expected;
      // Hanya koreksi kalau drift > 5 detik (terlalu jauh) atau < -2 detik (ketinggalan jauh)
      if (Math.abs(drift) > 5) {
        suppressSync = true;
        videoEl.currentTime = expected;
        setTimeout(() => { suppressSync = false; }, 500);
      }
    }, 5000);
  }

  // -------------------------------------------------------------------------
  // Cleanup saat jendela ditutup
  // -------------------------------------------------------------------------
  function destroy() {
    if (socket) socket.emit('theater:leave');
    if (syncInterval) clearInterval(syncInterval);
    // Hapus listener theater agar tidak menumpuk
    if (socket) {
      ['theater:init','theater:state','theater:video-added','theater:video-removed',
       'theater:viewer-joined','theater:viewer-left','theater:viewers-count',
       'theater:user-updated','theater:message','theater:reaction'].forEach(e => socket.off(e));
    }
  }

  // -------------------------------------------------------------------------
  // Apply state dari server → update video player
  // -------------------------------------------------------------------------
  function applyState(state, container) {
    if (!state) return;
    currentState = state;

    // Cari container dari videoEl jika tidak dikirim
    const cont = container || videoEl?.closest('.theater-root')?.parentElement;
    const noVideoEl = cont ? cont.querySelector('#theater-no-video') : document.getElementById('theater-no-video');
    const playBtn = cont ? cont.querySelector('#theater-play-btn') : document.getElementById('theater-play-btn');
    const progressEl = cont ? cont.querySelector('#theater-progress') : document.getElementById('theater-progress');

    if (state.currentVideo) {
      if (videoEl.src !== window.location.origin + state.currentVideo.url) {
        videoEl.style.display = 'block';
        if (noVideoEl) noVideoEl.style.display = 'none';
        videoEl.src = state.currentVideo.url;
        videoEl.load();
        videoEl.addEventListener('loadedmetadata', () => {
          suppressSync = true;
          videoEl.currentTime = expectedCurrentTime();
          setTimeout(() => { suppressSync = false; }, 500);
          if (progressEl) progressEl.disabled = false;
          if (playBtn) playBtn.disabled = false;
          if (state.isPlaying) videoEl.play().catch(() => {});
        }, { once: true });
      } else {
        suppressSync = true;
        const target = expectedCurrentTime();
        if (Math.abs(videoEl.currentTime - target) > 1) videoEl.currentTime = target;
        setTimeout(() => { suppressSync = false; }, 500);
        if (state.isPlaying) {
          if (videoEl.paused) videoEl.play().catch(() => {});
        } else {
          if (!videoEl.paused) videoEl.pause();
        }
        if (playBtn) playBtn.disabled = false;
        if (progressEl) progressEl.disabled = false;
      }
      updatePlayIcon(state.isPlaying, cont);
    } else {
      videoEl.style.display = 'none';
      if (noVideoEl) noVideoEl.style.display = 'flex';
      if (playBtn) playBtn.disabled = true;
      if (progressEl) progressEl.disabled = true;
    }
  }

  function expectedCurrentTime() {
    if (!currentState.isPlaying) return currentState.currentTime || 0;
    // lastSyncAt dari server adalah timestamp ms. Kalau tidak ada, anggap baru saja sync.
    const syncAt = currentState.lastSyncAt || Date.now();
    const elapsed = Math.max(0, (Date.now() - syncAt) / 1000);
    return (currentState.currentTime || 0) + elapsed;
  }

  function updatePlayIcon(playing, container) {
    const cont = container || videoEl?.closest('.theater-root')?.parentElement;
    const icon = cont ? cont.querySelector('#theater-play-icon') : document.getElementById('theater-play-icon');
    if (!icon) return;
    icon.innerHTML = playing
      ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
      : '<polygon points="5,3 19,12 5,21"/>';
  }

  // -------------------------------------------------------------------------
  // Bind video element events
  // -------------------------------------------------------------------------
  function bindVideoEvents() {
    if (!videoEl) return;

    videoEl.addEventListener('timeupdate', () => {
      const progressEl = _container ? _container.querySelector('#theater-progress') : null;
      const timeEl = _container ? _container.querySelector('#theater-time') : null;
      if (progressEl && videoEl.duration) {
        progressEl.value = (videoEl.currentTime / videoEl.duration) * 100;
      }
      if (timeEl) {
        timeEl.textContent = formatTime(videoEl.currentTime) + ' / ' + formatTime(videoEl.duration || 0);
      }
    });

    // Jangan emit ke server jika sedang apply state dari server
    videoEl.addEventListener('play', () => {
      if (suppressSync) return;
      socket.emit('theater:play', { currentTime: videoEl.currentTime });
    });

    videoEl.addEventListener('pause', () => {
      if (suppressSync) return;
      socket.emit('theater:pause', { currentTime: videoEl.currentTime });
    });

    videoEl.addEventListener('seeked', () => {
      if (suppressSync) return;
      socket.emit('theater:seek', { currentTime: videoEl.currentTime });
    });

    videoEl.addEventListener('ended', () => {
      updatePlayIcon(false, videoEl?.closest('.theater-root')?.parentElement);
    });
  }

  // -------------------------------------------------------------------------
  // Bind kontrol player
  // -------------------------------------------------------------------------
  function bindControls(container) {
    const playBtn = container.querySelector('#theater-play-btn');
    const progressEl = container.querySelector('#theater-progress');
    const volumeEl = container.querySelector('#theater-volume');
    const muteBtn = container.querySelector('#theater-mute-btn');
    const fsBtn = container.querySelector('#theater-fullscreen-btn');

    playBtn?.addEventListener('click', () => {
      if (!videoEl) return;
      if (videoEl.paused || videoEl.ended) {
        videoEl.play().catch(() => {});
      } else {
        videoEl.pause();
      }
    });

    progressEl?.addEventListener('input', () => {
      if (!videoEl || !videoEl.duration) return;
      const t = (progressEl.value / 100) * videoEl.duration;
      suppressSync = true;
      videoEl.currentTime = t;
      setTimeout(() => { suppressSync = false; }, 300);
      socket.emit('theater:seek', { currentTime: t });
    });

    volumeEl?.addEventListener('input', () => {
      if (!videoEl) return;
      videoEl.volume = parseFloat(volumeEl.value);
      videoEl.muted = videoEl.volume === 0;
      if (muteBtn) muteBtn.textContent = videoEl.muted ? '🔇' : '🔊';
    });

    muteBtn?.addEventListener('click', () => {
      if (!videoEl) return;
      videoEl.muted = !videoEl.muted;
      muteBtn.textContent = videoEl.muted ? '🔇' : '🔊';
    });

    fsBtn?.addEventListener('click', () => {
      const wrap = container.querySelector('#theater-player-wrap');
      if (!document.fullscreenElement) wrap?.requestFullscreen?.();
      else document.exitFullscreen?.();
    });
  }

  // -------------------------------------------------------------------------
  // Bind chat panel
  // -------------------------------------------------------------------------
  function bindChat(container) {
    const input = container.querySelector('#theater-chat-input');
    const sendBtn = container.querySelector('#theater-chat-send');

    function send() {
      const text = input?.value?.trim();
      if (!text || !socket) return;
      socket.emit('theater:message-send', text);
      if (input) input.value = '';
    }

    sendBtn?.addEventListener('click', send);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
  }

  // -------------------------------------------------------------------------
  // Bind upload
  // -------------------------------------------------------------------------
  function bindUpload(container) {
    const btn = container.querySelector('#theater-upload-btn');
    const fileInput = container.querySelector('#theater-file-input');

    btn?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', () => {
      const file = fileInput?.files?.[0];
      if (!file) return;

      const progressWrap = container.querySelector('#theater-upload-progress');
      const fill = container.querySelector('#theater-upload-fill');
      const label = container.querySelector('#theater-upload-label');
      if (progressWrap) progressWrap.style.display = 'block';

      const fd = new FormData();
      fd.append('video', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload-video');
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          if (fill) fill.style.width = pct + '%';
          if (label) label.textContent = `Mengupload… ${pct}%`;
        }
      });
      xhr.addEventListener('load', () => {
        if (progressWrap) progressWrap.style.display = 'none';
        if (fill) fill.style.width = '0%';
        fileInput.value = '';
        if (xhr.status !== 200) {
          alert('Upload gagal: ' + xhr.statusText);
        }
      });
      xhr.addEventListener('error', () => {
        if (progressWrap) progressWrap.style.display = 'none';
        alert('Upload error.');
      });
      xhr.send(fd);
    });
  }

  // -------------------------------------------------------------------------
  // Bind reaction buttons
  // -------------------------------------------------------------------------
  function bindReactions(container) {
    container.querySelectorAll('.theater-react-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        socket?.emit('theater:react', btn.dataset.emoji);
      });
    });
  }

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  function renderVideoList(container) {
    const list = container.querySelector('#theater-video-list');
    if (!list) return;
    if (videos.length === 0) {
      list.innerHTML = '<div class="theater-empty-hint">Belum ada video. Upload dulu!</div>';
      return;
    }
    list.innerHTML = videos.map(v => `
      <div class="theater-video-item ${currentState.currentVideo?.id === v.id ? 'active' : ''}"
           data-id="${v.id}" title="${v.filename}">
        <div class="theater-video-thumb">▶</div>
        <div class="theater-video-info">
          <div class="theater-video-name">${escHtml(v.filename)}</div>
          <div class="theater-video-size">${formatSize(v.size)}</div>
        </div>
        <button class="theater-video-delete" data-id="${v.id}" title="Hapus video">✕</button>
      </div>
    `).join('');

    list.querySelectorAll('.theater-video-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.theater-video-delete')) return;
        socket?.emit('theater:select-video', item.dataset.id);
      });
    });

    list.querySelectorAll('.theater-video-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm('Hapus video ini?')) return;
        fetch('/api/video/' + btn.dataset.id, { method: 'DELETE' });
      });
    });
  }

  function renderViewers(container) {
    const badge = container.querySelector('#theater-viewers-badge');
    const countEl = container.querySelector('#theater-viewer-count');
    if (badge) badge.textContent = '👀 ' + viewers.length;
    if (countEl) countEl.textContent = viewers.length + ' penonton';
  }

  function renderChatHistory(container) {
    const msgs = container.querySelector('#theater-chat-messages');
    if (!msgs) return;
    msgs.innerHTML = '';
    theaterMessages.forEach(m => appendChatMessage(container, m, false));
    msgs.scrollTop = msgs.scrollHeight;
  }

  function appendChatMessage(container, msg, scroll = true) {
    const msgs = container.querySelector('#theater-chat-messages');
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = 'theater-chat-msg' + (msg.system ? ' theater-chat-msg--system' : '');
    if (msg.system) {
      div.innerHTML = `<span class="theater-chat-system-text">${escHtml(msg.text)}</span>`;
    } else {
      const isMe = meUser && msg.authorId === meUser.id;
      div.classList.toggle('theater-chat-msg--me', isMe);
      div.innerHTML = `
        <span class="theater-chat-avatar">${msg.avatar || '💬'}</span>
        <div class="theater-chat-bubble-wrap">
          <span class="theater-chat-nick">${escHtml(msg.nickname)}</span>
          <div class="theater-chat-bubble">${escHtml(msg.text)}</div>
        </div>`;
    }
    msgs.appendChild(div);
    if (scroll) msgs.scrollTop = msgs.scrollHeight;
  }

  function showFloatingReaction(container, emoji, nickname) {
    const overlay = container.querySelector('#theater-reaction-overlay');
    if (!overlay) return;
    const el = document.createElement('div');
    el.className = 'theater-float-reaction';
    el.style.left = (10 + Math.random() * 80) + '%';
    el.innerHTML = `<span class="theater-float-emoji">${emoji}</span><span class="theater-float-name">${escHtml(nickname)}</span>`;
    overlay.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  // -------------------------------------------------------------------------
  // Utils
  // -------------------------------------------------------------------------
  function formatTime(s) {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ':' + String(sec).padStart(2, '0');
  }
  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }
  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // -------------------------------------------------------------------------
  // Daftar ke Desktop window manager
  // -------------------------------------------------------------------------
  window.addEventListener('DOMContentLoaded', () => {
    if (typeof Desktop === 'undefined') return;
    Desktop.registerApp('theater', {
      icon: '📺',
      title: 'Nonton Bareng',
      render(container, { close }) {
        init(container);
      }
    });
  });
})();
