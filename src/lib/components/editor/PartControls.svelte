<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import type { PartInstance } from '#lib/sketch/types';
	import { doc } from '#lib/sketch/doc.svelte';
	import { sim } from '#lib/sim/controller.svelte';
	import { livePart } from '#lib/sim/live';

	let { part }: { part: PartInstance } = $props();

	const live = $derived.by(() => {
		void sim.revision;
		return livePart(part.id);
	});

	const type = $derived(part.type);

	let position = $state(0);
	let temperature = $state(25);
	let humidity = $state(50);
	let light = $state(500);
	let volts = $state(5);
	let amps = $state(0);
	let distance = $state(100);
	let axisX = $state(0);
	let axisY = $state(0);
	let angle = $state(0);
	let keyIndex = $state<number | null>(null);
	let dipMask = $state(0);

	// Controls start from the stored attributes; re-seed only when the
	// selection moves to another part, not on every attribute write.
	let seeded = '';
	$effect(() => {
		const id = part.id;
		if (id === seeded) return;
		seeded = id;
		position = Math.max(0, Math.min(1000, Number(part.attrs.value ?? 0) * 10));
		temperature = Number(part.attrs.temperature ?? 25);
		humidity = Number(part.attrs.humidity ?? 50);
		light = Number(part.attrs.light ?? 500);
		volts = Number(part.attrs.voltage ?? 5);
		amps = Number(part.attrs.current_limit ?? 0);
		distance = Number(part.attrs.distance ?? 100);
		axisX = 0;
		axisY = 0;
		angle = 0;
		keyIndex = null;
		dipMask = 0;
	});

	const KEYPAD = ['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D'];
	const keypadColumns = $derived(Number(part.attrs.columns ?? 4));
	const keypadRows = $derived(Math.ceil(KEYPAD.length / keypadColumns));

	const positionControl = $derived(
		type === 'litz-potentiometer' ||
			type === 'litz-slide-potentiometer' ||
			type === 'litz-trimmer-potentiometer'
	);

	const isControl = $derived(
		positionControl ||
			type === 'litz-photoresistor-sensor' ||
			type === 'litz-dht22' ||
			type === 'litz-power-supply' ||
			type === 'litz-hc-sr04' ||
			type === 'litz-pir-motion-sensor' ||
			type === 'litz-ntc-temperature-sensor' ||
			type === 'litz-rotary-encoder' ||
			type === 'litz-ky-040' ||
			type === 'litz-analog-joystick' ||
			type === 'litz-membrane-keypad' ||
			type === 'litz-pushbutton-latching' ||
			type === 'litz-dip-switch-4' ||
			type === 'litz-dip-switch-8'
	);

	function movePosition(value: number): void {
		position = value;
		sim.setControl(part.id, value);
	}

	function commitPosition(value: number): void {
		doc.setAttr(part.id, 'value', String(Math.round(value / 10)));
	}

	function moveLight(value: number): void {
		light = value;
		sim.setControl(part.id, value);
	}

	function commitLight(value: number): void {
		doc.setAttr(part.id, 'light', Math.round(value));
	}

	function moveTemperature(value: number): void {
		temperature = value;
		sim.setNamedControl(part.id, 'temperature', value);
	}

	function commitTemperature(value: number): void {
		doc.setAttr(part.id, 'temperature', value);
	}

	function moveHumidity(value: number): void {
		humidity = value;
		sim.setNamedControl(part.id, 'humidity', value);
		doc.setAttr(part.id, 'humidity', value);
	}

	function moveDistance(value: number): void {
		distance = value;
		// 0–1000 spans the sensor's 2–400 cm range.
		sim.setControl(part.id, Math.round(((value - 2) / 398) * 1000));
		doc.setAttr(part.id, 'distance', value);
	}

	function moveNtc(value: number): void {
		temperature = value;
		// −20…100 °C across 0–1000.
		sim.setControl(part.id, Math.round(((value + 20) / 120) * 1000));
		doc.setAttr(part.id, 'temperature', value);
	}

	function moveRotary(value: number): void {
		angle = value;
		sim.setControl(part.id, Math.round(((value + 80) / 160) * 1000));
	}

	function setAxis(axis: 'x' | 'y', value: number): void {
		if (axis === 'x') axisX = value;
		else axisY = value;
		sim.setNamedControl(part.id, axis, value);
	}

	function selectKey(index: number): void {
		keyIndex = index;
		const keys = keypadRows * keypadColumns;
		sim.setControl(part.id, Math.round((index * 1000) / Math.max(1, keys - 1)));
	}

	function holdKey(index: number, down: boolean): void {
		if (down) {
			selectKey(index);
			sim.press(part.id, true);
		} else {
			sim.press(part.id, false);
			keyIndex = null;
		}
	}

	const dipPositions = $derived(
		Array.from({ length: type === 'litz-dip-switch-4' ? 4 : 8 }, (_, index) => index)
	);

	function toggleDip(index: number): void {
		dipMask ^= 1 << index;
		sim.setControl(part.id, dipMask);
	}

	function toggleLatch(): void {
		sim.press(part.id, true);
		sim.press(part.id, false);
	}

	function setSupply(nextVolts: number, nextAmps: number): void {
		volts = nextVolts;
		amps = nextAmps;
		sim.setNamedControl(part.id, 'voltage', nextVolts);
		sim.setNamedControl(part.id, 'current', nextAmps);
	}

	function commitSupply(): void {
		doc.setAttr(part.id, 'voltage', volts);
		doc.setAttr(part.id, 'current_limit', amps);
	}

	function toggleMotion(): void {
		const on = live?.state !== 'on';
		sim.setNamedControl(part.id, 'motion', on ? 1 : 0);
	}

	const sliderClass = 'mt-0.5 w-full accent-stone-700';
</script>

{#if isControl}
	<p class="mt-3 text-[11px] text-stone-500">{m.section_control()}</p>

	{#if positionControl}
		<label class="mt-1 block">
			<span class="flex justify-between text-[12px] text-stone-600">
				<span>{m.control_position()}</span>
				<span class="font-mono text-stone-500">{Math.round(position / 10)}%</span>
			</span>
			<input
				type="range"
				min="0"
				max="1000"
				value={position}
				oninput={(event) => movePosition(Number(event.currentTarget.value))}
				onchange={(event) => commitPosition(Number(event.currentTarget.value))}
				class={sliderClass}
			/>
		</label>
	{:else if type === 'litz-photoresistor-sensor'}
		<label class="mt-1 block">
			<span class="flex justify-between text-[12px] text-stone-600">
				<span>{m.control_light()}</span>
				<span class="font-mono text-stone-500">{Math.round(light / 10)}%</span>
			</span>
			<input
				type="range"
				min="0"
				max="1000"
				value={light}
				oninput={(event) => moveLight(Number(event.currentTarget.value))}
				onchange={(event) => commitLight(Number(event.currentTarget.value))}
				class={sliderClass}
			/>
		</label>
	{:else if type === 'litz-dht22'}
		<label class="mt-1 block">
			<span class="flex justify-between text-[12px] text-stone-600">
				<span>{m.control_temperature()}</span>
				<span class="font-mono text-stone-500">{temperature.toFixed(1)}</span>
			</span>
			<input
				type="range"
				min="-40"
				max="80"
				step="0.5"
				value={temperature}
				oninput={(event) => moveTemperature(Number(event.currentTarget.value))}
				onchange={(event) => commitTemperature(Number(event.currentTarget.value))}
				class={sliderClass}
			/>
		</label>
		<label class="mt-1 block">
			<span class="flex justify-between text-[12px] text-stone-600">
				<span>{m.control_humidity()}</span>
				<span class="font-mono text-stone-500">{humidity.toFixed(0)}</span>
			</span>
			<input
				type="range"
				min="0"
				max="100"
				value={humidity}
				oninput={(event) => moveHumidity(Number(event.currentTarget.value))}
				class={sliderClass}
			/>
		</label>
	{:else if type === 'litz-power-supply'}
		<label class="mt-1 block">
			<span class="flex justify-between text-[12px] text-stone-600">
				<span>{m.control_voltage()}</span>
				<span class="font-mono text-stone-500">{volts.toFixed(1)}</span>
			</span>
			<input
				type="range"
				min="0"
				max="24"
				step="0.1"
				value={volts}
				oninput={(event) => setSupply(Number(event.currentTarget.value), amps)}
				onchange={commitSupply}
				class={sliderClass}
			/>
		</label>
		<label class="mt-1 block">
			<span class="flex justify-between text-[12px] text-stone-600">
				<span>{m.control_current()}</span>
				<span class="font-mono text-stone-500">
					{amps === 0 ? m.state_off() : `${amps.toFixed(1)} A`}
				</span>
			</span>
			<input
				type="range"
				min="0"
				max="20"
				step="0.1"
				value={amps}
				oninput={(event) => setSupply(volts, Number(event.currentTarget.value))}
				onchange={commitSupply}
				class={sliderClass}
			/>
		</label>
	{:else if type === 'litz-hc-sr04'}
		<label class="mt-1 block">
			<span class="flex justify-between text-[12px] text-stone-600">
				<span>{m.control_distance()}</span>
				<span class="font-mono text-stone-500">{distance.toFixed(0)}</span>
			</span>
			<input
				type="range"
				min="2"
				max="400"
				value={distance}
				oninput={(event) => moveDistance(Number(event.currentTarget.value))}
				class={sliderClass}
			/>
		</label>
	{:else if type === 'litz-ntc-temperature-sensor'}
		<label class="mt-1 block">
			<span class="flex justify-between text-[12px] text-stone-600">
				<span>{m.control_temperature()}</span>
				<span class="font-mono text-stone-500">{temperature.toFixed(1)}</span>
			</span>
			<input
				type="range"
				min="-20"
				max="100"
				step="0.5"
				value={temperature}
				oninput={(event) => moveNtc(Number(event.currentTarget.value))}
				class={sliderClass}
			/>
		</label>
	{:else if type === 'litz-pir-motion-sensor'}
		<button
			type="button"
			class="mt-1 rounded border px-2 py-1 text-[12px] [@media(pointer:coarse)]:px-3 [@media(pointer:coarse)]:py-2 {live?.state ===
			'on'
				? 'border-emerald-400 bg-emerald-50 text-emerald-700'
				: 'border-stone-300 bg-white text-stone-700'}"
			onclick={toggleMotion}
		>
			{m.control_motion()} · {live?.state === 'on' ? m.state_on() : m.state_off()}
		</button>
	{:else if type === 'litz-rotary-encoder' || type === 'litz-ky-040'}
		<label class="mt-1 block">
			<span class="flex justify-between text-[12px] text-stone-600">
				<span>{m.control_rotate()}</span>
				<span class="font-mono text-stone-500">{Math.round(angle * 4.5)}°</span>
			</span>
			<input
				type="range"
				min="-80"
				max="80"
				value={angle}
				oninput={(event) => moveRotary(Number(event.currentTarget.value))}
				class={sliderClass}
			/>
		</label>
	{:else if type === 'litz-analog-joystick'}
		<label class="mt-1 block">
			<span class="flex justify-between text-[12px] text-stone-600">
				<span>{m.control_axis_x()}</span>
				<span class="font-mono text-stone-500">{axisX}</span>
			</span>
			<input
				type="range"
				min="-100"
				max="100"
				value={axisX}
				oninput={(event) => setAxis('x', Number(event.currentTarget.value))}
				class={sliderClass}
			/>
		</label>
		<label class="mt-1 block">
			<span class="flex justify-between text-[12px] text-stone-600">
				<span>{m.control_axis_y()}</span>
				<span class="font-mono text-stone-500">{axisY}</span>
			</span>
			<input
				type="range"
				min="-100"
				max="100"
				value={axisY}
				oninput={(event) => setAxis('y', Number(event.currentTarget.value))}
				class={sliderClass}
			/>
		</label>
		<button
			type="button"
			class="mt-1 rounded border border-stone-300 bg-white px-2 py-1 text-[12px] text-stone-700 active:bg-stone-200 [@media(pointer:coarse)]:px-3 [@media(pointer:coarse)]:py-2"
			onpointerdown={() => sim.press(part.id, true)}
			onpointerup={() => sim.press(part.id, false)}
			onpointerleave={() => sim.press(part.id, false)}
		>
			{m.control_pressed()}
		</button>
	{:else if type === 'litz-membrane-keypad'}
		<div
			class="mt-1 grid gap-1"
			style="grid-template-columns: repeat({keypadColumns}, minmax(0, 1fr))"
		>
			{#each KEYPAD.slice(0, keypadRows * keypadColumns) as key, index (key)}
				<button
					type="button"
					class="rounded border px-1 py-1 font-mono text-[11px] {keyIndex === index
						? 'border-stone-700 bg-stone-800 text-white'
						: 'border-stone-300 bg-white text-stone-700'}"
					onpointerdown={() => holdKey(index, true)}
					onpointerup={() => holdKey(index, false)}
					onpointerleave={() => {
						if (keyIndex === index) holdKey(index, false);
					}}
				>
					{key}
				</button>
			{/each}
		</div>
	{:else if type === 'litz-dip-switch-4' || type === 'litz-dip-switch-8'}
		<div class="mt-1 flex flex-wrap gap-2">
			{#each dipPositions as index (index)}
				<label class="flex items-center gap-1 text-[11px] text-stone-600">
					<input
						type="checkbox"
						checked={Boolean(dipMask & (1 << index))}
						onchange={() => toggleDip(index)}
						class="accent-stone-700"
					/>
					{index + 1}
				</label>
			{/each}
		</div>
	{:else if type === 'litz-pushbutton-latching'}
		<button
			type="button"
			class="mt-1 rounded border px-2 py-1 text-[12px] [@media(pointer:coarse)]:px-3 [@media(pointer:coarse)]:py-2 {live?.state ===
			'down'
				? 'border-emerald-400 bg-emerald-50 text-emerald-700'
				: 'border-stone-300 bg-white text-stone-700'}"
			onclick={toggleLatch}
		>
			{live?.state === 'down' ? m.state_down() : m.state_up()}
		</button>
	{/if}
{/if}
