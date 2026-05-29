import { Vector } from './vector';

/**
 * Defines a directed line.
 */
export class Line {
	direction: Vector;
	point: Vector;

	constructor() {
		this.direction = new Vector(0, 0);
		this.point = new Vector(0, 0);
	}
}
