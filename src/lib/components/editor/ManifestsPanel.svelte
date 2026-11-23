<script lang="ts">
	let {
		manifests,
		title,
		hint,
		nameLabel,
		textLabel,
		addLabel,
		removeLabel,
		emptyLabel,
		onadd,
		onremove
	}: {
		manifests: { name: string; text: string }[];
		title: string;
		hint: string;
		nameLabel: string;
		textLabel: string;
		addLabel: string;
		removeLabel: string;
		emptyLabel: string;
		onadd: (name: string, text: string) => boolean;
		onremove: (name: string) => void;
	} = $props();

	let name = $state('');
	let text = $state('');

	function submit(event: SubmitEvent): void {
		event.preventDefault();
		if (onadd(name, text)) {
			name = '';
			text = '';
		}
	}
</script>

<div class="flex h-full min-h-0 flex-col gap-2 px-3 py-2 text-[11px] text-stone-700">
	<div>
		<h3 class="text-[11px] font-medium text-stone-600">{title}</h3>
		<p class="text-[10px] text-stone-400">{hint}</p>
	</div>

	{#if manifests.length}
		<ul class="max-h-40 space-y-1 overflow-y-auto">
			{#each manifests as manifest (manifest.name)}
				<li class="flex items-start gap-2 rounded border border-stone-200 bg-white px-2 py-1">
					<span class="w-32 shrink-0 truncate font-mono text-stone-700">{manifest.name}</span>
					<span class="min-w-0 flex-1 truncate font-mono text-[10px] text-stone-400">
						{manifest.text.replace(/\s+/g, ' ').trim()}
					</span>
					<button
						type="button"
						class="shrink-0 text-stone-400 hover:text-red-600"
						title={removeLabel}
						onclick={() => onremove(manifest.name)}
					>
						×
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-[10px] text-stone-400">{emptyLabel}</p>
	{/if}

	<form class="flex min-h-0 flex-1 flex-col gap-1" onsubmit={submit}>
		<div class="flex gap-1">
			<input
				bind:value={name}
				placeholder={nameLabel}
				class="w-40 rounded border border-stone-300 bg-white px-1.5 py-0.5 font-mono text-[10px]"
			/>
			<button
				type="submit"
				class="rounded border border-stone-300 bg-stone-100 px-2 py-0.5 text-[10px] hover:bg-stone-200"
			>
				{addLabel}
			</button>
		</div>
		<textarea
			bind:value={text}
			placeholder={textLabel}
			spellcheck="false"
			class="min-h-20 flex-1 resize-none rounded border border-stone-300 bg-white px-2 py-1 font-mono text-[10px] leading-relaxed"
		></textarea>
	</form>
</div>
