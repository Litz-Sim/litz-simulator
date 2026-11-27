/**
 * A minimal S3 client for project files, unsigned by nobody but the browser.
 *
 * The editor is a static page with no server of its own, so requests are
 * signed in the page with the keys the user pasted into Settings and sent
 * straight to the bucket. Everything here is path-style against one endpoint,
 * which is what S3-compatible servers (MinIO, R2, Ceph) accept as well.
 */
import { AwsClient } from 'aws4fetch';

export interface S3Settings {
	/** Base URL, without the bucket: `https://s3.us-east-1.amazonaws.com`. */
	endpoint: string;
	region: string;
	bucket: string;
	/** Folder inside the bucket, empty for the root. */
	prefix: string;
	accessKeyId: string;
	secretAccessKey: string;
	/**
	 * A Cloudflare API token, used only to make the bucket from the editor.
	 * Nothing signs with it; it travels through the CLI link, because the
	 * Cloudflare API has no CORS and the browser cannot call it.
	 */
	apiToken?: string;
}

export interface StoredProject {
	key: string;
	/** The key without the configured prefix. */
	name: string;
	size: number;
	/** ISO timestamp from a listing; the link's folder reports milliseconds. */
	modified: string | number;
}

export class S3Error extends Error {}

export const EMPTY_SETTINGS: S3Settings = {
	endpoint: '',
	region: 'us-east-1',
	bucket: '',
	prefix: '',
	accessKeyId: '',
	secretAccessKey: '',
	apiToken: ''
};

export function configured(settings: S3Settings): boolean {
	return Boolean(
		settings.endpoint.trim() &&
		settings.bucket.trim() &&
		settings.accessKeyId.trim() &&
		settings.secretAccessKey.trim()
	);
}

/** The S3 endpoint Cloudflare R2 serves an account at. */
export function r2Endpoint(account: string): string {
	return `https://${account.trim()}.r2.cloudflarestorage.com`;
}

/** The account id inside an R2 endpoint, or null for any other server. */
export function r2Account(endpoint: string): string | null {
	const match = /^https:\/\/([0-9a-f]{32})\.r2\.cloudflarestorage\.com\/?$/i.exec(endpoint.trim());
	return match ? match[1] : null;
}

/** The object name a project is stored under: `Name.litzproject.json`. */
export function projectFile(name: string): string {
	const clean = name
		.trim()
		.replace(/[\\/:*?"<>|]+/g, '-')
		.replace(/\s+/g, ' ');
	if (clean.endsWith('.litzproject.json')) return clean;
	return `${clean || 'untitled'}.litzproject.json`;
}

/**
 * The stem `projectFile` builds: a project's name once it is a file, which is
 * how the link's library names it too.
 */
export function plainName(name: string): string {
	return projectFile(name).slice(0, -'.litzproject.json'.length);
}

/** Join the prefix and a project name into an object key. */
export function objectKey(name: string, prefix: string): string {
	const file = projectFile(name);
	const dir = prefix.replace(/^\/+|\/+$/g, '');
	return dir ? `${dir}/${file}` : file;
}

/** A project's name as the dialog shows it: no prefix, no extension. */
export function projectName(key: string, prefix: string): string {
	const dir = prefix.replace(/^\/+|\/+$/g, '');
	const rest = dir && key.startsWith(`${dir}/`) ? key.slice(dir.length + 1) : key;
	return rest.endsWith('.litzproject.json') ? rest.slice(0, -'.litzproject.json'.length) : rest;
}

function decode(text: string): string {
	return text
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');
}

/**
 * Read a ListObjectsV2 response. The body is a flat document with one
 * `<Contents>` per object, so the fields are taken by tag rather than through
 * a DOM parser, which the node test runner does not have.
 */
export function parseListing(xml: string): {
	items: { key: string; size: number; modified: string }[];
	next: string | null;
} {
	const items: { key: string; size: number; modified: string }[] = [];
	for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
		const block = match[1];
		const key = /<Key>([\s\S]*?)<\/Key>/.exec(block)?.[1];
		if (!key) continue;
		items.push({
			key: decode(key),
			size: Number(/<Size>(\d+)<\/Size>/.exec(block)?.[1] ?? 0),
			modified: decode(/<LastModified>([\s\S]*?)<\/LastModified>/.exec(block)?.[1] ?? '')
		});
	}
	const next = /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1];
	return { items, next: next ? decode(next) : null };
}

/** The `<Message>` an S3 error response carries, for a readable failure. */
export function parseError(xml: string, status: number, statusText: string): string {
	const message = /<Message>([\s\S]*?)<\/Message>/.exec(xml)?.[1];
	const code = /<Code>([\s\S]*?)<\/Code>/.exec(xml)?.[1];
	if (message) return `${decode(code ?? String(status))}: ${decode(message)}`;
	return statusText || `HTTP ${status}`;
}

export class S3Store {
	#client: AwsClient;
	#endpoint: string;
	#bucket: string;
	#prefix: string;

	constructor(settings: S3Settings) {
		const endpoint = settings.endpoint.trim().replace(/\/+$/, '');
		let parsed: URL;
		try {
			parsed = new URL(endpoint);
		} catch {
			throw new S3Error('The endpoint is not a URL.');
		}
		if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
			throw new S3Error('The endpoint must start with http:// or https://.');
		}
		if (!settings.bucket.trim()) throw new S3Error('No bucket is set.');
		if (!settings.accessKeyId.trim() || !settings.secretAccessKey.trim()) {
			throw new S3Error('No access key is set.');
		}
		this.#endpoint = endpoint;
		this.#bucket = settings.bucket.trim();
		this.#prefix = settings.prefix.replace(/^\/+|\/+$/g, '');
		this.#client = new AwsClient({
			accessKeyId: settings.accessKeyId.trim(),
			secretAccessKey: settings.secretAccessKey.trim(),
			service: 's3',
			region: settings.region.trim() || 'us-east-1',
			retries: 2
		});
	}

	/** The absolute URL of one object, path-style under the endpoint. */
	url(key: string, query?: Record<string, string>): URL {
		const path = [this.#bucket, ...key.split('/')]
			.filter((part) => part.length > 0)
			.map(encodeURIComponent)
			.join('/');
		const url = new URL(`${this.#endpoint}/${path}`);
		for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
		return url;
	}

	async #send(
		method: string,
		key: string,
		init: { query?: Record<string, string>; body?: string; contentType?: string } = {}
	): Promise<Response> {
		const headers: Record<string, string> = {};
		if (init.contentType) headers['content-type'] = init.contentType;
		const response = await this.#client.fetch(this.url(key, init.query).toString(), {
			method,
			body: init.body,
			headers
		});
		if (!response.ok) {
			const text = await response.text().catch(() => '');
			throw new S3Error(parseError(text, response.status, response.statusText));
		}
		return response;
	}

	/** Every object under the prefix, newest first. */
	async list(): Promise<StoredProject[]> {
		const items: StoredProject[] = [];
		let token: string | null = null;
		do {
			const query: Record<string, string> = { 'list-type': '2', 'max-keys': '1000' };
			if (this.#prefix) query.prefix = `${this.#prefix}/`;
			if (token) query['continuation-token'] = token;
			const response = await this.#send('GET', '', { query });
			const page = parseListing(await response.text());
			for (const item of page.items) {
				// A folder placeholder is a key ending in `/`, not a project.
				if (item.key.endsWith('/')) continue;
				items.push({ ...item, name: projectName(item.key, this.#prefix) });
			}
			token = page.next;
		} while (token);
		return items.sort((a, b) => String(b.modified).localeCompare(String(a.modified)));
	}

	async text(key: string): Promise<string> {
		const response = await this.#send('GET', key);
		return response.text();
	}

	async put(key: string, body: string): Promise<void> {
		await this.#send('PUT', key, {
			body,
			contentType: 'application/json'
		});
	}

	async remove(key: string): Promise<void> {
		await this.#send('DELETE', key);
	}
}
