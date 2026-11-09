<div align="center">

<img src="assets/logo.svg" alt="Spotify Signup Automation" width="640">

<p>
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white" alt="Node.js 18+">
  <img src="https://img.shields.io/badge/Playwright-Chromium-2EAD33?logo=playwright&logoColor=white" alt="Playwright">
  <img src="https://img.shields.io/badge/Browser-Brave%20%7C%20Chrome-FB542B?logo=brave&logoColor=white" alt="Brave | Chrome">
  <img src="https://img.shields.io/badge/OS-Linux%20%7C%20Windows%20%7C%20macOS-1DB954" alt="OS">
  <img src="https://img.shields.io/badge/Module-ESM-F7DF1E?logo=javascript&logoColor=black" alt="ESM">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
</p>

<p>
  <a href="#-fitur">Fitur</a> •
  <a href="#-instalasi">Instalasi</a> •
  <a href="#-cara-menjalankan">Cara Menjalankan</a> •
  <a href="#%EF%B8%8F-konfigurasi">Konfigurasi</a> •
  <a href="#-hasil--log">Hasil &amp; Log</a> •
  <a href="#-troubleshooting">Troubleshooting</a> •
  <a href="#-lisensi">Lisensi</a>
</p>

</div>

---

## ✨ Fitur

- **Single atau bulk.** Daftarkan satu email, atau banyak email sekaligus dari file `.txt`.
- **Pakai browser lokal.** Brave atau Chrome dideteksi otomatis. Tidak perlu `npx playwright install`.
- **Guest profile sementara.** Setiap sesi memakai profil baru yang langsung dihapus setelah selesai.
- **Proses paralel.** Beberapa jendela browser berjalan bersamaan dan tersusun rapi di layar.
- **Deteksi email terdaftar.** Email yang sudah punya akun langsung ditandai `ALREADY REGISTERED`.
- **Captcha manual.** Jika captcha muncul, selesaikan sendiri di browser. Program menunggu lalu lanjut otomatis.
- **Log aman.** Password tidak pernah ditulis ke `logs.txt`.
- **Selalu bersih.** Browser tetap ditutup walau terjadi error atau Anda menekan `Ctrl+C`.

---

## 📦 Kebutuhan

| Komponen | Versi / Keterangan |
|---|---|
| **Node.js** | 18 atau lebih baru. Cek dengan `node -v` |
| **Browser** | Brave **atau** Google Chrome sudah terpasang |
| **Sistem** | Linux, Windows, atau macOS dengan tampilan desktop |

---

## 🚀 Instalasi

<details open>
<summary><b>🐧 Linux (Ubuntu / Debian)</b></summary>

```bash
# 1. Install Node.js 20 (lewati jika sudah ada)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Install salah satu browser
#    Brave : https://brave.com/linux/
#    Chrome: https://www.google.com/chrome/

# 3. Masuk ke folder project lalu install dependencies
cd spotify-automation
npm install
```

</details>

<details open>
<summary><b>🪟 Windows</b></summary>

1. Download dan install **Node.js LTS** dari <https://nodejs.org>. Pastikan opsi **Add to PATH** tercentang.
2. Install **Brave** atau **Google Chrome**.
3. Buka **PowerShell** atau **CMD**, lalu jalankan:

```powershell
cd C:\path\ke\spotify-automation
npm install
```

</details>

---

## ▶️ Cara Menjalankan

Perintahnya sama untuk Linux dan Windows.

| Mode | Perintah | Kegunaan |
|---|---|---|
| Menu interaktif | `node index.js` | Pilih mode lewat menu |
| Single email | `node index.js {email}` | Daftarkan satu email |
| Bulk dari file | `node index.js {namafile.txt}` | Daftarkan banyak email sekaligus |

### 1. Menu interaktif

```bash
node index.js
```

Ketik `1` untuk single email atau `2` untuk bulk dari file.

### 2. Single email

```bash
node index.js user@mail.com
```

### 3. Bulk dari file `.txt`

```bash
node index.js email.txt
```

Isi file: **satu email per baris**.

```text
user1@mail.com
user2@mail.com
user3@mail.com
```

> [!NOTE]
> - Email duplikat dan format tidak valid otomatis dilewati.
> - Secara default maksimal **5 email** diproses per run. Ubah lewat `maxPerRun` atau `MAX_PER_RUN`.
> - Path file dihitung dari folder tempat Anda menjalankan perintah.

> [!TIP]
> Jika captcha muncul, selesaikan di jendela browser yang terbuka. Program menunggu hingga **10 menit**, lalu melanjutkan sendiri.

---

## ⚙️ Konfigurasi

Semua pengaturan ada di bagian paling atas [`src/config.js`](src/config.js), di blok **`SETTINGS`**.

```js
const SETTINGS = {
  password: 'Spokosong#123',   // password default akun baru
  maxPerRun: 5,                // maksimal email per run (bulk)
  headless: false,             // true = browser tanpa jendela
  browserPath: '',             // kosong = deteksi otomatis
  typingSpeed: 15,             // ms per karakter
  passwordTypingSpeed: 70,
  captchaWaitMinutes: 10,      // waktu tunggu captcha manual
  birthDate: { dayMin: 1, dayMax: 20, month: '5', year: '2000' },
  window: { width: 620, height: 820, columns: 3 }
};
```

Bagian di bawah blok `SETTINGS` (URL, selector, status) bersifat internal. Ubah hanya jika tampilan halaman Spotify berubah.

### Environment variable (opsional)

Nilai berikut bisa diatur tanpa mengedit file:

| Variable | Fungsi | Contoh |
|---|---|---|
| `BROWSER_PATH` | Path browser yang dipakai | `/usr/bin/google-chrome` |
| `BRAVE_PATH` / `CHROME_PATH` | Alternatif `BROWSER_PATH` | |
| `MAX_PER_RUN` | Batas email per run | `10` |
| `HEADLESS` | Jalankan tanpa jendela | `true` |

<details>
<summary><b>🐧 Contoh di Linux</b></summary>

```bash
BROWSER_PATH=/usr/bin/google-chrome node index.js email.txt
MAX_PER_RUN=10 node index.js email.txt
```

</details>

<details>
<summary><b>🪟 Contoh di Windows PowerShell</b></summary>

```powershell
$env:BROWSER_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"; node index.js email.txt
$env:MAX_PER_RUN="10"; node index.js email.txt
```

</details>

<details>
<summary><b>🪟 Contoh di Windows CMD</b></summary>

```cmd
set BROWSER_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
node index.js email.txt
```

</details>

**Urutan deteksi browser:** `BROWSER_PATH` → `BRAVE_PATH` → `CHROME_PATH` → Brave → Google Chrome → Chromium.

---

## 📁 Hasil & Log

Semua hasil disimpan di folder `output/`:

| File | Isi |
|---|---|
| `output/akun.txt` | Akun yang berhasil dibuat: `email\|password\|YYYY-MM-DD HH:mm:ss` |
| `output/logs.txt` | Riwayat status setiap email, **tanpa password** |

> [!WARNING]
> `output/akun.txt` berisi password. Jangan bagikan atau commit file ini. Folder `output/` sudah masuk `.gitignore`.

### Arti status

| Status | Arti |
|---|---|
| ✅ `SIGNUP COMPLETED (NO CAPTCHA)` | Berhasil tanpa captcha |
| ✅ `SIGNUP COMPLETED (CAPTCHA SOLVED)` | Berhasil setelah captcha diselesaikan manual |
| 🧩 `CAPTCHA REQUIRED` | Captcha muncul dan belum diselesaikan tepat waktu |
| ⚠️ `ALREADY REGISTERED` | Email sudah punya akun Spotify |
| 🚪 `BROWSER CLOSED` | Jendela browser ditutup sebelum proses selesai |
| ❌ `FAILED` | Gagal karena error validasi atau timeout |

---

## 🗂️ Struktur Project

```text
spotify-automation/
├── assets/
│   └── logo.svg       # logo README
├── src/
│   ├── browser.js     # launch & tutup browser (guest profile)
│   ├── signup.js      # alur registrasi Spotify
│   ├── logger.js      # tampilan CLI & penulisan log
│   ├── emails.js      # baca & validasi file email
│   ├── config.js      # pengaturan (SETTINGS) & selector
│   └── data.json      # data nama untuk form profil
├── output/            # akun.txt & logs.txt (dibuat otomatis)
├── index.js           # entry point CLI
├── LICENSE            # lisensi MIT
└── package.json
```

---

## 🛠️ Troubleshooting

| Masalah | Solusi |
|---|---|
| `Browser tidak ditemukan` / gagal launch | Set `BROWSER_PATH` ke lokasi `brave` atau `chrome` |
| Input email/password terpotong | Naikkan `typingSpeed` / `passwordTypingSpeed` di `config.js` |
| Linux server tanpa GUI | Jalankan dengan `xvfb-run node index.js email.txt` |
| `node` tidak dikenali (Windows) | Install ulang Node.js dan centang **Add to PATH**, lalu buka terminal baru |
| Ingin berhenti di tengah proses | Tekan `Ctrl+C`. Semua browser dan profil sementara dibersihkan |

---

## 📄 Lisensi

Project ini dilisensikan di bawah lisensi [MIT](LICENSE). Bebas dipakai, dimodifikasi, dan didistribusikan, dengan syarat tetap mencantumkan copyright dan teks lisensi asli (credit).

---

<div align="center">
<sub>Dibuat dengan Node.js + Playwright · Gunakan dengan bijak dan patuhi Ketentuan Layanan Spotify.</sub>
</div>
