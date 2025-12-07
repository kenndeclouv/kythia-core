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
import type { KythiaMiddleware, KythiaContainer } from '../types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const convertColor = require('../utils/color');

const voteLocked: KythiaMiddleware = {
	name: 'voteLocked',
	priority: 15,
	async execute(
		interaction: Interaction,
		command: any,
		container: KythiaContainer,
	): Promise<boolean> {
		if (!command.voteLocked) return true;
		if (container.helpers.discord.isOwner(interaction.user.id)) return true;

		const { KythiaVoter } = container.models;
		const { kythiaConfig, t } = container;

		// Ambil data voter sekali aja
		const voter = await (KythiaVoter as any).getCache({ userId: interaction.user.id });
		const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

		// Cek: Belum pernah vote ATAU vote terakhir udah expired (lebih dari 12 jam lalu)
		if (!voter || new Date(voter.votedAt) < twelveHoursAgo) {
			const errContainer = new ContainerBuilder().setAccentColor(
				convertColor(kythiaConfig.bot.color, {
					from: 'hex',
					to: 'decimal',
				}),
			);

			errContainer.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					await t(interaction, 'common.error.vote.locked.text'),
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
							await t(interaction, 'common.error.vote.locked.button', {
								username: interaction.client.user.username,
							}),
						)
						.setStyle(ButtonStyle.Link)
						.setURL(`https://top.gg/bot/${kythiaConfig.bot.clientId}/vote`),
				),
			);

			errContainer.addSeparatorComponents(
				new SeparatorBuilder()
					.setSpacing(SeparatorSpacingSize.Small)
					.setDivider(true),
			);

			errContainer.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					await t(interaction, 'common.container.footer', {
						username: interaction.client.user.username,
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

		return true;
	},
};

export default voteLocked;
