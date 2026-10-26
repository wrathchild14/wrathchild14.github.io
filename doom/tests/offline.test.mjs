import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const workerSource = await readFile(new URL('sw.js', root), 'utf8');
const assetSource = await readFile(new URL('offline-assets.js', root), 'utf8');

function worker({ failDownload = false } = {}) {
    const handlers = new Map();
    const stores = new Map();
    const requests = [];
    const key = (value, ignoreSearch = false) => {
        const url = new URL(typeof value === 'string' ? value : value.url);
        if (ignoreSearch) url.search = '';
        return url.href;
    };
    const caches = {
        async open(name) {
            if (!stores.has(name)) stores.set(name, new Map());
            const entries = stores.get(name);
            return {
                async addAll(urls) {
                    if (failDownload) throw new Error('Download interrupted');
                    for (const url of urls) {
                        requests.push(url.url);
                        entries.set(key(url), new Response('cached asset'));
                    }
                },
                async match(url, options = {}) {
                    return entries.get(key(url, options.ignoreSearch))?.clone();
                },
                async put(url, response) {
                    entries.set(key(url), response);
                },
            };
        },
        async keys() {
            return [...stores.keys()];
        },
        async delete(name) {
            return stores.delete(name);
        },
    };
    const self = {
        location: { href: 'https://example.test/doom/sw.js' },
        clients: { claim: async () => {} },
        addEventListener: (name, handler) => handlers.set(name, handler),
    };
    const context = vm.createContext({ self, caches, URL, Request, Response, Headers, console });
    context.importScripts = () => vm.runInContext(assetSource, context);
    context.fetch = async () => {
        throw new Error('Network offline');
    };
    vm.runInContext(workerSource, context);
    return {
        context,
        self,
        caches,
        stores,
        requests,
        async lifecycle(name) {
            let result;
            handlers.get(name)({
                waitUntil: (promise) => {
                    result = promise;
                },
            });
            return result;
        },
        request(path, headers = {}) {
            let response;
            handlers.get('fetch')({
                request: new Request(new URL(path, self.location.href), { headers }),
                respondWith: (promise) => {
                    response = promise;
                },
            });
            return response;
        },
    };
}

test('offline release includes every shipped module and matches their content hash', async () => {
    const instance = worker();
    const assets = instance.self.OFFLINE_ASSETS;
    const hash = createHash('sha256');
    for (const file of [...assets, 'sw.js']) {
        hash.update(file);
        hash.update(await readFile(new URL(file, root)));
    }
    assert.equal(
        instance.self.OFFLINE_VERSION,
        hash.digest('hex').slice(0, 16),
        'Run node doom/scripts/update-offline.mjs after editing game assets',
    );
    for (const file of assets.filter((file) => file.endsWith('.js') && file.startsWith('game/'))) {
        const source = await readFile(new URL(file, root), 'utf8');
        for (const [, relative] of source.matchAll(/from ['"](.+?)['"]/g)) {
            const dependency = new URL(relative, new URL(file, root));
            const path = decodeURIComponent(dependency.pathname.slice(root.pathname.length));
            assert.ok(assets.includes(path), `Missing offline module: ${path}`);
        }
    }
    const model = JSON.parse(await readFile(new URL('common/models/1level/1level.gltf', root)));
    for (const asset of [...model.buffers, ...model.images]) {
        if (asset.uri) assert.ok(assets.includes(`common/models/1level/${asset.uri}`));
    }
    assert.ok(assets.includes('common/models/1level/Rip & Off.mp3'));
});

test('first installation precaches the complete release and serves offline navigation', async () => {
    const instance = worker();
    await instance.lifecycle('install');
    assert.equal(instance.requests.length, instance.self.OFFLINE_ASSETS.length);
    const response = await instance.request('./index.html?source=installed');
    assert.equal(await response.text(), 'cached asset');
    const directory = await instance.request('/doom/');
    assert.equal(await directory.text(), 'cached asset');
    const module = await instance.request('./game/engine/PostProcessing.js');
    assert.equal(module.status, 200);
});

test('failed download removes incomplete cache and preserves the previous release', async () => {
    const instance = worker({ failDownload: true });
    await instance.caches.open('rip-and-off-previous');
    await assert.rejects(instance.lifecycle('install'), /interrupted/);
    assert.deepEqual(await instance.caches.keys(), ['rip-and-off-previous']);
});

test('activation cleans only obsolete game caches and never forces a live update', async () => {
    const instance = worker();
    await instance.caches.open('rip-and-off-previous');
    await instance.caches.open('another-project');
    await instance.lifecycle('install');
    await instance.lifecycle('activate');
    assert.deepEqual(
        (await instance.caches.keys()).sort(),
        ['another-project', `rip-and-off-${instance.self.OFFLINE_VERSION}`].sort(),
    );
    assert.ok(!workerSource.includes('self.skipWaiting('));
});

test('offline soundtrack supports byte ranges, suffix ranges, and invalid ranges', async () => {
    const instance = worker();
    await instance.lifecycle('install');
    const cache = await instance.caches.open(`rip-and-off-${instance.self.OFFLINE_VERSION}`);
    const url = 'https://example.test/doom/common/models/1level/Rip%20%26%20Off.mp3';
    await cache.put(url, new Response('0123456789', { headers: { 'Content-Type': 'audio/mpeg' } }));
    const part = await instance.request(url, { Range: 'bytes=2-5' });
    assert.equal(part.status, 206);
    assert.equal(part.headers.get('Content-Range'), 'bytes 2-5/10');
    assert.equal(await part.text(), '2345');
    const suffix = await instance.request(url, { Range: 'bytes=-3' });
    assert.equal(await suffix.text(), '789');
    const invalid = await instance.request(url, { Range: 'bytes=100-' });
    assert.equal(invalid.status, 416);
});

test('the game worker does not intercept the portfolio, other origins, or itself', () => {
    const instance = worker();
    assert.equal(instance.request('/index.html'), undefined);
    assert.equal(instance.request('https://outside.test/doom/game.js'), undefined);
    assert.equal(instance.request('./sw.js'), undefined);
    assert.equal(instance.request('./offline-assets.js'), undefined);
});

test('the app manifest has a scoped entry point and real PNG install icons', async () => {
    const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', root)));
    assert.equal(manifest.scope, './');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.id, './');
    assert.ok(manifest.start_url.startsWith('./index.html'));
    for (const icon of manifest.icons) {
        const bytes = await readFile(new URL(icon.src, root));
        assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
        const size = Number(icon.sizes.split('x')[0]);
        assert.equal(bytes.readUInt32BE(16), size);
        assert.equal(bytes.readUInt32BE(20), size);
    }
});
