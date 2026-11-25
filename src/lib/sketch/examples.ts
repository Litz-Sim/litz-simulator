import { GRID, type PartInstance, type Sketch, type WireInstance } from './types';
import { defaultBend } from './wire';

/**
 * ESP32-C3 on the left, a resistor and an LED plugged into a half-size
 * breadboard. GPIO8 drives the LED through 220 Ω, which is what the bundled
 * `blinky` firmware toggles.
 *
 * Every wire ends on a hole, and both parts sit with their legs in holes, so
 * the board carries the circuit rather than sitting under it.
 */
export function blinkySketch(name: string): Sketch {
	const parts: PartInstance[] = [
		{
			id: 'esp',
			type: 'board-esp32-c3-devkitm-1',
			x: -280,
			y: 40,
			rotate: 0,
			attrs: {}
		},
		{ id: 'r1', type: 'litz-resistor', x: 180, y: 40, rotate: 0, attrs: { value: '220' } },
		{ id: 'led1', type: 'litz-led', x: 330, y: 129, rotate: 0, attrs: { color: 'red' } }
	];

	const wire = (
		id: string,
		from: WireInstance['from'],
		to: WireInstance['to'],
		color: string,
		bend = defaultBend()
	): WireInstance => ({ id, from, to, color, bend, style: 'ortho' });

	return {
		format: 'litz-board',
		version: 1,
		grid: GRID,
		name,
		boards: [{ id: 'bb1', type: 'breadboard-half', x: 0, y: 0, rotate: 0 }],
		parts,
		wires: [
			// GPIO8 to the resistor's left leg (col 7, row 2).
			wire(
				'w1',
				{ kind: 'pin', part: 'esp', pin: 'GPIO8' },
				{ kind: 'hole', board: 'bb1', col: 7, row: 2 },
				'#2f8f4e'
			),
			// The resistor's right leg (col 11) to the LED anode (col 17, row 8).
			wire(
				'w2',
				{ kind: 'hole', board: 'bb1', col: 11, row: 2 },
				{ kind: 'hole', board: 'bb1', col: 17, row: 8 },
				'#c8352c'
			),
			// The cathode (col 16) back to ground. The bend keeps the wire out of
			// the hole columns on its way up.
			wire(
				'w3',
				{ kind: 'hole', board: 'bb1', col: 16, row: 8 },
				{ kind: 'pin', part: 'esp', pin: 'GND.1' },
				'#2f3235',
				[{ u: 0.014, v: 0 }]
			)
		],
		view: { panX: 0, panY: 0, zoom: 1 }
	};
}
