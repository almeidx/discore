import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import {
	GatewayDispatchEvents,
	GatewayIntentBits,
	Routes,
	type RESTGetAPIGatewayBotResult,
} from "discord-api-types/v10";
import { createBot, defineCommand, defineEvent, publishCommands } from "../src/index.ts";

const token = process.env.DISCORD_TOKEN!;

const ping = defineCommand({
	data: { name: "ping", description: "Check bot latency" },
	handler: async (ctx) => {
		console.log(`[/ping] used by ${ctx.interaction.member?.user.username ?? ctx.interaction.user?.username}`);
		await ctx.reply({ content: "Pong!" });
	},
});

const ready = defineEvent({
	event: GatewayDispatchEvents.Ready,
	handler: async (ctx) => {
		console.log(`Logged in as ${ctx.event.user.username} (shard ${ctx.shardId})`);
	},
});

const onMessage = defineEvent({
	event: GatewayDispatchEvents.MessageCreate,
	handler: async (ctx) => {
		console.log(`${ctx.event.author.username}: ${ctx.event.content}`);
	},
});

const rest = new REST().setToken(token);
const gateway = new WebSocketManager({
	token,
	intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMessages | GatewayIntentBits.MessageContent,
	fetchGatewayInformation: () => rest.get(Routes.gatewayBot()) as Promise<RESTGetAPIGatewayBotResult>,
});

const bot = createBot({
	rest,
	gateway,
	commands: [ping],
	events: [ready, onMessage],
});

console.log("Publishing commands...");
const published = await publishCommands({ token, commands: [ping] });
console.log(`Published ${published.length} commands`);

console.log("Connecting to gateway...");
await gateway.connect();

process.on("SIGINT", () => {
	console.log("Shutting down...");
	bot.destroy();
	gateway.destroy();
});
