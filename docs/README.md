# 📚 Dokumentasi Coworker Rest Area

Selamat datang di pusat dokumentasi **Coworker Rest Area** — ruang istirahat
virtual untuk para pekerja yang berjalan sepenuhnya di jaringan LAN kantor.

Dokumentasi ini dibagi berdasarkan siapa pembacanya dan apa yang ingin
dicapainya. Pilih jalur yang paling sesuai untukmu:

---

## 🗺️ Peta Dokumentasi

| Dokumen | Untuk siapa | Isi |
|---------|-------------|-----|
| [Panduan Pengguna](user-guide.md) | Pengguna akhir (karyawan) | Cara menjalankan server, masuk ke Rest Area, dan memakai setiap aplikasi langkah demi langkah |
| [Arsitektur Sistem](architecture.md) | Developer / arsitek | Gambaran umum sistem, diagram komponen, alur koneksi, dan keputusan desain |
| [API Reference](api-reference.md) | Developer | Daftar lengkap seluruh Socket.IO events dan REST endpoint |
| [Panduan Developer](developer-guide.md) | Kontributor / AI agent | Struktur file, state management, konvensi kode, panduan menambah fitur, known issues, dan roadmap |
| [Troubleshooting & FAQ](troubleshooting.md) | Semua orang | Masalah umum (firewall, screen share gagal, video hilang) dan jawabannya |
| [Change Log](changelog.md) | Developer | Riwayat perubahan besar per versi/langkah pengembangan |

---

## 🚀 Mulai dari sini

### Aku baru, ingin mencoba aplikasinya

1. Baca bagian **Cara Menjalankan** di [Panduan Pengguna](user-guide.md#cara-menjalankan-server)
2. Lanjut ikuti [Langkah Pertama (Quick Start)](user-guide.md#langkah-pertama-quick-start)
3. Kalau ada masalah koneksi, cek [Troubleshooting](troubleshooting.md)

### Aku developer, ingin memahami kodenya

1. Mulai dari [Arsitektur Sistem](architecture.md) — pahami bentuk besar sistem
2. Lihat [API Reference](api-reference.md) saat membaca `server.js`
3. Baca [Panduan Developer](developer-guide.md) sebelum menulis kode baru

### Aku ingin menambahkan fitur baru

Langsung ke
[Panduan Developer → Panduan Menambah Fitur Baru](developer-guide.md#10-panduan-menambah-fitur-baru),
lalu ikuti checklist di bagian akhir dokumen tersebut.

---

## 📁 Struktur folder docs

```
docs/
├── README.md            # File ini — index dokumentasi
├── user-guide.md        # Dokumentasi pengguna
├── architecture.md      # Arsitektur & desain sistem
├── api-reference.md     # Socket.IO events + REST API
├── developer-guide.md   # Dokumentasi developer lengkap
├── troubleshooting.md   # FAQ & penyelesaian masalah
└── changelog.md         # Riwayat perubahan
```

> ℹ️ Dokumentasi ditulis dalam Bahasa Indonesia agar konsisten dengan bahasa
> komentar dan UI aplikasi.
