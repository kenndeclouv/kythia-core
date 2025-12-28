import {
	ContainerBuilder,
	TextDisplayBuilder,
	SeparatorBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
	SeparatorSpacingSize,
	type Interaction,
} from 'discord.js';
import type {
	KythiaMiddleware,
	KythiaContainer,
	KythiaCommandModule,
} from '../types';
import { convertColor } from '../utils/color';

const isInMainGuild: KythiaMiddleware = {
	name: 'isInMainGuild',
	priority: 7,

	async execute(
		interaction: Interaction,
		command: KythiaCommandModule,
		container: KythiaContainer,
	): Promise<boolean> {
		if (!command.isInMainGuild) return true;
		if (container.helpers.discord.isOwner(interaction.user.id)) return true;

		const { client, kythiaConfig, t, logger } = container;
		const mainGuildId = kythiaConfig.bot.mainGuildId;

		if (!mainGuildId) return true;

		const mainGuild = client.guilds.cache.get(mainGuildId);

		if (!mainGuild) {
			logger.error(
				`❌ [isInMainGuild Check] Error: Bot is not a member of main guild: ${mainGuildId}`,
			);
			return true;
		}

		try {
			await mainGuild.members.fetch(interaction.user.id);
			return true;
		} catch (_e) {
			const errContainer = new ContainerBuilder().setAccentColor(
				convertColor(kythiaConfig.bot.color, { from: 'hex', to: 'decimal' }),
			);

			errContainer.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					await t(interaction, 'common.error.not.in.main.guild.text', {
						name: mainGuild.name,
					}),
				),
			);
			errContainer.addSeparatorComponents(
				new SeparatorBuilder()
					.setSpacing(SeparatorSpacingSize.Small)
					.setDivider(true),
			);
			errContainer.addActionRowComponents(
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setLabel(
							await t(
								interaction,
								'common.error.not.in.main.guild.button.join',
							),
						)
						.setStyle(ButtonStyle.Link)
						.setURL(kythiaConfig.settings.supportServer),
				),
			);
			errContainer.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					await t(interaction, 'common.container.footer', {
						username: client.user?.username || 'Kythia',
					}),
				),
			);

			if (interaction.isRepliable()) {
				await interaction.reply({
					components: [errContainer as ContainerBuilder],
					flags: MessageFlags.IsComponentsV2,
				});
			}
			return false;
		}
	},
};

export default isInMainGuild;
