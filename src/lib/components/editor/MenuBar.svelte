<script lang="ts">
	import { canvasControl } from '#lib/canvas/control';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale, setLocale } from '#lib/paraglide/runtime.js';
	import { blinkySketch } from '#lib/sketch/examples';
	import {
		buttonLedSketch,
		oledSketch,
		potSketch,
		trafficLightSketch
	} from '#lib/sketch/examples-extra';
	import { sim } from '#lib/sim/controller.svelte';
	import { doc } from '#lib/sketch/doc.svelte';
	import type { Sketch } from '#lib/sketch/types';
	import { ui } from '#lib/ui.svelte';

	interface Item {
		label: string;
		hint?: string;
		disabled?: () => boolean;
		checked?: () => boolean;
		run: () => void;
	}
	interface Sep {
		separator: true;
	}
	interface Menu {
		label: string;
		items: (Item | Sep)[];
	}

	let open = $state<string | null>(null);
	let fileInput: HTMLInputElement;
	let projectInput: HTMLInputElement;
	let firmwareInput: HTMLInputElement;
	let auxInput: HTMLInputElement;
	let auxKind: 'rom' | 'boot' | 'ptable' = 'boot';

	function download(name: string, blob: Blob): void {
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = name;
		link.click();
		URL.revokeObjectURL(url);
	}

	function exportJson(): void {
		download(`${doc.name}.litzboard.json`, new Blob([doc.toJSON()], { type: 'application/json' }));
	}

	function exportProject(): void {
		const name = doc.name.replace(/[\\/:*?"<>|]+/g, '-');
		download(
			`${name}.litzproject.json`,
			new Blob([doc.projectJSON()], { type: 'application/json' })
		);
	}

	async function importProjectFile(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		if (!doc.loadProject(await file.text())) {
			doc.projectError = m.error_project_invalid();
		}
	}

	function exportPng(): void {
		const data = canvasControl.engine?.toDataURL();
		if (!data) return;
		const link = document.createElement('a');
		link.href = data;
		link.download = `${doc.name}.png`;
		link.click();
	}

	async function importFile(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		doc.loadFromJSON(await file.text());
		requestAnimationFrame(() => canvasControl.engine?.fit());
	}

	function chooseAux(kind: 'rom' | 'boot' | 'ptable'): void {
		auxKind = kind;
		auxInput.click();
	}

	async function chooseAuxFile(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (file) await sim.loadImagePart(auxKind, file);
	}

	async function chooseFirmware(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		await sim.loadFirmware(file);
	}

	function openExample(factory: (name: string) => Sketch, name: string): void {
		doc.openSketch(name, factory(name));
		requestAnimationFrame(() => canvasControl.engine?.fit());
	}

	function exportVcd(): void {
		const text = sim.traceVcd();
		if (!text) return;
		download(`${doc.name}.vcd`, new Blob([text], { type: 'text/vcd' }));
	}

	async function chooseLocale(locale: 'en' | 'zh'): Promise<void> {
		if (getLocale() === locale) return;
		await setLocale(locale);
		window.location.reload();
	}

	function selectAll(): void {
		doc.setSelection([
			...doc.sketch.parts.map((part) => ({ kind: 'part' as const, id: part.id })),
			...doc.sketch.boards.map((board) => ({ kind: 'board' as const, id: board.id }))
		]);
	}

	const menus: Menu[] = [
		{
			label: m.menu_file(),
			items: [
				{
					label: m.menu_new_tab(),
					run: () => {
						doc.newTab();
						requestAnimationFrame(() => canvasControl.engine?.fit());
					}
				},
				{
					label: m.menu_example_blinky(),
					run: () => {
						const name = m.example_blinky_name();
						doc.openSketch(name, blinkySketch(name));
						requestAnimationFrame(() => canvasControl.engine?.fit());
					}
				},
				{
					label: m.menu_example_pot(),
					run: () => openExample(potSketch, m.example_pot_name())
				},
				{
					label: m.menu_example_button(),
					run: () => openExample(buttonLedSketch, m.example_button_name())
				},
				{
					label: m.menu_example_oled(),
					run: () => openExample(oledSketch, m.example_oled_name())
				},
				{
					label: m.menu_example_traffic(),
					run: () => openExample(trafficLightSketch, m.example_traffic_name())
				},
				{ label: m.menu_close_tab(), run: () => doc.closeTab(doc.activeTab) },
				{ separator: true },
				{ label: m.menu_save_project(), hint: '⌘S', run: () => doc.save() },
				{ label: m.menu_import_project(), run: () => projectInput.click() },
				{ label: m.menu_export_project(), run: exportProject },
				{ separator: true },
				{ label: m.menu_import_json(), run: () => fileInput.click() },
				{ label: m.menu_export_json(), run: exportJson },
				{ label: m.menu_export_png(), run: exportPng }
			]
		},
		{
			label: m.menu_edit(),
			items: [
				{ label: m.menu_undo(), hint: '⌘Z', disabled: () => !doc.canUndo, run: () => doc.undo() },
				{ label: m.menu_redo(), hint: '⇧⌘Z', disabled: () => !doc.canRedo, run: () => doc.redo() },
				{ separator: true },
				{ label: m.menu_copy(), hint: '⌘C', run: () => doc.copySelection() },
				{ label: m.menu_paste(), hint: '⌘V', run: () => doc.pasteClipboard() },
				{ label: m.menu_duplicate(), hint: '⌘D', run: () => doc.duplicateSelection() },
				{ label: m.menu_delete(), hint: '⌫', run: () => doc.deleteSelection() },
				{ separator: true },
				{ label: m.menu_select_all(), hint: '⌘A', run: selectAll },
				{ label: m.menu_deselect(), hint: 'Esc', run: () => doc.clearSelection() }
			]
		},
		{
			label: m.menu_view(),
			items: [
				{ label: m.menu_fit(), hint: 'F', run: () => canvasControl.engine?.fit() },
				{ label: m.menu_zoom_in(), hint: '+', run: () => canvasControl.engine?.zoomBy(1.2) },
				{ label: m.menu_zoom_out(), hint: '−', run: () => canvasControl.engine?.zoomBy(1 / 1.2) },
				{ separator: true },
				{ label: m.menu_toggle_bottom(), run: () => (ui.bottomOpen = !ui.bottomOpen) }
			]
		},
		{
			label: m.menu_place(),
			items: [
				{ label: m.menu_add_part(), hint: 'A', run: () => (ui.addOpen = true) },
				{ separator: true },
				{
					label: m.menu_add_bb_full(),
					run: () => canvasControl.engine?.addBoardAtCenter('breadboard-full')
				},
				{
					label: m.menu_add_bb_half(),
					run: () => canvasControl.engine?.addBoardAtCenter('breadboard-half')
				}
			]
		},
		{
			label: m.menu_simulate(),
			items: [
				{
					label: m.menu_run(),
					hint: '▶',
					disabled: () => sim.running || sim.loading,
					run: () => void sim.start()
				},
				{
					label: m.menu_stop(),
					hint: '■',
					disabled: () => !sim.running && !sim.loading,
					run: () => sim.stop()
				},
				{ separator: true },
				{
					label: m.menu_pause(),
					disabled: () => !sim.running || sim.paused,
					run: () => sim.pause()
				},
				{
					label: m.menu_resume(),
					disabled: () => !sim.running || !sim.paused,
					run: () => sim.resume()
				},
				{ label: m.menu_step_1(), disabled: () => !sim.running, run: () => sim.step(1) },
				{ label: m.menu_step(), disabled: () => !sim.running, run: () => sim.step(10) },
				{ label: m.menu_step_100(), disabled: () => !sim.running, run: () => sim.step(100) },
				{
					label: m.menu_reset(),
					disabled: () => !sim.running && !sim.loading,
					run: () => sim.reset()
				},
				{ separator: true },
				{
					label: m.menu_speed_quarter(),
					checked: () => sim.speed === 0.25,
					run: () => sim.setSpeed(0.25)
				},
				{
					label: m.menu_speed_half(),
					checked: () => sim.speed === 0.5,
					run: () => sim.setSpeed(0.5)
				},
				{
					label: m.menu_speed_normal(),
					checked: () => sim.speed === 1,
					run: () => sim.setSpeed(1)
				},
				{
					label: m.menu_speed_double(),
					checked: () => sim.speed === 2,
					run: () => sim.setSpeed(2)
				},
				{
					label: m.menu_speed_quad(),
					checked: () => sim.speed === 4,
					run: () => sim.setSpeed(4)
				},
				{
					label: m.menu_speed_max(),
					checked: () => sim.speed === 0,
					run: () => sim.setSpeed(0)
				},
				{ separator: true },
				{
					label: m.menu_analog(),
					checked: () => sim.analog,
					run: () => sim.setAnalog(!sim.analog)
				},
				{ label: m.menu_load_firmware(), run: () => firmwareInput.click() },
				{ label: m.menu_load_bootloader(), run: () => chooseAux('boot') },
				{ label: m.menu_load_partition(), run: () => chooseAux('ptable') },
				{ label: m.menu_load_rom(), run: () => chooseAux('rom') },
				{ label: m.menu_use_bundled(), run: () => sim.useBundledFirmware() },
				{
					label: m.menu_export_vcd(),
					disabled: () => !sim.running,
					run: exportVcd
				},
				{ separator: true },
				{
					label: m.menu_serial_panel(),
					run: () => ((ui.bottomOpen = true), (ui.bottomTab = 'serial'))
				},
				{
					label: m.menu_serial_plot(),
					run: () => ((ui.bottomOpen = true), (ui.bottomTab = 'plot'))
				},
				{
					label: m.menu_analysis_panel(),
					run: () => ((ui.bottomOpen = true), (ui.bottomTab = 'analysis'))
				},
				{
					label: m.panel_debug(),
					run: () => ((ui.bottomOpen = true), (ui.bottomTab = 'debug'))
				},
				{
					label: m.menu_manifests(),
					run: () => ((ui.bottomOpen = true), (ui.bottomTab = 'manifests'))
				},
				{ label: m.menu_code_panel(), run: () => ((ui.bottomOpen = true), (ui.bottomTab = 'code')) }
			]
		},
		{
			label: m.menu_help(),
			items: [
				{ label: m.menu_help_keys(), run: () => {} },
				{ label: m.menu_help_pan(), run: () => {} }
			]
		},
		{
			label: m.language(),
			items: [
				{ label: m.language_en(), run: () => void chooseLocale('en') },
				{ label: m.language_zh(), run: () => void chooseLocale('zh') }
			]
		}
	];
</script>

<svelte:window onclick={() => (open = null)} />

<div
	class="relative flex h-8 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-stone-300 bg-[#2f6fd0] px-2 text-[12px] whitespace-nowrap text-white [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:text-[13px]"
>
	<span class="mr-2 font-semibold tracking-tight">{m.app_title()}</span>
	{#each menus as menu (menu.label)}
		<div class="relative">
			<button
				type="button"
				class="shrink-0 rounded px-2 py-0.5 hover:bg-white/15 [@media(pointer:coarse)]:px-3 [@media(pointer:coarse)]:py-1.5 {open ===
				menu.label
					? 'bg-white/20'
					: ''}"
				onclick={(event) => {
					event.stopPropagation();
					open = open === menu.label ? null : menu.label;
				}}
				onmouseenter={() => {
					if (open) open = menu.label;
				}}
			>
				{menu.label}
			</button>
			{#if open === menu.label}
				<div
					class="absolute top-full left-0 z-50 mt-0.5 min-w-52 rounded border border-stone-300 bg-white py-1 text-stone-800 shadow-lg"
				>
					{#each menu.items as item, index (index)}
						{#if 'separator' in item}
							<div class="my-1 h-px bg-stone-200"></div>
						{:else}
							<button
								type="button"
								class="flex w-full items-center justify-between gap-6 px-3 py-1 text-left hover:bg-stone-100 disabled:opacity-40 [@media(pointer:coarse)]:py-2.5"
								disabled={item.disabled?.()}
								onclick={(event) => {
									event.stopPropagation();
									item.run();
									open = null;
								}}
							>
								<span class="flex items-center gap-1.5">
									{#if item.checked?.()}<span class="text-stone-700">✓</span>{/if}
									{item.label}
								</span>
								{#if item.hint}<span class="text-[11px] text-stone-400">{item.hint}</span>{/if}
							</button>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	{/each}

	<input
		bind:this={fileInput}
		type="file"
		accept="application/json,.json"
		class="hidden"
		onchange={importFile}
	/>
	<input
		bind:this={projectInput}
		type="file"
		accept=".json,.litzproject,application/json"
		class="hidden"
		onchange={importProjectFile}
	/>
	<input
		bind:this={firmwareInput}
		type="file"
		accept=".bin,.hex,application/octet-stream"
		class="hidden"
		onchange={chooseFirmware}
	/>
	<input
		bind:this={auxInput}
		type="file"
		accept=".bin,.elf,application/octet-stream"
		class="hidden"
		onchange={chooseAuxFile}
	/>
</div>
