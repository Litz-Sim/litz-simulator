#!/usr/bin/env node
// Pulls the stock Python interpreters and the ESP32 mask ROMs the editor runs.
//
// The images are big and MIT-licensed, so they stay out of git: this script
// writes them into `static/firmware/` and the build serves them from there.
// Every byte is pinned by SHA-256 rather than resolved from a "latest" URL, so
// a green run downloads the same interpreters tomorrow. A file that already
// matches its hash is kept and costs no network.
//
//   node scripts/fetch-firmware.mjs           fetch what is missing
//   node scripts/fetch-firmware.mjs --check   verify only, fail when incomplete
//
// The RP2040 builds ship as UF2 containers; the runner takes a flat QSPI dump
// from 0x1000_0000, so the payload blocks are copied out once into a `.bin`.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'static/firmware');
const CHECK = process.argv.includes('--check');

const MICROPYTHON = 'https://micropython.org/resources/firmware';
const CIRCUITPYTHON = 'https://downloads.circuitpython.org/bin';

// MicroPython v1.29.0 (2026-08-24) and CircuitPython 10.3.2 (2026-11-11).
const IMAGES = [
	{
		out: 'micropython-esp32c3.bin',
		url: `${MICROPYTHON}/ESP32_GENERIC_C3-20260824-v1.29.0.bin`,
		sha256: 'bf72ed9eb88ad3a8f49d02c3d371f9ea34c90a8a303aeb9e324d8efd4a2a655a'
	},
	{
		out: 'micropython-esp32c6.bin',
		url: `${MICROPYTHON}/ESP32_GENERIC_C6-20260824-v1.29.0.bin`,
		sha256: '3688ba4e2c3949e639f5772e99fdb0efa1258b162a496133f78c108434195c89'
	},
	{
		out: 'micropython-rp2040.bin',
		url: `${MICROPYTHON}/RPI_PICO-20260824-v1.29.0.uf2`,
		sha256: 'e1160e602e277d85920adb5fe741435edccba9ba6ecadc85fdab75252eeff4e9',
		uf2: true,
		binSha256: '7ddec240b08086c06f35cafef3268bf36ab9102091aee6aa23fa1b1eeeeaa8bc'
	},
	{
		out: 'circuitpython-esp32c3.bin',
		url: `${CIRCUITPYTHON}/espressif_esp32c3_devkitm_1_n4/en_US/adafruit-circuitpython-espressif_esp32c3_devkitm_1_n4-en_US-10.3.2.bin`,
		sha256: 'b23fa8a3439bb546c6877907950231a2b58dc0073072bf26b1f407595b665c8c'
	}
];

// The merged ESP images start in the mask ROM, so the chip's ROM is part of
// the runtime. The ELFs come from Espressif's pinned esp-rom-elfs release.
const ROM_RELEASE = '20260528';
const ROM_URL = `https://github.com/espressif/esp-rom-elfs/releases/download/${ROM_RELEASE}/esp-rom-elfs-${ROM_RELEASE}.tar.gz`;
const ROM_TARBALL_SHA = 'caa463d3cbef2430a5a35847c1d9f2f152403b17a802050927ff60c8da54fe46';
const ROMS = [
	{
		out: 'esp32c3-rom.elf',
		member: 'esp32c3_rev3_rom.elf',
		sha256: '19ac22e08707df926fb0cf4c54795d4067b983fae8635f396ded173a6d78fc3c'
	},
	{
		out: 'esp32c6-rom.elf',
		member: 'esp32c6_rev0_rom.elf',
		sha256: '788e1d38724aeb8fd974fa10c4a7b089c02627d35342ce84b9e0b12b239f3551'
	}
];

function digest(bytes) {
	return createHash('sha256').update(bytes).digest('hex');
}

function matches(path, sha256) {
	if (!existsSync(path)) return false;
	return digest(readFileSync(path)) === sha256;
}

async function download(url, sha256) {
	const response = await fetch(url, { signal: AbortSignal.timeout(180_000) });
	if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
	const bytes = Buffer.from(await response.arrayBuffer());
	if (digest(bytes) !== sha256) throw new Error(`${url}: SHA-256 mismatch`);
	return bytes;
}

// A UF2 is a container of 512-byte blocks: magic, target address, payload.
// The runner wants one flat image starting at 0x1000_0000.
function uf2ToBin(uf2) {
	const chunks = new Map();
	for (let offset = 0; offset + 512 <= uf2.length; offset += 512) {
		const magic0 = uf2.readUInt32LE(offset);
		const magic1 = uf2.readUInt32LE(offset + 4);
		if (magic0 !== 0x0a324655 || magic1 !== 0x9e5d5157) continue; // Not a UF2 block.
		const address = uf2.readUInt32LE(offset + 12);
		const size = uf2.readUInt32LE(offset + 16);
		if (size > 476) throw new Error(`UF2 block at ${offset} claims ${size} bytes`);
		chunks.set(address, uf2.subarray(offset + 32, offset + 32 + size));
	}
	if (chunks.size === 0) throw new Error('UF2 has no data blocks');
	const low = Math.min(...chunks.keys());
	let high = 0;
	for (const [address, payload] of chunks) high = Math.max(high, address + payload.length);
	const image = Buffer.alloc(high - low);
	for (const [address, payload] of chunks) payload.copy(image, address - low);
	return image;
}

function untar(buffer) {
	const files = new Map();
	let offset = 0;
	while (offset + 512 <= buffer.length) {
		const header = buffer.subarray(offset, offset + 512);
		if (header.every((byte) => byte === 0)) break;
		const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
		const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
		const size = Number.parseInt(header.subarray(124, 136).toString('ascii').trim(), 8) || 0;
		const path = prefix ? `${prefix}/${name}` : name;
		const start = offset + 512;
		files.set(path, buffer.subarray(start, start + size));
		offset = start + Math.ceil(size / 512) * 512;
	}
	return files;
}

async function fetchImages() {
	const missing = [];
	for (const image of IMAGES) {
		const path = join(OUT, image.out);
		const sha = image.uf2 ? image.binSha256 : image.sha256;
		if (matches(path, sha)) {
			console.log(`  ${image.out}: present`);
			continue;
		}
		if (CHECK) {
			console.error(`${image.out}: missing or stale`);
			missing.push(image.out);
			continue;
		}
		const bytes = await download(image.url, image.sha256);
		const payload = image.uf2 ? uf2ToBin(bytes) : bytes;
		const payloadSha = image.uf2 ? image.binSha256 : image.sha256;
		if (digest(payload) !== payloadSha) throw new Error(`${image.out}: image hash mismatch`);
		await writeFile(path, payload);
		console.log(`  ${image.out}: fetched`);
	}
	return missing;
}

async function fetchRoms() {
	const missing = [];
	const needed = new Set();
	for (const rom of ROMS) {
		if (matches(join(OUT, rom.out), rom.sha256)) {
			console.log(`  ${rom.out}: present`);
			continue;
		}
		const path = join(OUT, rom.out);
		if (existsSync(path)) {
			console.error(`${rom.out}: hash does not match the pinned ROM`);
		} else {
			console.error(`${rom.out}: missing`);
		}
		missing.push(rom.out);
		needed.add(rom.member);
	}
	if (CHECK || needed.size === 0) return missing;

	const tarball = await download(ROM_URL, ROM_TARBALL_SHA);
	const entries = untar(gunzipSync(tarball));
	for (const rom of ROMS) {
		if (!needed.has(rom.member)) continue;
		const entry = [...entries.entries()].find(([name]) => name.endsWith(rom.member))?.[1];
		if (!entry) throw new Error(`${rom.member} is not in esp-rom-elfs ${ROM_RELEASE}`);
		if (digest(entry) !== rom.sha256) throw new Error(`${rom.out}: SHA-256 mismatch`);
		await writeFile(join(OUT, rom.out), entry);
		console.log(`  ${rom.out}: fetched`);
	}
	return [];
}

await mkdir(OUT, { recursive: true });
console.log(CHECK ? 'Firmware check' : 'Firmware fetch');
const images = await fetchImages();
const roms = await fetchRoms();
const missing = [...images, ...roms];
if (missing.length) {
	if (CHECK) console.error(`missing ${missing.length} file(s)`);
	process.exit(1);
}
console.log('done');
