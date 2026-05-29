import type { Client } from '..';

export interface CommandContext {
	client: Client;
	sender: string;
}

export interface Command {
	name: string;
	privileged?: boolean;
	execute(args: string[], ctx: CommandContext): void;
}
