<script lang="ts">
	import { onMount } from 'svelte';
	import { canvasControl } from '#lib/canvas/control';
	import type { Tool } from '#lib/canvas/engine';
	import { canvasStatus } from '#lib/canvas/status.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import BottomPanel from '#lib/components/editor/BottomPanel.svelte';
	import CanvasView from '#lib/components/editor/CanvasView.svelte';
	import EditorLinkDialog from '#lib/components/editor/EditorLinkDialog.svelte';
	import ExamplesDialog from '#lib/components/editor/ExamplesDialog.svelte';
	import Icon from '#lib/components/editor/Icon.svelte';
	import Inspector from '#lib/components/editor/Inspector.svelte';
	import MenuBar from '#lib/components/editor/MenuBar.svelte';
	import PartsBin from '#lib/components/editor/PartsBin.svelte';
	import ProjectInfoDialog from '#lib/components/editor/ProjectInfoDialog.svelte';
	import ProjectsDialog from '#lib/components/editor/ProjectsDialog.svelte';
	import SettingsDialog from '#lib/components/editor/SettingsDialog.svelte';
	import StatusBar from '#lib/components/editor/StatusBar.svelte';
	import TabRow from '#lib/components/editor/TabRow.svelte';
	import Toolbar from '#lib/components/editor/Toolbar.svelte';
	import { parseAttach } from '#lib/sim/attach';
	import { sim } from '#lib/sim/controller.svelte';
	import { link } from '#lib/sim/editorLink.svelte';
	import * as live from '#lib/sim/live';
	import { doc } from '#lib/sketch/doc.svelte';
	import { projects } from '#lib/storage/projects.svelte';
	import { ui } from '#lib/ui.svelte';

	let tool = $state<Tool>('select');
	// Below the xl breakpoint the side panels become drawers over the canvas.
	let partsOpen = $state(false);
	let inspectorOpen = $state(false);
	let saveTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		if (window.matchMedia('(pointer: coarse)').matches && window.innerHeight < 900) {
			ui.bottomHeight = 168;
		}
		const restored = doc.loadSaved();
		if (!restored) requestAnimationFrame(() => canvasControl.engine?.fit());
		// A stable handle for browser tests and for debugging a deployed build.
		(window as unknown as { __litz?: unknown }).__litz = { doc, ui, canvasControl, sim, live };
		// A link URL carries its own address, so a public editor attaches from
		// the fragment alone: `https://editor/#wss://host/ws#CODE`. A bare code
		// belongs to a link that also serves the page, so it goes to this host.
		// Either way the fragment is dropped, and without one the browser
		// reattaches to the link it used last.
		const hash = location.hash.slice(1);
		const attach = parseAttach(hash)
			? hash
			: hash
				? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws#${hash}`
				: '';
		if (attach) {
			if (link.connect(attach)) {
				history.replaceState(null, '', `${location.pathname}${location.search}`);
			}
		} else {
			link.restore();
		}
	});

	$effect(() => {
		void doc.rev;
		void doc.activeTab;
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			doc.save();
			projects.queue();
		}, 500);
	});

	// Each document runs its own session: a tab switch never leaves another
	// project's console on screen.
	let lastTab = doc.activeTab;
	$effect(() => {
		const tab = doc.activeTab;
		if (tab === lastTab) return;
		lastTab = tab;
		if (sim.running || sim.loading) sim.stop();
		sim.clearSerial();
		sim.clearFlash();
		ui.serialBoard = null;
		ui.codeFile = 'diagram.json';
	});

	// Probes live in the document, so a rename or a deletion reaches the
	// running scope without a restart.
	$effect(() => {
		void doc.rev;
		sim.syncProbes();
	});

	function shortcut(event: KeyboardEvent): void {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
			event.preventDefault();
			doc.save();
			void projects.flush();
			return;
		}
		const target = event.target as HTMLElement | null;
		if (
			target &&
			(target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
		)
			return;
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if (event.key === 'v') tool = 'select';
		else if (event.key === 'w') tool = 'wire';
		else if (event.key === 'p') tool = 'probe';
		else if (event.key === 'f') {
			canvasControl.engine?.fit();
		}
	}
</script>

<svelte:window onkeydown={shortcut} />

<div class="flex h-dvh flex-col overflow-hidden bg-stone-100 text-stone-800">
	<MenuBar />
	<TabRow />
	<Toolbar bind:tool />

	<div class="flex min-h-0 flex-1">
		<aside class="hidden w-[232px] shrink-0 border-r border-stone-300 bg-stone-50 xl:block">
			<PartsBin />
		</aside>

		<main class="relative min-w-0 flex-1 bg-[#f7f4ec]">
			<CanvasView {tool} />

			<div class="pointer-events-none absolute inset-0">
				<div class="pointer-events-auto absolute top-4 left-4 flex items-center gap-1.5">
					<button
						type="button"
						title={m.parts()}
						class="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-stone-700 shadow-lg ring-1 ring-stone-300/80 hover:bg-white xl:hidden [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
						onclick={() => (partsOpen = true)}
					>
						<Icon name="parts" size={17} />
					</button>
				</div>

				<button
					type="button"
					title={m.inspector()}
					class="pointer-events-auto absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-stone-700 shadow-lg ring-1 ring-stone-300/80 hover:bg-white xl:hidden [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
					onclick={() => (inspectorOpen = true)}
				>
					<Icon name="sliders" size={17} />
				</button>

				<div
					class="pointer-events-auto absolute bottom-4 left-4 flex items-center rounded-lg border border-stone-300 bg-white/95 text-[11px] text-stone-700 shadow-lg"
				>
					<button
						type="button"
						class="flex h-8 w-8 items-center justify-center rounded-l-lg hover:bg-stone-100 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10"
						title={m.zoom_out_title()}
						onclick={() => canvasControl.engine?.zoomBy(1 / 1.2)}
					>
						<Icon name="minus" size={14} />
					</button>
					<span class="w-12 text-center tabular-nums [@media(pointer:coarse)]:w-14">
						{Math.round(canvasStatus.zoom * 100)}%
					</span>
					<button
						type="button"
						class="flex h-8 w-8 items-center justify-center hover:bg-stone-100 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10"
						title={m.zoom_in_title()}
						onclick={() => canvasControl.engine?.zoomBy(1.2)}
					>
						<Icon name="plus" size={14} />
					</button>
					<span class="mx-0.5 h-4 w-px bg-stone-200"></span>
					<button
						type="button"
						class="flex h-8 w-8 items-center justify-center rounded-r-lg hover:bg-stone-100 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10"
						title={m.tool_fit()}
						onclick={() => canvasControl.engine?.fit()}
					>
						<Icon name="fit" size={14} />
					</button>
				</div>
			</div>

			{#if partsOpen}
				<div class="pointer-events-auto absolute inset-0 z-40 xl:hidden">
					<button
						type="button"
						aria-label={m.close()}
						class="absolute inset-0 bg-black/25"
						onclick={() => (partsOpen = false)}
					></button>
					<aside
						class="absolute inset-y-0 left-0 flex w-[280px] flex-col border-r border-stone-300 bg-stone-50 shadow-2xl"
					>
						<div
							class="flex h-11 shrink-0 items-center justify-between border-b border-stone-200 px-3"
						>
							<span class="text-[13px] font-medium text-stone-600">{m.parts()}</span>
							<button
								type="button"
								class="flex h-9 w-9 items-center justify-center rounded text-stone-500 hover:bg-stone-200"
								onclick={() => (partsOpen = false)}
							>
								<Icon name="close" size={18} />
							</button>
						</div>
						<div class="min-h-0 flex-1">
							<PartsBin onAdd={() => (partsOpen = false)} />
						</div>
					</aside>
				</div>
			{/if}

			{#if inspectorOpen}
				<div class="pointer-events-auto absolute inset-0 z-40 xl:hidden">
					<button
						type="button"
						aria-label={m.close()}
						class="absolute inset-0 bg-black/25"
						onclick={() => (inspectorOpen = false)}
					></button>
					<aside
						class="absolute inset-y-0 right-0 flex w-[300px] flex-col border-l border-stone-300 bg-stone-50 shadow-2xl"
					>
						<div
							class="flex h-11 shrink-0 items-center justify-between border-b border-stone-200 px-3"
						>
							<span class="text-[13px] font-medium text-stone-600">{m.inspector()}</span>
							<button
								type="button"
								class="flex h-9 w-9 items-center justify-center rounded text-stone-500 hover:bg-stone-200"
								onclick={() => (inspectorOpen = false)}
							>
								<Icon name="close" size={18} />
							</button>
						</div>
						<div class="min-h-0 flex-1 overflow-y-auto">
							<Inspector />
						</div>
					</aside>
				</div>
			{/if}
		</main>

		<aside class="hidden w-[280px] shrink-0 flex-col border-l border-stone-300 bg-stone-50 xl:flex">
			<div class="min-h-0 flex-1 overflow-y-auto">
				<Inspector />
			</div>
		</aside>
	</div>

	<BottomPanel />
	<StatusBar />
	<SettingsDialog />
	<EditorLinkDialog />
	<ProjectsDialog />
	<ExamplesDialog />
	<ProjectInfoDialog />
</div>
