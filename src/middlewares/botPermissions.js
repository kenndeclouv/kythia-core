const { MessageFlags } = require('discord.js');

const formatPerms = (permsArray) =>
	permsArray.map((perm) => perm.replace(/([A-Z])/g, ' $1').trim()).join(', ');

module.exports = {
	name: 'botPermissions',
	priority: 6,
	async execute(interaction, command, container) {
		if (!command.botPermissions || !interaction.inGuild()) return true;

		const missingPerms = interaction.guild.members.me.permissions.missing(
			command.botPermissions,
		);

		if (missingPerms.length > 0) {
			await interaction.reply({
				content: await container.t(
					interaction,
					'common.error.bot.missing.perms',
					{ perms: formatPerms(missingPerms) },
				),
				flags: MessageFlags.Ephemeral,
			});
			return false;
		}

		return true;
	},
};
