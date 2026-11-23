import * as art from './art';
import { BOARD_PARTS } from './library/board-parts';
import { COMMS_PARTS } from './library/comms';
import { DISPLAY_PARTS } from './library/displays';
import { INPUT_PARTS } from './library/inputs';
import { LOGIC_PARTS } from './library/logic';
import { OUTPUT_PARTS } from './library/outputs';
import { SENSOR_PARTS } from './library/sensors';
import type { PartDef, PinDef } from './types';

/** Header names that reach a GPIO without spelling it out. */
const BOARD_ALIASES: Record<string, number> = { TX: 21, RX: 20 };

function boardPin(name: string, x: number, y: number): PinDef {
	const match = /^GPIO(\d+)$/.exec(name);
	const gpio = match ? Number(match[1]) : BOARD_ALIASES[name];
	return gpio === undefined ? { name, x, y } : { name, x, y, gpio };
}

function devBoard(
	type: string,
	name: string,
	keyword: string,
	left: string[],
	right: string[],
	chip: string
): PartDef {
	const rows = Math.max(left.length, right.length);
	const top = -((rows - 1) * 20) / 2;
	const pins: PinDef[] = [];
	left.forEach((pin, i) => pins.push(boardPin(pin, -89, top + i * 20)));
	right.forEach((pin, i) => pins.push(boardPin(pin, 89, top + i * 20)));
	return {
		type,
		name,
		category: 'Boards',
		keywords: [keyword, 'board', 'mcu', 'devkit'],
		width: 190,
		height: 250,
		pins,
		attrs: [],
		chip,
		draw: (ctx, _part, zoom) => art.drawDevBoard(ctx, { left, right }, name, zoom)
	};
}

export const PART_DEFS: PartDef[] = [
	...BOARD_PARTS,
	devBoard(
		'board-esp32-c3-devkitm-1',
		'ESP32-C3 DevKitM',
		'esp32',
		['3V3', '5V', 'GND.1', 'GND.2', 'GPIO0', 'GPIO1', 'GPIO2', 'GPIO3', 'GPIO4', 'GPIO5'],
		[
			'GPIO6',
			'GPIO7',
			'GPIO8',
			'GPIO9',
			'GPIO10',
			'GPIO18',
			'GPIO19',
			'GPIO20',
			'GPIO21',
			'TX',
			'RX'
		],
		'esp32c3'
	),
	{
		type: 'litz-led',
		name: 'LED 5 mm',
		category: 'Lights',
		keywords: ['led', 'light', 'diode'],
		width: 40,
		height: 62,
		pins: [
			{ name: 'A', label: 'anode', x: -10, y: 42 },
			{ name: 'C', label: 'cathode', x: 10, y: 42 }
		],
		attrs: [
			{
				name: 'color',
				type: 'enum',
				values: ['red', 'green', 'blue', 'yellow', 'white', 'orange'],
				default: 'red'
			},
			{ name: 'label', type: 'string', default: '' }
		],
		draw: art.drawLed
	},
	{
		type: 'litz-resistor',
		name: 'Resistor',
		category: 'Passives',
		keywords: ['resistor', 'ohm', 'r'],
		width: 84,
		height: 24,
		pins: [
			{ name: '1', x: -40, y: 0 },
			{ name: '2', x: 40, y: 0 }
		],
		attrs: [{ name: 'value', type: 'string', default: '220' }],
		draw: (ctx) => art.drawResistor(ctx)
	},
	{
		type: 'litz-capacitor',
		name: 'Ceramic capacitor',
		category: 'Passives',
		keywords: ['capacitor', 'cap', 'ceramic'],
		width: 44,
		height: 62,
		pins: [
			{ name: '1', x: -20, y: 30 },
			{ name: '2', x: 20, y: 30 }
		],
		attrs: [{ name: 'value', type: 'string', default: '100n' }],
		draw: (ctx) => art.drawCapacitor(ctx)
	},
	{
		type: 'litz-diode-1n4148',
		name: 'Diode 1N4148',
		category: 'Passives',
		keywords: ['diode', '1n4148'],
		width: 84,
		height: 20,
		pins: [
			{ name: 'A', label: 'anode', x: -40, y: 0 },
			{ name: 'C', label: 'cathode', x: 40, y: 0 }
		],
		attrs: [{ name: 'vf', type: 'number', default: 0.72 }],
		draw: (ctx) => art.drawDiode(ctx)
	},
	{
		type: 'litz-pushbutton',
		name: 'Pushbutton',
		category: 'Switches',
		keywords: ['button', 'switch', 'tactile'],
		width: 44,
		height: 40,
		pins: [
			{ name: '1.l', x: -20, y: -10 },
			{ name: '1.r', x: 20, y: -10 },
			{ name: '2.l', x: -20, y: 10 },
			{ name: '2.r', x: 20, y: 10 }
		],
		attrs: [
			{
				name: 'color',
				type: 'enum',
				values: ['green', 'blue', 'red', 'yellow', 'white', 'black'],
				default: 'green'
			},
			{ name: 'xray', type: 'bool', default: false }
		],
		draw: (ctx, part) => art.drawButton(ctx, part)
	},
	{
		type: 'litz-potentiometer',
		name: 'Potentiometer',
		category: 'Switches',
		keywords: ['pot', 'trimmer', 'knob'],
		width: 60,
		height: 56,
		pins: [
			{ name: '1', x: -20, y: 28 },
			{ name: '2', label: 'wiper', x: 0, y: 28 },
			{ name: '3', x: 20, y: 28 }
		],
		/* Litz reads `value` as a 0–100 percent of travel, not a resistance. */
		attrs: [{ name: 'value', type: 'string', default: '50' }],
		draw: (ctx, part) => art.drawPotentiometer(ctx, part)
	},
	{
		type: 'litz-buzzer',
		name: 'Buzzer',
		category: 'Audio',
		keywords: ['buzzer', 'piezo', 'sound'],
		width: 48,
		height: 60,
		pins: [
			{ name: '1', x: -10, y: 34 },
			{ name: '2', x: 10, y: 34 }
		],
		attrs: [{ name: 'buzzerType', type: 'enum', values: ['active', 'passive'], default: 'active' }],
		draw: (ctx) => art.drawBuzzer(ctx)
	},
	{
		type: 'litz-rgb-led',
		name: 'RGB LED',
		category: 'Lights',
		keywords: ['rgb', 'led', 'color'],
		width: 80,
		height: 70,
		pins: [
			{ name: 'R', x: -30, y: 44 },
			{ name: 'G', x: -10, y: 44 },
			{ name: 'B', x: 10, y: 44 },
			{ name: 'COM', x: 30, y: 44 }
		],
		attrs: [],
		draw: (ctx, part) => art.drawRgbLed(ctx, part)
	},
	{
		type: 'litz-neopixel',
		name: 'NeoPixel',
		category: 'Lights',
		keywords: ['neopixel', 'rgb', 'ws2812'],
		width: 68,
		height: 62,
		pins: [
			{ name: 'VDD', x: -30, y: 30 },
			{ name: 'DOUT', x: -10, y: 30 },
			{ name: 'VSS', x: 10, y: 30 },
			{ name: 'DIN', x: 30, y: 30 }
		],
		attrs: [{ name: 'pixels', type: 'number', default: 1 }],
		draw: (ctx, part) => art.drawNeopixel(ctx, part)
	},
	{
		type: 'litz-7segment',
		name: '7-segment display',
		category: 'Displays',
		keywords: ['7segment', 'display', 'digit'],
		width: 90,
		height: 110,
		pins: [
			{ name: 'a', x: -30, y: -52 },
			{ name: 'b', x: -10, y: -52 },
			{ name: 'c', x: 10, y: -52 },
			{ name: 'd', x: 30, y: -52 },
			{ name: 'e', x: -40, y: 52 },
			{ name: 'f', x: -20, y: 52 },
			{ name: 'g', x: 0, y: 52 },
			{ name: 'dp', x: 20, y: 52 },
			{ name: 'com', x: 40, y: 52 }
		],
		attrs: [
			{ name: 'color', type: 'enum', values: ['red', 'green', 'blue', 'yellow'], default: 'red' }
		],
		draw: (ctx, part) => art.drawSevenSegment(ctx, part)
	},
	{
		type: 'litz-ssd1306',
		name: 'SSD1306 OLED',
		category: 'Displays',
		keywords: ['oled', 'ssd1306', 'display', 'i2c'],
		width: 96,
		height: 76,
		pins: [
			{ name: 'GND', x: -30, y: 44 },
			{ name: 'VCC', x: -10, y: 44 },
			{ name: 'SCL', x: 10, y: 44 },
			{ name: 'SDA', x: 30, y: 44 }
		],
		attrs: [],
		draw: (ctx) => art.drawOled(ctx)
	},
	{
		type: 'litz-lcd1602',
		name: 'LCD 1602',
		category: 'Displays',
		keywords: ['lcd', '1602', 'display', 'character'],
		width: 176,
		height: 112,
		pins: [
			{ name: 'VSS', x: -70, y: 54 },
			{ name: 'VDD', x: -50, y: 54 },
			{ name: 'V0', x: -30, y: 54 },
			{ name: 'RS', x: -10, y: 54 },
			{ name: 'RW', x: 10, y: 54 },
			{ name: 'E', x: 30, y: 54 },
			{ name: 'D0', x: 50, y: 54 },
			{ name: 'D1', x: 70, y: 54 },
			{ name: 'D2', x: -70, y: -54 },
			{ name: 'D3', x: -50, y: -54 },
			{ name: 'D4', x: -30, y: -54 },
			{ name: 'D5', x: -10, y: -54 },
			{ name: 'D6', x: 10, y: -54 },
			{ name: 'D7', x: 30, y: -54 },
			{ name: 'A', x: 50, y: -54 },
			{ name: 'K', x: 70, y: -54 }
		],
		attrs: [
			{ name: 'color', type: 'enum', values: ['black', 'white', 'blue'], default: 'black' },
			{ name: 'background', type: 'enum', values: ['green', 'blue'], default: 'green' },
			{ name: 'variant', type: 'enum', values: ['A00', 'A02'], default: 'A00' },
			{ name: 'pins', type: 'enum', values: ['full', 'i2c'], default: 'full' }
		],
		draw: (ctx) => art.drawLcd(ctx)
	},
	{
		type: 'litz-dht22',
		name: 'DHT22 sensor',
		category: 'Sensors',
		keywords: ['dht22', 'temperature', 'humidity', 'sensor'],
		width: 64,
		height: 76,
		pins: [
			{ name: 'VCC', x: -30, y: 42 },
			{ name: 'SDA', x: -10, y: 42 },
			{ name: 'NC', x: 10, y: 42 },
			{ name: 'GND', x: 30, y: 42 }
		],
		attrs: [
			{ name: 'temperature', type: 'number', default: 24 },
			{ name: 'humidity', type: 'number', default: 50 }
		],
		draw: (ctx) => art.drawDht(ctx)
	},
	{
		type: 'litz-photoresistor-sensor',
		name: 'Photoresistor module',
		category: 'Sensors',
		keywords: ['photoresistor', 'ldr', 'light', 'sensor'],
		width: 76,
		height: 50,
		pins: [
			{ name: 'VCC', x: -30, y: 28 },
			{ name: 'GND', x: -10, y: 28 },
			{ name: 'AO', x: 10, y: 28 },
			{ name: 'DO', x: 30, y: 28 }
		],
		attrs: [{ name: 'light', type: 'number', default: 500 }],
		draw: (ctx) => art.drawPhotoSensor(ctx)
	},
	{
		type: 'litz-servo',
		name: 'Servo',
		category: 'Actuators',
		keywords: ['servo', 'motor', 'pwm'],
		width: 96,
		height: 60,
		pins: [
			{ name: 'GND', x: -30, y: 36 },
			{ name: 'V+', x: -10, y: 36 },
			{ name: 'PWM', x: 10, y: 36 }
		],
		attrs: [],
		draw: (ctx) => art.drawServo(ctx)
	},
	{
		type: 'litz-bjt',
		name: 'Transistor (TO-92)',
		category: 'Passives',
		keywords: ['transistor', 'bjt', 'npn', 'pnp'],
		width: 52,
		height: 62,
		pins: [
			{ name: 'C', x: -20, y: 40 },
			{ name: 'B', x: 0, y: 40 },
			{ name: 'E', x: 20, y: 40 }
		],
		attrs: [
			{ name: 'polarity', type: 'enum', values: ['npn', 'pnp'], default: 'npn' },
			{ name: 'beta', type: 'number', default: 100 },
			{ name: 'vbe', type: 'number', default: 0.7 }
		],
		draw: (ctx) => art.drawBjt(ctx)
	},
	{
		type: 'litz-slide-switch',
		name: 'Slide switch',
		category: 'Switches',
		keywords: ['slide', 'switch'],
		width: 68,
		height: 44,
		pins: [
			{ name: '1', x: -20, y: 24 },
			{ name: '2', x: 0, y: 24 },
			{ name: '3', x: 20, y: 24 }
		],
		attrs: [{ name: 'color', type: 'enum', values: ['black', 'white'], default: 'black' }],
		draw: (ctx, part) => art.drawSlideSwitch(ctx, part)
	},
	{
		type: 'litz-tilt-switch',
		name: 'Tilt switch',
		category: 'Switches',
		keywords: ['tilt', 'switch', 'ball'],
		width: 80,
		height: 30,
		pins: [
			{ name: '1', x: -34, y: 0 },
			{ name: '2', x: 34, y: 0 }
		],
		attrs: [],
		draw: (ctx, part) => art.drawTiltSwitch(ctx, part)
	},
	{
		type: 'litz-battery',
		name: '9V battery',
		category: 'Power',
		keywords: ['battery', '9v', 'power'],
		width: 64,
		height: 112,
		pins: [
			{ name: '+', x: -12, y: -58 },
			{ name: '-', x: 12, y: -58 }
		],
		attrs: [
			{ name: 'type', type: 'enum', values: ['AA', '9V', 'coin'], default: 'AA' },
			{ name: 'voltage', type: 'number', default: 1.5 }
		],
		draw: (ctx) => art.drawBattery(ctx)
	},
	{
		type: 'litz-power-supply',
		name: 'Bench supply',
		category: 'Power',
		keywords: ['supply', 'bench', 'dc', 'power'],
		width: 100,
		height: 84,
		pins: [
			{ name: '+', label: 'positive', x: -30, y: 42 },
			{ name: '-', label: 'negative', x: 30, y: 42 }
		],
		attrs: [
			{ name: 'voltage', type: 'number', default: 5 },
			{ name: 'current_limit', type: 'number', default: 0 }
		],
		draw: (ctx, part) => art.drawPowerSupply(ctx, part)
	},
	...DISPLAY_PARTS,
	...SENSOR_PARTS,
	...INPUT_PARTS,
	...OUTPUT_PARTS,
	...LOGIC_PARTS,
	...COMMS_PARTS
];

const BY_TYPE = new Map(PART_DEFS.map((def) => [def.type, def]));

function generic(type: string): PartDef {
	return {
		type,
		name: type.replace(/^(litz|board)-/, '').replace(/-/g, ' '),
		category: 'Other',
		keywords: [],
		width: 120,
		height: 80,
		pins: [
			{ name: '1', x: -40, y: 0 },
			{ name: '2', x: 40, y: 0 }
		],
		attrs: [],
		draw: (ctx, _part, zoom) => art.drawGeneric(ctx, type, 2, zoom)
	};
}

/** Art for a catalog id. Unknown ids still render, so a catalog import never breaks the canvas. */
export function partDef(type: string): PartDef {
	return BY_TYPE.get(type) ?? generic(type);
}

export function partDefsByCategory(): { category: string; defs: PartDef[] }[] {
	const groups = new Map<string, PartDef[]>();
	for (const def of PART_DEFS) {
		const list = groups.get(def.category) ?? [];
		list.push(def);
		groups.set(def.category, list);
	}
	return [...groups.entries()].map(([category, defs]) => ({ category, defs }));
}
