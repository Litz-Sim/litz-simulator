import { immutable } from '$app/manifest';
import { self } from '$app/service-worker';
import {
	APP_CACHE_PREFIX,
	RUNTIME_CACHE,
	SHELL,
	fingerprint,
	isFirmwarePath,
	precachePaths,
	staleAppCaches
} from '#lib/sw/cachePlan';

// The build id comes from the content-hashed asset list, so a deploy always
// lands in a new cache and an old one can never answer for it.
const IMMUTABLE = immutable.map((asset) => asset.path);
const BUILD = fingerprint(IMMUTABLE.join('\n'));
const APP = APP_CACHE_PREFIX + BUILD;
const PRECACHE = precachePaths(IMMUTABLE);
const HASHED = new Set(IMMUTABLE);

self.addEventListener('install', (event) => {
	// No skipWaiting: the page already open keeps the chunks it loaded, and the
	// next launch activates this build. Navigations are network-first either way,
	// so a reload picks up a new deploy even while this one waits.
	event.waitUntil(caches.open(APP).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(staleAppCaches(keys, BUILD).map((key) => caches.delete(key)));
		})()
	);
});

async function cacheFirst(name: string, request: Request): Promise<Response> {
	const cache = await caches.open(name);
	const cached = await cache.match(request);
	if (cached) return cached;
	const response = await fetch(request);
	if (response.ok) await cache.put(request, response.clone());
	return response;
}

async function staleWhileRevalidate(name: string, request: Request): Promise<Response> {
	let cache: Cache | undefined;
	try {
		cache = await caches.open(name);
		const cached = await cache.match(request);
		if (cached) {
			// Refresh in the background; the cached copy answers immediately.
			void fetch(request)
				.then((response) => (response.ok ? cache?.put(request, response.clone()) : undefined))
				.catch(() => undefined);
			return cached;
		}
	} catch {
		cache = undefined;
	}
	const response = await fetch(request);
	if (response.ok && cache) await cache.put(request, response.clone());
	return response;
}

/** The document is always asked for first; the cached shell only covers offline. */
async function navigation(request: Request): Promise<Response> {
	const cache = await caches.open(APP);
	try {
		const response = await fetch(request);
		if (response.ok) await cache.put(SHELL, response.clone());
		return response;
	} catch {
		const shell = await cache.match(SHELL);
		if (shell) return shell;
		return Response.error();
	}
}

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;
	// Ranged reads cannot be served from a cached full response.
	if (request.headers.has('range')) return;

	if (request.mode === 'navigate') {
		event.respondWith(navigation(request));
		return;
	}

	if (isFirmwarePath(url.pathname)) {
		event.respondWith(staleWhileRevalidate(RUNTIME_CACHE, request));
		return;
	}

	if (HASHED.has(url.pathname)) {
		event.respondWith(cacheFirst(APP, request));
		return;
	}

	event.respondWith(staleWhileRevalidate(APP, request));
});
