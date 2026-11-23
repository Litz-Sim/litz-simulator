import { GRID, type Endpoint, type PartInstance, type Sketch, type WireInstance } from './types';
import { defaultBend } from './wire';

/**
 * ESP32-C3 on the left, a resistor and an LED in the breadboard. GPIO8 drives
 * the LED through 220 Ω, which is what the bundled `blinky` firmware toggles.
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
		{ id: 'r1', type: 'litz-resistor', x: 600, y: 40, rotate: 0, attrs: { value: '220' } },
		{ id: 'led1', type: 'litz-led', x: 610, y: 222, rotate: 180, attrs: { color: 'red' } }
	];

	const wire = (
		id: string,
		from: [string, string],
		to: [string, string],
		color: string,
		bend = defaultBend()
	): WireInstance => {
		const a: Endpoint = { kind: 'pin', part: from[0], pin: from[1] };
		const b: Endpoint = { kind: 'pin', part: to[0], pin: to[1] };
		return { id, from: a, to: b, color, bend, style: 'ortho' };
	};

	return {
		format: 'litz-board',
		version: 1,
		grid: GRID,
		name,
		boards: [{ id: 'bb1', type: 'breadboard-full', x: 0, y: 0, rotate: 0 }],
		parts,
		wires: [
			wire('w1', ['esp', 'GPIO8'], ['r1', '1'], '#2f8f4e'),
			wire('w2', ['r1', '2'], ['led1', 'A'], '#c8352c'),
			wire('w3', ['led1', 'C'], ['esp', 'GND.1'], '#2f3235', [{ u: 0.9, v: 0 }])
		],
		view: { panX: 0, panY: 0, zoom: 1 }
	};
}
