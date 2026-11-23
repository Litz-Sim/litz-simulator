/**
 * Image upload handling for the author pages. Bytes go into the package; the
 * object URL is only kept for on-screen previews.
 */

import { imageType } from '#lib/parts/packages';
import type { ArtDraft } from './manifest';

export interface UploadedImage {
	path: string;
	fileName: string;
	bytes: Uint8Array;
	url: string;
	element: HTMLImageElement;
	loaded: boolean;
}

export type ImageMap = Record<string, UploadedImage>;

const EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'svg']);

let sequence = 0;

function extension(fileName: string): string {
	return fileName.split('.').pop()?.toLowerCase() ?? '';
}

export function isImageFile(file: File): boolean {
	return EXTENSIONS.has(extension(file.name));
}

function safeFileName(fileName: string): string {
	const base = (fileName.split(/[\\/]/).pop() ?? 'image').replace(/[^A-Za-z0-9._-]+/g, '-');
	return base.replace(/^-+/, '') || `image.${extension(fileName) || 'png'}`;
}

/** Decode a picker file into bytes plus an element still waiting for `src`. */
export async function readImage(file: File): Promise<UploadedImage | null> {
	if (!isImageFile(file)) return null;
	const bytes = new Uint8Array(await file.arrayBuffer());
	const url = URL.createObjectURL(new Blob([bytes], { type: imageType(file.name) }));
	sequence += 1;
	return {
		path: `images/${sequence}-${safeFileName(file.name)}`,
		fileName: file.name,
		bytes,
		url,
		element: new Image(),
		loaded: false
	};
}

/** Put a newly uploaded image into the reactive map and start decoding it. */
export function adoptImage(images: ImageMap, image: UploadedImage): void {
	images[image.path] = image;
	const entry = images[image.path];
	entry.element.onload = () => {
		entry.loaded = true;
	};
	entry.element.src = entry.url;
}

/** Drop an image and its object URL once no art slot points at it any more. */
export function releaseImage(images: ImageMap, path: string | null): void {
	if (!path) return;
	const entry = images[path];
	if (!entry) return;
	URL.revokeObjectURL(entry.url);
	delete images[path];
}

export function referencedPaths(art: ArtDraft): string[] {
	const paths = new Set<string>();
	if (art.default) paths.add(art.default);
	for (const path of Object.values(art.states)) if (path) paths.add(path);
	for (const rule of art.pins) if (rule.path) paths.add(rule.path);
	return [...paths];
}
