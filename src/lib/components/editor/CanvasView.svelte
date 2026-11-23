<script lang="ts">
	import { onMount } from 'svelte';
	import { BOARD_MIME, PART_MIME } from '#lib/canvas/drag';
	import { CanvasEngine, type Tool } from '#lib/canvas/engine';
	import { canvasControl } from '#lib/canvas/control';
	import { doc } from '#lib/sketch/doc.svelte';
	import type { BoardType } from '#lib/sketch/types';

	let { tool = 'select' }: { tool?: Tool } = $props();

	let canvas: HTMLCanvasElement;
	let engine: CanvasEngine | null = null;

	function carries(event: DragEvent): boolean {
		const types = event.dataTransfer?.types;
		return !!types && (types.includes(PART_MIME) || types.includes(BOARD_MIME));
	}

	function dragOver(event: DragEvent): void {
		if (!carries(event)) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
	}

	function drop(event: DragEvent): void {
		if (!carries(event) || !engine) return;
		event.preventDefault();
		const rect = canvas.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		const part = event.dataTransfer?.getData(PART_MIME);
		const board = event.dataTransfer?.getData(BOARD_MIME);
		if (part) engine.dropPart(part, x, y);
		else if (board) engine.dropBoard(board as BoardType, x, y);
	}

	onMount(() => {
		engine = new CanvasEngine(canvas);
		engine.attach();
		engine.setTool(tool);
		canvasControl.engine = engine;
		engine.fit();
		return () => {
			canvasControl.engine = null;
			engine?.detach();
			engine = null;
		};
	});

	$effect(() => {
		void doc.rev;
		engine?.invalidate();
	});

	$effect(() => {
		engine?.setTool(tool);
	});
</script>

<canvas
	bind:this={canvas}
	class="block h-full w-full touch-none select-none"
	ondragover={dragOver}
	ondrop={drop}
></canvas>
