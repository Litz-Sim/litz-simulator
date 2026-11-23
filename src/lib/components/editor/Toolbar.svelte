<script lang="ts">
	import { canvasControl } from '#lib/canvas/control';
	import { colorLabel } from '#lib/i18n/labels';
	import { m } from '#lib/paraglide/messages.js';
	import type { Tool } from '#lib/canvas/engine';
	import { doc } from '#lib/sketch/doc.svelte';
	import { WIRE_COLORS } from '#lib/sketch/types';
	import Icon from './Icon.svelte';

	let { tool = $bindable('select') }: { tool?: Tool } = $props();

	const selectedWire = $derived(doc.selectedWires()[0]);
	const hasParts = $derived(doc.selected.some((s) => s.kind !== 'wire'));

	function pickColor(value: string): void {
		doc.wireColor = value;
		if (selectedWire) doc.setWireColor(selectedWire.id, value);
	}

	const currentColor = $derived(selectedWire?.color ?? doc.wireColor);
</script>

<div
	class="flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b border-stone-300 bg-stone-50 px-2 [@media(pointer:coarse)]:h-12"
>
	<button
		type="button"
		title={m.tool_select()}
		class="flex h-7 w-8 shrink-0 items-center justify-center rounded [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-11 {tool ===
		'select'
			? 'bg-stone-800 text-white'
			: 'text-stone-700 hover:bg-stone-200'}"
		onclick={() => (tool = 'select')}
	>
		<Icon name="cursor" />
	</button>
	<button
		type="button"
		title={m.tool_wire()}
		class="flex h-7 w-8 shrink-0 items-center justify-center rounded [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-11 {tool ===
		'wire'
			? 'bg-stone-800 text-white'
			: 'text-stone-700 hover:bg-stone-200'}"
		onclick={() => (tool = 'wire')}
	>
		<Icon name="wire" />
	</button>

	<span class="mx-1 h-5 w-px bg-stone-300"></span>

	<button
		type="button"
		title={m.tool_rotate()}
		class="flex h-7 w-8 shrink-0 items-center justify-center rounded text-stone-700 hover:bg-stone-200 disabled:opacity-35 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-11"
		disabled={!hasParts}
		onclick={() => doc.rotateSelection()}
	>
		<Icon name="rotate" />
	</button>
	<button
		type="button"
		title={m.tool_delete()}
		class="flex h-7 w-8 shrink-0 items-center justify-center rounded text-stone-700 hover:bg-stone-200 disabled:opacity-35 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-11"
		disabled={!doc.selected.length}
		onclick={() => doc.deleteSelection()}
	>
		<Icon name="trash" />
	</button>

	<span class="mx-1 h-5 w-px bg-stone-300"></span>

	<button
		type="button"
		title={m.tool_undo()}
		class="flex h-7 w-8 shrink-0 items-center justify-center rounded text-stone-700 hover:bg-stone-200 disabled:opacity-35 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-11"
		disabled={!doc.canUndo}
		onclick={() => doc.undo()}
	>
		<Icon name="undo" />
	</button>
	<button
		type="button"
		title={m.tool_redo()}
		class="flex h-7 w-8 shrink-0 items-center justify-center rounded text-stone-700 hover:bg-stone-200 disabled:opacity-35 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-11"
		disabled={!doc.canRedo}
		onclick={() => doc.redo()}
	>
		<Icon name="redo" />
	</button>

	<span class="mx-1 h-5 w-px bg-stone-300"></span>

	<div class="flex items-center gap-1" title={m.wire_color()}>
		{#each WIRE_COLORS as color (color.value)}
			<button
				type="button"
				aria-label={colorLabel(color.name)}
				class="h-4 w-4 shrink-0 rounded-full border [@media(pointer:coarse)]:h-7 [@media(pointer:coarse)]:w-7 {currentColor ===
				color.value
					? 'border-stone-800 ring-2 ring-stone-400'
					: 'border-stone-400'}"
				style="background: {color.value}"
				onclick={() => pickColor(color.value)}
			></button>
		{/each}
	</div>

	<span class="mx-1 h-5 w-px bg-stone-300"></span>

	<button
		type="button"
		title={m.snap_hint()}
		class="ml-1 flex h-7 shrink-0 items-center gap-1 rounded px-2 text-[11px] [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:text-[13px] {doc.snap
			? 'bg-stone-800 text-white'
			: 'text-stone-700 hover:bg-stone-200'}"
		onclick={() => (doc.snap = !doc.snap)}
	>
		<Icon name="grid" size={14} />
		<span class="[@media(pointer:coarse)]:hidden">{m.snap_hint()}</span>
	</button>

	<div class="ml-auto flex items-center gap-1">
		<button
			type="button"
			title={m.tool_fit()}
			class="flex h-7 w-8 shrink-0 items-center justify-center rounded text-stone-700 hover:bg-stone-200 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-11"
			onclick={() => canvasControl.engine?.fit()}
		>
			<Icon name="fit" />
		</button>
	</div>
</div>
