import { describe, expect, it } from 'vitest';
import { boardDef } from '#lib/parts/breadboard';
import { partDef } from '#lib/parts/registry';
import { logicAnalyzerSketch, supplySketch } from './examples-more';
import { holeNear, pinPosition, toLitzDiagram } from './export';
import type { Sketch } from './types';

const examples: [string, (name: string) => Sketch][] = [
	['analyzer', logicAnalyzerSketch],
	['supply', supplySketch]
];

/** The tie group a hole belongs to: one strip of five, or a rail. */
function tieGroup(col: number, row: number): string | null {
	const board = boardDef('breadboard-half');
	const strip = board.rows.findIndex(([from, to]) => row >= from && row <= to);
	if (strip >= 0) return `strip${strip}:${col}`;
	const rail = board.rails.find(
		(rail) => rail.row === row && rail.segments.some(([a, b]) => col >= a && col <= b)
	);
	return rail ? `rail${rail.row}` : null;
}

describe('logic analyzer example', () => {
	const sketch = logicAnalyzerSketch('Logic analyzer');
	const diagram = toLitzDiagram(sketch);
	const pairs = diagram.connections.map(([a, b]) => [a, b]);

	it('bit-bangs one GPIO into the shift register and clocks it from another', () => {
		expect(pairs).toContainEqual(['esp:GPIO8', 'u1:A']);
		expect(pairs).toContainEqual(['esp:GPIO8', 'u1:B']);
		expect(pairs).toContainEqual(['esp:GPIO9', 'u1:CLK']);
	});

	it('shows three outputs on LEDs and probes the data and clock lines', () => {
		for (const output of ['Q0', 'Q1', 'Q2']) {
			expect(
				sketch.wires.some((wire) => wire.from.kind === 'pin' && wire.from.pin === output)
			).toBe(true);
		}
		expect(sketch.probes?.map((probe) => `${probe.part}:${probe.pin}`)).toEqual([
			'esp:GPIO8',
			'esp:GPIO9',
			'u1:Q2'
		]);
	});
});

describe('MCU supply example', () => {
	const sketch = supplySketch('MCU adjustable supply');
	const diagram = toLitzDiagram(sketch);
	const pairs = diagram.connections.map(([a, b]) => [a, b]);

	it('trims the regulator from the DAC and measures the output with the ADC', () => {
		expect(pairs).toContainEqual(['ps1:+', 'reg:VI']);
		expect(pairs).toContainEqual(['dac:VOUT', 'reg:ADJ']);
		expect(pairs).toContainEqual(['reg:VO', 'r1:1']);
		expect(pairs).toContainEqual(['r1:2', 'adc:A0']);
		expect(pairs).toContainEqual(['r2:1', 'adc:A0']);
		expect(pairs).toContainEqual(['r2:2', 'esp:GND.2']);
	});

	it('puts both I²C devices on GPIO9 and GPIO10', () => {
		for (const part of ['dac', 'adc']) {
			expect(pairs).toContainEqual(['esp:GPIO9', `${part}:SDA`]);
			expect(pairs).toContainEqual(['esp:GPIO10', `${part}:SCL`]);
		}
	});
});

describe('new examples', () => {
	for (const [label, build] of examples) {
		const sketch = build(label);

		it(`${label} wires only pins that exist`, () => {
			const parts = new Map(sketch.parts.map((part) => [part.id, part]));
			const problems: string[] = [];
			for (const wire of sketch.wires) {
				for (const endpoint of [wire.from, wire.to]) {
					if (endpoint.kind !== 'pin' || !endpoint.part || !endpoint.pin) continue;
					const part = parts.get(endpoint.part);
					if (!part) {
						problems.push(`${wire.id}: no part ${endpoint.part}`);
						continue;
					}
					if (!partDef(part.type).pins.some((pin) => pin.name === endpoint.pin)) {
						problems.push(`${wire.id}: ${part.type} has no pin ${endpoint.pin}`);
					}
				}
			}
			expect(problems).toEqual([]);
		});

		it(`${label} plugs every on-board part into a hole without bridging a strip`, () => {
			const loose: string[] = [];
			const strips = new Map<string, string[]>();
			for (const part of sketch.parts) {
				if (part.type.startsWith('board-')) continue;
				for (const pin of partDef(part.type).pins) {
					const position = pinPosition(part, pin.name);
					if (!position) continue;
					const hole = holeNear(sketch, position);
					if (!hole) {
						loose.push(`${part.id}:${pin.name}`);
						continue;
					}
					const group = tieGroup(hole.col, hole.row);
					if (!group) continue;
					strips.set(group, [...(strips.get(group) ?? []), part.id]);
				}
			}
			// A module with two header rows sits off the board in this model, so
			// its pins are loose on purpose; everything else has to land.
			const offBoard = sketch.parts.filter((part) => part.x > 580).map((part) => part.id);
			expect(loose.filter((pin) => !offBoard.includes(pin.split(':')[0]))).toEqual([]);
			const bridged = [...strips]
				.filter(([, ids]) => new Set(ids).size > 1)
				.map(([group, ids]) => `${group} = ${ids.join(',')}`);
			expect(bridged).toEqual([]);
		});

		it(`${label} ships a MicroPython program`, () => {
			expect(sketch.programs?.esp?.files?.[0]?.name).toBe('main.py');
			expect(sketch.programs?.esp?.files?.[0]?.text).toContain('while True:');
		});
	}
});
