/**
 * Form state and TOML generation for the custom part and board author pages.
 * The generated text is what the engine reads from `manifest.toml`.
 */

export type AuthorMode = 'part' | 'board';

export const PIN_KINDS = [
	'digital-in',
	'digital-out',
	'digital-io',
	'analog-in',
	'analog-out',
	'analog-io',
	'passive',
	'ground',
	'power',
	'i2c-sda',
	'i2c-scl',
	'spi-sck',
	'spi-mosi',
	'spi-miso',
	'spi-cs',
	'uart-tx',
	'uart-rx',
	'nc'
] as const;

export const BEHAVIORS = [
	'led',
	'pushbutton',
	'buzzer',
	'potentiometer',
	'servo',
	'resistor',
	'diode',
	'capacitor',
	'gate'
] as const;

export const BOARD_CHIPS = [
	{ id: 'esp32c3', name: 'ESP32-C3' },
	{ id: 'esp32c6', name: 'ESP32-C6' },
	{ id: 'rp2040', name: 'RP2040' }
] as const;

export const FIXED_RAILS = ['3v3', '5v', 'gnd'] as const;

/** States the art editor offers an image for, in the order it shows them. */
export const ART_STATES = ['on', 'off', 'up', 'down', 'sounding', 'silent'] as const;

export type ArtState = (typeof ART_STATES)[number];

export interface PinRow {
	name: string;
	label: string;
	kind: string;
	x: string;
	y: string;
	/** Board only: the GPIO number, ignored when `fixed` names a rail. */
	gpio: string;
	/** Board only: `3v3`, `5v` or `gnd`. */
	fixed: string;
}

export interface PinRuleDraft {
	pin: string;
	level: 'low' | 'high' | 'high-z';
	/** Package path of the image, or an empty string while the row is unfilled. */
	path: string;
}

export interface ArtDraft {
	default: string | null;
	states: Record<string, string>;
	pins: PinRuleDraft[];
}

export function blankPin(index: number): PinRow {
	return {
		name: `P${index + 1}`,
		label: '',
		kind: 'passive',
		x: '0',
		y: '0',
		gpio: '',
		fixed: ''
	};
}

export function blankArt(): ArtDraft {
	return { default: null, states: {}, pins: [] };
}

/** Lowercase a display name into the type id the package format accepts. */
export function slugify(input: string): string {
	return input
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-{2,}/g, '-')
		.slice(0, 64)
		.replace(/-+$/, '');
}

/** A short suffix for names that have no latin characters to slug. */
export function shortHash(input: string): string {
	let hash = 0;
	for (const char of input) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
	return hash.toString(36).slice(0, 4);
}

const BARE_KEY = /^[A-Za-z0-9_-]+$/;

export function tomlString(value: string): string {
	const escaped = value
		.replace(/\\/g, '\\\\')
		.replace(/"/g, '\\"')
		.replace(/\r/g, '\\r')
		.replace(/\n/g, '\\n')
		.replace(/\t/g, '\\t');
	return `"${escaped}"`;
}

/** A pin name becomes a TOML table key; quote it when it is not a bare key. */
export function tomlKey(value: string): string {
	const trimmed = value.trim();
	return BARE_KEY.test(trimmed) ? trimmed : tomlString(trimmed);
}

function partHeader(type: string, name: string): string[] {
	return [
		'[part]',
		`id = ${tomlString(type)}`,
		`name = ${tomlString(name)}`,
		'version = "1.0.0"',
		''
	];
}

export interface PartManifestInput {
	type: string;
	name: string;
	pins: PinRow[];
	behavior: string;
}

/** `behavior === 'none'` means a graphic-only part with no engine manifest. */
export function generatePartManifest({ type, name, pins, behavior }: PartManifestInput): string {
	if (behavior === 'none') return '';
	const lines = partHeader(type, name);
	let number = 0;
	for (const pin of pins) {
		const pinName = pin.name.trim();
		if (!pinName) continue;
		number += 1;
		lines.push(
			`[pins.${tomlKey(pinName)}]`,
			`kind = ${tomlString(pin.kind)}`,
			`number = ${number}`
		);
		const label = pin.label.trim();
		if (label) lines.push(`label = ${tomlString(label)}`);
		lines.push('');
	}
	lines.push('[simulation]', 'backend = "builtin"', `engine = ${tomlString(behavior)}`, '');
	return lines.join('\n');
}

export interface BoardManifestInput {
	type: string;
	name: string;
	chip: string;
	flash: string;
	pins: PinRow[];
}

export function generateBoardManifest({
	type,
	name,
	chip,
	flash,
	pins
}: BoardManifestInput): string {
	const lines = [
		'[board]',
		`id = ${tomlString(type)}`,
		`name = ${tomlString(name)}`,
		'version = "1.0.0"',
		`chip = ${tomlString(chip)}`,
		`flash_size = ${tomlString(flash.trim() || '4MB')}`,
		''
	];
	for (const pin of pins) {
		const pinName = pin.name.trim();
		if (!pinName) continue;
		lines.push('[[pins]]', `name = ${tomlString(pinName)}`);
		const fixed = pin.fixed.trim().toLowerCase();
		if ((FIXED_RAILS as readonly string[]).includes(fixed)) {
			lines.push(`fixed = ${tomlString(fixed)}`);
		} else {
			const gpio = Number.parseInt(pin.gpio.trim(), 10);
			lines.push(`gpio = ${Number.isFinite(gpio) ? gpio : 0}`);
		}
		lines.push('');
	}
	return lines.join('\n');
}
