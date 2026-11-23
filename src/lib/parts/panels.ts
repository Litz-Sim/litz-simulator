/**
 * The parts whose engine keeps a whole frame the host can read back.
 *
 * A character LCD reports its text through the pin protocol and a seven-segment
 * display reports a mask, so neither belongs here: these are the raster panels
 * the canvas and the Screen panel can show pixel for pixel.
 */
const PANEL_TYPES: readonly string[] = [
	'litz-ssd1306',
	'litz-sh1106',
	'litz-ili9341',
	'litz-st7735',
	'litz-epaper-1in54',
	'litz-epaper-2in13',
	'litz-max7219-matrix',
	'litz-nokia-5110-screen'
];

const PANELS = new Set(PANEL_TYPES);

/** The resistive controller that turns a finger on a panel into SPI reads. */
export const TOUCH_TYPE = 'litz-xpt2046';

export function isPanelPart(type: string): boolean {
	return PANELS.has(type);
}

/**
 * A panel pixel as the controller's raw 12-bit code.
 *
 * The XPT2046 reports 0–4095 and leaves the mapping to the driver, so the
 * panel edge is what the code range is anchored to.
 */
export function touchCode(pixel: number, size: number): number {
	if (size <= 1) return 0;
	const clamped = Math.min(size - 1, Math.max(0, pixel));
	return Math.round((clamped / (size - 1)) * 4095);
}
