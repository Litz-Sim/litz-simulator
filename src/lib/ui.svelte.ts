export type BottomTab = 'code' | 'serial' | 'plot' | 'analysis' | 'debug' | 'manifests' | 'log';

interface UiState {
	addOpen: boolean;
	bottomOpen: boolean;
	bottomTab: BottomTab;
	/** Height in pixels of the open bottom panel; dragging the divider changes it. */
	bottomHeight: number;
	/** File shown in the bottom editor: the editable source or the derived diagram. */
	codeFile: 'main.c' | 'diagram.json';
}

/** Small pieces of chrome state shared by the menu bar, canvas and page. */
export const ui: UiState = $state({
	addOpen: false,
	bottomOpen: true,
	bottomTab: 'code',
	bottomHeight: 216,
	codeFile: 'main.c'
});
