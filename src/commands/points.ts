import type { Command } from './types.js';

export default {
	name: 'points',
	execute(args, ctx) {
		const points = ctx.client.selfEntity.upgradePoints ?? 0;
		ctx.client.sendChatMessage(points.toString());
	},
} as Command;
