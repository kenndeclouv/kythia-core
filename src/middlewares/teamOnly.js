const { MessageFlags } = require('discord.js');

module.exports = {
	name: 'teamOnly',
	priority: 3,
	async execute(interaction, command, container) {
		if (!command.teamOnly) return true;
		if (container.helpers.discord.isOwner(interaction.user.id)) return true;

		const isTeamMember = await container.helpers.discord.isTeam(
			interaction.user,
		);
		if (!isTeamMember) {
			await interaction.reply({
				content: await container.t(interaction, 'common.error.not.team'),
				flags: MessageFlags.Ephemeral,
			});
			return false;
		}
		return true;
	},
};
