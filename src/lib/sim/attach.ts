/**
 * Read the attach URL `litz connect-editor` prints.
 *
 * The pairing code travels in the fragment, which browsers do not send to a
 * server, so a pasted URL is also safe to keep in a chat log. A bare
 * `http://127.0.0.1:4317` is accepted too: the editor turns it into the
 * `/ws` route and the caller supplies the code separately.
 *
 * Older builds print the address and the code on two lines, so the code is
 * also read from anywhere in the pasted text.
 */
export function parseAttach(text: string): { url: string; token: string } | null {
	const address = /(?:wss?|https?):\/\/[^\s#]+/i.exec(text)?.[0];
	if (!address) return null;
	let url = address;
	if (url.startsWith('https://')) url = `wss://${url.slice('https://'.length)}`;
	else if (url.startsWith('http://')) url = `ws://${url.slice('http://'.length)}`;
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return null;
	}
	const rest = text.slice(text.indexOf(address) + address.length);
	const token =
		/#([^\s#]+)/.exec(rest)?.[1] ??
		/(?:^|[\s:])([0-9a-f]{4}(?:-[0-9a-f]{4}){3})(?=\s|$)/i.exec(text)?.[1] ??
		parsed.searchParams.get('token') ??
		'';
	if (!token) return null;
	if (!parsed.pathname || parsed.pathname === '/') parsed.pathname = '/ws';
	parsed.search = '';
	return { url: parsed.toString(), token };
}
