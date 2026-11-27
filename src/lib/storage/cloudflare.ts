/**
 * The Cloudflare calls a page cannot make.
 *
 * The REST API answers no preflight, so a browser's request is refused before
 * it leaves. Through the CLI link the request comes from the machine the link
 * runs on, which is why the editor asks for the API token here and sends it
 * nowhere else.
 */

export const CLOUD_API = 'https://api.cloudflare.com/client/v4';

/** What the link reports back: the host's status and its body as text. */
export interface CloudReply {
	status: number;
	body: string;
}

export interface CloudSend {
	(
		method: string,
		url: string,
		init?: { headers?: Record<string, string>; body?: string }
	): Promise<CloudReply>;
}

export class CloudError extends Error {}

/** The first message a failed call carries, or the status when it carries none. */
function failure(status: number, body: string): string {
	try {
		const parsed = JSON.parse(body) as { errors?: { message?: string }[] };
		const message = parsed.errors?.[0]?.message;
		if (message) return message;
	} catch {
		// A proxy or a bad token can answer with HTML; the status is all there is.
	}
	return body.trim().slice(0, 200) || `HTTP ${status}`;
}

/**
 * The two calls that turn an empty account into a bucket this editor can use:
 * make the bucket, then allow the editor's origin to read and write it.
 */
export class Cloudflare {
	#account: string;
	#token: string;
	#send: CloudSend;

	constructor(account: string, token: string, send: CloudSend) {
		this.#account = account.trim();
		this.#token = token.trim();
		this.#send = send;
	}

	get #buckets(): string {
		return `${CLOUD_API}/accounts/${encodeURIComponent(this.#account)}/r2/buckets`;
	}

	get #headers(): Record<string, string> {
		return {
			authorization: `Bearer ${this.#token}`,
			'content-type': 'application/json'
		};
	}

	async createBucket(name: string): Promise<void> {
		const answer = await this.#send('POST', this.#buckets, {
			headers: this.#headers,
			body: JSON.stringify({ name: name.trim() })
		});
		this.#check(answer);
	}

	async setCors(name: string, origin: string): Promise<void> {
		const rules = {
			rules: [
				{
					allowed: {
						origins: [origin],
						methods: ['GET', 'PUT', 'DELETE', 'HEAD'],
						headers: ['*']
					},
					exposeHeaders: ['ETag'],
					maxAgeSeconds: 3600
				}
			]
		};
		const answer = await this.#send('PUT', `${this.#buckets}/${encodeURIComponent(name)}/cors`, {
			headers: this.#headers,
			body: JSON.stringify(rules)
		});
		this.#check(answer);
	}

	/** Cloudflare answers 200 with `success: false` as well as 4xx; both fail. */
	#check(answer: CloudReply): void {
		if (answer.status >= 400) throw new CloudError(failure(answer.status, answer.body));
		let success = true;
		try {
			const parsed = JSON.parse(answer.body) as { success?: boolean };
			if (parsed.success === false) success = false;
		} catch {
			return;
		}
		if (!success) throw new CloudError(failure(answer.status, answer.body));
	}
}
