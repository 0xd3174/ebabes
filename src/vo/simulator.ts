import { Agent } from './agent';
import { KdTree } from './kd-tree';
import { Line } from './line';
import { Obstacle } from './obstacle';
import { Vector } from './vector';

/**
 * Defines a worker.
 */
class Worker {
	private end: number;
	private start: number;

	/**
	 * Constructs and initializes a worker.
	 *
	 * @param start Start.
	 * @param end End.
	 */
	constructor(start: number, end: number) {
		this.start = start;
		this.end = end;
	}

	/**
	 * Performs a simulation step.
	 */
	step(): void {
		for (let agentNo = this.start; agentNo < this.end; ++agentNo) {
			Simulator.Instance.agents[agentNo].computeNeighbors();
			Simulator.Instance.agents[agentNo].computeNewVelocity();
		}
	}

	/**
	 * updates the two-dimensional position and
	 * two-dimensional velocity of each agent.
	 */
	update(): void {
		for (let agentNo = this.start; agentNo < this.end; ++agentNo) {
			Simulator.Instance.agents[agentNo].update();
		}
	}
}

/**
 * Defines the simulation.
 */
export class Simulator {
	agents!: Agent[];
	obstacles!: Obstacle[];
	kdTree!: KdTree;
	timeStep!: number;

	private static instance: Simulator = new Simulator();

	private defaultAgent!: Agent | null;
	private workers!: Worker[] | null;
	private numWorkers!: number;
	private globalTime!: number;

	public static get Instance(): Simulator {
		return Simulator.instance;
	}

	/**
	 * Adds a new agent with default properties to the simulation.
	 *
	 * @returns The number of the agent, or -1 when the agent defaults have
	 * not been set.
	 *
	 * @param position The two-dimensional starting position of this
	 * agent.
	 */
	addAgent(position: Vector): number;
	/**
	 * Adds a new agent to the simulation.
	 *
	 * @returns The number of the agent.
	 *
	 * @param position The two-dimensional starting position of this
	 * agent.
	 * @param neighborDist The maximum distance (center point to
	 * center point) to other agents this agent takes into account in the
	 * navigation. The larger this number, the longer the running time of
	 * the simulation. If the number is too low, the simulation will not be
	 * safe. Must be non-negative.
	 * @param maxNeighbors The maximum number of other agents this
	 * agent takes into account in the navigation. The larger this number,
	 * the longer the running time of the simulation. If the number is too
	 * low, the simulation will not be safe.
	 * @param timeHorizon The minimal amount of time for which this
	 * agent's velocities that are computed by the simulation are safe with
	 * respect to other agents. The larger this number, the sooner this
	 * agent will respond to the presence of other agents, but the less
	 * freedom this agent has in choosing its velocities. Must be positive.
	 * @param timeHorizonObst The minimal amount of time for which
	 * this agent's velocities that are computed by the simulation are safe
	 * with respect to obstacles. The larger this number, the sooner this
	 * agent will respond to the presence of obstacles, but the less freedom
	 * this agent has in choosing its velocities. Must be positive.
	 * @param radius The radius of this agent. Must be non-negative.
	 * @param maxSpeed The maximum speed of this agent. Must be
	 * non-negative.
	 * @param velocity The initial two-dimensional linear velocity of
	 * this agent.
	 */
	addAgent(
		position: Vector,
		neighborDist: number,
		maxNeighbors: number,
		timeHorizon: number,
		timeHorizonObst: number,
		radius: number,
		maxSpeed: number,
		velocity: Vector,
	): number;
	addAgent(
		position: Vector,
		neighborDist?: number,
		maxNeighbors?: number,
		timeHorizon?: number,
		timeHorizonObst?: number,
		radius?: number,
		maxSpeed?: number,
		velocity?: Vector,
	): number {
		if (neighborDist === undefined) {
			if (this.defaultAgent === null) {
				return -1;
			}

			let agent: Agent = new Agent();
			agent.id = this.agents.length;
			agent.maxNeighbors = this.defaultAgent.maxNeighbors;
			agent.maxSpeed = this.defaultAgent.maxSpeed;
			agent.neighborDist = this.defaultAgent.neighborDist;
			agent.position = position;
			agent.radius = this.defaultAgent.radius;
			agent.timeHorizon = this.defaultAgent.timeHorizon;
			agent.timeHorizonObst = this.defaultAgent.timeHorizonObst;
			agent.velocity = this.defaultAgent.velocity;
			this.agents.push(agent);

			return agent.id;
		} else {
			let agent: Agent = new Agent();
			agent.id = this.agents.length;
			agent.maxNeighbors = maxNeighbors!;
			agent.maxSpeed = maxSpeed!;
			agent.neighborDist = neighborDist!;
			agent.position = position;
			agent.radius = radius!;
			agent.timeHorizon = timeHorizon!;
			agent.timeHorizonObst = timeHorizonObst!;
			agent.velocity = velocity!;
			this.agents.push(agent);

			return agent.id;
		}
	}

	/**
	 * Adds a new obstacle to the simulation.
	 *
	 * @returns The number of the first vertex of the obstacle, or -1 when
	 * the number of vertices is less than two.
	 *
	 * @param vertices List of the vertices of the polygonal obstacle
	 * in counterclockwise order.
	 *
	 * To add a "negative" obstacle, e.g. a bounding polygon around
	 * the environment, the vertices should be listed in clockwise order.
	 */
	addObstacle(vertices: Vector[]): number {
		if (vertices.length < 2) {
			return -1;
		}

		let obstacleNo: number = this.obstacles.length;

		for (let i = 0; i < vertices.length; ++i) {
			let obstacle: Obstacle = new Obstacle();
			obstacle.point = vertices[i];

			if (i !== 0) {
				obstacle.previous = this.obstacles[this.obstacles.length - 1];
				obstacle.previous.next = obstacle;
			}

			if (i === vertices.length - 1) {
				obstacle.next = this.obstacles[obstacleNo];
				obstacle.next.previous = obstacle;
			}

			obstacle.direction = vertices[i === vertices.length - 1 ? 0 : i + 1]
				.sub(vertices[i])
				.normalize();

			if (vertices.length === 2) {
				obstacle.convex = true;
			} else {
				obstacle.convex =
					Vector.leftOf(
						vertices[i === 0 ? vertices.length - 1 : i - 1],
						vertices[i],
						vertices[i === vertices.length - 1 ? 0 : i + 1],
					) >= 0.0;
			}

			obstacle.id = this.obstacles.length;
			this.obstacles.push(obstacle);
		}

		return obstacleNo;
	}

	/**
	 * Clears the simulation.
	 */
	Clear(): void {
		this.agents = [];
		this.defaultAgent = null;
		this.kdTree = new KdTree();
		this.obstacles = [];
		this.globalTime = 0.0;
		this.timeStep = 0.1;

		this.SetNumWorkers(0);
	}

	/**
	 * Performs a simulation step and updates the two-dimensional
	 * position and two-dimensional velocity of each agent.
	 *
	 * @returns The global time after the simulation step.
	 */
	doStep(): number {
		if (this.workers === null) {
			this.workers = Array.from({ length: this.numWorkers }) as Worker[];

			for (let block = 0; block < this.workers.length; ++block) {
				this.workers[block] = new Worker(
					Math.floor((block * this.getNumAgents()) / this.workers.length),
					Math.floor(((block + 1) * this.getNumAgents()) / this.workers.length),
				);
			}
		}

		this.kdTree.buildAgentTree();

		for (let block = 0; block < this.workers.length; ++block) {
			this.workers[block].step();
		}

		for (let block = 0; block < this.workers.length; ++block) {
			this.workers[block].update();
		}

		this.globalTime += this.timeStep;

		return this.globalTime;
	}

	/**
	 * Returns the specified agent neighbor of the specified agent.
	 *
	 * @returns The number of the neighboring agent.
	 *
	 * @param agentNo The number of the agent whose agent neighbor is
	 * to be retrieved.
	 * @param neighborNo The number of the agent neighbor to be
	 * retrieved.
	 */
	getAgentAgentNeighbor(agentNo: number, neighborNo: number): number {
		return this.agents[agentNo].agentNeighbors[neighborNo].value.id;
	}

	/**
	 * Returns the maximum neighbor count of a specified agent.
	 *
	 * @returns The present maximum neighbor count of the agent.
	 *
	 * @param agentNo The number of the agent whose maximum neighbor
	 * count is to be retrieved.
	 */
	getAgentMaxNeighbors(agentNo: number): number {
		return this.agents[agentNo].maxNeighbors;
	}

	/**
	 * Returns the maximum speed of a specified agent.
	 *
	 * @returns The present maximum speed of the agent.
	 *
	 * @param agentNo The number of the agent whose maximum speed is
	 * to be retrieved.
	 */
	getAgentMaxSpeed(agentNo: number): number {
		return this.agents[agentNo].maxSpeed;
	}

	/**
	 * Returns the maximum neighbor distance of a specified agent.
	 *
	 * @returns The present maximum neighbor distance of the agent.
	 *
	 * @param agentNo The number of the agent whose maximum neighbor
	 * distance is to be retrieved.
	 */
	getAgentNeighborDist(agentNo: number): number {
		return this.agents[agentNo].neighborDist;
	}

	/**
	 * Returns the count of agent neighbors taken into account to
	 * compute the current velocity for the specified agent.
	 *
	 * @returns The count of agent neighbors taken into account to compute
	 * the current velocity for the specified agent.
	 *
	 * @param agentNo The number of the agent whose count of agent
	 * neighbors is to be retrieved.
	 */
	getAgentNumAgentNeighbors(agentNo: number): number {
		return this.agents[agentNo].agentNeighbors.length;
	}

	/**
	 * Returns the count of obstacle neighbors taken into account
	 * to compute the current velocity for the specified agent.
	 *
	 * @returns The count of obstacle neighbors taken into account to
	 * compute the current velocity for the specified agent.
	 *
	 * @param agentNo The number of the agent whose count of obstacle
	 * neighbors is to be retrieved.
	 */
	getAgentNumObstacleNeighbors(agentNo: number): number {
		return this.agents[agentNo].obstacleNeighbors.length;
	}

	/**
	 * Returns the specified obstacle neighbor of the specified
	 * agent.
	 *
	 * @returns The number of the first vertex of the neighboring obstacle
	 * edge.
	 *
	 * @param agentNo The number of the agent whose obstacle neighbor
	 * is to be retrieved.
	 * @param neighborNo The number of the obstacle neighbor to be
	 * retrieved.
	 */
	getAgentObstacleNeighbor(agentNo: number, neighborNo: number): number {
		return this.agents[agentNo].obstacleNeighbors[neighborNo].value.id;
	}

	/**
	 * Returns the ORCA constraints of the specified agent.
	 *
	 * @returns A list of lines representing the ORCA constraints.
	 *
	 * @param agentNo The number of the agent whose ORCA constraints
	 * are to be retrieved.
	 *
	 * The halfplane to the left of each line is the region of
	 * permissible velocities with respect to that ORCA constraint.
	 */
	getAgentOrcaLines(agentNo: number): Line[] {
		return this.agents[agentNo].orcaLines;
	}

	/**
	 * Returns the two-dimensional position of a specified agent.
	 *
	 * @returns The present two-dimensional position of the (center of the)
	 * agent.
	 *
	 * @param agentNo The number of the agent whose two-dimensional
	 * position is to be retrieved.
	 */
	getAgentPosition(agentNo: number): Vector {
		return this.agents[agentNo].position;
	}

	/**
	 * Returns the two-dimensional preferred velocity of a
	 * specified agent.
	 *
	 * @returns The present two-dimensional preferred velocity of the agent.
	 *
	 * @param agentNo The number of the agent whose two-dimensional
	 * preferred velocity is to be retrieved.
	 */
	getAgentPrefVelocity(agentNo: number): Vector {
		return this.agents[agentNo].prefVelocity;
	}

	/**
	 * Returns the radius of a specified agent.
	 *
	 * @returns The present radius of the agent.
	 *
	 * @param agentNo The number of the agent whose radius is to be
	 * retrieved.
	 */
	getAgentRadius(agentNo: number): number {
		return this.agents[agentNo].radius;
	}

	/**
	 * Returns the time horizon of a specified agent.
	 *
	 * @returns The present time horizon of the agent.
	 *
	 * @param agentNo The number of the agent whose time horizon is
	 * to be retrieved.
	 */
	getAgentTimeHorizon(agentNo: number): number {
		return this.agents[agentNo].timeHorizon;
	}

	/**
	 * Returns the time horizon with respect to obstacles of a
	 * specified agent.
	 *
	 * @returns The present time horizon with respect to obstacles of the
	 * agent.
	 *
	 * @param agentNo The number of the agent whose time horizon with
	 * respect to obstacles is to be retrieved.
	 */
	getAgentTimeHorizonObst(agentNo: number): number {
		return this.agents[agentNo].timeHorizonObst;
	}

	/**
	 * Returns the two-dimensional linear velocity of a specified
	 * agent.
	 *
	 * @returns The present two-dimensional linear velocity of the agent.
	 *
	 * @param agentNo The number of the agent whose two-dimensional
	 * linear velocity is to be retrieved.
	 */
	getAgentVelocity(agentNo: number): Vector {
		return this.agents[agentNo].velocity;
	}

	/**
	 * Returns the global time of the simulation.
	 *
	 * @returns The present global time of the simulation (zero initially).
	 */
	getGlobalTime(): number {
		return this.globalTime;
	}

	/**
	 * Returns the count of agents in the simulation.
	 *
	 * @returns The count of agents in the simulation.
	 */
	getNumAgents(): number {
		return this.agents.length;
	}

	/**
	 * Returns the count of obstacle vertices in the simulation.
	 *
	 * @returns The count of obstacle vertices in the simulation.
	 */
	getNumObstacleVertices(): number {
		return this.obstacles.length;
	}

	/**
	 * Returns the count of workers.
	 *
	 * @returns The count of workers.
	 */
	GetNumWorkers(): number {
		return this.numWorkers;
	}

	/**
	 * Returns the two-dimensional position of a specified obstacle
	 * vertex.
	 *
	 * @returns The two-dimensional position of the specified obstacle
	 * vertex.
	 *
	 * @param vertexNo The number of the obstacle vertex to be
	 * retrieved.
	 */
	getObstacleVertex(vertexNo: number): Vector {
		return this.obstacles[vertexNo].point;
	}

	/**
	 * Returns the number of the obstacle vertex succeeding the
	 * specified obstacle vertex in its polygon.
	 *
	 * @returns The number of the obstacle vertex succeeding the specified
	 * obstacle vertex in its polygon.
	 *
	 * @param vertexNo The number of the obstacle vertex whose
	 * successor is to be retrieved.
	 */
	getNextObstacleVertexNo(vertexNo: number): number {
		return this.obstacles[vertexNo].next.id;
	}

	/**
	 * Returns the number of the obstacle vertex preceding the
	 * specified obstacle vertex in its polygon.
	 *
	 * @returns The number of the obstacle vertex preceding the specified
	 * obstacle vertex in its polygon.
	 *
	 * @param vertexNo The number of the obstacle vertex whose
	 * predecessor is to be retrieved.
	 */
	getPrevObstacleVertexNo(vertexNo: number): number {
		return this.obstacles[vertexNo].previous.id;
	}

	/**
	 * Returns the time step of the simulation.
	 *
	 * @returns The present time step of the simulation.
	 */
	getTimeStep(): number {
		return this.timeStep;
	}

	/**
	 * Processes the obstacles that have been added so that they
	 * are accounted for in the simulation.
	 *
	 * Obstacles added to the simulation after this function has
	 * been called are not accounted for in the simulation.
	 */
	processObstacles(): void {
		this.kdTree.buildObstacleTree();
	}

	/**
	 * Performs a visibility query between the two specified points
	 * with respect to the obstacles.
	 *
	 * @returns A boolean specifying whether the two points are mutually
	 * visible. Returns true when the obstacles have not been processed.
	 *
	 * @param point1 The first point of the query.
	 * @param point2 The second point of the query.
	 * @param radius The minimal distance between the line connecting
	 * the two points and the obstacles in order for the points to be
	 * mutually visible (optional). Must be non-negative.
	 */
	queryVisibility(point1: Vector, point2: Vector, radius: number): boolean {
		return this.kdTree.queryVisibility(point1, point2, radius);
	}

	/**
	 * Sets the default properties for any new agent that is added.
	 *
	 * @param neighborDist The default maximum distance (center point
	 * to center point) to other agents a new agent takes into account in
	 * the navigation. The larger this number, the longer he running time of
	 * the simulation. If the number is too low, the simulation will not be
	 * safe. Must be non-negative.
	 * @param maxNeighbors The default maximum number of other agents
	 * a new agent takes into account in the navigation. The larger this
	 * number, the longer the running time of the simulation. If the number
	 * is too low, the simulation will not be safe.
	 * @param timeHorizon The default minimal amount of time for
	 * which a new agent's velocities that are computed by the simulation
	 * are safe with respect to other agents. The larger this number, the
	 * sooner an agent will respond to the presence of other agents, but the
	 * less freedom the agent has in choosing its velocities. Must be
	 * positive.
	 * @param timeHorizonObst The default minimal amount of time for
	 * which a new agent's velocities that are computed by the simulation
	 * are safe with respect to obstacles. The larger this number, the
	 * sooner an agent will respond to the presence of obstacles, but the
	 * less freedom the agent has in choosing its velocities. Must be
	 * positive.
	 * @param radius The default radius of a new agent. Must be
	 * non-negative.
	 * @param maxSpeed The default maximum speed of a new agent. Must
	 * be non-negative.
	 * @param velocity The default initial two-dimensional linear
	 * velocity of a new agent.
	 */
	setAgentDefaults(
		neighborDist: number,
		maxNeighbors: number,
		timeHorizon: number,
		timeHorizonObst: number,
		radius: number,
		maxSpeed: number,
		velocity: Vector,
	): void {
		if (this.defaultAgent === null) {
			this.defaultAgent = new Agent();
		}

		this.defaultAgent.maxNeighbors = maxNeighbors;
		this.defaultAgent.maxSpeed = maxSpeed;
		this.defaultAgent.neighborDist = neighborDist;
		this.defaultAgent.radius = radius;
		this.defaultAgent.timeHorizon = timeHorizon;
		this.defaultAgent.timeHorizonObst = timeHorizonObst;
		this.defaultAgent.velocity = velocity;
	}

	/**
	 * Sets the maximum neighbor count of a specified agent.
	 *
	 * @param agentNo The number of the agent whose maximum neighbor
	 * count is to be modified.
	 * @param maxNeighbors The replacement maximum neighbor count.
	 */
	setAgentMaxNeighbors(agentNo: number, maxNeighbors: number): void {
		this.agents[agentNo].maxNeighbors = maxNeighbors;
	}

	/**
	 * Sets the maximum speed of a specified agent.
	 *
	 * @param agentNo The number of the agent whose maximum speed is
	 * to be modified.
	 * @param maxSpeed The replacement maximum speed. Must be
	 * non-negative.
	 */
	setAgentMaxSpeed(agentNo: number, maxSpeed: number): void {
		this.agents[agentNo].maxSpeed = maxSpeed;
	}

	/**
	 * Sets the maximum neighbor distance of a specified agent.
	 *
	 * @param agentNo The number of the agent whose maximum neighbor
	 * distance is to be modified.
	 * @param neighborDist The replacement maximum neighbor distance.
	 * Must be non-negative.
	 */
	setAgentNeighborDist(agentNo: number, neighborDist: number): void {
		this.agents[agentNo].neighborDist = neighborDist;
	}

	/**
	 * Sets the two-dimensional position of a specified agent.
	 *
	 * @param agentNo The number of the agent whose two-dimensional
	 * position is to be modified.
	 * @param position The replacement of the two-dimensional
	 * position.
	 */
	setAgentPosition(agentNo: number, position: Vector): void {
		this.agents[agentNo].position = position;
	}

	/**
	 * Sets the two-dimensional preferred velocity of a specified
	 * agent.
	 *
	 * @param agentNo The number of the agent whose two-dimensional
	 * preferred velocity is to be modified.
	 * @param prefVelocity The replacement of the two-dimensional
	 * preferred velocity.
	 */
	setAgentPrefVelocity(agentNo: number, prefVelocity: Vector): void {
		this.agents[agentNo].prefVelocity = prefVelocity;
	}

	/**
	 * Sets the radius of a specified agent.
	 *
	 * @param agentNo The number of the agent whose radius is to be
	 * modified.
	 * @param radius The replacement radius. Must be non-negative.
	 */
	setAgentRadius(agentNo: number, radius: number): void {
		this.agents[agentNo].radius = radius;
	}

	/**
	 * Sets the time horizon of a specified agent with respect to
	 * other agents.
	 *
	 * @param agentNo The number of the agent whose time horizon is
	 * to be modified.
	 * @param timeHorizon The replacement time horizon with respect
	 * to other agents. Must be positive.
	 */
	setAgentTimeHorizon(agentNo: number, timeHorizon: number): void {
		this.agents[agentNo].timeHorizon = timeHorizon;
	}

	/**
	 * Sets the time horizon of a specified agent with respect to
	 * obstacles.
	 *
	 * @param agentNo The number of the agent whose time horizon with
	 * respect to obstacles is to be modified.
	 * @param timeHorizonObst The replacement time horizon with
	 * respect to obstacles. Must be positive.
	 */
	setAgentTimeHorizonObst(agentNo: number, timeHorizonObst: number): void {
		this.agents[agentNo].timeHorizonObst = timeHorizonObst;
	}

	/**
	 * Sets the two-dimensional linear velocity of a specified
	 * agent.
	 *
	 * @param agentNo The number of the agent whose two-dimensional
	 * linear velocity is to be modified.
	 * @param velocity The replacement two-dimensional linear
	 * velocity.
	 */
	setAgentVelocity(agentNo: number, velocity: Vector): void {
		this.agents[agentNo].velocity = velocity;
	}

	/**
	 * Sets the global time of the simulation.
	 *
	 * @param globalTime The global time of the simulation.
	 */
	setGlobalTime(globalTime: number): void {
		this.globalTime = globalTime;
	}

	/**
	 * Sets the number of workers.
	 *
	 * @param numWorkers The number of workers.
	 */
	SetNumWorkers(numWorkers: number): void {
		this.numWorkers = numWorkers;

		if (this.numWorkers <= 0) {
			this.numWorkers = 1;
		}
		this.workers = null;
	}

	/**
	 * Sets the time step of the simulation.
	 *
	 * @param timeStep The time step of the simulation. Must be
	 * positive.
	 */
	setTimeStep(timeStep: number): void {
		this.timeStep = timeStep;
	}

	/**
	 * Constructs and initializes a simulation.
	 */
	private constructor() {
		this.Clear();
	}
}
