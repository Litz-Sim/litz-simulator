<script lang="ts">
	import Icon from '#lib/components/editor/Icon.svelte';
	import { m } from '#lib/paraglide/messages.js';

	let {
		url = null,
		onpick,
		onclear
	}: {
		url?: string | null;
		onpick: (file: File) => void;
		onclear: () => void;
	} = $props();

	function changed(event: Event & { currentTarget: HTMLInputElement }): void {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		if (file) onpick(file);
	}
</script>

<div class="flex items-center gap-2">
	<div
		class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-stone-300 bg-white"
	>
		{#if url}
			<img src={url} alt="" class="max-h-full max-w-full object-contain" />
		{:else}
			<span class="text-[10px] text-stone-300">—</span>
		{/if}
	</div>
	<div class="flex flex-wrap items-center gap-1">
		<label
			class="cursor-pointer rounded-md border border-stone-300 bg-white px-2 py-1 text-[12px] text-stone-700 hover:border-stone-400 [@media(pointer:coarse)]:py-2"
		>
			{m.author_image_pick()}
			<input
				type="file"
				class="sr-only"
				accept="image/png,image/jpeg,image/webp,image/svg+xml"
				aria-label={m.author_image_pick()}
				onchange={changed}
			/>
		</label>
		{#if url}
			<button
				type="button"
				title={m.settings_remove()}
				aria-label={m.settings_remove()}
				class="flex h-7 w-7 items-center justify-center rounded text-stone-400 hover:bg-stone-100 hover:text-red-600 [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:w-9"
				onclick={onclear}
			>
				<Icon name="close" size={14} />
			</button>
		{/if}
	</div>
</div>
