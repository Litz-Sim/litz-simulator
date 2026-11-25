import type { PartInstance } from '#lib/sketch/types';
import type { PartDef } from '../types';

/*
 * Bench instruments the canvas can hold.
 *
 * The meter draws only what its attributes say; the reading is live state and
 * belongs to the Meter panel, so the art here never touches the simulation.
 */

const LEAD_POSITIVE = '#c0392b';
const LEAD_NEGATIVE = '#2b2b2b';

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

function drawMultimeter(ctx: CanvasRenderingContext2D, part: PartInstance): void {
	const mode = String(part.attrs.mode ?? 'voltage');
	const current = mode === 'current';

	ctx.save();
	ctx.lineCap = 'round';

	// Case.
	const body = ctx.createLinearGradient(0, -40, 0, 24);
	body.addColorStop(0, '#f4c84f');
	body.addColorStop(1, '#d09a24');
	ctx.fillStyle = body;
	ctx.strokeStyle = '#9c6f14';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-46, -40, 92, 64, 7);
	ctx.fill();
	ctx.stroke();

	// Display.
	ctx.fillStyle = '#12241c';
	ctx.strokeStyle = '#0a1410';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.roundRect(-36, -33, 72, 28, 2);
	ctx.fill();
	ctx.stroke();

	ctx.textAlign = 'right';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = '#7ee2a8';
	ctx.font = '20px ui-monospace, SFMono-Regular, Menlo, monospace';
	ctx.fillText(current ? 'A' : 'V', 26, -19);
	ctx.textAlign = 'left';
	ctx.font = '7px ui-monospace, SFMono-Regular, Menlo, monospace';
	ctx.fillText('DC', -30, -26);

	// Range dial, pointing at the mode's side.
	ctx.fillStyle = '#3b4044';
	ctx.strokeStyle = '#16181a';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.arc(0, 12, 8, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
	const angle = current ? Math.PI * 0.15 : Math.PI * 0.85;
	ctx.strokeStyle = '#e9edf1';
	ctx.lineWidth = 1.6;
	ctx.beginPath();
	ctx.moveTo(0, 12);
	ctx.lineTo(Math.cos(angle) * 6, 12 - Math.sin(angle) * 6);
	ctx.stroke();
	label(ctx, 'V', -20, 12, 7, '#5b4410');
	label(ctx, 'A', 20, 12, 7, '#5b4410');

	// Leads: red on +, black on -.
	ctx.strokeStyle = LEAD_POSITIVE;
	ctx.lineWidth = 2.6;
	ctx.beginPath();
	ctx.moveTo(-30, 24);
	ctx.lineTo(-30, 40);
	ctx.stroke();
	ctx.strokeStyle = LEAD_NEGATIVE;
	ctx.beginPath();
	ctx.moveTo(30, 24);
	ctx.lineTo(30, 40);
	ctx.stroke();

	ctx.fillStyle = LEAD_POSITIVE;
	ctx.beginPath();
	ctx.arc(-30, 40, 2.6, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = LEAD_NEGATIVE;
	ctx.beginPath();
	ctx.arc(30, 40, 2.6, 0, Math.PI * 2);
	ctx.fill();

	label(ctx, '+', -30, 32, 7, '#ffffff');
	label(ctx, '−', 30, 32, 7, '#ffffff');
	ctx.restore();
}

export const INSTRUMENT_PARTS: PartDef[] = [
	{
		type: 'litz-multimeter',
		name: 'Multimeter',
		category: 'Modules',
		keywords: ['multimeter', 'meter', 'voltmeter', 'ammeter', 'voltage', 'current', 'measure'],
		width: 100,
		height: 88,
		pins: [
			{ name: '+', label: 'red lead', x: -30, y: 40 },
			{ name: '-', label: 'black lead', x: 30, y: 40 }
		],
		attrs: [{ name: 'mode', type: 'enum', values: ['voltage', 'current'], default: 'voltage' }],
		artAttr: 'mode',
		draw: (ctx, part) => drawMultimeter(ctx, part)
	}
];
