import type { Interaction } from 'discord.js';
import type { KythiaContainer } from './KythiaContainer';
import type { KythiaCommandModule } from './AddonManager';

// Tipe untuk satu middleware
export interface KythiaMiddleware {
	name: string;
	priority?: number;
	execute: (
		interaction: Interaction,
		command: KythiaCommandModule,
		container: KythiaContainer,
	) => Promise<boolean>;
}

// Interface untuk Managernya (yang dipake di Container)
export interface IMiddlewareManager {
	middlewares: KythiaMiddleware[];
	loadMiddlewares(): Promise<void>;
	handle(interaction: Interaction, command: KythiaCommandModule): Promise<boolean>;
}
