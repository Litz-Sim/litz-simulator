import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { doc } from '#lib/sketch/doc.svelte';
import { projects } from './projects.svelte';

/** A bucket with just enough behaviour for the store: list, get, put, delete. */
function bucket(): { server: Server; objects: Map<string, string> } {
	const objects = new Map<string, string>();
	const server = createServer((request, response) => {
		const chunks: Buffer[] = [];
		request.on('data', (chunk: Buffer) => chunks.push(chunk));
		request.on('end', () => {
			const url = new URL(request.url ?? '/', 'http://localhost');
			const key = decodeURIComponent(url.pathname.replace(/^\/bucket\/?/, ''));
			if (request.method === 'PUT') {
				objects.set(key, Buffer.concat(chunks).toString());
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
	return { server, objects };
}

describe('projects store', () => {
	const { server, objects } = bucket();
	let endpoint = '';

	beforeAll(async () => {
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		const address = server.address();
		const port = typeof address === 'object' && address ? address.port : 0;
		endpoint = `http://127.0.0.1:${port}`;
		projects.setProvider('s3');
		projects.saveSettings({
			endpoint,
			region: 'us-east-1',
			bucket: 'bucket',
			prefix: 'litz',
			accessKeyId: 'AKIAEXAMPLE',
			secretAccessKey: 'secret'
		});
	});

	afterAll(async () => {
		await new Promise<void>((resolve) => server.close(() => resolve()));
	});

	it('saves, updates, lists and opens a project', async () => {
		doc.renameTab('Round trip');
		expect(await projects.save('Round trip')).toBe(true);
		expect(projects.key).toBe('litz/Round trip.litzproject.json');
		expect(projects.sync).toBe('saved');
		expect(objects.get(projects.key ?? '')).toContain('"litz-project"');

		doc.renameTab('Renamed');
		await projects.flush();
		expect(projects.key).toBe('litz/Round trip.litzproject.json');
		expect(objects.get(projects.key ?? '')).toContain('"Renamed"');

		await projects.refresh();
		expect(projects.items.map((item) => item.name)).toContain('Round trip');

		doc.renameTab('Something else');
		const item = projects.items.find((entry) => entry.key === projects.key);
		expect(item).toBeDefined();
		expect(await projects.open(item!)).toBe(true);
		expect(doc.name).toBe('Renamed');
	});

	it('reports a file that is not a project', async () => {
		objects.set('litz/broken.litzproject.json', '{"format":"something-else"}');
		await projects.refresh();
		const item = projects.items.find((entry) => entry.name === 'broken');
		expect(item).toBeDefined();
		expect(await projects.open(item!)).toBe(false);
		expect(projects.error).toBeTruthy();
	});

	it('deletes an object and detaches it', async () => {
		const key = projects.key;
		const item = projects.items.find((entry) => entry.key === key);
		expect(item).toBeDefined();
		await projects.remove(item!);
		expect(objects.has(key ?? '')).toBe(false);
		expect(projects.key).toBeNull();
		expect(projects.sync).toBe('idle');
	});
});
