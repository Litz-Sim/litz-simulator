import type { PartDef, PinDef } from '../types';
import { drawBoard } from './board-art';

const PIN_SPACING = 20;
const PIN_INSET = 6;
const VERTICAL_PADDING = 34;

interface PinSpec {
	name: string;
	gpio?: number;
}

interface BoardSpec {
	type: string;
	name: string;
	keywords: string[];
	width: number;
	/** How many manifest pins sit on the left header. */
	leftCount: number;
	pins: PinSpec[];
	chip?: string;
}

function pin(name: string, gpio?: number): PinSpec {
	return gpio === undefined ? { name } : { name, gpio };
}

function gpioPin(number: number): PinSpec {
	return pin(`GPIO${number}`, number);
}

function picoPin(number: number): PinSpec {
	return pin(`GP${number}`, number);
}

function board(spec: BoardSpec): PartDef {
	const leftCount = Math.min(spec.leftCount, spec.pins.length);
	const rightCount = spec.pins.length - leftCount;
	const rows = Math.max(leftCount, rightCount, 1);
	const height = rows * PIN_SPACING + VERTICAL_PADDING;
	const top = -((rows - 1) * PIN_SPACING) / 2;
	const inset = spec.width / 2 - PIN_INSET;

	// Pins keep manifest order; each one is placed on the header it belongs to.
	const pins: PinDef[] = spec.pins.map((entry, index) => {
		const isLeft = index < leftCount;
		const row = isLeft ? index : index - leftCount;
		return {
			name: entry.name,
			...(entry.gpio === undefined ? {} : { gpio: entry.gpio }),
			x: isLeft ? -inset : inset,
			y: top + row * PIN_SPACING
		};
	});

	const left = spec.pins.slice(0, leftCount).map((entry) => entry.name);
	const right = spec.pins.slice(leftCount).map((entry) => entry.name);

	return {
		type: spec.type,
		name: spec.name,
		category: 'Boards',
		keywords: spec.keywords,
		width: spec.width,
		height,
		pins,
		attrs: [{ name: 'power', type: 'bool', default: true }],
		...(spec.chip === undefined ? {} : { chip: spec.chip }),
		draw: (ctx, _part, zoom) =>
			drawBoard(ctx, {
				left,
				right,
				label: spec.name,
				zoom,
				width: spec.width,
				height
			})
	};
}

interface PlacedPin extends PinSpec {
	/** Header row, 0 at the top. Duplicate power pads leave gaps. */
	row?: number;
}

interface HeaderSpec {
	type: string;
	name: string;
	keywords: string[];
	chip?: string;
	width: number;
	height: number;
	/** Distance from the centre to each header column, and the top pad's y. */
	x: number;
	top: number;
	left: PlacedPin[];
	right: PlacedPin[];
}

/**
 * A board traced from its dimension drawing: the header pads keep the
 * drawing's measured columns and row offset instead of the centring `board()`
 * applies, so pins land on the pads the art shows.
 */
function detailedBoard(spec: HeaderSpec): PartDef {
	const pins: PinDef[] = [];
	const place = (list: PlacedPin[], x: number): void => {
		list.forEach((entry, index) => {
			pins.push({
				name: entry.name,
				...(entry.gpio === undefined ? {} : { gpio: entry.gpio }),
				x,
				y: spec.top + (entry.row ?? index) * PIN_SPACING
			});
		});
	};
	place(spec.left, -spec.x);
	place(spec.right, spec.x);

	return {
		type: spec.type,
		name: spec.name,
		category: 'Boards',
		keywords: spec.keywords,
		width: spec.width,
		height: spec.height,
		pins,
		attrs: [{ name: 'power', type: 'bool', default: true }],
		...(spec.chip === undefined ? {} : { chip: spec.chip }),
		draw: (ctx, _part, zoom) =>
			drawBoard(ctx, {
				left: spec.left.map((entry) => entry.name),
				right: spec.right.map((entry) => entry.name),
				label: spec.name,
				zoom,
				width: spec.width,
				height: spec.height
			})
	};
}

interface GridPin extends PinSpec {
	x: number;
	y: number;
}

/**
 * A board whose pads follow the drawing's own grid: the P4 breaks its GPIOs out
 * to a 2 x 20 header along the top edge instead of two columns.
 */
function pinnedBoard(spec: {
	type: string;
	name: string;
	keywords: string[];
	chip?: string;
	width: number;
	height: number;
	pins: GridPin[];
}): PartDef {
	const pins: PinDef[] = spec.pins.map(({ name, gpio, x, y }) => ({
		name,
		...(gpio === undefined ? {} : { gpio }),
		x,
		y
	}));
	const names = spec.pins.map((entry) => entry.name);
	const half = Math.ceil(names.length / 2);

	return {
		type: spec.type,
		name: spec.name,
		category: 'Boards',
		keywords: spec.keywords,
		width: spec.width,
		height: spec.height,
		pins,
		attrs: [{ name: 'power', type: 'bool', default: true }],
		...(spec.chip === undefined ? {} : { chip: spec.chip }),
		draw: (ctx, _part, zoom) =>
			drawBoard(ctx, {
				left: names.slice(0, half),
				right: names.slice(half),
				label: spec.name,
				zoom,
				width: spec.width,
				height: spec.height
			})
	};
}

/** A vertical header column, first entry at `top`, 2.54 mm apart. */
function sidePins(x: number, top: number, entries: PinSpec[]): GridPin[] {
	return entries.map((entry, index) => ({ ...entry, x, y: top + index * PIN_SPACING }));
}

/** A horizontal header row: the entries placed left to right at the given x. */
function strip(y: number, xs: number[], entries: PinSpec[]): GridPin[] {
	return entries.map((entry, index) => ({ ...entry, x: xs[index], y }));
}

const P4_COLUMN = 20;
const P4_X = (col: number): number => -280.3 + col * P4_COLUMN;
/** Outer row (even pins) 2.0 mm below the top edge, inner row 1.27 mm past it. */
const P4_OUTER = -275.6;
const P4_INNER = -255.6;

export const BOARD_PARTS: PartDef[] = [
	detailedBoard({
		type: 'board-esp32-c3-devkitm-1',
		name: 'ESP32-C3 DevKitM',
		keywords: ['esp32', 'c3', 'devkitm', 'board', 'mcu', 'devkit'],
		chip: 'esp32c3',
		width: 200,
		height: 306,
		x: 90,
		top: -137,
		// J1 and J3 from the DevKitM user guide, top pad first.
		left: [
			pin('GND.1'),
			pin('3V3'),
			pin('3V3.2'),
			gpioPin(2),
			gpioPin(3),
			pin('GND.2'),
			pin('RST'),
			pin('GND.3'),
			gpioPin(0),
			gpioPin(1),
			gpioPin(10),
			pin('GND.4'),
			pin('5V'),
			pin('5V.2'),
			pin('GND.5')
		],
		right: [
			pin('GND.6'),
			pin('TX', 21),
			pin('RX', 20),
			pin('GND.7'),
			gpioPin(9),
			gpioPin(8),
			pin('GND.8'),
			gpioPin(7),
			gpioPin(6),
			gpioPin(5),
			gpioPin(4),
			pin('GND.9'),
			gpioPin(18),
			gpioPin(19),
			pin('GND.10')
		]
	}),
	detailedBoard({
		type: 'board-esp32-c6-devkitc-1',
		name: 'ESP32-C6-DevKitC-1',
		keywords: ['esp32', 'c6', 'devkitc', 'board', 'mcu', 'devkit'],
		chip: 'esp32c6',
		width: 200,
		height: 407.9,
		x: 90,
		top: -191.5,
		// J1 and J3 from the DevKitC-1 user guide, top pad first. The last pad
		// on each header is not connected.
		left: [
			pin('3V3'),
			pin('RST'),
			gpioPin(4),
			gpioPin(5),
			gpioPin(6),
			gpioPin(7),
			gpioPin(0),
			gpioPin(1),
			gpioPin(8),
			gpioPin(10),
			gpioPin(11),
			gpioPin(2),
			gpioPin(3),
			pin('5V'),
			pin('GND.1')
		],
		right: [
			pin('GND.2'),
			pin('TX', 16),
			pin('RX', 17),
			gpioPin(15),
			gpioPin(23),
			gpioPin(22),
			gpioPin(21),
			gpioPin(20),
			gpioPin(19),
			gpioPin(18),
			gpioPin(9),
			pin('GND.3'),
			gpioPin(13),
			gpioPin(12),
			pin('GND.4')
		]
	}),
	detailedBoard({
		type: 'board-esp32-c6-devkitm-1',
		name: 'ESP32-C6-DevKitM-1',
		keywords: ['esp32', 'c6', 'devkitm', 'board', 'mcu', 'devkit'],
		chip: 'esp32c6',
		width: 200,
		height: 380,
		x: 90,
		top: -177.6,
		// J1 and J3 from the DevKitM-1 user guide, top pad first.
		left: [
			pin('3V3'),
			pin('RST'),
			gpioPin(2),
			gpioPin(3),
			gpioPin(4),
			gpioPin(5),
			gpioPin(0),
			gpioPin(1),
			gpioPin(8),
			gpioPin(6),
			gpioPin(7),
			gpioPin(14),
			pin('GND.1'),
			pin('5V'),
			pin('GND.2')
		],
		right: [
			pin('GND.3'),
			pin('TX', 16),
			pin('RX', 17),
			gpioPin(23),
			gpioPin(22),
			gpioPin(21),
			gpioPin(20),
			gpioPin(19),
			gpioPin(18),
			gpioPin(15),
			gpioPin(9),
			pin('GND.4'),
			gpioPin(13),
			gpioPin(12),
			pin('GND.5')
		]
	}),
	pinnedBoard({
		type: 'board-esp32-p4-function-ev',
		name: 'ESP32-P4-Function-EV',
		keywords: ['esp32', 'p4', 'board', 'mcu', 'devkit'],
		chip: 'esp32p4',
		width: 693,
		height: 583,
		// J1 from the Function-EV user guide: 2 x 20 along the top edge, even
		// pins in the outer row. Columns 14 and 28 are the two unconnected pads.
		pins: (
			[
				[pin('5V'), pin('3V3')],
				[pin('5V.2'), gpioPin(7)],
				[pin('GND.1'), gpioPin(8)],
				[gpioPin(37), gpioPin(23)],
				[gpioPin(38), pin('GND.2')],
				[gpioPin(22), gpioPin(21)],
				[pin('GND.3'), gpioPin(20)],
				[gpioPin(5), gpioPin(6)],
				[gpioPin(4), pin('3V3.2')],
				[pin('GND.4'), gpioPin(3)],
				[gpioPin(1), gpioPin(2)],
				[gpioPin(36), gpioPin(0)],
				[gpioPin(32), pin('GND.5')],
				[null, null],
				[pin('GND.6'), gpioPin(33)],
				[gpioPin(54), gpioPin(26)],
				[pin('GND.7'), gpioPin(48)],
				[gpioPin(46), gpioPin(53)],
				[gpioPin(27), gpioPin(47)],
				[gpioPin(45), pin('GND.8')]
			] as [PinSpec | null, PinSpec | null][]
		).flatMap(([outer, inner], col) =>
			[
				outer ? { ...outer, x: P4_X(col), y: P4_OUTER } : null,
				inner ? { ...inner, x: P4_X(col), y: P4_INNER } : null
			].filter((entry): entry is GridPin => entry !== null)
		)
	}),
	pinnedBoard({
		type: 'board-esp32-s31-coreboard',
		name: 'ESP32-S31 Function CoreBoard',
		keywords: ['esp32', 's31', 'coreboard', 'board', 'mcu', 'devkit'],
		chip: 'esp32s31',
		width: 512,
		height: 433,
		// J2 from the coreboard user guide: 2 x 19 along the top edge, even pins
		// in the outer row.
		pins: (
			[
				[pin('GND.2'), pin('GND.1')],
				[pin('RX0', 59), pin('TX0', 58)],
				[gpioPin(60), pin('BOOT', 61)],
				[pin('GND.3'), gpioPin(2)],
				[gpioPin(3), gpioPin(0)],
				[gpioPin(1), gpioPin(49)],
				[gpioPin(48), gpioPin(47)],
				[gpioPin(46), gpioPin(45)],
				[gpioPin(44), gpioPin(43)],
				[gpioPin(42), gpioPin(40)],
				[gpioPin(38), gpioPin(39)],
				[gpioPin(36), gpioPin(37)],
				[pin('D0', 20), gpioPin(35)],
				[pin('D2', 22), pin('D1', 21)],
				[pin('CLK', 24), pin('D3', 23)],
				[gpioPin(4), pin('CMD', 25)],
				[pin('GND.5'), pin('GND.4')],
				[pin('3V3.2'), pin('3V3')],
				[pin('GND.7'), pin('GND.6')]
			] as [PinSpec, PinSpec][]
		).flatMap(([outer, inner], col) => [
			{ ...outer, x: -192.6 + col * 20, y: -205.5 },
			{ ...inner, x: -192.6 + col * 20, y: -185.5 }
		])
	}),
	pinnedBoard({
		type: 'board-arduino-uno',
		name: 'Arduino Uno',
		keywords: ['arduino', 'uno', 'board', 'mcu', 'devkit'],
		chip: 'atmega328p',
		width: 540,
		height: 420,
		// Shield headers: D8-D13 plus the I2C/AREF pads on the left half of the
		// top edge, D0-D7 on the right half with the 160 mil break between
		// them, and power plus analog along the bottom edge.
		pins: [
			...strip(
				-190,
				[230, 210, 190, 170, 150, 130, 110, 90, 58, 38, 18, -2, -22, -42, -62, -82, -102, -122],
				[
					pin('D0', 0),
					pin('D1', 1),
					pin('D2', 2),
					pin('D3', 3),
					pin('D4', 4),
					pin('D5', 5),
					pin('D6', 6),
					pin('D7', 7),
					pin('D8', 8),
					pin('D9', 9),
					pin('D10', 10),
					pin('D11', 11),
					pin('D12', 12),
					pin('D13', 13),
					pin('GND.3'),
					pin('AREF'),
					pin('SDA'),
					pin('SCL')
				]
			),
			...strip(
				190,
				[130, 150, 170, 190, 210, 230],
				[pin('A0', 14), pin('A1', 15), pin('A2', 16), pin('A3', 17), pin('A4', 18), pin('A5', 19)]
			),
			...strip(
				190,
				[-30, -10, 10, 30, 50, 70, 90],
				[pin('IOREF'), pin('RESET'), pin('3V3'), pin('5V'), pin('GND.1'), pin('GND.2'), pin('VIN')]
			)
		]
	}),
	detailedBoard({
		type: 'board-arduino-nano',
		name: 'Arduino Nano',
		keywords: ['arduino', 'nano', 'board', 'mcu', 'devkit'],
		chip: 'atmega328p',
		width: 140,
		height: 340.2,
		x: 60,
		top: -160,
		// Mechanical drawing: 43.18 x 17.78 mm, two 15.24 mm rows on a 2.54 mm
		// pitch. The digital side carries 16 pins, the analog side 14.
		left: [
			pin('D1', 1),
			pin('D0', 0),
			pin('RST.1'),
			pin('GND.1'),
			pin('D2', 2),
			pin('D3', 3),
			pin('D4', 4),
			pin('D5', 5),
			pin('D6', 6),
			pin('D7', 7),
			pin('D8', 8),
			pin('D9', 9),
			pin('D10', 10),
			pin('D11', 11),
			pin('D12', 12),
			pin('D13', 13)
		],
		right: [
			pin('VIN'),
			pin('GND.2'),
			pin('RST.2'),
			pin('5V'),
			pin('A7', 21),
			pin('A6', 20),
			pin('A5', 19),
			pin('A4', 18),
			pin('A3', 17),
			pin('A2', 16),
			pin('A1', 15),
			pin('A0', 14),
			pin('AREF'),
			pin('3V3')
		]
	}),
	pinnedBoard({
		type: 'board-arduino-pro-mini',
		name: 'Arduino Pro Mini',
		keywords: ['arduino', 'pro', 'mini', 'board', 'mcu', 'devkit'],
		chip: 'atmega328p',
		width: 140,
		height: 259.8,
		// 33.02 x 17.78 mm; 12 pins per side plus the A4-A7 solder pads inboard
		// of the analog header.
		pins: [
			...sidePins(-60, -110, [
				pin('RAW'),
				pin('GND.1'),
				pin('RST.1'),
				pin('VCC'),
				pin('A3', 17),
				pin('A2', 16),
				pin('A1', 15),
				pin('A0', 14),
				pin('D13', 13),
				pin('D12', 12),
				pin('D11', 11),
				pin('D10', 10)
			]),
			...sidePins(60, -110, [
				pin('D1', 1),
				pin('D0', 0),
				pin('RST.2'),
				pin('GND.2'),
				pin('D2', 2),
				pin('D3', 3),
				pin('D4', 4),
				pin('D5', 5),
				pin('D6', 6),
				pin('D7', 7),
				pin('D8', 8),
				pin('D9', 9)
			]),
			...strip(60, [-30, -10, 10, 30], [pin('A4', 18), pin('A5', 19), pin('A6', 20), pin('A7', 21)])
		]
	}),
	detailedBoard({
		type: 'board-raspberry-pi-pico',
		name: 'Raspberry Pi Pico',
		keywords: ['raspberry', 'pico', 'rp2040', 'board', 'mcu', 'devkit'],
		chip: 'rp2040',
		width: 165.4,
		height: 401.6,
		x: 70,
		top: -190,
		// 51 x 21 mm, 40 pins on a 2.54 mm pitch; pin 1 is GP0 at the USB end.
		left: [
			picoPin(0),
			picoPin(1),
			pin('GND.1'),
			picoPin(2),
			picoPin(3),
			picoPin(4),
			picoPin(5),
			pin('GND.2'),
			picoPin(6),
			picoPin(7),
			picoPin(8),
			picoPin(9),
			pin('GND.3'),
			picoPin(10),
			picoPin(11),
			picoPin(12),
			picoPin(13),
			pin('GND.4'),
			picoPin(14),
			picoPin(15)
		],
		right: [
			pin('VBUS'),
			pin('VSYS'),
			pin('GND.5'),
			pin('3V3_EN'),
			pin('3V3'),
			pin('ADC_VREF'),
			picoPin(28),
			pin('GND.6'),
			picoPin(27),
			picoPin(26),
			pin('RUN'),
			picoPin(22),
			pin('GND.7'),
			picoPin(21),
			picoPin(20),
			picoPin(19),
			picoPin(18),
			pin('GND.8'),
			picoPin(17),
			picoPin(16)
		]
	}),
	board({
		type: 'board-litz-rv32',
		name: 'Litz RV32 reference',
		keywords: ['litz', 'rv32', 'riscv', 'board', 'mcu', 'reference'],
		width: 170,
		leftCount: 9,
		pins: [
			pin('3V3'),
			pin('GND.1'),
			pin('GND.2'),
			gpioPin(0),
			gpioPin(1),
			gpioPin(2),
			gpioPin(3),
			gpioPin(4),
			gpioPin(5),
			gpioPin(6),
			gpioPin(7),
			gpioPin(8),
			gpioPin(9),
			gpioPin(10),
			gpioPin(20),
			gpioPin(21),
			pin('RX', 20),
			pin('TX', 21)
		]
	})
];
