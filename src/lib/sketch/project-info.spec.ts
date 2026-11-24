import { describe, expect, it } from 'vitest';
import { EMPTY_PROJECT_INFO, normalizeProjectInfo } from './project-info';

describe('project info', () => {
	it('keeps the four text fields and trims them', () => {
		expect(
			normalizeProjectInfo({
				author: '  Ada  ',
				description: '\nBlinker\n',
				version: '1.2.0 ',
				license: 'MIT'
			})
		).toEqual({
			author: 'Ada',
			description: 'Blinker',
			version: '1.2.0',
			license: 'MIT'
		});
	});

	it('fills missing fields with empty strings', () => {
		expect(normalizeProjectInfo({ author: 'Ada' })).toEqual({
			...EMPTY_PROJECT_INFO,
			author: 'Ada'
		});
	});

	it('survives values that are not a project info object', () => {
		expect(normalizeProjectInfo(undefined)).toEqual(EMPTY_PROJECT_INFO);
		expect(normalizeProjectInfo(null)).toEqual(EMPTY_PROJECT_INFO);
		expect(normalizeProjectInfo('MIT')).toEqual(EMPTY_PROJECT_INFO);
	});

	it('drops fields of the wrong type', () => {
		expect(normalizeProjectInfo({ version: 3, license: ['MIT'] })).toEqual(EMPTY_PROJECT_INFO);
	});
});
