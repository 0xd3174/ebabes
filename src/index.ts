import { type Message, type MessageInitShape } from '@bufbuild/protobuf';
import type { GenMessage } from '@bufbuild/protobuf/codegenv2';

import { decode as eDecode, encode } from './binary.js';
import { commands } from './commands/index.js';
import { getOrRefreshCookies } from './cookies.js';
import { Entity } from './entity.js';
import { env } from './env.js';
import { Game, GAME_TICK_RATE, startWebServer } from './game.js';
import {
	ClientPayloadSchema,
	FramePayloadSchema,
	HeroSelection,
	KeyEvent,
	KeyType,
	type ClientPayload,
	type FramePayload,
} from './gen/evades_pb.js';
import { Simulator } from './vo/simulator.js';
import { Vector } from './vo/vector.js';

function decodeBinary<T extends Message>(
	schema: GenMessage<T>,
	binary: string,
): T {
	return eDecode(schema, Buffer.from(binary));
}

enum CLIENT_STATES {
	INITIAL,
	LOGGEDIN,
	SURRENDED,
}

export class Client {
	socket!: WebSocket;
	selfId!: number;
	_selfEntity!: Entity;
	selfSpeed = 150;

	game = new Game();
	target?: { x: number; y: number };
	scale = 10;

	admin: string;

	heartbeatSeq = 0;
	state = CLIENT_STATES.INITIAL;
	following = false;
	isMoving = false;
	sequence = 1;

	name: string;
	password: string;

	constructor(name: string, password: string, admin: string) {
		this.name = name;
		this.password = password;
		this.admin = admin;
	}

	async connect(server: number): Promise<void> {
		const cookie = await getOrRefreshCookies(this.name, this.password);

		return new Promise<void>((resolve, reject) => {
			this.socket = new WebSocket(
				`wss://eu.evades.123000777.xyz/api/game/connect?backend=${server}&game=0`,
				{
					headers: {
						cookie,
					},
				},
			);

			this.socket.addEventListener('open', () => {
				console.log('Connected to server');
				resolve();
			});

			this.socket.addEventListener('message', (event) => {
				this.handleMessage(event);
			});

			this.socket.addEventListener('close', () => {
				console.log('Disconnected from server');
			});

			this.socket.addEventListener('error', (err) => {
				console.error('Socket error:', err);
				reject(err);
			});
		});
	}

	gameLoop = () => {
		const payload = {} as Omit<
			MessageInitShape<typeof ClientPayloadSchema>,
			'sequence'
		>;

		if (this.target) {
			const sim = Simulator.Instance;

			let speed = this.selfSpeed;

			if (this.selfEntity.totalSpeed > this.selfSpeed) {
				speed = this.selfEntity.totalSpeed;
			}

			sim.Clear();
			sim.setTimeStep(1 / GAME_TICK_RATE);

			sim.setAgentDefaults(500, 10, 1, 1, 15, speed, new Vector(0, 0));

			const myPos = new Vector(this.selfEntity.x, this.selfEntity.y);
			sim.addAgent(myPos);

			const targetVector = new Vector(this.target.x, this.target.y).sub(myPos);

			if (targetVector.absSq() > 1.0) {
				let weightedTarget = new Vector(targetVector.x, targetVector.y * 3);
				let preferredVel = weightedTarget.normalize().mul(speed);
				const perp = new Vector(-preferredVel.y, preferredVel.x)
					.normalize()
					.mul(0.01);
				preferredVel = preferredVel.add(perp);
				sim.setAgentPrefVelocity(0, preferredVel);
			}

			for (const id in this.game.entities) {
				const entity = this.game.entities[id];

				if (
					entity.id === this.selfId ||
					entity.entityType === 113 ||
					entity.entityType === 118
				) {
					continue;
				}

				if (entity.entityType === 228) {
					const { x, y, width, height } = entity;
					if (height > width) continue;
					if (width !== undefined && height !== undefined) {
						sim.addObstacle([
							new Vector(x, y),
							new Vector(x + width, y),
							new Vector(x + width, y + height),
							new Vector(x, y + height),
						]);
					}
					continue;
				}

				const enemyVelocity = entity.velocity.mul(GAME_TICK_RATE);

				const latency = 0.08;
				const predictedPos = entity.pos.add(enemyVelocity.mul(latency));

				const enemyId = sim.addAgent(predictedPos);

				const radius =
					entity.radius * 0.5 > 12 ? entity.radius * 1.5 : entity.radius + 10;

				sim.setAgentRadius(enemyId, radius);

				sim.setAgentVelocity(enemyId, enemyVelocity);
				sim.setAgentPrefVelocity(enemyId, enemyVelocity);
			}

			sim.processObstacles();

			sim.doStep();

			const safeVelocity = sim.getAgentVelocity(0);

			if (safeVelocity.absSq() > 0.1) {
				payload.mouseDown = {
					updated: true,
					x: Math.round(safeVelocity.x * this.scale),
					y: Math.round(safeVelocity.y * this.scale),
				};

				this.isMoving = true;
			} else if (this.isMoving) {
				payload.mouseDown = {
					updated: false,
					x: 0,
					y: 0,
				};

				this.isMoving = false;
			}
		}

		if (Object.keys(payload).length > 0) {
			this.sendClientPayload(payload);
		}
	};

	handleInitialMessage(_event: any) {
		try {
			// console.log(decodeBinary(ConnectionPayloadSchema, event.data));
			this.state = CLIENT_STATES.LOGGEDIN;
		} catch (err) {
			console.error(err);
			process.exit(1);
		}

		setInterval(() => {
			this.socket.send(
				encode(ClientPayloadSchema, {
					sequence: 0,
					ping: this.heartbeatSeq++,
				}),
			);
		}, 1000);

		setInterval(this.gameLoop, 1000 / GAME_TICK_RATE);
	}

	handleChatMessages(messages: any[]) {
		const PREFIX = '!';

		messages.forEach((e) => {
			if (!e.text.startsWith(PREFIX)) return;

			const parts = e.text.slice(PREFIX.length).trim().split(/ +/);
			const commandName = parts[0];

			const cmd = commands[commandName];
			if (!cmd) return;

			if (cmd.privileged && e.sender !== this.admin) {
				return this.sendChatMessage(
					"You don't have enough privileges to execute this command.",
				);
			}

			const args = parts.slice(1);

			cmd.execute(args, {
				client: this,
				sender: e.sender,
			});
		});
	}

	handleLoggedInMessage(data: FramePayload) {
		if (!this.selfId && data.selfId) this.selfId = data.selfId;

		if (data.chat?.messages) this.handleChatMessages(data.chat.messages);

		if (data.area) this.game.area = data.area;
		if (data.map) this.game.map = data.map;

		const entityFields = [
			'globalEntities',
			'entities',
			'xyEntities',
			'xEntities',
			'yEntities',
		] as const;

		entityFields.forEach((e) => {
			if (data[e]) this.game.updateEntities(data[e] as Entity[]);
		});
	}

	handleMessage(event: any) {
		if (this.state === CLIENT_STATES.INITIAL) {
			this.handleInitialMessage(event);
			return;
		}

		if (this.state === CLIENT_STATES.LOGGEDIN) {
			try {
				const data = decodeBinary(FramePayloadSchema, event.data);
				this.handleLoggedInMessage(data);
			} catch (err) {
				console.error(err);
				process.exit(1);
			}
		}
	}

	get selfEntity(): Entity {
		return this.game.entities[this.selfId];
	}

	selectHero(hero: HeroSelection) {
		if (this.socket.readyState === WebSocket.OPEN) {
			this.socket.send(
				encode(ClientPayloadSchema, {
					sequence: this.sequence++,
					heroSelection: hero,
				}),
			);
		}
	}

	sendChatMessage(message: string) {
		this.socket.send(
			encode(ClientPayloadSchema, {
				sequence: this.sequence++,
				message,
			}),
		);
	}

	upgradeHero(type: Upgrades, amount: number) {
		let counter = 0;

		const sendUpgrade = () => {
			if (counter === amount) {
				return this.sendChatMessage(
					`Legacy speed: ${this.selfEntity.totalSpeed}`,
				);
			}

			this.sendClientPayload({
				keys: [
					{
						keyEvent: KeyEvent.KEY_DOWN,
						keyType: KeyType[`UPGRADE_${type}_KEY`],
					},
				],
			});

			setTimeout(() => {
				this.sendClientPayload({
					keys: [
						{
							keyEvent: KeyEvent.KEY_UP,
							keyType: KeyType[`UPGRADE_${type}_KEY`],
						},
					],
				});

				counter++;
				setTimeout(sendUpgrade, 30);
			}, 30);
		};

		sendUpgrade();
	}

	sendClientPayload(
		payload: Omit<MessageInitShape<typeof ClientPayloadSchema>, 'sequence'>,
	) {
		this.socket.send(
			encode(ClientPayloadSchema, {
				...payload,
				sequence: this.sequence++,
			} as ClientPayload),
		);
	}
}

export enum Upgrades {
	SPEED = 'SPEED',
	MAX_ENERGY = 'MAX_ENERGY',
	ENERGY_REGEN = 'ENERGY_REGEN',
	ABILITY_ONE = 'ABILITY_ONE',
	ABILITY_TWO = 'ABILITY_TWO',
}

export const client = new Client(env.USERNAME, env.PASSWORD, 'SaveMePls');
await client.connect(7);

startWebServer(client);

setTimeout(() => {
	client.selectHero(HeroSelection.HERO_SELECTION_REAPER);
}, 5000);
