<img width="1254" height="1254" alt="Coworker Rest Area" src="https://github.com/user-attachments/assets/81322afd-4d52-41db-82c2-0d7126bf37b4" />




# Coworker Rest Area 🛎️

Ruang istirahat virtual untuk para pekerja di jaringan LAN kantor. Tampilan seperti desktop Windows, dengan aplikasi-aplikasi yang bisa dibuka sebagai jendela. Semua fitur berjalan **lokal di jaringan LAN** — tidak butuh internet, tidak ada akun, tidak ada data yang dikirim ke luar.

> **Privasi:** Semua pesan hanya disimpan di memori server (RAM) dan hilang saat server di-restart. Video yang diupload disimpan di disk dan otomatis dihapus setelah 7 hari. Tidak ada sistem login — identitas sepenuhnya anonim dan bisa diganti kapan saja.

---

## Fitur

### ✅ Step 1 — Ruang Obrolan

Aplikasi chat real-time dengan tampilan desktop ala Windows.

- **Tampilan desktop:** ikon di desktop, taskbar, start menu, jam analog, ganti wallpaper (URL atau upload file lokal)
- **Window manager:** setiap aplikasi buka sebagai jendela yang bisa di-drag, di-resize, minimize, maximize, dan ditutup
- **Check-in screen:** pilih avatar emoji dan nama panggilan sebelum masuk
- **Lobby Utama:** ruang obrolan publik, semua orang otomatis masuk
- **Ruang privat:** buat ruang obrolan terpisah, undang minimal 1 orang lain, obrolan tidak terlihat oleh pengguna lain; ruang otomatis hilang saat semua anggota keluar
- **Ganti identitas:** ganti nickname dan avatar emoji kapan saja, langsung berlaku di semua ruangan
- **Daftar online:** tampil real-time siapa saja yang sedang aktif

---

### ✅ Step 2 — Nonton Bareng

Ruang nonton video bersama secara sinkron, mirip seperti watch party.

- **Multi-ruangan:** setiap orang yang upload video otomatis punya ruangan sendiri; penonton bisa pindah-pindah ruangan
- **Upload video:** mendukung file video hingga 2 GB per file; video tersimpan di disk dan tetap ada walau server di-restart
- **Nonton YouTube:** tempel link YouTube (termasuk `/live`, `/shorts`) untuk membuka ruangan nonton YouTube bersama
- **Sinkronisasi real-time:** semua penonton play/pause/seek secara bersamaan — siapa pun bisa mengontrol playback
- **Player lengkap:** play/pause, progress bar, volume, mute, fullscreen
- **Auto-delete:** video otomatis dihapus setelah 7 hari; ruangan kosong > 20 menit otomatis dihapus
- **Chat panel:** obrolan live di sebelah kanan player
- **Emoji reactions:** 👍❤️😂😮😢🔥👏🎉 yang "terbang" di layar video
- **Badge penonton:** jumlah penonton tampil live
- **Responsif mobile:** tab navigasi untuk berpindah antara daftar video, player, dan chat

---

### ✅ Step 3 — Watch Me

Fitur berbagi layar peer-to-peer, mirip Google Meet screen share, dengan chat samping.

- **Screen share:** broadcaster berbagi layar (seluruh layar, jendela tertentu, atau tab browser) ke semua penonton di LAN
- **Peer-to-peer WebRTC:** video langsung dari broadcaster ke viewer tanpa melewati server; latensi rendah di LAN
- **Lobby sesi:** daftar sesi aktif tampil real-time; penonton tinggal klik "Tonton"
- **Broadcaster controls:** tombol hentikan siaran, fullscreen preview layar sendiri; indikator LIVE di header
- **Viewer controls:** volume, mute, fullscreen
- **Chat panel:** obrolan live di sebelah kanan layar
- **Emoji reactions:** 👍❤️😂😮🔥👏🎉😱 yang terbang di layar
- **Auto-cleanup:** sesi berakhir otomatis saat broadcaster disconnect atau menghentikan siaran; semua viewer diberitahu
- **Responsif mobile:** tab navigasi untuk berpindah antara layar dan chat

---

## Cara Menjalankan

Butuh [Node.js](https://nodejs.org) versi **18 ke atas** di **satu** komputer yang akan jadi server. Komputer lain cukup buka browser.

```bash
# 1. Masuk ke folder project
cd coworker-rest-area

# 2. Install dependency (hanya perlu sekali)
npm install

# 3. Jalankan server
npm start
```

Terminal akan menampilkan:

```
========================================
 Coworker Rest Area server berjalan!
  Lokal:   http://localhost:3000
  LAN:     http://192.168.1.23:3000
 Bagikan alamat LAN ke komputer lain di jaringan yang sama.
========================================
```

- **Komputer server:** buka `http://localhost:3000`
- **Komputer lain di LAN/Wi-Fi yang sama:** buka alamat LAN yang tampil di terminal

> Jika komputer lain tidak bisa connect, biasanya Firewall Windows memblokir port 3000.
> Solusi: izinkan Node.js / port 3000 di **Windows Defender Firewall → Allow an app through firewall** untuk jaringan "Private".

---

## Cara Pakai Tiap Fitur

### Ruang Obrolan
1. Saat pertama buka, pilih avatar emoji dan isi nama panggilan → klik **Masuk ke Rest Area**
2. Jendela Ruang Obrolan otomatis terbuka di **Lobby Utama**
3. Klik avatar atau nama di pojok kiri untuk menggantinya kapan saja
4. Klik **+** di samping "Ruangan" untuk membuat ruang privat dan mengundang orang

### Nonton Bareng
1. Buka ikon **📺 Nonton Bareng** di desktop
2. Di lobby, klik **Upload** untuk upload file video dari komputermu — ruanganmu otomatis terbuat
3. Atau tempel **link YouTube** dan klik **▶ Buat Ruangan YT**
4. Penonton lain masuk lewat lobby dan klik **Masuk** di ruanganmu
5. Siapa pun bisa play/pause/seek — semua penonton otomatis tersinkron
6. Klik **← Kembali** untuk kembali ke lobby dan pindah ruangan lain

### Watch Me
1. Buka ikon **🖥️ Watch Me** di desktop
2. **Untuk berbagi layar:** klik **Mulai Bagikan Layarku** → pilih layar/jendela/tab yang ingin dibagikan di dialog browser → sesimu otomatis muncul di lobby
3. **Untuk menonton:** klik tombol **Tonton** di sesi yang muncul di lobby
4. Gunakan emoji reactions dan chat di panel kanan
5. Klik **← Kembali** atau **⏹ Hentikan** untuk keluar dari sesi

---

## Struktur Project

```
coworker-rest-area/
├── server.js               # Express + Socket.IO + WebRTC signaling
├── package.json
└── public/
    ├── index.html           # Boot screen + shell desktop
    ├── uploads/             # Video tersimpan di sini (dibuat otomatis)
    ├── css/
    │   ├── style.css        # Styling utama + desktop
    │   ├── theater.css      # Styling Nonton Bareng (Step 2)
    │   └── watchme.css      # Styling Watch Me (Step 3)
    └── js/
        ├── desktop.js       # Window manager (drag, resize, taskbar, wallpaper)
        ├── chat.js          # Ruang Obrolan + expose socket global
        ├── theater.js       # Nonton Bareng
        └── watchme.js       # Watch Me (screen share WebRTC)
```

---

## Dependency

```json
{
  "express": "^4.18.2",
  "socket.io": "^4.7.2",
  "multer": "^1.4.5-lts.1"
}
```

Tidak ada database. Tidak ada dependency frontend (semua vanilla JS).

---

## Catatan Teknis

| Hal | Penjelasan |
|-----|------------|
| **Pesan chat** | Hanya di RAM, hilang saat server restart |
| **Video upload** | Tersimpan di disk di `public/uploads/`, otomatis dihapus setelah 7 hari |
| **Ruang nonton kosong** | Otomatis dihapus setelah 20 menit tidak ada penonton |
| **Watch Me** | Menggunakan WebRTC peer-to-peer; bekerja optimal di LAN tanpa konfigurasi tambahan |
| **Watch Me (internet)** | Jika diakses dari luar LAN, perlu TURN server tambahan untuk menembus NAT |
| **Browser** | Chrome, Edge, Firefox terbaru direkomendasikan; Screen share butuh izin dari browser |
| **Mobile** | Bisa diakses dari HP di jaringan Wi-Fi yang sama; layout responsif dengan tab navigasi |

---

## Roadmap

- [x] **Step 1** — Ruang Obrolan (publik + privat, ganti nickname & avatar, wallpaper)
- [x] **Step 2** — Nonton Bareng (upload video, YouTube, multi-ruangan, sinkronisasi)
- [x] **Step 3** — Watch Me (screen share WebRTC, multi-viewer, chat, reactions)
