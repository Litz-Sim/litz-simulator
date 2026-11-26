<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { link } from '#lib/sim/editorLink.svelte';
	import { ui } from '#lib/ui.svelte';
	import Icon from './Icon.svelte';

	let attach = $state('');
	let board = $state('');
	let transcript = $state<HTMLElement>();

	function close(): void {
		ui.linkOpen = false;
	}

	function connect(): void {
		if (!attach.trim()) return;
		if (link.connect(attach)) attach = '';
	}

	function disconnect(): void {
		link.disconnect();
		board = '';
	}

	function build(): void {
		link.build(board || undefined);
	}

	const status = $derived(
		link.status === 'online'
			? m.link_online()
			: link.status === 'connecting'
				? m.link_connecting()
				: m.link_offline()
	);

	$effect(() => {
		if (transcript && link.log) transcript.scrollTop = transcript.scrollHeight;
	});
</script>

<svelte:window
	onkeydown={(event: KeyboardEvent) => {
		if (ui.linkOpen && event.key === 'Escape') close();
	}}
/>

{#if ui.linkOpen}
	<div class="fixed inset-0 z-[100]">
		<button
			type="button"
			aria-label={m.close()}
			class="absolute inset-0 bg-black/25"
			onclick={close}
		></button>
		<div
			class="relative mx-auto mt-16 flex max-h-[85vh] w-[min(600px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-stone-300 bg-white shadow-2xl [@media(pointer:coarse)]:mt-8"
			role="dialog"
			aria-label={m.link_title()}
		>
			<div class="flex h-11 shrink-0 items-center justify-between border-b border-stone-200 px-3">
				<h2 class="text-[13px] font-semibold text-stone-800">{m.link_title()}</h2>
				<button
					type="button"
					aria-label={m.close()}
					class="grid h-7 w-7 place-items-center rounded text-stone-500 hover:bg-stone-100 hover:text-stone-800"
					onclick={close}
				>
					<Icon name="close" size={15} />
				</button>
			</div>

			<div class="flex min-h-0 flex-col gap-3 overflow-y-auto p-3">
				<p class="text-[12px] leading-relaxed text-stone-500">{m.link_hint()}</p>
				<div class="flex gap-2">
					<input
						type="text"
						spellcheck="false"
						autocomplete="off"
						placeholder="ws://127.0.0.1:4317/ws#ABCD-EF01-2345-6789"
						class="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1.5 font-mono text-[12px] text-stone-800 placeholder:text-stone-400 focus:border-[#2f6fd0] focus:outline-none"
						bind:value={attach}
						onkeydown={(event) => {
							if (event.key === 'Enter') connect();
						}}
					/>
					{#if link.status === 'offline'}
						<button
							type="button"
							class="shrink-0 rounded bg-[#2f6fd0] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#2860b6] disabled:opacity-40"
							disabled={!attach.trim()}
							onclick={connect}
						>
							{m.link_connect()}
						</button>
					{:else}
						<button
							type="button"
							class="shrink-0 rounded border border-stone-300 px-3 py-1.5 text-[12px] text-stone-700 hover:bg-stone-50"
							onclick={disconnect}
						>
							{m.link_disconnect()}
						</button>
					{/if}
				</div>

				<div class="flex items-center gap-3 text-[12px] text-stone-600">
					<span class="flex items-center gap-1.5">
						<span
							class="h-2 w-2 rounded-full {link.status === 'online'
								? 'bg-emerald-500'
								: link.status === 'connecting'
									? 'bg-amber-400'
									: 'bg-stone-300'}"
						></span>
						{status}
					</span>
					{#if link.project}
						<span class="truncate text-stone-500">{link.project}</span>
					{/if}
					{#if link.version}
						<span class="ml-auto font-mono text-[11px] text-stone-400">litz {link.version}</span>
					{/if}
				</div>

				{#if link.error}
					<p class="rounded bg-red-50 px-2 py-1.5 text-[12px] text-red-700">{link.error}</p>
				{/if}

				{#if link.status === 'online'}
					<div class="flex items-center gap-2">
						{#if link.boards.length > 1}
							<select
								class="rounded border border-stone-300 px-2 py-1.5 text-[12px] text-stone-700"
								bind:value={board}
							>
								<option value="">{m.link_all_boards()}</option>
								{#each link.boards as id (id)}
									<option value={id}>{id}</option>
								{/each}
							</select>
						{/if}
						<button
							type="button"
							class="rounded bg-[#2f6fd0] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#2860b6] disabled:opacity-40"
							disabled={link.building}
							onclick={build}
						>
							{link.building ? m.link_building() : m.link_build()}
						</button>
						{#if link.last}
							<span class="truncate font-mono text-[11px] text-stone-400">
								{link.last.name} · {(link.last.size / 1024).toFixed(0)} KB
							</span>
						{/if}
					</div>
				{/if}

				{#if link.log}
					<pre
						bind:this={transcript}
						class="max-h-64 min-h-24 overflow-auto rounded border border-stone-200 bg-[#fbfaf7] p-2 font-mono text-[11px] leading-snug whitespace-pre-wrap text-stone-600">{link.log}</pre>
				{/if}
			</div>
		</div>
	</div>
{/if}
