<script lang="ts">
	import { boardDef } from '#lib/parts/breadboard';
	import { boardName, categoryLabel, colorLabel } from '#lib/i18n/labels';
	import { m } from '#lib/paraglide/messages.js';
	import { partDef } from '#lib/parts/registry';
	import { sim } from '#lib/sim/controller.svelte';
	import type { Level, PartState } from '#lib/sim/backend';
	import { livePart } from '#lib/sim/live';
	import { doc } from '#lib/sketch/doc.svelte';
	import { GRID, WIRE_COLORS, type Rotation } from '#lib/sketch/types';
	import PartControls from './PartControls.svelte';

	const selection = $derived(doc.selected);
	const single = $derived(selection.length === 1 ? selection[0] : null);
	const part = $derived(single && single.kind === 'part' ? doc.part(single.id) : undefined);
	const board = $derived(single && single.kind === 'board' ? doc.board(single.id) : undefined);
	const wire = $derived(
		single && single.kind === 'wire' ? doc.sketch.wires.find((w) => w.id === single.id) : undefined
	);
	const def = $derived(part ? partDef(part.type) : null);

	function setX(value: number): void {
		if (!single) return;
		doc.mutate(() => doc.setPosition(single.id, value, part?.y ?? board?.y ?? 0));
	}

	function setY(value: number): void {
		if (!single) return;
		doc.mutate(() => doc.setPosition(single.id, part?.x ?? board?.x ?? 0, value));
	}

	function setRotate(rotate: Rotation): void {
		const target = part ?? board;
		if (!target) return;
		doc.mutate(() => {
			target.rotate = rotate;
		});
	}

	function wireEnd(endpoint: {
		kind: string;
		part?: string;
		pin?: string;
		board?: string;
		col?: number;
		row?: number;
	}): string {
		if (endpoint.kind === 'pin') return `${endpoint.part}:${endpoint.pin}`;
		if (endpoint.kind === 'hole') return `${endpoint.board} ${endpoint.col},${endpoint.row}`;
		return m.free_point();
	}

	const counts = $derived({
		part: selection.filter((s) => s.kind === 'part').length,
		board: selection.filter((s) => s.kind === 'board').length,
		wire: selection.filter((s) => s.kind === 'wire').length
	});

	const live = $derived.by(() => {
		void sim.revision;
		return part ? livePart(part.id) : undefined;
	});

	const pinLevels = $derived.by(() => {
		void sim.revision;
		if (!part || !def || !sim.running) return [];
		return def.pins.map((pin) => ({ name: pin.name, level: sim.partPin(part.id, pin.name) }));
	});

	function stateLabel(state: PartState | undefined): string {
		switch (state) {
			case 'off':
				return m.state_off();
			case 'on':
				return m.state_on();
			case 'up':
				return m.state_up();
			case 'down':
				return m.state_down();
			case 'silent':
				return m.state_silent();
			case 'sounding':
				return m.state_sounding();
			case 'position':
				return m.state_position();
			case 'mask':
				return m.state_mask();
			case 'state':
				return m.state_state();
			case 'unknown':
				return m.state_unknown();
			default:
				return m.state_none();
		}
	}

	function levelLabel(level: Level | null): string {
		if (level === 'high') return m.level_high();
		if (level === 'low') return m.level_low();
		if (level === 'high-z') return m.level_high_z();
		return m.level_none();
	}

	function levelClass(level: Level | null): string {
		if (level === 'high') return 'bg-emerald-500';
		if (level === 'low') return 'bg-stone-500';
		if (level === 'high-z') return 'bg-amber-400';
		return 'bg-stone-200';
	}
</script>

<div class="flex h-full flex-col overflow-y-auto p-3">
	{#if selection.length > 1}
		<p class="text-[11px] font-medium tracking-wide text-stone-500">{m.multi_selection()}</p>
		<h2 class="mt-0.5 text-[15px] font-semibold text-stone-800">
			{m.multi_count({ count: selection.length })}
		</h2>
		<ul class="mt-2 space-y-0.5 text-[12px] text-stone-500">
			{#if counts.part}<li>{m.multi_parts({ count: counts.part })}</li>{/if}
			{#if counts.board}<li>{m.multi_boards({ count: counts.board })}</li>{/if}
			{#if counts.wire}<li>{m.multi_wires({ count: counts.wire })}</li>{/if}
		</ul>
		<div class="mt-3 flex gap-1.5">
			<button
				type="button"
				class="rounded border border-stone-300 bg-white px-2 py-1 text-[12px] text-stone-700 hover:border-stone-400"
				onclick={() => doc.rotateSelection()}
			>
				{m.rotate_90()}
			</button>
			<button
				type="button"
				class="rounded border border-red-300 bg-red-50 px-2 py-1 text-[12px] text-red-700 hover:bg-red-100"
				onclick={() => doc.deleteSelection()}
			>
				{m.delete()}
			</button>
		</div>
		<p class="mt-3 text-[11px] text-stone-400">{m.multi_drag_hint()}</p>
	{:else if part && def}
		<p class="text-[11px] font-medium tracking-wide text-stone-500">
			{categoryLabel(def.category)}
		</p>
		<h2 class="mt-0.5 text-[15px] font-semibold text-stone-800">{def.name}</h2>
		<p class="text-[12px] text-stone-500">{part.type} · {part.id}</p>

		<div class="mt-4 grid grid-cols-2 gap-2">
			<label class="block">
				<span class="block text-[11px] text-stone-500">X</span>
				<input
					type="number"
					step={GRID}
					value={Math.round(part.x)}
					onchange={(event) => setX(Number(event.currentTarget.value))}
					class="mt-0.5 w-full rounded border border-stone-300 bg-white px-2 py-1 text-[13px]"
				/>
			</label>
			<label class="block">
				<span class="block text-[11px] text-stone-500">Y</span>
				<input
					type="number"
					step={GRID}
					value={Math.round(part.y)}
					onchange={(event) => setY(Number(event.currentTarget.value))}
					class="mt-0.5 w-full rounded border border-stone-300 bg-white px-2 py-1 text-[13px]"
				/>
			</label>
		</div>

		<p class="mt-3 text-[11px] text-stone-500">{m.section_rotation()}</p>
		<div class="mt-1 grid grid-cols-4 gap-1">
			{#each [0, 90, 180, 270] as angle (angle)}
				<button
					type="button"
					class="rounded border px-1 py-1 text-[12px] {part.rotate === angle
						? 'border-stone-700 bg-stone-800 text-white'
						: 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'}"
					onclick={() => setRotate(angle as Rotation)}
				>
					{angle}°
				</button>
			{/each}
		</div>

		{#if def.attrs.length}
			<p class="mt-3 text-[11px] text-stone-500">{m.section_attrs()}</p>
			{#each def.attrs as attr (attr.name)}
				<label class="mt-1 block">
					<span class="block text-[12px] text-stone-600">{attr.name}</span>
					{#if attr.type === 'enum'}
						<select
							value={String(part.attrs[attr.name] ?? attr.default)}
							onchange={(event) => doc.setAttr(part.id, attr.name, event.currentTarget.value)}
							class="mt-0.5 w-full rounded border border-stone-300 bg-white px-2 py-1 text-[13px]"
						>
							{#each attr.values ?? [] as value (value)}
								<option {value}>{value}</option>
							{/each}
						</select>
					{:else if attr.type === 'number'}
						<input
							type="number"
							step="any"
							value={String(part.attrs[attr.name] ?? attr.default)}
							onchange={(event) =>
								doc.setAttr(part.id, attr.name, Number(event.currentTarget.value))}
							class="mt-0.5 w-full rounded border border-stone-300 bg-white px-2 py-1 text-[13px]"
						/>
					{:else}
						<input
							type="text"
							value={String(part.attrs[attr.name] ?? attr.default)}
							onchange={(event) => doc.setAttr(part.id, attr.name, event.currentTarget.value)}
							class="mt-0.5 w-full rounded border border-stone-300 bg-white px-2 py-1 text-[13px]"
						/>
					{/if}
				</label>
			{/each}
		{/if}

		{#if sim.running}
			<p class="mt-3 text-[11px] text-stone-500">{m.section_live()}</p>
			<div class="mt-1 grid grid-cols-2 gap-2 rounded bg-stone-100 px-2 py-1 text-[12px]">
				<span class="text-stone-500">{m.live_state()}</span>
				<span class="font-mono text-stone-700">{stateLabel(live?.state)}</span>
				<span class="text-stone-500">{m.live_value()}</span>
				<span class="font-mono text-stone-700">{live ? live.value : m.level_none()}</span>
			</div>
		{/if}

		{#if sim.running}
			<PartControls {part} />
		{/if}

		<p class="mt-3 text-[11px] text-stone-500">{m.section_pins()}</p>
		<ul class="mt-1 space-y-0.5">
			{#each def.pins as pin (pin.name)}
				<li class="flex justify-between rounded bg-stone-100 px-2 py-0.5 text-[12px]">
					<span class="font-mono text-stone-700">{pin.name}</span>
					{#if sim.running}
						<span class="flex items-center gap-1 text-[11px] text-stone-500">
							<span
								class="h-2 w-2 rounded-full {levelClass(
									pinLevels.find((entry) => entry.name === pin.name)?.level ?? null
								)}"
							></span>
							{levelLabel(pinLevels.find((entry) => entry.name === pin.name)?.level ?? null)}
						</span>
					{:else}
						<span class="text-stone-500">{pin.label ?? ''}</span>
					{/if}
				</li>
			{/each}
		</ul>

		<button
			type="button"
			class="mt-4 rounded border border-red-300 bg-red-50 px-2 py-1.5 text-[12px] text-red-700 hover:bg-red-100"
			onclick={() => doc.deleteSelection()}
		>
			{m.delete_part()}
		</button>
	{:else if board}
		<p class="text-[11px] font-medium tracking-wide text-stone-500">{m.breadboard()}</p>
		<h2 class="mt-0.5 text-[15px] font-semibold text-stone-800">{boardName(board.type)}</h2>
		<p class="text-[12px] text-stone-500">
			{m.board_info({ count: boardDef(board.type).tiePoints, id: board.id })}
		</p>

		<div class="mt-4 grid grid-cols-2 gap-2">
			<label class="block">
				<span class="block text-[11px] text-stone-500">X</span>
				<input
					type="number"
					step={GRID}
					value={Math.round(board.x)}
					onchange={(event) => setX(Number(event.currentTarget.value))}
					class="mt-0.5 w-full rounded border border-stone-300 bg-white px-2 py-1 text-[13px]"
				/>
			</label>
			<label class="block">
				<span class="block text-[11px] text-stone-500">Y</span>
				<input
					type="number"
					step={GRID}
					value={Math.round(board.y)}
					onchange={(event) => setY(Number(event.currentTarget.value))}
					class="mt-0.5 w-full rounded border border-stone-300 bg-white px-2 py-1 text-[13px]"
				/>
			</label>
		</div>

		<p class="mt-3 text-[11px] text-stone-500">{m.section_rotation()}</p>
		<div class="mt-1 grid grid-cols-4 gap-1">
			{#each [0, 90, 180, 270] as angle (angle)}
				<button
					type="button"
					class="rounded border px-1 py-1 text-[12px] {board.rotate === angle
						? 'border-stone-700 bg-stone-800 text-white'
						: 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'}"
					onclick={() => setRotate(angle as Rotation)}
				>
					{angle}°
				</button>
			{/each}
		</div>

		<button
			type="button"
			class="mt-4 rounded border border-red-300 bg-red-50 px-2 py-1.5 text-[12px] text-red-700 hover:bg-red-100"
			onclick={() => doc.deleteSelection()}
		>
			{m.delete_board()}
		</button>
	{:else if wire}
		<p class="text-[11px] font-medium tracking-wide text-stone-500">{m.wire()}</p>
		<h2 class="mt-0.5 text-[15px] font-semibold text-stone-800">{wire.id}</h2>
		<p class="mt-1 text-[12px] break-all text-stone-500">{wireEnd(wire.from)}</p>
		<p class="text-[12px] break-all text-stone-500">→ {wireEnd(wire.to)}</p>

		<p class="mt-4 text-[11px] text-stone-500">{m.section_color()}</p>
		<div class="mt-1 flex flex-wrap gap-1.5">
			{#each WIRE_COLORS as color (color.value)}
				<button
					type="button"
					title={colorLabel(color.name)}
					class="h-6 w-6 rounded-full border-2 {wire.color === color.value
						? 'border-stone-800'
						: 'border-transparent'}"
					style="background: {color.value}"
					onclick={() => doc.setWireColor(wire.id, color.value)}
				></button>
			{/each}
		</div>

		<p class="mt-4 text-[11px] text-stone-400">{m.wire_routing_hint()}</p>

		<button
			type="button"
			class="mt-4 rounded border border-red-300 bg-red-50 px-2 py-1.5 text-[12px] text-red-700 hover:bg-red-100"
			onclick={() => doc.deleteSelection()}
		>
			{m.delete_wire()}
		</button>
	{:else}
		<p class="text-[13px] text-stone-500">{m.inspector_empty()}</p>
		<ul class="mt-3 space-y-1 text-[12px] text-stone-500">
			<li>{m.hint_drag_parts()}</li>
			<li>{m.hint_wire()}</li>
			<li>{m.hint_marquee()}</li>
			<li>{m.hint_pan_zoom()}</li>
			<li>{m.hint_keys()}</li>
		</ul>
	{/if}
</div>
