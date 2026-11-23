import { loadLitz, type Display, type Litz, type Session } from '@litz-sim/litz';
import { m } from '#lib/paraglide/messages.js';
import type {
	BoardRuntimeInfo,
	ChipInfo,
	DebugStop,
	DecodeRecord,
	DisplayFrame,
	Level,
	LoadOptions,
	PartState,
	ProbeRecord,
	RegisterSnapshot,
	ScopeSnapshot,
	SimAssets,
	SimBackend,
	StopWord
} from './backend';

/** One module per page; sessions are cheap, compiling the wasm is not. */
let runtime: Promise<Litz> | null = null;

function runtimePromise(): Promise<Litz> {
	runtime ??= loadLitz().catch((error: unknown) => {
		runtime = null;
		throw error;
	});
	return runtime;
}

/** The host side of `Session`, shaped like the editor's simulation slot. */
export class LitzBackend implements SimBackend {
	readonly kind = 'litz-wasm';

	#session: Session | null = null;
	#chipName = '';
	#chipInfo: ChipInfo | null = null;
	/** Pixels are copied only when the board's frame version moves. */
	#displayCache = new Map<number, { version: number; frame: DisplayFrame }>();
	/** Per-part panels, keyed by diagram id. */
	#partCache = new Map<string, { version: number; frame: DisplayFrame }>();

	async load(diagramJson: string, assets?: SimAssets, options?: LoadOptions): Promise<void> {
		const boards = assets?.boards ?? [];
		const app = assets?.app;
		if (boards.length === 0 && (!app || app.length === 0)) {
			throw new Error(m.error_no_firmware());
		}
		const litz = await runtimePromise();
		this.dispose();
		this.#session = litz.createSession({
			diagram: diagramJson,
			app,
			boardImages:
				boards.length > 0
					? boards.map((board) => ({ id: board.id, app: board.app, rom: board.rom ?? null }))
					: undefined,
			rom: assets?.rom ?? null,
			boot: assets?.boot ?? null,
			ptable: assets?.ptable ?? null,
			analog: options?.analog ?? false,
			manifests: options?.manifests ?? []
		});
		const chip = this.#session.chip();
		this.#chipName = chip.name;
		this.#chipInfo = {
			name: chip.name,
			cpuHz: chip.cpuHz,
			flash: {
				size: chip.flash.size,
				bootloader: chip.flash.bootloader,
				partitionTable: chip.flash.partitionTable,
				app: chip.flash.app
			}
		};
		// Record from the first step so the exported VCD covers the whole run.
		this.#session.trace.start();
		this.#displayCache.clear();
	}

	get chip(): string {
		return this.#chipName;
	}

	chipInfo(): ChipInfo | null {
		return this.#chipInfo;
	}

	run(steps: number): number {
		return this.#session?.run(steps) ?? 0;
	}

	stopWord(): StopWord {
		return this.#session?.stop ?? 'idle';
	}

	fault(): string | null {
		return this.#session?.fault ?? null;
	}

	heap(): number | null {
		return this.#session?.heap() ?? null;
	}

	conflicts(): string[] {
		return this.#session?.conflicts() ?? [];
	}

	parts(): { id: string; state: PartState; value: number }[] {
		const session = this.#session;
		if (!session) return [];
		return session.parts().map((part) => ({
			id: part.id,
			state: part.state ?? 'none',
			value: part.value
		}));
	}

	partState(id: string): PartState {
		return this.#session?.part(id)?.state ?? 'none';
	}

	partPin(id: string, pin?: string): Level | null {
		return this.#session?.partPin(id, pin) ?? null;
	}

	gpio(pin: number): Level | null {
		return this.#session?.gpio(pin) ?? null;
	}

	gpioOn(board: number | string, pin: number): Level | null {
		return this.#session?.gpioOn(board, pin) ?? null;
	}

	boards(): BoardRuntimeInfo[] {
		const session = this.#session;
		if (!session) return [];
		return session.boards().map((board) => ({
			index: board.index,
			id: board.id,
			name: board.name,
			cpuHz: board.cpuHz
		}));
	}

	press(id: string, down: boolean): void {
		this.#session?.press(id, down);
	}

	setControl(id: string, permille: number): void {
		this.#session?.setControl(id, permille);
	}

	setNamedControl(id: string, name: string, value: string | number): boolean {
		const session = this.#session;
		if (!session) return false;
		try {
			session.setNamedControl(id, name, value);
			return true;
		} catch {
			return false;
		}
	}

	serialTake(): string {
		return this.#session?.serial.take() ?? '';
	}

	serialTakeBoard(board: number | string): string {
		return this.#session?.serial.takeBoard(board) ?? '';
	}

	serialWrite(text: string): void {
		this.#session?.serial.write(text);
	}

	serialWriteBoard(board: number | string, text: string): void {
		this.#session?.serial.writeBoard(board, text);
	}

	probe(name: string, point: string): void {
		this.#session?.probe.add(name, point);
	}

	decode(spec: string): void {
		this.#session?.decode.add(spec);
	}

	scope(): ScopeSnapshot | null {
		const session = this.#session;
		if (!session) return null;
		const doc = session.scope();
		return {
			ms: doc.ms,
			probes: doc.probes.map((probe): ProbeRecord => ({
				name: probe.name,
				point: probe.point,
				net: probe.net,
				edges: probe.edges,
				highNs: probe.high_ns,
				lowNs: probe.low_ns,
				frequencyHz: probe.frequency_hz,
				duty: probe.duty,
				minVolts: probe.min_volts,
				maxVolts: probe.max_volts,
				digital: probe.digital,
				volts: probe.volts
			})),
			decodes: doc.decodes.map((decode): DecodeRecord => ({
				spec: decode.spec,
				kind: decode.kind,
				name: decode.name,
				frames: decode.frames.map((frame) => ({
					at: frame.at,
					end: frame.end,
					text: frame.text,
					error: frame.error
				}))
			}))
		};
	}

	traceCount(): number {
		return this.#session?.trace.transitions ?? 0;
	}

	traceVcd(): string {
		return this.#session?.trace.vcd() ?? '';
	}

	touch(x: number, y: number, down?: boolean): boolean {
		return this.#session?.touch(x, y, down) ?? false;
	}

	displayFrame(board: number | string = 0): DisplayFrame | null {
		const session = this.#session;
		if (!session) return null;
		const index = session.board(board).index;
		const display = session.displayOn(index);
		if (!display) return null;
		const cached = this.#displayCache.get(index);
		if (cached && cached.version === display.version) return cached.frame;
		const frame: DisplayFrame = {
			width: display.width,
			height: display.height,
			rgba: display.pixels(),
			version: display.version
		};
		this.#displayCache.set(index, { version: frame.version, frame });
		return frame;
	}

	partDisplayFrame(part: string): DisplayFrame | null {
		const session = this.#session;
		if (!session) return null;
		// Per-part capture arrived with 0.5; older modules only answer for the board.
		const display = (
			session as Session & { partDisplay?: (id: string) => Display | null }
		).partDisplay?.(part);
		if (!display) return null;
		const cached = this.#partCache.get(part);
		if (cached && cached.version === display.version) return cached.frame;
		const frame: DisplayFrame = {
			width: display.width,
			height: display.height,
			rgba: display.pixels(),
			version: display.version
		};
		this.#partCache.set(part, { version: frame.version, frame });
		return frame;
	}

	debugAvailable(board: number | string): boolean {
		return this.#session?.debug.available(board) ?? false;
	}

	debugRegisters(board: number | string): RegisterSnapshot | null {
		return this.#session?.debug.registers(board) ?? null;
	}

	debugMemory(board: number | string, addr: number, length: number): Uint8Array {
		return this.#session?.debug.memory(board, addr, length) ?? new Uint8Array(0);
	}

	debugDisassemble(board: number | string, addr: number, count: number): string {
		return this.#session?.debug.disassemble(board, addr, count) ?? '';
	}

	debugSetBreakpoints(board: number | string, pcs: number[]): void {
		this.#session?.debug.setBreakpoints(board, pcs);
	}

	debugStep(board: number | string): DebugStop {
		return this.#session?.debug.step(board) ?? 'unsupported';
	}

	debugRun(board: number | string, steps: number): DebugStop {
		return this.#session?.debug.run(board, steps) ?? 'unsupported';
	}

	dispose(): void {
		this.#session?.close();
		this.#session = null;
		this.#chipName = '';
		this.#chipInfo = null;
		this.#displayCache.clear();
		this.#partCache.clear();
	}
}
