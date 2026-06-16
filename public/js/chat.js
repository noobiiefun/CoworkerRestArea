// chat.js
// Step 1: Ruang Obrolan — boot/check-in screen, koneksi Socket.IO,
// daftar ruangan (publik + privat), daftar online, kirim pesan,
// ganti nickname & avatar.
//
// STEP 2 ADDITION:
// Setelah socket dibuat dan user diketahui, expose ke global agar theater.js bisa pakai:
//   window._theaterSocket = socket
//   window.ME             = { id, nickname, avatar }

(() => {
  const socket = io();

  // Expose socket ke theater.js segera setelah dibuat
  window._theaterSocket = socket;

  const state = {
    me: null,                 // {id, nickname, avatar}
    avatarChoices: [],
    users: [],                // online users
    rooms: [],                // room summaries relevan utk user ini
    activeRoomId: 'lobby',
    messagesByRoom: {}        // roomId -> array pesan (cache di memori browser saja)
  };

  let chatUI = null; // referensi elemen DOM saat window chat sedang terbuka
  let selectedBootAvatar = null;

  // ===================== BOOT SCREEN =====================
  const bootScreen = document.getElementById('boot-screen');
  const bootAvatarGrid = document.getElementById('boot-avatar-grid');
  const bootNickname = document.getElementById('boot-nickname');
  const bootEnterBtn = document.getElementById('boot-enter-btn');

  function renderBootAvatarGrid() {
    bootAvatarGrid.innerHTML = '';
    state.avatarChoices.forEach((a) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = a;
      if (a === selectedBootAvatar) btn.classList.add('selected');
      btn.addEventListener('click', () => {
        selectedBootAvatar = a;
        renderBootAvatarGrid();
      });
      bootAvatarGrid.appendChild(btn);
    });
  }

  bootEnterBtn.addEventListener('click', enterRestArea);
  bootNickname.addEventListener('keydown', (e) => { if (e.key === 'Enter') enterRestArea(); });

  function enterRestArea() {
    const nickname = bootNickname.value.trim() || state.me.nickname;
    const avatar = selectedBootAvatar || state.me.avatar;
    if (nickname !== state.me.nickname) socket.emit('user:set-nickname', nickname);
    if (avatar !== state.me.avatar) socket.emit('user:set-avatar', avatar);

    bootScreen.classList.add('hidden');
    document.getElementById('desktop').classList.remove('hidden');
    Desktop.registerApp('chat', { icon: '💬', title: 'Ruang Obrolan', render: renderChatApp });
    Desktop.openApp('chat');
  }

  // ===================== SOCKET EVENTS =====================
  socket.on('me:init', (data) => {
    state.me = data.me;
    state.avatarChoices = data.avatarChoices;
    state.rooms = data.rooms;
    state.messagesByRoom['lobby'] = data.lobbyMessages || [];
    selectedBootAvatar = state.me.avatar;
    bootNickname.value = state.me.nickname;

    // Expose user ke global untuk theater.js
    window.ME = state.me;

    renderBootAvatarGrid();
  });

  socket.on('users:list', (list) => {
    state.users = list;
    const countEl = document.getElementById('online-count');
    if (countEl) countEl.textContent = '👥 ' + list.length;
    renderUserList();
    renderInviteList();
  });

  socket.on('rooms:list', (list) => {
    state.rooms = list;
    list.forEach((r) => { if (!state.messagesByRoom[r.id]) state.messagesByRoom[r.id] = []; });
    renderRoomList();
    renderChatHeader();
  });

  socket.on('user:updated', (u) => {
    if (state.me && u.id === state.me.id) {
      state.me = u;
      // Selalu update window.ME supaya theater.js punya data nickname/avatar terbaru
      window.ME = state.me;
      renderProfileCard();
    }
  });

  socket.on('message:new', ({ roomId, message }) => {
    if (!state.messagesByRoom[roomId]) state.messagesByRoom[roomId] = [];
    state.messagesByRoom[roomId].push(message);
    if (roomId === state.activeRoomId) appendMessageEl(message);
  });

  socket.on('room:history', ({ roomId, messages }) => {
    state.messagesByRoom[roomId] = messages;
    if (roomId === state.activeRoomId) renderMessages();
  });

  socket.on('room:invited', (room) => {
    if (!state.messagesByRoom[room.id]) state.messagesByRoom[room.id] = [];
    switchRoom(room.id);
  });

  socket.on('room:error', (msg) => {
    if (chatUI && chatUI.createRoomError) {
      chatUI.createRoomError.textContent = msg;
      chatUI.createRoomError.classList.remove('hidden');
    }
  });

  // ===================== CHAT APP UI =====================
  function renderChatApp(bodyEl) {
    bodyEl.innerHTML = `
      <div class="chat-app">
        <div class="chat-sidebar">
          <div class="profile-card">
            <button class="profile-avatar-btn" id="cw-avatar-btn"></button>
            <div class="profile-meta">
              <button class="profile-nickname-btn" id="cw-nickname-btn"></button>
              <div class="profile-tag">● online</div>
            </div>
          </div>

          <div class="sidebar-section">
            <span>Ruangan</span>
            <button class="sidebar-add-btn" id="cw-create-room-btn" title="Buat ruang privat">+</button>
          </div>
          <div class="room-list" id="cw-room-list"></div>

          <div class="sidebar-section"><span>Online</span></div>
          <div class="user-list" id="cw-user-list"></div>
        </div>

        <div class="chat-main">
          <div class="chat-header">
            <span class="ch-name" id="cw-room-name">Lobby Utama</span>
            <span class="ch-meta" id="cw-room-meta"></span>
          </div>
          <div class="message-list" id="cw-message-list"></div>
          <div class="composer">
            <input type="text" id="cw-composer-input" class="text-input" maxlength="1000" placeholder="Tulis pesan… (anonim, tidak disimpan)" />
            <button id="cw-composer-send">Kirim</button>
          </div>
        </div>
      </div>
    `;

    chatUI = {
      avatarBtn: bodyEl.querySelector('#cw-avatar-btn'),
      nicknameBtn: bodyEl.querySelector('#cw-nickname-btn'),
      roomList: bodyEl.querySelector('#cw-room-list'),
      userList: bodyEl.querySelector('#cw-user-list'),
      roomName: bodyEl.querySelector('#cw-room-name'),
      roomMeta: bodyEl.querySelector('#cw-room-meta'),
      messageList: bodyEl.querySelector('#cw-message-list'),
      composerInput: bodyEl.querySelector('#cw-composer-input'),
      composerSend: bodyEl.querySelector('#cw-composer-send'),
      createRoomBtn: bodyEl.querySelector('#cw-create-room-btn'),
      root: bodyEl,
      createRoomError: null
    };

    chatUI.avatarBtn.addEventListener('click', openAvatarModal);
    chatUI.nicknameBtn.addEventListener('click', openNicknameModal);
    chatUI.createRoomBtn.addEventListener('click', openCreateRoomModal);
    chatUI.composerSend.addEventListener('click', sendMessage);
    chatUI.composerInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });

    renderProfileCard();
    renderRoomList();
    renderUserList();
    renderChatHeader();
    switchRoom(state.activeRoomId, { silent: true });
    renderMessages();
  }

  function renderProfileCard() {
    if (!chatUI || !state.me) return;
    chatUI.avatarBtn.textContent = state.me.avatar;
    chatUI.nicknameBtn.textContent = state.me.nickname;
  }

  function renderRoomList() {
    if (!chatUI) return;
    chatUI.roomList.innerHTML = '';
    state.rooms.forEach((room) => {
      const item = document.createElement('button');
      item.className = 'room-item' + (room.id === state.activeRoomId ? ' active' : '');
      item.innerHTML = `
        <span class="room-glyph">${room.type === 'private' ? '🔒' : '💬'}</span>
        <span class="rt">${escapeHtml(room.name)}</span>
        <span class="rc">${room.memberCount}</span>
      `;
      item.addEventListener('click', () => switchRoom(room.id));
      chatUI.roomList.appendChild(item);
    });
  }

  function renderUserList() {
    if (!chatUI) return;
    chatUI.userList.innerHTML = '';
    state.users.forEach((u) => {
      const row = document.createElement('div');
      row.className = 'user-row' + (state.me && u.id === state.me.id ? ' is-me' : '');
      row.innerHTML = `<span class="dot"></span><span>${u.avatar}</span><span class="un">${escapeHtml(u.nickname)}</span>`;
      chatUI.userList.appendChild(row);
    });
  }

  function renderChatHeader() {
    if (!chatUI) return;
    const room = state.rooms.find((r) => r.id === state.activeRoomId);
    if (!room) return;
    chatUI.roomName.textContent = (room.type === 'private' ? '🔒 ' : '💬 ') + room.name;
    chatUI.roomMeta.textContent = room.memberCount + ' orang di ruangan ini';
  }

  function switchRoom(roomId, opts = {}) {
    state.activeRoomId = roomId;
    socket.emit('room:join', roomId);
    if (!opts.silent) {
      renderRoomList();
      renderChatHeader();
      renderMessages();
    }
  }

  function renderMessages() {
    if (!chatUI) return;
    chatUI.messageList.innerHTML = '';
    const msgs = state.messagesByRoom[state.activeRoomId] || [];
    msgs.forEach(appendMessageEl);
  }

  function appendMessageEl(message) {
    if (!chatUI || message === undefined) return;
    const row = document.createElement('div');
    const isSelf = state.me && message.authorId === state.me.id;
    row.className = 'msg-row' + (message.system ? ' is-system' : '') + (isSelf && !message.system ? ' is-self' : '');
    const time = new Date(message.time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    if (message.system) {
      row.innerHTML = `<div class="msg-bubble"><div class="msg-text">${escapeHtml(message.text)}</div></div>`;
    } else {
      row.innerHTML = `
        <div class="msg-avatar">${message.avatar}</div>
        <div class="msg-bubble">
          <div class="msg-meta"><span class="msg-name">${escapeHtml(message.nickname)}</span><span class="msg-time">${time}</span></div>
          <div class="msg-text"></div>
        </div>
      `;
      row.querySelector('.msg-text').textContent = message.text;
    }
    chatUI.messageList.appendChild(row);
    chatUI.messageList.scrollTop = chatUI.messageList.scrollHeight;
  }

  function sendMessage() {
    if (!chatUI) return;
    const text = chatUI.composerInput.value.trim();
    if (!text) return;
    socket.emit('message:send', { roomId: state.activeRoomId, text });
    chatUI.composerInput.value = '';
    chatUI.composerInput.focus();
  }

  // ===================== MODALS =====================
  function openModal(buildFn) {
    if (!chatUI) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const card = document.createElement('div');
    card.className = 'modal-card';
    overlay.appendChild(card);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    chatUI.root.appendChild(overlay);
    buildFn(card, () => overlay.remove());
    return card;
  }

  function openAvatarModal() {
    openModal((card, close) => {
      card.innerHTML = '<h3>Pilih ikon baru</h3>';
      const grid = document.createElement('div');
      grid.className = 'avatar-grid';
      state.avatarChoices.forEach((a) => {
        const btn = document.createElement('button');
        btn.textContent = a;
        if (state.me && a === state.me.avatar) btn.classList.add('selected');
        btn.addEventListener('click', () => {
          socket.emit('user:set-avatar', a);
          close();
        });
        grid.appendChild(btn);
      });
      card.appendChild(grid);
    });
  }

  function openNicknameModal() {
    openModal((card, close) => {
      card.innerHTML = '<h3>Ganti nama panggilan</h3>';
      const input = document.createElement('input');
      input.className = 'text-input';
      input.maxLength = 24;
      input.value = state.me ? state.me.nickname : '';
      card.appendChild(input);
      const actions = document.createElement('div');
      actions.className = 'modal-actions';
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn-ghost';
      cancelBtn.textContent = 'Batal';
      cancelBtn.addEventListener('click', close);
      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn-primary';
      saveBtn.textContent = 'Simpan';
      saveBtn.addEventListener('click', () => {
        const v = input.value.trim();
        if (v) socket.emit('user:set-nickname', v);
        close();
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveBtn.click(); });
      actions.appendChild(cancelBtn);
      actions.appendChild(saveBtn);
      card.appendChild(actions);
      input.focus();
    });
  }

  function openCreateRoomModal() {
    openModal((card, close) => {
      card.innerHTML = '<h3>Buat ruang privat</h3><p style="margin:0;font-size:12px;color:var(--text-muted)">Minimal pilih 1 orang lain (total minimal 2 orang di ruangan).</p>';
      const nameInput = document.createElement('input');
      nameInput.className = 'text-input';
      nameInput.maxLength = 30;
      nameInput.placeholder = 'Nama ruang (opsional)';
      card.appendChild(nameInput);

      const label = document.createElement('div');
      label.className = 'boot-label';
      label.textContent = 'Undang dari daftar online';
      card.appendChild(label);

      const list = document.createElement('div');
      list.className = 'invite-list';
      card.appendChild(list);

      const errorEl = document.createElement('div');
      errorEl.className = 'modal-error hidden';
      card.appendChild(errorEl);
      chatUI.createRoomError = errorEl;

      const actions = document.createElement('div');
      actions.className = 'modal-actions';
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn-ghost';
      cancelBtn.textContent = 'Batal';
      cancelBtn.addEventListener('click', () => { chatUI.createRoomError = null; close(); });
      const createBtn = document.createElement('button');
      createBtn.className = 'btn-primary';
      createBtn.textContent = 'Buat Ruang';
      createBtn.addEventListener('click', () => {
        const checked = Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map((c) => c.value);
        if (checked.length < 1) {
          errorEl.textContent = 'Pilih minimal 1 orang lain dulu, ya.';
          errorEl.classList.remove('hidden');
          return;
        }
        socket.emit('room:create-private', { name: nameInput.value.trim(), inviteIds: checked });
        chatUI.createRoomError = null;
        close();
      });
      actions.appendChild(cancelBtn);
      actions.appendChild(createBtn);
      card.appendChild(actions);

      renderInviteListInto(list);
    });
  }

  function renderInviteListInto(listEl) {
    listEl.innerHTML = '';
    const others = state.users.filter((u) => !state.me || u.id !== state.me.id);
    if (others.length === 0) {
      listEl.innerHTML = '<div class="modal-empty">Belum ada orang lain yang online.</div>';
      return;
    }
    others.forEach((u) => {
      const row = document.createElement('label');
      row.className = 'user-row';
      row.innerHTML = `<input type="checkbox" value="${u.id}" /><span>${u.avatar}</span><span class="un">${escapeHtml(u.nickname)}</span>`;
      listEl.appendChild(row);
    });
  }

  function renderInviteList() {
    if (!chatUI || !chatUI.root) return;
    const list = chatUI.root.querySelector('.invite-list');
    if (list) renderInviteListInto(list);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
})();
