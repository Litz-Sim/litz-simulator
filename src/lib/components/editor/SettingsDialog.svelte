<script lang="ts">
	import { getLocale, setLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import { installPackage, packages, removePackage } from '#lib/parts/custom.svelte';
	import { sim } from '#lib/sim/controller.svelte';
	import { doc } from '#lib/sketch/doc.svelte';
	import { projects } from '#lib/storage/projects.svelte';
	import type { S3Settings } from '#lib/storage/s3';
	import { ui } from '#lib/ui.svelte';
	import Icon from './Icon.svelte';

	const SPEEDS: { value: number; label: () => string }[] = [
		{ value: 0.25, label: m.menu_speed_quarter },
		{ value: 0.5, label: m.menu_speed_half },
		{ value: 1, label: m.menu_speed_normal },
		{ value: 2, label: m.menu_speed_double },
		{ value: 4, label: m.menu_speed_quad },
		{ value: 0, label: m.menu_speed_max }
	];

	const FIELDS: {
		key: keyof S3Settings;
		label: () => string;
		placeholder: string;
		wide?: boolean;
		secret?: boolean;
	}[] = [
		{
			key: 'endpoint',
			label: m.settings_endpoint,
			placeholder: 'https://s3.us-east-1.amazonaws.com',
			wide: true
		},
		{ key: 'bucket', label: m.settings_bucket, placeholder: 'my-litz-projects' },
		{ key: 'region', label: m.settings_region, placeholder: 'us-east-1' },
		{ key: 'prefix', label: m.settings_prefix, placeholder: 'projects' },
		{ key: 'accessKeyId', label: m.settings_access_key, placeholder: 'AKIA…' },
		{
			key: 'secretAccessKey',
			label: m.settings_secret_key,
			placeholder: '••••••••',
			wide: true,
			secret: true
		}
	];

	let input = $state<HTMLInputElement>();
	let error = $state<string | null>(null);
	let draft = $state<S3Settings>({ ...projects.settings });
	let testState = $state<'idle' | 'ok' | 'error'>('idle');

	$effect(() => {
		if (!ui.settingsOpen) return;
		draft = { ...projects.settings };
		testState = 'idle';
	});

	async function test(): Promise<void> {
		testState = (await projects.test()) ? 'ok' : 'error';
	}

	function close(): void {
		ui.settingsOpen = false;
		error = null;
	}

	async function chooseLocale(locale: 'en' | 'zh'): Promise<void> {
		if (getLocale() === locale) return;
		await setLocale(locale);
		window.location.reload();
	}

	async function importFile(event: Event): Promise<void> {
		const field = event.currentTarget as HTMLInputElement;
		const file = field.files?.[0];
		field.value = '';
		if (!file) return;
		error = null;
		try {
			installPackage(new Uint8Array(await file.arrayBuffer()), file.name);
		} catch (failure) {
			error = failure instanceof Error ? failure.message : String(failure);
		}
	}

	function setSpeed(value: string): void {
		sim.setSpeed(Number(value));
	}
</script>

<svelte:window
	onkeydown={(event: KeyboardEvent) => {
		if (ui.settingsOpen && event.key === 'Escape') close();
	}}
/>

{#if ui.settingsOpen}
	<div class="fixed inset-0 z-[100]">
		<button
			type="button"
			aria-label={m.close()}
			class="absolute inset-0 bg-black/25"
			onclick={close}
		></button>
		<div
			class="relative mx-auto mt-16 flex max-h-[85vh] w-[min(560px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-stone-300 bg-white shadow-2xl [@media(pointer:coarse)]:mt-8"
			role="dialog"
			aria-label={m.settings()}
		>
			<div class="flex h-11 shrink-0 items-center justify-between border-b border-stone-200 px-3">
				<h2 class="text-[13px] font-semibold text-stone-800">{m.settings()}</h2>
				<button
					type="button"
					aria-label={m.close()}
					class="grid h-7 w-7 place-items-center rounded text-stone-500 hover:bg-stone-100 hover:text-stone-800"
					onclick={close}
				>
					<Icon name="close" size={15} />
				</button>
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto">
				<section class="border-b border-stone-200 px-3 py-3">
					<div class="flex items-center justify-between gap-3">
						<h3 class="text-[11px] font-medium tracking-wide text-stone-500">{m.language()}</h3>
						<select
							class="rounded border border-stone-300 bg-white px-2 py-1 text-[12px] [@media(pointer:coarse)]:py-2"
							onchange={(event) => void chooseLocale(event.currentTarget.value as 'en' | 'zh')}
						>
							<option value="zh" selected={getLocale() === 'zh'}>{m.language_zh()}</option>
							<option value="en" selected={getLocale() === 'en'}>{m.language_en()}</option>
						</select>
					</div>
				</section>

				<section class="border-b border-stone-200 px-3 py-3">
					<div class="flex items-center justify-between gap-3">
						<h3 class="text-[11px] font-medium tracking-wide text-stone-500">
							{m.settings_snap()}
						</h3>
						<button
							type="button"
							aria-label={m.settings_snap()}
							aria-pressed={doc.snap}
							class="h-6 w-11 rounded-full p-0.5 transition-colors {doc.snap
								? 'bg-stone-800'
								: 'bg-stone-300'}"
							onclick={() => (doc.snap = !doc.snap)}
						>
							<span
								class="block h-5 w-5 rounded-full bg-white shadow transition-transform {doc.snap
									? 'translate-x-5'
									: ''}"
							></span>
						</button>
					</div>
					<div class="mt-3 flex items-center justify-between gap-3">
						<h3 class="text-[11px] font-medium tracking-wide text-stone-500">
							{m.settings_speed()}
						</h3>
						<select
							class="rounded border border-stone-300 bg-white px-2 py-1 text-[12px] [@media(pointer:coarse)]:py-2"
							onchange={(event) => setSpeed(event.currentTarget.value)}
						>
							{#each SPEEDS as speed (speed.value)}
								<option value={speed.value} selected={speed.value === sim.speed}>
									{speed.label()}
								</option>
							{/each}
						</select>
					</div>
				</section>

				<section class="px-3 py-3">
					<div class="flex items-center justify-between gap-2">
						<h3 class="text-[11px] font-medium tracking-wide text-stone-500">
							{m.settings_parts()}
						</h3>
						<input
							bind:this={input}
							type="file"
							accept=".zip,application/zip"
							class="hidden"
							onchange={importFile}
						/>
						<button
							type="button"
							class="flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2 py-1 text-[12px] text-stone-700 hover:border-stone-400 [@media(pointer:coarse)]:py-2"
							onclick={() => input?.click()}
						>
							<Icon name="upload" size={13} />
							{m.settings_import()}
						</button>
					</div>
					<p class="mt-1 text-[11px] text-stone-400">{m.settings_parts_hint()}</p>

					{#if packages.length}
						<ul class="mt-2 space-y-1">
							{#each packages as entry (entry.name)}
								<li
									class="flex items-center gap-2 rounded border border-stone-200 bg-stone-50 px-2 py-1.5"
								>
									<span class="min-w-0 flex-1">
										<span class="block truncate text-[12px] text-stone-800">{entry.name}</span>
										<span class="block truncate font-mono text-[10px] text-stone-500">
											{entry.types.join(', ')}
										</span>
									</span>
									<button
										type="button"
										class="shrink-0 rounded px-1.5 py-1 text-[11px] text-stone-500 hover:bg-red-50 hover:text-red-600"
										onclick={() => removePackage(entry.name)}
									>
										{m.settings_remove()}
									</button>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="mt-2 text-[12px] text-stone-400">{m.settings_empty()}</p>
					{/if}

					{#if error}
						<p class="mt-2 text-[11px] text-red-600">
							{m.settings_import_failed({ detail: error })}
						</p>
					{/if}
				</section>

				<section class="border-t border-stone-200 px-3 py-3">
					<div class="flex items-center justify-between gap-3">
						<h3 class="text-[11px] font-medium tracking-wide text-stone-500">
							{m.settings_storage()}
						</h3>
						<div class="flex items-center gap-1.5">
							<button
								type="button"
								class="rounded-md border border-stone-300 bg-white px-2 py-1 text-[12px] text-stone-700 hover:border-stone-400 [@media(pointer:coarse)]:py-2"
								onclick={() => {
									projects.saveSettings(draft);
									void test();
								}}
							>
								{m.settings_storage_test()}
							</button>
							<button
								type="button"
								class="rounded-md bg-stone-800 px-2 py-1 text-[12px] text-white hover:bg-stone-700 [@media(pointer:coarse)]:py-2"
								onclick={() => projects.saveSettings(draft)}
							>
								{m.projects_save()}
							</button>
						</div>
					</div>

					<div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
						{#each FIELDS as field (field.key)}
							<label class="block {field.wide ? 'sm:col-span-2' : ''}">
								<span class="block text-[11px] text-stone-500">{field.label()}</span>
								<input
									type={field.secret ? 'password' : 'text'}
									spellcheck="false"
									autocomplete="off"
									placeholder={field.placeholder}
									class="mt-0.5 w-full rounded border border-stone-300 px-2 py-1 font-mono text-[12px] text-stone-800 placeholder:text-stone-400 focus:border-[#2f6fd0] focus:outline-none"
									bind:value={draft[field.key]}
								/>
							</label>
						{/each}
					</div>
					<p class="mt-1.5 text-[11px] text-stone-400">{m.settings_storage_keys()}</p>
					{#if testState === 'ok'}
						<p class="mt-1 text-[11px] text-emerald-700">{m.settings_storage_ok()}</p>
					{:else if testState === 'error' && projects.error}
						<p class="mt-1 text-[11px] text-red-600">
							{m.projects_failed({ detail: projects.error })}
						</p>
					{/if}
				</section>
			</div>
		</div>
	</div>
{/if}
