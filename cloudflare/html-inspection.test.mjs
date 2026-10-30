import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { elements, htmlText } from '../scripts/lib/html.mjs';

test('HTML inspection follows browser raw-text, quoted attributes and inert templates', () => {
  const source = '<!-- <script>fake()</script> --><template><script>inert()</script></template>' +
    '<SCRIPT data-note=">">const message = "<tag>";\nreal();</SCRIPT >' +
    '<script SRC="external.js">ignored()</script><script type="application/ld+json">{"name":"a>b"}</script>';
  const scripts = elements(source).filter(n => n.tag === 'script');
  assert.equal(scripts.length, 3);
  assert.equal(scripts[0].content, 'const message = "<tag>";\nreal();');
  assert.equal(scripts[1].attr('src'), 'external.js');
  assert.deepEqual(JSON.parse(scripts[2].content), { name: 'a>b' });
  assert.equal(createHash('sha256').update(scripts[0].content).digest('hex'),
    createHash('sha256').update('const message = "<tag>";\nreal();').digest('hex'));
});

test('visible text decodes entities once and cannot borrow FAQ content from JSON-LD', () => {
  const html = '<script type="application/ld+json">{"answer":"invisible answer"}</script>' +
    '<p title=">">&lt;img&gt; &amp;lt;script&amp;gt; &nbsp; A<strong>B</strong></p>';
  assert.equal(htmlText(html), '<img> &lt;script&gt; AB');
  assert.equal(htmlText(html).includes('invisible answer'), false);
  const store = '<section data-store hidden><div><a href="https://apps.microsoft.com/detail/x">Store</a></div></section><p>Installer</p>';
  assert.equal(elements(store).find(n => n.tag === 'a').hiddenStore, true);
  assert.equal(htmlText(store, { omitHiddenStore: true }), 'Installer');
});
