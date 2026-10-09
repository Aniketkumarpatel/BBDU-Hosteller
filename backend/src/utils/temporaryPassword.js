import { randomInt } from 'node:crypto';

// Ambiguous characters (0 O 1 l I) are left out because temporary passwords are
// usually read out or typed from a phone screen by someone else.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const ALL = UPPER + LOWER + DIGITS;

const pick = (set) => set[randomInt(set.length)];

/**
 * Generates a cryptographically random temporary password that always satisfies
 * the password policy (at least one upper, one lower, one digit, 8 to 128 chars).
 * @param {number} [length=12]
 * @returns {string}
 */
export const generateTemporaryPassword = (length = 12) => {
  if (!Number.isInteger(length) || length < 8 || length > 128) {
    throw new RangeError('Temporary password length must be an integer between 8 and 128.');
  }

  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS)];
  while (chars.length < length) chars.push(pick(ALL));

  // Fisher-Yates shuffle so the guaranteed characters are not always first
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};
