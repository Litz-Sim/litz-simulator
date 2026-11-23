<script lang="ts">
	import { canvasControl } from '#lib/canvas/control';
	import { m } from '#lib/paraglide/messages.js';
	import { doc } from '#lib/sketch/doc.svelte';

	function addTab(): void {
		doc.newTab();
		requestAnimationFrame(() => canvasControl.engine?.fit());
	}

	let editing = $state<number | null>(null);
	let draft = $state('');

	function begin(index: number): void {
		editing = index;
		draft = doc.tabs[index].name;
	}

	function commit(): void {
		if (editing === null) return;
		doc.renameTab(draft);
		editing = null;
	}

	function focus(node: HTMLInputElement): void {
		node.focus();
		node.select();
	}
</script>

<div
	class="flex h-8 shrink-0 items-center gap-0 overflow-x-auto border-b border-stone-300 bg-stone-200/70 pl-1 [@media(pointer:coarse)]:h-11"
>
	{#each doc.tabs as tab, index (tab.id)}
		<div
			class="group relative flex h-7 max-w-48 shrink-0 items-center gap-1 rounded-t border border-b-0 px-2 text-[12px] [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:px-3 [@media(pointer:coarse)]:text-[13px] {index ===
			doc.activeTab
				? 'border-stone-300 bg-stone-50 text-stone-800'
				: 'border-transparent text-stone-500 hover:bg-stone-300/60'}"
		>
			{#if editing === index}
				<input
					bind:value={draft}
					use:focus
					class="w-32 rounded border border-stone-400 bg-white px-1 text-[12px]"
					onblur={commit}
					onkeydown={(event) => {
						if (event.key === 'Enter') commit();
						if (event.key === 'Escape') editing = null;
					}}
				/>
			{:else}
				<button
					type="button"
					class="truncate"
					onclick={() => doc.switchTab(index)}
					ondblclick={() => begin(index)}
				>
					{tab.name}
				</button>
				<button
					type="button"
					aria-label={m.tab_close()}
					class="rounded px-0.5 text-stone-400 opacity-0 group-hover:opacity-100 hover:bg-stone-300 hover:text-stone-700 [@media(pointer:coarse)]:px-1.5 [@media(pointer:coarse)]:opacity-100"
					onclick={(event) => {
						event.stopPropagation();
						doc.closeTab(index);
					}}
				>
					×
				</button>
			{/if}
		</div>
	{/each}
	<button
		type="button"
		aria-label={m.tab_new()}
		class="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-[15px] leading-none text-stone-600 hover:bg-stone-300 [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:w-9"
		onclick={addTab}
	>
		+
	</button>
</div>
