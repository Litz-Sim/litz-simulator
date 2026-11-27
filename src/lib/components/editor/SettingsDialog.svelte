<script lang="ts">
	import { untrack } from 'svelte';
	import { getLocale, setLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import { installPackage, packages, removePackage } from '#lib/parts/custom.svelte';
	import { sim } from '#lib/sim/controller.svelte';
	import { link } from '#lib/sim/editorLink.svelte';
	import { doc } from '#lib/sketch/doc.svelte';
	import { Cloudflare } from '#lib/storage/cloudflare';
	import { projects } from '#lib/storage/projects.svelte';
	import { r2Account, r2Endpoint, type S3Settings } from '#lib/storage/s3';
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
		{ key: 'bucket', label: m.settings_bucket, placeholder: 'my-litz-projects' },
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
	/** The bucket flavour, which is a different question from where projects live. */
	let flavour = $state<'s3' | 'r2'>('s3');
	let account = $state('');
	let copied = $state(false);
	let attach = $state('');
	let apiToken = $state('');
	let bucketState = $state<'idle' | 'working' | 'done'>('idle');
	let bucketError = $state<string | null>(null);
	const canBucket = $derived(
		link.status === 'online' && Boolean(account.trim() && draft.bucket.trim() && apiToken.trim())
	);

	$effect(() => {
		if (!ui.settingsOpen) return;
		// Read the stored settings once into locals: an effect that read back
		// the state it just wrote would re-run until Svelte stops it.
		const stored = { ...projects.settings };
		const id = r2Account(stored.endpoint) ?? '';
		draft = stored;
		account = id;
		apiToken = stored.apiToken ?? '';
		flavour = id ? 'r2' : 's3';
		testState = 'idle';
		copied = false;
		// Untracked: the link going online mid-edit must not reset the form.
		attach = untrack(() => (link.status === 'online' ? '' : link.remembered));
		bucketState = 'idle';
		bucketError = null;
	});

	// R2 has one endpoint per account and signs with region `auto`, so the
	// dialog asks for the account id and stores what the bucket expects.
	function current(): S3Settings {
		return flavour === 'r2'
			? { ...draft, endpoint: r2Endpoint(account), region: 'auto', apiToken: apiToken.trim() }
			: { ...draft, apiToken: apiToken.trim() };
	}

	function save(): void {
		projects.saveSettings(current());
	}

	async function test(): Promise<void> {
		projects.saveSettings(current());
		testState = (await projects.test()) ? 'ok' : 'error';
	}

	async function copyCors(): Promise<void> {
		const policy = [
			{
				AllowedOrigins: [window.location.origin],
				AllowedMethods: ['GET', 'PUT', 'DELETE', 'HEAD'],
				AllowedHeaders: ['*'],
				ExposeHeaders: ['ETag'],
				MaxAgeSeconds: 3600
			}
		];
		try {
			await navigator.clipboard.writeText(JSON.stringify(policy, null, 2));
			copied = true;
		} catch {
			copied = false;
		}
	}

	function connectLink(): void {
		const text = attach.trim();
		if (!text) return;
		if (link.connect(text)) attach = '';
	}

	/** The calls Cloudflare will not take from a page, made from the link's machine. */
	function cloud(): Cloudflare {
		projects.saveSettings(current());
		return new Cloudflare(account.trim(), apiToken.trim(), async (method, url, init) => {
			const reply = await link.request(method, url, init);
			return { status: reply.status, body: reply.body };
		});
	}

	async function runBucket(task: () => Promise<void>): Promise<void> {
		bucketState = 'working';
		bucketError = null;
		try {
			await task();
			bucketState = 'done';
		} catch (failure) {
			bucketState = 'idle';
			bucketError = failure instanceof Error ? failure.message : String(failure);
		}
	}

	function createBucket(): void {
		void runBucket(async () => {
			await cloud().createBucket(draft.bucket);
			await cloud().setCors(draft.bucket, window.location.origin);
		});
	}

	function setCors(): void {
		void runBucket(async () => {
			await cloud().setCors(draft.bucket, window.location.origin);
		});
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
							{m.link_title()}
						</h3>
						<span
							class="text-[11px] {link.status === 'online' ? 'text-emerald-700' : 'text-stone-400'}"
						>
							{link.status === 'online'
								? m.link_online()
								: link.status === 'connecting'
									? m.link_connecting()
									: m.link_offline()}
						</span>
					</div>

					{#if link.status === 'online'}
						<p class="mt-2 text-[11px] text-stone-600">
							{[link.project, link.version].filter(Boolean).join(' · ')}
						</p>
						<p class="mt-0.5 font-mono text-[10px] break-all text-stone-400">
							{link.library ?? ''}
						</p>
						<button
							type="button"
							class="mt-2 rounded-md border border-stone-300 bg-white px-2 py-1 text-[12px] text-stone-700 hover:border-stone-400 [@media(pointer:coarse)]:py-2"
							onclick={() => link.disconnect()}
						>
							{m.link_disconnect()}
						</button>
					{:else}
						<div class="mt-2 flex gap-2">
							<input
								type="text"
								spellcheck="false"
								autocomplete="off"
								aria-label={m.link_hint()}
								placeholder="wss://host/ws#CODE"
								class="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1 font-mono text-[12px] text-stone-800 placeholder:text-stone-400 focus:border-[#2f6fd0] focus:outline-none"
								bind:value={attach}
								onkeydown={(event) => {
									if (event.key === 'Enter') connectLink();
								}}
							/>
							<button
								type="button"
								class="shrink-0 rounded-md bg-stone-800 px-2 py-1 text-[12px] text-white hover:bg-stone-700 [@media(pointer:coarse)]:py-2"
								onclick={connectLink}
							>
								{m.link_connect()}
							</button>
						</div>
						{#if link.error}
							<p class="mt-1 text-[11px] text-red-600">{link.error}</p>
						{/if}
					{/if}
				</section>

				<section class="border-t border-stone-200 px-3 py-3">
					<div class="flex items-center justify-between gap-3">
						<h3 class="text-[11px] font-medium tracking-wide text-stone-500">
							{m.settings_storage()}
						</h3>
						{#if projects.provider === 's3'}
							<div class="flex items-center gap-1.5">
								<button
									type="button"
									class="rounded-md border border-stone-300 bg-white px-2 py-1 text-[12px] text-stone-700 hover:border-stone-400 [@media(pointer:coarse)]:py-2"
									onclick={() => void test()}
								>
									{m.settings_storage_test()}
								</button>
								<button
									type="button"
									class="rounded-md bg-stone-800 px-2 py-1 text-[12px] text-white hover:bg-stone-700 [@media(pointer:coarse)]:py-2"
									onclick={save}
								>
									{m.projects_save()}
								</button>
							</div>
						{/if}
					</div>

					<label class="mt-2 block">
						<span class="block text-[11px] text-stone-500">{m.settings_source()}</span>
						<select
							class="mt-0.5 w-full rounded border border-stone-300 bg-white px-2 py-1 text-[12px]"
							value={projects.provider}
							onchange={(event) =>
								projects.setProvider(event.currentTarget.value === 's3' ? 's3' : 'link')}
						>
							<option value="link">{m.settings_source_link()}</option>
							<option value="s3">{m.settings_source_s3()}</option>
						</select>
					</label>

					{#if projects.provider === 'link'}
						<p class="mt-2 font-mono text-[11px] text-stone-400">
							{link.library ?? m.projects_need_link()}
						</p>
					{:else}
						<div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
							<label class="block sm:col-span-2">
								<span class="block text-[11px] text-stone-500">{m.settings_provider()}</span>
								<select
									class="mt-0.5 w-full rounded border border-stone-300 bg-white px-2 py-1 text-[12px]"
									bind:value={flavour}
								>
									<option value="s3">{m.settings_provider_s3()}</option>
									<option value="r2">{m.settings_provider_r2()}</option>
								</select>
							</label>
							{#if flavour === 'r2'}
								<label class="block sm:col-span-2">
									<span class="block text-[11px] text-stone-500">{m.settings_account()}</span>
									<input
										type="text"
										spellcheck="false"
										autocomplete="off"
										placeholder="0123456789abcdef0123456789abcdef"
										class="mt-0.5 w-full rounded border border-stone-300 px-2 py-1 font-mono text-[12px] text-stone-800 placeholder:text-stone-400 focus:border-[#2f6fd0] focus:outline-none"
										bind:value={account}
									/>
								</label>
								<label class="block sm:col-span-2">
									<span class="block text-[11px] text-stone-500">
										{m.settings_api_token()}
									</span>
									<input
										type="password"
										spellcheck="false"
										autocomplete="off"
										placeholder="••••••••"
										class="mt-0.5 w-full rounded border border-stone-300 px-2 py-1 font-mono text-[12px] text-stone-800 placeholder:text-stone-400 focus:border-[#2f6fd0] focus:outline-none"
										bind:value={apiToken}
									/>
								</label>
							{:else}
								<label class="block sm:col-span-2">
									<span class="block text-[11px] text-stone-500">{m.settings_endpoint()}</span>
									<input
										type="text"
										spellcheck="false"
										autocomplete="off"
										placeholder="https://s3.us-east-1.amazonaws.com"
										class="mt-0.5 w-full rounded border border-stone-300 px-2 py-1 font-mono text-[12px] text-stone-800 placeholder:text-stone-400 focus:border-[#2f6fd0] focus:outline-none"
										bind:value={draft.endpoint}
									/>
								</label>
								<label class="block sm:col-span-2">
									<span class="block text-[11px] text-stone-500">{m.settings_region()}</span>
									<input
										type="text"
										spellcheck="false"
										autocomplete="off"
										placeholder="us-east-1"
										class="mt-0.5 w-full rounded border border-stone-300 px-2 py-1 font-mono text-[12px] text-stone-800 placeholder:text-stone-400 focus:border-[#2f6fd0] focus:outline-none"
										bind:value={draft.region}
									/>
								</label>
							{/if}
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
						{#if flavour === 'r2'}
							<div class="mt-2 flex flex-wrap items-center gap-2">
								<button
									type="button"
									class="rounded-md border border-stone-300 bg-white px-2 py-1 text-[12px] text-stone-700 hover:border-stone-400 disabled:opacity-40 [@media(pointer:coarse)]:py-2"
									disabled={!canBucket || bucketState === 'working'}
									onclick={createBucket}
								>
									{m.settings_bucket_create()}
								</button>
								<button
									type="button"
									class="rounded-md border border-stone-300 bg-white px-2 py-1 text-[12px] text-stone-700 hover:border-stone-400 disabled:opacity-40 [@media(pointer:coarse)]:py-2"
									disabled={!canBucket || bucketState === 'working'}
									onclick={setCors}
								>
									{m.settings_cors_set()}
								</button>
								{#if bucketState === 'done'}
									<span class="text-[11px] text-emerald-700">{m.settings_bucket_done()}</span>
								{/if}
							</div>
							{#if link.status !== 'online'}
								<p class="mt-1 text-[11px] text-stone-400">{m.link_need_for_bucket()}</p>
							{:else if bucketError}
								<p class="mt-1 text-[11px] text-red-600">
									{m.projects_failed({ detail: bucketError })}
								</p>
							{/if}
						{/if}
						<div class="mt-1.5 flex items-center justify-between gap-3">
							<p class="text-[11px] text-stone-400">{m.settings_storage_keys()}</p>
							<button
								type="button"
								class="shrink-0 rounded border border-stone-300 px-2 py-0.5 text-[11px] text-stone-600 hover:bg-stone-50"
								onclick={() => void copyCors()}
							>
								{copied ? m.settings_copied() : m.settings_copy_cors()}
							</button>
						</div>
						{#if testState === 'ok'}
							<p class="mt-1 text-[11px] text-emerald-700">{m.settings_storage_ok()}</p>
						{:else if testState === 'error' && projects.error}
							<p class="mt-1 text-[11px] text-red-600">
								{m.projects_failed({ detail: projects.error })}
							</p>
						{/if}
					{/if}
				</section>
			</div>
		</div>
	</div>
{/if}
