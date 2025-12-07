import { MessageFlags, type Interaction } from 'discord.js';
import type { KythiaMiddleware, KythiaContainer } from '../types';

const teamOnly: KythiaMiddleware = {
	name: 'teamOnly',
	priority: 3,
	async execute(
		interaction: Interaction,
		command: any,
		container: KythiaContainer,
	): Promise<boolean> {
		if (!command.teamOnly) return true;
		if (container.helpers.discord.isOwner(interaction.user.id)) return true;

		const isTeamMember = await container.helpers.discord.isTeam(
			interaction.user.id,
		);

		if (!isTeamMember) {
			if (interaction.isRepliable()) {
				await interaction.reply({
					content: await container.t(interaction, 'common.error.not.team'),
					flags: MessageFlags.Ephemeral,
				});
			}
			return false;
		}
		return true;
	},
};

export default teamOnly;
