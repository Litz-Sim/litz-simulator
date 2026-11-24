<script lang="ts">
	import { partDef } from '#lib/parts/registry';
	import { m } from '#lib/paraglide/messages.js';
	import { sim } from '#lib/sim/controller.svelte';
	import { findEntry } from '#lib/sim/python';
	import { base64ToBytes, bytesToBase64, encodeText, formatBytes } from '#lib/sim/volume';
	import { doc } from '#lib/sketch/doc.svelte';
	import type { RuntimeMode, VolumeFile } from '#lib/sketch/types';
	import { flashPath, storageFile, ui, volumePath } from '#lib/ui.svelte';
	import Icon from './Icon.svelte';

	/** Files above this size would not fit through the REPL in a useful time. */
	const MAX_IMPORT = 256 * 1024;
	/** A volume import lands in one FAT image, so it is bounded by capacity, not the REPL. */
	const MAX_VOLUME_IMPORT = 2 * 1024 * 1024;

	let adding = $state<string | null>(null);
	let draft = $state('');
	let fileError = $state<string | null>(null);
	let fileErrorBoard = $state<string | null>(null);
	let importing = $state<string | null>(null);
	let fileInput: HTMLInputElement;

	let volumeAdding = $state<string | null>(null);
	let volumeDraft = $state('');
	let volumeError = $state<string | null>(null);
	let volumeErrorPart = $state<string | null>(null);
	let importingVolume = $state<string | null>(null);
	let volumeInput: HTMLInputElement;
	let flashError = $state<string | null>(null);

	const boards = $derived(doc.developmentBoards());
	const volumes = $derived(doc.storageParts());
	const flashSizes = $derived.by(() => {
		const sizes: Record<string, number> = {};
		for (const part of boards) sizes[part.id] = sim.flashFor(part.id)?.length ?? 0;
		return sizes;
	});

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
			ui.codeFile = next ? storageFile(boardId, next) : 'diagram.json';
		}
	}

	function beginAdd(boardId: string): void {
		adding = boardId;
		draft = '';
		fileError = null;
		fileErrorBoard = null;
	}

	function addFile(boardId: string): void {
		const name = draft.trim();
		if (!name) return;
		if (!doc.addBoardFile(boardId, name)) {
			fileError = name.includes('..') ? m.error_file_name() : m.error_file_exists();
			fileErrorBoard = boardId;
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

	function pickFiles(boardId: string): void {
		importing = boardId;
		fileError = null;
		fileErrorBoard = null;
		fileInput.click();
	}

	async function importFiles(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const files = [...(input.files ?? [])];
		input.value = '';
		const boardId = importing;
		importing = null;
		if (!boardId || files.length === 0) return;

		fileError = null;
		let opened: string | null = null;
		for (const file of files) {
			if (file.size > MAX_IMPORT) {
				fileError = m.error_file_too_large({ kb: MAX_IMPORT / 1024 });
				fileErrorBoard = boardId;
				continue;
			}
			const text = await file.text();
			if (text.includes('\u0000')) {
				fileError = m.error_file_text_only();
				fileErrorBoard = boardId;
				continue;
			}
			const exists = doc.programFor(boardId).files.some((item) => item.name === file.name);
			if (!exists && !doc.addBoardFile(boardId, file.name)) {
				fileError = m.error_file_name();
				fileErrorBoard = boardId;
				continue;
			}
			doc.setBoardFile(boardId, file.name, text);
			opened = file.name;
		}
		if (opened) select(boardId, opened);
	}

	function saveFile(name: string, text: string): void {
		saveBytes(name, new TextEncoder().encode(text), 'text/plain;charset=utf-8');
	}

	function saveBytes(name: string, bytes: Uint8Array, type = 'application/octet-stream'): void {
		const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type }));
		const link = document.createElement('a');
		link.href = url;
		link.download = name;
		document.body.appendChild(link);
		link.click();
		link.remove();
		URL.revokeObjectURL(url);
	}

	// ------------------------------------------------------------- volumes

	function selectVolume(partId: string, path: string): void {
		ui.bottomOpen = true;
		ui.codeFile = volumePath(partId, path);
	}

	function beginAddVolume(partId: string): void {
		volumeAdding = partId;
		volumeDraft = '';
		volumeError = null;
		volumeErrorPart = null;
	}

	function addVolumeFile(partId: string): void {
		const name = volumeDraft.trim();
		if (!name) return;
		if (!doc.addVolumeFile(partId, { path: name, data: encodeText('') })) {
			volumeError = name.includes('..') ? m.error_file_name() : m.error_file_exists();
			volumeErrorPart = partId;
			return;
		}
		volumeAdding = null;
		volumeDraft = '';
		volumeError = null;
		selectVolume(partId, name);
	}

	function pickVolumeFiles(partId: string): void {
		importingVolume = partId;
		volumeError = null;
		volumeErrorPart = null;
		volumeInput.click();
	}

	async function importVolumeFiles(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const files = [...(input.files ?? [])];
		input.value = '';
		const partId = importingVolume;
		importingVolume = null;
		if (!partId || files.length === 0) return;
		let opened: string | null = null;
		for (const file of files) {
			if (file.size > MAX_VOLUME_IMPORT) {
				volumeError = m.error_file_too_large({ kb: MAX_VOLUME_IMPORT / 1024 });
				volumeErrorPart = partId;
				continue;
			}
			const data = bytesToBase64(new Uint8Array(await file.arrayBuffer()));
			if (!doc.addVolumeFile(partId, { path: file.name, data })) {
				volumeError = m.error_file_exists();
				volumeErrorPart = partId;
				continue;
			}
			opened = file.name;
		}
		if (opened) selectVolume(partId, opened);
	}

	function removeVolumeFile(partId: string, path: string): void {
		doc.removeVolumeFile(partId, path);
		if (ui.codeFile === volumePath(partId, path)) ui.codeFile = 'diagram.json';
	}

	function downloadVolumeFile(partId: string, file: VolumeFile): void {
		const name = file.path.split('/').pop() || file.path;
		saveBytes(name, base64ToBytes(file.data));
	}

	function downloadFlash(boardId: string): void {
		const image = sim.flashFor(boardId);
		if (!image) {
			flashError = m.level_none();
			return;
		}
		flashError = null;
		saveBytes(`${boardId}.flash.bin`, image);
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
							class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-stone-400 opacity-0 group-hover:opacity-100 hover:bg-stone-300 hover:text-stone-700 [@media(pointer:coarse)]:h-7 [@media(pointer:coarse)]:w-7 [@media(pointer:coarse)]:opacity-100"
							title={m.code_export_file()}
							aria-label={m.code_export_file()}
							onclick={() => saveFile(file.name, file.text)}
						>
							<Icon name="download" size={11} />
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
				{:else}
					<div class="mt-0.5 flex gap-1">
						<button
							type="button"
							class="flex flex-1 items-center gap-1.5 rounded px-1.5 py-1 text-left text-[10px] text-stone-500 hover:bg-stone-200/70 hover:text-stone-800"
							onclick={() => pickFiles(part.id)}
						>
							<Icon name="upload" size={12} />
							{m.code_import_file()}
						</button>
						<button
							type="button"
							class="flex flex-1 items-center gap-1.5 rounded px-1.5 py-1 text-left text-[10px] text-stone-500 hover:bg-stone-200/70 hover:text-stone-800"
							onclick={() => beginAdd(part.id)}
						>
							<Icon name="file-plus" size={12} />
							{m.code_new_file()}
						</button>
					</div>
				{/if}
				{#if fileError && fileErrorBoard === part.id}
					<p class="px-1 pt-1 text-[10px] text-red-600">{fileError}</p>
				{/if}
			{/if}
		</div>
	{/each}

	{#if volumes.length}
		<p class="mt-2 px-1.5 py-1 text-[10px] font-medium tracking-wide text-stone-400">
			{m.code_storage_files()}
		</p>
		{#each volumes as part (part.id)}
			{@const def = partDef(part.type)}
			{@const files = doc.volume(part.id)}
			<div class="mt-1">
				<div class="flex items-center gap-1.5 rounded px-1.5 py-1">
					<Icon name="folder" size={13} class="shrink-0 text-stone-400" />
					<span class="min-w-0 flex-1 truncate font-medium text-stone-700" title={def.name}>
						{def.name}
					</span>
					<span class="shrink-0 rounded bg-stone-200 px-1 py-0.5 text-[9px] text-stone-600">
						{String(part.attrs.size ?? '')}
					</span>
				</div>
				{#each files as file (file.path)}
					<div
						class="group flex items-center rounded-md {ui.codeFile ===
						volumePath(part.id, file.path)
							? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-300'
							: 'hover:bg-stone-200/70'}"
					>
						<button
							type="button"
							class="flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-1 text-left"
							title={file.path}
							onclick={() => selectVolume(part.id, file.path)}
						>
							<Icon name="file" size={12} class="shrink-0 text-stone-400" />
							<span class="truncate font-mono">{file.path}</span>
						</button>
						<button
							type="button"
							class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-stone-400 opacity-0 group-hover:opacity-100 hover:bg-stone-300 hover:text-stone-700 [@media(pointer:coarse)]:h-7 [@media(pointer:coarse)]:w-7 [@media(pointer:coarse)]:opacity-100"
							title={m.code_export_file()}
							aria-label={m.code_export_file()}
							onclick={() => downloadVolumeFile(part.id, file)}
						>
							<Icon name="download" size={11} />
						</button>
						<button
							type="button"
							class="mr-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-stone-400 opacity-0 group-hover:opacity-100 hover:bg-stone-300 hover:text-stone-700 [@media(pointer:coarse)]:h-7 [@media(pointer:coarse)]:w-7 [@media(pointer:coarse)]:opacity-100"
							title={m.code_delete_file()}
							aria-label={m.code_delete_file()}
							onclick={() => removeVolumeFile(part.id, file.path)}
						>
							<Icon name="close" size={11} />
						</button>
					</div>
				{/each}

				{#if volumeAdding === part.id}
					<div class="mt-1 flex gap-1 px-1">
						<input
							bind:value={volumeDraft}
							use:focus
							placeholder={m.code_file_name()}
							class="h-6 min-w-0 flex-1 rounded border border-stone-300 bg-white px-1.5 font-mono text-[10px]"
							onkeydown={(event) => {
								if (event.key === 'Enter') addVolumeFile(part.id);
								if (event.key === 'Escape') volumeAdding = null;
							}}
						/>
						<button
							type="button"
							class="rounded bg-stone-800 px-2 text-[10px] text-white hover:bg-stone-700"
							onclick={() => addVolumeFile(part.id)}
						>
							{m.code_add_file()}
						</button>
					</div>
				{:else}
					<div class="mt-0.5 flex gap-1">
						<button
							type="button"
							class="flex flex-1 items-center gap-1.5 rounded px-1.5 py-1 text-left text-[10px] text-stone-500 hover:bg-stone-200/70 hover:text-stone-800"
							onclick={() => pickVolumeFiles(part.id)}
						>
							<Icon name="upload" size={12} />
							{m.code_import_file()}
						</button>
						<button
							type="button"
							class="flex flex-1 items-center gap-1.5 rounded px-1.5 py-1 text-left text-[10px] text-stone-500 hover:bg-stone-200/70 hover:text-stone-800"
							onclick={() => beginAddVolume(part.id)}
						>
							<Icon name="file-plus" size={12} />
							{m.code_new_file()}
						</button>
					</div>
				{/if}
				{#if volumeError && volumeErrorPart === part.id}
					<p class="px-1 pt-1 text-[10px] text-red-600">{volumeError}</p>
				{/if}
			</div>
		{/each}
	{/if}

	{#if boards.length}
		<p class="mt-2 px-1.5 py-1 text-[10px] font-medium tracking-wide text-stone-400">
			{m.code_flash()}
		</p>
		{#each boards as part (part.id)}
			<div
				class="group flex items-center rounded-md {ui.codeFile === flashPath(part.id)
					? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-300'
					: 'hover:bg-stone-200/70'}"
			>
				<button
					type="button"
					class="flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-1 text-left"
					title={m.storage_flash_hint()}
					onclick={() => {
						ui.bottomOpen = true;
						ui.codeFile = flashPath(part.id);
					}}
				>
					<Icon name="chip" size={12} class="shrink-0 text-stone-400" />
					<span class="truncate font-mono">{part.id}.flash</span>
					<span class="ml-auto shrink-0 text-[9px] text-stone-400">
						{flashSizes[part.id] ? formatBytes(flashSizes[part.id]) : m.level_none()}
					</span>
				</button>
				<button
					type="button"
					class="mr-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-stone-400 opacity-0 group-hover:opacity-100 hover:bg-stone-300 hover:text-stone-700 [@media(pointer:coarse)]:h-7 [@media(pointer:coarse)]:w-7 [@media(pointer:coarse)]:opacity-100"
					title={m.storage_export_flash()}
					aria-label={m.storage_export_flash()}
					onclick={() => downloadFlash(part.id)}
				>
					<Icon name="download" size={11} />
				</button>
			</div>
		{/each}
		{#if flashError}
			<p class="px-1 pt-1 text-[10px] text-red-600">{flashError}</p>
		{/if}
	{/if}

	<p class="mt-2 px-1.5 py-1 text-[10px] font-medium tracking-wide text-stone-400">
		{m.code_project()}
	</p>
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

	<input
		bind:this={fileInput}
		type="file"
		multiple
		class="hidden"
		accept="text/*,.py,.txt,.json,.csv,.md,.cfg,.ini,.toml,.yaml,.yml,.js,.mjs,.ts,.html,.xml,.log,.sh"
		onchange={importFiles}
	/>
	<input bind:this={volumeInput} type="file" multiple class="hidden" onchange={importVolumeFiles} />
</div>
