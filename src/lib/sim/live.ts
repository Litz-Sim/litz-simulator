import type { DisplayFrame, PartState } from './backend';

export interface LivePart {
	state: PartState;
	/** The number behind the state: segment mask, servo degrees, tone rate. */
	value: number;
}

/**
 * Part states written by the running backend and read by the canvas.
 *
 * This is deliberately not reactive: the canvas redraws on its own frame
 * clock, so a plain lookup avoids waking every component on each step.
 */
const states = new Map<string, LivePart>();

/** One frame per display part, keyed by diagram id. */
const panels = new Map<string, DisplayFrame>();

let display: DisplayFrame | null = null;

export function setLiveStates(entries: { id: string; state: PartState; value: number }[]): void {
	states.clear();
	for (const entry of entries) states.set(entry.id, { state: entry.state, value: entry.value });
}

export function clearLiveStates(): void {
	states.clear();
}

export function livePart(id: string): LivePart | undefined {
	return states.get(id);
}

export function liveState(id: string): PartState | undefined {
	return states.get(id)?.state;
}

export function setLiveDisplay(frame: DisplayFrame | null): void {
	display = frame;
}

export function liveDisplay(): DisplayFrame | null {
	return display;
}

/** Replace the per-part frames; a part whose backend has no panel keeps none. */
export function setLivePanels(entries: { id: string; frame: DisplayFrame | null }[]): void {
	panels.clear();
	for (const entry of entries) {
		if (entry.frame) panels.set(entry.id, entry.frame);
	}
}

export function clearLivePanels(): void {
	panels.clear();
}

export function livePanel(id: string): DisplayFrame | null {
	return panels.get(id) ?? null;
}
