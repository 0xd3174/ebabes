import ctargetCommand from './ctarget.js';
import followCommand from './follow.js';
import helpCommand from './help.js';
import pingCommand from './ping.js';
import pointsCommand from './points.js';
import sayCommand from './say.js';
import scaleCommand from './scale.js';
import speedCommand from './speed.js';
import stopCommand from './stop.js';
import targetCommand from './target.js';
import type { Command } from './types.js';
import warpCommand from './warp.js';

export const commands: { [key: string]: Command } = {
	[pingCommand.name]: pingCommand,
	[sayCommand.name]: sayCommand,
	[warpCommand.name]: warpCommand,
	[followCommand.name]: followCommand,
	[pointsCommand.name]: pointsCommand,
	[speedCommand.name]: speedCommand,
	[helpCommand.name]: helpCommand,
	[targetCommand.name]: targetCommand,
	[stopCommand.name]: stopCommand,
	[ctargetCommand.name]: ctargetCommand,
	[scaleCommand.name]: scaleCommand,
} as const;

export * from './types.js';
