import { describe, expect, it } from 'vitest';
import { afterStaging, RUN_MARKER } from './python';

// Captured from the interpreters this editor stages, so the marker search sees
// the same control bytes and line endings the Serial panel filters.
describe('afterStaging', () => {
	it('hides the raw REPL traffic until the restart line', () => {
		const text =
			'\r\n>>> \r\nraw REPL; CTRL-B to exit\r\n>OK\x04\x04>\r\n' +
			'MicroPython v1.29.0 on 2026-08-24; ESP32-C3\r\n' +
			'MPY: soft reboot\r\n' +
			'MicroPython v1.29.0 on 2026-08-24; ESP32-C3\r\n' +
			'Hello from MicroPython\r\n';
		expect(afterStaging(text)).toBe(
			'MicroPython v1.29.0 on 2026-08-24; ESP32-C3\r\nHello from MicroPython\r\n'
		);
	});

	it('returns the program output after a CircuitPython reload', () => {
		const text =
			'raw REPL; CTRL-B to exit\r\n>OK\x04\x04>\r\n' +
			'Adafruit CircuitPython 10.3.2 on 2026-11-11\r\n' +
			'>>> import supervisor; supervisor.reload()\r\n' +
			'\x1b]0;🐍Wi-Fi: off | BLE:CIRCUITPY3458 | Done | 10.3.2\x1b\\soft reboot\r\n' +
			'\x1b[2K[0Gcode.py output:\r\nHello from CircuitPython\r\r\n';
		const visible = afterStaging(text);
		expect(visible).toContain('Hello from CircuitPython');
		expect(visible).not.toContain('raw REPL');
	});

	it('returns the program output after the RP2040 run marker', () => {
		const text = `>OK\x04\x04>OK${RUN_MARKER}\r\nHello from Pico MicroPython\r\n`;
		expect(afterStaging(text)).toBe('Hello from Pico MicroPython\r\n');
	});

	it('reports no output while the paste is still running', () => {
		expect(afterStaging('raw REPL; CTRL-B to exit\r\n>OK')).toBeNull();
	});

	it('hides the latest marker even when an earlier one is still in the buffer', () => {
		const text = `MPY: soft reboot\r\n${RUN_MARKER}\r\nHello\r\n`;
		expect(afterStaging(text)).toBe('Hello\r\n');
	});
});
