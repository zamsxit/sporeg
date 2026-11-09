import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { CONFIG } from './config.js';

const BLOCKED_TYPES = new Set(CONFIG.browser.blockedResources);

function isPassthrough(hostname) {
  return CONFIG.browser.passthroughHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

let cachedScreen = null;

/**
 * Detect the primary screen size, falling back to config.
 * Linux uses xrandr, Windows uses PowerShell, other platforms use the fallback.
 * @returns {{ width: number, height: number }}
 */
function getScreenSize() {
  if (cachedScreen) return cachedScreen;
  try {
    const opts = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 };
    if (process.platform === 'win32') {
      const out = execFileSync(
        'powershell',
        [
          '-NoProfile',
          '-Command',
          'Add-Type -AssemblyName System.Windows.Forms; $b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; "$($b.Width)x$($b.Height)"'
        ],
        opts
      );
      const match = out.match(/(\d+)x(\d+)/);
      if (match) cachedScreen = { width: Number(match[1]), height: Number(match[2]) };
    } else if (process.platform === 'linux') {
      const out = execFileSync('xrandr', ['--current'], opts);
      const match = out.match(/(\d+)x(\d+)\+\d+\+\d+/); // first connected output geometry
      if (match) cachedScreen = { width: Number(match[1]), height: Number(match[2]) };
    }
  } catch {
    // Detection tool unavailable, use fallback
  }
  cachedScreen ??= CONFIG.browser.window.fallbackScreen;
  return cachedScreen;
}

/**
 * Compute the top-left corner for window `index`, centering the whole group on screen.
 * Keeps y >= 40 so the title bar always stays reachable.
 * @param {number} index
 * @param {number} total number of windows opened together
 * @returns {{ x: number, y: number }}
 */
function windowPosition(index, total) {
  const { width, height, columns, gap } = CONFIG.browser.window;
  const screen = getScreenSize();
  const cols = Math.min(total, columns);
  const rows = Math.ceil(total / columns);

  const groupWidth = cols * width + (cols - 1) * gap;
  const groupHeight = rows * height + (rows - 1) * gap;
  const startX = Math.max(0, Math.round((screen.width - groupWidth) / 2));
  const startY = Math.max(40, Math.round((screen.height - groupHeight) / 2));

  const col = index % columns;
  const row = Math.floor(index / columns);
  const stackedY = startY + row * (height + gap);
  const lowestY = Math.max(40, screen.height - height);
  return {
    x: startX + col * (width + gap),
    // Rows that would run off-screen are cascaded instead of stacked
    y: stackedY <= lowestY ? stackedY : lowestY + row * 40
  };
}

/**
 * Launch local Brave browser instance with an isolated guest profile.
 * @param {number} [index] position of this window in the layout
 * @param {number} [total] number of windows opened together
 * @returns {Promise<{ context: import('playwright').BrowserContext, page: import('playwright').Page, tempProfileDir: string }>}
 */
export async function launchBrowser(index = 0, total = 1) {
  const { width, height } = CONFIG.browser.window;
  const { x, y } = windowPosition(index, total);
  const tempProfileDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brave-guest-'));

  const context = await chromium.launchPersistentContext(tempProfileDir, {
    executablePath: CONFIG.browser.executablePath,
    headless: CONFIG.browser.headless,
    slowMo: CONFIG.browser.slowMo,
    viewport: null,
    locale: 'id-ID',
    args: [
      '--guest',
      `--window-size=${width},${height}`,
      `--window-position=${x},${y}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=BraveShields,Translate,MediaRouter',
      // Lighter and faster
      '--disable-extensions',
      '--disable-sync',
      '--disable-default-apps',
      '--disable-component-update',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-dev-shm-usage',
      '--mute-audio'
    ]
  });

  // Skip images, media and fonts (except on captcha hosts) to cut load time and memory.
  await context.route('**/*', (route) => {
    const request = route.request();
    if (BLOCKED_TYPES.has(request.resourceType()) && !isPassthrough(new URL(request.url()).hostname)) {
      return route.abort();
    }
    return route.continue();
  });

  const page = context.pages()[0] ?? (await context.newPage());
  page.setDefaultTimeout(CONFIG.browser.timeout);

  return { context, page, tempProfileDir };
}

/**
 * Close browser context and delete the guest profile directory.
 * @param {import('playwright').BrowserContext|null} context
 * @param {string|null} tempProfileDir
 */
export async function closeBrowser(context, tempProfileDir = null) {
  if (context) {
    try {
      await context.close();
    } catch {
      // Suppress closure errors
    }
  }

  if (tempProfileDir) {
    try {
      await fs.rm(tempProfileDir, { recursive: true, force: true });
    } catch (err) {
      console.error(`[BROWSER] Failed to cleanup guest profile: ${err.message}`);
    }
  }
}
