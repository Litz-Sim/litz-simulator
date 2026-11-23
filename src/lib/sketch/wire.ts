import type { Bend, Point } from './types';

/** Turn the chord-space bends into world positions. */
export function bendPoints(a: Point, b: Point, bends: Bend[]): Point[] {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len = Math.hypot(dx, dy) || 1;
	const nx = -dy / len;
	const ny = dx / len;
	return bends.map((bend) => ({
		x: a.x + dx * bend.u + nx * bend.v,
		y: a.y + dy * bend.u + ny * bend.v
	}));
}

/**
 * The channel a fresh wire gets: the midpoint between its ends. Orthogonal
 * routing turns this into the middle of the longer axis.
 */
export function defaultBend(): Bend[] {
	return [{ u: 0.5, v: 0 }];
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

/** Drop repeated points and corners that do not change direction. */
function simplify(points: Point[]): Point[] {
	const out: Point[] = [];
	for (const point of points) {
		const last = out[out.length - 1];
		if (last && Math.abs(last.x - point.x) < 0.01 && Math.abs(last.y - point.y) < 0.01) continue;
		out.push(point);
	}
	for (let i = 1; i < out.length - 1;) {
		const a = out[i - 1];
		const b = out[i];
		const c = out[i + 1];
		const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
		if (Math.abs(cross) < 0.01) out.splice(i, 1);
		else i += 1;
	}
	return out;
}

/**
 * Orthogonal route: horizontal and vertical segments only. The bend picks the
 * middle channel — a vertical channel for mostly-horizontal wires, a
 * horizontal one otherwise. Without a bend a single corner joins the ends.
 */
export function orthoPoints(a: Point, b: Point, bends: Bend[]): Point[] {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	if (Math.abs(dx) < 0.01 || Math.abs(dy) < 0.01) return [a, b];
	if (bends.length === 0) return simplify([a, { x: b.x, y: a.y }, b]);

	const middle = bendPoints(a, b, [bends[0]])[0];
	const route =
		Math.abs(dx) >= Math.abs(dy)
			? [a, { x: middle.x, y: a.y }, { x: middle.x, y: b.y }, b]
			: [a, { x: a.x, y: middle.y }, { x: b.x, y: middle.y }, b];
	return simplify(route);
}

export function tracePolyline(ctx: CanvasRenderingContext2D, points: Point[]): void {
	if (points.length < 2) return;
	ctx.beginPath();
	ctx.moveTo(points[0].x, points[0].y);
	for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
}

export function traceWire(ctx: CanvasRenderingContext2D, a: Point, b: Point, bends: Bend[]): void {
	tracePolyline(ctx, orthoPoints(a, b, bends));
}

/** A polyline approximation of the wire, for hit testing. */
export function wirePoints(a: Point, b: Point, bends: Bend[]): Point[] {
	return orthoPoints(a, b, bends);
}

/** Where the bend handle sits: the middle of the crossbar. */
export function bendHandle(a: Point, b: Point, bend: Bend): Point {
	const middle = bendPoints(a, b, [bend])[0];
	if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) {
		return { x: middle.x, y: (a.y + b.y) / 2 };
	}
	return { x: (a.x + b.x) / 2, y: middle.y };
}

/** Convert a dragged handle position back into chord space. */
export function bendFromPoint(a: Point, b: Point, point: Point): Bend {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	if (Math.abs(dx) >= Math.abs(dy)) {
		if (Math.abs(dx) < 0.01) return { u: 0.5, v: 0 };
		return { u: clamp01((point.x - a.x) / dx), v: 0 };
	}
	if (Math.abs(dy) < 0.01) return { u: 0.5, v: 0 };
	return { u: clamp01((point.y - a.y) / dy), v: 0 };
}
