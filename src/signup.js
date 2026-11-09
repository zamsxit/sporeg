import fs from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { CONFIG } from './config.js';
import { cli, appendLog, saveAccount } from './logger.js';

/**
 * Handle cookie dialog if it pops up.
 * @param {import('playwright').Page} page
 */
async function dismissCookieBanner(page) {
  try {
    const cookieBtn = page.locator('#onetrust-accept-btn-handler, button[data-testid="cookie-banner-accept"]');
    if (await cookieBtn.isVisible({ timeout: 2500 })) {
      await cookieBtn.click();
    }
  } catch {
    // Cookie banner not present, safe to continue
  }
}

/**
 * Type text with real key events so the form framework registers the value,
 * then verify the field holds the full text before returning.
 * Falls back to fill() if keystrokes were dropped (e.g. long emails).
 * @param {import('playwright').Locator} input
 * @param {string} text
 * @param {number} [delay] ms per keystroke
 */
async function typeInto(input, text, delay = CONFIG.typing.delay) {
  await input.click();
  await input.fill('');
  await input.pressSequentially(text, { delay });

  if ((await input.inputValue()) === text) return;

  await input.fill(text);
  if ((await input.inputValue()) !== text) {
    throw new Error('Input value does not match after typing');
  }
}

/**
 * Pick a random display name from data.json.
 * @returns {Promise<string>}
 */
async function pickRandomName() {
  const raw = await fs.readFile(CONFIG.paths.dataFile, 'utf8');
  const { names } = JSON.parse(raw);
  if (!Array.isArray(names) || names.length === 0) {
    throw new Error('data.json has no names');
  }
  return names[Math.floor(Math.random() * names.length)];
}

/**
 * Fill Step 2 (birth date, gender, name) and submit with Enter.
 * The name is filled last so Enter submits while that input is focused.
 * @param {import('playwright').Page} page
 * @returns {Promise<string>} the name used
 */
async function fillProfileStep(page) {
  const { dayRange, month, year } = CONFIG.profile;
  const day = String(dayRange.min + Math.floor(Math.random() * (dayRange.max - dayRange.min + 1)));
  const name = await pickRandomName();

  const dayInput = page.locator(CONFIG.selectors.dayInput);
  await dayInput.waitFor({ state: 'visible', timeout: 15000 });

  cli.step(6, `Filling profile: ${day}/May/${year}, Woman, ${name}`);
  await typeInto(dayInput, day);
  await page.locator(CONFIG.selectors.monthSelect).selectOption(month);
  await typeInto(page.locator(CONFIG.selectors.yearInput), year);
  await page.locator(CONFIG.selectors.genderWoman).click();

  const nameInput = page.locator(CONFIG.selectors.displayNameInput);
  await typeInto(nameInput, name);
  await nameInput.press('Enter');

  await page.waitForURL((url) => url.href.includes(CONFIG.urls.step3Hash), { timeout: 20000 });
  return name;
}

/**
 * Step 3: tick the marketing checkbox and submit with Enter.
 * Then resolve the outcome: captcha challenge (manual) or direct finish.
 * @param {import('playwright').Page} page
 * @param {string} email
 * @returns {Promise<string>} final status
 */
async function finishSignup(page, email) {
  const checkbox = page.locator(CONFIG.selectors.marketingCheckbox);
  await checkbox.waitFor({ state: 'attached', timeout: 15000 });

  cli.step(7, 'Ticking marketing checkbox and submitting');
  // Real input is visually hidden, so click its label then focus the input for Enter.
  await page.locator(CONFIG.selectors.marketingLabel).click();
  await checkbox.focus();

  const isSpotify = (url) => url.hostname.endsWith('spotify.com');
  const leftSignup = (url) =>
    isSpotify(url) &&
    (url.hostname === CONFIG.urls.challengeHost || !url.pathname.includes('/signup'));

  await submitStep(page, checkbox, () => waitForUrl(page, leftSignup, 3000));
  const nextUrl = await waitForUrl(page, leftSignup, 30000);
  cli.info(`Next page detected: ${nextUrl.href}`);

  if (nextUrl.hostname !== CONFIG.urls.challengeHost) {
    cli.success(`Redirected without captcha: ${nextUrl.href}`);
    return CONFIG.status.completedNoCaptcha;
  }

  cli.warning('Selesaikan captcha manual lalu klik Continue di browser.');
  await appendLog(CONFIG.status.captchaRequired, email, 'Selesaikan captcha manual di browser');
  if (CONFIG.browser.headless) {
    cli.warning('HEADLESS=true: you cannot see the browser. Run without HEADLESS to solve it.');
  }
  const doneUrl = await waitForUrl(
    page,
    (url) => isSpotify(url) && url.hostname !== CONFIG.urls.challengeHost,
    CONFIG.timeouts.captcha
  );

  cli.success(`Captcha solved, signup finished: ${doneUrl.href}`);
  return CONFIG.status.completedCaptchaSolved;
}

/**
 * Poll every open tab until one matches the URL predicate.
 * Playwright's own URL waits depend on page load events, which can hang on
 * pages that never finish loading, so we read the URLs directly.
 * @param {import('playwright').Page} page
 * @param {(url: URL) => boolean} predicate
 * @param {number} timeout ms
 * @returns {Promise<URL>} the matching URL
 */
async function waitForUrl(page, predicate, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const tab of page.context().pages()) {
      let url;
      try {
        url = new URL(tab.url());
      } catch {
        continue;
      }
      if (predicate(url)) return url;
    }
    await sleep(100);
  }
  throw new Error(`Timed out after ${timeout}ms waiting for URL change (last: ${page.url()})`);
}

/**
 * Submit the current step and make sure the NEXT action really happens.
 * Attempts, in order, until the page reacts:
 *   1. Enter while the input is focused
 *   2. Scroll NEXT into view (covers small windows) and click its label
 *   3. Click the button element directly via the DOM
 * A cookie banner that may cover the button is dismissed before each attempt.
 * @param {import('playwright').Page} page
 * @param {import('playwright').Locator} inputField
 * @param {() => Promise<unknown>} waitForProgress resolves once the page reacted
 */
async function submitStep(page, inputField, waitForProgress) {
  const nextButton = page.locator(CONFIG.selectors.submitButton).first();

  const attempts = [
    () => inputField.press('Enter', { noWaitAfter: true }),
    async () => {
      await nextButton.scrollIntoViewIfNeeded({ timeout: 2000 });
      await nextButton.locator('span').first().click({ noWaitAfter: true, timeout: 3000 });
    },
    () => nextButton.evaluate((el) => el.click())
  ];

  for (const attempt of attempts) {
    await dismissCookieBanner(page);

    // Let the form finish validating: submit only once the NEXT button is enabled.
    await page
      .waitForFunction(
        (selector) => {
          const button = document.querySelector(selector);
          return button && !button.disabled && button.getAttribute('aria-disabled') !== 'true';
        },
        CONFIG.selectors.submitButton,
        { timeout: 5000 }
      )
      .catch(() => {});

    await attempt().catch(() => {});

    try {
      await waitForProgress();
      return;
    } catch {
      // No reaction yet. A disabled button means the form is submitting, so stop clicking.
      const stillClickable = await nextButton.isEnabled({ timeout: 1000 }).catch(() => false);
      if (!stillClickable) return;
    }
  }
}

/**
 * Executes the Spotify signup automation flow up to Step 2.
 * @param {object} params
 * @param {import('playwright').Page} params.page
 * @param {string} params.email
 * @returns {Promise<{ status: string, message?: string }>}
 */
export async function runSignupFlow({ page, email }) {
  cli.step(1, `Navigating to ${CONFIG.urls.signup}`);
  await page.goto(CONFIG.urls.signup, { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);

  cli.step(2, `Entering email: ${email}`);
  const emailInput = page.locator(CONFIG.selectors.emailInput);
  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await typeInto(emailInput, email);

  const bannerLocator = page.locator(CONFIG.selectors.banner).first();
  const passwordLocator = page.locator(CONFIG.selectors.passwordInput);
  const inlineErrorLocator = page.locator('[data-encore-id="formHelpText"], [aria-invalid="true"]').first();

  cli.step(3, 'Submitting email for validation');
  await submitStep(page, emailInput, () =>
    page
      .locator(`${CONFIG.selectors.passwordInput}, ${CONFIG.selectors.banner}, [data-encore-id="formHelpText"]`)
      .first()
      .waitFor({ state: 'visible', timeout: 3000 })
  );

  // Wait for: password field visible, step 1 URL, banner error, or inline error
  const condition = await Promise.race([
    passwordLocator.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'password_visible'),
    page.waitForURL((url) => url.href.includes(CONFIG.urls.step1Hash), { timeout: 20000 }).then(() => 'step1_url'),
    bannerLocator.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'banner_visible'),
    inlineErrorLocator.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'inline_error')
  ]).catch(() => 'timeout');

  // Check for error banner or existing account
  if (condition === 'banner_visible' || (await bannerLocator.isVisible().catch(() => false))) {
    const text = (await bannerLocator.innerText().catch(() => '')).trim();
    const isAlreadyRegistered =
      text.includes(CONFIG.messages.alreadyRegisteredError) ||
      text.toLowerCase().includes('already linked') ||
      text.toLowerCase().includes('sudah ada');

    if (isAlreadyRegistered) {
      cli.warning(`Account detected: ${text}`);
      return {
        status: CONFIG.status.alreadyRegistered,
        message: text || CONFIG.messages.alreadyRegisteredError
      };
    }

    cli.error(`Validation banner: ${text}`);
    return {
      status: CONFIG.status.failed,
      message: text
    };
  }

  // Check for inline error message
  if (condition === 'inline_error' || (await inlineErrorLocator.isVisible().catch(() => false))) {
    const text = (await inlineErrorLocator.innerText().catch(() => '')).trim();
    cli.error(`Inline error: ${text}`);
    return {
      status: CONFIG.status.failed,
      message: text
    };
  }

  // Step 1: Input password and click NEXT
  const isStep1 =
    condition === 'password_visible' ||
    condition === 'step1_url' ||
    (await passwordLocator.isVisible().catch(() => false)) ||
    page.url().includes(CONFIG.urls.step1Hash);

  if (isStep1) {
    cli.step(4, 'Email accepted. Entering default password');
    await passwordLocator.waitFor({ state: 'visible', timeout: 10000 });
    await typeInto(passwordLocator, CONFIG.credentials.defaultPassword, CONFIG.typing.passwordDelay);

    cli.step(5, 'Submitting password and awaiting Step 2');
    await submitStep(page, passwordLocator, () =>
      page.waitForURL((url) => url.href.includes(CONFIG.urls.step2Hash), { timeout: 3000 })
    );

    // Wait for URL step=2 or next step form container
    await Promise.race([
      page.waitForURL((url) => url.href.includes(CONFIG.urls.step2Hash), { timeout: 20000 }),
      page
        .locator('#display-name, #year, #month, #day, [name="displayName"]')
        .first()
        .waitFor({ state: 'visible', timeout: 20000 })
    ]);

    cli.success('Reached Step 2');
    const name = await fillProfileStep(page);

    cli.success('Profile submitted, reached Step 3');
    const status = await finishSignup(page, email);
    await saveAccount(email, CONFIG.credentials.defaultPassword);
    cli.success(`Akun disimpan ke ${CONFIG.paths.accountFile}`);
    return {
      status,
      message: `Profile submitted (name: ${name})`
    };
  }

  throw new Error(`Timeout or unexpected navigation state: ${page.url()}`);
}
