import { writeFileSync, mkdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import { PART_DEFS } from './registry';

it.runIf(process.env.FRITZING)('dumps the catalog for the Fritzing converter', () => {
	const defs = PART_DEFS.map((def) => ({
		type: def.type,
		name: def.name,
		category: def.category,
		keywords: def.keywords,
		width: def.width,
		height: def.height,
		chip: def.chip ?? null,
		pins: def.pins.map((pin) => ({ name: pin.name, label: pin.label ?? null, x: pin.x, y: pin.y }))
	}));
	expect(defs.length).toBeGreaterThan(0);
	mkdirSync('build/fritzing', { recursive: true });
	writeFileSync('build/fritzing/catalog.json', JSON.stringify(defs, null, '\t'));
});
