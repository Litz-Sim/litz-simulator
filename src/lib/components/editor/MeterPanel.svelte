<script lang="ts">
	import { canvasControl } from '#lib/canvas/control';
	import { m } from '#lib/paraglide/messages.js';
	import { sim } from '#lib/sim/controller.svelte';
	import { doc } from '#lib/sketch/doc.svelte';

	const meters = $derived.by(() => {
		void doc.rev;
		return doc.sketch.parts.filter((part) => part.type === 'litz-multimeter');
	});

	function formatVolts(value: number): string {
		if (Math.abs(value) < 1) return `${(value * 1000).toFixed(0)} mV`;
		return `${value.toFixed(3)} V`;
	}

	function formatAmps(value: number): string {
		const magnitude = Math.abs(value);
		if (magnitude < 0.001) return `${(value * 1_000_000).toFixed(1)} µA`;
		if (magnitude < 1) return `${(value * 1000).toFixed(2)} mA`;
		return `${value.toFixed(3)} A`;
	}

	// The reading is backend state, so touching `revision` is what makes the
	// values follow the frame loop.
	const rows = $derived.by(() => {
		void sim.revision;
		return meters.map((part) => {
			const mode = String(part.attrs.mode ?? 'voltage');
			const value = mode === 'current' ? sim.meterAmps(part.id) : sim.meterVolts(part.id);
			return {
				id: part.id,
				mode,
				text: value === null ? '—' : mode === 'current' ? formatAmps(value) : formatVolts(value)
			};
		});
	});

	function setMode(id: string, mode: string): void {
		doc.setAttr(id, 'mode', mode);
		// The mode is the meter's resistance, fixed when the circuit boots.
		if (sim.running) sim.reset();
	}

	function addMeter(): void {
		canvasControl.engine?.addPartAtCenter('litz-multimeter');
	}
</script>

<div class="h-full overflow-y-auto px-3 py-2 text-[11px] text-stone-700">
	{#if !meters.length}
		<p class="text-stone-400">{m.meter_empty()}</p>
		<button
			type="button"
			class="mt-2 rounded border border-stone-300 bg-white px-2 py-1 text-[11px] hover:bg-stone-100"
			onclick={addMeter}
		>
			{m.meter_add()}
		</button>
	{:else}
		<p class="text-[10px] text-stone-400">{m.meter_hint()}</p>
		{#if !sim.running}
			<p class="mt-1 text-[10px] text-stone-400">{m.meter_idle()}</p>
		{/if}
		<div class="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
			{#each rows as row (row.id)}
				<div class="rounded border border-stone-200 bg-white px-3 py-2">
					<div class="flex items-center gap-2">
						<span class="font-mono text-[10px] text-stone-500">{row.id}</span>
						<select
							class="ml-auto rounded border border-stone-300 bg-white px-1 py-0.5 text-[10px]"
							value={row.mode}
							onchange={(event) => setMode(row.id, event.currentTarget.value)}
						>
							<option value="voltage">{m.meter_voltage()}</option>
							<option value="current">{m.meter_current()}</option>
						</select>
					</div>
					<div class="mt-1 font-mono text-2xl text-stone-800 tabular-nums">{row.text}</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
