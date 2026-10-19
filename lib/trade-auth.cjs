const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const COOKIE = 'bape_trade_lab';
const TTL = 60 * 60 * 4;
function config() {
  const hash = process.env.TRADE_LAB_CODE_HASH || '';
  const secret = process.env.TRADE_LAB_SESSION_SECRET || '';
  return /^[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash) && secret.length >= 32 ? { hash, secret } : null;
}
async function verify(code, cfg) {
  if (typeof code !== 'string' || code.length > 256) return false;
  const [salt, expected] = cfg.hash.split(':');
  const actual = await scrypt(code, salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
function signature(payload, cfg) {
  return crypto.createHmac('sha256', cfg.secret + cfg.hash).update(payload).digest('base64url');
}
function issue(cfg, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(now / 1000) + TTL, nonce: crypto.randomBytes(16).toString('hex') })).toString('base64url');
  return payload + '.' + signature(payload, cfg);
}
function authorized(req, cfg, now = Date.now()) {
  if (!cfg) return false;
  const token = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!token || token.length > 512) return false;
  const [payload, sig, extra] = token.split('.');
  if (!payload || !/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]{43}$/.test(sig || '') || extra) return false;
  const expected = signature(payload, cfg);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try { const data = JSON.parse(Buffer.from(payload, 'base64url')); return Number.isInteger(data.exp) && data.exp > now / 1000 && data.exp <= now / 1000 + TTL; } catch { return false; }
}
function cookie(value, clear = false) {
  return `${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/api/trade-lab; Max-Age=${clear ? 0 : TTL}${process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}
module.exports = { config, verify, issue, authorized, cookie };
