/**
 * Centralized Email Generator Helper (CommonJS)
 *
 * Base Email: shahnawaz@empirepixel.com
 * Pattern: <username>+<2-character-alphanumeric-string>@<domain>
 * Example: shahnawaz+a7@empirepixel.com, shahnawaz+8k@empirepixel.com
 */
function generateUniqueEmail(baseEmail = 'shahnawaz@empirepixel.com') {
  const [username, domain] = baseEmail.split('@');
  // Exactly 2 random alphanumeric characters (letters & numbers)
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const char1 = chars.charAt(Math.floor(Math.random() * chars.length));
  const char2 = chars.charAt(Math.floor(Math.random() * chars.length));
  const shortSuffix = `${char1}${char2}`;
  return `${username}+${shortSuffix}@${domain || 'empirepixel.com'}`;
}

const generateEmail = generateUniqueEmail;

module.exports = {
  generateUniqueEmail,
  generateEmail,
  default: generateUniqueEmail,
};
