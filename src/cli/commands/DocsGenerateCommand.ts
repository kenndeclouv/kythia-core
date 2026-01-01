/**
 * 📚 Documentation Generator
 *
 * @file src/cli/commands/DocsGenerateCommand.ts
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.9-beta
 */

import Command from '../Command';
import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import {
	SlashCommandBuilder,
	SlashCommandSubcommandBuilder,
	SlashCommandSubcommandGroupBuilder,
	ApplicationCommandOptionType,
	PermissionsBitField,
} from 'discord.js';
import { KythiaContainer } from '../../types';

interface CommandMetadata {
	aliases?: string[];
	ownerOnly?: boolean;
	teamOnly?: boolean;
	cooldown?: number;
	permissions?: bigint[];
	botPermissions?: bigint[];
}

interface SubcommandMetaMap {
	[key: string]: CommandMetadata;
}

export default class DocsGenerateCommand extends Command {
	public signature = 'docs:generate';
	public description =
		'Generate markdown documentation for all Discord commands';

	private markdownBuffers: Record<string, string> = {};
	private projectRoot = process.cwd();
	private addonsDir = path.join(process.cwd(), 'addons');
	private outputDir = path.join(process.cwd(), 'docs', 'commands');

	public configure(command: any): void {
		command.option('-p, --path <path>', 'Custom output path for documentation');
	}

	public async handle(options: { path?: string }): Promise<void> {
		console.log(pc.cyan('\n🚀 Starting documentation generator...\n'));

		// Resolve output path
		if (options.path) {
			this.outputDir = path.resolve(process.cwd(), options.path);
		}

		// Register module aliases
		this.registerModuleAliases(this.projectRoot);

		// Clear buffers
		this.markdownBuffers = {};

		if (!fs.existsSync(this.outputDir)) {
			fs.mkdirSync(this.outputDir, { recursive: true });
		}

		if (!fs.existsSync(this.addonsDir)) {
			console.error(pc.red(`❌ Addons directory not found: ${this.addonsDir}`));
			return;
		}

		const addons = fs
			.readdirSync(this.addonsDir, { withFileTypes: true })
			.filter((d) => d.isDirectory());

		for (const addon of addons) {
			const commandsPath = path.join(this.addonsDir, addon.name, 'commands');
			if (!fs.existsSync(commandsPath)) continue;

			console.log(pc.blue(`📦 Processing Addon: ${addon.name}`));
			this.processDirectory(commandsPath, addon.name);
		}

		console.log(pc.green('\n✅ Writing to .md files...'));
		for (const [cat, content] of Object.entries(this.markdownBuffers)) {
			const outputFilePath = path.join(this.outputDir, `${cat}.md`);
			fs.writeFileSync(outputFilePath, content);
			console.log(pc.green(`   -> Generated: ${cat}.md`));
		}
		console.log(pc.green('\n🎉 Finished!'));
	}

	private getSlashCommandBuilder(commandModule: any): any {
		if (!commandModule) return null;
		return commandModule.slashCommand || commandModule.data || null;
	}

	private getOptionType(type: ApplicationCommandOptionType): string {
		switch (type) {
			case ApplicationCommandOptionType.String:
				return 'Text';
			case ApplicationCommandOptionType.Integer:
				return 'Integer';
			case ApplicationCommandOptionType.Number:
				return 'Number';
			case ApplicationCommandOptionType.Boolean:
				return 'Boolean';
			case ApplicationCommandOptionType.User:
				return 'User';
			case ApplicationCommandOptionType.Channel:
				return 'Channel';
			case ApplicationCommandOptionType.Role:
				return 'Role';
			case ApplicationCommandOptionType.Mentionable:
				return 'Mentionable';
			case ApplicationCommandOptionType.Attachment:
				return 'Attachment';
			default:
				return 'Unknown';
		}
	}

	private generateOptionsDocs(optionsData: any[], isListStyle = false): string {
		let md = isListStyle ? '' : '### ⚙️ Options\n\n';
		for (const opt of optionsData) {
			md += `- **\`${opt.name}${opt.required ? '*' : ''}\`**\n`;
			md += `  - **Description:** ${opt.description}\n`;
			md += `  - **Type:** ${this.getOptionType(opt.type)}\n`;
			if (opt.choices) {
				const choicesString = opt.choices
					.map((c: any) => `\`${c.name}\` (\`${c.value}\`)`)
					.join(', ');
				md += `  - **Choices:** ${choicesString}\n`;
			}
		}
		return md;
	}

	private generateSubcommandDocs(
		parentName: string,
		subData: any,
		groupName: string | null = null,
		extraSubMeta: CommandMetadata | null = null,
	): string {
		const groupPrefix = groupName ? `${groupName} ` : '';
		const subOptions = subData.options || [];

		const usageString = subOptions
			.map((opt: any) => {
				const placeholder = `<${opt.name.toLowerCase()}>`;
				return opt.required ? placeholder : `[${placeholder}]`;
			})
			.join(' ');

		let md = `**\`/${parentName} ${groupPrefix}${subData.name}${usageString ? ` ${usageString}` : ''}\`**\n`;
		md += `> ${subData.description}\n`;

		if (
			extraSubMeta &&
			Array.isArray(extraSubMeta.aliases) &&
			extraSubMeta.aliases.length > 0
		) {
			md += `> _Aliases: ${extraSubMeta.aliases.map((a) => `\`${a}\``).join(', ')}_\n`;
		}
		if (extraSubMeta?.ownerOnly) {
			md += `> _Owner Only: Yes_\n`;
		}
		if (extraSubMeta?.cooldown) {
			md += `> _Cooldown: ${extraSubMeta.cooldown} seconds_\n`;
		}
		if (extraSubMeta?.permissions && extraSubMeta.permissions.length > 0) {
			const perms = new PermissionsBitField(extraSubMeta.permissions).toArray();
			md += `> _User Permissions: ${perms.map((p) => `\`${p}\``).join(', ')}_\n`;
		}
		if (
			extraSubMeta?.botPermissions &&
			extraSubMeta.botPermissions.length > 0
		) {
			const perms = new PermissionsBitField(
				extraSubMeta.botPermissions,
			).toArray();
			md += `> _Bot Permissions: ${perms.map((p) => `\`${p}\``).join(', ')}_\n`;
		}
		md += '\n';

		if (subOptions.length > 0) {
			md += `**Options for this subcommand:**\n`;
			md += this.generateOptionsDocs(subOptions, true);
		} else {
			md += `\n`;
		}
		return md;
	}

	private generateMetadataDocs(commandModule: any): string {
		let md = '### 📋 Details\n\n';
		let hasMetadata = false;

		if (
			commandModule.aliases &&
			Array.isArray(commandModule.aliases) &&
			commandModule.aliases.length > 0
		) {
			md += `- **Aliases:** ${commandModule.aliases.map((a: string) => `\`${a}\``).join(', ')}\n`;
			hasMetadata = true;
		}

		if (commandModule.ownerOnly) {
			md += `- **Owner Only:** ✅ Yes\n`;
			hasMetadata = true;
		}
		if (commandModule.cooldown) {
			md += `- **Cooldown:** ${commandModule.cooldown} seconds\n`;
			hasMetadata = true;
		}
		if (commandModule.permissions && commandModule.permissions.length > 0) {
			const perms = new PermissionsBitField(
				commandModule.permissions,
			).toArray();
			md += `- **User Permissions:** \`${perms.join('`, `')}\`\n`;
			hasMetadata = true;
		}
		if (
			commandModule.botPermissions &&
			commandModule.botPermissions.length > 0
		) {
			const perms = new PermissionsBitField(
				commandModule.botPermissions,
			).toArray();
			md += `- **Bot Permissions:** \`${perms.join('`, `')}\`\n`;
			hasMetadata = true;
		}

		return hasMetadata ? md : '';
	}

	private generateCommandMarkdown(
		commandJSON: any,
		commandModule: any,
		subcommandExtraMeta: SubcommandMetaMap | null = null,
	): string {
		const parentName = commandJSON.name;
		let mdContent = `### 💾 \`/${parentName}\`\n\n`;
		mdContent += `**Description:** ${commandJSON.description}\n\n`;
		mdContent += this.generateMetadataDocs(commandModule);

		const subcommands = commandJSON.options?.filter(
			(opt: any) =>
				opt.type === ApplicationCommandOptionType.Subcommand ||
				opt.type === ApplicationCommandOptionType.SubcommandGroup,
		);
		const regularOptions = commandJSON.options?.filter(
			(opt: any) =>
				opt.type !== ApplicationCommandOptionType.Subcommand &&
				opt.type !== ApplicationCommandOptionType.SubcommandGroup,
		);

		mdContent += '### 💻 Usage\n\n';
		if (subcommands && subcommands.length > 0) {
			subcommands.forEach((sub: any) => {
				if (sub.type === ApplicationCommandOptionType.SubcommandGroup) {
					sub.options.forEach((subInGroup: any) => {
						const usageString = (subInGroup.options || [])
							.map((opt: any) =>
								opt.required ? `<${opt.name}>` : `[${opt.name}]`,
							)
							.join(' ');
						mdContent += `\`/${parentName} ${sub.name} ${subInGroup.name}${usageString ? ` ${usageString}` : ''}\`\n`;
					});
				} else {
					const usageString = (sub.options || [])
						.map((opt: any) =>
							opt.required ? `<${opt.name}>` : `[${opt.name}]`,
						)
						.join(' ');
					mdContent += `\`/${parentName} ${sub.name}${usageString ? ` ${usageString}` : ''}\`\n`;
				}
			});
			mdContent += '\n';
		} else if (regularOptions && regularOptions.length > 0) {
			const usageString = regularOptions
				.map((opt: any) => (opt.required ? `<${opt.name}>` : `[${opt.name}]`))
				.join(' ');
			mdContent += `\`/${parentName}${usageString ? ` ${usageString}` : ''}\`\n\n`;
		} else {
			mdContent += `\`/${parentName}\`\n\n`;
		}

		if (subcommands && subcommands.length > 0) {
			mdContent += `### 🔧 Subcommands\n\n`;
			for (const sub of subcommands) {
				if (sub.type === ApplicationCommandOptionType.SubcommandGroup) {
					for (const subInGroup of sub.options) {
						const meta = subcommandExtraMeta?.[subInGroup.name]
							? subcommandExtraMeta[subInGroup.name]
							: null;
						mdContent += this.generateSubcommandDocs(
							parentName,
							subInGroup,
							sub.name,
							meta,
						);
					}
				} else {
					const meta = subcommandExtraMeta?.[sub.name]
						? subcommandExtraMeta[sub.name]
						: null;
					mdContent += this.generateSubcommandDocs(parentName, sub, null, meta);
				}
			}
		} else if (regularOptions && regularOptions.length > 0) {
			mdContent += this.generateOptionsDocs(regularOptions);
		}

		return mdContent;
	}

	private processSplitCommandDirectory(
		dirPath: string,
		categoryName: string,
	): void {
		console.log(`[SPLIT] Assembling '${categoryName}' from folder...`);
		try {
			const baseCommandPath = path.join(dirPath, '_command.js');
			const baseCommandModule = require(baseCommandPath);

			if (baseCommandModule.ownerOnly || baseCommandModule.teamOnly) return;

			const mainBuilder = this.getSlashCommandBuilder(baseCommandModule);
			if (!mainBuilder) return;

			const subcommandExtraMeta: SubcommandMetaMap = {};
			const contents = fs.readdirSync(dirPath, { withFileTypes: true });

			for (const item of contents) {
				const itemPath = path.join(dirPath, item.name);

				if (
					item.isFile() &&
					item.name.endsWith('.js') &&
					item.name !== '_command.js'
				) {
					const subModule = require(itemPath);

					const subData = subModule.data || subModule.slashCommand;
					if (!subData) continue;

					const subBuilder = new SlashCommandSubcommandBuilder();

					if (typeof subData === 'function') {
						subData(subBuilder);
					} else if (typeof subData === 'object') {
						subBuilder
							.setName(subData.name)
							.setDescription(subData.description);
						if (subData.options) {
							// @ts-ignore
							subBuilder.options = subData.options;
						}
					}

					if (subBuilder.name) {
						mainBuilder.addSubcommand(subBuilder);

						subcommandExtraMeta[subBuilder.name] = {
							aliases: subModule.aliases,
							ownerOnly: subModule.ownerOnly,
							cooldown: subModule.cooldown,
							permissions: subModule.permissions,
							botPermissions: subModule.botPermissions,
						};
					}
				} else if (item.isDirectory()) {
					const groupDefPath = path.join(itemPath, '_group.js');
					if (!fs.existsSync(groupDefPath)) continue;

					const groupModule = require(groupDefPath);
					const groupData = groupModule.data || groupModule.slashCommand;
					if (!groupData) continue;

					const groupBuilder = new SlashCommandSubcommandGroupBuilder();
					if (typeof groupData === 'function') groupData(groupBuilder);
					else {
						groupBuilder
							.setName(groupData.name)
							.setDescription(groupData.description);
					}

					const subFiles = fs
						.readdirSync(itemPath)
						.filter((f) => f.endsWith('.js') && !f.startsWith('_'));
					for (const file of subFiles) {
						const subModule = require(path.join(itemPath, file));
						const subData = subModule.data || subModule.slashCommand;
						if (!subData) continue;

						const subBuilder = new SlashCommandSubcommandBuilder();
						if (typeof subData === 'function') subData(subBuilder);
						else {
							subBuilder
								.setName(subData.name)
								.setDescription(subData.description);
							// @ts-ignore
							if (subData.options) subBuilder.options = subData.options;
						}

						groupBuilder.addSubcommand(subBuilder);
						subcommandExtraMeta[subBuilder.name] = {
							aliases: subModule.aliases,
							permissions: subModule.permissions,
						};
					}
					mainBuilder.addSubcommandGroup(groupBuilder);
				}
			}

			const commandJSON = mainBuilder.toJSON();
			const markdown = this.generateCommandMarkdown(
				commandJSON,
				baseCommandModule,
				subcommandExtraMeta,
			);

			if (!this.markdownBuffers[categoryName]) {
				this.markdownBuffers[categoryName] =
					`## 📁 Command Category: ${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}\n\n`;
			}
			this.markdownBuffers[categoryName] += `${markdown}\n\n`;
		} catch (e) {
			console.error(
				`❌ Failed to assemble split command in ${categoryName}:`,
				e,
			);
		}
	}

	private processSimpleDirectory(dirPath: string, categoryName: string): void {
		const files = fs
			.readdirSync(dirPath)
			.filter((f) => f.endsWith('.js') && !f.startsWith('_'));
		for (const file of files) {
			try {
				const filePath = path.join(dirPath, file);
				const commandModule = require(filePath);

				if (commandModule.ownerOnly || commandModule.teamOnly) continue;

				const commandBuilder = this.getSlashCommandBuilder(commandModule);
				if (!commandBuilder) continue;

				let commandJSON: any;
				if (typeof commandBuilder.toJSON === 'function') {
					commandJSON = commandBuilder.toJSON();
				} else {
					commandJSON = commandBuilder;
				}

				const markdown = this.generateCommandMarkdown(
					commandJSON,
					commandModule,
				);

				if (!this.markdownBuffers[categoryName]) {
					this.markdownBuffers[categoryName] =
						`## 📁 Command Category: ${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}\n\n`;
				}
				this.markdownBuffers[categoryName] += `${markdown}\n\n`;
				console.log(
					`[${categoryName.toUpperCase()}] Added '${commandJSON.name || file}' to buffer`,
				);
			} catch (e: any) {
				console.error(
					`❌ Failed to process file ${file} in category ${categoryName}: ${e.message}`,
				);
			}
		}
	}

	private processDirectory(dirPath: string, categoryName: string): void {
		const baseCommandPath = path.join(dirPath, '_command.js');

		if (fs.existsSync(baseCommandPath)) {
			this.processSplitCommandDirectory(dirPath, categoryName);
		} else {
			this.processSimpleDirectory(dirPath, categoryName);

			const items = fs.readdirSync(dirPath, { withFileTypes: true });
			for (const item of items) {
				if (item.isDirectory()) {
					const subPath = path.join(dirPath, item.name);

					const subCategory =
						categoryName === 'core' ? item.name : categoryName;
					this.processDirectory(subPath, subCategory);
				}
			}
		}
	}

	/**
	 * Register module aliases from package.json to resolve imports properly
	 */
	private registerModuleAliases(projectRoot: string): void {
		try {
			const packageJsonPath = path.join(projectRoot, 'package.json');
			if (!fs.existsSync(packageJsonPath)) return;

			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
			const moduleAliases = packageJson._moduleAliases;

			if (!moduleAliases || typeof moduleAliases !== 'object') return;

			// Manual module alias registration to avoid dependency issues
			const Module = require('node:module');
			const originalResolveFilename = Module._resolveFilename;

			Module._resolveFilename = function (request: string, parent: any) {
				for (const [alias, aliasPath] of Object.entries(moduleAliases)) {
					if (request === alias || request.startsWith(`${alias}/`)) {
						const relativePath = request.substring(alias.length);
						const resolvedPath = path.join(
							projectRoot,
							aliasPath as string, // Cast to string
							relativePath,
						);
						return originalResolveFilename.call(this, resolvedPath, parent);
					}
				}
				return originalResolveFilename.call(this, request, parent);
			};

			console.log(
				pc.green(
					`   ✓ Registered ${Object.keys(moduleAliases).length} module alias(es)`,
				),
			);
		} catch (_e) {
			// Silently fail if package.json doesn't exist or has no aliases
		}
	}
}
