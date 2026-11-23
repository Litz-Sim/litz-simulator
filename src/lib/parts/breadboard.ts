import { rotatePoint } from '#lib/sketch/geometry';
import { GRID, type BoardInstance, type BoardType, type Box, type Point } from '#lib/sketch/types';

export interface RailDef {
	/** Row (in holes) the rail sits on. */
	row: number;
	/** Column segments; a real board breaks each rail in the middle. */
	segments: [number, number][];
	polarity: '+' | '-';
}

export interface BoardDef {
	type: BoardType;
	name: string;
	cols: number;
	/** Tie-point rows above and below the centre channel. */
	rows: [[number, number], [number, number]];
	rails: RailDef[];
	/** Board outline in local world units. */
	bounds: Box;
	tiePoints: number;
}

function defineFull(): BoardDef {
	const cols = 63;
	const rails: RailDef[] = [
		{
			row: -5,
			segments: [
				[0, 24],
				[38, 62]
			],
			polarity: '-'
		},
		{
			row: -3,
			segments: [
				[0, 24],
				[38, 62]
			],
			polarity: '+'
		},
		{
			row: 14,
			segments: [
				[0, 24],
				[38, 62]
			],
			polarity: '+'
		},
		{
			row: 16,
			segments: [
				[0, 24],
				[38, 62]
			],
			polarity: '-'
		}
	];
	return {
		type: 'breadboard-full',
		name: 'Full-size breadboard',
		cols,
		rows: [
			[0, 4],
			[7, 11]
		],
		rails,
		bounds: { x0: -30, y0: -130, x1: cols * GRID + 10, y1: 16 * GRID + 30 },
		tiePoints: cols * 10 + 4 * 50
	};
}

function defineHalf(): BoardDef {
	const cols = 30;
	const rails: RailDef[] = [
		{ row: -5, segments: [[0, 24]], polarity: '-' },
		{ row: -3, segments: [[0, 24]], polarity: '+' },
		{ row: 14, segments: [[0, 24]], polarity: '+' },
		{ row: 16, segments: [[0, 24]], polarity: '-' }
	];
	return {
		type: 'breadboard-half',
		name: 'Half-size breadboard',
		cols,
		rows: [
			[0, 4],
			[7, 11]
		],
		rails,
		bounds: { x0: -30, y0: -130, x1: cols * GRID + 10, y1: 16 * GRID + 30 },
		tiePoints: cols * 10 + 4 * 25
	};
}

export const BOARD_DEFS: Record<BoardType, BoardDef> = {
	'breadboard-full': defineFull(),
	'breadboard-half': defineHalf()
};

export function boardDef(type: BoardType): BoardDef {
	return BOARD_DEFS[type];
}

/** Local position of a hole, before the board's own placement. */
export function holeLocal(col: number, row: number): Point {
	return { x: col * GRID, y: row * GRID };
}

export function holePoint(board: BoardInstance, col: number, row: number): Point {
	const [dx, dy] = rotatePoint(col * GRID, row * GRID, board.rotate);
	return { x: board.x + dx, y: board.y + dy };
}

/** The nearest hole to a world point, or null when the point is off the board. */
export function nearestHole(
	board: BoardInstance,
	world: Point,
	maxDistance = GRID * 0.6
): { col: number; row: number; point: Point } | null {
	const rad = (-board.rotate * Math.PI) / 180;
	const dx = world.x - board.x;
	const dy = world.y - board.y;
	const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
	const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
	const col = Math.round(lx / GRID);
	const row = Math.round(ly / GRID);
	const def = boardDef(board.type);
	if (col < 0 || col >= def.cols) return null;
	const inTieA = row >= def.rows[0][0] && row <= def.rows[0][1];
	const inTieB = row >= def.rows[1][0] && row <= def.rows[1][1];
	const inRail = def.rails.some(
		(rail) => rail.row === row && rail.segments.some(([a, b]) => col >= a && col <= b)
	);
	if (!inTieA && !inTieB && !inRail) return null;
	const point = { x: col * GRID, y: row * GRID };
	if (Math.hypot(lx - point.x, ly - point.y) > maxDistance) return null;
	return { col, row, point: holePoint(board, col, row) };
}

/** Tie-point and rail groups: holes that are electrically joined on the board. */
export function boardGroups(board: BoardInstance, def: BoardDef): { col: number; row: number }[][] {
	const groups: { col: number; row: number }[][] = [];
	for (let col = 0; col < def.cols; col++) {
		for (const [from, to] of def.rows) {
			const group = [];
			for (let row = from; row <= to; row++) group.push({ col, row });
			groups.push(group);
		}
	}
	for (const rail of def.rails) {
		for (const [from, to] of rail.segments) {
			const group = [];
			for (let col = from; col <= to; col++) group.push({ col, row: rail.row });
			groups.push(group);
		}
	}
	return groups;
}

/** Draw the board in local space. The caller applies placement and zoom. */
export function drawBoard(ctx: CanvasRenderingContext2D, def: BoardDef, zoom: number): void {
	const { x0, y0, x1, y1 } = def.bounds;
	const w = x1 - x0;
	const h = y1 - y0;

	ctx.save();
	ctx.shadowColor = 'rgba(30, 26, 20, 0.28)';
	ctx.shadowBlur = 14;
	ctx.shadowOffsetY = 7;
	ctx.fillStyle = '#f4f1e8';
	ctx.beginPath();
	ctx.roundRect(x0, y0, w, h, 18);
	ctx.fill();
	ctx.restore();

	// The recessed panel the holes are drilled into.
	ctx.fillStyle = '#e9e4d7';
	ctx.beginPath();
	ctx.roundRect(x0 + 8, y0 + 8, w - 16, h - 16, 12);
	ctx.fill();

	// Centre channel.
	const channelTop = def.rows[0][1] * GRID + GRID * 0.9;
	const channelBottom = def.rows[1][0] * GRID - GRID * 0.9;
	ctx.fillStyle = '#ddd7c8';
	ctx.fillRect(x0 + 20, channelTop, w - 40, channelBottom - channelTop);

	// Power rail stripes.
	for (const rail of def.rails) {
		ctx.strokeStyle = rail.polarity === '+' ? 'rgba(196, 61, 52, 0.45)' : 'rgba(52, 92, 168, 0.45)';
		ctx.lineWidth = 2;
		for (const [from, to] of rail.segments) {
			ctx.beginPath();
			ctx.moveTo(from * GRID, rail.row * GRID + 13);
			ctx.lineTo(to * GRID, rail.row * GRID + 13);
			ctx.stroke();
		}
	}

	if (zoom >= 0.22) {
		const r = Math.max(2.2, 5.2);
		ctx.fillStyle = '#454a4d';
		for (let col = 0; col < def.cols; col++) {
			for (const [from, to] of def.rows) {
				for (let row = from; row <= to; row++) {
					ctx.beginPath();
					ctx.arc(col * GRID, row * GRID, r, 0, Math.PI * 2);
					ctx.fill();
				}
			}
		}
		for (const rail of def.rails) {
			for (const [from, to] of rail.segments) {
				for (let col = from; col <= to; col++) {
					ctx.beginPath();
					ctx.arc(col * GRID, rail.row * GRID, r, 0, Math.PI * 2);
					ctx.fill();
				}
			}
		}

		// A faint highlight inside every hole reads as depth at normal zoom.
		if (zoom >= 0.55) {
			ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
			for (let col = 0; col < def.cols; col++) {
				for (const [from, to] of def.rows) {
					for (let row = from; row <= to; row++) {
						ctx.beginPath();
						ctx.arc(col * GRID - r * 0.25, row * GRID - r * 0.3, r * 0.55, 0, Math.PI * 2);
						ctx.fill();
					}
				}
			}
		}
	}

	// Row letters and column numbers, the way a real board is printed.
	if (zoom >= 0.75) {
		ctx.fillStyle = 'rgba(70, 66, 58, 0.55)';
		ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		const rowsA = 'abcde';
		const rowsB = 'fghij';
		for (let i = 0; i < 5; i++) {
			ctx.fillText(rowsA[i], -18, def.rows[0][0] * GRID + i * GRID);
			ctx.fillText(rowsB[i], -18, def.rows[1][0] * GRID + i * GRID);
		}
		for (let col = 0; col < def.cols; col += 5) {
			ctx.fillText(String(col + 1), col * GRID, 6 * GRID + 6);
		}
	}
}
