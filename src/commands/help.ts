import { commands } from './index.js';
import type { Command } from './types.js';

export default {
	name: 'help',
	execute(args, ctx) {
		ctx.client.sendChatMessage(
			`Available commands: ${Object.keys(commands).join(', ')}`,
		);
	},
} as Command;
