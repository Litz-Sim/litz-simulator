import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PART_DEFS } from './registry';

const TYPES = [
	'litz-bme280',
	'litz-bmp280',
	'litz-bme680',
	'litz-ds1307',
	'litz-ds18b20',
	'litz-microsd-card',
	'litz-soil-moisture-sensor',
	'litz-gps-neo6m',
	'litz-ir-emitting-diode',
	'litz-photodiode',
	'litz-vibration-motor',
	'litz-fuse',
	'litz-lm393',
	'litz-optocoupler',
	'litz-dip-switch-8',
	'litz-led-bar-graph',
	'litz-a4988',
	'litz-servo',
	'litz-hx711',
	'litz-ds3231'
];

/** Parts whose pins are one straight header row on the 2.54 mm breadboard pitch. */
const HEADERS = [
	'litz-bme280',
	'litz-bmp280',
	'litz-bme680',
	'litz-ds1307',
	'litz-microsd-card',
	'litz-soil-moisture-sensor',
	'litz-gps-neo6m'
];

describe('redrawn modules', () => {
	it('puts every pin on a pad the art draws', () => {
		// The servo, HX711 and DS3231 keep their Fritzing art: their pins sit on
		// the holes that drawing already has, so there are no separate pads.
		const drawn = TYPES.filter(
			(type) => !['litz-servo', 'litz-hx711', 'litz-ds3231'].includes(type)
		);
		for (const type of drawn) {
			const def = PART_DEFS.find((entry) => entry.type === type);
			expect(def, type).toBeDefined();
			const text = readFileSync(new URL(`./art/${type}.svg`, import.meta.url), 'utf8');
			const pads: { x: number; y: number }[] = [];
			for (const match of text.matchAll(/<rect\b[^>]*>/g)) {
				if (!match[0].includes('fill="#cba552"')) continue;
				if (!match[0].includes('rx="4.5"')) continue;
				const numbers = Object.fromEntries(
					[...match[0].matchAll(/(?:^|\s)(x|y|width|height)="([-\d.]+)"/g)].map((m) => [
						m[1],
						Number(m[2])
					])
				);
				pads.push({ x: numbers.x + numbers.width / 2, y: numbers.y + numbers.height / 2 });
			}
			expect(pads.length, type).toBeGreaterThanOrEqual(def!.pins.length);
			for (const pin of def!.pins) {
				const near = pads.some(
					(pad) => Math.abs(pad.x - pin.x) < 0.01 && Math.abs(pad.y - pin.y) < 0.01
				);
				expect(near, `${type} ${pin.name} at ${pin.x},${pin.y}`).toBe(true);
			}
		}
	});

	it('keeps every header on the breadboard pitch', () => {
		// The DS18B20 is a TO-92: its three leads sit on 1.27 mm, half a hole.
		for (const type of HEADERS) {
			const def = PART_DEFS.find((entry) => entry.type === type)!;
			const columns = [...new Set(def.pins.map((pin) => pin.x))].sort((a, b) => a - b);
			for (let i = 1; i < columns.length; i++) {
				expect(columns[i] - columns[i - 1], `${type} columns`).toBeCloseTo(20, 6);
			}
		}
	});
});
