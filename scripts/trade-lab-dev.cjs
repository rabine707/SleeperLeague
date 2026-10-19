// Local-only adapter for the same Vercel handler. No dependencies required.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const handler = require('../api/trade-lab.js');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.mp3':'audio/mpeg' };
http.createServer(async (req,res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/trade-lab') {
    req.query = Object.fromEntries(url.searchParams); let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 1024) { res.writeHead(413).end(); return; } }
    req.body = body; res.status = code => { res.statusCode = code; return res; };
    res.json = value => { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(value)); };
    try { await handler(req,res); } catch { res.writeHead(500).end('Server error'); }
    return;
  }
  let name;
  try { name = decodeURIComponent(url.pathname); } catch { res.writeHead(400).end(); return; }
  if (name === '/') name = '/index.html';
  if (name === '/trade-lab') name = '/trade-lab.html';
  const file = path.resolve(root, '.' + name);
  // Mirror the public surface only; never expose server sources or local secrets.
  if (path.dirname(file) !== root || !types[path.extname(file)]) { res.writeHead(404).end(); return; }
  try { const content = fs.readFileSync(file); res.writeHead(200, {'Content-Type':types[path.extname(file)]}); res.end(content); }
  catch { res.writeHead(404).end(); }
}).listen(5173,'127.0.0.1',() => console.log('Trade Lab preview: http://127.0.0.1:5173/trade-lab'));
