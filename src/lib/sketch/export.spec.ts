import { describe, expect, it } from 'vitest';
import { toLitzDiagram } from './export';
import { GRID, type Sketch } from './types';

function sketchWith(parts: Sketch['parts'], wires: Sketch['wires'] = []): Sketch {
	return {
		format: 'litz-board',
		version: 1,
		grid: GRID,
		name: 'test',
		boards: [{ id: 'bb1', type: 'breadboard-full', x: 0, y: 0, rotate: 0 }],
		parts,
		wires,
		view: { panX: 0, panY: 0, zoom: 1 }
	};
}

/** A resistor whose two pins sit in holes (col, row) and (col+4, row). */
function resistor(id: string, col: number, row: number) {
	return {
		id,
		type: 'litz-resistor',
		// pin 1 is at local x = -40, so the anchor sits 2 holes to the right.
		x: col * GRID + 40,
		y: row * GRID,
		rotate: 0 as const,
		attrs: { value: '220' }
	};
}

describe('toLitzDiagram', () => {
	it('turns a breadboard tie column into connections between pins', () => {
		const diagram = toLitzDiagram(sketchWith([resistor('r1', 5, 2), resistor('r2', 5, 4)]));

		const connections = diagram.connections.map(([a, b]) => [a, b].sort().join(' '));
		expect(connections).toContain('r1:1 r2:1');
		expect(connections).toContain('r1:2 r2:2');
	});

	it('keeps an explicit wire between two pins', () => {
		const diagram = toLitzDiagram(
			sketchWith(
				[resistor('r1', 5, 2), resistor('r2', 20, 2)],
				[
					{
						id: 'w1',
						from: { kind: 'pin', part: 'r1', pin: '2' },
						to: { kind: 'pin', part: 'r2', pin: '1' },
						color: 'blue',
						bend: [],
						style: 'ortho'
					}
				]
			)
		);

		expect(diagram.connections).toContainEqual(['r1:2', 'r2:1', 'blue', []]);
	});

	it('does not emit a connection for a pin that reaches no hole or wire', () => {
		const floating = { ...resistor('r1', 5, 30), y: -1000 };
		const diagram = toLitzDiagram(sketchWith([floating]));
		expect(diagram.connections).toHaveLength(0);
	});

	it('writes part geometry into left/top', () => {
		const diagram = toLitzDiagram(sketchWith([resistor('r1', 5, 2)]));
		expect(diagram.parts[0]).toMatchObject({ id: 'r1', type: 'litz-resistor', left: 140, top: 40 });
	});
});
