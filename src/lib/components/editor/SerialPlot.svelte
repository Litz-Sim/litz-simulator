<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';

	let { text, emptyLabel }: { text: string; emptyLabel: string } = $props();

	const CHANNELS = 4;
	const MAX_SAMPLES = 1000;
	const MAX_LINES = 2000;
	const PAD_LEFT = 48;
	const PAD_RIGHT = 10;
	const PAD_TOP = 22;
	const PAD_BOTTOM = 20;
	/** Horizontal zoom limits, in pixels per sample. */
	const MIN_SCALE = 1;
	const MAX_SCALE = 40;
	const DEFAULT_SCALE = 8;
	const ZOOM_STEP = 1.6;

	const NUMBER_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
	const COLORS: readonly string[] = ['#2563eb', '#059669', '#d97706', '#dc2626'];
	const AXIS_FONT = '10px ui-monospace, SFMono-Regular, Menlo, monospace';

	type Sample = number | null;

	interface Series {
		channels: Sample[][];
		min: number;
		max: number;
		hasData: boolean;
	}

	let canvas = $state<HTMLCanvasElement | null>(null);
	let scroller = $state<HTMLDivElement | null>(null);
	let viewWidth = $state(1);
	let viewHeight = $state(1);
	let pixelRatio = $state(1);
	/** Pixels per sample. Fixed unless the user zooms, so history scrolls instead of shrinking. */
	let scale = $state(DEFAULT_SCALE);
	let scrollLeft = $state(0);
	/** Follow new samples while the view sits at the right edge. */
	let followEnd = $state(true);

	const series = $derived(parseSeries(text));
	const count = $derived(series.channels[0]?.length ?? 0);
	const contentWidth = $derived(
		Math.max(viewWidth, Math.ceil(PAD_LEFT + count * scale + PAD_RIGHT))
	);

	function tailLines(source: string, max: number): string {
		let pos = source.length;
		for (let i = 0; i < max; i += 1) {
			const newline = source.lastIndexOf('\n', pos - 1);
			if (newline < 0) return source;
			pos = newline;
		}
		return source.slice(pos + 1);
	}

	function parseSeries(source: string): Series {
		// A lone CR is a line break in terminal output; splitting on it also keeps
		// two short lines from merging into one row with too many values.
		const lines = tailLines(source.replace(/\r\n?/g, '\n'), MAX_LINES).split('\n');
		const rows: number[][] = [];

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			const parts = trimmed.split(/[,;\s]+/);
			const values: number[] = [];
			let numeric = true;
			for (const part of parts) {
				if (!NUMBER_RE.test(part)) {
					numeric = false;
					break;
				}
				const value = Number(part);
				if (!Number.isFinite(value)) {
					numeric = false;
					break;
				}
				values.push(value);
			}
			if (numeric && values.length > 0) rows.push(values);
		}

		const recent = rows.slice(-MAX_SAMPLES);
		const channels: Sample[][] = Array.from({ length: CHANNELS }, (): Sample[] => []);
		for (const row of recent) {
			for (let c = 0; c < CHANNELS; c += 1) {
				channels[c]?.push(c < row.length ? (row[c] ?? null) : null);
			}
		}

		let min = Infinity;
		let max = -Infinity;
		for (const channel of channels) {
			for (const value of channel) {
				if (typeof value !== 'number') continue;
				if (value < min) min = value;
				if (value > max) max = value;
			}
		}

		return {
			channels,
			min,
			max,
			hasData: recent.length > 0 && min <= max
		};
	}

	function channelColor(index: number): string {
		return COLORS[index % COLORS.length] ?? '#2563eb';
	}

	function formatTick(value: number): string {
		const abs = Math.abs(value);
		if (abs >= 100_000 || (abs > 0 && abs < 0.001)) return value.toExponential(1);
		if (abs >= 100) return value.toFixed(0);
		if (abs >= 10) return value.toFixed(1);
		if (abs >= 1) return value.toFixed(2);
		return value.toFixed(3);
	}

	function clampScale(value: number): number {
		if (!Number.isFinite(value) || value <= 0) return MIN_SCALE;
		return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
	}

	function setScroll(value: number): void {
		scrollLeft = value;
		if (scroller) scroller.scrollLeft = value;
	}

	function maxScroll(): number {
		return Math.max(0, contentWidth - viewWidth);
	}

	function fit(): void {
		const width = Math.max(1, viewWidth - PAD_LEFT - PAD_RIGHT);
		scale = clampScale(width / Math.max(1, count));
		followEnd = true;
		setScroll(0);
	}

	function zoomBy(factor: number, anchorX = (PAD_LEFT + viewWidth) / 2): void {
		const next = clampScale(scale * factor);
		if (Math.abs(next - scale) < scale * 1e-6) return;
		const index = (scrollLeft + anchorX - PAD_LEFT) / scale;
		scale = next;
		if (followEnd) {
			setScroll(maxScroll());
		} else {
			setScroll(Math.max(0, PAD_LEFT + index * next - anchorX));
		}
	}

	/** Pick a 1-2-5 step in samples for the visible span. */
	function chooseSampleStep(): number {
		const visible = Math.max(1, (viewWidth - PAD_LEFT - PAD_RIGHT) / scale);
		const divisions = Math.max(2, Math.min(8, Math.round(visible / 110)));
		const target = visible / divisions;
		const exponent = Math.floor(Math.log10(target));
		const candidates: number[] = [];
		for (let e = exponent - 1; e <= exponent + 1; e += 1) {
			const base = 10 ** e;
			for (const multiplier of [1, 2, 5]) candidates.push(multiplier * base);
		}
		let best = 1;
		let bestScore = Number.POSITIVE_INFINITY;
		for (const step of candidates) {
			if (!(step >= 1) || !Number.isFinite(step)) continue;
			const score = Math.abs(visible / step - divisions);
			if (score < bestScore) {
				bestScore = score;
				best = step;
			}
		}
		return Math.max(1, Math.round(best));
	}

	function handleScroll(): void {
		if (!scroller) return;
		scrollLeft = scroller.scrollLeft;
		followEnd = scrollLeft >= maxScroll() - 2;
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
		followEnd = false;
		setScroll(scrollLeft + horizontal);
	}

	function draw(): void {
		const element = canvas;
		if (!element) return;
		const ctx = element.getContext('2d');
		if (!ctx) return;

		const width = Math.max(1, viewWidth);
		const height = Math.max(1, viewHeight);
		const dpr = Math.max(1, pixelRatio);
		const pixelWidth = Math.max(1, Math.round(width * dpr));
		const pixelHeight = Math.max(1, Math.round(height * dpr));
		if (element.width !== pixelWidth) element.width = pixelWidth;
		if (element.height !== pixelHeight) element.height = pixelHeight;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, width, height);
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, width, height);

		const data = series;
		if (!data.hasData || width < 2 || height < 2) {
			ctx.fillStyle = '#a8a29e';
			ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(emptyLabel, width / 2, height / 2);
			return;
		}

		const plotWidth = width - PAD_LEFT - PAD_RIGHT;
		const plotHeight = height - PAD_TOP - PAD_BOTTOM;
		if (plotWidth < 2 || plotHeight < 2) return;

		const span = data.max - data.min;
		const padding = span > 0 ? span * 0.08 : Math.max(Math.abs(data.max) * 0.1, 1);
		const yMin = data.min - padding;
		const yMax = data.max + padding;
		const yFor = (value: number): number => PAD_TOP + ((yMax - value) / (yMax - yMin)) * plotHeight;
		const xFor = (index: number): number => PAD_LEFT + index * scale - scrollLeft;

		const step = chooseSampleStep();
		const startIndex = Math.max(0, (scrollLeft - PAD_LEFT) / scale);
		const endIndex = Math.min(count - 1, (scrollLeft + width - PAD_LEFT) / scale);
		const axisY = PAD_TOP + plotHeight;

		ctx.lineWidth = 1;
		ctx.strokeStyle = '#e7e5e4';
		ctx.beginPath();
		for (let i = 0; i <= 4; i += 1) {
			const y = Math.round(PAD_TOP + (i / 4) * plotHeight) + 0.5;
			ctx.moveTo(PAD_LEFT, y);
			ctx.lineTo(PAD_LEFT + plotWidth, y);
		}
		for (let tick = Math.ceil(startIndex / step) * step; tick <= endIndex; tick += step) {
			const x = Math.round(xFor(tick)) + 0.5;
			if (x < PAD_LEFT - 1 || x > PAD_LEFT + plotWidth + 1) continue;
			ctx.moveTo(x, PAD_TOP);
			ctx.lineTo(x, axisY);
		}
		ctx.stroke();

		ctx.font = AXIS_FONT;
		ctx.fillStyle = '#78716c';
		ctx.textAlign = 'right';
		ctx.textBaseline = 'top';
		ctx.fillText(formatTick(yMax), PAD_LEFT - 6, PAD_TOP - 1);
		ctx.textBaseline = 'bottom';
		ctx.fillText(formatTick(yMin), PAD_LEFT - 6, axisY + 2);

		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		for (let tick = Math.ceil(startIndex / step) * step; tick <= endIndex; tick += step) {
			const x = xFor(tick);
			if (x < PAD_LEFT + 8 || x > PAD_LEFT + plotWidth - 8) continue;
			ctx.fillText(String(tick), x, axisY + 4);
		}

		ctx.save();
		ctx.beginPath();
		ctx.rect(PAD_LEFT, PAD_TOP, plotWidth, plotHeight);
		ctx.clip();

		for (let c = 0; c < CHANNELS; c += 1) {
			const channel = data.channels[c];
			if (!channel) continue;
			const color = channelColor(c);

			ctx.strokeStyle = color;
			ctx.lineWidth = 1.5;
			ctx.lineJoin = 'round';
			ctx.lineCap = 'round';
			ctx.beginPath();
			let open = false;
			for (let i = 0; i < channel.length; i += 1) {
				const value = channel[i];
				if (typeof value !== 'number') {
					open = false;
					continue;
				}
				const x = xFor(i);
				const y = yFor(value);
				if (open) ctx.lineTo(x, y);
				else ctx.moveTo(x, y);
				open = true;
			}
			ctx.stroke();

			ctx.fillStyle = color;
			for (let i = 0; i < channel.length; i += 1) {
				const value = channel[i];
				if (typeof value !== 'number') continue;
				const previous = i > 0 ? channel[i - 1] : null;
				const next = i + 1 < channel.length ? channel[i + 1] : null;
				if (typeof previous === 'number' || typeof next === 'number') continue;
				ctx.beginPath();
				ctx.arc(xFor(i), yFor(value), 1.8, 0, Math.PI * 2);
				ctx.fill();
			}
		}

		ctx.restore();

		ctx.font = AXIS_FONT;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		let legendX = PAD_LEFT + 4;
		for (let c = 0; c < CHANNELS; c += 1) {
			const channel = data.channels[c];
			if (!channel || !channel.some((value) => typeof value === 'number')) continue;
			const color = channelColor(c);
			ctx.strokeStyle = color;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(legendX, 10);
			ctx.lineTo(legendX + 10, 10);
			ctx.stroke();
			ctx.fillStyle = '#57534e';
			ctx.fillText(String(c), legendX + 14, 10);
			legendX += 34;
		}
	}

	onMount(() => {
		const element = scroller;
		if (!element) return;
		const sync = (): void => {
			pixelRatio = window.devicePixelRatio || 1;
			viewWidth = Math.max(1, element.clientWidth);
			viewHeight = Math.max(1, element.clientHeight);
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
		const max = maxScroll();
		if (followEnd) {
			if (Math.abs(scrollLeft - max) > 0.5) scrollLeft = max;
		} else if (scrollLeft > max) {
			scrollLeft = max;
		}
		if (scroller && Math.abs(scroller.scrollLeft - scrollLeft) > 0.5) {
			scroller.scrollLeft = scrollLeft;
		}
	});

	$effect(() => {
		void series;
		void scrollLeft;
		void scale;
		void viewWidth;
		void viewHeight;
		if (canvas) draw();
	});
</script>

<div class="flex h-full min-h-0 flex-col border border-stone-300 bg-white font-mono">
	<div class="relative min-h-0 flex-1">
		<div
			bind:this={scroller}
			class="absolute inset-0 overflow-x-auto overflow-y-hidden"
			onscroll={handleScroll}
		>
			<div style="width: {contentWidth}px; height: {viewHeight}px">
				<canvas
					bind:this={canvas}
					class="sticky top-0 left-0 block"
					style="width: {viewWidth}px; height: {viewHeight}px"
				></canvas>
			</div>
		</div>
	</div>

	<div class="flex shrink-0 items-center gap-1 border-t border-stone-200 px-1.5 py-1">
		<button
			type="button"
			aria-label={m.zoom_out()}
			title={m.zoom_out()}
			class="grid h-5 w-5 place-items-center rounded border border-stone-300 bg-white text-[12px] leading-none text-stone-600 hover:border-stone-400"
			onclick={() => zoomBy(1 / ZOOM_STEP)}
		>
			−
		</button>
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
