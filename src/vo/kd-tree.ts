import { Agent } from './agent';
import { Obstacle } from './obstacle';
import { Simulator } from './simulator';
import { Vector } from './vector';

/**
 * Defines a node of an agent k-D tree.
 */
class AgentTreeNode {
	begin: number = 0;
	end: number = 0;
	left: number = 0;
	right: number = 0;
	maxX: number = 0;
	maxY: number = 0;
	minX: number = 0;
	minY: number = 0;
}

/**
 * Defines a pair of scalar values.
 */
class FloatPair {
	a: number;
	b: number;

	constructor(a: number, b: number) {
		this.a = a;
		this.b = b;
	}

	static lessThan(pair1: FloatPair, pair2: FloatPair): boolean {
		return pair1.a < pair2.a || (!(pair2.a < pair1.a) && pair1.b < pair2.b);
	}

	static lessThanOrEqual(pair1: FloatPair, pair2: FloatPair): boolean {
		return (
			(pair1.a === pair2.a && pair1.b === pair2.b) ||
			FloatPair.lessThan(pair1, pair2)
		);
	}

	static greaterThan(pair1: FloatPair, pair2: FloatPair): boolean {
		return !FloatPair.lessThanOrEqual(pair1, pair2);
	}

	static greaterThanOrEqual(pair1: FloatPair, pair2: FloatPair): boolean {
		return !FloatPair.lessThan(pair1, pair2);
	}
}

/**
 * Defines a node of an obstacle k-D tree.
 */
class ObstacleTreeNode {
	obstacle!: Obstacle;
	left: ObstacleTreeNode | null = null;
	right: ObstacleTreeNode | null = null;
}

/**
 * Defines k-D trees for agents and static obstacles in the
 * simulation.
 */
export class KdTree {
	/**
	 * The maximum size of an agent k-D tree leaf.
	 */
	private readonly MAX_LEAF_SIZE: number = 10;

	private agents!: Agent[];
	private agentTree!: AgentTreeNode[];
	private obstacleTree: ObstacleTreeNode | null = null;

	/**
	 * Builds an agent k-D tree.
	 */
	buildAgentTree(): void {
		if (
			this.agents === undefined ||
			this.agents === null ||
			this.agents.length !== Simulator.Instance.agents.length
		) {
			this.agents = Array.from({
				length: Simulator.Instance.agents.length,
			}) as Agent[];

			for (let i = 0; i < this.agents.length; ++i) {
				this.agents[i] = Simulator.Instance.agents[i];
			}

			this.agentTree = Array.from({
				length: 2 * this.agents.length,
			}) as AgentTreeNode[];

			for (let i = 0; i < this.agentTree.length; ++i) {
				this.agentTree[i] = new AgentTreeNode();
			}
		}

		if (this.agents.length !== 0) {
			this.buildAgentTreeRecursive(0, this.agents.length, 0);
		}
	}

	/**
	 * Builds an obstacle k-D tree.
	 */
	buildObstacleTree(): void {
		this.obstacleTree = new ObstacleTreeNode();

		let obstacles: Obstacle[] = Array.from({
			length: Simulator.Instance.obstacles.length,
		}) as Obstacle[];

		for (let i = 0; i < Simulator.Instance.obstacles.length; ++i) {
			obstacles[i] = Simulator.Instance.obstacles[i];
		}

		this.obstacleTree = this.buildObstacleTreeRecursive(obstacles);
	}

	/**
	 * Computes the agent neighbors of the specified agent.
	 *
	 * @param agent The agent for which agent neighbors are to be
	 * computed.
	 * @param rangeSqObj The squared range around the agent.
	 */
	computeAgentNeighbors(agent: Agent, rangeSqObj: { val: number }): void {
		this.queryAgentTreeRecursive(agent, rangeSqObj, 0);
	}

	/**
	 * Computes the obstacle neighbors of the specified agent.
	 *
	 * @param agent The agent for which obstacle neighbors are to be
	 * computed.
	 * @param rangeSq The squared range around the agent.
	 */
	computeObstacleNeighbors(agent: Agent, rangeSq: number): void {
		this.queryObstacleTreeRecursive(agent, rangeSq, this.obstacleTree);
	}

	/**
	 * Queries the visibility between two points within a specified
	 * radius.
	 *
	 * @returns True if q1 and q2 are mutually visible within the radius;
	 * false otherwise.
	 *
	 * @param q1 The first point between which visibility is to be
	 * tested.
	 * @param q2 The second point between which visibility is to be
	 * tested.
	 * @param radius The radius within which visibility is to be
	 * tested.
	 */
	queryVisibility(q1: Vector, q2: Vector, radius: number): boolean {
		return this.queryVisibilityRecursive(q1, q2, radius, this.obstacleTree);
	}

	/**
	 * Recursive method for building an agent k-D tree.
	 *
	 * @param begin The beginning agent k-D tree node node index.
	 * @param end The ending agent k-D tree node index.
	 * @param node The current agent k-D tree node index.
	 */
	private buildAgentTreeRecursive(
		begin: number,
		end: number,
		node: number,
	): void {
		this.agentTree[node].begin = begin;
		this.agentTree[node].end = end;
		this.agentTree[node].minX = this.agentTree[node].maxX =
			this.agents[begin].position.x;
		this.agentTree[node].minY = this.agentTree[node].maxY =
			this.agents[begin].position.y;

		for (let i = begin + 1; i < end; ++i) {
			this.agentTree[node].maxX = Math.max(
				this.agentTree[node].maxX,
				this.agents[i].position.x,
			);
			this.agentTree[node].minX = Math.min(
				this.agentTree[node].minX,
				this.agents[i].position.x,
			);
			this.agentTree[node].maxY = Math.max(
				this.agentTree[node].maxY,
				this.agents[i].position.y,
			);
			this.agentTree[node].minY = Math.min(
				this.agentTree[node].minY,
				this.agents[i].position.y,
			);
		}

		if (end - begin > this.MAX_LEAF_SIZE) {
			/* No leaf node. */
			let isVertical: boolean =
				this.agentTree[node].maxX - this.agentTree[node].minX >
				this.agentTree[node].maxY - this.agentTree[node].minY;
			let splitValue: number =
				0.5 *
				(isVertical
					? this.agentTree[node].maxX + this.agentTree[node].minX
					: this.agentTree[node].maxY + this.agentTree[node].minY);

			let left: number = begin;
			let right: number = end;

			while (left < right) {
				while (
					left < right &&
					(isVertical
						? this.agents[left].position.x
						: this.agents[left].position.y) < splitValue
				) {
					++left;
				}

				while (
					right > left &&
					(isVertical
						? this.agents[right - 1].position.x
						: this.agents[right - 1].position.y) >= splitValue
				) {
					--right;
				}

				if (left < right) {
					let tempAgent: Agent = this.agents[left];
					this.agents[left] = this.agents[right - 1];
					this.agents[right - 1] = tempAgent;
					++left;
					--right;
				}
			}

			let leftSize: number = left - begin;

			if (leftSize === 0) {
				++leftSize;
				++left;
				++right;
			}

			this.agentTree[node].left = node + 1;
			this.agentTree[node].right = node + 2 * leftSize;

			this.buildAgentTreeRecursive(begin, left, this.agentTree[node].left);
			this.buildAgentTreeRecursive(left, end, this.agentTree[node].right);
		}
	}

	/**
	 * Recursive method for building an obstacle k-D tree.
	 *
	 * @returns An obstacle k-D tree node.
	 *
	 * @param obstacles A list of obstacles.
	 */
	private buildObstacleTreeRecursive(
		obstacles: Obstacle[],
	): ObstacleTreeNode | null {
		if (obstacles.length === 0) {
			return null;
		}

		let node: ObstacleTreeNode = new ObstacleTreeNode();

		let optimalSplit: number = 0;
		let minLeft: number = obstacles.length;
		let minRight: number = obstacles.length;

		for (let i = 0; i < obstacles.length; ++i) {
			let leftSize: number = 0;
			let rightSize: number = 0;

			let obstacleI1: Obstacle = obstacles[i];
			let obstacleI2: Obstacle = obstacleI1.next;

			/* Compute optimal split node. */
			for (let j = 0; j < obstacles.length; ++j) {
				if (i === j) {
					continue;
				}

				let obstacleJ1: Obstacle = obstacles[j];
				let obstacleJ2: Obstacle = obstacleJ1.next;

				let j1LeftOfI: number = Vector.leftOf(
					obstacleI1.point,
					obstacleI2.point,
					obstacleJ1.point,
				);
				let j2LeftOfI: number = Vector.leftOf(
					obstacleI1.point,
					obstacleI2.point,
					obstacleJ2.point,
				);

				if (
					j1LeftOfI >= -Vector.RVO_EPSILON &&
					j2LeftOfI >= -Vector.RVO_EPSILON
				) {
					++leftSize;
				} else if (
					j1LeftOfI <= Vector.RVO_EPSILON &&
					j2LeftOfI <= Vector.RVO_EPSILON
				) {
					++rightSize;
				} else {
					++leftSize;
					++rightSize;
				}

				if (
					FloatPair.greaterThanOrEqual(
						new FloatPair(
							Math.max(leftSize, rightSize),
							Math.min(leftSize, rightSize),
						),
						new FloatPair(
							Math.max(minLeft, minRight),
							Math.min(minLeft, minRight),
						),
					)
				) {
					break;
				}
			}

			if (
				FloatPair.lessThan(
					new FloatPair(
						Math.max(leftSize, rightSize),
						Math.min(leftSize, rightSize),
					),
					new FloatPair(
						Math.max(minLeft, minRight),
						Math.min(minLeft, minRight),
					),
				)
			) {
				minLeft = leftSize;
				minRight = rightSize;
				optimalSplit = i;
			}
		}

		{
			/* Build split node. */
			let leftObstacles: Obstacle[] = Array.from({
				length: minLeft,
			}) as Obstacle[];
			let rightObstacles: Obstacle[] = Array.from({
				length: minRight,
			}) as Obstacle[];

			let leftCounter: number = 0;
			let rightCounter: number = 0;
			let i: number = optimalSplit;

			let obstacleI1: Obstacle = obstacles[i];
			let obstacleI2: Obstacle = obstacleI1.next;

			for (let j = 0; j < obstacles.length; ++j) {
				if (i === j) {
					continue;
				}

				let obstacleJ1: Obstacle = obstacles[j];
				let obstacleJ2: Obstacle = obstacleJ1.next;

				let j1LeftOfI: number = Vector.leftOf(
					obstacleI1.point,
					obstacleI2.point,
					obstacleJ1.point,
				);
				let j2LeftOfI: number = Vector.leftOf(
					obstacleI1.point,
					obstacleI2.point,
					obstacleJ2.point,
				);

				if (
					j1LeftOfI >= -Vector.RVO_EPSILON &&
					j2LeftOfI >= -Vector.RVO_EPSILON
				) {
					leftObstacles[leftCounter++] = obstacles[j];
				} else if (
					j1LeftOfI <= Vector.RVO_EPSILON &&
					j2LeftOfI <= Vector.RVO_EPSILON
				) {
					rightObstacles[rightCounter++] = obstacles[j];
				} else {
					/* Split obstacle j. */
					let t: number =
						obstacleI2.point
							.sub(obstacleI1.point)
							.det(obstacleJ1.point.sub(obstacleI1.point)) /
						obstacleI2.point
							.sub(obstacleI1.point)
							.det(obstacleJ1.point.sub(obstacleJ2.point));

					let splitPoint: Vector = obstacleJ1.point.add(
						obstacleJ2.point.sub(obstacleJ1.point).mul(t),
					);

					let newObstacle: Obstacle = new Obstacle();
					newObstacle.point = splitPoint;
					newObstacle.previous = obstacleJ1;
					newObstacle.next = obstacleJ2;
					newObstacle.convex = true;
					newObstacle.direction = obstacleJ1.direction;

					newObstacle.id = Simulator.Instance.obstacles.length;

					Simulator.Instance.obstacles.push(newObstacle);

					obstacleJ1.next = newObstacle;
					obstacleJ2.previous = newObstacle;

					if (j1LeftOfI > 0.0) {
						leftObstacles[leftCounter++] = obstacleJ1;
						rightObstacles[rightCounter++] = newObstacle;
					} else {
						rightObstacles[rightCounter++] = obstacleJ1;
						leftObstacles[leftCounter++] = newObstacle;
					}
				}
			}

			node.obstacle = obstacleI1;
			node.left = this.buildObstacleTreeRecursive(leftObstacles);
			node.right = this.buildObstacleTreeRecursive(rightObstacles);

			return node;
		}
	}

	/**
	 * Recursive method for computing the agent neighbors of the
	 * specified agent.
	 *
	 * @param agent The agent for which agent neighbors are to be
	 * computed.
	 * @param rangeSqObj The squared range around the agent.
	 * @param node The current agent k-D tree node index.
	 */
	private queryAgentTreeRecursive(
		agent: Agent,
		rangeSqObj: { val: number },
		node: number,
	): void {
		if (
			this.agentTree[node].end - this.agentTree[node].begin <=
			this.MAX_LEAF_SIZE
		) {
			for (
				let i = this.agentTree[node].begin;
				i < this.agentTree[node].end;
				++i
			) {
				agent.insertAgentNeighbor(this.agents[i], rangeSqObj);
			}
		} else {
			let distSqLeft: number =
				Math.max(
					0.0,
					this.agentTree[this.agentTree[node].left].minX - agent.position.x,
				) **
					2 +
				Math.max(
					0.0,
					agent.position.x - this.agentTree[this.agentTree[node].left].maxX,
				) **
					2 +
				Math.max(
					0.0,
					this.agentTree[this.agentTree[node].left].minY - agent.position.y,
				) **
					2 +
				Math.max(
					0.0,
					agent.position.y - this.agentTree[this.agentTree[node].left].maxY,
				) **
					2;
			let distSqRight: number =
				Math.max(
					0.0,
					this.agentTree[this.agentTree[node].right].minX - agent.position.x,
				) **
					2 +
				Math.max(
					0.0,
					agent.position.x - this.agentTree[this.agentTree[node].right].maxX,
				) **
					2 +
				Math.max(
					0.0,
					this.agentTree[this.agentTree[node].right].minY - agent.position.y,
				) **
					2 +
				Math.max(
					0.0,
					agent.position.y - this.agentTree[this.agentTree[node].right].maxY,
				) **
					2;

			if (distSqLeft < distSqRight) {
				if (distSqLeft < rangeSqObj.val) {
					this.queryAgentTreeRecursive(
						agent,
						rangeSqObj,
						this.agentTree[node].left,
					);

					if (distSqRight < rangeSqObj.val) {
						this.queryAgentTreeRecursive(
							agent,
							rangeSqObj,
							this.agentTree[node].right,
						);
					}
				}
			} else {
				if (distSqRight < rangeSqObj.val) {
					this.queryAgentTreeRecursive(
						agent,
						rangeSqObj,
						this.agentTree[node].right,
					);

					if (distSqLeft < rangeSqObj.val) {
						this.queryAgentTreeRecursive(
							agent,
							rangeSqObj,
							this.agentTree[node].left,
						);
					}
				}
			}
		}
	}

	/**
	 * Recursive method for computing the obstacle neighbors of the
	 * specified agent.
	 *
	 * @param agent The agent for which obstacle neighbors are to be
	 * computed.
	 * @param rangeSq The squared range around the agent.
	 * @param node The current obstacle k-D node.
	 */
	private queryObstacleTreeRecursive(
		agent: Agent,
		rangeSq: number,
		node: ObstacleTreeNode | null,
	): void {
		if (node !== null) {
			let obstacle1: Obstacle = node.obstacle;
			let obstacle2: Obstacle = obstacle1.next;

			let agentLeftOfLine: number = Vector.leftOf(
				obstacle1.point,
				obstacle2.point,
				agent.position,
			);

			this.queryObstacleTreeRecursive(
				agent,
				rangeSq,
				agentLeftOfLine >= 0.0 ? node.left : node.right,
			);

			let distSqLine: number =
				agentLeftOfLine ** 2 / obstacle2.point.sub(obstacle1.point).absSq();

			if (distSqLine < rangeSq) {
				if (agentLeftOfLine < 0.0) {
					/*
					 * Try obstacle at this node only if agent is on right side of
					 * obstacle (and can see obstacle).
					 */
					agent.insertObstacleNeighbor(node.obstacle, rangeSq);
				}

				/* Try other side of line. */
				this.queryObstacleTreeRecursive(
					agent,
					rangeSq,
					agentLeftOfLine >= 0.0 ? node.right : node.left,
				);
			}
		}
	}

	/**
	 * Recursive method for querying the visibility between two
	 * points within a specified radius.
	 *
	 * @returns True if q1 and q2 are mutually visible within the radius;
	 * false otherwise.
	 *
	 * @param q1 The first point between which visibility is to be
	 * tested.
	 * @param q2 The second point between which visibility is to be
	 * tested.
	 * @param radius The radius within which visibility is to be
	 * tested.
	 * @param node The current obstacle k-D node.
	 */
	private queryVisibilityRecursive(
		q1: Vector,
		q2: Vector,
		radius: number,
		node: ObstacleTreeNode | null,
	): boolean {
		if (node === null) {
			return true;
		}

		let obstacle1: Obstacle = node.obstacle;
		let obstacle2: Obstacle = obstacle1.next;

		let q1LeftOfI: number = Vector.leftOf(obstacle1.point, obstacle2.point, q1);
		let q2LeftOfI: number = Vector.leftOf(obstacle1.point, obstacle2.point, q2);
		let invLengthI: number = 1.0 / obstacle2.point.sub(obstacle1.point).absSq();

		if (q1LeftOfI >= 0.0 && q2LeftOfI >= 0.0) {
			return (
				this.queryVisibilityRecursive(q1, q2, radius, node.left) &&
				((q1LeftOfI ** 2 * invLengthI >= radius ** 2 &&
					q2LeftOfI ** 2 * invLengthI >= radius ** 2) ||
					this.queryVisibilityRecursive(q1, q2, radius, node.right))
			);
		}

		if (q1LeftOfI <= 0.0 && q2LeftOfI <= 0.0) {
			return (
				this.queryVisibilityRecursive(q1, q2, radius, node.right) &&
				((q1LeftOfI ** 2 * invLengthI >= radius ** 2 &&
					q2LeftOfI ** 2 * invLengthI >= radius ** 2) ||
					this.queryVisibilityRecursive(q1, q2, radius, node.left))
			);
		}

		if (q1LeftOfI >= 0.0 && q2LeftOfI <= 0.0) {
			/* One can see through obstacle from left to right. */
			return (
				this.queryVisibilityRecursive(q1, q2, radius, node.left) &&
				this.queryVisibilityRecursive(q1, q2, radius, node.right)
			);
		}

		let point1LeftOfQ: number = Vector.leftOf(q1, q2, obstacle1.point);
		let point2LeftOfQ: number = Vector.leftOf(q1, q2, obstacle2.point);
		let invLengthQ: number = 1.0 / q2.sub(q1).absSq();

		return (
			point1LeftOfQ * point2LeftOfQ >= 0.0 &&
			point1LeftOfQ ** 2 * invLengthQ > radius ** 2 &&
			point2LeftOfQ ** 2 * invLengthQ > radius ** 2 &&
			this.queryVisibilityRecursive(q1, q2, radius, node.left) &&
			this.queryVisibilityRecursive(q1, q2, radius, node.right)
		);
	}
}
