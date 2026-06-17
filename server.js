// server.js
// Coworker Rest Area — Multi-Room Theater
// Setiap ruangan nonton bisa punya video & state sendiri.

const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Multer — simpan video di disk
// ---------------------------------------------------------------------------
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, Date.now() + '_' + safe);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Hanya file video yang diizinkan'));
  }
});

// Middleware: terima file video + field text (uploaderId, uploaderName)
const uploadVideo = (req, res, next) => {
  upload.fields([{ name: 'video', maxCount: 1 }])(req, res, (err) => {
    if (err) return next(err);
    if (req.files && req.files.video) req.file = req.files.video[0];
    next();
  });
};

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true })); // baca req.body dari multipart

// API — upload video (otomatis buat theater room atas nama pengupload)
app.post('/api/upload-video', uploadVideo, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File tidak valid' });

  const url = '/uploads/' + req.file.filename;
  const uploaderId = req.body.uploaderId || null;
  const uploaderName = String(req.body.uploaderName || 'Anonim').trim().slice(0, 30);

  const videoMeta = {
    id: 'v_' + Date.now().toString(36),
    filename: req.file.originalname,
    url,
    size: req.file.size,
    uploadedAt: Date.now(),
    uploaderId,
    uploaderName
  };
  videoLibrary.push(videoMeta);

  // Cari apakah sudah ada theater room milik pengupload ini
  let theaterRoom = uploaderId
    ? Array.from(theaterRooms.values()).find(tr => tr.uploaderId === uploaderId)
    : null;

  if (!theaterRoom) {
    // Buat ruangan baru atas nama pengupload
    const rid = makeId('tr_');
    const roomName = `📺 ${uploaderName}`;
    theaterRoom = makeTheaterRoom(rid, roomName, uploaderId);
    theaterRoom.uploaderId = uploaderId;
    theaterRoom.uploaderName = uploaderName;
    theaterRooms.set(rid, theaterRoom);
  }

  // Set video aktif di ruangan pengupload
  theaterRoom.currentVideo = videoMeta;
  theaterRoom.isPlaying = false;
  theaterRoom.currentTime = 0;
  theaterRoom.lastSyncAt = Date.now();

  io.emit('theater:video-added', videoMeta);
  broadcastTheaterRoomList();

  res.json({ ok: true, video: videoMeta, theaterRoomId: theaterRoom.id });
});

// API — hapus video
app.delete('/api/video/:id', (req, res) => {
  const idx = videoLibrary.findIndex(v => v.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Video tidak ditemukan' });
  const [vid] = videoLibrary.splice(idx, 1);
  const filePath = path.join(__dirname, 'public', vid.url);
  fs.unlink(filePath, () => {});
  io.emit('theater:video-removed', vid.id);

  // Hapus theater room yang video aktifnya adalah video ini
  theaterRooms.forEach((tr, rid) => {
    if (tr.currentVideo && tr.currentVideo.id === vid.id) {
      io.to(rid).emit('theater:room-deleted', rid);
      theaterRooms.delete(rid);
    }
  });

  broadcastTheaterRoomList();
  res.json({ ok: true });
});

// API — list video
app.get('/api/videos', (req, res) => res.json(videoLibrary));

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------
const users = new Map();
const rooms = new Map();
const MAX_MESSAGES_PER_ROOM = 300;

/** Daftar video yang sudah diupload */
const videoLibrary = [];

/**
 * Theater rooms — tiap entry adalah ruangan nonton terpisah.
 * Key: theaterRoomId (string)
 * Value: { id, name, hostId, currentVideo, isPlaying, currentTime, lastSyncAt, messages, memberIds }
 */
const theaterRooms = new Map();

// Buat satu ruangan default "Nonton Bareng Umum"
function makeTheaterRoom(id, name, creatorId) {
  return {
    id,
    name,
    creatorId,
    hostId: null,
    currentVideo: null,
    isPlaying: false,
    currentTime: 0,
    lastSyncAt: Date.now(),
    messages: [],
    memberIds: new Set(),
    lastEmptyAt: null  // waktu room pertama kali jadi kosong (untuk auto-delete)
  };
}
// Tidak ada ruangan default — ruangan dibuat otomatis saat pengupload upload video

function theaterCurrentTime(tr) {
  if (!tr.isPlaying) return tr.currentTime;
  const elapsed = (Date.now() - tr.lastSyncAt) / 1000;
  return tr.currentTime + elapsed;
}

function theaterStateForClient(tr) {
  return {
    roomId: tr.id,
    roomName: tr.name,
    currentVideo: tr.currentVideo,
    isPlaying: tr.isPlaying,
    currentTime: theaterCurrentTime(tr),
    hostId: tr.hostId,
    lastSyncAt: tr.lastSyncAt,
    memberCount: tr.memberIds.size
  };
}

function broadcastTheaterRoomList() {
  const list = Array.from(theaterRooms.values()).map(tr => {
    let videoName = null;
    if (tr.currentVideo) {
      if (tr.currentVideo.ytId) {
        // Tampilkan nama/judul yang lebih bersih untuk YouTube
        videoName = tr.currentVideo.title || `▶ youtube.com/watch?v=${tr.currentVideo.ytId}`;
      } else {
        videoName = tr.currentVideo.filename;
      }
    }
    return {
      id: tr.id,
      name: tr.name,
      creatorId: tr.creatorId,
      memberCount: tr.memberIds.size,
      currentVideoName: videoName,
      isPlaying: tr.isPlaying,
      isYT: !!(tr.currentVideo?.ytId)
    };
  });
  io.emit('theater:rooms-list', list);
}

// Scan upload dir saat boot — rebuild videoLibrary & theater rooms
(function scanVideos() {
  if (!fs.existsSync(UPLOAD_DIR)) return;
  const files = fs.readdirSync(UPLOAD_DIR).filter(f => f !== '.gitkeep');
  files.forEach(f => {
    const fullPath = path.join(UPLOAD_DIR, f);
    const stat = fs.statSync(fullPath);
    // Timestamp upload ada di awal nama file (format: <timestamp>_<filename>)
    const tsMatch = f.match(/^(\d+)_/);
    const uploadedAt = tsMatch ? parseInt(tsMatch[1], 10) : stat.mtimeMs;
    const meta = {
      id: 'v_' + f.split('_')[0],
      filename: f.replace(/^\d+_/, ''),
      url: '/uploads/' + f,
      size: stat.size,
      uploadedAt,
      uploaderId: null,
      uploaderName: 'Anonim'
    };
    videoLibrary.push(meta);

    // Buat ruangan untuk video ini
    const rid = 'tr_boot_' + meta.id;
    if (!theaterRooms.has(rid)) {
      const tr = makeTheaterRoom(rid, `📺 ${meta.uploaderName}`, null);
      tr.currentVideo = meta;
      theaterRooms.set(rid, tr);
    }
  });
})();

function makeId(prefix = '') {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
// ---------------------------------------------------------------------------
// Auto-delete theater room yang kosong > 20 menit
// ---------------------------------------------------------------------------
const ROOM_EMPTY_TTL_MS = 20 * 60 * 1000;

function checkEmptyRooms() {
  const now = Date.now();
  theaterRooms.forEach((tr, rid) => {
    if (tr.memberIds.size > 0) {
      tr.lastEmptyAt = null;
      return;
    }
    if (tr.lastEmptyAt == null) {
      tr.lastEmptyAt = now;
      return;
    }
    if ((now - tr.lastEmptyAt) >= ROOM_EMPTY_TTL_MS) {
      console.log('[auto-delete room] "' + tr.name + '" kosong 20 menit, dihapus.');
      io.to(rid).emit('theater:room-deleted', rid);
      theaterRooms.delete(rid);
    }
  });
  broadcastTheaterRoomList();
}

setInterval(checkEmptyRooms, 2 * 60 * 1000);

// ---------------------------------------------------------------------------
// Auto-delete video yang sudah > 7 hari
// ---------------------------------------------------------------------------
const VIDEO_TTL_DAYS = 7;
const VIDEO_TTL_MS = VIDEO_TTL_DAYS * 24 * 60 * 60 * 1000;

function deleteExpiredVideos() {
  const now = Date.now();
  const expired = videoLibrary.filter(v => (now - v.uploadedAt) > VIDEO_TTL_MS);
  if (expired.length === 0) return;

  expired.forEach(v => {
    console.log(`[auto-delete] Video kadaluarsa: ${v.filename} (${VIDEO_TTL_DAYS} hari)`);

    // Hapus file dari disk
    const filePath = path.join(__dirname, 'public', v.url);
    fs.unlink(filePath, (err) => {
      if (err && err.code !== 'ENOENT') console.error('[auto-delete] Gagal hapus file:', err.message);
    });

    // Hapus dari videoLibrary
    const idx = videoLibrary.findIndex(x => x.id === v.id);
    if (idx !== -1) videoLibrary.splice(idx, 1);

    // Hapus/kosongkan theater room yang memakai video ini
    theaterRooms.forEach((tr, rid) => {
      if (tr.currentVideo && tr.currentVideo.id === v.id) {
        tr.currentVideo = null;
        tr.isPlaying = false;
        tr.currentTime = 0;
        if (tr.memberIds.size === 0) {
          theaterRooms.delete(rid);
        } else {
          io.to(rid).emit('theater:state', theaterStateForClient(tr));
          io.to(rid).emit('theater:video-removed', v.id);
        }
      }
    });

    io.emit('theater:video-removed', v.id);
  });

  broadcastTheaterRoomList();
  console.log('[auto-delete] ' + expired.length + ' video dihapus.');
}

// Jalankan saat server start dan setiap 6 jam
deleteExpiredVideos();
setInterval(deleteExpiredVideos, 6 * 60 * 60 * 1000);


rooms.set('lobby', {
  id: 'lobby', name: 'Lobby Utama', type: 'public',
  memberIds: new Set(), createdBy: null, messages: []
});

const AVATAR_CHOICES = ['🦊','🐱','🐶','🐼','🦁','🐸','🐵','🦉','🐧','🐢','🦄','🐯','🐨','🐰','🦝','🐹','🦔','🐻','🐺','🐲','😎','🤖','🥷','👻','🎩','🕶️','🧑‍💻','🧑‍🚀'];
const ADJ = ['Pelancong','Penjaga','Pengembara','Sahabat','Penghuni','Tamu','Kapten','Penjelajah'];
const NOUN = ['Rest Area','Lobi','Jalan Tol','Kopi','Lampu','Bintang','Senja','Malam'];

function randomNickname() {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const n = NOUN[Math.floor(Math.random() * NOUN.length)];
  return `${a} ${n} ${Math.floor(Math.random() * 90) + 10}`;
}
function randomAvatar() {
  return AVATAR_CHOICES[Math.floor(Math.random() * AVATAR_CHOICES.length)];
}
function publicUserView(u) {
  return { id: u.id, nickname: u.nickname, avatar: u.avatar };
}
function roomSummary(room) {
  return { id: room.id, name: room.name, type: room.type, memberCount: room.memberIds.size, memberIds: Array.from(room.memberIds) };
}
function broadcastUserList() {
  io.emit('users:list', Array.from(users.values()).map(publicUserView));
}
function broadcastRoomList() {
  const allRooms = Array.from(rooms.values());
  io.sockets.sockets.forEach((s) => {
    const visible = allRooms.filter((r) => r.type === 'public' || r.memberIds.has(s.id));
    s.emit('rooms:list', visible.map(roomSummary));
  });
}
function pushMessage(room, msg) {
  room.messages.push(msg);
  if (room.messages.length > MAX_MESSAGES_PER_ROOM) room.messages.shift();
}
function systemMessage(room, text) {
  const msg = { id: makeId('m_'), authorId: 'system', nickname: 'Sistem', avatar: '🛎️', text, system: true, time: Date.now() };
  pushMessage(room, msg);
  io.to(room.id).emit('message:new', { roomId: room.id, message: msg });
}

// ---------------------------------------------------------------------------
// Socket.IO
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  const user = {
    id: socket.id, socketId: socket.id,
    nickname: randomNickname(), avatar: randomAvatar(),
    rooms: new Set(['lobby']),
    theaterRoomId: null  // theater room yang sedang diikuti
  };
  users.set(socket.id, user);

  socket.join('lobby');
  rooms.get('lobby').memberIds.add(socket.id);

  socket.emit('me:init', {
    me: publicUserView(user),
    avatarChoices: AVATAR_CHOICES,
    rooms: Array.from(rooms.values()).map(roomSummary),
    lobbyMessages: rooms.get('lobby').messages
  });

  broadcastUserList();
  broadcastRoomList();
  systemMessage(rooms.get('lobby'), `${user.avatar} ${user.nickname} bergabung ke rest area.`);

  // ---- Chat events ----
  socket.on('user:set-nickname', (nicknameRaw) => {
    const nickname = String(nicknameRaw || '').trim().slice(0, 24);
    if (!nickname) return;
    const old = user.nickname;
    user.nickname = nickname;
    broadcastUserList();
    io.emit('user:updated', publicUserView(user));
    user.rooms.forEach((rid) => {
      const r = rooms.get(rid);
      if (r) systemMessage(r, `${old} mengubah nama menjadi ${nickname}.`);
    });
    if (user.theaterRoomId) {
      io.to(user.theaterRoomId).emit('theater:user-updated', publicUserView(user));
    }
  });

  socket.on('user:set-avatar', (avatar) => {
    if (!AVATAR_CHOICES.includes(avatar)) return;
    user.avatar = avatar;
    broadcastUserList();
    io.emit('user:updated', publicUserView(user));
  });

  socket.on('message:send', ({ roomId, text }) => {
    const room = rooms.get(roomId);
    if (!room || !room.memberIds.has(socket.id)) return;
    const clean = String(text || '').trim().slice(0, 1000);
    if (!clean) return;
    const msg = { id: makeId('m_'), authorId: user.id, nickname: user.nickname, avatar: user.avatar, text: clean, time: Date.now() };
    pushMessage(room, msg);
    io.to(room.id).emit('message:new', { roomId: room.id, message: msg });
  });

  socket.on('room:create-private', ({ name, inviteIds }) => {
    const invites = Array.isArray(inviteIds) ? inviteIds.filter((id) => users.has(id) && id !== socket.id) : [];
    if (invites.length < 1) { socket.emit('room:error', 'Pilih minimal 1 orang lain.'); return; }
    const roomId = makeId('priv_');
    const roomName = String(name || '').trim().slice(0, 30) || `Ruang Privat ${roomId.slice(-4)}`;
    const room = { id: roomId, name: roomName, type: 'private', memberIds: new Set([socket.id, ...invites]), createdBy: socket.id, messages: [] };
    rooms.set(roomId, room);
    room.memberIds.forEach((mid) => {
      const s = io.sockets.sockets.get(mid);
      const u = users.get(mid);
      if (s) s.join(roomId);
      if (u) u.rooms.add(roomId);
    });
    broadcastRoomList();
    io.to(roomId).emit('room:invited', roomSummary(room));
    systemMessage(room, `Ruang privat "${roomName}" dibuat oleh ${user.nickname}.`);
  });

  socket.on('room:join', (roomId) => {
    const room = rooms.get(roomId);
    if (!room || !room.memberIds.has(socket.id)) return;
    socket.join(roomId);
    socket.emit('room:history', { roomId, messages: room.messages });
  });

  socket.on('room:leave', (roomId) => {
    const room = rooms.get(roomId);
    if (!room || room.type !== 'private') return;
    room.memberIds.delete(socket.id);
    user.rooms.delete(roomId);
    socket.leave(roomId);
    systemMessage(room, `${user.nickname} meninggalkan ruang ini.`);
    if (room.memberIds.size === 0) rooms.delete(roomId);
    broadcastRoomList();
  });

  // ---- THEATER MULTI-ROOM events ----

  /** Minta daftar theater rooms */
  socket.on('theater:get-rooms', () => {
    socket.emit('theater:rooms-list', Array.from(theaterRooms.values()).map(tr => ({
      id: tr.id, name: tr.name, creatorId: tr.creatorId,
      memberCount: tr.memberIds.size,
      currentVideoName: tr.currentVideo?.filename || null,
      isPlaying: tr.isPlaying
    })));
    socket.emit('theater:videos-list', videoLibrary);
  });

  /** Buat theater room dari YouTube URL */
  socket.on('theater:create-yt-room', ({ ytId, ytUrl, uploaderName, uploaderId }) => {
    if (!ytId) { socket.emit('theater:error', 'YouTube ID tidak valid'); return; }
    const rid = makeId('tr_yt_');
    const roomName = `🎬 ${uploaderName || 'Anonim'}`;
    const tr = makeTheaterRoom(rid, roomName, socket.id);
    tr.uploaderId = uploaderId || socket.id;
    tr.uploaderName = uploaderName || 'Anonim';
    tr.currentVideo = {
      id: 'yt_' + ytId,
      filename: `YouTube: ${ytId}`,
      title: `▶ ${ytId}`,  // akan diupdate jika ada judul
      url: ytUrl,
      ytId,
      size: 0,
      uploadedAt: Date.now()
    };
    tr.lastEmptyAt = null; // belum pernah kosong
    theaterRooms.set(rid, tr);
    broadcastTheaterRoomList();
    socket.emit('theater:yt-room-created', { roomId: rid, roomName });
  });

  /** Ganti video YouTube di room yang sedang diikuti */
  socket.on('theater:change-yt-video', ({ ytId, ytUrl }) => {
    if (!user.theaterRoomId) return;
    const tr = theaterRooms.get(user.theaterRoomId);
    if (!tr) return;
    tr.currentVideo = {
      id: 'yt_' + ytId,
      filename: `YouTube: ${ytId}`,
      title: `▶ ${ytId}`,
      url: ytUrl,
      ytId,
      size: 0,
      uploadedAt: Date.now()
    };
    tr.isPlaying = false;
    tr.currentTime = 0;
    tr.lastSyncAt = Date.now();
    tr.hostId = socket.id;
    io.to(tr.id).emit('theater:state', theaterStateForClient(tr));
    broadcastTheaterRoomList();
  });

  /** Masuk ke theater room tertentu */
  socket.on('theater:join-room', (theaterRoomId) => {
    // Keluar dari theater room sebelumnya jika ada
    if (user.theaterRoomId && user.theaterRoomId !== theaterRoomId) {
      const oldTr = theaterRooms.get(user.theaterRoomId);
      if (oldTr) {
        oldTr.memberIds.delete(socket.id);
        socket.leave(user.theaterRoomId);
        io.to(user.theaterRoomId).emit('theater:viewer-left', user.id);
        io.to(user.theaterRoomId).emit('theater:viewers-count', oldTr.memberIds.size);
        broadcastTheaterRoomList();
      }
    }

    const tr = theaterRooms.get(theaterRoomId);
    if (!tr) { socket.emit('theater:error', 'Ruangan tidak ditemukan'); return; }

    tr.memberIds.add(socket.id);
    socket.join(theaterRoomId);
    user.theaterRoomId = theaterRoomId;

    const viewers = Array.from(tr.memberIds)
      .map(id => users.get(id))
      .filter(Boolean)
      .map(publicUserView);

    socket.emit('theater:init', {
      state: theaterStateForClient(tr),
      videos: videoLibrary,
      viewers,
      messages: tr.messages.slice(-100)
    });

    // Broadcast ke member LAIN saja (bukan ke yang baru join, sudah ada di theater:init)
    socket.to(theaterRoomId).emit('theater:viewer-joined', publicUserView(user));
    io.to(theaterRoomId).emit('theater:viewers-count', tr.memberIds.size);
    broadcastTheaterRoomList();
  });

  /** Keluar dari theater room */
  socket.on('theater:leave-room', () => {
    leaveCurrentTheaterRoom(socket, user);
  });

  function leaveCurrentTheaterRoom(socket, user) {
    if (!user.theaterRoomId) return;
    const tr = theaterRooms.get(user.theaterRoomId);
    if (tr) {
      if (tr.hostId === socket.id) {
        tr.currentTime = theaterCurrentTime(tr);
        tr.lastSyncAt = Date.now();
        tr.hostId = null;
        io.to(tr.id).emit('theater:host-changed', null);
      }
      tr.memberIds.delete(socket.id);
      socket.leave(tr.id);
      io.to(tr.id).emit('theater:viewer-left', user.id);
      io.to(tr.id).emit('theater:viewers-count', tr.memberIds.size);
      // Hapus room hanya jika kosong DAN tidak punya video (room upload persisten)
      if (tr.memberIds.size === 0 && !tr.currentVideo) {
        theaterRooms.delete(tr.id);
      }
      broadcastTheaterRoomList();
    }
    user.theaterRoomId = null;
  }

  /** Pilih video */
  socket.on('theater:select-video', (videoId) => {
    if (!user.theaterRoomId) return;
    const tr = theaterRooms.get(user.theaterRoomId);
    const video = videoLibrary.find(v => v.id === videoId);
    if (!tr || !video) return;
    tr.currentVideo = video;
    tr.isPlaying = false;
    tr.currentTime = 0;
    tr.lastSyncAt = Date.now();
    tr.hostId = socket.id;
    io.to(tr.id).emit('theater:state', theaterStateForClient(tr));
    const msg = { id: makeId('tm_'), authorId: 'system', nickname: 'Sistem', avatar: '🎬',
      text: `${user.nickname} memilih video: "${video.filename}"`, system: true, time: Date.now() };
    tr.messages.push(msg);
    if (tr.messages.length > 200) tr.messages.shift();
    io.to(tr.id).emit('theater:message', msg);
    broadcastTheaterRoomList();
  });

  /** Play */
  socket.on('theater:play', ({ currentTime }) => {
    if (!user.theaterRoomId) return;
    const tr = theaterRooms.get(user.theaterRoomId);
    if (!tr) return;
    tr.isPlaying = true;
    tr.currentTime = currentTime ?? theaterCurrentTime(tr);
    tr.lastSyncAt = Date.now();
    tr.hostId = socket.id;
    io.to(tr.id).emit('theater:state', theaterStateForClient(tr));
  });

  /** Pause */
  socket.on('theater:pause', ({ currentTime }) => {
    if (!user.theaterRoomId) return;
    const tr = theaterRooms.get(user.theaterRoomId);
    if (!tr) return;
    tr.isPlaying = false;
    tr.currentTime = currentTime ?? theaterCurrentTime(tr);
    tr.lastSyncAt = Date.now();
    tr.hostId = socket.id;
    io.to(tr.id).emit('theater:state', theaterStateForClient(tr));
  });

  /** Seek */
  socket.on('theater:seek', ({ currentTime }) => {
    if (!user.theaterRoomId) return;
    const tr = theaterRooms.get(user.theaterRoomId);
    if (!tr) return;
    tr.currentTime = currentTime ?? 0;
    tr.lastSyncAt = Date.now();
    io.to(tr.id).emit('theater:state', theaterStateForClient(tr));
  });

  /** Sync request */
  socket.on('theater:request-sync', () => {
    if (!user.theaterRoomId) return;
    const tr = theaterRooms.get(user.theaterRoomId);
    if (tr) socket.emit('theater:state', theaterStateForClient(tr));
  });

  /** Chat di theater room */
  socket.on('theater:message-send', (text) => {
    if (!user.theaterRoomId) return;
    const tr = theaterRooms.get(user.theaterRoomId);
    if (!tr) return;
    const clean = String(text || '').trim().slice(0, 500);
    if (!clean) return;
    const msg = { id: makeId('tm_'), authorId: user.id, nickname: user.nickname, avatar: user.avatar, text: clean, time: Date.now() };
    tr.messages.push(msg);
    if (tr.messages.length > 200) tr.messages.shift();
    io.to(tr.id).emit('theater:message', msg);
  });

  /** React */
  socket.on('theater:react', (emoji) => {
    if (!user.theaterRoomId) return;
    const ALLOWED = ['👍','❤️','😂','😮','😢','🔥','👏','🎉'];
    if (!ALLOWED.includes(emoji)) return;
    io.to(user.theaterRoomId).emit('theater:reaction', { userId: user.id, nickname: user.nickname, emoji });
  });

  // ---- Disconnect ----
  socket.on('disconnect', () => {
    users.delete(socket.id);
    leaveCurrentTheaterRoom(socket, user);
    rooms.forEach((room) => {
      if (room.memberIds.has(socket.id)) {
        room.memberIds.delete(socket.id);
        if (room.type === 'public' || room.memberIds.size > 0)
          systemMessage(room, `${user.avatar} ${user.nickname} meninggalkan rest area.`);
        if (room.type === 'private' && room.memberIds.size === 0) rooms.delete(room.id);
      }
    });
    broadcastUserList();
    broadcastRoomList();
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
function getLanIps() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  Object.values(ifaces).forEach((list) => {
    (list || []).forEach((info) => {
      if (info.family === 'IPv4' && !info.internal) ips.push(info.address);
    });
  });
  return ips;
}

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLanIps();
  console.log('========================================');
  console.log(' Coworker Rest Area server berjalan!');
  console.log(`  Lokal:   http://localhost:${PORT}`);
  if (ips.length) ips.forEach((ip) => console.log(`  LAN:     http://${ip}:${PORT}`));
  else console.log('  LAN:     (tidak terdeteksi IP LAN)');
  console.log('========================================');
});
