import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

export const directory = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(directory, '../..');
export const catalog = JSON.parse(fs.readFileSync(path.join(directory, 'icons.json'), 'utf8'));
export const lineVariants = ['convert', 'layout-strip', 'layout-compact', 'layout-vertical'];
export const masterNames = catalog.icons.filter(icon => icon.size === 24)
  .flatMap(icon => icon.outputs.svg.map(file => path.basename(file, '.svg'))).sort();

const numeric = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;
const geometryAttributes = {
  path: ['d'],
  circle: ['cx', 'cy', 'r'],
  rect: ['x', 'y', 'width', 'height', 'rx'],
  line: ['x1', 'y1', 'x2', 'y2'],
  polyline: ['points'],
};
const presentation = ['fill', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'];

// A deliberately restricted XML parser. Reject everything outside the master format,
// including unconsumed text, duplicate attributes, entities and nested elements.
function attributes(source) {
  const attrs = {};
  let rest = source;
  while (rest.trim()) {
    const match = /^\s+([\w:-]+)="([^"<>&]*)"/.exec(rest);
    assert(match, 'Malformed XML attributes: ' + rest);
    assert(!(match[1] in attrs), 'Duplicate attribute: ' + match[1]);
    attrs[match[1]] = match[2];
    rest = rest.slice(match[0].length);
  }
  return attrs;
}

export function parseSvg(source, name) {
  assert(source.endsWith('\n') && !source.endsWith('\n\n'), name + ': one trailing newline');
  assert(!/[\r\u2013\u2014]/.test(source), name + ': LF and no long dashes');
  const document = /^<svg([^<>]*)>\n([\s\S]*)<\/svg>\n$/.exec(source);
  assert(document, name + ': SVG root');
  assert.deepEqual(attributes(document[1]), {
    xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24',
  }, name + ': root attributes');
  let body = document[2];
  const shapes = [];
  while (body.trim()) {
    const element = /^\s*<([a-z]+)([^<>]*)\/>/.exec(body);
    assert(element, name + ': unsupported or malformed element');
    const tag = element[1], attrs = attributes(element[2]);
    assert(tag in geometryAttributes, name + ': forbidden element ' + tag);
    for (const key of Object.keys(attrs)) {
      assert([...geometryAttributes[tag], ...presentation].includes(key), name + ': forbidden attribute ' + key);
    }
    for (const key of geometryAttributes[tag]) {
      assert(key in attrs, name + ': missing ' + key);
      if (!['d', 'points'].includes(key)) assert(numeric.test(attrs[key]), name + ': invalid number');
    }
    if (attrs.stroke) {
      assert.equal(attrs.fill, 'none', name);
      assert.equal(attrs.stroke, 'currentColor', name);
      const fallback = lineVariants.some(id => name === id + '-fill');
      const widths = fallback ? [String(catalog.stroke.selectedWeight)] : [String(catalog.stroke.width)];
      if (name === 'clock') widths.push(String(catalog.stroke.details.clockHands));
      if (name === 'sun' || name === 'sun-fill') widths.push(String(catalog.stroke.details.sunRays));
      assert(widths.includes(attrs['stroke-width']), name + ': approved stroke width');
      assert.equal(attrs['stroke-linecap'], 'round', name);
      assert.equal(attrs['stroke-linejoin'], 'round', name);
      assert(!attrs['fill-rule'], name);
    } else {
      assert.equal(attrs.fill, 'currentColor', name);
      assert(!Object.keys(attrs).some(key => key.startsWith('stroke')), name);
      if (tag === 'path') assert.equal(attrs['fill-rule'], 'evenodd', name);
    }
    if (tag === 'path') parsePath(attrs.d);
    if (tag === 'polyline') {
      assert(/^[\d.,\s-]+$/.test(attrs.points), name);
      assert(attrs.points.match(/-?(?:\d*\.?\d+)/g).length % 2 === 0, name);
    }
    shapes.push({ tag, attrs });
    body = body.slice(element[0].length);
  }
  assert(shapes.length > 0 && shapes.length <= 6, name + ': element budget');
  const commands = shapes.flatMap(shape => shape.tag === 'path' ? parsePath(shape.attrs.d) : []);
  assert(commands.length <= 40, name + ': path command budget: ' + commands.length);
  return shapes;
}

export function parsePath(data) {
  const tokens = data.match(/[a-zA-Z]|-?(?:\d+(?:\.\d+)?|\.\d+)/g) || [];
  assert.equal(data.replace(/[a-zA-Z]|-?(?:\d+(?:\.\d+)?|\.\d+)|[\s,]/g, ''), '', 'Invalid path syntax');
  const arity = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
  let command, index = 0;
  const result = [];
  while (index < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[index])) command = tokens[index++];
    assert(command && command.toUpperCase() in arity, 'Invalid path command');
    const count = arity[command.toUpperCase()];
    const values = tokens.slice(index, index + count);
    assert(values.length === count && values.every(v => numeric.test(v)), 'Invalid command arguments');
    if (command.toUpperCase() === 'A') {
      assert(+values[0] > 0 && +values[1] > 0, 'Positive arc radii');
      assert(['0', '1'].includes(values[3]) && ['0', '1'].includes(values[4]), 'Arc flags');
    }
    result.push({ command, values });
    index += count;
    if (count === 0) command = undefined;
    else if (command === 'M') command = 'L';
    else if (command === 'm') command = 'l';
  }
  assert(result[0]?.command.toUpperCase() === 'M', 'Path must start with a move');
  return result;
}

const num = value => Number(Number(value).toFixed(6));
export function pathData({ tag, attrs: a }) {
  const v = key => +a[key];
  if (tag === 'path') return a.d;
  if (tag === 'line') return 'M' + a.x1 + ' ' + a.y1 + 'L' + a.x2 + ' ' + a.y2;
  if (tag === 'polyline') return 'M' + a.points.trim().split(/[\s,]+/).reduce((out, value, i) => out + (i > 0 && i % 2 === 0 ? 'L' : i % 2 ? ' ' : '') + value, '');
  if (tag === 'circle') {
    const x = v('cx'), y = v('cy'), r = v('r');
    return 'M' + num(x-r) + ' ' + y + 'a' + r + ' ' + r + ' 0 1 0 ' + num(2*r) + ' 0a' + r + ' ' + r + ' 0 1 0 ' + num(-2*r) + ' 0Z';
  }
  const x = v('x'), y = v('y'), w = v('width'), h = v('height'), r = v('rx');
  assert(r > 0 && r <= Math.min(w, h) / 2, 'Valid rounded rect radius');
  return 'M' + num(x+r) + ' ' + y + 'H' + num(x+w-r) +
    'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + r + 'V' + num(y+h-r) +
    'a' + r + ' ' + r + ' 0 0 1 ' + -r + ' ' + r + 'H' + num(x+r) +
    'a' + r + ' ' + r + ' 0 0 1 ' + -r + ' ' + -r + 'V' + num(y+r) +
    'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + -r + 'Z';
}

export function readMasters() {
  const actual = fs.readdirSync(path.join(directory, 'svg')).sort();
  assert.deepEqual(actual, masterNames.map(id => id + '.svg').sort(), 'Master inventory');
  return masterNames.map(id => {
    const source = fs.readFileSync(path.join(directory, 'svg', id + '.svg'), 'utf8');
    return { id, source, shapes: parseSvg(source, id) };
  });
}
