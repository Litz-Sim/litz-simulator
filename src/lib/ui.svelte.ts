export type BottomTab = 'code' | 'serial' | 'plot' | 'analysis' | 'debug' | 'manifests' | 'log';

interface UiState {
	settingsOpen: boolean;
	bottomOpen: boolean;
	bottomTab: BottomTab;
	/** Height in pixels of the open bottom panel; dragging the divider changes it. */
	bottomHeight: number;
	/**
	 * File shown in the bottom editor: `main.c`, `diagram.json`, or a board
	 * storage file written as `storage:<board id>:<path>`.
	 */
	codeFile: string;
	/** Board whose console the Serial and Plot panels show; the first one when unset. */
	serialBoard: string | null;
}

/** Small pieces of chrome state shared by the menu bar, canvas and page. */
export const ui: UiState = $state({
	settingsOpen: false,
	bottomOpen: true,
	bottomTab: 'code',
	bottomHeight: 216,
	codeFile: 'main.c',
	serialBoard: null
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
