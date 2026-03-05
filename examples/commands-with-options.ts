import { createBot, defineCommand, publishCommands } from "@almeidx/discore";
import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import {
	ApplicationCommandOptionType,
	GatewayIntentBits,
	Routes,
	type RESTGetAPIGatewayBotResult,
} from "discord-api-types/v10";

const token = process.env.DISCORD_TOKEN!;

const ban = defineCommand({
	data: {
		name: "ban",
		description: "Ban a member from the server",
		options: [
			{ name: "user", type: ApplicationCommandOptionType.User, description: "The user to ban", required: true },
			{ name: "reason", type: ApplicationCommandOptionType.String, description: "Reason for the ban" },
		],
	},
	handler: async (ctx) => {
		// ctx.options.user is typed as string (Snowflake), guaranteed present
		// ctx.options.reason is typed as string | undefined
		const userId = ctx.options.user;
		const reason = ctx.options.reason ?? "No reason provided";

		await ctx.reply({ content: `Banned <@${userId}> for: ${reason}` });
	},
});

const userinfo = defineCommand({
	data: {
		name: "userinfo",
		description: "Get information about a user",
		options: [
			{ name: "target", type: ApplicationCommandOptionType.User, description: "User to look up", required: true },
			{ name: "ephemeral", type: ApplicationCommandOptionType.Boolean, description: "Only visible to you" },
		],
	},
	handler: async (ctx) => {
		const isEphemeral = ctx.options.ephemeral ?? false;

		if (isEphemeral) {
			await ctx.defer({ ephemeral: true });
		} else {
			await ctx.defer();
		}

		await ctx.editReply({ content: `User ID: ${ctx.options.target}` });
	},
});

const rest = new REST().setToken(token);
const gateway = new WebSocketManager({
	token,
	intents: GatewayIntentBits.Guilds,
	fetchGatewayInformation: () => rest.get(Routes.gatewayBot()) as Promise<RESTGetAPIGatewayBotResult>,
});

createBot({ rest, gateway, commands: [ban, userinfo] });
await publishCommands({ token, commands: [ban, userinfo] });
await gateway.connect();
