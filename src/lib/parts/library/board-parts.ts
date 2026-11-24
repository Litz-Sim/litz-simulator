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

export const BOARD_PARTS: PartDef[] = [
	board({
		type: 'board-esp32-c6-devkitc-1',
		name: 'ESP32-C6-DevKitC-1',
		keywords: ['esp32', 'c6', 'devkitc', 'board', 'mcu', 'devkit'],
		chip: 'esp32c6',
		width: 190,
		leftCount: 16,
		pins: [
			pin('3V3'),
			pin('5V'),
			pin('GND.1'),
			pin('GND.2'),
			pin('GND.3'),
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
			gpioPin(11),
			gpioPin(12),
			gpioPin(13),
			gpioPin(14),
			gpioPin(15),
			gpioPin(18),
			gpioPin(19),
			gpioPin(20),
			gpioPin(21),
			gpioPin(22),
			gpioPin(23),
			pin('TX', 16),
			pin('RX', 17),
			gpioPin(16),
			gpioPin(17)
		]
	}),
	board({
		type: 'board-esp32-c6-devkitm-1',
		name: 'ESP32-C6-DevKitM-1',
		keywords: ['esp32', 'c6', 'devkitm', 'board', 'mcu', 'devkit'],
		chip: 'esp32c6',
		width: 190,
		leftCount: 15,
		pins: [
			pin('3V3'),
			pin('5V'),
			pin('GND.1'),
			pin('GND.2'),
			pin('GND.3'),
			pin('GND.4'),
			pin('GND.5'),
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
			gpioPin(12),
			gpioPin(13),
			gpioPin(14),
			gpioPin(15),
			gpioPin(18),
			gpioPin(19),
			gpioPin(20),
			gpioPin(21),
			gpioPin(22),
			gpioPin(23),
			pin('TX', 16),
			pin('RX', 17)
		]
	}),
	board({
		type: 'board-esp32-p4-function-ev',
		name: 'ESP32-P4-Function-EV',
		keywords: ['esp32', 'p4', 'board', 'mcu', 'devkit'],
		chip: 'esp32p4',
		width: 200,
		leftCount: 13,
		pins: [
			pin('3V3'),
			pin('5V'),
			pin('GND.1'),
			pin('GND.2'),
			pin('GND.3'),
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
			gpioPin(11),
			gpioPin(12),
			gpioPin(13),
			gpioPin(14),
			gpioPin(15),
			gpioPin(16),
			gpioPin(17),
			gpioPin(18),
			gpioPin(19),
			gpioPin(20)
		]
	}),
	board({
		type: 'board-esp32-s31-coreboard',
		name: 'ESP32-S31 Function CoreBoard',
		keywords: ['esp32', 's31', 'coreboard', 'board', 'mcu', 'devkit'],
		chip: 'esp32s31',
		width: 200,
		leftCount: 13,
		pins: [
			pin('3V3'),
			pin('5V'),
			pin('GND.1'),
			pin('GND.2'),
			pin('GND.3'),
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
			gpioPin(11),
			gpioPin(12),
			gpioPin(13),
			gpioPin(14),
			gpioPin(15),
			gpioPin(16),
			gpioPin(17),
			gpioPin(18),
			gpioPin(19),
			gpioPin(20)
		]
	}),
	board({
		type: 'board-arduino-uno',
		name: 'Arduino Uno',
		keywords: ['arduino', 'uno', 'board', 'mcu', 'devkit'],
		chip: 'atmega328p',
		width: 190,
		leftCount: 14,
		pins: [
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
			pin('A0', 14),
			pin('A1', 15),
			pin('A2', 16),
			pin('A3', 17),
			pin('A4', 18),
			pin('A5', 19),
			pin('5V'),
			pin('3V3'),
			pin('VIN'),
			pin('GND.1'),
			pin('GND.2'),
			pin('GND.3')
		]
	}),
	board({
		type: 'board-arduino-nano',
		name: 'Arduino Nano',
		keywords: ['arduino', 'nano', 'board', 'mcu', 'devkit'],
		chip: 'atmega328p',
		width: 170,
		leftCount: 14,
		pins: [
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
			pin('A0', 14),
			pin('A1', 15),
			pin('A2', 16),
			pin('A3', 17),
			pin('A4', 18),
			pin('A5', 19),
			pin('A6', 20),
			pin('A7', 21),
			pin('5V'),
			pin('3V3'),
			pin('VIN'),
			pin('GND.1'),
			pin('GND.2')
		]
	}),
	board({
		type: 'board-arduino-pro-mini',
		name: 'Arduino Pro Mini',
		keywords: ['arduino', 'pro', 'mini', 'board', 'mcu', 'devkit'],
		chip: 'atmega328p',
		width: 170,
		leftCount: 13,
		pins: [
			pin('RAW'),
			pin('GND.1'),
			pin('GND.2'),
			pin('GND.3'),
			pin('VCC'),
			pin('A3', 17),
			pin('A2', 16),
			pin('A1', 15),
			pin('A0', 14),
			pin('D13', 13),
			pin('D12', 12),
			pin('D11', 11),
			pin('D10', 10),
			pin('D1', 1),
			pin('D0', 0),
			pin('D2', 2),
			pin('D3', 3),
			pin('D4', 4),
			pin('D5', 5),
			pin('D6', 6),
			pin('D7', 7),
			pin('D8', 8),
			pin('D9', 9),
			pin('A4', 18),
			pin('A5', 19),
			pin('A6', 20),
			pin('A7', 21)
		]
	}),
	board({
		type: 'board-raspberry-pi-pico',
		name: 'Raspberry Pi Pico',
		keywords: ['raspberry', 'pico', 'rp2040', 'board', 'mcu', 'devkit'],
		chip: 'rp2040',
		width: 170,
		leftCount: 22,
		pins: [
			picoPin(0),
			picoPin(1),
			pin('GND.1'),
			pin('GND.2'),
			pin('GND.3'),
			pin('GND.4'),
			pin('GND.5'),
			pin('GND.6'),
			pin('GND.7'),
			pin('GND.8'),
			picoPin(2),
			picoPin(3),
			picoPin(4),
			picoPin(5),
			picoPin(6),
			picoPin(7),
			picoPin(8),
			picoPin(9),
			picoPin(10),
			picoPin(11),
			picoPin(12),
			picoPin(13),
			picoPin(14),
			picoPin(15),
			picoPin(16),
			picoPin(17),
			picoPin(18),
			picoPin(19),
			picoPin(20),
			picoPin(21),
			picoPin(22),
			picoPin(26),
			picoPin(27),
			picoPin(28),
			pin('ADC_VREF'),
			pin('AGND'),
			pin('3V3'),
			pin('3V3_EN', 37),
			pin('VSYS'),
			pin('VBUS'),
			pin('RUN', 38),
			pin('SWCLK', 39),
			pin('SWDIO', 40),
			picoPin(25)
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
