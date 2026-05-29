import { Upgrades } from '../index.js';
import type { Command } from './types.js';

export default {
	name: 'upgrade',
	privileged: true,
	execute(args, ctx) {
		const upgrade = args[0].toUpperCase() as Upgrades;
		const amount = parseInt(args[1], 10);

		if (amount > ctx.client.selfEntity.upgradePoints) {
			return ctx.client.sendChatMessage(
				`Not enough points to upgrade, available points: ${ctx.client.selfEntity.upgradePoints}`,
			);
		}

		if (!Object.values(Upgrades).includes(upgrade)) {
			return ctx.client.sendChatMessage(
				`An unknown upgrade type, available upgrades: ${Object.values(Upgrades).join(', ')}`,
			);
		}

		if (upgrade === Upgrades.SPEED) ctx.client.selfSpeed += 30 * amount;

		ctx.client.upgradeHero(upgrade, amount);
	},
} as Command;
