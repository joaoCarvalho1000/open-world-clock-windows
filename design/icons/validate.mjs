// Dependency-free structural and optional headless Chromium validation. No SVGO.
// node design/icons/validate.mjs [--render] [--strict-checklist]
// --svg-only remains accepted for compatibility. This public validator always checks SVGs.
// CHROME_PATH may point to a Chrome/Edge executable on any platform.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { directory, catalog, lineVariants, readMasters, parsePath } from './svg-tools.mjs';

const masters = readMasters();
const byId = Object.fromEntries(masters.map(master => [master.id, master]));
const conflicts = [];
const onGrid = (value, scale) => Math.abs(Number(value) * scale - Math.round(Number(value) * scale)) < 1e-7;
for (const master of masters) {
  const numbers = master.shapes.flatMap(({ tag, attrs }) =>
    tag === 'path' ? parsePath(attrs.d).flatMap(part => part.values) :
    Object.entries(attrs).filter(([key]) => ['cx','cy','r','x','y','width','height','rx','x1','y1','x2','y2','points'].includes(key))
      .flatMap(([, value]) => value.match(/-?(?:\d+(?:\.\d+)?|\.\d+)/g)));
  assert.deepEqual(master.shapes, catalog.geometry[master.id], master.id + ': exact approved geometry');
  const outsideGrid = [...new Set(numbers.filter(value => !onGrid(value, 4)))];
  const precision = [...new Set(numbers.filter(value => (value.split('.')[1]?.length || 0) > 2))];
  if (outsideGrid.length || precision.length) conflicts.push({
    id: master.id, rule: 'coordinate-grid', values: outsideGrid, precision,
    reason: 'Playful masters must stay on the quarter grid with at most two decimals.',
  });
}
for (const id of lineVariants) {
  assert.equal(byId[id + '-fill'].source.replaceAll('stroke-width="2.5"', 'stroke-width="2"'), byId[id].source, id + ': selected geometry');
}
// Every master is checked against the approved geometry, including all control points and ink.
for (const id of ['sun', 'moon']) {
  assert.equal(byId[id].source, byId[id + '-fill'].source, id + ': solid status aliases');
}

// Reflection is a geometry requirement. Check coordinates, independent of raster AA.
function endpoints(id, axis) {
  let x = 0, y = 0;
  return parsePath(byId[id].shapes[0].attrs.d).map(({ command, values }) => {
    const n = values.map(Number);
    if (command === 'M' || command === 'L') [x,y] = n;
    else if (command === 'H') x = n[0];
    else if (command === 'V') y = n[0];
    else throw new Error('Unexpected directional command ' + command);
    return [command === 'M' ? 'M' : 'L', axis === 'x' ? 24-x : x, axis === 'y' ? 24-y : y];
  });
}
for (const [a,b,axis] of [['chevron-left','chevron-right','x'],['chevron-up','chevron-down','y'],['arrow-back','arrow-right','x']]) {
  assert.deepEqual(endpoints(a,axis), endpoints(b), a + ': exact reflected coordinates');
}


function outerSubpath(master) {
  const parts = parsePath(master.shapes[0].attrs.d);
  const end = parts.findIndex(part => part.command.toUpperCase() === 'Z');
  return parts.slice(0, end + 1);
}
for (const master of masters.filter(master => master.id.endsWith('-fill'))) {
  const base = master.id.slice(0, -5);
  if (lineVariants.includes(base)) continue;
  if (JSON.stringify(outerSubpath(master)) !== JSON.stringify(outerSubpath(byId[base]))) {
    conflicts.push({ id: master.id, rule: 'fill-silhouette',
      reason: 'Filled variants must preserve the first closed contour.' });
  }
}

assert.deepEqual(conflicts, [], 'Structural specification checklist');
console.log('PASS: ' + masters.length + ' SVG masters parsed; exact approved geometry, quarter grid, colors, stroke, command budget, inventory, selected variants and silhouette.');
if (process.argv.includes('--strict-checklist')) assert(process.argv.includes('--render'), '--strict-checklist requires --render for pixel and live-area checks');

const reviewDir = path.join(directory, 'review');
fs.mkdirSync(reviewDir, { recursive: true });
let rendering;
if (process.argv.includes('--render')) {
  const chromePath = process.env.CHROME_PATH || [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium',
  ].find(file => fs.existsSync(file));
  assert(chromePath, 'Set CHROME_PATH to Chrome or Edge');
  const profile = path.join(reviewDir, 'chromium-' + process.pid);
  const child = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run',
    '--no-default-browser-check', '--remote-debugging-pipe', '--user-data-dir=' + profile, 'about:blank'],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  let stderr = '', buffer = '', nextId = 0;
  const pending = new Map();
  child.stderr.on('data', data => { stderr += data; });
  try {
    // Chromium's inherited pipes keep rendered file contents off network sockets.
    child.stdio[4].setEncoding('utf8');
    child.stdio[4].on('data', data => {
      buffer += data;
      let end;
      while ((end = buffer.indexOf('\0')) !== -1) {
        const packet = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        if (!packet) continue;
        const message = JSON.parse(packet);
        const callback = pending.get(message.id);
        if (!callback) continue;
        pending.delete(message.id);
        clearTimeout(callback.timer);
        if (message.error) callback.reject(new Error(JSON.stringify(message.error)));
        else callback.resolve(message.result);
      }
    });
    const failPending = error => {
      for (const callback of pending.values()) { clearTimeout(callback.timer); callback.reject(error); }
      pending.clear();
    };
    child.on('error', failPending);
    child.on('exit', code => failPending(new Error('Chromium exited (' + code + '): ' + stderr.slice(-1200))));
    child.stdio[3].on('error', failPending);
    function call(method, params = {}, sessionId) {
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 30000);
        pending.set(id, { resolve, reject, timer });
        child.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
      });
    }
    const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
    const cdp = (method, params) => call(method, params, sessionId);
    await cdp('Page.enable');
    await cdp('Runtime.enable');
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
    // Render only the known, self-authored contact-sheet source in an isolated browser.
    // This does not open local file URLs in the user's browser.
    const { frameTree } = await cdp('Page.getFrameTree');
    await cdp('Page.setDocumentContent', { frameId: frameTree.frame.id,
      html: fs.readFileSync(path.join(directory, 'contact-sheet.html'), 'utf8') });
    async function evaluate(expression) {
      const response = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      assert(!response.exceptionDetails, JSON.stringify(response.exceptionDetails));
      return response.result.value;
    }
    const loadDeadline = Date.now() + 10000;
    while (!(await evaluate('document.querySelectorAll("article").length === ' + masters.length))) {
      assert(Date.now() < loadDeadline, 'Contact sheet failed to load');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    rendering = await evaluate('(' + renderChecks.toString() + ')(' + JSON.stringify(masters) + ')');
    assert.deepEqual(rendering.failures, [], 'Browser SVG parsing and raster checks');
    conflicts.push(...rendering.conflicts);
    for (let y = 0, page = 1; y < rendering.height; y += 1400, page++) {
      const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
        clip: { x: 0, y, width: 1280, height: Math.min(1400, rendering.height-y), scale: 1 } });
      fs.writeFileSync(path.join(reviewDir, 'contact-sheet-' + page + '.png'), Buffer.from(shot.data, 'base64'));
    }
    await call('Browser.close');
    console.log('PASS: ' + rendering.samples + ' contact-sheet samples at 1x; SVG parsing, live area and optical weight; sky controls; exact directional reflections (raster AA differences recorded).');
  } finally {
    child.stdio[3].end();
    if (child.exitCode === null) child.kill();
  }
}
fs.writeFileSync(path.join(reviewDir, 'validation.json'), JSON.stringify({
  masters: masters.length, structural: 'pass', rendering: rendering || 'not requested',
  checklistConflicts: conflicts,
}, null, 2) + '\n');
console.log('Playful checklist failures: ' + conflicts.length + '. Legacy weight comparisons: ' + (rendering?.legacyWeightComparisons.length ?? 'not rendered') + '. See design/icons/review/validation.json.');
if (rendering || process.argv.includes('--strict-checklist')) assert.deepEqual(conflicts, [], 'Playful acceptance checklist');

// This function runs inside the isolated headless browser, not in Node.
async function renderChecks(masters) {
  const failures = [], conflicts = [], metrics = [], rasters = {}, reflectionRasters = [], legacyWeightComparisons = [];
  const fail = (condition, label) => { if (!condition) failures.push(label); };
  const parser = new DOMParser();
  async function raster(svg, size = 96) {
    const image = new Image();
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, size, size);
    return ctx.getImageData(0, 0, size, size).data;
  }
  const simple = new Set(['add','close','check','chevron-down','chevron-up','chevron-left','chevron-right',
    'arrow-back','arrow-right','more-vert','more-horiz','minimize','edit','reorder','face','download','convert']);
  for (let i = 0; i < masters.length; i++) {
    const { id, source } = masters[i];
    const svgDocument = parser.parseFromString(source, 'image/svg+xml');
    fail(!svgDocument.querySelector('parsererror'), id + ': SVG XML parsing');
    const original = await raster(source);
    rasters[id] = original;
    let outside = 0, minX = 96, minY = 96, maxX = -1, maxY = -1;
    for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
      const alpha = original[(y*96+x)*4+3]/255;
      if (x < 8 || x >= 88 || y < 8 || y >= 88) outside += alpha;
      if (alpha > 0) { minX = Math.min(minX,x); minY = Math.min(minY,y); maxX = Math.max(maxX,x); maxY = Math.max(maxY,y); }
    }
    if (outside > 0) conflicts.push({ id, rule: 'live-area', bounds: [minX/4,minY/4,(maxX+1)/4,(maxY+1)/4], reason: 'All Playful pixels must stay inside the live area.' });
    const pixels24 = await raster(source, 24);
    let area24 = 0;
    for (let y = 2; y < 22; y++) for (let x = 2; x < 22; x++) area24 += pixels24[(y*24+x)*4+3]/255;
    const coverage = area24/400*100;
    const selectedLine = ['convert-fill','layout-strip-fill','layout-compact-fill','layout-vertical-fill'].includes(id);
    const fill = (id.endsWith('-fill') && !selectedLine) || ['check-circle','sun','moon','theme-auto','look'].includes(id);
    const family = selectedLine ? 'selected-line' : fill ? 'solid' : simple.has(id) ? 'simple' : 'outlined';
    const [low,high] = { simple:[5,32], outlined:[20,60], 'selected-line':[18,60], solid:[20,80] }[family];
    if (coverage < low || coverage > high) conflicts.push({
      id, rule:'optical-weight', family, coverage:+coverage.toFixed(2), requested:[low,high],
      reason:'Outside the approved Playful semantic-family band.',
    });
    const legacyFill = (id.endsWith('-fill') && !selectedLine) || ['check-circle','more-vert','more-horiz'].includes(id);
    const legacyBand = legacyFill ? [30,55] : [14,24];
    if (!['minimize','more-vert','more-horiz'].includes(id) && (coverage < legacyBand[0] || coverage > legacyBand[1])) {
      legacyWeightComparisons.push({id,coverage:+coverage.toFixed(2),version1Band:legacyBand});
    }
    metrics.push({ id, coverage: +coverage.toFixed(2), bounds: [minX/4,minY/4,(maxX+1)/4,(maxY+1)/4] });
  }
  for (const [a,b,axis] of [['chevron-left','chevron-right','x'],['chevron-up','chevron-down','y'],['arrow-back','arrow-right','x']]) {
    let maxDifference = 0;
    for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
      const other = ((axis === 'y' ? 95-y : y)*96+(axis === 'x' ? 95-x : x))*4+3;
      maxDifference = Math.max(maxDifference, Math.abs(rasters[a][(y*96+x)*4+3]-rasters[b][other]));
    }
    // Reflected geometry is asserted in Node. Record directional raster AA differences.
    reflectionRasters.push({ pair: [a,b], maxAlphaDifference: maxDifference });
  }
  const samples = [...document.querySelectorAll('.sample svg')];
  fail(samples.length === masters.length*6, 'Contact sheet sample count');
  for (const svg of samples) {
    const size = parseInt(svg.parentElement.style.getPropertyValue('--size'));
    const bounds = svg.getBoundingClientRect();
    fail(bounds.width === size && bounds.height === size, 'Contact sheet sample size');
  }
  const skyStates = [];
  for (const phase of ['neutral','dawn','day','golden','dusk']) {
    document.querySelector('button[data-phase="' + phase + '"]').click();
    skyStates.push({phase,light:getComputedStyle(document.querySelector('.light')).backgroundImage,
      dark:getComputedStyle(document.querySelector('.dark')).backgroundImage});
    fail(document.querySelectorAll('button[aria-pressed="true"]').length===1, 'Sky selection');
  }
  document.querySelector('button[data-phase="day"]').click();
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  fail(document.documentElement.scrollWidth === document.documentElement.clientWidth, 'Contact sheet horizontal overflow');
  return { failures, conflicts, legacyWeightComparisons, metrics, reflectionRasters, skyStates,
    samples: samples.length, height: document.documentElement.scrollHeight };
}
