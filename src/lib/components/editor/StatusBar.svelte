<script lang="ts">
	import { canvasStatus } from '#lib/canvas/status.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { sim } from '#lib/sim/controller.svelte';
	import { link } from '#lib/sim/editorLink.svelte';
	import { doc } from '#lib/sketch/doc.svelte';
	import { projects } from '#lib/storage/projects.svelte';
	import { ui } from '#lib/ui.svelte';
	import Icon from './Icon.svelte';

	const saveLabel = $derived(
		doc.projectError ??
			(doc.saveState === 'saved'
				? m.save_state_saved()
				: doc.saveState === 'pending'
					? m.save_state_pending()
					: m.save_state_error())
	);
	const saveIcon = $derived(
		doc.projectError || doc.saveState === 'error'
			? 'save-error'
			: doc.saveState === 'pending'
				? 'save-pending'
				: 'save-ok'
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
	class="flex h-7 shrink-0 items-center gap-4 overflow-x-auto border-t border-stone-300 bg-stone-100 px-3 text-[11px] whitespace-nowrap text-stone-600 [@media(pointer:coarse)]:h-8"
>
	<span>{m.status_zoom({ percent: Math.round(canvasStatus.zoom * 100) })}</span>
	<span class="hidden sm:inline">{m.status_grid({ size: 20 })}</span>
	<span class="hidden md:inline">
		X {Math.round(canvasStatus.x)} &nbsp; Y {Math.round(canvasStatus.y)}
	</span>
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
			<span class="hidden text-stone-500 lg:inline">
				{m.status_heap({ kb: (sim.heap / 1024).toFixed(1) })}
			</span>
		{/if}
		{#if sim.analog}
			<span class="text-stone-500">{m.menu_analog()}</span>
		{/if}
		<span class="hidden text-stone-500 sm:inline">
			{m.status_speed({ value: sim.speed === 0 ? '∞' : sim.speed })}
		</span>
	{/if}
	{#if link.status === 'online'}
		<button
			type="button"
			class="flex items-center gap-1 text-emerald-700 hover:text-emerald-800"
			title={m.link_title()}
			onclick={() => (ui.linkOpen = true)}
		>
			<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
			CLI{link.project ? ` · ${link.project}` : ''}
		</button>
	{/if}
	<div class="ml-auto flex items-center gap-3">
		{#if projects.provider === 's3' && projects.ready && projects.key}
			<button
				type="button"
				class="flex items-center gap-1 {projects.sync === 'error'
					? 'text-red-600'
					: projects.sync === 'saving'
						? 'text-amber-700'
						: 'text-stone-500'} hover:text-stone-700"
				title={projects.error ?? projects.key}
				onclick={() => (ui.projectsOpen = true)}
			>
				<Icon name="folder" size={12} />
				{projects.sync === 'error'
					? m.status_storage_error()
					: projects.sync === 'saving'
						? m.status_storage_saving()
						: m.status_storage()}
			</button>
		{/if}
		<span class="hidden text-stone-500 sm:inline">
			{m.status_counts({ parts: doc.sketch.parts.length, wires: doc.sketch.wires.length })}
		</span>
		<span
			class="flex items-center gap-1 {saveClass}"
			title={doc.projectError ?? doc.saveError ?? ''}
		>
			<Icon name={saveIcon} size={12} />
			{saveLabel}
		</span>
		<span class="hidden max-w-40 truncate text-stone-400 md:inline" title={doc.name}>
			{doc.name}
		</span>
	</div>
</div>
