import type { PartInstance } from '#lib/sketch/types';

export interface PinDef {
	name: string;
	label?: string;
	/** Local position, unrotated, relative to the part anchor. */
	x: number;
	y: number;
	/** Development boards only: the chip GPIO number this header pin reaches. */
	gpio?: number;
}

export interface AttrDef {
	name: string;
	type: 'enum' | 'string' | 'number' | 'bool';
	values?: readonly string[];
	default: string | number | boolean;
}

/**
 * A drawable part. `draw` runs in local part space: the origin is the part
 * anchor, y points down, and one unit is the same world unit the document
 * uses. The caller has already applied pan, zoom and rotation.
 */
export interface PartDef {
	type: string;
	name: string;
	category: string;
	keywords: string[];
	/** Local bounding box, used for hit testing and fitting. */
	width: number;
	height: number;
	pins: PinDef[];
	attrs: AttrDef[];
	/** Attribute whose value picks an `--<value>` art variant, such as an LED colour. */
	artAttr?: string;
	/** Set on development boards: the chip the Litz backend boots for it. */
	chip?: string;
	draw: (ctx: CanvasRenderingContext2D, part: PartInstance, zoom: number) => void;
}

export function pinOf(def: PartDef, name: string): PinDef | undefined {
	return def.pins.find((pin) => pin.name === name);
}
