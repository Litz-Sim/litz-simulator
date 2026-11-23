<script lang="ts">
	type AnsiState = {
		bold: boolean;
		dim: boolean;
		color: string | undefined;
	};

	type Token = {
		text: string;
		color?: string;
		bold?: boolean;
		dim?: boolean;
	};

	type RenderedOutput = {
		lines: Token[][];
		truncated: boolean;
	};

	const MAX_LINES = 2000;
	const STICK_THRESHOLD = 24;

	const ANSI_COLORS: readonly string[] = [
		'#1c1917',
		'#b91c1c',
		'#15803d',
		'#a16207',
		'#1d4ed8',
		'#a21caf',
		'#0e7490',
		'#57534e'
	];

	const ANSI_BRIGHT_COLORS: readonly string[] = [
		'#78716c',
		'#dc2626',
		'#16a34a',
		'#ca8a04',
		'#2563eb',
		'#c026d3',
		'#0891b2',
		'#a8a29e'
	];

	// CSI sequences, OSC sequences, then any other two/three-byte escape sequence.
	/* eslint-disable no-control-regex */
	const ANSI_PATTERN =
		/\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?|\x1b[ -/]*[0-~]/g;

	function applySgr(params: string, state: AnsiState): void {
		const parts = params.length === 0 ? ['0'] : params.split(';');
		for (const part of parts) {
			const code = part.length === 0 ? 0 : Number.parseInt(part, 10);
			if (Number.isNaN(code)) continue;
			if (code === 0) {
				state.bold = false;
				state.dim = false;
				state.color = undefined;
			} else if (code === 1) {
				state.bold = true;
			} else if (code === 2) {
				state.dim = true;
			} else if (code === 22) {
				state.bold = false;
				state.dim = false;
			} else if (code === 39) {
				state.color = undefined;
			} else if (code >= 30 && code <= 37) {
				state.color = ANSI_COLORS[code - 30];
			} else if (code >= 90 && code <= 97) {
				state.color = ANSI_BRIGHT_COLORS[code - 90];
			}
		}
	}

	function pushToken(tokens: Token[], text: string, state: AnsiState): void {
		if (!text) return;
		const previous: Token | undefined = tokens[tokens.length - 1];
		if (
			previous !== undefined &&
			previous.color === state.color &&
			(previous.bold ?? false) === state.bold &&
			(previous.dim ?? false) === state.dim
		) {
			previous.text += text;
			return;
		}
		const token: Token = { text };
		if (state.color !== undefined) token.color = state.color;
		if (state.bold) token.bold = true;
		if (state.dim) token.dim = true;
		tokens.push(token);
	}

	function parseLine(line: string): Token[] {
		const tokens: Token[] = [];
		const state: AnsiState = { bold: false, dim: false, color: undefined };
		let lastIndex = 0;
		ANSI_PATTERN.lastIndex = 0;
		let match: RegExpExecArray | null = ANSI_PATTERN.exec(line);
		while (match !== null) {
			if (match.index > lastIndex) {
				pushToken(tokens, line.slice(lastIndex, match.index), state);
			}
			const sequence = match[0];
			if (
				sequence.length > 2 &&
				sequence.charCodeAt(1) === 0x5b &&
				sequence.charCodeAt(sequence.length - 1) === 0x6d
			) {
				applySgr(sequence.slice(2, -1), state);
			}
			lastIndex = ANSI_PATTERN.lastIndex;
			match = ANSI_PATTERN.exec(line);
		}
		if (lastIndex < line.length) {
			pushToken(tokens, line.slice(lastIndex), state);
		}
		return tokens;
	}

	let {
		text,
		running,
		error,
		onSend,
		onClear,
		boards = [],
		selected = null,
		onselect,
		placeholder,
		sendLabel,
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
		placeholder: string;
		sendLabel: string;
		clearLabel: string;
		waitingLabel: string;
		idleLabel: string;
	} = $props();

	let input = $state('');
	const destination = $derived(selected ?? boards[0]?.id ?? '');
	let scroller = $state<HTMLDivElement | undefined>();
	let inputElement: HTMLInputElement | undefined;
	let stickToBottom = true;

	const rendered: RenderedOutput = $derived.by(() => {
		const source = text;
		if (source.length === 0) {
			return { lines: [], truncated: false };
		}
		const rawLines = source.split('\n');
		const start = Math.max(0, rawLines.length - MAX_LINES);
		const lines: Token[][] = [];
		for (let index = start; index < rawLines.length; index += 1) {
			let line = rawLines[index] ?? '';
			// CRLF ends every normal line; a lone CR only rewrites the line
			// already on screen. Strip the terminator before looking for the
			// last in-line redraw, or every CRLF line would render empty.
			while (line.endsWith('\r')) line = line.slice(0, -1);
			const carriageReturn = line.lastIndexOf('\r');
			if (carriageReturn !== -1) line = line.slice(carriageReturn + 1);
			lines.push(parseLine(line));
		}
		return { lines, truncated: start > 0 };
	});

	function handleScroll(): void {
		const element = scroller;
		if (!element) return;
		stickToBottom =
			element.scrollHeight - element.scrollTop - element.clientHeight <= STICK_THRESHOLD;
	}

	function submit(event: SubmitEvent): void {
		event.preventDefault();
		onSend(`${input}\n`, destination || undefined);
		input = '';
		inputElement?.focus();
	}

	$effect(() => {
		void text;
		const element = scroller;
		if (element && stickToBottom) {
			element.scrollTop = element.scrollHeight;
		}
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
	<div
		bind:this={scroller}
		onscroll={handleScroll}
		class="min-h-0 flex-1 overflow-y-auto bg-[#fbfaf7] px-3 py-1.5 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap text-stone-700"
	>
		{#if text}
			{#if rendered.truncated}
				<div class="min-h-[1.625em] text-stone-400">…</div>
			{/if}
			{#each rendered.lines as line, lineIndex (lineIndex)}
				<div class="min-h-[1.625em]">
					{#each line as token, tokenIndex (tokenIndex)}
						<span
							class:font-bold={token.bold}
							class:opacity-60={token.dim}
							style:color={token.color}
						>
							{token.text}
						</span>
					{/each}
				</div>
			{/each}
		{:else}
			<span class="text-stone-400">{running ? waitingLabel : idleLabel}</span>
		{/if}
	</div>

	{#if error}
		<p
			class="border-t border-red-200 bg-red-50 px-3 py-1 font-mono text-[11px] break-all whitespace-pre-wrap text-red-700"
		>
			{error}
		</p>
	{/if}

	<form class="flex items-center gap-1 border-t border-stone-200 px-2 py-1" onsubmit={submit}>
		<input
			bind:this={inputElement}
			bind:value={input}
			{placeholder}
			spellcheck="false"
			autocomplete="off"
			class="min-w-0 flex-1 rounded border border-stone-300 bg-white px-2 py-0.5 font-mono text-[11px] [@media(pointer:coarse)]:py-2"
		/>
		<button
			type="submit"
			class="rounded border border-stone-300 bg-stone-100 px-2 py-0.5 text-[11px] hover:bg-stone-200 [@media(pointer:coarse)]:px-3 [@media(pointer:coarse)]:py-2"
		>
			{sendLabel}
		</button>
		<button
			type="button"
			class="rounded border border-stone-300 bg-stone-100 px-2 py-0.5 text-[11px] hover:bg-stone-200 [@media(pointer:coarse)]:px-3 [@media(pointer:coarse)]:py-2"
			onclick={() => onClear()}
		>
			{clearLabel}
		</button>
		<span class="rounded bg-stone-200 px-1.5 py-0.5 text-[10px] text-stone-500">115200</span>
	</form>
</div>
