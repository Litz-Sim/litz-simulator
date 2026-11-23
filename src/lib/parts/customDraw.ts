import { livePart, liveState } from '#lib/sim/live';
import type { Level, PartState } from '#lib/sim/backend';
import { sim } from '#lib/sim/controller.svelte';
import type { PartInstance } from '#lib/sketch/types';
import type { RangeRule } from './packages';

/** Decoded artwork of one installed part, keyed the way its package names it. */
export interface ArtImages {
	default: HTMLImageElement | null;
	states: Map<string, HTMLImageElement>;
	ranges: { rule: RangeRule; image: HTMLImageElement }[];
	pins: { pin: string; level: Level; image: HTMLImageElement }[];
}

export interface ArtOverride {
	/** Draw this state instead of the live one, for a builder's preview. */
	state?: PartState | null;
	value?: number;
}

function pick(
	images: ArtImages,
	instance: Pick<PartInstance, 'id'>,
	override: ArtOverride
): HTMLImageElement | null {
	for (const rule of images.pins) {
		const level = sim.partPin(instance.id, rule.pin);
		if (level === rule.level) return rule.image;
	}
	const state = override.state !== undefined ? override.state : (liveState(instance.id) ?? null);
	if (state && images.states.has(state)) return images.states.get(state) ?? null;
	const value = override.value ?? livePart(instance.id)?.value ?? 0;
	for (const entry of images.ranges) {
		if (entry.rule.state !== state) continue;
		if (value >= entry.rule.min && value <= entry.rule.max) return entry.image;
	}
	return images.default;
}

/** Draw an installed part, scaled to the box its package declared. */
export function drawPackagePart(
	ctx: CanvasRenderingContext2D,
	instance: Pick<PartInstance, 'id'>,
	images: ArtImages,
	width: number,
	height: number,
	name: string,
	override: ArtOverride = {}
): void {
	const image = pick(images, instance, override);
	ctx.save();
	if (image && image.complete && image.naturalWidth > 0) {
		const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
		const drawnWidth = image.naturalWidth * scale;
		const drawnHeight = image.naturalHeight * scale;
		ctx.drawImage(image, -drawnWidth / 2, -drawnHeight / 2, drawnWidth, drawnHeight);
	} else {
		ctx.fillStyle = '#e7e2d6';
		ctx.strokeStyle = '#8b8577';
		ctx.lineWidth = 1.4;
		ctx.beginPath();
		ctx.roundRect(-width / 2, -height / 2, width, height, Math.min(8, width / 8));
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = '#5f5a4e';
		ctx.font = `${Math.max(8, Math.min(14, width / 10))}px ui-sans-serif, system-ui, sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(name, 0, 0, width - 8);
	}
	ctx.restore();
}
