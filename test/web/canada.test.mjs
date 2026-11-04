import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startOnFreePort } from './serve.mjs';

const require = createRequire(new URL('../../cloudflare/package.json', import.meta.url));
const puppeteer = require('puppeteer-core');
const executablePath = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(fs.existsSync);
const server = await startOnFreePort(8890, 8900);
const browser = await puppeteer.launch({ executablePath, headless: true });
const output = path.resolve('dist/canada-shots');
fs.mkdirSync(output, { recursive: true });
try {
  for (const lang of ['en', 'pt', 'es']) for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width, height: 1000 });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
      const prefix = lang === 'en' ? '/' : `/${lang}/`;
      await page.goto(server.url + prefix + 'canada-time-zone-changes-2026', { waitUntil: 'networkidle0' });
      const article = await page.evaluate(() => {
        const graph = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'];
        return {
          h1: document.querySelectorAll('h1').length,
          canonical: document.querySelector('link[rel="canonical"]').href,
          alternates: [...document.querySelectorAll('link[hreflang]')].map(a => a.hreflang),
          graph, regionRows: document.querySelectorAll('#regions tbody tr').length,
          questions: [...document.querySelectorAll('#questions h3')].map(h => h.textContent),
          tablesAccessible: [...document.querySelectorAll('.tbl-wrap')].every(t => t.tabIndex === 0 && t.getAttribute('aria-label')),
          overflow: document.documentElement.scrollWidth > innerWidth,
          body: document.querySelector('main').textContent,
        };
      });
      assert.equal(article.h1, 1);
      assert.equal(article.canonical, 'https://openworldclock.com' + prefix + 'canada-time-zone-changes-2026');
      assert.deepEqual(article.alternates.sort(), ['en', 'es', 'pt-BR', 'x-default'].sort());
      assert.equal(article.regionRows, 6);
      assert.equal(article.tablesAccessible, true);
      assert.equal(article.overflow, false);
      const schemaArticle = article.graph.find(n => n['@type'] === 'Article');
      assert.equal(schemaArticle.datePublished, '2026-11-04');
      assert.equal(article.graph.find(n => n['@type'] === 'WebPage').datePublished, '2026-11-04');
      const faqs = article.graph.find(n => n['@type'] === 'FAQPage').mainEntity;
      assert.deepEqual(faqs.map(q => q.name), article.questions);
      for (const faq of faqs) assert(article.body.includes(faq.acceptedAnswer.text));
      assert.deepEqual(errors, []);
      await page.screenshot({ path: path.join(output, `${lang}-${width}-${theme}.png`), fullPage: true });
      // The site lazily renders long sections. Inspect their real scrolled state too.
      for (const id of ['questions', 'sources']) {
        await page.$eval('#' + id, e => e.scrollIntoView());
        await new Promise(resolve => setTimeout(resolve, 100));
        assert(await page.$eval('#' + id, e => e.getBoundingClientRect().height > 50));
      }
      if ((lang === 'en' && width === 1440 && theme === 'light') || (lang === 'pt' && width === 390 && theme === 'dark')) {
        await page.screenshot({ path: path.join(output, `${lang}-${width}-${theme}-sources.png`) });
      }
      if (lang === 'en' && width === 1440 && theme === 'light') {
        await page.click('main .btn-primary');
        await page.waitForSelector('.tool-window.is-ready');
        const frame = await (await page.$('#heroApp')).contentFrame();
        const examples = await frame.evaluate(() => {
          const T = window.WCTime;
          return ['2026-11-04', '2027-07-01'].map(day => {
            const [y, m, d] = day.split('-').map(Number);
            const date = new Date(T.zonedToEpoch('America/Vancouver', y, m, d, 9, 0));
            return ['America/Vancouver', 'America/Edmonton', 'America/Winnipeg', 'America/Toronto', 'America/Los_Angeles'].map(z => {
              const p = T.parts(z, date, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
              return `${p.hour}:${p.minute}`;
            });
          });
        });
        assert.deepEqual(examples, [['09:00', '10:00', '11:00', '11:00', '08:00'], ['09:00', '10:00', '11:00', '12:00', '09:00']]);
        assert.equal(await frame.$eval('#convClear', e => e.hidden), false);
      }
    } finally { await context.close(); }
  }
  console.log('PASS: Canadian guide in three languages, mobile/desktop, light/dark, accessible tables, metadata, schema and real conversion examples.');
} finally { await browser.close(); await server.close(); }
