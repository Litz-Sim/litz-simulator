import type { ProgramFile, RuntimeMode } from '#lib/sketch/types';

/** The name the interpreter runs on boot. */
export function pythonEntry(runtime: RuntimeMode): string | null {
	if (runtime === 'micropython') return 'main.py';
	if (runtime === 'circuitpython') return 'code.py';
	return null;
}

/** The entry file present in a board's storage, if any. */
export function findEntry(runtime: RuntimeMode, files: ProgramFile[]): string | null {
	if (runtime === 'micropython')
		return files.some((file) => file.name === 'main.py') ? 'main.py' : null;
	if (runtime === 'circuitpython') {
		if (files.some((file) => file.name === 'code.py')) return 'code.py';
		if (files.some((file) => file.name === 'main.py')) return 'main.py';
	}
	return null;
}

function quote(text: string): string {
	// JSON string escapes are a subset of Python's: quotes, backslashes, newlines
	// and control characters all round-trip, and the file is written as UTF-8.
	return JSON.stringify(text);
}

/**
 * The program pasted into a running interpreter to put the board's files on
 * its storage. It writes the files and resets, so the firmware's own boot
 * picks up `main.py` / `code.py`; the editor never executes user code through
 * the REPL.
 */
export function storageBootstrap(
	runtime: RuntimeMode,
	files: ProgramFile[],
	entry: string
): string {
	const writes = files
		.map((file) => `_litz_write(${quote(file.name)}, ${quote(file.text)})`)
		.join('\n');
	// A hardware reset ends the wasm session; the soft reset/reload restarts
	// the interpreter and boots the files just written.
	return [
		'def _litz_mkdir(path):',
		'    import os',
		'    cur = ""',
		'    for part in path.split("/")[:-1]:',
		'        cur = part if not cur else cur + "/" + part',
		'        try:',
		'            os.mkdir(cur)',
		'        except OSError:',
		'            pass',
		'',
		'def _litz_write(name, text):',
		'    _litz_mkdir(name)',
		'    f = open(name, "w")',
		'    f.write(text)',
		'    f.close()',
		'',
		writes,
		'',
		`# ${entry} is now on the board.`,
		''
	].join('\n');
}

/** The line printed just before the entry file is executed on the RP2040. */
export const RUN_MARKER = '__litz_run__';

/**
 * The console text a staged program has produced, or null while staging is
 * still in progress.
 *
 * Each restart path prints its own line before the entry file runs:
 * MicroPython's soft reset prints `MPY: soft reboot`, CircuitPython's reload
 * prints `soft reboot`, and the RP2040 path prints `RUN_MARKER`. Everything up
 * to that line is staging traffic and stays hidden.
 */
export function afterStaging(text: string): string | null {
	const markers = [
		'MPY: soft reboot',
		'soft reboot',
		'soft reload',
		'Code done running',
		RUN_MARKER
	];
	// The latest marker in the text wins: a program's own output can echo an
	// earlier one, and the run marker must not reach the console.
	let end = -1;
	for (const marker of markers) {
		const at = text.lastIndexOf(marker);
		if (at !== -1) end = Math.max(end, at + marker.length);
	}
	return end === -1 ? null : text.slice(end).replace(/^\r?\n/, '');
}

/** The friendly-REPL line that reboots the interpreter after files are stored. */
export function restartCommand(runtime: RuntimeMode): string {
	return runtime === 'circuitpython'
		? 'import supervisor; supervisor.reload()\r\n'
		: 'import machine; machine.soft_reset()\r\n';
}

/**
 * Raw-REPL framing for writing files and starting the program.
 *
 * The entry file normally runs after a reboot, and the reset must be issued
 * from the friendly REPL: a soft reset inside the raw REPL returns to the raw
 * prompt instead of booting `main.py`. The RP2040 has no second core in this
 * engine, so MicroPython's soft reset waits on it forever; the entry file is
 * executed over the raw REPL instead.
 */
export function rawPaste(
	runtime: RuntimeMode,
	bootstrap: string,
	chip: string | null,
	entry: string
): string {
	if (runtime === 'micropython' && chip === 'rp2040') {
		const run = `print(${JSON.stringify(RUN_MARKER)}); exec(open(${JSON.stringify(entry)}).read())`;
		return `\x03\x01${bootstrap}\x04${run}\x04`;
	}
	return `\x03\x01${bootstrap}\x04\x02${restartCommand(runtime)}`;
}
