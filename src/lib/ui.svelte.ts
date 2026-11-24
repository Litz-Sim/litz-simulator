export type BottomTab = 'code' | 'serial' | 'plot' | 'screen' | 'analysis' | 'debug' | 'log';

/** What the Enter key sends after the terminal translates it from CR. */
export type SerialEnding = 'lf' | 'cr' | 'crlf';

interface UiState {
	settingsOpen: boolean;
	projectOpen: boolean;
	examplesOpen: boolean;
	bottomOpen: boolean;
	bottomTab: BottomTab;
	/** Height in pixels of the open bottom panel; dragging the divider changes it. */
	bottomHeight: number;
	/**
	 * File shown in the bottom editor: `diagram.json`, or a board storage file
	 * written as `storage:<board id>:<path>`.
	 */
	codeFile: string;
	/** Board whose console the Serial and Plot panels show; the first one when unset. */
	serialBoard: string | null;
	/** Line ending the Serial terminal sends for Enter. */
	serialEnding: SerialEnding;
	/** Display part the Screen panel shows; the first one in the circuit when unset. */
	screenPart: string | null;
}

/** Small pieces of chrome state shared by the menu bar, canvas and page. */
export const ui: UiState = $state({
	settingsOpen: false,
	projectOpen: false,
	examplesOpen: false,
	bottomOpen: true,
	bottomTab: 'code',
	bottomHeight: 216,
	codeFile: 'diagram.json',
	serialBoard: null,
	serialEnding: 'lf',
	screenPart: null
});

/** Key for a file in a development board's storage. */
export function storageFile(boardId: string, path: string): string {
	return `storage:${boardId}:${path}`;
}

/** Split a `storage:` key back into its board and path. */
export function parseStorageFile(value: string): { boardId: string; path: string } | null {
	if (!value.startsWith('storage:')) return null;
	const rest = value.slice('storage:'.length);
	const split = rest.indexOf(':');
	if (split <= 0) return null;
	return { boardId: rest.slice(0, split), path: rest.slice(split + 1) };
}

/** Key for a file on a storage part's volume. */
export function volumePath(partId: string, path: string): string {
	return `volume:${partId}:${path}`;
}

export function parseVolumePath(value: string): { partId: string; path: string } | null {
	if (!value.startsWith('volume:')) return null;
	const rest = value.slice('volume:'.length);
	const split = rest.indexOf(':');
	if (split <= 0) return null;
	return { partId: rest.slice(0, split), path: rest.slice(split + 1) };
}

/** Key for a development board's flash dump. */
export function flashPath(boardId: string): string {
	return `flash:${boardId}`;
}

export function parseFlashPath(value: string): string | null {
	return value.startsWith('flash:') ? value.slice('flash:'.length) : null;
}
