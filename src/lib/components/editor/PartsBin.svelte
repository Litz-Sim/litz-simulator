<script lang="ts">
	import { canvasControl } from '#lib/canvas/control';
	import { m } from '#lib/paraglide/messages.js';
	import { BOARD_MIME, PART_MIME } from '#lib/canvas/drag';
	import { categoryLabel } from '#lib/i18n/labels';
	import { partDefsByCategory } from '#lib/parts/registry';
	import { customParts } from '#lib/parts/custom.svelte';
	import { doc } from '#lib/sketch/doc.svelte';
	import type { BoardType } from '#lib/sketch/types';
	import Icon from './Icon.svelte';
	import PartThumb from './PartThumb.svelte';

	let { onAdd }: { onAdd?: () => void } = $props();
	let query = $state('');
	const groups = $derived(partDefsByCategory(customParts));

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

	function addPart(type: string): void {
		canvasControl.engine?.addPartAtCenter(type);
		onAdd?.();
	}

	function addBoard(type: BoardType): void {
		const center = canvasControl.engine?.centerWorld() ?? { x: 0, y: 0 };
		doc.addBoard(type, center.x, center.y);
		onAdd?.();
	}

	function dragPart(event: DragEvent, type: string): void {
		event.dataTransfer?.setData(PART_MIME, type);
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
	}

	function dragBoard(event: DragEvent, type: BoardType): void {
		event.dataTransfer?.setData(BOARD_MIME, type);
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
	}
</script>

<div class="flex h-full flex-col">
	<div class="relative px-3 pt-3 pb-2">
		<Icon
			name="search"
			size={14}
			class="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-stone-400"
		/>
		<input
			type="search"
			placeholder={m.search_parts()}
			bind:value={query}
			class="w-full rounded-md border border-stone-300 bg-white py-1.5 pr-2.5 pl-8 text-[13px] text-stone-800 outline-none placeholder:text-stone-400 focus:border-stone-500 [@media(pointer:coarse)]:py-2.5"
		/>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
		{#if query.trim()}
			<ul class="space-y-0.5">
				{#each matches as def (def.type)}
					<li>
						<button
							type="button"
							draggable="true"
							class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-stone-200/70 [@media(pointer:coarse)]:py-2.5"
							onclick={() => addPart(def.type)}
							ondragstart={(event) => dragPart(event, def.type)}
						>
							<PartThumb {def} />
							<span class="min-w-0">
								<span class="block truncate text-[13px] text-stone-800">{def.name}</span>
								<span class="block truncate text-[11px] text-stone-500">{def.type}</span>
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="px-2 pt-1 pb-2 text-[11px] font-medium tracking-wide text-stone-500">
				{m.breadboard()}
			</p>
			<div class="mb-4 flex gap-1.5 px-1">
				<button
					type="button"
					draggable="true"
					class="flex-1 rounded-md border border-stone-300 bg-white px-2 py-2 text-[12px] text-stone-700 hover:border-stone-400"
					onclick={() => addBoard('breadboard-full')}
					ondragstart={(event) => dragBoard(event, 'breadboard-full')}
				>
					{m.bb_full()}
				</button>
				<button
					type="button"
					draggable="true"
					class="flex-1 rounded-md border border-stone-300 bg-white px-2 py-2 text-[12px] text-stone-700 hover:border-stone-400"
					onclick={() => addBoard('breadboard-half')}
					ondragstart={(event) => dragBoard(event, 'breadboard-half')}
				>
					{m.bb_half()}
				</button>
			</div>

			{#each groups as group (group.category)}
				<p class="px-2 pt-1 pb-2 text-[11px] font-medium tracking-wide text-stone-500">
					{categoryLabel(group.category)}
				</p>
				<ul class="mb-4 space-y-0.5">
					{#each group.defs as def (def.type)}
						<li>
							<button
								type="button"
								draggable="true"
								class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-stone-200/70 [@media(pointer:coarse)]:py-2.5"
								onclick={() => addPart(def.type)}
								ondragstart={(event) => dragPart(event, def.type)}
							>
								<PartThumb {def} />
								<span class="min-w-0">
									<span class="block truncate text-[13px] text-stone-800">{def.name}</span>
									<span class="block truncate text-[11px] text-stone-500">{def.type}</span>
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{/each}
		{/if}
	</div>
</div>
