import { redirect } from '@sveltejs/kit';

export function load(): void {
	// A link prints one URL with its pairing code in the fragment, and that
	// URL is the site root: carry the code through to the editor, which
	// attaches and then drops it.
	const hash = typeof location === 'undefined' ? '' : location.hash;
	redirect(307, `/editor${hash}`);
}
