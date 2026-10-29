import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
let checked = 0;
function scan(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const target = path.join(folder, entry.name);
    if (entry.isDirectory()) scan(target);
    else if (entry.name.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' });
      if (result.status) { console.error(target, result.stderr); process.exitCode = 1; }
      checked++;
    }
  }
}
for (const name of ['src', 'public/js', 'scripts', 'tests']) scan(name);
console.log(`Checked syntax of ${checked} JavaScript files.`);
