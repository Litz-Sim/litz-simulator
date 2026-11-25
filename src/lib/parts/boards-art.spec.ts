import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOARD_PARTS } from './library/board-parts';

const TYPES = [
	'board-arduino-uno',
	'board-arduino-nano',
	'board-arduino-pro-mini',
	'board-raspberry-pi-pico'
];

describe('redrawn boards', () => {
	it('puts every pin on a pad the art draws', () => {
		for (const type of TYPES) {
			const def = BOARD_PARTS.find((entry) => entry.type === type);
			expect(def, type).toBeDefined();
			const text = readFileSync(new URL(`./art/${type}.svg`, import.meta.url), 'utf8');
			const pads: { x: number; y: number }[] = [];
			for (const match of text.matchAll(/<rect\b[^>]*>/g)) {
				if (!match[0].includes('fill="#cba552"')) continue;
				if (!match[0].includes('rx="4.6"')) continue;
				const numbers = Object.fromEntries(
					[...match[0].matchAll(/(?:^|\s)(x|y|width|height)="([-\d.]+)"/g)].map((m) => [
						m[1],
						Number(m[2])
					])
				);
				pads.push({ x: numbers.x + numbers.width / 2, y: numbers.y + numbers.height / 2 });
			}
			expect(pads.length, type).toBeGreaterThan(10);
			for (const pin of def!.pins) {
				const near = pads.some(
					(pad) => Math.abs(pad.x - pin.x) < 0.01 && Math.abs(pad.y - pin.y) < 0.01
				);
				expect(near, `${type} ${pin.name} at ${pin.x},${pin.y}`).toBe(true);
			}
		}
	});
});
