const { MessageFlags } = require('discord.js');

module.exports = {
	name: 'ownerOnly',
	priority: 1,
	async execute(interaction, command, container) {
		if (!command.ownerOnly) return true;

		const isOwner = container.helpers.discord.isOwner(interaction.user.id);

		if (!isOwner) {
			await interaction.reply({
				content: await container.t(interaction, 'common.error.not.owner'),
				flags: MessageFlags.Ephemeral,
			});
			return false;
		}

		return true;
	},
};
