# Coworker Rest Area — Developer Documentation

> Dokumen ini ditujukan untuk developer atau AI yang ingin mengembangkan,
> memperbaiki bug, atau menambahkan fitur baru ke aplikasi Coworker Rest Area.
> Tidak ada kode di dokumen ini — hanya arsitektur, alur data, dan panduan
> kontribusi.

---

## Daftar Isi

1. [Gambaran Umum](#1-gambaran-umum)
2. [Arsitektur Sistem](#2-arsitektur-sistem)
3. [Struktur File](#3-struktur-file)
4. [State Management](#4-state-management)
5. [Socket.IO Event Reference](#5-socketio-event-reference)
6. [REST API Reference](#6-rest-api-reference)
7. [Fitur Per Modul](#7-fitur-per-modul)
8. [Pola Komunikasi Antar Modul](#8-pola-komunikasi-antar-modul)
9. [Konvensi & Aturan Kode](#9-konvensi--aturan-kode)
10. [Panduan Menambah Fitur Baru](#10-panduan-menambah-fitur-baru)
11. [Known Issues & Bug Log](#11-known-issues--bug-log)
12. [Roadmap & Ide Fitur](#12-roadmap--ide-fitur)

---

## 1. Gambaran Umum

Coworker Rest Area adalah aplikasi web LAN (Local Area Network) yang berjalan
di satu komputer server dan dapat diakses dari komputer lain di jaringan yang
sama melalui browser. Tidak perlu install apapun di sisi client.

**Stack teknologi:**

| Layer | Teknologi |
|-------|-----------|
| Server | Node.js + Express |
| Realtime | Socket.IO v4 |
| Upload | Multer |
| Frontend | Vanilla HTML/CSS/JS (tanpa framework) |
| Persistensi | File JSON (fishtank) + disk (video upload) |
| Screen share | WebRTC peer-to-peer (STUN Google) |

**Prinsip desain:**

- Semua data chat hanya di RAM — hilang saat server restart. Ini disengaja.
- Video upload tersimpan di disk (`public/uploads/`), bertahan saat restart.
- Data ikan tersimpan di `data/fishtank.json`, bertahan saat restart.
- Tidak ada database, tidak ada autentikasi, tidak ada akun.
- Identitas sepenuhnya anonim — nickname dan avatar bisa diganti kapan saja.
- Satu socket connection = satu user session.

---

## 2. Arsitektur Sistem

```
Browser (Client)
  │
  ├── HTTP GET /          → Express static (public/)
  ├── HTTP POST /api/upload-video  → Multer → disk
  ├── HTTP DELETE /api/video/:id   → hapus file + update state
  ├── HTTP GET /api/videos         → list video
  │
  └── WebSocket (Socket.IO)
        │
        ├── Namespace: / (default)
        │     ├── Chat events (rooms, messages, users)
        │     ├── Theater events (video sync, rooms, reactions)
        │     ├── Watch Me events (WebRTC signaling)
        │     └── Fish Tank events (ikan, feed, poke)
        │
        └── Server state (semua di RAM kecuali video & ikan)
```

**Alur koneksi user baru:**

1. Browser load `index.html` → CSS → JS (desktop.js, chat.js, theater.js, watchme.js, fishtank.js)
2. `chat.js` membuat koneksi Socket.IO → server assign `socket.id` sebagai user ID
3. Server kirim `me:init` dengan nickname random, avatar random, daftar room, history lobby
4. `chat.js` expose `window._theaterSocket = socket` dan `window.ME = meUser`
5. Semua modul lain (theater, watchme, fishtank) mengambil socket dari `window._theaterSocket`
6. User melewati boot screen → masuk desktop → bisa buka app apapun

**Satu socket untuk semua modul** — ini penting. Theater, Watch Me, dan Fish
Tank tidak membuat koneksi Socket.IO baru; mereka pakai socket yang sama dari
`chat.js` via `window._theaterSocket`.

---

## 3. Struktur File

```
CoworkerRestArea/
│
├── server.js                 # Entry point server — semua backend ada di sini
├── package.json
├── .gitignore
│
├── data/
│   └── fishtank.json         # Persisted fish data (dibuat otomatis)
│
└── public/                   # Static files — semua yang diakses browser
    ├── index.html            # Satu-satunya halaman HTML
    │
    ├── uploads/              # Video yang diupload (dibuat otomatis)
    │
    ├── css/
    │   ├── style.css         # Styling global + desktop + chat (tema Aero Windows 7)
    │   ├── theater.css       # Styling Nonton Bareng
    │   ├── watchme.css       # Styling Watch Me
    │   └── fishtank.css      # Styling Fish Tank
    │
    └── js/
        ├── desktop.js        # Window manager (drag, resize, taskbar, wallpaper)
        ├── chat.js           # Ruang Obrolan + inisialisasi socket global
        ├── theater.js        # Nonton Bareng (video + YouTube sync)
        ├── watchme.js        # Watch Me (WebRTC screen share)
        └── fishtank.js       # Fish Tank (akuarium + canvas drawing)
```

### Urutan load script di index.html

```
socket.io.js → desktop.js → chat.js → theater.js → watchme.js → fishtank.js
```

Urutan ini **wajib** dipertahankan. `chat.js` harus load sebelum modul lain
karena ia yang mengeset `window._theaterSocket` dan `window.ME`.

---

## 4. State Management

### Server-side state (RAM)

Semua state server ada di `server.js` sebagai variabel module-level:

| Variabel | Tipe | Isi | Persisten |
|----------|------|-----|-----------|
| `users` | `Map<socketId, UserObject>` | Semua user yang sedang online | ❌ RAM |
| `rooms` | `Map<roomId, RoomObject>` | Chat rooms (lobby + private) | ❌ RAM |
| `theaterRooms` | `Map<roomId, TheaterRoom>` | Ruangan nonton bareng | ❌ RAM |
| `videoLibrary` | `Array<VideoMeta>` | Metadata video yang diupload | ❌ RAM (direload dari disk saat boot) |
| `fishList` | `Array<FishObject>` | Data ikan | ✅ Disk (`data/fishtank.json`) |
| `watchmeRooms` | `Map<roomId, WatchMeRoom>` | Sesi screen share aktif | ❌ RAM |

### UserObject (server)

```
{
  id: string,           // = socket.id
  socketId: string,     // = socket.id
  nickname: string,     // max 24 karakter
  avatar: string,       // emoji dari AVATAR_CHOICES
  rooms: Set<string>,   // chat room IDs yang diikuti
  theaterRoomId: string|null,  // theater room aktif
  watchmeRoomId: string|null   // watchme room aktif
}
```

### TheaterRoom (server)

```
{
  id: string,
  name: string,
  creatorId: string|null,
  uploaderId: string|null,
  uploaderName: string,
  hostId: string|null,        // siapa yang terakhir kontrol playback
  currentVideo: VideoMeta|null,
  isPlaying: boolean,
  currentTime: number,        // dalam detik
  lastSyncAt: number,         // timestamp ms — untuk hitung elapsed time
  messages: Array<Message>,   // max 200 pesan
  memberIds: Set<string>,
  lastEmptyAt: number|null    // untuk auto-delete 20 menit
}
```

### WatchMeRoom (server)

```
{
  id: string,
  name: string,
  broadcasterId: string,
  broadcasterName: string,
  viewerIds: Set<string>,
  messages: Array<Message>,
  createdAt: number
}
```

### FishObject (disk)

```
{
  id: string,
  nickname: string,
  ownerId: string,      // socket.id saat ikan dibuat
  imageData: string,    // base64 JPEG, max ~300KB
  createdAt: number     // timestamp ms
}
```

### Client-side state

Setiap modul JS menyimpan state-nya sendiri di dalam IIFE (Immediately Invoked
Function Expression) — tidak ada state global selain dua variabel yang
di-expose oleh `chat.js`:

| Global | Diset oleh | Dipakai oleh |
|--------|------------|--------------|
| `window._theaterSocket` | chat.js | theater.js, watchme.js, fishtank.js |
| `window.ME` | chat.js | theater.js, watchme.js, fishtank.js |

`window.ME` selalu diupdate saat user mengganti nickname atau avatar.

---

## 5. Socket.IO Event Reference

Format: `modul:aksi` — semua event mengikuti namespace ini.

### Chat Events

| Event | Arah | Payload | Keterangan |
|-------|------|---------|------------|
| `me:init` | S→C | `{me, avatarChoices, rooms, lobbyMessages}` | Dikirim saat connect |
| `users:list` | S→C | `Array<{id, nickname, avatar}>` | Broadcast saat ada perubahan |
| `rooms:list` | S→C | `Array<RoomSummary>` | Per-socket, hanya room yang relevan |
| `user:updated` | S→C | `{id, nickname, avatar}` | Broadcast saat ganti nama/avatar |
| `message:new` | S→C | `{roomId, message}` | Pesan baru di room |
| `room:history` | S→C | `{roomId, messages}` | History saat join room |
| `room:invited` | S→C | `RoomSummary` | Saat diundang ke private room |
| `room:error` | S→C | `string` | Error saat buat room |
| `user:set-nickname` | C→S | `string` | Ganti nickname |
| `user:set-avatar` | C→S | `string` | Ganti avatar |
| `message:send` | C→S | `{roomId, text}` | Kirim pesan |
| `room:create-private` | C→S | `{name, inviteIds}` | Buat private room |
| `room:join` | C→S | `roomId` | Join/rejoin room |
| `room:leave` | C→S | `roomId` | Keluar dari private room |

### Theater Events

| Event | Arah | Payload | Keterangan |
|-------|------|---------|------------|
| `theater:rooms-list` | S→C | `Array<TheaterRoomSummary>` | Update daftar ruangan |
| `theater:videos-list` | S→C | `Array<VideoMeta>` | Update daftar video |
| `theater:init` | S→C | `{state, videos, viewers, messages}` | Dikirim saat join room |
| `theater:state` | S→C | `TheaterState` | Update state playback |
| `theater:viewer-joined` | S→C | `UserView` | Ada penonton baru |
| `theater:viewer-left` | S→C | `userId` | Penonton keluar |
| `theater:viewers-count` | S→C | `number` | Update jumlah penonton |
| `theater:message` | S→C | `Message` | Pesan chat theater |
| `theater:reaction` | S→C | `{userId, nickname, emoji}` | Emoji reaction |
| `theater:host-changed` | S→C | `userId\|null` | Host playback berubah |
| `theater:room-deleted` | S→C | `roomId` | Room dihapus (auto atau manual) |
| `theater:video-added` | S→C | `VideoMeta` | Video baru diupload |
| `theater:video-removed` | S→C | `videoId` | Video dihapus |
| `theater:yt-room-created` | S→C | `{roomId, roomName}` | Room YouTube berhasil dibuat |
| `theater:user-updated` | S→C | `UserView` | Nickname/avatar berubah |
| `theater:error` | S→C | `string` | Error |
| `theater:get-rooms` | C→S | — | Minta daftar rooms |
| `theater:join-room` | C→S | `roomId` | Masuk ke room |
| `theater:leave-room` | C→S | — | Keluar dari room |
| `theater:create-yt-room` | C→S | `{ytId, ytUrl, uploaderName, uploaderId}` | Buat room YouTube |
| `theater:change-yt-video` | C→S | `{ytId, ytUrl}` | Ganti video YouTube |
| `theater:select-video` | C→S | `videoId` | Pilih video lokal |
| `theater:play` | C→S | `{currentTime}` | Play |
| `theater:pause` | C→S | `{currentTime}` | Pause |
| `theater:seek` | C→S | `{currentTime}` | Seek |
| `theater:request-sync` | C→S | — | Minta sync state |
| `theater:message-send` | C→S | `string` | Kirim pesan chat |
| `theater:react` | C→S | `emoji` | Kirim reaction |

**TheaterState object:**
```
{
  roomId, roomName, currentVideo, isPlaying,
  currentTime, hostId, lastSyncAt, memberCount
}
```

**Kalkulasi currentTime di client:**
Jika `isPlaying = true`, waktu aktual = `currentTime + (Date.now() - lastSyncAt) / 1000`.
Ini yang dipakai untuk sinkronisasi drift.

### Watch Me Events

| Event | Arah | Payload | Keterangan |
|-------|------|---------|------------|
| `watchme:rooms-list` | S→C | `Array<WatchMeRoomSummary>` | Update daftar sesi |
| `watchme:room-created` | S→C | `{roomId, roomName}` | Sesi berhasil dibuat |
| `watchme:init` | S→C | `{viewers, messages}` | State awal saat viewer join |
| `watchme:viewer-joined` | S→C | `{viewerId, viewerNickname, viewerAvatar}` | Viewer baru masuk |
| `watchme:viewer-left` | S→C | `viewerId` | Viewer keluar |
| `watchme:viewers-count` | S→C | `number` | Update jumlah penonton |
| `watchme:message` | S→C | `Message` | Pesan chat |
| `watchme:reaction` | S→C | `{userId, nickname, emoji}` | Reaction |
| `watchme:room-ended` | S→C | — | Sesi berakhir (broadcaster disconnect) |
| `watchme:error` | S→C | `string` | Error |
| `watchme:offer` | S↔C | `{from/to, offer}` | WebRTC offer (relay) |
| `watchme:answer` | S↔C | `{from/to, answer}` | WebRTC answer (relay) |
| `watchme:ice-candidate` | S↔C | `{from/to, candidate}` | ICE candidate (relay) |
| `watchme:get-rooms` | C→S | — | Minta daftar sesi |
| `watchme:create-room` | C→S | `{broadcasterName, broadcasterId}` | Mulai siaran |
| `watchme:join-room` | C→S | `{roomId}` | Tonton sesi |
| `watchme:leave-room` | C→S | — | Keluar dari sesi |
| `watchme:message-send` | C→S | `string` | Kirim pesan chat |
| `watchme:react` | C→S | `emoji` | Kirim reaction |

**Alur WebRTC Watch Me:**
```
Broadcaster creates room
  → Viewer joins (watchme:join-room)
  → Server notifies broadcaster (watchme:viewer-joined)
  → Broadcaster creates RTCPeerConnection + offer (watchme:offer)
  → Server relays offer to viewer
  → Viewer creates RTCPeerConnection + answer (watchme:answer)
  → Server relays answer to broadcaster
  → ICE candidates dipertukarkan (watchme:ice-candidate) via server relay
  → WebRTC connection established (P2P langsung, tidak lewat server)
  → Video stream mengalir langsung Broadcaster → Viewer
```

Server **hanya menjadi relay sinyal** — stream video tidak lewat server.

### Fish Tank Events

| Event | Arah | Payload | Keterangan |
|-------|------|---------|------------|
| `fishtank:all-fish` | S→C | `Array<FishPublic>` | Semua ikan saat ini |
| `fishtank:fish-added` | S→C | `FishPublic` | Ikan baru ditambahkan |
| `fishtank:fish-replaced` | S→C | `{oldId, fish}` | Ikan user diganti |
| `fishtank:fish-removed` | S→C | `fishId` | Ikan dihapus (TTL habis) |
| `fishtank:feed` | S→C | — | Broadcast partikel makanan |
| `fishtank:poke-fish` | S→C | `fishId` | Broadcast colek ikan |
| `fishtank:error` | S→C | `string` | Error (mis. gambar terlalu besar) |
| `fishtank:get-fish` | C→S | — | Minta semua ikan |
| `fishtank:add-fish` | C→S | `{imageData, nickname, ownerId}` | Submit ikan baru |
| `fishtank:feed` | C→S | — | Beri makan (broadcast ke lain) |
| `fishtank:poke-fish` | C→S | `fishId` | Colek ikan (broadcast ke lain) |

---

## 6. REST API Reference

| Method | Endpoint | Body | Response | Keterangan |
|--------|----------|------|----------|------------|
| `POST` | `/api/upload-video` | `multipart/form-data: video (file), uploaderId, uploaderName` | `{ok, video, theaterRoomId}` | Upload video, otomatis buat/update theater room |
| `DELETE` | `/api/video/:id` | — | `{ok}` | Hapus video + theater room terkait |
| `GET` | `/api/videos` | — | `Array<VideoMeta>` | List semua video |

**VideoMeta object:**
```
{
  id: string,           // "v_" + timestamp base36
  filename: string,     // nama file asli
  url: string,          // path relatif, e.g. "/uploads/xxx_file.mp4"
  size: number,         // bytes
  uploadedAt: number,   // timestamp ms
  uploaderId: string|null,
  uploaderName: string
}
```

**Upload limits:**
- Max file size: 2 GB
- Tipe yang diterima: `video/*` (MIME type check)
- Nama file disanitasi: karakter non-alphanumeric diganti `_`

---

## 7. Fitur Per Modul

### desktop.js

**Tanggung jawab:** Window manager dan shell desktop.

**Fungsi publik yang di-expose via `window.Desktop`:**

| Fungsi | Parameter | Keterangan |
|--------|-----------|------------|
| `Desktop.registerApp(appId, config)` | `appId: string`, `config: {icon, title, render}` | Daftarkan app ke desktop |
| `Desktop.openApp(appId)` | `appId: string` | Buka jendela app |
| `Desktop.closeApp(appId)` | `appId: string` | Tutup jendela app |
| `Desktop.initShell()` | — | Inisialisasi taskbar, clock, wallpaper (dipanggil otomatis di DOMContentLoaded) |

**`render` callback:**
Dipanggil dengan `(containerElement, {close})` saat jendela dibuka.
Container adalah `div.window-body` — isi dengan HTML apapun.

**Mode mobile:** Jika viewport ≤ 768px, app dibuka sebagai fullscreen overlay
(bukan floating window). Tombol kembali muncul di header.

**Wallpaper:**
- Disimpan di `localStorage` dengan key `cra_wallpaper`
- Mendukung URL eksternal dan upload file lokal (via FileReader → base64)
- Klik kanan desktop → buka panel wallpaper
- Reset ke SVG default (pemandangan Windows 7 Bliss Hills)

**Auto-cleanup desktop icons:** Icon dengan class `is-soon` dilewati saat
inisialisasi click handler.

**Pointer events:** `#windows-layer` memakai `pointer-events: none` agar klik
pada icon desktop tidak terblokir. Window individual memakai
`pointer-events: auto` agar tetap bisa diklik.

---

### chat.js

**Tanggung jawab:** Ruang obrolan + inisialisasi socket global.

**State internal:**
```
state = {
  me: {id, nickname, avatar},
  avatarChoices: Array<string>,
  users: Array<UserView>,
  rooms: Array<RoomSummary>,
  activeRoomId: string,
  messagesByRoom: Map<roomId, Array<Message>>
}
```

**Side effects penting:**
- Membuat koneksi `io()` dan menyimpannya di `window._theaterSocket`
- Menyimpan info user di `window.ME` dan mengupdate setiap kali nickname/avatar berubah

**Pesan:** Disimpan di `state.messagesByRoom` (cache browser saja).
Max 300 pesan per room disimpan di server, history dikirim saat `room:join`.

**Private room:** Dibuat via modal, mengundang user dari daftar online.
Room otomatis hilang di server saat semua member disconnect.

---

### theater.js

**Tanggung jawab:** Nonton Bareng — video lokal dan YouTube.

**State internal:**
```
currentRoomId: string|null
myRole: 'uploader'|'viewer'|null
currentState: TheaterState
videos: Array<VideoMeta>
theaterRooms: Array<TheaterRoomSummary>
viewers: Array<UserView>
theaterMessages: Array<Message>
```

**Mode YouTube:**
- Input URL YouTube (termasuk `/live`, `/shorts`, `/embed`)
- Ekstrak YouTube ID via regex
- Embed menggunakan YouTube IFrame Player API (`www.youtube.com/iframe_api`)
- Sinkronisasi play/pause/seek dilakukan via IFrame API (`player.seekTo`, `player.playVideo`, `player.pauseVideo`)
- YouTube embed punya batasan: tidak semua video bisa di-embed (copyright)

**Mode video lokal:**
- Upload via `POST /api/upload-video`
- Playback via HTML5 `<video>` element
- Sinkronisasi via `theater:play/pause/seek` events
- Drift correction: setiap 5 detik cek selisih waktu, jika > 2 detik lakukan seek

**Multi-room:** Setiap uploader punya ruangan sendiri. Viewer bisa pindah
ruangan kapan saja.

**Auto-delete rooms:** Room yang kosong > 20 menit dihapus otomatis di server.

**Guard double-init:** `isActive` flag mencegah theater diinisialisasi ulang
tanpa cleanup proper.

---

### watchme.js

**Tanggung jawab:** Screen share berbasis WebRTC.

**State internal:**
```
localStream: MediaStream|null
peerConnections: Map<peerId, RTCPeerConnection>
wmRooms: Array<WatchMeRoomSummary>
currentRoomId: string|null
myRole: 'broadcaster'|'viewer'|null
viewers: Array<UserView>
wmMessages: Array<Message>
```

**WebRTC config:**
```
STUN servers:
  - stun:stun.l.google.com:19302
  - stun:stun1.l.google.com:19302
```

Hanya STUN (tidak ada TURN). Artinya:
- Bekerja sempurna di LAN lokal
- Mungkin gagal jika melewati NAT yang strict (internet publik)
- Untuk deployment publik, perlu tambahkan TURN server

**Broadcaster dapat menangani banyak viewer** — satu `RTCPeerConnection`
dibuat per viewer yang join. Track dari `localStream` ditambahkan ke
setiap peer connection.

**Cleanup:** Saat broadcaster stop atau disconnect:
1. Semua `RTCPeerConnection` di-close
2. `localStream.getTracks()` di-stop
3. Server menghapus room dan broadcast `watchme:room-ended` ke semua viewer

---

### fishtank.js

**Tanggung jawab:** Akuarium virtual + canvas drawing.

**State internal:**
```
fishes: Array<FishObject + _state>
foodParticles: Array<FoodParticle>
bubbles: Array<Bubble>
plants: Array<Plant>
animId: number (requestAnimationFrame ID)
canvas, ctx: HTMLCanvasElement, CanvasRenderingContext2D
drawCanvas, drawCtx: HTMLCanvasElement, CanvasRenderingContext2D
drawHistory: Array<string> (base64 snapshots, max 30)
isEraserActive: boolean
drawColor: string
drawSize: number
isEraserActive: boolean
```

**Animasi loop:**
Berjalan via `requestAnimationFrame`. Setiap frame:
1. Clear canvas
2. Gambar background + gradien
3. Gambar pasir
4. Gambar tanaman (dengan animasi sway)
5. Gambar batu (deterministik via seed `mulberry32`)
6. Gambar gelembung (naik ke atas, muncul baru secara random)
7. Update dan gambar partikel makanan
8. Update dan gambar ikan (movement, label nama, efek fade menjelang mati)
9. Gambar bingkai kaca

**Fisika ikan:**
- Setiap ikan punya `_state` dengan posisi, kecepatan, target, dan timer
- Ikan mencari makanan terdekat dalam radius 120px
- Saat diklik: kabur dengan kecepatan tinggi selama 60 frame
- Pantulan dari tepi akuarium dengan force field (bukan hard boundary)
- Ekor beranimasi via `Math.sin(state.tail)`

**Drawing canvas:**
- Background: `#12243a` (diisi via `fillDrawBackground()`)
- Saat submit: validasi pixel berbeda dari background, export sebagai JPEG 85%
- Eraser menggunakan `globalCompositeOperation: 'destination-out'`
- Undo: simpan snapshot `toDataURL()` sebelum setiap coretan, max 30 level

**TTL ikan:**
- 7 hari sejak `createdAt`
- Hari ke-1 s/d 2: tumbuh sedikit (`growRatio`)
- Hari ke-6 s/d 7: memudar (`alpha` berkurang)
- Server `pruneDeadFish()` berjalan setiap jam

**Batas gambar:** Max 300.000 karakter base64 (~220KB decoded). JPEG 85%
dari canvas 360×220 biasanya menghasilkan 30-80KB — jauh di bawah batas.

---

## 8. Pola Komunikasi Antar Modul

### Global bridge (chat.js → semua modul)

```
chat.js
  └─ window._theaterSocket  ←── theater.js, watchme.js, fishtank.js
  └─ window.ME              ←── theater.js, watchme.js, fishtank.js
```

`window.ME` diupdate setiap kali `user:updated` diterima dari server.
Modul lain yang butuh nickname/avatar terkini harus mengakses `window.ME`
saat dibutuhkan (tidak di-cache di dalam modul).

### Registrasi app ke Desktop

Semua modul mendaftarkan diri di `DOMContentLoaded`:
```
Desktop.registerApp('appId', {
  icon: 'emoji',
  title: 'Nama App',
  render(container) {
    // isi container dengan UI
    // bind socket events
  }
})
```

### Pattern destroy / cleanup

Setiap modul harus punya fungsi `destroy()` yang:
1. Stop semua interval/timer
2. Cancel animasi (`cancelAnimationFrame`)
3. Emit socket event "leave" ke server
4. Remove semua socket listener (`socket.off('event-name')`)
5. Reset state internal

Tanpa cleanup proper, membuka/menutup app berulang akan menyebabkan
event listener menumpuk (memory leak + double-trigger).

---

## 9. Konvensi & Aturan Kode

### Penamaan event Socket.IO

```
modul:aksi         → dari client ke server
modul:aksi-noun    → dari server ke client (hasil/update)

Contoh:
  theater:play           (C→S) user menekan play
  theater:state          (S→C) server broadcast state baru
  fishtank:add-fish      (C→S) user submit ikan
  fishtank:fish-added    (S→C) server broadcast ikan baru
```

### Validasi di server

Semua input dari client divalidasi di server:
- String: `String(val || '').trim().slice(0, maxLength)`
- Emoji reactions: whitelist check (`ALLOWED.includes(emoji)`)
- File upload: MIME type check (`file.mimetype.startsWith('video/')`)
- Image data: panjang base64 check (max 300.000 karakter)
- Array: `Array.isArray(val)` sebelum operasi

### Pola ID

```
makeId(prefix)  →  prefix + random(base36, 8 char) + timestamp(base36, 4 char)

Contoh:
  makeId('m_')      → "m_a3b2c1d2kj9x"   (pesan chat)
  makeId('priv_')   → "priv_a3b2c1d2kj9x" (private room)
  makeId('tr_')     → "tr_a3b2c1d2kj9x"   (theater room)
  makeId('fish_')   → "fish_a3b2c1d2kj9x" (ikan)
  makeId('wm_')     → "wm_a3b2c1d2kj9x"   (watchme room)
```

### XSS Prevention

- Semua teks dari user yang dirender ke DOM menggunakan `element.textContent`
  atau fungsi `escHtml()` — bukan `innerHTML` langsung.
- `escHtml()` ada di tiap modul frontend secara independen.

### CSS class naming

```
Modul prefix:
  .wm-*      → Watch Me
  .theater-* → Nonton Bareng (theater)
  .ft-*      → Fish Tank
  (no prefix) → Global / Desktop / Chat
```

---

## 10. Panduan Menambah Fitur Baru

### Menambah App baru ke desktop

**File yang perlu dibuat/diubah:**

1. **`public/js/namaapp.js`** (file baru)
   - Bungkus semua kode dalam IIFE `(function() { ... })()`
   - Di akhir file, daftarkan ke Desktop:
     ```
     window.addEventListener('DOMContentLoaded', () => {
       Desktop.registerApp('namaapp', {
         icon: '🎮',
         title: 'Nama App',
         render(container) { init(container); }
       });
     });
     ```
   - Fungsi `init(container)` isi HTML ke container, bind socket events
   - Selalu buat fungsi `destroy()` untuk cleanup

2. **`public/css/namaapp.css`** (file baru)
   - Semua class pakai prefix: `.na-*`

3. **`public/index.html`** — tambahkan:
   - `<link rel="stylesheet" href="/css/namaapp.css" />` di `<head>`
   - Icon di `#desktop-icons`
   - Item di `#start-menu`
   - `<script src="/js/namaapp.js"></script>` di akhir `<body>`

4. **`server.js`** — tambahkan:
   - State variabel di bagian atas (setelah Fish Tank state)
   - Socket events di dalam `io.on('connection', ...)` handler
   - Cleanup di `socket.on('disconnect', ...)`

### Menambah Socket event baru

Di `server.js`, di dalam blok `io.on('connection', (socket) => { ... })`:
```
socket.on('namaapp:aksi', (payload) => {
  // validasi payload
  // update state
  // emit response
  io.emit('namaapp:result', data);          // ke semua
  socket.emit('namaapp:result', data);      // ke pengirim saja
  socket.broadcast.emit('namaapp:result', data); // ke semua KECUALI pengirim
  io.to(roomId).emit('namaapp:result', data);    // ke room tertentu
});
```

Di frontend (`namaapp.js`):
```
socket.on('namaapp:result', (data) => {
  // update UI
});
// Saat destroy:
socket.off('namaapp:result');
```

### Menambah REST endpoint baru

Di `server.js`, sebelum blok `io.on('connection', ...)`:
```
app.get('/api/namaapp/data', (req, res) => {
  res.json(data);
});

app.post('/api/namaapp/action', express.json(), (req, res) => {
  // proses req.body
  res.json({ ok: true });
});
```

### Menambah persistensi data baru

Ikuti pola Fish Tank:
1. Tentukan path file: `path.join(__dirname, 'data', 'namaapp.json')`
2. Pastikan folder `data/` ada (server sudah buat otomatis)
3. Buat fungsi `loadData()`, `saveData()`, `pruneExpiredData()`
4. Panggil `loadData()` saat server start
5. Set interval untuk `pruneExpiredData()` jika ada TTL

---

## 11. Known Issues & Bug Log

### Bug yang sudah diperbaiki

| # | Deskripsi | File yang diubah | Root cause |
|---|-----------|-----------------|------------|
| 1 | Icon desktop tidak bisa diklik (single click) | `public/js/desktop.js`, `public/css/style.css` | `#windows-layer` menutupi desktop tanpa `pointer-events: none`; icon butuh double-click |
| 2 | Jendela Nonton Bareng kosong (blank) saat dibuka | `public/js/theater.js` | `registerApp` pakai `onOpen:` tapi Desktop hanya kenal `render:` |
| 3 | Canvas drawing Fish Tank tidak bisa menggambar | `public/js/fishtank.js` | `bindDrawModal()` dipanggil saat `init()` ketika `drawCanvas` masih `null`, sehingga event listener drawing tidak pernah terpasang |
| 4 | Ikan tampil sebagai kotak hitam/putih | `public/js/fishtank.js` | Canvas export memakai background gelap yang sama dengan akuarium; background canvas drawing harus kontras |
| 5 | `Cannot GET /` saat server start | `server.js` | `app.use(express.static(...))` hilang/berpindah posisi setelah edit |
| 6 | Watch Me ikon masih SOON meski sudah ada | `public/index.html` | Class `is-soon` dan `soon-badge` tidak dihapus; `watchme.js` tidak di-load di HTML |
| 7 | Git push rejected | — | Remote repo punya commit yang belum di-pull; solusi: `git pull origin main --rebase` dulu |

### Potensi issue yang belum difix

| # | Deskripsi | Dampak | Saran fix | File terkait |
|---|-----------|--------|-----------|--------------|
| 1 | `ownerId` ikan menggunakan `socket.id` yang berubah setiap connect | User yang reconnect tidak bisa mengedit ikan lama | Gunakan ID yang lebih persisten (localStorage UUID) | `fishtank.js`, `server.js` |
| 2 | Watch Me WebRTC hanya pakai STUN — gagal di NAT strict | Screen share tidak berfungsi di luar LAN | Tambahkan TURN server | `watchme.js` |
| 3 | Tidak ada rate limiting pada kirim pesan | Spam chat memungkinkan | Tambahkan counter per socket | `server.js` |
| 4 | Video upload tidak ada progress bar yang akurat | UX buruk untuk file besar | Gunakan XHR dengan `upload.onprogress` | `theater.js` |
| 5 | Theater room yang dibuat dari video lama (scan boot) diberi nama "Anonim" | Kurang informatif | Simpan `uploaderName` ke metadata video di disk | `server.js` |
| 6 | `fishList` disimpan termasuk `imageData` base64 di JSON | File `fishtank.json` bisa sangat besar jika banyak ikan | Simpan image sebagai file terpisah, JSON hanya simpan path | `server.js` |
| 7 | Tidak ada feedback visual saat upload ikan gagal (gambar terlalu besar) | User tidak tahu kenapa gagal | Handle `fishtank:error` event di UI | `fishtank.js` |
| 8 | Socket listener theater/watchme/fishtank tidak di-cleanup saat tutup window | Event listener menumpuk jika buka-tutup berulang | Pastikan `socket.off()` dipanggil di fungsi `destroy()` | `theater.js`, `watchme.js`, `fishtank.js` |

---

## 12. Roadmap & Ide Fitur

### Fitur yang sudah ada (✅)

- Ruang Obrolan (publik + privat, anonim, nickname/avatar)
- Nonton Bareng (video lokal + YouTube, multi-room, sinkronisasi)
- Watch Me (screen share WebRTC, multi-viewer, chat, reactions)
- Fish Tank (akuarium, gambar ikan via canvas, interaksi, TTL 7 hari)
- Desktop shell (window manager, taskbar, jam analog, wallpaper)

### Ide fitur lanjutan

**Mini games & interaktif:**
- 🎮 **Tic-Tac-Toe / Chess** — game 2 pemain via Socket.IO, bisa diundang dari daftar online
- 🎲 **Dadu & Papan** — lempar dadu bersama, bisa untuk sesi meeting ice-breaker
- 🎨 **Whiteboard** — kanvas bersama real-time (mirip Excalidraw sederhana)
- 🎵 **Musik Bareng** — upload file audio, putar bersama (mirip theater tapi untuk musik)

**Peningkatan fitur yang ada:**
- 📝 **Sticky Notes** — catatan kecil yang bisa ditempel di desktop, sync ke semua user
- 📊 **Poll / Vote** — buat polling cepat dari dalam chat
- 🔔 **Notifikasi** — badge di taskbar saat ada pesan baru di room lain
- 🖼️ **Kirim gambar di chat** — upload/paste gambar langsung di chat
- 😀 **Custom emoji** — upload emoji sendiri untuk dipakai di chat
- 🔍 **Search pesan** — cari di history chat (terbatas di session saja)

**Infrastruktur:**
- 📦 **Docker** — Dockerfile untuk deployment mudah
- 🔒 **Password ruangan** — private room dengan kode akses
- 📱 **PWA** — install sebagai app di HP via browser
- 🌐 **TURN server** — agar Watch Me bisa dipakai lewat internet
- 💾 **Export chat** — download history chat sebagai file teks/JSON

### Cara menambahkan app baru ke roadmap

Saat implementasi:
1. Tambahkan entry di bagian ini dengan status `🔄 In Progress`
2. Buat file JS dan CSS baru dengan prefix yang konsisten
3. Daftarkan ke Desktop via `Desktop.registerApp()`
4. Tambahkan Socket events dengan namespace `namaapp:*`
5. Update dokumentasi ini setelah selesai

---

## Appendix: Checklist Bug Fix

Saat melaporkan atau memperbaiki bug, sertakan:

```
**Bug:** [deskripsi singkat]
**Langkah reproduksi:**
  1. ...
  2. ...
**Yang diharapkan:** ...
**Yang terjadi:** ...
**File terkait:** server.js / public/js/xxx.js / public/css/xxx.css
**Root cause:** ...
**Fix:** [deskripsi perubahan, bukan kode]
```

## Appendix: Checklist Fitur Baru

Sebelum PR/commit fitur baru:

- [ ] File JS baru dibungkus dalam IIFE
- [ ] App didaftarkan via `Desktop.registerApp()`
- [ ] Fungsi `destroy()` ada dan membersihkan semua listener
- [ ] Socket events menggunakan prefix namespace yang konsisten
- [ ] Input dari client divalidasi di server
- [ ] CSS menggunakan class prefix yang unik
- [ ] `index.html` diupdate (CSS link, icon, script)
- [ ] `server.js` cleanup ditambahkan di `socket.on('disconnect')`
- [ ] Dokumentasi ini diupdate
