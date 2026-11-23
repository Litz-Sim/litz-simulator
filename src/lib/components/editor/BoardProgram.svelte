<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { bundledFirmware } from '#lib/sim/firmware';
	import { findEntry } from '#lib/sim/python';
	import { sim } from '#lib/sim/controller.svelte';
	import { doc, pythonEntry } from '#lib/sketch/doc.svelte';
	import type { RuntimeMode } from '#lib/sketch/types';
	import { ui } from '#lib/ui.svelte';
	import Icon from './Icon.svelte';

	let { boardId, chip }: { boardId: string; chip: string | null } = $props();

	let firmwareInput: HTMLInputElement;
	let romInput: HTMLInputElement;
	let error = $state<string | null>(null);

	const program = $derived(doc.programFor(boardId));
	const bundled = $derived(bundledFirmware(chip, program.runtime));
	const entry = $derived(findEntry(program.runtime, program.files));

	const runtimes: { value: RuntimeMode; label: string }[] = [
		{ value: 'native', label: m.runtime_native() },
		{ value: 'micropython', label: m.runtime_micropython() },
		{ value: 'circuitpython', label: m.runtime_circuitpython() }
	];

	function apply(): void {
		if (sim.running || sim.loading) sim.reset();
	}

	function setRuntime(runtime: RuntimeMode): void {
		if (program.runtime === runtime) return;
		doc.setBoardRuntime(boardId, runtime);
		const name = pythonEntry(runtime);
		if (name) ui.codeFile = `storage:${boardId}:${name}`;
		apply();
	}

	function upload(event: Event, kind: 'firmware' | 'rom'): void {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		error = null;
		const task =
			kind === 'firmware'
				? sim.loadFirmware(file, boardId)
				: sim.loadImagePart('rom', file, boardId);
		void task.then(() => {
			if (sim.actionError) error = sim.actionError;
		});
	}

	function useBundled(): void {
		sim.useBundledFirmware(boardId);
		error = null;
	}

	function openFiles(): void {
		ui.bottomOpen = true;
		ui.bottomTab = 'code';
		const name = entry ?? program.files[0]?.name;
		if (name) ui.codeFile = `storage:${boardId}:${name}`;
	}

	const button =
		'flex h-7 items-center justify-center gap-1 rounded-md border border-stone-300 bg-white px-2 text-[11px] text-stone-700 hover:border-stone-400 [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:px-3 [@media(pointer:coarse)]:text-[12px]';
</script>

<div class="mt-4 rounded-md border border-stone-200 bg-stone-50/70 p-2">
	<p class="text-[11px] font-medium text-stone-500">{m.section_program()}</p>

	<div class="mt-1 grid grid-cols-3 gap-1">
		{#each runtimes as runtime (runtime.value)}
			<button
				type="button"
				class="flex h-7 items-center justify-center rounded-md border px-1 text-[10px] leading-tight transition-colors [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:text-[11px] {program.runtime ===
				runtime.value
					? 'border-stone-700 bg-stone-800 text-white'
					: 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'}"
				onclick={() => setRuntime(runtime.value)}
			>
				{runtime.label}
			</button>
		{/each}
	</div>

	<div class="mt-2 rounded border border-stone-200 bg-white px-2 py-1.5">
		<div class="flex items-center justify-between gap-2">
			<span class="text-[11px] text-stone-500">{m.program_firmware()}</span>
			{#if !program.firmware && bundled}
				<span class="rounded bg-emerald-100 px-1 py-0.5 text-[9px] text-emerald-700">
					{m.program_bundled()}
				</span>
			{/if}
		</div>
		<p
			class="mt-0.5 truncate font-mono text-[11px] text-stone-800"
			title={program.firmware?.name ?? bundled?.name ?? ''}
		>
			{program.firmware?.name ?? bundled?.name ?? m.program_missing_firmware()}
		</p>
		<div class="mt-1.5 flex gap-1">
			<button type="button" class={button} onclick={() => firmwareInput.click()}>
				<Icon name="upload" size={12} />
				{m.program_upload()}
			</button>
			{#if program.firmware || program.rom || program.boot || program.ptable}
				<button type="button" class={button} onclick={useBundled}>
					{m.program_use_bundled()}
				</button>
			{/if}
		</div>
	</div>

	{#if program.runtime !== 'native' && chip?.startsWith('esp32')}
		<div class="mt-1.5 rounded border border-stone-200 bg-white px-2 py-1.5">
			<div class="flex items-center justify-between gap-2">
				<span class="text-[11px] text-stone-500">{m.program_rom()}</span>
				{#if !program.rom && bundled?.rom}
					<span class="rounded bg-emerald-100 px-1 py-0.5 text-[9px] text-emerald-700">
						{m.program_bundled()}
					</span>
				{/if}
			</div>
			<p class="mt-0.5 truncate font-mono text-[11px] text-stone-800">
				{program.rom?.name ?? bundled?.rom?.name ?? m.program_missing_firmware()}
			</p>
			<button type="button" class={`${button} mt-1.5`} onclick={() => romInput.click()}>
				<Icon name="upload" size={12} />
				{m.program_upload()}
			</button>
		</div>
	{/if}

	{#if program.runtime !== 'native'}
		<div class="mt-1.5 flex items-center justify-between gap-2">
			<span class="text-[11px] text-stone-500">
				{program.files.length === 1
					? m.program_file_one()
					: m.program_file_many({ count: program.files.length })}
			</span>
			<button
				type="button"
				class="flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-stone-600 hover:bg-stone-200 [@media(pointer:coarse)]:h-8"
				onclick={openFiles}
			>
				<Icon name="folder" size={12} />
				{m.program_open_files()}
			</button>
		</div>
		{#if program.files.length > 0 && !entry}
			<p class="mt-1 text-[10px] text-amber-700">{m.program_entry_missing()}</p>
		{/if}
	{/if}

	{#if error}
		<p class="mt-1 text-[10px] break-all text-red-600">{error}</p>
	{/if}

	<input
		bind:this={firmwareInput}
		type="file"
		accept=".bin,.hex,.uf2,.elf,application/octet-stream"
		class="hidden"
		onchange={(event) => upload(event, 'firmware')}
	/>
	<input
		bind:this={romInput}
		type="file"
		accept=".elf,.bin,application/octet-stream"
		class="hidden"
		onchange={(event) => upload(event, 'rom')}
	/>
</div>
