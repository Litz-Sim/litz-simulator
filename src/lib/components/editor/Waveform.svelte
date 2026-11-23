<script lang="ts">
	import { onMount } from 'svelte';
	import type { ProbeRecord } from '#lib/sim/backend';

	const GUTTER = 110;
	const LANE_HEIGHT = 30;
	const AXIS_HEIGHT = 18;
	const PAD_TOP = 4;
	const RIGHT_PAD = 12;
	const MIN_HEIGHT = 120;
	const ACCENTS = ['#3f7f5f', '#b06a2c', '#3d6fb4', '#8a5ab8', '#b23b3b'];

	type HoverState = { x: number; t: number; lane: number };

	type Layout = {
		laneTop: number;
		plotLeft: number;
		plotRight: number;
		plotWidth: number;
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
	let host: HTMLDivElement | undefined = $state();
	let cssWidth = $state(1);
	let pixelRatio = $state(1);
	let hover = $state<HoverState | null>(null);

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

	const stepMs = $derived(chooseStep(durationMs));

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
		const layout = computeLayout(cssWidth, cssHeight, probes.length);
		const preferred = hover.lane >= 0 ? layout.laneTop + hover.lane * LANE_HEIGHT + 2 : PAD_TOP + 2;
		return Math.max(2, Math.min(cssHeight - 38, preferred));
	});
	const labelFlipped = $derived(hover !== null && hover.x > cssWidth - 118);
	const labelLeft = $derived(hover ? (labelFlipped ? hover.x - 6 : hover.x + 6) : 0);
	const labelTransform = $derived(labelFlipped ? 'translateX(-100%)' : 'none');

	function chooseStep(duration: number): number {
		const target = duration / 8;
		const exponent = Math.floor(Math.log10(target));
		const candidates: number[] = [];
		for (let e = exponent - 1; e <= exponent + 1; e += 1) {
			const base = 10 ** e;
			for (const multiplier of [1, 2, 5]) candidates.push(multiplier * base);
		}
		let best = 1;
		let bestScore = Number.POSITIVE_INFINITY;
		let fallback = candidates[0] ?? 1;
		let fallbackScore = Number.POSITIVE_INFINITY;
		for (const step of candidates) {
			if (!(step > 0) || !Number.isFinite(step)) continue;
			const divisions = duration / step;
			const score = Math.abs(divisions - 8);
			if (score < fallbackScore) {
				fallbackScore = score;
				fallback = step;
			}
			if (divisions >= 5 && divisions <= 11 && score < bestScore) {
				bestScore = score;
				best = step;
			}
		}
		return bestScore === Number.POSITIVE_INFINITY ? fallback : best;
	}

	function computeLayout(width: number, height: number, count: number): Layout {
		const plotLeft = GUTTER;
		const plotRight = Math.max(plotLeft + 1, width - RIGHT_PAD);
		const laneAreaTop = PAD_TOP;
		const axisY = Math.max(laneAreaTop, height - AXIS_HEIGHT);
		const laneAreaHeight = Math.max(0, axisY - laneAreaTop);
		const lanesHeight = count * LANE_HEIGHT;
		const laneTop = laneAreaTop + Math.max(0, (laneAreaHeight - lanesHeight) / 2);
		return {
			laneTop,
			plotLeft,
			plotRight,
			plotWidth: Math.max(1, plotRight - plotLeft),
			axisY
		};
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
		const { unit, scale } = axisUnit(stepMs);
		const value = time * scale;
		const magnitude = Math.abs(value);
		const decimals = magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : magnitude >= 1 ? 2 : 3;
		return `${trimZeros(value.toFixed(decimals))} ${unit}`;
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

	function tint(hex: string, alpha: number): string {
		const value = Number.parseInt(hex.slice(1), 16);
		const r = (value >> 16) & 255;
		const g = (value >> 8) & 255;
		const b = value & 255;
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}

	function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
		if (ctx.measureText(text).width <= maxWidth) return text;
		let cut = text;
		while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
			cut = cut.slice(0, -1);
		}
		return `${cut}…`;
	}

	function drawHorizontal(
		ctx: CanvasRenderingContext2D,
		start: number,
		end: number,
		level: 0 | 1 | 2,
		top: number,
		plotLeft: number,
		plotWidth: number,
		duration: number
	): void {
		if (end <= start || duration <= 0) return;
		const x0 = plotLeft + (start / duration) * plotWidth;
		const x1 = plotLeft + (end / duration) * plotWidth;
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

		const width = Math.max(1, cssWidth);
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

		const layout = computeLayout(width, height, probes.length);
		const count = probes.length;
		const duration = durationMs;
		const monoFont = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
		const nameFont = '11px ui-monospace, SFMono-Regular, Menlo, monospace';

		for (let index = 0; index < count; index += 1) {
			const accent = ACCENTS[index % ACCENTS.length] ?? '#3f7f5f';
			const top = layout.laneTop + index * LANE_HEIGHT;
			ctx.fillStyle = tint(accent, 0.055);
			ctx.fillRect(0, top, width, LANE_HEIGHT);
			ctx.strokeStyle = '#f1efec';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(0, top + LANE_HEIGHT + 0.5);
			ctx.lineTo(width, top + LANE_HEIGHT + 0.5);
			ctx.stroke();
		}

		const unit = axisUnit(stepMs);
		const stepScaled = stepMs * unit.scale;
		const tickDecimals = stepScaled >= 1 ? 0 : stepScaled >= 0.1 ? 1 : stepScaled >= 0.01 ? 2 : 3;
		const tickCount = Math.max(1, Math.min(200, Math.floor(duration / stepMs + 1e-9)));

		ctx.font = monoFont;
		ctx.textBaseline = 'top';
		ctx.lineWidth = 1;
		for (let index = 0; index <= tickCount; index += 1) {
			const value = index * stepMs;
			if (value > duration + stepMs * 1e-6) break;
			const x = layout.plotLeft + (value / duration) * layout.plotWidth;
			ctx.strokeStyle = index === 0 ? '#e4e2df' : '#ebe9e6';
			ctx.beginPath();
			ctx.moveTo(x, layout.laneTop);
			ctx.lineTo(x, layout.axisY);
			ctx.stroke();

			const label = `${trimZeros((value * unit.scale).toFixed(tickDecimals))} ${unit.unit}`;
			ctx.fillStyle = '#78716c';
			if (index === 0) {
				ctx.textAlign = 'left';
				ctx.fillText(label, x + 1, layout.axisY + 4);
			} else if (x > layout.plotRight - 2) {
				ctx.textAlign = 'right';
				ctx.fillText(label, layout.plotRight, layout.axisY + 4);
			} else {
				ctx.textAlign = 'center';
				ctx.fillText(label, x, layout.axisY + 4);
			}
		}

		ctx.strokeStyle = '#dedbd7';
		ctx.beginPath();
		ctx.moveTo(layout.plotLeft + 0.5, layout.laneTop);
		ctx.lineTo(layout.plotLeft + 0.5, layout.axisY);
		ctx.stroke();

		ctx.strokeStyle = '#d6d3d1';
		ctx.beginPath();
		ctx.moveTo(layout.plotLeft, layout.axisY + 0.5);
		ctx.lineTo(layout.plotRight, layout.axisY + 0.5);
		ctx.stroke();

		ctx.save();
		ctx.beginPath();
		ctx.rect(layout.plotLeft, layout.laneTop, layout.plotWidth, count * LANE_HEIGHT);
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

			const top = layout.laneTop + index * LANE_HEIGHT;
			ctx.strokeStyle = ACCENTS[index % ACCENTS.length] ?? '#3f7f5f';

			let level = normalizeLevel(first[1]);
			let previousTime = 0;
			for (let edge = 1; edge < digital.length; edge += 1) {
				const entry = digital[edge];
				if (!entry) continue;
				const tick = entry[0];
				if (!Number.isFinite(tick)) continue;
				const time = Math.min(duration, Math.max(0, tick / 1e6));
				if (time > previousTime) {
					drawHorizontal(
						ctx,
						previousTime,
						time,
						level,
						top,
						layout.plotLeft,
						layout.plotWidth,
						duration
					);
					previousTime = time;
				}
				const nextLevel = normalizeLevel(entry[1]);
				if (nextLevel !== level) {
					const x = layout.plotLeft + (previousTime / duration) * layout.plotWidth;
					ctx.setLineDash([]);
					ctx.beginPath();
					ctx.moveTo(x, laneLevelY(level, top));
					ctx.lineTo(x, laneLevelY(nextLevel, top));
					ctx.stroke();
				}
				level = nextLevel;
			}
			if (previousTime < duration) {
				drawHorizontal(
					ctx,
					previousTime,
					duration,
					level,
					top,
					layout.plotLeft,
					layout.plotWidth,
					duration
				);
			}
		}
		ctx.restore();

		ctx.font = nameFont;
		ctx.textBaseline = 'middle';
		ctx.textAlign = 'left';
		for (let index = 0; index < count; index += 1) {
			const probe = probes[index];
			if (!probe) continue;
			const accent = ACCENTS[index % ACCENTS.length] ?? '#3f7f5f';
			const middle = layout.laneTop + index * LANE_HEIGHT + LANE_HEIGHT / 2;
			ctx.fillStyle = accent;
			ctx.fillRect(6, middle - 6, 3, 12);
			ctx.fillStyle = '#44403c';
			ctx.fillText(truncate(ctx, probe.name, GUTTER - 22), 14, middle);
		}

		if (hover) {
			const cursorX = Math.min(layout.plotRight, Math.max(layout.plotLeft, hover.x));
			ctx.strokeStyle = '#78716c';
			ctx.lineWidth = 1;
			ctx.setLineDash([2, 3]);
			ctx.beginPath();
			ctx.moveTo(cursorX, layout.laneTop);
			ctx.lineTo(cursorX, layout.axisY);
			ctx.stroke();
			ctx.setLineDash([]);

			if (hover.lane >= 0 && hover.lane < count) {
				const probe = probes[hover.lane];
				if (probe) {
					const level = levelAt(probe, hover.t);
					if (level !== null) {
						const top = layout.laneTop + hover.lane * LANE_HEIGHT;
						ctx.fillStyle = ACCENTS[hover.lane % ACCENTS.length] ?? '#3f7f5f';
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
		const layout = computeLayout(width, height, probes.length);
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		if (x < layout.plotLeft || x > layout.plotRight) {
			hover = null;
			return;
		}
		const lanesBottom = layout.laneTop + probes.length * LANE_HEIGHT;
		const lane =
			y >= layout.laneTop && y < lanesBottom
				? Math.min(probes.length - 1, Math.floor((y - layout.laneTop) / LANE_HEIGHT))
				: -1;
		const t = Math.max(
			0,
			Math.min(durationMs, ((x - layout.plotLeft) / layout.plotWidth) * durationMs)
		);
		hover = { x, t, lane };
	}

	function handlePointerLeave(): void {
		hover = null;
	}

	onMount(() => {
		const element = host;
		if (!element) return;
		const sync = (): void => {
			pixelRatio = window.devicePixelRatio || 1;
			cssWidth = Math.max(1, element.clientWidth);
		};
		sync();
		const observer = new ResizeObserver(() => {
			cssWidth = Math.max(1, element.clientWidth);
		});
		observer.observe(element);
		window.addEventListener('resize', sync);
		return () => {
			observer.disconnect();
			window.removeEventListener('resize', sync);
		};
	});

	$effect(() => {
		void cssWidth;
		void cssHeight;
		void pixelRatio;
		void hover;
		if (canvas) draw();
	});
</script>

<div
	class="relative h-full min-h-[120px] w-full overflow-x-hidden overflow-y-auto rounded border border-stone-300 bg-stone-50"
	title={hint}
>
	<div bind:this={host} class="relative w-full" style="height: {cssHeight}px">
		<canvas
			bind:this={canvas}
			aria-label={hint}
			class="block h-full w-full cursor-crosshair"
			onpointermove={handlePointerMove}
			onpointerleave={handlePointerLeave}
		></canvas>

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
