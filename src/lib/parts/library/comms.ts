import type { PartDef } from '../types';

const LEG_COLOR = '#b7bdc2';
const PAD_COLOR = '#c9a227';

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

function sideLegs(
	ctx: CanvasRenderingContext2D,
	ys: readonly number[],
	from: number,
	to: number
): void {
	ctx.strokeStyle = LEG_COLOR;
	ctx.lineWidth = 2.6;
	for (const y of ys) leg(ctx, from, y, to, y);
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

/** Wi-Fi router: a squat box with two antennas, a signal icon and status LEDs. */
function drawWifiRouter(ctx: CanvasRenderingContext2D, zoom: number): void {
	ctx.save();
	ctx.lineCap = 'round';

	// Antennas rising out of the back of the box.
	ctx.strokeStyle = '#3a3f43';
	ctx.lineWidth = 4;
	leg(ctx, -26, -26, -34, -52);
	leg(ctx, 26, -26, 34, -52);

	const body = ctx.createLinearGradient(0, -30, 0, 30);
	body.addColorStop(0, '#3c474f');
	body.addColorStop(1, '#1f272c');
	ctx.fillStyle = body;
	ctx.strokeStyle = '#0d1215';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-48, -30, 96, 60, 6);
	ctx.fill();
	ctx.stroke();

	// Signal arcs, opening upward.
	ctx.strokeStyle = 'rgba(140, 220, 255, 0.75)';
	ctx.lineWidth = 2.4;
	for (const radius of [7, 13, 19]) {
		ctx.beginPath();
		ctx.arc(0, 8, radius, -Math.PI * 0.75, -Math.PI * 0.25);
		ctx.stroke();
	}
	ctx.fillStyle = 'rgba(140, 220, 255, 0.9)';
	ctx.beginPath();
	ctx.arc(0, 8, 2.4, 0, Math.PI * 2);
	ctx.fill();

	// Status LEDs along the front edge.
	const leds = [
		{ x: -32, color: '#57d97e' },
		{ x: -16, color: '#f0c62a' },
		{ x: 0, color: '#57d97e' },
		{ x: 16, color: '#7aa7d6' },
		{ x: 32, color: '#57d97e' }
	];
	for (const led of leds) {
		ctx.fillStyle = led.color;
		ctx.beginPath();
		ctx.arc(led.x, 21, 2.6, 0, Math.PI * 2);
		ctx.fill();
	}
	if (zoom >= 0.7) label(ctx, 'Wi-Fi', 0, 27, 6, 'rgba(200, 215, 225, 0.7)');

	legs(ctx, [-20, 20], 30, 44);
	ctx.restore();
}

/** Bluetooth beacon: a small board with a coin cell. */
function drawBleBeacon(ctx: CanvasRenderingContext2D, zoom: number): void {
	ctx.save();
	ctx.lineCap = 'round';

	ctx.fillStyle = '#25445c';
	ctx.strokeStyle = '#12293b';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-38, -32, 76, 66, 6);
	ctx.fill();
	ctx.stroke();

	const coin = ctx.createRadialGradient(-7, -11, 2, 0, -4, 26);
	coin.addColorStop(0, '#edf1f3');
	coin.addColorStop(0.6, '#b6bec4');
	coin.addColorStop(1, '#7b848a');
	ctx.fillStyle = coin;
	ctx.beginPath();
	ctx.arc(0, -4, 24, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#6a737a';
	ctx.lineWidth = 1.2;
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(0, -4, 15, 0, Math.PI * 2);
	ctx.stroke();

	// Cell polarity mark.
	ctx.strokeStyle = '#5c656c';
	ctx.lineWidth = 2;
	leg(ctx, -6, -4, 6, -4);
	leg(ctx, 0, 2, 0, -10);

	ctx.fillStyle = '#57d97e';
	ctx.beginPath();
	ctx.arc(27, 20, 2.6, 0, Math.PI * 2);
	ctx.fill();
	if (zoom >= 0.7) label(ctx, 'BLE', -18, 25, 6, 'rgba(205, 220, 230, 0.75)');

	legs(ctx, [-16, 16], 34, 46);
	ctx.restore();
}

/** 2.4 GHz module: PCB with a printed antenna, transceiver chip and crystal. */
function drawNrf24(ctx: CanvasRenderingContext2D, zoom: number): void {
	ctx.save();
	ctx.lineCap = 'round';

	// Printed antenna meander.
	ctx.strokeStyle = PAD_COLOR;
	ctx.lineWidth = 2.4;
	ctx.beginPath();
	ctx.moveTo(-30, -50);
	for (let i = 0; i < 5; i++) {
		const x = -30 + i * 12;
		ctx.lineTo(x + 6, -58);
		ctx.lineTo(x + 12, -50);
	}
	ctx.stroke();

	const board = ctx.createLinearGradient(0, -56, 0, 40);
	board.addColorStop(0, '#2c5a8c');
	board.addColorStop(1, '#173a5e');
	ctx.fillStyle = board;
	ctx.strokeStyle = '#0e2539';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-50, -50, 100, 90, 6);
	ctx.fill();
	ctx.stroke();

	// Transceiver chip.
	ctx.fillStyle = '#15181a';
	ctx.strokeStyle = '#0a0c0d';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.roundRect(-20, -28, 40, 30, 2);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#c7ced3';
	for (let i = 0; i < 4; i++) {
		const y = -23 + i * 7;
		ctx.fillRect(-25, y, 5, 3);
		ctx.fillRect(20, y, 5, 3);
	}
	if (zoom >= 0.7) label(ctx, 'nRF24', 0, -13, 8, 'rgba(210, 225, 240, 0.85)');

	// Crystal and passives.
	ctx.fillStyle = '#b9c0c6';
	ctx.fillRect(22, 6, 12, 8);
	ctx.fillStyle = '#8c7418';
	ctx.fillRect(-38, 6, 6, 4);
	ctx.fillRect(-28, 6, 6, 4);

	legs(ctx, [-56, -40, -24, -8, 8, 24, 40, 56], 40, 58);
	ctx.restore();
}

/** Sub-GHz LoRa module: PCB, SMA pigtail, transceiver chip and crystal. */
function drawSx1276(ctx: CanvasRenderingContext2D, zoom: number): void {
	ctx.save();
	ctx.lineCap = 'round';

	// SMA antenna connector.
	ctx.strokeStyle = '#8a9299';
	ctx.lineWidth = 2;
	leg(ctx, 0, -50, 0, -58);
	ctx.fillStyle = '#c3c9cd';
	ctx.strokeStyle = '#6f777d';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.arc(0, -66, 8, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#5b6268';
	ctx.beginPath();
	ctx.arc(0, -66, 3.5, 0, Math.PI * 2);
	ctx.fill();

	const board = ctx.createLinearGradient(0, -50, 0, 38);
	board.addColorStop(0, '#2f6b5a');
	board.addColorStop(1, '#183f34');
	ctx.fillStyle = board;
	ctx.strokeStyle = '#0f2b24';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-54, -50, 108, 88, 6);
	ctx.fill();
	ctx.stroke();

	// Transceiver chip.
	ctx.fillStyle = '#15181a';
	ctx.strokeStyle = '#0a0c0d';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.roundRect(-22, -30, 44, 34, 2);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#c7ced3';
	for (let i = 0; i < 5; i++) {
		const y = -25 + i * 7;
		ctx.fillRect(-27, y, 5, 3);
		ctx.fillRect(22, y, 5, 3);
	}
	if (zoom >= 0.7) label(ctx, 'SX1276', 0, -13, 8, 'rgba(210, 235, 225, 0.85)');

	ctx.fillStyle = '#b9c0c6';
	ctx.fillRect(26, 10, 14, 8);

	legs(ctx, [-56, -42, -28, -14, 0, 14, 28, 42, 56], 38, 58);
	ctx.restore();
}

/** IEEE 802.15.4 module: PCB with a ceramic antenna, radio chip and crystal. */
function drawAt86(ctx: CanvasRenderingContext2D, zoom: number): void {
	ctx.save();
	ctx.lineCap = 'round';

	// Ceramic chip antenna.
	ctx.fillStyle = '#c9a227';
	ctx.strokeStyle = '#8a6f18';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-34, -62, 46, 10, 2);
	ctx.fill();
	ctx.stroke();
	ctx.strokeStyle = PAD_COLOR;
	ctx.lineWidth = 1.6;
	leg(ctx, 12, -52, 12, -56);

	const board = ctx.createLinearGradient(0, -50, 0, 38);
	board.addColorStop(0, '#35664b');
	board.addColorStop(1, '#1b3d2c');
	ctx.fillStyle = board;
	ctx.strokeStyle = '#10271c';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-50, -50, 100, 88, 6);
	ctx.fill();
	ctx.stroke();

	// Radio chip.
	ctx.fillStyle = '#15181a';
	ctx.strokeStyle = '#0a0c0d';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.roundRect(-18, -28, 36, 30, 2);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#c7ced3';
	for (let i = 0; i < 4; i++) {
		const y = -23 + i * 7;
		ctx.fillRect(-23, y, 5, 3);
		ctx.fillRect(18, y, 5, 3);
	}
	if (zoom >= 0.7) label(ctx, 'AT86', 0, -13, 8, 'rgba(215, 235, 220, 0.85)');

	ctx.fillStyle = '#b9c0c6';
	ctx.fillRect(24, 8, 12, 8);

	legs(ctx, [-56, -42, -28, -14, 0, 14, 28, 42, 56], 38, 58);
	ctx.restore();
}

/** microSD card with a chamfered corner and gold contact fingers. */
function drawMicroSd(ctx: CanvasRenderingContext2D, zoom: number): void {
	ctx.save();
	ctx.lineCap = 'round';

	const card = ctx.createLinearGradient(-40, -52, 42, 42);
	card.addColorStop(0, '#2b3a4a');
	card.addColorStop(1, '#141d26');
	ctx.fillStyle = card;
	ctx.strokeStyle = '#0a1015';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.moveTo(-40, -52);
	ctx.lineTo(26, -52);
	ctx.lineTo(42, -36);
	ctx.lineTo(42, 42);
	ctx.lineTo(-40, 42);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	// Contact fingers.
	ctx.fillStyle = PAD_COLOR;
	for (let i = 0; i < 6; i++) ctx.fillRect(-32 + i * 11, -44, 7, 14);

	// Label panel.
	ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
	ctx.beginPath();
	ctx.roundRect(-32, -18, 64, 46, 3);
	ctx.fill();
	if (zoom >= 0.7) {
		label(ctx, 'microSD', 0, 0, 9, 'rgba(220, 230, 240, 0.9)');
		label(ctx, '4 GB', 0, 14, 7, 'rgba(190, 205, 220, 0.7)');
	}

	legs(ctx, [-36, -24, -12, 0, 12, 24, 36], 42, 58);
	ctx.restore();
}

/** 24C02: an 8-pin DIP serial EEPROM. */
function drawEepromDip(ctx: CanvasRenderingContext2D, zoom: number): void {
	ctx.save();

	sideLegs(ctx, [-33, -11, 11, 33], -30, -48);
	sideLegs(ctx, [-33, 11, 33], 30, 48);

	const body = ctx.createLinearGradient(0, -50, 0, 50);
	body.addColorStop(0, '#2a2e31');
	body.addColorStop(1, '#101213');
	ctx.fillStyle = body;
	ctx.strokeStyle = '#050708';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-30, -50, 60, 100, 4);
	ctx.fill();
	ctx.stroke();

	// Pin-1 notch at the top edge.
	ctx.fillStyle = '#050708';
	ctx.beginPath();
	ctx.arc(0, -50, 7, 0, Math.PI);
	ctx.fill();
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.arc(0, -50, 7, 0, Math.PI);
	ctx.stroke();

	if (zoom >= 0.7) {
		label(ctx, '24C02', 0, -20, 9, 'rgba(220, 225, 230, 0.85)');
		label(ctx, '256 B', 0, -6, 7, 'rgba(190, 198, 205, 0.7)');
	}
	ctx.restore();
}

/** W25Q32: an 8-pin SOIC SPI NOR flash. */
function drawSpiFlash(ctx: CanvasRenderingContext2D, zoom: number): void {
	ctx.save();

	sideLegs(ctx, [-30, -10, 10, 30], -30, -48);
	sideLegs(ctx, [-30, -10, 10, 30], 30, 48);

	const body = ctx.createLinearGradient(0, -44, 0, 44);
	body.addColorStop(0, '#292d30');
	body.addColorStop(1, '#0f1112');
	ctx.fillStyle = body;
	ctx.strokeStyle = '#050708';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-30, -44, 60, 88, 3);
	ctx.fill();
	ctx.stroke();

	// Pin-1 marker.
	ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
	ctx.beginPath();
	ctx.arc(-21, -35, 3, 0, Math.PI * 2);
	ctx.fill();

	if (zoom >= 0.7) {
		label(ctx, 'W25Q32', 0, -10, 9, 'rgba(220, 225, 230, 0.85)');
		label(ctx, '4 MiB', 0, 4, 7, 'rgba(190, 198, 205, 0.7)');
	}
	ctx.restore();
}

export const COMMS_PARTS: PartDef[] = [
	{
		type: 'litz-wifi-router',
		name: 'Wi-Fi router',
		category: 'Radio',
		keywords: ['wifi', 'wi-fi', 'router', 'access point', 'tcp', 'udp', 'mqtt'],
		width: 120,
		height: 110,
		pins: [
			{ name: '3V3', label: 'supply', x: -20, y: 44 },
			{ name: 'GND', x: 20, y: 44 }
		],
		attrs: [
			{ name: 'ssid', type: 'string', default: 'litz' },
			{ name: 'psk', type: 'string', default: '' },
			{ name: 'channel', type: 'number', default: 6 },
			{ name: 'http', type: 'string', default: 'hello from litz\n' },
			{ name: 'echo', type: 'string', default: '7' },
			{ name: 'udp_echo', type: 'string', default: '' },
			{ name: 'https', type: 'string', default: '' },
			{ name: 'ws', type: 'string', default: '' },
			{ name: 'wss', type: 'string', default: '' },
			{ name: 'mqtt', type: 'number', default: 1883 },
			{ name: 'nearby', type: 'string', default: '' }
		],
		draw: (ctx, _part, zoom) => drawWifiRouter(ctx, zoom)
	},
	{
		type: 'litz-ble-beacon',
		name: 'Bluetooth beacon',
		category: 'Radio',
		keywords: ['bluetooth', 'ble', 'beacon', 'advertiser', 'coin cell'],
		width: 100,
		height: 108,
		pins: [
			{ name: '3V3', label: 'supply', x: -16, y: 46 },
			{ name: 'GND', x: 16, y: 46 }
		],
		attrs: [
			{ name: 'name', type: 'string', default: 'litz' },
			{ name: 'address', type: 'string', default: '' },
			{ name: 'rssi', type: 'number', default: -60 },
			{ name: 'services', type: 'string', default: '' },
			{ name: 'adv', type: 'string', default: '' },
			{ name: 'rsp', type: 'string', default: '' }
		],
		draw: (ctx, _part, zoom) => drawBleBeacon(ctx, zoom)
	},
	{
		type: 'litz-nrf24l01',
		name: 'nRF24L01+',
		category: 'Radio',
		keywords: ['nrf24l01', 'radio', '2.4ghz', 'spi', 'transceiver'],
		width: 130,
		height: 150,
		pins: [
			{ name: 'VCC', x: -56, y: 58 },
			{ name: 'GND', x: -40, y: 58 },
			{ name: 'SCK', label: 'SPI clock', x: -24, y: 58 },
			{ name: 'MOSI', label: 'SPI data in', x: -8, y: 58 },
			{ name: 'MISO', label: 'SPI data out', x: 8, y: 58 },
			{ name: 'CSN', label: 'chip select, active low', x: 24, y: 58 },
			{ name: 'CE', label: 'chip enable; a rising edge starts TX', x: 40, y: 58 },
			{ name: 'IRQ', label: 'interrupt, active low', x: 56, y: 58 }
		],
		attrs: [
			{ name: 'network', type: 'string', default: 'nrf24' },
			{ name: 'channel', type: 'number', default: 76 },
			{ name: 'rate', type: 'enum', values: ['1M', '2M'], default: '1M' },
			{ name: 'address', type: 'string', default: 'e7e7e7e7e7' },
			{ name: 'payload_size', type: 'number', default: 32 }
		],
		draw: (ctx, _part, zoom) => drawNrf24(ctx, zoom)
	},
	{
		type: 'litz-sx1276',
		name: 'SX1276',
		category: 'Radio',
		keywords: ['sx1276', 'lora', 'sub-ghz', 'spi', 'transceiver'],
		width: 140,
		height: 150,
		pins: [
			{ name: 'VCC', x: -56, y: 58 },
			{ name: 'GND', x: -42, y: 58 },
			{ name: 'SCK', label: 'SPI clock', x: -28, y: 58 },
			{ name: 'MOSI', label: 'SPI data in', x: -14, y: 58 },
			{ name: 'MISO', label: 'SPI data out', x: 0, y: 58 },
			{ name: 'NSS', label: 'chip select, active low', x: 14, y: 58 },
			{ name: 'RESET', label: 'reset, active high', x: 28, y: 58 },
			{ name: 'DIO0', label: 'RxDone interrupt', x: 42, y: 58 },
			{ name: 'DIO1', label: 'TxDone interrupt', x: 56, y: 58 }
		],
		attrs: [
			{ name: 'network', type: 'string', default: 'lora' },
			{ name: 'frequency', type: 'number', default: 868.0 },
			{ name: 'sf', type: 'number', default: 7 },
			{ name: 'bandwidth', type: 'number', default: 125.0 },
			{ name: 'power', type: 'number', default: 14 }
		],
		draw: (ctx, _part, zoom) => drawSx1276(ctx, zoom)
	},
	{
		type: 'litz-at86rf233',
		name: 'AT86RF233',
		category: 'Radio',
		keywords: ['at86rf233', 'ieee802154', '802.15.4', 'zigbee', 'spi', 'transceiver'],
		width: 140,
		height: 150,
		pins: [
			{ name: 'VCC', x: -56, y: 58 },
			{ name: 'GND', x: -42, y: 58 },
			{ name: 'SCK', label: 'SPI clock', x: -28, y: 58 },
			{ name: 'MOSI', label: 'SPI data in', x: -14, y: 58 },
			{ name: 'MISO', label: 'SPI data out', x: 0, y: 58 },
			{ name: 'SELN', label: 'chip select, active low', x: 14, y: 58 },
			{ name: 'RSTN', label: 'reset, active low', x: 28, y: 58 },
			{
				name: 'IRQ',
				label: 'interrupt, active high until the driver changes polarity',
				x: 42,
				y: 58
			},
			{ name: 'SLPTR', label: 'sleep control', x: 56, y: 58 }
		],
		attrs: [
			{ name: 'network', type: 'string', default: 'ieee802154' },
			{ name: 'channel', type: 'number', default: 15 },
			{ name: 'pan', type: 'number', default: 0xabcd },
			{ name: 'address', type: 'number', default: 0x0001 },
			{ name: 'extended_address', type: 'string', default: '0011223344556677' },
			{ name: 'power', type: 'number', default: 0 }
		],
		draw: (ctx, _part, zoom) => drawAt86(ctx, zoom)
	},
	{
		type: 'litz-microsd-card',
		name: 'microSD card',
		category: 'Storage',
		keywords: ['microsd', 'sd', 'card', 'spi', 'storage'],
		width: 100,
		height: 130,
		pins: [
			{ name: 'CD', x: -36, y: 58 },
			{ name: 'DO', x: -24, y: 58 },
			{ name: 'GND', x: -12, y: 58 },
			{ name: 'SCK', x: 0, y: 58 },
			{ name: 'VCC', x: 12, y: 58 },
			{ name: 'DI', x: 24, y: 58 },
			{ name: 'CS', x: 36, y: 58 }
		],
		attrs: [{ name: 'image', type: 'string', default: '' }],
		draw: (ctx, _part, zoom) => drawMicroSd(ctx, zoom)
	},
	{
		type: 'litz-24c02',
		name: '24C02',
		category: 'Storage',
		keywords: ['24c02', 'eeprom', 'i2c', 'storage', 'dip'],
		width: 100,
		height: 120,
		pins: [
			{ name: 'A0', label: 'address select, low for 0x50', x: -48, y: -33 },
			{ name: 'A1', label: 'address select, low for 0x50', x: -48, y: -11 },
			{ name: 'A2', label: 'address select, low for 0x50', x: -48, y: 11 },
			{ name: 'GND', x: -48, y: 33 },
			{ name: 'SCL', label: 'I2C clock', x: 48, y: 11 },
			{ name: 'SDA', label: 'I2C data', x: 48, y: 33 },
			{ name: 'VCC', label: 'supply', x: 48, y: -33 }
		],
		attrs: [],
		draw: (ctx, _part, zoom) => drawEepromDip(ctx, zoom)
	},
	{
		type: 'litz-w25q32',
		name: 'W25Q32',
		category: 'Storage',
		keywords: ['w25q32', 'flash', 'spi', 'nor', 'storage', 'soic'],
		width: 100,
		height: 110,
		pins: [
			{ name: 'VCC', x: 48, y: -30 },
			{ name: 'GND', x: -48, y: 30 },
			{ name: 'CS', x: -48, y: -30 },
			{ name: 'CLK', x: 48, y: 10 },
			{ name: 'DI', x: 48, y: 30 },
			{ name: 'DO', x: -48, y: -10 },
			{ name: 'WP', label: 'write protect, active low', x: -48, y: 10 },
			{ name: 'HOLD', label: 'hold, active low', x: 48, y: -10 }
		],
		attrs: [],
		draw: (ctx, _part, zoom) => drawSpiFlash(ctx, zoom)
	}
];
