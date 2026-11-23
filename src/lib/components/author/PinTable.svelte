<script lang="ts">
	import Icon from '#lib/components/editor/Icon.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { blankPin, PIN_KINDS, type AuthorMode, type PinRow } from './manifest';

	let {
		mode,
		pins = $bindable()
	}: {
		mode: AuthorMode;
		pins: PinRow[];
	} = $props();

	const field =
		'w-full rounded-md border border-stone-300 bg-white px-1.5 py-1 text-[12px] text-stone-800 outline-none focus:border-stone-500 [@media(pointer:coarse)]:py-2';

	function add(): void {
		pins = [...pins, blankPin(pins.length)];
	}

	function remove(index: number): void {
		pins = pins.filter((_, row) => row !== index);
	}
</script>

<div class="space-y-2">
	{#if mode === 'board'}
		<p class="text-[11px] text-stone-500">{m.author_board_pins_hint()}</p>
	{/if}

	<div class="-mx-1 overflow-x-auto px-1">
		<table class="w-full min-w-[520px] border-separate border-spacing-y-1">
			<thead>
				<tr class="text-left text-[11px] font-medium text-stone-500">
					<th class="w-24 px-1 font-medium">{m.author_pin_name()}</th>
					<th class="w-24 px-1 font-medium">{m.author_pin_label()}</th>
					{#if mode === 'part'}
						<th class="w-32 px-1 font-medium">{m.author_pin_kind()}</th>
					{:else}
						<th class="w-20 px-1 font-medium">{m.author_pin_gpio()}</th>
					{/if}
					<th class="w-16 px-1 font-medium">{m.author_pin_x()}</th>
					<th class="w-16 px-1 font-medium">{m.author_pin_y()}</th>
					{#if mode === 'board'}
						<th class="w-24 px-1 font-medium">{m.author_pin_fixed()}</th>
					{/if}
					<th class="w-8 px-1"></th>
				</tr>
			</thead>
			<tbody>
				{#each pins as pin, index (index)}
					<tr>
						<td class="px-1">
							<input class={field} bind:value={pin.name} aria-label={m.author_pin_name()} />
						</td>
						<td class="px-1">
							<input class={field} bind:value={pin.label} aria-label={m.author_pin_label()} />
						</td>
						{#if mode === 'part'}
							<td class="px-1">
								<select class={field} bind:value={pin.kind} aria-label={m.author_pin_kind()}>
									{#each PIN_KINDS as kind (kind)}
										<option value={kind}>{kind}</option>
									{/each}
								</select>
							</td>
						{:else}
							<td class="px-1">
								<input
									class={field}
									bind:value={pin.gpio}
									inputmode="numeric"
									aria-label={m.author_pin_gpio()}
								/>
							</td>
						{/if}
						<td class="px-1">
							<input
								class={field}
								bind:value={pin.x}
								inputmode="decimal"
								aria-label={m.author_pin_x()}
							/>
						</td>
						<td class="px-1">
							<input
								class={field}
								bind:value={pin.y}
								inputmode="decimal"
								aria-label={m.author_pin_y()}
							/>
						</td>
						{#if mode === 'board'}
							<td class="px-1">
								<input
									class={field}
									bind:value={pin.fixed}
									placeholder="3v3 / 5v / gnd"
									aria-label={m.author_board_pins_hint()}
								/>
							</td>
						{/if}
						<td class="px-1">
							<button
								type="button"
								title={m.settings_remove()}
								aria-label={m.settings_remove()}
								class="flex h-7 w-7 items-center justify-center rounded text-stone-400 hover:bg-stone-100 hover:text-red-600 [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:w-9"
								onclick={() => remove(index)}
							>
								<Icon name="trash" size={14} />
							</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<button
		type="button"
		class="flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2 py-1 text-[12px] text-stone-700 hover:border-stone-400 [@media(pointer:coarse)]:py-2"
		onclick={add}
	>
		<Icon name="plus" size={13} />
		{m.author_add_pin()}
	</button>
</div>
