import { Vector } from './vector';

/**
 * Defines static obstacles in the simulation.
 */
export class Obstacle {
	next!: Obstacle;
	previous!: Obstacle;
	direction!: Vector;
	point!: Vector;
	id!: number;
	convex!: boolean;
}
