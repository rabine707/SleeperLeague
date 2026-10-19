// Prints only the salted hash and a fresh signing secret, never the access code.
const { randomBytes, scryptSync } = require('node:crypto');
const readline = require('node:readline');
const input = process.stdin;
if (!input.isTTY) { console.error('Run in an interactive terminal so your code stays hidden.'); process.exit(1); }
console.log('Enter a unique access code (at least 16 characters). Input is hidden:');
readline.emitKeypressEvents(input); input.setRawMode(true); input.resume();
let code = '';
input.on('keypress', (str, key = {}) => {
  if (key.ctrl && key.name === 'c') process.exit(1);
  if (key.name === 'return') {
    input.setRawMode(false); input.pause();
    if (code.length < 16 || code.length > 256) { console.error('Use 16–256 characters.'); process.exitCode = 1; return; }
    const salt = randomBytes(16).toString('hex');
    console.log(`TRADE_LAB_CODE_HASH=${salt}:${scryptSync(code, salt, 64).toString('hex')}`);
    console.log(`TRADE_LAB_SESSION_SECRET=${randomBytes(32).toString('hex')}`);
    code = '';
  } else if (key.name === 'backspace') code = code.slice(0, -1);
  else if (str && !key.ctrl && !key.meta) code += str;
});
