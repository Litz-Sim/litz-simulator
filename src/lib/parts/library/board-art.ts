import { shade } from '../art';

export interface BoardArtOptions {
	left: string[];
	right: string[];
	label: string;
	zoom: number;
	width: number;
	height: number;
}

const PIN_SPACING = 20;
const PAD_WIDTH = 12;
const PAD_HEIGHT = 10;

/**
 * A development board drawn from its two header columns. The pin geometry here
 * matches the PinDef layout in board-parts.ts: rows are centred vertically and
 * pads sit flush with the left and right edges.
 */
export function drawBoard(ctx: CanvasRenderingContext2D, opts: BoardArtOptions): void {
	const { left, right, label, zoom, width, height } = opts;
	const halfWidth = width / 2;
	const halfHeight = height / 2;

	ctx.save();

	// PCB body.
	const body = ctx.createLinearGradient(0, -halfHeight, 0, halfHeight);
	body.addColorStop(0, shade('#27333a', 0.06));
	body.addColorStop(1, shade('#161d21', -0.04));
	ctx.fillStyle = body;
	ctx.strokeStyle = '#0b0f11';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.roundRect(-halfWidth, -halfHeight, width, height, 8);
	ctx.fill();
	ctx.stroke();

	// Mounting holes in the four corners.
	const holes: [number, number][] = [
		[-halfWidth + 11, -halfHeight + 11],
		[halfWidth - 11, -halfHeight + 11],
		[-halfWidth + 11, halfHeight - 11],
		[halfWidth - 11, halfHeight - 11]
	];
	for (const [x, y] of holes) {
		ctx.fillStyle = '#0a0e10';
		ctx.beginPath();
		ctx.arc(x, y, 4, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = '#c9a227';
		ctx.lineWidth = 1;
		ctx.stroke();
	}

	// Metal shield / module.
	const shieldWidth = Math.min(width - 48, 132);
	const shieldHeight = Math.min(96, Math.max(56, height * 0.24));
	const shieldX = -shieldWidth / 2;
	const shieldY = -halfHeight + 30;
	const shield = ctx.createLinearGradient(
		shieldX,
		shieldY,
		shieldX + shieldWidth,
		shieldY + shieldHeight
	);
	shield.addColorStop(0, '#d7dbde');
	shield.addColorStop(0.5, '#9aa2a8');
	shield.addColorStop(1, '#c3c9cd');
	ctx.fillStyle = shield;
	ctx.strokeStyle = '#70787e';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.roundRect(shieldX, shieldY, shieldWidth, shieldHeight, 3);
	ctx.fill();
	ctx.stroke();

	// Antenna meander along the top of the shield.
	ctx.strokeStyle = '#c9a227';
	ctx.lineWidth = 2;
	ctx.beginPath();
	for (let i = 0; i < 5; i++) {
		const x = -24 + i * 12;
		ctx.moveTo(x, shieldY - 12);
		ctx.lineTo(x, shieldY - 4);
	}
	ctx.stroke();

	// Board label, squeezed to fit the shield width.
	ctx.fillStyle = 'rgba(35, 41, 45, 0.82)';
	ctx.font = 'bold 9px ui-sans-serif, system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(label, 0, shieldY + shieldHeight / 2, shieldWidth - 12);

	// USB connector along the bottom edge.
	ctx.fillStyle = '#b9c0c6';
	ctx.strokeStyle = '#70787e';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.roundRect(-15, halfHeight - 14, 30, 20, 2);
	ctx.fill();
	ctx.stroke();

	// Pin pads and labels.
	const rows = Math.max(left.length, right.length, 1);
	const top = -((rows - 1) * PIN_SPACING) / 2;
	const drawPad = (name: string, y: number, isLeft: boolean): void => {
		const padX = isLeft ? -halfWidth : halfWidth - PAD_WIDTH;
		ctx.fillStyle = '#c9a227';
		ctx.strokeStyle = '#8a6f1b';
		ctx.lineWidth = 0.8;
		ctx.beginPath();
		ctx.roundRect(padX, y - PAD_HEIGHT / 2, PAD_WIDTH, PAD_HEIGHT, 2);
		ctx.fill();
		ctx.stroke();
		if (zoom >= 0.5) {
			ctx.fillStyle = '#cfd6db';
			ctx.font = '6.5px ui-sans-serif, system-ui, sans-serif';
			ctx.textBaseline = 'middle';
			ctx.textAlign = isLeft ? 'left' : 'right';
			ctx.fillText(name, isLeft ? -halfWidth + PAD_WIDTH + 3 : halfWidth - PAD_WIDTH - 3, y);
		}
	};
	left.forEach((name, index) => drawPad(name, top + index * PIN_SPACING, true));
	right.forEach((name, index) => drawPad(name, top + index * PIN_SPACING, false));

	ctx.restore();
}
