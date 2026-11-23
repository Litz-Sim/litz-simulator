<script lang="ts">
	import { canvasControl } from '#lib/canvas/control';
	import { m } from '#lib/paraglide/messages.js';
	import { sim } from '#lib/sim/controller.svelte';
	import { doc } from '#lib/sketch/doc.svelte';
	import { ui } from '#lib/ui.svelte';
	import Icon from './Icon.svelte';

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
	let menuLeft = $state(0);
	let menuTop = $state(0);

	const MENU_WIDTH = 248;

	function placeMenu(button: HTMLElement): void {
		const rect = button.getBoundingClientRect();
		menuLeft = Math.max(8, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8));
		menuTop = rect.bottom + 6;
	}

	function toggleMenu(menu: Menu, event: MouseEvent): void {
		event.stopPropagation();
		const button = event.currentTarget as HTMLElement;
		placeMenu(button);
		open = open === menu.label ? null : menu.label;
	}

	function hoverMenu(menu: Menu, event: MouseEvent): void {
		if (!open || open === menu.label) return;
		placeMenu(event.currentTarget as HTMLElement);
		open = menu.label;
	}

	function closeMenu(event: KeyboardEvent): void {
		if (event.key === 'Escape') open = null;
	}

	function dismissMenu(event: MouseEvent): void {
		const target = event.target as Element | null;
		if (target?.closest('[data-menu-root]')) return;
		open = null;
	}

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

	function exportVcd(): void {
		const text = sim.traceVcd();
		if (!text) return;
		download(`${doc.name}.vcd`, new Blob([text], { type: 'text/vcd' }));
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
				{ label: m.menu_examples(), run: () => (ui.examplesOpen = true) },
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
					label: m.menu_screen_panel(),
					run: () => ((ui.bottomOpen = true), (ui.bottomTab = 'screen'))
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
		}
	];

	const activeMenu = $derived(menus.find((menu) => menu.label === open) ?? null);
</script>

<svelte:window onclick={dismissMenu} onresize={() => (open = null)} onkeydown={closeMenu} />

<header
	data-menu-root
	class="relative z-50 flex h-12 shrink-0 items-center gap-2 border-b border-stone-200 bg-white px-2 text-[13px] text-stone-700 [@media(pointer:coarse)]:h-14"
>
	<div class="flex shrink-0 items-center gap-2 pl-1">
		<span
			class="grid h-7 w-7 place-items-center rounded-lg bg-[#2f6fd0] text-white shadow-sm [@media(pointer:coarse)]:h-8 [@media(pointer:coarse)]:w-8"
		>
			<Icon name="chip" size={16} />
		</span>
		<span class="hidden font-semibold tracking-tight text-stone-900 sm:inline">
			{m.app_title()}
		</span>
	</div>

	<span class="mr-1 hidden h-5 w-px shrink-0 bg-stone-200 sm:block"></span>

	<nav
		class="flex min-w-0 [scrollbar-width:none] items-center gap-0.5 overflow-x-auto overscroll-x-contain [&::-webkit-scrollbar]:hidden"
		aria-label={m.app_title()}
	>
		{#each menus as menu (menu.label)}
			<button
				type="button"
				class="h-8 shrink-0 rounded-md px-2.5 text-[13px] whitespace-nowrap transition-colors [@media(pointer:coarse)]:px-3 [@media(pointer:coarse)]:py-1.5 {open ===
				menu.label
					? 'bg-stone-100 text-stone-900'
					: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'}"
				aria-haspopup="menu"
				aria-expanded={open === menu.label}
				onclick={(event) => toggleMenu(menu, event)}
				onmouseenter={(event) => hoverMenu(menu, event)}
			>
				{menu.label}
			</button>
		{/each}
	</nav>

	<div class="ml-auto flex shrink-0 items-center gap-2 pl-2">
		<button
			type="button"
			title={m.settings()}
			aria-label={m.settings()}
			class="grid h-8 w-8 shrink-0 place-items-center rounded-md text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10"
			onclick={() => (ui.settingsOpen = true)}
		>
			<Icon name="settings" size={16} />
		</button>
		<button
			type="button"
			disabled={sim.loading}
			class="flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-medium text-white shadow-sm transition-colors disabled:cursor-wait disabled:opacity-60 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:px-4 [@media(pointer:coarse)]:text-[13px] {sim.running
				? 'bg-red-600 hover:bg-red-700'
				: 'bg-emerald-600 hover:bg-emerald-700'}"
			title={sim.running ? m.stop_sim() : m.run_sim()}
			onclick={() => sim.toggle()}
		>
			<Icon
				name={sim.loading ? 'loader' : sim.running ? 'stop' : 'play'}
				size={14}
				class={sim.loading ? 'animate-spin' : ''}
			/>
			<span class="hidden sm:inline">
				{sim.loading ? m.sim_loading() : sim.running ? m.menu_stop() : m.menu_run()}
			</span>
		</button>
	</div>
</header>

{#if activeMenu}
	<div
		data-menu-root
		class="fixed z-[90] overflow-y-auto rounded-xl border border-stone-200 bg-white py-1.5 text-[12px] text-stone-700 shadow-xl ring-1 ring-black/5"
		style:left="{menuLeft}px"
		style:top="{menuTop}px"
		style:width="{MENU_WIDTH}px"
		style:max-height="calc(100dvh - {menuTop + 10}px)"
	>
		{#each activeMenu.items as item, index (index)}
			{#if 'separator' in item}
				<div class="mx-2 my-1 h-px bg-stone-200"></div>
			{:else}
				<button
					type="button"
					class="mx-1 flex w-[calc(100%-0.5rem)] items-center justify-between gap-6 rounded-md px-2.5 py-1.5 text-left hover:bg-stone-100 disabled:opacity-40 [@media(pointer:coarse)]:py-2.5"
					disabled={item.disabled?.()}
					onclick={(event) => {
						event.stopPropagation();
						item.run();
						open = null;
					}}
				>
					<span class="flex min-w-0 items-center gap-1.5">
						{#if item.checked?.()}
							<Icon name="check" size={13} class="shrink-0 text-stone-500" />
						{:else}
							<span class="h-[13px] w-[13px] shrink-0"></span>
						{/if}
						<span class="truncate">{item.label}</span>
					</span>
					{#if item.hint}<span class="shrink-0 text-[11px] text-stone-400">{item.hint}</span>{/if}
				</button>
			{/if}
		{/each}
	</div>
{/if}

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
