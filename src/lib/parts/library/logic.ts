import type { AttrDef, PartDef, PinDef } from '../types';

/**
 * Logic ICs, 74-series packages and the logic-adjacent breakout boards.
 *
 * Each body is drawn from the same geometry that places its pins, so a stub
 * always lands where a wire expects it. Nothing here touches the simulation:
 * the catalog ids line up with builtin engines on the Rust side.
 */

interface PinSpec {
	name: string;
	label?: string;
}

interface Geometry {
	bodyWidth: number;
	bodyHeight: number;
	pitch: number;
	top: number;
	pinX: number;
	rows: number;
}

const PIN_OUT = 10;

function pin(name: string, label?: string): PinSpec {
	return label ? { name, label } : { name };
}

function geometry(left: number, right: number, bodyWidth: number): Geometry {
	const rows = Math.max(left, right, 1);
	const pitch = rows > 9 ? 18 : 22;
	return {
		bodyWidth,
		bodyHeight: Math.max((rows - 1) * pitch + 28, 72),
		pitch,
		top: -((rows - 1) * pitch) / 2,
		pinX: bodyWidth / 2 + PIN_OUT,
		rows
	};
}

function placePins(left: PinSpec[], right: PinSpec[], geo: Geometry): PinDef[] {
	const pins: PinDef[] = [];
	left.forEach((spec, i) => {
		const x = -geo.pinX;
		const y = geo.top + i * geo.pitch;
		pins.push(
			spec.label ? { name: spec.name, label: spec.label, x, y } : { name: spec.name, x, y }
		);
	});
	right.forEach((spec, i) => {
		const x = geo.pinX;
		const y = geo.top + i * geo.pitch;
		pins.push(
			spec.label ? { name: spec.name, label: spec.label, x, y } : { name: spec.name, x, y }
		);
	});
	return pins;
}

function leg(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
}

function drawPins(ctx: CanvasRenderingContext2D, geo: Geometry, left: number, right: number): void {
	ctx.strokeStyle = '#b7bdc2';
	ctx.lineWidth = 2.4;
	for (let i = 0; i < left; i++) {
		const y = geo.top + i * geo.pitch;
		leg(ctx, -geo.bodyWidth / 2, y, -geo.pinX, y);
	}
	for (let i = 0; i < right; i++) {
		const y = geo.top + i * geo.pitch;
		leg(ctx, geo.bodyWidth / 2, y, geo.pinX, y);
	}
}

/** A through-hole DIP: dark epoxy body, top notch, pin 1 dot, part label. */
function drawDip(
	ctx: CanvasRenderingContext2D,
	label: string,
	geo: Geometry,
	left: number,
	right: number,
	zoom: number
): void {
	ctx.save();
	ctx.lineCap = 'round';
	drawPins(ctx, geo, left, right);

	const fill = ctx.createLinearGradient(0, -geo.bodyHeight / 2, 0, geo.bodyHeight / 2);
	fill.addColorStop(0, '#363b3f');
	fill.addColorStop(1, '#17191b');
	ctx.fillStyle = fill;
	ctx.strokeStyle = '#0b0c0d';
	ctx.lineWidth = 1.3;
	ctx.beginPath();
	ctx.roundRect(-geo.bodyWidth / 2, -geo.bodyHeight / 2, geo.bodyWidth, geo.bodyHeight, 4);
	ctx.fill();
	ctx.stroke();

	// Notch cut into the top edge.
	ctx.strokeStyle = '#0b0c0d';
	ctx.lineWidth = 1.8;
	ctx.beginPath();
	ctx.arc(0, -geo.bodyHeight / 2, Math.min(9, geo.bodyWidth * 0.1), 0, Math.PI);
	ctx.stroke();

	// Pin 1 marker.
	ctx.fillStyle = '#c9b06a';
	ctx.beginPath();
	ctx.arc(-geo.bodyWidth / 2 + 9, -geo.bodyHeight / 2 + 11, 2.4, 0, Math.PI * 2);
	ctx.fill();

	if (zoom >= 0.4) {
		ctx.fillStyle = '#e7e2d6';
		ctx.font = 'bold 10px ui-sans-serif, system-ui, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(label, 0, 0);
	}
	ctx.restore();
}

/** A breakout board: green PCB, copper pads, mounting holes and its chip. */
function drawPcb(
	ctx: CanvasRenderingContext2D,
	label: string,
	geo: Geometry,
	left: number,
	right: number,
	zoom: number
): void {
	ctx.save();
	ctx.lineCap = 'round';
	drawPins(ctx, geo, left, right);

	const fill = ctx.createLinearGradient(0, -geo.bodyHeight / 2, 0, geo.bodyHeight / 2);
	fill.addColorStop(0, '#2a7450');
	fill.addColorStop(1, '#124631');
	ctx.fillStyle = fill;
	ctx.strokeStyle = '#0c2f21';
	ctx.lineWidth = 1.3;
	ctx.beginPath();
	ctx.roundRect(-geo.bodyWidth / 2, -geo.bodyHeight / 2, geo.bodyWidth, geo.bodyHeight, 4);
	ctx.fill();
	ctx.stroke();

	// Copper pads at the header pins.
	ctx.fillStyle = '#d3b45a';
	for (let i = 0; i < left; i++) {
		const y = geo.top + i * geo.pitch;
		ctx.beginPath();
		ctx.roundRect(-geo.bodyWidth / 2 - 2.5, y - 3.5, 7, 7, 2);
		ctx.fill();
	}
	for (let i = 0; i < right; i++) {
		const y = geo.top + i * geo.pitch;
		ctx.beginPath();
		ctx.roundRect(geo.bodyWidth / 2 - 4.5, y - 3.5, 7, 7, 2);
		ctx.fill();
	}

	// Mounting holes.
	ctx.fillStyle = '#0c2f21';
	ctx.strokeStyle = '#d3b45a';
	ctx.lineWidth = 1;
	for (const hx of [-geo.bodyWidth / 2 + 9, geo.bodyWidth / 2 - 9]) {
		for (const hy of [-geo.bodyHeight / 2 + 9, geo.bodyHeight / 2 - 9]) {
			ctx.beginPath();
			ctx.arc(hx, hy, 3, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
		}
	}

	// The chip the breakout carries.
	const chipW = Math.min(geo.bodyWidth - 28, 52);
	const chipH = Math.max(26, Math.min(geo.bodyHeight * 0.36, 56));
	ctx.fillStyle = '#15181a';
	ctx.strokeStyle = '#0a0b0c';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-chipW / 2, -chipH / 2, chipW, chipH, 3);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#4a5054';
	ctx.beginPath();
	ctx.arc(-chipW / 2 + 5, -chipH / 2 + 7, 1.8, 0, Math.PI * 2);
	ctx.fill();

	if (zoom >= 0.4) {
		ctx.fillStyle = '#e7e2d6';
		ctx.font = 'bold 9px ui-sans-serif, system-ui, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(label, 0, 0);
	}
	ctx.restore();
}

interface PackageOptions {
	type: string;
	name: string;
	label: string;
	keywords: string[];
	left: PinSpec[];
	right: PinSpec[];
	attrs?: AttrDef[];
	bodyWidth?: number;
}

function packagedPart(opts: PackageOptions & { category: string; pcb: boolean }): PartDef {
	const geo = geometry(opts.left.length, opts.right.length, opts.bodyWidth ?? 112);
	return {
		type: opts.type,
		name: opts.name,
		category: opts.category,
		keywords: opts.keywords,
		width: geo.pinX * 2,
		height: geo.bodyHeight,
		pins: placePins(opts.left, opts.right, geo),
		attrs: opts.attrs ?? [],
		draw: (ctx, _part, zoom) => {
			if (opts.pcb) {
				drawPcb(ctx, opts.label, geo, opts.left.length, opts.right.length, zoom);
			} else {
				drawDip(ctx, opts.label, geo, opts.left.length, opts.right.length, zoom);
			}
		}
	};
}

function logicPart(opts: PackageOptions): PartDef {
	return packagedPart({ ...opts, category: 'Logic', pcb: false });
}

function modulePart(opts: PackageOptions): PartDef {
	return packagedPart({ ...opts, category: 'Modules', pcb: true });
}

/** 74HC00/02/08/32/86 share the same fourteen-pin assignment. */
function quadGate(type: string, name: string, label: string, keywords: string[]): PartDef {
	return logicPart({
		type,
		name,
		label,
		keywords,
		bodyWidth: 108,
		left: [pin('1A'), pin('1B'), pin('1Y'), pin('2A'), pin('2B'), pin('2Y'), pin('3A')],
		right: [pin('3B'), pin('3Y'), pin('4A'), pin('4B'), pin('4Y'), pin('VCC'), pin('GND')]
	});
}

/** 74HC04/14 are six independent inverters in a fourteen-pin package. */
function hexInverter(type: string, name: string, label: string, keywords: string[]): PartDef {
	return logicPart({
		type,
		name,
		label,
		keywords,
		bodyWidth: 108,
		left: [pin('1A'), pin('1Y'), pin('2A'), pin('2Y'), pin('3A'), pin('3Y'), pin('4A')],
		right: [pin('4Y'), pin('5A'), pin('5Y'), pin('6A'), pin('6Y'), pin('VCC'), pin('GND')]
	});
}

/** A single-gate package: inputs on the left, output and rails on the right. */
function singleGate(
	type: string,
	name: string,
	label: string,
	inputs: number,
	keywords: string[]
): PartDef {
	const left = inputs === 2 ? [pin('A'), pin('B')] : [pin('A')];
	return logicPart({
		type,
		name,
		label,
		keywords,
		bodyWidth: 86,
		left,
		right: [pin('Y'), pin('VCC'), pin('GND')]
	});
}

export const LOGIC_PARTS: PartDef[] = [
	// CD4000 series.
	logicPart({
		type: 'litz-4017',
		name: 'CD4017',
		label: 'CD4017',
		keywords: ['cd4017', 'decade', 'counter', 'logic'],
		bodyWidth: 112,
		left: [
			pin('CLK'),
			pin('RST'),
			pin('CLKINH'),
			pin('Q0'),
			pin('Q1'),
			pin('Q2'),
			pin('Q3'),
			pin('Q4')
		],
		right: [
			pin('Q5'),
			pin('Q6'),
			pin('Q7'),
			pin('Q8'),
			pin('Q9'),
			pin('CO'),
			pin('VDD'),
			pin('VSS')
		]
	}),
	logicPart({
		type: 'litz-4051',
		name: 'CD4051',
		label: 'CD4051',
		keywords: ['cd4051', 'multiplexer', 'analog', 'logic'],
		bodyWidth: 112,
		left: [pin('A'), pin('B'), pin('C'), pin('INH'), pin('X'), pin('X0'), pin('X1'), pin('X2')],
		right: [
			pin('X3'),
			pin('X4'),
			pin('X5'),
			pin('X6'),
			pin('X7'),
			pin('VDD'),
			pin('VSS'),
			pin('VEE')
		]
	}),
	logicPart({
		type: 'litz-4094',
		name: 'CD4094',
		label: 'CD4094',
		keywords: ['cd4094', 'shift register', 'latch', 'logic'],
		bodyWidth: 112,
		left: [
			pin('DATA'),
			pin('CLK'),
			pin('STROBE'),
			pin('OE'),
			pin('Q0'),
			pin('Q1'),
			pin('Q2'),
			pin('Q3')
		],
		right: [pin('Q4'), pin('Q5'), pin('Q6'), pin('Q7'), pin('QS'), pin('VDD'), pin('VSS')]
	}),

	// 74HC logic.
	quadGate('litz-74hc00', '74HC00', '74HC00', ['74hc00', 'nand', 'logic', 'gate']),
	quadGate('litz-74hc02', '74HC02', '74HC02', ['74hc02', 'nor', 'logic', 'gate']),
	hexInverter('litz-74hc04', '74HC04', '74HC04', ['74hc04', 'inverter', 'not', 'logic']),
	quadGate('litz-74hc08', '74HC08', '74HC08', ['74hc08', 'and', 'logic', 'gate']),
	logicPart({
		type: 'litz-74hc138',
		name: '74HC138',
		label: '74HC138',
		keywords: ['74hc138', 'decoder', 'demux', 'logic'],
		bodyWidth: 112,
		left: [
			pin('A0', 'address bit 0'),
			pin('A1', 'address bit 1'),
			pin('A2', 'address bit 2'),
			pin('E1', 'enable, active low'),
			pin('E2', 'enable, active low'),
			pin('E3', 'enable, active high'),
			pin('Y0'),
			pin('Y1')
		],
		right: [
			pin('Y2'),
			pin('Y3'),
			pin('Y4'),
			pin('Y5'),
			pin('Y6'),
			pin('Y7'),
			pin('VCC'),
			pin('GND')
		]
	}),
	logicPart({
		type: 'litz-74hc139',
		name: '74HC139',
		label: '74HC139',
		keywords: ['74hc139', 'decoder', 'demux', 'logic'],
		bodyWidth: 112,
		left: [
			pin('1E', 'decoder 1 enable, active low'),
			pin('1A0', 'decoder 1 address bit 0'),
			pin('1A1', 'decoder 1 address bit 1'),
			pin('1Y0'),
			pin('1Y1'),
			pin('1Y2'),
			pin('1Y3'),
			pin('GND')
		],
		right: [
			pin('2Y3'),
			pin('2Y2'),
			pin('2Y1'),
			pin('2Y0'),
			pin('2A1', 'decoder 2 address bit 1'),
			pin('2A0', 'decoder 2 address bit 0'),
			pin('2E', 'decoder 2 enable, active low'),
			pin('VCC')
		]
	}),
	hexInverter('litz-74hc14', '74HC14', '74HC14', ['74hc14', 'inverter', 'schmitt', 'logic']),
	logicPart({
		type: 'litz-74hc164',
		name: '74HC164',
		label: '74HC164',
		keywords: ['74hc164', 'shift register', 'logic'],
		bodyWidth: 108,
		left: [pin('A'), pin('B'), pin('CLK'), pin('CLR'), pin('Q0'), pin('Q1'), pin('Q2')],
		right: [pin('Q3'), pin('Q4'), pin('Q5'), pin('Q6'), pin('Q7'), pin('VCC'), pin('GND')]
	}),
	logicPart({
		type: 'litz-74hc165',
		name: '74HC165',
		label: '74HC165',
		keywords: ['74hc165', 'shift register', 'logic'],
		bodyWidth: 112,
		left: [pin('D0'), pin('D1'), pin('D2'), pin('D3'), pin('D4'), pin('D5'), pin('D6'), pin('D7')],
		right: [
			pin('PL', 'parallel load, active low'),
			pin('CP', 'shift clock'),
			pin('CE', 'clock enable, active low'),
			pin('DS', 'serial data in'),
			pin('Q7', 'serial data out'),
			pin('Q7_N', 'inverted serial data out'),
			pin('VCC'),
			pin('GND')
		]
	}),
	logicPart({
		type: 'litz-74hc166',
		name: '74HC166',
		label: '74HC166',
		keywords: ['74hc166', 'shift register', 'logic'],
		bodyWidth: 112,
		left: [pin('D0'), pin('D1'), pin('D2'), pin('D3'), pin('D4'), pin('D5'), pin('D6'), pin('D7')],
		right: [
			pin('PL'),
			pin('CP'),
			pin('CE'),
			pin('DS'),
			pin('Q7'),
			pin('Q7_N'),
			pin('VCC'),
			pin('GND')
		]
	}),
	logicPart({
		type: 'litz-74hc238',
		name: '74HC238',
		label: '74HC238',
		keywords: ['74hc238', 'decoder', 'demux', 'logic'],
		bodyWidth: 112,
		left: [
			pin('A0', 'address bit 0'),
			pin('A1', 'address bit 1'),
			pin('A2', 'address bit 2'),
			pin('E1', 'enable, active low'),
			pin('E2', 'enable, active low'),
			pin('E3', 'enable, active high'),
			pin('Y0'),
			pin('Y1')
		],
		right: [
			pin('Y2'),
			pin('Y3'),
			pin('Y4'),
			pin('Y5'),
			pin('Y6'),
			pin('Y7'),
			pin('VCC'),
			pin('GND')
		]
	}),
	quadGate('litz-74hc32', '74HC32', '74HC32', ['74hc32', 'or', 'logic', 'gate']),
	logicPart({
		type: 'litz-74hc4067',
		name: '74HC4067 multiplexer',
		label: '74HC4067',
		keywords: ['74hc4067', 'multiplexer', 'analog', 'logic'],
		bodyWidth: 112,
		left: [
			pin('S0'),
			pin('S1'),
			pin('S2'),
			pin('S3'),
			pin('E'),
			pin('COM'),
			pin('I0'),
			pin('I1'),
			pin('I2'),
			pin('I3'),
			pin('I4')
		],
		right: [
			pin('I5'),
			pin('I6'),
			pin('I7'),
			pin('I8'),
			pin('I9'),
			pin('I10'),
			pin('I11'),
			pin('I12'),
			pin('I13'),
			pin('I14'),
			pin('I15')
		]
	}),
	logicPart({
		type: 'litz-74hc573',
		name: '74HC573',
		label: '74HC573',
		keywords: ['74hc573', 'latch', 'logic'],
		bodyWidth: 112,
		left: [
			pin('D0'),
			pin('Q0'),
			pin('D1'),
			pin('Q1'),
			pin('D2'),
			pin('Q2'),
			pin('D3'),
			pin('Q3'),
			pin('D4'),
			pin('Q4')
		],
		right: [
			pin('D5'),
			pin('Q5'),
			pin('D6'),
			pin('Q6'),
			pin('D7'),
			pin('Q7'),
			pin('LE'),
			pin('OE'),
			pin('VCC'),
			pin('GND')
		]
	}),
	logicPart({
		type: 'litz-74hc595',
		name: '74HC595',
		label: '74HC595',
		keywords: ['74hc595', 'shift register', 'logic'],
		bodyWidth: 108,
		left: [
			pin('DS', 'serial data'),
			pin('SHCP', 'shift clock'),
			pin('STCP', 'storage clock'),
			pin('OE', 'output enable, active low'),
			pin('MR', 'master reset, active low'),
			pin('Q0'),
			pin('Q1')
		],
		right: [pin('Q2'), pin('Q3'), pin('Q4'), pin('Q5'), pin('Q6'), pin('Q7')]
	}),
	quadGate('litz-74hc86', '74HC86', '74HC86', ['74hc86', 'xor', 'logic', 'gate']),

	// Single gates.
	singleGate('litz-and', 'AND gate', 'AND', 2, ['and', 'logic', 'gate']),
	singleGate('litz-nand', 'NAND gate', 'NAND', 2, ['nand', 'logic', 'gate']),
	singleGate('litz-nor', 'NOR gate', 'NOR', 2, ['nor', 'logic', 'gate']),
	singleGate('litz-not', 'NOT gate', 'NOT', 1, ['not', 'inverter', 'logic', 'gate']),
	singleGate('litz-or', 'OR gate', 'OR', 2, ['or', 'logic', 'gate']),
	singleGate('litz-xor', 'XOR gate', 'XOR', 2, ['xor', 'logic', 'gate']),
	singleGate('litz-xnor', 'XNOR gate', 'XNOR', 2, ['xnor', 'logic', 'gate']),
	singleGate('litz-buffer', 'Buffer', 'BUFFER', 1, ['buffer', 'logic', 'gate']),

	// I2C/SPI expanders, converters and drivers.
	modulePart({
		type: 'litz-mcp23017',
		name: 'MCP23017',
		label: 'MCP23017',
		keywords: ['mcp23017', 'i2c', 'expander', 'gpio'],
		bodyWidth: 140,
		left: [
			pin('VCC'),
			pin('GND'),
			pin('SDA'),
			pin('SCL'),
			pin('A0', 'address select bit 0'),
			pin('A1', 'address select bit 1'),
			pin('A2', 'address select bit 2'),
			pin('RESET', 'reset, active low'),
			pin('INTA'),
			pin('INTB'),
			pin('GPA0'),
			pin('GPA1'),
			pin('GPA2')
		],
		right: [
			pin('GPA3'),
			pin('GPA4'),
			pin('GPA5'),
			pin('GPA6'),
			pin('GPA7'),
			pin('GPB0'),
			pin('GPB1'),
			pin('GPB2'),
			pin('GPB3'),
			pin('GPB4'),
			pin('GPB5'),
			pin('GPB6'),
			pin('GPB7')
		]
	}),
	modulePart({
		type: 'litz-mcp3008',
		name: 'MCP3008',
		label: 'MCP3008',
		keywords: ['mcp3008', 'spi', 'adc', 'analog'],
		bodyWidth: 140,
		left: [
			pin('VDD'),
			pin('DGND'),
			pin('AGND'),
			pin('VREF', 'conversion reference'),
			pin('CLK', 'SPI clock'),
			pin('DOUT', 'data from the ADC'),
			pin('DIN', 'data to the ADC'),
			pin('CS', 'chip select, active low')
		],
		right: [
			pin('CH0'),
			pin('CH1'),
			pin('CH2'),
			pin('CH3'),
			pin('CH4'),
			pin('CH5'),
			pin('CH6'),
			pin('CH7')
		],
		attrs: [
			{ name: 'v0', type: 'number', default: 0 },
			{ name: 'v1', type: 'number', default: 0 },
			{ name: 'v2', type: 'number', default: 0 },
			{ name: 'v3', type: 'number', default: 0 },
			{ name: 'v4', type: 'number', default: 0 },
			{ name: 'v5', type: 'number', default: 0 },
			{ name: 'v6', type: 'number', default: 0 },
			{ name: 'v7', type: 'number', default: 0 },
			{ name: 'vref', type: 'number', default: 3.3 }
		]
	}),
	modulePart({
		type: 'litz-mcp4725',
		name: 'MCP4725 DAC',
		label: 'MCP4725',
		keywords: ['mcp4725', 'i2c', 'dac', 'analog'],
		bodyWidth: 120,
		left: [pin('VCC'), pin('GND'), pin('SDA')],
		right: [pin('SCL'), pin('VOUT')],
		attrs: [
			{ name: 'value', type: 'number', default: 0 },
			{ name: 'vref', type: 'number', default: 5.0 }
		]
	}),
	modulePart({
		type: 'litz-pcf8574',
		name: 'PCF8574',
		label: 'PCF8574',
		keywords: ['pcf8574', 'i2c', 'expander', 'gpio'],
		bodyWidth: 140,
		left: [
			pin('VCC'),
			pin('GND'),
			pin('SDA', 'I2C data'),
			pin('SCL', 'I2C clock'),
			pin('P0'),
			pin('P1'),
			pin('P2')
		],
		right: [
			pin('P3'),
			pin('P4'),
			pin('P5'),
			pin('P6'),
			pin('P7'),
			pin('INT', 'interrupt, open drain')
		]
	}),
	modulePart({
		type: 'litz-pcf8591',
		name: 'PCF8591 ADC/DAC',
		label: 'PCF8591',
		keywords: ['pcf8591', 'i2c', 'adc', 'dac'],
		bodyWidth: 128,
		left: [pin('VCC'), pin('GND'), pin('SDA'), pin('SCL'), pin('AOUT')],
		right: [pin('AIN0'), pin('AIN1'), pin('AIN2'), pin('AIN3')],
		attrs: [
			{ name: 'ain0', type: 'number', default: 0 },
			{ name: 'ain1', type: 'number', default: 0 },
			{ name: 'ain2', type: 'number', default: 0 },
			{ name: 'ain3', type: 'number', default: 0 },
			{ name: 'vref', type: 'number', default: 3.3 }
		]
	}),
	modulePart({
		type: 'litz-tca9548a',
		name: 'TCA9548A',
		label: 'TCA9548A',
		keywords: ['tca9548a', 'i2c', 'multiplexer'],
		bodyWidth: 128,
		left: [
			pin('VCC'),
			pin('GND'),
			pin('SDA', 'upstream I2C data'),
			pin('SCL', 'upstream I2C clock')
		],
		right: [
			pin('A0', 'address select bit 0'),
			pin('A1', 'address select bit 1'),
			pin('A2', 'address select bit 2'),
			pin('RESET', 'reset, active low')
		]
	}),
	modulePart({
		type: 'litz-ads1015',
		name: 'ADS1015 ADC',
		label: 'ADS1015',
		keywords: ['ads1015', 'i2c', 'adc', 'analog'],
		bodyWidth: 124,
		left: [pin('VDD'), pin('GND'), pin('SCL')],
		right: [
			pin('SDA'),
			pin('ADDR'),
			pin('ALRT'),
			pin('A0', 'channel 0 input'),
			pin('A1', 'channel 1 input'),
			pin('A2', 'channel 2 input'),
			pin('A3', 'channel 3 input')
		],
		attrs: [
			{ name: 'a0', type: 'number', default: 0 },
			{ name: 'a1', type: 'number', default: 0 },
			{ name: 'a2', type: 'number', default: 0 },
			{ name: 'a3', type: 'number', default: 0 }
		]
	}),
	modulePart({
		type: 'litz-ads1115',
		name: 'ADS1115 ADC',
		label: 'ADS1115',
		keywords: ['ads1115', 'i2c', 'adc', 'analog'],
		bodyWidth: 124,
		left: [pin('VDD'), pin('GND'), pin('SCL')],
		right: [
			pin('SDA'),
			pin('ADDR'),
			pin('ALRT'),
			pin('A0', 'channel 0 input'),
			pin('A1', 'channel 1 input'),
			pin('A2', 'channel 2 input'),
			pin('A3', 'channel 3 input')
		],
		attrs: [
			{ name: 'a0', type: 'number', default: 0 },
			{ name: 'a1', type: 'number', default: 0 },
			{ name: 'a2', type: 'number', default: 0 },
			{ name: 'a3', type: 'number', default: 0 }
		]
	}),
	modulePart({
		type: 'litz-pca9685',
		name: 'PCA9685 PWM driver',
		label: 'PCA9685',
		keywords: ['pca9685', 'i2c', 'pwm', 'servo'],
		bodyWidth: 140,
		left: [
			pin('VCC'),
			pin('GND'),
			pin('SDA'),
			pin('SCL'),
			pin('OE'),
			pin('PWM0'),
			pin('PWM1'),
			pin('PWM2'),
			pin('PWM3'),
			pin('PWM4'),
			pin('PWM5')
		],
		right: [
			pin('PWM6'),
			pin('PWM7'),
			pin('PWM8'),
			pin('PWM9'),
			pin('PWM10'),
			pin('PWM11'),
			pin('PWM12'),
			pin('PWM13'),
			pin('PWM14'),
			pin('PWM15')
		],
		attrs: [{ name: 'frequency', type: 'number', default: 50 }]
	}),

	modulePart({
		type: 'litz-logic-level-converter',
		name: 'Logic level converter',
		label: 'LEVEL',
		keywords: ['level', 'shifter', 'converter', '3v3', '5v', 'bidirectional'],
		bodyWidth: 96,
		left: [pin('LV'), pin('HV'), pin('GND'), pin('LV1'), pin('LV2'), pin('LV3'), pin('LV4')],
		right: [pin('HV1'), pin('HV2'), pin('HV3'), pin('HV4')]
	})
];
