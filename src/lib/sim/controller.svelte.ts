import { canvasControl } from '#lib/canvas/control';
import { m } from '#lib/paraglide/messages.js';
import { partDef } from '#lib/parts/registry';
import { doc } from '#lib/sketch/doc.svelte';
import { toLitzDiagram } from '#lib/sketch/export';
import { ui } from '#lib/ui.svelte';
import type {
	BoardRuntimeInfo,
	ChipInfo,
	DebugStop,
	Level,
	RegisterSnapshot,
	ScopeSnapshot,
	StopWord
} from './backend';
import {
	bundledFirmware,
	cacheFirmware,
	loadBundled,
	loadBundledRom,
	readFirmware
} from './firmware';
import { LitzBackend } from './litzBackend';
import { clearLiveStates, setLiveDisplay, setLiveStates } from './live';
import { afterStaging, findEntry, rawPaste, storageBootstrap } from './python';
import type { RuntimeMode } from '#lib/sketch/types';

const MANIFEST_KEY = 'litz.manifests';

function readManifests(): ManifestEntry[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(MANIFEST_KEY);
		const parsed: unknown = raw ? JSON.parse(raw) : [];
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(entry): entry is ManifestEntry =>
				typeof entry === 'object' &&
				entry !== null &&
				typeof (entry as ManifestEntry).name === 'string' &&
				typeof (entry as ManifestEntry).text === 'string'
		);
	} catch {
		return [];
	}
}

function errorText(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

interface LogEntry {
	at: number;
	text: string;
}

interface PythonPlan {
	runtime: Exclude<RuntimeMode, 'native'>;
	entry: string;
	payload: string[];
	phase: 'wait' | 'paste' | 'done' | 'error';
	offset: number;
	startedMs: number;
	lastNudge: number;
	lastSend: number;
	console: string;
	/** Hide raw-REPL traffic until the interpreter has rebooted. */
	quiet: boolean;
	quietText: string;
	quietUntil: number;
}

export interface ProbeEntry {
	name: string;
	point: string;
}

export interface ManifestEntry {
	name: string;
	text: string;
}

export interface BoardInfo {
	id: string;
	name: string;
	chip: string | null;
	pins: { name: string; gpio: number }[];
}

class SimController {
	running = $state(false);
	/** Loaded but not advancing; the analysis view still reads the last state. */
	paused = $state(false);
	loading = $state(false);
	/** Simulated milliseconds since the session booted. */
	ms = $state(0);
	chip = $state<string | null>(null);
	chipInfo = $state<ChipInfo | null>(null);
	heap = $state<number | null>(null);
	stopWord = $state<StopWord>('idle');
	fault = $state<string | null>(null);
	conflicts = $state<string[]>([]);
	/** Header-pin levels, keyed by board id and then pin name. */
	levels = $state<Record<string, Record<string, Level | null>>>({});
	/** Increments on each refresh so views can read the live maps. */
	revision = $state(0);
	error = $state<string | null>(null);
	/** A probe or decoder that the circuit refused. */
	actionError = $state<string | null>(null);
	/** Everything the firmware printed, oldest first. */
	serial = $state('');
	/** Each board's console, keyed by board id. */
	serialBoards = $state<Record<string, string>>({});
	entries = $state<LogEntry[]>([]);
	probes = $state<ProbeEntry[]>([]);
	decoders = $state<string[]>([]);
	waves = $state<ScopeSnapshot | null>(null);
	/** File name of the image in the slot; the bundled one until replaced. */
	firmwareName = $state('blinky.bin');
	analog = $state(false);
	/** 0 means "as fast as the frame allows"; otherwise a wall-clock multiplier. */
	speed = $state(1);
	manifests = $state<ManifestEntry[]>(readManifests());
	/** Boards the running session booted, in diagram order. */
	boardRuntime = $state<BoardRuntimeInfo[]>([]);
	/** Index into `boardRuntime` that the debug panel drives. */
	debugBoard = $state(0);
	debugPc = $state<number | null>(null);
	registers = $state<RegisterSnapshot | null>(null);
	disassembly = $state<string>('');
	debugStop = $state<DebugStop | null>(null);
	/** Breakpoints per board id, as instruction addresses. */
	breakpoints = $state<Record<string, number[]>>({});

	#backend = new LitzBackend();
	/** Python boards whose stored files still have to be seeded after boot. */
	#pythonPlans = new Map<string, PythonPlan>();
	#frame = 0;
	#last = 0;
	#lastDiag = 0;
	#lastScope = 0;
	#lastDebug = 0;
	/** Names already registered with the live session, so a hidden probe can return. */
	#boundProbes = new Map<string, string>();
	#boundDecoders = new Map<string, true>();
	/** Hidden probes that feed the per-board pin-level grid. */
	#boardProbes = new Map<string, { boardId: string; pin: string }>();
	/** Incomplete console line per board, so prefixes land on line starts. */
	#boardSerial = new Map<string, string>();
	/** Bumped by every stop, so a load that finishes late cannot start a session. */
	#generation = 0;

	get status(): string {
		if (this.loading) return m.sim_loading();
		if (this.error) return m.sim_error();
		if (this.running) {
			const seconds = (this.ms / 1000).toFixed(2);
			return this.paused ? m.sim_paused({ seconds }) : m.sim_running({ seconds });
		}
		return m.sim_idle();
	}

	/** GPIO numbers the boards in the document expose, sorted. */
	get gpioPins(): number[] {
		const pins: number[] = [];
		for (const part of doc.sketch.parts) {
			if (!part.type.startsWith('board-')) continue;
			for (const pin of partDef(part.type).pins) {
				const match = /^GPIO(\d+)$/.exec(pin.name);
				if (!match) continue;
				const number = Number(match[1]);
				if (!pins.includes(number)) pins.push(number);
			}
		}
		return pins.sort((a, b) => a - b);
	}

	/** The id of the first development board; probe points start with it. */
	get boardId(): string {
		return doc.sketch.parts.find((part) => part.type.startsWith('board-'))?.id ?? 'board';
	}

	/** Every board in the document, with the header pins that reach a GPIO. */
	get boards(): BoardInfo[] {
		const out: BoardInfo[] = [];
		for (const part of doc.sketch.parts) {
			if (!part.type.startsWith('board-')) continue;
			const def = partDef(part.type);
			const pins: BoardInfo['pins'] = [];
			for (const pin of def.pins) {
				if (pin.gpio !== undefined) pins.push({ name: pin.name, gpio: pin.gpio });
			}
			out.push({ id: part.id, name: def.name, chip: def.chip ?? null, pins });
		}
		return out;
	}

	/** The image the selected board would boot now. */
	get slotName(): string {
		const boardId = doc.selectedBoardId;
		if (!boardId) return '—';
		const program = doc.programFor(boardId);
		if (program.firmware) return program.firmware.name;
		const board = this.boards.find((entry) => entry.id === boardId);
		return bundledFirmware(board?.chip ?? null, program.runtime)?.name ?? '—';
	}

	/** Chips of every booted board, with a count when they repeat. */
	get chipSummary(): string | null {
		const boards = this.boardRuntime;
		if (boards.length === 0) return this.chip;
		const counts: Record<string, number> = {};
		for (const board of boards) counts[board.name] = (counts[board.name] ?? 0) + 1;
		return Object.entries(counts)
			.map(([name, count]) => (count > 1 ? `${name} ×${count}` : name))
			.join(' + ');
	}

	/** The chip the first board boots, or null when the document has none. */
	get boardChip(): string | null {
		const board = doc.sketch.parts.find((part) => part.type.startsWith('board-'));
		return board ? (partDef(board.type).chip ?? null) : null;
	}

	async start(): Promise<void> {
		if (this.running || this.loading) return;
		const generation = ++this.#generation;
		this.#resetReadouts();

		const diagram = toLitzDiagram(doc.sketch);
		if (!diagram.parts.some((part) => part.type.startsWith('board-'))) {
			this.#fail(m.error_no_board());
			return;
		}

		const boards = this.boards;
		if (boards.length > 1) {
			const withAux = boards.some((board) => {
				const program = doc.programFor(board.id);
				return Boolean(program.boot || program.ptable);
			});
			if (withAux) {
				this.#fail(m.error_aux_single_board());
				return;
			}
		}

		this.loading = true;
		try {
			const images: { id: string; app: Uint8Array; rom?: Uint8Array }[] = [];
			const names: string[] = [];
			const plans: [string, PythonPlan][] = [];
			let boot: Uint8Array | undefined;
			let ptable: Uint8Array | undefined;
			for (const board of boards) {
				const program = doc.programFor(board.id);
				const bundled = bundledFirmware(board.chip, program.runtime);
				let app: Uint8Array;
				let name: string;
				if (program.firmware) {
					app = await readFirmware(program.firmware);
					name = program.firmware.name;
				} else {
					if (!bundled) {
						this.loading = false;
						this.#fail(
							board.chip ? m.error_no_firmware_chip({ chip: board.chip }) : m.error_no_firmware()
						);
						return;
					}
					app = await loadBundled(bundled);
					name = bundled.name;
				}
				let rom = program.rom ? await readFirmware(program.rom) : undefined;
				if (!rom && bundled) rom = await loadBundledRom(bundled);
				if (program.boot && !rom) {
					this.loading = false;
					this.#fail(m.error_boot_needs_rom());
					return;
				}
				if (boards.length === 1) {
					if (program.boot) boot = await readFirmware(program.boot);
					if (program.ptable) ptable = await readFirmware(program.ptable);
				}
				images.push({ id: board.id, app, rom });
				names.push(`${board.id}: ${name}`);
				if (program.runtime !== 'native' && program.files.length > 0) {
					const entry = findEntry(program.runtime, program.files);
					if (!entry) {
						this.loading = false;
						this.#fail(m.error_python_no_entry({ runtime: program.runtime }));
						return;
					}
					const bootstrap = storageBootstrap(program.runtime, program.files, entry);
					plans.push([
						board.id,
						{
							runtime: program.runtime,
							entry,
							payload: Array.from(rawPaste(program.runtime, bootstrap, board.chip, entry)),
							phase: 'wait',
							offset: 0,
							startedMs: this.ms,
							lastNudge: 0,
							lastSend: 0,
							console: '',
							quiet: false,
							quietText: '',
							quietUntil: 0
						}
					]);
				}
			}
			this.firmwareName = names.join(' + ');
			await this.#backend.load(
				JSON.stringify(diagram),
				{
					app: images[0]?.app,
					// Auxiliary images describe one flash, so they only apply when the
					// diagram has one board; a fleet takes per-board images instead.
					rom: images[0]?.rom,
					boot,
					ptable,
					boards: images.length > 1 ? images : undefined
				},
				{ analog: this.analog, manifests: this.manifests.map((entry) => entry.text) }
			);
			if (generation !== this.#generation) {
				this.#backend.dispose();
				return;
			}
			this.#pythonPlans = new Map(plans);
			this.chipInfo = this.#backend.chipInfo();
			this.boardRuntime = this.#backend.boards();
			this.debugBoard = 0;
			this.chip =
				this.chipInfo?.name ?? (this.#backend instanceof LitzBackend ? this.#backend.chip : null);
			this.loading = false;
			this.running = true;
			this.paused = false;
			this.#registerInstruments();
			this.#registerBoardProbes();
			this.#applyBreakpoints();
			this.#log(m.sim_started({ chip: this.chip ?? 'litz-wasm', firmware: this.firmwareName }));
			ui.bottomOpen = true;
			ui.bottomTab = 'serial';
			this.#last = performance.now();
			this.#lastDiag = 0;
			this.#lastScope = 0;
			this.#lastDebug = 0;
			this.#refresh(true);
			this.#frame = requestAnimationFrame(this.#tick);
		} catch (error) {
			if (generation !== this.#generation) {
				this.#backend.dispose();
				return;
			}
			this.loading = false;
			this.#backend.dispose();
			clearLiveStates();
			setLiveDisplay(null);
			canvasControl.engine?.invalidate();
			this.#fail(errorText(error));
		}
	}

	stop(): void {
		if (!this.running && !this.loading) return;
		this.#generation += 1;
		const wasRunning = this.running;
		this.running = false;
		this.paused = false;
		this.loading = false;
		this.#cancelFrame();
		this.#backend.dispose();
		clearLiveStates();
		setLiveDisplay(null);
		this.chipInfo = null;
		this.boardRuntime = [];
		this.heap = null;
		this.stopWord = 'idle';
		this.fault = null;
		this.conflicts = [];
		this.levels = {};
		this.waves = null;
		this.#clearDebugReadouts();
		this.#boundProbes.clear();
		this.#boundDecoders.clear();
		this.#boardProbes.clear();
		this.#boardSerial.clear();
		this.#pythonPlans.clear();
		canvasControl.engine?.invalidate();
		if (wasRunning) this.#log(m.sim_stopped());
	}

	toggle(): void {
		if (this.running) this.stop();
		else void this.start();
	}

	pause(): void {
		if (!this.running || this.paused) return;
		this.paused = true;
		this.#cancelFrame();
		if (ui.bottomOpen && ui.bottomTab === 'debug') this.refreshDebug();
	}

	resume(): void {
		if (!this.running || !this.paused) return;
		this.paused = false;
		this.#last = performance.now();
		this.#frame = requestAnimationFrame(this.#tick);
	}

	togglePause(): void {
		if (this.paused) this.resume();
		else this.pause();
	}

	/** Advance a paused session by a fixed slice of simulated time. */
	step(ms = 10): void {
		if (!this.running) return;
		this.pause();
		const target = this.ms + Math.max(1, Math.min(1000, ms));
		let guard = 0;
		try {
			while (this.ms < target && guard < 4000) {
				this.ms = this.#backend.run(10_000);
				guard += 1;
			}
		} catch (error) {
			this.stop();
			this.#fail(errorText(error));
			return;
		}
		try {
			this.#refresh(true);
		} catch (error) {
			this.stop();
			this.#fail(errorText(error));
		}
	}

	/** Boot again with the current document and firmware. */
	reset(): void {
		if (this.loading) return;
		this.stop();
		void this.start();
	}

	async loadFirmware(file: File, boardId?: string): Promise<void> {
		const target = boardId ?? doc.selectedBoardId;
		if (!target) {
			this.actionError = m.error_no_board();
			return;
		}
		if (!file.size) return;
		try {
			const ref = await cacheFirmware(file);
			doc.setBoardFirmware(target, ref);
			this.actionError = null;
		} catch (error) {
			this.actionError = errorText(error);
			return;
		}
		if (this.running || this.loading) this.reset();
	}

	/** Load a bootloader, partition table or mask ROM for one board. */
	async loadImagePart(
		kind: 'rom' | 'boot' | 'ptable',
		file: File,
		boardId?: string
	): Promise<void> {
		const target = boardId ?? doc.selectedBoardId;
		if (!target) {
			this.actionError = m.error_no_board();
			return;
		}
		if (!file.size) return;
		try {
			const ref = await cacheFirmware(file);
			doc.setBoardImagePart(target, kind, ref);
			this.actionError = null;
		} catch (error) {
			this.actionError = errorText(error);
			return;
		}
		if (this.running || this.loading) this.reset();
	}

	setAnalog(on: boolean): void {
		if (this.analog === on) return;
		this.analog = on;
		if (this.running || this.loading) this.reset();
	}

	setSpeed(value: number): void {
		this.speed = value;
	}

	/** Drop the custom images and use the bundled image for the board's runtime. */
	useBundledFirmware(boardId?: string): void {
		const target = boardId ?? doc.selectedBoardId;
		if (!target) return;
		doc.setBoardFirmware(target, null);
		doc.setBoardImagePart(target, 'rom', null);
		doc.setBoardImagePart(target, 'boot', null);
		doc.setBoardImagePart(target, 'ptable', null);
		if (this.running || this.loading) this.reset();
	}

	addManifest(name: string, text: string): boolean {
		const trimmedName = name.trim();
		if (!trimmedName || !text.trim()) return false;
		const next = [
			...this.manifests.filter((entry) => entry.name !== trimmedName),
			{
				name: trimmedName,
				text
			}
		];
		this.manifests = next;
		this.#saveManifests();
		this.actionError = null;
		if (this.running || this.loading) this.reset();
		return true;
	}

	removeManifest(name: string): void {
		this.manifests = this.manifests.filter((entry) => entry.name !== name);
		this.#saveManifests();
		if (this.running || this.loading) this.reset();
	}

	/** A pushbutton the user presses on the canvas. */
	press(id: string, down: boolean): void {
		if (!this.running) return;
		this.#backend.press(id, down);
	}

	/** A potentiometer or other continuous control, 0–1000. */
	setControl(id: string, permille: number): void {
		if (!this.running) return;
		this.#backend.setControl(id, Math.max(0, Math.min(1000, Math.round(permille))));
	}

	/** A sensor reading or supply setting. */
	setNamedControl(id: string, name: string, value: string | number): void {
		if (!this.running) return;
		this.#backend.setNamedControl(id, name, value);
	}

	partPin(id: string, pin: string): Level | null {
		return this.#backend.partPin(id, pin);
	}

	/** The board the debug panel is looking at. */
	get debugBoardId(): string {
		return this.boardRuntime[this.debugBoard]?.id ?? this.boardId;
	}

	selectDebugBoard(index: number): void {
		if (index === this.debugBoard) return;
		this.debugBoard = index;
		this.#clearDebugReadouts();
		this.refreshDebug();
	}

	debugAvailable(): boolean {
		if (!this.running) return false;
		return this.#backend.debugAvailable(this.debugBoardId);
	}

	/** Read the register file, disassembly around PC and the stop reason. */
	refreshDebug(): void {
		if (!this.running || !this.debugAvailable()) return;
		const board = this.debugBoardId;
		try {
			const registers = this.#backend.debugRegisters(board);
			if (!registers) return;
			this.registers = registers;
			this.debugPc = registers.pc;
			this.disassembly = this.#backend.debugDisassemble(board, registers.pc, 10);
		} catch (error) {
			this.actionError = errorText(error);
		}
	}

	memory(addr: number, length = 64): Uint8Array {
		if (!this.running) return new Uint8Array(0);
		try {
			return this.#backend.debugMemory(this.debugBoardId, addr, length);
		} catch (error) {
			this.actionError = errorText(error);
			return new Uint8Array(0);
		}
	}

	/** Arm an instruction address on the selected board. */
	setBreakpoint(addr: number): boolean {
		const board = this.debugBoardId;
		const address = addr >>> 0;
		const list = this.breakpoints[board] ?? [];
		if (list.includes(address)) return false;
		const next = [...list, address].sort((a, b) => a - b);
		this.breakpoints = { ...this.breakpoints, [board]: next };
		this.#syncBreakpoints(board);
		return true;
	}

	removeBreakpoint(addr: number, board = this.debugBoardId): void {
		const list = this.breakpoints[board] ?? [];
		const next = list.filter((pc) => pc !== addr >>> 0);
		this.breakpoints = { ...this.breakpoints, [board]: next };
		this.#syncBreakpoints(board);
	}

	clearBreakpoints(): void {
		const board = this.debugBoardId;
		this.breakpoints = { ...this.breakpoints, [board]: [] };
		this.#syncBreakpoints(board);
	}

	/** Execute one instruction on the selected board. */
	debugStep(): void {
		if (!this.running || !this.debugAvailable()) return;
		this.pause();
		try {
			this.debugStop = this.#backend.debugStep(this.debugBoardId);
			this.#refresh(true);
		} catch (error) {
			this.actionError = errorText(error);
		}
	}

	/** Continue the selected board until a breakpoint or the step budget. */
	debugRun(steps = 200_000): void {
		if (!this.running || !this.debugAvailable()) return;
		this.pause();
		try {
			this.debugStop = this.#backend.debugRun(this.debugBoardId, steps);
			this.#refresh(true);
		} catch (error) {
			this.actionError = errorText(error);
		}
	}

	/** Deliver a touch to the panel at its own pixel coordinates. */
	touch(x: number, y: number, down: boolean): void {
		if (!this.running) return;
		this.#backend.touch(x, y, down);
	}

	addProbe(name: string, point: string): boolean {
		const trimmedName = name.trim();
		const trimmedPoint = point.trim();
		if (!trimmedName || !trimmedPoint) return false;
		if (this.probes.some((probe) => probe.name === trimmedName)) {
			this.actionError = m.analysis_probe_duplicate({ name: trimmedName });
			return false;
		}
		const bound = this.#boundProbes.get(trimmedName);
		if (bound !== undefined) {
			if (bound !== trimmedPoint) {
				this.actionError = m.analysis_probe_bound({ name: trimmedName, point: bound });
				return false;
			}
			this.probes = [...this.probes, { name: trimmedName, point: bound }];
			this.actionError = null;
			this.refreshScope(true);
			return true;
		}
		try {
			this.#backend.probe(trimmedName, trimmedPoint);
		} catch (error) {
			this.actionError = errorText(error);
			return false;
		}
		this.#boundProbes.set(trimmedName, trimmedPoint);
		this.probes = [...this.probes, { name: trimmedName, point: trimmedPoint }];
		this.actionError = null;
		this.refreshScope(true);
		return true;
	}

	removeProbe(name: string): void {
		this.probes = this.probes.filter((probe) => probe.name !== name);
		this.waves = this.waves
			? { ...this.waves, probes: this.waves.probes.filter((probe) => probe.name !== name) }
			: null;
	}

	addDecoder(spec: string): boolean {
		const trimmed = spec.trim();
		if (!trimmed) return false;
		if (this.decoders.includes(trimmed)) return false;
		if (!this.#boundDecoders.has(trimmed)) {
			try {
				this.#backend.decode(trimmed);
			} catch (error) {
				this.actionError = errorText(error);
				return false;
			}
			this.#boundDecoders.set(trimmed, true);
		}
		this.decoders = [...this.decoders, trimmed];
		this.actionError = null;
		this.refreshScope(true);
		return true;
	}

	removeDecoder(spec: string): void {
		this.decoders = this.decoders.filter((item) => item !== spec);
		this.waves = this.waves
			? { ...this.waves, decodes: this.waves.decodes.filter((decode) => decode.spec !== spec) }
			: null;
	}

	refreshScope(force = false): void {
		if (!this.running) return;
		const now = performance.now();
		if (!force && now - this.#lastScope < 250) return;
		this.#lastScope = now;
		try {
			const snapshot = this.#backend.scope();
			if (!snapshot) return;
			const names = new Set(this.probes.map((probe) => probe.name));
			const specs = new Set(this.decoders);
			this.waves = {
				ms: snapshot.ms,
				probes: snapshot.probes.filter((probe) => names.has(probe.name)),
				decodes: snapshot.decodes.filter((decode) => specs.has(decode.spec))
			};
			this.#readBoardLevels(snapshot);
		} catch (error) {
			this.actionError = errorText(error);
		}
	}

	traceCount(): number {
		return this.running ? this.#backend.traceCount() : 0;
	}

	traceVcd(): string {
		return this.running ? this.#backend.traceVcd() : '';
	}

	clearSerial(): void {
		this.serial = '';
		this.serialBoards = {};
		this.#boardSerial.clear();
	}

	/** One board's console; no board asks for the merged stream. */
	serialFor(boardId: string | null): string {
		return boardId ? (this.serialBoards[boardId] ?? '') : this.serial;
	}

	/** Bytes typed into the serial monitor, delivered to one board's UART0. */
	writeSerial(text: string, board?: string): void {
		if (!this.running || !text) return;
		if (board) {
			this.#backend.serialWriteBoard(board, text);
			this.serial =
				this.boardRuntime.length > 1
					? (this.serial + `[${board}] ${text}`).slice(-40000)
					: (this.serial + text).slice(-40000);
			return;
		}
		this.#backend.serialWrite(text);
		this.serial = (this.serial + text).slice(-40000);
	}

	#appendBoardSerial(boardId: string, text: string): void {
		this.serialBoards = {
			...this.serialBoards,
			[boardId]: ((this.serialBoards[boardId] ?? '') + text).slice(-40000)
		};
	}

	#tick = (): void => {
		this.#frame = 0;
		if (!this.running || this.paused) return;
		const now = performance.now();
		// Simulate about as much time as passed on the wall clock, capped so a
		// long pause does not turn into one giant synchronous call.
		const budget = Math.max(1, Math.min(50, now - this.#last)) * (this.speed || 1);
		this.#last = now;
		const unlimited = this.speed === 0;

		try {
			// Keep up with the wall clock but never block a frame for long: the
			// scheduler can need many steps to advance a single millisecond.
			const target = unlimited ? Number.POSITIVE_INFINITY : this.ms + budget;
			const deadline = performance.now() + 18;
			const guardLimit = unlimited ? 2000 : 400;
			let guard = 0;
			while (this.ms < target && guard < guardLimit && performance.now() < deadline) {
				this.ms = this.#backend.run(10_000);
				guard += 1;
				if (this.#backend.stopWord() === 'breakpoint') break;
			}
		} catch (error) {
			this.stop();
			this.#fail(errorText(error));
			return;
		}

		try {
			this.#refresh();
			if (this.#backend.stopWord() === 'breakpoint') this.pause();
		} catch (error) {
			this.stop();
			this.#fail(errorText(error));
			return;
		}
		this.#frame = requestAnimationFrame(this.#tick);
	};

	#boardOutput(boardId: string, chunk: string): string {
		const plan = this.#pythonPlans.get(boardId);
		if (!plan || !plan.quiet) return chunk;
		if (this.ms > plan.quietUntil && plan.quietUntil > 0) {
			plan.quiet = false;
			return chunk;
		}
		plan.quietText = (plan.quietText + chunk).slice(-1000);
		const after = afterStaging(plan.quietText);
		if (after === null) return '';
		plan.quiet = false;
		plan.quietText = '';
		return after;
	}

	#advancePython(boardId: string, chunk: string): void {
		const plan = this.#pythonPlans.get(boardId);
		if (!plan || plan.phase === 'done' || plan.phase === 'error') return;
		plan.console = (plan.console + chunk).slice(-800);
		if (plan.phase === 'wait') {
			if (plan.console.includes('>>>')) {
				plan.phase = 'paste';
				plan.console = '';
				plan.quiet = true;
			} else {
				const now = performance.now();
				if (plan.runtime === 'circuitpython' && now - plan.lastNudge > 400) {
					this.#backend.serialWriteBoard(boardId, '\x03');
					plan.lastNudge = now;
				}
				if (this.ms - plan.startedMs > 15_000) {
					plan.phase = 'error';
					const text = m.error_python_prompt({ board: boardId });
					this.actionError = text;
					this.#log(text);
				}
				return;
			}
		}
		const now = performance.now();
		if (now - plan.lastSend < 16) return;
		plan.lastSend = now;
		const next = plan.payload.slice(plan.offset, plan.offset + 16).join('');
		if (next) {
			this.#backend.serialWriteBoard(boardId, next);
			plan.offset += 16;
		}
		if (plan.offset >= plan.payload.length) {
			plan.phase = 'done';
			plan.quietUntil = this.ms + 1500;
			this.#log(m.python_stored({ board: boardId, entry: plan.entry }));
		}
	}

	#refresh(force = false): void {
		const boards = this.boardRuntime;
		for (const board of boards) {
			const chunk = this.#backend.serialTakeBoard(board.id);
			this.#advancePython(board.id, chunk);
			// Raw Python bootstrap traffic is control bytes, not terminal text. ESC
			// itself stays: the serial panel parses the ANSI sequences it introduces.
			const visible = this.#boardOutput(board.id, chunk).replace(
				// eslint-disable-next-line no-control-regex -- these bytes are the raw-REPL framing
				/[\x00-\x08\x0b\x0c\x0e-\x1a\x1c-\x1f]/g,
				''
			);
			if (!visible) continue;
			this.#appendBoardSerial(board.id, visible);
			if (boards.length > 1) {
				const pending = (this.#boardSerial.get(board.id) ?? '') + visible;
				const lines = pending.split('\n');
				const rest = lines.pop() ?? '';
				this.#boardSerial.set(board.id, rest);
				if (lines.length === 0) continue;
				const prefixed = lines
					.map((line) => line.replace(/\r$/, ''))
					.filter((line) => line !== '')
					.map((line) => `[${board.id}] ${line}`)
					.join('\n');
				if (prefixed) this.serial = (this.serial + prefixed + '\n').slice(-40000);
			} else {
				this.serial = (this.serial + visible).slice(-40000);
			}
		}

		setLiveStates(
			this.#backend
				.parts()
				.filter((part) => doc.sketch.parts.some((instance) => instance.id === part.id))
				.map((part) => ({ id: part.id, state: part.state, value: part.value }))
		);
		setLiveDisplay(this.#backend.displayFrame());

		const now = performance.now();
		if (force || now - this.#lastDiag > 200) {
			this.#lastDiag = now;
			this.heap = this.#backend.heap();
			this.stopWord = this.#backend.stopWord();
			this.fault = this.#backend.fault();
			this.conflicts = this.#backend.conflicts();
		}
		if (ui.bottomOpen && ui.bottomTab === 'analysis') this.refreshScope(force);
		if (ui.bottomOpen && ui.bottomTab === 'debug') {
			const stamp = performance.now();
			if (force || stamp - this.#lastDebug > 200) {
				this.#lastDebug = stamp;
				this.refreshDebug();
			}
		}

		this.revision += 1;
		canvasControl.engine?.invalidate();
	}

	#registerInstruments(): void {
		const missing: string[] = [];
		for (const probe of this.probes) {
			try {
				this.#backend.probe(probe.name, probe.point);
				this.#boundProbes.set(probe.name, probe.point);
			} catch {
				missing.push(probe.name);
			}
		}
		if (missing.length) {
			this.probes = this.probes.filter((probe) => !missing.includes(probe.name));
			this.#log(m.analysis_probe_dropped({ names: missing.join(', ') }));
		}
		for (const spec of this.decoders) {
			try {
				this.#backend.decode(spec);
				this.#boundDecoders.set(spec, true);
			} catch (error) {
				this.actionError = errorText(error);
			}
		}
	}

	#resetReadouts(): void {
		this.error = null;
		this.actionError = null;
		this.ms = 0;
		this.chip = null;
		this.chipInfo = null;
		this.boardRuntime = [];
		this.heap = null;
		this.stopWord = 'idle';
		this.fault = null;
		this.conflicts = [];
		this.levels = {};
		this.serial = '';
		this.#clearDebugReadouts();
		this.entries = [];
		this.waves = null;
		this.#boundProbes.clear();
		this.#boundDecoders.clear();
		this.#boardProbes.clear();
		this.#boardSerial.clear();
		this.#pythonPlans.clear();
	}

	#registerBoardProbes(): void {
		for (const board of this.boards) {
			for (const pin of board.pins) {
				const name = `__b/${board.id}/${pin.name}`;
				try {
					this.#backend.probe(name, `${board.id}:${pin.gpio}`);
					this.#boardProbes.set(name, { boardId: board.id, pin: pin.name });
				} catch {
					// An unwired pin is not a net yet.
				}
			}
		}
	}

	#readBoardLevels(snapshot: ScopeSnapshot): void {
		const levels: Record<string, Record<string, Level | null>> = {};
		for (const board of this.boards) {
			const pins: Record<string, Level | null> = {};
			for (const pin of board.pins) pins[pin.name] = null;
			levels[board.id] = pins;
		}
		for (const probe of snapshot.probes) {
			const info = this.#boardProbes.get(probe.name);
			if (!info) continue;
			const last = probe.digital.at(-1);
			if (!last) continue;
			levels[info.boardId][info.pin] = last[1] === 1 ? 'high' : last[1] === 0 ? 'low' : 'high-z';
		}
		this.levels = levels;
	}

	#applyBreakpoints(): void {
		for (const board of this.boardRuntime) {
			this.#syncBreakpoints(board.id);
		}
	}

	#syncBreakpoints(board: string): void {
		if (!this.running) return;
		try {
			this.#backend.debugSetBreakpoints(board, this.breakpoints[board] ?? []);
		} catch (error) {
			this.actionError = errorText(error);
		}
	}

	#clearDebugReadouts(): void {
		this.debugPc = null;
		this.registers = null;
		this.disassembly = '';
		this.debugStop = null;
	}

	#saveManifests(): void {
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(MANIFEST_KEY, JSON.stringify(this.manifests));
		} catch {
			// A full storage quota should not break the editor.
		}
	}

	#cancelFrame(): void {
		if (this.#frame) cancelAnimationFrame(this.#frame);
		this.#frame = 0;
	}

	#fail(message: string): void {
		this.error = message;
		this.#log(message);
		ui.bottomOpen = true;
	}

	#log(text: string): void {
		this.entries = [...this.entries.slice(-199), { at: Math.round(this.ms), text }];
	}
}

export const sim = new SimController();
