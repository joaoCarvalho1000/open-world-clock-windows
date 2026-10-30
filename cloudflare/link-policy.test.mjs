import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkPolicy, fetchChecked } from '../scripts/lib/link-policy.mjs';
import { checkLinks } from './check-links.mjs';

const allowed = linkPolicy('owner/repo', 'https://download.openworldclock.com');
test('destination policy rejects authority confusion, credentials, ports and sibling repos', () => {
  for (const value of [
    'http://github.com/owner/repo', 'https://github.com.evil.test/owner/repo',
    'https://github.com@127.0.0.1/owner/repo', 'https://x@github.com/owner/repo',
    'https://github.com:8443/owner/repo', 'https://github.com/owner/repository',
    'https://github.com/owner/repo/../../other/repo', 'file:///etc/passwd',
    'https://download.openworldclock.com.evil.test/x.exe', 'https://[::1]/',
  ]) assert.equal(allowed(value), false, value);
  for (const value of ['https://github.com/owner/repo/issues', 'https://apps.microsoft.com/detail/9TEST',
    'https://download.openworldclock.com/Open-World-Clock-1.4.0-setup.exe']) assert.equal(allowed(value), true, value);
});

test('redirects are checked before the next request, and every response body is released', async () => {
  const calls = [], bodies = [];
  const request = async (url, options) => {
    calls.push(url); assert.equal(options.redirect, 'manual');
    const response = new Response('redirect', { status: 302, headers: { location: 'https://127.0.0.1/private' } });
    bodies.push(response.body); return response;
  };
  await assert.rejects(fetchChecked(request, 'https://github.com/owner/repo', {}, allowed), /destination policy/);
  assert.deepEqual(calls, ['https://github.com/owner/repo']);
  assert.equal(bodies[0].locked, false);
  assert.equal((await bodies[0].getReader().read()).done, true);
  let hops = 0;
  await assert.rejects(fetchChecked(async () => { hops++; return new Response('', { status: 302, headers: { location: '/owner/repo' } }); },
    'https://github.com/owner/repo', {}, allowed), /Too many/);
  assert.equal(hops, 6);
  const ok = await fetchChecked(async url => url.endsWith('/issues') ? new Response('ok') :
    new Response('', { status: 302, headers: { location: '/owner/repo/issues' } }), 'https://github.com/owner/repo', {}, allowed);
  assert.equal(ok.status, 200);
});

test('untrusted configured hosts fail closed before a request', async () => {
  for (const patch of [{ downloadBase: 'https://127.0.0.1' }, { githubRepo: 'owner/repo@127.0.0.1' },
    { storeUrl: 'https://apps.microsoft.com.evil.test/detail/x' }]) {
    let calls = 0;
    const result = await checkLinks({ config: { storeUrl: 'https://apps.microsoft.com/detail/x', githubRepo: 'owner/repo',
      downloadBase: 'https://download.openworldclock.com', version: '1.4.0', ...patch }, version: '1.4.0',
      fetchImpl: async () => { calls++; return new Response('ok'); } });
    assert.equal(calls, 0);
    assert.ok(result.problems.some(p => p.includes('destination policy')));
  }
});
