import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { canvasControl } from '#lib/canvas/control';
import { liveState } from '#lib/sim/live';
import type { PartInstance } from '#lib/sketch/types';
import type { PartDef } from './types';
import { drawOverlay, parseOverlays, type Overlay } from './overlays';

/**
 * Built-in part art, loaded from `./art/<type>[--<variant>].svg`.
 *
 * A variant is a state name (`on`, `down`, …), an attribute value (`red`), or
 * both joined by `--`. The file's viewBox is its placement: the art draws at
 * exactly those local units, so the asset decides where it sits relative to the
 * part anchor and nothing in code has to know the size.
 */

interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

interface Art {
	image: HTMLImageElement;
	box: Box;
	overlays: Overlay[];
}

const catalog = new SvelteMap<string, Map<string, () => Promise<string>>>();
const loaded = new SvelteMap<string, Art>();
const pending = new SvelteSet<string>();

const sources = import.meta.glob('./art/*.svg', { query: '?raw', import: 'default' }) as Record<
	string,
	() => Promise<string>
>;

for (const [path, load] of Object.entries(sources)) {
	const file = path.slice('./art/'.length, -'.svg'.length);
	const split = file.indexOf('--');
	const type = split < 0 ? file : file.slice(0, split);
	const variant = split < 0 ? '' : file.slice(split + 2);
	const variants = catalog.get(type) ?? new SvelteMap<string, () => Promise<string>>();
	variants.set(variant, load);
	catalog.set(type, variants);
}

/** Bumped when an asset finishes decoding, so thumbnails repaint with the art. */
export const artRevision = $state({ value: 0 });

export function hasArt(type: string): boolean {
	return catalog.has(type);
}

function viewBox(text: string): Box | null {
	const match = /viewBox\s*=\s*"[-\d.]+[,\s]+[-\d.]+[,\s]+[-\d.]+[,\s]+[-\d.]+"/.exec(text);
	if (!match) return null;
	const numbers = match[0]
		.replace(/viewBox\s*=\s*"/, '')
		.slice(0, -1)
		.trim()
		.split(/[,\s]+/);
	if (numbers.length !== 4) return null;
	const [x, y, w, h] = numbers.map(Number);
	return Number.isFinite(x + y + w + h) && w > 0 && h > 0 ? { x, y, w, h } : null;
}

function load(type: string, variant: string, loader: () => Promise<string>): void {
	const key = `${type}\u0000${variant}`;
	if (pending.has(key) || loaded.has(key)) return;
	pending.add(key);
	void loader().then((text) => {
		const box = viewBox(text);
		if (!box) {
			console.warn(`part art ${type}${variant ? ` (${variant})` : ''}: missing viewBox`);
			return;
		}
		const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
		const overlays = parseOverlays(text);
		const image = new Image();
		image.onload = () => {
			loaded.set(key, { image, box, overlays });
			artRevision.value += 1;
			canvasControl.engine?.invalidate();
		};
		image.onerror = () => console.warn(`part art ${type}${variant ? ` (${variant})` : ''}: failed`);
		image.src = url;
	});
}

/** The variant for this instance: attribute then state, then each alone, then default. */
function variantOf(def: PartDef, part: PartInstance): string | null {
	const variants = catalog.get(def.type);
	if (!variants) return null;
	const state = livePartState(part.id);
	const value = def.artAttr ? String(part.attrs[def.artAttr] ?? '').trim() : '';
	const candidates = [value && state ? `${value}--${state}` : '', value, state].filter(Boolean);
	for (const candidate of candidates) {
		if (variants.has(candidate)) return candidate;
	}
	return variants.has('') ? '' : null;
}

function livePartState(id: string): string {
	const state = liveState(id);
	return state ? String(state) : '';
}

function artOf(def: PartDef, part: PartInstance): Art | null {
	const variants = catalog.get(def.type);
	if (!variants) return null;
	const variant = variantOf(def, part);
	if (variant === null) return null;
	const key = `${def.type}\u0000${variant}`;
	const art = loaded.get(key);
	if (art) return art.image.complete ? art : null;
	const loader = variants.get(variant);
	if (loader) load(def.type, variant, loader);
	return null;
}

/** Draw the part's art at its own viewBox; a part without art keeps its vector draw. */
export function drawArt(ctx: CanvasRenderingContext2D, part: PartInstance, def: PartDef): void {
	const art = artOf(def, part);
	if (!art) return;
	ctx.drawImage(art.image, art.box.x, art.box.y, art.box.w, art.box.h);
	for (const overlay of art.overlays) drawOverlay(ctx, part, def, overlay);
}

/** The viewBox of a type's default asset, once decoded, so a thumbnail can frame the art. */
export function artBounds(type: string): Box | null {
	for (const [key, art] of loaded) {
		if (key.startsWith(`${type}\u0000`)) return art.box;
	}
	return null;
}

/** Swap a catalog definition's drawing for its SVG asset, when the asset exists. */
export function withArt(def: PartDef): PartDef {
	if (!catalog.has(def.type)) return def;
	return { ...def, draw: (ctx, part) => drawArt(ctx, part, def) };
}
