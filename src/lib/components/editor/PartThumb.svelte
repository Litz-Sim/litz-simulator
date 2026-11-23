<script lang="ts">
	import { onMount } from 'svelte';
	import type { PartDef } from '#lib/parts/types';
	import type { PartInstance } from '#lib/sketch/types';

	let { def, size = 46 }: { def: PartDef; size?: number } = $props();
	let canvas: HTMLCanvasElement;

	onMount(() => {
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.round(size * dpr);
		canvas.height = Math.round(size * dpr);
		canvas.style.width = `${size}px`;
		canvas.style.height = `${size}px`;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.scale(dpr, dpr);
		const scale = Math.min((size * 0.86) / def.width, (size * 0.86) / def.height);
		const attrs: PartInstance['attrs'] = {};
		for (const attr of def.attrs) attrs[attr.name] = attr.default;
		const probe: PartInstance = { id: 'thumb', type: def.type, x: 0, y: 0, rotate: 0, attrs };
		ctx.translate(size / 2, size / 2);
		ctx.scale(scale, scale);
		def.draw(ctx, probe, 1);
	});
</script>

<canvas bind:this={canvas} class="shrink-0"></canvas>
