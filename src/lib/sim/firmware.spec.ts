import { describe, expect, it } from 'vitest';
import { bundledFirmware } from './firmware';

describe('bundled python firmware', () => {
	it('runs both interpreters on the ESP32-C3', () => {
		expect(bundledFirmware('esp32c3', 'micropython')?.rom?.name).toBe('esp32c3-rom.elf');
		expect(bundledFirmware('esp32c3', 'circuitpython')?.rom?.name).toBe('esp32c3-rom.elf');
	});

	it('runs MicroPython on the ESP32-C6 with that chip ROM', () => {
		expect(bundledFirmware('esp32c6', 'micropython')?.name).toBe('micropython-esp32c6.bin');
		expect(bundledFirmware('esp32c6', 'micropython')?.rom?.name).toBe('esp32c6-rom.elf');
		// CircuitPython enables BLE, which this engine only models on the C3.
		expect(bundledFirmware('esp32c6', 'circuitpython')).toBeUndefined();
	});

	it('runs MicroPython on the RP2040 from flash', () => {
		expect(bundledFirmware('rp2040', 'micropython')?.name).toBe('micropython-rp2040.bin');
		expect(bundledFirmware('rp2040', 'micropython')?.rom).toBeUndefined();
		// CircuitPython writes to ROM during boot2, which the RP2040 model refuses.
		expect(bundledFirmware('rp2040', 'circuitpython')).toBeUndefined();
	});

	it('has no interpreter for the ATmega328P', () => {
		expect(bundledFirmware('atmega328p', 'micropython')).toBeUndefined();
		expect(bundledFirmware('atmega328p', 'circuitpython')).toBeUndefined();
	});
});
