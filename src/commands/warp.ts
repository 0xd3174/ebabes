import type { Command } from './types.js';

export default {
	name: 'warp',
	privileged: true,
	execute(args, ctx) {
		ctx.client.sendChatMessage(`/warp ${args[0]}`);
	},
} as Command;
