const {
	ContainerBuilder,
	TextDisplayBuilder,
	SeparatorBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
	SeparatorSpacingSize,
} = require('discord.js');
const convertColor = require('../utils/color');

module.exports = {
	name: 'isInMainGuild',
	priority: 10,
	async execute(interaction, command, container) {
		if (!command.isInMainGuild) return true;
		if (container.helpers.discord.isOwner(interaction.user.id)) return true;

		const { client, kythiaConfig, t, logger } = container;
		const mainGuild = client.guilds.cache.get(kythiaConfig.bot.mainGuildId);

		if (!mainGuild) {
			logger.error(
				`❌ [isInMainGuild Check] Error: Bot is not a member of main guild: ${kythiaConfig.bot.mainGuildId}`,
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
				new ActionRowBuilder().addComponents(
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
						username: client.user.username,
					}),
				),
			);

			await interaction.reply({
				components: [errContainer],
				flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2,
			});
			return false;
		}
	},
};
