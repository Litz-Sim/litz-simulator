import { unzipSync } from 'fflate';
import type { PinDef } from './types';

/**
 * A part package is a zip the editor installs as one dev board or component:
 *
 *   part.json      what the canvas draws and where its pins sit
 *   manifest.toml  optional, the engine's own description of the part
 *   images/*       the artwork every state points at
 *
 * `part.json` is a superset of the built-in part definition: besides size and
 * pins it says which image belongs to which simulator state, so an imported
 * LED lights up like a catalog one.
 */

export const PACKAGE_FORMAT = 'litz-part-package';

/** Part states the backend reports, matching `PartState` in the simulator. */
const KNOWN_STATES = new Set([
	'none',
	'off',
	'on',
	'up',
	'down',
	'silent',
	'sounding',
	'position',
	'mask',
	'state',
	'unknown'
]);

const LEVELS = new Set(['low', 'high', 'high-z']);

const IMAGE_TYPES: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp',
	gif: 'image/gif',
	svg: 'image/svg+xml'
};

export interface RangeRule {
	state: string;
	min: number;
	max: number;
	image: string;
}

export interface PinRule {
	pin: string;
	level: 'low' | 'high' | 'high-z';
	image: string;
}

export interface PackageArt {
	defaultImage: string | null;
	/** Image per reported state, e.g. `{ "on": "images/on.png" }`. */
	states: Record<string, string>;
	/** Image per value range of a `position` or `mask` part. */
	ranges: RangeRule[];
	/** Image per pin level; checked before the state rules. */
	pins: PinRule[];
}

export interface PackagePart {
	type: string;
	name: string;
	keywords: string[];
	/** Chip the board runs, or null for a plain component. */
	chip: string | null;
	width: number;
	height: number;
	pins: PinDef[];
	art: PackageArt;
	/** The manifest text this part's behavior comes from, when it has one. */
	manifest: string | null;
}

export interface ParsedPackage {
	name: string;
	parts: PackagePart[];
	/** Image bytes by path inside the zip. */
	images: Map<string, Uint8Array>;
}

/** A package the editor refused, with a message fit for the settings dialog. */
export class PackageError extends Error {}

const TYPE_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;

function fail(message: string): never {
	throw new PackageError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function number(value: unknown, what: string): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${what} must be a number`);
	return value;
}

function safePath(path: string, what: string): string {
	if (path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) {
		fail(`${what} must stay inside the package: ${path}`);
	}
	return path;
}

function imagePath(value: unknown, files: Record<string, Uint8Array>, what: string): string {
	if (typeof value !== 'string' || value.trim() === '') fail(`${what} needs an image path`);
	const path = safePath(value, what);
	if (!files[path]) fail(`${what} points at a missing file: ${path}`);
	const extension = path.split('.').pop()?.toLowerCase() ?? '';
	if (!IMAGE_TYPES[extension]) fail(`${what} is not an image: ${path}`);
	return path;
}

function readPins(value: unknown): PinDef[] {
	if (!Array.isArray(value) || value.length === 0) fail('a part needs at least one pin');
	const seen = new Set<string>();
	return value.map((entry, index) => {
		const what = `pin ${index + 1}`;
		if (!isRecord(entry)) fail(`${what} must be an object`);
		const name = entry.name;
		if (typeof name !== 'string' || name === '') fail(`${what} needs a name`);
		if (seen.has(name)) fail(`two pins are named ${name}`);
		seen.add(name);
		const pin: PinDef = {
			name,
			x: number(entry.x, `${what} x`),
			y: number(entry.y, `${what} y`)
		};
		if (typeof entry.label === 'string' && entry.label !== '') pin.label = entry.label;
		if (entry.gpio !== undefined) pin.gpio = number(entry.gpio, `${what} gpio`);
		return pin;
	});
}

function readArt(value: unknown, files: Record<string, Uint8Array>, pins: PinDef[]): PackageArt {
	const art: PackageArt = { defaultImage: null, states: {}, ranges: [], pins: [] };
	if (value === undefined) return art;
	if (!isRecord(value)) fail('art must be an object');

	if (value.default !== undefined)
		art.defaultImage = imagePath(value.default, files, 'art.default');

	if (value.states !== undefined) {
		if (!isRecord(value.states)) fail('art.states must map a state to an image');
		for (const [state, path] of Object.entries(value.states)) {
			if (!KNOWN_STATES.has(state)) fail(`unknown state in art.states: ${state}`);
			art.states[state] = imagePath(path, files, `art.states.${state}`);
		}
	}

	if (value.ranges !== undefined) {
		if (!Array.isArray(value.ranges)) fail('art.ranges must be a list');
		art.ranges = value.ranges.map((entry, index) => {
			const what = `art.ranges[${index}]`;
			if (!isRecord(entry)) fail(`${what} must be an object`);
			const state = entry.state;
			if (state !== 'position' && state !== 'mask') {
				fail(`${what} only applies to position or mask`);
			}
			const min = number(entry.min, `${what} min`);
			const max = number(entry.max, `${what} max`);
			if (min >= max) fail(`${what} needs min < max`);
			return { state, min, max, image: imagePath(entry.image, files, what) };
		});
	}

	if (value.pins !== undefined) {
		if (!Array.isArray(value.pins)) fail('art.pins must be a list');
		const names = new Set(pins.map((pin) => pin.name));
		art.pins = value.pins.map((entry, index) => {
			const what = `art.pins[${index}]`;
			if (!isRecord(entry)) fail(`${what} must be an object`);
			const pin = entry.pin;
			if (typeof pin !== 'string' || !names.has(pin)) fail(`${what} names no pin of this part`);
			const level = entry.level;
			if (typeof level !== 'string' || !LEVELS.has(level)) {
				fail(`${what} level must be low, high or high-z`);
			}
			return {
				pin,
				level: level as PinRule['level'],
				image: imagePath(entry.image, files, what)
			};
		});
	}

	return art;
}

/**
 * Read a package zip into part definitions.
 *
 * Nothing here touches the DOM: the caller decodes the images and registers the
 * definitions, which keeps the format testable outside a browser.
 */
export function parsePackage(bytes: Uint8Array, fallbackName = 'package'): ParsedPackage {
	let files: Record<string, Uint8Array>;
	try {
		files = unzipSync(bytes);
	} catch {
		throw new PackageError('the file is not a zip package');
	}

	const source = files['part.json'];
	if (!source) throw new PackageError('part.json is missing');

	let doc: unknown;
	try {
		doc = JSON.parse(new TextDecoder().decode(source));
	} catch {
		throw new PackageError('part.json is not valid JSON');
	}
	if (!isRecord(doc)) throw new PackageError('part.json must hold an object');
	if (doc.format !== PACKAGE_FORMAT) throw new PackageError(`format must be ${PACKAGE_FORMAT}`);
	if (doc.version !== undefined && number(doc.version, 'version') > 1) {
		throw new PackageError('this package needs a newer editor');
	}

	const name =
		typeof doc.name === 'string' && doc.name.trim() !== ''
			? doc.name.trim()
			: fallbackName.replace(/\.zip$/i, '');
	if (!Array.isArray(doc.parts) || doc.parts.length === 0) {
		throw new PackageError('a package needs at least one part');
	}

	const defaultManifest = files['manifest.toml']
		? new TextDecoder().decode(files['manifest.toml'])
		: null;

	const images = new Map<string, Uint8Array>();
	const parts = doc.parts.map((entry, index) => {
		const what = `part ${index + 1}`;
		if (!isRecord(entry)) fail(`${what} must be an object`);

		const type = entry.type;
		if (typeof type !== 'string' || !TYPE_PATTERN.test(type)) {
			fail(`${what} needs a type of lowercase letters, digits and dashes`);
		}
		if (typeof entry.name !== 'string' || entry.name.trim() === '') fail(`${what} needs a name`);

		const width = number(entry.width, `${what} width`);
		const height = number(entry.height, `${what} height`);
		if (width <= 0 || height <= 0 || width > 2000 || height > 2000) {
			fail(`${what} size must be between 1 and 2000 units`);
		}

		const pins = readPins(entry.pins);
		const art = readArt(entry.art, files, pins);
		for (const path of artPaths(art)) {
			if (!images.has(path)) images.set(path, files[path]);
		}

		let manifest = defaultManifest;
		if (entry.manifest !== undefined) {
			if (typeof entry.manifest !== 'string') fail(`${what} manifest must be a path`);
			const path = safePath(entry.manifest, `${what} manifest`);
			const text = files[path];
			if (!text) fail(`${what} manifest points at a missing file: ${path}`);
			manifest = new TextDecoder().decode(text);
		}

		const keywords = Array.isArray(entry.keywords)
			? entry.keywords.filter((word): word is string => typeof word === 'string')
			: [];

		return {
			type,
			name: entry.name.trim(),
			keywords,
			chip: typeof entry.chip === 'string' && entry.chip !== '' ? entry.chip : null,
			width,
			height,
			pins,
			art,
			manifest
		};
	});

	return { name, parts, images };
}

function artPaths(art: PackageArt): string[] {
	return [
		...(art.defaultImage ? [art.defaultImage] : []),
		...Object.values(art.states),
		...art.ranges.map((rule) => rule.image),
		...art.pins.map((rule) => rule.image)
	];
}

/** MIME type for an image path inside a package. */
export function imageType(path: string): string {
	const extension = path.split('.').pop()?.toLowerCase() ?? '';
	return IMAGE_TYPES[extension] ?? 'application/octet-stream';
}
