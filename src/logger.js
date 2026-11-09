import fs from 'node:fs/promises';
import { AsyncLocalStorage } from 'node:async_hooks';
import { CONFIG } from './config.js';

// Per-account label so output from parallel runs stays readable.
const labelStore = new AsyncLocalStorage();

/**
 * Run `fn` with every cli.* message prefixed by `[label]`.
 * @template T
 * @param {string} label
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export function withLabel(label, fn) {
  return labelStore.run(label, fn);
}

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  bgGreen: '\x1b[42m\x1b[30m',
  bgYellow: '\x1b[43m\x1b[30m',
  bgRed: '\x1b[41m\x1b[37m'
};

function tag() {
  const label = labelStore.getStore();
  return label ? `${colors.magenta}[${label}]${colors.reset} ` : '';
}

export async function appendLog(status, email, details = '') {
  const timestamp = new Date().toISOString();
  const sanitizedDetails = details ? ` | ${details}` : '';
  const entry = `[${timestamp}] [${status}] ${email}${sanitizedDetails}\n`;

  try {
    await fs.mkdir(CONFIG.paths.outputDir, { recursive: true });
    await fs.appendFile(CONFIG.paths.logFile, entry, 'utf8');
  } catch (err) {
    console.error(`${colors.red}[LOGGER ERROR] Failed to write to log file: ${err.message}${colors.reset}`);
  }
}

/**
 * Save a successfully created account as `email|password|YYYY-MM-DD HH:mm:ss` (local time).
 * @param {string} email
 * @param {string} password
 */
export async function saveAccount(email, password) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const createdAt =
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  await fs.mkdir(CONFIG.paths.outputDir, { recursive: true });
  await fs.appendFile(CONFIG.paths.accountFile, `${email}|${password}|${createdAt}\n`, 'utf8');
}

export const cli = {
  banner() {
    const line = `${colors.green}${colors.bold}====================================================${colors.reset}`;
    console.clear();
    console.log(line);
    console.log(`${colors.green}${colors.bold}   🎵  SPOTIFY SIGNUP AUTOMATION CLI  🎵           ${colors.reset}`);
    console.log(`${colors.cyan}   Node.js + Playwright Automation Flow             ${colors.reset}`);
    console.log(`${colors.dim}   Target  : https://www.spotify.com/id-id/signup    ${colors.reset}`);
    console.log(`${colors.dim}   Browser : Brave / Chrome · Guest Profile (auto-delete)     ${colors.reset}`);
    console.log(`${colors.dim}   Output  : output/akun.txt · output/logs.txt       ${colors.reset}`);
    console.log(`${line}\n`);
  },

  menu(maxPerRun) {
    console.log(`${colors.bold}Pilih mode:${colors.reset}`);
    console.log(`  ${colors.green}${colors.bold}[1]${colors.reset} Single  ${colors.dim}- daftar 1 email${colors.reset}`);
    console.log(
      `  ${colors.cyan}${colors.bold}[2]${colors.reset} Bulk    ${colors.dim}- daftar dari file txt, maks ${maxPerRun} profile sekaligus${colors.reset}`
    );
  },

  info(msg) {
    console.log(`${tag()}${colors.cyan}ℹ ${msg}${colors.reset}`);
  },

  step(stepNumber, title) {
    console.log(`${tag()}${colors.yellow}${colors.bold}[Step ${stepNumber}]${colors.reset} ${title}`);
  },

  success(msg) {
    console.log(`${tag()}${colors.green}✔ ${colors.bold}${msg}${colors.reset}`);
  },

  warning(msg) {
    console.log(`${tag()}${colors.yellow}⚠ ${colors.bold}${msg}${colors.reset}`);
  },

  error(msg) {
    console.log(`${tag()}${colors.red}✖ ${colors.bold}${msg}${colors.reset}`);
  },

  summary({ email, status, message }) {
    console.log(`\n${colors.bold}---------------- EXECUTION SUMMARY ----------------${colors.reset}`);
    console.log(`Email  : ${colors.cyan}${email}${colors.reset}`);
    let badge;
    if (status.includes('COMPLETED')) {
      badge = `${colors.bgGreen} ${status} ${colors.reset}`;
    } else if (status === CONFIG.status.alreadyRegistered || status === CONFIG.status.browserClosed) {
      badge = `${colors.bgYellow} ${status} ${colors.reset}`;
    } else {
      badge = `${colors.bgRed} ${status} ${colors.reset}`;
    }
    console.log(`Status : ${badge}`);
    if (message) {
      console.log(`Detail : ${colors.dim}${message}${colors.reset}`);
    }
    console.log(`Log    : ${colors.dim}${CONFIG.paths.logFile}${colors.reset}`);
    console.log(`${colors.bold}---------------------------------------------------${colors.reset}\n`);
  },

  bulkResult(results) {
    console.log(`\n${colors.bold}================ BULK RESULT ================${colors.reset}`);
    results.forEach(({ email, status }) => console.log(` ${email} -> ${status}`));
    console.log(`${colors.bold}=============================================${colors.reset}\n`);
  }
};
