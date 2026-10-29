import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { headersFor, SITE } from '../test/web/serve.mjs';
import path from 'node:path';

test('the shared app permits indexing inside its parent without becoming a standalone result', () => {
  const html = fs.readFileSync(path.join(SITE, 'app/index.html'), 'utf8');
  const meta = html.match(/<meta name="robots" content="([^"]+)"/)[1];
  const header = headersFor('/app/')['x-robots-tag'];
  for (const directives of [meta, header]) {
    const tokens = directives.split(',').map(s => s.trim());
    assert(tokens.includes('noindex'), 'standalone app must remain excluded');
    assert(tokens.includes('indexifembedded'), 'embedded tools must be indexable with their parent');
  }
  for (const prefix of ['', 'pt/', 'es/']) {
    for (const slug of ['world-map', 'world-time-now', 'time-zone-converter', 'meeting-planner', 'utc-time']) {
      const route = '/' + prefix + slug;
      const parent = fs.readFileSync(path.join(SITE, prefix, slug + '.html'), 'utf8');
      assert(!/name="robots"[^>]*content="[^"]*noindex/.test(parent), route);
      assert(!/noindex/.test(headersFor(route)['x-robots-tag'] || ''), route);
    }
  }
  assert.equal(headersFor('/api/example')['x-robots-tag'], 'noindex', 'API exclusion is unchanged');
});
