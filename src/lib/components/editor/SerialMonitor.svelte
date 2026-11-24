<script lang="ts">
	import '@xterm/xterm/css/xterm.css';
	import { onMount } from 'svelte';
	import type { Terminal } from '@xterm/xterm';
	import { m } from '#lib/paraglide/messages.js';
	import { feedDelta, withCarriageReturns } from '#lib/sim/terminalStream';
	import { ui, type SerialEnding } from '#lib/ui.svelte';

	/** The bytes Enter sends, after xterm hands it a CR. */
	const ENDINGS: Record<SerialEnding, string> = {
		lf: '\n',
		cr: '\r',
		crlf: '\r\n'
	};

	/** Touch screens have no Esc, Ctrl or arrow keys of their own. */
	const KEYS: { label: string; data: string }[] = [
		{ label: 'Esc', data: '\x1b' },
		{ label: 'Tab', data: '\t' },
		{ label: '^C', data: '\x03' },
		{ label: '^D', data: '\x04' },
		{ label: '↑', data: '\x1b[A' },
		{ label: '↓', data: '\x1b[B' },
		{ label: '←', data: '\x1b[D' },
		{ label: '→', data: '\x1b[C' }
	];

	// Same tones as the rest of the editor, mapped onto the terminal's palette.
	const THEME = {
		background: '#fbfaf7',
		foreground: '#44403c',
		cursor: '#57534e',
		cursorAccent: '#fbfaf7',
		selectionBackground: 'rgba(120, 113, 108, 0.3)',
		black: '#1c1917',
		red: '#b91c1c',
		green: '#15803d',
		yellow: '#a16207',
		blue: '#1d4ed8',
		magenta: '#a21caf',
		cyan: '#0e7490',
		white: '#d6d3d1',
		brightBlack: '#78716c',
		brightRed: '#dc2626',
		brightGreen: '#16a34a',
		brightYellow: '#ca8a04',
		brightBlue: '#2563eb',
		brightMagenta: '#c026d3',
		brightCyan: '#0891b2',
		brightWhite: '#f5f5f4'
	};

	let {
		text,
		running,
		error,
		onSend,
		onClear,
		boards = [],
		selected = null,
		onselect,
		clearLabel,
		waitingLabel,
		idleLabel
	}: {
		text: string;
		running: boolean;
		error: string | null;
		onSend: (text: string, board?: string) => void;
		onClear: () => void;
		boards?: { id: string; name: string }[];
		selected?: string | null;
		onselect?: (board: string) => void;
		clearLabel: string;
		waitingLabel: string;
		idleLabel: string;
	} = $props();

	const destination = $derived(selected ?? boards[0]?.id ?? '');
	let host: HTMLDivElement | undefined;
	let term = $state.raw<Terminal>();
	/** What the terminal currently shows, so each tick writes only the new tail. */
	let shown = '';
	let shownBoard = '';
	let afterCR = false;

	onMount(() => {
		let disposed = false;
		let observer: ResizeObserver | undefined;
		void (async () => {
			const [core, fitModule] = await Promise.all([
				import('@xterm/xterm'),
				import('@xterm/addon-fit')
			]);
			if (disposed || !host) return;
			const instance = new core.Terminal({
				cols: 80,
				rows: 12,
				scrollback: 2000,
				// Bare line feeds are normalised before they reach the terminal.
				convertEol: false,
				cursorBlink: true,
				cursorStyle: 'bar',
				fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
				fontSize: window.matchMedia('(pointer: coarse)').matches ? 13 : 11,
				lineHeight: 1.25,
				theme: THEME
			});
			const fit = new fitModule.FitAddon();
			instance.loadAddon(fit);
			instance.open(host);
			requestAnimationFrame(() => {
				try {
					fit.fit();
				} catch {
					// The panel can still be at zero height on its first frame.
				}
			});
			instance.onData((data) => send(data));
			observer = new ResizeObserver(() => {
				try {
					fit.fit();
				} catch {
					// Same as above: a collapsed panel has nothing to fit.
				}
			});
			observer.observe(host);
			term = instance;
		})();
		return () => {
			disposed = true;
			observer?.disconnect();
			term?.dispose();
			term = undefined;
		};
	});

	/** Typed bytes reach the board unchanged, except the Enter key's line ending. */
	function send(data: string): void {
		const out = data === '\r' ? ENDINGS[ui.serialEnding] : data;
		onSend(out, destination || undefined);
	}

	// xterm parses writes asynchronously, so a reset issued while chunks are
	// still queued would land in the middle of them and scramble the screen.
	// Both go through one chain, in the order the console produced them.
	let pending: Promise<void> = Promise.resolve();
	function enqueue(action: () => void | Promise<void>): void {
		pending = pending.then(action, action);
	}
	function resetTerminal(terminal: Terminal): void {
		enqueue(() => terminal.reset());
	}
	function writeTerminal(terminal: Terminal, data: string): void {
		enqueue(
			() =>
				new Promise<void>((done) => {
					terminal.write(data, () => done());
				})
		);
	}

	$effect(() => {
		const terminal = term;
		if (!terminal) return;
		const board = selected ?? '';
		const source = text;
		if (board !== shownBoard) {
			resetTerminal(terminal);
			shown = '';
			afterCR = false;
			shownBoard = board;
		}
		const feed = feedDelta(shown, source);
		if (feed.reset) {
			resetTerminal(terminal);
			afterCR = false;
		}
		shown = source;
		if (!feed.write) return;
		const normalized = withCarriageReturns(feed.write, afterCR);
		afterCR = normalized.afterCR;
		writeTerminal(terminal, normalized.text);
	});

	$effect(() => {
		if (!term) return;
		term.options.disableStdin = !running;
		term.options.cursorInactiveStyle = running ? 'outline' : 'none';
	});
</script>

<div class="flex h-full min-h-0 flex-col bg-stone-50">
	{#if boards.length > 1}
		<div
			class="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-stone-200 bg-stone-100 px-2 py-1"
		>
			{#each boards as board (board.id)}
				<button
					type="button"
					title={board.name}
					class="flex h-6 max-w-44 shrink-0 items-center gap-1.5 rounded-md border px-2 text-[10px] transition-colors [@media(pointer:coarse)]:h-8 [@media(pointer:coarse)]:text-[11px] {selected ===
					board.id
						? 'border-stone-700 bg-stone-800 text-white'
						: 'border-stone-300 bg-white text-stone-600 hover:border-stone-400'}"
					onclick={() => onselect?.(board.id)}
				>
					<span class="font-mono">{board.id}</span>
					<span class="truncate opacity-70">{board.name}</span>
				</button>
			{/each}
		</div>
	{/if}

	<div class="relative min-h-0 flex-1">
		<div bind:this={host} class="h-full w-full bg-[#fbfaf7] px-2 py-1"></div>
		{#if !text}
			<p class="pointer-events-none absolute inset-x-3 top-2 font-mono text-[11px] text-stone-400">
				{running ? waitingLabel : idleLabel}
			</p>
		{/if}
	</div>

	{#if error}
		<p
			class="border-t border-red-200 bg-red-50 px-3 py-1 font-mono text-[11px] break-all whitespace-pre-wrap text-red-700"
		>
			{error}
		</p>
	{/if}

	<div
		role="group"
		class="hidden shrink-0 items-center gap-1 border-t border-stone-200 bg-stone-100 px-2 py-1 [@media(pointer:coarse)]:flex"
		aria-label={m.serial_keys()}
	>
		{#each KEYS as key (key.label)}
			<button
				type="button"
				aria-label={key.label}
				class="flex h-7 min-w-8 items-center justify-center rounded border border-stone-300 bg-white px-1.5 font-mono text-[11px] text-stone-600 hover:border-stone-400"
				onclick={() => send(key.data)}
			>
				{key.label}
			</button>
		{/each}
	</div>

	<div class="flex shrink-0 items-center gap-1 border-t border-stone-200 px-2 py-1">
		<select
			bind:value={ui.serialEnding}
			title={m.serial_ending()}
			aria-label={m.serial_ending()}
			class="h-6 rounded border border-stone-300 bg-white px-1 font-mono text-[10px] text-stone-600 [@media(pointer:coarse)]:h-8"
		>
			<option value="lf">LF</option>
			<option value="cr">CR</option>
			<option value="crlf">CRLF</option>
		</select>
		<button
			type="button"
			class="h-6 rounded border border-stone-300 bg-stone-100 px-2 text-[11px] hover:bg-stone-200 [@media(pointer:coarse)]:h-8 [@media(pointer:coarse)]:px-3"
			onclick={() => onClear()}
		>
			{clearLabel}
		</button>
		<span class="ml-auto rounded bg-stone-200 px-1.5 py-0.5 text-[10px] text-stone-500">
			115200
		</span>
	</div>
</div>
