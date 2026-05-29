import type { Command } from './types.js';

export default {
	name: 'follow',
	privileged: true,
	execute(args, ctx) {
		ctx.client.following = !ctx.client.following;

		if (!ctx.client.following) {
			ctx.client.target = undefined;

			ctx.client.sendClientPayload({
				mouseDown: {
					updated: false,
					x: ctx.client.selfEntity.x,
					y: ctx.client.selfEntity.y,
				},
			});
		}
	},
} as Command;
