// public/js/watchme.js
// Watch Me — Step 3
// Fitur berbagi layar (screen share) + chat samping.
// Satu orang jadi "Broadcaster", yang lain jadi "Penonton".
// Menggunakan WebRTC (peer-to-peer) + Socket.IO sebagai sinyal.
// Mengikuti pola registerApp yang sama dengan theater.js.

(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  let socket = null;
  let meUser = null;

  // WebRTC
  let localStream = null;           // MediaStream dari getDisplayMedia
  const peerConnections = new Map(); // peerId -> RTCPeerConnection

  // State ruangan Watch Me
  let wmRooms = [];                  // daftar sesi aktif
  let currentRoomId = null;
  let myRole = null;                 // 'broadcaster' | 'viewer' | null
  let viewers = [];
  let wmMessages = [];

  let _container = null;

  // RTC config — pakai STUN publik Google (cukup untuk LAN, tidak perlu TURN)
  const RTC_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // -------------------------------------------------------------------------
  // HTML
  // -------------------------------------------------------------------------
  function renderHTML() {
    return `
<div class="wm-root" id="wm-root">

  <!-- ======= LOBBY ======= -->
  <div class="wm-lobby" id="wm-lobby">
    <div class="wm-lobby-header">
      <span class="wm-lobby-title">🖥️ Watch Me</span>
      <span class="wm-lobby-hint">Bagikan layarmu, atau tonton layar orang lain di jaringan yang sama.</span>
    </div>

    <button class="wm-start-btn" id="wm-start-btn">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/></svg>
      Mulai Bagikan Layarku
    </button>

    <div class="wm-divider">— atau tonton sesi yang sedang aktif —</div>

    <div class="wm-rooms-list" id="wm-rooms-list">
      <div class="wm-empty-hint">Belum ada sesi aktif. Jadilah yang pertama berbagi layar!</div>
    </div>
  </div>

  <!-- ======= AREA NONTON ======= -->
  <div class="wm-watch" id="wm-watch" style="display:none">

    <div class="wm-room-bar">
      <button class="wm-back-btn" id="wm-back-btn">← Kembali</button>
      <span class="wm-room-name" id="wm-room-name">Sesi</span>
      <span class="wm-role-badge" id="wm-role-badge"></span>
      <!-- Mobile tabs -->
      <div class="wm-mobile-tabs" id="wm-mobile-tabs">
        <button class="wm-tab active" data-tab="screen">🖥️ Layar</button>
        <button class="wm-tab" data-tab="chat">💬 Chat</button>
      </div>
    </div>

    <div class="wm-panels">

      <!-- Panel kiri: video/layar -->
      <div class="wm-screen-panel wm-panel active" data-panel="screen">

        <!-- Broadcaster: preview layar sendiri + kontrol -->
        <div class="wm-broadcaster-controls" id="wm-broadcaster-controls" style="display:none">
          <div class="wm-bc-status" id="wm-bc-status">
            <span class="wm-bc-dot"></span>
            <span id="wm-bc-label">Sedang berbagi layar…</span>
          </div>
          <button class="wm-ctrl-btn" id="wm-stop-btn" title="Hentikan siaran">
            ⏹ Hentikan
          </button>
          <button class="wm-ctrl-btn" id="wm-fullscreen-btn-bc" title="Fullscreen preview">⛶</button>
        </div>

        <div class="wm-video-wrap" id="wm-video-wrap">
          <div class="wm-no-screen" id="wm-no-screen">
            <div class="wm-no-screen-icon">🖥️</div>
            <div class="wm-no-screen-text" id="wm-no-screen-text">
              Menunggu siaran…
            </div>
          </div>
          <!-- video untuk broadcaster (preview) -->
          <video id="wm-local-video" autoplay muted playsinline
            style="display:none;width:100%;height:100%;object-fit:contain;background:#000;position:absolute;inset:0;"></video>
          <!-- video untuk viewer (stream dari broadcaster) -->
          <video id="wm-remote-video" autoplay playsinline
            style="display:none;width:100%;height:100%;object-fit:contain;background:#000;position:absolute;inset:0;"></video>
        </div>

        <!-- Kontrol viewer -->
        <div class="wm-viewer-controls" id="wm-viewer-controls" style="display:none">
          <button class="wm-ctrl-btn" id="wm-mute-viewer" title="Mute/Unmute">🔊</button>
          <input type="range" id="wm-volume-viewer" min="0" max="1" step="0.05" value="1" style="width:80px" title="Volume">
          <button class="wm-ctrl-btn" id="wm-fullscreen-btn-viewer" title="Fullscreen">⛶</button>
          <span class="wm-viewer-count" id="wm-viewer-count">👀 0 penonton</span>
        </div>

        <!-- Emoji reactions -->
        <div class="wm-reactions-bar">
          ${['👍','❤️','😂','😮','🔥','👏','🎉','😱'].map(e =>
            `<button class="wm-react-btn" data-emoji="${e}">${e}</button>`
          ).join('')}
        </div>

        <!-- Floating reactions overlay -->
        <div class="wm-reaction-overlay" id="wm-reaction-overlay"></div>
      </div>

      <!-- Panel kanan: chat -->
      <div class="wm-chat-panel wm-panel" data-panel="chat">
        <div class="wm-chat-header">
          <span>💬 Chat</span>
          <span class="wm-chat-count" id="wm-chat-count">0 penonton</span>
        </div>
        <div class="wm-chat-messages" id="wm-chat-messages"></div>
        <div class="wm-chat-input-row">
          <input type="text" id="wm-chat-input" placeholder="Tulis komentar…" maxlength="200" autocomplete="off">
          <button id="wm-chat-send">Kirim</button>
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

    socket = window._theaterSocket || (typeof io !== 'undefined' ? io() : null);
    meUser = window.ME || { id: null, nickname: 'Anonim', avatar: '👤' };

    if (!socket) {
      container.querySelector('#wm-no-screen-text').textContent = 'Koneksi socket tidak tersedia. Buka Ruang Obrolan dulu.';
      return;
    }

    bindLobby(container);
    bindMobileTabs(container);
    registerSocketEvents(container);

    // Minta daftar sesi aktif
    socket.emit('watchme:get-rooms');
  }

  // -------------------------------------------------------------------------
  // Lobby
  // -------------------------------------------------------------------------
  function bindLobby(container) {
    container.querySelector('#wm-start-btn')?.addEventListener('click', () => startBroadcast(container));
    container.querySelector('#wm-back-btn')?.addEventListener('click', () => leaveRoom(container));
  }

  function renderRoomsList(container) {
    const el = container.querySelector('#wm-rooms-list');
    if (!el) return;
    if (wmRooms.length === 0) {
      el.innerHTML = '<div class="wm-empty-hint">Belum ada sesi aktif. Jadilah yang pertama berbagi layar!</div>';
      return;
    }
    el.innerHTML = wmRooms.map(r => `
      <div class="wm-room-card" data-id="${r.id}">
        <div class="wm-room-card-icon">🖥️</div>
        <div class="wm-room-card-info">
          <div class="wm-room-card-name">${escHtml(r.name)}</div>
          <div class="wm-room-card-meta">
            <span class="wm-live-dot"></span> LIVE
            ${r.viewerCount > 0 ? ` · 👀 ${r.viewerCount} penonton` : ''}
          </div>
        </div>
        <button class="wm-room-join-btn" data-id="${r.id}">Tonton</button>
      </div>
    `).join('');

    el.querySelectorAll('.wm-room-join-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const roomId = btn.dataset.id;
        const card = btn.closest('.wm-room-card');
        const name = card.querySelector('.wm-room-card-name').textContent;
        joinAsViewer(container, roomId, name);
      });
    });
  }

  // -------------------------------------------------------------------------
  // Broadcaster — mulai share layar
  // -------------------------------------------------------------------------
  async function startBroadcast(container) {
    try {
      localStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always', displaySurface: 'monitor' },
        audio: true
      });
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') return; // user cancel
      alert('Gagal mendapatkan akses layar: ' + err.message);
      return;
    }

    myRole = 'broadcaster';

    // Tampilkan preview lokal
    const localVideo = container.querySelector('#wm-local-video');
    if (localVideo) {
      localVideo.srcObject = localStream;
      localVideo.style.display = 'block';
    }

    // Buat sesi di server
    socket.emit('watchme:create-room', {
      broadcasterName: meUser.nickname,
      broadcasterId: meUser.id
    });

    // Tangani jika user stop share dari OS (klik Stop Sharing di browser)
    localStream.getVideoTracks()[0].addEventListener('ended', () => {
      leaveRoom(container);
    });
  }

  // -------------------------------------------------------------------------
  // Viewer — join sesi
  // -------------------------------------------------------------------------
  function joinAsViewer(container, roomId, roomName) {
    myRole = 'viewer';
    currentRoomId = roomId;

    socket.emit('watchme:join-room', { roomId });
    showWatchArea(container, roomName, 'viewer');
  }

  // -------------------------------------------------------------------------
  // Tampilkan area nonton (setelah create atau join)
  // -------------------------------------------------------------------------
  function showWatchArea(container, roomName, role) {
    container.querySelector('#wm-lobby').style.display = 'none';
    const watch = container.querySelector('#wm-watch');
    watch.style.display = 'flex';

    container.querySelector('#wm-room-name').textContent = roomName;
    const roleBadge = container.querySelector('#wm-role-badge');
    roleBadge.textContent = role === 'broadcaster' ? '🔴 Broadcaster' : '👀 Penonton';
    roleBadge.className = 'wm-role-badge ' + (role === 'broadcaster' ? 'is-broadcaster' : 'is-viewer');

    const noScreen = container.querySelector('#wm-no-screen');
    const bcControls = container.querySelector('#wm-broadcaster-controls');
    const viewerControls = container.querySelector('#wm-viewer-controls');

    if (role === 'broadcaster') {
      if (noScreen) noScreen.style.display = 'none';
      if (bcControls) bcControls.style.display = 'flex';
      if (viewerControls) viewerControls.style.display = 'none';
      bindBroadcasterControls(container);
    } else {
      if (noScreen) noScreen.style.display = 'flex';
      if (bcControls) bcControls.style.display = 'none';
      if (viewerControls) viewerControls.style.display = 'flex';
      bindViewerControls(container);
    }

    bindChat(container);
    bindReactions(container);
  }

  // -------------------------------------------------------------------------
  // Kontrol broadcaster
  // -------------------------------------------------------------------------
  function bindBroadcasterControls(container) {
    container.querySelector('#wm-stop-btn')?.addEventListener('click', () => leaveRoom(container));

    container.querySelector('#wm-fullscreen-btn-bc')?.addEventListener('click', () => {
      const v = container.querySelector('#wm-local-video');
      if (!document.fullscreenElement) v?.requestFullscreen?.();
      else document.exitFullscreen?.();
    });
  }

  // -------------------------------------------------------------------------
  // Kontrol viewer
  // -------------------------------------------------------------------------
  function bindViewerControls(container) {
    const remoteVideo = container.querySelector('#wm-remote-video');

    container.querySelector('#wm-mute-viewer')?.addEventListener('click', () => {
      if (!remoteVideo) return;
      remoteVideo.muted = !remoteVideo.muted;
      container.querySelector('#wm-mute-viewer').textContent = remoteVideo.muted ? '🔇' : '🔊';
    });

    container.querySelector('#wm-volume-viewer')?.addEventListener('input', (e) => {
      if (remoteVideo) remoteVideo.volume = parseFloat(e.target.value);
    });

    container.querySelector('#wm-fullscreen-btn-viewer')?.addEventListener('click', () => {
      if (!document.fullscreenElement) remoteVideo?.requestFullscreen?.();
      else document.exitFullscreen?.();
    });
  }

  // -------------------------------------------------------------------------
  // Chat
  // -------------------------------------------------------------------------
  function bindChat(container) {
    const input = container.querySelector('#wm-chat-input');
    const sendBtn = container.querySelector('#wm-chat-send');

    function send() {
      const text = input?.value?.trim();
      if (!text || !socket) return;
      socket.emit('watchme:message-send', text);
      input.value = '';
    }

    sendBtn?.addEventListener('click', send);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
  }

  function appendChatMessage(container, msg, scroll = true) {
    const cont = container || _container;
    const msgs = cont?.querySelector('#wm-chat-messages');
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = 'wm-chat-msg' + (msg.system ? ' wm-chat-msg--system' : '');
    if (msg.system) {
      div.innerHTML = `<span class="wm-chat-system-text">${escHtml(msg.text)}</span>`;
    } else {
      const isMe = meUser && msg.authorId === meUser.id;
      div.classList.toggle('wm-chat-msg--me', isMe);
      div.innerHTML = `
        <span class="wm-chat-avatar">${msg.avatar || '💬'}</span>
        <div class="wm-chat-bubble-wrap">
          <span class="wm-chat-nick">${escHtml(msg.nickname)}</span>
          <div class="wm-chat-bubble">${escHtml(msg.text)}</div>
        </div>`;
    }
    msgs.appendChild(div);
    if (scroll) msgs.scrollTop = msgs.scrollHeight;
  }

  // -------------------------------------------------------------------------
  // Reactions
  // -------------------------------------------------------------------------
  function bindReactions(container) {
    container.querySelectorAll('.wm-react-btn').forEach(btn => {
      btn.addEventListener('click', () => socket?.emit('watchme:react', btn.dataset.emoji));
    });
  }

  function showFloatingReaction(container, emoji, nickname) {
    const overlay = (container || _container)?.querySelector('#wm-reaction-overlay');
    if (!overlay) return;
    const el = document.createElement('div');
    el.className = 'wm-float-reaction';
    el.style.left = (10 + Math.random() * 80) + '%';
    el.innerHTML = `<span class="wm-float-emoji">${emoji}</span><span class="wm-float-name">${escHtml(nickname)}</span>`;
    overlay.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  // -------------------------------------------------------------------------
  // Mobile tabs
  // -------------------------------------------------------------------------
  function bindMobileTabs(container) {
    container.querySelectorAll('.wm-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.wm-tab').forEach(b => b.classList.toggle('active', b === btn));
        container.querySelectorAll('.wm-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === btn.dataset.tab));
      });
    });
  }

  // -------------------------------------------------------------------------
  // Leave / cleanup
  // -------------------------------------------------------------------------
  function leaveRoom(container) {
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }

    // Close semua peer connections
    peerConnections.forEach(pc => pc.close());
    peerConnections.clear();

    // Beri tahu server
    if (socket && currentRoomId) {
      socket.emit('watchme:leave-room');
    }

    currentRoomId = null;
    myRole = null;
    viewers = [];
    wmMessages = [];

    // Reset UI
    const localVideo = container.querySelector('#wm-local-video');
    const remoteVideo = container.querySelector('#wm-remote-video');
    if (localVideo) { localVideo.srcObject = null; localVideo.style.display = 'none'; }
    if (remoteVideo) { remoteVideo.srcObject = null; remoteVideo.style.display = 'none'; }

    const noScreen = container.querySelector('#wm-no-screen');
    if (noScreen) { noScreen.style.display = 'flex'; }

    const chat = container.querySelector('#wm-chat-messages');
    if (chat) chat.innerHTML = '';

    container.querySelector('#wm-lobby').style.display = 'flex';
    container.querySelector('#wm-watch').style.display = 'none';

    // Refresh daftar ruangan
    socket?.emit('watchme:get-rooms');
  }

  function destroy() {
    leaveRoom(_container || document.createElement('div'));
    if (socket) {
      ['watchme:rooms-list','watchme:room-created','watchme:viewer-joined',
       'watchme:viewer-left','watchme:viewers-count','watchme:message',
       'watchme:reaction','watchme:room-ended','watchme:error',
       'watchme:offer','watchme:answer','watchme:ice-candidate'
      ].forEach(e => socket.off(e));
    }
  }

  // -------------------------------------------------------------------------
  // WebRTC — Signaling via Socket.IO
  // -------------------------------------------------------------------------

  /** Broadcaster membuat offer untuk viewer baru */
  async function createOfferFor(viewerId) {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnections.set(viewerId, pc);

    // Tambahkan track dari localStream ke peer connection
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('watchme:ice-candidate', { to: viewerId, candidate: e.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        pc.close();
        peerConnections.delete(viewerId);
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('watchme:offer', { to: viewerId, offer });
  }

  /** Viewer menerima offer dari broadcaster */
  async function handleOffer(container, { from, offer }) {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnections.set(from, pc);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('watchme:ice-candidate', { to: from, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      const remoteVideo = container.querySelector('#wm-remote-video');
      if (!remoteVideo) return;
      if (!remoteVideo.srcObject) {
        remoteVideo.srcObject = new MediaStream();
        remoteVideo.style.display = 'block';
        const noScreen = container.querySelector('#wm-no-screen');
        if (noScreen) noScreen.style.display = 'none';
      }
      remoteVideo.srcObject.addTrack(e.track);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        pc.close();
        peerConnections.delete(from);
        // Tampilkan pesan koneksi terputus
        const noScreen = container.querySelector('#wm-no-screen');
        const noScreenText = container.querySelector('#wm-no-screen-text');
        if (noScreen) noScreen.style.display = 'flex';
        if (noScreenText) noScreenText.textContent = 'Koneksi ke broadcaster terputus.';
        const remoteVideo = container.querySelector('#wm-remote-video');
        if (remoteVideo) { remoteVideo.style.display = 'none'; remoteVideo.srcObject = null; }
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('watchme:answer', { to: from, answer });
  }

  /** Terima answer dari viewer (sisi broadcaster) */
  async function handleAnswer({ from, answer }) {
    const pc = peerConnections.get(from);
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  /** Terima ICE candidate */
  async function handleIceCandidate({ from, candidate }) {
    const pc = peerConnections.get(from);
    if (!pc) return;
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e) {}
  }

  // -------------------------------------------------------------------------
  // Socket events
  // -------------------------------------------------------------------------
  function registerSocketEvents(container) {
    // Daftar sesi aktif
    socket.on('watchme:rooms-list', (list) => {
      wmRooms = list || [];
      renderRoomsList(container);
    });

    // Broadcaster: sesi berhasil dibuat
    socket.on('watchme:room-created', ({ roomId, roomName }) => {
      currentRoomId = roomId;
      showWatchArea(container, roomName, 'broadcaster');
    });

    // Broadcaster: ada viewer baru masuk → kirim offer
    socket.on('watchme:viewer-joined', ({ viewerId, viewerNickname, viewerAvatar }) => {
      viewers.push({ id: viewerId, nickname: viewerNickname, avatar: viewerAvatar });
      updateViewerCount(container);
      // Jika kita broadcaster, buat offer untuk viewer baru ini
      if (myRole === 'broadcaster' && localStream) {
        createOfferFor(viewerId);
      }
    });

    socket.on('watchme:viewer-left', (viewerId) => {
      viewers = viewers.filter(v => v.id !== viewerId);
      updateViewerCount(container);
      const pc = peerConnections.get(viewerId);
      if (pc) { pc.close(); peerConnections.delete(viewerId); }
    });

    socket.on('watchme:viewers-count', (count) => {
      updateViewerCount(container, count);
    });

    // WebRTC signaling
    socket.on('watchme:offer', ({ from, offer }) => handleOffer(container, { from, offer }));
    socket.on('watchme:answer', ({ from, answer }) => handleAnswer({ from, answer }));
    socket.on('watchme:ice-candidate', ({ from, candidate }) => handleIceCandidate({ from, candidate }));

    // Chat
    socket.on('watchme:message', (msg) => {
      appendChatMessage(container, msg);
    });

    // Reactions
    socket.on('watchme:reaction', ({ nickname, emoji }) => {
      showFloatingReaction(container, emoji, nickname);
    });

    // Sesi berakhir (broadcaster keluar)
    socket.on('watchme:room-ended', () => {
      alert('Sesi telah berakhir. Broadcaster menghentikan siaran.');
      leaveRoom(container);
    });

    socket.on('watchme:error', (msg) => {
      alert('Watch Me error: ' + msg);
    });

    // History chat saat join
    socket.on('watchme:init', ({ viewers: vs, messages }) => {
      viewers = vs || [];
      wmMessages = messages || [];
      updateViewerCount(container);
      const chat = container.querySelector('#wm-chat-messages');
      if (chat) chat.innerHTML = '';
      wmMessages.forEach(m => appendChatMessage(container, m, false));
      const msgs = container.querySelector('#wm-chat-messages');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    });
  }

  function updateViewerCount(container, count) {
    const n = count !== undefined ? count : viewers.length;
    const vcEl = (container || _container)?.querySelector('#wm-viewer-count');
    const chatCountEl = (container || _container)?.querySelector('#wm-chat-count');
    if (vcEl) vcEl.textContent = `👀 ${n} penonton`;
    if (chatCountEl) chatCountEl.textContent = `${n} penonton`;
  }

  // -------------------------------------------------------------------------
  // Utils
  // -------------------------------------------------------------------------
  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // -------------------------------------------------------------------------
  // Register ke Desktop
  // -------------------------------------------------------------------------
  window.addEventListener('DOMContentLoaded', () => {
    if (typeof Desktop === 'undefined') return;
    Desktop.registerApp('watchme', {
      icon: '🖥️',
      title: 'Watch Me',
      render(container) {
        init(container);
      }
    });
  });
})();
