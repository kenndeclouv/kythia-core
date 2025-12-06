const { Collection, MessageFlags } = require('discord.js');

module.exports = {
	name: 'cooldown',
	priority: 20,
	async execute(interaction, command, container) {
		const { client, kythiaConfig, helpers } = container;

		if (helpers.discord.isOwner(interaction.user.id)) return true;

		const cooldownDuration =
			command.cooldown ?? kythiaConfig.bot.globalCommandCooldown ?? 15;
		if (cooldownDuration <= 0) return true;

		if (!client.cooldowns.has(command.name)) {
			client.cooldowns.set(command.name, new Collection());
		}

		const now = Date.now();
		const timestamps = client.cooldowns.get(command.name);
		const cooldownAmount = cooldownDuration * 1000;

		if (timestamps.has(interaction.user.id)) {
			const expirationTime =
				timestamps.get(interaction.user.id) + cooldownAmount;
			if (now < expirationTime) {
				const timeLeft = (expirationTime - now) / 1000;
				const reply = await container.t(interaction, 'common.error.cooldown', {
					time: timeLeft.toFixed(1),
				});
				await interaction.reply({
					content: reply,
					flags: MessageFlags.Ephemeral,
				});
				return false;
			}
		}

		timestamps.set(interaction.user.id, now);
		setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

		return true;
	},
};
