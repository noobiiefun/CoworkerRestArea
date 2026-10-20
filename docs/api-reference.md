# 🔌 API Reference — Coworker Rest Area

Daftar lengkap seluruh **Socket.IO events** dan **REST endpoints**.
Referensi ini cocok dibuka berdampingan saat membaca `server.js` atau modul frontend.

- Konvensi penamaan event: `modul:aksi` (C→S) dan `modul:aksi-noun` (S→C).
- **C→S** = client emit ke server · **S→C** = server emit ke client · **S↔C** = relay dua arah.
- Untuk konteks arsitektur, lihat [Architecture](architecture.md); untuk objek state lengkap, lihat [Developer Guide §4](developer-guide.md#4-state-management).

---

## Daftar Isi

1. [REST API](#rest-api)
2. [Chat Events](#chat-events)
3. [Theater (Nonton Bareng) Events](#theater-nonton-bareng-events)
4. [Watch Me Events](#watch-me-events)
5. [Fish Tank Events](#fish-tank-events)
6. [Struktur Objek Bersama](#struktur-objek-bersama)

---

## REST API

| Method | Endpoint | Body / Query | Response | Keterangan |
|--------|----------|--------------|----------|------------|
| `POST` | `/api/upload-video` | `multipart/form-data`: field `video` (file), `uploaderId`, `uploaderName` | `{ ok, video: VideoMeta, theaterRoomId }` | Upload video (maks 2 GB, MIME `video/*`). Otomatis membuat/memperbarui theater room milik uploader |
| `DELETE` | `/api/video/:id` | — | `{ ok }` | Hapus file video + theater room terkait; broadcast `theater:video-removed` |
| `GET` | `/api/videos` | — | `Array<VideoMeta>` | List metadata semua video yang tersimpan |

**Aturan upload:**
- Ukuran maksimum: **2 GB** per file
- Validasi tipe: `file.mimetype.startsWith('video/')`
- Nama file disanitasi: karakter non-alphanumeric → `_`
- File disimpan di `public/uploads/`, auto-delete setelah **7 hari**

---

## Chat Events

### Client → Server

| Event | Payload | Keterangan |
|-------|---------|------------|
| `user:set-nickname` | `string` (trim, maks 24 char) | Ganti nickname; broadcast `user:updated` |
| `user:set-avatar` | `string` (emoji) | Ganti avatar; broadcast `user:updated` |
| `message:send` | `{ roomId, text }` | Kirim pesan ke room; di-broadcast sebagai `message:new` |
| `room:create-private` | `{ name, inviteIds: string[] }` | Buat room privat (undang min. 1 orang). Error via `room:error` |
| `room:join` | `roomId` | Join/rejoin room; server balas `room:history` + `rooms:list` |
| `room:leave` | `roomId` | Keluar dari private room |

### Server → Client

| Event | Payload | Dikirim kepada | Keterangan |
|-------|---------|----------------|------------|
| `me:init` | `{ me, avatarChoices, rooms, lobbyMessages }` | socket baru | Inisialisasi identitas + state awal, tepat setelah connect |
| `users:list` | `Array<UserView>` | semua | Perubahan daftar user online |
| `rooms:list` | `Array<RoomSummary>` | per-socket | Hanya room yang relevan bagi penerimanya |
| `user:updated` | `{ id, nickname, avatar }` | semua | Ada yang ganti nama/avatar |
| `message:new` | `{ roomId, message }` | anggota room | Pesan baru |
| `room:history` | `{ roomId, messages }` | pengirim join | Riwayat room (maks 300 pesan) |
| `room:invited` | `RoomSummary` | yang diundang | Notifikasi diundang ke room privat |
| `room:error` | `string` | pengirim | Gagal membuat room |

---

## Theater (Nonton Bareng) Events

### Client → Server

| Event | Payload | Keterangan |
|-------|---------|------------|
| `theater:get-rooms` | — | Minta daftar ruangan (balasan `theater:rooms-list`) |
| `theater:join-room` | `roomId` | Masuk ruangan nonton; server balas `theater:init` |
| `theater:leave-room` | — | Keluar dari ruangan aktif |
| `theater:create-yt-room` | `{ ytId, ytUrl, uploaderName, uploaderId }` | Buat ruangan YouTube dari link |
| `theater:change-yt-video` | `{ ytId, ytUrl }` | Ganti video YouTube dalam ruangan |
| `theater:select-video` | `videoId` | Pilih video lokal untuk diputar |
| `theater:play` | `{ currentTime }` | Play — pemegang kontrol jadi `hostId` |
| `theater:pause` | `{ currentTime }` | Pause |
| `theater:seek` | `{ currentTime }` | Seek ke posisi tertentu |
| `theater:request-sync` | — | Minta state playback terkini (mis. setelah drift) |
| `theater:message-send` | `string` | Chat dalam ruangan theater |
| `theater:react` | `emoji` | Reaction — whitelist: 👍❤️😂😮😢🔥👏🎉 |

### Server → Client

| Event | Payload | Keterangan |
|-------|---------|------------|
| `theater:rooms-list` | `Array<TheaterRoomSummary>` | Daftar ruangan nonton |
| `theater:videos-list` | `Array<VideoMeta>` | Daftar video library |
| `theater:init` | `{ state, videos, viewers, messages }` | State lengkap saat join room |
| `theater:state` | `TheaterState` | Update playback (play/pause/seek/host) |
| `theater:viewer-joined` | `UserView` | Penonton baru |
| `theater:viewer-left` | `userId` | Penonton keluar |
| `theater:viewers-count` | `number` | Update jumlah penonton |
| `theater:message` | `Message` | Pesan chat theater |
| `theater:reaction` | `{ userId, nickname, emoji }` | Reaction terbang di layar |
| `theater:host-changed` | `userId \| null` | Host playback berganti |
| `theater:room-deleted` | `roomId` | Room dihapus (manual/auto > 20 menit kosong) |
| `theater:video-added` | `VideoMeta` | Video baru selesai diupload |
| `theater:video-removed` | `videoId` | Video dihapus |
| `theater:yt-room-created` | `{ roomId, roomName }` | Konfirmasi room YouTube dibuat |
| `theater:user-updated` | `UserView` | Nickname/avatar penonton berubah |
| `theater:error` | `string` | Error (room tidak ada, payload invalid, dsb.) |

**Alur sinkronisasi (ringkas):**

```
siapa pun press play → theater:play {currentTime}
   → server simpan {isPlaying:true, currentTime, lastSyncAt:Date.now(), hostId}
   → theater:state di-broadcast ke seluruh member
   → tiap client: posisi = currentTime + (Date.now() - lastSyncAt)/1000
   → client cek drift tiap 5 dtk; jika selisih > 2 dtk → seek koreksi
```

---

## Watch Me Events

Server **hanya me-relay signaling WebRTC**; stream video berjalan P2P langsung
dari broadcaster ke tiap viewer.

### Client → Server

| Event | Payload | Keterangan |
|-------|---------|------------|
| `watchme:get-rooms` | — | Minta daftar sesi aktif |
| `watchme:create-room` | `{ broadcasterName, broadcasterId }` | Mulai siaran (setelah `getDisplayMedia` sukses) |
| `watchme:join-room` | `{ roomId }` | Viewer masuk sesi |
| `watchme:leave-room` | — | Keluar dari sesi |
| `watchme:message-send` | `string` | Chat samping siaran |
| `watchme:react` | `emoji` | Reaction — whitelist: 👍❤️😂😮🔥👏🎉😱 |
| `watchme:offer` | `{ to, offer }` | SDP offer broadcaster → viewer (relay) |
| `watchme:answer` | `{ to, answer }` | SDP answer viewer → broadcaster (relay) |
| `watchme:ice-candidate` | `{ to, candidate }` | ICE candidate (relay) |

### Server → Client

| Event | Payload | Keterangan |
|-------|---------|------------|
| `watchme:rooms-list` | `Array<WatchMeRoomSummary>` | Daftar sesi LIVE |
| `watchme:room-created` | `{ roomId, roomName }` | Konfirmasi siaran dimulai |
| `watchme:init` | `{ viewers, messages }` | State awal untuk viewer yang join |
| `watchme:viewer-joined` | `{ viewerId, viewerNickname, viewerAvatar }` | Broadcaster diminta membuat offer untuk viewer baru |
| `watchme:viewer-left` | `viewerId` | Viewer keluar (peer connection ditutup broadcaster) |
| `watchme:viewers-count` | `number` | Jumlah penonton |
| `watchme:message` | `Message` | Pesan chat |
| `watchme:reaction` | `{ userId, nickname, emoji }` | Reaction |
| `watchme:room-ended` | — | Sesi berakhir (broadcaster stop/disconnect) |
| `watchme:error` | `string` | Error |

**Negosiasi WebRTC:**

```
Viewer join → server: watchme:viewer-joined → Broadcaster
Broadcaster: new RTCPeerConnection(viewer) + addTrack(stream)
           → createOffer → watchme:offer {to: viewer}
Server relay → Viewer: setRemote(offer) → createAnswer
           → watchme:answer {to: broadcaster}
ICE candidates bolak-balik via watchme:ice-candidate
Koneksi P2P terbentuk → video mengalir TANPA lewat server
```

Konfigurasi ICE saat ini hanya STUN Google (`stun.l.google.com:19302`,
`stun1.l.google.com:19302`). Untuk penggunaan lintas NAT publik perlu TURN.

---

## Fish Tank Events

### Client → Server

| Event | Payload | Keterangan |
|-------|---------|------------|
| `fishtank:get-fish` | — | Minta semua ikan (balasan `fishtank:all-fish`) |
| `fishtank:add-fish` | `{ imageData, nickname, ownerId }` | Submit ikan hasil gambar canvas. `imageData` base64 JPEG, maks 300.000 karakter |
| `fishtank:feed` | — | Beri makan — dibroadcast ke semua klien |
| `fishtank:poke-fish` | `fishId` | Colek ikan — dibroadcast agar ikan kabur di semua layar |

### Server → Client

| Event | Payload | Keterangan |
|-------|---------|------------|
| `fishtank:all-fish` | `Array<FishPublic>` | Semua ikan hidup |
| `fishtank:fish-added` | `FishPublic` | Ikan baru |
| `fishtank:fish-replaced` | `{ oldId, fish }` | Ikan milik user diganti |
| `fishtank:fish-removed` | `fishId` | Ikan mati (TTL 7 hari, prune tiap jam) |
| `fishtank:feed` | — | Partikel makanan muncul di akuarium semua orang |
| `fishtank:poke-fish` | `fishId` | Animasi kabur pada ikan tsb. |
| `fishtank:error` | `string` | Error (mis. gambar terlalu besar) |

---

## Struktur Objek Bersama

```js
// UserView — representasi publik user
{ id, nickname, avatar }

// Message
{ id, userId, nickname, avatar, text, timestamp }

// RoomSummary (chat)
{ id, name, isPrivate, memberCount }

// VideoMeta
{
  id,             // "v_" + timestamp base36
  filename,       // nama file asli
  url,            // "/uploads/<sanitized>"
  size,           // bytes
  uploadedAt,     // epoch ms
  uploaderId,     // string | null
  uploaderName
}

// TheaterRoomSummary
{ id, name, currentVideoTitle, memberCount, isPlaying }

// TheaterState
{ roomId, roomName, currentVideo, isPlaying,
  currentTime, hostId, lastSyncAt, memberCount }

// WatchMeRoomSummary
{ id, name, broadcasterName, viewerCount, createdAt }

// FishPublic (tanpa ownerId internal)
{ id, nickname, imageData, createdAt }
```

---

« [Index Dokumentasi](README.md) · [Architecture](architecture.md) · [Developer Guide](developer-guide.md) »
