import type { ProjectInfo } from './types';

export const EMPTY_PROJECT_INFO: ProjectInfo = {
	author: '',
	description: '',
	version: '',
	license: ''
};

/** Accepts anything a project file may carry; every field ends up a trimmed string. */
export function normalizeProjectInfo(raw: unknown): ProjectInfo {
	const source =
		typeof raw === 'object' && raw ? (raw as Partial<Record<keyof ProjectInfo, unknown>>) : {};
	const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
	return {
		author: text(source.author),
		description: text(source.description),
		version: text(source.version),
		license: text(source.license)
	};
}
