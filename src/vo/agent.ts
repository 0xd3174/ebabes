import { Line } from './line';
import { Obstacle } from './obstacle';
import { Simulator } from './simulator';
import { Vector } from './vector';

export interface KeyValuePair<K, V> {
	key: K;
	value: V;
}

/**
 * Defines an agent in the simulation.
 */
export class Agent {
	agentNeighbors: KeyValuePair<number, Agent>[] = [];
	obstacleNeighbors: KeyValuePair<number, Obstacle>[] = [];
	orcaLines: Line[] = [];
	position: Vector = new Vector(0, 0);
	prefVelocity: Vector = new Vector(0, 0);
	velocity: Vector = new Vector(0, 0);
	id: number = 0;
	maxNeighbors: number = 0;
	maxSpeed: number = 0.0;
	neighborDist: number = 0.0;
	radius: number = 0.0;
	timeHorizon: number = 0.0;
	timeHorizonObst: number = 0.0;

	private newVelocity: Vector = new Vector(0, 0);

	/**
	 * Computes the neighbors of this agent.
	 */
	computeNeighbors(): void {
		this.obstacleNeighbors = [];
		let rangeSq: number =
			(this.timeHorizonObst * this.maxSpeed + this.radius) ** 2;
		Simulator.Instance.kdTree.computeObstacleNeighbors(this, rangeSq);

		this.agentNeighbors = [];

		if (this.maxNeighbors > 0) {
			let rangeSqObj = { val: this.neighborDist ** 2 };
			Simulator.Instance.kdTree.computeAgentNeighbors(this, rangeSqObj);
		}
	}

	/**
	 * Computes the new velocity of this agent.
	 */
	computeNewVelocity(): void {
		this.orcaLines = [];

		let invTimeHorizonObst: number = 1.0 / this.timeHorizonObst;

		/* Create obstacle ORCA lines. */
		for (let i = 0; i < this.obstacleNeighbors.length; ++i) {
			let obstacle1: Obstacle = this.obstacleNeighbors[i].value;
			let obstacle2: Obstacle = obstacle1.next;

			let relativePosition1: Vector = obstacle1.point.sub(this.position);
			let relativePosition2: Vector = obstacle2.point.sub(this.position);

			/*
			 * Check if velocity obstacle of obstacle is already taken care
			 * of by previously constructed obstacle ORCA lines.
			 */
			let alreadyCovered: boolean = false;

			for (let j = 0; j < this.orcaLines.length; ++j) {
				if (
					relativePosition1
						.mul(invTimeHorizonObst)
						.sub(this.orcaLines[j].point)
						.det(this.orcaLines[j].direction) -
						invTimeHorizonObst * this.radius >=
						-Vector.RVO_EPSILON &&
					relativePosition2
						.mul(invTimeHorizonObst)
						.sub(this.orcaLines[j].point)
						.det(this.orcaLines[j].direction) -
						invTimeHorizonObst * this.radius >=
						-Vector.RVO_EPSILON
				) {
					alreadyCovered = true;

					break;
				}
			}

			if (alreadyCovered) {
				continue;
			}

			/* Not yet covered. Check for collisions. */
			let distSq1: number = relativePosition1.absSq();
			let distSq2: number = relativePosition2.absSq();

			let radiusSq: number = this.radius ** 2;

			let obstacleVector: Vector = obstacle2.point.sub(obstacle1.point);
			let s: number =
				relativePosition1.neg().dot(obstacleVector) / obstacleVector.absSq();
			let distSqLine: number = relativePosition1
				.neg()
				.sub(obstacleVector.mul(s))
				.absSq();

			let line: Line = new Line();

			if (s < 0.0 && distSq1 <= radiusSq) {
				/* Collision with left vertex. Ignore if non-convex. */
				if (obstacle1.convex) {
					line.point = new Vector(0.0, 0.0);
					line.direction = new Vector(
						-relativePosition1.y,
						relativePosition1.x,
					).normalize();
					this.orcaLines.push(line);
				}

				continue;
			} else if (s > 1.0 && distSq2 <= radiusSq) {
				/*
				 * Collision with right vertex. Ignore if non-convex or if
				 * it will be taken care of by neighboring obstacle.
				 */
				if (
					obstacle2.convex &&
					relativePosition2.det(obstacle2.direction) >= 0.0
				) {
					line.point = new Vector(0.0, 0.0);
					line.direction = new Vector(
						-relativePosition2.y,
						relativePosition2.x,
					).normalize();
					this.orcaLines.push(line);
				}

				continue;
			} else if (s >= 0.0 && s < 1.0 && distSqLine <= radiusSq) {
				/* Collision with obstacle segment. */
				line.point = new Vector(0.0, 0.0);
				line.direction = obstacle1.direction.neg();
				this.orcaLines.push(line);

				continue;
			}

			/*
			 * No collision. Compute legs. When obliquely viewed, both legs
			 * can come from a single vertex. Legs extend cut-off line when
			 * non-convex vertex.
			 */

			let leftLegDirection: Vector;
			let rightLegDirection: Vector;

			if (s < 0.0 && distSqLine <= radiusSq) {
				/*
				 * Obstacle viewed obliquely so that left vertex
				 * defines velocity obstacle.
				 */
				if (!obstacle1.convex) {
					/* Ignore obstacle. */
					continue;
				}

				obstacle2 = obstacle1;

				let leg1: number = Math.sqrt(distSq1 - radiusSq);
				leftLegDirection = new Vector(
					relativePosition1.x * leg1 - relativePosition1.y * this.radius,
					relativePosition1.x * this.radius + relativePosition1.y * leg1,
				).div(distSq1);
				rightLegDirection = new Vector(
					relativePosition1.x * leg1 + relativePosition1.y * this.radius,
					-relativePosition1.x * this.radius + relativePosition1.y * leg1,
				).div(distSq1);
			} else if (s > 1.0 && distSqLine <= radiusSq) {
				/*
				 * Obstacle viewed obliquely so that
				 * right vertex defines velocity obstacle.
				 */
				if (!obstacle2.convex) {
					/* Ignore obstacle. */
					continue;
				}

				obstacle1 = obstacle2;

				let leg2: number = Math.sqrt(distSq2 - radiusSq);
				leftLegDirection = new Vector(
					relativePosition2.x * leg2 - relativePosition2.y * this.radius,
					relativePosition2.x * this.radius + relativePosition2.y * leg2,
				).div(distSq2);
				rightLegDirection = new Vector(
					relativePosition2.x * leg2 + relativePosition2.y * this.radius,
					-relativePosition2.x * this.radius + relativePosition2.y * leg2,
				).div(distSq2);
			} else {
				/* Usual situation. */
				if (obstacle1.convex) {
					let leg1: number = Math.sqrt(distSq1 - radiusSq);
					leftLegDirection = new Vector(
						relativePosition1.x * leg1 - relativePosition1.y * this.radius,
						relativePosition1.x * this.radius + relativePosition1.y * leg1,
					).div(distSq1);
				} else {
					/* Left vertex non-convex; left leg extends cut-off line. */
					leftLegDirection = obstacle1.direction.neg();
				}

				if (obstacle2.convex) {
					let leg2: number = Math.sqrt(distSq2 - radiusSq);
					rightLegDirection = new Vector(
						relativePosition2.x * leg2 + relativePosition2.y * this.radius,
						-relativePosition2.x * this.radius + relativePosition2.y * leg2,
					).div(distSq2);
				} else {
					/* Right vertex non-convex; right leg extends cut-off line. */
					rightLegDirection = obstacle1.direction;
				}
			}

			/*
			 * Legs can never point into neighboring edge when convex
			 * vertex, take cutoff-line of neighboring edge instead. If
			 * velocity projected on "foreign" leg, no constraint is added.
			 */

			let leftNeighbor: Obstacle = obstacle1.previous;

			let isLeftLegForeign: boolean = false;
			let isRightLegForeign: boolean = false;

			if (
				obstacle1.convex &&
				leftLegDirection.det(leftNeighbor.direction.neg()) >= 0.0
			) {
				/* Left leg points into obstacle. */
				leftLegDirection = leftNeighbor.direction.neg();
				isLeftLegForeign = true;
			}

			if (
				obstacle2.convex &&
				rightLegDirection.det(obstacle2.direction) <= 0.0
			) {
				/* Right leg points into obstacle. */
				rightLegDirection = obstacle2.direction;
				isRightLegForeign = true;
			}

			/* Compute cut-off centers. */
			let leftCutOff: Vector = obstacle1.point
				.sub(this.position)
				.mul(invTimeHorizonObst);
			let rightCutOff: Vector = obstacle2.point
				.sub(this.position)
				.mul(invTimeHorizonObst);
			let cutOffVector: Vector = rightCutOff.sub(leftCutOff);

			/* Project current velocity on velocity obstacle. */

			/* Check if current velocity is projected on cutoff circles. */
			let t: number =
				obstacle1 === obstacle2
					? 0.5
					: this.velocity.sub(leftCutOff).dot(cutOffVector) /
						cutOffVector.absSq();
			let tLeft: number = this.velocity.sub(leftCutOff).dot(leftLegDirection);
			let tRight: number = this.velocity
				.sub(rightCutOff)
				.dot(rightLegDirection);

			if (
				(t < 0.0 && tLeft < 0.0) ||
				(obstacle1 === obstacle2 && tLeft < 0.0 && tRight < 0.0)
			) {
				/* Project on left cut-off circle. */
				let unitW: Vector = this.velocity.sub(leftCutOff).normalize();

				line.direction = new Vector(unitW.y, -unitW.x);
				line.point = leftCutOff.add(
					unitW.mul(this.radius * invTimeHorizonObst),
				);
				this.orcaLines.push(line);

				continue;
			} else if (t > 1.0 && tRight < 0.0) {
				/* Project on right cut-off circle. */
				let unitW: Vector = this.velocity.sub(rightCutOff).normalize();

				line.direction = new Vector(unitW.y, -unitW.x);
				line.point = rightCutOff.add(
					unitW.mul(this.radius * invTimeHorizonObst),
				);
				this.orcaLines.push(line);

				continue;
			}

			/*
			 * Project on left leg, right leg, or cut-off line, whichever is
			 * closest to velocity.
			 */
			let distSqCutoff: number =
				t < 0.0 || t > 1.0 || obstacle1 === obstacle2
					? Number.POSITIVE_INFINITY
					: this.velocity.sub(leftCutOff.add(cutOffVector.mul(t))).absSq();
			let distSqLeft: number =
				tLeft < 0.0
					? Number.POSITIVE_INFINITY
					: this.velocity
							.sub(leftCutOff.add(leftLegDirection.mul(tLeft)))
							.absSq();
			let distSqRight: number =
				tRight < 0.0
					? Number.POSITIVE_INFINITY
					: this.velocity
							.sub(rightCutOff.add(rightLegDirection.mul(tRight)))
							.absSq();

			if (distSqCutoff <= distSqLeft && distSqCutoff <= distSqRight) {
				/* Project on cut-off line. */
				line.direction = obstacle1.direction.neg();
				line.point = leftCutOff.add(
					new Vector(-line.direction.y, line.direction.x).mul(
						this.radius * invTimeHorizonObst,
					),
				);
				this.orcaLines.push(line);

				continue;
			}

			if (distSqLeft <= distSqRight) {
				/* Project on left leg. */
				if (isLeftLegForeign) {
					continue;
				}

				line.direction = leftLegDirection;
				line.point = leftCutOff.add(
					new Vector(-line.direction.y, line.direction.x).mul(
						this.radius * invTimeHorizonObst,
					),
				);
				this.orcaLines.push(line);

				continue;
			}

			/* Project on right leg. */
			if (isRightLegForeign) {
				continue;
			}

			line.direction = rightLegDirection.neg();
			line.point = rightCutOff.add(
				new Vector(-line.direction.y, line.direction.x).mul(
					this.radius * invTimeHorizonObst,
				),
			);
			this.orcaLines.push(line);
		}

		let numObstLines: number = this.orcaLines.length;

		let invTimeHorizon: number = 1.0 / this.timeHorizon;

		/* Create agent ORCA lines. */
		for (let i = 0; i < this.agentNeighbors.length; ++i) {
			let other: Agent = this.agentNeighbors[i].value;

			let relativePosition: Vector = other.position.sub(this.position);
			let relativeVelocity: Vector = this.velocity.sub(other.velocity);
			let distSq: number = relativePosition.absSq();
			let combinedRadius: number = this.radius + other.radius;
			let combinedRadiusSq: number = combinedRadius ** 2;

			let line: Line = new Line();
			let u: Vector;

			if (distSq > combinedRadiusSq) {
				/* No collision. */
				let w: Vector = relativeVelocity.sub(
					relativePosition.mul(invTimeHorizon),
				);

				/* Vector from cutoff center to relative velocity. */
				let wLengthSq: number = w.absSq();
				let dotProduct1: number = w.dot(relativePosition);

				if (
					dotProduct1 < 0.0 &&
					dotProduct1 ** 2 > combinedRadiusSq * wLengthSq
				) {
					/* Project on cut-off circle. */
					let wLength: number = Math.sqrt(wLengthSq);
					let unitW: Vector = w.div(wLength);

					line.direction = new Vector(unitW.y, -unitW.x);
					u = unitW.mul(combinedRadius * invTimeHorizon - wLength);
				} else {
					/* Project on legs. */
					let leg: number = Math.sqrt(distSq - combinedRadiusSq);

					if (relativePosition.det(w) > 0.0) {
						/* Project on left leg. */
						line.direction = new Vector(
							relativePosition.x * leg - relativePosition.y * combinedRadius,
							relativePosition.x * combinedRadius + relativePosition.y * leg,
						).div(distSq);
					} else {
						/* Project on right leg. */
						line.direction = new Vector(
							relativePosition.x * leg + relativePosition.y * combinedRadius,
							-relativePosition.x * combinedRadius + relativePosition.y * leg,
						)
							.div(distSq)
							.neg();
					}

					let dotProduct2: number = relativeVelocity.dot(line.direction);
					u = line.direction.mul(dotProduct2).sub(relativeVelocity);
				}
			} else {
				/* Collision. Project on cut-off circle of time timeStep. */
				let invTimeStep: number = 1.0 / Simulator.Instance.timeStep;

				/* Vector from cutoff center to relative velocity. */
				let w: Vector = relativeVelocity.sub(relativePosition.mul(invTimeStep));

				let wLength: number = w.abs();
				let unitW: Vector = w.div(wLength);

				line.direction = new Vector(unitW.y, -unitW.x);
				u = unitW.mul(combinedRadius * invTimeStep - wLength);
			}

			line.point = this.velocity.add(u);
			this.orcaLines.push(line);
		}

		let newVelocityObj = { val: this.newVelocity };
		let lineFail: number = this.linearProgram2(
			this.orcaLines,
			this.maxSpeed,
			this.prefVelocity,
			false,
			newVelocityObj,
		);
		this.newVelocity = newVelocityObj.val;

		if (lineFail < this.orcaLines.length) {
			this.linearProgram3(
				this.orcaLines,
				numObstLines,
				lineFail,
				this.maxSpeed,
				newVelocityObj,
			);
			this.newVelocity = newVelocityObj.val;
		}
	}

	/**
	 * Inserts an agent neighbor into the set of neighbors of this
	 * agent.
	 *
	 * @param agent A pointer to the agent to be inserted.
	 * @param rangeSqObj The squared range around this agent.
	 */
	insertAgentNeighbor(agent: Agent, rangeSqObj: { val: number }): void {
		if (this !== agent) {
			let distSq: number = this.position.sub(agent.position).absSq();

			if (distSq < rangeSqObj.val) {
				if (this.agentNeighbors.length < this.maxNeighbors) {
					this.agentNeighbors.push({ key: distSq, value: agent });
				}

				let i: number = this.agentNeighbors.length - 1;

				while (i !== 0 && distSq < this.agentNeighbors[i - 1].key) {
					this.agentNeighbors[i] = this.agentNeighbors[i - 1];
					--i;
				}

				this.agentNeighbors[i] = { key: distSq, value: agent };

				if (this.agentNeighbors.length === this.maxNeighbors) {
					rangeSqObj.val =
						this.agentNeighbors[this.agentNeighbors.length - 1].key;
				}
			}
		}
	}

	/**
	 * Inserts a static obstacle neighbor into the set of neighbors
	 * of this agent.
	 *
	 * @param obstacle The number of the static obstacle to be
	 * inserted.
	 * @param rangeSq The squared range around this agent.
	 */
	insertObstacleNeighbor(obstacle: Obstacle, rangeSq: number): void {
		let nextObstacle: Obstacle = obstacle.next;

		let distSq: number = Vector.distSqPointLineSegment(
			obstacle.point,
			nextObstacle.point,
			this.position,
		);

		if (distSq < rangeSq) {
			this.obstacleNeighbors.push({ key: distSq, value: obstacle });

			let i: number = this.obstacleNeighbors.length - 1;

			while (i !== 0 && distSq < this.obstacleNeighbors[i - 1].key) {
				this.obstacleNeighbors[i] = this.obstacleNeighbors[i - 1];
				--i;
			}
			this.obstacleNeighbors[i] = { key: distSq, value: obstacle };
		}
	}

	/**
	 * Updates the two-dimensional position and two-dimensional
	 * velocity of this agent.
	 */
	update(): void {
		this.velocity = this.newVelocity;
		this.position = this.position.add(
			this.velocity.mul(Simulator.Instance.timeStep),
		);
	}

	/**
	 * Solves a one-dimensional linear program on a specified line
	 * subject to linear constraints defined by lines and a circular
	 * constraint.
	 *
	 * @returns True if successful.
	 *
	 * @param lines Lines defining the linear constraints.
	 * @param lineNo The specified line constraint.
	 * @param radius The radius of the circular constraint.
	 * @param optVelocity The optimization velocity.
	 * @param directionOpt True if the direction should be optimized.
	 * @param resultObj A reference to the result of the linear program.
	 */
	private linearProgram1(
		lines: Line[],
		lineNo: number,
		radius: number,
		optVelocity: Vector,
		directionOpt: boolean,
		resultObj: { val: Vector },
	): boolean {
		let dotProduct: number = lines[lineNo].point.dot(lines[lineNo].direction);
		let discriminant: number =
			dotProduct ** 2 + radius ** 2 - lines[lineNo].point.absSq();

		if (discriminant < 0.0) {
			/* Max speed circle fully invalidates line lineNo. */
			return false;
		}

		let sqrtDiscriminant: number = Math.sqrt(discriminant);
		let tLeft: number = -dotProduct - sqrtDiscriminant;
		let tRight: number = -dotProduct + sqrtDiscriminant;

		for (let i = 0; i < lineNo; ++i) {
			let denominator: number = lines[lineNo].direction.det(lines[i].direction);
			let numerator: number = lines[i].direction.det(
				lines[lineNo].point.sub(lines[i].point),
			);

			if (Math.abs(denominator) <= Vector.RVO_EPSILON) {
				/* Lines lineNo and i are (almost) parallel. */
				if (numerator < 0.0) {
					return false;
				}

				continue;
			}

			let t: number = numerator / denominator;

			if (denominator >= 0.0) {
				/* Line i bounds line lineNo on the right. */
				tRight = Math.min(tRight, t);
			} else {
				/* Line i bounds line lineNo on the left. */
				tLeft = Math.max(tLeft, t);
			}

			if (tLeft > tRight) {
				return false;
			}
		}

		if (directionOpt) {
			/* Optimize direction. */
			if (optVelocity.dot(lines[lineNo].direction) > 0.0) {
				/* Take right extreme. */
				resultObj.val = lines[lineNo].point.add(
					lines[lineNo].direction.mul(tRight),
				);
			} else {
				/* Take left extreme. */
				resultObj.val = lines[lineNo].point.add(
					lines[lineNo].direction.mul(tLeft),
				);
			}
		} else {
			/* Optimize closest point. */
			let t: number = lines[lineNo].direction.dot(
				optVelocity.sub(lines[lineNo].point),
			);

			if (t < tLeft) {
				resultObj.val = lines[lineNo].point.add(
					lines[lineNo].direction.mul(tLeft),
				);
			} else if (t > tRight) {
				resultObj.val = lines[lineNo].point.add(
					lines[lineNo].direction.mul(tRight),
				);
			} else {
				resultObj.val = lines[lineNo].point.add(lines[lineNo].direction.mul(t));
			}
		}

		return true;
	}

	/**
	 * Solves a two-dimensional linear program subject to linear
	 * constraints defined by lines and a circular constraint.
	 *
	 * @returns The number of the line it fails on, and the number of lines
	 * if successful.
	 *
	 * @param lines Lines defining the linear constraints.
	 * @param radius The radius of the circular constraint.
	 * @param optVelocity The optimization velocity.
	 * @param directionOpt True if the direction should be optimized.
	 * @param resultObj A reference to the result of the linear program.
	 */
	private linearProgram2(
		lines: Line[],
		radius: number,
		optVelocity: Vector,
		directionOpt: boolean,
		resultObj: { val: Vector },
	): number {
		if (directionOpt) {
			/*
			 * Optimize direction. Note that the optimization velocity is of
			 * unit length in this case.
			 */
			resultObj.val = optVelocity.mul(radius);
		} else if (optVelocity.absSq() > radius ** 2) {
			/* Optimize closest point and outside circle. */
			resultObj.val = optVelocity.normalize().mul(radius);
		} else {
			/* Optimize closest point and inside circle. */
			resultObj.val = optVelocity;
		}

		for (let i = 0; i < lines.length; ++i) {
			if (lines[i].direction.det(lines[i].point.sub(resultObj.val)) > 0.0) {
				/* Result does not satisfy constraint i. Compute new optimal result. */
				let tempResult: Vector = resultObj.val;
				if (
					!this.linearProgram1(
						lines,
						i,
						radius,
						optVelocity,
						directionOpt,
						resultObj,
					)
				) {
					resultObj.val = tempResult;

					return i;
				}
			}
		}

		return lines.length;
	}

	/**
	 * Solves a two-dimensional linear program subject to linear
	 * constraints defined by lines and a circular constraint.
	 *
	 * @param lines Lines defining the linear constraints.
	 * @param numObstLines Count of obstacle lines.
	 * @param beginLine The line on which the 2-d linear program
	 * failed.
	 * @param radius The radius of the circular constraint.
	 * @param resultObj A reference to the result of the linear program.
	 */
	private linearProgram3(
		lines: Line[],
		numObstLines: number,
		beginLine: number,
		radius: number,
		resultObj: { val: Vector },
	): void {
		let distance: number = 0.0;

		for (let i = beginLine; i < lines.length; ++i) {
			if (
				lines[i].direction.det(lines[i].point.sub(resultObj.val)) > distance
			) {
				/* Result does not satisfy constraint of line i. */
				let projLines: Line[] = [];
				for (let ii = 0; ii < numObstLines; ++ii) {
					projLines.push(lines[ii]);
				}

				for (let j = numObstLines; j < i; ++j) {
					let line: Line = new Line();

					let determinant: number = lines[i].direction.det(lines[j].direction);

					if (Math.abs(determinant) <= Vector.RVO_EPSILON) {
						/* Line i and line j are parallel. */
						if (lines[i].direction.dot(lines[j].direction) > 0.0) {
							/* Line i and line j point in the same direction. */
							continue;
						} else {
							/* Line i and line j point in opposite direction. */
							line.point = lines[i].point.add(lines[j].point).mul(0.5);
						}
					} else {
						line.point = lines[i].point.add(
							lines[i].direction.mul(
								lines[j].direction.det(lines[i].point.sub(lines[j].point)) /
									determinant,
							),
						);
					}

					line.direction = lines[j].direction
						.sub(lines[i].direction)
						.normalize();
					projLines.push(line);
				}

				let tempResult: Vector = resultObj.val;
				if (
					this.linearProgram2(
						projLines,
						radius,
						new Vector(-lines[i].direction.y, lines[i].direction.x),
						true,
						resultObj,
					) < projLines.length
				) {
					/*
					 * This should in principle not happen. The result is by
					 * definition already in the feasible region of this
					 * linear program. If it fails, it is due to small
					 * floating point error, and the current result is kept.
					 */
					resultObj.val = tempResult;
				}

				distance = lines[i].direction.det(lines[i].point.sub(resultObj.val));
			}
		}
	}
}
