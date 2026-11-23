import { describe, expect, it } from 'vitest';
import { blinkySketch } from './examples';
import { toLitzDiagram } from './export';

describe('blinky example', () => {
	const sketch = blinkySketch('Blinking LED');
	const diagram = toLitzDiagram(sketch);

	it('places the board, resistor and LED', () => {
		expect(diagram.parts.map((part) => part.id)).toEqual(['esp', 'r1', 'led1']);
		expect(diagram.parts[0].type).toBe('board-esp32-c3-devkitm-1');
	});

	it('wires GPIO8 through the resistor to the LED and back to ground', () => {
		const pairs = diagram.connections.map((connection) => [connection[0], connection[1]]);
		expect(pairs).toContainEqual(['esp:GPIO8', 'r1:1']);
		expect(pairs).toContainEqual(['r1:2', 'led1:A']);
		expect(pairs).toContainEqual(['led1:C', 'esp:GND.1']);
	});

	it('keeps the wires orthogonal with a draggable middle', () => {
		expect(sketch.wires).toHaveLength(3);
		for (const wire of sketch.wires) {
			expect(wire.style).toBe('ortho');
			expect(wire.bend.length).toBeGreaterThan(0);
		}
	});
});
