<script lang="ts">
	import { canvasStatus } from '#lib/canvas/status.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { sim } from '#lib/sim/controller.svelte';
	import { doc } from '#lib/sketch/doc.svelte';

	const saveLabel = $derived(
		doc.projectError ??
			(doc.saveState === 'saved'
				? m.save_state_saved()
				: doc.saveState === 'pending'
					? m.save_state_pending()
					: m.save_state_error())
	);
	const saveClass = $derived(
		doc.projectError || doc.saveState === 'error'
			? 'text-red-600'
			: doc.saveState === 'pending'
				? 'text-amber-700'
				: 'text-stone-500'
	);
</script>

<div
	class="flex h-6 shrink-0 items-center gap-3 overflow-x-auto border-t border-stone-300 bg-stone-100 px-2 text-[11px] whitespace-nowrap text-stone-600 [@media(pointer:coarse)]:h-8"
>
	<span>{m.status_zoom({ percent: Math.round(canvasStatus.zoom * 100) })}</span>
	<span class="text-stone-300">|</span>
	<span>{m.status_grid({ size: 20 })}</span>
	<span class="text-stone-300">|</span>
	<span>X {Math.round(canvasStatus.x)} &nbsp; Y {Math.round(canvasStatus.y)}</span>
	<span class="text-stone-300">|</span>
	<span
		class={sim.error
			? 'text-red-600'
			: sim.paused
				? 'text-amber-700'
				: sim.running
					? 'text-emerald-700'
					: 'text-stone-500'}
	>
		{sim.chipSummary ? m.sim_with_chip({ status: sim.status, chip: sim.chipSummary }) : sim.status}
	</span>
	{#if sim.running}
		{#if sim.heap !== null}
			<span class="text-stone-300">|</span>
			<span class="text-stone-500">{m.status_heap({ kb: (sim.heap / 1024).toFixed(1) })}</span>
		{/if}
		{#if sim.analog}
			<span class="text-stone-300">|</span>
			<span class="text-stone-500">{m.menu_analog()}</span>
		{/if}
		<span class="text-stone-300">|</span>
		<span class="text-stone-500">
			{m.status_speed({ value: sim.speed === 0 ? '∞' : sim.speed })}
		</span>
	{/if}
	<span class="ml-auto">
		{m.status_counts({ parts: doc.sketch.parts.length, wires: doc.sketch.wires.length })}
	</span>
	<span class="text-stone-300">|</span>
	<span class={saveClass} title={doc.projectError ?? doc.saveError ?? ''}>{saveLabel}</span>
	<span class="text-stone-300">|</span>
	<span class="text-stone-400">{doc.name}</span>
</div>
