import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import { GatewayIntentBits, MessageFlags, Routes, type RESTGetAPIGatewayBotResult } from "discord-api-types/v10";
import { createBot, defineCommand, publishCommands } from "@almeidx/discore";

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
		await ctx.reply({ content: "This worked!" });
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
	hooks: {
		beforeCommand: async () => {
			console.log("[global] before — skipped for commands with their own hooks");
		},
		afterCommand: async () => {
			console.log("[global] after — skipped for commands with their own hooks");
		},
		onError: async (_ctx, error) => {
			console.error("Unhandled error:", error);
		},
	},
	errorResponse: { content: "Something went wrong!", flags: MessageFlags.Ephemeral },
});

await publishCommands({ token, commands: [riskyCommand] });
await gateway.connect();
