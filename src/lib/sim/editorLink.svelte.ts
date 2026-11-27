import { m } from '#lib/paraglide/messages.js';
import { doc } from '#lib/sketch/doc.svelte';
import { parseAttach } from './attach';
import { sim } from './controller.svelte';

export type LinkStatus = 'offline' | 'connecting' | 'online';

export interface LinkArtifact {
	name: string;
	sha256: string;
	size: number;
	board: string | null;
}

interface Hello {
	type: 'hello';
	version: string;
	project: string;
	library: string;
	boards: string[];
}

/** The attach URL this browser last used, so a public editor reattaches itself. */
const LINK_KEY = 'litz.link.v1';

/** One project in the link's library, as the daemon lists it. */
export interface LinkProject {
	key: string;
	name: string;
	size: number;
	modified: number;
}

/** The answer to a request the linked machine made on the page's behalf. */
export interface LinkReply {
	status: number;
	headers: Record<string, string>;
	/** The host's bytes as text, or base64 when they were not UTF-8. */
	body: string;
	base64: boolean;
}

interface Pending {
	resolve: (value: Record<string, unknown>) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
}

/**
 * The editor's half of `litz connect-editor`.
 *
 * The socket carries commands and build output; the image itself is fetched
 * from the same loopback port by its content hash, which keeps a 2 MB image
 * out of a JSON message and lets the browser cache it.
 */
function text(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

class EditorLink {
	status = $state<LinkStatus>('offline');
	error = $state<string | null>(null);
	project = $state<string | null>(null);
	version = $state<string | null>(null);
	/** Where the daemon keeps the projects the page saves, for the dialog to show. */
	library = $state<string | null>(null);
	boards = $state<string[]>([]);
	building = $state(false);
	/** The recipe's transcript, newest last, capped so a long build cannot grow the tab. */
	log = $state('');
	last = $state<LinkArtifact | null>(null);

	#socket: WebSocket | null = null;
	#url = '';
	#token = '';
	#wanted = false;
	#attempts = 0;
	#beat: ReturnType<typeof setInterval> | null = null;
	#retry: ReturnType<typeof setTimeout> | null = null;
	#seq = 0;
	#pending = new Map<number, Pending>();

	connect(attach: string): boolean {
		const parsed = parseAttach(attach);
		if (!parsed) {
			this.error = m.link_bad_url();
			return false;
		}
		this.#wanted = true;
		this.#url = parsed.url;
		this.#token = parsed.token;
		this.error = null;
		this.#attempts = 0;
		this.#remember(attach);
		this.#open();
		return true;
	}

	/**
	 * Reattach to the link this browser used last. A public editor keeps the
	 * code in its own storage, the way it keeps bucket keys, so a reload or a
	 * next day does not mean pasting the URL again.
	 */
	restore(): boolean {
		const attach = this.#stored();
		return attach ? this.connect(attach) : false;
	}

	disconnect(): void {
		this.#wanted = false;
		this.#forgetStored();
		this.#forget();
		this.#close();
		this.status = 'offline';
		this.building = false;
	}

	build(board?: string): void {
		if (this.status !== 'online' || this.building) return;
		this.log = '';
		this.#send({ type: 'build', board: board || null });
	}

	/** The projects in the daemon's library, newest first. */
	async projects(): Promise<LinkProject[]> {
		const answer = await this.#request('projects.list');
		return Array.isArray(answer.items) ? (answer.items as LinkProject[]) : [];
	}

	/** One project's text, ready for `doc.loadProject`. */
	async readProject(key: string): Promise<string> {
		const answer = await this.#request('project.read', { name: key });
		return text(answer.text);
	}

	async writeProject(key: string, body: string): Promise<void> {
		await this.#request('project.write', { name: key, text: body });
	}

	async removeProject(key: string): Promise<void> {
		await this.#request('project.remove', { name: key });
	}

	/**
	 * Make an HTTP request from the machine the link runs on. A browser may not
	 * call a host that sends no CORS headers, and may not set every header a
	 * host wants; the link has neither limit, so an API the page is locked out
	 * of is reachable through it.
	 */
	async request(
		method: string,
		url: string,
		init: { headers?: Record<string, string>; body?: string } = {}
	): Promise<LinkReply> {
		const answer = await this.#request(
			'http.request',
			{ method, url, headers: init.headers ?? {}, body: init.body },
			35_000
		);
		if (answer.type === 'http.failed') {
			throw new Error(text(answer.error) || m.link_forward_failed());
		}
		if (typeof answer.status !== 'number') throw new Error(m.link_forward_failed());
		return {
			status: answer.status,
			headers: (answer.headers as Record<string, string>) ?? {},
			body: text(answer.body),
			base64: answer.encoding === 'base64'
		};
	}

	#open(): void {
		this.#close();
		this.status = 'connecting';
		// The code rides in the subprotocol, not the query: a proxy in front of a
		// remote link logs request lines, and this one is the only credential.
		const socket = new WebSocket(this.#url, ['litz', this.#token]);
		this.#socket = socket;
		socket.onopen = () => {
			this.status = 'online';
			this.#attempts = 0;
			this.error = null;
			this.#startHeartbeat();
		};
		socket.onmessage = (event: MessageEvent) => {
			if (typeof event.data === 'string') this.#receive(event.data);
		};
		socket.onerror = () => {
			if (this.#socket === socket) this.error = m.link_unreachable();
		};
		socket.onclose = () => {
			if (this.#socket !== socket) return;
			this.#socket = null;
			this.status = 'offline';
			this.building = false;
			this.#stopHeartbeat();
			this.#rejectAll(m.link_unreachable());
			this.#scheduleRetry();
		};
	}

	#close(): void {
		this.#stopHeartbeat();
		if (this.#retry) {
			clearTimeout(this.#retry);
			this.#retry = null;
		}
		const socket = this.#socket;
		this.#socket = null;
		socket?.close();
	}

	#forget(): void {
		this.project = null;
		this.version = null;
		this.library = null;
		this.boards = [];
		this.log = '';
		this.last = null;
	}

	#scheduleRetry(): void {
		if (!this.#wanted || this.#retry) return;
		const delay = Math.min(30_000, 1000 * 2 ** Math.min(this.#attempts, 5));
		this.#attempts += 1;
		this.#retry = setTimeout(() => {
			this.#retry = null;
			if (this.#wanted) this.#open();
		}, delay);
	}

	#startHeartbeat(): void {
		this.#stopHeartbeat();
		this.#beat = setInterval(() => this.#send({ type: 'ping' }), 20_000);
	}

	#stopHeartbeat(): void {
		if (this.#beat) {
			clearInterval(this.#beat);
			this.#beat = null;
		}
	}

	#send(message: unknown): void {
		if (this.#socket?.readyState !== WebSocket.OPEN) return;
		this.#socket.send(JSON.stringify(message));
	}

	#remember(attach: string): void {
		try {
			localStorage.setItem(LINK_KEY, attach);
		} catch {
			// A full quota costs the memory, not the session.
		}
	}

	#stored(): string {
		if (typeof localStorage === 'undefined') return '';
		try {
			return localStorage.getItem(LINK_KEY) ?? '';
		} catch {
			return '';
		}
	}

	#forgetStored(): void {
		try {
			localStorage.removeItem(LINK_KEY);
		} catch {
			// Nothing to do: the next connect writes it again.
		}
	}

	/**
	 * Send a request and wait for the reply that carries its id. A failure
	 * rejects this promise instead of landing in the strip's error, so a save
	 * that could not happen cannot read as a build that failed.
	 */
	#request(
		type: string,
		body: Record<string, unknown> = {},
		patience = 15_000
	): Promise<Record<string, unknown>> {
		const socket = this.#socket;
		if (this.status !== 'online' || socket?.readyState !== WebSocket.OPEN) {
			return Promise.reject(new Error(m.link_unreachable()));
		}
		this.#seq += 1;
		const id = this.#seq;
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.#pending.delete(id);
				reject(new Error(m.link_timeout()));
			}, patience);
			this.#pending.set(id, { resolve, reject, timer });
			socket.send(JSON.stringify({ ...body, type, id }));
		});
	}

	#settle(id: number, message: Record<string, unknown>): void {
		const pending = this.#pending.get(id);
		if (!pending) return;
		this.#pending.delete(id);
		clearTimeout(pending.timer);
		if (message.type === 'error') pending.reject(new Error(text(message.message)));
		else pending.resolve(message);
	}

	#rejectAll(reason: string): void {
		for (const pending of this.#pending.values()) {
			clearTimeout(pending.timer);
			pending.reject(new Error(reason));
		}
		this.#pending.clear();
	}

	#receive(raw: string): void {
		let message: Record<string, unknown>;
		try {
			message = JSON.parse(raw) as Record<string, unknown>;
		} catch {
			return;
		}
		// A reply to a request is matched by id and goes no further.
		if (typeof message.id === 'number') {
			this.#settle(message.id, message);
			return;
		}
		switch (message.type) {
			case 'hello': {
				const hello = message as unknown as Hello;
				this.project = hello.project ?? null;
				this.version = hello.version ?? null;
				this.library = hello.library ?? null;
				this.boards = Array.isArray(hello.boards) ? hello.boards : [];
				break;
			}
			case 'build.started':
				this.building = true;
				this.log = '';
				break;
			case 'log':
				this.log = (this.log + text(message.chunk)).slice(-20_000);
				break;
			case 'build.failed':
				this.building = false;
				this.error = text(message.message) || m.link_build_failed();
				break;
			case 'artifact':
				this.building = false;
				void this.#install(message as unknown as LinkArtifact);
				break;
			case 'error':
				this.error = text(message.message);
				break;
			default:
				break;
		}
	}

	/** Fetch the image by hash and boot it on the board it names. */
	async #install(artifact: LinkArtifact): Promise<void> {
		this.last = artifact;
		// ws:// -> http://, wss:// -> https://; the artifact route sits on the
		// same port as the socket.
		const base = this.#url.replace(/^ws/, 'http').replace(/\/ws$/, '');
		const url = `${base}/artifact/${artifact.sha256}`;
		try {
			const response = await fetch(url, {
				cache: 'no-store',
				headers: { authorization: `Bearer ${this.#token}` }
			});
			if (!response.ok) throw new Error(String(response.status));
			const bytes = await response.arrayBuffer();
			// Boot it on the board the project names when this document has one
			// by that id; otherwise the selected board.
			const board =
				artifact.board && doc.sketch.boards.some((entry) => entry.id === artifact.board)
					? artifact.board
					: undefined;
			const file = new File([bytes], artifact.name, { type: 'application/octet-stream' });
			await sim.loadFirmware(file, board);
			this.error = null;
		} catch (failure) {
			this.error = failure instanceof Error ? failure.message : String(failure);
		}
	}
}

export const link = new EditorLink();
