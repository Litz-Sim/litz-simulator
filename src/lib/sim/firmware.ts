import { asset } from '$app/paths';
import type { FirmwareRef, RuntimeMode } from '#lib/sketch/types';
import { m } from '#lib/paraglide/messages.js';

export interface BundledFirmware {
	name: string;
	url: string;
	rom?: { name: string; url: string };
}

/** One image per chip for the editor's own C/C++ fixtures. */
export const NATIVE_FIRMWARE: Record<string, BundledFirmware> = {
	esp32c3: { name: 'blinky.bin', url: asset('firmware/blinky.bin') },
	atmega328p: { name: 'uno-blink.hex', url: asset('firmware/uno-blink.hex') },
	rp2040: { name: 'pico-blink.bin', url: asset('firmware/pico-blink.bin') }
};

/**
 * Stock Python interpreters shipped with the editor.
 *
 * Both ESP32-C3 runtimes are paired with the chip's Mask ROM. The RP2040 runs
 * MicroPython from its own flash; the engine's flash helpers accept writes, so
 * `main.py` survives and runs.
 */
export const PYTHON_FIRMWARE: Record<
	string,
	Partial<Record<Exclude<RuntimeMode, 'native'>, BundledFirmware>>
> = {
	esp32c3: {
		micropython: {
			name: 'micropython-esp32c3.bin',
			url: asset('firmware/micropython-esp32c3.bin'),
			rom: { name: 'esp32c3-rom.elf', url: asset('firmware/esp32c3-rom.elf') }
		},
		circuitpython: {
			name: 'circuitpython-esp32c3.bin',
			url: asset('firmware/circuitpython-esp32c3.bin'),
			rom: { name: 'esp32c3-rom.elf', url: asset('firmware/esp32c3-rom.elf') }
		}
	},
	rp2040: {
		micropython: {
			name: 'micropython-rp2040.bin',
			url: asset('firmware/micropython-rp2040.bin')
		}
	}
};

export function bundledFirmware(
	chip: string | null,
	runtime: RuntimeMode
): BundledFirmware | undefined {
	if (!chip) return undefined;
	if (runtime === 'native') return NATIVE_FIRMWARE[chip];
	return PYTHON_FIRMWARE[chip]?.[runtime];
}

const bundledBytes = new Map<string, Promise<Uint8Array>>();

export function loadBundled(image: BundledFirmware): Promise<Uint8Array> {
	return loadUrl(image.url);
}

export function loadBundledRom(image: BundledFirmware): Promise<Uint8Array> | undefined {
	return image.rom ? loadUrl(image.rom.url) : undefined;
}

function loadUrl(url: string): Promise<Uint8Array> {
	let pending = bundledBytes.get(url);
	if (!pending) {
		pending = fetch(url)
			.then(async (response) => {
				if (!response.ok) throw new Error(m.error_firmware_http({ status: response.status }));
				return new Uint8Array(await response.arrayBuffer());
			})
			.catch((error: unknown) => {
				bundledBytes.delete(url);
				throw error;
			});
		bundledBytes.set(url, pending);
	}
	return pending;
}

const DB_NAME = 'litz-firmware';
const STORE = 'images';
const memory = new Map<string, ArrayBuffer>();

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (typeof indexedDB === 'undefined') {
			reject(new Error(m.error_firmware_cache_unavailable()));
			return;
		}
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(STORE)) {
				request.result.createObjectStore(STORE);
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error(m.error_firmware_cache_unavailable()));
	});
}

function fallbackKey(buffer: ArrayBuffer): string {
	let hash = 0x811c9dc5;
	const bytes = new Uint8Array(buffer);
	for (const byte of bytes) {
		hash ^= byte;
		hash = Math.imul(hash, 0x01000193);
	}
	return `fnv-${(hash >>> 0).toString(16)}-${buffer.byteLength}`;
}

async function digestKey(buffer: ArrayBuffer): Promise<string> {
	if (typeof crypto !== 'undefined' && crypto.subtle) {
		try {
			const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
			return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
		} catch {
			// Insecure contexts have no SubtleCrypto; the filename still pins it.
		}
	}
	return fallbackKey(buffer);
}

/** Copy an uploaded image into the browser cache and return its project reference. */
export async function cacheFirmware(file: File): Promise<FirmwareRef> {
	const buffer = await file.arrayBuffer();
	const key = await digestKey(buffer);
	memory.set(key, buffer);
	try {
		const database = await openDatabase();
		await new Promise<void>((resolve, reject) => {
			const transaction = database.transaction(STORE, 'readwrite');
			transaction.objectStore(STORE).put(buffer, key);
			transaction.oncomplete = () => resolve();
			transaction.onerror = () =>
				reject(transaction.error ?? new Error(m.error_firmware_cache_unavailable()));
			transaction.onabort = () =>
				reject(transaction.error ?? new Error(m.error_firmware_cache_unavailable()));
		});
		database.close();
	} catch {
		// The in-memory copy still works for this tab; the project keeps only the ref.
	}
	return { name: file.name, key };
}

/** Read a cached image, following the project reference. */
export async function readFirmware(ref: FirmwareRef): Promise<Uint8Array> {
	const cached = memory.get(ref.key);
	if (cached) return new Uint8Array(cached.slice(0));
	try {
		const database = await openDatabase();
		const buffer = await new Promise<ArrayBuffer | undefined>((resolve, reject) => {
			const transaction = database.transaction(STORE, 'readonly');
			const request = transaction.objectStore(STORE).get(ref.key);
			request.onsuccess = () => resolve(request.result as ArrayBuffer | undefined);
			request.onerror = () =>
				reject(request.error ?? new Error(m.error_firmware_cache_unavailable()));
		});
		database.close();
		if (!buffer) throw new Error(m.error_firmware_missing({ name: ref.name }));
		memory.set(ref.key, buffer);
		return new Uint8Array(buffer.slice(0));
	} catch (error) {
		if (error instanceof Error && error.message === m.error_firmware_missing({ name: ref.name })) {
			throw error;
		}
		throw new Error(m.error_firmware_missing({ name: ref.name }), { cause: error });
	}
}
