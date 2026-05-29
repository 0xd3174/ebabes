import type { Command } from './types.js';

export default {
	name: 'ping',
	execute(args, ctx) {
		ctx.client.sendChatMessage('pong!');
	},
} as Command;
