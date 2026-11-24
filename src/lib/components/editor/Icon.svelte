<script lang="ts">
	import type { Component } from 'svelte';
	import Activity from '@lucide/svelte/icons/activity';
	import Bug from '@lucide/svelte/icons/bug';
	import Cable from '@lucide/svelte/icons/cable';
	import Crosshair from '@lucide/svelte/icons/crosshair';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import Download from '@lucide/svelte/icons/download';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleDashed from '@lucide/svelte/icons/circle-dashed';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Cpu from '@lucide/svelte/icons/cpu';
	import FileCode from '@lucide/svelte/icons/file-code';
	import FilePlus from '@lucide/svelte/icons/file-plus';
	import FolderOpen from '@lucide/svelte/icons/folder-open';
	import Grid3x3 from '@lucide/svelte/icons/grid-3x3';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Maximize2 from '@lucide/svelte/icons/maximize-2';
	import Minus from '@lucide/svelte/icons/minus';
	import Monitor from '@lucide/svelte/icons/monitor';
	import MousePointer2 from '@lucide/svelte/icons/mouse-pointer-2';
	import Palette from '@lucide/svelte/icons/palette';
	import PanelBottom from '@lucide/svelte/icons/panel-bottom';
	import Play from '@lucide/svelte/icons/play';
	import Plus from '@lucide/svelte/icons/plus';
	import Redo2 from '@lucide/svelte/icons/redo-2';
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import Save from '@lucide/svelte/icons/save';
	import ScrollText from '@lucide/svelte/icons/scroll-text';
	import Search from '@lucide/svelte/icons/search';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import Square from '@lucide/svelte/icons/square';
	import Terminal from '@lucide/svelte/icons/terminal';
	import Trash from '@lucide/svelte/icons/trash';
	import TriangleExclamationPoint from '@lucide/svelte/icons/triangle-exclamation-point';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import Upload from '@lucide/svelte/icons/upload';
	import X from '@lucide/svelte/icons/x';

	type IconComponent = Component<{
		size?: number;
		strokeWidth?: number;
		class?: string;
		'aria-hidden'?: boolean | 'true' | 'false';
	}>;

	const ICONS: Record<string, IconComponent> = {
		activity: Activity,
		bug: Bug,
		chart: ChartLine,
		check: Check,
		chevron: ChevronDown,
		'chevron-up': ChevronUp,
		chip: Cpu,
		close: X,
		code: FileCode,
		cursor: MousePointer2,
		probe: Crosshair,
		download: Download,
		file: FileCode,
		'file-plus': FilePlus,
		fit: Maximize2,
		folder: FolderOpen,
		grid: Grid3x3,
		loader: LoaderCircle,
		log: ScrollText,
		minus: Minus,
		monitor: Monitor,
		palette: Palette,
		panel: PanelBottom,
		parts: LayoutGrid,
		play: Play,
		plus: Plus,
		redo: Redo2,
		rotate: RotateCw,
		save: Save,
		'save-error': TriangleExclamationPoint,
		'save-ok': CircleCheck,
		'save-pending': CircleDashed,
		search: Search,
		settings: SettingsIcon,
		sliders: SlidersHorizontal,
		stop: Square,
		terminal: Terminal,
		trash: Trash,
		upload: Upload,
		undo: Undo2,
		'save-x': CircleX,
		wire: Cable
	};

	let {
		name,
		size = 16,
		strokeWidth = 1.9,
		class: className = ''
	}: { name: string; size?: number; strokeWidth?: number; class?: string } = $props();

	const Glyph = $derived(ICONS[name] ?? ICONS.code);
</script>

<Glyph {size} {strokeWidth} class={className} aria-hidden="true" />
