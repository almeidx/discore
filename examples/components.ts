import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import { GatewayIntentBits, MessageFlags, Routes, type RESTGetAPIGatewayBotResult } from "discord-api-types/v10";
import {
	createBot,
	defineCommand,
	defineButton,
	defineSelectMenu,
	defineModal,
	publishCommands,
} from "../src/index.ts";

const token = process.env.DISCORD_TOKEN!;

const verifyButton = defineButton({
	customId: /^verify:(?<userId>\d+)$/,
	handler: async (ctx) => {
		const userId = ctx.params.userId;
		await ctx.reply({ content: `Verified user ${userId}!`, flags: MessageFlags.Ephemeral });
	},
});

const roleSelect = defineSelectMenu({
	customId: /^roles:(?<panel>\w+)$/,
	handler: async (ctx) => {
		const panel = ctx.params.panel;
		const selectedRoles = ctx.values;
		await ctx.reply({
			content: `Updated roles from panel "${panel}": ${selectedRoles.join(", ")}`,
			flags: MessageFlags.Ephemeral,
		});
	},
});

const feedbackModal = defineModal({
	customId: /^feedback:(?<type>\w+)$/,
	handler: async (ctx) => {
		const type = ctx.params.type;
		const description = ctx.fields.getRequired("description");
		await ctx.reply({ content: `Received ${type} feedback: ${description}` });
	},
});

const feedback = defineCommand({
	data: { name: "feedback", description: "Submit feedback" },
	handler: async (ctx) => {
		await ctx.showModal({
			custom_id: "feedback:suggestion",
			title: "Submit Feedback",
			components: [
				{
					type: 1,
					components: [
						{
							type: 4,
							custom_id: "description",
							label: "Description",
							style: 2,
							required: true,
						},
					],
				},
			],
		});
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
	commands: [feedback],
	interactions: [verifyButton, roleSelect, feedbackModal],
});

await publishCommands({ token, commands: [feedback] });
await gateway.connect();
