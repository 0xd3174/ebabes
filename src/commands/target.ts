import type { Command } from './types.js';

export default {
	name: 'target',
	privileged: true,
	execute(args, ctx) {
		const senderEntity = Object.values(ctx.client.game.entities).find(
			(p) => p.name === ctx.sender,
		);

		if (!senderEntity) {
			ctx.client.sendChatMessage('Could not find your player to set target.');
			return;
		}

		ctx.client.target = { x: senderEntity.x, y: senderEntity.y };

		ctx.client.sendChatMessage(
			`Target set to position: x: ${Math.round(senderEntity.x)}, y: ${Math.round(senderEntity.y)}`,
		);
	},
} as Command;
