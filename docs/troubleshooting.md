# 🛠️ Troubleshooting & FAQ — Coworker Rest Area

Kumpulan masalah yang sering ditemui dan cara mengatasinya. Kalau gejala kamu
tidak ada di sini, cek [Known Issues di Developer Guide](developer-guide.md#11-known-issues--bug-log)
atau laporkan dengan format checklist di dokumen tersebut.

---

## Daftar Isi

**Jaringan & Server**
- [Komputer lain tidak bisa connect](#komputer-lain-tidak-bisa-connect)
- [Server gagal start / port bentrok](#server-gagal-start--port-bentrok)
- [`Cannot GET /` saat membuka halaman](#cannot-get--saat-membuka-halaman)

**Fitur**
- [Nonton Bareng: video tersendak / tidak sinkron](#nonton-bareng-video-tersendak--tidak-sinkron)
- [Nonton Bareng: video YouTube tidak mau diputar](#nonton-bareng-video-youtube-tidak-mau-diputar)
- [Watch Me: layar penonton hitam / gagal connect](#watch-me-layar-penonton-hitam--gagal-connect)
- [Fish Tank: submit ikan ditolak](#fish-tank-submit-ikan-ditolak)

**Data**
- [Chat hilang setelah server restart — normal?](#chat-hilang-setelah-server-restart--normal)
- [Video upload hilang](#video-upload-hilang)

**Umum (FAQ)**
- [Perlu internet?](#perlu-internet)
- [Bisa dipakai dari HP?](#bisa-dipakai-dari-hp)
- [Browser apa yang didukung?](#browser-apa-yang-didukung)
- [Berapa banyak user?](#berapa-banyak-user)

---

## Jaringan & Server

### Komputer lain tidak bisa connect

**Gejala:** `http://localhost:3000` jalan di komputer server, tapi alamat LAN
(mis. `http://192.168.1.23:3000`) tidak bisa dibuka dari komputer lain.

**Penyebab paling umum: Firewall Windows memblokir port 3000.**

Solusi:
1. Buka **Windows Defender Firewall → Allow an app through firewall**
2. Cari **Node.js** (atau tambahkan `node.exe`) → centang jaringan **"Private"**
3. Alternatif via PowerShell (admin):
   ```powershell
   netsh advfirewall firewall add rule name="CoworkerRestArea" dir=in action=allow protocol=TCP localport=3000
   ```

Cek tambahan:
- Pastikan kedua komputer di **Wi-Fi/LAN yang sama** (jaringan "Public" di
  Windows sering memblokir koneksi masuk)
- Pastikan IP di terminal masih valid (IP DHCP bisa berubah) — cek ulang dengan `ipconfig`
- Coba `ping 192.168.1.23` dari komputer client dulu sebelum tes browser

### Server gagal start / port bentrok

**Gejala:** `EADDRINUSE: address already in use :::3000`

Ada proses lain yang memakai port 3000 (sering: instance server yang lama
masih berjalan). Solusi:
- Tutup terminal/server lama, atau
- Cari process-nya: `netstat -ano | findstr :3000` (Windows) lalu
  `taskkill /PID <pid>` — atau ganti port di `server.js` (`PORT = 3000`).

**Gejala:** `Error: Cannot find module 'express'`

Dependency belum terinstall — jalankan `npm install` di folder project.
Butuh **Node.js ≥ 18**; cek dengan `node -v`.

### `Cannot GET /` saat membuka halaman

Biasanya karena baris `app.use(express.static(...))` hilang/terpindah saat
mengedit `server.js`. Pastikan static middleware didaftarkan sebelum handler
lain yang men-intercept route. (Pernah terjadi — lihat Bug Log #5.)

---

## Fitur

### Nonton Bareng: video tersendak / tidak sinkron

- Sinkronisasi berbasis timestamp; koreksi drift otomatis tiap 5 detik
  (seek jika selisih > 2 detik). Tunggu ~5 detik setelah menekan play.
- Tekan tombol **sync** / buka ulang room untuk memicu `theater:request-sync`.
- Video sangat besar + HDD lambat + banyak penonton sekaligus bisa bikin buffer
  tidak merata — kurangi jumlah penonton per room atau transcode ke bitrate lebih rendah.
- Jika satu browser me-load ulang (F5), dia akan auto-sync ke posisi terbaru.

### Nonton Bareng: video YouTube tidak mau diputar

Beberapa kemungkinan:
- Video **tidak boleh di-embed** (pembatasan hak cipta pemilik channel) —
  coba video lain.
- Link salah format — yang didukung: `/watch?v=…`, youtu.be/…, `/live`, `/shorts`.
  ID diekstrak otomatis via regex.
- Browser memblokir autoplay bersuara — beberapa browser butuh interaksi
  user dulu sebelum suara keluar.

### Watch Me: layar penonton hitam / gagal connect

Urutan pengecekan:
1. Broadcaster benar-benar sudah **memilih sumber layar** di dialog browser
   (kalau dialog dibatalkan, sesi tidak dibuat).
2. Izin screen share diberikan (ikon kamera/mikrofon di address bar browser).
3. Penonton dan broadcaster di **LAN yang sama** — WebRTC di sini hanya
   memakai STUN, tanpa TURN. Lewat internet/NAT strict, koneksi P2P bisa gagal.
4. Gunakan **Chrome/Edge** — Firefox mendukung getDisplayMedia tapi
   pembatasan fitur lebih ketat.
5. Restart sesi: hentikan siaran (⏹) lalu mulai lagi.

### Fish Tank: submit ikan ditolak

- Gambar melebihi batas (~300.000 karakter base64 ≈ 220KB). Canvas 360×220
  dengan JPEG 85% biasanya 30–80KB — kalau penuh coretan tebal bisa lewat.
  Coba gambar lebih sederhana atau gunakan warna solid.
- Validasi pixel: canvas harus berisi **pixel berbeda dari background**
  (`#12243a`) — submit dengan kanvas kosong akan ditolak.
- Saat ini pesan error dari server (`fishtank:error`) belum selalu tampil di UI —
  cek console browser (masuk known issues #7).

---

## Data

### Chat hilang setelah server restart — normal?

**Ya, disengaja.** Semua pesan chat hanya disimpan di RAM demi privasi.
Yang bertahan lintas restart: file video upload (`public/uploads/`) dan
data ikan (`data/fishtank.json`).

### Video upload hilang

- Video **auto-delete setelah 7 hari** — memang begitu aturannya.
- Folder `public/uploads/` jangan ikut terhapus saat pull/deploy; pastikan
  ia tidak dibersihkan oleh skrip build.
- Ruangan nonton yang kosong > 20 menit juga dihapus, tapi videonya tetap
  ada di library dan bisa dibuat ruangan baru.

---

## Umum (FAQ)

### Perlu internet?
Tidak. Semua berjalan di LAN. Pengecualian kecil: Watch Me memakai STUN Google
untuk negosiasi WebRTC (hanya pertukaran alamat, bukan data video), dan mode
YouTube obviously butuh internet. Chat dan video lokal 100% offline.

### Bisa dipakai dari HP?
Bisa, asalkan satu Wi-Fi dengan server. Layout responsif: aplikasi dibuka
fullscreen dengan tab navigasi (daftar/player/chat).

### Browser apa yang didukung?
Chrome, Edge, dan Firefox terbaru. Screen sharing dan beberapa fitur WebRTC
paling stabil di Chrome/Edge.

### Berapa banyak user?
Didesain untuk skala sekantor (puluhan hingga ratusan pengguna simultan pada
satu PC). Tidak ada batas teknis keras, tapi semua state di RAM single-process.

### Apakah percakapan privat benar-benar privat?
Room privat tidak dikirim ke user di luar room. Tapi ingat: tidak ada enkripsi
end-to-end dan tidak ada autentikasi — model kepercayaannya adalah jaringan
kantor internal.

---

« [Index Dokumentasi](README.md) · [User Guide](user-guide.md) · [Developer Guide](developer-guide.md) »
