import type { Command } from './types.js';

export default {
	name: 'stop',
	privileged: true,
	execute(args, ctx) {
		ctx.client.target = undefined;

		ctx.client.sendChatMessage(`Stopped moving`);
	},
} as Command;
