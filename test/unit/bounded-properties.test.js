// A reproducible, bounded property corpus for existing time/link invariants.
// This is local regression coverage, not a claim of continuous OSS-Fuzz enrollment.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const window = {};
for (const file of ['time.js', 'share-link.js']) vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, '../../src/renderer', file), 'utf8'), { window, Intl, Date, URLSearchParams });
let seed = 0x20261030;
const pick = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };

test('seeded civil times round trip in fixed/fractional zones without DST ambiguity', () => {
  const zones = ['UTC', 'Asia/Kathmandu', 'Asia/Kolkata', 'Pacific/Marquesas'];
  for (let i = 0; i < 256; i++) {
    const zone = zones[pick(zones.length)], y = 2024 + pick(5), m = 1 + pick(12), d = 1 + pick(28), h = pick(24), minute = pick(60);
    const ms = window.WCTime.zonedToEpoch(zone, y, m, d, h, minute);
    const p = window.WCTime.parts(zone, new Date(ms), { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    assert.deepEqual([+p.year, +p.month, +p.day, +p.hour, +p.minute], [y, m, d, h, minute]);
    const parsed = window.WCTime.parseTime(`${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    assert.deepEqual(Array.from(parsed), [h, minute]);
  }
});

test('seeded exact meetings preserve zones and elapsed interval through link encoding', () => {
  const codec = window.WCLink;
  const zones = ['Europe/London', 'America/New_York', 'Asia/Kathmandu'];
  for (let i = 0; i < 256; i++) {
    const startMs = Date.UTC(2026, pick(12), 1 + pick(28), pick(24), pick(4) * 15);
    const endMs = startMs + (1 + pick(8)) * 900000;
    const encoded = codec.build(zones, zones[pick(zones.length)], startMs, endMs);
    const decoded = codec.parse(encoded);
    assert.equal(decoded.startMs, startMs);
    assert.equal(decoded.endMs, endMs);
    assert.deepEqual(Array.from(decoded.zones), zones);
    assert.equal(codec.parse(encoded + '&s=garbage').bad, true);
  }
});
