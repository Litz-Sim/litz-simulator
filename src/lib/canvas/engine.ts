import { canvasStatus } from '#lib/canvas/status.svelte';
import { boardDef, drawBoard, nearestHole } from '#lib/parts/breadboard';
import { partDef } from '#lib/parts/registry';
import type { PinDef } from '#lib/parts/types';
import { sim } from '#lib/sim/controller.svelte';

/** Pressed while the pointer is down; released on pointer-up. */
const MOMENTARY_BUTTONS: readonly string[] = [
	'litz-pushbutton',
	'litz-pushbutton-6mm',
	'litz-pushbutton-momentary'
];

/** Toggle on the press edge and ignore the release. */
const LATCHING_SWITCHES: readonly string[] = [
	'litz-slide-switch',
	'litz-tilt-switch',
	'litz-pushbutton-latching',
	'litz-reed-switch'
];
import { liveDisplay } from '#lib/sim/live';
import { doc } from '#lib/sketch/doc.svelte';
import { distanceToPolyline, pointInBox, snapToGrid } from '#lib/sketch/geometry';
import {
	GRID,
	WIRE_COLORS,
	type BoardInstance,
	type Endpoint,
	type PartInstance,
	type Point,
	type Selection,
	type Sketch,
	type WireInstance
} from '#lib/sketch/types';
import { bendFromPoint, bendHandle, traceWire, wirePoints } from '#lib/sketch/wire';

export type Tool = 'select' | 'wire';

type Hit =
	| { kind: 'pin'; part: PartInstance; pin: PinDef; point: Point }
	| { kind: 'hole'; board: BoardInstance; col: number; row: number; point: Point }
	| { kind: 'part'; part: PartInstance }
	| { kind: 'board'; board: BoardInstance }
	| { kind: 'wire'; wire: WireInstance; point: Point };

type Origin = { kind: 'part' | 'board'; id: string; x: number; y: number };

type Drag =
	| { kind: 'pan'; startX: number; startY: number; panX: number; panY: number }
	| { kind: 'move'; start: Point; origins: Origin[]; single: string | null }
	| { kind: 'wire'; wireId: string; index: number }
	| { kind: 'connect'; from: Endpoint; point: Point }
	| { kind: 'marquee'; start: Point; current: Point; base: Selection[] }
	| { kind: 'control'; partId: string }
	| null;

const MIN_ZOOM = 0.06;
const MAX_ZOOM = 6;
const RULER = 20;
/** How long a finger rests on a pin before its name appears. */
const LONG_PRESS = 450;

function roundRectPath(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number
): void {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.arcTo(x + width, y, x + width, y + height, radius);
	ctx.arcTo(x + width, y + height, x, y + height, radius);
	ctx.arcTo(x, y + height, x, y, radius);
	ctx.arcTo(x, y, x + width, y, radius);
	ctx.closePath();
}

function boxOf(part: PartInstance, width: number, height: number) {
	const rad = (part.rotate * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	const xs: number[] = [];
	const ys: number[] = [];
	for (const [x, y] of [
		[-width / 2, -height / 2],
		[width / 2, -height / 2],
		[width / 2, height / 2],
		[-width / 2, height / 2]
	]) {
		xs.push(part.x + x * cos - y * sin);
		ys.push(part.y + x * sin + y * cos);
	}
	return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

function boxesIntersect(
	a: { x0: number; y0: number; x1: number; y1: number },
	b: { x0: number; y0: number; x1: number; y1: number }
): boolean {
	return a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0;
}

export class CanvasEngine {
	#canvas: HTMLCanvasElement;
	#ctx: CanvasRenderingContext2D;
	#width = 0;
	#height = 0;
	#dpr = 1;
	#frame = 0;
	#tool: Tool = 'select';
	#hover: Hit | null = null;
	#drag: Drag = null;
	#space = false;
	#moved = false;
	/** Pushbutton held down by the pointer while the simulation runs. */
	#pressed: string | null = null;
	/** Display receiving a touch while the pointer is down. */
	#touching: string | null = null;
	/** Live touch points, in canvas pixels, for pinch and two-finger pan. */
	#touches = new Map<number, Point>();
	#gesture: { startDistance: number; startZoom: number; anchor: Point } | null = null;
	/** Pending long-press on a pin; the timer names it without moving. */
	#pressTimer = 0;
	/** Where the finger went down, so drift can cancel the long press. */
	#pressAt: Point | null = null;
	#resize: ResizeObserver;

	constructor(canvas: HTMLCanvasElement) {
		this.#canvas = canvas;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('2D canvas is not available');
		this.#ctx = ctx;
		this.#resize = new ResizeObserver(() => this.#measure());
		this.#resize.observe(canvas);
		this.#measure();
	}

	attach(): void {
		this.#canvas.addEventListener('pointerdown', this.#onPointerDown);
		this.#canvas.addEventListener('pointermove', this.#onPointerMove);
		this.#canvas.addEventListener('pointerup', this.#onPointerUp);
		this.#canvas.addEventListener('pointercancel', this.#onPointerUp);
		this.#canvas.addEventListener('wheel', this.#onWheel, { passive: false });
		window.addEventListener('keydown', this.#onKeyDown);
		window.addEventListener('keyup', this.#onKeyUp);
		canvasStatus.zoom = doc.sketch.view.zoom;
		this.invalidate();
	}

	detach(): void {
		this.#canvas.removeEventListener('pointerdown', this.#onPointerDown);
		this.#canvas.removeEventListener('pointermove', this.#onPointerMove);
		this.#canvas.removeEventListener('pointerup', this.#onPointerUp);
		this.#canvas.removeEventListener('pointercancel', this.#onPointerUp);
		this.#canvas.removeEventListener('wheel', this.#onWheel);
		window.removeEventListener('keydown', this.#onKeyDown);
		window.removeEventListener('keyup', this.#onKeyUp);
		this.#resize.disconnect();
		clearTimeout(this.#pressTimer);
		if (this.#frame) cancelAnimationFrame(this.#frame);
	}

	get tool(): Tool {
		return this.#tool;
	}

	setTool(tool: Tool): void {
		this.#tool = tool;
		this.#canvas.style.cursor = tool === 'wire' ? 'crosshair' : 'default';
	}

	invalidate(): void {
		if (this.#frame) return;
		this.#frame = requestAnimationFrame(() => {
			this.#frame = 0;
			this.draw();
		});
	}

	#measure(): void {
		const rect = this.#canvas.getBoundingClientRect();
		this.#dpr = window.devicePixelRatio || 1;
		this.#width = Math.max(1, Math.round(rect.width));
		this.#height = Math.max(1, Math.round(rect.height));
		this.#canvas.width = Math.round(this.#width * this.#dpr);
		this.#canvas.height = Math.round(this.#height * this.#dpr);
		this.invalidate();
	}

	centerWorld(): Point {
		return this.screenToWorld(this.#width / 2, this.#height / 2);
	}

	screenToWorld(sx: number, sy: number): Point {
		const view = doc.sketch.view;
		return { x: (sx - view.panX) / view.zoom, y: (sy - view.panY) / view.zoom };
	}

	addPartAtCenter(type: string): void {
		const def = partDef(type);
		const center = this.centerWorld();
		// Repeated adds should not pile up on the same spot: walk a grid of
		// cells inside the visible canvas, nearest cell to the centre first.
		const topLeft = this.screenToWorld(RULER + 24, RULER + 24);
		const bottomRight = this.screenToWorld(this.#width - 24, this.#height - 24);
		const cellW = Math.max(GRID * 6, def.width + GRID * 3);
		const cellH = Math.max(GRID * 6, def.height + GRID * 3);
		const cols = Math.max(1, Math.floor((bottomRight.x - topLeft.x) / cellW));
		const rows = Math.max(1, Math.floor((bottomRight.y - topLeft.y) / cellH));

		let best: Point | null = null;
		let bestDistance = Infinity;
		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				const point = {
					x: topLeft.x + (col + 0.5) * cellW,
					y: topLeft.y + (row + 0.5) * cellH
				};
				const taken = doc.sketch.parts.some(
					(part) =>
						Math.abs(part.x - point.x) < cellW * 0.62 && Math.abs(part.y - point.y) < cellH * 0.62
				);
				if (taken) continue;
				const distance = (point.x - center.x) ** 2 + (point.y - center.y) ** 2;
				if (distance < bestDistance) {
					bestDistance = distance;
					best = point;
				}
			}
		}

		const snapped = this.#snapCandidate(type, 0, best ?? center);
		doc.addPart(type, snapped.x, snapped.y, { snap: false });
	}

	addBoardAtCenter(type: 'breadboard-full' | 'breadboard-half'): void {
		const center = this.centerWorld();
		doc.addBoard(type, center.x, center.y);
	}

	fit(): void {
		const box = this.#contentBox();
		const view = doc.sketch.view;
		if (!box) {
			view.zoom = 1;
			view.panX = this.#width / 2;
			view.panY = this.#height / 2;
			canvasStatus.zoom = 1;
			this.invalidate();
			return;
		}
		const w = Math.max(1, box.x1 - box.x0);
		const h = Math.max(1, box.y1 - box.y0);
		const zoom = Math.min(
			(this.#width - RULER * 2) / (w * 1.12),
			(this.#height - RULER * 2) / (h * 1.12),
			MAX_ZOOM
		);
		view.zoom = Math.max(MIN_ZOOM, zoom);
		view.panX = this.#width / 2 - ((box.x0 + box.x1) / 2) * view.zoom;
		view.panY = this.#height / 2 - ((box.y0 + box.y1) / 2) * view.zoom;
		canvasStatus.zoom = view.zoom;
		this.invalidate();
	}

	zoomBy(factor: number, sx = this.#width / 2, sy = this.#height / 2): void {
		const view = doc.sketch.view;
		const before = this.screenToWorld(sx, sy);
		view.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * factor));
		view.panX = sx - before.x * view.zoom;
		view.panY = sy - before.y * view.zoom;
		canvasStatus.zoom = view.zoom;
		this.invalidate();
	}

	#contentBox(): { x0: number; y0: number; x1: number; y1: number } | null {
		const sketch = doc.sketch;
		let box: { x0: number; y0: number; x1: number; y1: number } | null = null;
		const add = (x0: number, y0: number, x1: number, y1: number) => {
			if (!box) box = { x0, y0, x1, y1 };
			else {
				box.x0 = Math.min(box.x0, x0);
				box.y0 = Math.min(box.y0, y0);
				box.x1 = Math.max(box.x1, x1);
				box.y1 = Math.max(box.y1, y1);
			}
		};
		for (const board of sketch.boards) {
			const def = boardDef(board.type);
			for (const corner of this.#corners(board, def.bounds))
				add(corner.x, corner.y, corner.x, corner.y);
		}
		for (const part of sketch.parts) {
			const def = partDef(part.type);
			const b = boxOf(part, def.width, def.height);
			add(b.x0, b.y0, b.x1, b.y1);
		}
		return box;
	}

	#corners(
		board: BoardInstance,
		bounds: { x0: number; y0: number; x1: number; y1: number }
	): Point[] {
		const rad = (board.rotate * Math.PI) / 180;
		return [
			[bounds.x0, bounds.y0],
			[bounds.x1, bounds.y0],
			[bounds.x1, bounds.y1],
			[bounds.x0, bounds.y1]
		].map(([x, y]) => ({
			x: board.x + x * Math.cos(rad) - y * Math.sin(rad),
			y: board.y + x * Math.sin(rad) + y * Math.cos(rad)
		}));
	}

	// ---------------------------------------------------------------- drawing

	draw(): void {
		const ctx = this.#ctx;
		const view = doc.sketch.view;
		ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
		ctx.fillStyle = '#f7f4ec';
		ctx.fillRect(0, 0, this.#width, this.#height);
		this.#drawDots(ctx);
		ctx.setTransform(
			this.#dpr * view.zoom,
			0,
			0,
			this.#dpr * view.zoom,
			this.#dpr * view.panX,
			this.#dpr * view.panY
		);

		const sketch = doc.sketch;
		for (const board of sketch.boards) {
			ctx.save();
			ctx.translate(board.x, board.y);
			ctx.rotate((board.rotate * Math.PI) / 180);
			drawBoard(ctx, boardDef(board.type), view.zoom);
			ctx.restore();
			if (doc.isSelected('board', board.id)) this.#outlineBoard(ctx, board, view.zoom);
		}

		for (const wire of sketch.wires) this.#drawWire(ctx, wire, view.zoom);
		for (const part of sketch.parts) this.#drawPart(ctx, part, view.zoom);

		if (this.#drag?.kind === 'connect') {
			const from = doc.endpointPoint(this.#drag.from);
			if (from) {
				ctx.save();
				traceWire(ctx, from, this.#drag.point, []);
				ctx.strokeStyle = 'rgba(40, 44, 48, 0.5)';
				ctx.lineWidth = 5;
				ctx.lineCap = 'round';
				ctx.setLineDash([10, 8]);
				ctx.stroke();
				ctx.restore();
			}
		}

		if (this.#hover) this.#drawHover(ctx, this.#hover, view.zoom);
		this.#drawPinLabels(ctx, view.zoom);

		ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
		if (this.#drag?.kind === 'marquee') this.#drawMarquee(ctx);
		this.#drawRulers(ctx);
	}

	#drawDots(ctx: CanvasRenderingContext2D): void {
		const view = doc.sketch.view;
		const step = GRID * 5 * view.zoom;
		if (step < 9) return;
		ctx.fillStyle = 'rgba(90, 84, 70, 0.16)';
		const offsetX = view.panX % step;
		const offsetY = view.panY % step;
		for (let x = offsetX; x < this.#width; x += step) {
			for (let y = offsetY; y < this.#height; y += step) {
				ctx.beginPath();
				ctx.arc(x, y, 1.1, 0, Math.PI * 2);
				ctx.fill();
			}
		}
	}

	#drawPart(ctx: CanvasRenderingContext2D, part: PartInstance, zoom: number): void {
		const def = partDef(part.type);
		ctx.save();
		ctx.translate(part.x, part.y);
		ctx.rotate((part.rotate * Math.PI) / 180);
		def.draw(ctx, part, zoom);
		ctx.restore();

		if (doc.isSelected('part', part.id)) {
			ctx.save();
			ctx.translate(part.x, part.y);
			ctx.rotate((part.rotate * Math.PI) / 180);
			ctx.strokeStyle = '#1f9d55';
			ctx.lineWidth = 2 / zoom;
			ctx.setLineDash([7 / zoom, 5 / zoom]);
			ctx.strokeRect(-def.width / 2 - 5, -def.height / 2 - 5, def.width + 10, def.height + 10);
			ctx.restore();
		}
	}

	#drawWire(ctx: CanvasRenderingContext2D, wire: WireInstance, zoom: number): void {
		const from = doc.endpointPoint(wire.from);
		const to = doc.endpointPoint(wire.to);
		if (!from || !to) return;

		ctx.save();
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		traceWire(ctx, from, to, wire.bend);
		ctx.strokeStyle = 'rgba(28, 26, 22, 0.35)';
		ctx.lineWidth = 10;
		ctx.stroke();
		ctx.strokeStyle = wire.color;
		ctx.lineWidth = 7;
		ctx.stroke();
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
		ctx.lineWidth = 2.4;
		ctx.stroke();
		ctx.restore();

		for (const point of [from, to]) {
			ctx.fillStyle = wire.color;
			ctx.beginPath();
			ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
			ctx.fill();
		}

		if (doc.isSelected('wire', wire.id)) {
			ctx.save();
			ctx.strokeStyle = 'rgba(47, 111, 208, 0.85)';
			ctx.lineWidth = 2 / zoom;
			ctx.setLineDash([6 / zoom, 5 / zoom]);
			traceWire(ctx, from, to, wire.bend);
			ctx.stroke();
			ctx.restore();
			wire.bend.forEach((bend) => {
				const handle = bendHandle(from, to, bend);
				ctx.fillStyle = '#ffffff';
				ctx.strokeStyle = '#2f6fd0';
				ctx.lineWidth = 2 / zoom;
				ctx.beginPath();
				ctx.arc(handle.x, handle.y, 7 / zoom, 0, Math.PI * 2);
				ctx.fill();
				ctx.stroke();
			});
		}
	}

	#outlineBoard(ctx: CanvasRenderingContext2D, board: BoardInstance, zoom: number): void {
		const def = boardDef(board.type);
		ctx.save();
		ctx.translate(board.x, board.y);
		ctx.rotate((board.rotate * Math.PI) / 180);
		ctx.strokeStyle = '#1f9d55';
		ctx.lineWidth = 2 / zoom;
		ctx.setLineDash([8 / zoom, 6 / zoom]);
		ctx.strokeRect(
			def.bounds.x0 - 4,
			def.bounds.y0 - 4,
			def.bounds.x1 - def.bounds.x0 + 8,
			def.bounds.y1 - def.bounds.y0 + 8
		);
		ctx.restore();
	}

	#drawHover(ctx: CanvasRenderingContext2D, hit: Hit, zoom: number): void {
		if (hit.kind === 'pin' || hit.kind === 'hole') {
			ctx.strokeStyle = '#1f9d55';
			ctx.lineWidth = 2 / zoom;
			ctx.beginPath();
			ctx.arc(hit.point.x, hit.point.y, 8 / zoom, 0, Math.PI * 2);
			ctx.stroke();
		}
	}

	/**
	 * Pin names: the pin under the pointer or finger, and the two ends of a
	 * selected wire. The tag is screen-sized and dark, so it reads over any
	 * artwork, including boards that print no pin labels of their own.
	 */
	#drawPinLabels(ctx: CanvasRenderingContext2D, zoom: number): void {
		const labels = new Map<string, { name: string; point: Point }>();
		const add = (name: string, point: Point): void => {
			const key = `${Math.round(point.x)},${Math.round(point.y)}`;
			if (!labels.has(key)) labels.set(key, { name, point });
		};
		if (this.#hover?.kind === 'pin') add(this.#hover.pin.name, this.#hover.point);
		for (const wire of doc.sketch.wires) {
			if (!doc.isSelected('wire', wire.id)) continue;
			for (const endpoint of [wire.from, wire.to]) {
				const pin = this.#endpointPin(endpoint);
				if (pin) add(pin.name, pin.point);
			}
		}
		for (const label of labels.values()) {
			this.#drawPinTag(ctx, label.name, label.point, zoom);
		}
	}

	#drawPinTag(ctx: CanvasRenderingContext2D, name: string, point: Point, zoom: number): void {
		const size = 11 / zoom;
		const padX = 5 / zoom;
		const padY = 3 / zoom;
		ctx.save();
		ctx.font = `600 ${size}px ui-sans-serif, system-ui, sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		const width = ctx.measureText(name).width + padX * 2;
		const height = size + padY * 2;
		const view = doc.sketch.view;
		// Flip below the pin when the tag would run under the ruler.
		const screenY = point.y * view.zoom + view.panY;
		const gap = 4 / zoom;
		const above = screenY - gap - height > RULER;
		const centerY = point.y + (above ? -1 : 1) * (height / 2 + gap);
		const left = point.x - width / 2;
		const top = centerY - height / 2;
		roundRectPath(ctx, left, top, width, height, 4 / zoom);
		ctx.fillStyle = 'rgba(17, 20, 18, 0.94)';
		ctx.fill();
		ctx.fillStyle = '#ffffff';
		ctx.fillText(name, point.x, centerY);
		ctx.restore();
	}

	#drawMarquee(ctx: CanvasRenderingContext2D): void {
		if (this.#drag?.kind !== 'marquee') return;
		const view = doc.sketch.view;
		const a = this.#drag.start;
		const b = this.#drag.current;
		const x = Math.min(a.x, b.x) * view.zoom + view.panX;
		const y = Math.min(a.y, b.y) * view.zoom + view.panY;
		const w = Math.abs(b.x - a.x) * view.zoom;
		const h = Math.abs(b.y - a.y) * view.zoom;
		ctx.fillStyle = 'rgba(47, 111, 208, 0.08)';
		ctx.fillRect(x, y, w, h);
		ctx.strokeStyle = 'rgba(47, 111, 208, 0.8)';
		ctx.lineWidth = 1;
		ctx.setLineDash([4, 3]);
		ctx.strokeRect(x + 0.5, y + 0.5, w, h);
		ctx.setLineDash([]);
	}

	#drawRulers(ctx: CanvasRenderingContext2D): void {
		const view = doc.sketch.view;
		ctx.save();
		ctx.fillStyle = 'rgba(244, 241, 232, 0.96)';
		ctx.fillRect(0, 0, this.#width, RULER);
		ctx.fillRect(0, 0, RULER, this.#height);
		ctx.strokeStyle = '#d5cfc0';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(0, RULER + 0.5);
		ctx.lineTo(this.#width, RULER + 0.5);
		ctx.moveTo(RULER + 0.5, 0);
		ctx.lineTo(RULER + 0.5, this.#height);
		ctx.stroke();

		const target = 70 / view.zoom;
		const step = [20, 50, 100, 200, 500, 1000, 2000, 5000].find((c) => c >= target) ?? 5000;
		const minor = step / 5;
		ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
		ctx.fillStyle = '#7b7568';
		ctx.textBaseline = 'middle';

		const worldLeft = (RULER - view.panX) / view.zoom;
		const worldRight = (this.#width - view.panX) / view.zoom;
		const startX = Math.floor(worldLeft / minor) * minor;
		for (let w = startX; w <= worldRight; w += minor) {
			const sx = w * view.zoom + view.panX;
			if (sx < RULER) continue;
			const major = Math.abs(w % step) < 0.001;
			ctx.strokeStyle = major ? '#a49c8a' : '#d5cfc0';
			ctx.beginPath();
			ctx.moveTo(sx + 0.5, RULER - (major ? 7 : 4));
			ctx.lineTo(sx + 0.5, RULER);
			ctx.stroke();
			if (major) ctx.fillText(String(Math.round(w)), sx + 3, RULER - 10);
		}

		const worldTop = (RULER - view.panY) / view.zoom;
		const worldBottom = (this.#height - view.panY) / view.zoom;
		const startY = Math.floor(worldTop / minor) * minor;
		for (let w = startY; w <= worldBottom; w += minor) {
			const sy = w * view.zoom + view.panY;
			if (sy < RULER) continue;
			const major = Math.abs(w % step) < 0.001;
			ctx.strokeStyle = major ? '#a49c8a' : '#d5cfc0';
			ctx.beginPath();
			ctx.moveTo(RULER - (major ? 7 : 4), sy + 0.5);
			ctx.lineTo(RULER, sy + 0.5);
			ctx.stroke();
			if (major) {
				ctx.save();
				ctx.translate(RULER - 9, sy);
				ctx.rotate(-Math.PI / 2);
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(String(Math.round(w)), 0, 0);
				ctx.restore();
			}
		}

		ctx.fillStyle = 'rgba(244, 241, 232, 0.98)';
		ctx.fillRect(0, 0, RULER, RULER);
		ctx.strokeStyle = '#d5cfc0';
		ctx.strokeRect(0.5, 0.5, RULER, RULER);
		ctx.restore();
	}

	// ---------------------------------------------------------------- hit test

	#hitTest(point: Point): Hit | null {
		const sketch = doc.sketch;
		for (const part of sketch.parts) {
			const def = partDef(part.type);
			for (const pin of def.pins) {
				const world = this.#pinWorld(part, pin);
				if (Math.hypot(world.x - point.x, world.y - point.y) < 10) {
					return { kind: 'pin', part, pin, point: world };
				}
			}
		}
		// A part sits over the holes it is plugged into, so its body wins over
		// the hole underneath; its pins were already checked above.
		for (let i = sketch.parts.length - 1; i >= 0; i--) {
			const part = sketch.parts[i];
			const def = partDef(part.type);
			const rad = (-part.rotate * Math.PI) / 180;
			const dx = point.x - part.x;
			const dy = point.y - part.y;
			const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
			const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
			if (Math.abs(lx) <= def.width / 2 + 4 && Math.abs(ly) <= def.height / 2 + 4) {
				return { kind: 'part', part };
			}
		}
		// Wires are drawn under parts but over the bare board, so they take
		// the pointer before an unwired hole does.
		for (const wire of sketch.wires) {
			const from = doc.endpointPoint(wire.from);
			const to = doc.endpointPoint(wire.to);
			if (!from || !to) continue;
			if (distanceToPolyline(point, wirePoints(from, to, wire.bend)) < 7) {
				return { kind: 'wire', wire, point };
			}
		}
		for (const board of sketch.boards) {
			const hole = nearestHole(board, point, 9);
			if (hole) return { kind: 'hole', board, col: hole.col, row: hole.row, point: hole.point };
		}
		for (const board of sketch.boards) {
			const def = boardDef(board.type);
			const rad = (-board.rotate * Math.PI) / 180;
			const dx = point.x - board.x;
			const dy = point.y - board.y;
			const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
			const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
			if (pointInBox({ x: lx, y: ly }, def.bounds)) return { kind: 'board', board };
		}
		return null;
	}

	#pinWorld(part: PartInstance, pin: PinDef): Point {
		const rad = (part.rotate * Math.PI) / 180;
		return {
			x: part.x + pin.x * Math.cos(rad) - pin.y * Math.sin(rad),
			y: part.y + pin.x * Math.sin(rad) + pin.y * Math.cos(rad)
		};
	}

	#endpointOf(hit: Hit): Endpoint | null {
		if (hit.kind === 'pin') return { kind: 'pin', part: hit.part.id, pin: hit.pin.name };
		if (hit.kind === 'hole')
			return { kind: 'hole', board: hit.board.id, col: hit.col, row: hit.row };
		return null;
	}

	/** The part pin a wire ends on, with its live position; holes have no name. */
	#endpointPin(endpoint: Endpoint): { name: string; point: Point } | null {
		if (endpoint.kind !== 'pin') return null;
		const part = doc.part(endpoint.part);
		if (!part) return null;
		const pin = partDef(part.type).pins.find((entry) => entry.name === endpoint.pin);
		if (!pin) return null;
		return { name: pin.name, point: this.#pinWorld(part, pin) };
	}

	#marqueeRect(drag: Extract<Drag, { kind: 'marquee' }>) {
		return {
			x0: Math.min(drag.start.x, drag.current.x),
			y0: Math.min(drag.start.y, drag.current.y),
			x1: Math.max(drag.start.x, drag.current.x),
			y1: Math.max(drag.start.y, drag.current.y)
		};
	}

	#marqueeSelection(
		rect: { x0: number; y0: number; x1: number; y1: number },
		base: Selection[]
	): Selection[] {
		const out: Selection[] = [...base];
		const has = (kind: Selection['kind'], id: string) =>
			out.some((s) => s.kind === kind && s.id === id);
		for (const part of doc.sketch.parts) {
			const def = partDef(part.type);
			if (boxesIntersect(boxOf(part, def.width, def.height), rect) && !has('part', part.id)) {
				out.push({ kind: 'part', id: part.id });
			}
		}
		for (const board of doc.sketch.boards) {
			const def = boardDef(board.type);
			const corners = this.#corners(board, def.bounds);
			const xs = corners.map((c) => c.x);
			const ys = corners.map((c) => c.y);
			const box = {
				x0: Math.min(...xs),
				y0: Math.min(...ys),
				x1: Math.max(...xs),
				y1: Math.max(...ys)
			};
			if (boxesIntersect(box, rect) && !has('board', board.id))
				out.push({ kind: 'board', id: board.id });
		}
		return out;
	}

	#pointerPos(event: PointerEvent): Point {
		const rect = this.#canvas.getBoundingClientRect();
		return this.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
	}

	/** A world point in the part's unrotated local frame. */
	#localPoint(part: PartInstance, point: Point): Point {
		const rad = (-part.rotate * Math.PI) / 180;
		const dx = point.x - part.x;
		const dy = point.y - part.y;
		return {
			x: dx * Math.cos(rad) - dy * Math.sin(rad),
			y: dx * Math.sin(rad) + dy * Math.cos(rad)
		};
	}

	/** Deliver a pointer to the OLED's panel at its own pixel coordinates. */
	#touchPanel(part: PartInstance, point: Point, down: boolean): boolean {
		if (part.type !== 'litz-ssd1306') return false;
		const frame = liveDisplay();
		if (!frame) return false;
		const local = this.#localPoint(part, point);
		const height = Math.min(40, 66 * (frame.height / frame.width));
		const top = -24 + (40 - height) / 2;
		if (local.x < -33 || local.x > 33 || local.y < top || local.y > top + height) return false;
		sim.touch(((local.x + 33) / 66) * frame.width, ((local.y - top) / height) * frame.height, down);
		return true;
	}

	/** Horizontal travel across the pot body is 0–1000 of the wiper. */
	#turnControl(part: PartInstance, point: Point): number {
		const local = this.#localPoint(part, point);
		const permille = Math.max(0, Math.min(1000, ((local.x + 23) / 46) * 1000));
		sim.setControl(part.id, permille);
		return permille;
	}

	// --------------------------------------------------------------- pointers

	#canvasPoint(event: PointerEvent): Point {
		const rect = this.#canvas.getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top };
	}

	#touchPair(): [Point, Point] | null {
		const points = [...this.#touches.values()];
		if (points.length < 2) return null;
		return [points[0], points[1]];
	}

	/** Two fingers take over from whatever one finger started. */
	#beginGesture(): void {
		clearTimeout(this.#pressTimer);
		this.#pressTimer = 0;
		this.#pressAt = null;
		const pair = this.#touchPair();
		if (!pair) return;
		if (this.#pressed) {
			sim.press(this.#pressed, false);
			this.#pressed = null;
		}
		if (this.#touching) {
			sim.touch(0, 0, false);
			this.#touching = null;
		}
		if (this.#drag?.kind === 'move' || this.#drag?.kind === 'wire') doc.cancelDrag();
		this.#drag = null;
		this.#moved = false;
		const mid = { x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 };
		const distance = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
		this.#gesture = {
			startDistance: Math.max(1, distance),
			startZoom: doc.sketch.view.zoom,
			anchor: this.screenToWorld(mid.x, mid.y)
		};
		this.#hover = null;
		this.invalidate();
	}

	#moveGesture(): void {
		const gesture = this.#gesture;
		const pair = this.#touchPair();
		if (!gesture || !pair) return;
		const mid = { x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 };
		const distance = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
		const view = doc.sketch.view;
		view.zoom = Math.min(
			MAX_ZOOM,
			Math.max(MIN_ZOOM, gesture.startZoom * (distance / gesture.startDistance))
		);
		view.panX = mid.x - gesture.anchor.x * view.zoom;
		view.panY = mid.y - gesture.anchor.y * view.zoom;
		canvasStatus.zoom = view.zoom;
		this.invalidate();
	}

	#onPointerDown = (event: PointerEvent): void => {
		if (event.button !== 0 && event.button !== 1) return;
		try {
			this.#canvas.setPointerCapture(event.pointerId);
		} catch {
			// Safari can refuse a capture for a touch it already routed elsewhere.
		}

		if (event.pointerType === 'touch') {
			this.#touches.set(event.pointerId, this.#canvasPoint(event));
			if (this.#touches.size >= 2) {
				this.#beginGesture();
				return;
			}
			if (this.#gesture) return;
		}

		const screen = { x: event.clientX, y: event.clientY };
		const point = this.#pointerPos(event);
		this.#moved = false;

		if (event.button === 1 || this.#space) {
			const view = doc.sketch.view;
			this.#drag = {
				kind: 'pan',
				startX: screen.x,
				startY: screen.y,
				panX: view.panX,
				panY: view.panY
			};
			return;
		}

		const hit = this.#hitTest(point);
		// A finger hides what it covers; resting on a pin names it.
		if (event.pointerType === 'touch' && hit?.kind === 'pin') {
			clearTimeout(this.#pressTimer);
			this.#pressAt = point;
			this.#pressTimer = window.setTimeout(() => {
				this.#pressTimer = 0;
				this.#pressAt = null;
				this.#hover = hit;
				this.invalidate();
			}, LONG_PRESS);
		}
		if (!hit) {
			// A finger on empty canvas pans; a mouse still marquee-selects.
			if (event.pointerType === 'touch') {
				const view = doc.sketch.view;
				doc.clearSelection();
				this.#drag = {
					kind: 'pan',
					startX: screen.x,
					startY: screen.y,
					panX: view.panX,
					panY: view.panY
				};
				this.invalidate();
				return;
			}
			if (!event.shiftKey) doc.clearSelection();
			this.#drag = {
				kind: 'marquee',
				start: point,
				current: point,
				base: event.shiftKey ? doc.selected.slice() : []
			};
			this.invalidate();
			return;
		}

		if (hit.kind === 'pin' || hit.kind === 'hole') {
			const from = this.#endpointOf(hit);
			if (from) {
				doc.clearSelection();
				this.#drag = { kind: 'connect', from, point: hit.point };
				this.invalidate();
			}
			return;
		}

		if (hit.kind === 'part' && sim.running && MOMENTARY_BUTTONS.includes(hit.part.type)) {
			doc.select('part', hit.part.id, false);
			this.#pressed = hit.part.id;
			sim.press(hit.part.id, true);
			this.invalidate();
			return;
		}

		if (hit.kind === 'part' && sim.running && LATCHING_SWITCHES.includes(hit.part.type)) {
			// Both latch on the press edge and ignore the release.
			doc.select('part', hit.part.id, false);
			sim.press(hit.part.id, true);
			sim.press(hit.part.id, false);
			this.invalidate();
			return;
		}

		if (hit.kind === 'part' && sim.running && this.#touchPanel(hit.part, point, true)) {
			doc.select('part', hit.part.id, false);
			this.#touching = hit.part.id;
			this.invalidate();
			return;
		}

		if (hit.kind === 'part' && sim.running && hit.part.type === 'litz-potentiometer') {
			doc.select('part', hit.part.id, false);
			this.#drag = { kind: 'control', partId: hit.part.id };
			this.#turnControl(hit.part, point);
			this.invalidate();
			return;
		}

		if (hit.kind === 'part' || hit.kind === 'board') {
			const id = hit.kind === 'part' ? hit.part.id : hit.board.id;
			if (event.shiftKey) {
				doc.select(hit.kind, id, true);
				this.invalidate();
				return;
			}
			if (!doc.isSelected(hit.kind, id)) doc.select(hit.kind, id, false);
			const origins: Origin[] = [
				...doc.selectedBoards().map((b) => ({ kind: 'board' as const, id: b.id, x: b.x, y: b.y })),
				...doc.selectedParts().map((p) => ({ kind: 'part' as const, id: p.id, x: p.x, y: p.y }))
			];
			doc.beginDrag();
			this.#drag = {
				kind: 'move',
				start: point,
				origins,
				single: origins.length === 1 && origins[0].kind === 'part' ? origins[0].id : null
			};
			this.invalidate();
			return;
		}

		if (hit.kind === 'wire') {
			doc.select('wire', hit.wire.id, false);
			doc.beginDrag();
			this.#drag = { kind: 'wire', wireId: hit.wire.id, index: 0 };
			this.invalidate();
		}
	};

	#onPointerMove = (event: PointerEvent): void => {
		if (event.pointerType === 'touch' && this.#touches.has(event.pointerId)) {
			this.#touches.set(event.pointerId, this.#canvasPoint(event));
		}
		if (this.#gesture) {
			this.#moveGesture();
			return;
		}
		const point = this.#pointerPos(event);
		canvasStatus.x = point.x;
		canvasStatus.y = point.y;

		if (this.#pressAt) {
			const drift = Math.hypot(point.x - this.#pressAt.x, point.y - this.#pressAt.y);
			// Finger jitter should not cancel the long press; a drag should.
			if (drift * doc.sketch.view.zoom > 10) {
				clearTimeout(this.#pressTimer);
				this.#pressTimer = 0;
				this.#pressAt = null;
			}
		}

		if (this.#drag?.kind === 'pan') {
			const view = doc.sketch.view;
			// Both the start and the current point are client coordinates.
			const dx = event.clientX - this.#drag.startX;
			const dy = event.clientY - this.#drag.startY;
			view.panX = this.#drag.panX + dx;
			view.panY = this.#drag.panY + dy;
			if (Math.hypot(dx, dy) > 3) this.#moved = true;
			this.invalidate();
			return;
		}

		if (this.#drag?.kind === 'connect') {
			this.#drag.point = point;
			this.#hover = this.#hitTest(point);
			this.#moved = true;
			this.invalidate();
			return;
		}

		if (this.#drag?.kind === 'move') {
			const drag = this.#drag;
			const raw = { x: point.x - drag.start.x, y: point.y - drag.start.y };
			if (drag.single) {
				const origin = drag.origins[0];
				const snapped = this.#snapPart(origin.id, { x: origin.x + raw.x, y: origin.y + raw.y });
				doc.movePart(origin.id, snapped.x, snapped.y);
			} else {
				const dx = doc.snap ? snapToGrid(raw.x) : raw.x;
				const dy = doc.snap ? snapToGrid(raw.y) : raw.y;
				for (const origin of drag.origins) {
					if (origin.kind === 'part') doc.movePart(origin.id, origin.x + dx, origin.y + dy);
					else doc.moveBoard(origin.id, origin.x + dx, origin.y + dy);
				}
			}
			this.#moved = true;
			this.invalidate();
			return;
		}

		if (this.#drag?.kind === 'wire') {
			const dragging = this.#drag;
			const target = doc.sketch.wires.find((w) => w.id === dragging.wireId);
			const from = target && doc.endpointPoint(target.from);
			const to = target && doc.endpointPoint(target.to);
			if (target && from && to) {
				doc.updateBend(target.id, dragging.index, bendFromPoint(from, to, point));
				this.#moved = true;
				this.invalidate();
			}
			return;
		}

		if (this.#drag?.kind === 'control') {
			const part = doc.part(this.#drag.partId);
			if (part) this.#turnControl(part, point);
			this.#moved = true;
			this.invalidate();
			return;
		}

		if (this.#touching) {
			const part = doc.part(this.#touching);
			if (part) this.#touchPanel(part, point, true);
			return;
		}

		if (this.#drag?.kind === 'marquee') {
			this.#drag.current = point;
			this.#moved = true;
			const rect = this.#marqueeRect(this.#drag);
			doc.setSelection(this.#marqueeSelection(rect, this.#drag.base));
			this.invalidate();
			return;
		}

		const hover = this.#hitTest(point);
		this.#hover = hover;
		this.#canvas.style.cursor = this.#cursorFor(hover);
		this.invalidate();
	};

	#cursorFor(hit: Hit | null): string {
		if (this.#space) return 'grab';
		if (this.#tool === 'wire') return 'crosshair';
		if (!hit) return 'default';
		if (hit.kind === 'pin' || hit.kind === 'hole') return 'crosshair';
		if (hit.kind === 'wire') return 'move';
		if (hit.kind === 'part' && sim.running) {
			if (hit.part.type === 'litz-potentiometer') return 'ew-resize';
			if (hit.part.type === 'litz-ssd1306') return 'pointer';
			if (MOMENTARY_BUTTONS.includes(hit.part.type) || LATCHING_SWITCHES.includes(hit.part.type)) {
				return 'pointer';
			}
		}
		return 'grab';
	}

	#onPointerUp = (event: PointerEvent): void => {
		if (this.#canvas.hasPointerCapture(event.pointerId)) {
			this.#canvas.releasePointerCapture(event.pointerId);
		}
		if (event.pointerType === 'touch') {
			clearTimeout(this.#pressTimer);
			this.#pressTimer = 0;
			this.#pressAt = null;
			// Touch has no hover, so the name goes away with the finger.
			if (this.#hover) {
				this.#hover = null;
				this.invalidate();
			}
			this.#touches.delete(event.pointerId);
			if (this.#gesture) {
				if (this.#touches.size < 2) this.#gesture = null;
				this.#drag = null;
				this.invalidate();
				return;
			}
		}
		if (this.#pressed) {
			sim.press(this.#pressed, false);
			this.#pressed = null;
		}
		if (this.#touching) {
			sim.touch(0, 0, false);
			this.#touching = null;
		}
		const drag = this.#drag;
		this.#drag = null;

		if (drag?.kind === 'connect') {
			const point = this.#pointerPos(event);
			const hit = this.#hitTest(point);
			const to = hit ? this.#endpointOf(hit) : null;
			if (to && JSON.stringify(to) !== JSON.stringify(drag.from)) doc.addWire(drag.from, to);
			this.invalidate();
			return;
		}

		if (drag?.kind === 'control') {
			const part = doc.part(drag.partId);
			if (part) {
				// Keep the wiper where it was left so a restart starts from it.
				const permille = this.#turnControl(part, this.#pointerPos(event));
				doc.setAttr(part.id, 'value', String(Math.round(permille / 10)));
			}
			this.invalidate();
			return;
		}

		if (drag?.kind === 'pan' && event.pointerType === 'touch' && !this.#moved) {
			doc.clearSelection();
			this.invalidate();
			return;
		}

		if (drag?.kind === 'move' || drag?.kind === 'wire') {
			doc.endDrag();
			if (!this.#moved) doc.bump();
			this.invalidate();
			return;
		}

		this.invalidate();
	};

	#snapPart(partId: string, raw: Point): Point {
		const part = doc.part(partId);
		if (!part) return doc.snap ? { x: snapToGrid(raw.x), y: snapToGrid(raw.y) } : raw;
		return this.#snapCandidate(part.type, part.rotate, raw);
	}

	/** Grid-snap a candidate position, then nudge it so a pin lands in a nearby hole. */
	#snapCandidate(type: string, rotate: number, raw: Point): Point {
		const x = doc.snap ? snapToGrid(raw.x) : raw.x;
		const y = doc.snap ? snapToGrid(raw.y) : raw.y;
		if (!doc.snap) return { x, y };
		const def = partDef(type);
		const rad = (rotate * Math.PI) / 180;
		for (const pin of def.pins) {
			const px = x + pin.x * Math.cos(rad) - pin.y * Math.sin(rad);
			const py = y + pin.x * Math.sin(rad) + pin.y * Math.cos(rad);
			for (const board of doc.sketch.boards) {
				const hole = nearestHole(board, { x: px, y: py }, 11);
				if (hole) return { x: x + hole.point.x - px, y: y + hole.point.y - py };
			}
		}
		return { x, y };
	}

	/** Drop from the parts bin: the pointer leaves the part centred on the cursor. */
	dropPart(type: string, sx: number, sy: number): void {
		const point = this.#snapCandidate(type, 0, this.screenToWorld(sx, sy));
		doc.addPart(type, point.x, point.y, { snap: false });
	}

	dropBoard(type: 'breadboard-full' | 'breadboard-half', sx: number, sy: number): void {
		const point = this.screenToWorld(sx, sy);
		doc.addBoard(
			type,
			doc.snap ? snapToGrid(point.x) : point.x,
			doc.snap ? snapToGrid(point.y) : point.y
		);
	}

	#onWheel = (event: WheelEvent): void => {
		event.preventDefault();
		const rect = this.#canvas.getBoundingClientRect();
		const factor = Math.exp(-event.deltaY * 0.0015);
		this.zoomBy(factor, event.clientX - rect.left, event.clientY - rect.top);
	};

	#onKeyDown = (event: KeyboardEvent): void => {
		const target = event.target as HTMLElement | null;
		if (
			target &&
			(target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
		)
			return;

		if (event.key === ' ') {
			this.#space = true;
			this.#canvas.style.cursor = 'grab';
			return;
		}

		const mod = event.metaKey || event.ctrlKey;
		const key = event.key.toLowerCase();

		if (mod && key === 'z') {
			if (event.shiftKey) doc.redo();
			else doc.undo();
			event.preventDefault();
			return;
		}
		if (mod && key === 'a') {
			doc.setSelection([
				...doc.sketch.parts.map((part) => ({ kind: 'part' as const, id: part.id })),
				...doc.sketch.boards.map((board) => ({ kind: 'board' as const, id: board.id }))
			]);
			event.preventDefault();
			return;
		}
		if (mod && key === 'c') {
			doc.copySelection();
			return;
		}
		if (mod && key === 'v') {
			doc.pasteClipboard();
			return;
		}
		if (mod && key === 'd') {
			doc.duplicateSelection();
			event.preventDefault();
			return;
		}
		if (mod) return;

		if (event.key === 'Delete' || event.key === 'Backspace') {
			doc.deleteSelection();
			event.preventDefault();
		} else if (key === 'r') {
			doc.rotateSelection();
			event.preventDefault();
		} else if (event.key === 'Escape') {
			doc.clearSelection();
			this.#drag = null;
			this.invalidate();
		} else if (event.key.startsWith('Arrow')) {
			const step = event.shiftKey ? GRID * 5 : GRID;
			const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
			const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
			doc.nudgeSelection(dx, dy);
			event.preventDefault();
		}
	};

	#onKeyUp = (event: KeyboardEvent): void => {
		if (event.key === ' ') {
			this.#space = false;
			this.#canvas.style.cursor = 'default';
		}
	};

	wireColors(): readonly { name: string; value: string }[] {
		return WIRE_COLORS;
	}

	toDataURL(): string {
		return this.#canvas.toDataURL('image/png');
	}
}

export type { Sketch };
