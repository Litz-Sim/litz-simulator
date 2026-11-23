import { m } from '#lib/paraglide/messages.js';
import { boardDef } from '#lib/parts/breadboard';
import { partDef } from '#lib/parts/registry';
import { snapToGrid } from './geometry';
import {
	DEFAULT_WIRE_COLOR,
	GRID,
	type BoardInstance,
	type BoardType,
	type Endpoint,
	type PartInstance,
	type Rotation,
	type Selection,
	type Sketch,
	type WireStyle
} from './types';
import { DEFAULT_CODE } from './template';
import { defaultBend } from './wire';

const WORKSPACE_KEY = 'litz-board.workspace.v1';
const LEGACY_KEY = 'litz-board.sketch.v1';

export interface Tab {
	id: string;
	name: string;
	sketch: Sketch;
	/** Firmware kept beside the diagram, the way Wokwi keeps code beside its canvas. */
	code: string;
}

export function blankSketch(name: string = m.untitled()): Sketch {
	return {
		format: 'litz-board',
		version: 1,
		grid: GRID,
		name,
		boards: [{ id: 'bb1', type: 'breadboard-full', x: 0, y: 0, rotate: 0 }],
		parts: [],
		wires: [],
		view: { panX: 0, panY: 0, zoom: 1 }
	};
}

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

/** Documents saved before orthogonal routing carried `style: "curve"`. */
function orthoWires(sketch: Sketch): Sketch {
	return {
		...sketch,
		wires: (sketch.wires ?? []).map((wire) => ({ ...wire, style: 'ortho' as const }))
	};
}

class DocumentStore {
	tabs = $state<Tab[]>([]);
	activeTab = $state(0);
	selected = $state<Selection[]>([]);
	/** Bumped on every visual change, so the canvas knows to redraw. */
	rev = $state(0);
	canUndo = $state(false);
	canRedo = $state(false);
	/** Colour the next wire is drawn in. */
	wireColor = $state(DEFAULT_WIRE_COLOR);
	/** Wires are always routed orthogonally; kept on the wire for file compatibility. */
	wireStyle: WireStyle = 'ortho';
	/** Whether dragging snaps to the 20-unit grid. */
	snap = $state(true);
	/** Autosave status, shown in the status bar. */
	saveState = $state<'saved' | 'pending' | 'error'>('saved');
	/** Why the last project import failed, or null. */
	projectError = $state<string | null>(null);
	/** Why the last localStorage write failed, or null. */
	saveError = $state<string | null>(null);

	#undo: Sketch[] = [];
	#redo: Sketch[] = [];
	#dragBefore: Sketch | null = null;
	#seq = 1;

	constructor() {
		const name = m.untitled_n({ n: 1 });
		this.tabs = [{ id: 't1', name, sketch: blankSketch(name), code: DEFAULT_CODE }];
	}

	get code(): string {
		return this.tabs[this.activeTab].code;
	}

	set code(next: string) {
		this.tabs[this.activeTab].code = next;
	}

	get sketch(): Sketch {
		return this.tabs[this.activeTab].sketch;
	}

	set sketch(next: Sketch) {
		this.tabs[this.activeTab].sketch = next;
	}

	get name(): string {
		return this.tabs[this.activeTab]?.name ?? m.untitled();
	}

	#snapshot(): Sketch {
		return clone(this.sketch);
	}

	bump(): void {
		this.rev += 1;
		this.saveState = 'pending';
		this.projectError = null;
	}

	#push(before: Sketch): void {
		this.#undo.push(before);
		if (this.#undo.length > 120) this.#undo.shift();
		this.#redo = [];
		this.canUndo = true;
		this.canRedo = false;
	}

	/** Run a discrete edit and make it undoable in one step. */
	mutate(fn: () => void): void {
		const before = this.#snapshot();
		fn();
		this.#push(before);
		this.bump();
	}

	/** Start a drag: remember the document as it was before the pointer moved. */
	beginDrag(): void {
		this.#dragBefore = this.#snapshot();
	}

	/** Abandon a drag and put the document back where it was. */
	cancelDrag(): void {
		if (!this.#dragBefore) return;
		this.sketch = this.#dragBefore;
		this.#dragBefore = null;
		this.bump();
	}

	endDrag(): void {
		if (!this.#dragBefore) return;
		const before = this.#dragBefore;
		this.#dragBefore = null;
		if (JSON.stringify(before) === JSON.stringify(this.#snapshot())) return;
		this.#push(before);
	}

	undo(): void {
		const previous = this.#undo.pop();
		if (!previous) return;
		this.#redo.push(this.#snapshot());
		this.sketch = previous;
		this.selected = [];
		this.canUndo = this.#undo.length > 0;
		this.canRedo = true;
		this.bump();
	}

	redo(): void {
		const next = this.#redo.pop();
		if (!next) return;
		this.#undo.push(this.#snapshot());
		this.sketch = next;
		this.canUndo = true;
		this.canRedo = this.#redo.length > 0;
		this.bump();
	}

	// ------------------------------------------------------------------ tabs

	#tabId(): string {
		this.#seq += 1;
		return `t${this.#seq}`;
	}

	newTab(): void {
		const n = this.tabs.length + 1;
		const name = m.untitled_n({ n });
		this.openSketch(name, blankSketch(name));
	}

	/** Open a prepared document in a fresh tab. */
	openSketch(name: string, sketch: Sketch, code = DEFAULT_CODE): void {
		this.tabs.push({ id: this.#tabId(), name, sketch, code });
		this.activeTab = this.tabs.length - 1;
		this.selected = [];
		this.#undo = [];
		this.#redo = [];
		this.canUndo = false;
		this.canRedo = false;
		this.bump();
	}

	switchTab(index: number): void {
		if (index === this.activeTab || index < 0 || index >= this.tabs.length) return;
		this.activeTab = index;
		this.selected = [];
		this.#undo = [];
		this.#redo = [];
		this.canUndo = false;
		this.canRedo = false;
		this.bump();
	}

	closeTab(index: number): void {
		if (this.tabs.length === 1) {
			this.reset();
			return;
		}
		this.tabs.splice(index, 1);
		if (this.activeTab >= this.tabs.length) this.activeTab = this.tabs.length - 1;
		this.selected = [];
		this.#undo = [];
		this.#redo = [];
		this.canUndo = false;
		this.canRedo = false;
		this.bump();
	}

	renameTab(name: string): void {
		const trimmed = name.trim();
		if (!trimmed) return;
		this.tabs[this.activeTab].name = trimmed;
		this.sketch.name = trimmed;
		this.bump();
	}

	// ------------------------------------------------------------- selection

	isSelected(kind: Selection['kind'], id: string): boolean {
		return this.selected.some((item) => item.kind === kind && item.id === id);
	}

	select(kind: Selection['kind'], id: string, additive = false): void {
		if (additive) {
			if (this.isSelected(kind, id)) {
				this.selected = this.selected.filter((item) => !(item.kind === kind && item.id === id));
			} else {
				this.selected = [...this.selected, { kind, id }];
			}
		} else {
			this.selected = [{ kind, id }];
		}
		this.bump();
	}

	setSelection(items: Selection[]): void {
		this.selected = items;
		this.bump();
	}

	clearSelection(): void {
		if (!this.selected.length) return;
		this.selected = [];
		this.bump();
	}

	selectedOf(kind: Selection['kind']): string[] {
		return this.selected.filter((item) => item.kind === kind).map((item) => item.id);
	}

	selectedParts(): PartInstance[] {
		const ids = new Set(this.selectedOf('part'));
		return this.sketch.parts.filter((part) => ids.has(part.id));
	}

	selectedBoards(): BoardInstance[] {
		const ids = new Set(this.selectedOf('board'));
		return this.sketch.boards.filter((board) => ids.has(board.id));
	}

	selectedWires() {
		const ids = new Set(this.selectedOf('wire'));
		return this.sketch.wires.filter((wire) => ids.has(wire.id));
	}

	// ----------------------------------------------------------------- parts

	#freeId(prefix: string): string {
		const used = new Set([
			...this.sketch.parts.map((p) => p.id),
			...this.sketch.wires.map((w) => w.id)
		]);
		let n = 1;
		while (used.has(`${prefix}${n}`)) n++;
		return `${prefix}${n}`;
	}

	addPart(type: string, x: number, y: number, options: { snap?: boolean } = {}): PartInstance {
		const def = partDef(type);
		const attrs: Record<string, string | number | boolean> = {};
		for (const attr of def.attrs) attrs[attr.name] = attr.default;
		const snap = options.snap ?? true;
		const part: PartInstance = {
			id: this.#freeId('p'),
			type,
			x: snap ? snapToGrid(x) : x,
			y: snap ? snapToGrid(y) : y,
			rotate: 0,
			attrs
		};
		this.mutate(() => this.sketch.parts.push(part));
		this.selected = [{ kind: 'part', id: part.id }];
		return part;
	}

	addBoard(type: BoardType, x: number, y: number): BoardInstance {
		const board: BoardInstance = {
			id: this.#freeId('bb'),
			type,
			x: snapToGrid(x),
			y: snapToGrid(y),
			rotate: 0
		};
		this.mutate(() => this.sketch.boards.push(board));
		this.selected = [{ kind: 'board', id: board.id }];
		return board;
	}

	part(id: string): PartInstance | undefined {
		return this.sketch.parts.find((p) => p.id === id);
	}

	board(id: string): BoardInstance | undefined {
		return this.sketch.boards.find((b) => b.id === id);
	}

	movePart(id: string, x: number, y: number): void {
		const part = this.part(id);
		if (!part) return;
		part.x = x;
		part.y = y;
		this.bump();
	}

	moveBoard(id: string, x: number, y: number): void {
		const board = this.board(id);
		if (!board) return;
		board.x = x;
		board.y = y;
		this.bump();
	}

	setPosition(id: string, x: number, y: number): void {
		if (this.part(id)) this.movePart(id, x, y);
		else if (this.board(id)) this.moveBoard(id, x, y);
	}

	rotateSelection(): void {
		const parts = new Set(this.selectedOf('part'));
		const boards = new Set(this.selectedOf('board'));
		if (!parts.size && !boards.size) return;
		this.mutate(() => {
			for (const part of this.sketch.parts) {
				if (parts.has(part.id)) part.rotate = ((part.rotate + 90) % 360) as Rotation;
			}
			for (const board of this.sketch.boards) {
				if (boards.has(board.id)) board.rotate = ((board.rotate + 90) % 360) as Rotation;
			}
		});
	}

	rotate(id: string): void {
		const part = this.part(id);
		const board = this.board(id);
		const target = part ?? board;
		if (!target) return;
		this.mutate(() => {
			target.rotate = ((target.rotate + 90) % 360) as Rotation;
		});
	}

	setAttr(partId: string, name: string, value: string | number | boolean): void {
		const part = this.part(partId);
		if (!part) return;
		this.mutate(() => {
			part.attrs[name] = value;
		});
	}

	setWireColor(wireId: string, color: string): void {
		const wire = this.sketch.wires.find((w) => w.id === wireId);
		if (!wire) return;
		this.mutate(() => {
			wire.color = color;
		});
	}

	// ----------------------------------------------------------------- wires

	addWire(from: Endpoint, to: Endpoint, color = this.wireColor): void {
		if (JSON.stringify(from) === JSON.stringify(to)) return;
		const existing = this.sketch.wires.some(
			(wire) =>
				(JSON.stringify(wire.from) === JSON.stringify(from) &&
					JSON.stringify(wire.to) === JSON.stringify(to)) ||
				(JSON.stringify(wire.from) === JSON.stringify(to) &&
					JSON.stringify(wire.to) === JSON.stringify(from))
		);
		if (existing) return;
		const fromPoint = this.endpointPoint(from);
		const toPoint = this.endpointPoint(to);
		const bend = fromPoint && toPoint ? defaultBend() : [];
		const wire = { id: this.#freeId('w'), from, to, color, bend, style: this.wireStyle };
		this.mutate(() => this.sketch.wires.push(wire));
		this.selected = [{ kind: 'wire', id: wire.id }];
	}

	#clipboard: { parts: PartInstance[]; boards: BoardInstance[] } | null = null;

	copySelection(): void {
		this.#clipboard = { parts: clone(this.selectedParts()), boards: clone(this.selectedBoards()) };
	}

	duplicateSelection(): void {
		const before = this.#clipboard;
		this.copySelection();
		this.pasteClipboard();
		this.#clipboard = before;
	}

	pasteClipboard(): void {
		if (!this.#clipboard) return;
		const source = this.#clipboard;
		const created: Selection[] = [];
		this.mutate(() => {
			for (const part of source.parts) {
				const id = this.#freeId('p');
				this.sketch.parts.push({ ...clone(part), id, x: part.x + GRID * 2, y: part.y + GRID * 2 });
				created.push({ kind: 'part', id });
			}
			for (const board of source.boards) {
				const id = this.#freeId('bb');
				this.sketch.boards.push({
					...clone(board),
					id,
					x: board.x + GRID * 2,
					y: board.y + GRID * 2
				});
				created.push({ kind: 'board', id });
			}
		});
		if (created.length) this.selected = created;
	}

	nudgeSelection(dx: number, dy: number): void {
		const parts = new Set(this.selectedOf('part'));
		const boards = new Set(this.selectedOf('board'));
		if (!parts.size && !boards.size) return;
		this.mutate(() => {
			for (const part of this.sketch.parts) {
				if (!parts.has(part.id)) continue;
				part.x += dx;
				part.y += dy;
			}
			for (const board of this.sketch.boards) {
				if (!boards.has(board.id)) continue;
				board.x += dx;
				board.y += dy;
			}
		});
	}

	updateBend(wireId: string, index: number, bend: { u: number; v: number }): void {
		const wire = this.sketch.wires.find((w) => w.id === wireId);
		if (!wire || !wire.bend[index]) return;
		wire.bend[index] = bend;
		this.bump();
	}

	deleteSelection(): void {
		if (!this.selected.length) return;
		const parts = new Set(this.selectedOf('part'));
		const boards = new Set(this.selectedOf('board'));
		const wires = new Set(this.selectedOf('wire'));
		this.mutate(() => {
			this.sketch.wires = this.sketch.wires.filter(
				(wire) =>
					!wires.has(wire.id) &&
					!this.#touchesAny(wire.from, parts, boards) &&
					!this.#touchesAny(wire.to, parts, boards)
			);
			this.sketch.parts = this.sketch.parts.filter((part) => !parts.has(part.id));
			this.sketch.boards = this.sketch.boards.filter((board) => !boards.has(board.id));
		});
		this.selected = [];
	}

	#touchesAny(endpoint: Endpoint, parts: Set<string>, boards: Set<string>): boolean {
		if (endpoint.kind === 'pin') return parts.has(endpoint.part);
		if (endpoint.kind === 'hole') return boards.has(endpoint.board);
		return false;
	}

	/** Kept for keyboard delete on a single item. */
	deleteSelected(): void {
		this.deleteSelection();
	}

	/** Live lookup used while a wire is being dragged. */
	endpointPoint(endpoint: Endpoint): { x: number; y: number } | null {
		if (endpoint.kind === 'free') return { x: endpoint.x, y: endpoint.y };
		if (endpoint.kind === 'pin') {
			const part = this.part(endpoint.part);
			if (!part) return null;
			const def = partDef(part.type);
			const pin = def.pins.find((p) => p.name === endpoint.pin);
			if (!pin) return null;
			const rad = (part.rotate * Math.PI) / 180;
			const cos = Math.cos(rad);
			const sin = Math.sin(rad);
			return { x: part.x + pin.x * cos - pin.y * sin, y: part.y + pin.x * sin + pin.y * cos };
		}
		const board = this.board(endpoint.board);
		if (!board) return null;
		const rad = (board.rotate * Math.PI) / 180;
		const cos = Math.cos(rad);
		const sin = Math.sin(rad);
		const lx = endpoint.col * GRID;
		const ly = endpoint.row * GRID;
		return { x: board.x + lx * cos - ly * sin, y: board.y + lx * sin + ly * cos };
	}

	// ------------------------------------------------------------ persistence

	/** The whole workspace as a project file: every tab, its code and its view. */
	projectJSON(): string {
		return JSON.stringify(
			{
				format: 'litz-project',
				version: 1,
				name: this.name,
				active: this.activeTab,
				tabs: clone(this.tabs)
			},
			null,
			2
		);
	}

	/** Replace the workspace with a project file. */
	loadProject(text: string): boolean {
		try {
			const parsed = JSON.parse(text) as {
				format?: string;
				tabs?: Partial<Tab>[];
				active?: number;
			};
			if (parsed.format !== 'litz-project' || !Array.isArray(parsed.tabs)) return false;
			const tabs: Tab[] = [];
			for (const [index, raw] of parsed.tabs.entries()) {
				const sketch = raw?.sketch as Partial<Sketch> | undefined;
				if (
					!sketch ||
					sketch.format !== 'litz-board' ||
					!Array.isArray(sketch.parts) ||
					!Array.isArray(sketch.boards)
				) {
					return false;
				}
				const name =
					typeof raw.name === 'string' && raw.name.trim()
						? raw.name
						: m.untitled_n({ n: index + 1 });
				const id = typeof raw.id === 'string' && raw.id ? raw.id : `t${index + 1}`;
				tabs.push({
					id: tabs.some((tab) => tab.id === id) ? `t${tabs.length + 1}` : id,
					name,
					code: typeof raw.code === 'string' ? raw.code : DEFAULT_CODE,
					sketch: {
						format: 'litz-board',
						version: 1,
						grid: GRID,
						name,
						boards: sketch.boards,
						parts: sketch.parts,
						wires: Array.isArray(sketch.wires)
							? sketch.wires.map((wire) => ({ ...wire, style: 'ortho' as const }))
							: [],
						view: sketch.view ?? { panX: 0, panY: 0, zoom: 1 }
					}
				});
			}
			if (tabs.length === 0) return false;
			this.tabs = tabs;
			this.activeTab = Math.min(Math.max(parsed.active ?? 0, 0), tabs.length - 1);
			this.#seq = Math.max(this.#seq, tabs.length);
			this.selected = [];
			this.#undo = [];
			this.#redo = [];
			this.canUndo = false;
			this.canRedo = false;
			this.projectError = null;
			this.bump();
			return true;
		} catch {
			return false;
		}
	}

	toJSON(): string {
		const plain: Record<string, unknown> = { ...clone(this.sketch) };
		delete plain.view;
		return JSON.stringify(plain, null, 2);
	}

	loadFromJSON(text: string): boolean {
		try {
			const parsed = JSON.parse(text) as Partial<Sketch>;
			if (
				parsed.format !== 'litz-board' ||
				!Array.isArray(parsed.parts) ||
				!Array.isArray(parsed.boards)
			) {
				return false;
			}
			const next: Sketch = {
				format: 'litz-board',
				version: 1,
				grid: GRID,
				name: parsed.name ?? this.name,
				boards: parsed.boards,
				parts: parsed.parts,
				wires: Array.isArray(parsed.wires)
					? parsed.wires.map((wire) => ({ ...wire, style: 'ortho' as const }))
					: [],
				view: parsed.view ?? this.sketch.view
			};
			this.sketch = next;
			this.selected = [];
			this.#undo = [];
			this.#redo = [];
			this.canUndo = false;
			this.canRedo = false;
			this.bump();
			return true;
		} catch {
			return false;
		}
	}

	/** Returns true when a saved workspace was restored. */
	loadSaved(): boolean {
		if (typeof localStorage === 'undefined') return false;
		try {
			const saved = localStorage.getItem(WORKSPACE_KEY);
			if (saved) {
				const parsed = JSON.parse(saved) as { tabs?: Tab[]; active?: number };
				if (Array.isArray(parsed.tabs) && parsed.tabs.length) {
					this.tabs = parsed.tabs.map((tab) => ({
						...tab,
						code: tab.code ?? DEFAULT_CODE,
						sketch: orthoWires(tab.sketch)
					}));
					this.activeTab = Math.min(parsed.active ?? 0, this.tabs.length - 1);
					this.selected = [];
					this.bump();
					return true;
				}
			}
			const legacy = localStorage.getItem(LEGACY_KEY);
			if (legacy) return this.loadFromJSON(legacy);
		} catch {
			// A corrupt save should not stop the editor from opening.
		}
		return false;
	}

	save(): boolean {
		if (typeof localStorage === 'undefined') {
			this.saveState = 'error';
			this.saveError = m.save_project_failed();
			return false;
		}
		try {
			localStorage.setItem(
				WORKSPACE_KEY,
				JSON.stringify({ tabs: this.tabs, active: this.activeTab })
			);
			this.saveState = 'saved';
			this.saveError = null;
			return true;
		} catch {
			// A full quota should not take the editor down, but it must be visible.
			this.saveState = 'error';
			this.saveError = m.save_project_failed();
			return false;
		}
	}

	reset(): void {
		const name = this.name;
		this.sketch = blankSketch(name);
		this.selected = [];
		this.#undo = [];
		this.#redo = [];
		this.canUndo = false;
		this.canRedo = false;
		this.bump();
	}

	/** Breadboards in the document, with their definitions, for the canvas. */
	breadboards(): { instance: BoardInstance; def: ReturnType<typeof boardDef> }[] {
		return this.sketch.boards.map((instance) => ({ instance, def: boardDef(instance.type) }));
	}
}

export const doc = new DocumentStore();
