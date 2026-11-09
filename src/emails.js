import fs from 'node:fs/promises';
import path from 'node:path';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Read an email list file (one email per line) and analyse it.
 * Duplicates are detected case-insensitively; only the first occurrence is kept.
 * @param {string} filePath
 * @returns {Promise<{
 *   filePath: string,
 *   emails: string[],
 *   duplicates: { email: string, lines: number[] }[],
 *   invalid: { email: string, line: number }[]
 * }>}
 */
export async function parseEmailFile(filePath) {
  const resolved = path.resolve(filePath);
  const content = await fs.readFile(resolved, 'utf8');

  const seen = new Map(); // lowercased email -> { email, lines }
  const invalid = [];

  content.split(/\r?\n/).forEach((raw, index) => {
    const email = raw.trim();
    if (!email) return;

    const line = index + 1;
    if (!EMAIL_PATTERN.test(email)) {
      invalid.push({ email, line });
      return;
    }

    const key = email.toLowerCase();
    if (seen.has(key)) {
      seen.get(key).lines.push(line);
    } else {
      seen.set(key, { email, lines: [line] });
    }
  });

  const entries = [...seen.values()];
  return {
    filePath: resolved,
    emails: entries.map((entry) => entry.email),
    duplicates: entries.filter((entry) => entry.lines.length > 1),
    invalid
  };
}
