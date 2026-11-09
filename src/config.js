import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/* ============================================================================
 *  ⚙️  PENGATURAN USER
 *  Ubah nilai di bagian ini sesuai kebutuhan. Bagian lain tidak perlu disentuh.
 *  Sebagian nilai bisa juga diatur lewat environment variable (lihat README).
 * ========================================================================== */
const SETTINGS = {
  // Password default untuk akun baru (tidak pernah ditulis ke logs.txt)
  password: 'Spokosong#123',

  // Jumlah maksimal email yang diproses sekaligus di mode bulk   [env: MAX_PER_RUN]
  maxPerRun: Number(process.env.MAX_PER_RUN) || 5,

  // Jalankan browser tanpa jendela (true/false)                  [env: HEADLESS=true]
  headless: process.env.HEADLESS === 'true',

  // Path browser manual. Kosongkan ('') untuk deteksi otomatis   [env: BROWSER_PATH]
  browserPath: process.env.BROWSER_PATH || '',

  // Kecepatan ketik dalam ms per karakter. Naikkan jika input sering terpotong.
  typingSpeed: 15,
  passwordTypingSpeed: 70,

  // Waktu tunggu untuk menyelesaikan captcha manual di browser (menit)
  captchaWaitMinutes: 10,

  // Data tanggal lahir yang diisi di form profil
  birthDate: {
    dayMin: 1, // tanggal diacak antara dayMin..dayMax
    dayMax: 20,
    month: '5', // 1 = Januari ... 12 = Desember
    year: '2000'
  },

  // Ukuran jendela browser (pixel) dan jumlah kolom saat bulk
  window: { width: 620, height: 820, columns: 3 }
};

/* ============================================================================
 *  🔒 INTERNAL — jangan diubah kecuali struktur halaman Spotify berubah
 * ========================================================================== */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');

/** Known install locations per OS, checked in order (Brave first, then Chrome/Chromium). */
function browserPathCandidates() {
  const env = process.env;
  const fromEnv = [SETTINGS.browserPath, env.BRAVE_PATH, env.CHROME_PATH];

  if (process.platform === 'win32') {
    const roots = [env.PROGRAMFILES ?? 'C:\\Program Files', env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)', env.LOCALAPPDATA ?? ''];
    const apps = [
      ['BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'],
      ['Google', 'Chrome', 'Application', 'chrome.exe']
    ];
    return [...fromEnv, ...apps.flatMap((app) => roots.map((root) => path.join(root, ...app)))].filter(Boolean);
  }

  if (process.platform === 'darwin') {
    return [
      ...fromEnv,
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ].filter(Boolean);
  }

  return [
    ...fromEnv,
    '/opt/brave.com/brave/brave-browser',
    '/usr/bin/brave-browser',
    '/usr/bin/brave-browser-stable',
    '/usr/bin/brave',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ].filter(Boolean);
}

function resolveBrowserPath() {
  const candidates = browserPathCandidates();
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0] ?? 'brave';
}

export const CONFIG = {
  credentials: { defaultPassword: SETTINGS.password },
  bulk: { maxPerRun: SETTINGS.maxPerRun },
  typing: { delay: SETTINGS.typingSpeed, passwordDelay: SETTINGS.passwordTypingSpeed },
  timeouts: { captcha: SETTINGS.captchaWaitMinutes * 60 * 1000 },
  profile: {
    dayRange: { min: SETTINGS.birthDate.dayMin, max: SETTINGS.birthDate.dayMax },
    month: SETTINGS.birthDate.month,
    year: SETTINGS.birthDate.year
  },

  browser: {
    executablePath: resolveBrowserPath(),
    headless: SETTINGS.headless,
    slowMo: Number(process.env.SLOW_MO) || 0,
    timeout: 30000,
    // Windows are centered as a group on screen (wraps after `columns` windows)
    window: { ...SETTINGS.window, gap: 8, fallbackScreen: { width: 1920, height: 1080 } },
    // Heavy resources skipped for speed. Hosts below stay untouched so captcha images still load.
    blockedResources: ['image', 'media', 'font'],
    passthroughHosts: ['challenge.spotify.com', 'google.com', 'gstatic.com', 'recaptcha.net']
  },

  urls: {
    signup: 'https://www.spotify.com/id-id/signup',
    step1Hash: '#step=1',
    step2Hash: '#step=2',
    step3Hash: '#step=3',
    challengeHost: 'challenge.spotify.com'
  },

  selectors: {
    emailInput: '#username',
    passwordInput: '#new-password',
    submitButton: '[data-testid="submit"]',
    banner: '[data-encore-id="banner"]',
    displayNameInput: '#displayName',
    dayInput: '#day',
    monthSelect: '#month',
    yearInput: '#year',
    genderWoman: 'label[for="gender_option_female"]',
    marketingLabel: 'label[for="checkbox-marketing"]',
    marketingCheckbox: '#checkbox-marketing'
  },

  messages: {
    alreadyRegisteredError: 'This address is already linked to an existing account.'
  },

  status: {
    completedNoCaptcha: 'SIGNUP COMPLETED (NO CAPTCHA)',
    completedCaptchaSolved: 'SIGNUP COMPLETED (CAPTCHA SOLVED)',
    captchaRequired: 'CAPTCHA REQUIRED',
    alreadyRegistered: 'ALREADY REGISTERED',
    browserClosed: 'BROWSER CLOSED',
    failed: 'FAILED'
  },

  paths: {
    root: ROOT_DIR,
    outputDir: OUTPUT_DIR,
    logFile: path.join(OUTPUT_DIR, 'logs.txt'),
    accountFile: path.join(OUTPUT_DIR, 'akun.txt'),
    dataFile: path.join(__dirname, 'data.json')
  }
};
