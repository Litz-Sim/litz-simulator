<script lang="ts">
	import { onMount } from 'svelte';

	let { text, emptyLabel }: { text: string; emptyLabel: string } = $props();

	const CHANNELS = 4;
	const MAX_SAMPLES = 600;
	const MAX_LINES = 800;
	const PAD_LEFT = 48;
	const PAD_RIGHT = 10;
	const PAD_TOP = 22;
	const PAD_BOTTOM = 16;

	const NUMBER_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
	const COLORS: readonly string[] = ['#2563eb', '#059669', '#d97706', '#dc2626'];
	const AXIS_FONT = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
	const EMPTY_FONT = '11px ui-monospace, SFMono-Regular, Menlo, monospace';

	type Sample = number | null;

	interface Series {
		channels: Sample[][];
		min: number;
		max: number;
		hasData: boolean;
	}

	let canvas = $state<HTMLCanvasElement | null>(null);

	const series = $derived.by(() => parseSeries(text));

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
		const lines = tailLines(source, MAX_LINES).split(/\r?\n/);
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

	function draw(): void {
		const element = canvas;
		if (!element) return;
		const ctx = element.getContext('2d');
		if (!ctx) return;

		const width = element.clientWidth;
		const height = element.clientHeight;
		if (width < 2 || height < 2) return;

		const dpr = window.devicePixelRatio || 1;
		const pixelWidth = Math.max(1, Math.round(width * dpr));
		const pixelHeight = Math.max(1, Math.round(height * dpr));
		if (element.width !== pixelWidth) element.width = pixelWidth;
		if (element.height !== pixelHeight) element.height = pixelHeight;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, width, height);

		const data = series;
		if (!data.hasData) {
			ctx.fillStyle = '#a8a29e';
			ctx.font = EMPTY_FONT;
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

		ctx.lineWidth = 1;
		ctx.strokeStyle = '#e7e5e4';
		ctx.beginPath();
		for (let i = 0; i <= 4; i += 1) {
			const y = Math.round(PAD_TOP + (i / 4) * plotHeight) + 0.5;
			ctx.moveTo(PAD_LEFT, y);
			ctx.lineTo(PAD_LEFT + plotWidth, y);
		}
		for (let i = 0; i <= 6; i += 1) {
			const x = Math.round(PAD_LEFT + (i / 6) * plotWidth) + 0.5;
			ctx.moveTo(x, PAD_TOP);
			ctx.lineTo(x, PAD_TOP + plotHeight);
		}
		ctx.stroke();

		ctx.font = AXIS_FONT;
		ctx.fillStyle = '#78716c';
		ctx.textAlign = 'right';
		ctx.textBaseline = 'top';
		ctx.fillText(formatTick(yMax), PAD_LEFT - 6, PAD_TOP - 1);
		ctx.textBaseline = 'bottom';
		ctx.fillText(formatTick(yMin), PAD_LEFT - 6, PAD_TOP + plotHeight + 2);

		const xAt = (index: number, count: number): number =>
			count <= 1 ? PAD_LEFT + plotWidth / 2 : PAD_LEFT + (index / (count - 1)) * plotWidth;

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
				const x = xAt(i, channel.length);
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
				ctx.arc(xAt(i, channel.length), yFor(value), 1.8, 0, Math.PI * 2);
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

	$effect(() => {
		draw();
	});

	onMount(() => {
		const element = canvas;
		if (!element) return;
		const observer = new ResizeObserver(() => draw());
		observer.observe(element);
		draw();
		return () => observer.disconnect();
	});
</script>

<div
	class="relative h-full min-h-0 w-full overflow-hidden border border-stone-300 bg-white font-mono"
>
	<canvas bind:this={canvas} class="block h-full w-full"></canvas>
</div>
