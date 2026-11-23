import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import { PackageError, parsePackage } from './packages';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const TOML = `
[part]
id = "custom-led"
name = "Custom LED"
version = "1.0.0"

[simulation]
backend = "builtin"
engine = "led"
`;

function encode(value: unknown): Uint8Array {
	return new TextEncoder().encode(JSON.stringify(value));
}

function zip(files: Record<string, Uint8Array>): Uint8Array {
	return zipSync(files, { level: 0 });
}

function packageWith(part: Record<string, unknown>, extra: Record<string, Uint8Array> = {}) {
	return zip({
		'part.json': encode({
			format: 'litz-part-package',
			version: 1,
			name: 'Test pack',
			parts: [
				{
					type: 'custom-led',
					name: 'Custom LED',
					width: 40,
					height: 60,
					pins: [
						{ name: 'A', x: -10, y: 30 },
						{ name: 'C', x: 10, y: 30 }
					],
					...part
				}
			]
		}),
		'manifest.toml': new TextEncoder().encode(TOML),
		'images/off.png': PNG,
		'images/on.png': PNG,
		...extra
	});
}

describe('parsePackage', () => {
	it('reads a part with state artwork and its manifest', () => {
		const parsed = parsePackage(
			packageWith({
				art: {
					default: 'images/off.png',
					states: { on: 'images/on.png' },
					pins: [{ pin: 'A', level: 'high', image: 'images/on.png' }]
				}
			}),
			'ignored.zip'
		);

		expect(parsed.name).toBe('Test pack');
		expect(parsed.parts).toHaveLength(1);
		const [part] = parsed.parts;
		expect(part.type).toBe('custom-led');
		expect(part.pins.map((pin) => pin.name)).toEqual(['A', 'C']);
		expect(part.art.defaultImage).toBe('images/off.png');
		expect(part.art.states.on).toBe('images/on.png');
		expect(part.art.pins[0]).toEqual({ pin: 'A', level: 'high', image: 'images/on.png' });
		expect(part.manifest).toContain('engine = "led"');
		expect([...parsed.images.keys()].sort()).toEqual(['images/off.png', 'images/on.png']);
	});

	it('falls back to the file name when the package has no name', () => {
		const parsed = parsePackage(
			zip({
				'part.json': encode({
					format: 'litz-part-package',
					parts: [
						{
							type: 'custom-x',
							name: 'X',
							width: 20,
							height: 20,
							pins: [{ name: '1', x: 0, y: 10 }]
						}
					]
				})
			}),
			'my-pack.zip'
		);
		expect(parsed.name).toBe('my-pack');
		expect(parsed.parts[0].manifest).toBeNull();
	});

	it('refuses a file that is not a zip', () => {
		expect(() => parsePackage(new TextEncoder().encode('nope'))).toThrow(PackageError);
	});

	it('refuses an image the zip does not contain', () => {
		expect(() => parsePackage(packageWith({ art: { default: 'images/missing.png' } }))).toThrow(
			/missing file/
		);
	});

	it('refuses a state the backend never reports', () => {
		expect(() =>
			parsePackage(packageWith({ art: { states: { glowing: 'images/on.png' } } }))
		).toThrow(/unknown state/);
	});

	it('refuses art pinned to a pin the part does not have', () => {
		expect(() =>
			parsePackage(
				packageWith({ art: { pins: [{ pin: 'Z', level: 'high', image: 'images/on.png' }] } })
			)
		).toThrow(/names no pin/);
	});
});
