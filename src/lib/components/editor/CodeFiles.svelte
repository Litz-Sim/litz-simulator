<script lang="ts">
	import { partDef } from '#lib/parts/registry';
	import { m } from '#lib/paraglide/messages.js';
	import { findEntry } from '#lib/sim/python';
	import { doc } from '#lib/sketch/doc.svelte';
	import type { RuntimeMode } from '#lib/sketch/types';
	import { storageFile, ui } from '#lib/ui.svelte';
	import Icon from './Icon.svelte';

	let adding = $state<string | null>(null);
	let draft = $state('');
	let fileError = $state<string | null>(null);

	const boards = $derived(doc.developmentBoards());

	function runtimeLabel(runtime: RuntimeMode): string {
		if (runtime === 'micropython') return m.runtime_micropython();
		if (runtime === 'circuitpython') return m.runtime_circuitpython();
		return m.runtime_native();
	}

	function select(boardId: string, name: string): void {
		ui.bottomOpen = true;
		ui.codeFile = storageFile(boardId, name);
	}

	function remove(boardId: string, name: string): void {
		doc.removeBoardFile(boardId, name);
		if (ui.codeFile === storageFile(boardId, name)) {
			const program = doc.programFor(boardId);
			const next = findEntry(program.runtime, program.files) ?? program.files[0]?.name;
			ui.codeFile = next ? storageFile(boardId, next) : 'main.c';
		}
	}

	function beginAdd(boardId: string): void {
		adding = boardId;
		draft = '';
		fileError = null;
	}

	function addFile(boardId: string): void {
		const name = draft.trim();
		if (!name) return;
		if (!doc.addBoardFile(boardId, name)) {
			fileError = name.includes('..') ? m.error_file_name() : m.error_file_exists();
			return;
		}
		adding = null;
		draft = '';
		fileError = null;
		select(boardId, name);
	}

	function focus(node: HTMLInputElement): void {
		node.focus();
	}
</script>

<div class="flex h-full flex-col overflow-y-auto p-1.5 text-[11px] text-stone-600">
	<p class="px-1.5 py-1 text-[10px] font-medium tracking-wide text-stone-400">
		{m.code_board_files()}
	</p>

	{#each boards as part (part.id)}
		{@const def = partDef(part.type)}
		{@const program = doc.programFor(part.id)}
		{@const entry = findEntry(program.runtime, program.files)}
		<div class="mt-1">
			<div class="flex items-center gap-1.5 rounded px-1.5 py-1">
				<Icon name="chip" size={13} class="shrink-0 text-stone-400" />
				<span class="min-w-0 flex-1 truncate font-medium text-stone-700" title={def.name}>
					{def.name}
				</span>
				<span
					class="shrink-0 rounded px-1 py-0.5 text-[9px] {program.runtime === 'micropython'
						? 'bg-emerald-100 text-emerald-700'
						: program.runtime === 'circuitpython'
							? 'bg-sky-100 text-sky-700'
							: 'bg-stone-200 text-stone-600'}"
				>
					{runtimeLabel(program.runtime)}
				</span>
			</div>

			{#if program.runtime === 'native'}
				<p class="px-2 py-1 text-[10px] text-stone-400">{m.code_native_hint()}</p>
			{:else}
				{#each program.files as file (file.name)}
					<div
						class="group flex items-center rounded-md {ui.codeFile ===
						storageFile(part.id, file.name)
							? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-300'
							: 'hover:bg-stone-200/70'}"
					>
						<button
							type="button"
							class="flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-1 text-left"
							title={file.name}
							onclick={() => select(part.id, file.name)}
						>
							<Icon name="file" size={12} class="shrink-0 text-stone-400" />
							<span class="truncate font-mono {file.name === entry ? 'text-stone-900' : ''}">
								{file.name}
							</span>
							{#if file.name === entry}
								<span class="shrink-0 rounded bg-emerald-100 px-1 text-[9px] text-emerald-700">
									{m.code_entry_badge()}
								</span>
							{/if}
						</button>
						<button
							type="button"
							class="mr-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-stone-400 opacity-0 group-hover:opacity-100 hover:bg-stone-300 hover:text-stone-700 [@media(pointer:coarse)]:h-7 [@media(pointer:coarse)]:w-7 [@media(pointer:coarse)]:opacity-100"
							title={m.code_delete_file()}
							aria-label={m.code_delete_file()}
							onclick={() => remove(part.id, file.name)}
						>
							<Icon name="close" size={11} />
						</button>
					</div>
				{/each}

				{#if adding === part.id}
					<div class="mt-1 flex gap-1 px-1">
						<input
							bind:value={draft}
							use:focus
							placeholder={m.code_file_name()}
							class="h-6 min-w-0 flex-1 rounded border border-stone-300 bg-white px-1.5 font-mono text-[10px]"
							onkeydown={(event) => {
								if (event.key === 'Enter') addFile(part.id);
								if (event.key === 'Escape') adding = null;
							}}
						/>
						<button
							type="button"
							class="rounded bg-stone-800 px-2 text-[10px] text-white hover:bg-stone-700"
							onclick={() => addFile(part.id)}
						>
							{m.code_add_file()}
						</button>
					</div>
					{#if fileError}
						<p class="px-1 pt-1 text-[10px] text-red-600">{fileError}</p>
					{/if}
				{:else}
					<button
						type="button"
						class="mt-0.5 flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[10px] text-stone-500 hover:bg-stone-200/70 hover:text-stone-800"
						onclick={() => beginAdd(part.id)}
					>
						<Icon name="file-plus" size={12} />
						{m.code_new_file()}
					</button>
				{/if}
			{/if}
		</div>
	{/each}

	<p class="mt-2 px-1.5 py-1 text-[10px] font-medium tracking-wide text-stone-400">
		{m.code_project()}
	</p>
	<button
		type="button"
		class="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left {ui.codeFile ===
		'main.c'
			? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-300'
			: 'hover:bg-stone-200/70'}"
		onclick={() => (ui.codeFile = 'main.c')}
	>
		<Icon name="code" size={12} class="text-stone-400" />
		{m.code_main()}
	</button>
	<button
		type="button"
		class="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left {ui.codeFile ===
		'diagram.json'
			? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-300'
			: 'hover:bg-stone-200/70'}"
		onclick={() => (ui.codeFile = 'diagram.json')}
	>
		<Icon name="file" size={12} class="text-stone-400" />
		diagram.json
	</button>
</div>
