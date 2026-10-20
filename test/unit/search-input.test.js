// Exercise the actual renderer functions against authored expectations, independently
// of export-shared.mjs (which deliberately generates its golden data from the renderer).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const fixtures = JSON.parse(fs.readFileSync(path.join(root, 'shared/search-input-fixtures.json'), 'utf8'));
function renderer() {
  const context = vm.createContext({ window: {}, Intl, Date });
  for (const name of ['zones.js', 'time.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'src/renderer', name), 'utf8'), context);
  }
  const source = fs.readFileSync(path.join(root, 'src/renderer/app.js'), 'utf8');
  function section(start, end) {
    const a = source.indexOf(start), b = source.indexOf(end, a);
    assert.ok(a >= 0 && b > a, `search harness anchors: ${start}`);
    return source.slice(a, b);
  }
  vm.runInContext(`
    const T = window.WCTime, I = { lang: 'en', locale: 'en-US' };
    ${section('  const LEGACY', '  let settings = null')}
    let settings = { zones: [], labels: {} };
    ${section('  const englishCity', '  const labelOf')}
    ${section('  const ABBR =', '  // Nothing to add for this query')}
    this.search = searchZones;
    this.parse = parseOffsetQuery;
    this.kind = () => lastOffsetQuery;
    this.exclude = (zone) => { settings.zones = [zone]; };
  `, context);
  return context;
}
for (const entry of fixtures.terms) {
  test(`shared timezone term ${JSON.stringify(entry.query)}`, () => {
    const api = renderer();
    assert.deepEqual(Array.from(api.search(entry.query)), entry.zones);
    assert.equal(api.kind().abbr, true);
    api.exclude(entry.zones[0]);
    assert.deepEqual(Array.from(api.search(entry.query)), entry.zones.slice(1));
  });
}
for (const entry of fixtures.offsets) {
  test(`shared offset input ${JSON.stringify(entry.query)}`, () => {
    // Negative zero is the same UTC offset as positive zero on every platform.
    const actual = renderer().parse(entry.query);
    assert.equal(actual === 0 ? 0 : actual, entry.minutes);
  });
}
for (const entry of fixtures.identifiers) {
  test(`shared identifier input ${JSON.stringify(entry.query)}`, () => {
    const api = renderer();
    assert.deepEqual(Array.from(api.search(entry.query)), entry.zone ? [entry.zone] : []);
    if (entry.zone) {
      api.exclude(entry.zone);
      assert.deepEqual(Array.from(api.search(entry.query)), [], 'existing exclusion contract is preserved');
    }
  });
}
