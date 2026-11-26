import { describe, expect, it } from 'vitest';
import { parseAttach } from './attach';

describe('parseAttach', () => {
	it('reads the URL the CLI prints', () => {
		expect(parseAttach('ws://127.0.0.1:4317/ws#ABCD-EF01-2345-6789')).toEqual({
			url: 'ws://127.0.0.1:4317/ws',
			token: 'ABCD-EF01-2345-6789'
		});
	});

	it('accepts an http address and turns it into the socket route', () => {
		expect(parseAttach('http://127.0.0.1:4317/#ABCD')).toEqual({
			url: 'ws://127.0.0.1:4317/ws',
			token: 'ABCD'
		});
	});

	it('reads a token from the query string', () => {
		expect(parseAttach('ws://127.0.0.1:4317/ws?token=ABCD')).toEqual({
			url: 'ws://127.0.0.1:4317/ws',
			token: 'ABCD'
		});
	});

	it('refuses text without a token', () => {
		expect(parseAttach('ws://127.0.0.1:4317/ws')).toBeNull();
		expect(parseAttach('')).toBeNull();
		expect(parseAttach('https://example.com/litz')).toBeNull();
	});

	it('keeps the fragment out of the socket URL', () => {
		const parsed = parseAttach('wss://127.0.0.1:4317/ws#CODE');
		expect(parsed?.url).not.toContain('#');
		expect(parsed?.url).not.toContain('CODE');
	});

	it('reads a code printed on the line below the address', () => {
		expect(
			parseAttach(
				'litz: editor link ws://127.0.0.1:4317/ws\nlitz: pairing code B82E-4414-23F7-48D9'
			)
		).toEqual({
			url: 'ws://127.0.0.1:4317/ws',
			token: 'B82E-4414-23F7-48D9'
		});
	});

	it('reads a code that follows the address on the same line', () => {
		expect(parseAttach('ws://127.0.0.1:4317/ws B82E-4414-23F7-48D9')).toEqual({
			url: 'ws://127.0.0.1:4317/ws',
			token: 'B82E-4414-23F7-48D9'
		});
	});
});
