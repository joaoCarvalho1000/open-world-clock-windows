// Regenerates the per-icon table in ICON-SPEC.md from icons.json, so the two cannot drift.
// Run from the repository root: node design/icons/build-table.mjs
// With --check it writes nothing and exits 1 if the table is out of date.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const specPath = path.join(dir, 'ICON-SPEC.md');
const json = JSON.parse(fs.readFileSync(path.join(dir, 'icons.json'), 'utf8'));

const cell = (s) => String(s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
const rows = json.icons.map((i) => {
  const states = Object.entries(i.states || {}).map(([k, v]) => `${k}: ${v}`).join('; ');
  const used = i.usedIn.map((u) => u.replace(/ \(.*$/, '')).join('; ');
  return `| \`${i.id}\` | ${i.priority} | ${i.style} | ${cell(i.meaning)} | ${cell(used)} | ${cell(i.replaces)} | ${cell(i.construction)} | ${cell(states)} |`;
});
const table = [
  '| id | P | style | meaning | used in | replaces | construction (24 grid) | states |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...rows,
].join('\n');

const spec = fs.readFileSync(specPath, 'utf8');
const next = spec.replace(/(<!-- TABLE:BEGIN[^\n]*-->)[\s\S]*?(<!-- TABLE:END -->)/, `$1\n${table}\n$2`);
if (process.argv.includes('--check')) {
  if (next !== spec) { console.error('ICON-SPEC.md table is out of date; run node design/icons/build-table.mjs'); process.exit(1); }
} else if (next !== spec) {
  fs.writeFileSync(specPath, next);
}
const counts = {};
for (const i of json.icons) counts[i.priority] = (counts[i.priority] || 0) + 1;
console.log(`${json.icons.length} icons`, counts);
