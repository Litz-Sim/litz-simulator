import { describe, expect, it } from 'vitest';
import {
	APP_CACHE_PREFIX,
	RUNTIME_CACHE,
	SHELL,
	fingerprint,
	isFirmwarePath,
	precachePaths,
	staleAppCaches
} from './cachePlan';

describe('service worker cache plan', () => {
	it('precaches the build assets and the shell once', () => {
		const paths = precachePaths([
			'/_app/immutable/entry/start.abc.js',
			'/_app/immutable/nodes/0.def.js'
		]);
		expect(paths).toEqual([
			'/_app/immutable/entry/start.abc.js',
			'/_app/immutable/nodes/0.def.js',
			SHELL
		]);
	});

	it('does not list the shell twice', () => {
		expect(precachePaths([SHELL, SHELL])).toEqual([SHELL]);
	});

	it('recognises the on-demand firmware directory', () => {
		expect(isFirmwarePath('/firmware/micropython-esp32c3.bin')).toBe(true);
		expect(isFirmwarePath('/base/firmware/esp32c3-rom.elf')).toBe(true);
		expect(isFirmwarePath('/favicon.ico')).toBe(false);
		expect(isFirmwarePath('/firmwarex/thing')).toBe(false);
	});

	it('gives a new build a different cache name', () => {
		const before = fingerprint('/_app/immutable/entry/start.abc.js');
		const after = fingerprint('/_app/immutable/entry/start.def.js');
		expect(before).not.toBe(after);
		expect(fingerprint('/_app/immutable/entry/start.abc.js')).toBe(before);
	});

	it('drops older app caches but keeps the runtime firmware cache', () => {
		const keys = [`${APP_CACHE_PREFIX}old`, `${APP_CACHE_PREFIX}now`, RUNTIME_CACHE, 'other'];
		expect(staleAppCaches(keys, 'now')).toEqual([`${APP_CACHE_PREFIX}old`]);
	});
});
