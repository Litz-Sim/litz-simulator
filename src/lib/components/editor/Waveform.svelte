<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { ProbeRecord } from '#lib/sim/backend';

	const GUTTER = 110;
	const LANE_HEIGHT = 30;
	const AXIS_HEIGHT = 18;
	const PAD_TOP = 4;
	const RIGHT_PAD = 12;
	const MIN_HEIGHT = 120;
	/** Pixels per millisecond at the zoom limits. */
	const MIN_SCALE = 1e-6;
	const MAX_SCALE = 4;
	const ZOOM_STEP = 1.6;
	const ACCENTS = ['#3f7f5f', '#b06a2c', '#3d6fb4', '#8a5ab8', '#b23b3b'];

	type HoverState = { x: number; t: number; lane: number };

	type Layout = {
		laneTop: number;
		plotRight: number;
		axisY: number;
	};

	let {
		probes,
		endMs,
		emptyLabel,
		hint
	}: {
		probes: ProbeRecord[];
		endMs: number;
		emptyLabel: string;
		hint: string;
	} = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let scroller: HTMLDivElement | undefined = $state();
	let viewWidth = $state(1);
	let pixelRatio = $state(1);
	let hover = $state<HoverState | null>(null);
	/** Timeline zoom, in pixels per millisecond. Zero means "fit on first data". */
	let scale = $state(0);
	let scrollLeft = $state(0);

	const cssHeight = $derived(
		Math.max(MIN_HEIGHT, PAD_TOP * 2 + probes.length * LANE_HEIGHT + AXIS_HEIGHT)
	);

	const isEmpty = $derived(
		probes.length === 0 || !probes.some((probe) => probe.digital.length > 0)
	);

	const durationMs = $derived.by(() => {
		let lastTick = 0;
		for (const probe of probes) {
			const lastDigital = probe.digital[probe.digital.length - 1];
			if (lastDigital) lastTick = Math.max(lastTick, lastDigital[0]);
			const lastVolt = probe.volts[probe.volts.length - 1];
			if (lastVolt) lastTick = Math.max(lastTick, lastVolt[0]);
		}
		const fromSamples = Number.isFinite(lastTick) ? lastTick / 1e6 : 0;
		const requested = Number.isFinite(endMs) && endMs > 0 ? endMs : 0;
		return Math.max(requested, fromSamples, 1);
	});

	const layout = $derived(computeLayout(viewWidth, cssHeight, probes.length));
	const currentScale = $derived(scale > 0 ? scale : fitScale());
	const contentWidth = $derived(
		Math.max(viewWidth, Math.ceil(durationMs * currentScale) + RIGHT_PAD)
	);
	const visibleLabel = $derived(formatSpan(viewWidth / currentScale));

	const hoverTimeLabel = $derived(hover ? formatHoverTime(hover.t) : '');
	const hoverLevelLabel = $derived.by(() => {
		if (!hover || hover.lane < 0) return '';
		const probe = probes[hover.lane];
		if (!probe) return '';
		const level = levelAt(probe, hover.t);
		return level === null ? '' : `${probe.name} ${levelGlyph(level)}`;
	});

	const labelTop = $derived.by(() => {
		if (!hover) return 0;
		const preferred = hover.lane >= 0 ? layout.laneTop + hover.lane * LANE_HEIGHT + 2 : PAD_TOP + 2;
		return Math.max(2, Math.min(cssHeight - 38, preferred));
	});
	const labelFlipped = $derived(hover !== null && hover.x > viewWidth - 118);
	const labelLeft = $derived(hover ? (labelFlipped ? hover.x - 6 : hover.x + 6) : 0);
	const labelTransform = $derived(labelFlipped ? 'translateX(-100%)' : 'none');

	function clampScale(value: number): number {
		if (!Number.isFinite(value) || value <= 0) return MIN_SCALE;
		return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
	}

	function fitScale(): number {
		return clampScale(viewWidth / Math.max(1, durationMs));
	}

	function fit(): void {
		scale = fitScale();
		setScroll(0);
	}

	/** Zoom about a viewport x, keeping the time under the cursor fixed. */
	function zoomBy(factor: number, anchorX = viewWidth / 2): void {
		const before = currentScale;
		const next = clampScale(before * factor);
		if (Math.abs(next - before) < before * 1e-6) return;
		const time = (scrollLeft + anchorX) / before;
		scale = next;
		setScroll(Math.max(0, time * next - anchorX));
	}

	function setScroll(value: number): void {
		scrollLeft = value;
		if (scroller) scroller.scrollLeft = value;
	}

	/**
	 * Pick a 1-2-5 tick step for a visible span. The tick count follows the plot
	 * width so labels keep about 70 px between them instead of colliding.
	 */
	function chooseStep(duration: number, plotWidth: number): number {
		const divisions = Math.max(2, Math.min(10, Math.round(plotWidth / 70)));
		const target = duration / divisions;
		const exponent = Math.floor(Math.log10(target));
		const candidates: number[] = [];
		for (let e = exponent - 1; e <= exponent + 1; e += 1) {
			const base = 10 ** e;
			for (const multiplier of [1, 2, 5]) candidates.push(multiplier * base);
		}
		let best = 1;
		let bestScore = Number.POSITIVE_INFINITY;
		for (const step of candidates) {
			if (!(step > 0) || !Number.isFinite(step)) continue;
			const count = duration / step;
			const score = Math.abs(count - divisions);
			if (score < bestScore) {
				bestScore = score;
				best = step;
			}
		}
		return best;
	}

	function computeLayout(width: number, height: number, count: number): Layout {
		const plotRight = Math.max(1, width - RIGHT_PAD);
		const laneAreaTop = PAD_TOP;
		const axisY = Math.max(laneAreaTop, height - AXIS_HEIGHT);
		const laneAreaHeight = Math.max(0, axisY - laneAreaTop);
		const lanesHeight = count * LANE_HEIGHT;
		const laneTop = laneAreaTop + Math.max(0, (laneAreaHeight - lanesHeight) / 2);
		return { laneTop, plotRight, axisY };
	}

	function axisUnit(step: number): { unit: string; scale: number } {
		if (step >= 1000) return { unit: 's', scale: 0.001 };
		if (step < 1) return { unit: 'µs', scale: 1000 };
		return { unit: 'ms', scale: 1 };
	}

	function trimZeros(text: string): string {
		return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
	}

	function formatHoverTime(time: number): string {
		const { unit, scale: unitScale } = axisUnit(stepForView());
		const value = time * unitScale;
		const magnitude = Math.abs(value);
		const decimals = magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : magnitude >= 1 ? 2 : 3;
		return `${trimZeros(value.toFixed(decimals))} ${unit}`;
	}

	function formatSpan(span: number): string {
		const { unit, scale: unitScale } = axisUnit(span);
		const value = span * unitScale;
		const decimals = value >= 100 ? 0 : value >= 10 ? 0 : value >= 1 ? 1 : 2;
		return `${trimZeros(value.toFixed(decimals))} ${unit}`;
	}

	function stepForView(): number {
		return chooseStep(viewWidth / currentScale, viewWidth - RIGHT_PAD);
	}

	function normalizeLevel(value: number): 0 | 1 | 2 {
		if (value === 1) return 1;
		if (value === 2) return 2;
		return 0;
	}

	function levelAt(probe: ProbeRecord, timeMs: number): 0 | 1 | 2 | null {
		const digital = probe.digital;
		if (digital.length === 0) return null;
		let low = 0;
		let high = digital.length - 1;
		let found = -1;
		while (low <= high) {
			const middle = (low + high) >> 1;
			const entry = digital[middle];
			if (!entry) break;
			if (entry[0] / 1e6 <= timeMs) {
				found = middle;
				low = middle + 1;
			} else {
				high = middle - 1;
			}
		}
		const entry = digital[found < 0 ? 0 : found];
		return entry ? normalizeLevel(entry[1]) : null;
	}

	function levelGlyph(level: 0 | 1 | 2): string {
		if (level === 1) return 'H';
		if (level === 2) return 'Z';
		return 'L';
	}

	function laneLevelY(level: 0 | 1 | 2, top: number): number {
		if (level === 1) return top + 7;
		if (level === 0) return top + LANE_HEIGHT - 7;
		return top + LANE_HEIGHT / 2;
	}

	function accentFor(index: number): string {
		return ACCENTS[index % ACCENTS.length] ?? '#3f7f5f';
	}

	function tint(hex: string, alpha: number): string {
		const value = Number.parseInt(hex.slice(1), 16);
		const r = (value >> 16) & 255;
		const g = (value >> 8) & 255;
		const b = value & 255;
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}

	function drawHorizontal(
		ctx: CanvasRenderingContext2D,
		start: number,
		end: number,
		level: 0 | 1 | 2,
		top: number,
		xOf: (time: number) => number,
		width: number
	): void {
		if (end <= start) return;
		const x0 = xOf(start);
		const x1 = xOf(end);
		if (x1 < 0 || x0 > width) return;
		const y = laneLevelY(level, top);
		ctx.setLineDash(level === 2 ? [3, 3] : []);
		ctx.beginPath();
		ctx.moveTo(x0, y);
		ctx.lineTo(x1, y);
		ctx.stroke();
		ctx.setLineDash([]);
	}

	function draw(): void {
		const element = canvas;
		if (!element) return;

		const width = Math.max(1, viewWidth);
		const height = Math.max(MIN_HEIGHT, cssHeight);
		const dpr = Math.max(1, pixelRatio);
		const pixelWidth = Math.max(1, Math.round(width * dpr));
		const pixelHeight = Math.max(1, Math.round(height * dpr));
		if (element.width !== pixelWidth) element.width = pixelWidth;
		if (element.height !== pixelHeight) element.height = pixelHeight;

		const ctx = element.getContext('2d');
		if (!ctx) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, width, height);
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, width, height);
		if (isEmpty) return;

		const layoutNow = computeLayout(width, height, probes.length);
		const count = probes.length;
		const duration = durationMs;
		const pxPerMs = currentScale;
		const offset = scrollLeft;
		const startTime = offset / pxPerMs;
		const endTime = (offset + width) / pxPerMs;
		const xOf = (time: number): number => time * pxPerMs - offset;
		const monoFont = '10px ui-monospace, SFMono-Regular, Menlo, monospace';

		for (let index = 0; index < count; index += 1) {
			const top = layoutNow.laneTop + index * LANE_HEIGHT;
			ctx.fillStyle = tint(accentFor(index), 0.055);
			ctx.fillRect(0, top, width, LANE_HEIGHT);
			ctx.strokeStyle = '#f1efec';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(0, top + LANE_HEIGHT + 0.5);
			ctx.lineTo(width, top + LANE_HEIGHT + 0.5);
			ctx.stroke();
		}

		const stepMs = chooseStep(endTime - startTime, width - RIGHT_PAD);
		const unit = axisUnit(stepMs);
		const stepScaled = stepMs * unit.scale;
		const tickDecimals = stepScaled >= 1 ? 0 : stepScaled >= 0.1 ? 1 : stepScaled >= 0.01 ? 2 : 3;
		const firstTick = Math.ceil(startTime / stepMs - 1e-9);

		ctx.font = monoFont;
		ctx.textBaseline = 'top';
		ctx.lineWidth = 1;
		let ticks = 0;
		for (let index = firstTick; ticks < 200; index += 1, ticks += 1) {
			const value = index * stepMs;
			if (value > endTime + stepMs * 1e-6) break;
			const x = xOf(value);
			ctx.strokeStyle = value === 0 ? '#e4e2df' : '#ebe9e6';
			ctx.beginPath();
			ctx.moveTo(x, layoutNow.laneTop);
			ctx.lineTo(x, layoutNow.axisY);
			ctx.stroke();

			const label = `${trimZeros((value * unit.scale).toFixed(tickDecimals))} ${unit.unit}`;
			ctx.fillStyle = '#78716c';
			if (x < 2) {
				ctx.textAlign = 'left';
				ctx.fillText(label, x + 1, layoutNow.axisY + 4);
			} else if (x > layoutNow.plotRight - 2) {
				ctx.textAlign = 'right';
				ctx.fillText(label, layoutNow.plotRight, layoutNow.axisY + 4);
			} else {
				ctx.textAlign = 'center';
				ctx.fillText(label, x, layoutNow.axisY + 4);
			}
		}

		ctx.strokeStyle = '#d6d3d1';
		ctx.beginPath();
		ctx.moveTo(0, layoutNow.axisY + 0.5);
		ctx.lineTo(layoutNow.plotRight, layoutNow.axisY + 0.5);
		ctx.stroke();

		const endX = xOf(duration);
		if (endX >= 0 && endX <= width) {
			ctx.strokeStyle = '#dedbd7';
			ctx.beginPath();
			ctx.moveTo(endX + 0.5, layoutNow.laneTop);
			ctx.lineTo(endX + 0.5, layoutNow.axisY);
			ctx.stroke();
		}

		ctx.save();
		ctx.beginPath();
		ctx.rect(0, layoutNow.laneTop, width, count * LANE_HEIGHT);
		ctx.clip();
		ctx.lineWidth = 1.5;
		ctx.lineCap = 'butt';
		ctx.lineJoin = 'round';

		for (let index = 0; index < count; index += 1) {
			const probe = probes[index];
			if (!probe) continue;
			const digital = probe.digital;
			if (digital.length === 0) continue;
			const first = digital[0];
			if (!first) continue;

			const top = layoutNow.laneTop + index * LANE_HEIGHT;
			ctx.strokeStyle = accentFor(index);

			let level = normalizeLevel(first[1]);
			let previousTime = 0;
			for (let edge = 1; edge < digital.length; edge += 1) {
				const entry = digital[edge];
				if (!entry) continue;
				const tick = entry[0];
				if (!Number.isFinite(tick)) continue;
				const time = Math.min(duration, Math.max(0, tick / 1e6));
				if (time > previousTime) {
					drawHorizontal(ctx, previousTime, time, level, top, xOf, width);
					previousTime = time;
				}
				const nextLevel = normalizeLevel(entry[1]);
				if (nextLevel !== level) {
					const x = xOf(previousTime);
					if (x >= -1 && x <= width + 1) {
						ctx.setLineDash([]);
						ctx.beginPath();
						ctx.moveTo(x, laneLevelY(level, top));
						ctx.lineTo(x, laneLevelY(nextLevel, top));
						ctx.stroke();
					}
				}
				level = nextLevel;
			}
			if (previousTime < duration) {
				drawHorizontal(ctx, previousTime, duration, level, top, xOf, width);
			}
		}
		ctx.restore();

		ctx.strokeStyle = '#dedbd7';
		ctx.beginPath();
		ctx.moveTo(0.5, layoutNow.laneTop);
		ctx.lineTo(0.5, layoutNow.axisY);
		ctx.stroke();

		if (hover) {
			const cursorX = Math.min(layoutNow.plotRight, Math.max(0, hover.x));
			ctx.strokeStyle = '#78716c';
			ctx.lineWidth = 1;
			ctx.setLineDash([2, 3]);
			ctx.beginPath();
			ctx.moveTo(cursorX, layoutNow.laneTop);
			ctx.lineTo(cursorX, layoutNow.axisY);
			ctx.stroke();
			ctx.setLineDash([]);

			if (hover.lane >= 0 && hover.lane < count) {
				const probe = probes[hover.lane];
				if (probe) {
					const level = levelAt(probe, hover.t);
					if (level !== null) {
						const top = layoutNow.laneTop + hover.lane * LANE_HEIGHT;
						ctx.fillStyle = accentFor(hover.lane);
						ctx.beginPath();
						ctx.arc(cursorX, laneLevelY(level, top), 2.5, 0, Math.PI * 2);
						ctx.fill();
					}
				}
			}
		}
	}

	function handlePointerMove(event: PointerEvent): void {
		const element = canvas;
		if (!element || isEmpty) {
			hover = null;
			return;
		}
		const rect = element.getBoundingClientRect();
		const width = Math.max(1, rect.width);
		const height = Math.max(MIN_HEIGHT, rect.height);
		const layoutNow = computeLayout(width, height, probes.length);
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		if (x > layoutNow.plotRight) {
			hover = null;
			return;
		}
		const lanesBottom = layoutNow.laneTop + probes.length * LANE_HEIGHT;
		const lane =
			y >= layoutNow.laneTop && y < lanesBottom
				? Math.min(probes.length - 1, Math.floor((y - layoutNow.laneTop) / LANE_HEIGHT))
				: -1;
		const t = Math.max(0, Math.min(durationMs, (scrollLeft + x) / currentScale));
		hover = { x, t, lane };
	}

	function handlePointerLeave(): void {
		hover = null;
	}

	function handleScroll(): void {
		if (!scroller) return;
		scrollLeft = scroller.scrollLeft;
		hover = null;
	}

	function handleWheel(event: WheelEvent): void {
		if (event.ctrlKey || event.metaKey) {
			event.preventDefault();
			const rect = scroller?.getBoundingClientRect();
			const anchorX = rect ? event.clientX - rect.left : viewWidth / 2;
			zoomBy(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, anchorX);
			return;
		}
		const horizontal =
			Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
		if (horizontal === 0) return;
		event.preventDefault();
		setScroll(scroller ? scroller.scrollLeft + horizontal : scrollLeft + horizontal);
	}

	onMount(() => {
		const element = scroller;
		if (!element) return;
		const sync = (): void => {
			pixelRatio = window.devicePixelRatio || 1;
			viewWidth = Math.max(1, element.clientWidth);
		};
		sync();
		const observer = new ResizeObserver(sync);
		observer.observe(element);
		const wheel = (event: WheelEvent): void => handleWheel(event);
		element.addEventListener('wheel', wheel, { passive: false });
		window.addEventListener('resize', sync);
		return () => {
			observer.disconnect();
			element.removeEventListener('wheel', wheel);
			window.removeEventListener('resize', sync);
		};
	});

	$effect(() => {
		if (scale === 0 && !isEmpty) scale = fitScale();
	});

	$effect(() => {
		const maxScroll = Math.max(0, contentWidth - viewWidth);
		if (scrollLeft > maxScroll) scrollLeft = maxScroll;
		if (scroller && Math.abs(scroller.scrollLeft - scrollLeft) > 0.5) {
			scroller.scrollLeft = scrollLeft;
		}
	});

	$effect(() => {
		void viewWidth;
		void cssHeight;
		void pixelRatio;
		void hover;
		void scrollLeft;
		void scale;
		void contentWidth;
		if (canvas) draw();
	});
</script>

<div class="rounded border border-stone-300 bg-stone-50" title={hint}>
	<div class="relative flex" style="height: {cssHeight}px">
		<div
			class="shrink-0 overflow-hidden border-r border-stone-200"
			style="width: {GUTTER}px; padding-top: {layout.laneTop}px"
		>
			{#each probes as probe, index (probe.name)}
				<div class="flex items-center gap-1.5 px-1.5" style="height: {LANE_HEIGHT}px">
					<span class="h-3 w-[3px] shrink-0 rounded-sm" style="background: {accentFor(index)}"
					></span>
					<span class="truncate font-mono text-[11px] text-stone-700">{probe.name}</span>
				</div>
			{/each}
		</div>

		<div class="relative min-w-0 flex-1">
			<div
				bind:this={scroller}
				class="absolute inset-0 overflow-x-auto overflow-y-hidden"
				onscroll={handleScroll}
			>
				<div style="width: {contentWidth}px; height: {cssHeight}px">
					<canvas
						bind:this={canvas}
						aria-label={hint}
						class="sticky top-0 left-0 block cursor-crosshair"
						style="width: {viewWidth}px; height: {cssHeight}px"
						onpointermove={handlePointerMove}
						onpointerleave={handlePointerLeave}
					></canvas>
				</div>
			</div>

			{#if isEmpty}
				<div
					class="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center font-mono text-[11px] text-stone-400"
				>
					{emptyLabel}
				</div>
			{/if}

			{#if hover && !isEmpty}
				<div
					class="pointer-events-none absolute z-10 rounded border border-stone-300 bg-white/95 px-1.5 py-0.5 font-mono text-[10px] leading-tight text-stone-700 shadow-sm"
					style="left: {labelLeft}px; top: {labelTop}px; transform: {labelTransform}"
				>
					<div>{hoverTimeLabel}</div>
					{#if hoverLevelLabel}
						<div class="text-stone-500">{hoverLevelLabel}</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<div class="flex items-center gap-1 border-t border-stone-200 px-1.5 py-1">
		<button
			type="button"
			aria-label={m.zoom_out()}
			title={m.zoom_out()}
			class="grid h-5 w-5 place-items-center rounded border border-stone-300 bg-white text-[12px] leading-none text-stone-600 hover:border-stone-400"
			onclick={() => zoomBy(1 / ZOOM_STEP)}
		>
			−
		</button>
		<span class="min-w-14 text-center font-mono text-[10px] text-stone-500">{visibleLabel}</span>
		<button
			type="button"
			aria-label={m.zoom_in()}
			title={m.zoom_in()}
			class="grid h-5 w-5 place-items-center rounded border border-stone-300 bg-white text-[12px] leading-none text-stone-600 hover:border-stone-400"
			onclick={() => zoomBy(ZOOM_STEP)}
		>
			+
		</button>
		<button
			type="button"
			class="ml-1 rounded border border-stone-300 bg-white px-1.5 py-0.5 text-[10px] text-stone-600 hover:border-stone-400"
			onclick={fit}
		>
			{m.zoom_fit()}
		</button>
	</div>
</div>
