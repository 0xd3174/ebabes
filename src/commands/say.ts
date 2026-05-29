import type { Command } from './types.js';

export default {
	name: 'say',
	execute(args, ctx) {
		ctx.client.sendChatMessage(args.join(' '));
	},
} as Command;
