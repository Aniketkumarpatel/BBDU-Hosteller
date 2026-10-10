/**
 * Client-side mirror of the backend passwordPolicySchema (DEC-022) so users get
 * instant feedback. The server remains the authority and re-validates everything.
 *
 * @param {string} password
 * @returns {string} First problem found, or an empty string when the password is acceptable
 */
export const getPasswordPolicyIssue = (password) => {
  if (!password || password.length < 8) return 'length';
  if (password.length > 128) return 'max';
  if (!/[A-Z]/.test(password)) return 'upper';
  if (!/[a-z]/.test(password)) return 'lower';
  if (!/[0-9]/.test(password)) return 'digit';
  return '';
};

const ENGLISH_MESSAGES = {
  length: 'Password must be at least 8 characters long',
  max: 'Password cannot exceed 128 characters',
  upper: 'Password must contain at least one uppercase letter',
  lower: 'Password must contain at least one lowercase letter',
  digit: 'Password must contain at least one number',
};

export const getPasswordPolicyError = (password) => ENGLISH_MESSAGES[getPasswordPolicyIssue(password)] || '';

export const PASSWORD_POLICY_HINT =
  'At least 8 characters with an uppercase letter, a lowercase letter and a number.';
