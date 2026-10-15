/**
 * Decide whether a browser origin may call the API (CORS).
 *
 * - No Origin header (curl, mobile apps, server to server, test runners): allowed.
 * - An origin listed in CLIENT_URL: allowed.
 * - Outside production only: localhost, 127.0.0.1 and private network addresses
 *   (10.x.x.x, 192.168.x.x, 172.16 to 172.31) so a phone on the same Wi-Fi can open the dev app.
 * - Everything else: refused. The host is parsed, never matched as text, so a name such as
 *   "evil-localhost.com" or "localhost.evil.com" does not count as localhost.
 */
const PRIVATE_IPV4 = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
];

const isDevelopmentHost = (hostname) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || PRIVATE_IPV4.some((re) => re.test(hostname));

export const isOriginAllowed = (origin, { allowedOrigins = [], isProduction = false } = {}) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (isProduction) return false;

  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return isDevelopmentHost(url.hostname);
};
