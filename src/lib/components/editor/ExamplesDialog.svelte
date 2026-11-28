<script lang="ts">
	import { canvasControl } from '#lib/canvas/control';
	import { m } from '#lib/paraglide/messages.js';
	import { sim } from '#lib/sim/controller.svelte';
	import { doc } from '#lib/sketch/doc.svelte';
	import { EXAMPLES, type Example } from '#lib/sketch/examples-list';
	import { ui } from '#lib/ui.svelte';
	import Icon from './Icon.svelte';

	function close(): void {
		ui.examplesOpen = false;
	}

	function open(example: Example): void {
		const name = example.name();
		if (example.analog) sim.setAnalog(true);
		doc.openSketch(name, example.build(name));
		ui.examplesOpen = false;
		requestAnimationFrame(() => canvasControl.engine?.fit());
	}
</script>

<svelte:window
	onkeydown={(event: KeyboardEvent) => {
		if (ui.examplesOpen && event.key === 'Escape') close();
	}}
/>

{#if ui.examplesOpen}
	<div class="fixed inset-0 z-[100]">
		<button
			type="button"
			aria-label={m.close()}
			class="absolute inset-0 bg-black/25"
			onclick={close}
		></button>
		<div
			class="relative mx-auto mt-16 flex max-h-[85vh] w-[min(440px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-stone-300 bg-white shadow-2xl [@media(pointer:coarse)]:mt-8"
			role="dialog"
			aria-label={m.examples_title()}
		>
			<div class="flex h-11 shrink-0 items-center justify-between border-b border-stone-200 px-3">
				<h2 class="text-[13px] font-semibold text-stone-800">{m.examples_title()}</h2>
				<button
					type="button"
					aria-label={m.close()}
					class="grid h-7 w-7 place-items-center rounded text-stone-500 hover:bg-stone-100 hover:text-stone-800"
					onclick={close}
				>
					<Icon name="close" size={15} />
				</button>
			</div>

			<div class="grid min-h-0 grid-cols-1 gap-1.5 overflow-y-auto p-2 sm:grid-cols-2">
				{#each EXAMPLES as example (example.id)}
					<button
						type="button"
						class="flex min-h-14 items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-2.5 py-2 text-left text-[12px] text-stone-800 transition-colors hover:border-stone-300 hover:bg-white [@media(pointer:coarse)]:min-h-16"
						onclick={() => open(example)}
					>
						<span
							class="grid h-7 w-7 shrink-0 place-items-center rounded bg-white text-stone-500 ring-1 ring-stone-200"
						>
							<Icon name="grid" size={14} />
						</span>
						<span class="truncate">{example.name()}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>
{/if}
