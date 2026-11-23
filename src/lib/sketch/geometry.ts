import { GRID, type Point } from './types';

/** Rotate around the origin. `deg` is clockwise on screen, where y points down. */
export function rotatePoint(x: number, y: number, deg: number): [number, number] {
	if (!deg) return [x, y];
	const rad = (deg * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	return [x * cos - y * sin, x * sin + y * cos];
}

export function snapToGrid(value: number, grid = GRID): number {
	return Math.round(value / grid) * grid;
}

export function distance(a: Point, b: Point): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Distance from a point to a polyline, used for wire hit testing. */
export function distanceToPolyline(p: Point, points: Point[]): number {
	let best = Infinity;
	for (let i = 0; i < points.length - 1; i++) {
		const a = points[i];
		const b = points[i + 1];
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const len2 = dx * dx + dy * dy;
		let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
		t = Math.max(0, Math.min(1, t));
		best = Math.min(best, Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)));
	}
	return best;
}

export function pointInBox(
	p: Point,
	box: { x0: number; y0: number; x1: number; y1: number }
): boolean {
	return p.x >= box.x0 && p.x <= box.x1 && p.y >= box.y0 && p.y <= box.y1;
}
