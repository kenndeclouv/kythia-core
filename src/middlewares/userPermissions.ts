import {
	MessageFlags,
	type Interaction,
	type PermissionsString,
} from 'discord.js';
import type {
	KythiaMiddleware,
	KythiaContainer,
	KythiaCommandModule,
} from '../types';

const formatPerms = (permsArray: string[]): string =>
	permsArray.map((perm) => perm.replace(/([A-Z])/g, ' $1').trim()).join(', ');

const userPermissions: KythiaMiddleware = {
	name: 'userPermissions',
	priority: 5,
	async execute(
		interaction: Interaction,
		command: KythiaCommandModule,
		container: KythiaContainer,
	): Promise<boolean> {
		if (!command.permissions || !interaction.inGuild()) return true;

		const member = interaction.member;
		if (!member || typeof (member as any).permissions.missing !== 'function')
			return true;

		const missingPerms = (member as any).permissions.missing(
			command.permissions as PermissionsString[],
		);

		if (missingPerms.length > 0) {
			if (interaction.isRepliable()) {
				await interaction.reply({
					content: await container.t(
						interaction,
						'common.error.user.missing.perms',
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

export default userPermissions;
