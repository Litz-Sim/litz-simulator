import type { DisplayFrame } from '#lib/sim/backend';
import { liveDisplay, livePanel, livePart, liveState } from '#lib/sim/live';
import type { PartInstance } from '#lib/sketch/types';

/** Mix a #rrggbb colour towards white (amount > 0) or black (amount < 0). */
export function shade(hex: string, amount: number): string {
	const value = hex.replace('#', '');
	const num = parseInt(value, 16);
	const r = (num >> 16) & 255;
	const g = (num >> 8) & 255;
	const b = num & 255;
	const target = amount > 0 ? 255 : 0;
	const t = Math.abs(amount);
	const mix = (channel: number) => Math.round(channel + (target - channel) * t);
	return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

interface LedColors {
	body: string;
}

const LED_COLORS: Record<string, LedColors> = {
	red: { body: '#e0503f' },
	green: { body: '#3fb862' },
	blue: { body: '#3d7ef0' },
	yellow: { body: '#f0c62a' },
	white: { body: '#f3f1ea' },
	orange: { body: '#f08a2a' }
};

function leg(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
}

export function drawLed(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	const colors = LED_COLORS[String(part.attrs.color ?? 'red')] ?? LED_COLORS.red;
	const lit = liveState(part.id) === 'on';
	ctx.save();
	ctx.lineCap = 'round';

	ctx.strokeStyle = '#9aa2a9';
	ctx.lineWidth = 3.4;
	leg(ctx, -8, 10, -10, 42);
	leg(ctx, 8, 10, 10, 42);

	ctx.fillStyle = '#cfd4d8';
	ctx.strokeStyle = '#71797f';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.ellipse(0, 9, 20, 8.5, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();

	if (lit) {
		const glow = ctx.createRadialGradient(0, 0, 6, 0, 0, 42);
		glow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
		glow.addColorStop(0.3, colors.body);
		glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
		ctx.save();
		ctx.globalAlpha = 0.6;
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.arc(0, 0, 42, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}

	const gradient = ctx.createRadialGradient(-7, -8, 1, 0, 0, 22);
	gradient.addColorStop(0, shade(colors.body, lit ? 0.85 : 0.55));
	gradient.addColorStop(0.55, lit ? shade(colors.body, 0.25) : colors.body);
	gradient.addColorStop(1, shade(colors.body, -0.32));
	ctx.fillStyle = gradient;
	ctx.beginPath();
	ctx.arc(0, 0, 18.5, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = shade(colors.body, -0.45);
	ctx.lineWidth = 1.2;
	ctx.stroke();

	ctx.globalAlpha = 0.5;
	ctx.fillStyle = '#ffffff';
	ctx.beginPath();
	ctx.ellipse(-7, -8, 5.2, 3.4, -0.6, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

export function drawResistor(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = '#b7bdc2';
	ctx.lineWidth = 2.8;
	leg(ctx, -28, 0, -40, 0);
	leg(ctx, 28, 0, 40, 0);

	const gradient = ctx.createLinearGradient(0, -11, 0, 11);
	gradient.addColorStop(0, '#f3e9d3');
	gradient.addColorStop(0.5, '#e4d4b2');
	gradient.addColorStop(1, '#cdb98f');
	ctx.fillStyle = gradient;
	ctx.strokeStyle = '#8d7f66';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-28, -11, 56, 22, 10);
	ctx.fill();
	ctx.stroke();

	const bands: [number, string][] = [
		[-16, '#7a2f1e'],
		[-7, '#1f1f1f'],
		[7, '#c8352c'],
		[16, '#c9a227']
	];
	for (const [x, color] of bands) {
		ctx.fillStyle = color;
		ctx.fillRect(x - 2.5, -11, 5, 22);
	}
	ctx.restore();
}

export function drawButton(ctx: CanvasRenderingContext2D, part?: PartInstance): void {
	const pressed = part ? liveState(part.id) === 'down' : false;
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = '#9aa2a9';
	ctx.lineWidth = 3;
	leg(ctx, -14, -10, -20, -10);
	leg(ctx, -14, 10, -20, 10);
	leg(ctx, 14, -10, 20, -10);
	leg(ctx, 14, 10, 20, 10);

	ctx.fillStyle = '#2f3437';
	ctx.beginPath();
	ctx.roundRect(-15, -15, 30, 30, 3);
	ctx.fill();

	const cap = ctx.createRadialGradient(-3, -5, 1, 0, 0, 14);
	cap.addColorStop(0, pressed ? '#8c959c' : '#a9b1b7');
	cap.addColorStop(1, pressed ? '#464d52' : '#5c646a');
	ctx.fillStyle = cap;
	ctx.beginPath();
	ctx.arc(0, pressed ? 0.5 : -1, pressed ? 9 : 10, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

export function drawPotentiometer(ctx: CanvasRenderingContext2D, part?: PartInstance): void {
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = '#b7bdc2';
	ctx.lineWidth = 2.8;
	leg(ctx, -20, 15, -20, 28);
	leg(ctx, 0, 15, 0, 28);
	leg(ctx, 20, 15, 20, 28);

	const body = ctx.createLinearGradient(0, -17, 0, 17);
	body.addColorStop(0, '#4d7fbf');
	body.addColorStop(1, '#2f5b93');
	ctx.fillStyle = body;
	ctx.strokeStyle = '#22406b';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-23, -17, 46, 32, 3);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#cfd6dd';
	ctx.beginPath();
	ctx.arc(0, -3, 11, 0, Math.PI * 2);
	ctx.fill();

	// The slot follows the live wiper, so a drag on the canvas reads back here.
	const permille = part ? potPermille(part) : 500;
	const angle = (-135 + (permille / 1000) * 270) * (Math.PI / 180);
	ctx.strokeStyle = '#4c565f';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(0, -3);
	ctx.lineTo(Math.sin(angle) * 8.5, -3 - Math.cos(angle) * 8.5);
	ctx.stroke();
	ctx.restore();
}

function potPermille(part: PartInstance): number {
	const live = livePart(part.id);
	if (live) return live.value;
	const percent = Number(part.attrs.value ?? 50);
	return Number.isFinite(percent) ? Math.max(0, Math.min(1000, percent * 10)) : 500;
}

export function drawBuzzer(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = '#9aa2a9';
	ctx.lineWidth = 3;
	leg(ctx, -10, 18, -10, 34);
	leg(ctx, 10, 18, 10, 34);

	const body = ctx.createRadialGradient(-7, -8, 2, 0, 0, 24);
	body.addColorStop(0, '#4a4f53');
	body.addColorStop(1, '#17191b');
	ctx.fillStyle = body;
	ctx.beginPath();
	ctx.arc(0, 0, 21, 0, Math.PI * 2);
	ctx.fill();

	ctx.fillStyle = '#0c0d0e';
	ctx.beginPath();
	ctx.arc(0, 0, 6, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = 'rgba(255,255,255,0.12)';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.arc(0, 0, 14, 0, Math.PI * 2);
	ctx.stroke();
	ctx.restore();
}

export function drawCapacitor(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = '#b7bdc2';
	ctx.lineWidth = 2.8;
	leg(ctx, -6, 4, -20, 30);
	leg(ctx, 6, 4, 20, 30);

	const disc = ctx.createRadialGradient(-5, -6, 1, 0, 0, 24);
	disc.addColorStop(0, '#f2d9a0');
	disc.addColorStop(1, '#c99a45');
	ctx.fillStyle = disc;
	ctx.strokeStyle = '#8a6524';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.ellipse(0, 0, 21, 15, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#3a352a';
	ctx.font = '6px ui-sans-serif, system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('104', 0, 0);
	ctx.restore();
}

export function drawDiode(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = '#b7bdc2';
	ctx.lineWidth = 2.8;
	leg(ctx, -26, 0, -40, 0);
	leg(ctx, 26, 0, 40, 0);

	const body = ctx.createLinearGradient(0, -9, 0, 9);
	body.addColorStop(0, '#4a4f53');
	body.addColorStop(1, '#141618');
	ctx.fillStyle = body;
	ctx.beginPath();
	ctx.roundRect(-26, -9, 52, 18, 7);
	ctx.fill();

	ctx.fillStyle = '#d8d3c6';
	ctx.fillRect(16, -9, 6, 18);
	ctx.restore();
}

export function drawRgbLed(ctx: CanvasRenderingContext2D, part?: PartInstance): void {
	const lit = part ? liveState(part.id) === 'on' : false;
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = '#9aa2a9';
	ctx.lineWidth = 3;
	for (const x of [-30, -10, 10, 30]) leg(ctx, x * 0.55, 10, x, 44);

	if (lit) {
		const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 46);
		glow.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
		glow.addColorStop(0.35, 'rgba(120, 230, 170, 0.85)');
		glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
		ctx.save();
		ctx.globalAlpha = 0.55;
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.arc(0, 0, 46, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}

	const gradient = ctx.createLinearGradient(-20, -20, 20, 20);
	gradient.addColorStop(0, lit ? '#ff9a8c' : '#e0503f');
	gradient.addColorStop(0.5, lit ? '#8cf0a8' : '#3fb862');
	gradient.addColorStop(1, lit ? '#9dc3ff' : '#3d7ef0');
	ctx.fillStyle = gradient;
	ctx.beginPath();
	ctx.arc(0, 0, 20, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = 'rgba(40, 40, 40, 0.5)';
	ctx.lineWidth = 1.4;
	ctx.stroke();

	ctx.fillStyle = '#cfd4d8';
	ctx.beginPath();
	ctx.ellipse(0, 10, 21, 8, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#71797f';
	ctx.stroke();

	ctx.globalAlpha = 0.55;
	ctx.fillStyle = '#ffffff';
	ctx.beginPath();
	ctx.ellipse(-7, -7, 5, 3.4, -0.6, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

function segment(
	ctx: CanvasRenderingContext2D,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	lit: boolean
): void {
	ctx.strokeStyle = lit ? '#e0503f' : 'rgba(224, 80, 63, 0.16)';
	ctx.lineWidth = 6;
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
}

export function drawSevenSegment(ctx: CanvasRenderingContext2D, part?: PartInstance): void {
	// A mask bit per segment, least significant bit `a` (Litz's convention).
	const live = part ? livePart(part.id) : undefined;
	const mask = live && live.state === 'mask' ? live.value & 0xff : 0xff;
	const on = (bit: number) => (mask & (1 << bit)) !== 0;
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = '#b7bdc2';
	ctx.lineWidth = 2.6;
	for (const x of [-30, -10, 10, 30]) leg(ctx, x, -34, x, -52);
	for (const x of [-40, -20, 0, 20, 40]) leg(ctx, x, 34, x, 52);

	ctx.fillStyle = '#1b1d1f';
	ctx.strokeStyle = '#0b0c0d';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-32, -42, 64, 84, 6);
	ctx.fill();
	ctx.stroke();

	segment(ctx, -16, -30, 16, -30, on(0));
	segment(ctx, 20, -26, 20, -6, on(1));
	segment(ctx, 20, 6, 20, 26, on(2));
	segment(ctx, -16, 30, 16, 30, on(3));
	segment(ctx, -20, 6, -20, 26, on(4));
	segment(ctx, -20, -26, -20, -6, on(5));
	segment(ctx, -16, 0, 16, 0, on(6));
	segment(ctx, 26, 24, 26, 30, on(7));
	ctx.restore();
}

/** Live panels, rasterised once per version; each part keeps its own canvas. */
const panelCanvases = new Map<string, { canvas: HTMLCanvasElement; version: number }>();

function panelImage(id: string, frame: DisplayFrame): HTMLCanvasElement | null {
	if (typeof document === 'undefined') return null;
	const expected = frame.width * frame.height * 4;
	if (frame.rgba.length < expected) return null;
	let entry = panelCanvases.get(id);
	if (!entry) {
		entry = { canvas: document.createElement('canvas'), version: -1 };
		panelCanvases.set(id, entry);
	}
	if (entry.version !== frame.version) {
		entry.canvas.width = frame.width;
		entry.canvas.height = frame.height;
		const context = entry.canvas.getContext('2d');
		if (!context) return null;
		context.putImageData(
			new ImageData(
				new Uint8ClampedArray(frame.rgba.slice(0, expected)),
				frame.width,
				frame.height
			),
			0,
			0
		);
		entry.version = frame.version;
	}
	return entry.canvas;
}

/**
 * Draw a live frame inside a box, keeping the panel's own aspect ratio.
 *
 * Returns false when the frame cannot be rasterised, so the caller can keep
 * whatever placeholder it drew first.
 */
export function drawPanelFrame(
	ctx: CanvasRenderingContext2D,
	id: string,
	frame: DisplayFrame,
	x: number,
	y: number,
	width: number,
	height: number
): boolean {
	const image = panelImage(id, frame);
	if (!image) return false;
	const scale = Math.min(width / frame.width, height / frame.height);
	const drawWidth = frame.width * scale;
	const drawHeight = frame.height * scale;
	ctx.save();
	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(
		image,
		x + (width - drawWidth) / 2,
		y + (height - drawHeight) / 2,
		drawWidth,
		drawHeight
	);
	ctx.restore();
	return true;
}

/** A part's own frame, falling back to the board's display on older backends. */
export function panelFrame(part: PartInstance): DisplayFrame | null {
	const own = livePanel(part.id);
	if (own) return own;
	// Before per-part capture the backend only reported the board's first panel,
	// which was the SSD1306 whenever the circuit had one.
	return part.type === 'litz-ssd1306' ? liveDisplay() : null;
}

export function drawOled(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = '#b7bdc2';
	ctx.lineWidth = 2.6;
	for (const x of [-30, -10, 10, 30]) leg(ctx, x, 28, x, 44);

	ctx.fillStyle = '#1f4f8f';
	ctx.strokeStyle = '#12325c';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-42, -32, 84, 62, 4);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#0a0b0c';
	ctx.beginPath();
	ctx.roundRect(-33, -24, 66, 40, 2);
	ctx.fill();

	const frame = panelFrame(part);
	const drawn = frame ? drawPanelFrame(ctx, part.id, frame, -33, -24, 66, 40) : false;
	if (!drawn) {
		ctx.fillStyle = 'rgba(90, 200, 255, 0.5)';
		ctx.font = '7px ui-sans-serif, system-ui, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('128 × 64', 0, -4);
	}
	ctx.restore();
}

export function drawLcd(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = '#b7bdc2';
	ctx.lineWidth = 2.6;
	for (let i = 0; i < 8; i++) {
		const x = -70 + i * 20;
		leg(ctx, x, -44, x, -54);
		leg(ctx, x, 44, x, 54);
	}

	ctx.fillStyle = '#2f7d4f';
	ctx.strokeStyle = '#1d5234';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-84, -44, 168, 88, 5);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#14261a';
	ctx.beginPath();
	ctx.roundRect(-66, -27, 132, 44, 2);
	ctx.fill();

	ctx.fillStyle = 'rgba(120, 220, 150, 0.35)';
	for (let row = 0; row < 2; row++) {
		for (let col = 0; col < 16; col++) {
			ctx.fillRect(-60 + col * 8, -20 + row * 20, 5, 9);
		}
	}
	ctx.restore();
}

export function drawDht(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = '#b7bdc2';
	ctx.lineWidth = 2.6;
	for (const x of [-30, -10, 10, 30]) leg(ctx, x, 24, x, 42);

	ctx.fillStyle = '#f2f1ec';
	ctx.strokeStyle = '#b9b5aa';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-22, -32, 44, 58, 5);
	ctx.fill();
	ctx.stroke();

	ctx.strokeStyle = '#c9c5ba';
	ctx.lineWidth = 1.6;
	for (let i = 0; i < 5; i++) {
		ctx.beginPath();
		ctx.moveTo(-14, -22 + i * 7);
		ctx.lineTo(14, -22 + i * 7);
		ctx.stroke();
	}
	ctx.fillStyle = '#8a877e';
	ctx.font = '6px ui-sans-serif, system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.fillText('DHT22', 0, 20);
	ctx.restore();
}

export function drawServo(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = '#9aa2a9';
	ctx.lineWidth = 2.8;
	leg(ctx, -30, 22, -30, 36);
	leg(ctx, -10, 22, -10, 36);
	leg(ctx, 10, 22, 10, 36);

	ctx.fillStyle = '#2f5b93';
	ctx.strokeStyle = '#1d3b62';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-34, -18, 68, 40, 3);
	ctx.fill();
	ctx.stroke();
	ctx.fillRect(-46, -8, 12, 20);
	ctx.fillRect(34, -8, 12, 20);
	ctx.strokeRect(-46, -8, 12, 20);
	ctx.strokeRect(34, -8, 12, 20);

	ctx.fillStyle = '#e8e6df';
	ctx.beginPath();
	ctx.arc(0, -18, 10, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#8b8880';
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(0, -18);
	ctx.lineTo(14, -28);
	ctx.strokeStyle = '#e8e6df';
	ctx.lineWidth = 4;
	ctx.stroke();
	ctx.restore();
}

export function drawBattery(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = '#b7bdc2';
	ctx.lineWidth = 2.8;
	leg(ctx, -12, -44, -12, -58);
	leg(ctx, 12, -44, 12, -58);

	ctx.fillStyle = '#2c3033';
	ctx.strokeStyle = '#16181a';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-28, -44, 56, 88, 6);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#d9d6cc';
	ctx.beginPath();
	ctx.arc(-12, -44, 5, 0, Math.PI * 2);
	ctx.arc(12, -44, 5, 0, Math.PI * 2);
	ctx.fill();

	ctx.fillStyle = '#c9a227';
	ctx.font = 'bold 11px ui-sans-serif, system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('9V', 0, 0);
	ctx.fillStyle = '#d9d6cc';
	ctx.font = '8px ui-sans-serif, system-ui, sans-serif';
	ctx.fillText('+  −', 0, 26);
	ctx.restore();
}

export function drawPowerSupply(ctx: CanvasRenderingContext2D, part?: PartInstance): void {
	const volts = Number(part?.attrs.voltage ?? 5);
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = '#b7bdc2';
	ctx.lineWidth = 2.8;
	leg(ctx, -30, 30, -30, 42);
	leg(ctx, 30, 30, 30, 42);

	const body = ctx.createLinearGradient(0, -34, 0, 30);
	body.addColorStop(0, '#4a5157');
	body.addColorStop(1, '#252a2e');
	ctx.fillStyle = body;
	ctx.strokeStyle = '#15181a';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-46, -34, 92, 64, 5);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#10201a';
	ctx.strokeStyle = '#0a0f0d';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.roundRect(-36, -26, 72, 22, 2);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#77e6a8';
	ctx.font = 'bold 11px ui-monospace, monospace';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(`${Number.isFinite(volts) ? volts.toFixed(1) : '5.0'} V`, 0, -15);

	ctx.fillStyle = '#d9d6cc';
	ctx.font = '8px ui-sans-serif, system-ui, sans-serif';
	ctx.fillText('+', -30, 12);
	ctx.fillText('−', 30, 12);
	ctx.restore();
}

export function drawSlideSwitch(ctx: CanvasRenderingContext2D, part?: PartInstance): void {
	const on = part ? liveState(part.id) === 'on' : false;
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = '#b7bdc2';
	ctx.lineWidth = 2.6;
	leg(ctx, -20, 9, -20, 24);
	leg(ctx, 0, 9, 0, 24);
	leg(ctx, 20, 9, 20, 24);

	ctx.fillStyle = '#4a4f53';
	ctx.strokeStyle = '#262a2d';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-28, -9, 56, 18, 3);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#cfd4d8';
	ctx.beginPath();
	ctx.roundRect(on ? 2 : -18, -7, 16, 14, 2);
	ctx.fill();
	ctx.strokeStyle = '#7b8288';
	ctx.stroke();
	ctx.restore();
}

export function drawPhotoSensor(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = '#b7bdc2';
	ctx.lineWidth = 2.6;
	for (const x of [-30, -10, 10, 30]) leg(ctx, x, 18, x, 28);

	ctx.fillStyle = '#1f4f8f';
	ctx.strokeStyle = '#12325c';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-34, -22, 68, 40, 3);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#f0c33c';
	ctx.beginPath();
	ctx.arc(-10, -2, 11, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#8a6a12';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.arc(-10, -2, 6, 0, Math.PI * 2);
	ctx.stroke();

	ctx.fillStyle = '#0e1113';
	ctx.beginPath();
	ctx.roundRect(12, -12, 14, 12, 2);
	ctx.fill();
	ctx.restore();
}

export function drawBjt(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = '#b7bdc2';
	ctx.lineWidth = 2.8;
	leg(ctx, -20, 6, -20, 40);
	leg(ctx, 0, 10, 0, 40);
	leg(ctx, 20, 6, 20, 40);

	const body = ctx.createLinearGradient(0, -24, 0, 12);
	body.addColorStop(0, '#3b4044');
	body.addColorStop(1, '#16181a');
	ctx.fillStyle = body;
	ctx.strokeStyle = '#0b0c0d';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.moveTo(-22, 8);
	ctx.lineTo(-22, -8);
	ctx.arc(0, -8, 22, Math.PI, 0, false);
	ctx.lineTo(22, 8);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = 'rgba(230, 228, 220, 0.55)';
	ctx.font = '7px ui-sans-serif, system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.fillText('TO-92', 0, 0);
	ctx.restore();
}

export function drawNeopixel(ctx: CanvasRenderingContext2D, part?: PartInstance): void {
	// Without a simulation the pixel shows its idle green, as a preview.
	const state = part ? liveState(part.id) : undefined;
	const lit = state === undefined || state === 'on';
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = '#b7bdc2';
	ctx.lineWidth = 2.6;
	for (const x of [-30, -10, 10, 30]) leg(ctx, x, 14, x, 30);

	ctx.fillStyle = '#1b1f22';
	ctx.strokeStyle = '#0b0c0d';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.arc(0, -4, 20, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();

	if (lit) {
		const glow = ctx.createRadialGradient(0, -4, 1, 0, -4, 10);
		glow.addColorStop(0, '#eafff2');
		glow.addColorStop(0.4, '#65e08c');
		glow.addColorStop(1, '#1d5a33');
		ctx.fillStyle = glow;
	} else {
		ctx.fillStyle = '#121719';
	}
	ctx.beginPath();
	ctx.arc(0, -4, 9, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

export function drawTiltSwitch(ctx: CanvasRenderingContext2D, part?: PartInstance): void {
	const tilted = part ? liveState(part.id) === 'on' : false;
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = '#b7bdc2';
	ctx.lineWidth = 2.8;
	leg(ctx, -22, 0, -34, 0);
	leg(ctx, 22, 0, 34, 0);

	const body = ctx.createLinearGradient(0, -11, 0, 11);
	body.addColorStop(0, '#5b6165');
	body.addColorStop(1, '#1c1f21');
	ctx.fillStyle = body;
	ctx.strokeStyle = '#0b0c0d';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-22, -11, 44, 22, 10);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#c9a227';
	ctx.fillRect(-24, -3, 5, 6);
	ctx.fillRect(19, -3, 5, 6);

	// The ball sits at the low end of the tube once the switch is tilted.
	ctx.fillStyle = tilted ? '#7ee2a8' : '#d8dde1';
	ctx.beginPath();
	ctx.arc(tilted ? 12 : -12, 0, 4.5, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

/** Anything the catalog knows but we have no art for yet. */
export function drawGeneric(
	ctx: CanvasRenderingContext2D,
	name: string,
	pins: number,
	zoom: number
): void {
	const width = Math.max(80, Math.ceil(pins / 2) * 24);
	ctx.save();
	ctx.fillStyle = '#e7e2d6';
	ctx.strokeStyle = '#8b8577';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-width / 2, -40, width, 80, 8);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#5f5a4e';
	ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	if (zoom >= 0.5) ctx.fillText(name, 0, 0);
	ctx.restore();
}
