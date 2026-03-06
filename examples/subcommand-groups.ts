import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import {
	ApplicationCommandOptionType,
	GatewayDispatchEvents,
	GatewayIntentBits,
	MessageFlags,
	Routes,
	type RESTGetAPIGatewayBotResult,
} from "discord-api-types/v10";
import {
	createBot,
	defineCommand,
	defineCommandGroup,
	defineEvent,
	publishCommands,
	type SubcommandGroup,
} from "../src/index.ts";

const token = process.env.DISCORD_TOKEN!;

const addRole = defineCommand({
	data: {
		name: "add",
		description: "Add a role to a member",
		options: [
			{ name: "member", type: ApplicationCommandOptionType.User, description: "Target member", required: true },
			{ name: "role", type: ApplicationCommandOptionType.Role, description: "Role to add", required: true },
		] as const,
	},
	handler: async (ctx) => {
		const memberId = ctx.options.member.user.id;
		const roleId = ctx.options.role.id;
		console.log(`[/mod role add] member=${memberId} role=${ctx.options.role.name}`);
		await ctx.reply({
			content: `Added <@&${roleId}> to <@${memberId}>.`,
			flags: MessageFlags.Ephemeral,
		});
	},
});

const removeRole = defineCommand({
	data: {
		name: "remove",
		description: "Remove a role from a member",
		options: [
			{ name: "member", type: ApplicationCommandOptionType.User, description: "Target member", required: true },
			{ name: "role", type: ApplicationCommandOptionType.Role, description: "Role to remove", required: true },
		] as const,
	},
	handler: async (ctx) => {
		const memberId = ctx.options.member.user.id;
		const roleId = ctx.options.role.id;
		console.log(`[/mod role remove] member=${memberId} role=${ctx.options.role.name}`);
		await ctx.reply({
			content: `Removed <@&${roleId}> from <@${memberId}>.`,
			flags: MessageFlags.Ephemeral,
		});
	},
});

const roleGroup: SubcommandGroup = {
	name: "role",
	description: "Manage member roles",
	subcommands: [addRole, removeRole],
};

const warn = defineCommand({
	data: {
		name: "warn",
		description: "Warn a member",
		options: [
			{ name: "member", type: ApplicationCommandOptionType.User, description: "Member to warn", required: true },
			{ name: "reason", type: ApplicationCommandOptionType.String, description: "Reason for the warning" },
		] as const,
	},
	handler: async (ctx) => {
		const reason = ctx.options.reason ?? "No reason provided";
		const memberId = ctx.options.member.user.id;
		console.log(`[/mod warn] member=${memberId} reason=${reason}`);
		await ctx.reply({ content: `Warned <@${memberId}>: ${reason}` });
	},
});

const mod = defineCommandGroup({
	data: { name: "mod", description: "Moderation commands" },
	subcommands: [warn, roleGroup],
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
	commands: [mod],
	events: [ready],
});

console.log("Publishing commands...");
await publishCommands({ token, commands: [mod] });

console.log("Connecting to gateway...");
await gateway.connect();
