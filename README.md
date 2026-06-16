# Coworker Rest Area 🛎️

Ruang istirahat virtual untuk para pekerja di jaringan LAN kantor. Tampilan
seperti desktop Windows, dengan aplikasi-aplikasi yang bisa dibuka sebagai
jendela.

> Semua pesan hanya disimpan di **memori server (RAM)**. Video yang diupload
> disimpan di disk (`public/uploads/`). Begitu server di-restart atau dimatikan,
> seluruh riwayat chat otomatis hilang. Nickname & avatar sepenuhnya bebas
> diganti — tidak ada sistem akun/login.

## Fitur saat ini

### ✅ Step 1 — Ruang Obrolan
- Tampilan desktop ala Windows: drag, resize, minimize, maximize, taskbar
- Obrolan anonim di **Lobby Utama**
- Ganti nickname & avatar emoji
- Ruang privat (minimal 2 orang), hilang otomatis saat semua keluar

### ✅ Step 2 — Nonton Bareng
- Upload video dari komputer (hingga 2 GB per file)
- Daftar video di panel kiri, pilih untuk ditayangkan
- Video player dengan kontrol lengkap: play/pause, progress bar, volume, fullscreen
- **Sinkronisasi otomatis**: semua penonton play/pause/seek bersama-sama
- Siapa pun bisa mengontrol playback (tidak ada "host" eksklusif)
- Chat panel di kanan, real-time seperti siaran langsung
- Emoji reactions (👍❤️😂😮😢🔥👏🎉) yang "terbang" di layar
- Jumlah penonton live di badge
- Video tetap ada di disk walau server restart

### 🔜 Step 3 — Watch Me
- Fitur sudah ada ikonnya di desktop (ditandai "SOON")

## Cara menjalankan

Butuh [Node.js](https://nodejs.org) versi 18+ di **satu** komputer server.

```bash
# 1. masuk ke folder project
cd coworker-rest-area

# 2. install dependency (sekali saja, pastikan ada multer)
npm install

# 3. jalankan server
npm start
```

Terminal akan menampilkan:
```
========================================
 Coworker Rest Area server berjalan!
  Lokal:   http://localhost:3000
  LAN:     http://192.168.1.23:3000
========================================
```

- Di komputer **server**: buka `http://localhost:3000`
- Di komputer **lain di LAN**: buka alamat LAN di browser

## Panduan integrasi Step 2 ke project yang sudah ada

Jika kamu sudah punya project Step 1, tambahkan ini:

### 1. `server.js`
Ganti seluruh isi `server.js` dengan versi baru (sudah include multer + theater events).

### 2. `public/js/theater.js`
File baru — salin ke folder `public/js/`.

### 3. `public/css/theater.css`
File baru — salin ke `public/css/`. Lalu tambahkan di `public/index.html`:
```html
<link rel="stylesheet" href="/css/theater.css">
<script src="/js/theater.js" defer></script>
```

### 4. `public/index.html`
Ubah ikon "Nonton Bareng" di desktop agar tidak lagi ditandai "SOON":
```html
<!-- Cari baris tombol Nonton Bareng, hapus badge "SOON", ubah onclick -->
<div class="desktop-icon" onclick="Desktop.openApp('theater')">
  <div class="desktop-icon-img">📺</div>
  <div class="desktop-icon-label">Nonton Bareng</div>
</div>
```

Dan pastikan ada global socket yang bisa diakses oleh theater.js.
Di `public/js/chat.js`, setelah socket dibuat, tambahkan:
```js
window._theaterSocket = socket;
window.ME = meUser; // objek { id, nickname, avatar }
```

### 5. `package.json`
Pastikan `multer` sudah ada di dependencies:
```json
"dependencies": {
  "express": "^4.18.2",
  "multer": "^1.4.5-lts.1",
  "socket.io": "^4.7.2"
}
```
Lalu jalankan `npm install` ulang.

## Struktur project

```
coworker-rest-area/
├── server.js
├── package.json
└── public/
    ├── index.html
    ├── uploads/           ← video tersimpan di sini (dibuat otomatis)
    ├── css/
    │   ├── style.css
    │   └── theater.css    ← BARU (Step 2)
    └── js/
        ├── desktop.js
        ├── chat.js
        └── theater.js     ← BARU (Step 2)
```

## Roadmap

- [x] **Step 1** — Ruang Obrolan
- [x] **Step 2** — Nonton Bareng
- [ ] **Step 3** — Watch Me (screen share + chat)
