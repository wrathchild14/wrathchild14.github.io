// Generated asset list + content hash. Regenerate after changing game files.
importScripts('./offline-assets.js');

const CACHE_PREFIX = 'rip-and-off-';
const CACHE_NAME = CACHE_PREFIX + self.OFFLINE_VERSION;
const scope = new URL('./', self.location.href);
const assetURLs = self.OFFLINE_ASSETS.map((path) => new URL(path, scope).href);

self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            try {
                // All-or-nothing: never announce offline readiness for a partial game.
                await cache.addAll(assetURLs.map((url) => new Request(url, { cache: 'reload' })));
            } catch (error) {
                await caches.delete(CACHE_NAME);
                throw error;
            }
        })(),
    );
    // Do not skipWaiting: an update must not replace modules during a live run.
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const names = await caches.keys();
            await Promise.all(
                names
                    .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
                    .map((name) => caches.delete(name)),
            );
            await self.clients.claim();
        })(),
    );
});

async function rangedResponse(response, range) {
    // Browsers request audio in byte ranges, even when the complete file is cached.
    const bytes = await response.arrayBuffer();
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const size = bytes.byteLength;
    let start = match?.[1] ? Number(match[1]) : 0;
    let end = match?.[2] ? Number(match[2]) : size - 1;
    if (match && !match[1] && match[2]) {
        start = Math.max(0, size - Number(match[2]));
        end = size - 1;
    }
    if (
        !match ||
        (!match[1] && !match[2]) ||
        start > end ||
        start >= size ||
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end)
    ) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    }
    end = Math.min(end, size - 1);
    const headers = new Headers(response.headers);
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    headers.set('Content-Length', String(end - start + 1));
    headers.set('Accept-Ranges', 'bytes');
    return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}

async function respond(request) {
    const cache = await caches.open(CACHE_NAME);
    const url = new URL(request.url);
    if (url.pathname === scope.pathname) url.pathname += 'index.html';
    const saved = await cache.match(url.href, { ignoreSearch: true });
    if (saved) {
        const range = request.headers.get('Range');
        return range ? rangedResponse(saved, range) : saved;
    }
    return fetch(request);
}

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (
        event.request.method !== 'GET' ||
        url.origin !== scope.origin ||
        !url.pathname.startsWith(scope.pathname)
    )
        return;
    if (url.pathname.endsWith('/sw.js') || url.pathname.endsWith('/offline-assets.js')) return;
    event.respondWith(respond(event.request));
});
