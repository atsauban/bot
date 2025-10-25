# Bot WhatsApp (Baileys)

Bot WhatsApp berbasis `@whiskeysockets/baileys` dengan konsep silent: hanya merespons perintah, tanpa balasan default/error ke user. Mendukung login via QR atau Kode Pairing, modular features, fitur grup & game, utilitas server, AI (Groq), hingga Akinator.

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

Perintah yang tersedia saat ini (ringkas):

- `!ping` → uji nyala + latency.
- `!status` → info server (CPU, RAM, Disk, uptime, load).
- `!stiker` → ubah gambar/video (≤12s) menjadi stiker.
- `!img` → ubah stiker menjadi gambar PNG.
- `!weather <lokasi>` → cuaca saat ini (WeatherAPI).
- `!forecast <lokasi> [hari]` → prakiraan 1–3 hari.
- `!ascii <font> <teks>` → teks → ASCII figlet; `!ascii-list [filter]` untuk daftar font.
- `!ascii` saat reply/kirim gambar → konversi gambar → ASCII (WhatsApp‑friendly, auto chunk).
- Game: `!tebak` (tebak angka 1–10; tebak via `!1.. !10`).
- Game: `!ttt` (Tic‑Tac‑Toe) — DM vs bot atau grup vs mention; langkah via `!1.. !9`.
- Game: `!akinator [region]` — main Akinator; jawab via `!1.. !5`; `!akinator back|stop` untuk kontrol.
- Reminder: `!reminder <pesan> <HH:MM>`, `!reminder-list`, `!reminder-cancel <id|index>` (bot‑only).
- `!spam <jumlah> <pesan>` (bot‑only).
- `!ai <prompt>` (Groq; bot‑only; set `GROQ_API_KEY`).

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
  - `AKI_DEFAULT_REGION` (default `en`) — region awal Akinator. Pilihan: `en, ar, cn, de, es, fr, il, it, jp, kr, nl, pl, pt, ru, tr, id`.
  - `AKI_PROXY` (opsional) — HTTP/HTTPS proxy untuk menghindari blokir (403) dari Akinator, contoh: `http://user:pass@host:port`.

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
  - `aki-api` — Akinator API (membutuhkan internet; beberapa region dapat memblokir IP VPS)

- Penyimpanan lokal
  - `nedb-promises` — database file untuk `!reminder`

- AI (opsional)
  - (Tidak perlu paket tambahan) — `fetch` bawaan Node 18+ ke endpoint Groq (OpenAI-compatible). Set `GROQ_API_KEY`.

- Opsional (disarankan)
  - `link-preview-js` — menghilangkan warning “url generation failed” dari Baileys saat preview tautan
  - Salah satu dari: `sharp` atau `jimp` — untuk konversi gambar di beberapa fitur (mis. `!img`, gambar → ASCII, dan `!setpic` di lingkungan tertentu)
  - `pm2` (global) — menjalankan bot sebagai service: `npm i -g pm2`
  - Git LFS (untuk repo besar) — jika Anda ingin melacak aset binary besar di Git

Catatan:

- Node.js 18+ direkomendasikan (agar `fetch` global tersedia dan kompatibilitas ESM lebih baik).
- `ffmpeg-static` sudah menyertakan binary ffmpeg; tidak perlu install ffmpeg sistem terpisah.

## Struktur Proyek

```
src/
  core/                 # inti aplikasi
    config.js           # muatan .env, path auth, opsi pairing, dsb.
    logger.js           # logger (pino) dengan pretty-print saat TTY
    commands.js         # registry perintah (register/find)
    guards.js           # botOnly, admin checks, normalisasi nomor, dsb.
  platform/
    wa/
      extract.js        # helper ekstraksi teks dari berbagai tipe pesan Baileys
      client.js         # bootstrap koneksi Baileys (QR/pairing, reconnect, router pesan)
  features/             # fitur perintah (modular, silent default)
    index.js            # registrasi fitur via side-effect
    ai/*.js, ascii/*.js, game/*.js, group/*.js, misc/*.js, reminder/*.js, sticker/*.js, system/*.js, weather/*.js
  db/
    reminders.js        # penyimpanan NeDB untuk fitur reminder
storage/
  auth/                 # kredensial login WhatsApp (di-ignore Git)
  data/reminders.db     # database lokal untuk reminder
```

## Tooling & Quality

- ESLint (flat config) + Prettier + Husky:
  - Lint: `npm run lint`
  - Format: `npm run format`
  - Cek format: `npm run format:check`
  - Husky pre-commit menjalankan lint dan cek format (aktif setelah `npm install`).
- Unit test (Node.js test runner): `npm test` — mencakup extractText, router numeric, logika TTT, util status, util reminder, normalisasi nomor.
- EditorConfig tersedia untuk menyamakan style di editor.

## Menjalankan dengan PM2 (opsional)

```bash
npm run pm2:start   # start sebagai service
npm run pm2:logs    # lihat log
npm run pm2:stop    # hentikan service
```

## Akinator

- Mulai permainan: `!akinator` atau `!akinator id` (region opsional).
- Jawaban:
  - `!1` = Ya, `!2` = Tidak, `!3` = Tidak tahu, `!4` = Mungkin, `!5` = Mungkin tidak
- Kontrol: `!akinator back` (mundur 1 langkah), `!akinator stop` (akhiri sesi).
- Catatan blokir (403): beberapa region/IP VPS diblokir oleh Akinator. Bot akan mencoba fallback region otomatis. Jika tetap 403, set env `AKI_PROXY` ke proxy yang valid.

## Catatan Repository

- Folder `storage/auth` dan file `.env` di-ignore agar kredensial/rahasia tidak ter‑commit.
- Atas permintaan, `node_modules` disertakan dalam repository. Jika ingin kembali ke pola umum (tanpa commit `node_modules`), hapus dari Git dan andalkan `npm ci`/`npm install` saat deploy.
