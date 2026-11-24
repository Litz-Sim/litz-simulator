<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { sim } from '#lib/sim/controller.svelte';
	import { doc } from '#lib/sketch/doc.svelte';
	import { toLitzDiagram } from '#lib/sketch/export';
	import { parseStorageFile, ui, type BottomTab } from '#lib/ui.svelte';
	import AnalysisPanel from './AnalysisPanel.svelte';
	import CodeFiles from './CodeFiles.svelte';
	import CodeEditor from './CodeEditor.svelte';
	import DebugPanel from './DebugPanel.svelte';
	import Icon from './Icon.svelte';
	import ScreenPanel from './ScreenPanel.svelte';
	import SerialMonitor from './SerialMonitor.svelte';
	import SerialPlot from './SerialPlot.svelte';

	const tabs: { key: BottomTab; label: string; icon: string }[] = [
		{ key: 'code', label: m.panel_code(), icon: 'code' },
		{ key: 'serial', label: m.panel_serial(), icon: 'terminal' },
		{ key: 'plot', label: m.panel_plot(), icon: 'chart' },
		{ key: 'screen', label: m.panel_screen(), icon: 'monitor' },
		{ key: 'analysis', label: m.panel_analysis(), icon: 'activity' },
		{ key: 'debug', label: m.panel_debug(), icon: 'bug' },
		{ key: 'log', label: m.panel_log(), icon: 'log' }
	];

	const diagramText = $derived.by(() => {
		void doc.rev;
		return JSON.stringify(toLitzDiagram(doc.sketch), null, 2);
	});

	const storage = $derived(parseStorageFile(ui.codeFile));
	const storageFile = $derived(
		storage
			? doc.programFor(storage.boardId).files.find((file) => file.name === storage.path)
			: undefined
	);
	const storageLabel = $derived(
		storage ? `${doc.part(storage.boardId)?.type ?? storage.boardId} / ${storage.path}` : ''
	);

	const serialBoards = $derived(
		sim.boardRuntime.map((board) => ({ id: board.id, name: board.name }))
	);
	const serialBoard = $derived(
		ui.serialBoard &&
			(serialBoards.some((board) => board.id === ui.serialBoard) ||
				sim.serialBoards[ui.serialBoard] !== undefined)
			? ui.serialBoard
			: (serialBoards[0]?.id ?? Object.keys(sim.serialBoards)[0] ?? null)
	);

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
		class="flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-stone-200 bg-stone-100 px-1.5 [@media(pointer:coarse)]:h-11"
	>
		{#each tabs as tab (tab.key)}
			<button
				type="button"
				class="flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12px] transition-colors [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:px-3 [@media(pointer:coarse)]:text-[13px] {ui.bottomTab ===
				tab.key
					? 'bg-white font-medium text-stone-900 shadow-sm ring-1 ring-stone-300'
					: 'text-stone-500 hover:bg-stone-200/70 hover:text-stone-800'}"
				onclick={() => {
					ui.bottomTab = tab.key;
					ui.bottomOpen = true;
				}}
			>
				<Icon name={tab.icon} size={13} />
				{tab.label}
			</button>
		{/each}
		<div class="ml-auto flex shrink-0 items-center gap-2 pl-2 text-[11px] text-stone-400">
			<span class="hidden lg:inline">{doc.name}</span>
			<button
				type="button"
				title={ui.bottomOpen ? m.panel_collapse() : m.panel_expand()}
				class="flex h-7 w-7 items-center justify-center rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-800 [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:w-9"
				onclick={() => (ui.bottomOpen = !ui.bottomOpen)}
			>
				<Icon name={ui.bottomOpen ? 'chevron' : 'chevron-up'} size={14} />
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
				<div class="flex h-full min-h-0">
					<div class="w-44 shrink-0 overflow-y-auto border-r border-stone-200 bg-stone-50 sm:w-52">
						<CodeFiles />
					</div>
					<div class="flex min-h-0 min-w-0 flex-1 flex-col">
						<div
							class="flex h-7 shrink-0 items-center gap-2 border-b border-stone-200 bg-stone-100 px-2 text-[11px] text-stone-500"
						>
							<span class="truncate font-mono text-stone-700">
								{storage ? storageLabel : ui.codeFile}
							</span>
							<span class="ml-auto shrink-0 text-[10px] text-stone-400">
								{sim.slotName}
							</span>
						</div>
						<div class="min-h-0 flex-1">
							{#key ui.codeFile}
								{#if ui.codeFile === 'diagram.json'}
									<CodeEditor value={diagramText} readonly />
								{:else if storage && storageFile}
									<CodeEditor
										value={storageFile.text}
										language="python"
										onchange={(text: string) =>
											doc.setBoardFile(storage.boardId, storageFile.name, text)}
									/>
								{:else}
									<p class="px-3 py-2 text-[11px] text-stone-400">{m.code_choose_file()}</p>
								{/if}
							{/key}
						</div>
					</div>
				</div>
			{:else if ui.bottomTab === 'serial'}
				<SerialMonitor
					text={sim.serialFor(serialBoard)}
					running={sim.running}
					error={sim.error}
					onSend={(text: string, board?: string) => sim.writeSerial(text, board)}
					boards={serialBoards}
					selected={serialBoard}
					onselect={(board: string) => (ui.serialBoard = board)}
					onClear={() => sim.clearSerial()}
					clearLabel={m.serial_clear()}
					waitingLabel={m.serial_waiting()}
					idleLabel={m.serial_idle()}
				/>
			{:else if ui.bottomTab === 'plot'}
				<SerialPlot text={sim.serialFor(serialBoard)} emptyLabel={m.serial_plot_empty()} />
			{:else if ui.bottomTab === 'screen'}
				<ScreenPanel />
			{:else if ui.bottomTab === 'analysis'}
				<AnalysisPanel />
			{:else if ui.bottomTab === 'debug'}
				<DebugPanel />
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
