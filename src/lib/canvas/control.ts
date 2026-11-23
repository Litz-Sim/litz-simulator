import type { CanvasEngine } from './engine';

/** The mounted canvas engine, for UI that lives outside the canvas component. */
export const canvasControl: { engine: CanvasEngine | null } = { engine: null };
