<script lang="ts">
	import { canvasControl } from '#lib/canvas/control';
	import { m } from '#lib/paraglide/messages.js';
	import { doc } from '#lib/sketch/doc.svelte';
	import Icon from './Icon.svelte';

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
	class="flex h-9 shrink-0 items-stretch gap-0.5 overflow-x-auto border-b border-stone-300 bg-stone-100 px-1.5 [@media(pointer:coarse)]:h-11"
>
	{#each doc.tabs as tab, index (tab.id)}
		<div
			class="group my-1 flex h-7 max-w-52 min-w-0 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] transition-colors [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:px-3 [@media(pointer:coarse)]:text-[13px] {index ===
			doc.activeTab
				? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-300'
				: 'text-stone-500 hover:bg-stone-200/70 hover:text-stone-800'}"
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
					class="min-w-0 truncate"
					title={tab.name}
					onclick={() => doc.switchTab(index)}
					ondblclick={() => begin(index)}
				>
					{tab.name}
				</button>
				<button
					type="button"
					aria-label={m.tab_close()}
					title={m.tab_close()}
					class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-stone-400 opacity-0 transition-colors group-hover:opacity-100 hover:bg-stone-200 hover:text-stone-700 [@media(pointer:coarse)]:h-7 [@media(pointer:coarse)]:w-7 [@media(pointer:coarse)]:opacity-100"
					onclick={(event) => {
						event.stopPropagation();
						doc.closeTab(index);
					}}
				>
					<Icon name="close" size={12} />
				</button>
			{/if}
		</div>
	{/each}
	<button
		type="button"
		aria-label={m.tab_new()}
		title={m.tab_new()}
		class="my-1 ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-stone-500 transition-colors hover:bg-stone-200 hover:text-stone-900 [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:w-9"
		onclick={addTab}
	>
		<Icon name="plus" size={14} />
	</button>
</div>
