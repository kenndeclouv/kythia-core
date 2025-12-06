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
	name: 'voteLocked',
	priority: 15,
	async execute(interaction, command, container) {
		if (!command.voteLocked) return true;
		if (container.helpers.discord.isOwner(interaction.user.id)) return true;

		const { KythiaVoter } = container.models;
		const { kythiaConfig, t } = container;

		const voter = await KythiaVoter.getCache({ userId: interaction.user.id });
		const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

		if (!voter || voter.votedAt < twelveHoursAgo) {
			const voter = await KythiaVoter.getCache({
				userId: interaction.user.id,
			});
			const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

			if (!voter || voter.votedAt < twelveHoursAgo) {
				const container = new ContainerBuilder().setAccentColor(
					convertColor(kythiaConfig.bot.color, {
						from: 'hex',
						to: 'decimal',
					}),
				);
				container.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(
						await t(interaction, 'common.error.vote.locked.text'),
					),
				);
				container.addSeparatorComponents(
					new SeparatorBuilder()
						.setSpacing(SeparatorSpacingSize.Small)
						.setDivider(true),
				);
				container.addActionRowComponents(
					new ActionRowBuilder().addComponents(
						new ButtonBuilder()
							.setLabel(
								await t(interaction, 'common.error.vote.locked.button', {
									username: interaction.client.user.username,
								}),
							)
							.setStyle(ButtonStyle.Link)
							.setURL(`https://top.gg/bot/${kythiaConfig.bot.clientId}/vote`),
					),
				);
				container.addSeparatorComponents(
					new SeparatorBuilder()
						.setSpacing(SeparatorSpacingSize.Small)
						.setDivider(true),
				);
				container.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(
						await t(interaction, 'common.container.footer', {
							username: interaction.client.user.username,
						}),
					),
				);
				return interaction.reply({
					components: [container],
					flags: MessageFlags.IsComponentsV2,
				});
			}
			return false;
		}

		return true;
	},
};
