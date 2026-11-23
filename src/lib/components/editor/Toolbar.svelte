<script lang="ts">
	import { canvasControl } from '#lib/canvas/control';
	import { colorLabel } from '#lib/i18n/labels';
	import { m } from '#lib/paraglide/messages.js';
	import type { Tool } from '#lib/canvas/engine';
	import { doc } from '#lib/sketch/doc.svelte';
	import { WIRE_COLORS } from '#lib/sketch/types';
	import Icon from './Icon.svelte';

	let { tool = $bindable('select') }: { tool?: Tool } = $props();

	let paletteOpen = $state(false);

	const selectedWire = $derived(doc.selectedWires()[0]);
	const hasParts = $derived(doc.selected.some((s) => s.kind !== 'wire'));

	function pickColor(value: string): void {
		doc.wireColor = value;
		if (selectedWire) doc.setWireColor(selectedWire.id, value);
		paletteOpen = false;
	}

	const currentColor = $derived(selectedWire?.color ?? doc.wireColor);
	const ghost =
		'flex h-7 w-8 shrink-0 items-center justify-center rounded-md text-stone-600 transition-colors hover:bg-stone-200 hover:text-stone-900 disabled:opacity-35 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-11';
</script>

<svelte:window
	onclick={() => (paletteOpen = false)}
	onkeydown={(event: KeyboardEvent) => {
		if (event.key === 'Escape') paletteOpen = false;
	}}
/>

<div
	class="relative z-30 flex h-11 shrink-0 items-center gap-1 border-b border-stone-300 bg-stone-50 px-2 [@media(pointer:coarse)]:h-12"
>
	<div class="flex items-center gap-0.5 rounded-md bg-stone-200/70 p-0.5">
		<button
			type="button"
			title={m.tool_select()}
			class="flex h-7 w-9 items-center justify-center rounded transition-colors [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-12 {tool ===
			'select'
				? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-300'
				: 'text-stone-600 hover:text-stone-900'}"
			onclick={() => (tool = 'select')}
		>
			<Icon name="cursor" />
		</button>
		<button
			type="button"
			title={m.tool_wire()}
			class="flex h-7 w-9 items-center justify-center rounded transition-colors [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-12 {tool ===
			'wire'
				? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-300'
				: 'text-stone-600 hover:text-stone-900'}"
			onclick={() => (tool = 'wire')}
		>
			<Icon name="wire" />
		</button>
	</div>

	<span class="mx-1 h-5 w-px bg-stone-300"></span>

	<button
		type="button"
		title={m.tool_rotate()}
		class={ghost}
		disabled={!hasParts}
		onclick={() => doc.rotateSelection()}
	>
		<Icon name="rotate" />
	</button>
	<button
		type="button"
		title={m.tool_delete()}
		class={ghost}
		disabled={!doc.selected.length}
		onclick={() => doc.deleteSelection()}
	>
		<Icon name="trash" />
	</button>

	<span class="mx-1 h-5 w-px bg-stone-300"></span>

	<button
		type="button"
		title={m.tool_undo()}
		class={ghost}
		disabled={!doc.canUndo}
		onclick={() => doc.undo()}
	>
		<Icon name="undo" />
	</button>
	<button
		type="button"
		title={m.tool_redo()}
		class={ghost}
		disabled={!doc.canRedo}
		onclick={() => doc.redo()}
	>
		<Icon name="redo" />
	</button>

	<span class="mx-1 h-5 w-px bg-stone-300"></span>

	<div class="relative">
		<button
			type="button"
			title={m.wire_color()}
			aria-haspopup="dialog"
			aria-expanded={paletteOpen}
			class="flex h-7 items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2 text-[11px] text-stone-600 shadow-sm transition-colors hover:border-stone-400 hover:text-stone-900 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:px-3"
			onclick={(event) => {
				event.stopPropagation();
				paletteOpen = !paletteOpen;
			}}
		>
			<span class="h-3.5 w-3.5 rounded-full border border-black/15" style:background={currentColor}
			></span>
			<span class="hidden md:inline">{m.wire_color()}</span>
			<Icon name="chevron" size={12} />
		</button>

		{#if paletteOpen}
			<div
				class="absolute top-full left-0 z-50 mt-2 w-56 rounded-xl border border-stone-200 bg-white p-2.5 shadow-xl ring-1 ring-black/5"
			>
				<p class="px-1 pb-1.5 text-[11px] font-medium text-stone-500">{m.wire_color()}</p>
				<div class="grid grid-cols-5 gap-2">
					{#each WIRE_COLORS as color (color.value)}
						<button
							type="button"
							title={colorLabel(color.name)}
							aria-label={colorLabel(color.name)}
							class="h-8 w-8 rounded-full border transition-transform hover:scale-105 {currentColor ===
							color.value
								? 'border-stone-900 ring-2 ring-stone-400 ring-offset-1'
								: 'border-black/15'}"
							style:background={color.value}
							onclick={() => pickColor(color.value)}
						></button>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<div class="ml-auto flex items-center gap-1">
		<button
			type="button"
			title={m.snap_hint()}
			aria-pressed={doc.snap}
			class="flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] transition-colors [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:px-3 [@media(pointer:coarse)]:text-[13px] {doc.snap
				? 'bg-stone-800 text-white'
				: 'text-stone-600 hover:bg-stone-200 hover:text-stone-900'}"
			onclick={() => (doc.snap = !doc.snap)}
		>
			<Icon name="grid" size={14} />
			<span class="hidden sm:inline">{m.snap_short()}</span>
		</button>
		<button
			type="button"
			title={m.tool_fit()}
			class={ghost}
			onclick={() => canvasControl.engine?.fit()}
		>
			<Icon name="fit" />
		</button>
	</div>
</div>
