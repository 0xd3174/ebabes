import { Entity } from './entity.js';
import { type Area, type Map } from './gen/evades_pb.js';
import { Vector } from './vo/index.js';

export const GAME_TICK_RATE = 60;

export class Game {
	entities: MapOf<Entity> = {};
	area?: Area;
	map?: Map;

	updateEntities(entities: MaybeArray<Entity>) {
		if (Array.isArray(entities)) {
			for (const entity of entities) {
				this.updateEntity(entity);
			}
			return;
		}

		this.updateEntity(entities);
	}

	updateEntity(entity: Entity) {
		const { entities } = this;

		if (entity.removed) {
			delete entities[entity.id];
			return;
		}

		let existing = entities[entity.id];

		if (!existing) {
			existing = new Entity(entity);
			entities[entity.id] = existing;
		} else {
			Object.assign(existing, entity);
			existing.pos = new Vector(entity.x, entity.y);
		}
	}
}
