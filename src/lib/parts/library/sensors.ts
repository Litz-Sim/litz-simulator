import { drawGeneric } from '../art';
import type { AttrDef, PartDef, PinDef } from '../types';

const LEG_COLOR = '#b7bdc2';

function leg(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
}

function legs(
	ctx: CanvasRenderingContext2D,
	xs: readonly number[],
	from: number,
	to: number
): void {
	ctx.strokeStyle = LEG_COLOR;
	ctx.lineWidth = 2.6;
	for (const x of xs) leg(ctx, x, from, x, to);
}

function label(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	size: number,
	color: string
): void {
	ctx.fillStyle = color;
	ctx.font = `${size}px ui-sans-serif, system-ui, sans-serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(text, x, y);
}

/**
 * Lay a pin header out around the generic body. Up to six pins sit in one
 * bottom row; larger headers wrap to a second row so the part stays compact.
 */
function headerPins(names: readonly string[]): { pins: PinDef[]; width: number } {
	const spacing = names.length <= 4 ? 20 : 14;
	const twoRows = names.length > 6;
	const perRow = twoRows ? Math.ceil(names.length / 2) : names.length;
	const pins = names.map((name, i) => {
		if (!twoRows) {
			return { name, x: -((names.length - 1) * spacing) / 2 + i * spacing, y: 42 };
		}
		const row = i < perRow ? 0 : 1;
		const count = row === 0 ? perRow : names.length - perRow;
		const col = row === 0 ? i : i - perRow;
		return { name, x: -((count - 1) * spacing) / 2 + col * spacing, y: row === 0 ? -42 : 42 };
	});
	return { pins, width: Math.max(80, perRow * spacing + 20) };
}

function genericPart(
	type: string,
	name: string,
	category: string,
	keywords: string[],
	pinNames: string[],
	attrs: AttrDef[]
): PartDef {
	const layout = headerPins(pinNames);
	return {
		type,
		name,
		category,
		keywords,
		width: layout.width,
		height: 100,
		pins: layout.pins,
		attrs,
		draw: (ctx, _part, zoom) => drawGeneric(ctx, name, pinNames.length, zoom)
	};
}

/** HC-SR04: two silver transducer cylinders on a small blue PCB. */
function drawHcsr04(ctx: CanvasRenderingContext2D, zoom: number): void {
	ctx.save();
	ctx.lineCap = 'round';
	legs(ctx, [-30, -10, 10, 30], 18, 34);

	ctx.fillStyle = '#1f4f8f';
	ctx.strokeStyle = '#12325c';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-40, -28, 80, 46, 4);
	ctx.fill();
	ctx.stroke();

	for (const cx of [-20, 20]) {
		const metal = ctx.createRadialGradient(cx - 4, -8, 2, cx, -4, 15);
		metal.addColorStop(0, '#e6eaed');
		metal.addColorStop(0.6, '#aab2b8');
		metal.addColorStop(1, '#6f787f');
		ctx.fillStyle = metal;
		ctx.strokeStyle = '#5b6369';
		ctx.lineWidth = 1.2;
		ctx.beginPath();
		ctx.arc(cx, -4, 14, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();

		ctx.strokeStyle = 'rgba(70, 77, 82, 0.7)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.arc(cx, -4, 9.5, 0, Math.PI * 2);
		ctx.stroke();

		ctx.fillStyle = '#3c4247';
		ctx.beginPath();
		ctx.arc(cx, -4, 6, 0, Math.PI * 2);
		ctx.fill();
	}

	if (zoom >= 0.6) label(ctx, 'HC-SR04', 0, 12, 6.5, 'rgba(220, 230, 240, 0.9)');
	ctx.restore();
}

/** PIR module: a white fresnel dome over a small board. */
function drawPir(ctx: CanvasRenderingContext2D, zoom: number): void {
	ctx.save();
	ctx.lineCap = 'round';
	legs(ctx, [-20, 0, 20], 12, 32);

	ctx.fillStyle = '#e9e7df';
	ctx.strokeStyle = '#b3afa2';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-26, -16, 52, 30, 4);
	ctx.fill();
	ctx.stroke();

	const dome = ctx.createRadialGradient(-8, -34, 3, 0, -16, 26);
	dome.addColorStop(0, '#ffffff');
	dome.addColorStop(1, '#d8d5ca');
	ctx.fillStyle = dome;
	ctx.strokeStyle = '#b3afa2';
	ctx.beginPath();
	ctx.arc(0, -16, 24, Math.PI, Math.PI * 2);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	// Fresnel segments.
	ctx.strokeStyle = 'rgba(150, 146, 132, 0.55)';
	ctx.lineWidth = 1;
	for (const radius of [9, 16, 22]) {
		ctx.beginPath();
		ctx.arc(0, -16, radius, Math.PI, Math.PI * 2);
		ctx.stroke();
	}
	ctx.beginPath();
	ctx.moveTo(0, -40);
	ctx.lineTo(0, -16);
	ctx.moveTo(-21, -16);
	ctx.lineTo(21, -16);
	ctx.stroke();

	if (zoom >= 0.6) label(ctx, 'PIR', 0, 6, 6, 'rgba(120, 116, 104, 0.85)');
	ctx.restore();
}

/** Photodiode: a dark epoxy body with a clear lens and incoming light. */
function drawPhotodiode(ctx: CanvasRenderingContext2D, zoom: number): void {
	ctx.save();
	ctx.lineCap = 'round';
	legs(ctx, [-12, 12], 10, 42);

	const body = ctx.createLinearGradient(0, -20, 0, 14);
	body.addColorStop(0, '#3a4045');
	body.addColorStop(1, '#111315');
	ctx.fillStyle = body;
	ctx.strokeStyle = '#060708';
	ctx.lineWidth = 1.3;
	ctx.beginPath();
	ctx.roundRect(-16, -20, 32, 34, 5);
	ctx.fill();
	ctx.stroke();

	const lens = ctx.createRadialGradient(-2, -6, 1, 0, -3, 10);
	lens.addColorStop(0, '#ffe6a0');
	lens.addColorStop(1, '#a8791d');
	ctx.fillStyle = lens;
	ctx.beginPath();
	ctx.arc(0, -3, 8, 0, Math.PI * 2);
	ctx.fill();

	// Two arrows of incident light.
	ctx.strokeStyle = '#f0c33c';
	ctx.lineWidth = 2;
	for (const dx of [-6, 6]) {
		ctx.beginPath();
		ctx.moveTo(20 + dx, -34);
		ctx.lineTo(8 + dx, -16);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(8 + dx, -16);
		ctx.lineTo(12 + dx, -16);
		ctx.moveTo(8 + dx, -16);
		ctx.lineTo(10 + dx, -20);
		ctx.stroke();
	}

	if (zoom >= 0.7) label(ctx, 'PD', 0, 10, 5.5, 'rgba(210, 215, 220, 0.8)');
	ctx.restore();
}

/** RC522: a green board with the etched antenna coil and the reader chip. */
function drawRfid(ctx: CanvasRenderingContext2D, zoom: number): void {
	ctx.save();
	ctx.lineCap = 'round';
	const pinX = [-63, -45, -27, -9, 9, 27, 45, 63];
	legs(ctx, pinX, 34, 50);

	ctx.fillStyle = '#2f7d4f';
	ctx.strokeStyle = '#1d5234';
	ctx.lineWidth = 1.3;
	ctx.beginPath();
	ctx.roundRect(-72, -44, 144, 78, 6);
	ctx.fill();
	ctx.stroke();

	// Antenna coil: concentric rounded rectangles.
	ctx.strokeStyle = '#c08a3e';
	ctx.lineWidth = 2;
	for (const [w, h] of [
		[56, 46],
		[46, 36],
		[36, 26]
	]) {
		ctx.beginPath();
		ctx.roundRect(-w / 2, -6 - h / 2, w, h, 5);
		ctx.stroke();
	}

	ctx.fillStyle = '#15181a';
	ctx.strokeStyle = '#050708';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.roundRect(-9, -15, 18, 18, 2);
	ctx.fill();
	ctx.stroke();

	if (zoom >= 0.6) label(ctx, 'RC522', 0, 26, 6, 'rgba(225, 240, 230, 0.9)');
	ctx.restore();
}

/** NEO-6M: a GPS module with a ceramic patch antenna. */
function drawGps(ctx: CanvasRenderingContext2D, zoom: number): void {
	ctx.save();
	ctx.lineCap = 'round';
	legs(ctx, [-30, -10, 10, 30], 24, 36);

	ctx.fillStyle = '#244e37';
	ctx.strokeStyle = '#15301f';
	ctx.lineWidth = 1.3;
	ctx.beginPath();
	ctx.roundRect(-44, -34, 88, 58, 4);
	ctx.fill();
	ctx.stroke();

	// Ceramic patch antenna.
	const patch = ctx.createLinearGradient(0, -31, 0, -13);
	patch.addColorStop(0, '#f0eee6');
	patch.addColorStop(1, '#c9c5b6');
	ctx.fillStyle = patch;
	ctx.strokeStyle = '#9d9888';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.roundRect(-32, -31, 64, 18, 2);
	ctx.fill();
	ctx.stroke();
	ctx.strokeStyle = 'rgba(140, 135, 118, 0.6)';
	ctx.beginPath();
	ctx.moveTo(-26, -22);
	ctx.lineTo(26, -22);
	ctx.stroke();

	// Receiver chip.
	ctx.fillStyle = '#15181a';
	ctx.beginPath();
	ctx.roundRect(-9, -5, 18, 14, 2);
	ctx.fill();

	if (zoom >= 0.6) label(ctx, 'NEO-6M', 0, 17, 6, 'rgba(215, 235, 220, 0.9)');
	ctx.restore();
}

/** PMS5003: a grey box with a fan grille on the front. */
function drawPms5003(ctx: CanvasRenderingContext2D, zoom: number): void {
	ctx.save();
	ctx.lineCap = 'round';
	legs(ctx, [-30, -10, 10, 30], 28, 40);

	const body = ctx.createLinearGradient(0, -34, 0, 28);
	body.addColorStop(0, '#c6cbd0');
	body.addColorStop(1, '#8f979d');
	ctx.fillStyle = body;
	ctx.strokeStyle = '#6a7177';
	ctx.lineWidth = 1.3;
	ctx.beginPath();
	ctx.roundRect(-42, -34, 84, 62, 5);
	ctx.fill();
	ctx.stroke();

	// Fan grille: concentric rings and spokes.
	const cx = 0;
	const cy = -4;
	const fan = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, 17);
	fan.addColorStop(0, '#2a2e31');
	fan.addColorStop(1, '#0e1012');
	ctx.fillStyle = fan;
	ctx.beginPath();
	ctx.arc(cx, cy, 17, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = 'rgba(190, 198, 205, 0.45)';
	ctx.lineWidth = 1;
	for (const radius of [6, 11, 16]) {
		ctx.beginPath();
		ctx.arc(cx, cy, radius, 0, Math.PI * 2);
		ctx.stroke();
	}
	for (let i = 0; i < 6; i++) {
		const angle = (i * Math.PI) / 3;
		ctx.beginPath();
		ctx.moveTo(cx + Math.cos(angle) * 5, cy + Math.sin(angle) * 5);
		ctx.lineTo(cx + Math.cos(angle) * 16, cy + Math.sin(angle) * 16);
		ctx.stroke();
	}

	if (zoom >= 0.6) label(ctx, 'PMS5003', 0, 21, 6, 'rgba(40, 46, 50, 0.8)');
	ctx.restore();
}

export const SENSOR_PARTS: PartDef[] = [
	{
		type: 'litz-hc-sr04',
		name: 'HC-SR04',
		category: 'Sensors',
		keywords: ['hc-sr04', 'ultrasonic', 'distance', 'sonar', 'range'],
		width: 96,
		height: 80,
		pins: [
			{ name: 'VCC', x: -30, y: 34 },
			{ name: 'TRIG', label: 'trigger pulse', x: -10, y: 34 },
			{ name: 'ECHO', label: 'echo pulse, 58 us per cm', x: 10, y: 34 },
			{ name: 'GND', x: 30, y: 34 }
		],
		attrs: [{ name: 'distance', type: 'number', default: 100 }],
		draw: (ctx, _part, zoom) => drawHcsr04(ctx, zoom)
	},
	{
		type: 'litz-pir-motion-sensor',
		name: 'PIR motion sensor',
		category: 'Sensors',
		keywords: ['pir', 'motion', 'infrared', 'presence', 'sensor'],
		width: 76,
		height: 80,
		pins: [
			{ name: 'VCC', x: -20, y: 32 },
			{ name: 'OUT', label: 'motion, high when detected', x: 0, y: 32 },
			{ name: 'GND', x: 20, y: 32 }
		],
		attrs: [],
		draw: (ctx, _part, zoom) => drawPir(ctx, zoom)
	},
	genericPart(
		'litz-ntc-temperature-sensor',
		'NTC temperature sensor',
		'Sensors',
		['ntc', 'thermistor', 'temperature', 'sensor'],
		['VCC', 'GND', 'AO', 'DO'],
		[{ name: 'temperature', type: 'number', default: 25 }]
	),
	genericPart(
		'litz-ds18b20',
		'DS18B20',
		'Sensors',
		['ds18b20', 'temperature', '1-wire', 'sensor'],
		['VCC', 'GND', 'DQ'],
		[
			{ name: 'temperature', type: 'number', default: 25 },
			{ name: 'deviceID', type: 'string', default: '2800000000000001' }
		]
	),
	genericPart(
		'litz-bmp280',
		'BMP280',
		'Sensors',
		['bmp280', 'pressure', 'barometer', 'temperature', 'i2c'],
		['VCC', 'GND', 'SCL', 'SDA', 'CSB', 'SDO'],
		[]
	),
	genericPart(
		'litz-bme280',
		'BME280',
		'Sensors',
		['bme280', 'temperature', 'humidity', 'pressure', 'i2c'],
		['VCC', 'GND', 'SDA', 'SCL'],
		[
			{ name: 'temperature', type: 'number', default: 25 },
			{ name: 'humidity', type: 'number', default: 50 },
			{ name: 'pressure', type: 'number', default: 101325 }
		]
	),
	genericPart(
		'litz-bme680',
		'BME680',
		'Sensors',
		['bme680', 'temperature', 'humidity', 'pressure', 'gas', 'i2c'],
		['VCC', 'GND', 'SDA', 'SCL', 'CS', 'SDO'],
		[
			{ name: 'temperature', type: 'number', default: 25 },
			{ name: 'pressure', type: 'number', default: 101325 },
			{ name: 'humidity', type: 'number', default: 50 },
			{ name: 'gas', type: 'number', default: 100000 }
		]
	),
	genericPart(
		'litz-mpu6050',
		'MPU6050',
		'Sensors',
		['mpu6050', 'accelerometer', 'gyroscope', 'imu', 'i2c'],
		['VCC', 'GND', 'SDA', 'SCL', 'INT', 'XDA', 'XCL', 'AD0'],
		[
			{ name: 'ax', type: 'number', default: 0 },
			{ name: 'ay', type: 'number', default: 0 },
			{ name: 'az', type: 'number', default: 1 },
			{ name: 'gx', type: 'number', default: 0 },
			{ name: 'gy', type: 'number', default: 0 },
			{ name: 'gz', type: 'number', default: 0 }
		]
	),
	genericPart(
		'litz-adxl345',
		'ADXL345',
		'Sensors',
		['adxl345', 'accelerometer', 'imu', 'i2c', 'spi'],
		['VCC', 'GND', 'SDA', 'SCL', 'CS', 'SDO', 'INT1', 'INT2'],
		[
			{ name: 'x', type: 'number', default: 0 },
			{ name: 'y', type: 'number', default: 0 },
			{ name: 'z', type: 'number', default: 1 }
		]
	),
	genericPart(
		'litz-qmc5883l',
		'QMC5883L',
		'Sensors',
		['qmc5883l', 'magnetometer', 'compass', 'i2c'],
		['VCC', 'GND', 'SDA', 'SCL', 'DRDY'],
		[
			{ name: 'x', type: 'number', default: 0 },
			{ name: 'y', type: 'number', default: 0 },
			{ name: 'z', type: 'number', default: 50 }
		]
	),
	genericPart(
		'litz-bh1750',
		'BH1750',
		'Sensors',
		['bh1750', 'light', 'lux', 'ambient', 'i2c'],
		['VCC', 'GND', 'SDA', 'SCL', 'ADDR'],
		[{ name: 'lux', type: 'number', default: 500 }]
	),
	genericPart(
		'litz-tsl2561',
		'TSL2561',
		'Sensors',
		['tsl2561', 'light', 'lux', 'ambient', 'i2c'],
		['VCC', 'GND', 'SDA', 'SCL', 'INT'],
		[{ name: 'lux', type: 'number', default: 500 }]
	),
	genericPart(
		'litz-veml7700',
		'VEML7700',
		'Sensors',
		['veml7700', 'light', 'lux', 'ambient', 'i2c'],
		['VCC', 'GND', 'SDA', 'SCL'],
		[{ name: 'lux', type: 'number', default: 500 }]
	),
	genericPart(
		'litz-apds9960',
		'APDS9960',
		'Sensors',
		['apds9960', 'proximity', 'gesture', 'rgb', 'light', 'i2c'],
		['VCC', 'GND', 'SDA', 'SCL', 'INT'],
		[
			{ name: 'clear', type: 'number', default: 1000 },
			{ name: 'red', type: 'number', default: 2000 },
			{ name: 'green', type: 'number', default: 1000 },
			{ name: 'blue', type: 'number', default: 500 },
			{ name: 'proximity', type: 'number', default: 0 }
		]
	),
	genericPart(
		'litz-mlx90614',
		'MLX90614',
		'Sensors',
		['mlx90614', 'infrared', 'temperature', 'thermometer', 'i2c'],
		['VCC', 'GND', 'SDA', 'SCL'],
		[
			{ name: 'object', type: 'number', default: 25 },
			{ name: 'ambient', type: 'number', default: 22 }
		]
	),
	genericPart(
		'litz-tmp102',
		'TMP102',
		'Sensors',
		['tmp102', 'temperature', 'i2c'],
		['VCC', 'GND', 'SDA', 'SCL', 'ADD0', 'ALERT'],
		[{ name: 'temperature', type: 'number', default: 25 }]
	),
	genericPart(
		'litz-sht31',
		'SHT31',
		'Sensors',
		['sht31', 'temperature', 'humidity', 'i2c'],
		['VDD', 'GND', 'SDA', 'SCL'],
		[
			{ name: 'temperature', type: 'number', default: 25 },
			{ name: 'humidity', type: 'number', default: 50 }
		]
	),
	genericPart(
		'litz-sgp30',
		'SGP30',
		'Sensors',
		['sgp30', 'air quality', 'eco2', 'tvoc', 'i2c'],
		['VCC', 'GND', 'SDA', 'SCL'],
		[
			{ name: 'eco2', type: 'number', default: 400 },
			{ name: 'tvoc', type: 'number', default: 0 }
		]
	),
	genericPart(
		'litz-gas-sensor',
		'Gas sensor',
		'Sensors',
		['gas', 'mq-2', 'smoke', 'analog', 'sensor'],
		['VCC', 'GND', 'DOUT', 'AOUT'],
		[
			{ name: 'ppm', type: 'number', default: 400 },
			{ name: 'threshold', type: 'number', default: 4.4 }
		]
	),
	genericPart(
		'litz-flame-sensor',
		'Flame sensor',
		'Sensors',
		['flame', 'fire', 'infrared', 'analog', 'sensor'],
		['VCC', 'GND', 'DO', 'AO'],
		[
			{ name: 'intensity', type: 'number', default: 500 },
			{ name: 'threshold', type: 'number', default: 500 }
		]
	),
	genericPart(
		'litz-rain-sensor',
		'Rain sensor',
		'Sensors',
		['rain', 'water', 'moisture', 'analog', 'sensor'],
		['VCC', 'GND', 'AO', 'DO'],
		[
			{ name: 'value', type: 'number', default: 0 },
			{ name: 'threshold', type: 'number', default: 500 },
			{ name: 'activeLow', type: 'bool', default: true },
			{ name: 'vref', type: 'number', default: 5 }
		]
	),
	genericPart(
		'litz-soil-moisture-sensor',
		'Soil moisture sensor',
		'Sensors',
		['soil', 'moisture', 'water', 'analog', 'sensor'],
		['VCC', 'GND', 'AO', 'DO'],
		[
			{ name: 'value', type: 'number', default: 300 },
			{ name: 'threshold', type: 'number', default: 500 },
			{ name: 'activeLow', type: 'bool', default: false },
			{ name: 'vref', type: 'number', default: 5 }
		]
	),
	genericPart(
		'litz-water-level-sensor',
		'Water level sensor',
		'Sensors',
		['water level', 'liquid', 'analog', 'sensor'],
		['VCC', 'GND', 'AO'],
		[
			{ name: 'value', type: 'number', default: 0 },
			{ name: 'threshold', type: 'number', default: 500 },
			{ name: 'activeLow', type: 'bool', default: false },
			{ name: 'vref', type: 'number', default: 5 }
		]
	),
	genericPart(
		'litz-force-sensor',
		'Force sensor FSR',
		'Sensors',
		['force', 'fsr', 'pressure', 'analog', 'sensor'],
		['VCC', 'GND', 'AO'],
		[
			{ name: 'force', type: 'number', default: 300 },
			{ name: 'vref', type: 'number', default: 3.3 }
		]
	),
	genericPart(
		'litz-flex-sensor',
		'Flex sensor',
		'Sensors',
		['flex', 'bend', 'analog', 'sensor'],
		['VCC', 'GND', 'AO'],
		[
			{ name: 'bend', type: 'number', default: 300 },
			{ name: 'vref', type: 'number', default: 3.3 }
		]
	),
	genericPart(
		'litz-vibration-sensor',
		'Vibration sensor',
		'Sensors',
		['vibration', 'shock', 'analog', 'sensor'],
		['VCC', 'GND', 'AO', 'DO'],
		[
			{ name: 'value', type: 'number', default: 0 },
			{ name: 'threshold', type: 'number', default: 500 },
			{ name: 'activeLow', type: 'bool', default: false },
			{ name: 'vref', type: 'number', default: 5 }
		]
	),
	genericPart(
		'litz-sound-sensor',
		'Sound sensor',
		'Sensors',
		['sound', 'microphone', 'audio', 'analog', 'sensor'],
		['VCC', 'GND', 'AO', 'DO'],
		[
			{ name: 'value', type: 'number', default: 300 },
			{ name: 'threshold', type: 'number', default: 500 },
			{ name: 'activeLow', type: 'bool', default: false },
			{ name: 'vref', type: 'number', default: 5 }
		]
	),
	genericPart(
		'litz-hall-sensor',
		'Hall sensor A3144',
		'Sensors',
		['hall', 'magnetic', 'a3144', 'switch', 'sensor'],
		['VCC', 'GND', 'OUT'],
		[{ name: 'magnetic', type: 'bool', default: false }]
	),
	genericPart(
		'litz-tcrt5000',
		'TCRT5000 reflective sensor',
		'Sensors',
		['tcrt5000', 'reflective', 'line', 'infrared', 'sensor'],
		['VCC', 'GND', 'AO', 'DO'],
		[
			{ name: 'line', type: 'enum', values: ['white', 'black'], default: 'white' },
			{ name: 'reflectance', type: 'number', default: 800 }
		]
	),
	{
		type: 'litz-photodiode',
		name: 'Photodiode',
		category: 'Sensors',
		keywords: ['photodiode', 'light', 'optical', 'sensor', 'diode'],
		width: 64,
		height: 88,
		pins: [
			{ name: 'A', label: 'anode', x: -12, y: 42 },
			{ name: 'C', label: 'cathode', x: 12, y: 42 }
		],
		attrs: [
			{ name: 'vf', type: 'number', default: 0.7 },
			{ name: 'light', type: 'number', default: 500 }
		],
		draw: (ctx, _part, zoom) => drawPhotodiode(ctx, zoom)
	},
	genericPart(
		'litz-heart-beat-sensor',
		'Heartbeat sensor',
		'Sensors',
		['heartbeat', 'pulse', 'bpm', 'optical', 'sensor'],
		['VCC', 'GND', 'OUT', 'AOUT'],
		[{ name: 'bpm', type: 'number', default: 72 }]
	),
	genericPart(
		'litz-hx711',
		'HX711',
		'Sensors',
		['hx711', 'load cell', 'weight', 'scale', 'adc'],
		['VCC', 'GND', 'DT', 'SCK', 'E+', 'E-', 'A+', 'A-', 'B+', 'B-'],
		[
			{ name: 'weight', type: 'number', default: 0 },
			{ name: 'capacity', type: 'number', default: 5000 },
			{ name: 'type', type: 'enum', values: ['5kg', '50kg'], default: '5kg' }
		]
	),
	genericPart(
		'litz-ina219',
		'INA219',
		'Sensors',
		['ina219', 'current', 'voltage', 'power', 'monitor', 'i2c'],
		['VCC', 'GND', 'SDA', 'SCL', 'VIN+', 'VIN-'],
		[
			{ name: 'busVoltage', type: 'number', default: 5 },
			{ name: 'shuntMillivolts', type: 'number', default: 10 },
			{ name: 'currentMilliamps', type: 'number', default: 100 }
		]
	),
	genericPart(
		'litz-vl53l0x',
		'VL53L0X',
		'Sensors',
		['vl53l0x', 'time of flight', 'tof', 'distance', 'i2c'],
		['VCC', 'GND', 'SDA', 'SCL', 'XSHUT', 'GPIO1'],
		[{ name: 'distance', type: 'number', default: 100 }]
	),
	genericPart(
		'litz-vl53l1x',
		'VL53L1X',
		'Sensors',
		['vl53l1x', 'time of flight', 'tof', 'distance', 'i2c'],
		['VCC', 'GND', 'SDA', 'SCL', 'XSHUT', 'GPIO1'],
		[{ name: 'distance', type: 'number', default: 100 }]
	),
	genericPart(
		'litz-ds1307',
		'DS1307 RTC',
		'Storage',
		['ds1307', 'rtc', 'real time clock', 'time', 'i2c'],
		['VCC', 'GND', 'SDA', 'SCL', 'SQW'],
		[
			{ name: 'time', type: 'string', default: '2024-01-01T00:00:00' },
			{ name: 'weekday', type: 'number', default: 1 }
		]
	),
	genericPart(
		'litz-ds3231',
		'DS3231 RTC',
		'Storage',
		['ds3231', 'rtc', 'real time clock', 'time', 'i2c'],
		['VCC', 'GND', 'SDA', 'SCL', 'SQW', '32K'],
		[
			{ name: 'time', type: 'string', default: '2024-01-01T00:00:00' },
			{ name: 'weekday', type: 'number', default: 1 },
			{ name: 'temperature', type: 'number', default: 25 }
		]
	),
	genericPart(
		'litz-lm75',
		'LM75',
		'Sensors',
		['lm75', 'temperature', 'i2c', 'thermostat'],
		['VCC', 'GND', 'SDA', 'SCL', 'A0', 'A1', 'A2'],
		[{ name: 'temperature', type: 'number', default: 25 }]
	),
	{
		type: 'litz-rfid-rc522',
		name: 'RFID RC522',
		category: 'Modules',
		keywords: ['rfid', 'rc522', 'mfrc522', 'nfc', '13.56mhz', 'spi'],
		width: 160,
		height: 116,
		pins: [
			{ name: 'SDA', label: 'chip select', x: -63, y: 50 },
			{ name: 'SCK', label: 'SPI clock', x: -45, y: 50 },
			{ name: 'MOSI', label: 'SPI data in', x: -27, y: 50 },
			{ name: 'MISO', label: 'SPI data out', x: -9, y: 50 },
			{ name: 'RST', label: 'reset, active low', x: 9, y: 50 },
			{ name: 'IRQ', label: 'interrupt', x: 27, y: 50 },
			{ name: 'VCC', x: 45, y: 50 },
			{ name: 'GND', x: 63, y: 50 }
		],
		attrs: [],
		draw: (ctx, _part, zoom) => drawRfid(ctx, zoom)
	},
	genericPart(
		'litz-fingerprint',
		'Fingerprint sensor',
		'Modules',
		['fingerprint', 'biometric', 'r307', 'uart', 'sensor'],
		['TX', 'RX', 'VCC', 'GND'],
		[]
	),
	{
		type: 'litz-pms5003',
		name: 'PMS5003 particulate sensor',
		category: 'Modules',
		keywords: ['pms5003', 'particulate', 'pm2.5', 'pm10', 'air quality', 'uart'],
		width: 96,
		height: 88,
		pins: [
			{ name: 'VCC', x: -30, y: 40 },
			{ name: 'GND', x: -10, y: 40 },
			{ name: 'TX', x: 10, y: 40 },
			{ name: 'RX', x: 30, y: 40 }
		],
		attrs: [
			{ name: 'pm1', type: 'number', default: 4 },
			{ name: 'pm25', type: 'number', default: 7 },
			{ name: 'pm10', type: 'number', default: 9 },
			{ name: 'interval', type: 'number', default: 1000 }
		],
		draw: (ctx, _part, zoom) => drawPms5003(ctx, zoom)
	},
	{
		type: 'litz-gps-neo6m',
		name: 'GPS NEO-6M',
		category: 'Modules',
		keywords: ['gps', 'neo-6m', 'u-blox', 'nmea', 'uart', 'location'],
		width: 100,
		height: 84,
		pins: [
			{ name: 'VCC', x: -30, y: 36 },
			{ name: 'GND', x: -10, y: 36 },
			{ name: 'TX', x: 10, y: 36 },
			{ name: 'RX', x: 30, y: 36 }
		],
		attrs: [
			{ name: 'latitude', type: 'number', default: 47.6062 },
			{ name: 'longitude', type: 'number', default: -122.3321 },
			{ name: 'speed', type: 'number', default: 0.5 }
		],
		draw: (ctx, _part, zoom) => drawGps(ctx, zoom)
	},
	genericPart(
		'litz-tcs34725',
		'TCS34725',
		'Sensors',
		['tcs34725', 'colour', 'color', 'rgb', 'light', 'i2c', 'sensor'],
		['VCC', 'GND', 'SDA', 'SCL', 'INT', 'LED'],
		[
			{ name: 'clear', type: 'number', default: 1000 },
			{ name: 'red', type: 'number', default: 2000 },
			{ name: 'green', type: 'number', default: 1000 },
			{ name: 'blue', type: 'number', default: 500 }
		]
	)
];
