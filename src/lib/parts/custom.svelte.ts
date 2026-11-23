import { zipSync } from 'fflate';
import { canvasControl } from '#lib/canvas/control';
import { sim } from '#lib/sim/controller.svelte';
import type { Level } from '#lib/sim/backend';
import { drawPackagePart, type ArtImages } from './customDraw';
import {
	PACKAGE_FORMAT,
	PackageError,
	imageType,
	parsePackage,
	type PackagePart,
	type ParsedPackage,
	type PinRule,
	type RangeRule
} from './packages';
import { isBuiltinPart, registerCustomPart, unregisterCustomPart } from './registry';
import type { PartDef, PinDef } from './types';

/**
 * Installed part packages.
 *
 * Each one is kept as the zip it came in, so a reload rebuilds the parts and
 * their engine manifests from the same bytes the user installed.
 */
const STORAGE_KEY = 'litz-board.parts.v1';

export interface InstalledPackage {
	name: string;
	/** The package zip, base64. */
	zip: string;
	types: string[];
}

export const packages = $state<InstalledPackage[]>(readInstalled());
export const customParts = $state<PartDef[]>([]);
/** Why the last install failed; read `message`, null once it works. */
export const packageError = $state<{ message: string | null }>({ message: null });

function readInstalled(): InstalledPackage[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(entry): entry is InstalledPackage =>
				typeof entry === 'object' &&
				entry !== null &&
				typeof (entry as InstalledPackage).name === 'string' &&
				typeof (entry as InstalledPackage).zip === 'string' &&
				Array.isArray((entry as InstalledPackage).types)
		);
	} catch {
		return [];
	}
}

function toBase64(bytes: Uint8Array): string {
	let text = '';
	for (let i = 0; i < bytes.length; i += 0x8000) {
		text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(text);
}

function fromBase64(text: string): Uint8Array {
	const raw = atob(text);
	const bytes = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
	return bytes;
}

function manifestName(type: string): string {
	return `${type}.toml`;
}

// Decoded art outlives any single redraw and never changes, so this cache stays
// plain: a reactive map would wake components that already redraw per frame.
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a lookup, not state
const imageCache = new Map<string, HTMLImageElement>();

/** Two packages may name their art the same way, so the package is part of the key. */
function artKey(parsed: ParsedPackage, path: string): string {
	return `${parsed.name}\u0000${path}`;
}

function forgetArt(name: string): void {
	const prefix = `${name}\u0000`;
	for (const key of imageCache.keys()) {
		if (key.startsWith(prefix)) imageCache.delete(key);
	}
}

function image(parsed: ParsedPackage, path: string): HTMLImageElement | null {
	const key = artKey(parsed, path);
	const cached = imageCache.get(key);
	if (cached) return cached;
	const bytes = parsed.images.get(path);
	if (!bytes) return null;
	const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) as ArrayBuffer;
	const bitmap = new Blob([copy], { type: imageType(path) });
	const element = new Image();
	element.onload = () => canvasControl.engine?.invalidate();
	element.src = URL.createObjectURL(bitmap);
	imageCache.set(key, element);
	return element;
}

function imagesOf(parsed: ParsedPackage, part: PackagePart): ArtImages {
	// Built once per package and only read afterwards, so it needs no reactivity.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a lookup, not state
	const states = new Map<string, HTMLImageElement>();
	for (const [state, path] of Object.entries(part.art.states)) {
		const element = image(parsed, path);
		if (element) states.set(state, element);
	}
	const ranges: { rule: RangeRule; image: HTMLImageElement }[] = [];
	for (const rule of part.art.ranges) {
		const element = image(parsed, rule.image);
		if (element) ranges.push({ rule, image: element });
	}
	const pins: { pin: string; level: Level; image: HTMLImageElement }[] = [];
	for (const rule of part.art.pins) {
		const element = image(parsed, rule.image);
		if (element) pins.push({ pin: rule.pin, level: rule.level, image: element });
	}
	return {
		default: part.art.defaultImage ? image(parsed, part.art.defaultImage) : null,
		states,
		ranges,
		pins
	};
}

function defOf(parsed: ParsedPackage, part: PackagePart): PartDef {
	const images = imagesOf(parsed, part);
	return {
		type: part.type,
		name: part.name,
		category: part.chip ? 'Boards' : 'Custom',
		keywords: part.keywords,
		width: part.width,
		height: part.height,
		pins: part.pins,
		attrs: [],
		...(part.chip ? { chip: part.chip } : {}),
		draw: (ctx, instance) =>
			drawPackagePart(ctx, instance, images, part.width, part.height, part.name)
	};
}

function persist(): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(packages));
	} catch {
		packageError.message = 'localStorage is full';
	}
}

/** Register a parsed package; caller decides what to persist. */
function apply(parsed: ParsedPackage): string[] {
	for (const part of parsed.parts) {
		const def = defOf(parsed, part);
		registerCustomPart(def);
		customParts.push(def);
		if (part.manifest) sim.addManifest(manifestName(part.type), part.manifest);
	}
	return parsed.parts.map((part) => part.type);
}

export function installPackage(bytes: Uint8Array, fileName: string): InstalledPackage {
	const parsed = parsePackage(bytes, fileName.replace(/\.zip$/i, ''));
	const existing = packages.find((entry) => entry.name === parsed.name);
	if (existing) removePackage(existing.name);
	try {
		for (const part of parsed.parts) {
			if (isBuiltinPart(part.type)) {
				throw new PackageError(`${part.type} is a built-in part`);
			}
			if (customParts.some((def) => def.type === part.type)) {
				throw new PackageError(`${part.type} is already installed`);
			}
		}
		const types = apply(parsed);
		const entry: InstalledPackage = { name: parsed.name, zip: toBase64(bytes), types };
		packages.push(entry);
		packageError.message = null;
		persist();
		return entry;
	} catch (error) {
		packageError.message =
			error instanceof PackageError ? error.message : 'the package could not be installed';
		throw error;
	}
}

export function removePackage(name: string): void {
	const entry = packages.find((pkg) => pkg.name === name);
	if (!entry) return;
	for (const type of entry.types) {
		unregisterCustomPart(type);
		sim.removeManifest(manifestName(type));
	}
	forgetArt(entry.name);
	packages.splice(packages.indexOf(entry), 1);
	const remaining = customParts.filter((def) => !entry.types.includes(def.type));
	customParts.splice(0, customParts.length, ...remaining);
	packageError.message = null;
	persist();
}

export interface PackageDraft {
	name: string;
	part: {
		type: string;
		name: string;
		keywords?: string[];
		chip?: string | null;
		width: number;
		height: number;
		pins: PinDef[];
		art: {
			default?: string | null;
			states?: Record<string, string>;
			ranges?: RangeRule[];
			pins?: PinRule[];
		};
	};
	manifest?: string | null;
	/** Image bytes by the path `art` refers to. */
	images: Map<string, Uint8Array>;
}

/** Build a zip a builder can preview, install or download. */
export function buildPackage(draft: PackageDraft): Uint8Array {
	const part = draft.part;
	const files: Record<string, Uint8Array> = {
		'part.json': new TextEncoder().encode(
			JSON.stringify(
				{
					format: PACKAGE_FORMAT,
					version: 1,
					name: draft.name,
					parts: [
						{
							type: part.type,
							name: part.name,
							keywords: part.keywords ?? [],
							...(part.chip ? { chip: part.chip } : {}),
							width: part.width,
							height: part.height,
							pins: part.pins,
							art: {
								...(part.art.default ? { default: part.art.default } : {}),
								...(part.art.states && Object.keys(part.art.states).length
									? { states: part.art.states }
									: {}),
								...(part.art.ranges?.length ? { ranges: part.art.ranges } : {}),
								...(part.art.pins?.length ? { pins: part.art.pins } : {})
							},
							...(draft.manifest ? { manifest: 'manifest.toml' } : {})
						}
					]
				},
				null,
				2
			)
		)
	};
	if (draft.manifest) files['manifest.toml'] = new TextEncoder().encode(draft.manifest);
	for (const [path, bytes] of draft.images) files[path] = bytes;
	return zipSync(files, { level: 6 });
}

function hydrate(): void {
	if (typeof localStorage === 'undefined') return;
	const kept: InstalledPackage[] = [];
	for (const entry of packages) {
		try {
			apply(parsePackage(fromBase64(entry.zip), entry.name));
			kept.push(entry);
		} catch {
			// A package that no longer parses should not stop the editor from opening.
		}
	}
	if (kept.length !== packages.length) packages.splice(0, packages.length, ...kept);
}

hydrate();
