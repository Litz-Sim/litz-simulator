/**
 * Files a host puts on a storage part.
 *
 * The document keeps them as base64 so a project file stays JSON and a binary
 * blob survives the round trip. The engine wants bytes, and the sidebar wants
 * to know which files are text it can edit.
 */

import type { VolumeFile } from '#lib/sketch/types';

export interface VolumeEntry {
	path: string;
	data: Uint8Array;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 without `btoa`, so the same code runs under the test runner. */
export function bytesToBase64(bytes: Uint8Array): string {
	let out = '';
	for (let index = 0; index < bytes.length; index += 3) {
		const a = bytes[index] ?? 0;
		const b = bytes[index + 1] ?? 0;
		const c = bytes[index + 2] ?? 0;
		const triple = (a << 16) | (b << 8) | c;
		out += ALPHABET[(triple >> 18) & 63];
		out += ALPHABET[(triple >> 12) & 63];
		out += index + 1 < bytes.length ? ALPHABET[(triple >> 6) & 63] : '=';
		out += index + 2 < bytes.length ? ALPHABET[triple & 63] : '=';
	}
	return out;
}

export function base64ToBytes(text: string): Uint8Array {
	const clean = text.replace(/[\s=]/g, '');
	const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
	let byte = 0;
	let buffer = 0;
	let bits = 0;
	for (const char of clean) {
		const value = ALPHABET.indexOf(char);
		if (value < 0) continue;
		buffer = (buffer << 6) | value;
		bits += 6;
		if (bits >= 8) {
			bits -= 8;
			out[byte++] = (buffer >> bits) & 0xff;
		}
	}
	return out.slice(0, byte);
}

/** The text a UTF-8 file holds, or null when it is not text. */
export function decodeText(bytes: Uint8Array): string | null {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return null;
	}
}

export function encodeText(text: string): string {
	return bytesToBase64(new TextEncoder().encode(text));
}

export function volumeEntries(files: VolumeFile[]): VolumeEntry[] {
	return files.map((file) => ({ path: file.path, data: base64ToBytes(file.data) }));
}

export function volumeFiles(entries: { path: string; data: Uint8Array }[]): VolumeFile[] {
	return entries.map((entry) => ({ path: entry.path, data: bytesToBase64(entry.data) }));
}

/** A byte count in the units a card label uses. */
export function formatBytes(size: number): string {
	if (size >= 1024 * 1024 * 1024) return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
	if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(0)} MB`;
	if (size >= 1024) return `${(size / 1024).toFixed(0)} KB`;
	return `${size} B`;
}
