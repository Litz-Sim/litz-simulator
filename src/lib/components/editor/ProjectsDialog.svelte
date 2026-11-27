<script lang="ts">
	import { canvasControl } from '#lib/canvas/control';
	import { m } from '#lib/paraglide/messages.js';
	import { doc } from '#lib/sketch/doc.svelte';
	import { link } from '#lib/sim/editorLink.svelte';
	import { projects } from '#lib/storage/projects.svelte';
	import type { StoredProject } from '#lib/storage/s3';
	import { ui } from '#lib/ui.svelte';
	import Icon from './Icon.svelte';

	let name = $state('');
	let busy = $state<string | null>(null);
	let pendingDelete = $state<string | null>(null);

	function close(): void {
		ui.projectsOpen = false;
	}

	function openSettings(): void {
		ui.projectsOpen = false;
		if (projects.provider === 'link') ui.linkOpen = true;
		else ui.settingsOpen = true;
	}

	$effect(() => {
		if (!ui.projectsOpen) return;
		name = projects.key ? projects.nameOf(projects.key) : doc.name;
		pendingDelete = null;
		void projects.refresh();
	});

	async function save(): Promise<void> {
		if (!name.trim()) return;
		await projects.save(name);
	}

	async function open(item: StoredProject): Promise<void> {
		busy = item.key;
		const done = await projects.open(item);
		busy = null;
		if (!done) return;
		close();
		requestAnimationFrame(() => canvasControl.engine?.fit());
	}

	async function remove(item: StoredProject): Promise<void> {
		if (pendingDelete !== item.key) {
			pendingDelete = item.key;
			return;
		}
		busy = item.key;
		await projects.remove(item);
		busy = null;
		pendingDelete = null;
	}

	function size(bytes: number): string {
		return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
	}

	/** A bucket lists ISO timestamps; the link lists milliseconds. */
	function when(stamp: string | number): string {
		const date = new Date(stamp);
		return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
	}
</script>

<svelte:window
	onkeydown={(event: KeyboardEvent) => {
		if (ui.projectsOpen && event.key === 'Escape') close();
	}}
/>

{#if ui.projectsOpen}
	<div class="fixed inset-0 z-[100]">
		<button
			type="button"
			aria-label={m.close()}
			class="absolute inset-0 bg-black/25"
			onclick={close}
		></button>
		<div
			class="relative mx-auto mt-16 flex max-h-[85vh] w-[min(640px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-stone-300 bg-white shadow-2xl [@media(pointer:coarse)]:mt-8"
			role="dialog"
			aria-label={m.projects_title()}
		>
			<div class="flex h-11 shrink-0 items-center justify-between border-b border-stone-200 px-3">
				<h2 class="text-[13px] font-semibold text-stone-800">{m.projects_title()}</h2>
				<div class="flex items-center gap-1">
					{#if projects.ready}
						<button
							type="button"
							aria-label={m.projects_refresh()}
							title={m.projects_refresh()}
							class="grid h-7 w-7 place-items-center rounded text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:opacity-40"
							disabled={projects.listing}
							onclick={() => void projects.refresh()}
						>
							<Icon name="loader" size={14} class={projects.listing ? 'animate-spin' : ''} />
						</button>
					{/if}
					<button
						type="button"
						aria-label={m.close()}
						class="grid h-7 w-7 place-items-center rounded text-stone-500 hover:bg-stone-100 hover:text-stone-800"
						onclick={close}
					>
						<Icon name="close" size={15} />
					</button>
				</div>
			</div>

			{#if !projects.ready}
				<div class="flex flex-col items-start gap-3 p-4">
					<p class="text-[12px] text-stone-600">
						{projects.provider === 'link' ? m.projects_need_link() : m.projects_unconfigured()}
					</p>
					<button
						type="button"
						class="rounded border border-stone-300 px-3 py-1.5 text-[12px] text-stone-700 hover:bg-stone-50"
						onclick={openSettings}
					>
						{projects.provider === 'link' ? m.link_connect() : m.projects_settings()}
					</button>
				</div>
			{:else}
				<div class="flex shrink-0 items-center gap-2 border-b border-stone-200 px-3 py-2">
					<input
						type="text"
						spellcheck="false"
						aria-label={m.projects_name()}
						placeholder={m.projects_name()}
						class="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1.5 font-mono text-[12px] text-stone-800 placeholder:text-stone-400 focus:border-[#2f6fd0] focus:outline-none"
						bind:value={name}
						onkeydown={(event) => {
							if (event.key === 'Enter') void save();
						}}
					/>
					<button
						type="button"
						class="shrink-0 rounded bg-[#2f6fd0] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#2860b6] disabled:opacity-40"
						disabled={projects.saving || !name.trim()}
						onclick={() => void save()}
					>
						{projects.saving ? m.projects_saving() : m.projects_save()}
					</button>
				</div>

				<div class="min-h-0 flex-1 overflow-y-auto">
					{#if projects.error}
						<p class="border-b border-stone-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
							{m.projects_failed({ detail: projects.error })}
						</p>
					{/if}

					{#if projects.items.length === 0}
						<p class="px-3 py-6 text-center text-[12px] text-stone-400">
							{projects.listing ? m.projects_refresh() : m.projects_empty()}
						</p>
					{:else}
						<ul>
							{#each projects.items as item (item.key)}
								<li
									class="flex items-center gap-2 border-b border-stone-100 px-3 py-2 last:border-0 hover:bg-stone-50"
								>
									<button
										type="button"
										class="min-w-0 flex-1 text-left disabled:opacity-40"
										disabled={busy !== null}
										onclick={() => void open(item)}
									>
										<span class="flex items-center gap-1.5">
											<span class="truncate text-[12px] text-stone-800">{item.name}</span>
											{#if projects.key === item.key}
												<span
													class="shrink-0 text-stone-500"
													title={m.projects_attached({ key: item.key })}
												>
													<Icon name="check" size={12} />
												</span>
											{/if}
										</span>
										<span class="block truncate font-mono text-[10px] text-stone-400">
											{when(item.modified)} · {size(item.size)}
										</span>
									</button>
									<button
										type="button"
										class="shrink-0 rounded px-2 py-1 text-[11px] {pendingDelete === item.key
											? 'bg-red-50 text-red-700'
											: 'text-stone-500 hover:bg-red-50 hover:text-red-600'}"
										disabled={busy !== null}
										onclick={() => void remove(item)}
										onblur={() => {
											if (pendingDelete === item.key) pendingDelete = null;
										}}
									>
										{pendingDelete === item.key ? m.projects_confirm() : m.projects_delete()}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>

				<div
					class="flex shrink-0 items-center gap-3 border-t border-stone-200 px-3 py-2 text-[11px]"
				>
					<span class="truncate text-stone-400">
						{projects.key ? m.projects_attached({ key: projects.key }) : m.projects_not_stored()}
					</span>
					{#if projects.provider === 'link' && link.library}
						<span class="ml-auto shrink-0 truncate font-mono text-stone-300" title={link.library}>
							{link.library}
						</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}
