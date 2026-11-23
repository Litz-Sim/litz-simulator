<script lang="ts">
	import { artBounds, artRevision } from '#lib/parts/svgArt.svelte';
	import type { PartDef } from '#lib/parts/types';
	import type { PartInstance } from '#lib/sketch/types';

	let { def, size = 46 }: { def: PartDef; size?: number } = $props();
	let canvas: HTMLCanvasElement;

	// Art arrives asynchronously, so redraw whenever a new asset has decoded.
	$effect(() => {
		void artRevision.value;
		const element = canvas;
		if (!element) return;
		const dpr = window.devicePixelRatio || 1;
		element.width = Math.round(size * dpr);
		element.height = Math.round(size * dpr);
		element.style.width = `${size}px`;
		element.style.height = `${size}px`;
		const ctx = element.getContext('2d');
		if (!ctx) return;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, element.width, element.height);
		ctx.scale(dpr, dpr);
		const attrs: PartInstance['attrs'] = {};
		for (const attr of def.attrs) attrs[attr.name] = attr.default;
		const probe: PartInstance = { id: 'thumb', type: def.type, x: 0, y: 0, rotate: 0, attrs };
		const bounds = artBounds(def.type) ?? {
			x: -def.width / 2,
			y: -def.height / 2,
			w: def.width,
			h: def.height
		};
		const scale = Math.min((size * 0.86) / bounds.w, (size * 0.86) / bounds.h);
		ctx.translate(
			size / 2 - (bounds.x + bounds.w / 2) * scale,
			size / 2 - (bounds.y + bounds.h / 2) * scale
		);
		ctx.scale(scale, scale);
		def.draw(ctx, probe, 1);
	});
</script>

<canvas bind:this={canvas} class="shrink-0"></canvas>
