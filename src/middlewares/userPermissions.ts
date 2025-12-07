import {
	MessageFlags,
	type Interaction,
	type PermissionsString,
} from 'discord.js';
import type { KythiaMiddleware, KythiaContainer } from '../types';

const formatPerms = (permsArray: string[]): string =>
	permsArray.map((perm) => perm.replace(/([A-Z])/g, ' $1').trim()).join(', ');

const userPermissions: KythiaMiddleware = {
	name: 'userPermissions',
	priority: 5,
	async execute(
		interaction: Interaction,
		command: any,
		container: KythiaContainer,
	): Promise<boolean> {
		// Guard clause: Kalau command gak butuh perms atau bukan di guild, skip
		if (!command.permissions || !interaction.inGuild()) return true;

		// interaction.member di API interaction bisa null/APIInteractionGuildMember
		// Kita cast ke any dulu atau GuildMember kalau sudah di-fetch
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
