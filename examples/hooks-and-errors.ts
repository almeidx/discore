import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import {
	GatewayDispatchEvents,
	GatewayIntentBits,
	MessageFlags,
	Routes,
	type RESTGetAPIGatewayBotResult,
} from "discord-api-types/v10";
import { createBot, defineCommand, defineEvent, isCommand, publishCommands } from "../src/index.ts";

const token = process.env.DISCORD_TOKEN!;

const riskyCommand = defineCommand({
	data: { name: "risky", description: "A command with per-command hooks" },
	hooks: {
		beforeCommand: async () => {
			console.log("[risky] before handler");
		},
		afterCommand: async () => {
			console.log("[risky] after handler");
		},
	},
	handler: async (ctx) => {
		console.log("[risky] handler");
		await ctx.reply({ content: "This worked!" });
	},
});

const ready = defineEvent({
	event: GatewayDispatchEvents.Ready,
	handler: async (ctx) => {
		console.log(`Logged in as ${ctx.event.user.username} (shard ${ctx.shardId})`);
	},
});

const rest = new REST().setToken(token);
const gateway = new WebSocketManager({
	token,
	intents: GatewayIntentBits.Guilds,
	fetchGatewayInformation: () => rest.get(Routes.gatewayBot()) as Promise<RESTGetAPIGatewayBotResult>,
});

createBot({
	rest,
	gateway,
	commands: [riskyCommand],
	events: [ready],
	hooks: {
		beforeCommand: async () => {
			console.log("[global] before handler");
		},
		afterCommand: async () => {
			console.log("[global] after handler");
		},
		onError: async (_ctx, error) => {
			console.error("Unhandled error:", error);
		},
		beforeInteraction: async (ctx) => {
			if (isCommand(ctx)) {
				console.log(`[beforeInteraction] command: ${ctx.interaction.data.name}`);
			}
		},
		afterInteraction: async () => {
			console.log("[afterInteraction] done");
		},
	},
	errorResponse: { content: "Something went wrong!", flags: MessageFlags.Ephemeral },
});

console.log("Publishing commands...");
await publishCommands({ rest, commands: [riskyCommand] });

console.log("Connecting to gateway...");
await gateway.connect();
