import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import {
	ApplicationCommandOptionType,
	ChannelType,
	ComponentType,
	GatewayIntentBits,
	MessageFlags,
	Routes,
	TextInputStyle,
	type RESTGetAPIGatewayBotResult,
} from "discord-api-types/v10";
import { createBot, defineCommand, defineCommandGroup, publishCommands, CollectorTimeoutError } from "../src/index.ts";

const token = process.env.DISCORD_TOKEN!;

const toggleSetting = defineCommand({
	data: {
		name: "toggle",
		description: "Toggle a server setting on or off",
		options: [
			{
				name: "setting",
				type: ApplicationCommandOptionType.String,
				description: "The setting to toggle",
				required: true,
				choices: [
					{ name: "Welcome messages", value: "welcome" },
					{ name: "Auto moderation", value: "automod" },
					{ name: "Logging", value: "logging" },
					{ name: "Level-up notifications", value: "levelup" },
				],
			},
		],
	},
	handler: async (ctx) => {
		const setting = ctx.options.setting;
		const enabled = !getSettingState(setting);

		await ctx.reply({
			content: `**${setting}** is now **${enabled ? "enabled" : "disabled"}**.`,
			flags: MessageFlags.Ephemeral,
		});
	},
});

const channels = defineCommand({
	data: {
		name: "channels",
		description: "Configure channels for a feature",
		options: [
			{
				name: "feature",
				type: ApplicationCommandOptionType.String,
				description: "Feature to configure channels for",
				required: true,
				choices: [
					{ name: "Welcome messages", value: "welcome" },
					{ name: "Mod logs", value: "modlogs" },
					{ name: "Level-up notifications", value: "levelup" },
				],
			},
		],
	},
	handler: async (ctx) => {
		const feature = ctx.options.feature;
		const customId = `config:channels:${feature}:${ctx.interaction.id}`;

		await ctx.reply({
			content: `Select the channels for **${feature}**:`,
			flags: MessageFlags.Ephemeral,
			components: [
				{
					type: ComponentType.ActionRow,
					components: [
						{
							type: ComponentType.ChannelSelect,
							custom_id: customId,
							min_values: 1,
							max_values: 5,
							channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
						},
					],
				},
			],
		});

		try {
			const response = await ctx.awaitComponent({
				filter: (i) => i.customId === customId,
				timeout: 60_000,
			});

			const channelMentions = ("values" in response ? response.values : []).map((id) => `<#${id}>`).join(", ");
			await response.reply({
				content: `Updated **${feature}** channels to: ${channelMentions}`,
				flags: MessageFlags.Ephemeral,
			});
		} catch (error) {
			if (error instanceof CollectorTimeoutError) {
				await ctx.editReply({ content: "Selection timed out.", components: [] });
			}
		}
	},
});

const customMessage = defineCommand({
	data: {
		name: "message",
		description: "Set a custom message for a feature",
		options: [
			{
				name: "feature",
				type: ApplicationCommandOptionType.String,
				description: "Feature to set the message for",
				required: true,
				choices: [
					{ name: "Welcome message", value: "welcome" },
					{ name: "Goodbye message", value: "goodbye" },
					{ name: "Level-up message", value: "levelup" },
				],
			},
		],
	},
	handler: async (ctx) => {
		const feature = ctx.options.feature;
		const modalCustomId = `config:message:${feature}:${ctx.interaction.id}`;

		await ctx.showModal({
			custom_id: modalCustomId,
			title: `Set ${feature} message`,
			components: [
				{
					type: ComponentType.ActionRow,
					components: [
						{
							type: ComponentType.TextInput,
							custom_id: "title",
							label: "Title",
							style: TextInputStyle.Short,
							max_length: 256,
							required: true,
							placeholder: "Welcome to the server!",
						},
					],
				},
				{
					type: ComponentType.ActionRow,
					components: [
						{
							type: ComponentType.TextInput,
							custom_id: "body",
							label: "Message body",
							style: TextInputStyle.Paragraph,
							max_length: 2_000,
							required: true,
							placeholder: "Hey {user}, welcome to {server}! You are member #{count}.",
						},
					],
				},
				{
					type: ComponentType.ActionRow,
					components: [
						{
							type: ComponentType.TextInput,
							custom_id: "footer",
							label: "Footer (optional)",
							style: TextInputStyle.Short,
							max_length: 256,
							required: false,
							placeholder: "Read the rules in #rules",
						},
					],
				},
			],
		});

		try {
			const response = await ctx.awaitModal({
				filter: (i) => i.customId === modalCustomId,
				timeout: 300_000,
			});

			const title = response.fields.getRequired("title");
			const body = response.fields.getRequired("body");
			const footer = response.fields.get("footer");

			const preview = [`**${title}**`, "", body, footer ? `\n-# ${footer}` : ""].join("\n");

			await response.reply({
				content: `Updated **${feature}** message. Preview:\n\n${preview}`,
				flags: MessageFlags.Ephemeral,
			});
		} catch (error) {
			if (!(error instanceof CollectorTimeoutError)) throw error;
		}
	},
});

const config = defineCommandGroup({
	data: { name: "config", description: "Server configuration" },
	subcommands: [toggleSetting, channels, customMessage],
});

function getSettingState(_setting: string): boolean {
	return false;
}

const rest = new REST().setToken(token);
const gateway = new WebSocketManager({
	token,
	intents: GatewayIntentBits.Guilds,
	fetchGatewayInformation: () => rest.get(Routes.gatewayBot()) as Promise<RESTGetAPIGatewayBotResult>,
});

createBot({
	rest,
	gateway,
	commands: [config],
	hooks: {
		beforeCommand(ctx) {
			console.log(`Executing command: ${ctx.interaction.data.name}`);
		},
	},
});

await publishCommands({ token, commands: [config] });
await gateway.connect();

console.log("Bot is now connected and ready.");
