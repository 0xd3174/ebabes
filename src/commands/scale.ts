import type { Command } from './types.js';

export default {
	name: 'scale',
	privileged: true,
	execute(args, ctx) {
		const scale = parseFloat(args[0]);

		if (isNaN(scale)) {
			return ctx.client.sendChatMessage('Error parsing numbers!');
		}

		ctx.client.scale = scale;
	},
} as Command;
