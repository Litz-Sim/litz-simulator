<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { sim } from '#lib/sim/controller.svelte';
	import { doc } from '#lib/sketch/doc.svelte';
	import { toLitzDiagram } from '#lib/sketch/export';
	import { ui, type BottomTab } from '#lib/ui.svelte';
	import AnalysisPanel from './AnalysisPanel.svelte';
	import CodeEditor from './CodeEditor.svelte';
	import DebugPanel from './DebugPanel.svelte';
	import Icon from './Icon.svelte';
	import ManifestsPanel from './ManifestsPanel.svelte';
	import SerialMonitor from './SerialMonitor.svelte';
	import SerialPlot from './SerialPlot.svelte';

	const tabs: { key: BottomTab; label: string }[] = [
		{ key: 'code', label: m.panel_code() },
		{ key: 'serial', label: m.panel_serial() },
		{ key: 'plot', label: m.panel_plot() },
		{ key: 'analysis', label: m.panel_analysis() },
		{ key: 'debug', label: m.panel_debug() },
		{ key: 'manifests', label: m.panel_manifests() },
		{ key: 'log', label: m.panel_log() }
	];

	const diagramText = $derived.by(() => {
		void doc.rev;
		return JSON.stringify(toLitzDiagram(doc.sketch), null, 2);
	});

	function startResize(event: PointerEvent): void {
		const startY = event.clientY;
		const startHeight = ui.bottomHeight;
		const target = event.currentTarget as HTMLElement;
		target.setPointerCapture(event.pointerId);

		const move = (e: PointerEvent) => {
			const max = Math.max(160, window.innerHeight - 260);
			ui.bottomHeight = Math.min(max, Math.max(96, startHeight + startY - e.clientY));
		};
		const end = () => {
			target.removeEventListener('pointermove', move);
			target.removeEventListener('pointerup', end);
			target.removeEventListener('pointercancel', end);
		};
		target.addEventListener('pointermove', move);
		target.addEventListener('pointerup', end);
		target.addEventListener('pointercancel', end);
	}
</script>

<div class="shrink-0 border-t border-stone-300 bg-stone-50">
	<div
		class="flex h-8 items-center gap-0.5 overflow-x-auto border-b border-stone-200 px-2 [@media(pointer:coarse)]:h-11"
	>
		{#each tabs as tab (tab.key)}
			<button
				type="button"
				class="shrink-0 rounded-t px-2.5 py-0.5 text-[12px] [@media(pointer:coarse)]:px-3 [@media(pointer:coarse)]:py-1.5 [@media(pointer:coarse)]:text-[13px] {ui.bottomTab ===
				tab.key
					? 'bg-stone-200 font-medium text-stone-800'
					: 'text-stone-500 hover:bg-stone-200/60'}"
				onclick={() => {
					ui.bottomTab = tab.key;
					ui.bottomOpen = true;
				}}
			>
				{tab.label}
			</button>
		{/each}
		<div class="ml-auto flex items-center gap-2 text-[11px] text-stone-400">
			<span>{doc.name}</span>
			<button
				type="button"
				title={ui.bottomOpen ? m.panel_collapse() : m.panel_expand()}
				class="flex h-6 w-6 items-center justify-center rounded hover:bg-stone-200 [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:w-9"
				onclick={() => (ui.bottomOpen = !ui.bottomOpen)}
			>
				<span class={ui.bottomOpen ? 'rotate-180' : ''}><Icon name="chevron" size={14} /></span>
			</button>
		</div>
	</div>

	{#if ui.bottomOpen}
		<div
			role="separator"
			aria-orientation="horizontal"
			aria-label={m.panel_resize()}
			class="h-1 cursor-row-resize bg-transparent hover:bg-stone-300 [@media(pointer:coarse)]:h-3 [@media(pointer:coarse)]:bg-stone-200"
			onpointerdown={startResize}
		></div>
		<div style="height: {ui.bottomHeight}px">
			{#if ui.bottomTab === 'code'}
				<div class="flex h-full flex-col">
					<div
						class="flex h-7 shrink-0 items-center gap-0 border-b border-stone-200 bg-stone-100 px-2"
					>
						<button
							type="button"
							class="rounded px-2 py-0.5 text-[11px] {ui.codeFile === 'main.c'
								? 'bg-white text-stone-800 shadow-sm'
								: 'text-stone-500 hover:text-stone-700'}"
							onclick={() => (ui.codeFile = 'main.c')}
						>
							main.c
						</button>
						<button
							type="button"
							class="rounded px-2 py-0.5 text-[11px] {ui.codeFile === 'diagram.json'
								? 'bg-white text-stone-800 shadow-sm'
								: 'text-stone-500 hover:text-stone-700'}"
							onclick={() => (ui.codeFile = 'diagram.json')}
						>
							diagram.json
						</button>
						<span class="ml-auto text-[10px] text-stone-400">
							{ui.codeFile === 'diagram.json'
								? m.diagram_readonly()
								: m.firmware_slot({ name: sim.slotName })}
						</span>
					</div>
					<div class="min-h-0 flex-1">
						{#key ui.codeFile}
							{#if ui.codeFile === 'main.c'}
								<CodeEditor value={doc.code} onchange={(text: string) => (doc.code = text)} />
							{:else}
								<CodeEditor value={diagramText} readonly />
							{/if}
						{/key}
					</div>
				</div>
			{:else if ui.bottomTab === 'serial'}
				<SerialMonitor
					text={sim.serial}
					running={sim.running}
					error={sim.error}
					onSend={(text: string, board?: string) => sim.writeSerial(text, board)}
					boards={sim.boardRuntime.map((board) => board.id)}
					onClear={() => sim.clearSerial()}
					placeholder={m.serial_placeholder()}
					sendLabel={m.serial_send()}
					clearLabel={m.serial_clear()}
					waitingLabel={m.serial_waiting()}
					idleLabel={m.serial_idle()}
				/>
			{:else if ui.bottomTab === 'plot'}
				<SerialPlot text={sim.serial} emptyLabel={m.serial_plot_empty()} />
			{:else if ui.bottomTab === 'analysis'}
				<AnalysisPanel />
			{:else if ui.bottomTab === 'debug'}
				<DebugPanel />
			{:else if ui.bottomTab === 'manifests'}
				<ManifestsPanel
					manifests={sim.manifests}
					title={m.manifest_title()}
					hint={m.manifest_hint()}
					nameLabel={m.manifest_name()}
					textLabel={m.manifest_text()}
					addLabel={m.analysis_add()}
					removeLabel={m.analysis_remove()}
					emptyLabel={m.manifest_empty()}
					onadd={(name: string, text: string) => sim.addManifest(name, text)}
					onremove={(name: string) => sim.removeManifest(name)}
				/>
			{:else}
				<div
					class="h-full overflow-y-auto px-3 py-1.5 font-mono text-[11px] leading-relaxed text-stone-500"
				>
					{#if sim.entries.length}
						{#each sim.entries as entry, index (index)}
							<p class={entry.text === sim.error ? 'text-red-600' : ''}>
								<span class="mr-2 inline-block w-14 text-right text-stone-400">
									{(entry.at / 1000).toFixed(2)}s
								</span>
								{entry.text}
							</p>
						{/each}
					{:else}
						<p class="text-stone-400">
							{m.log_ready()}
						</p>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
