/**
 * The document the editor owns.
 *
 * This is deliberately not Litz's `diagram.json`: that file has no room for
 * routing geometry. Here every wire keeps its shape, every part keeps its
 * position, and the breadboard keeps its holes. `diagram.json` is derived
 * from this on export.
 *
 * World units: 20 units = one 0.1" breadboard pitch (2.54 mm). Everything a
 * part or a wire stores is a multiple of that, so routing never has to carry
 * around pixels.
 */

export const GRID = 20;

export type Rotation = 0 | 90 | 180 | 270;

export type BoardType = 'breadboard-full' | 'breadboard-half';

/** A breadboard (or other board) placed on the canvas. */
export interface BoardInstance {
	id: string;
	type: BoardType;
	/** World position of hole (0, 0). */
	x: number;
	y: number;
	rotate: Rotation;
}

/** A component placed on the canvas. */
export interface PartInstance {
	id: string;
	/** Catalog id, e.g. `litz-led`. */
	type: string;
	/** World position of the part's anchor (its local origin). */
	x: number;
	y: number;
	rotate: Rotation;
	attrs: Record<string, string | number | boolean>;
}

/** Where a wire ends. */
export type Endpoint =
	| { kind: 'pin'; part: string; pin: string }
	| { kind: 'hole'; board: string; col: number; row: number }
	| { kind: 'free'; x: number; y: number };

/**
 * One bend of a wire, in chord coordinates. `u` runs from the `from` end
 * (0) to the `to` end (1); `v` is the offset perpendicular to the chord, in
 * world units, positive to the right of the direction of travel.
 */
export interface Bend {
	u: number;
	v: number;
}

/** Wires are routed horizontally and vertically, like a schematic. */
export type WireStyle = 'ortho';

export interface WireInstance {
	id: string;
	from: Endpoint;
	to: Endpoint;
	color: string;
	bend: Bend[];
	/** How the wire is drawn. Curves are the breadboard look; ortho matches Litz's routing. */
	style?: WireStyle;
}

export type SelectKind = 'part' | 'board' | 'wire';

export interface Selection {
	kind: SelectKind;
	id: string;
}

export interface View {
	/** Screen position of world origin, in CSS pixels. */
	panX: number;
	panY: number;
	zoom: number;
}

/** What a development board runs in the simulation. */
export type RuntimeMode = 'native' | 'micropython' | 'circuitpython';

/** An image uploaded by the user; `key` indexes the browser's firmware cache. */
export interface FirmwareRef {
	name: string;
	key: string;
}

/** One text file in a board's Python storage. */
export interface ProgramFile {
	name: string;
	text: string;
}

/** Per-board program: runtime, uploaded images, and files on the board. */
export interface BoardProgram {
	runtime: RuntimeMode;
	/** `null` uses the image bundled for this chip and runtime. */
	firmware: FirmwareRef | null;
	/** Optional image parts; bundled Python images carry their own ROM. */
	rom: FirmwareRef | null;
	boot: FirmwareRef | null;
	ptable: FirmwareRef | null;
	files: ProgramFile[];
}

export interface Sketch {
	format: 'litz-board';
	version: 1;
	grid: number;
	name: string;
	boards: BoardInstance[];
	parts: PartInstance[];
	wires: WireInstance[];
	view: View;
	/** Keyed by development-board part id. */
	programs?: Record<string, BoardProgram>;
}

export interface Point {
	x: number;
	y: number;
}

export interface Box {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

/** Fritzing's wire palette, in the order the wire picker shows it. */
export const WIRE_COLORS = [
	{ name: 'red', value: '#c8352c' },
	{ name: 'orange', value: '#e07b1f' },
	{ name: 'yellow', value: '#e8c31c' },
	{ name: 'green', value: '#2f8f4e' },
	{ name: 'blue', value: '#2f6fd0' },
	{ name: 'purple', value: '#7b3fa0' },
	{ name: 'grey', value: '#7d858c' },
	{ name: 'black', value: '#2f3235' },
	{ name: 'white', value: '#f3f1ea' }
] as const;

export const DEFAULT_WIRE_COLOR = '#c8352c';
