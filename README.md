# Bot WhatsApp (Baileys)

Bot WhatsApp berbasis `@whiskeysockets/baileys` dengan konsep silent: hanya merespons perintah, tanpa balasan default/error ke user. Mendukung login via QR atau Kode Pairing, modular commands, fitur grup, game sederhana, dan utilitas.

## Instalasi
```bash
cd /root/bot
npm install
cp .env.example .env
```

## Menjalankan
```bash
npm start
```
Scan QR yang muncul di terminal (WhatsApp > Perangkat tertaut). Lalu kirim `!ping` ke bot (termasuk dari nomor bot sendiri).

Perintah yang tersedia saat ini:
- `!ping` → uji nyala + tampilkan latency.
- `!status` → info server (CPU, RAM, disk, uptime, load average).
- `!stiker` → balas gambar/video (≤12s) atau kirim media ber-caption `!stiker` untuk ubah jadi stiker.
- `!weather <lokasi>` → cuaca saat ini (butuh `WEATHER_API_KEY`).
- `!forecast <lokasi> [hari]` → prakiraan 1–3 hari.
- `!ascii-list [filter]` → daftar semua font figlet (bisa difilter).
- `!ascii <font> <teks>` → render teks jadi ASCII art (dibungkus monospaced).
- Game `!tebak` → mulai sesi tebak angka 1–10 per chat; tebak pakai `!1`..`!10`; diberi klu; bot umumkan saat benar.
- `!reminder <pesan> <HH:MM>` → set reminder per chat (persisten di DB; zona waktu server; bot-only).
- `!reminder-list` → lihat daftar reminder pending di chat ini (bot-only).
- `!reminder-cancel <id|index>` → batalkan reminder pending (bot-only).
- `!spam <jumlah> <pesan>` → kirim pesan berulang di chat (maks 100, jeda ~150ms; bot-only).
 - `!ai <prompt>` → jawaban AI menggunakan Groq (bot-only). Set `GROQ_API_KEY` dan `AI_MODEL`.

Fitur grup:
- Akses dasar (boleh oleh pengirim admin atau pesan dari akun bot sendiri):
  - `!groupinfo` → info grup (owner ditampilkan sebagai mention), jumlah anggota, deskripsi, waktu dibuat.
  - `!list` → daftar anggota dalam bentuk mention; dipecah jika terlalu panjang.
  - `!tagall` → tag semua anggota.
  - `!setname <nama>` → ganti nama grup.
  - `!setdesc <deskripsi>` → ganti deskripsi grup.
  - `!setpic` → ganti foto grup dari gambar pesan/reply.
- Admin-only (pengirim harus admin, dan bot perlu admin agar berhasil di server):
  - `!add <nomor...>` → tambah anggota (nomor lokal dinormalkan, default kode negara 62). Setelah berhasil: kirim “Selamat datang ...”.
  - `!kick [mention/reply/nomor...]` → ucapkan perpisahan lalu keluarkan anggota.
  - `!promote [mention/reply/nomor...]` → naikkan jadi admin; feedback “(tag) admin sekarang”.
  - `!demote [mention/reply/nomor...]` → turunkan admin; feedback “(tag) dikick dari atmin”.

Catatan kebijakan grup:
- Jika setelan grup “hanya admin yang boleh ubah info” dan bot bukan admin, perintah `!setname/!setdesc/!setpic` akan diabaikan (tanpa balasan).
- Aksi partisipan (add/kick/promote/demote) tetap silent bila tidak memenuhi syarat (bot bukan admin, target tidak valid, dsb.).

### Pilih Metode: QR atau Kode Pairing
Setel di `.env`:
```
# QR saja
AUTH_METHOD=qr

# Kode Pairing (Link with phone number)
AUTH_METHOD=pairing
PAIR_PHONE_NUMBER=62xxxxxxxxxxx

# Otomatis: pairing jika nomor terisi; selain itu QR
AUTH_METHOD=auto
PAIR_PHONE_NUMBER=62xxxxxxxxxxx  # opsional
```

#### Pairing dengan Nomor (tanpa QR)
1. Edit `.env` dan isi:
   - `AUTH_METHOD=pairing`
   - `PAIR_PHONE_NUMBER=62xxxxxxxxxxx`
2. Jalankan `npm start`.
3. Terminal akan menampilkan "Kode pairing" (8 digit). Pada ponsel utama buka WhatsApp → Perangkat tertaut → Tautkan dengan nomor telepon, lalu masukkan kode tersebut.
4. Setelah tersambung, kode tidak diperlukan lagi karena kredensial tersimpan di `storage/auth`.

## Reset Login
Hapus kredensial lalu start lagi untuk QR baru:
```bash
rm -rf storage/auth/*
npm start
```

## Catatan
- Variabel `.env`:
  - `AUTH_FOLDER` (default `./storage/auth`)
  - `LOG_LEVEL` (default `info`)
  - `WEATHER_API_KEY` (API key dari weatherapi.com)
  - `AUTH_METHOD` (`qr` | `pairing` | `auto`), `PAIR_PHONE_NUMBER` untuk pairing via nomor
  - `DEFAULT_COUNTRY_CODE` (default `62`) untuk normalisasi nomor lokal pada fitur grup
  - `PN_MAP` (opsional) peta LID→PN untuk tampilan nomor jika perlu
  - `GROQ_API_KEY` (wajib untuk `!ai`), `AI_MODEL` (default `llama-3.1-8b-instant`)

### Penyimpanan & Scheduler
- Reminder disimpan di file database: `storage/data/reminders.db` (NeDB, tanpa server terpisah).
- Saat bot tersambung, scheduler memuat reminder pending dan menjadwalkannya kembali otomatis.
- Reminder menggunakan zona waktu server. Jika jam sudah lewat, reminder dijadwalkan untuk hari berikutnya.

## Dependensi (kalau `node_modules` tidak tersedia)

Jalankan `npm install` di direktori project untuk memasang semua paket pada `package.json`. Paket utama yang dipakai:

- Runtime & inti
  - `@whiskeysockets/baileys` — koneksi WhatsApp MD
  - `dotenv` — muat variabel `.env`
  - `pino`, `pino-pretty` — logging
  - `qrcode-terminal` — cetak QR code di terminal

- Media & utilitas
  - `wa-sticker-formatter` — buat stiker (webp) dari gambar/video
  - `ffmpeg-static`, `fluent-ffmpeg` — konversi media untuk stiker video (≤12s)
  - `figlet` — render ASCII art untuk `!ascii`

- Penyimpanan lokal
  - `nedb-promises` — database file untuk `!reminder`

- AI (opsional)
  - (Tidak perlu paket tambahan) — `fetch` bawaan Node 18+ ke endpoint Groq (OpenAI-compatible). Set `GROQ_API_KEY`.

- Opsional (disarankan)
  - `link-preview-js` — menghilangkan warning “url generation failed” dari Baileys saat preview tautan
  - Salah satu dari: `sharp` atau `jimp` — diperlukan agar `!setpic` (ganti foto grup) bekerja di semua lingkungan
  - `pm2` (global) — menjalankan bot sebagai service: `npm i -g pm2`
  - Git LFS (untuk repo besar) — jika Anda ingin melacak aset binary besar di Git

Catatan:
- Node.js 18+ direkomendasikan (agar `fetch` global tersedia dan kompatibilitas ESM lebih baik).
- `ffmpeg-static` sudah menyertakan binary ffmpeg; tidak perlu install ffmpeg sistem terpisah.

## Menjalankan dengan PM2 (opsional)
```bash
npm run pm2:start   # start sebagai service
npm run pm2:logs    # lihat log
npm run pm2:stop    # hentikan service
```
