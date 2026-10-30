// Build-time HTML inspection, never a sanitizer. Keep source slices for CSP hashes
// and surgical build edits; parsing must not serialize or normalize shipped bytes.
import { parse, parseFragment } from 'parse5';

export function elements(html) {
  const found = [];
  const visit = (node, hiddenStore = false) => {
    hiddenStore ||= !!node.attrs?.some(a => a.name === 'data-store') && node.attrs.some(a => a.name === 'hidden');
    if (node.tagName && node.sourceCodeLocation?.startTag) {
      const location = node.sourceCodeLocation;
      found.push({
        tag: node.tagName,
        hiddenStore,
        attr: name => node.attrs.find(a => a.name === name)?.value,
        raw: html.slice(location.startOffset, location.endOffset),
        content: html.slice(location.startTag.endOffset, location.endTag?.startOffset ?? location.endOffset),
      });
    }
    for (const child of node.childNodes || []) visit(child, hiddenStore);
    // Template contents and noscript with scripting enabled are inert.
  };
  visit(parse(html, { sourceCodeLocationInfo: true }));
  return found;
}

export function htmlText(html, { omitHiddenStore = false } = {}) {
  const text = node => {
    if (['script', 'style', 'template'].includes(node.tagName)) return '';
    if (omitHiddenStore && node.attrs?.some(a => a.name === 'data-store') && node.attrs.some(a => a.name === 'hidden')) return '';
    if (node.nodeName === '#text') return node.value;
    return (node.childNodes || []).map(text).join('');
  };
  return text(parseFragment(html)).replace(/\s+/gu, ' ').trim();
}
