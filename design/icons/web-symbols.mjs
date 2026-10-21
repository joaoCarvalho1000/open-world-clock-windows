// Build-time adapters shared by the Windows renderer and website generators.
import assert from 'node:assert/strict';
import { readMasters } from './svg-tools.mjs';

const masters = new Map(readMasters().map(master => [master.id, master.source]));
export const siteIcons = Object.freeze({
  store: 'store', download: 'download', share: 'share', file: 'file',
  sun: 'sun', moon: 'moon', system: 'theme-auto', pin: 'pin', copy: 'copy',
  plus: 'add', back: 'now', chev: 'chevron-down', strip: 'layout-strip',
  compact: 'layout-compact', vert: 'layout-vertical', globe: 'globe',
  phone: 'phone', check: 'check', cup: 'cup', plan: 'plan',
  arrow: 'arrow-right', mail: 'mail',
});

export function masterSvg(id) {
  assert(masters.has(id), 'Unknown icon: ' + id);
  return masters.get(id);
}
export function symbol(id, name) {
  const body = masterSvg(id).replace(/^<svg[^>]*>\n|<\/svg>\n$/g, '').trim().replace(/\n\s*/g, '');
  // A filled master must not inherit the host site's outline stroke.
  return '<symbol id="' + name + '" viewBox="0 0 24 24" stroke="none">' + body + '</symbol>';
}
export const siteSymbols = Object.fromEntries(Object.entries(siteIcons).map(([name, id]) => ['i-' + name, symbol(id, 'i-' + name)]));
