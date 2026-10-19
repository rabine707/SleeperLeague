const auth = require('../lib/trade-auth.cjs');
const { load } = require('../lib/trade-data.cjs');
const attempts = new Map(); // Per-instance defense; high-entropy code remains required.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const send = (status, body) => res.status(status).json(body);
  const action = req.query?.action || new URL(req.url, 'http://localhost').searchParams.get('action') || 'session';
  const cfg = auth.config();
  if (!['GET','POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return send(405, { error: 'Method not allowed' }); }
  if (req.method === 'POST') {
    const origin = req.headers.origin;
    const host = req.headers.host;
    try { if (!origin || new URL(origin).host !== host) return send(403, { error: 'Invalid request origin' }); } catch { return send(403, { error: 'Invalid request origin' }); }
  }
  if (!cfg) return send(503, { error: 'Trade Lab is locked until the owner configures access.' });
  if (action === 'login' && req.method === 'POST') {
    const ip = req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    for (const [key, item] of attempts) if (item.until < now) attempts.delete(key);
    const item = attempts.get(ip) || { count: 0, until: now + 900000 };
    if (item.count >= 5 || attempts.size >= 10000) { res.setHeader('Retry-After', '900'); return send(429, { error: 'Too many attempts. Try again in 15 minutes.' }); }
    item.count++; attempts.set(ip, item);
    let body = req.body;
    try { if (typeof body === 'string' && body.length <= 1024) body = JSON.parse(body); } catch { body = null; }
    if (!await auth.verify(body?.code, cfg)) return send(401, { error: 'Access code not recognized.' });
    attempts.delete(ip);
    res.setHeader('Set-Cookie', auth.cookie(auth.issue(cfg)));
    return send(200, { ok: true });
  }
  if (!auth.authorized(req, cfg)) return send(401, { error: 'Unlock the Trade Lab to continue.' });
  if (action === 'logout' && req.method === 'POST') {
    res.setHeader('Set-Cookie', auth.cookie('', true)); return send(200, { ok: true });
  }
  if (req.method !== 'GET') return send(405, { error: 'Method not allowed' });
  if (action === 'session') return send(200, { ok: true });
  if (action !== 'data') return send(404, { error: 'Unknown action' });
  try { return send(200, await load()); } catch { return send(502, { error: 'Sleeper could not be reached. Retry shortly; no sample rosters have been substituted.' }); }
};
