/**
 * The simulation slot.
 *
 * The editor knows nothing about how a circuit is solved. It renders a
 * backend that answers these questions, and `NullBackend` answers nothing —
 * which is what ships when `@litz-sim/litz` cannot run. `LitzBackend` loads the
 * wasm module and drives one session.
 */

/** What a part reports, matching `PartStateName` from `@litz-sim/litz`. */
export type PartState =
	| 'none'
	| 'off'
	| 'on'
	| 'up'
	| 'down'
	| 'silent'
	| 'sounding'
	| 'position'
	| 'mask'
	| 'state'
	| 'unknown';

/** A pin level as the board sees it. */
export type Level = 'low' | 'high' | 'high-z';

/** How the last `run` ended. */
export type StopWord = 'budget' | 'idle' | 'halted' | 'trap' | 'reset' | 'breakpoint';

export interface SimAssets {
	app?: Uint8Array;
	rom?: Uint8Array;
	/** Second-stage bootloader; needs `ptable`. */
	boot?: Uint8Array;
	/** Partition table; needs `boot`. */
	ptable?: Uint8Array;
	/** One image per board, for diagrams with several development boards. */
	boards?: BoardImageBytes[];
}

/** The firmware slot says which board it belongs to, not just its index. */
export interface BoardImageBytes {
	id: string;
	app: Uint8Array;
	rom?: Uint8Array;
}

export interface LoadOptions {
	/** Solve the analog network instead of treating every net as digital. */
	analog?: boolean;
	/** Custom part/board TOML manifests, applied when the session boots. */
	manifests?: string[];
}

/** One board the running session booted. */
export interface BoardRuntimeInfo {
	index: number;
	id: string;
	name: string;
	cpuHz: number;
}

/** The register file of one core: x1–x31 plus pc. */
export interface RegisterSnapshot {
	values: number[];
	pc: number;
}

/** A debugger stop; `unsupported` when the board is not a RISC-V core. */
export type DebugStop = StopWord | 'unsupported';

export interface ChipInfo {
	name: string;
	cpuHz: number;
	flash: { size: number; bootloader: number; partitionTable: number; app: number };
}

export interface DisplayFrame {
	width: number;
	height: number;
	rgba: Uint8Array;
	/** Grows when the pixels change. */
	version: number;
}

export interface ProbeRecord {
	name: string;
	point: string;
	net: number;
	edges: number;
	highNs: number;
	lowNs: number;
	frequencyHz: number | null;
	duty: number | null;
	minVolts: number | null;
	maxVolts: number | null;
	/** Digital transitions as `[tickNs, level]`, level 0 low, 1 high, 2 high-Z. */
	digital: [number, number][];
	/** Analog samples as `[tickNs, volts]`. */
	volts: [number, number][];
}

export interface DecoderFrame {
	at: number;
	end: number;
	text: string;
	error: boolean | string;
}

export interface DecodeRecord {
	spec: string;
	kind: string;
	name: string;
	frames: DecoderFrame[];
}

export interface ScopeSnapshot {
	ms: number;
	probes: ProbeRecord[];
	decodes: DecodeRecord[];
}

export interface SimBackend {
	readonly kind: 'none' | 'mock' | 'litz-wasm';
	load(diagramJson: string, assets?: SimAssets, options?: LoadOptions): Promise<void>;
	/** The backend the diagram booted, its clock and its flash layout. */
	chipInfo(): ChipInfo | null;
	/** Advance at most `steps` scheduling steps; returns simulated milliseconds. */
	run(steps: number): number;
	/** How the last `run` ended. */
	stopWord(): StopWord;
	/** The backend's explanation for a trap, or null. */
	fault(): string | null;
	/** The firmware's own free heap in bytes, or null. */
	heap(): number | null;
	/** Electrical conflicts, oldest first. */
	conflicts(): string[];
	/** Every part the loaded circuit declares, with its current state. */
	parts(): { id: string; state: PartState; value: number }[];
	partState(id: string): PartState;
	/** The level on one of a part's pins. */
	partPin(id: string, pin?: string): Level | null;
	/** The level the chip sees on its own pad, by GPIO number. */
	gpio(pin: number): Level | null;
	/** The level one board sees on one of its own pads. */
	gpioOn(board: number | string, pin: number): Level | null;
	/** Every board the session booted, in diagram order. */
	boards(): BoardRuntimeInfo[];
	press(id: string, down: boolean): void;
	/** 0–1000, for potentiometers and knobs. */
	setControl(id: string, permille: number): void;
	/** A named input such as a sensor's `temperature` or a supply's `voltage`. */
	setNamedControl(id: string, name: string, value: string | number): boolean;
	serialTake(): string;
	serialTakeBoard(board: number | string): string;
	serialWrite(text: string): void;
	serialWriteBoard(board: number | string, text: string): void;
	probe(name: string, point: string): void;
	decode(spec: string): void;
	scope(): ScopeSnapshot | null;
	/** Net transitions recorded so far. */
	traceCount(): number;
	traceVcd(): string;
	touch(x: number, y: number, down?: boolean): boolean;
	displayFrame(board?: number | string): DisplayFrame | null;
	/** One display part's frame, by diagram id; null when it has no panel. */
	partDisplayFrame(part: string): DisplayFrame | null;
	debugAvailable(board: number | string): boolean;
	debugRegisters(board: number | string): RegisterSnapshot | null;
	debugMemory(board: number | string, addr: number, length: number): Uint8Array;
	debugDisassemble(board: number | string, addr: number, count: number): string;
	debugSetBreakpoints(board: number | string, pcs: number[]): void;
	debugStep(board: number | string): DebugStop;
	debugRun(board: number | string, steps: number): DebugStop;
	dispose(): void;
}

const EMPTY_CHIP: ChipInfo = {
	name: '',
	cpuHz: 0,
	flash: { size: 0, bootloader: 0, partitionTable: 0, app: 0 }
};

export class NullBackend implements SimBackend {
	readonly kind = 'none';

	async load(): Promise<void> {}

	chipInfo(): ChipInfo | null {
		return null;
	}

	run(): number {
		return 0;
	}

	stopWord(): StopWord {
		return 'idle';
	}

	fault(): string | null {
		return null;
	}

	heap(): number | null {
		return null;
	}

	conflicts(): string[] {
		return [];
	}

	parts(): { id: string; state: PartState; value: number }[] {
		return [];
	}

	partState(): PartState {
		return 'none';
	}

	partPin(): Level | null {
		return null;
	}

	gpio(): Level | null {
		return null;
	}

	gpioOn(): Level | null {
		return null;
	}

	boards(): BoardRuntimeInfo[] {
		return [];
	}

	press(): void {}

	setControl(): void {}

	setNamedControl(): boolean {
		return false;
	}

	serialTake(): string {
		return '';
	}

	serialTakeBoard(): string {
		return '';
	}

	serialWrite(): void {}

	serialWriteBoard(): void {}

	probe(): void {}

	decode(): void {}

	scope(): ScopeSnapshot | null {
		return null;
	}

	traceCount(): number {
		return 0;
	}

	traceVcd(): string {
		return '';
	}

	touch(): boolean {
		return false;
	}

	displayFrame(): DisplayFrame | null {
		return null;
	}

	partDisplayFrame(): DisplayFrame | null {
		return null;
	}

	debugAvailable(): boolean {
		return false;
	}

	debugRegisters(): RegisterSnapshot | null {
		return null;
	}

	debugMemory(): Uint8Array {
		return new Uint8Array(0);
	}

	debugDisassemble(): string {
		return '';
	}

	debugSetBreakpoints(): void {}

	debugStep(): DebugStop {
		return 'unsupported';
	}

	debugRun(): DebugStop {
		return 'unsupported';
	}

	dispose(): void {}
}

export { EMPTY_CHIP };
