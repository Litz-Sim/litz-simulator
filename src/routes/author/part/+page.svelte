<script lang="ts">
	import AuthorEditor from '#lib/components/author/AuthorEditor.svelte';
	import { m } from '#lib/paraglide/messages.js';
</script>

<svelte:head>
	<title>{m.author_part_title()}</title>
</svelte:head>

<AuthorEditor mode="part" />
