import { panelFrame, drawPanelFrame, shade } from './art';
import { livePart } from '#lib/sim/live';
import type { PartInstance } from '#lib/sketch/types';
import type { PartDef } from './types';

/**
 * Dynamic layers an SVG asset can host.
 *
 * The asset draws the shell and declares where its live content goes with a
 * marker element; this module paints only that content. Geometry lives in the
 * SVG, so an asset can be redrawn without touching code:
 *
 *   <rect data-overlay="panel" x y width height />     framebuffer, letterboxed
 *   <rect data-overlay="segments" x y width height />  one seven-segment digit,
 *     optional data-mask (bits 0-6 = a-g, 7 = decimal point) for a digit the
 *     engine never updates
 *   <circle data-overlay="knob" cx cy r />             wiper slot, 270°
 *   <rect data-overlay="slider" x y width height />    travel range, knob on top
 *   <circle data-overlay="cap" cx cy r />              button cap, tinted by
 *     the part's `color` attribute
 */
export type Overlay =
	| {
			kind: 'panel' | 'segments' | 'slider';
			x: number;
			y: number;
			w: number;
			h: number;
			mask: number;
	  }
	| { kind: 'knob' | 'cap'; cx: number; cy: number; r: number };

const TAG = /<(?:rect|circle)\b[^>]*\bdata-overlay="([a-z]+)"[^>]*>/g;
const ATTR = /\b(x|y|width|height|cx|cy|r|data-mask)="([-\d.]+)"/g;

function attrs(tag: string): Record<string, number> {
	const out: Record<string, number> = {};
	for (const match of tag.matchAll(ATTR)) out[match[1]] = Number(match[2]);
	return out;
}

/** Overlay markers in an asset, in document order. Unknown or malformed ones are skipped. */
export function parseOverlays(text: string): Overlay[] {
	const overlays: Overlay[] = [];
	for (const match of text.matchAll(TAG)) {
		const kind = match[1];
		const values = attrs(match[0]);
		if (kind === 'knob' || kind === 'cap') {
			const { cx, cy, r } = values;
			if ([cx, cy, r].every(Number.isFinite) && r > 0) overlays.push({ kind, cx, cy, r });
		} else if (kind === 'panel' || kind === 'segments' || kind === 'slider') {
			const { x, y, width, height } = values;
			if ([x, y, width, height].every(Number.isFinite) && width > 0 && height > 0) {
				const mask = Number.isFinite(values['data-mask']) ? values['data-mask'] & 0xff : 0xff;
				overlays.push({ kind, x, y, w: width, h: height, mask });
			}
		}
	}
	return overlays;
}

const SEGMENT_COLORS: Record<string, string> = {
	red: '#e0503f',
	green: '#3fb862',
	blue: '#3d7ef0',
	yellow: '#f0c62a'
};

/** Button caps share the wire palette, so a red cap matches a red wire. */
const CAP_COLORS: Record<string, string> = {
	green: '#3fb862',
	blue: '#3d7ef0',
	red: '#e0503f',
	yellow: '#f0c62a',
	white: '#e8e6df',
	black: '#2b2f32'
};

function percentOf(part: PartInstance, fallback = 50): number {
	const live = livePart(part.id);
	if (live) return live.value / 10;
	const value = Number(part.attrs.value ?? fallback);
	return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : fallback;
}

/** One seven-segment digit; least significant bit is `a`. */
function digit(
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	w: number,
	h: number,
	mask: number,
	color: string
): void {
	const t = Math.max(2.4, w * 0.16);
	const hw = w / 2;
	const hh = h / 2;
	ctx.save();
	ctx.lineCap = 'round';
	ctx.lineWidth = t;
	const seg = (x1: number, y1: number, x2: number, y2: number, bit: number) => {
		ctx.strokeStyle = (mask & (1 << bit)) !== 0 ? color : 'rgba(255, 255, 255, 0.07)';
		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.stroke();
	};
	seg(cx - hw + t, cy - hh, cx + hw - t, cy - hh, 0);
	seg(cx + hw, cy - hh + t, cx + hw, cy - t, 1);
	seg(cx + hw, cy + t, cx + hw, cy + hh - t, 2);
	seg(cx - hw + t, cy + hh, cx + hw - t, cy + hh, 3);
	seg(cx - hw, cy + t, cx - hw, cy + hh - t, 4);
	seg(cx - hw, cy - hh + t, cx - hw, cy - t, 5);
	seg(cx - hw + t, cy, cx + hw - t, cy, 6);
	if ((mask & (1 << 7)) !== 0) {
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.arc(cx + hw + t * 0.6, cy + hh - t, t * 0.6, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}

/** Paint the live layer of a part on top of its SVG shell. */
export function drawOverlay(
	ctx: CanvasRenderingContext2D,
	part: PartInstance,
	def: PartDef,
	overlay: Overlay
): void {
	ctx.save();
	switch (overlay.kind) {
		case 'panel': {
			const frame = panelFrame(part);
			if (frame) drawPanelFrame(ctx, part.id, frame, overlay.x, overlay.y, overlay.w, overlay.h);
			break;
		}
		case 'segments': {
			const live = livePart(part.id);
			const mask = live && live.state === 'mask' ? live.value & 0xff : overlay.mask;
			const color = SEGMENT_COLORS[String(part.attrs.color ?? 'red')] ?? SEGMENT_COLORS.red;
			digit(
				ctx,
				overlay.x + overlay.w / 2,
				overlay.y + overlay.h / 2,
				overlay.w,
				overlay.h,
				mask,
				color
			);
			break;
		}
		case 'cap': {
			const color = CAP_COLORS[String(part.attrs.color ?? 'green')] ?? CAP_COLORS.green;
			const fill = ctx.createRadialGradient(
				overlay.cx - overlay.r * 0.3,
				overlay.cy - overlay.r * 0.4,
				overlay.r * 0.1,
				overlay.cx,
				overlay.cy,
				overlay.r * 1.4
			);
			fill.addColorStop(0, shade(color, 0.35));
			fill.addColorStop(1, shade(color, -0.25));
			ctx.fillStyle = fill;
			ctx.strokeStyle = shade(color, -0.45);
			ctx.lineWidth = Math.max(1, overlay.r * 0.12);
			ctx.beginPath();
			ctx.arc(overlay.cx, overlay.cy, overlay.r, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();

			ctx.globalAlpha = 0.38;
			ctx.fillStyle = '#ffffff';
			ctx.beginPath();
			ctx.ellipse(
				overlay.cx - overlay.r * 0.31,
				overlay.cy - overlay.r * 0.4,
				overlay.r * 0.31,
				overlay.r * 0.2,
				-0.6,
				0,
				Math.PI * 2
			);
			ctx.fill();
			break;
		}
		case 'knob': {
			const angle = (-135 + (percentOf(part) / 100) * 270) * (Math.PI / 180);
			const reach = overlay.r * 0.78;
			ctx.strokeStyle = '#4c565f';
			ctx.lineWidth = Math.max(1.6, overlay.r * 0.16);
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(overlay.cx, overlay.cy);
			ctx.lineTo(overlay.cx + Math.sin(angle) * reach, overlay.cy - Math.cos(angle) * reach);
			ctx.stroke();
			break;
		}
		case 'slider': {
			const knobX = overlay.x + (percentOf(part) / 100) * overlay.w;
			const knobW = Math.min(16, overlay.h * 0.55);
			const knobH = overlay.h * 1.9;
			const knob = ctx.createLinearGradient(knobX - knobW / 2, 0, knobX + knobW / 2, 0);
			knob.addColorStop(0, '#eef1f3');
			knob.addColorStop(1, '#939ca3');
			ctx.fillStyle = knob;
			ctx.strokeStyle = '#5d666c';
			ctx.lineWidth = 1.2;
			ctx.beginPath();
			ctx.roundRect(knobX - knobW / 2, overlay.y + overlay.h / 2 - knobH / 2, knobW, knobH, 3);
			ctx.fill();
			ctx.stroke();

			ctx.fillStyle = '#394247';
			const grip = knobW * 0.62;
			for (let i = 0; i < 3; i++) {
				ctx.fillRect(knobX - grip / 2, overlay.y + overlay.h / 2 - 5 + i * 4, grip, 1.6);
			}
			break;
		}
	}
	ctx.restore();
}
