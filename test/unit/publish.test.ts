import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	type RESTPutAPIApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import {
	commandToPayload,
	defineCommand,
	defineCommandGroup,
	defineMessageCommand,
	defineUserCommand,
	publishCommands,
} from "../../src/index.ts";
import { asAPI, createMockAPI } from "../fixtures/mock-api.ts";

const ping = defineCommand({ data: { name: "ping", description: "Pong!" }, handler: () => {} });

describe("commandToPayload", () => {
	it("serializes a chat input command, defaulting options to an empty list", () => {
		assert.deepStrictEqual(commandToPayload(ping), {
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
				options: [{ name: "text", type: ApplicationCommandOptionType.String, description: "Text", required: true }],
			},
			handler: () => {},
		});
		const originalData = structuredClone(cmd.data);

		const payload = commandToPayload(cmd);

		assert.ok("options" in payload);
		assert.deepStrictEqual(payload.options, originalData.options);
		assert.notStrictEqual(payload.options, cmd.data.options);
		assert.deepStrictEqual(cmd.data, originalData);
	});

	it("serializes a command group's subcommands as Subcommand options", () => {
		const ban = defineCommand({
			data: {
				name: "ban",
				description: "Ban a user",
				options: [{ name: "user", type: ApplicationCommandOptionType.User, description: "The user", required: true }],
			},
			handler: () => {},
		});
		const group = defineCommandGroup({ data: { name: "mod", description: "Mod commands" }, subcommands: [ban] });

		assert.deepStrictEqual(commandToPayload(group), {
			description: "Mod commands",
			name: "mod",
			options: [
				{
					description: "Ban a user",
					name: "ban",
					options: [{ description: "The user", name: "user", required: true, type: ApplicationCommandOptionType.User }],
					type: ApplicationCommandOptionType.Subcommand,
				},
			],
			type: ApplicationCommandType.ChatInput,
		});
	});

	it("serializes subcommand groups as SubcommandGroup options next to direct subcommands", () => {
		const subcommand = (name: string, description: string) =>
			defineCommand({ data: { name, description }, handler: () => {} });
		const group = defineCommandGroup({
			data: { name: "manage", description: "Management" },
			subcommands: [
				subcommand("kick", "Kick a user"),
				{
					name: "role",
					description: "Role management",
					subcommands: [subcommand("add", "Add a role"), subcommand("remove", "Remove a role")],
				},
			],
		});

		assert.deepStrictEqual(commandToPayload(group), {
			description: "Management",
			name: "manage",
			options: [
				{ description: "Kick a user", name: "kick", options: [], type: ApplicationCommandOptionType.Subcommand },
				{
					description: "Role management",
					name: "role",
					options: [
						{ description: "Add a role", name: "add", options: [], type: ApplicationCommandOptionType.Subcommand },
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

	it("serializes user and message context menu commands", () => {
		const userCommand = defineUserCommand({ data: { name: "User Info" }, handler: () => {} });
		const messageCommand = defineMessageCommand({ data: { name: "Bookmark" }, handler: () => {} });

		assert.deepStrictEqual(commandToPayload(userCommand), { name: "User Info", type: ApplicationCommandType.User });
		assert.deepStrictEqual(commandToPayload(messageCommand), {
			name: "Bookmark",
			type: ApplicationCommandType.Message,
		});
	});
});

describe("publishCommands", () => {
	// `satisfies` also checks at compile time that serialized payloads are a valid bulk-overwrite body.
	const expectedBody = [commandToPayload(ping)] satisfies RESTPutAPIApplicationCommandsJSONBody;

	it("bulk-overwrites global commands and returns the API result", async () => {
		const api = createMockAPI();
		const published = [{ id: "1" }];
		api.applicationCommands.bulkOverwriteGlobalCommands.mock.mockImplementation(async () => published);

		const result = await publishCommands({ api: asAPI(api), applicationId: "app-id", commands: [ping] });

		assert.deepStrictEqual(
			api.applicationCommands.bulkOverwriteGlobalCommands.mock.calls.map((call) => call.arguments),
			[["app-id", expectedBody]],
		);
		assert.strictEqual(api.applicationCommands.bulkOverwriteGuildCommands.mock.callCount(), 0);
		assert.strictEqual(result, published);
	});

	it("bulk-overwrites guild commands when a guildId is given", async () => {
		const api = createMockAPI();
		const published = [{ id: "1" }];
		api.applicationCommands.bulkOverwriteGuildCommands.mock.mockImplementation(async () => published);

		const result = await publishCommands({
			api: asAPI(api),
			applicationId: "app-id",
			commands: [ping],
			guildId: "guild-id",
		});

		assert.deepStrictEqual(
			api.applicationCommands.bulkOverwriteGuildCommands.mock.calls.map((call) => call.arguments),
			[["app-id", "guild-id", expectedBody]],
		);
		assert.strictEqual(api.applicationCommands.bulkOverwriteGlobalCommands.mock.callCount(), 0);
		assert.strictEqual(result, published);
	});
});
