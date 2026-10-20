# 🏗️ Arsitektur Sistem — Coworker Rest Area

Dokumen ini menjelaskan **bagaimana sistem dirancang**: komponen-komponennya,
alur data, dan keputusan desain yang mendasarinya. Untuk detail implementasi
(step-by-step menambah fitur), lihat [Panduan Developer](developer-guide.md);
untuk daftar event/endpoint, lihat [API Reference](api-reference.md).

---

## Daftar Isi

1. [Ringkasan Eksekutif](#ringkasan-eksekutif)
2. [Stack Teknologi](#stack-teknologi)
3. [Diagram Komponen](#diagram-komponen)
4. [Alur Koneksi & Sesi User](#alur-koneksi--sesi-user)
5. [Model Data & Persistensi](#model-data--persistensi)
6. [Keputusan Desain (Design Decisions)](#keputusan-desain-design-decisions)
7. [Batasan Sistem](#batasan-sistem)

---

## Ringkasan Eksekutif

Coworker Rest Area adalah **aplikasi web single-page** yang di-serve dari satu
proses Node.js. Client tidak meng-install apa pun — cukup membuka alamat LAN
di browser. Komunikasi realtime memakai **satu koneksi Socket.IO per user**
yang dipakai bersama oleh seluruh modul frontend (chat, theater, watch me,
fish tank). Backend sengaja dibuat *stateless-ish*: hampir semua state hidup
di RAM dan hilang saat restart; hanya video upload dan data ikan yang dipertahankan.

**Karakteristik utama:**

- Zero-dependency frontend (vanilla JS), zero-auth, zero-database
- Satu socket connection = satu user session (`socket.id` menjadi user ID)
- Screen share lewat WebRTC peer-to-peer — server hanya relay sinyal
- Auto-expiry untuk semua konten (video 7 hari, room kosong 20 menit, ikan 7 hari)

---

## Stack Teknologi

| Layer | Teknologi | Peran |
|-------|-----------|-------|
| HTTP server | Express 4 | Serve static files + REST endpoint upload |
| Realtime | Socket.IO 4 | Semua event chat, theater, watchme, fishtank |
| Upload | Multer | Multipart video → disk (`public/uploads/`) |
| Frontend | Vanilla HTML/CSS/JS | Window manager + 4 aplikasi, tanpa framework/bundler |
| Video sync | HTML5 `<video>` + YouTube IFrame API | Playback tersinkron antar penonton |
| Screen share | WebRTC (`getUserMedia`/`getDisplayMedia` + `RTCPeerConnection`) | Stream P2P broadcaster → viewers |
| Persistensi | File JSON + disk | Hanya `data/fishtank.json` dan folder uploads |

---

## Diagram Komponen

```
┌───────────────────────────── Browser (Client) ─────────────────────────────┐
│                                                                             │
│  index.html                                                                 │
│    ├─ desktop.js   → Window manager (drag/resize/taskbar/wallpaper)         │
│    ├─ chat.js      → Ruang Obrolan + MEMBUAT socket global ────┐             │
│    ├─ theater.js   → Nonton Bareng        ← pakai socket ──────┤             │
│    ├─ watchme.js   → Watch Me (WebRTC)    ← pakai socket ──────┼──► io()    │
│    └─ fishtank.js  → Fish Tank (canvas)   ← pakai socket ──────┘  (1 koneksi)│
│                                                                             │
│  window._theaterSocket ◄── bridge antar modul (di-set oleh chat.js)         │
│  window.ME             ◄── identitas user, selalu up-to-date                │
└──────────────┬──────────────────────────────────────┬───────────────────────┘
               │ HTTP                                  │ WebSocket (Socket.IO)
               ▼                                      ▼
┌─────────────────────────────── server.js (Node.js) ─────────────────────────┐
│                                                                             │
│  Express                                                                    │
│    ├─ static /public                → aset frontend                         │
│    ├─ POST /api/upload-video (Multer) → public/uploads/ + videoLibrary      │
│    ├─ DELETE /api/video/:id          → hapus file + theater room terkait     │
│    └─ GET /api/videos                → list metadata video                   │
│                                                                             │
│  Socket.IO — io.on('connection')                                             │
│    ├─ Chat: users(Map) · rooms(Map) · message:new/join/create-private       │
│    ├─ Theater: theaterRooms(Map) · sinkronisasi play/pause/seek · reactions │
│    ├─ WatchMe: signaling relay offer/answer/ICE saja (video TIDAK lewat sini)│
│    └─ FishTank: fishList(Array) ↔ data/fishtank.json · prune tiap jam        │
│                                                                             │
│  Scheduler/cleanup                                                           │
│    ├─ auto-delete video > 7 hari                                             │
│    ├─ auto-delete theater room kosong > 20 menit                             │
│    └─ pruneDeadFish() TTL 7 hari                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                 WebRTC media path (di luar server):
        Broadcaster ════════► Viewer 1
                    ════════► Viewer 2   (stream layar langsung P2P via LAN)
```

---

## Alur Koneksi & Sesi User

```
Browser                    server.js
  │  GET /                     │
  ├───────────────────────────►│ load index.html + CSS + JS
  │                            │
  │  io() connect              │
  ├───────────────────────────►│ users.set(socket.id, {…random nick/avatar})
  │  me:init {me, avatarChoices│
  │          , rooms, lobbyMsg}│
  │◄───────────────────────────┤
  │                            │
  │  chat.js set:              │
  │   window._theaterSocket ───┼── theater/watchme/fishtank ikut socket ini
  │   window.ME                │
  │                            │
  │  (user check-in → desktop) │
  │  message:send / room:join /│
  │  theater:join-room / …     │
  ├───────────────────────────►│ routing + validasi + broadcast
  │                            │
  │  disconnect                │
  ├───────────────────────────►│ cleanup: hapus user, tinggalkan semua room,
  │                            │ end watchme session, leave theater room
```

Poin penting:

1. **Identitas = `socket.id`.** Tidak ada login; reconnect menghasilkan "orang" baru.
2. **Satu socket untuk semua modul.** Modul lain tidak memanggil `io()` sendiri;
   mereka menunggu `window._theaterSocket` yang dibuat `chat.js`. Urutan load
   script di `index.html` karena itu wajib dipertahankan.
3. **Server memvalidasi semua input**, client dianggap tidak dipercaya
   (trim/slice panjang string, whitelist emoji, cek MIME, cek ukuran base64).

---

## Model Data & Persistensi

| Data | Lokasi | Umur | Alasan |
|------|--------|------|--------|
| User online | RAM (`users` Map) | sampai disconnect | sesi sementara |
| Chat rooms + pesan | RAM (`rooms` Map) | max 300 pesan/room, hilang saat restart | privasi by design |
| Theater rooms | RAM (`theaterRooms` Map) | auto-hapus jika kosong > 20 menit | hemat resource |
| Metadata video | RAM (`videoLibrary`), direkonstruksi dari disk saat boot | selamanya* | agar room nonton bisa di-resume setelah restart |
| File video | Disk `public/uploads/` | auto-hapus > 7 hari | kuota disk |
| Sesi Watch Me | RAM (`watchmeRooms` Map) | sampai broadcaster stop/disconnect | streaming live, tak perlu disimpan |
| Ikan | Disk `data/fishtank.json` | TTL 7 hari (prune tiap jam) | konten kreatif user, ingin awet |

\* Nama uploader untuk video hasil scan-boot tercatat sebagai "Anonim"
(diketahui sebagai limitation — lihat Known Issues di developer guide).

---

## Keputusan Desain (Design Decisions)

### 1. Semua backend dalam satu file `server.js`
**Alasan:** proyek kecil, mudah dibaca oleh kontributor non-professional,
tanpa build step. **Trade-off:** file tumbuh besar (~28KB); refactor ke modul
mungkin perlu saat fitur bertambah banyak.

### 2. State di RAM, bukan database
**Alasan:** sesuai filosofi "ruang istirahat" — percakapan memang sementara,
privasi maksimal, nol konfigurasi. **Trade-off:** restart = semua chat hilang;
tidak ada multi-process/scale-out.

### 3. WebRTC P2P untuk screen share (bukan relay lewat server)
**Alasan:** latensi rendah dan bandwidth server nyaris nol di LAN. Server hanya
menjadi *signaling relay* (`watchme:offer/answer/ice-candidate`).
**Trade-off:** tanpa TURN, koneksi gagal di NAT strict (di luar LAN).

### 4. Sinkronisasi video berbasis timestamp, bukan frame-lock
**Alasan:** sederhana dan robust di jaringan lokal. Server menyimpan
`currentTime + lastSyncAt`; client menghitung posisi aktual
`currentTime + (Date.now() - lastSyncAt)/1000` dan melakukan koreksi drift
(setiap 5 detik, seek jika selisih > 2 detik). Host terakhir yang menekan
kontrol menjadi `hostId`.

### 5. Modul frontend sebagai IIFE dengan kontrak lifecycle
**Alasan:** tanpa bundler tetap harus hindari tabrakan nama dan memory leak.
Kontraknya: setiap app mendaftar via `Desktop.registerApp(appId, {icon, title, render})`
dan WAJIB menyediakan cleanup (`socket.off`, `cancelAnimationFrame`, clear interval).

### 6. Bridge global eksplisit (`window._theaterSocket`, `window.ME`)
**Alasan:** cara termudah berbagi satu socket antar file JS tanpa module system.
**Trade-off:** coupling implisit — urutan script dan inisialisasi chat.js
menjadi constraint arsitektural yang terdokumentasi.

---

## Batasan Sistem

| Batasan | Dampak | Mitigasi saat ini |
|---------|--------|-------------------|
| Skala kecil (single process, semua di RAM) | Dirancang untuk puluhan–ratusan user sekantor | Cukup untuk use case LAN kantor |
| Tanpa autentikasi | Siapa pun di LAN bisa masuk; room privat hanya "tersembunyi", bukan terenkripsi | Diterima by design (lingkungan kantor terpercaya) |
| STUN-only WebRTC | Watch Me gagal di internet publik/NAT strict | Dokumen: tambahkan TURN bila deploy di luar LAN |
| Upload 2 GB per file via HTTP multipart | Memori/disk server terbatas milik PC kantor | Auto-delete 7 hari menjaga disk |
| Reset saat restart | Chat & sesi aktif hilang | Sudah ditekankan ke pengguna |
| `ownerId` ikan = socket.id | Pemilik ikan "berganti" tiap reconnect | Masuk daftar known issues (saran: UUID di localStorage) |

---

Lanjut ke: [API Reference](api-reference.md) untuk daftar lengkap event, atau
[Panduan Developer](developer-guide.md) untuk praktik kontribusi.
