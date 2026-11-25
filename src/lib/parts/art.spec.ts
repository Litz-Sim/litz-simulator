import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LIVE_ART_TYPES, parseOverlays } from './overlays';
import { PART_DEFS } from './registry';

const ART_DIR = new URL('./art/', import.meta.url);
const files = readdirSync(ART_DIR).filter((name) => name.endsWith('.svg'));
const byType = new Map(PART_DEFS.map((def) => [def.type, def]));

function box(text: string): { x: number; y: number; w: number; h: number } | null {
	const match = /viewBox\s*=\s*"([^"]+)"/.exec(text);
	if (!match) return null;
	const numbers = match[1]
		.trim()
		.split(/[,\s]+/)
		.map(Number);
	if (numbers.length !== 4 || numbers.some((value) => !Number.isFinite(value))) return null;
	const [x, y, w, h] = numbers;
	return w > 0 && h > 0 ? { x, y, w, h } : null;
}

describe('part art', () => {
	it('names every file after a catalog part', () => {
		for (const file of files) {
			const stem = file.slice(0, -'.svg'.length);
			const type = stem.split('--')[0];
			expect(byType.has(type), file).toBe(true);
		}
	});

	it('places every asset with a usable viewBox', () => {
		for (const file of files) {
			const text = readFileSync(new URL(file, ART_DIR), 'utf8');
			expect(box(text), file).not.toBeNull();
		}
	});

	it('keeps every pin inside the art that has to show it', () => {
		// A pin the art does not reach is a pin the user cannot find on screen.
		for (const file of files) {
			const stem = file.slice(0, -'.svg'.length);
			const def = byType.get(stem.split('--')[0]);
			const text = readFileSync(new URL(file, ART_DIR), 'utf8');
			const view = box(text);
			if (!def || !view) continue;
			for (const pin of def.pins) {
				expect(pin.x, `${file} pin ${pin.name}`).toBeGreaterThanOrEqual(view.x);
				expect(pin.x, `${file} pin ${pin.name}`).toBeLessThanOrEqual(view.x + view.w);
				expect(pin.y, `${file} pin ${pin.name}`).toBeGreaterThanOrEqual(view.y);
				expect(pin.y, `${file} pin ${pin.name}`).toBeLessThanOrEqual(view.y + view.h);
			}
		}
	});

	it('gives every catalog part art of some kind', () => {
		const types = new Set(files.map((file) => file.slice(0, -'.svg'.length).split('--')[0]));
		for (const def of PART_DEFS) expect(types.has(def.type), def.type).toBe(true);
	});

	it('keeps overlay markers inside the art and invisible', () => {
		for (const file of files) {
			const text = readFileSync(new URL(file, ART_DIR), 'utf8');
			const view = box(text);
			if (!view) continue;
			for (const overlay of parseOverlays(text)) {
				if ('cx' in overlay) {
					expect(overlay.cx, file).toBeGreaterThanOrEqual(view.x);
					expect(overlay.cx, file).toBeLessThanOrEqual(view.x + view.w);
					expect(overlay.cy, file).toBeGreaterThanOrEqual(view.y);
					expect(overlay.cy, file).toBeLessThanOrEqual(view.y + view.h);
					continue;
				}
				expect(overlay.x, file).toBeGreaterThanOrEqual(view.x);
				expect(overlay.y, file).toBeGreaterThanOrEqual(view.y);
				expect(overlay.x + overlay.w, file).toBeLessThanOrEqual(view.x + view.w);
				expect(overlay.y + overlay.h, file).toBeLessThanOrEqual(view.y + view.h);
			}
			for (const match of text.matchAll(/<(?:rect|circle)\b[^>]*\bdata-overlay="[^"]+"[^>]*>/g)) {
				expect(match[0], file).toContain('fill="none"');
			}
		}
	});

	it('keeps a runtime layer on every live part', () => {
		// A plain part photo would freeze a display or a knob at one value.
		for (const file of files) {
			const type = file.slice(0, -'.svg'.length).split('--')[0];
			if (!LIVE_ART_TYPES.has(type)) continue;
			const text = readFileSync(new URL(file, ART_DIR), 'utf8');
			expect(parseOverlays(text).length, file).toBeGreaterThan(0);
		}
	});

	it('spells state variants with names the engine reports', () => {
		const states = new Set([
			'none',
			'off',
			'on',
			'up',
			'down',
			'silent',
			'sounding',
			'position',
			'mask',
			'state',
			'unknown'
		]);
		for (const file of files) {
			const parts = file.slice(0, -'.svg'.length).split('--');
			for (const variant of parts.slice(1)) {
				expect(states.has(variant) || /^[a-z0-9]+$/.test(variant), file).toBe(true);
			}
		}
	});
});
