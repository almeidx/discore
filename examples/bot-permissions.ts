import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import {
	GatewayDispatchEvents,
	GatewayIntentBits,
	MessageFlags,
	PermissionFlagsBits,
	Routes,
	type RESTGetAPIGatewayBotResult,
} from "discord-api-types/v10";
import { createBot, defineCommand, defineEvent, publishCommands } from "../src/index.ts";

const token = process.env.DISCORD_TOKEN!;

const ban = defineCommand({
	data: { name: "ban", description: "Ban a member from the server" },
	requiredBotPermissions: PermissionFlagsBits.BanMembers,
	handler: async (ctx) => {
		await ctx.reply({ content: "Banned!" });
	},
});

const manage = defineCommand({
	data: { name: "manage", description: "Manage channels and roles" },
	requiredBotPermissions: PermissionFlagsBits.ManageChannels | PermissionFlagsBits.ManageRoles,
	hooks: {
		onMissingBotPermissions: async (ctx, missing) => {
			const names: string[] = [];
			if (missing & PermissionFlagsBits.ManageChannels) names.push("Manage Channels");
			if (missing & PermissionFlagsBits.ManageRoles) names.push("Manage Roles");

			await ctx.reply({
				content: `I need the following permissions: ${names.join(", ")}`,
				flags: MessageFlags.Ephemeral,
			});
		},
	},
	handler: async (ctx) => {
		await ctx.reply({ content: "Managing!" });
	},
});

const ready = defineEvent({
	event: GatewayDispatchEvents.Ready,
	handler: async (ctx) => {
		console.log(`Logged in as ${ctx.event.user.username}`);
	},
});

const rest = new REST().setToken(token);
const gateway = new WebSocketManager({
	token,
	intents: GatewayIntentBits.Guilds,
	fetchGatewayInformation: () => rest.get(Routes.gatewayBot()) as Promise<RESTGetAPIGatewayBotResult>,
});

const bot = createBot({
	rest,
	gateway,
	commands: [ban, manage],
	events: [ready],
	missingPermissionsResponse: (ctx, _missing) => ({
		content: `I don't have the required permissions to run \`/${ctx.interaction.data.name}\`.`,
		flags: MessageFlags.Ephemeral,
	}),
});

await publishCommands({ api: bot.api, applicationId: process.env.DISCORD_APP_ID!, commands: [ban, manage] });
await gateway.connect();
