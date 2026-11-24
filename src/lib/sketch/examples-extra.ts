import { defaultBend } from './wire';
import { GRID, type Endpoint, type Sketch, type WireInstance } from './types';

interface PartSpec {
	id: string;
	type: string;
	x: number;
	y: number;
	rotate?: number;
	attrs?: Record<string, string | number | boolean>;
}

function wire(
	id: string,
	from: [string, string],
	to: [string, string],
	color: string,
	bend = defaultBend()
): WireInstance {
	const a: Endpoint = { kind: 'pin', part: from[0], pin: from[1] };
	const b: Endpoint = { kind: 'pin', part: to[0], pin: to[1] };
	return { id, from: a, to: b, color, bend, style: 'ortho' };
}

/**
 * Every example plugs its parts into one half-size board: pin rows sit on
 * hole rows, so the modules have something to stand on and a saved sketch
 * exports the same nets the picture shows.
 */
function sketch(name: string, parts: PartSpec[], wires: WireInstance[]): Sketch {
	return {
		format: 'litz-board',
		version: 1,
		grid: GRID,
		name,
		boards: [{ id: 'bb1', type: 'breadboard-half', x: 0, y: 0, rotate: 0 }],
		parts: parts.map((part) => ({
			id: part.id,
			type: part.type,
			x: part.x,
			y: part.y,
			rotate: (part.rotate ?? 0) as 0 | 90 | 180 | 270,
			attrs: part.attrs ?? {}
		})),
		wires,
		view: { panX: 0, panY: 0, zoom: 1 }
	};
}

const BOARD = 'board-esp32-c3-devkitm-1';

/** GPIO0 reads the wiper; GPIO8 blinks the LED. */
export function potSketch(name: string): Sketch {
	return sketch(
		name,
		[
			{ id: 'esp', type: BOARD, x: -280, y: 40 },
			{ id: 'pot1', type: 'litz-potentiometer', x: 300, y: 12, attrs: { value: '50' } },
			{ id: 'r1', type: 'litz-resistor', x: 400, y: 140, attrs: { value: '220' } },
			{ id: 'led1', type: 'litz-led', x: 410, y: 222, rotate: 180, attrs: { color: 'green' } }
		],
		[
			wire('w1', ['esp', '3V3'], ['pot1', '1'], '#c8352c'),
			wire('w2', ['pot1', '3'], ['esp', 'GND.1'], '#2f3235', [{ u: 0.85, v: 0 }]),
			wire('w3', ['pot1', '2'], ['esp', 'GPIO0'], '#2f6fd0'),
			wire('w4', ['esp', 'GPIO8'], ['r1', '1'], '#2f8f4e'),
			wire('w5', ['r1', '2'], ['led1', 'A'], '#c8352c'),
			wire('w6', ['led1', 'C'], ['esp', 'GND.2'], '#2f3235', [{ u: 0.9, v: 0 }])
		]
	);
}

/** GPIO1 reads the button; GPIO8 drives the LED. */
export function buttonLedSketch(name: string): Sketch {
	return sketch(
		name,
		[
			{ id: 'esp', type: BOARD, x: -280, y: 40 },
			{ id: 'btn1', type: 'litz-pushbutton', x: 300, y: 50, attrs: { color: 'blue' } },
			{ id: 'r1', type: 'litz-resistor', x: 400, y: 140, attrs: { value: '220' } },
			{ id: 'led1', type: 'litz-led', x: 410, y: 222, rotate: 180, attrs: { color: 'red' } }
		],
		[
			wire('w1', ['esp', 'GPIO1'], ['btn1', '1.l'], '#2f6fd0'),
			wire('w2', ['btn1', '1.r'], ['esp', 'GND.1'], '#2f3235', [{ u: 0.85, v: 0 }]),
			wire('w3', ['esp', 'GPIO8'], ['r1', '1'], '#2f8f4e'),
			wire('w4', ['r1', '2'], ['led1', 'A'], '#c8352c'),
			wire('w5', ['led1', 'C'], ['esp', 'GND.2'], '#2f3235', [{ u: 0.9, v: 0 }])
		]
	);
}

/** SSD1306 on I²C: SDA is GPIO9, SCL is GPIO10. */
export function oledSketch(name: string): Sketch {
	return sketch(
		name,
		[
			{ id: 'esp', type: BOARD, x: -280, y: 40 },
			{ id: 'oled1', type: 'litz-ssd1306', x: 310, y: -44 },
			{ id: 'r1', type: 'litz-resistor', x: 300, y: 140, attrs: { value: '220' } },
			{ id: 'led1', type: 'litz-led', x: 310, y: 222, rotate: 180, attrs: { color: 'blue' } }
		],
		[
			wire('w1', ['esp', '3V3'], ['oled1', 'VCC'], '#c8352c'),
			wire('w2', ['esp', 'GND.1'], ['oled1', 'GND'], '#2f3235', [{ u: 0.92, v: 0 }]),
			wire('w3', ['esp', 'GPIO9'], ['oled1', 'SDA'], '#2f6fd0'),
			wire('w4', ['esp', 'GPIO10'], ['oled1', 'SCL'], '#7a4bb0'),
			wire('w5', ['esp', 'GPIO8'], ['r1', '1'], '#2f8f4e'),
			wire('w6', ['r1', '2'], ['led1', 'A'], '#c8352c'),
			wire('w7', ['led1', 'C'], ['esp', 'GND.2'], '#2f3235', [{ u: 0.9, v: 0 }])
		]
	);
}

/**
 * MicroPython prints two sine values per line, which is what the Serial Plot
 * parses: every token on a line must be a number.
 */
export function plotSketch(name: string): Sketch {
	return {
		...sketch(
			name,
			[
				{ id: 'esp', type: BOARD, x: -280, y: 40 },
				{ id: 'r1', type: 'litz-resistor', x: 180, y: 40, attrs: { value: '220' } },
				{ id: 'led1', type: 'litz-led', x: 330, y: 118, attrs: { color: 'green' } }
			],
			[
				wire('w1', ['esp', 'GPIO8'], ['r1', '1'], '#2f8f4e'),
				wire('w2', ['r1', '2'], ['led1', 'A'], '#c8352c'),
				wire('w3', ['led1', 'C'], ['esp', 'GND.1'], '#2f3235', [{ u: 0.014, v: 0 }])
			]
		),
		programs: {
			esp: {
				runtime: 'micropython',
				firmware: null,
				rom: null,
				boot: null,
				ptable: null,
				files: [
					{
						name: 'main.py',
						text: [
							'import math',
							'import time',
							'from machine import Pin',
							'',
							'led = Pin(8, Pin.OUT)',
							'i = 0',
							'while True:',
							'    led.value(i % 2)',
							'    print(round(math.sin(i / 6) * 100, 1), round(math.cos(i / 6) * 100, 1))',
							'    i += 1',
							'    time.sleep_ms(50)',
							''
						].join('\n')
					}
				]
			}
		}
	};
}

/** Three LEDs on GPIO8, GPIO9 and GPIO10. */
export function trafficLightSketch(name: string): Sketch {
	return sketch(
		name,
		[
			{ id: 'esp', type: BOARD, x: -280, y: 40 },
			{ id: 'r1', type: 'litz-resistor', x: 180, y: 0, attrs: { value: '220' } },
			{ id: 'r2', type: 'litz-resistor', x: 300, y: 40, attrs: { value: '220' } },
			{ id: 'r3', type: 'litz-resistor', x: 420, y: 80, attrs: { value: '220' } },
			{
				id: 'led1',
				type: 'litz-led',
				x: 110,
				y: 222,
				rotate: 180,
				attrs: { color: 'red' }
			},
			{
				id: 'led2',
				type: 'litz-led',
				x: 230,
				y: 222,
				rotate: 180,
				attrs: { color: 'yellow' }
			},
			{
				id: 'led3',
				type: 'litz-led',
				x: 350,
				y: 222,
				rotate: 180,
				attrs: { color: 'green' }
			}
		],
		[
			wire('w1', ['esp', 'GPIO8'], ['r1', '1'], '#2f8f4e'),
			wire('w2', ['esp', 'GPIO9'], ['r2', '1'], '#2f8f4e'),
			wire('w3', ['esp', 'GPIO10'], ['r3', '1'], '#2f8f4e'),
			wire('w4', ['r1', '2'], ['led1', 'A'], '#c8352c'),
			wire('w5', ['r2', '2'], ['led2', 'A'], '#c8952c'),
			wire('w6', ['r3', '2'], ['led3', 'A'], '#2f8f4e'),
			wire('w7', ['led1', 'C'], ['esp', 'GND.1'], '#2f3235'),
			wire('w8', ['led2', 'C'], ['esp', 'GND.1'], '#2f3235'),
			wire('w9', ['led3', 'C'], ['esp', 'GND.1'], '#2f3235')
		]
	);
}
