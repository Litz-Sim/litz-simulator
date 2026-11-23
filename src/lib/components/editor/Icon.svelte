<script lang="ts">
	const PATHS: Record<string, string> = {
		cursor: 'M5 3l6 17 2.2-6.8L20 11z',
		wire: 'M4 19c4-1 6-4 8-7s4-6 8-8',
		rotate: 'M4 10a8 8 0 1 1 2.3 8.7M4 5v5h5',
		trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
		undo: 'M9 14L4 9l5-5M4 9h9a7 7 0 0 1 0 14h-2',
		redo: 'M15 14l5-5-5-5M20 9h-9a7 7 0 0 0 0 14h2',
		plus: 'M12 5v14M5 12h14',
		play: 'M8 5l11 7-11 7z',
		stop: 'M7 7h10v10H7z',
		grid: 'M4 9h16M4 15h16M9 4v16M15 4v16',
		chevron: 'M6 9l6 6 6-6',
		code: 'M9 7l-5 5 5 5M15 7l5 5-5 5',
		chip: 'M8 8h8v8H8zM4 9h4M4 15h4M16 9h4M16 15h4M9 4v4M15 4v4M9 16v4M15 16v4',
		fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
		parts: 'M4 5h6v6H4zM14 5h6v6h-6zM4 13h6v6H4zM14 13h6v6h-6z',
		sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4v6M9 14v6',
		close: 'M6 6l12 12M18 6L6 18'
	};

	let { name, size = 16 }: { name: string; size?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	<path d={PATHS[name] ?? ''} />
</svg>
