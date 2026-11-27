import { describe, expect, it } from 'vitest';
import { CloudError, Cloudflare, type CloudReply } from './cloudflare';

interface Call {
	method: string;
	url: string;
	headers?: Record<string, string>;
	body?: string;
}

function recorder(answer: CloudReply = { status: 200, body: '{"success":true}' }) {
	const calls: Call[] = [];
	const send = (
		method: string,
		url: string,
		init?: { headers?: Record<string, string>; body?: string }
	): Promise<CloudReply> => {
		calls.push({ method, url, ...init });
		return Promise.resolve(answer);
	};
	return { calls, send };
}

describe('Cloudflare through the link', () => {
	it('creates the bucket under the account the endpoint names', async () => {
		const { calls, send } = recorder();
		const cloud = new Cloudflare('0123456789abcdef0123456789abcdef', 'secret', send);
		await cloud.createBucket(' litz-projects ');
		expect(calls).toHaveLength(1);
		expect(calls[0].method).toBe('POST');
		expect(calls[0].url).toBe(
			'https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/r2/buckets'
		);
		expect(calls[0].headers?.authorization).toBe('Bearer secret');
		expect(JSON.parse(calls[0].body ?? '')).toEqual({ name: 'litz-projects' });
	});

	it('allows exactly the editor origin to read and write the bucket', async () => {
		const { calls, send } = recorder();
		const cloud = new Cloudflare('acct', 'secret', send);
		await cloud.setCors('litz-projects', 'https://editor.example.com');
		expect(calls[0].method).toBe('PUT');
		expect(calls[0].url).toBe(
			'https://api.cloudflare.com/client/v4/accounts/acct/r2/buckets/litz-projects/cors'
		);
		const body = JSON.parse(calls[0].body ?? '') as {
			rules: { allowed: { origins: string[]; methods: string[] } }[];
		};
		expect(body.rules[0].allowed.origins).toEqual(['https://editor.example.com']);
		expect(body.rules[0].allowed.methods).toContain('PUT');
	});

	it('reports what Cloudflare said, not just the status', async () => {
		const { send } = recorder({
			status: 400,
			body: JSON.stringify({ success: false, errors: [{ message: 'bucket name is invalid' }] })
		});
		const cloud = new Cloudflare('acct', 'secret', send);
		await expect(cloud.createBucket('Bad Name')).rejects.toThrow('bucket name is invalid');
	});

	it('treats a 200 that says success false as a failure', async () => {
		const { send } = recorder({
			status: 200,
			body: JSON.stringify({ success: false, errors: [{ message: 'token lacks R2 write' }] })
		});
		const cloud = new Cloudflare('acct', 'secret', send);
		await expect(cloud.createBucket('ok')).rejects.toBeInstanceOf(CloudError);
	});

	it('falls back to the status when the body is not JSON', async () => {
		const { send } = recorder({ status: 403, body: '<html>forbidden</html>' });
		const cloud = new Cloudflare('acct', 'secret', send);
		await expect(cloud.createBucket('ok')).rejects.toThrow('forbidden');
	});
});
