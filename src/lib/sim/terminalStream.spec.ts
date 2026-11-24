import { describe, expect, it } from 'vitest';
import { feedDelta, withCarriageReturns } from './terminalStream';

describe('terminal feed', () => {
	it('writes only what a growing console added', () => {
		expect(feedDelta('boot\r\n>>> ', 'boot\r\n>>> print(1)')).toEqual({
			reset: false,
			write: 'print(1)'
		});
	});

	it('writes nothing when the console did not change', () => {
		expect(feedDelta('same', 'same')).toEqual({ reset: false, write: '' });
	});

	it('writes just the new tail after the window rolled forward', () => {
		const previous = `head-${'x'.repeat(39990)}`;
		const next = previous.slice(-39990) + 'fresh output';
		expect(feedDelta(previous, next)).toEqual({ reset: false, write: 'fresh output' });
	});

	it('resets when the next console cannot continue the shown one', () => {
		expect(feedDelta('board a says hi', 'board b says hello').reset).toBe(true);
	});

	it('resets when the console was cleared', () => {
		expect(feedDelta('old text', '')).toEqual({ reset: true, write: '' });
	});

	it('treats a short shared boundary as a different console', () => {
		const previous = `${'a'.repeat(200)}tail`;
		const next = 'tother board';
		expect(feedDelta(previous, next).reset).toBe(true);
	});
});

describe('terminal line feeds', () => {
	it('adds the carriage return a bare line feed is missing', () => {
		expect(withCarriageReturns('one\ntwo', false)).toEqual({ text: 'one\r\ntwo', afterCR: false });
	});

	it('leaves CRLF and lone CR alone', () => {
		expect(withCarriageReturns('one\r\ntwo', false).text).toBe('one\r\ntwo');
		expect(withCarriageReturns('progress\rdone', false).text).toBe('progress\rdone');
	});

	it('remembers a CR split across chunks', () => {
		const first = withCarriageReturns('line\r', false);
		expect(first.afterCR).toBe(true);
		expect(withCarriageReturns('\nnext', first.afterCR).text).toBe('\nnext');
		expect(withCarriageReturns('\nnext', false).text).toBe('\r\nnext');
	});
});
