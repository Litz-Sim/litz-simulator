import { describe, expect, it } from 'vitest';
import { partDef } from '#lib/parts/registry';
import { buttonLedSketch, oledSketch, potSketch, trafficLightSketch } from './examples-extra';
import type { Sketch } from './types';

const examples: [string, (name: string) => Sketch][] = [
	['pot', potSketch],
	['button', buttonLedSketch],
	['oled', oledSketch],
	['traffic', trafficLightSketch]
];

describe('extra examples', () => {
	for (const [label, build] of examples) {
		it(`${label} wires only pins that exist`, () => {
			const sketch = build(label);
			const parts = new Map(sketch.parts.map((part) => [part.id, part]));
			expect(parts.size).toBe(sketch.parts.length);
			const problems: string[] = [];
			for (const wire of sketch.wires) {
				for (const endpoint of [wire.from, wire.to]) {
					if (endpoint.kind !== 'pin' || !endpoint.part || !endpoint.pin) continue;
					const part = parts.get(endpoint.part);
					if (!part) {
						problems.push(`${wire.id}: no part ${endpoint.part}`);
						continue;
					}
					const def = partDef(part.type);
					if (!def.pins.some((pin) => pin.name === endpoint.pin)) {
						problems.push(`${wire.id}: ${part.type} has no pin ${endpoint.pin}`);
					}
				}
			}
			expect(problems).toEqual([]);
		});
	}
});
