import fs from 'node:fs';
import crypto from 'node:crypto';
const path = '.env';
if (fs.existsSync(path)) { console.log('.env already exists; existing secrets left unchanged.'); process.exit(0); }
let content = fs.readFileSync('.env.example', 'utf8');
content = content.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${crypto.randomBytes(48).toString('hex')}`)
  .replace(/^CSRF_SECRET=.*$/m, `CSRF_SECRET=${crypto.randomBytes(48).toString('hex')}`);
fs.writeFileSync(path, content, { mode: 0o600 });
console.log('.env created with secure random secrets. Review CLIENT_ORIGIN and MONGO_URI before running.');
