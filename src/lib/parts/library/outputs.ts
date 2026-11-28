import type { PartInstance } from '#lib/sketch/types';
import type { PartDef } from '../types';

/*
 * Output, motor and power parts.
 *
 * Art is kept local to this module so the library has no dependency on the
 * live simulation state. Every draw call works in local part space: the
 * origin is the anchor, y points down, and the caller has applied the view
 * transform.
 */

const LEAD = '#9aa2a9';
const EDGE = '#3b4044';
const PAD = '#c9a227';

function leg(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
}

function label(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	size = 7,
	color = '#e7e6e1'
): void {
	ctx.fillStyle = color;
	ctx.font = `${size}px ui-sans-serif, system-ui, sans-serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(text, x, y);
}

function pad(ctx: CanvasRenderingContext2D, x: number, y: number): void {
	ctx.fillStyle = PAD;
	ctx.beginPath();
	ctx.roundRect(x - 5, y - 4, 10, 8, 1.5);
	ctx.fill();
}

function strokeWave(
	ctx: CanvasRenderingContext2D,
	wave: string,
	x0: number,
	x1: number,
	mid: number,
	amp: number,
	cycles = 3
): void {
	const steps = 120;
	ctx.beginPath();
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const phase = (t * cycles) % 1;
		let value: number;
		switch (wave) {
			case 'sine':
				value = Math.sin(t * cycles * Math.PI * 2);
				break;
			case 'triangle':
				value = 1 - 4 * Math.abs(phase - 0.5);
				break;
			case 'sawtooth':
				value = 2 * phase - 1;
				break;
			default:
				value = phase < 0.5 ? 1 : -1;
				break;
		}
		const x = x0 + (x1 - x0) * t;
		const y = mid - value * amp;
		if (i === 0) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	}
	ctx.stroke();
}

function drawDcMotor(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';

	ctx.strokeStyle = LEAD;
	ctx.lineWidth = 3;
	for (const x of [-26, 0, 26]) leg(ctx, x, 24, x, 44);
	for (const x of [-26, 0, 26]) pad(ctx, x, 42);

	const body = ctx.createLinearGradient(-28, -28, 28, 26);
	body.addColorStop(0, '#d3d8db');
	body.addColorStop(0.45, '#9aa1a6');
	body.addColorStop(1, '#5f666b');
	ctx.fillStyle = body;
	ctx.strokeStyle = '#4c5257';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-28, -28, 56, 54, 7);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#dfe3e6';
	ctx.strokeStyle = '#7d858c';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.ellipse(0, -28, 28, 7, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#b7bdc2';
	ctx.strokeStyle = '#7d858c';
	ctx.beginPath();
	ctx.roundRect(-4, -45, 8, 18, 2);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#2f3437';
	ctx.font = 'bold 18px ui-sans-serif, system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('M', 0, 2);
	ctx.restore();
}

function drawStepperMotor(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	const size = String(part.attrs.size ?? '23');
	ctx.save();
	ctx.lineCap = 'round';

	ctx.strokeStyle = LEAD;
	ctx.lineWidth = 2.6;
	for (const x of [-30, -10, 10, 30]) leg(ctx, x, 40, x, 46);
	for (const x of [-30, -10, 10, 30]) pad(ctx, x, 44);

	const body = ctx.createLinearGradient(-38, -40, 38, 40);
	body.addColorStop(0, '#d8dcdf');
	body.addColorStop(0.5, '#a7aeb3');
	body.addColorStop(1, '#767d82');
	ctx.fillStyle = body;
	ctx.strokeStyle = '#5c6368';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-38, -40, 76, 80, 4);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#c6ccd0';
	ctx.strokeStyle = '#6c7378';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.arc(0, 0, 24, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#8b9297';
	ctx.beginPath();
	ctx.arc(0, 0, 10, 0, Math.PI * 2);
	ctx.fill();

	ctx.fillStyle = '#4a4f53';
	ctx.beginPath();
	ctx.arc(0, 0, 5, 0, Math.PI * 2);
	ctx.fill();

	ctx.fillStyle = '#e7e6e1';
	for (const x of [-30, 30]) {
		for (const y of [-32, 32]) {
			ctx.beginPath();
			ctx.arc(x, y, 3, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	label(ctx, `NEMA ${size}`, 0, 30, 7, '#3f464b');
	ctx.restore();
}

function drawA4988(ctx: CanvasRenderingContext2D): void {
	const left = [-70, -50, -30, -10, 10, 30, 50, 70];
	const right = [-60, -40, -20, 0, 20, 40, 60];
	ctx.save();
	ctx.lineCap = 'round';

	const board = ctx.createLinearGradient(0, -86, 0, 86);
	board.addColorStop(0, '#3a8a59');
	board.addColorStop(1, '#23603d');
	ctx.fillStyle = board;
	ctx.strokeStyle = '#1d5234';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-70, -86, 140, 172, 4);
	ctx.fill();
	ctx.stroke();

	ctx.strokeStyle = LEAD;
	ctx.lineWidth = 2.8;
	for (const y of left) leg(ctx, -70, y, -76, y);
	for (const y of right) leg(ctx, 70, y, 76, y);
	for (const y of left) pad(ctx, -70, y);
	for (const y of right) pad(ctx, 70, y);

	// Terminal blocks for the four coil outputs.
	ctx.fillStyle = '#1f4f8f';
	ctx.strokeStyle = '#12325c';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(14, -18, 50, 32, 3);
	ctx.fill();
	ctx.stroke();
	ctx.beginPath();
	ctx.roundRect(14, 22, 50, 32, 3);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#0d2440';
	for (const y of [-2, 38]) {
		ctx.beginPath();
		ctx.arc(30, y, 4, 0, Math.PI * 2);
		ctx.arc(48, y, 4, 0, Math.PI * 2);
		ctx.fill();
	}

	// Driver IC.
	const chip = ctx.createLinearGradient(0, -56, 0, 14);
	chip.addColorStop(0, '#2e3336');
	chip.addColorStop(1, '#121415');
	ctx.fillStyle = chip;
	ctx.strokeStyle = '#0b0c0d';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-48, -56, 54, 70, 3);
	ctx.fill();
	ctx.stroke();
	ctx.strokeStyle = '#c9ced2';
	ctx.lineWidth = 3;
	for (let i = 0; i < 4; i++) {
		const y = -46 + i * 15;
		leg(ctx, -48, y, -54, y);
		leg(ctx, 6, y, 12, y);
	}
	ctx.fillStyle = '#23603d';
	ctx.beginPath();
	ctx.arc(-21, -56, 6, 0, Math.PI, false);
	ctx.fill();
	label(ctx, 'A4988', -21, -8, 8, '#cfd6db');

	// Microstep trimmer.
	ctx.fillStyle = '#2f5b93';
	ctx.strokeStyle = '#1d3b62';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.arc(28, -38, 10, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
	ctx.strokeStyle = '#cfd6dd';
	ctx.lineWidth = 1.6;
	leg(ctx, 22, -38, 34, -38);
	ctx.restore();
}

function drawL293d(ctx: CanvasRenderingContext2D): void {
	const left = [-24, 0, 24];
	const right = [-40, -20, 0, 20, 40];
	ctx.save();
	ctx.lineCap = 'round';

	ctx.strokeStyle = LEAD;
	ctx.lineWidth = 3;
	for (const y of left) leg(ctx, -46, y, -58, y);
	for (const y of right) leg(ctx, 46, y, 58, y);
	for (const y of left) pad(ctx, -58, y);
	for (const y of right) pad(ctx, 58, y);

	const chip = ctx.createLinearGradient(0, -40, 0, 40);
	chip.addColorStop(0, '#2e3336');
	chip.addColorStop(1, '#121415');
	ctx.fillStyle = chip;
	ctx.strokeStyle = '#0b0c0d';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-46, -40, 92, 80, 4);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#0b0c0d';
	ctx.beginPath();
	ctx.arc(0, -40, 7, 0, Math.PI, false);
	ctx.fill();
	ctx.strokeStyle = '#3b4044';
	ctx.lineWidth = 1;
	ctx.stroke();

	ctx.fillStyle = '#5c6368';
	ctx.beginPath();
	ctx.arc(-36, -30, 2.5, 0, Math.PI * 2);
	ctx.fill();
	label(ctx, 'L293D', 0, 0, 12, '#cfd6db');
	ctx.restore();
}

function drawUln2003(ctx: CanvasRenderingContext2D): void {
	const left = [-60, -40, -20, 0, 20, 40, 60];
	ctx.save();
	ctx.lineCap = 'round';

	ctx.strokeStyle = LEAD;
	ctx.lineWidth = 3;
	for (const y of left) {
		leg(ctx, -66, y, -76, y);
		leg(ctx, 66, y, 76, y);
	}
	leg(ctx, -30, -74, -30, -86);
	leg(ctx, 30, -74, 30, -86);
	for (const y of left) {
		pad(ctx, -76, y);
		pad(ctx, 76, y);
	}
	pad(ctx, -30, -86);
	pad(ctx, 30, -86);

	const chip = ctx.createLinearGradient(0, -74, 0, 74);
	chip.addColorStop(0, '#2e3336');
	chip.addColorStop(1, '#121415');
	ctx.fillStyle = chip;
	ctx.strokeStyle = '#0b0c0d';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-66, -74, 132, 148, 4);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#0b0c0d';
	ctx.beginPath();
	ctx.arc(0, -74, 8, 0, Math.PI, false);
	ctx.fill();
	ctx.strokeStyle = '#3b4044';
	ctx.lineWidth = 1;
	ctx.stroke();

	ctx.fillStyle = '#5c6368';
	ctx.beginPath();
	ctx.arc(-54, -62, 2.5, 0, Math.PI * 2);
	ctx.fill();
	label(ctx, 'ULN2003', 0, -6, 13, '#cfd6db');
	label(ctx, 'DARLINGTON', 0, 12, 7, '#8b9297');
	ctx.restore();
}

function drawVibrationMotor(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';

	ctx.strokeStyle = LEAD;
	ctx.lineWidth = 3;
	leg(ctx, -12, 10, -12, 34);
	leg(ctx, 12, 10, 12, 34);

	const body = ctx.createRadialGradient(-6, -12, 2, 0, -6, 20);
	body.addColorStop(0, '#5c6368');
	body.addColorStop(0.6, '#2e3336');
	body.addColorStop(1, '#141618');
	ctx.fillStyle = body;
	ctx.strokeStyle = '#0b0c0d';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.arc(0, -6, 18, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();

	// Offset weight inside the can.
	ctx.fillStyle = '#8b9297';
	ctx.beginPath();
	ctx.arc(5, -3, 6, 0, Math.PI * 2);
	ctx.fill();

	ctx.strokeStyle = 'rgba(90, 105, 115, 0.5)';
	ctx.lineWidth = 1.4;
	for (const radius of [21, 24]) {
		ctx.beginPath();
		ctx.arc(0, -6, radius, -0.5, 0.5);
		ctx.stroke();
	}
	ctx.restore();
}

function drawRelay(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';

	ctx.strokeStyle = LEAD;
	ctx.lineWidth = 3;
	for (const y of [-24, 0, 24]) {
		leg(ctx, -40, y, -54, y);
		leg(ctx, 40, y, 54, y);
		pad(ctx, -54, y);
		pad(ctx, 54, y);
	}

	const box = ctx.createLinearGradient(0, -34, 0, 34);
	box.addColorStop(0, 'rgba(74, 141, 219, 0.95)');
	box.addColorStop(1, 'rgba(38, 92, 166, 0.95)');
	ctx.fillStyle = box;
	ctx.strokeStyle = '#1e4f8c';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-40, -34, 80, 68, 4);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
	ctx.beginPath();
	ctx.roundRect(-36, -30, 72, 18, 3);
	ctx.fill();

	// Coil.
	ctx.fillStyle = 'rgba(20, 50, 90, 0.4)';
	ctx.beginPath();
	ctx.roundRect(-32, -20, 22, 40, 3);
	ctx.fill();
	ctx.strokeStyle = '#c9a227';
	ctx.lineWidth = 1.6;
	for (let i = 0; i < 5; i++) {
		const y = -14 + i * 7;
		ctx.beginPath();
		ctx.arc(-22, y, 4, -Math.PI / 2, Math.PI / 2);
		ctx.stroke();
	}

	// Armature and contacts.
	ctx.strokeStyle = '#e7e6e1';
	ctx.lineWidth = 2.4;
	leg(ctx, 2, 14, 24, -12);
	ctx.fillStyle = '#e7e6e1';
	ctx.beginPath();
	ctx.arc(2, 14, 3, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#c9a227';
	ctx.beginPath();
	ctx.arc(24, -12, 2.4, 0, Math.PI * 2);
	ctx.arc(24, 8, 2.4, 0, Math.PI * 2);
	ctx.fill();

	label(ctx, 'RELAY', 14, -24, 7, '#e7f0fb');
	ctx.restore();
}

function drawRelayModule(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';

	const board = ctx.createLinearGradient(0, -40, 0, 40);
	board.addColorStop(0, '#2b63a8');
	board.addColorStop(1, '#173f72');
	ctx.fillStyle = board;
	ctx.strokeStyle = '#12325c';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-50, -40, 100, 80, 4);
	ctx.fill();
	ctx.stroke();

	ctx.strokeStyle = LEAD;
	ctx.lineWidth = 2.8;
	for (const y of [-24, 0, 24]) {
		leg(ctx, -50, y, -58, y);
		leg(ctx, 50, y, 58, y);
		pad(ctx, -58, y);
		pad(ctx, 58, y);
	}

	// Relay can.
	const box = ctx.createLinearGradient(0, -30, 0, 22);
	box.addColorStop(0, 'rgba(74, 141, 219, 0.95)');
	box.addColorStop(1, 'rgba(38, 92, 166, 0.95)');
	ctx.fillStyle = box;
	ctx.strokeStyle = '#1e4f8c';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-36, -30, 42, 52, 3);
	ctx.fill();
	ctx.stroke();
	ctx.strokeStyle = '#c9a227';
	ctx.lineWidth = 1.4;
	for (let i = 0; i < 4; i++) {
		const y = -20 + i * 9;
		leg(ctx, -28, y, -20, y);
	}

	// Screw terminal.
	ctx.fillStyle = '#2f7d4f';
	ctx.strokeStyle = '#1d5234';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(14, -32, 30, 64, 3);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#16351f';
	for (const y of [-24, 0, 24]) {
		ctx.beginPath();
		ctx.arc(29, y, 4, 0, Math.PI * 2);
		ctx.fill();
	}

	// Driver transistor and indicator.
	ctx.fillStyle = '#16181a';
	ctx.beginPath();
	ctx.moveTo(-18, 30);
	ctx.arc(-12, 30, 6, Math.PI, 0, false);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = '#e0503f';
	ctx.beginPath();
	ctx.arc(2, 28, 3.5, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

function drawKs2e(ctx: CanvasRenderingContext2D): void {
	const right = [-45, -27, -9, 9, 27, 45];
	ctx.save();
	ctx.lineCap = 'round';

	ctx.strokeStyle = LEAD;
	ctx.lineWidth = 3;
	for (const y of [-12, 12]) leg(ctx, -56, y, -70, y);
	for (const y of right) leg(ctx, 56, y, 70, y);
	for (const y of [-12, 12]) pad(ctx, -70, y);
	for (const y of right) pad(ctx, 70, y);

	const box = ctx.createLinearGradient(0, -52, 0, 52);
	box.addColorStop(0, 'rgba(74, 141, 219, 0.95)');
	box.addColorStop(1, 'rgba(38, 92, 166, 0.95)');
	ctx.fillStyle = box;
	ctx.strokeStyle = '#1e4f8c';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-56, -52, 112, 104, 4);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
	ctx.beginPath();
	ctx.roundRect(-52, -48, 104, 18, 3);
	ctx.fill();

	// Coil.
	ctx.fillStyle = 'rgba(20, 50, 90, 0.4)';
	ctx.beginPath();
	ctx.roundRect(-46, -34, 24, 68, 3);
	ctx.fill();
	ctx.strokeStyle = '#c9a227';
	ctx.lineWidth = 1.6;
	for (let i = 0; i < 8; i++) {
		const y = -26 + i * 7.5;
		ctx.beginPath();
		ctx.arc(-34, y, 4, -Math.PI / 2, Math.PI / 2);
		ctx.stroke();
	}

	// Two changeover contacts.
	for (const y of [-30, 30]) {
		ctx.strokeStyle = '#e7e6e1';
		ctx.lineWidth = 2.4;
		leg(ctx, -4, y + 14, 24, y - 12);
		ctx.fillStyle = '#e7e6e1';
		ctx.beginPath();
		ctx.arc(-4, y + 14, 3, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = '#c9a227';
		ctx.beginPath();
		ctx.arc(24, y - 12, 2.4, 0, Math.PI * 2);
		ctx.arc(24, y + 10, 2.4, 0, Math.PI * 2);
		ctx.fill();
	}

	label(ctx, 'DPDT', 0, -42, 7, '#e7f0fb');
	ctx.restore();
}

function drawOptocoupler(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	const variant = String(part.attrs.variant ?? '4N25');
	ctx.save();
	ctx.lineCap = 'round';

	ctx.strokeStyle = LEAD;
	ctx.lineWidth = 2.8;
	for (const y of [-12, 12]) {
		leg(ctx, -30, y, -42, y);
		leg(ctx, 30, y, 42, y);
		pad(ctx, -42, y);
		pad(ctx, 42, y);
	}

	const chip = ctx.createLinearGradient(0, -24, 0, 24);
	chip.addColorStop(0, '#2e3336');
	chip.addColorStop(1, '#121415');
	ctx.fillStyle = chip;
	ctx.strokeStyle = '#0b0c0d';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-30, -24, 60, 48, 4);
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = '#0b0c0d';
	ctx.beginPath();
	ctx.arc(0, -24, 5, 0, Math.PI, false);
	ctx.fill();

	// LED side.
	ctx.strokeStyle = '#e0a04a';
	ctx.lineWidth = 1.4;
	leg(ctx, -22, -7, -16, -7);
	leg(ctx, -22, 7, -16, 7);
	leg(ctx, -16, -7, -16, 7);
	ctx.fillStyle = '#e0a04a';
	ctx.beginPath();
	ctx.moveTo(-16, -7);
	ctx.lineTo(-16, 7);
	ctx.lineTo(-8, 0);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = '#e0a04a';
	leg(ctx, -8, -7, -8, 7);

	// Optical coupling arrows.
	ctx.strokeStyle = '#7ee2a8';
	ctx.lineWidth = 1.2;
	for (const y of [-5, 3]) {
		leg(ctx, -4, y, 4, y - 3);
		leg(ctx, 2, y - 3, 4, y - 3);
		leg(ctx, 4, y - 3, 4, y - 1);
	}

	// Phototransistor.
	ctx.strokeStyle = '#cfd6db';
	ctx.lineWidth = 1.6;
	leg(ctx, 12, -11, 12, 11);
	leg(ctx, 12, -4, 20, -9);
	leg(ctx, 12, 4, 20, 9);
	leg(ctx, 6, 0, 12, 0);

	label(ctx, variant, 0, 17, 6, '#8b9297');
	ctx.restore();
}

function drawMosfet(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	const channel = String(part.attrs.channel ?? 'n').toUpperCase();
	ctx.save();
	ctx.lineCap = 'round';

	ctx.strokeStyle = LEAD;
	ctx.lineWidth = 2.8;
	leg(ctx, -20, 8, -20, 42);
	leg(ctx, 0, 10, 0, 42);
	leg(ctx, 20, 8, 20, 42);

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

	label(ctx, `${channel}-MOS`, 0, -2, 8, '#cfd6db');
	label(ctx, 'TO-92', 0, 5, 5.5, '#8b9297');
	ctx.restore();
}

function drawOpamp(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';

	ctx.strokeStyle = LEAD;
	ctx.lineWidth = 2.8;
	leg(ctx, -40, -16, -46, -16);
	leg(ctx, -40, 16, -46, 16);
	leg(ctx, 44, 0, 46, 0);
	leg(ctx, 0, -18, 0, -40);
	leg(ctx, 0, 18, 0, 40);
	pad(ctx, -46, -16);
	pad(ctx, -46, 16);
	pad(ctx, 46, 0);
	pad(ctx, 0, -40);
	pad(ctx, 0, 40);

	ctx.fillStyle = '#f0eee6';
	ctx.strokeStyle = EDGE;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(-40, -34);
	ctx.lineTo(-40, 34);
	ctx.lineTo(44, 0);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	// Input polarity.
	ctx.strokeStyle = EDGE;
	ctx.lineWidth = 2;
	leg(ctx, -32, -16, -24, -16);
	leg(ctx, -28, -20, -28, -12);
	leg(ctx, -32, 16, -24, 16);

	label(ctx, 'OA', 0, 0, 7, '#5f5a4e');
	ctx.restore();
}

function drawLm393(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';

	const board = ctx.createLinearGradient(0, -38, 0, 38);
	board.addColorStop(0, '#2b63a8');
	board.addColorStop(1, '#173f72');
	ctx.fillStyle = board;
	ctx.strokeStyle = '#12325c';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-44, -38, 88, 76, 4);
	ctx.fill();
	ctx.stroke();

	ctx.strokeStyle = LEAD;
	ctx.lineWidth = 2.8;
	for (const y of [-30, -10, 10, 30]) leg(ctx, -44, y, -54, y);
	leg(ctx, 44, 0, 54, 0);
	for (const y of [-30, -10, 10, 30]) pad(ctx, -54, y);
	pad(ctx, 54, 0);

	const chip = ctx.createLinearGradient(0, -22, 0, 22);
	chip.addColorStop(0, '#2e3336');
	chip.addColorStop(1, '#121415');
	ctx.fillStyle = chip;
	ctx.strokeStyle = '#0b0c0d';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-18, -22, 36, 44, 3);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#0b0c0d';
	ctx.beginPath();
	ctx.arc(0, -22, 4, 0, Math.PI, false);
	ctx.fill();
	label(ctx, 'LM393', 0, 2, 7, '#cfd6db');

	// Threshold trimmer.
	ctx.fillStyle = '#2f5b93';
	ctx.strokeStyle = '#1d3b62';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.arc(28, -18, 9, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
	ctx.strokeStyle = '#cfd6dd';
	ctx.lineWidth = 1.4;
	leg(ctx, 22, -18, 34, -18);

	ctx.fillStyle = '#3fb862';
	ctx.beginPath();
	ctx.arc(28, 16, 4, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

function drawRegulator(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	const variant = String(part.attrs.variant ?? '7805');
	ctx.save();
	ctx.lineCap = 'round';

	ctx.strokeStyle = LEAD;
	ctx.lineWidth = 3;
	for (const x of [-18, 0, 18]) leg(ctx, x, 18, x, 44);
	for (const x of [-18, 0, 18]) pad(ctx, x, 42);
	// The LM317's adjust tap, on the body's side.
	leg(ctx, 20, 0, 42, 0);
	pad(ctx, 40, 0);

	// Heat tab.
	ctx.fillStyle = '#c3c9cd';
	ctx.strokeStyle = '#7d858c';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-15, -44, 30, 16, 2);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#7d858c';
	ctx.beginPath();
	ctx.arc(0, -36, 3.5, 0, Math.PI * 2);
	ctx.fill();

	const body = ctx.createLinearGradient(0, -32, 0, 18);
	body.addColorStop(0, '#3b4044');
	body.addColorStop(1, '#16181a');
	ctx.fillStyle = body;
	ctx.strokeStyle = '#0b0c0d';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.roundRect(-20, -32, 40, 50, 3);
	ctx.fill();
	ctx.stroke();

	label(ctx, variant, 0, -4, 8, '#cfd6db');
	ctx.restore();
}

function drawDcDc(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	const boost = String(part.attrs.topology ?? 'buck') === 'boost';
	ctx.save();
	ctx.lineCap = 'round';

	ctx.strokeStyle = LEAD;
	ctx.lineWidth = 3;
	for (const x of [-18, 0, 18]) {
		leg(ctx, x, 18, x, 44);
		pad(ctx, x, 42);
	}

	const board = ctx.createLinearGradient(0, -30, 0, 18);
	board.addColorStop(0, '#2b63a8');
	board.addColorStop(1, '#173f72');
	ctx.fillStyle = board;
	ctx.strokeStyle = '#12325c';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-30, -30, 60, 48, 4);
	ctx.fill();
	ctx.stroke();

	// Inductor winding along the top of the module.
	ctx.strokeStyle = '#d9a441';
	ctx.lineWidth = 2;
	ctx.beginPath();
	for (let i = 0; i < 4; i++) {
		ctx.arc(-18 + i * 9, -18, 4.5, Math.PI, 0, false);
	}
	ctx.stroke();

	label(ctx, boost ? 'BOOST' : 'BUCK', 0, 6, 9, '#dfe7ef');
	ctx.restore();
}

function drawDiodeSymbol(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = EDGE;
	ctx.lineWidth = 2.6;

	leg(ctx, -40, 0, -12, 0);
	leg(ctx, 12, 0, 40, 0);

	ctx.fillStyle = EDGE;
	ctx.beginPath();
	ctx.moveTo(-12, -10);
	ctx.lineTo(-12, 10);
	ctx.lineTo(12, 0);
	ctx.closePath();
	ctx.fill();

	ctx.lineWidth = 3;
	leg(ctx, 12, -11, 12, 11);
	ctx.restore();
}

function drawZenerSymbol(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = EDGE;
	ctx.lineWidth = 2.6;

	leg(ctx, -40, 0, -12, 0);
	leg(ctx, 12, 0, 40, 0);

	ctx.fillStyle = EDGE;
	ctx.beginPath();
	ctx.moveTo(-12, -10);
	ctx.lineTo(-12, 10);
	ctx.lineTo(12, 0);
	ctx.closePath();
	ctx.fill();

	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(7, -14);
	ctx.lineTo(12, -10);
	ctx.lineTo(12, 10);
	ctx.lineTo(17, 14);
	ctx.stroke();
	ctx.restore();
}

function drawElectrolytic(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	const value = String(part.attrs.value ?? '10u');
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = EDGE;
	ctx.lineWidth = 2.6;

	leg(ctx, -14, -4, -14, 32);
	leg(ctx, 14, 10, 14, 32);

	// Straight plate is the positive terminal.
	ctx.lineWidth = 3;
	leg(ctx, -20, -4, 20, -4);
	ctx.beginPath();
	ctx.moveTo(-20, 8);
	ctx.quadraticCurveTo(0, 16, 20, 8);
	ctx.stroke();

	ctx.lineWidth = 2;
	leg(ctx, 21, -17, 27, -17);
	leg(ctx, 24, -20, 24, -14);

	label(ctx, value, -2, -22, 7, '#5f5a4e');
	ctx.restore();
}

function drawInductor(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = EDGE;
	ctx.lineWidth = 2.6;

	leg(ctx, -40, 0, -30, 0);
	leg(ctx, 30, 0, 40, 0);
	for (let i = 0; i < 4; i++) {
		ctx.beginPath();
		ctx.arc(-22.5 + i * 15, 0, 7.5, Math.PI, Math.PI * 2);
		ctx.stroke();
	}
	ctx.restore();
}

function drawFuse(ctx: CanvasRenderingContext2D): void {
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = EDGE;
	ctx.lineWidth = 2.4;

	leg(ctx, -40, 0, -26, 0);
	leg(ctx, 26, 0, 40, 0);

	ctx.fillStyle = '#f3f1ea';
	ctx.strokeStyle = EDGE;
	ctx.lineWidth = 1.8;
	ctx.beginPath();
	ctx.roundRect(-26, -8, 52, 16, 8);
	ctx.fill();
	ctx.stroke();

	ctx.strokeStyle = '#8b8577';
	ctx.lineWidth = 1.6;
	ctx.beginPath();
	ctx.moveTo(-18, 0);
	ctx.bezierCurveTo(-12, -7, -6, 7, 0, 0);
	ctx.bezierCurveTo(6, -7, 12, 7, 18, 0);
	ctx.stroke();
	ctx.restore();
}

function drawClockGenerator(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	const frequency = String(part.attrs.frequency ?? '10k');
	ctx.save();
	ctx.lineCap = 'round';

	const board = ctx.createLinearGradient(0, -30, 0, 26);
	board.addColorStop(0, '#2b63a8');
	board.addColorStop(1, '#173f72');
	ctx.fillStyle = board;
	ctx.strokeStyle = '#12325c';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-42, -30, 84, 56, 4);
	ctx.fill();
	ctx.stroke();

	ctx.strokeStyle = LEAD;
	ctx.lineWidth = 2.8;
	leg(ctx, -26, 26, -26, 38);
	leg(ctx, 26, 26, 26, 38);
	pad(ctx, -26, 37);
	pad(ctx, 26, 37);

	ctx.fillStyle = '#10201a';
	ctx.strokeStyle = '#0a0f0d';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.roundRect(-34, -24, 68, 24, 2);
	ctx.fill();
	ctx.stroke();

	ctx.strokeStyle = '#7ee2a8';
	ctx.lineWidth = 1.8;
	strokeWave(ctx, 'square', -30, 30, -13, 6, 3);

	label(ctx, `${frequency} Hz`, 0, 11, 7, '#cfe0ff');
	ctx.restore();
}

function drawSignalGenerator(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	const wave = String(part.attrs.wave ?? 'square');
	const frequency = String(part.attrs.frequency ?? '1k');
	ctx.save();
	ctx.lineCap = 'round';

	const board = ctx.createLinearGradient(0, -34, 0, 24);
	board.addColorStop(0, '#2b63a8');
	board.addColorStop(1, '#173f72');
	ctx.fillStyle = board;
	ctx.strokeStyle = '#12325c';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-46, -34, 92, 58, 4);
	ctx.fill();
	ctx.stroke();

	ctx.strokeStyle = LEAD;
	ctx.lineWidth = 2.8;
	leg(ctx, -30, 24, -30, 40);
	leg(ctx, 30, 24, 30, 40);
	pad(ctx, -30, 39);
	pad(ctx, 30, 39);

	ctx.fillStyle = '#10201a';
	ctx.strokeStyle = '#0a0f0d';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.roundRect(-38, -28, 76, 26, 2);
	ctx.fill();
	ctx.stroke();

	ctx.strokeStyle = '#7ee2a8';
	ctx.lineWidth = 1.8;
	strokeWave(ctx, wave, -34, 34, -15, 9, 3);

	// Waveform selector knob.
	ctx.fillStyle = '#3b4044';
	ctx.strokeStyle = '#16181a';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.arc(30, 12, 7, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
	ctx.strokeStyle = '#cfd6dd';
	ctx.lineWidth = 1.6;
	leg(ctx, 30, 12, 30, 6);

	label(ctx, frequency, -12, 12, 7, '#cfe0ff');
	ctx.restore();
}

export const OUTPUT_PARTS: PartDef[] = [
	{
		type: 'litz-dc-motor',
		name: 'DC motor',
		category: 'Actuators',
		keywords: ['motor', 'dc', 'brushed', 'actuator'],
		width: 84,
		height: 96,
		pins: [
			{ name: 'IN1', x: -26, y: 44 },
			{ name: 'IN2', x: 0, y: 44 },
			{ name: 'PWM', x: 26, y: 44 }
		],
		attrs: [],
		draw: (ctx) => drawDcMotor(ctx)
	},
	{
		type: 'litz-stepper-motor',
		name: 'Stepper motor',
		category: 'Actuators',
		keywords: ['stepper', 'motor', 'bipolar', 'nema', 'actuator'],
		width: 100,
		height: 100,
		pins: [
			{ name: 'A-', x: -30, y: 46 },
			{ name: 'A+', x: -10, y: 46 },
			{ name: 'B+', x: 10, y: 46 },
			{ name: 'B-', x: 30, y: 46 }
		],
		attrs: [
			{ name: 'gearRatio', type: 'string', default: '1:1' },
			{ name: 'display', type: 'enum', values: ['steps', 'angle', 'none'], default: 'steps' },
			{ name: 'size', type: 'enum', values: ['8', '11', '14', '17', '23', '34'], default: '23' },
			{ name: 'arrow', type: 'string', default: '' }
		],
		draw: (ctx, part) => drawStepperMotor(ctx, part)
	},
	{
		type: 'litz-a4988',
		name: 'A4988 stepper driver',
		category: 'Actuators',
		keywords: ['a4988', 'stepper', 'driver', 'pololu', 'motor'],
		width: 158,
		height: 180,
		pins: [
			{ name: 'ENABLE', label: 'active low', x: -76, y: -70 },
			{ name: 'MS1', x: -76, y: -50 },
			{ name: 'MS2', x: -76, y: -30 },
			{ name: 'MS3', x: -76, y: -10 },
			{ name: 'RESET', label: 'active low', x: -76, y: 10 },
			{ name: 'SLEEP', label: 'active low', x: -76, y: 30 },
			{ name: 'STEP', x: -76, y: 50 },
			{ name: 'DIR', x: -76, y: 70 },
			{ name: 'GND', x: 76, y: -60 },
			{ name: 'VDD', x: 76, y: -40 },
			{ name: '1B', x: 76, y: -20 },
			{ name: '1A', x: 76, y: 0 },
			{ name: '2A', x: 76, y: 20 },
			{ name: '2B', x: 76, y: 40 },
			{ name: 'VMOT', label: 'motor supply', x: 76, y: 60 }
		],
		attrs: [],
		draw: (ctx) => drawA4988(ctx)
	},
	{
		type: 'litz-l293d',
		name: 'L293D',
		category: 'Actuators',
		keywords: ['l293d', 'h-bridge', 'motor', 'driver', 'dip'],
		width: 124,
		height: 96,
		pins: [
			{ name: 'IN1', x: -58, y: -24 },
			{ name: 'IN2', x: -58, y: 0 },
			{ name: 'EN', label: 'channel enable / PWM', x: -58, y: 24 },
			{ name: 'OUT1', x: 58, y: -40 },
			{ name: 'OUT2', x: 58, y: -20 },
			{ name: 'VCC1', label: 'logic supply', x: 58, y: 0 },
			{ name: 'VCC2', label: 'motor supply', x: 58, y: 20 },
			{ name: 'GND', x: 58, y: 40 }
		],
		attrs: [],
		draw: (ctx) => drawL293d(ctx)
	},
	{
		type: 'litz-uln2003',
		name: 'ULN2003',
		category: 'Actuators',
		keywords: ['uln2003', 'darlington', 'driver', 'sink', 'dip'],
		width: 158,
		height: 190,
		pins: [
			{ name: 'IN1', x: -76, y: -60 },
			{ name: 'IN2', x: -76, y: -40 },
			{ name: 'IN3', x: -76, y: -20 },
			{ name: 'IN4', x: -76, y: 0 },
			{ name: 'IN5', x: -76, y: 20 },
			{ name: 'IN6', x: -76, y: 40 },
			{ name: 'IN7', x: -76, y: 60 },
			{ name: 'OUT1', x: 76, y: -60 },
			{ name: 'OUT2', x: 76, y: -40 },
			{ name: 'OUT3', x: 76, y: -20 },
			{ name: 'OUT4', x: 76, y: 0 },
			{ name: 'OUT5', x: 76, y: 20 },
			{ name: 'OUT6', x: 76, y: 40 },
			{ name: 'OUT7', x: 76, y: 60 },
			{ name: 'COM', x: -30, y: -86 },
			{ name: 'GND', x: 30, y: -86 }
		],
		attrs: [],
		draw: (ctx) => drawUln2003(ctx)
	},
	{
		type: 'litz-vibration-motor',
		name: 'Vibration motor',
		category: 'Actuators',
		keywords: ['vibration', 'motor', 'haptic', 'coin'],
		width: 56,
		height: 74,
		pins: [
			{ name: '1', x: -12, y: 34 },
			{ name: '2', x: 12, y: 34 }
		],
		attrs: [],
		draw: (ctx) => drawVibrationMotor(ctx)
	},
	{
		type: 'litz-relay',
		name: 'Relay',
		category: 'Actuators',
		keywords: ['relay', 'spdt', 'switch', 'coil'],
		width: 116,
		height: 92,
		pins: [
			{ name: 'IN', label: 'coil drive', x: -54, y: -24 },
			{ name: 'VCC', x: -54, y: 0 },
			{ name: 'GND', x: -54, y: 24 },
			{ name: 'NO', label: 'normally open', x: 54, y: -24 },
			{ name: 'NC', label: 'normally closed', x: 54, y: 0 },
			{ name: 'COM', label: 'common', x: 54, y: 24 }
		],
		attrs: [],
		draw: (ctx) => drawRelay(ctx)
	},
	{
		type: 'litz-relay-module',
		name: 'Relay module',
		category: 'Actuators',
		keywords: ['relay', 'module', 'spdt', 'driver'],
		width: 124,
		height: 92,
		pins: [
			{ name: 'VCC', x: -58, y: -24 },
			{ name: 'GND', x: -58, y: 0 },
			{ name: 'IN', x: -58, y: 24 },
			{ name: 'NC', x: 58, y: -24 },
			{ name: 'COM', x: 58, y: 0 },
			{ name: 'NO', x: 58, y: 24 }
		],
		attrs: [{ name: 'transistor', type: 'enum', values: ['npn', 'pnp'], default: 'npn' }],
		draw: (ctx) => drawRelayModule(ctx)
	},
	{
		type: 'litz-ks2e-m-dc5',
		name: 'DPDT relay',
		category: 'Actuators',
		keywords: ['relay', 'dpdt', 'ks2e', 'two-pole'],
		width: 148,
		height: 128,
		pins: [
			{ name: 'COIL1', x: -70, y: -12 },
			{ name: 'COIL2', x: -70, y: 12 },
			{ name: 'P1', label: 'first pole', x: 70, y: -45 },
			{ name: 'NC1', x: 70, y: -27 },
			{ name: 'NO1', x: 70, y: -9 },
			{ name: 'P2', label: 'second pole', x: 70, y: 9 },
			{ name: 'NC2', x: 70, y: 27 },
			{ name: 'NO2', x: 70, y: 45 }
		],
		attrs: [],
		draw: (ctx) => drawKs2e(ctx)
	},
	{
		type: 'litz-optocoupler',
		name: 'Optocoupler',
		category: 'Logic',
		keywords: ['optocoupler', 'opto', 'isolation', '4n25', 'pc817'],
		width: 96,
		height: 74,
		pins: [
			{ name: 'A', label: 'LED anode', x: -42, y: -12 },
			{ name: 'K', label: 'LED cathode', x: -42, y: 12 },
			{ name: 'C', label: 'phototransistor collector', x: 42, y: -12 },
			{ name: 'E', label: 'phototransistor emitter', x: 42, y: 12 }
		],
		attrs: [
			{ name: 'variant', type: 'enum', values: ['4N25', 'PC817'], default: '4N25' },
			{ name: 'ctr', type: 'number', default: 0.5 }
		],
		draw: (ctx, part) => drawOptocoupler(ctx, part)
	},
	{
		type: 'litz-mosfet',
		name: 'MOSFET',
		category: 'Logic',
		keywords: ['mosfet', 'transistor', 'fet', 'n-channel', 'p-channel'],
		width: 52,
		height: 64,
		pins: [
			{ name: 'D', label: 'drain', x: -20, y: 42 },
			{ name: 'G', label: 'gate', x: 0, y: 42 },
			{ name: 'S', label: 'source', x: 20, y: 42 }
		],
		attrs: [
			{ name: 'channel', type: 'enum', values: ['n', 'p'], default: 'n' },
			{ name: 'vth', type: 'number', default: 2.0 }
		],
		draw: (ctx, part) => drawMosfet(ctx, part)
	},
	{
		type: 'litz-opamp',
		name: 'Op-amp',
		category: 'Logic',
		keywords: ['opamp', 'op-amp', 'amplifier', 'analog'],
		width: 100,
		height: 88,
		pins: [
			{ name: '+', label: 'non-inverting input', x: -46, y: -16 },
			{ name: '-', label: 'inverting input', x: -46, y: 16 },
			{ name: 'OUT', label: 'output', x: 46, y: 0 },
			{ name: 'V+', label: 'positive supply', x: 0, y: -40 },
			{ name: 'V-', label: 'negative supply', x: 0, y: 40 }
		],
		attrs: [{ name: 'gain', type: 'number', default: 100000 }],
		draw: (ctx) => drawOpamp(ctx)
	},
	{
		type: 'litz-lm393',
		name: 'LM393 comparator module',
		category: 'Logic',
		keywords: ['lm393', 'comparator', 'module', 'threshold'],
		width: 116,
		height: 84,
		pins: [
			{ name: 'VCC', x: -54, y: -30 },
			{ name: 'GND', x: -54, y: -10 },
			{ name: '+', label: 'non-inverting input', x: -54, y: 10 },
			{ name: '-', label: 'inverting input', x: -54, y: 30 },
			{ name: 'OUT', label: 'high while + is above -', x: 54, y: 0 }
		],
		attrs: [
			{ name: 'threshold', type: 'number', default: 1.65 },
			{ name: 'value', type: 'number', default: 0 },
			{ name: 'vref', type: 'number', default: 3.3 }
		],
		draw: (ctx) => drawLm393(ctx)
	},
	{
		type: 'litz-voltage-regulator',
		name: 'Voltage regulator',
		category: 'Power',
		keywords: ['regulator', 'ldo', '7805', 'lm317', 'power'],
		width: 66,
		height: 92,
		pins: [
			{ name: 'VI', label: 'input', x: -18, y: 44 },
			{ name: 'GND', label: 'ground', x: 0, y: 44 },
			{ name: 'VO', label: 'output', x: 18, y: 44 },
			{ name: 'ADJ', label: 'adjust', x: 42, y: 0 }
		],
		attrs: [
			{ name: 'variant', type: 'enum', values: ['7805', '7812', '7905', 'LM317'], default: '7805' },
			{ name: 'voltage', type: 'number', default: 5.0 }
		],
		draw: (ctx, part) => drawRegulator(ctx, part)
	},
	{
		type: 'litz-dc-dc',
		name: 'DC-DC converter',
		category: 'Power',
		keywords: ['buck', 'boost', 'converter', 'step-down', 'step-up'],
		width: 66,
		height: 92,
		pins: [
			{ name: 'VI', label: 'input', x: -18, y: 44 },
			{ name: 'GND', label: 'ground', x: 0, y: 44 },
			{ name: 'VO', label: 'output', x: 18, y: 44 }
		],
		attrs: [
			{ name: 'topology', type: 'enum', values: ['buck', 'boost'], default: 'buck' },
			{ name: 'voltage', type: 'number', default: 5.0 },
			{ name: 'max_amps', type: 'number', default: 2.0 }
		],
		draw: (ctx, part) => drawDcDc(ctx, part)
	},
	{
		type: 'litz-zener',
		name: 'Zener diode',
		category: 'Passives',
		keywords: ['zener', 'diode', 'breakdown', 'clamp'],
		width: 84,
		height: 24,
		pins: [
			{ name: 'A', label: 'anode', x: -40, y: 0 },
			{ name: 'C', label: 'cathode', x: 40, y: 0 }
		],
		attrs: [
			{ name: 'vz', type: 'number', default: 5.1 },
			{ name: 'vf', type: 'number', default: 0.7 }
		],
		draw: (ctx) => drawZenerSymbol(ctx)
	},
	{
		type: 'litz-diode',
		name: 'Diode',
		category: 'Passives',
		keywords: ['diode', 'rectifier', 'silicon'],
		width: 84,
		height: 24,
		pins: [
			{ name: 'A', label: 'anode', x: -40, y: 0 },
			{ name: 'C', label: 'cathode', x: 40, y: 0 }
		],
		attrs: [{ name: 'vf', type: 'number', default: 0.7 }],
		draw: (ctx) => drawDiodeSymbol(ctx)
	},
	{
		type: 'litz-diode-1n4007',
		name: '1N4007 diode',
		category: 'Passives',
		keywords: ['diode', '1n4007', 'rectifier', '1a'],
		width: 84,
		height: 24,
		pins: [
			{ name: 'A', label: 'anode', x: -40, y: 0 },
			{ name: 'C', label: 'cathode', x: 40, y: 0 }
		],
		attrs: [{ name: 'vf', type: 'number', default: 0.9 }],
		draw: (ctx) => drawDiodeSymbol(ctx)
	},
	{
		type: 'litz-capacitor-electrolytic',
		name: 'Electrolytic capacitor',
		category: 'Passives',
		keywords: ['capacitor', 'cap', 'electrolytic', 'polarised'],
		width: 60,
		height: 68,
		pins: [
			{ name: '1', label: 'positive', x: -14, y: 32 },
			{ name: '2', label: 'negative', x: 14, y: 32 }
		],
		attrs: [{ name: 'value', type: 'string', default: '10u' }],
		draw: (ctx, part) => drawElectrolytic(ctx, part)
	},
	{
		type: 'litz-inductor',
		name: 'Inductor',
		category: 'Passives',
		keywords: ['inductor', 'coil', 'henry', 'choke'],
		width: 84,
		height: 30,
		pins: [
			{ name: '1', x: -40, y: 0 },
			{ name: '2', x: 40, y: 0 }
		],
		attrs: [{ name: 'value', type: 'string', default: '10mH' }],
		draw: (ctx) => drawInductor(ctx)
	},
	{
		type: 'litz-fuse',
		name: 'Fuse',
		category: 'Passives',
		keywords: ['fuse', 'protection', 'cartridge'],
		width: 84,
		height: 24,
		pins: [
			{ name: '1', x: -40, y: 0 },
			{ name: '2', x: 40, y: 0 }
		],
		attrs: [{ name: 'rating', type: 'string', default: '500mA' }],
		draw: (ctx) => drawFuse(ctx)
	},
	{
		type: 'litz-clock-generator',
		name: 'Clock generator',
		category: 'Modules',
		keywords: ['clock', 'generator', 'square', 'frequency'],
		width: 100,
		height: 76,
		pins: [
			{ name: 'CLK', label: 'clock output', x: -26, y: 38 },
			{ name: 'GND', x: 26, y: 38 }
		],
		attrs: [{ name: 'frequency', type: 'string', default: '10k' }],
		draw: (ctx, part) => drawClockGenerator(ctx, part)
	},
	{
		type: 'litz-signal-generator',
		name: 'Signal generator',
		category: 'Modules',
		keywords: ['signal', 'generator', 'function', 'waveform', 'frequency'],
		width: 110,
		height: 82,
		pins: [
			{ name: 'OUT', label: 'signal output', x: -30, y: 40 },
			{ name: 'GND', label: 'reference', x: 30, y: 40 }
		],
		attrs: [
			{
				name: 'wave',
				type: 'enum',
				values: ['square', 'sine', 'triangle', 'sawtooth'],
				default: 'square'
			},
			{ name: 'frequency', type: 'string', default: '1k' },
			{ name: 'duty', type: 'string', default: '50' },
			{ name: 'amplitude', type: 'string', default: '3.3' },
			{ name: 'offset', type: 'string', default: '' },
			{ name: 'phase', type: 'string', default: '0' }
		],
		draw: (ctx, part) => drawSignalGenerator(ctx, part)
	}
];
