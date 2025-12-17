import type { Interaction } from 'discord.js';
import type { KythiaContainer } from './KythiaContainer';
import type { KythiaCommandModule } from './AddonManager';

export interface KythiaMiddleware {
	name: string;
	priority?: number;
	execute: (
		interaction: Interaction,
		command: KythiaCommandModule,
		container: KythiaContainer,
	) => Promise<boolean>;
}

export interface IMiddlewareManager {
	middlewares: KythiaMiddleware[];
	loadMiddlewares(): Promise<void>;
	handle(
		interaction: Interaction,
		command: KythiaCommandModule,
	): Promise<boolean>;
}
