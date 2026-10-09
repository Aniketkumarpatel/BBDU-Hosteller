/**
 * Client-side mirror of the backend passwordPolicySchema (DEC-022) so users get
 * instant feedback. The server remains the authority and re-validates everything.
 *
 * @param {string} password
 * @returns {string} First problem found, or an empty string when the password is acceptable
 */
export const getPasswordPolicyError = (password) => {
  if (!password || password.length < 8) return 'Password must be at least 8 characters long';
  if (password.length > 128) return 'Password cannot exceed 128 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return '';
};

export const PASSWORD_POLICY_HINT =
  'At least 8 characters with an uppercase letter, a lowercase letter and a number.';
