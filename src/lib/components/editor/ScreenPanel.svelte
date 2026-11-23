<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { panelFrame } from '#lib/parts/art';
	import { isPanelPart, TOUCH_TYPE, touchCode } from '#lib/parts/panels';
	import { partDef } from '#lib/parts/registry';
	import { sim } from '#lib/sim/controller.svelte';
	import { doc } from '#lib/sketch/doc.svelte';
	import { ui } from '#lib/ui.svelte';
	import Icon from './Icon.svelte';

	let canvas = $state<HTMLCanvasElement | null>(null);
	let box = $state<HTMLDivElement | null>(null);
	let boxWidth = $state(0);
	let boxHeight = $state(0);
	let frameWidth = $state(0);
	let frameHeight = $state(0);
	let zoom = $state<'fit' | number>('fit');
	let pressed = $state(false);

	const panels = $derived.by(() => {
		void doc.rev;
		return doc.sketch.parts.filter((part) => isPanelPart(part.type));
	});

	const selected = $derived(panels.find((part) => part.id === ui.screenPart) ?? panels[0] ?? null);

	const hasTouch = $derived.by(() => {
		void doc.rev;
		return doc.sketch.parts.some((part) => part.type === TOUCH_TYPE);
	});

	const fitScale = $derived.by(() => {
		if (frameWidth <= 0 || frameHeight <= 0) return 1;
		const scale = Math.min(boxWidth / frameWidth, boxHeight / frameHeight);
		return Math.max(1, Math.floor(scale));
	});

	const scale = $derived(zoom === 'fit' ? fitScale : zoom);
	const cssWidth = $derived(Math.round(frameWidth * scale));

	$effect(() => {
		const element = box;
		if (!element) return;
		const measure = () => {
			boxWidth = element.clientWidth;
			boxHeight = element.clientHeight;
		};
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		measure();
		return () => observer.disconnect();
	});

	$effect(() => {
		const element = canvas;
		const partId = selected?.id ?? null;
		if (!element || !partId) return;
		let raf = 0;
		let version = -1;
		const paint = () => {
			raf = requestAnimationFrame(paint);
			const part = doc.part(partId);
			if (!part) return;
			const frame = panelFrame(part);
			const expected = frame ? frame.width * frame.height * 4 : 0;
			if (!frame || frame.rgba.length < expected) return;
			if (
				version === frame.version &&
				element.width === frame.width &&
				element.height === frame.height
			)
				return;
			element.width = frame.width;
			element.height = frame.height;
			const context = element.getContext('2d');
			if (!context) return;
			context.putImageData(
				new ImageData(
					new Uint8ClampedArray(frame.rgba.slice(0, expected)),
					frame.width,
					frame.height
				),
				0,
				0
			);
			version = frame.version;
			frameWidth = frame.width;
			frameHeight = frame.height;
		};
		paint();
		return () => cancelAnimationFrame(raf);
	});

	function choose(id: string): void {
		ui.screenPart = id;
		zoom = 'fit';
		frameWidth = 0;
		frameHeight = 0;
	}

	function zoomStep(direction: 1 | -1): void {
		const current = Math.max(1, Math.round(scale));
		zoom = Math.min(8, Math.max(1, current + direction));
	}

	function toggleZoom(): void {
		zoom = zoom === 'fit' ? Math.max(2, fitScale * 2) : 'fit';
	}

	/** The pointer's position in panel pixels. */
	function panelPoint(event: PointerEvent): { x: number; y: number } | null {
		if (!canvas || frameWidth <= 0 || frameHeight <= 0) return null;
		const rect = canvas.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return null;
		return {
			x: ((event.clientX - rect.left) / rect.width) * frameWidth,
			y: ((event.clientY - rect.top) / rect.height) * frameHeight
		};
	}

	/** A finger becomes the controller's raw codes; the driver calibrates them. */
	function send(event: PointerEvent, down: boolean): void {
		const at = panelPoint(event);
		sim.touch(at ? touchCode(at.x, frameWidth) : 0, at ? touchCode(at.y, frameHeight) : 0, down);
	}

	function pointerDown(event: PointerEvent): void {
		if (!hasTouch || !sim.running) return;
		const target = event.currentTarget as HTMLElement;
		target.setPointerCapture(event.pointerId);
		pressed = true;
		send(event, true);
	}

	function pointerMove(event: PointerEvent): void {
		if (!pressed) return;
		send(event, true);
	}

	function pointerUp(event: PointerEvent): void {
		if (!pressed) return;
		pressed = false;
		send(event, false);
	}
</script>

<div class="flex h-full min-h-0 flex-col gap-2 px-3 py-2 text-[11px] text-stone-600">
	<div class="flex flex-wrap items-center gap-1.5">
		{#each panels as part (part.id)}
			<button
				type="button"
				class="flex h-6 items-center rounded-md px-2 transition-colors {selected?.id === part.id
					? 'bg-white font-medium text-stone-900 shadow-sm ring-1 ring-stone-300'
					: 'text-stone-500 hover:bg-stone-200/70 hover:text-stone-800'}"
				onclick={() => choose(part.id)}
			>
				{partDef(part.type).name}
			</button>
		{:else}
			<span class="text-stone-400">{m.screen_empty()}</span>
		{/each}

		{#if selected}
			<div class="ml-auto flex shrink-0 items-center gap-1">
				<span class="text-stone-500 tabular-nums">
					{m.screen_size({ width: frameWidth, height: frameHeight })}
				</span>
				<span class="mx-0.5 h-4 w-px bg-stone-300"></span>
				<button
					type="button"
					class="flex h-6 w-6 items-center justify-center rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-800"
					aria-label={m.zoom_out_title()}
					onclick={() => zoomStep(-1)}
				>
					<Icon name="minus" size={12} />
				</button>
				<button
					type="button"
					class="h-6 rounded-md px-2 text-stone-500 hover:bg-stone-200 hover:text-stone-800 {zoom ===
					'fit'
						? 'font-medium text-stone-800'
						: ''}"
					onclick={() => (zoom = 'fit')}
				>
					{m.screen_zoom_fit()}
				</button>
				<button
					type="button"
					class="flex h-6 w-6 items-center justify-center rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-800"
					aria-label={m.zoom_in_title()}
					onclick={() => zoomStep(1)}
				>
					<Icon name="plus" size={12} />
				</button>
			</div>
		{/if}
	</div>

	<div
		bind:this={box}
		class="relative flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg bg-stone-900 p-3"
	>
		{#if selected}
			<canvas
				bind:this={canvas}
				class="block shrink-0 rounded-sm bg-stone-950 [image-rendering:pixelated] {hasTouch &&
				sim.running
					? 'cursor-crosshair touch-none'
					: ''}"
				style:width="{cssWidth}px"
				ondblclick={toggleZoom}
				onpointerdown={pointerDown}
				onpointermove={pointerMove}
				onpointerup={pointerUp}
				onpointercancel={pointerUp}
			></canvas>
		{:else}
			<span class="text-[12px] text-stone-400">{m.screen_empty()}</span>
		{/if}

		{#if selected && !sim.running}
			<span class="pointer-events-none absolute right-3 bottom-2 text-[11px] text-stone-400">
				{m.screen_idle()}
			</span>
		{:else if selected && !hasTouch}
			<span class="pointer-events-none absolute right-3 bottom-2 text-[11px] text-stone-400">
				{m.screen_no_touch()}
			</span>
		{:else if selected}
			<span class="pointer-events-none absolute right-3 bottom-2 text-[11px] text-stone-500">
				{m.screen_touch()}
			</span>
		{/if}
	</div>
</div>
