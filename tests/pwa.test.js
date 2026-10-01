// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import vm from 'node:vm';
import { Config } from '../js/Config.js';

const root = join(import.meta.dirname, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

/**
 * Reads the pixel size from a PNG's IHDR chunk.
 * @param {string} path
 * @returns {string} e.g. '192x192'
 */
function pngSize(path) {
  const bytes = readFileSync(join(root, path));
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

/**
 * Lists files under a directory, relative to the repo root.
 * @param {string} dir
 * @returns {string[]}
 */
function listFiles(dir) {
  return readdirSync(join(root, dir), { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => relative(root, join(entry.parentPath, entry.name)));
}

describe('manifest', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));

  it('has the fields Chrome requires to offer install', () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe('standalone');
  });

  it('declares 192px, 512px and maskable icons', () => {
    const icon = (sizes, purpose) => manifest.icons.find(i => i.sizes === sizes && i.purpose === purpose);
    expect(icon('192x192', 'any')).toBeDefined();
    expect(icon('512x512', 'any')).toBeDefined();
    expect(icon('512x512', 'maskable')).toBeDefined();
  });

  it('points at icon files of the declared size', () => {
    for (const icon of manifest.icons) {
      expect(pngSize(icon.src), icon.src).toBe(icon.sizes);
    }
  });
});

describe('index.html', () => {
  const html = read('index.html');

  it('links the manifest and icons, and the files exist', () => {
    for (const rel of ['manifest', 'icon', 'apple-touch-icon']) {
      const match = html.match(new RegExp(`<link rel="${rel}" href="([^"]+)"`));
      expect(match, rel).not.toBeNull();
      expect(existsSync(join(root, match[1])), match[1]).toBe(true);
    }
    expect(pngSize('icons/apple-touch-icon.png')).toBe('180x180');
  });
});

describe('service worker', () => {
  const ORIGIN = 'https://example.com';
  let listeners;
  let context;
  let cache;

  beforeEach(() => {
    listeners = {};
    cache = {
      match: vi.fn(async () => undefined),
      put: vi.fn(async () => {})
    };
    context = vm.createContext({
      self: {
        location: new URL(`${ORIGIN}/sw.js`),
        addEventListener: (type, listener) => { listeners[type] = listener; }
      },
      caches: {
        open: vi.fn(async () => cache),
        match: vi.fn(async () => undefined)
      },
      fetch: vi.fn(async () => new Response('network')),
      URL,
      Request,
      console
    });
    vm.runInContext(read('sw.js'), context);
  });

  /**
   * Dispatches a fake fetch event to the worker.
   * @returns {{respondWith: Function, waitUntil: Function}}
   */
  function dispatchFetch(url, { method = 'GET', mode = 'cors' } = {}) {
    const event = {
      request: { url, method, mode },
      respondWith: vi.fn(),
      waitUntil: vi.fn()
    };
    listeners.fetch(event);
    return event;
  }

  it('never answers a speed-test download from cache', () => {
    const event = dispatchFetch(`${Config.speedTest.testUrl}?_t=${Date.now()}`);
    expect(event.respondWith).not.toHaveBeenCalled();
  });

  it('leaves map tiles to the network', () => {
    const event = dispatchFetch('https://a.tile.openstreetmap.org/13/1309/3166.png', { mode: 'no-cors' });
    expect(event.respondWith).not.toHaveBeenCalled();
  });

  it('ignores non-GET requests', () => {
    const event = dispatchFetch(`${ORIGIN}/js/app.js`, { method: 'POST' });
    expect(event.respondWith).not.toHaveBeenCalled();
  });

  it('serves a cached app file and refreshes it in the background', async () => {
    const url = `${ORIGIN}/js/app.js`;
    cache.match.mockResolvedValue(new Response('cached'));

    const event = dispatchFetch(url);
    const response = await event.respondWith.mock.calls[0][0];
    expect(await response.text()).toBe('cached');

    await event.waitUntil.mock.calls[0][0];
    expect(context.fetch).toHaveBeenCalledWith(url, { cache: 'no-cache' });
    expect(cache.put).toHaveBeenCalledWith(url, expect.any(Response));
  });

  it('falls back to the network when an app file is not cached', async () => {
    const event = dispatchFetch(`${ORIGIN}/js/app.js`);
    const response = await event.respondWith.mock.calls[0][0];
    expect(await response.text()).toBe('network');
  });

  it('serves the cached app page for navigations, whatever the query string', async () => {
    cache.match.mockResolvedValue(new Response('page'));

    const event = dispatchFetch(`${ORIGIN}/?source=homescreen`, { mode: 'navigate' });
    const response = await event.respondWith.mock.calls[0][0];

    expect(await response.text()).toBe('page');
    expect(cache.match).toHaveBeenCalledWith(`${ORIGIN}/`);
  });

  it('precaches every script, stylesheet and icon', () => {
    const shell = vm.runInContext('APP_SHELL', context);
    for (const file of [...listFiles('js'), ...listFiles('css'), ...listFiles('icons')]) {
      expect(shell, `${file} is missing from APP_SHELL in sw.js`).toContain(file);
    }
  });

  it('precaches only files that exist', () => {
    const shell = vm.runInContext('APP_SHELL', context);
    for (const path of shell) {
      const file = path === './' ? 'index.html' : path;
      expect(existsSync(join(root, file)), file).toBe(true);
    }
  });

  it('precaches exactly the CDN URLs index.html loads', () => {
    const html = read('index.html');
    const loaded = [...html.matchAll(/(?:href|src)="(https:\/\/[^"]+)"/g)].map(match => match[1]);
    expect(vm.runInContext('CDN_ASSETS', context)).toEqual(loaded);
  });
});
