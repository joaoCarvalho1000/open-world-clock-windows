import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { check } from './site-chrome.mjs';

test('chrome checks report missing files but do not hide other read failures', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'owc-chrome-io-'));
  try {
    fs.mkdirSync(path.join(root, 'assets'));
    fs.copyFileSync(new URL('../site/assets/config.js', import.meta.url), path.join(root, 'assets/config.js'));
    const missing = check({ siteDir: root });
    assert.equal(missing.length, 90);
    assert.ok(missing.every(message => message.endsWith(' is missing')));
    fs.mkdirSync(path.join(root, 'index.html'));
    assert.throws(() => check({ siteDir: root }), error => error.code === 'EISDIR' || error.code === 'EACCES');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('IndexNow dry run accepts an absent state file and rejects corrupt state without notification', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'owc-indexnow-io-'));
  try {
    const cf = path.join(root, 'cloudflare'), site = path.join(root, 'site');
    fs.mkdirSync(cf); fs.mkdirSync(site);
    fs.copyFileSync(new URL('./indexnow.mjs', import.meta.url), path.join(cf, 'indexnow.mjs'));
    fs.writeFileSync(path.join(cf, 'indexnow-key.txt'), '0123456789abcdef0123456789abcdef');
    fs.writeFileSync(path.join(site, 'sitemap.xml'), '<urlset><url><loc>https://openworldclock.com/</loc></url></urlset>');
    fs.writeFileSync(path.join(site, 'index.html'), '<p>Fixture</p>');
    const run = () => spawnSync(process.execPath, [path.join(cf, 'indexnow.mjs')], { encoding: 'utf8', timeout: 10000 });
    const empty = run();
    assert.equal(empty.status, 0, empty.stderr);
    assert.match(empty.stdout, /Dry run/);
    assert.equal(fs.existsSync(path.join(cf, '.wrangler')), false);
    fs.mkdirSync(path.join(cf, '.wrangler'));
    fs.writeFileSync(path.join(cf, '.wrangler/seo-indexnow-state.json'), '{broken');
    const broken = run();
    assert.notEqual(broken.status, 0);
    assert.match(broken.stderr, /SyntaxError/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
