/**
 * QA-only browser shim for Node's `path` (posix subset) — see fs-promises.js
 * for why these shims exist. Pure-JS implementations, safe in the webview.
 */

export function join(...parts) {
  return normalize(parts.filter(Boolean).join('/'));
}

export function normalize(p) {
  const abs = p.startsWith('/');
  const out = [];
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return (abs ? '/' : '') + out.join('/');
}

export function dirname(p) {
  const i = p.replace(/\/+$/, '').lastIndexOf('/');
  return i <= 0 ? (p.startsWith('/') ? '/' : '.') : p.slice(0, i);
}

export function basename(p, ext) {
  let b = p.replace(/\/+$/, '').split('/').pop() || '';
  if (ext && b.endsWith(ext)) b = b.slice(0, -ext.length);
  return b;
}

export function extname(p) {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  return i <= 0 ? '' : b.slice(i);
}

export function relative(from, to) {
  const f = normalize(from).split('/').filter(Boolean);
  const t = normalize(to).split('/').filter(Boolean);
  let i = 0;
  while (i < f.length && i < t.length && f[i] === t[i]) i++;
  return [...f.slice(i).map(() => '..'), ...t.slice(i)].join('/');
}

export function resolve(...parts) {
  let out = '';
  for (const p of parts) {
    if (!p) continue;
    out = p.startsWith('/') ? p : `${out}/${p}`;
  }
  return normalize(out || '/');
}

export function isAbsolute(p) {
  return p.startsWith('/');
}

export const sep = '/';
export const posix = { join, normalize, dirname, basename, extname, relative, resolve, isAbsolute, sep };

export default posix;
