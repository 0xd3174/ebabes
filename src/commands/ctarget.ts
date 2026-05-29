import type { Command } from './types.js';

export default {
	name: 'ctarget',
	privileged: true,
	execute(args, ctx) {
		const x = parseInt(args[0], 10);
		const y = parseInt(args[1], 10);

		if (isNaN(x) || isNaN(y)) {
			return ctx.client.sendChatMessage('Error parsing numbers!');
		}

		ctx.client.target = { x, y };

		ctx.client.sendChatMessage(
			`Target set to position: x: ${Math.round(x)}, y: ${Math.round(y)}`,
		);
	},
} as Command;
