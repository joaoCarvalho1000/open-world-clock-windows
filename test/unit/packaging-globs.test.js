// The scoped minimatch upgrade must preserve electron-builder's directory walk
// and ordered exclusions, while legacy asar callers retain their function API.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const { FileMatcher } = require('app-builder-lib/out/fileMatcher');
const { hasMagic } = require('app-builder-lib/out/util/filter');
const builderRequire = createRequire(require.resolve('app-builder-lib'));
const { Minimatch } = builderRequire('minimatch');

test('packaging globs preserve directory traversal, dotfiles and exclusions', () => {
  const root = path.resolve('packaging-fixture');
  const matcher = new FileMatcher(root, root, value => value, [
    'src/**/*', 'build/icon.{png,ico}', '!**/.smoke/**', '!test/**',
  ]);
  const filter = matcher.createFilter();
  for (const [name, directory, included] of [
    ['src', true, true],
    ['src/nested', true, true],
    ['src/nested/main.js', false, true],
    ['src/.config.json', false, true],
    ['src/.smoke', true, false],
    ['src/.smoke/main.js', false, false],
    ['build', true, true],
    ['build/icon.png', false, true],
    ['build/icon.ico', false, true],
    ['build/icon.svg', false, false],
    ['test/main.js', false, false],
    ['node_modules', true, false],
  ]) {
    assert.equal(filter(path.join(root, name), { isDirectory: () => directory }), included, name);
  }
  assert.equal(hasMagic(new Minimatch('src')), false);
  assert.equal(hasMagic(new Minimatch('src/**/*')), true);
  const literalDirectory = new FileMatcher(root, root, value => value, ['src']).createFilter();
  assert.equal(literalDirectory(path.join(root, 'src/nested/main.js'), { isDirectory: () => false }), true);
});

test('packaging matcher bounds globparts amplification at optimization level two', () => {
  const pattern = Array(30).fill('**/../a/b').join('/');
  const matcher = new Minimatch(pattern, { optimizationLevel: 2, braceExpandMax: 64 });
  assert.equal(matcher.set.length, 64);
});

test('legacy asar keeps the callable minimatch API used by unpack filters', () => {
  const asarRequire = createRequire(require.resolve('@electron/asar'));
  const minimatch = asarRequire('minimatch');
  assert.equal(typeof minimatch, 'function');
  assert.equal(minimatch('main.js', '*.js', { matchBase: true }), true);
});
