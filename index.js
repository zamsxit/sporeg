import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { CONFIG } from './src/config.js';
import { cli, appendLog, withLabel } from './src/logger.js';
import { launchBrowser, closeBrowser } from './src/browser.js';
import { runSignupFlow } from './src/signup.js';
import { parseEmailFile } from './src/emails.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Browser sessions currently open, so Ctrl+C can clean up every guest profile.
const activeSessions = new Set();

async function ask(rl, question, validate, errorMessage) {
  while (true) {
    const answer = (await rl.question(question)).trim();
    if (!validate || validate(answer)) return answer;
    cli.warning(errorMessage);
  }
}

/**
 * Create one account: launch Brave guest profile, run the flow, always clean up.
 * @param {string} email
 * @returns {Promise<{ email: string, status: string, message: string }>}
 */
function createAccount(email, index, total) {
  return withLabel(email, async () => {
    cli.info(`Target Email : ${email}`);
    cli.info('Membuka browser lokal dengan Guest Profile...');

    let status = CONFIG.status.failed;
    let message = '';
    let session = null;
    let isNormalClose = false;
    let userClosed = false;

    try {
      session = await launchBrowser(index, total);
      activeSessions.add(session);

      session.page.on('close', () => {
        if (!isNormalClose) userClosed = true;
      });
      session.context.on('close', () => {
        if (!isNormalClose) userClosed = true;
      });

      const result = await runSignupFlow({ page: session.page, email });
      status = result.status;
      message = result.message || '';
    } catch (error) {
      const isClosed =
        userClosed ||
        /Target page, context or browser has been closed|Browser has been closed|Target closed/i.test(
          error.message
        );

      if (isClosed) {
        status = CONFIG.status.browserClosed;
        message = 'Browser ditutup sebelum proses selesai';
        cli.warning('Browser ditutup oleh user');
      } else {
        message = error.message;
        cli.error(`Terjadi kegagalan: ${error.message}`);
      }
    } finally {
      isNormalClose = true;
      cli.info('Menutup browser dan menghapus temporary guest profile...');
      if (session) {
        await closeBrowser(session.context, session.tempProfileDir);
        activeSessions.delete(session);
      }
      await appendLog(status, email, message);
      cli.summary({ email, status, message });
    }

    return { email, status, message };
  });
}

/**
 * Ask for a file, report duplicates / invalid lines, and apply the per-run limit.
 * @param {readline.Interface} rl
 * @param {string} [initialFile] file name passed via CLI argument (skips the prompt once)
 * @returns {Promise<string[]>} emails to process (empty when cancelled)
 */
async function prepareBulkEmails(rl, initialFile) {
  let parsed;
  let fileName = initialFile;
  while (!parsed) {
    fileName ||= await ask(rl, '\n📄 Nama file txt berisi email: ', (v) => v.length > 0, 'Nama file wajib diisi.');
    try {
      parsed = await parseEmailFile(fileName);
    } catch (error) {
      cli.error(`Gagal membaca file: ${error.message}`);
      fileName = '';
    }
  }

  cli.info(`File          : ${parsed.filePath}`);
  cli.info(`Email unik    : ${parsed.emails.length}`);

  if (parsed.duplicates.length > 0) {
    cli.warning(`Duplikat terdeteksi (${parsed.duplicates.length} email), hanya kemunculan pertama dipakai:`);
    parsed.duplicates.forEach(({ email, lines }) => console.log(`   - ${email} (baris ${lines.join(', ')})`));
  } else {
    cli.success('Tidak ada email duplikat.');
  }

  if (parsed.invalid.length > 0) {
    cli.warning(`Baris dengan format email tidak valid (dilewati):`);
    parsed.invalid.forEach(({ email, line }) => console.log(`   - baris ${line}: ${email}`));
  }

  if (parsed.emails.length === 0) {
    cli.error('Tidak ada email valid untuk diproses.');
    return [];
  }

  const { maxPerRun } = CONFIG.bulk;
  let emails = parsed.emails;
  if (emails.length > maxPerRun) {
    cli.warning(`Maksimal ${maxPerRun} akun per run. ${emails.length - maxPerRun} email sisanya tidak diproses.`);
    emails = emails.slice(0, maxPerRun);
  }

  console.log('\nAkan diproses:');
  emails.forEach((email, i) => console.log(`   ${i + 1}. ${email}`));

  const confirm = await ask(rl, '\nLanjutkan? (y/n): ', (v) => /^[yn]$/i.test(v), 'Jawab y atau n.');
  return confirm.toLowerCase() === 'y' ? emails : [];
}

async function main() {
  cli.banner();

  const cleanExit = async () => {
    await Promise.all(
      [...activeSessions].map((session) => closeBrowser(session.context, session.tempProfileDir))
    );
    process.exit(1);
  };
  process.on('SIGINT', cleanExit);
  process.on('SIGTERM', cleanExit);

  // Accepts either `node index.js user@mail.com` or `node index.js emails.txt`.
  const arg = process.argv[2]?.trim();
  const rl = readline.createInterface({ input, output });
  let emails = [];

  try {
    if (arg && EMAIL_PATTERN.test(arg)) {
      emails = [arg];
    } else if (arg && /\.txt$/i.test(arg)) {
      emails = await prepareBulkEmails(rl, arg);
    } else {
      if (arg) cli.warning(`Argumen "${arg}" bukan email atau file .txt, beralih ke menu.`);
      cli.menu(CONFIG.bulk.maxPerRun);
      const mode = await ask(rl, '\nMode (1/2): ', (v) => v === '1' || v === '2', 'Pilih 1 atau 2.');

      if (mode === '1') {
        const email = await ask(
          rl,
          '\n✉ Masukkan email untuk registrasi: ',
          (v) => EMAIL_PATTERN.test(v),
          'Format email tidak valid (contoh: user@mail.com).'
        );
        emails = [email];
      } else {
        emails = await prepareBulkEmails(rl);
      }
    }
  } finally {
    rl.close();
  }

  if (emails.length === 0) {
    cli.info('Tidak ada yang diproses.');
    return;
  }

  if (emails.length > 1) {
    cli.info(`Membuka ${emails.length} profile sekaligus...`);
  }
  // createAccount never throws (errors are captured per account), so all runs finish independently.
  const results = await Promise.all(emails.map((email, index) => createAccount(email, index, emails.length)));

  if (results.length > 1) {
    cli.bulkResult(results);
  }
}

main().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
