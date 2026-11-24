/**
 * The serial panel keeps one string per board. A terminal needs the deltas, not
 * the whole string every tick, and it needs real line breaks rather than bare
 * line feeds.
 */

export interface Feed {
	/** True when the new string cannot continue what the terminal already shows. */
	reset: boolean;
	write: string;
}

/**
 * Never trust a tiny match: two unrelated console logs can share a character or
 * two at the seam, and a false continuation loses the start of the new output.
 */
const MIN_OVERLAP = 64;

/**
 * Longest suffix of `previous` that is a prefix of `next`, computed with the
 * KMP failure table so a capped 40k window costs one linear pass.
 */
function suffixPrefix(previous: string, next: string): number {
	if (previous.length === 0 || next.length === 0) return 0;
	const fail = new Int32Array(next.length);
	for (let index = 1, matched = 0; index < next.length; index += 1) {
		const code = next.charCodeAt(index);
		while (matched > 0 && code !== next.charCodeAt(matched)) matched = fail[matched - 1];
		if (code === next.charCodeAt(matched)) matched += 1;
		fail[index] = matched;
	}
	let matched = 0;
	for (let index = 0; index < previous.length; index += 1) {
		const code = previous.charCodeAt(index);
		while (matched > 0 && code !== next.charCodeAt(matched)) matched = fail[matched - 1];
		if (code === next.charCodeAt(matched)) matched += 1;
		if (matched === next.length) matched = fail[matched - 1];
	}
	return matched;
}

/** What to write so a terminal that already shows `previous` ends up showing `next`. */
export function feedDelta(previous: string, next: string): Feed {
	if (next === previous) return { reset: false, write: '' };
	if (next.startsWith(previous)) return { reset: false, write: next.slice(previous.length) };
	if (previous.startsWith(next)) return { reset: true, write: next };
	const shared = suffixPrefix(previous, next);
	if (shared >= MIN_OVERLAP) return { reset: false, write: next.slice(shared) };
	return { reset: true, write: next };
}

/**
 * xterm treats a line feed as "down one row, same column". Firmware that prints
 * `"\n"` alone expects the cursor to return as well, so give every bare LF the
 * carriage return it is missing. `afterCR` carries the boundary between chunks.
 */
export function withCarriageReturns(
	chunk: string,
	afterCR: boolean
): { text: string; afterCR: boolean } {
	if (chunk.length === 0) return { text: '', afterCR };
	let text = '';
	let previousWasCR = afterCR;
	for (const character of chunk) {
		if (character === '\n' && !previousWasCR) text += '\r';
		text += character;
		previousWasCR = character === '\r';
	}
	return { text, afterCR: previousWasCR };
}
