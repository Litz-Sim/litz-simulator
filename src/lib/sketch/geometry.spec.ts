import { describe, expect, it } from 'vitest';
import { rotatePoint, snapToGrid } from './geometry';
import { defaultBend, orthoPoints } from './wire';

describe('geometry', () => {
	it('rotates clockwise on screen', () => {
		const [x, y] = rotatePoint(10, 0, 90);
		expect(Math.round(x)).toBe(0);
		expect(Math.round(y)).toBe(10);
	});

	it('snaps to the 20-unit grid', () => {
		expect(snapToGrid(31)).toBe(40);
		expect(snapToGrid(-9) === 0).toBe(true);
	});
});

describe('wires', () => {
	it('puts a fresh wire’s bend at the midpoint', () => {
		expect(defaultBend()).toEqual([{ u: 0.5, v: 0 }]);
	});

	it('routes without a bend as one elbow', () => {
		const points = orthoPoints({ x: 0, y: 0 }, { x: 100, y: 50 }, []);
		expect(points).toEqual([
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 100, y: 50 }
		]);
	});

	it('uses the bend as the middle channel of a mostly-horizontal wire', () => {
		const points = orthoPoints({ x: 0, y: 0 }, { x: 200, y: 60 }, [{ u: 0.25, v: 0 }]);
		expect(points).toEqual([
			{ x: 0, y: 0 },
			{ x: 50, y: 0 },
			{ x: 50, y: 60 },
			{ x: 200, y: 60 }
		]);
	});

	it('routes a mostly-vertical wire through a horizontal channel', () => {
		const points = orthoPoints({ x: 0, y: 0 }, { x: 40, y: 200 }, [{ u: 0.5, v: 0 }]);
		expect(points).toEqual([
			{ x: 0, y: 0 },
			{ x: 0, y: 100 },
			{ x: 40, y: 100 },
			{ x: 40, y: 200 }
		]);
	});

	it('keeps an aligned wire straight', () => {
		expect(orthoPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, defaultBend())).toEqual([
			{ x: 0, y: 0 },
			{ x: 100, y: 0 }
		]);
	});
});
