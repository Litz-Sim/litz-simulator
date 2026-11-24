<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { DebugStop } from '#lib/sim/backend';
	import { sim } from '#lib/sim/controller.svelte';

	type Tab = 'registers' | 'disassembly' | 'breakpoints';

	let address = $state('');
	let memAddr = $state(0);
	let memory = $state<Uint8Array>(new Uint8Array(0));
	let seededPc = -1;
	let coarse = $state(false);
	/** Narrow windows stack the panes the same way a touch screen does. */
	let narrow = $state(false);
	let tab = $state<Tab>('registers');

	const pc = $derived.by(() => {
		void sim.revision;
		return sim.debugPc;
	});
	const available = $derived.by(() => {
		void sim.revision;
		return sim.debugAvailable();
	});
	const compact = $derived(coarse || narrow);
	const breakpoints = $derived(sim.breakpoints[sim.debugBoardId] ?? []);
	const lines = $derived(sim.disassembly.split('\n').filter((line) => line.trim() !== ''));
	const registers = $derived.by(() => {
		void sim.revision;
		return sim.registers;
	});
	const registerLabels = $derived.by((): { label: string; value: number }[] => {
		const values = registers?.values ?? [];
		const arm = /^rp2040/i.test(sim.boardRuntime[sim.debugBoard]?.name ?? '');
		return values.flatMap((value, index) => {
			if (arm) {
				if (index > 14) return [];
				const label = index < 13 ? `r${index}` : index === 13 ? 'sp' : 'lr';
				return [{ label, value }];
			}
			return [{ label: `x${index}`, value }];
		});
	});

	onMount(() => {
		sim.refreshDebug();
		// Three side-by-side panes need room; every narrower context gets the tabs.
		const touch = matchMedia('(pointer: coarse)');
		const width = matchMedia('(max-width: 640px)');
		const sync = () => {
			coarse = touch.matches;
			narrow = width.matches;
		};
		sync();
		const update = () => sync();
		touch.addEventListener('change', update);
		width.addEventListener('change', update);
		return () => {
			touch.removeEventListener('change', update);
			width.removeEventListener('change', update);
		};
	});

	// Follow the PC until the user types an address of their own.
	$effect(() => {
		const current = pc;
		if (current === null || current === seededPc) return;
		seededPc = current;
		memAddr = current;
		readMemory(current);
	});

	const stopLabel = $derived.by(() => {
		const stop = sim.debugStop;
		if (stop === null) return m.debug_none();
		const labels: Record<DebugStop, string> = {
			budget: m.stop_budget(),
			idle: m.stop_idle(),
			halted: m.stop_halted(),
			trap: m.stop_trap(),
			reset: m.stop_reset(),
			breakpoint: m.stop_breakpoint(),
			unsupported: m.debug_unsupported()
		};
		return labels[stop] ?? stop;
	});

	function hex(value: number, width = 8): string {
		return (value >>> 0).toString(16).padStart(width, '0');
	}

	function parseAddress(text: string): number | null {
		const trimmed = text.trim();
		if (!trimmed) return null;
		const value = Number(trimmed);
		return Number.isFinite(value) && value >= 0 ? value >>> 0 : null;
	}

	function lineAddress(line: string): number {
		return Number.parseInt(line.slice(0, 8), 16) >>> 0;
	}

	function toggleBreakpoint(line: string): void {
		const target = lineAddress(line);
		if (breakpoints.includes(target)) sim.removeBreakpoint(target);
		else sim.setBreakpoint(target);
	}

	function addBreakpoint(event: SubmitEvent): void {
		event.preventDefault();
		const target = parseAddress(address);
		if (target !== null && sim.setBreakpoint(target)) address = '';
	}

	function readMemory(addr = memAddr): void {
		memAddr = addr >>> 0;
		memory = sim.memory(memAddr, 64);
	}

	function readFromInput(): void {
		const target = parseAddress(address);
		if (target !== null) readMemory(target);
	}

	function selectBoard(event: Event): void {
		sim.selectDebugBoard(Number((event.currentTarget as HTMLSelectElement).value));
	}

	const cell =
		'rounded border border-stone-300 bg-white px-2 py-0.5 text-[11px] [@media(pointer:coarse)]:px-3 [@media(pointer:coarse)]:py-2 [@media(pointer:coarse)]:text-[12px]';
	const barCell = `${cell} shrink-0`;

	const tabs: { id: Tab; label: () => string }[] = [
		{ id: 'registers', label: () => m.debug_registers() },
		{ id: 'disassembly', label: () => m.debug_disassembly() },
		{ id: 'breakpoints', label: () => m.debug_breakpoints() }
	];
</script>

{#if !sim.running}
	<p class="px-3 py-2 text-[12px] text-stone-500">{m.debug_run_hint()}</p>
{:else}
	<div class="flex h-full min-h-0 flex-col">
		<div
			class="flex h-8 shrink-0 items-center gap-2 border-b border-stone-200 px-2 [@media(pointer:coarse)]:h-11 {compact
				? '[scrollbar-width:none] overflow-x-auto overscroll-x-contain [&::-webkit-scrollbar]:hidden'
				: ''}"
		>
			{#if sim.boardRuntime.length > 1}
				<label class="flex shrink-0 items-center gap-1 text-[11px] text-stone-500">
					{m.debug_board()}
					<select
						class="rounded border border-stone-300 bg-white px-1 py-0.5 text-[11px]"
						value={sim.debugBoard}
						onchange={selectBoard}
					>
						{#each sim.boardRuntime as board (board.id)}
							<option value={board.index}>{board.id}</option>
						{/each}
					</select>
				</label>
			{/if}
			<button type="button" class={barCell} disabled={!available} onclick={() => sim.debugStep()}>
				{m.debug_step()}
			</button>
			<button type="button" class={barCell} disabled={!available} onclick={() => sim.debugRun()}>
				{m.debug_continue()}
			</button>
			<button type="button" class={barCell} onclick={() => sim.pause()}>{m.debug_pause()}</button>
			<span class="ml-2 shrink-0 font-mono text-[11px] text-stone-600">
				{m.debug_pc()}: {pc === null ? m.debug_none() : `0x${hex(pc)}`}
			</span>
			<span class="shrink-0 font-mono text-[11px] text-stone-500">
				{m.debug_stop()}: {stopLabel}
			</span>
			{#if sim.boardRuntime[sim.debugBoard]}
				<span class="ml-auto shrink-0 text-[11px] text-stone-400">
					{sim.boardRuntime[sim.debugBoard].name}
				</span>
			{/if}
		</div>

		{#if !available}
			<p class="px-3 py-2 text-[12px] text-stone-500">{m.debug_unsupported()}</p>
		{:else}
			{#snippet registersPane()}
				<p class="mt-1 text-[11px] text-stone-500">{m.debug_registers()}</p>
				{#if registers}
					<div class="mt-1 grid grid-cols-2 gap-x-2 font-mono text-[10px] text-stone-600">
						{#each registerLabels as entry, index (index)}
							<span class="flex justify-between">
								<span class="text-stone-400">{entry.label}</span>
								<span>{hex(entry.value)}</span>
							</span>
						{/each}
						<span class="flex justify-between text-stone-800">
							<span class="text-stone-500">pc</span>
							<span>{hex(registers.pc)}</span>
						</span>
					</div>
				{/if}
			{/snippet}

			{#snippet disassemblyPane()}
				<p class="mt-1 flex items-center justify-between text-[11px] text-stone-500">
					<span>{m.debug_disassembly()}</span>
					<span class="text-stone-400">{m.debug_breakpoint_hint()}</span>
				</p>
				<div class="mt-1 font-mono text-[11px] leading-5">
					{#each lines as line (line)}
						{@const target = lineAddress(line)}
						<button
							type="button"
							class="flex w-full gap-2 rounded px-1 text-left hover:bg-stone-200/70 [@media(pointer:coarse)]:leading-7 {target ===
							pc
								? 'bg-amber-100'
								: ''}"
							onclick={() => toggleBreakpoint(line)}
						>
							<span
								class="w-3 shrink-0 {breakpoints.includes(target)
									? 'text-red-600'
									: 'text-transparent'}"
							>
								●
							</span>
							<span class="whitespace-pre text-stone-700">{line}</span>
						</button>
					{/each}
				</div>
			{/snippet}

			{#snippet breakpointsPane()}
				<p class="mt-1 text-[11px] text-stone-500">{m.debug_breakpoints()}</p>
				<form class="mt-1 flex gap-1" onsubmit={addBreakpoint}>
					<input
						class="min-w-0 flex-1 rounded border border-stone-300 px-1 py-0.5 font-mono text-[11px] [@media(pointer:coarse)]:py-2"
						placeholder={m.debug_address()}
						bind:value={address}
					/>
					<button type="submit" class={cell}>{m.debug_breakpoint_add()}</button>
					<button type="button" class={cell} onclick={() => sim.clearBreakpoints()}>
						{m.debug_breakpoint_clear()}
					</button>
				</form>
				{#if breakpoints.length}
					<ul class="mt-1 font-mono text-[11px] text-stone-600">
						{#each breakpoints as target (target)}
							<li class="flex items-center justify-between">
								<span>0x{hex(target)}</span>
								<button
									type="button"
									class="text-stone-400 hover:text-red-600"
									onclick={() => sim.removeBreakpoint(target)}
								>
									×
								</button>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="mt-1 text-[11px] text-stone-400">{m.debug_breakpoint_empty()}</p>
				{/if}

				<p class="mt-3 flex items-center justify-between text-[11px] text-stone-500">
					<span>{m.debug_memory()}</span>
					<span class="font-mono text-stone-400">{hex(memAddr)}</span>
				</p>
				<div class="mt-1 flex gap-1">
					<input
						class="min-w-0 flex-1 rounded border border-stone-300 px-1 py-0.5 font-mono text-[11px] [@media(pointer:coarse)]:py-2"
						value={`0x${hex(memAddr)}`}
						onchange={(event) => {
							const target = parseAddress(event.currentTarget.value);
							if (target !== null) readMemory(target);
						}}
					/>
					<button type="button" class={cell} onclick={readFromInput}>
						{m.debug_memory_read()}
					</button>
				</div>
				<div class="mt-1 font-mono text-[10px] leading-4 text-stone-600">
					{#if memory.length}
						{#each Array.from({ length: Math.ceil(memory.length / 8) }, (_, row) => row) as row (row)}
							<div class="flex gap-2">
								<span class="text-stone-400">{hex(memAddr + row * 8)}</span>
								<span>
									{#each Array.from({ length: 8 }, (_, col) => row * 8 + col) as offset (offset)}
										{offset < memory.length ? hex(memory[offset], 2) : '--'}
									{/each}
								</span>
							</div>
						{/each}
					{:else}
						<p class="text-stone-400">{m.debug_none()}</p>
					{/if}
				</div>
			{/snippet}

			{#if compact}
				<div
					class="flex h-11 shrink-0 items-center gap-0.5 border-b border-stone-200 bg-stone-50 p-1"
				>
					{#each tabs as item (item.id)}
						<button
							type="button"
							class="h-9 flex-1 rounded px-2 text-[12px] transition-colors {tab === item.id
								? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-300'
								: 'text-stone-600'}"
							onclick={() => (tab = item.id)}
						>
							{item.label()}
						</button>
					{/each}
				</div>
				<div class="min-h-0 flex-1 overflow-y-auto px-2 py-1">
					{#if tab === 'registers'}
						{@render registersPane()}
					{:else if tab === 'disassembly'}
						{@render disassemblyPane()}
					{:else}
						{@render breakpointsPane()}
					{/if}
				</div>
			{:else}
				<div class="flex min-h-0 flex-1">
					<div class="w-60 shrink-0 overflow-y-auto border-r border-stone-200 px-2 py-1">
						{@render registersPane()}
					</div>
					<div class="min-w-0 flex-1 overflow-y-auto px-2 py-1">
						{@render disassemblyPane()}
					</div>
					<div class="w-64 shrink-0 overflow-y-auto border-l border-stone-200 px-2 py-1">
						{@render breakpointsPane()}
					</div>
				</div>
			{/if}
		{/if}
	</div>
{/if}
