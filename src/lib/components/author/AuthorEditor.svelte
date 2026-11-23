<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import {
		buildPackage,
		installPackage,
		packageError,
		type PackageDraft
	} from '#lib/parts/custom.svelte';
	import type { PinDef } from '#lib/parts/types';
	import ArtEditor from './ArtEditor.svelte';
	import { referencedPaths, type ImageMap } from './art';
	import {
		ART_STATES,
		BEHAVIORS,
		blankArt,
		blankPin,
		BOARD_CHIPS,
		FIXED_RAILS,
		generateBoardManifest,
		generatePartManifest,
		shortHash,
		slugify,
		type ArtDraft,
		type ArtState,
		type AuthorMode,
		type PinRow
	} from './manifest';
	import PinTable from './PinTable.svelte';
	import PreviewCanvas from './PreviewCanvas.svelte';

	let { mode }: { mode: AuthorMode } = $props();

	const TYPE_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;

	let name = $state('');
	let type = $state('');
	let typeTouched = $state(false);
	// Each route passes a fixed mode, so the starting size may read it once.
	// svelte-ignore state_referenced_locally
	let width = $state(mode === 'part' ? '60' : '190');
	// svelte-ignore state_referenced_locally
	let height = $state(mode === 'part' ? '60' : '250');
	let pins = $state<PinRow[]>([blankPin(0)]);
	let chip = $state<string>('esp32c3');
	let flash = $state('4MB');
	let behavior = $state('none');
	let manifestText = $state('');
	let manifestDirty = $state(false);
	let art = $state<ArtDraft>(blankArt());
	let images = $state<ImageMap>({});
	let previewState = $state<ArtState | null>(null);
	let status = $state<string | null>(null);
	let error = $state<string | null>(null);

	const field =
		'mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-[13px] text-stone-800 outline-none focus:border-stone-500 [@media(pointer:coarse)]:py-2.5';
	const labelClass = 'block text-[11px] text-stone-500';

	const title = $derived(mode === 'part' ? m.author_part_title() : m.author_board_title());
	const pinNames = $derived([...new Set(pins.map((pin) => pin.name.trim()).filter(Boolean))]);
	const previewWidth = $derived(Number(width) > 0 ? Number(width) : 1);
	const previewHeight = $derived(Number(height) > 0 ? Number(height) : 1);
	const stateChoices = $derived(ART_STATES.filter((state) => Boolean(art.states[state])));

	const generatedManifest = $derived(
		mode === 'part'
			? generatePartManifest({ type, name, pins, behavior })
			: generateBoardManifest({ type, name, chip, flash, pins })
	);

	// A name types its type id until the field is edited by hand.
	$effect(() => {
		if (typeTouched) return;
		const trimmed = name.trim();
		if (!trimmed) {
			type = '';
			return;
		}
		let slug = slugify(trimmed);
		if (!slug) slug = `custom-${mode}-${shortHash(trimmed)}`;
		else if (slug.length < 2) slug = `${slug}-${mode}`;
		type = slug;
	});

	// Keep the textarea in step with the form until the user edits it.
	$effect(() => {
		if (manifestDirty) return;
		manifestText = generatedManifest;
	});

	$effect(() => {
		if (previewState && !art.states[previewState]) previewState = null;
	});

	function stateLabel(state: ArtState): string {
		switch (state) {
			case 'on':
				return m.state_on();
			case 'off':
				return m.state_off();
			case 'up':
				return m.state_up();
			case 'down':
				return m.state_down();
			case 'sounding':
				return m.state_sounding();
			case 'silent':
				return m.state_silent();
		}
	}

	function chipClass(active: boolean): string {
		return `rounded-md border px-2 py-1 text-[12px] [@media(pointer:coarse)]:py-2 ${
			active
				? 'border-stone-700 bg-stone-800 text-white'
				: 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'
		}`;
	}

	function finite(value: string): number | null {
		const trimmed = value.trim();
		if (!trimmed) return null;
		const parsed = Number(trimmed);
		return Number.isFinite(parsed) ? parsed : null;
	}

	function invalid(): false {
		error = m.author_invalid();
		status = null;
		return false;
	}

	function validate(): boolean {
		error = null;
		status = null;
		if (!name.trim() || !TYPE_PATTERN.test(type.trim())) return invalid();

		const w = finite(width);
		const h = finite(height);
		if (w === null || h === null || w <= 0 || h <= 0 || w > 2000 || h > 2000) return invalid();
		if (!pins.length) return invalid();

		const names: string[] = [];
		for (const pin of pins) {
			const pinName = pin.name.trim();
			if (!pinName || names.includes(pinName)) return invalid();
			names.push(pinName);
			if (finite(pin.x) === null || finite(pin.y) === null) return invalid();
			if (mode !== 'board') continue;

			const fixed = pin.fixed.trim().toLowerCase();
			if (fixed) {
				if (!(FIXED_RAILS as readonly string[]).includes(fixed)) return invalid();
			} else {
				const gpio = pin.gpio.trim();
				if (!/^\d{1,2}$/.test(gpio)) return invalid();
				const value = Number(gpio);
				if (value < 0 || value > 48) return invalid();
			}
		}

		for (const rule of art.pins) {
			if (rule.path && !names.includes(rule.pin)) return invalid();
		}
		return true;
	}

	function pinDefs(): PinDef[] {
		return pins.map((pin) => {
			const def: PinDef = {
				name: pin.name.trim(),
				x: Number(pin.x),
				y: Number(pin.y)
			};
			const label = pin.label.trim();
			if (label) def.label = label;
			if (mode === 'board' && !pin.fixed.trim()) {
				def.gpio = Number.parseInt(pin.gpio.trim(), 10);
			}
			return def;
		});
	}

	function imageMap(): Map<string, Uint8Array> {
		// A plain Map: it is handed to buildPackage and never read reactively.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const map = new Map<string, Uint8Array>();
		for (const path of referencedPaths(art)) {
			const entry = images[path];
			if (entry) map.set(path, entry.bytes);
		}
		return map;
	}

	function draft(): PackageDraft {
		return {
			name: name.trim(),
			part: {
				type: type.trim(),
				name: name.trim(),
				chip: mode === 'board' ? chip : null,
				width: Number(width),
				height: Number(height),
				pins: pinDefs(),
				art: {
					default: art.default,
					states: { ...art.states },
					pins: art.pins
						.filter((rule) => rule.path && rule.pin)
						.map((rule) => ({ pin: rule.pin, level: rule.level, image: rule.path }))
				}
			},
			manifest: manifestText.trim() ? manifestText : null,
			images: imageMap()
		};
	}

	function save(): void {
		if (!validate()) return;
		try {
			const entry = installPackage(buildPackage(draft()), `${name.trim()}.zip`);
			error = null;
			status = m.author_saved({ name: entry.name });
		} catch {
			status = null;
			error = packageError.message || m.author_invalid();
		}
	}

	function exportZip(): void {
		if (!validate()) return;
		const bytes = buildPackage(draft());
		const blob = new Blob([bytes.slice().buffer], { type: 'application/zip' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `${type.trim() || 'package'}.zip`;
		anchor.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
</script>

<div class="min-h-dvh bg-stone-100 text-stone-800">
	<header class="border-b border-stone-300 bg-stone-50">
		<div class="mx-auto flex h-12 max-w-5xl items-center px-4 [@media(pointer:coarse)]:h-14">
			<h1 class="text-[15px] font-semibold text-stone-800">{title}</h1>
		</div>
	</header>

	<main class="mx-auto max-w-5xl space-y-3 px-4 py-4">
		<section class="rounded-lg border border-stone-300 bg-white p-3 sm:p-4">
			<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
				<label class="{labelClass} lg:col-span-2">
					<span>{m.author_name()}</span>
					<input class={field} bind:value={name} />
				</label>
				<label class={labelClass}>
					<span>{m.author_type()}</span>
					<input
						class={field}
						bind:value={type}
						oninput={(event) => {
							type = event.currentTarget.value;
							typeTouched = type.trim() !== '';
						}}
					/>
				</label>
				<label class={labelClass}>
					<span>{m.author_width()}</span>
					<input class={field} bind:value={width} inputmode="decimal" />
				</label>
				<label class={labelClass}>
					<span>{m.author_height()}</span>
					<input class={field} bind:value={height} inputmode="decimal" />
				</label>
			</div>

			{#if mode === 'board'}
				<div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
					<label class="{labelClass} lg:col-span-2">
						<span>{m.author_chip()}</span>
						<select class={field} bind:value={chip} onchange={() => (manifestDirty = false)}>
							{#each BOARD_CHIPS as option (option.id)}
								<option value={option.id}>{option.name}</option>
							{/each}
						</select>
					</label>
					<label class={labelClass}>
						<span>{m.author_flash()}</span>
						<input class={field} bind:value={flash} />
					</label>
				</div>
			{/if}
		</section>

		<section class="rounded-lg border border-stone-300 bg-white p-3 sm:p-4">
			<h2 class="mb-2 text-[13px] font-medium text-stone-600">{m.author_pins()}</h2>
			<PinTable {mode} bind:pins />
		</section>

		{#if mode === 'part'}
			<section class="rounded-lg border border-stone-300 bg-white p-3 sm:p-4">
				<div class="max-w-sm">
					<label class={labelClass}>
						<span>{m.author_behavior()}</span>
						<select class={field} bind:value={behavior} onchange={() => (manifestDirty = false)}>
							<option value="none">{m.author_behavior_none()}</option>
							{#each BEHAVIORS as value (value)}
								<option {value}>{value}</option>
							{/each}
						</select>
					</label>
					<p class="mt-1 text-[11px] text-stone-400">{m.author_behavior_hint()}</p>
				</div>
			</section>
		{/if}

		<section class="rounded-lg border border-stone-300 bg-white p-3 sm:p-4">
			<h2 class="mb-2 text-[13px] font-medium text-stone-600">{m.author_art()}</h2>
			<ArtEditor bind:art bind:images {pinNames} />
		</section>

		<div class="grid gap-3 lg:grid-cols-2">
			<section class="rounded-lg border border-stone-300 bg-white p-3 sm:p-4">
				<h2 class="mb-2 text-[13px] font-medium text-stone-600">{m.author_preview()}</h2>
				<div class="mb-2 flex flex-wrap gap-1">
					<button
						type="button"
						class={chipClass(previewState === null)}
						onclick={() => (previewState = null)}
					>
						{m.author_art_default()}
					</button>
					{#each stateChoices as state (state)}
						<button
							type="button"
							class={chipClass(previewState === state)}
							onclick={() => (previewState = state)}
						>
							{stateLabel(state)}
						</button>
					{/each}
				</div>
				<PreviewCanvas
					width={previewWidth}
					height={previewHeight}
					{name}
					{art}
					{images}
					{previewState}
					{pins}
				/>
			</section>

			<section class="flex flex-col rounded-lg border border-stone-300 bg-white p-3 sm:p-4">
				<label class="flex min-h-0 flex-1 flex-col">
					<span class="mb-1 text-[13px] font-medium text-stone-600">{m.author_manifest()}</span>
					<textarea
						class="min-h-[240px] w-full flex-1 resize-y rounded-md border border-stone-300 bg-stone-50 p-2 font-mono text-[11px] leading-relaxed text-stone-800 outline-none focus:border-stone-500"
						spellcheck="false"
						bind:value={manifestText}
						oninput={() => (manifestDirty = true)}></textarea>
				</label>
			</section>
		</div>

		<section class="flex flex-wrap items-center gap-2 border-t border-stone-300 pt-3 pb-8">
			<button
				type="button"
				class="rounded-md bg-[#2f6fd0] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#2559a8] [@media(pointer:coarse)]:py-2.5"
				onclick={save}
			>
				{m.author_save()}
			</button>
			<button
				type="button"
				class="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-[13px] text-stone-700 hover:border-stone-400 [@media(pointer:coarse)]:py-2.5"
				onclick={exportZip}
			>
				{m.author_export()}
			</button>
			<a
				href={resolve('/editor')}
				class="rounded-md px-2 py-1.5 text-[13px] text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline [@media(pointer:coarse)]:py-2.5"
			>
				{m.author_back()}
			</a>
			{#if status}
				<span class="text-[12px] text-emerald-700" role="status">{status}</span>
			{/if}
			{#if error}
				<span class="text-[12px] text-red-700" role="alert">{error}</span>
			{/if}
		</section>
	</main>
</div>
