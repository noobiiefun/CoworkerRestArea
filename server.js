// server.js
// Coworker Rest Area - Step 1 + Step 2 (Nonton Bareng)
// Satu komputer menjalankan server ini, komputer lain di LAN yang sama
// membuka http://<ip-server>:3000 di browser mereka.

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
// Multer — simpan video di disk (tetap ada walau server restart)
// ---------------------------------------------------------------------------
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, Date.now() + '_' + safe);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Hanya file video yang diizinkan'));
  }
});

app.use(express.static(path.join(__dirname, 'public')));

// API — upload video
app.post('/api/upload-video', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File tidak valid' });
  const url = '/uploads/' + req.file.filename;
  const videoMeta = {
    id: 'v_' + Date.now().toString(36),
    filename: req.file.originalname,
    url,
    size: req.file.size,
    uploadedAt: Date.now()
  };
  videoLibrary.push(videoMeta);
  io.emit('theater:video-added', videoMeta);
  res.json({ ok: true, video: videoMeta });
});

// API — hapus video
app.delete('/api/video/:id', (req, res) => {
  const idx = videoLibrary.findIndex(v => v.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Video tidak ditemukan' });
  const [vid] = videoLibrary.splice(idx, 1);
  const filePath = path.join(__dirname, 'public', vid.url);
  fs.unlink(filePath, () => {});
  io.emit('theater:video-removed', vid.id);
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

/** Daftar video yang sudah diupload (persisten di disk, meta di RAM) */
const videoLibrary = [];

/**
 * State theater (Nonton Bareng) — satu "theater" global.
 * @type {{
 *   currentVideo: object|null,
 *   isPlaying: boolean,
 *   currentTime: number,
 *   lastSyncAt: number,
 *   hostId: string|null,
 *   messages: Array
 * }}
 */
const theater = {
  currentVideo: null,
  isPlaying: false,
  currentTime: 0,
  lastSyncAt: Date.now(),
  hostId: null,
  messages: []
};

// Scan upload dir saat boot untuk rebuild videoLibrary
(function scanVideos() {
  if (!fs.existsSync(UPLOAD_DIR)) return;
  const files = fs.readdirSync(UPLOAD_DIR);
  files.forEach(f => {
    const fullPath = path.join(UPLOAD_DIR, f);
    const stat = fs.statSync(fullPath);
    videoLibrary.push({
      id: 'v_' + f.split('_')[0],
      filename: f.replace(/^\d+_/, ''),
      url: '/uploads/' + f,
      size: stat.size,
      uploadedAt: stat.mtimeMs
    });
  });
})();

function makeId(prefix = '') {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

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

/** Hitung currentTime theater secara akurat berdasarkan waktu nyata */
function theaterCurrentTime() {
  if (!theater.isPlaying) return theater.currentTime;
  const elapsed = (Date.now() - theater.lastSyncAt) / 1000;
  return theater.currentTime + elapsed;
}

function theaterStateForClient() {
  return {
    currentVideo: theater.currentVideo,
    isPlaying: theater.isPlaying,
    currentTime: theaterCurrentTime(),
    hostId: theater.hostId
  };
}

// ---------------------------------------------------------------------------
// Socket.IO
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  const user = {
    id: socket.id, socketId: socket.id,
    nickname: randomNickname(), avatar: randomAvatar(),
    rooms: new Set(['lobby']), inTheater: false
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

  // ---- Chat events (sama seperti step 1) ----
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
    // Update nama di theater juga jika sedang nonton
    if (user.inTheater) io.to('theater').emit('theater:user-updated', publicUserView(user));
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

  // ---- THEATER (Nonton Bareng) events ----

  /** User masuk ke theater */
  socket.on('theater:join', () => {
    socket.join('theater');
    user.inTheater = true;
    const viewers = Array.from(users.values()).filter(u => u.inTheater).map(publicUserView);
    socket.emit('theater:init', {
      state: theaterStateForClient(),
      videos: videoLibrary,
      viewers,
      messages: theater.messages.slice(-100)
    });
    io.to('theater').emit('theater:viewer-joined', publicUserView(user));
    io.to('theater').emit('theater:viewers-count', viewers.length);
  });

  /** User keluar dari theater */
  socket.on('theater:leave', () => {
    socket.leave('theater');
    user.inTheater = false;
    if (theater.hostId === socket.id) {
      // Snapshot waktu terkini agar viewer lain tidak loncat ke posisi salah
      theater.currentTime = theaterCurrentTime();
      theater.lastSyncAt = Date.now();
      theater.hostId = null;
      io.to('theater').emit('theater:host-changed', null);
    }
    const viewers = Array.from(users.values()).filter(u => u.inTheater).map(publicUserView);
    io.to('theater').emit('theater:viewer-left', user.id);
    io.to('theater').emit('theater:viewers-count', viewers.length);
  });

  /** Pilih video untuk diputar */
  socket.on('theater:select-video', (videoId) => {
    const video = videoLibrary.find(v => v.id === videoId);
    if (!video) return;
    theater.currentVideo = video;
    theater.isPlaying = false;
    theater.currentTime = 0;
    theater.lastSyncAt = Date.now();
    theater.hostId = socket.id;
    io.to('theater').emit('theater:state', theaterStateForClient());
    const msg = { id: makeId('tm_'), authorId: 'system', nickname: 'Sistem', avatar: '🎬', text: `${user.nickname} memilih video: "${video.filename}"`, system: true, time: Date.now() };
    theater.messages.push(msg);
    if (theater.messages.length > 200) theater.messages.shift();
    io.to('theater').emit('theater:message', msg);
  });

  /** Play */
  socket.on('theater:play', ({ currentTime }) => {
    theater.isPlaying = true;
    theater.currentTime = currentTime ?? theaterCurrentTime();
    theater.lastSyncAt = Date.now();
    theater.hostId = socket.id;
    io.to('theater').emit('theater:state', theaterStateForClient());
  });

  /** Pause */
  socket.on('theater:pause', ({ currentTime }) => {
    theater.isPlaying = false;
    theater.currentTime = currentTime ?? theaterCurrentTime();
    theater.lastSyncAt = Date.now();
    theater.hostId = socket.id;
    io.to('theater').emit('theater:state', theaterStateForClient());
  });

  /** Seek */
  socket.on('theater:seek', ({ currentTime }) => {
    theater.currentTime = currentTime ?? 0;
    theater.lastSyncAt = Date.now();
    io.to('theater').emit('theater:state', theaterStateForClient());
  });

  /** Request sinkronisasi (misalnya user baru join & minta state terkini) */
  socket.on('theater:request-sync', () => {
    socket.emit('theater:state', theaterStateForClient());
  });

  /** Kirim pesan chat di theater */
  socket.on('theater:message-send', (text) => {
    const clean = String(text || '').trim().slice(0, 500);
    if (!clean) return;
    const msg = { id: makeId('tm_'), authorId: user.id, nickname: user.nickname, avatar: user.avatar, text: clean, time: Date.now() };
    theater.messages.push(msg);
    if (theater.messages.length > 200) theater.messages.shift();
    io.to('theater').emit('theater:message', msg);
  });

  /** React (emoji reaction) */
  socket.on('theater:react', (emoji) => {
    const ALLOWED = ['👍','❤️','😂','😮','😢','🔥','👏','🎉'];
    if (!ALLOWED.includes(emoji)) return;
    io.to('theater').emit('theater:reaction', { userId: user.id, nickname: user.nickname, emoji });
  });

  // ---- Disconnect ----
  socket.on('disconnect', () => {
    users.delete(socket.id);
    if (theater.hostId === socket.id) {
      // Snapshot waktu terkini agar posisi video tidak loncat saat host keluar
      theater.currentTime = theaterCurrentTime();
      theater.lastSyncAt = Date.now();
      theater.hostId = null;
    }
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
    const viewers = Array.from(users.values()).filter(u => u.inTheater).map(publicUserView);
    io.to('theater').emit('theater:viewer-left', socket.id);
    io.to('theater').emit('theater:viewers-count', viewers.length);
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
