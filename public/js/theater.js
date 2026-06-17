// public/js/theater.js
// Nonton Bareng — Multi-Room Theater + Mobile Responsive

(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // State lokal
  // -------------------------------------------------------------------------
  let socket = null;
  let meUser = null;
  let videos = [];
  let viewers = [];
  let theaterMessages = [];
  let theaterRoomsList = [];

  // Theater room yang sedang diikuti
  let currentRoomId = null;
  let currentRoomName = null;

  let currentState = {
    currentVideo: null,
    isPlaying: false,
    currentTime: 0,
    hostId: null,
    lastSyncAt: null
  };

  let videoEl = null;
  let suppressSync = false;
  let syncInterval = null;
  let _container = null;

  // Tampilan aktif di mobile: 'rooms' | 'list' | 'player' | 'chat'
  let mobileTab = 'rooms';

  // -------------------------------------------------------------------------
  // Render HTML utama — layout responsif
  // -------------------------------------------------------------------------
  function renderHTML() {
    return `
<div class="theater-root" id="theater-root">

  <!-- ======== LOBBY: daftar ruangan (1 ruangan per pengupload) ======== -->
  <div class="theater-lobby" id="theater-lobby">
    <div class="theater-lobby-header">
      <span class="theater-lobby-title">📺 Nonton Bareng</span>
      <span class="theater-lobby-hint">Upload video untuk mulai ruangan kamu sendiri</span>
    </div>
    <!-- Tombol upload di lobby -->
    <div class="theater-lobby-upload-row">
      <button class="theater-upload-btn" id="theater-lobby-upload-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        Upload Video
      </button>
      <input type="file" id="theater-file-input" accept="video/*" style="display:none">
      <div class="theater-upload-progress" id="theater-upload-progress" style="display:none">
        <div class="theater-upload-bar"><div class="theater-upload-fill" id="theater-upload-fill"></div></div>
        <span id="theater-upload-label">Mengupload…</span>
      </div>
      <div class="theater-yt-row">
        <span class="theater-yt-label">atau tonton dari YouTube:</span>
        <div class="theater-yt-input-row">
          <input type="text" id="theater-yt-input" placeholder="https://youtube.com/watch?v=..." autocomplete="off">
          <button class="theater-upload-btn" id="theater-yt-btn">▶ Buat Ruangan YT</button>
        </div>
      </div>
    </div>
    <!-- Kartu ruangan -->
    <div class="theater-lobby-rooms" id="theater-lobby-rooms">
      <div class="theater-empty-hint">Belum ada ruangan. Upload video untuk mulai!</div>
    </div>
  </div>

  <!-- ======== AREA NONTON (tampil setelah join room) ======== -->
  <div class="theater-watch" id="theater-watch" style="display:none">

    <!-- Header ruangan -->
    <div class="theater-room-bar" id="theater-room-bar">
      <button class="theater-back-btn" id="theater-back-btn">← Kembali</button>
      <span class="theater-room-name" id="theater-room-name-bar">Ruangan</span>
      <!-- Tab mobile -->
      <div class="theater-mobile-tabs" id="theater-mobile-tabs">
        <button class="theater-tab active" data-tab="list">🎬 Video</button>
        <button class="theater-tab" data-tab="player">▶ Player</button>
        <button class="theater-tab" data-tab="chat">💬 Chat</button>
      </div>
    </div>

    <!-- Konten 3 panel -->
    <div class="theater-panels" id="theater-panels">

      <!-- Panel kiri: daftar video di ruangan ini -->
      <div class="theater-sidebar theater-panel" id="panel-list" data-panel="list">
        <div class="theater-sidebar-header">
          <span class="theater-sidebar-title">🎬 Daftar Video</span>
          <button class="theater-upload-btn" id="theater-upload-btn" title="Upload video baru">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload
          </button>
          <input type="file" id="theater-file-input-room" accept="video/*" style="display:none">
        </div>
        <div class="theater-upload-progress" id="theater-upload-progress-room" style="display:none">
          <div class="theater-upload-bar"><div class="theater-upload-fill" id="theater-upload-fill-room"></div></div>
          <span id="theater-upload-label-room">Mengupload…</span>
        </div>
        <!-- Input ganti link YouTube di dalam room -->
        <div class="theater-room-yt-row">
          <div class="theater-yt-input-row">
            <input type="text" id="theater-room-yt-input" placeholder="Ganti link YouTube…" autocomplete="off">
            <button class="theater-upload-btn" id="theater-room-yt-btn">▶</button>
          </div>
        </div>
        <div class="theater-video-list" id="theater-video-list">
          <div class="theater-empty-hint">Belum ada video.</div>
        </div>
      </div>

      <!-- Panel tengah: player -->
      <div class="theater-main theater-panel active" id="panel-player" data-panel="player">
        <div class="theater-player-wrap" id="theater-player-wrap">
          <div class="theater-no-video" id="theater-no-video">
            <div class="theater-no-video-icon">🎬</div>
            <div class="theater-no-video-text">Pilih video dari daftar untuk mulai nonton bareng</div>
          </div>
          <!-- Video dan iframe selalu di dalam slot dari awal -->
          <div id="theater-video-slot" style="position:absolute;inset:0;background:#000;">
            <video id="theater-video" preload="metadata" playsinline
              style="display:none;width:100%;height:100%;object-fit:contain;position:absolute;inset:0;"></video>
            <iframe id="theater-yt-frame"
              style="display:none;position:absolute;inset:0;width:100%;height:100%;border:none;"
              allow="autoplay; fullscreen"
              allowfullscreen></iframe>
          </div>
          <div class="theater-reaction-overlay" id="theater-reaction-overlay"></div>
        </div>

        <div class="theater-controls" id="theater-controls">
          <button class="theater-ctrl-btn" id="theater-play-btn" title="Play/Pause" disabled>
            <svg id="theater-play-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
          </button>
          <div class="theater-progress-wrap">
            <input type="range" id="theater-progress" min="0" max="100" value="0" step="0.1" disabled>
          </div>
          <span class="theater-time" id="theater-time">0:00 / 0:00</span>
          <input type="range" id="theater-volume" min="0" max="1" step="0.05" value="1" title="Volume" style="width:60px">
          <button class="theater-ctrl-btn" id="theater-mute-btn" title="Mute">🔊</button>
          <button class="theater-ctrl-btn" id="theater-fullscreen-btn" title="Fullscreen">⛶</button>
          <div class="theater-viewers-badge" id="theater-viewers-badge" title="Penonton">👀 0</div>
        </div>

        <div class="theater-reactions-bar">
          ${['👍','❤️','😂','😮','😢','🔥','👏','🎉'].map(e =>
            `<button class="theater-react-btn" data-emoji="${e}">${e}</button>`
          ).join('')}
        </div>
      </div>

      <!-- Panel kanan: chat -->
      <div class="theater-chat-panel theater-panel" id="panel-chat" data-panel="chat">
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
    </div>
  </div>
</div>`;
  }

  // -------------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------------
  function init(container) {
    _container = container;
    container.innerHTML = renderHTML();

    // Video dan iframe ada DI DALAM slot (fix mobile: video tidak tampil)
    videoEl = container.querySelector('#theater-video');

    socket = window._theaterSocket || (window.io ? window.io() : null);
    if (!socket && typeof io !== 'undefined') socket = io();

    meUser = window.ME || { id: null, nickname: 'Anonim', avatar: '👤' };

    if (!socket) {
      const hint = container.querySelector('.theater-no-video-text');
      if (hint) hint.textContent = 'Koneksi socket tidak tersedia. Buka Ruang Obrolan dulu.';
      return;
    }

    bindLobby(container);
    bindVideoEvents();
    bindControls(container);
    bindChat(container);
    bindUpload(container);
    bindReactions(container);
    bindMobileTabs(container);

    // Socket events
    socket.on('theater:rooms-list', (list) => {
      theaterRoomsList = list || [];
      renderRoomsList(container);
    });

    socket.on('theater:videos-list', (vids) => {
      videos = vids || [];
      renderVideoList(container);
    });

    socket.on('theater:video-added', (video) => {
      if (!videos.find(v => v.id === video.id)) videos.push(video);
      renderVideoList(container);
    });

    socket.on('theater:video-removed', (videoId) => {
      videos = videos.filter(v => v.id !== videoId);
      renderVideoList(container);
      // Jika video yang dihapus adalah yang sedang aktif, reset player
      if (currentState.currentVideo?.id === videoId) {
        currentState.currentVideo = null;
        currentState.isPlaying = false;
        if (videoEl) {
          suppressSync = true;
          videoEl.pause();
          videoEl.src = '';
          videoEl.style.display = 'none';
          suppressSync = false;
        }
        const noVid = container.querySelector('#theater-no-video');
        if (noVid) noVid.style.display = 'flex';
        const playBtn = container.querySelector('#theater-play-btn');
        const progressEl = container.querySelector('#theater-progress');
        if (playBtn) playBtn.disabled = true;
        if (progressEl) { progressEl.disabled = true; progressEl.value = 0; }
      }
    });

    // Jika ruangan dihapus (semua video di-delete), kembalikan ke lobby
    socket.on('theater:room-deleted', (roomId) => {
      theaterRoomsList = theaterRoomsList.filter(r => r.id !== roomId);
      if (currentRoomId === roomId) {
        // Paksa keluar ke lobby
        currentRoomId = null;
        currentRoomName = null;
        viewers = [];
        theaterMessages = [];
        videos = [];
        if (videoEl) {
          suppressSync = true;
          videoEl.pause();
          videoEl.src = '';
          videoEl.style.display = 'none';
          suppressSync = false;
        }
        const lobby = container.querySelector('#theater-lobby');
        const watch = container.querySelector('#theater-watch');
        if (watch) watch.style.display = 'none';
        if (lobby) lobby.style.display = 'flex';
        renderRoomsList(container);
        alert('Ruangan ini telah dihapus karena semua videonya dihapus.');
      } else {
        renderRoomsList(container);
      }
    });

    socket.on('theater:init', ({ state, videos: vids, viewers: vs, messages }) => {
      videos = vids || [];
      viewers = vs || [];
      theaterMessages = messages || [];
      renderVideoList(container);
      renderViewers(container);
      renderChatHistory(container);
      applyState(state, container);
      // Setelah join, pindah ke tab player di mobile agar langsung bisa lihat video
      if (isMobile()) {
        switchMobileTab(container, 'player');
      }
    });

    socket.on('theater:state', (state) => {
      applyState(state, container);
    });

    socket.on('theater:viewer-joined', (user) => {
      // Skip diri sendiri — sudah masuk via theater:init
      if (meUser && user.id === meUser.id) return;
      if (!viewers.find(v => v.id === user.id)) viewers.push(user);
      renderViewers(container);
    });

    socket.on('theater:viewer-left', (userId) => {
      viewers = viewers.filter(v => v.id !== userId);
      renderViewers(container);
    });

    socket.on('theater:viewers-count', (count) => {
      // Server adalah sumber kebenaran untuk jumlah penonton
      const el = container.querySelector('#theater-viewer-count');
      if (el) el.textContent = count + ' penonton';
      const badge = container.querySelector('#theater-viewers-badge');
      if (badge) badge.textContent = '👀 ' + count;
      // Update juga data di theaterRoomsList agar lobby akurat
      if (currentRoomId) {
        const room = theaterRoomsList.find(r => r.id === currentRoomId);
        if (room) room.memberCount = count;
      }
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

    socket.on('theater:yt-room-created', ({ roomId, roomName }) => {
      joinTheaterRoom(container, roomId, roomName);
    });

    socket.on('theater:error', (msg) => {
      alert('Theater error: ' + msg);
    });

    // Periodic sync
    syncInterval = setInterval(() => {
      if (!currentState.isPlaying || !videoEl || videoEl.paused || videoEl.ended) return;
      if (!currentState.lastSyncAt) return;
      const expected = expectedCurrentTime();
      const drift = videoEl.currentTime - expected;
      if (Math.abs(drift) > 5) {
        suppressSync = true;
        videoEl.currentTime = expected;
        setTimeout(() => { suppressSync = false; }, 800);
      }
    }, 5000);

    // Minta daftar rooms
    socket.emit('theater:get-rooms');
  }

  // -------------------------------------------------------------------------
  // Lobby: daftar ruangan & upload
  // -------------------------------------------------------------------------
  function bindLobby(container) {
    // Upload file
    const lobbyUploadBtn = container.querySelector('#theater-lobby-upload-btn');
    const fileInput = container.querySelector('#theater-file-input');
    lobbyUploadBtn?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', () => {
      const file = fileInput?.files?.[0];
      if (!file) return;
      doUpload(container, file, {
        progressWrapId: '#theater-upload-progress',
        fillId: '#theater-upload-fill',
        labelId: '#theater-upload-label',
        fileInput,
        onDone: (result) => {
          if (result.theaterRoomId) {
            joinTheaterRoom(container, result.theaterRoomId, meUser.nickname + "'s Room");
          }
        }
      });
    });

    // YouTube URL
    container.querySelector('#theater-yt-btn')?.addEventListener('click', () => {
      const input = container.querySelector('#theater-yt-input');
      const url = input?.value?.trim();
      if (!url) return;
      const ytId = extractYouTubeId(url);
      if (!ytId) { alert('URL YouTube tidak valid. Contoh: https://youtube.com/watch?v=xxxx'); return; }
      socket.emit('theater:create-yt-room', {
        ytId,
        ytUrl: url,
        uploaderName: meUser?.nickname || 'Anonim',
        uploaderId: meUser?.id || ''
      });
      if (input) input.value = '';
    });
    container.querySelector('#theater-yt-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') container.querySelector('#theater-yt-btn')?.click();
    });

    container.querySelector('#theater-back-btn')?.addEventListener('click', () => {
      leaveRoom(container);
    });
  }

  function extractYouTubeId(url) {
    try {
      const u = new URL(url);
      // youtube.com/watch?v=ID
      if (u.hostname.includes('youtube.com')) {
        const v = u.searchParams.get('v');
        if (v) return v;
        // youtube.com/live/ID atau /shorts/ID
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length >= 2 && ['live','shorts','embed'].includes(parts[0])) return parts[1];
      }
      // youtu.be/ID
      if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
    } catch(e) {}
    // fallback: coba regex
    const m = url.match(/(?:v=|youtu\.be\/|\/embed\/|\/live\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  // Upload helper — bisa dipakai dari lobby maupun dari dalam ruangan
  function doUpload(container, file, { progressWrapId, fillId, labelId, fileInput, onDone }) {
    const progressWrap = container.querySelector(progressWrapId);
    const fill = container.querySelector(fillId);
    const label = container.querySelector(labelId);
    if (progressWrap) progressWrap.style.display = 'block';

    const fd = new FormData();
    fd.append('video', file);
    fd.append('uploaderId', meUser.id || '');
    fd.append('uploaderName', meUser.nickname || 'Anonim');

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
      if (fileInput) fileInput.value = '';
      if (xhr.status !== 200) { alert('Upload gagal: ' + xhr.statusText); return; }
      try {
        const result = JSON.parse(xhr.responseText);
        if (onDone) onDone(result);
      } catch(e) {}
    });
    xhr.addEventListener('error', () => {
      if (progressWrap) progressWrap.style.display = 'none';
      alert('Upload error.');
    });
    xhr.send(fd);
  }

  function renderRoomsList(container) {
    const el = container.querySelector('#theater-lobby-rooms');
    if (!el) return;
    if (theaterRoomsList.length === 0) {
      el.innerHTML = '<div class="theater-empty-hint">Belum ada ruangan. Upload video untuk mulai!</div>';
      return;
    }
    el.innerHTML = theaterRoomsList.map(tr => `
      <div class="theater-room-card ${tr.id === currentRoomId ? 'active' : ''}" data-id="${tr.id}">
        <div class="theater-room-card-thumb">📺</div>
        <div class="theater-room-card-info">
          <div class="theater-room-card-name">${escHtml(tr.name)}</div>
          <div class="theater-room-card-meta">
            ${tr.memberCount > 0 ? `👀 ${tr.memberCount} penonton · ` : ''}
            ${tr.currentVideoName ? '🎬 ' + escHtml(tr.currentVideoName) : 'Tidak ada video'}
            ${tr.isPlaying ? ' · ▶ Sedang diputar' : ''}
          </div>
        </div>
        <button class="theater-room-join-btn ${tr.id === currentRoomId ? 'is-here' : ''}" data-id="${tr.id}">
          ${tr.id === currentRoomId ? '✓ Di sini' : 'Masuk'}
        </button>
      </div>
    `).join('');

    el.querySelectorAll('.theater-room-join-btn').forEach(btn => {
      // Semua tombol bisa diklik — termasuk "Di sini" (untuk rejoin jika koneksi bermasalah)
      btn.addEventListener('click', () => {
        const card = btn.closest('.theater-room-card');
        const rid = card.dataset.id;
        const rname = card.querySelector('.theater-room-card-name').textContent;
        // Jika sudah di room ini dan tampilan watch sudah aktif, tidak perlu join ulang
        const watchEl = container.querySelector('#theater-watch');
        if (rid === currentRoomId && watchEl && watchEl.style.display !== 'none') return;
        joinTheaterRoom(container, rid, rname);
      });
    });
  }

  function joinTheaterRoom(container, roomId, roomName) {
    // Jika sudah di room ini, tidak perlu join ulang
    if (currentRoomId === roomId) return;

    currentRoomId = roomId;
    currentRoomName = roomName;

    // Tampilkan area nonton
    const lobby = container.querySelector('#theater-lobby');
    const watch = container.querySelector('#theater-watch');
    if (lobby) lobby.style.display = 'none';
    if (watch) watch.style.display = 'flex';

    const nameBar = container.querySelector('#theater-room-name-bar');
    if (nameBar) nameBar.textContent = roomName;

    // Reset state player & viewers (akan diisi ulang dari theater:init)
    if (videoEl) {
      suppressSync = true;
      videoEl.pause();
      videoEl.src = '';
      videoEl.style.display = 'none';
      videoEl.style.opacity = '0';
      suppressSync = false;
    }
    const noVid = container.querySelector('#theater-no-video');
    if (noVid) noVid.style.display = 'flex';
    currentState = { currentVideo: null, isPlaying: false, currentTime: 0, hostId: null, lastSyncAt: null };
    viewers = [];
    theaterMessages = [];
    videos = [];
    renderViewers(container);
    renderVideoList(container);
    renderChatHistory(container);

    socket.emit('theater:join-room', roomId);
  }

  function leaveRoom(container) {
    socket.emit('theater:leave-room');

    // Reset DULU sebelum render, agar card tidak terjebak di '✓ Di sini'
    currentRoomId = null;
    currentRoomName = null;
    viewers = [];
    theaterMessages = [];

    if (videoEl) {
      suppressSync = true;
      videoEl.pause();
      videoEl.src = '';
      videoEl.style.display = 'none';
      videoEl.style.opacity = '0';
      suppressSync = false;
    }
    currentState = { currentVideo: null, isPlaying: false, currentTime: 0, hostId: null, lastSyncAt: null };

    const lobby = container.querySelector('#theater-lobby');
    const watch = container.querySelector('#theater-watch');
    if (watch) watch.style.display = 'none';
    if (lobby) lobby.style.display = 'flex';

    // Render ulang list segera dengan data yang sudah ada (currentRoomId sudah null)
    // Server akan kirim update via broadcastTheaterRoomList setelah leave
    renderRoomsList(container);
    socket.emit('theater:get-rooms');
  }

  // -------------------------------------------------------------------------
  // Mobile tabs
  // -------------------------------------------------------------------------
  function isMobile() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function bindMobileTabs(container) {
    container.querySelectorAll('.theater-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        switchMobileTab(container, btn.dataset.tab);
      });
    });
  }

  function switchMobileTab(container, tab) {
    mobileTab = tab;
    container.querySelectorAll('.theater-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    container.querySelectorAll('.theater-panel').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.panel === tab);
    });
    // Video sudah permanen di dalam slot — tidak perlu dipindahkan
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------
  function destroy() {
    if (socket) socket.emit('theater:leave-room');
    if (syncInterval) clearInterval(syncInterval);
    if (socket) {
      ['theater:rooms-list','theater:videos-list','theater:init','theater:state',
       'theater:video-added','theater:video-removed','theater:viewer-joined',
       'theater:viewer-left','theater:viewers-count','theater:user-updated',
       'theater:message','theater:reaction','theater:room-created','theater:error'
      ].forEach(e => socket.off(e));
    }
  }

  // -------------------------------------------------------------------------
  // Apply state dari server → update video player
  // -------------------------------------------------------------------------
  function applyState(state, container) {
    if (!state) return;
    currentState = state;

    const cont = container || _container;
    const noVideoEl = cont?.querySelector('#theater-no-video');
    const playBtn = cont?.querySelector('#theater-play-btn');
    const progressEl = cont?.querySelector('#theater-progress');
    const slot = cont?.querySelector('#theater-video-slot');
    const ytFrame = cont?.querySelector('#theater-yt-frame');

    if (state.currentVideo) {
      const isYT = !!state.currentVideo.ytId;

      if (isYT) {
        // Mode YouTube — sembunyikan video biasa, tampilkan iframe
        if (videoEl) {
          suppressSync = true;
          videoEl.pause();
          videoEl.src = '';
          videoEl.style.display = 'none';
          suppressSync = false;
        }
        if (noVideoEl) noVideoEl.style.display = 'none';
        if (ytFrame) {
          const embedUrl = `https://www.youtube-nocookie.com/embed/${state.currentVideo.ytId}?autoplay=1&rel=0`;
          if (ytFrame.getAttribute('data-yt-id') !== state.currentVideo.ytId) {
            ytFrame.setAttribute('data-yt-id', state.currentVideo.ytId);
            ytFrame.src = embedUrl;
          }
          ytFrame.style.display = 'block';
        }
        if (playBtn) playBtn.disabled = true;
        if (progressEl) { progressEl.disabled = true; progressEl.value = 0; }
        const timeEl = cont?.querySelector('#theater-time');
        if (timeEl) timeEl.textContent = '▶ YouTube Live';
        renderVideoList(cont);
        return;
      }

      // Mode video file
      if (ytFrame) { ytFrame.style.display = 'none'; ytFrame.src = ''; ytFrame.removeAttribute('data-yt-id'); }

      const newSrc = window.location.origin + state.currentVideo.url;
      if (videoEl.src !== newSrc) {
        suppressSync = true;
        if (noVideoEl) noVideoEl.style.display = 'none';
        videoEl.style.display = 'block';
        videoEl.src = state.currentVideo.url;
        videoEl.load();
        videoEl.addEventListener('loadedmetadata', () => {
          videoEl.currentTime = expectedCurrentTime();
          if (state.isPlaying) videoEl.play().catch(() => {});
          setTimeout(() => { suppressSync = false; }, 800);
          if (progressEl) progressEl.disabled = false;
          if (playBtn) playBtn.disabled = false;
        }, { once: true });
      } else {
        suppressSync = true;
        const target = expectedCurrentTime();
        if (Math.abs(videoEl.currentTime - target) > 1) videoEl.currentTime = target;
        if (state.isPlaying) {
          if (videoEl.paused) videoEl.play().catch(() => {});
        } else {
          if (!videoEl.paused) videoEl.pause();
        }
        setTimeout(() => { suppressSync = false; }, 800);
        if (playBtn) playBtn.disabled = false;
        if (progressEl) progressEl.disabled = false;
      }
      updatePlayIcon(state.isPlaying, cont);
      renderVideoList(cont);
    } else {
      if (ytFrame) { ytFrame.style.display = 'none'; ytFrame.src = ''; }
      if (videoEl) {
        suppressSync = true;
        videoEl.pause();
        videoEl.style.display = 'none';
        suppressSync = false;
      }
      if (noVideoEl) noVideoEl.style.display = 'flex';
      if (playBtn) playBtn.disabled = true;
      if (progressEl) progressEl.disabled = true;
    }
  }

  function expectedCurrentTime() {
    if (!currentState.isPlaying) return currentState.currentTime || 0;
    const syncAt = currentState.lastSyncAt || Date.now();
    const elapsed = Math.max(0, (Date.now() - syncAt) / 1000);
    return (currentState.currentTime || 0) + elapsed;
  }

  function updatePlayIcon(playing, container) {
    const cont = container || _container;
    const icon = cont?.querySelector('#theater-play-icon');
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
      const progressEl = _container?.querySelector('#theater-progress');
      const timeEl = _container?.querySelector('#theater-time');
      if (progressEl && videoEl.duration) {
        progressEl.value = (videoEl.currentTime / videoEl.duration) * 100;
      }
      if (timeEl) {
        timeEl.textContent = formatTime(videoEl.currentTime) + ' / ' + formatTime(videoEl.duration || 0);
      }
    });

    videoEl.addEventListener('play', () => {
      if (suppressSync) return;
      socket.emit('theater:play', { currentTime: videoEl.currentTime });
    });

    videoEl.addEventListener('pause', () => {
      if (suppressSync) return;
      if (videoEl.ended) return;
      socket.emit('theater:pause', { currentTime: videoEl.currentTime });
    });

    videoEl.addEventListener('seeked', () => {
      if (suppressSync) return;
      socket.emit('theater:seek', { currentTime: videoEl.currentTime });
    });

    videoEl.addEventListener('ended', () => {
      updatePlayIcon(false, _container);
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
      if (videoEl.paused || videoEl.ended) videoEl.play().catch(() => {});
      else videoEl.pause();
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
      // Di mobile, fullscreen langsung pada video element
      const target = isMobile() ? videoEl : container.querySelector('#theater-player-wrap');
      if (!document.fullscreenElement) target?.requestFullscreen?.();
      else document.exitFullscreen?.();
    });
  }

  // -------------------------------------------------------------------------
  // Bind chat
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
  // Bind upload di dalam ruangan
  // -------------------------------------------------------------------------
  function bindUpload(container) {
    const btn = container.querySelector('#theater-upload-btn');
    const fileInput = container.querySelector('#theater-file-input-room');

    btn?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', () => {
      const file = fileInput?.files?.[0];
      if (!file) return;
      doUpload(container, file, {
        progressWrapId: '#theater-upload-progress-room',
        fillId: '#theater-upload-fill-room',
        labelId: '#theater-upload-label-room',
        fileInput,
        onDone: () => {}
      });
    });

    // Ganti link YouTube di dalam room
    const roomYtBtn = container.querySelector('#theater-room-yt-btn');
    const roomYtInput = container.querySelector('#theater-room-yt-input');
    roomYtBtn?.addEventListener('click', () => {
      const url = roomYtInput?.value?.trim();
      if (!url) return;
      const ytId = extractYouTubeId(url);
      if (!ytId) { alert('URL YouTube tidak valid'); return; }
      socket.emit('theater:change-yt-video', { ytId, ytUrl: url });
      if (roomYtInput) roomYtInput.value = '';
      // Pindah ke tab player di mobile
      if (isMobile()) switchMobileTab(container, 'player');
    });
    roomYtInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') roomYtBtn?.click();
    });
  }

  // -------------------------------------------------------------------------
  // Bind reactions
  // -------------------------------------------------------------------------
  function bindReactions(container) {
    container.querySelectorAll('.theater-react-btn').forEach(btn => {
      btn.addEventListener('click', () => socket?.emit('theater:react', btn.dataset.emoji));
    });
  }

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  function renderVideoList(container) {
    const cont = container || _container;
    const list = cont?.querySelector('#theater-video-list');
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
        // Di mobile, pindah ke tab player setelah pilih video
        if (isMobile()) switchMobileTab(cont, 'player');
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
    const cont = container || _container;
    const badge = cont?.querySelector('#theater-viewers-badge');
    const countEl = cont?.querySelector('#theater-viewer-count');
    if (badge) badge.textContent = '👀 ' + viewers.length;
    if (countEl) countEl.textContent = viewers.length + ' penonton';
  }

  function renderChatHistory(container) {
    const cont = container || _container;
    const msgs = cont?.querySelector('#theater-chat-messages');
    if (!msgs) return;
    msgs.innerHTML = '';
    theaterMessages.forEach(m => appendChatMessage(cont, m, false));
    msgs.scrollTop = msgs.scrollHeight;
  }

  function appendChatMessage(container, msg, scroll = true) {
    const cont = container || _container;
    const msgs = cont?.querySelector('#theater-chat-messages');
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
    const cont = container || _container;
    const overlay = cont?.querySelector('#theater-reaction-overlay');
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
  // Daftar ke Desktop
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
