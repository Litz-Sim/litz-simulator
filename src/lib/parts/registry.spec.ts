import { describe, expect, it } from 'vitest';
import { PART_DEFS, partDef } from './registry';

describe('part registry', () => {
	it('declares each type once', () => {
		const types = PART_DEFS.map((def) => def.type);
		expect(new Set(types).size).toBe(types.length);
	});

	it('writes the potentiometer travel as a string for Litz', () => {
		// The catalog types this attribute as a String; a number is rejected
		// when the session opens, not when the document is edited.
		const value = partDef('litz-potentiometer').attrs.find((attr) => attr.name === 'value');
		expect(value?.type).toBe('string');
		expect(typeof value?.default).toBe('string');
	});

	it('covers the catalog and every runnable board family', () => {
		expect(PART_DEFS.length).toBeGreaterThan(170);
		const boards = PART_DEFS.filter((def) => def.category === 'Boards');
		expect(boards.length).toBeGreaterThanOrEqual(10);
		for (const board of boards) {
			if (board.type === 'board-litz-rv32') continue; // a wasm MCU, not a chip id
			expect(board.chip, board.type).toBeTruthy();
			expect(
				board.pins.some((pin) => pin.gpio !== undefined),
				board.type
			).toBe(true);
		}
	});

	it('gives every pin a finite position near the part box', () => {
		const problems: string[] = [];
		for (const def of PART_DEFS) {
			for (const pin of def.pins) {
				if (!Number.isFinite(pin.x) || !Number.isFinite(pin.y)) {
					problems.push(`${def.type}:${pin.name} is not finite`);
				}
				// Header legs sit just outside the body outline.
				if (Math.abs(pin.x) > def.width / 2 + 12 || Math.abs(pin.y) > def.height / 2 + 12) {
					problems.push(`${def.type}:${pin.name} falls outside the box`);
				}
			}
		}
		expect(problems).toEqual([]);
	});

	it('exposes the bench supply terminals and settings', () => {
		const supply = partDef('litz-power-supply');
		expect(supply.pins.map((pin) => pin.name)).toEqual(['+', '-']);
		expect(supply.attrs.map((attr) => attr.name)).toEqual(['voltage', 'current_limit']);
	});
});
