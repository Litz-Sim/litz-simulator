<script lang="ts">
	import { canvasControl } from '#lib/canvas/control';
	import { m } from '#lib/paraglide/messages.js';
	import { categoryLabel } from '#lib/i18n/labels';
	import { partDefsByCategory } from '#lib/parts/registry';
	import { ui } from '#lib/ui.svelte';
	import PartThumb from './PartThumb.svelte';

	let query = $state('');
	const groups = partDefsByCategory();

	const matches = $derived(
		groups
			.flatMap((group) => group.defs)
			.filter((def) => {
				const text = query.trim().toLowerCase();
				if (!text) return true;
				return (
					def.name.toLowerCase().includes(text) ||
					def.type.toLowerCase().includes(text) ||
					def.keywords.some((word) => word.includes(text))
				);
			})
	);

	function add(type: string): void {
		canvasControl.engine?.addPartAtCenter(type);
		ui.addOpen = false;
		query = '';
	}

	function focus(node: HTMLInputElement): void {
		node.focus();
	}

	function close(): void {
		ui.addOpen = false;
		query = '';
	}
</script>

<svelte:window
	onkeydown={(event: KeyboardEvent) => {
		if (ui.addOpen && event.key === 'Escape') close();
	}}
/>

{#if ui.addOpen}
	<div class="fixed inset-0 z-[100]">
		<button
			type="button"
			aria-label={m.close()}
			class="absolute inset-0 bg-black/25"
			onclick={close}
		></button>
		<div
			class="relative mx-auto mt-24 flex max-h-[70vh] w-[min(560px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-stone-300 bg-white shadow-2xl [@media(pointer:coarse)]:mt-12 [@media(pointer:coarse)]:max-h-[85vh]"
			role="dialog"
			aria-label={m.add_part_title()}
		>
			<div class="border-b border-stone-200 p-3">
				<input
					bind:value={query}
					use:focus
					placeholder={m.add_part_search()}
					class="w-full rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-[13px] outline-none focus:border-stone-500"
					onkeydown={(event) => {
						if (event.key === 'Enter' && matches[0]) add(matches[0].type);
					}}
				/>
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto p-2">
				{#if !query.trim()}
					<p
						class="sticky top-0 bg-white px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-stone-500"
					>
						{m.breadboard()}
					</p>
					<div class="mb-2 flex gap-1.5 px-1">
						<button
							type="button"
							class="flex-1 rounded border border-stone-300 bg-stone-50 px-2 py-1.5 text-[12px] text-stone-700 hover:border-stone-400"
							onclick={() => {
								canvasControl.engine?.addBoardAtCenter('breadboard-full');
								ui.addOpen = false;
							}}
						>
							{m.bb_full()}
						</button>
						<button
							type="button"
							class="flex-1 rounded border border-stone-300 bg-stone-50 px-2 py-1.5 text-[12px] text-stone-700 hover:border-stone-400"
							onclick={() => {
								canvasControl.engine?.addBoardAtCenter('breadboard-half');
								ui.addOpen = false;
							}}
						>
							{m.bb_half()}
						</button>
					</div>
				{/if}
				{#if query.trim()}
					{#each matches as def (def.type)}
						<button
							type="button"
							class="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-stone-100 [@media(pointer:coarse)]:py-3"
							onclick={() => add(def.type)}
						>
							<PartThumb {def} size={40} />
							<span class="min-w-0">
								<span class="block truncate text-[13px] text-stone-800">{def.name}</span>
								<span class="block truncate text-[11px] text-stone-500">{def.type}</span>
							</span>
						</button>
					{/each}
				{:else}
					{#each groups as group (group.category)}
						<p
							class="sticky top-0 bg-white px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-stone-500"
						>
							{categoryLabel(group.category)}
						</p>
						{#each group.defs as def (def.type)}
							<button
								type="button"
								class="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-stone-100 [@media(pointer:coarse)]:py-3"
								onclick={() => add(def.type)}
							>
								<PartThumb {def} size={40} />
								<span class="min-w-0">
									<span class="block truncate text-[13px] text-stone-800">{def.name}</span>
									<span class="block truncate text-[11px] text-stone-500">{def.type}</span>
								</span>
							</button>
						{/each}
					{/each}
				{/if}
			</div>

			<div
				class="flex items-center justify-between border-t border-stone-200 px-3 py-1.5 text-[11px] text-stone-400"
			>
				<span>{m.add_part_hint()}</span>
				<span>{m.add_part_count({ count: matches.length })}</span>
			</div>
		</div>
	</div>
{/if}
