# 🧭 Panduan Pengguna — Coworker Rest Area

Dokumen ini menjelaskan cara **menjalankan server** dan **memakai setiap aplikasi**
di Coworker Rest Area. Tidak perlu keahlian teknis untuk bagian "Cara Pakai" —
cukup browser.

> Lihat juga: [Index Dokumentasi](README.md) · [Troubleshooting](troubleshooting.md)

---

## Daftar Isi

1. [Apa itu Coworker Rest Area?](#apa-itu-coworker-rest-area)
2. [Persyaratan](#persyaratan)
3. [Cara Menjalankan Server](#cara-menjalankan-server)
4. [Langkah Pertama (Quick Start)](#langkah-pertama-quick-start)
5. [Desktop Virtual](#desktop-virtual)
6. [💬 Ruang Obrolan](#-ruang-obrolan)
7. [📺 Nonton Bareng](#-nonton-bareng)
8. [🖥️ Watch Me (Bagi Layar)](#-watch-me-bagi-layar)
9. [🐠 Fish Tank](#-fish-tank)
10. [Privasi & Keamanan](#privasi--keamanan)

---

## Apa itu Coworker Rest Area?

Ruang istirahat virtual untuk para pekerja di jaringan LAN kantor. Tampilannya
seperti desktop Windows klasik, dengan aplikasi-aplikasi yang bisa dibuka
sebagai jendela: ngobrol, nonton video bareng, berbagi layar, dan memelihara
ikan di akuarium bersama.

**Tanpa internet, tanpa akun, tanpa install di komputer client.** Semua berjalan
di jaringan lokal kantor/Wi-Fi yang sama.

| Aplikasi | Ikon | Fungsi |
|----------|------|--------|
| Ruang Obrolan | 💬 | Chat real-time publik & privat ala Windows Messenger |
| Nonton Bareng | 📺 | Watch party video/YouTube yang tersinkron untuk semua penonton |
| Watch Me | 🖥️ | Share layar peer-to-peer mirip Google Meet + chat samping |
| Fish Tank | 🐠 | Akuarium bersama — gambar ikanmu, pelihara, beri makan, colek |

---

## Persyaratan

| Kebutuhan | Keterangan |
|-----------|------------|
| **Komputer server** | Satu PC/laptop dengan [Node.js](https://nodejs.org) versi **18 ke atas**, terhubung ke LAN/Wi-Fi kantor |
| **Komputer lain** | Cukup browser modern (Chrome, Edge, Firefox terbaru). Tidak perlu install apa pun |
| **HP / tablet** | Bisa, asalkan satu jaringan Wi-Fi dengan server |
| **Untuk Watch Me** | Browser harus mengizinkan izin screen share; gunakan Chrome/Edge untuk hasil terbaik |

---

## Cara Menjalankan Server

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

- **Di komputer server:** buka `http://localhost:3000`
- **Di komputer lain:** buka alamat **LAN** yang tampil di terminal
  (contoh `http://192.168.1.23:3000`)

> ⚠️ Jika komputer lain tidak bisa connect, hampir pasti **Firewall Windows**
> memblokir port 3000. Solusinya ada di
> [Troubleshooting → Komputer lain tidak bisa connect](troubleshooting.md#komputer-lain-tidak-bisa-connect).

> ℹ️ Server harus terus berjalan selama orang lain memakai aplikasi.
> Menutup terminal = mematikan Rest Area.

---

## Langkah Pertama (Quick Start)

1. Buka alamat server di browser → muncul **boot screen** ala Windows
2. **Check-in:** pilih avatar emoji dan ketik nama panggilan
3. Klik **Masuk ke Rest Area** → desktop virtual terbuka
4. Jendela **Ruang Obrolan** otomatis terbuka di Lobby Utama
5. Klik ikon aplikasi lain di desktop untuk membukanya sebagai jendela baru

Identitas (nama & avatar) bisa diganti kapan saja — klik avatar di pojok kiri
jendela chat.

---

## Desktop Virtual

Halaman utama bergaya desktop Windows 7:

| Komponen | Cara pakai |
|----------|------------|
| **Ikon desktop** | Klik (atau double-click) ikon untuk membuka aplikasi |
| **Taskbar** | Setiap app yang terbuka muncul di taskbar; klik untuk minimize/restore |
| **Start menu** | Klik tombol Start untuk daftar aplikasi |
| **Jam analog** | Di tray kanan bawah, menampilkan waktu real-time |
| **Window manager** | Jendela bisa di-drag (title bar), di-resize (sudut), minimize, maximize, dan ditutup |
| **Wallpaper** | Klik kanan desktop → ganti wallpaper via URL atau upload gambar; tersimpan di browser-mu (localStorage), bisa di-reset ke default |

Di layar kecil (≤768px / HP), aplikasi dibuka fullscreen dengan tombol kembali,
dan player memakai tab navigasi (daftar video / player / chat).

---

## 💬 Ruang Obrolan

Chat real-time dengan dua jenis ruangan:

### Lobby Utama
- Ruang publik — **semua orang otomatis masuk** saat check-in
- History 300 pesan terakhir tersedia

### Ruang Privat
1. Klik tombol **+** di samping daftar "Ruangan"
2. Beri nama room dan **undang minimal 1 orang** dari daftar online
3. Obrolan di dalamnya tidak terlihat oleh pengguna lain
4. Room otomatis hilang saat semua anggota keluar

### Ganti identitas
Klik avatar/namamu di pojok kiri jendela chat → ubah nickname (maks. 24 karakter)
dan avatar emoji. Berlaku langsung di semua ruangan dan semua aplikasi.

### Daftar online
Panel kanan menampilkan siapa saja yang sedang aktif, real-time.

---

## 📺 Nonton Bareng

Watch party sinkron — semua penonton melihat frame yang sama.

### Upload video sendiri
1. Buka ikon **📺 Nonton Bareng** di desktop
2. Klik **Upload** → pilih file video (maks. **2 GB**)
3. Ruanganmu otomatis terbuat; video disimpan di server dan bertahan walau server restart
4. Penonton masuk lewat lobby → klik **Masuk** di ruanganmu

### Nonton YouTube bersama
1. Tempel link YouTube di kolom input (mendukung `/watch`, `/live`, `/shorts`)
2. Klik **▶ Buat Ruangan YT**
3. Catatan: sebagian video berlisensi tidak bisa di-embed — coba video lain

### Kontrol & interaksi
- **Siapa pun** bisa play/pause/seek — semua penonton tersinkron otomatis (koreksi drift tiap 5 detik)
- Player lengkap: progress bar, volume, mute, fullscreen
- Chat live di panel kanan + emoji reactions 👍❤️😂😮😢🔥👏🎉 yang "terbang" di layar
- Badge jumlah penonton tampil live

### Masa berlaku
- Video upload **otomatis dihapus setelah 7 hari**
- Ruangan kosong > 20 menit otomatis dihapus

---

## 🖥️ Watch Me (Bagi Layar)

Screen sharing peer-to-peer (WebRTC) — video mengalir langsung dari layar
broadcaster ke tiap penonton, tidak melewati server, sehingga latensinya rendah.

### Sebagai broadcaster
1. Buka ikon **🖥️ Watch Me** di desktop
2. Klik **Mulai Bagikan Layarku**
3. Pilih seluruh layar / jendela tertentu / tab browser di dialog browser
4. Sesi otomatis muncul di lobby dengan label **LIVE**; indikator LIVE juga tampil di header
5. Klik **⏹ Hentikan** untuk menutup siaran (semua penonton langsung diberitahu)

### Sebagai penonton
1. Di lobby, klik **Tonton** pada sesi yang aktif
2. Kontrol: volume, mute, fullscreen
3. Chat dan emoji reactions 👍❤️😂😮🔥👏🎉😱 tersedia di panel kanan

Sesi berakhir otomatis saat broadcaster menutup halaman atau menghentikan siaran.

> 💡 Screen share membutuhkan izin dari browser. Jika dialog pemilihan layar
> tidak muncul, cek izin situs di setting browser.

---

## 🐠 Fish Tank

Akuarium komunal di desktop:

1. Buka ikon **🐠 Fish Tank**
2. Klik **Gambar Ikan** → lukis ikanmu di canvas (pensil, penghapus, warna, undo hingga 30 langkah)
3. Beri nama dan submit — ikanmu berenang bersama ikan rekan kerja lain
4. **Beri makan:** klik tombol makan, ikan terdekat akan mendekat
5. **Colek:** klik ikan — ia kabur kaget 😄

Aturan main:
- Ikan hidup **7 hari**, lalu memudar dan hilang (silakan gambar lagi!)
- Data ikan tersimpan di server (`data/fishtank.json`) — bertahan lintas restart
- Ukuran gambar dibatasi (~220KB); jika gagal submit, coba gambar lebih sederhana

---

## Privasi & Keamanan

| Aspek | Penjelasan |
|-------|------------|
| **Anonim** | Tidak ada login/akun. Nickname & avatar bebas diganti kapan saja |
| **Pesan chat** | Hanya disimpan di RAM server — hilang total saat restart |
| **Video upload** | Disimpan di disk server, auto-hapus setelah 7 hari |
| **Data ikan** | Disimpan di `data/fishtank.json` di server |
| **Tidak ada internet** | Semua traffic tetap di LAN; hanya STUN Google yang dipakai Watch Me untuk negosiasi WebRTC |
| **Jangkauan** | Hanya bisa diakses dari jaringan LAN/Wi-Fi yang sama dengan server |

---

Selanjutnya: kalau menemukan masalah, buka [Troubleshooting & FAQ](troubleshooting.md).
Kalau ingin ikut mengembangkan, baca [Panduan Developer](developer-guide.md).
