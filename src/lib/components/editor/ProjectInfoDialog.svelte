<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { doc } from '#lib/sketch/doc.svelte';
	import { ui } from '#lib/ui.svelte';
	import Icon from './Icon.svelte';

	let name = $state('');
	let author = $state('');
	let description = $state('');
	let version = $state('');
	let license = $state('');

	// Opening the dialog starts from what the project holds; typing stays local
	// until the user saves.
	$effect(() => {
		if (!ui.projectOpen) return;
		name = doc.name;
		author = doc.info.author;
		description = doc.info.description;
		version = doc.info.version;
		license = doc.info.license;
	});

	function close(): void {
		ui.projectOpen = false;
	}

	function save(): void {
		doc.renameTab(name);
		doc.setProjectInfo({ author, description, version, license });
		close();
	}

	const field =
		'h-8 w-full rounded border border-stone-300 bg-white px-2 text-[12px] text-stone-800 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:text-[13px]';
	const label = 'text-[11px] font-medium tracking-wide text-stone-500';
</script>

<svelte:window
	onkeydown={(event: KeyboardEvent) => {
		if (ui.projectOpen && event.key === 'Escape') close();
	}}
/>

{#if ui.projectOpen}
	<div class="fixed inset-0 z-[100]">
		<button
			type="button"
			aria-label={m.close()}
			class="absolute inset-0 bg-black/25"
			onclick={close}
		></button>
		<div
			class="relative mx-auto mt-16 flex max-h-[85vh] w-[min(460px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-stone-300 bg-white shadow-2xl [@media(pointer:coarse)]:mt-8"
			role="dialog"
			aria-label={m.project_info_title()}
		>
			<div class="flex h-11 shrink-0 items-center justify-between border-b border-stone-200 px-3">
				<h2 class="text-[13px] font-semibold text-stone-800">{m.project_info_title()}</h2>
				<button
					type="button"
					aria-label={m.close()}
					class="grid h-7 w-7 place-items-center rounded text-stone-500 hover:bg-stone-100 hover:text-stone-800"
					onclick={close}
				>
					<Icon name="close" size={15} />
				</button>
			</div>

			<div class="grid min-h-0 flex-1 gap-3 overflow-y-auto px-3 py-3">
				<label class="grid gap-1">
					<span class={label}>{m.project_name()}</span>
					<input bind:value={name} class={field} />
				</label>
				<label class="grid gap-1">
					<span class={label}>{m.project_author()}</span>
					<input bind:value={author} class={field} />
				</label>
				<label class="grid gap-1">
					<span class={label}>{m.project_description()}</span>
					<textarea
						bind:value={description}
						rows="3"
						class="w-full resize-y rounded border border-stone-300 bg-white px-2 py-1.5 text-[12px] text-stone-800 [@media(pointer:coarse)]:text-[13px]"
					></textarea>
				</label>
				<div class="grid grid-cols-2 gap-3">
					<label class="grid gap-1">
						<span class={label}>{m.project_version()}</span>
						<input bind:value={version} class={field} />
					</label>
					<label class="grid gap-1">
						<span class={label}>{m.project_license()}</span>
						<input bind:value={license} class={field} />
					</label>
				</div>
			</div>

			<div class="flex shrink-0 justify-end gap-2 border-t border-stone-200 px-3 py-2">
				<button
					type="button"
					class="h-8 rounded-md border border-stone-300 bg-white px-3 text-[12px] text-stone-700 hover:border-stone-400 [@media(pointer:coarse)]:h-10"
					onclick={close}
				>
					{m.project_cancel()}
				</button>
				<button
					type="button"
					class="h-8 rounded-md bg-stone-800 px-3 text-[12px] text-white hover:bg-stone-700 [@media(pointer:coarse)]:h-10"
					onclick={save}
				>
					{m.project_save()}
				</button>
			</div>
		</div>
	</div>
{/if}
