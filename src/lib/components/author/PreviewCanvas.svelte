<script lang="ts">
	import { drawPackagePart, type ArtImages } from '#lib/parts/customDraw';
	import type { ArtDraft, ArtState, PinRow } from './manifest';
	import type { ImageMap } from './art';

	let {
		width,
		height,
		name,
		art,
		images,
		previewState = null,
		pins
	}: {
		width: number;
		height: number;
		name: string;
		art: ArtDraft;
		images: ImageMap;
		previewState?: ArtState | null;
		pins: PinRow[];
	} = $props();

	/** Drawn at 2x: a crisp preview on every display. */
	const QUALITY = 2;
	const HEIGHT = 240;

	let canvas = $state<HTMLCanvasElement | undefined>();
	let hostWidth = $state(0);

	function sources(): ArtImages {
		// Built fresh for each draw, not kept as component state.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const states = new Map<string, HTMLImageElement>();
		for (const [key, path] of Object.entries(art.states)) {
			const element = images[path]?.element;
			if (element) states.set(key, element);
		}
		const pins = art.pins.flatMap((rule) => {
			const element = images[rule.path]?.element;
			return element ? [{ pin: rule.pin, level: rule.level, image: element }] : [];
		});
		return {
			default: art.default ? (images[art.default]?.element ?? null) : null,
			states,
			ranges: [],
			pins
		};
	}

	function draw(): void {
		if (!canvas || hostWidth <= 0) return;
		canvas.width = Math.round(hostWidth * QUALITY);
		canvas.height = HEIGHT * QUALITY;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.scale(QUALITY, QUALITY);

		const w = width > 0 ? width : 1;
		const h = height > 0 ? height : 1;
		const scale = Math.max(0.01, Math.min((hostWidth * 0.82) / w, (HEIGHT * 0.82) / h));
		ctx.translate(hostWidth / 2, HEIGHT / 2);
		ctx.scale(scale, scale);

		drawPackagePart(ctx, { id: 'preview' }, sources(), w, h, name || '—', {
			state: previewState
		});

		// The declared box and pin anchor, so coordinates can be checked by eye.
		ctx.strokeStyle = 'rgba(120, 113, 99, 0.35)';
		ctx.setLineDash([4 / scale, 4 / scale]);
		ctx.lineWidth = 1 / scale;
		ctx.strokeRect(-w / 2, -h / 2, w, h);
		ctx.setLineDash([]);

		for (const pin of pins) {
			const x = Number(pin.x);
			const y = Number(pin.y);
			if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
			ctx.beginPath();
			ctx.fillStyle = 'rgba(47, 111, 208, 0.85)';
			ctx.arc(x, y, Math.max(1.2, 2.4 / scale), 0, Math.PI * 2);
			ctx.fill();
		}
	}

	$effect(() => {
		void hostWidth;
		void width;
		void height;
		void name;
		void previewState;
		void art.default;
		for (const key of Object.keys(art.states)) void art.states[key];
		for (const rule of art.pins) {
			void rule.pin;
			void rule.level;
			void rule.path;
		}
		for (const entry of Object.values(images)) void entry.loaded;
		for (const pin of pins) {
			void pin.x;
			void pin.y;
		}
		draw();
	});
</script>

<div bind:clientWidth={hostWidth} class="overflow-hidden rounded-md bg-[#f7f4ec]">
	<canvas bind:this={canvas} style="height: {HEIGHT}px" class="block w-full"></canvas>
</div>
