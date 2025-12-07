import {
	MessageFlags,
	type Interaction,
	type PermissionsString,
} from 'discord.js';
import type { KythiaMiddleware, KythiaContainer } from '../types';

const formatPerms = (permsArray: string[]): string =>
	permsArray.map((perm) => perm.replace(/([A-Z])/g, ' $1').trim()).join(', ');

const botPermissions: KythiaMiddleware = {
	name: 'botPermissions',
	priority: 6,
	async execute(
		interaction: Interaction,
		command: any,
		container: KythiaContainer,
	): Promise<boolean> {
		if (!command.botPermissions || !interaction.inGuild() || !interaction.guild)
			return true;

		const me = interaction.guild.members.me;
		if (!me) return true; // Safety check

		const missingPerms = me.permissions.missing(
			command.botPermissions as PermissionsString[],
		);

		if (missingPerms.length > 0) {
			if (interaction.isRepliable()) {
				await interaction.reply({
					content: await container.t(
						interaction,
						'common.error.bot.missing.perms',
						{ perms: formatPerms(missingPerms) },
					),
					flags: MessageFlags.Ephemeral,
				});
			}
			return false;
		}

		return true;
	},
};

export default botPermissions;
