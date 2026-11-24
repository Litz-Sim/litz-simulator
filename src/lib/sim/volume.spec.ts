import { describe, expect, it } from 'vitest';
import {
	base64ToBytes,
	bytesToBase64,
	decodeText,
	encodeText,
	formatBytes,
	volumeEntries,
	volumeFiles
} from './volume';

describe('volume files', () => {
	it('round-trips bytes of every length through base64', () => {
		for (let length = 0; length <= 9; length += 1) {
			const bytes = Uint8Array.from({ length }, (_, index) => (index * 37 + length) & 0xff);
			expect([...base64ToBytes(bytesToBase64(bytes))]).toEqual([...bytes]);
		}
	});

	it('matches the platform encoder for a binary blob', () => {
		const bytes = Uint8Array.from([0, 1, 2, 250, 251, 252, 253, 254, 255]);
		expect(bytesToBase64(bytes)).toBe(btoa(String.fromCharCode(...bytes)));
	});

	it('decodes UTF-8 text and refuses a binary file', () => {
		expect(decodeText(new TextEncoder().encode('boot.py\r\n'))).toBe('boot.py\r\n');
		expect(decodeText(Uint8Array.from([0xff, 0xfe, 0x00]))).toBeNull();
	});

	it('round-trips the document form in both directions', () => {
		const files = [
			{ path: 'boot.py', data: encodeText('print(1)\n') },
			{ path: 'data/blob.bin', data: bytesToBase64(Uint8Array.from([0, 8, 255])) }
		];
		const entries = volumeEntries(files);
		expect(entries.map((entry) => entry.path)).toEqual(['boot.py', 'data/blob.bin']);
		expect(decodeText(entries[0].data)).toBe('print(1)\n');
		expect(volumeFiles(entries)).toEqual(files);
	});

	it('formats capacity the way a card is sold', () => {
		expect(formatBytes(512 * 1024)).toBe('512 KB');
		expect(formatBytes(4 * 1024 * 1024)).toBe('4 MB');
		expect(formatBytes(32 * 1024 * 1024)).toBe('32 MB');
	});
});
