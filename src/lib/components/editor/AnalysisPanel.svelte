<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { Level, StopWord } from '#lib/sim/backend';
	import { sim } from '#lib/sim/controller.svelte';
	import { doc } from '#lib/sketch/doc.svelte';
	import Waveform from './Waveform.svelte';

	let decoderSpec = $state('');

	onMount(() => {
		sim.refreshScope(true);
	});

	const stopLabel = $derived.by(() => {
		const labels: Record<StopWord, string> = {
			budget: m.stop_budget(),
			idle: m.stop_idle(),
			halted: m.stop_halted(),
			trap: m.stop_trap(),
			reset: m.stop_reset(),
			breakpoint: m.stop_breakpoint()
		};
		return labels[sim.stopWord] ?? sim.stopWord;
	});

	function levelLabel(level: Level | null | undefined): string {
		if (level === 'high') return m.level_high();
		if (level === 'low') return m.level_low();
		if (level === 'high-z') return m.level_high_z();
		return m.level_none();
	}

	function levelClass(level: Level | null | undefined): string {
		if (level === 'high') return 'bg-emerald-500';
		if (level === 'low') return 'bg-stone-400';
		if (level === 'high-z') return 'bg-amber-400';
		return 'bg-stone-200';
	}

	function addDecoder(event: SubmitEvent): void {
		event.preventDefault();
		if (sim.addDecoder(decoderSpec)) decoderSpec = '';
	}

	function formatHz(value: number | null): string {
		if (value === null) return m.level_none();
		if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} MHz`;
		if (value >= 1000) return `${(value / 1000).toFixed(2)} kHz`;
		return `${value.toFixed(1)} Hz`;
	}

	function formatPercent(value: number | null): string {
		return value === null ? m.level_none() : `${(value * 100).toFixed(1)}%`;
	}

	function formatVolts(value: number | null): string {
		return value === null ? m.level_none() : `${value.toFixed(2)} V`;
	}

	function formatBytes(value: number | null): string {
		if (value === null) return m.level_none();
		if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
		if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
		return `${value} B`;
	}

	function formatFlash(): string {
		const info = sim.chipInfo;
		if (!info) return m.level_none();
		return `${formatBytes(info.flash.size)} · ${m.analysis_app({ size: formatBytes(info.flash.app) })}`;
	}

	function exportVcd(): void {
		const text = sim.traceVcd();
		if (!text) return;
		const blob = new Blob([text], { type: 'text/vcd' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${doc.name}.vcd`;
		link.click();
		URL.revokeObjectURL(url);
	}

	const waves = $derived.by(() => {
		void sim.revision;
		return sim.waves;
	});

	const traceCount = $derived.by(() => {
		void sim.revision;
		return sim.traceCount();
	});
</script>

<div class="h-full overflow-y-auto px-3 py-2 text-[11px] text-stone-700">
	{#if !sim.running}
		<p class="text-stone-400">{m.analysis_run_hint()}</p>
	{:else}
		<div class="grid grid-cols-2 gap-x-6 gap-y-1 md:grid-cols-4">
			<div>
				<span class="block text-stone-400">{m.analysis_chip()}</span>
				<span class="font-mono">{sim.chipInfo?.name ?? sim.chip ?? m.level_none()}</span>
			</div>
			<div>
				<span class="block text-stone-400">{m.analysis_clock()}</span>
				<span class="font-mono">
					{sim.chipInfo ? `${(sim.chipInfo.cpuHz / 1_000_000).toFixed(0)} MHz` : m.level_none()}
				</span>
			</div>
			<div>
				<span class="block text-stone-400">{m.analysis_flash()}</span>
				<span class="font-mono">{formatFlash()}</span>
			</div>
			<div>
				<span class="block text-stone-400">{m.analysis_heap()}</span>
				<span class="font-mono">{formatBytes(sim.heap)}</span>
			</div>
			<div>
				<span class="block text-stone-400">{m.analysis_stop()}</span>
				<span class="font-mono">{stopLabel}</span>
			</div>
			<div>
				<span class="block text-stone-400">{m.analysis_conflicts()}</span>
				<span class="font-mono">{sim.conflicts.length}</span>
			</div>
			<div class="col-span-2">
				<span class="block text-stone-400">{m.analysis_fault()}</span>
				<span class="font-mono text-red-600">{sim.fault ?? m.level_none()}</span>
			</div>
		</div>

		{#if sim.conflicts.length}
			<ul class="mt-1 space-y-0.5 font-mono text-[10px] text-amber-700">
				{#each sim.conflicts.slice(-4) as conflict, index (index)}
					<li>{conflict}</li>
				{/each}
			</ul>
		{/if}

		<div class="mt-3 flex items-baseline gap-2">
			<h3 class="text-[11px] font-medium text-stone-600">{m.analysis_gpio()}</h3>
			<span class="text-[10px] text-stone-400">{m.analysis_gpio_hint()}</span>
		</div>
		{#each sim.boards as board (board.id)}
			<div class="mt-1.5">
				<span class="text-[10px] text-stone-400">{board.name} · {board.id}</span>
				<div class="mt-1 flex flex-wrap gap-1">
					{#each board.pins as pin (pin.name)}
						{@const level = sim.levels[board.id]?.[pin.name] ?? null}
						<span
							title={levelLabel(level)}
							class="flex items-center gap-1 rounded border border-stone-200 bg-white px-1.5 py-0.5 font-mono text-[10px]"
						>
							<span class="h-2 w-2 rounded-full {levelClass(level)}"></span>
							{pin.name}
						</span>
					{/each}
				</div>
			</div>
		{/each}

		<div class="mt-3 flex flex-wrap items-center gap-2">
			<h3 class="text-[11px] font-medium text-stone-600">{m.analysis_probes()}</h3>
			<span class="text-[10px] text-stone-400">{m.probe_hint()}</span>
			<button
				type="button"
				class="ml-auto rounded border border-stone-300 bg-white px-2 py-0.5 text-[10px] hover:bg-stone-100"
				onclick={() => sim.refreshScope(true)}
			>
				{m.analysis_refresh()}
			</button>
		</div>
		{#if sim.actionError}
			<p class="mt-1 font-mono text-[10px] text-red-600">{sim.actionError}</p>
		{/if}

		{#if waves && waves.probes.length}
			<table class="mt-1 w-full border-collapse font-mono text-[10px]">
				<thead class="text-left text-stone-400">
					<tr>
						<th class="py-0.5 pr-2 font-normal">{m.analysis_name()}</th>
						<th class="py-0.5 pr-2 font-normal">{m.analysis_point()}</th>
						<th class="py-0.5 pr-2 font-normal">{m.analysis_net()}</th>
						<th class="py-0.5 pr-2 font-normal">{m.analysis_edges()}</th>
						<th class="py-0.5 pr-2 font-normal">{m.analysis_freq()}</th>
						<th class="py-0.5 pr-2 font-normal">{m.analysis_duty()}</th>
						<th class="py-0.5 pr-2 font-normal">{m.analysis_volts()}</th>
					</tr>
				</thead>
				<tbody>
					{#each waves.probes as probe (probe.name)}
						<tr class="border-t border-stone-200">
							<td class="py-0.5 pr-2">{probe.name}</td>
							<td class="py-0.5 pr-2 text-stone-500">{probe.point}</td>
							<td class="py-0.5 pr-2">{probe.net}</td>
							<td class="py-0.5 pr-2">{probe.edges}</td>
							<td class="py-0.5 pr-2">{formatHz(probe.frequencyHz)}</td>
							<td class="py-0.5 pr-2">{formatPercent(probe.duty)}</td>
							<td class="py-0.5 pr-2">
								{#if probe.minVolts !== null && probe.maxVolts !== null}
									{probe.minVolts.toFixed(2)}–{probe.maxVolts.toFixed(2)} V
								{:else}
									{formatVolts(probe.maxVolts)}
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<p class="mt-1 text-[10px] text-stone-400">{m.analysis_probe_empty()}</p>
		{/if}

		<div class="mt-3">
			<h3 class="text-[11px] font-medium text-stone-600">{m.analysis_wave()}</h3>
			<Waveform
				probes={waves?.probes ?? []}
				decodes={waves?.decodes ?? []}
				endMs={waves?.ms ?? 0}
				emptyLabel={m.analysis_wave_empty()}
				hint={m.analysis_wave_hint()}
			/>
		</div>

		<div class="mt-3 flex items-center gap-2">
			<h3 class="text-[11px] font-medium text-stone-600">{m.analysis_trace()}</h3>
			<button
				type="button"
				class="rounded border border-stone-300 bg-white px-2 py-0.5 text-[10px] hover:bg-stone-100 disabled:opacity-40"
				disabled={traceCount === 0}
				onclick={exportVcd}
			>
				{m.analysis_vcd()}
			</button>
		</div>

		<div class="mt-3 flex items-center gap-2">
			<h3 class="text-[11px] font-medium text-stone-600">{m.analysis_decoders()}</h3>
			<span class="text-[10px] text-stone-400">{m.analysis_decoder_hint()}</span>
		</div>
		<form class="mt-1 flex flex-wrap items-center gap-1" onsubmit={addDecoder}>
			<input
				bind:value={decoderSpec}
				placeholder={m.analysis_decoder_hint()}
				class="w-64 rounded border border-stone-300 bg-white px-1.5 py-0.5 font-mono text-[10px]"
			/>
			<button
				type="submit"
				class="rounded border border-stone-300 bg-stone-100 px-2 py-0.5 text-[10px] hover:bg-stone-200"
			>
				{m.analysis_add()}
			</button>
		</form>

		{#if waves && waves.decodes.length}
			<div class="mt-1 space-y-1">
				{#each waves.decodes as decode (decode.spec)}
					<div class="rounded border border-stone-200 bg-white px-2 py-1">
						<div class="flex items-center gap-2">
							<span class="font-mono text-[10px] text-stone-500">
								{decode.kind} · {decode.spec}
							</span>
							<button
								type="button"
								class="ml-auto text-stone-400 hover:text-red-600"
								title={m.analysis_remove()}
								onclick={() => sim.removeDecoder(decode.spec)}
							>
								×
							</button>
						</div>
						{#if decode.frames.length}
							<ul class="mt-0.5 space-y-0.5 font-mono text-[10px]">
								{#each decode.frames.slice(-12) as frame, index (index)}
									<li class:text-red-600={frame.error}>
										<span class="mr-2 text-stone-400">{(frame.at / 1_000_000).toFixed(3)} ms</span>
										{frame.text}{#if frame.error}<span class="text-red-500">
												· {String(frame.error)}
											</span>{/if}
									</li>
								{/each}
							</ul>
						{:else}
							<p class="text-[10px] text-stone-400">{m.analysis_decoder_empty()}</p>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
