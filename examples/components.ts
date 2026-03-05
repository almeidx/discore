import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import {
	ButtonStyle,
	ComponentType,
	GatewayDispatchEvents,
	GatewayIntentBits,
	Routes,
	TextInputStyle,
	type RESTGetAPIGatewayBotResult,
} from "discord-api-types/v10";
import {
	createBot,
	defineCommand,
	defineEvent,
	defineButton,
	defineSelectMenu,
	defineModal,
	publishCommands,
} from "../src/index.ts";

const token = process.env.DISCORD_TOKEN!;

const ready = defineEvent({
	event: GatewayDispatchEvents.Ready,
	handler: async (ctx) => {
		console.log(`Logged in as ${ctx.event.user.username} (shard ${ctx.shardId})`);
	},
});

const verify = defineCommand({
	data: { name: "verify", description: "Send a verification button" },
	handler: async (ctx) => {
		const userId = ctx.interaction.member?.user.id ?? ctx.interaction.user?.id ?? "unknown";
		console.log(`[/verify] sending button for user ${userId}`);
		await ctx.reply({
			content: "Click to verify:",
			components: [
				{
					type: ComponentType.ActionRow,
					components: [
						{ type: ComponentType.Button, custom_id: `verify:${userId}`, label: "Verify", style: ButtonStyle.Success },
					],
				},
			],
		});
	},
});

const verifyButton = defineButton({
	customId: /^verify:(?<userId>\d+)$/,
	handler: async (ctx) => {
		console.log(`[button] verify clicked for user ${ctx.params.userId}`);
		await ctx.update({ content: `Verified user ${ctx.params.userId}!`, components: [] });
	},
});

const roles = defineCommand({
	data: { name: "roles", description: "Pick your roles" },
	handler: async (ctx) => {
		console.log("[/roles] sending role select menu");
		await ctx.reply({
			content: "Select your roles:",
			components: [
				{
					type: ComponentType.ActionRow,
					components: [
						{
							type: ComponentType.StringSelect,
							custom_id: "roles:main",
							min_values: 1,
							max_values: 3,
							options: [
								{ label: "Announcements", value: "announcements" },
								{ label: "Events", value: "events" },
								{ label: "Gaming", value: "gaming" },
							],
						},
					],
				},
			],
		});
	},
});

const roleSelect = defineSelectMenu({
	customId: /^roles:(?<panel>\w+)$/,
	handler: async (ctx) => {
		console.log(`[select] roles selected on panel "${ctx.params.panel}": ${ctx.values.join(", ")}`);
		await ctx.update({
			content: `Roles updated: ${ctx.values.join(", ")}`,
			components: [],
		});
	},
});

const feedback = defineCommand({
	data: { name: "feedback", description: "Submit feedback" },
	handler: async (ctx) => {
		console.log("[/feedback] showing modal");
		await ctx.showModal({
			custom_id: "feedback:suggestion",
			title: "Submit Feedback",
			components: [
				{
					type: ComponentType.ActionRow,
					components: [
						{
							type: ComponentType.TextInput,
							custom_id: "description",
							label: "Description",
							style: TextInputStyle.Paragraph,
							required: true,
						},
					],
				},
			],
		});
	},
});

const feedbackModal = defineModal({
	customId: /^feedback:(?<type>\w+)$/,
	handler: async (ctx) => {
		console.log(`[modal] feedback submitted (type: ${ctx.params.type})`);
		const description = ctx.fields.getRequired("description");
		await ctx.reply({ content: `Received ${ctx.params.type} feedback: ${description}` });
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
	commands: [verify, roles, feedback],
	events: [ready],
	interactions: [verifyButton, roleSelect, feedbackModal],
});

console.log("Publishing commands...");
await publishCommands({ token, commands: [verify, roles, feedback] });

console.log("Connecting to gateway...");
await gateway.connect();
