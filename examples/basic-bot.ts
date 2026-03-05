import { createBot, defineCommand, defineEvent, publishCommands } from "@almeidx/discore";
import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import {
	GatewayDispatchEvents,
	GatewayIntentBits,
	Routes,
	type GatewayMessageCreateDispatchData,
	type RESTGetAPIGatewayBotResult,
} from "discord-api-types/v10";

const token = process.env.DISCORD_TOKEN!;

const ping = defineCommand({
	data: { name: "ping", description: "Check bot latency" },
	handler: async (ctx) => {
		await ctx.reply({ content: "Pong!" });
	},
});

const ready = defineEvent({
	event: GatewayDispatchEvents.Ready,
	handler: async () => {
		console.log("Bot is online!");
	},
});

const onMessage = defineEvent<GatewayMessageCreateDispatchData>({
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

createBot({
	rest,
	gateway,
	commands: [ping],
	events: [ready, onMessage],
});

await publishCommands({ token, commands: [ping] });
await gateway.connect();

console.log("Bot started");
