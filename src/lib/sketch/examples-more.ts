import { defaultBend } from './wire';
import { GRID, type Endpoint, type ProbeInstance, type Sketch, type WireInstance } from './types';

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

function probe(
	id: string,
	part: string,
	pin: string,
	name: string,
	color: string,
	dx = 26,
	dy = -26
): ProbeInstance {
	return { id, part, pin, name, color, dx, dy };
}

function sketch(
	name: string,
	parts: PartSpec[],
	wires: WireInstance[],
	extra: Partial<Sketch> = {}
): Sketch {
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
		view: { panX: 0, panY: 0, zoom: 1 },
		...extra
	};
}

const BOARD = 'board-esp32-c3-devkitm-1';

/**
 * Three of the shift register's eight outputs drive LEDs, and the data and
 * clock lines carry probes, so the Logic tab shows the edges the firmware
 * generates while the LEDs show the low three bits of the byte.
 */
export function logicAnalyzerSketch(name: string): Sketch {
	return sketch(
		name,
		[
			{ id: 'esp', type: BOARD, x: -280, y: 40 },
			{ id: 'u1', type: 'litz-74hc164', x: 140, y: 80, rotate: 90 },
			{ id: 'r1', type: 'litz-resistor', x: 280, y: 60, attrs: { value: '220' } },
			{ id: 'r2', type: 'litz-resistor', x: 380, y: 60, attrs: { value: '220' } },
			{ id: 'r3', type: 'litz-resistor', x: 480, y: 60, attrs: { value: '220' } },
			{ id: 'led1', type: 'litz-led', x: 270, y: 200, rotate: 180, attrs: { color: 'green' } },
			{ id: 'led2', type: 'litz-led', x: 370, y: 200, rotate: 180, attrs: { color: 'yellow' } },
			{ id: 'led3', type: 'litz-led', x: 470, y: 200, rotate: 180, attrs: { color: 'red' } }
		],
		[
			wire('w1', ['esp', 'GPIO8'], ['u1', 'A'], '#2f8f4e'),
			wire('w2', ['esp', 'GPIO8'], ['u1', 'B'], '#2f8f4e'),
			wire('w3', ['esp', 'GPIO9'], ['u1', 'CLK'], '#2f6fd0'),
			wire('w4', ['esp', '3V3'], ['u1', 'CLR'], '#c8352c'),
			wire('w5', ['esp', '3V3'], ['u1', 'VCC'], '#c8352c'),
			wire('w6', ['esp', 'GND.1'], ['u1', 'GND'], '#2f3235', [{ u: 0.9, v: 0 }]),
			wire('w7', ['u1', 'Q0'], ['r1', '1'], '#2f8f4e'),
			wire('w8', ['u1', 'Q1'], ['r2', '1'], '#c8952c'),
			wire('w9', ['u1', 'Q2'], ['r3', '1'], '#c8352c'),
			wire('w10', ['r1', '2'], ['led1', 'A'], '#2f8f4e'),
			wire('w11', ['r2', '2'], ['led2', 'A'], '#c8952c'),
			wire('w12', ['r3', '2'], ['led3', 'A'], '#c8352c'),
			wire('w13', ['led1', 'C'], ['esp', 'GND.2'], '#2f3235', [{ u: 0.9, v: 0 }]),
			wire('w14', ['led2', 'C'], ['esp', 'GND.2'], '#2f3235', [{ u: 0.92, v: 0 }]),
			wire('w15', ['led3', 'C'], ['esp', 'GND.2'], '#2f3235', [{ u: 0.94, v: 0 }])
		],
		{
			probes: [
				probe('p1', 'esp', 'GPIO8', 'DATA', '#3f7f5f'),
				probe('p2', 'esp', 'GPIO9', 'CLOCK', '#3d6fb4', 26, 22),
				probe('p3', 'u1', 'Q2', 'Q2', '#b23b3b')
			],
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
								'import time',
								'from machine import Pin',
								'',
								'data = Pin(8, Pin.OUT)',
								'clock = Pin(9, Pin.OUT)',
								'i = 0',
								'while True:',
								'    for bit in range(8):',
								'        data.value((i >> (7 - bit)) & 1)',
								'        clock.value(1)',
								'        clock.value(0)',
								'    print("byte", i & 7)',
								'    i = (i + 1) % 256',
								'    time.sleep_ms(200)',
								''
							].join('\n')
						}
					]
				}
			}
		}
	);
}

/**
 * The DAC trims the regulator's ADJ pin, so the output is the code plus
 * 1.25 V, and the ADC measures it through a 10 kΩ/10 kΩ divider.
 */
export function supplySketch(name: string): Sketch {
	return sketch(
		name,
		[
			{ id: 'esp', type: BOARD, x: -280, y: 40 },
			{ id: 'ps1', type: 'litz-power-supply', x: 700, y: -60, attrs: { voltage: 9 } },
			{
				id: 'reg',
				type: 'litz-voltage-regulator',
				x: 700,
				y: 90,
				attrs: { variant: 'LM317' }
			},
			{ id: 'dac', type: 'litz-mcp4725', x: 260, y: 110 },
			{ id: 'adc', type: 'litz-ads1115', x: 400, y: 110, rotate: 90 },
			{ id: 'r1', type: 'litz-resistor', x: 60, y: 180, attrs: { value: '10k' } },
			{ id: 'r2', type: 'litz-resistor', x: 180, y: 220, attrs: { value: '10k' } },
			{ id: 'load', type: 'litz-resistor', x: 520, y: 180, attrs: { value: '220' } }
		],
		[
			wire('w1', ['ps1', '+'], ['reg', 'VI'], '#c8352c'),
			wire('w2', ['ps1', '-'], ['esp', 'GND.1'], '#2f3235', [{ u: 0.9, v: 0 }]),
			wire('w3', ['reg', 'GND'], ['esp', 'GND.1'], '#2f3235', [{ u: 0.86, v: 0 }]),
			wire('w4', ['dac', 'VOUT'], ['reg', 'ADJ'], '#2f6fd0'),
			wire('w5', ['esp', '3V3'], ['dac', 'VCC'], '#c8352c'),
			wire('w6', ['dac', 'GND'], ['esp', 'GND.1'], '#2f3235', [{ u: 0.84, v: 0 }]),
			wire('w7', ['esp', 'GPIO9'], ['dac', 'SDA'], '#2f6fd0'),
			wire('w8', ['esp', 'GPIO10'], ['dac', 'SCL'], '#7a4bb0'),
			wire('w9', ['esp', '3V3'], ['adc', 'VDD'], '#c8352c'),
			wire('w10', ['adc', 'GND'], ['esp', 'GND.1'], '#2f3235', [{ u: 0.88, v: 0 }]),
			wire('w11', ['esp', 'GPIO9'], ['adc', 'SDA'], '#2f6fd0'),
			wire('w12', ['esp', 'GPIO10'], ['adc', 'SCL'], '#7a4bb0'),
			wire('w13', ['reg', 'VO'], ['r1', '1'], '#c8352c'),
			wire('w14', ['r1', '2'], ['adc', 'A0'], '#2f8f4e'),
			wire('w15', ['r2', '1'], ['adc', 'A0'], '#2f8f4e'),
			wire('w16', ['r2', '2'], ['esp', 'GND.2'], '#2f3235', [{ u: 0.8, v: 0 }]),
			wire('w17', ['reg', 'VO'], ['load', '1'], '#c8952c'),
			wire('w18', ['load', '2'], ['esp', 'GND.2'], '#2f3235', [{ u: 0.78, v: 0 }])
		],
		{
			probes: [
				probe('p1', 'reg', 'VO', 'VOUT', '#b06a2c'),
				probe('p2', 'dac', 'VOUT', 'SET', '#3d6fb4')
			],
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
								'import time',
								'from machine import Pin, I2C',
								'',
								'i2c = I2C(0, scl=Pin(10), sda=Pin(9), freq=400_000)',
								'',
								'def set_volts(volts):',
								'    code = int((volts - 1.25) / 3.3 * 4095)',
								'    i2c.writeto(0x60, bytes([code >> 8, code & 0xFF]))',
								'',
								'def read_volts():',
								'    i2c.writeto(0x48, b"\\x01\\xc3\\x83")',
								'    time.sleep_ms(20)',
								'    i2c.writeto(0x48, b"\\x00")',
								'    raw = i2c.readfrom(0x48, 2)',
								'    return int.from_bytes(raw, "big") / 32767 * 4.096 * 2',
								'',
								'while True:',
								'    for step in range(1, 10):',
								'        set_volts(1.25 + step * 0.35)',
								'        time.sleep_ms(50)',
								'        print("%.2f V" % read_volts())',
								'    time.sleep_ms(400)',
								''
							].join('\n')
						}
					]
				}
			}
		}
	);
}
