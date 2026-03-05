import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import {
	ApplicationCommandOptionType,
	GatewayDispatchEvents,
	GatewayIntentBits,
	MessageFlags,
	Routes,
	type RESTGetAPIGatewayBotResult,
} from "discord-api-types/v10";
import { createBot, defineCommand, defineEvent, publishCommands } from "../src/index.ts";

const token = process.env.DISCORD_TOKEN!;

const ready = defineEvent({
	event: GatewayDispatchEvents.Ready,
	handler: async (ctx) => {
		console.log(`Logged in as ${ctx.event.user.username} (shard ${ctx.shardId})`);
	},
});

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
		const userId = ctx.options.user;
		const reason = ctx.options.reason ?? "No reason provided";
		console.log(`[/ban] banning user ${userId} — reason: ${reason}`);

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
		console.log(`[/userinfo] looking up user ${ctx.options.target}`);
		const isEphemeral = ctx.options.ephemeral ?? false;

		if (isEphemeral) {
			await ctx.defer({ flags: MessageFlags.Ephemeral });
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

createBot({ rest, gateway, commands: [ban, userinfo], events: [ready] });

console.log("Publishing commands...");
await publishCommands({ token, commands: [ban, userinfo] });

console.log("Connecting to gateway...");
await gateway.connect();
