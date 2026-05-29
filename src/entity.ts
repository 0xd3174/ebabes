/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import { EntityType, type Entity as EvadesEntity } from './gen/evades_pb.js';
import { Vector } from './vo/index.js';

export interface Entity extends EvadesEntity {}

const MAX_VELOCITY_HISTORY = 5;

export class Entity {
	readonly $typeName = 'evades.Entity' as const;

	posHistory: Array<Vector> = Array.from({
		length: MAX_VELOCITY_HISTORY,
	}).map(() => new Vector(0, 0));
	velocity = new Vector(0, 0);
	constructor(
		data: Partial<EvadesEntity> & { id: number; x: number; y: number },
	) {
		data.radius = data.radius || data.visualRadius;

		if (!data.radius) {
			data.radius = data.entityType === EntityType.WALL_ENEMY ? 30 : 15;
		}

		Object.assign(this, data);

		this.posHistory = Array.from({ length: MAX_VELOCITY_HISTORY }).map(
			() => new Vector(this.x, this.y),
		);
	}

	get pos(): Vector {
		return new Vector(this.x, this.y);
	}

	set pos(value: Vector) {
		if (!value.x) value.x = this.posHistory.at(-1)!.x;
		if (!value.y) value.y = this.posHistory.at(-1)!.y;

		this.x = value.x;
		this.y = value.y;

		this.posHistory.shift();
		this.posHistory.push(value);

		this.velocity = this.approxVelocity();
	}

	private approxVelocity() {
		const { posHistory } = this;

		const sumVector = new Vector(0, 0);
		let sumLength = 0;

		for (let i = 0; i < MAX_VELOCITY_HISTORY - 1; i++) {
			const velocityVector = posHistory[i + 1].sub(posHistory[i]);
			const velocityVectorLength = velocityVector.abs();

			sumLength += velocityVectorLength;

			if (velocityVectorLength > 0) {
				sumVector.add(velocityVector.normalize());
			}
		}

		const averageLength = sumLength / (MAX_VELOCITY_HISTORY - 1);

		if (sumVector.abs() === 0) {
			return new Vector(0.1, 0.1);
		}

		if (this.entityType === EntityType.WALL_ENEMY) {
			sumVector.add(new Vector(0.1, 0.1));
		}

		return sumVector.normalize().mul(averageLength);
	}
}
