import { describe, expect, it } from 'vitest';
import { partDef } from '#lib/parts/registry';
import { blinkySketch } from './examples';
import { holeNear, pinPosition, toLitzDiagram } from './export';

describe('blinky example', () => {
	const sketch = blinkySketch('Blinking LED');
	const diagram = toLitzDiagram(sketch);

	it('places the board, resistor and LED', () => {
		expect(diagram.parts.map((part) => part.id)).toEqual(['esp', 'r1', 'led1']);
		expect(diagram.parts[0].type).toBe('board-esp32-c3-devkitm-1');
	});

	it('plugs every on-board part into a hole', () => {
		const loose: string[] = [];
		for (const part of sketch.parts) {
			if (part.id === 'esp') continue;
			for (const pin of partDef(part.type).pins) {
				const position = pinPosition(part, pin.name);
				if (position && !holeNear(sketch, position)) loose.push(`${part.id}:${pin.name}`);
			}
		}
		expect(loose).toEqual([]);
	});

	it('ends every wire on the breadboard', () => {
		for (const wire of sketch.wires) {
			const ends = [wire.from, wire.to];
			expect(
				ends.some((end) => end.kind === 'hole'),
				wire.id
			).toBe(true);
		}
	});

	it('wires GPIO8 through the resistor to the LED and back to ground', () => {
		const pairs = diagram.connections.map((connection) => [connection[0], connection[1]]);
		expect(pairs).toContainEqual(['esp:GPIO8', 'r1:1']);
		expect(pairs).toContainEqual(['r1:2', 'led1:A']);
		expect(pairs).toContainEqual(['esp:GND.1', 'led1:C']);
	});

	it('keeps the wires orthogonal with a draggable middle', () => {
		expect(sketch.wires).toHaveLength(3);
		for (const wire of sketch.wires) {
			expect(wire.style).toBe('ortho');
			expect(wire.bend.length).toBeGreaterThan(0);
		}
	});
});
