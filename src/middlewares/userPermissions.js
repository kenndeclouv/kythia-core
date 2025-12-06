const { MessageFlags } = require('discord.js');

const formatPerms = (permsArray) =>
	permsArray.map((perm) => perm.replace(/([A-Z])/g, ' $1').trim()).join(', ');

module.exports = {
	name: 'userPermissions',
	priority: 5,
	async execute(interaction, command, container) {
		if (!command.permissions || !interaction.inGuild()) return true;

		const missingPerms = interaction.member.permissions.missing(
			command.permissions,
		);

		if (missingPerms.length > 0) {
			await interaction.reply({
				content: await container.t(
					interaction,
					'common.error.user.missing.perms',
					{ perms: formatPerms(missingPerms) },
				),
				flags: MessageFlags.Ephemeral,
			});
			return false;
		}

		return true;
	},
};
