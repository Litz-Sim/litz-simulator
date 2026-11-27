import { createServer } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	objectKey,
	parseError,
	parseListing,
	projectFile,
	projectName,
	r2Account,
	r2Endpoint,
	S3Error,
	S3Store,
	type S3Settings
} from './s3';

const SETTINGS: S3Settings = {
	endpoint: 'https://s3.us-east-1.amazonaws.com',
	region: 'us-east-1',
	bucket: 'litz-projects',
	prefix: 'team/demo',
	accessKeyId: 'AKIAEXAMPLE',
	secretAccessKey: 'secret'
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('project keys', () => {
	it('names an object after the project, once', () => {
		expect(projectFile('Blinky')).toBe('Blinky.litzproject.json');
		expect(projectFile('Blinky.litzproject.json')).toBe('Blinky.litzproject.json');
		expect(projectFile('a/b:c')).toBe('a-b-c.litzproject.json');
		expect(projectFile('  ')).toBe('untitled.litzproject.json');
	});

	it('joins the prefix and trims it on the way out', () => {
		expect(objectKey('Blinky', 'team/demo')).toBe('team/demo/Blinky.litzproject.json');
		expect(objectKey('Blinky', '/team/demo/')).toBe('team/demo/Blinky.litzproject.json');
		expect(objectKey('Blinky', '')).toBe('Blinky.litzproject.json');
		expect(projectName('team/demo/Blinky.litzproject.json', 'team/demo')).toBe('Blinky');
		expect(projectName('Blinky.litzproject.json', '')).toBe('Blinky');
	});
});

describe('R2', () => {
	it('turns an account id into an endpoint and back', () => {
		const id = '0123456789abcdef0123456789abcdef';
		expect(r2Endpoint(id)).toBe(`https://${id}.r2.cloudflarestorage.com`);
		expect(r2Endpoint(` ${id} `)).toBe(`https://${id}.r2.cloudflarestorage.com`);
		expect(r2Account(r2Endpoint(id))).toBe(id);
		expect(r2Account('https://s3.us-east-1.amazonaws.com')).toBeNull();
		expect(r2Account('https://example.com')).toBeNull();
	});
});

describe('parseListing', () => {
	it('reads keys, sizes, timestamps and the continuation token', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <IsTruncated>true</IsTruncated>
  <Contents>
    <Key>team/demo/A &amp; B.litzproject.json</Key>
    <LastModified>2026-11-20T10:00:00.000Z</LastModified>
    <Size>2048</Size>
  </Contents>
  <Contents>
    <Key>team/demo/folder/</Key>
    <LastModified>2026-11-19T10:00:00.000Z</LastModified>
    <Size>0</Size>
  </Contents>
  <NextContinuationToken>abc+/=</NextContinuationToken>
</ListBucketResult>`;
		const page = parseListing(xml);
		expect(page.items).toEqual([
			{ key: 'team/demo/A & B.litzproject.json', size: 2048, modified: '2026-11-20T10:00:00.000Z' },
			{ key: 'team/demo/folder/', size: 0, modified: '2026-11-19T10:00:00.000Z' }
		]);
		expect(page.next).toBe('abc+/=');
	});

	it('has no token when the listing is complete', () => {
		expect(
			parseListing('<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>')
		).toEqual({ items: [], next: null });
	});
});

describe('parseError', () => {
	it('reads the code and message S3 sends', () => {
		expect(
			parseError(
				'<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>',
				403,
				'Forbidden'
			)
		).toBe('AccessDenied: Access Denied');
	});

	it('falls back to the status text', () => {
		expect(parseError('', 500, 'Internal Server Error')).toBe('Internal Server Error');
	});
});

describe('S3Store', () => {
	it('builds path-style URLs and encodes each segment', () => {
		const store = new S3Store(SETTINGS);
		expect(store.url('team/demo/A & B.litzproject.json').toString()).toBe(
			'https://s3.us-east-1.amazonaws.com/litz-projects/team/demo/A%20%26%20B.litzproject.json'
		);
	});

	it('refuses settings it cannot sign with', () => {
		expect(() => new S3Store({ ...SETTINGS, endpoint: 'ftp://x' })).toThrow(S3Error);
		expect(() => new S3Store({ ...SETTINGS, bucket: '' })).toThrow(S3Error);
		expect(() => new S3Store({ ...SETTINGS, secretAccessKey: '' })).toThrow(S3Error);
	});

	it('lists under the prefix with a signed request', async () => {
		const requests: Request[] = [];
		vi.stubGlobal('fetch', (request: Request) => {
			requests.push(request);
			return Promise.resolve(
				new Response(
					'<ListBucketResult><Contents><Key>team/demo/B.litzproject.json</Key>' +
						'<LastModified>2026-11-21T00:00:00.000Z</LastModified><Size>12</Size></Contents>' +
						'</ListBucketResult>'
				)
			);
		});
		const items = await new S3Store(SETTINGS).list();
		expect(items).toEqual([
			{
				key: 'team/demo/B.litzproject.json',
				name: 'B',
				size: 12,
				modified: '2026-11-21T00:00:00.000Z'
			}
		]);
		const url = new URL(requests[0].url);
		expect(requests[0].method).toBe('GET');
		expect(url.pathname).toBe('/litz-projects');
		expect(url.searchParams.get('prefix')).toBe('team/demo/');
		expect(url.searchParams.get('list-type')).toBe('2');
		expect(requests[0].headers.get('authorization')).toContain('AWS4-HMAC-SHA256');
	});

	it('puts a project as JSON and deletes by key', async () => {
		const requests: Request[] = [];
		vi.stubGlobal('fetch', (request: Request) => {
			requests.push(request);
			return Promise.resolve(new Response(''));
		});
		const store = new S3Store(SETTINGS);
		await store.put('team/demo/B.litzproject.json', '{"format":"litz-project"}');
		await store.remove('team/demo/B.litzproject.json');
		expect(requests.map((request) => request.method)).toEqual(['PUT', 'DELETE']);
		expect(new URL(requests[0].url).pathname).toBe('/litz-projects/team/demo/B.litzproject.json');
		expect(requests[0].headers.get('content-type')).toBe('application/json');
		expect(await requests[0].text()).toBe('{"format":"litz-project"}');
	});

	it('surfaces the refusal a bucket gives', async () => {
		vi.stubGlobal('fetch', () =>
			Promise.resolve(
				new Response('<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>', {
					status: 403,
					statusText: 'Forbidden'
				})
			)
		);
		await expect(new S3Store(SETTINGS).list()).rejects.toThrow('AccessDenied: Access Denied');
	});

	it('talks to a real HTTP server end to end', async () => {
		const objects = new Map<string, string>();
		const seen: { method: string; path: string; auth: string; hash: string }[] = [];
		const server = createServer((request, response) => {
			const chunks: Buffer[] = [];
			request.on('data', (chunk: Buffer) => chunks.push(chunk));
			request.on('end', () => {
				const body = Buffer.concat(chunks).toString();
				const url = new URL(request.url ?? '/', 'http://localhost');
				const key = decodeURIComponent(url.pathname.replace(/^\/litz-projects\/?/, ''));
				seen.push({
					method: request.method ?? '',
					path: url.pathname,
					auth: String(request.headers.authorization ?? ''),
					hash: String(request.headers['x-amz-content-sha256'] ?? '')
				});
				if (request.method === 'PUT') {
					objects.set(key, body);
					response.end();
					return;
				}
				if (request.method === 'DELETE') {
					objects.delete(key);
					response.end();
					return;
				}
				if (key) {
					response.end(objects.get(key) ?? '');
					return;
				}
				const prefix = url.searchParams.get('prefix') ?? '';
				const contents = [...objects]
					.filter(([name]) => name.startsWith(prefix))
					.map(
						([name, text]) =>
							`<Contents><Key>${name}</Key><LastModified>2026-11-22T00:00:00.000Z</LastModified><Size>${text.length}</Size></Contents>`
					)
					.join('');
				response.end(`<ListBucketResult>${contents}</ListBucketResult>`);
			});
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		const address = server.address();
		const port = typeof address === 'object' && address ? address.port : 0;

		try {
			const store = new S3Store({ ...SETTINGS, endpoint: `http://127.0.0.1:${port}` });
			await store.put('team/demo/A.litzproject.json', '{"format":"litz-project"}');
			expect(await store.text('team/demo/A.litzproject.json')).toBe('{"format":"litz-project"}');
			const items = await store.list();
			expect(items.map((item) => item.name)).toEqual(['A']);
			await store.remove('team/demo/A.litzproject.json');
			expect(await store.list()).toEqual([]);

			// The signature names the service, the region and the payload.
			const put = seen.find((entry) => entry.method === 'PUT');
			expect(put?.auth).toContain('/us-east-1/s3/aws4_request');
			// aws4fetch signs S3 requests with an unsigned payload: TLS carries
			// the body, and the headers still bind the request.
			expect(put?.hash).toBe('UNSIGNED-PAYLOAD');
			expect(seen.map((entry) => entry.method)).toEqual(['PUT', 'GET', 'GET', 'DELETE', 'GET']);
		} finally {
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	});
});
