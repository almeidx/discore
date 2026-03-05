import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import {
	ComponentType,
	GatewayDispatchEvents,
	GatewayIntentBits,
	MessageFlags,
	Routes,
	type RESTGetAPIGatewayBotResult,
} from "discord-api-types/v10";
import { createBot, defineCommand, defineEvent, CollectorTimeoutError, publishCommands } from "../src/index.ts";

const token = process.env.DISCORD_TOKEN!;

const ready = defineEvent({
	event: GatewayDispatchEvents.Ready,
	handler: async (ctx) => {
		console.log(`Logged in as ${ctx.event.user.username} (shard ${ctx.shardId})`);
	},
});

const confirm = defineCommand({
	data: { name: "confirm", description: "Demonstrate the awaitComponent collector" },
	handler: async (ctx) => {
		console.log("[/confirm] awaiting button response");
		await ctx.reply({
			content: "Are you sure?",
			components: [
				{
					type: ComponentType.ActionRow,
					components: [
						{ type: ComponentType.Button, custom_id: "yes", label: "Yes", style: 3 },
						{ type: ComponentType.Button, custom_id: "no", label: "No", style: 4 },
					],
				},
			],
		});

		try {
			const response = await ctx.awaitComponent({
				filter: (i) => i.customId === "yes" || i.customId === "no",
				timeout: 30_000,
			});

			console.log(`[/confirm] user clicked: ${response.customId}`);
			await response.reply({ content: `You clicked: ${response.customId}` });
		} catch (error) {
			if (error instanceof CollectorTimeoutError) {
				console.log("[/confirm] timed out");
				await ctx.editReply({ content: "Timed out!" });
			}
		}
	},
});

const poll = defineCommand({
	data: { name: "poll", description: "Demonstrate the collectComponents collector" },
	handler: async (ctx) => {
		console.log("[/poll] starting vote collection");
		await ctx.reply({
			content: "Vote! (collecting for 30 seconds)",
			components: [
				{
					type: ComponentType.ActionRow,
					components: [
						{ type: ComponentType.Button, custom_id: "option_a", label: "Option A", style: 1 },
						{ type: ComponentType.Button, custom_id: "option_b", label: "Option B", style: 1 },
					],
				},
			],
		});

		const votes = new Map<string, Set<string>>();
		const collector = ctx.collectComponents({
			filter: (i) => i.customId === "option_a" || i.customId === "option_b",
			timeout: 30_000,
		});

		for await (const vote of collector) {
			const voterId = vote.interaction.member?.user.id ?? vote.interaction.user?.id ?? "unknown";
			const existing = votes.get(vote.customId) ?? new Set();
			existing.add(voterId);
			votes.set(vote.customId, existing);

			await vote.reply({ content: "Vote recorded!", flags: MessageFlags.Ephemeral });
		}

		const optionA = votes.get("option_a")?.size ?? 0;
		const optionB = votes.get("option_b")?.size ?? 0;
		console.log(`[/poll] collection ended — A: ${optionA}, B: ${optionB}`);
		await ctx.editReply({
			content: `Results: Option A: ${optionA} votes, Option B: ${optionB} votes`,
			components: [],
		});
	},
});

const rest = new REST().setToken(token);
const gateway = new WebSocketManager({
	token,
	intents: GatewayIntentBits.Guilds,
	fetchGatewayInformation: () => rest.get(Routes.gatewayBot()) as Promise<RESTGetAPIGatewayBotResult>,
});

createBot({ rest, gateway, commands: [confirm, poll], events: [ready] });

console.log("Publishing commands...");
await publishCommands({ token, commands: [confirm, poll] });

console.log("Connecting to gateway...");
await gateway.connect();
