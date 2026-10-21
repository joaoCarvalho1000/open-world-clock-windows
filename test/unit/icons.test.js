// Keep generated icons in sync on the same CI path as the rest of the renderer.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Playful renderer outputs, inventory table and SVG construction remain in sync', () => {
  for (const [script, ...args] of [
    ['design/icons/build-web.mjs', '--check'],
    ['design/icons/build-table.mjs', '--check'],
    ['design/icons/validate.mjs', '--svg-only'],
  ]) execFileSync(process.execPath, [script, ...args], { cwd: root, timeout: 30000 });
});

test('every static and dynamic renderer icon resolves to a shared symbol', () => {
  const html = read('src/renderer/index.html');
  const symbols = new Set([...html.matchAll(/<symbol id="(owc-[a-z-]+)"/g)].map(m => m[1]));
  const sources = html + read('src/renderer/app.js') + read('src/renderer/motion/topbar.js');
  const references = [...sources.matchAll(/#(owc-[a-z-]+)/g)].map(m => m[1]);
  assert.ok(references.length >= 30, 'static controls, selected states and dynamic feedback');
  for (const id of references) assert.ok(symbols.has(id), 'missing ' + id);
  const withoutSprite = html.replace(/<!-- Playful icons:[\s\S]*?<!-- End Playful icons -->/, '');
  assert.doesNotMatch(withoutSprite, /<(?:path|circle|rect|g)\b/, 'controls must not carry a second hand-maintained icon set');
  assert.doesNotMatch(sources, /viewBox="0 0 (?:16|10) (?:16|10)"/, 'all UI icons use the 24 grid');
});

test('website aliases resolve to masters and isolate filled paths from inherited stroke', async () => {
  const { siteIcons, siteSymbols } = await import('../../design/icons/web-symbols.mjs');
  assert.equal(Object.keys(siteIcons).length, 22);
  for (const [name, id] of Object.entries(siteIcons)) {
    assert.ok(fs.existsSync(path.join(root, 'design/icons/svg', id + '.svg')));
    assert.match(siteSymbols['i-' + name], /viewBox="0 0 24 24" stroke="none"/);
  }
  assert.equal(siteIcons.system, 'theme-auto');
  assert.equal(siteIcons.back, 'now');
});
