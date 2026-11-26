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
	boards: string[];
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
		this.#open();
		return true;
	}

	disconnect(): void {
		this.#wanted = false;
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

	#open(): void {
		this.#close();
		this.status = 'connecting';
		const socket = new WebSocket(`${this.#url}?token=${encodeURIComponent(this.#token)}`);
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

	#receive(raw: string): void {
		let message: Record<string, unknown>;
		try {
			message = JSON.parse(raw) as Record<string, unknown>;
		} catch {
			return;
		}
		switch (message.type) {
			case 'hello': {
				const hello = message as unknown as Hello;
				this.project = hello.project ?? null;
				this.version = hello.version ?? null;
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
		const url = `${base}/artifact/${artifact.sha256}?token=${encodeURIComponent(this.#token)}`;
		try {
			const response = await fetch(url, { cache: 'no-store' });
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
