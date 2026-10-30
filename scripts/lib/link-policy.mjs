// Network destinations are code-owned, not selected by the HTML/config being checked.
export const DOWNLOAD_ORIGINS = Object.freeze(['https://download.openworldclock.com']);
export function httpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port ? url : null;
  } catch { return null; }
}
export function linkPolicy(repo, downloadBase, downloadOrigins = DOWNLOAD_ORIGINS) {
  const repoPath = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo || '') ? '/' + repo.toLowerCase() : null;
  const download = httpsUrl(downloadBase);
  const downloadOrigin = download && downloadOrigins.includes(download.origin) && !download.search && !download.hash ? download.origin : null;
  const downloadPath = downloadOrigin ? download.pathname.replace(/\/+$/, '') + '/' : null;
  return value => {
    const url = httpsUrl(value);
    if (!url) return false;
    if (url.origin === 'https://apps.microsoft.com') return true;
    if (url.origin === 'https://github.com' && repoPath) {
      const path = url.pathname.toLowerCase();
      return path === repoPath || path.startsWith(repoPath + '/');
    }
    return !!downloadOrigin && url.origin === downloadOrigin && url.pathname.startsWith(downloadPath);
  };
}

// Redirects are checked before connecting, with bounded hops and HTTPS throughout.
export async function fetchChecked(fetchImpl, value, options, allowed, maxRedirects = 5) {
  let next = value;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (!allowed(next)) throw new Error('URL is outside the link-check destination policy');
    const response = await fetchImpl(next, { ...options, redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      if (response.url && !allowed(response.url)) {
        await response.body?.cancel();
        throw new Error('Response URL is outside the link-check destination policy');
      }
      return response;
    }
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location) throw new Error('Redirect has no Location');
    next = new URL(location, next).href;
  }
  throw new Error('Too many link-check redirects');
}
