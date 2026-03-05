import { createBot, defineCommand, defineEvent, publishCommands } from "@almeidx/discore";
import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import { GatewayIntentBits, Routes, type RESTGetAPIGatewayBotResult } from "discord-api-types/v10";

const token = process.env.DISCORD_TOKEN!;

const ping = defineCommand({
	data: { name: "ping", description: "Check bot latency" },
	handler: async (ctx) => {
		await ctx.reply({ content: "Pong!" });
	},
});

const ready = defineEvent({
	event: "READY",
	handler: async () => {
		console.log("Bot is online!");
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
	commands: [ping],
	events: [ready],
});

await publishCommands({ token, commands: [ping] });
await gateway.connect();

console.log("Bot started");
