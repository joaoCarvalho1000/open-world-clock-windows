const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('icon table generation and check work from paths with spaces, Unicode, # and %', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'owc icon-table-'));
  // The fixture copies the real script and real data, not a reimplementation of path handling.
  const directory = path.join(temporary, 'clock espa\u00e7o # 100%');
  fs.mkdirSync(directory);
  const source = path.join(__dirname, '../../design/icons');
  for (const name of ['build-table.mjs', 'icons.json', 'ICON-SPEC.md']) {
    fs.copyFileSync(path.join(source, name), path.join(directory, name));
  }
  const spec = path.join(directory, 'ICON-SPEC.md');
  const original = fs.readFileSync(spec, 'utf8');
  const run = (...args) => spawnSync(process.execPath, [path.join(directory, 'build-table.mjs'), ...args], {
    cwd: temporary, encoding: 'utf8', timeout: 10000,
  });
  try {
    const first = run('--check');
    assert.equal(first.status, 0, first.stderr);
    assert.equal(fs.readFileSync(spec, 'utf8'), original);
    const stale = original.replace(/(<!-- TABLE:BEGIN[^\n]*-->)[\s\S]*?(<!-- TABLE:END -->)/, '$1\nstale table\n$2');
    assert.notEqual(stale, original);
    fs.writeFileSync(spec, stale);
    const check = run('--check');
    assert.equal(check.status, 1, check.stderr);
    assert.match(check.stderr, /table is out of date/);
    assert.equal(fs.readFileSync(spec, 'utf8'), stale, '--check must not write');
    const generate = run();
    assert.equal(generate.status, 0, generate.stderr);
    assert.equal(fs.readFileSync(spec, 'utf8'), original);
    assert.equal(run('--check').status, 0);
  } finally {
    // Only this test-created, resolved temporary directory is removed.
    assert.equal(path.dirname(directory), temporary);
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
