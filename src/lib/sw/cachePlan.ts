/**
 * Cache names and build id for the service worker.
 *
 * The app cache is keyed by a fingerprint of the build's own asset list, so
 * every deploy installs under a new name and cannot be served from the previous
 * deploy's cache. Nothing here is a hand-written version that someone has to
 * remember to bump.
 */
export const APP_CACHE_PREFIX = 'litz-app-';

/** Big files downloaded on demand (the Python images, the mask ROMs). */
export const RUNTIME_CACHE = 'litz-runtime';

/** SPA fallback page, served when a navigation request cannot reach the network. */
export const SHELL = '/index.html';

/** Files under this path are megabytes; they are cached when first used, never up front. */
export function isFirmwarePath(pathname: string): boolean {
	return pathname.includes('/firmware/');
}

/** Build assets plus the shell. Everything else is cached as it is used. */
export function precachePaths(immutable: readonly string[]): string[] {
	return [...new Set([...immutable, SHELL])];
}

/** A stable id for this build: FNV-1a over the hashed asset list. */
export function fingerprint(input: string): string {
	let a = 0x811c9dc5;
	let b = 0x01000193;
	for (let i = 0; i < input.length; i += 1) {
		const code = input.charCodeAt(i);
		a = Math.imul(a ^ code, 0x01000193) >>> 0;
		b = Math.imul(b ^ (code + i), 0x811c9dc5) >>> 0;
	}
	return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

/** Older app caches to delete once this build activates. The runtime cache is kept. */
export function staleAppCaches(keys: readonly string[], build: string): string[] {
	const current = APP_CACHE_PREFIX + build;
	return keys.filter((key) => key.startsWith(APP_CACHE_PREFIX) && key !== current);
}
