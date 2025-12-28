import { MessageFlags, type Interaction } from 'discord.js';
import type {
	KythiaMiddleware,
	KythiaContainer,
	KythiaCommandModule,
} from '../types';

const ownerOnly: KythiaMiddleware = {
	name: 'ownerOnly',
	priority: 1,
	async execute(
		interaction: Interaction,
		command: KythiaCommandModule,
		container: KythiaContainer,
	): Promise<boolean> {
		if (!command.ownerOnly) return true;

		const isOwner = container.helpers.discord.isOwner(interaction.user.id);

		if (!isOwner) {
			if (interaction.isRepliable()) {
				await interaction.reply({
					content: await container.t(interaction, 'common.error.not.owner'),
					flags: MessageFlags.Ephemeral,
				});
			}
			return false;
		}

		return true;
	},
};

export default ownerOnly;
