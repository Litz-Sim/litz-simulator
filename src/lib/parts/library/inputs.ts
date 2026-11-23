import type { PartInstance } from '#lib/sketch/types';
import type { PartDef } from '../types';

const LEG_COLOR = '#b7bdc2';

/** Mix a #rrggbb colour towards white (amount > 0) or black (amount < 0). */
function shade(hex: string, amount: number): string {
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

const BUTTON_COLORS: Record<string, string> = {
	green: '#3fb862',
	blue: '#3d7ef0',
	red: '#e0503f',
	yellow: '#f0c62a',
	white: '#e8e6df',
	black: '#2b2f32'
};

/** A tactile pushbutton: dark square body, coloured round cap, four legs. */
function drawPushbutton(
	ctx: CanvasRenderingContext2D,
	part: PartInstance,
	scale: number,
	latching: boolean
): void {
	const color = BUTTON_COLORS[String(part.attrs.color ?? 'green')] ?? '#3fb862';
	ctx.save();
	ctx.lineCap = 'round';

	ctx.strokeStyle = LEG_COLOR;
	ctx.lineWidth = 3;
	leg(ctx, -14 * scale, -10 * scale, -20 * scale, -10 * scale);
	leg(ctx, -14 * scale, 10 * scale, -20 * scale, 10 * scale);
	leg(ctx, 14 * scale, -10 * scale, 20 * scale, -10 * scale);
	leg(ctx, 14 * scale, 10 * scale, 20 * scale, 10 * scale);

	ctx.fillStyle = '#2f3437';
	ctx.strokeStyle = '#181c1e';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.roundRect(-15 * scale, -15 * scale, 30 * scale, 30 * scale, 3 * scale);
	ctx.fill();
	ctx.stroke();

	// A ring around the cap marks the push-on / push-off variant.
	if (latching) {
		ctx.strokeStyle = shade(color, 0.45);
		ctx.lineWidth = 1.4;
		ctx.beginPath();
		ctx.arc(0, -1 * scale, 12.5 * scale, 0, Math.PI * 2);
		ctx.stroke();
	}

	const cap = ctx.createRadialGradient(-3 * scale, -5 * scale, 1, 0, 0, 14 * scale);
	cap.addColorStop(0, shade(color, 0.35));
	cap.addColorStop(1, shade(color, -0.25));
	ctx.fillStyle = cap;
	ctx.beginPath();
	ctx.arc(0, -1 * scale, 10 * scale, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = shade(color, -0.45);
	ctx.lineWidth = 1.2;
	ctx.stroke();

	ctx.globalAlpha = 0.5;
	ctx.fillStyle = '#ffffff';
	ctx.beginPath();
	ctx.ellipse(-3.5 * scale, -5 * scale, 3 * scale, 2 * scale, -0.6, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

/** A red DIP package with `count` vertical sliders between the two pin rows. */
function drawDipSwitch(ctx: CanvasRenderingContext2D, count: number): void {
	const spacing = count === 4 ? 20 : 14;
	const bodyWidth = count === 4 ? 80 : 112;
	const xs = Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * spacing);

	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = LEG_COLOR;
	ctx.lineWidth = 2.6;
	for (const x of xs) {
		leg(ctx, x, -16, x, -24);
		leg(ctx, x, 16, x, 24);
	}

	const body = ctx.createLinearGradient(0, -16, 0, 16);
	body.addColorStop(0, '#d85445');
	body.addColorStop(1, '#a3342a');
	ctx.fillStyle = body;
	ctx.strokeStyle = '#6f211a';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-bodyWidth / 2, -16, bodyWidth, 32, 3);
	ctx.fill();
	ctx.stroke();

	xs.forEach((x, i) => {
		ctx.fillStyle = '#3d1712';
		ctx.beginPath();
		ctx.roundRect(x - 4, -11, 8, 22, 2);
		ctx.fill();

		const on = i % 2 === 0;
		ctx.fillStyle = '#f1efe8';
		ctx.strokeStyle = '#8b8880';
		ctx.lineWidth = 0.8;
		ctx.beginPath();
		ctx.roundRect(x - 3, on ? -1 : -9, 6, 10, 1.5);
		ctx.fill();
		ctx.stroke();
	});
	ctx.restore();
}

/** A linear slide potentiometer: long track, travelling knob, three legs. */
function drawSlidePot(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	const percent = Number(part.attrs.value ?? 0);
	const travel = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
	ctx.save();
	ctx.lineCap = 'round';
	legs(ctx, [-30, 0, 30], 16, 30);

	const body = ctx.createLinearGradient(0, -18, 0, 16);
	body.addColorStop(0, '#3d464c');
	body.addColorStop(1, '#171c1f');
	ctx.fillStyle = body;
	ctx.strokeStyle = '#0c1012';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-44, -18, 88, 34, 4);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#0a0c0d';
	ctx.beginPath();
	ctx.roundRect(-34, -7, 68, 12, 6);
	ctx.fill();
	ctx.fillStyle = 'rgba(180, 195, 205, 0.25)';
	ctx.fillRect(-31, -5, 62, 2);

	const knobX = -30 + (travel / 100) * 60;
	const knob = ctx.createLinearGradient(knobX - 8, -12, knobX + 8, 12);
	knob.addColorStop(0, '#eef1f3');
	knob.addColorStop(1, '#939ca3');
	ctx.fillStyle = knob;
	ctx.strokeStyle = '#5d666c';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(knobX - 8, -12, 16, 26, 3);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#394247';
	ctx.fillRect(knobX - 5, -7, 10, 1.6);
	ctx.fillRect(knobX - 5, -2, 10, 1.6);
	ctx.fillRect(knobX - 5, 3, 10, 1.6);
	ctx.restore();
}

/** A small blue trimmer: square body and a screw head that follows `value`. */
function drawTrimmerPot(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	const percent = Number(part.attrs.value ?? 50);
	const travel = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 50;
	ctx.save();
	ctx.lineCap = 'round';
	legs(ctx, [-20, 0, 20], 22, 28);

	const body = ctx.createLinearGradient(0, -23, 0, 23);
	body.addColorStop(0, '#4d7fbf');
	body.addColorStop(1, '#2a4f82');
	ctx.fillStyle = body;
	ctx.strokeStyle = '#1b3558';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-23, -23, 46, 46, 3);
	ctx.fill();
	ctx.stroke();

	// Pin 1 marker in the corner.
	ctx.fillStyle = '#cfd6dd';
	ctx.beginPath();
	ctx.arc(-17, -17, 2, 0, Math.PI * 2);
	ctx.fill();

	const screw = ctx.createRadialGradient(-4, -4, 1, 0, 0, 14);
	screw.addColorStop(0, '#f0f2f4');
	screw.addColorStop(1, '#aab3ba');
	ctx.fillStyle = screw;
	ctx.beginPath();
	ctx.arc(0, 0, 13, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#6b747b';
	ctx.lineWidth = 1.2;
	ctx.stroke();

	const angle = (travel / 100) * Math.PI * 1.5 - Math.PI / 2;
	ctx.strokeStyle = '#4c565f';
	ctx.lineWidth = 2.2;
	leg(
		ctx,
		-Math.cos(angle) * 10,
		-Math.sin(angle) * 10,
		Math.cos(angle) * 10,
		Math.sin(angle) * 10
	);
	ctx.restore();
}

/** A knurled knob with a pointer, shared by the bare encoder and the module. */
function drawKnob(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
	ctx.fillStyle = '#14181a';
	ctx.beginPath();
	ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
	ctx.fill();

	const cap = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.4, 2, cx, cy, radius);
	cap.addColorStop(0, '#6a747b');
	cap.addColorStop(1, '#24292c');
	ctx.fillStyle = cap;
	ctx.beginPath();
	ctx.arc(cx, cy, radius, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#0b0e10';
	ctx.lineWidth = 1;
	ctx.stroke();

	ctx.strokeStyle = 'rgba(220, 230, 235, 0.22)';
	ctx.lineWidth = 1.2;
	for (let i = 0; i < 16; i++) {
		const a = (i / 16) * Math.PI * 2;
		leg(
			ctx,
			cx + Math.cos(a) * (radius - 2),
			cy + Math.sin(a) * (radius - 2),
			cx + Math.cos(a) * (radius - 5),
			cy + Math.sin(a) * (radius - 5)
		);
	}

	ctx.strokeStyle = '#e7e4da';
	ctx.lineWidth = 2;
	leg(ctx, cx, cy - radius * 0.2, cx, cy - radius + 4);
}

/** A bare quadrature encoder: square can, knob on top, five legs. */
function drawRotaryEncoder(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';
	legs(ctx, [-36, -18, 0, 18, 36], 14, 28);

	const body = ctx.createLinearGradient(0, -24, 0, 14);
	body.addColorStop(0, '#3a4349');
	body.addColorStop(1, '#1a2023');
	ctx.fillStyle = body;
	ctx.strokeStyle = '#0b0f11';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-32, -24, 64, 38, 4);
	ctx.fill();
	ctx.stroke();

	drawKnob(ctx, 0, -7, 17);
	ctx.restore();
}

/** The KY-040 module: blue PCB, knurled knob and two tact switches. */
function drawKy040(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';
	legs(ctx, [-36, -18, 0, 18, 36], 32, 44);

	const board = ctx.createLinearGradient(0, -46, 0, 32);
	board.addColorStop(0, '#2b5b8e');
	board.addColorStop(1, '#173d63');
	ctx.fillStyle = board;
	ctx.strokeStyle = '#0f2842';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-52, -46, 104, 78, 5);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#0d1a28';
	for (const x of [-46, 46]) {
		ctx.beginPath();
		ctx.arc(x, -40, 3, 0, Math.PI * 2);
		ctx.fill();
	}

	drawKnob(ctx, 0, -14, 17);

	for (const x of [-24, 24]) {
		ctx.fillStyle = '#2a2f32';
		ctx.strokeStyle = '#0d1012';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.roundRect(x - 11, 8, 22, 18, 3);
		ctx.fill();
		ctx.stroke();

		const button = ctx.createLinearGradient(0, 10, 0, 24);
		button.addColorStop(0, '#cfd4d8');
		button.addColorStop(1, '#7d858c');
		ctx.fillStyle = button;
		ctx.strokeStyle = '#5c646a';
		ctx.beginPath();
		ctx.roundRect(x - 8, 11, 16, 13, 2);
		ctx.fill();
		ctx.stroke();
	}
	ctx.restore();
}

/** A two-axis module: square PCB, gimbal well and a capped stick. */
function drawJoystick(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';
	legs(ctx, [-40, -20, 0, 20, 40], 34, 44);

	const board = ctx.createLinearGradient(0, -46, 0, 34);
	board.addColorStop(0, '#2b5b8e');
	board.addColorStop(1, '#173d63');
	ctx.fillStyle = board;
	ctx.strokeStyle = '#0f2842';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-56, -46, 112, 80, 5);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#0d1a28';
	ctx.beginPath();
	ctx.arc(0, -10, 27, 0, Math.PI * 2);
	ctx.fill();

	const base = ctx.createRadialGradient(-6, -18, 2, 0, -10, 26);
	base.addColorStop(0, '#39434a');
	base.addColorStop(1, '#141a1e');
	ctx.fillStyle = base;
	ctx.beginPath();
	ctx.arc(0, -10, 24, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#0a0e10';
	ctx.lineWidth = 1;
	ctx.stroke();

	ctx.strokeStyle = 'rgba(180, 195, 205, 0.35)';
	ctx.lineWidth = 1.5;
	const marks: readonly [number, number, number, number][] = [
		[-20, -10, -14, -10],
		[14, -10, 20, -10],
		[0, -30, 0, -24],
		[0, 4, 0, 10]
	];
	for (const [x1, y1, x2, y2] of marks) {
		leg(ctx, x1, y1, x2, y2);
	}

	ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.beginPath();
	ctx.ellipse(3, 2, 14, 5, 0, 0, Math.PI * 2);
	ctx.fill();

	const cap = ctx.createRadialGradient(-4, -24, 2, 0, -20, 15);
	cap.addColorStop(0, '#e9ecee');
	cap.addColorStop(1, '#8f989f');
	ctx.fillStyle = cap;
	ctx.beginPath();
	ctx.arc(0, -20, 13, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#5d666c';
	ctx.lineWidth = 1.2;
	ctx.stroke();

	ctx.fillStyle = '#4c565f';
	ctx.beginPath();
	ctx.arc(0, -20, 4, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

/** A 4×4 membrane keypad: domed keys on a dark mat, eight ribbon pins. */
function drawKeypad(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	const columns = String(part.attrs.columns ?? '4') === '3' ? 3 : 4;
	ctx.save();
	ctx.lineCap = 'round';

	ctx.strokeStyle = LEG_COLOR;
	ctx.lineWidth = 2.6;
	for (let i = 0; i < 8; i++) leg(ctx, -42 + i * 12, 46, -42 + i * 12, 58);

	const board = ctx.createLinearGradient(0, -60, 0, 46);
	board.addColorStop(0, '#3a3f43');
	board.addColorStop(1, '#1c2023');
	ctx.fillStyle = board;
	ctx.strokeStyle = '#0c0f11';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-50, -58, 100, 104, 6);
	ctx.fill();
	ctx.stroke();

	const cell = 22;
	const startX = -((columns * cell) / 2);
	const startY = -52;
	for (let row = 0; row < 4; row++) {
		for (let col = 0; col < columns; col++) {
			const x = startX + col * cell;
			const y = startY + row * cell;
			const key = ctx.createLinearGradient(0, y, 0, y + cell - 2);
			key.addColorStop(0, '#e9e5d9');
			key.addColorStop(1, '#c9c3b2');
			ctx.fillStyle = key;
			ctx.strokeStyle = '#8b8577';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.roundRect(x + 1, y + 1, cell - 2, cell - 2, 3);
			ctx.fill();
			ctx.stroke();
		}
	}
	ctx.restore();
}

/** A 38 kHz IR receiver: black bulb with a dark lens and three legs. */
function drawIrReceiver(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';
	legs(ctx, [-20, 0, 20], 12, 26);

	const body = ctx.createLinearGradient(0, -24, 0, 14);
	body.addColorStop(0, '#3a3f43');
	body.addColorStop(1, '#121517');
	ctx.fillStyle = body;
	ctx.strokeStyle = '#080a0b';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-16, -24, 32, 38, 5);
	ctx.fill();
	ctx.stroke();

	const lens = ctx.createRadialGradient(-3, -19, 1, 0, -14, 11);
	lens.addColorStop(0, '#6a2a34');
	lens.addColorStop(1, '#1a0a0d');
	ctx.fillStyle = lens;
	ctx.beginPath();
	ctx.arc(0, -14, 10, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#0a0405';
	ctx.lineWidth = 1;
	ctx.stroke();

	ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
	ctx.beginPath();
	ctx.ellipse(-3, -18, 3, 2, -0.6, 0, Math.PI * 2);
	ctx.fill();

	ctx.fillStyle = '#2a2f32';
	ctx.fillRect(-16, 8, 32, 4);
	ctx.restore();
}

/** An infrared emitter drawn like an LED, with a violet lens. */
function drawIrLed(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';

	ctx.strokeStyle = LEG_COLOR;
	ctx.lineWidth = 3.4;
	leg(ctx, -7, 10, -10, 34);
	leg(ctx, 7, 10, 10, 34);

	ctx.fillStyle = '#cfd4d8';
	ctx.strokeStyle = '#71797f';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.ellipse(0, 9, 18, 8, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();

	const bulb = ctx.createRadialGradient(-6, -7, 1, 0, 0, 20);
	bulb.addColorStop(0, '#cfd9f2');
	bulb.addColorStop(0.45, '#7a6fb5');
	bulb.addColorStop(1, '#2d2650');
	ctx.fillStyle = bulb;
	ctx.beginPath();
	ctx.arc(0, 0, 16.5, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#1b1733';
	ctx.lineWidth = 1.2;
	ctx.stroke();

	ctx.fillStyle = '#241f3c';
	ctx.fillRect(-4, -1, 8, 5);

	ctx.globalAlpha = 0.5;
	ctx.fillStyle = '#ffffff';
	ctx.beginPath();
	ctx.ellipse(-6, -7, 4.5, 3, -0.6, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

/** A reed switch: glass capsule with two overlapping blades and their leads. */
function drawReedSwitch(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';

	ctx.strokeStyle = LEG_COLOR;
	ctx.lineWidth = 2.8;
	leg(ctx, -28, 0, -34, 0);
	leg(ctx, 28, 0, 34, 0);

	ctx.fillStyle = 'rgba(206, 222, 230, 0.5)';
	ctx.strokeStyle = '#8b969e';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-28, -9, 56, 18, 9);
	ctx.fill();
	ctx.stroke();

	ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
	ctx.lineWidth = 1.2;
	leg(ctx, -20, -5, 18, -5);

	ctx.strokeStyle = '#b9c2c8';
	ctx.lineWidth = 2.4;
	leg(ctx, -25, 3, -2, -1);
	leg(ctx, 25, -3, 2, 1);

	ctx.fillStyle = '#c9a227';
	ctx.beginPath();
	ctx.arc(-2, -1, 1.6, 0, Math.PI * 2);
	ctx.arc(2, 1, 1.6, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

export const INPUT_PARTS: PartDef[] = [
	{
		type: 'litz-pushbutton-6mm',
		name: 'Pushbutton 6mm',
		category: 'Switches',
		keywords: ['pushbutton', 'button', 'tactile', 'momentary', '6mm', 'switch'],
		width: 40,
		height: 34,
		pins: [
			{ name: '1.l', x: -18, y: -9 },
			{ name: '1.r', x: 18, y: -9 },
			{ name: '2.l', x: -18, y: 9 },
			{ name: '2.r', x: 18, y: 9 }
		],
		attrs: [
			{
				name: 'color',
				type: 'enum',
				values: ['green', 'blue', 'red', 'yellow', 'white', 'black'],
				default: 'black'
			}
		],
		draw: (ctx, part) => drawPushbutton(ctx, part, 0.9, false)
	},
	{
		type: 'litz-pushbutton-momentary',
		name: 'Pushbutton momentary',
		category: 'Switches',
		keywords: ['pushbutton', 'button', 'tactile', 'momentary', 'switch'],
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
			}
		],
		draw: (ctx, part) => drawPushbutton(ctx, part, 1, false)
	},
	{
		type: 'litz-pushbutton-latching',
		name: 'Pushbutton latching',
		category: 'Switches',
		keywords: ['pushbutton', 'button', 'latching', 'toggle', 'switch'],
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
				default: 'black'
			}
		],
		draw: (ctx, part) => drawPushbutton(ctx, part, 1, true)
	},
	{
		type: 'litz-dip-switch-4',
		name: 'DIP switch 4',
		category: 'Switches',
		keywords: ['dip', 'switch', 'bank', 'four'],
		width: 92,
		height: 52,
		pins: [
			{ name: '1a', x: -30, y: -24 },
			{ name: '1b', x: -30, y: 24 },
			{ name: '2a', x: -10, y: -24 },
			{ name: '2b', x: -10, y: 24 },
			{ name: '3a', x: 10, y: -24 },
			{ name: '3b', x: 10, y: 24 },
			{ name: '4a', x: 30, y: -24 },
			{ name: '4b', x: 30, y: 24 }
		],
		attrs: [],
		draw: (ctx) => drawDipSwitch(ctx, 4)
	},
	{
		type: 'litz-dip-switch-8',
		name: 'DIP switch 8',
		category: 'Switches',
		keywords: ['dip', 'switch', 'bank', 'eight'],
		width: 124,
		height: 52,
		pins: [
			{ name: '1a', x: -49, y: -24 },
			{ name: '1b', x: -49, y: 24 },
			{ name: '2a', x: -35, y: -24 },
			{ name: '2b', x: -35, y: 24 },
			{ name: '3a', x: -21, y: -24 },
			{ name: '3b', x: -21, y: 24 },
			{ name: '4a', x: -7, y: -24 },
			{ name: '4b', x: -7, y: 24 },
			{ name: '5a', x: 7, y: -24 },
			{ name: '5b', x: 7, y: 24 },
			{ name: '6a', x: 21, y: -24 },
			{ name: '6b', x: 21, y: 24 },
			{ name: '7a', x: 35, y: -24 },
			{ name: '7b', x: 35, y: 24 },
			{ name: '8a', x: 49, y: -24 },
			{ name: '8b', x: 49, y: 24 }
		],
		attrs: [],
		draw: (ctx) => drawDipSwitch(ctx, 8)
	},
	{
		type: 'litz-slide-potentiometer',
		name: 'Slide potentiometer',
		category: 'Switches',
		keywords: ['potentiometer', 'slide', 'pot', 'fader', 'analog'],
		width: 96,
		height: 68,
		pins: [
			{ name: '1', x: -30, y: 30 },
			{ name: '2', label: 'wiper', x: 0, y: 30 },
			{ name: '3', x: 30, y: 30 }
		],
		attrs: [
			{ name: 'value', type: 'string', default: '0' },
			{ name: 'travelLength', type: 'string', default: '30' }
		],
		draw: (ctx, part) => drawSlidePot(ctx, part)
	},
	{
		type: 'litz-trimmer-potentiometer',
		name: 'Trimmer potentiometer',
		category: 'Switches',
		keywords: ['potentiometer', 'trimmer', 'pot', 'screw', 'analog'],
		width: 60,
		height: 60,
		pins: [
			{ name: '1', x: -20, y: 28 },
			{ name: '2', label: 'wiper', x: 0, y: 28 },
			{ name: '3', x: 20, y: 28 }
		],
		attrs: [{ name: 'value', type: 'string', default: '50' }],
		draw: (ctx, part) => drawTrimmerPot(ctx, part)
	},
	{
		type: 'litz-rotary-encoder',
		name: 'Rotary encoder',
		category: 'Switches',
		keywords: ['encoder', 'rotary', 'quadrature', 'knob', 'switch'],
		width: 96,
		height: 64,
		pins: [
			{ name: 'VCC', x: -36, y: 28 },
			{ name: 'GND', x: -18, y: 28 },
			{ name: 'CLK', x: 0, y: 28 },
			{ name: 'DT', x: 18, y: 28 },
			{ name: 'SW', x: 36, y: 28 }
		],
		attrs: [],
		draw: (ctx) => drawRotaryEncoder(ctx)
	},
	{
		type: 'litz-ky-040',
		name: 'KY-040 rotary encoder',
		category: 'Switches',
		keywords: ['ky-040', 'ky040', 'encoder', 'rotary', 'module', 'knob'],
		width: 116,
		height: 100,
		pins: [
			{ name: 'VCC', x: -36, y: 44 },
			{ name: 'GND', x: -18, y: 44 },
			{ name: 'CLK', x: 0, y: 44 },
			{ name: 'DT', x: 18, y: 44 },
			{ name: 'SW', x: 36, y: 44 }
		],
		attrs: [],
		draw: (ctx) => drawKy040(ctx)
	},
	{
		type: 'litz-analog-joystick',
		name: 'Analog joystick',
		category: 'Switches',
		keywords: ['joystick', 'analog', 'thumbstick', 'xy', 'module'],
		width: 124,
		height: 100,
		pins: [
			{ name: 'VCC', x: -40, y: 44 },
			{ name: 'GND', x: -20, y: 44 },
			{ name: 'VERT', x: 0, y: 44 },
			{ name: 'HORZ', x: 20, y: 44 },
			{ name: 'SEL', x: 40, y: 44 }
		],
		attrs: [],
		draw: (ctx) => drawJoystick(ctx)
	},
	{
		type: 'litz-membrane-keypad',
		name: 'Membrane keypad',
		category: 'Switches',
		keywords: ['keypad', 'membrane', 'matrix', '4x4', 'button'],
		width: 120,
		height: 128,
		pins: [
			{ name: 'R1', x: -42, y: 58 },
			{ name: 'R2', x: -30, y: 58 },
			{ name: 'R3', x: -18, y: 58 },
			{ name: 'R4', x: -6, y: 58 },
			{ name: 'C1', x: 6, y: 58 },
			{ name: 'C2', x: 18, y: 58 },
			{ name: 'C3', x: 30, y: 58 },
			{ name: 'C4', x: 42, y: 58 }
		],
		attrs: [{ name: 'columns', type: 'enum', values: ['3', '4'], default: '4' }],
		draw: (ctx, part) => drawKeypad(ctx, part)
	},
	{
		type: 'litz-ir-receiver',
		name: 'IR receiver',
		category: 'Sensors',
		keywords: ['ir', 'infrared', 'receiver', 'nec', 'remote', 'sensor'],
		width: 64,
		height: 64,
		pins: [
			{ name: 'GND', x: -20, y: 26 },
			{ name: 'VCC', x: 0, y: 26 },
			{ name: 'DAT', x: 20, y: 26 }
		],
		attrs: [
			{ name: 'address', type: 'number', default: 0 },
			{ name: 'command', type: 'number', default: 12 }
		],
		draw: (ctx) => drawIrReceiver(ctx)
	},
	{
		type: 'litz-ir-emitting-diode',
		name: 'IR emitting diode',
		category: 'Lights',
		keywords: ['ir', 'infrared', 'led', 'emitter', 'diode', 'light'],
		width: 44,
		height: 74,
		pins: [
			{ name: 'A', label: 'anode', x: -10, y: 34 },
			{ name: 'C', label: 'cathode', x: 10, y: 34 }
		],
		attrs: [
			{ name: 'infrared', type: 'bool', default: true },
			{ name: 'wavelength', type: 'number', default: 940 }
		],
		draw: (ctx) => drawIrLed(ctx)
	},
	{
		type: 'litz-reed-switch',
		name: 'Reed switch',
		category: 'Sensors',
		keywords: ['reed', 'switch', 'magnetic', 'magnet', 'sensor'],
		width: 80,
		height: 28,
		pins: [
			{ name: '1', x: -34, y: 0 },
			{ name: '2', x: 34, y: 0 }
		],
		attrs: [],
		draw: (ctx) => drawReedSwitch(ctx)
	}
];
