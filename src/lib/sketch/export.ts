import { boardDef } from '#lib/parts/breadboard';
import { partDef } from '#lib/parts/registry';
import { GRID, type BoardInstance, type Endpoint, type PartInstance, type Sketch } from './types';

export interface LitzPart {
	id: string;
	type: string;
	attrs: Record<string, string | number | boolean>;
	left: number;
	top: number;
	rotate: number;
}

export interface LitzDiagram {
	version: 1;
	editor: string;
	parts: LitzPart[];
	connections: [string, string, string, []][];
}

class Nets {
	#parent = new Map<string, string>();

	find(key: string): string {
		if (!this.#parent.has(key)) this.#parent.set(key, key);
		let root = key;
		while (this.#parent.get(root) !== root) root = this.#parent.get(root)!;
		let cursor = key;
		while (this.#parent.get(cursor) !== root) {
			const next = this.#parent.get(cursor)!;
			this.#parent.set(cursor, root);
			cursor = next;
		}
		return root;
	}

	union(a: string, b: string): void {
		const ra = this.find(a);
		const rb = this.find(b);
		if (ra !== rb) this.#parent.set(ra, rb);
	}
}

function pinKey(part: string, pin: string): string {
	return `p:${part}:${pin}`;
}

function holeKey(board: string, col: number, row: number): string {
	return `h:${board}:${col}:${row}`;
}

/** World position of a part pin. */
export function pinPosition(part: PartInstance, name: string) {
	const def = partDef(part.type);
	const pin = def.pins.find((p) => p.name === name);
	if (!pin) return null;
	const rad = (part.rotate * Math.PI) / 180;
	return {
		x: part.x + pin.x * Math.cos(rad) - pin.y * Math.sin(rad),
		y: part.y + pin.x * Math.sin(rad) + pin.y * Math.cos(rad)
	};
}

/** The nearest board hole to a world point, or null. */
export function holeNear(sketch: Sketch, point: { x: number; y: number }, tolerance = GRID * 0.55) {
	let best: { board: BoardInstance; col: number; row: number; distance: number } | null = null;
	for (const board of sketch.boards) {
		const def = boardDef(board.type);
		const rad = (-board.rotate * Math.PI) / 180;
		const dx = point.x - board.x;
		const dy = point.y - board.y;
		const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
		const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
		const col = Math.round(lx / GRID);
		const row = Math.round(ly / GRID);
		if (col < 0 || col >= def.cols) continue;
		const inTie =
			(row >= def.rows[0][0] && row <= def.rows[0][1]) ||
			(row >= def.rows[1][0] && row <= def.rows[1][1]);
		const inRail = def.rails.some(
			(rail) => rail.row === row && rail.segments.some(([a, b]) => col >= a && col <= b)
		);
		if (!inTie && !inRail) continue;
		const distance = Math.hypot(lx - col * GRID, ly - row * GRID);
		if (distance > tolerance) continue;
		if (!best || distance < best.distance) best = { board, col, row, distance };
	}
	return best;
}

/**
 * Flatten the visual document into the file Litz reads.
 *
 * Geometry is presentation only there, so part positions go into `left`/`top`
 * and nothing else. Electrical meaning comes from three places: explicit
 * wires, breadboard tie groups, and pins that physically sit in a hole.
 */
export function toLitzDiagram(sketch: Sketch): LitzDiagram {
	const nets = new Nets();

	// Holes that share a tie column or a rail segment are one net.
	for (const board of sketch.boards) {
		const def = boardDef(board.type);
		for (let col = 0; col < def.cols; col++) {
			for (const [from, to] of def.rows) {
				for (let row = from + 1; row <= to; row++) {
					nets.union(holeKey(board.id, col, from), holeKey(board.id, col, row));
				}
			}
		}
		for (const rail of def.rails) {
			for (const [from, to] of rail.segments) {
				for (let col = from + 1; col <= to; col++) {
					nets.union(holeKey(board.id, col, rail.row), holeKey(board.id, from, rail.row));
				}
			}
		}
	}

	// A part pin sitting in a hole joins that hole's net.
	for (const part of sketch.parts) {
		const def = partDef(part.type);
		for (const pin of def.pins) {
			const position = pinPosition(part, pin.name);
			if (!position) continue;
			const hole = holeNear(sketch, position);
			if (hole) nets.union(pinKey(part.id, pin.name), holeKey(hole.board.id, hole.col, hole.row));
		}
	}

	const explicit: [string, string, string, []][] = [];
	const seen = new Set<string>();
	const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

	const explicitWire = (from: Endpoint, to: Endpoint, color: string) => {
		if (from.kind === 'free' || to.kind === 'free') return;
		const a = endpointKey(from, sketch);
		const b = endpointKey(to, sketch);
		if (!a || !b) return;
		nets.union(a, b);
		if (from.kind !== 'pin' || to.kind !== 'pin') return;
		const key = pairKey(a, b);
		if (seen.has(key)) return;
		seen.add(key);
		explicit.push([`${from.part}:${from.pin}`, `${to.part}:${to.pin}`, color, []]);
	};

	for (const wire of sketch.wires) explicitWire(wire.from, wire.to, wire.color);

	// Every net with two or more pins becomes connections. A three-way join is
	// three connections, which is what the format documents.
	const roots = new Map<string, { pin: string; ref: string }[]>();
	for (const part of sketch.parts) {
		const def = partDef(part.type);
		for (const pin of def.pins) {
			const key = pinKey(part.id, pin.name);
			const root = nets.find(key);
			const list = roots.get(root) ?? [];
			list.push({ pin: key, ref: `${part.id}:${pin.name}` });
			roots.set(root, list);
		}
	}

	const connections: [string, string, string, []][] = [...explicit];
	for (const list of roots.values()) {
		if (list.length < 2) continue;
		const first = list[0].pin;
		for (let i = 1; i < list.length; i++) {
			const key = pairKey(first, list[i].pin);
			if (seen.has(key)) continue;
			seen.add(key);
			connections.push([list[0].ref, list[i].ref, '', []]);
		}
	}

	return {
		version: 1,
		editor: 'litz-board',
		parts: sketch.parts.map((part) => ({
			id: part.id,
			type: part.type,
			attrs: { ...part.attrs },
			left: part.x,
			top: part.y,
			rotate: part.rotate
		})),
		connections
	};
}

function endpointKey(endpoint: Endpoint, sketch: Sketch): string | null {
	if (endpoint.kind === 'pin') {
		const part = sketch.parts.find((p) => p.id === endpoint.part);
		return part ? pinKey(endpoint.part, endpoint.pin) : null;
	}
	if (endpoint.kind === 'hole') {
		const board = sketch.boards.find((b) => b.id === endpoint.board);
		return board ? holeKey(endpoint.board, endpoint.col, endpoint.row) : null;
	}
	return null;
}
