import { drawPanelFrame, panelFrame, shade } from '../art';
import type { PartInstance } from '#lib/sketch/types';
import type { PartDef, PinDef } from '../types';

/** Only hex values live here, so `shade` can always parse them. */
const LED_HEX: Record<string, string> = {
	red: '#e0503f',
	green: '#3fb862',
	blue: '#3d7ef0',
	yellow: '#f0c62a'
};

const RAINBOW = ['#e0503f', '#f08a2a', '#f0c62a', '#3fb862', '#3d7ef0', '#7b3fa0'];

function ledHex(value: unknown): string {
	return LED_HEX[String(value)] ?? LED_HEX.red;
}

function rainbow(index: number): string {
	return RAINBOW[((index % RAINBOW.length) + RAINBOW.length) % RAINBOW.length];
}

/** A centred row of pins, in catalog order. */
function pinRow(names: readonly string[], y: number, step: number): PinDef[] {
	const start = (-(names.length - 1) * step) / 2;
	return names.map((name, i) => ({ name, x: start + i * step, y }));
}

const P_4DIGIT = pinRow(
	['DIG1', 'DIG2', 'DIG3', 'DIG4', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP'],
	44,
	16
);
const P_LCD1602_I2C = pinRow(['GND', 'VCC', 'SDA', 'SCL'], 52, 18);
const P_LCD2004 = [
	...pinRow(['VSS', 'VDD', 'V0', 'RS', 'RW', 'E', 'D0', 'D1'], -68, 20),
	...pinRow(['D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'A', 'K'], 68, 20)
];
const P_LCD2004_I2C = pinRow(['GND', 'VCC', 'SDA', 'SCL'], 58, 18);
const P_NOKIA = pinRow(['RST', 'CE', 'DC', 'DIN', 'CLK', 'VCC', 'GND', 'BL'], 50, 15);
const P_SH1106 = pinRow(['GND', 'VCC', 'SCL', 'SDA'], 46, 20);
const P_ST7735 = pinRow(['VCC', 'GND', 'CS', 'RESET', 'DC', 'MOSI', 'SCK', 'LED', 'MISO'], 56, 14);
const P_ILI9341 = pinRow(['VCC', 'GND', 'CS', 'RESET', 'DC', 'MOSI', 'SCK', 'LED', 'MISO'], 92, 14);
const P_EPAPER154 = pinRow(['VCC', 'GND', 'DIN', 'CLK', 'CS', 'DC', 'RST', 'BUSY'], 56, 15);
const P_EPAPER213 = pinRow(['VCC', 'GND', 'DIN', 'CLK', 'CS', 'DC', 'RST', 'BUSY'], 84, 15);
const P_MAX7219_SPI = pinRow(['VCC', 'GND', 'DIN', 'CS', 'CLK', 'DOUT'], 52, 15);
const P_MAX7219_PIN = pinRow(['VCC', 'GND', 'DIN', 'CLK', 'LOAD', 'DOUT'], 52, 15);
const P_TM1637 = pinRow(['CLK', 'DIO', 'VCC', 'GND'], 30, 16);
const P_LED_MATRIX = pinRow(['VDD', 'VSS', 'DIN', 'DOUT'], 52, 18);
const P_LED_RING = pinRow(['VDD', 'DOUT', 'VSS', 'DIN'], 52, 18);
const P_LED_STRIP = pinRow(['VDD', 'VSS', 'DIN', 'DOUT'], 26, 14);
const P_NEOPIXEL_MATRIX = pinRow(['VDD', 'DOUT', 'VSS', 'DIN'], 52, 18);
const P_RGB_PANEL = pinRow(['GND', 'SCL', 'SDA', 'VCC'], 46, 18);
const P_BAR_GRAPH = pinRow(
	['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'C'],
	46,
	15
);
const P_TRAFFIC = pinRow(['R', 'Y', 'G', 'GND'], 80, 18);
const P_XPT2046 = pinRow(['VCC', 'GND', 'CS', 'CLK', 'DIN', 'DOUT', 'IRQ'], 38, 15);

function lead(ctx: CanvasRenderingContext2D, x: number, y1: number, y2: number): void {
	ctx.beginPath();
	ctx.moveTo(x, y1);
	ctx.lineTo(x, y2);
	ctx.stroke();
}

/** Short metal legs from the body edge out to each pin. */
function pinLegs(ctx: CanvasRenderingContext2D, pins: readonly PinDef[]): void {
	ctx.save();
	ctx.strokeStyle = '#b7bdc2';
	ctx.lineWidth = 2.4;
	ctx.lineCap = 'round';
	for (const pin of pins) {
		const dir = pin.y < 0 ? -1 : 1;
		lead(ctx, pin.x, pin.y - dir * 9, pin.y);
	}
	ctx.restore();
}

function cells(
	ctx: CanvasRenderingContext2D,
	x0: number,
	y0: number,
	cols: number,
	rows: number,
	cellW: number,
	cellH: number,
	stepX: number,
	stepY: number,
	color: string
): void {
	ctx.fillStyle = color;
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			ctx.fillRect(x0 + c * stepX, y0 + r * stepY, cellW, cellH);
		}
	}
}

function screenNote(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	color: string
): void {
	ctx.fillStyle = color;
	ctx.font = '7px ui-sans-serif, system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(text, x, y);
}

/** One seven-segment digit; bit 0 is `a`, bit 6 is `g`. */
function digit(
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	w: number,
	h: number,
	mask: number,
	color: string
): void {
	const t = Math.max(2.4, w * 0.16);
	const hw = w / 2;
	const hh = h / 2;
	ctx.save();
	ctx.lineCap = 'round';
	ctx.lineWidth = t;
	const seg = (x1: number, y1: number, x2: number, y2: number, bit: number) => {
		ctx.strokeStyle = (mask & (1 << bit)) !== 0 ? color : 'rgba(255, 255, 255, 0.07)';
		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.stroke();
	};
	seg(cx - hw + t, cy - hh, cx + hw - t, cy - hh, 0);
	seg(cx + hw, cy - hh + t, cx + hw, cy - t, 1);
	seg(cx + hw, cy + t, cx + hw, cy + hh - t, 2);
	seg(cx - hw + t, cy + hh, cx + hw - t, cy + hh, 3);
	seg(cx - hw, cy + t, cx - hw, cy + hh - t, 4);
	seg(cx - hw, cy - hh + t, cx - hw, cy - t, 5);
	seg(cx - hw + t, cy, cx + hw - t, cy, 6);
	ctx.restore();
}

function led(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	r: number,
	color: string,
	lit: boolean,
	round: boolean
): void {
	if (lit) {
		const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
		halo.addColorStop(0, color);
		halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
		ctx.save();
		ctx.globalAlpha = 0.4;
		ctx.fillStyle = halo;
		ctx.beginPath();
		ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}
	ctx.fillStyle = lit ? shade(color, 0.12) : '#15191b';
	ctx.beginPath();
	if (round) {
		ctx.arc(x, y, r, 0, Math.PI * 2);
	} else {
		ctx.roundRect(x - r, y - r, r * 2, r * 2, r * 0.45);
	}
	ctx.fill();
	if (lit) {
		ctx.fillStyle = shade(color, 0.8);
		ctx.beginPath();
		ctx.arc(x - r * 0.28, y - r * 0.28, r * 0.3, 0, Math.PI * 2);
		ctx.fill();
	}
}

function drawFourDigit(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	const color = ledHex(part.attrs.color);
	ctx.save();
	pinLegs(ctx, P_4DIGIT);

	const board = ctx.createLinearGradient(0, -42, 0, 38);
	board.addColorStop(0, '#262b2e');
	board.addColorStop(1, '#14181a');
	ctx.fillStyle = board;
	ctx.strokeStyle = '#0b0d0e';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-94, -42, 188, 80, 6);
	ctx.fill();
	ctx.stroke();

	for (let i = 0; i < 4; i++) {
		const cx = -69 + i * 46;
		ctx.fillStyle = '#0a0b0c';
		ctx.beginPath();
		ctx.roundRect(cx - 20, -34, 40, 58, 4);
		ctx.fill();
		digit(ctx, cx, -6, 24, 40, 0x7f, color);
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.arc(cx + 15, 20, 2.2, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}

interface LcdLook {
	board: string;
	edge: string;
	glass: string;
	ink: string;
}

function lcdLook(part: PartInstance, withBackground: boolean): LcdLook {
	const color = String(part.attrs.color ?? 'black');
	const background = withBackground ? String(part.attrs.background ?? 'green') : 'green';
	const blue = background === 'blue';
	const backlight = blue ? '130, 190, 255' : '120, 220, 150';
	const alpha = color === 'white' ? 0.62 : 0.45;
	return {
		board: blue ? '#27528f' : '#2f7d4f',
		edge: blue ? '#173660' : '#1d5234',
		glass: blue ? '#0d2440' : '#14261a',
		ink: `rgba(${backlight}, ${alpha})`
	};
}

function drawLcdBody(
	ctx: CanvasRenderingContext2D,
	look: LcdLook,
	x: number,
	y: number,
	w: number,
	h: number,
	cols: number,
	rows: number,
	label: string
): void {
	ctx.fillStyle = look.board;
	ctx.strokeStyle = look.edge;
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(x, y, w, h, 5);
	ctx.fill();
	ctx.stroke();

	const gx = x + 12;
	const gy = y + 9;
	const gw = w - 24;
	const gh = h - 26;
	ctx.fillStyle = look.glass;
	ctx.beginPath();
	ctx.roundRect(gx, gy, gw, gh, 2);
	ctx.fill();

	const stepX = gw / cols;
	const stepY = gh / rows;
	cells(
		ctx,
		gx + stepX * 0.22,
		gy + stepY * 0.28,
		cols,
		rows,
		stepX * 0.56,
		stepY * 0.42,
		stepX,
		stepY,
		look.ink
	);
	screenNote(ctx, label, x + w / 2, y + h - 7, 'rgba(235, 240, 225, 0.7)');
}

function drawLcd1602I2c(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	ctx.save();
	pinLegs(ctx, P_LCD1602_I2C);
	drawLcdBody(ctx, lcdLook(part, false), -84, -44, 168, 88, 16, 2, '16 × 2');
	ctx.restore();
}

function drawLcd2004(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	ctx.save();
	pinLegs(ctx, P_LCD2004);
	drawLcdBody(ctx, lcdLook(part, true), -84, -54, 168, 108, 20, 4, '20 × 4');
	ctx.restore();
}

function drawLcd2004I2c(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	ctx.save();
	pinLegs(ctx, P_LCD2004_I2C);
	drawLcdBody(ctx, lcdLook(part, false), -84, -48, 168, 96, 20, 4, '20 × 4');
	ctx.restore();
}

function drawNokia(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	const tint = String(part.attrs.color ?? 'blue');
	const screen = tint === 'white' ? '#e6e3d6' : tint === 'red' ? '#2a1212' : '#0b2438';
	const ink =
		tint === 'white'
			? 'rgba(35, 48, 58, 0.7)'
			: tint === 'red'
				? 'rgba(255, 140, 120, 0.75)'
				: 'rgba(88, 200, 232, 0.75)';
	ctx.save();
	pinLegs(ctx, P_NOKIA);

	const frame = ctx.createLinearGradient(-60, -44, 60, 42);
	frame.addColorStop(0, '#d7dbde');
	frame.addColorStop(0.5, '#9aa2a8');
	frame.addColorStop(1, '#c3c9cd');
	ctx.fillStyle = frame;
	ctx.strokeStyle = '#70787e';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.roundRect(-60, -44, 120, 86, 5);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = screen;
	ctx.beginPath();
	ctx.roundRect(-48, -32, 96, 58, 2);
	ctx.fill();

	const live = panelFrame(part);
	if (live && drawPanelFrame(ctx, part.id, live, -48, -32, 96, 58)) {
		ctx.restore();
		return;
	}
	// Nothing on the glass yet: a coarse 84 × 48 pixel preview.
	cells(ctx, -44, -27, 12, 5, 5, 5, 7.6, 6.9, ink);
	screenNote(ctx, '84 × 48', 0, 15, ink);
	ctx.restore();
}

function drawSh1106(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	ctx.save();
	pinLegs(ctx, P_SH1106);

	ctx.fillStyle = '#1f4f8f';
	ctx.strokeStyle = '#12325c';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-42, -34, 84, 64, 4);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#080a0b';
	ctx.beginPath();
	ctx.roundRect(-33, -26, 66, 42, 2);
	ctx.fill();

	const live = panelFrame(part);
	if (live && drawPanelFrame(ctx, part.id, live, -33, -26, 66, 42)) {
		ctx.restore();
		return;
	}
	const ink = 'rgba(90, 200, 255, 0.68)';
	ctx.fillStyle = ink;
	ctx.fillRect(-28, -20, 50, 3);
	ctx.fillRect(-28, -12, 36, 3);
	ctx.fillRect(-28, -4, 46, 3);
	ctx.fillRect(-28, 4, 28, 3);
	screenNote(ctx, '128 × 64', 0, 15, 'rgba(90, 200, 255, 0.5)');
	ctx.restore();
}

function tft(
	ctx: CanvasRenderingContext2D,
	part: PartInstance,
	x: number,
	y: number,
	w: number,
	h: number,
	label: string
): void {
	const board = ctx.createLinearGradient(0, y, 0, y + h);
	board.addColorStop(0, '#252a2e');
	board.addColorStop(1, '#121516');
	ctx.fillStyle = board;
	ctx.strokeStyle = '#0a0c0d';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(x, y, w, h, 4);
	ctx.fill();
	ctx.stroke();

	const gx = x + 8;
	const gy = y + 8;
	const gw = w - 16;
	const gh = h - 24;
	const glass = ctx.createLinearGradient(gx, gy, gx + gw, gy + gh);
	glass.addColorStop(0, '#3d7ef0');
	glass.addColorStop(0.35, '#3fb862');
	glass.addColorStop(0.6, '#f0c62a');
	glass.addColorStop(0.82, '#e0503f');
	glass.addColorStop(1, '#7b3fa0');
	ctx.fillStyle = glass;
	ctx.beginPath();
	ctx.roundRect(gx, gy, gw, gh, 2);
	ctx.fill();

	ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
	ctx.beginPath();
	ctx.moveTo(gx, gy);
	ctx.lineTo(gx + gw * 0.55, gy);
	ctx.lineTo(gx, gy + gh * 0.7);
	ctx.closePath();
	ctx.fill();

	const frame = panelFrame(part);
	if (frame) drawPanelFrame(ctx, part.id, frame, gx, gy, gw, gh);

	screenNote(ctx, label, x + w / 2, y + h - 8, 'rgba(235, 240, 240, 0.75)');
}

function drawSt7735(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	ctx.save();
	pinLegs(ctx, P_ST7735);
	tft(ctx, part, -70, -50, 140, 98, '160 × 128');
	ctx.restore();
}

function drawIli9341(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	ctx.save();
	pinLegs(ctx, P_ILI9341);
	tft(ctx, part, -64, -86, 128, 176, '240 × 320');
	ctx.restore();
}

function epaper(
	ctx: CanvasRenderingContext2D,
	part: PartInstance,
	pins: readonly PinDef[],
	x: number,
	y: number,
	w: number,
	h: number,
	label: string
): void {
	pinLegs(ctx, pins);

	ctx.fillStyle = '#1c1f21';
	ctx.strokeStyle = '#0b0c0d';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(x, y, w, h, 3);
	ctx.fill();
	ctx.stroke();

	const px = x + 6;
	const py = y + 6;
	const pw = w - 12;
	const ph = h - 12;
	ctx.fillStyle = '#ece9df';
	ctx.strokeStyle = '#c7c2b4';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.roundRect(px, py, pw, ph, 1);
	ctx.fill();
	ctx.stroke();

	const frame = panelFrame(part);
	if (!frame || !drawPanelFrame(ctx, part.id, frame, px, py, pw, ph)) {
		// Nothing on the glass yet: a sparse 1-bit layout stands in for it.
		ctx.strokeStyle = 'rgba(30, 32, 30, 0.65)';
		ctx.lineWidth = 1.2;
		ctx.strokeRect(px + 6, py + 6, pw - 12, ph - 12);
		ctx.fillStyle = 'rgba(30, 32, 30, 0.55)';
		for (let i = 0; i < 5; i++) {
			ctx.fillRect(px + 12, py + 16 + i * 7, pw - 24 - (i % 3) * 12, 2);
		}
		screenNote(ctx, label, px + pw / 2, py + ph - 10, 'rgba(30, 32, 30, 0.7)');
	}
}

function drawEpaper154(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	ctx.save();
	epaper(ctx, part, P_EPAPER154, -62, -54, 124, 102, '200 × 200');
	ctx.restore();
}

function drawEpaper213(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	ctx.save();
	epaper(ctx, part, P_EPAPER213, -56, -82, 112, 156, '122 × 250');
	ctx.restore();
}

const HEART = [
	'01100110',
	'11111111',
	'11111111',
	'11111111',
	'01111110',
	'00111100',
	'00011000',
	'00000000'
];

function drawDotMatrix(
	ctx: CanvasRenderingContext2D,
	pins: readonly PinDef[],
	color: string
): void {
	ctx.save();
	pinLegs(ctx, pins);

	ctx.fillStyle = '#1b2a24';
	ctx.strokeStyle = '#0c1210';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-50, -46, 100, 86, 3);
	ctx.fill();
	ctx.stroke();

	for (let r = 0; r < 8; r++) {
		for (let c = 0; c < 8; c++) {
			led(ctx, -35 + c * 10, -35 + r * 10, 3.1, color, HEART[r][c] === '1', true);
		}
	}
	ctx.restore();
}

function drawMaxSpi(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	drawDotMatrix(ctx, P_MAX7219_SPI, ledHex(part.attrs.color));
}

function drawMaxPin(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	drawDotMatrix(ctx, P_MAX7219_PIN, ledHex(part.attrs.color));
}

const TM1637_MASKS = [0x06, 0x5b, 0x4f, 0x66];

function drawTm1637(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	const color = ledHex(part.attrs.color);
	const kind = String(part.attrs.type ?? 'colon');
	ctx.save();
	pinLegs(ctx, P_TM1637);

	ctx.fillStyle = '#191c1e';
	ctx.strokeStyle = '#0a0c0d';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-54, -27, 108, 50, 3);
	ctx.fill();
	ctx.stroke();

	const centers = [-39, -15, 15, 39];
	for (let i = 0; i < 4; i++) {
		ctx.fillStyle = '#0a0b0c';
		ctx.beginPath();
		ctx.roundRect(centers[i] - 10, -19, 20, 36, 3);
		ctx.fill();
		digit(ctx, centers[i], -1, 13, 28, TM1637_MASKS[i], color);
	}

	ctx.fillStyle = color;
	if (kind === 'colon') {
		ctx.beginPath();
		ctx.arc(0, -8, 2, 0, Math.PI * 2);
		ctx.fill();
		ctx.beginPath();
		ctx.arc(0, 4, 2, 0, Math.PI * 2);
		ctx.fill();
	} else {
		for (const cx of centers) {
			ctx.beginPath();
			ctx.arc(cx + 8, 13, 1.8, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	ctx.restore();
}

function drawAddressableMatrix(
	ctx: CanvasRenderingContext2D,
	pins: readonly PinDef[],
	domed: boolean
): void {
	ctx.save();
	pinLegs(ctx, pins);

	ctx.fillStyle = '#141719';
	ctx.strokeStyle = '#080a0a';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-46, -42, 92, 82, 4);
	ctx.fill();
	ctx.stroke();

	for (let r = 0; r < 8; r++) {
		for (let c = 0; c < 8; c++) {
			led(ctx, -35 + c * 10, -34 + r * 10, 3.2, rainbow(r * 2 + c), true, domed);
		}
	}
	ctx.restore();
}

function drawLedMatrix(ctx: CanvasRenderingContext2D): void {
	drawAddressableMatrix(ctx, P_LED_MATRIX, false);
}

function drawNeopixelMatrix(ctx: CanvasRenderingContext2D): void {
	drawAddressableMatrix(ctx, P_NEOPIXEL_MATRIX, true);
}

function drawLedRing(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	pinLegs(ctx, P_LED_RING);

	ctx.fillStyle = '#15181a';
	ctx.strokeStyle = '#080a0a';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.arc(0, 0, 44, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#0a0b0c';
	ctx.beginPath();
	ctx.arc(0, 0, 22, 0, Math.PI * 2);
	ctx.fill();

	for (let i = 0; i < 12; i++) {
		const angle = -Math.PI / 2 + (i * Math.PI * 2) / 12;
		led(ctx, Math.cos(angle) * 33, Math.sin(angle) * 33, 4.2, rainbow(i), true, true);
	}
	ctx.restore();
}

function drawLedStrip(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	pinLegs(ctx, P_LED_STRIP);

	const strip = ctx.createLinearGradient(0, -16, 0, 16);
	strip.addColorStop(0, '#22282b');
	strip.addColorStop(1, '#0f1214');
	ctx.fillStyle = strip;
	ctx.strokeStyle = '#080a0a';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-84, -16, 168, 32, 5);
	ctx.fill();
	ctx.stroke();

	for (let i = 0; i < 8; i++) {
		led(ctx, -70 + i * 20, 0, 5.2, rainbow(i), true, true);
	}
	ctx.restore();
}

function drawRgbPanel(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	pinLegs(ctx, P_RGB_PANEL);

	ctx.fillStyle = '#1a1e21';
	ctx.strokeStyle = '#0a0c0d';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-42, -38, 84, 76, 3);
	ctx.fill();
	ctx.stroke();

	const x0 = -34;
	const y0 = -30;
	const step = 8.5;
	for (let r = 0; r < 8; r++) {
		for (let c = 0; c < 8; c++) {
			ctx.fillStyle = shade(rainbow(r * 2 + c), -0.12);
			ctx.fillRect(x0 + c * step, y0 + r * step, step - 1.1, step - 1.1);
		}
	}
	ctx.restore();
}

function drawBarGraph(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	pinLegs(ctx, P_BAR_GRAPH);

	ctx.fillStyle = '#14181a';
	ctx.strokeStyle = '#080a0a';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-80, -38, 160, 70, 3);
	ctx.fill();
	ctx.stroke();

	for (let i = 0; i < 10; i++) {
		const x = -67.5 + i * 15;
		const bar = ctx.createLinearGradient(0, -28, 0, 24);
		bar.addColorStop(0, shade('#e0503f', 0.35));
		bar.addColorStop(0.5, '#e0503f');
		bar.addColorStop(1, shade('#e0503f', -0.25));
		ctx.fillStyle = bar;
		ctx.beginPath();
		ctx.roundRect(x - 4.5, -28, 9, 52, 4);
		ctx.fill();
		ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
		ctx.beginPath();
		ctx.roundRect(x - 2.6, -24, 1.6, 42, 0.8);
		ctx.fill();
	}
	ctx.restore();
}

function trafficLens(
	ctx: CanvasRenderingContext2D,
	cy: number,
	color: string,
	glowColor: string
): void {
	ctx.fillStyle = '#101315';
	ctx.beginPath();
	ctx.arc(0, cy, 17, 0, Math.PI * 2);
	ctx.fill();

	const halo = ctx.createRadialGradient(0, cy, 2, 0, cy, 24);
	halo.addColorStop(0, glowColor);
	halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
	ctx.save();
	ctx.globalAlpha = 0.45;
	ctx.fillStyle = halo;
	ctx.beginPath();
	ctx.arc(0, cy, 24, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();

	const lensGrad = ctx.createRadialGradient(-4, cy - 5, 1, 0, cy, 16);
	lensGrad.addColorStop(0, shade(color, 0.75));
	lensGrad.addColorStop(0.55, color);
	lensGrad.addColorStop(1, shade(color, -0.45));
	ctx.fillStyle = lensGrad;
	ctx.beginPath();
	ctx.arc(0, cy, 14, 0, Math.PI * 2);
	ctx.fill();
}

function drawTrafficLight(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	pinLegs(ctx, P_TRAFFIC);

	const housing = ctx.createLinearGradient(-32, 0, 32, 0);
	housing.addColorStop(0, '#3b4145');
	housing.addColorStop(0.5, '#22272a');
	housing.addColorStop(1, '#15181a');
	ctx.fillStyle = housing;
	ctx.strokeStyle = '#0a0c0d';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-32, -80, 64, 150, 10);
	ctx.fill();
	ctx.stroke();

	trafficLens(ctx, -56, '#e0503f', 'rgba(224, 80, 63, 0.75)');
	trafficLens(ctx, -14, '#f0c62a', 'rgba(240, 198, 42, 0.6)');
	trafficLens(ctx, 28, '#3fb862', 'rgba(63, 184, 98, 0.65)');

	// Visor lips above each lens.
	ctx.fillStyle = '#2b3033';
	for (const cy of [-56, -14, 28]) {
		ctx.beginPath();
		ctx.roundRect(-19, cy - 20, 38, 5, 2);
		ctx.fill();
	}
	ctx.restore();
}

function drawXpt2046(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	pinLegs(ctx, P_XPT2046);

	ctx.fillStyle = '#2f7d4f';
	ctx.strokeStyle = '#1d5234';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-42, -30, 84, 58, 3);
	ctx.fill();
	ctx.stroke();

	// Touch-panel tail entering from the top.
	ctx.fillStyle = '#c9a227';
	ctx.beginPath();
	ctx.roundRect(-26, -40, 52, 12, 1);
	ctx.fill();

	const chip = ctx.createLinearGradient(0, -18, 0, 14);
	chip.addColorStop(0, '#d7dbde');
	chip.addColorStop(1, '#8d959a');
	ctx.fillStyle = chip;
	ctx.strokeStyle = '#5f676c';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.roundRect(-20, -18, 40, 32, 2);
	ctx.fill();
	ctx.stroke();

	screenNote(ctx, 'XPT2046', 0, -2, '#2b3134');
	ctx.restore();
}

export const DISPLAY_PARTS: PartDef[] = [
	{
		type: 'litz-7segment-4digit',
		name: '4-digit 7-segment display',
		category: 'Displays',
		keywords: ['7segment', '4digit', 'display', 'segment'],
		width: 200,
		height: 96,
		pins: P_4DIGIT,
		attrs: [
			{
				name: 'color',
				type: 'enum',
				values: ['red', 'green', 'blue', 'yellow'],
				default: 'red'
			}
		],
		draw: drawFourDigit
	},
	{
		type: 'litz-lcd1602-i2c',
		name: 'LCD 1602 I2C',
		category: 'Displays',
		keywords: ['lcd', '1602', 'i2c', 'display', 'character'],
		width: 176,
		height: 112,
		pins: P_LCD1602_I2C,
		attrs: [
			{
				name: 'color',
				type: 'enum',
				values: ['black', 'white', 'blue'],
				default: 'black'
			}
		],
		draw: drawLcd1602I2c
	},
	{
		type: 'litz-lcd2004',
		name: 'LCD 2004',
		category: 'Displays',
		keywords: ['lcd', '2004', 'display', 'character', 'parallel'],
		width: 190,
		height: 140,
		pins: P_LCD2004,
		attrs: [
			{
				name: 'color',
				type: 'enum',
				values: ['black', 'white', 'blue'],
				default: 'black'
			},
			{
				name: 'background',
				type: 'enum',
				values: ['green', 'blue'],
				default: 'green'
			},
			{
				name: 'variant',
				type: 'enum',
				values: ['A00', 'A02'],
				default: 'A00'
			}
		],
		artAttr: 'background',
		draw: drawLcd2004
	},
	{
		type: 'litz-lcd2004-i2c',
		name: 'LCD 2004 I2C',
		category: 'Displays',
		keywords: ['lcd', '2004', 'i2c', 'display', 'character'],
		width: 190,
		height: 124,
		pins: P_LCD2004_I2C,
		attrs: [
			{
				name: 'color',
				type: 'enum',
				values: ['black', 'white', 'blue'],
				default: 'black'
			}
		],
		draw: drawLcd2004I2c
	},
	{
		type: 'litz-nokia-5110-screen',
		name: 'Nokia 5110 screen',
		category: 'Displays',
		keywords: ['nokia', '5110', 'lcd', 'display', 'pcd8544'],
		width: 132,
		height: 112,
		pins: P_NOKIA,
		attrs: [
			{
				name: 'color',
				type: 'enum',
				values: ['blue', 'white', 'red'],
				default: 'blue'
			}
		],
		draw: drawNokia
	},
	{
		type: 'litz-sh1106',
		name: 'SH1106 OLED',
		category: 'Displays',
		keywords: ['oled', 'sh1106', 'display', 'i2c'],
		width: 96,
		height: 96,
		pins: P_SH1106,
		attrs: [],
		draw: drawSh1106
	},
	{
		type: 'litz-st7735',
		name: 'ST7735 TFT',
		category: 'Displays',
		keywords: ['tft', 'st7735', 'display', 'spi', 'colour'],
		width: 156,
		height: 130,
		pins: P_ST7735,
		attrs: [],
		draw: drawSt7735
	},
	{
		type: 'litz-ili9341',
		name: 'ILI9341 TFT',
		category: 'Displays',
		keywords: ['tft', 'ili9341', 'display', 'spi', 'colour'],
		width: 150,
		height: 200,
		pins: P_ILI9341,
		attrs: [],
		draw: drawIli9341
	},
	{
		type: 'litz-epaper-1in54',
		name: 'E-paper 1.54',
		category: 'Displays',
		keywords: ['epaper', 'e-paper', 'display', 'spi', '1.54'],
		width: 136,
		height: 128,
		pins: P_EPAPER154,
		attrs: [
			{
				name: 'size',
				type: 'enum',
				values: ['1.54', '2.13'],
				default: '1.54'
			}
		],
		draw: drawEpaper154
	},
	{
		type: 'litz-epaper-2in13',
		name: 'E-paper 2.13',
		category: 'Displays',
		keywords: ['epaper', 'e-paper', 'display', 'spi', '2.13'],
		width: 124,
		height: 184,
		pins: P_EPAPER213,
		attrs: [
			{
				name: 'size',
				type: 'enum',
				values: ['1.54', '2.13'],
				default: '2.13'
			}
		],
		draw: drawEpaper213
	},
	{
		type: 'litz-max7219-matrix',
		name: 'MAX7219 8x8 matrix',
		category: 'Displays',
		keywords: ['max7219', 'matrix', 'led', 'display', 'spi'],
		width: 112,
		height: 116,
		pins: P_MAX7219_SPI,
		attrs: [
			{ name: 'chain', type: 'number', default: 1 },
			{
				name: 'color',
				type: 'enum',
				values: ['red', 'green', 'blue', 'yellow'],
				default: 'red'
			},
			{
				name: 'layout',
				type: 'enum',
				values: ['parola', 'fc16'],
				default: 'parola'
			}
		],
		artAttr: 'color',
		draw: drawMaxSpi
	},
	{
		type: 'litz-max7219-single',
		name: 'MAX7219 8x8 matrix (pin level)',
		category: 'Displays',
		keywords: ['max7219', 'matrix', 'led', 'display'],
		width: 112,
		height: 116,
		pins: P_MAX7219_PIN,
		attrs: [
			{
				name: 'color',
				type: 'enum',
				values: ['red', 'green', 'blue', 'yellow'],
				default: 'red'
			}
		],
		artAttr: 'color',
		draw: drawMaxPin
	},
	{
		type: 'litz-tm1637-7segment',
		name: 'TM1637 4-digit display',
		category: 'Displays',
		keywords: ['tm1637', '7segment', 'display', 'digit'],
		width: 120,
		height: 74,
		pins: P_TM1637,
		attrs: [
			{
				name: 'color',
				type: 'enum',
				values: ['red', 'green', 'blue'],
				default: 'red'
			},
			{
				name: 'type',
				type: 'enum',
				values: ['colon', 'dp'],
				default: 'colon'
			}
		],
		draw: drawTm1637
	},
	{
		type: 'litz-led-matrix',
		name: 'WS2812 LED matrix',
		category: 'Lights',
		keywords: ['led', 'matrix', 'ws2812', 'neopixel', 'rgb'],
		width: 104,
		height: 116,
		pins: P_LED_MATRIX,
		attrs: [
			{ name: 'rows', type: 'number', default: 8 },
			{ name: 'cols', type: 'number', default: 8 }
		],
		draw: drawLedMatrix
	},
	{
		type: 'litz-led-ring',
		name: 'NeoPixel ring',
		category: 'Lights',
		keywords: ['led', 'ring', 'ws2812', 'neopixel', 'rgb'],
		width: 104,
		height: 116,
		pins: P_LED_RING,
		attrs: [{ name: 'pixels', type: 'number', default: 12 }],
		draw: drawLedRing
	},
	{
		type: 'litz-led-strip',
		name: 'WS2812 LED strip',
		category: 'Lights',
		keywords: ['led', 'strip', 'ws2812', 'neopixel', 'rgb'],
		width: 176,
		height: 60,
		pins: P_LED_STRIP,
		attrs: [{ name: 'pixels', type: 'number', default: 8 }],
		draw: drawLedStrip
	},
	{
		type: 'litz-neopixel-matrix',
		name: 'NeoPixel matrix',
		category: 'Lights',
		keywords: ['neopixel', 'matrix', 'ws2812', 'rgb', 'led'],
		width: 104,
		height: 116,
		pins: P_NEOPIXEL_MATRIX,
		attrs: [
			{ name: 'rows', type: 'number', default: 8 },
			{ name: 'cols', type: 'number', default: 8 }
		],
		draw: drawNeopixelMatrix
	},
	{
		type: 'litz-rgb-panel',
		name: 'RGB panel',
		category: 'Lights',
		keywords: ['rgb', 'panel', 'display', 'i2c', 'framebuffer'],
		width: 96,
		height: 104,
		pins: P_RGB_PANEL,
		attrs: [],
		draw: drawRgbPanel
	},
	{
		type: 'litz-led-bar-graph',
		name: 'LED bar graph',
		category: 'Lights',
		keywords: ['led', 'bar', 'graph', 'segment'],
		width: 168,
		height: 104,
		pins: P_BAR_GRAPH,
		attrs: [],
		draw: drawBarGraph
	},
	{
		type: 'litz-traffic-light',
		name: 'Traffic light module',
		category: 'Lights',
		keywords: ['traffic', 'light', 'led', 'red', 'green'],
		width: 84,
		height: 176,
		pins: P_TRAFFIC,
		attrs: [],
		draw: drawTrafficLight
	},
	{
		type: 'litz-xpt2046',
		name: 'XPT2046 touch controller',
		category: 'Modules',
		keywords: ['touch', 'xpt2046', 'spi', 'controller', 'screen'],
		width: 96,
		height: 84,
		pins: P_XPT2046,
		attrs: [],
		draw: drawXpt2046
	}
];
