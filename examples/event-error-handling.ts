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

const onMessage = defineEvent({
	event: GatewayDispatchEvents.MessageCreate,
	handler: async (ctx) => {
		if (ctx.event.author.bot) return;

		await processMessage(ctx.event.content);
	},
});

const onReady = defineEvent({
	event: GatewayDispatchEvents.Ready,
	handler: async (ctx) => {
		console.log(`Logged in as ${ctx.event.user.username} on shard ${ctx.shardId}`);
	},
});

async function processMessage(content: string): Promise<void> {
	if (content.includes("error")) {
		throw new Error(`Failed to process message: ${content}`);
	}
}

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
	events: [onReady, onMessage],
	hooks: {
		onEventError(ctx, error) {
			console.error(`Event handler failed on shard ${ctx.shardId}:`, error);
		},
	},
});

console.log("Publishing commands...");
await publishCommands({ token, commands: [ping] });

console.log("Connecting to gateway...");
await gateway.connect();
