import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApplicationCommandOptionType, ApplicationCommandType } from "discord-api-types/v10";
import type { RESTPutAPIApplicationCommandsJSONBody } from "discord-api-types/v10";
import { defineCommandGroup } from "../../src/definitions/command-group.ts";
import { defineCommand } from "../../src/definitions/command.ts";
import { defineMessageCommand } from "../../src/definitions/message-command.ts";
import { defineUserCommand } from "../../src/definitions/user-command.ts";
import { commandToPayload, type CommandPayload, publishCommands } from "../../src/index.ts";
import type { CommandDefinition, SubcommandGroup } from "../../src/types/definitions.ts";
import { createMockAPI } from "../fixtures/mock-api.ts";

describe("publishCommands", () => {
	it("command definitions produce correct meta", () => {
		const cmd = defineCommand({
			data: { name: "ping", description: "Pong!" },
			handler: async () => {},
		});

		assert.strictEqual(cmd.data.name, "ping");
		assert.strictEqual(cmd.data.description, "Pong!");
		assert.deepStrictEqual(cmd.data.options, []);
		assert.deepStrictEqual(commandToPayload(cmd), {
			description: "Pong!",
			name: "ping",
			options: [],
			type: ApplicationCommandType.ChatInput,
		});
	});

	it("copies command options without mutating the definition", () => {
		const cmd = defineCommand({
			data: {
				name: "echo",
				description: "Echo text",
				options: [
					{ name: "text", type: ApplicationCommandOptionType.String, description: "Text", required: true },
				] as const,
			},
			handler: async () => {},
		});
		const originalData = structuredClone(cmd.data);

		const payload = commandToPayload(cmd);

		assert.ok("options" in payload);
		assert.notStrictEqual(payload.options, cmd.data.options);
		assert.deepStrictEqual(cmd.data, originalData);
	});

	it("combines serialized definitions with legacy command payloads", () => {
		const legacyPayload: CommandPayload = {
			description: "Legacy command",
			name: "legacy",
			type: ApplicationCommandType.ChatInput,
		};
		const cmd = defineCommand({
			data: { name: "ping", description: "Pong!" },
			handler: async () => {},
		});

		const body: RESTPutAPIApplicationCommandsJSONBody = [legacyPayload, commandToPayload(cmd)];

		assert.deepStrictEqual(
			body.map((payload) => payload.name),
			["legacy", "ping"],
		);
	});

	it("command group definitions produce correct meta", () => {
		const ban = defineCommand({
			data: {
				name: "ban",
				description: "Ban a user",
				options: [
					{ name: "user", type: ApplicationCommandOptionType.User, description: "The user", required: true },
				] as const,
			},
			handler: async () => {},
		});

		const group = defineCommandGroup({
			data: { name: "mod", description: "Mod commands" },
			subcommands: [ban],
		});

		assert.strictEqual(group.data.name, "mod");
		assert.strictEqual(group.subcommands.length, 1);

		const first = group.subcommands[0] as CommandDefinition;
		assert.strictEqual(first.data.name, "ban");
		assert.strictEqual(first.data.options[0]?.name, "user");
		assert.strictEqual(first.data.options[0]?.type, ApplicationCommandOptionType.User);
		assert.deepStrictEqual(commandToPayload(group), {
			description: "Mod commands",
			name: "mod",
			options: [
				{
					description: "Ban a user",
					name: "ban",
					options: [
						{
							description: "The user",
							name: "user",
							required: true,
							type: ApplicationCommandOptionType.User,
						},
					],
					type: ApplicationCommandOptionType.Subcommand,
				},
			],
			type: ApplicationCommandType.ChatInput,
		});
	});

	it("user command definition produces correct meta", () => {
		const cmd = defineUserCommand({
			data: { name: "User Info" },
			handler: async () => {},
		});

		assert.strictEqual(cmd.data.name, "User Info");
		assert.deepStrictEqual(commandToPayload(cmd), {
			name: "User Info",
			type: ApplicationCommandType.User,
		});
	});

	it("message command definition produces correct meta", () => {
		const cmd = defineMessageCommand({
			data: { name: "Bookmark" },
			handler: async () => {},
		});

		assert.strictEqual(cmd.data.name, "Bookmark");
		assert.deepStrictEqual(commandToPayload(cmd), {
			name: "Bookmark",
			type: ApplicationCommandType.Message,
		});
	});

	it("command group with subcommand groups produces correct structure", () => {
		const add = defineCommand({
			data: { name: "add", description: "Add a role" },
			handler: async () => {},
		});

		const remove = defineCommand({
			data: { name: "remove", description: "Remove a role" },
			handler: async () => {},
		});

		const roleGroup: SubcommandGroup = {
			name: "role",
			description: "Role management",
			subcommands: [add, remove],
		};

		const kick = defineCommand({
			data: { name: "kick", description: "Kick a user" },
			handler: async () => {},
		});

		const group = defineCommandGroup({
			data: { name: "manage", description: "Management" },
			subcommands: [kick, roleGroup],
		});

		assert.strictEqual(group.subcommands.length, 2);
		assert.ok("type" in group.subcommands[0]!);
		assert.ok(!("type" in group.subcommands[1]!));

		const sg = group.subcommands[1] as SubcommandGroup;
		assert.strictEqual(sg.name, "role");
		assert.strictEqual(sg.subcommands.length, 2);
		assert.deepStrictEqual(commandToPayload(group), {
			description: "Management",
			name: "manage",
			options: [
				{
					description: "Kick a user",
					name: "kick",
					options: [],
					type: ApplicationCommandOptionType.Subcommand,
				},
				{
					description: "Role management",
					name: "role",
					options: [
						{
							description: "Add a role",
							name: "add",
							options: [],
							type: ApplicationCommandOptionType.Subcommand,
						},
						{
							description: "Remove a role",
							name: "remove",
							options: [],
							type: ApplicationCommandOptionType.Subcommand,
						},
					],
					type: ApplicationCommandOptionType.SubcommandGroup,
				},
			],
			type: ApplicationCommandType.ChatInput,
		});
	});

	it("publishes command payloads through the API", async () => {
		const api = createMockAPI();
		api.applicationCommands.bulkOverwriteGlobalCommands.mock.mockImplementation(
			async (_appId: string, body: unknown) => body,
		);

		const cmd = defineCommand({
			data: { name: "ping", description: "Pong!" },
			handler: async () => {},
		});

		const result = await publishCommands({ api: api as any, applicationId: "app-id", commands: [cmd] });

		assert.strictEqual(api.applicationCommands.bulkOverwriteGlobalCommands.mock.callCount(), 1);
		const call = api.applicationCommands.bulkOverwriteGlobalCommands.mock.calls[0]!;
		assert.strictEqual(call.arguments[0], "app-id");
		assert.deepStrictEqual(result, [{ name: "ping", description: "Pong!", options: [], type: 1 }]);
	});

	it("publishes command payloads to a guild", async () => {
		const api = createMockAPI();
		api.applicationCommands.bulkOverwriteGuildCommands.mock.mockImplementation(
			async (_appId: string, _guildId: string, body: unknown) => body,
		);
		const cmd = defineCommand({
			data: { name: "ping", description: "Pong!" },
			handler: async () => {},
		});

		const result = await publishCommands({
			api: api as any,
			applicationId: "app-id",
			commands: [cmd],
			guildId: "guild-id",
		});

		assert.strictEqual(api.applicationCommands.bulkOverwriteGuildCommands.mock.callCount(), 1);
		const call = api.applicationCommands.bulkOverwriteGuildCommands.mock.calls[0]!;
		assert.deepStrictEqual(call.arguments.slice(0, 2), ["app-id", "guild-id"]);
		assert.deepStrictEqual(result, [{ name: "ping", description: "Pong!", options: [], type: 1 }]);
	});
});
