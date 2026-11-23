import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { loadLitz } from '@litz-sim/litz';

const DIAGRAM = JSON.stringify({
	version: 1,
	parts: [
		{ id: 'a', type: 'board-esp32-c3-devkitm-1', left: 0, top: 0, attrs: {} },
		{ id: 'b', type: 'board-esp32-c3-devkitm-1', left: 400, top: 0, attrs: {} },
		{ id: 'led1', type: 'litz-led', left: 200, top: 300, attrs: { color: 'red' } }
	],
	connections: [
		['a:GPIO8', 'b:GPIO0', '', []],
		['a:GPIO8', 'led1:A', '', []],
		['led1:C', 'a:GND.1', '', []]
	]
});

async function bootFleet() {
	const [wasm, app] = await Promise.all([
		readFile('node_modules/@litz-sim/litz/litz_wasm.wasm'),
		readFile('static/firmware/blinky.bin')
	]);
	const litz = await loadLitz({ wasm: new Uint8Array(wasm) });
	const session = litz.createSession({
		diagram: DIAGRAM,
		boardImages: [
			{ id: 'a', app: new Uint8Array(app) },
			{ id: 'b', app: new Uint8Array(app) }
		]
	});
	return { litz, session };
}

describe('the packaged simulator', () => {
	it('boots one chip per board on a shared circuit', async () => {
		const { litz, session } = await bootFleet();
		try {
			expect(session.boards().map((board) => board.id)).toEqual(['a', 'b']);
			session.advance(300);
			const serialA = session.serial.takeBoard('a');
			const serialB = session.serial.takeBoard('b');
			expect(serialA).toContain('litz: blinky');
			expect(serialB).toContain('litz: blinky');
			const toggle = session.gpioOn('a', 8);
			expect(toggle).not.toBeNull();
			expect(session.gpioOn('b', 0)).toBe(toggle);
		} finally {
			session.close();
			litz.close();
		}
	});

	it('single-steps a RISC-V board and stops on a breakpoint', async () => {
		const { litz, session } = await bootFleet();
		try {
			session.advance(100);
			expect(session.debug.available(0)).toBe(true);
			const registers = session.debug.registers(0);
			expect(registers?.values).toHaveLength(32);
			const before = session.debug.pc(0);
			expect(before).not.toBeNull();
			session.debug.step(0);
			const after = session.debug.pc(0);
			expect(after).not.toBe(before);
			expect(session.debug.disassemble(0, after ?? 0, 4).split('\n')[0]).toContain(':');
			session.debug.setBreakpoints(0, [after ?? 0]);
			expect(session.debug.run(0, 10_000)).toBe('breakpoint');
			expect(session.debug.pc(0)).toBe(after);
		} finally {
			session.close();
			litz.close();
		}
	});
});
