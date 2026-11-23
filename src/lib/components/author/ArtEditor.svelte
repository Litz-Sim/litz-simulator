<script lang="ts">
	import Icon from '#lib/components/editor/Icon.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { adoptImage, readImage, referencedPaths, releaseImage, type ImageMap } from './art';
	import { ART_STATES, type ArtDraft, type ArtState } from './manifest';
	import ImagePick from './ImagePick.svelte';

	let {
		art = $bindable(),
		images = $bindable(),
		pinNames
	}: {
		art: ArtDraft;
		images: ImageMap;
		pinNames: string[];
	} = $props();

	const LEVELS = ['low', 'high', 'high-z'] as const;

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

	function urlOf(path: string | null): string | null {
		return path ? (images[path]?.url ?? null) : null;
	}

	function releaseIfUnused(path: string | null): void {
		if (!path || referencedPaths(art).includes(path)) return;
		releaseImage(images, path);
	}

	async function adopt(file: File, apply: (path: string) => void): Promise<void> {
		const image = await readImage(file);
		if (!image) return;
		adoptImage(images, image);
		apply(image.path);
	}

	function pickDefault(file: File): void {
		const previous = art.default;
		void adopt(file, (path) => {
			art.default = path;
			releaseIfUnused(previous);
		});
	}

	function clearDefault(): void {
		const previous = art.default;
		art.default = null;
		releaseIfUnused(previous);
	}

	function pickState(state: string, file: File): void {
		const previous = art.states[state] ?? null;
		void adopt(file, (path) => {
			art.states[state] = path;
			releaseIfUnused(previous);
		});
	}

	function clearState(state: string): void {
		const previous = art.states[state] ?? null;
		delete art.states[state];
		releaseIfUnused(previous);
	}

	function addRule(): void {
		art.pins.push({ pin: pinNames[0] ?? '', level: 'low', path: '' });
	}

	function removeRule(index: number): void {
		const [rule] = art.pins.splice(index, 1);
		releaseIfUnused(rule?.path ?? null);
	}

	function pickRule(index: number, file: File): void {
		const previous = art.pins[index]?.path ?? null;
		void adopt(file, (path) => {
			const rule = art.pins[index];
			if (rule) rule.path = path;
			releaseIfUnused(previous);
		});
	}

	function clearRule(index: number): void {
		const rule = art.pins[index];
		if (!rule) return;
		const previous = rule.path;
		rule.path = '';
		releaseIfUnused(previous);
	}
</script>

<div class="space-y-3">
	<div>
		<p class="mb-1 text-[11px] font-medium text-stone-500">{m.author_art_default()}</p>
		<ImagePick url={urlOf(art.default)} onpick={pickDefault} onclear={clearDefault} />
	</div>

	<div>
		<p class="mb-1 text-[11px] font-medium text-stone-500">{m.author_art_states()}</p>
		<div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
			{#each ART_STATES as state (state)}
				<div class="rounded-md border border-stone-200 bg-stone-50 p-2">
					<p class="mb-1 text-[11px] text-stone-500">{stateLabel(state)}</p>
					<ImagePick
						url={urlOf(art.states[state] ?? null)}
						onpick={(file: File) => pickState(state, file)}
						onclear={() => clearState(state)}
					/>
				</div>
			{/each}
		</div>
	</div>

	<div>
		<p class="mb-1 text-[11px] font-medium text-stone-500">{m.author_art_pins()}</p>
		<div class="space-y-1">
			{#each art.pins as rule, index (index)}
				<div
					class="flex flex-wrap items-center gap-2 rounded-md border border-stone-200 bg-stone-50 p-2"
				>
					<select
						class="rounded-md border border-stone-300 bg-white px-1.5 py-1 text-[12px] text-stone-800 outline-none focus:border-stone-500 [@media(pointer:coarse)]:py-2"
						bind:value={rule.pin}
						aria-label={m.author_pin_name()}
					>
						{#each pinNames as pinName (pinName)}
							<option value={pinName}>{pinName}</option>
						{/each}
						{#if rule.pin && !pinNames.includes(rule.pin)}
							<option value={rule.pin}>{rule.pin}</option>
						{/if}
					</select>
					<select
						class="rounded-md border border-stone-300 bg-white px-1.5 py-1 text-[12px] text-stone-800 outline-none focus:border-stone-500 [@media(pointer:coarse)]:py-2"
						bind:value={rule.level}
						aria-label={m.author_level()}
					>
						{#each LEVELS as level (level)}
							<option value={level}>{level}</option>
						{/each}
					</select>
					<ImagePick
						url={urlOf(rule.path || null)}
						onpick={(file: File) => pickRule(index, file)}
						onclear={() => clearRule(index)}
					/>
					<button
						type="button"
						title={m.settings_remove()}
						aria-label={m.settings_remove()}
						class="ml-auto flex h-7 w-7 items-center justify-center rounded text-stone-400 hover:bg-stone-100 hover:text-red-600 [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:w-9"
						onclick={() => removeRule(index)}
					>
						<Icon name="trash" size={14} />
					</button>
				</div>
			{/each}
			<button
				type="button"
				class="flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2 py-1 text-[12px] text-stone-700 hover:border-stone-400 disabled:opacity-40 [@media(pointer:coarse)]:py-2"
				disabled={!pinNames.length}
				onclick={addRule}
			>
				<Icon name="plus" size={13} />
				{m.author_add_rule()}
			</button>
		</div>
	</div>
</div>
