import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import {
	GatewayDispatchEvents,
	GatewayIntentBits,
	MessageFlags,
	Routes,
	type RESTGetAPIGatewayBotResult,
} from "discord-api-types/v10";
import { createBot, defineEvent, defineUserCommand, defineMessageCommand, publishCommands } from "../src/index.ts";

const token = process.env.DISCORD_TOKEN!;

const userInfo = defineUserCommand({
	data: { name: "User Info" },
	handler: async (ctx) => {
		console.log(`[User Info] target: ${ctx.targetUser.username}`);
		const user = ctx.targetUser;
		const member = ctx.targetMember;

		const lines = [`**${user.global_name ?? user.username}**`, `ID: ${user.id}`, `Bot: ${user.bot ? "Yes" : "No"}`];

		if (member?.joined_at) {
			lines.push(`Joined: <t:${Math.floor(new Date(member.joined_at).getTime() / 1_000)}:R>`);
		}

		await ctx.reply({ content: lines.join("\n"), flags: MessageFlags.Ephemeral });
	},
});

const bookmark = defineMessageCommand({
	data: { name: "Bookmark" },
	handler: async (ctx) => {
		console.log(`[Bookmark] message ${ctx.targetMessage.id} by ${ctx.targetMessage.author.username}`);
		const msg = ctx.targetMessage;
		const link = `https://discord.com/channels/${ctx.interaction.guild_id}/${msg.channel_id}/${msg.id}`;

		await ctx.reply({
			content: `Bookmarked [this message](${link}) by ${msg.author.username}:\n>>> ${msg.content.slice(0, 200)}`,
			flags: MessageFlags.Ephemeral,
		});
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
	commands: [userInfo, bookmark],
	events: [ready],
});

console.log("Publishing commands...");
await publishCommands({ rest, commands: [userInfo, bookmark] });

console.log("Connecting to gateway...");
await gateway.connect();
