# 📋 Change Log — Coworker Rest Area

Riwayat perubahan besar pada aplikasi. Format mengikuti semangat
[Keep a Changelog](https://keepachangelog.com), ditulis dalam Bahasa Indonesia.

---

## [Step 4] — Fish Tank 🐠 ✅

### Ditambahkan
- **Fish Tank**: akuarium komunal berbasis canvas dengan animasi requestAnimationFrame
  (ikan, gelembung, tanaman bergoyang, batu deterministik via seed mulberry32)
- **Drawing tool in-app**: lukis ikan sendiri (pensil, penghapus, pilihan warna/ukuran,
  undo hingga 30 snapshot), submit sebagai JPEG 85%
- Interaksi realtime: **beri makan** (ikan mencari makanan radius 120px) dan
  **colek ikan** (ikan kabur selama 60 frame) — disinkronkan ke semua klien
- Persistensi ikan di `data/fishtank.json` — bertahan lintas restart server
- TTL ikan 7 hari: efek tumbuh (hari 1–2), memudar (hari 6–7), prune otomatis tiap jam
- Modul `fishtank.js`, `fishtank.css`, namespace event `fishtank:*`

## [Step 3] — Watch Me 🖥️ ✅

### Ditambahkan
- **Screen sharing peer-to-peer** via WebRTC (`getDisplayMedia` + `RTCPeerConnection`)
  — satu broadcaster ke banyak viewer, video tidak melewati server
- Signaling relay via Socket.IO: `watchme:offer`, `watchme:answer`, `watchme:ice-candidate`
- Lobby sesi LIVE real-time; tombol **Tonton** untuk masuk sesi
- Kontrol broadcaster (hentikan siaran, fullscreen preview) & viewer (volume, mute, fullscreen)
- Chat panel samping + emoji reactions 👍❤️😂😮🔥👏🎉😱
- Auto-cleanup: sesi berakhir saat broadcaster stop/disconnect; semua viewer diberi tahu
- Responsif mobile dengan tab navigasi
- Modul `watchme.js`, `watchme.css`, namespace event `watchme:*`

## [Step 2] — Nonton Bareng 📺 ✅

### Ditambahkan
- **Watch party tersinkron**: play/pause/seek siapa pun berlaku untuk semua penonton;
  koreksi drift tiap 5 detik (seek jika selisih > 2 detik)
- **Upload video** hingga 2 GB per file (Multer → `public/uploads/`), metadata
  direkonstruksi dari disk saat server boot
- **Multi-ruangan**: setiap uploader punya ruangan sendiri; penonton bisa pindah-pindah
- **Mode YouTube**: tempel link (`/watch`, `/live`, `/shorts`) → room YouTube bersama
  via IFrame Player API
- Player lengkap: progress bar, volume, mute, fullscreen
- Chat panel + emoji reactions 👍❤️😂😮😢🔥👏🎉 yang terbang di layar; badge penonton live
- Kebijakan retensi: video auto-delete setelah 7 hari; room kosong > 20 menit dihapus
- REST endpoints: `POST /api/upload-video`, `DELETE /api/video/:id`, `GET /api/videos`
- Modul `theater.js`, `theater.css`, namespace event `theater:*`

## [Step 1] — Ruang Obrolan 💬 + Desktop Shell ✅

### Ditambahkan
- **Desktop shell ala Windows 7**: ikon desktop, taskbar, start menu, jam analog,
  window manager (drag, resize, minimize, maximize, close)
- **Wallpaper**: ganti via URL atau upload file lokal; disimpan di localStorage
- **Check-in screen**: pilih avatar emoji + nama panggilan sebelum masuk
- **Lobby Utama** (publik, auto-join) dan **ruang privat** (undang min. 1 orang,
  terisolasi dari user lain, auto-hapus saat semua keluar)
- Ganti nickname/avatar kapan saja — berlaku di semua ruangan
- Daftar online real-time
- Pesan hanya di RAM (privasi by design), max 300 pesan per room
- Modul `desktop.js`, `chat.js`, `style.css`; socket global `window._theaterSocket`

## Perbaikan Bug Terkenal (ringkasan)

| Bug | Fix | Versi |
|-----|-----|-------|
| Icon desktop tidak bisa diklik (single click) | `pointer-events: none` pada `#windows-layer`, `auto` pada window | Step 1 |
| Jendela Nonton Bareng blank | `registerApp` harus pakai `render:` bukan `onOpen:` | Step 2 |
| Canvas Fish Tank tidak bisa menggambar | `bindDrawModal()` dipanggil setelah drawCanvas tersedia | Step 4 |
| Ikan tampil kotak hitam/putih | Background canvas drawing dibuat kontras (`#12243a`) | Step 4 |
| `Cannot GET /` | Static middleware Express dipastikan terdaftar | Step 1 |
| Ikon Watch Me masih "SOON" | Hapus class `is-soon`, load `watchme.js` di HTML | Step 3 |

Detail lengkap: [Developer Guide §11 — Known Issues & Bug Log](developer-guide.md#11-known-issues--bug-log)

---

## Cara mengisi change log ini

Saat menyelesaikan fitur/perbaikan besar:
1. Tambahkan entri baru di **paling atas** dengan tanggal/langkah
2. Kelompokkan menjadi `Ditambahkan / Diubah / Diperbaiki / Dihapus`
3. Sebutkan file & namespace event baru bila ada
4. Sinkronkan dengan [Developer Guide](developer-guide.md) bagian roadmap & known issues
