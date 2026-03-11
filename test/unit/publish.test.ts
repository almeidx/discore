import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApplicationCommandOptionType } from "discord-api-types/v10";
import { defineCommandGroup } from "../../src/definitions/command-group.ts";
import { defineCommand } from "../../src/definitions/command.ts";
import { defineMessageCommand } from "../../src/definitions/message-command.ts";
import { defineUserCommand } from "../../src/definitions/user-command.ts";
import { publishCommands } from "../../src/publish.ts";
import type { CommandDefinition, SubcommandGroup } from "../../src/types/definitions.ts";
import { createMockREST } from "../fixtures/mock-api.ts";

describe("publishCommands", () => {
	it("command definitions produce correct meta", () => {
		const cmd = defineCommand({
			data: { name: "ping", description: "Pong!" },
			handler: async () => {},
		});

		assert.strictEqual(cmd.data.name, "ping");
		assert.strictEqual(cmd.data.description, "Pong!");
		assert.deepStrictEqual(cmd.data.options, []);
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
	});

	it("user command definition produces correct meta", () => {
		const cmd = defineUserCommand({
			data: { name: "User Info" },
			handler: async () => {},
		});

		assert.strictEqual(cmd.data.name, "User Info");
	});

	it("message command definition produces correct meta", () => {
		const cmd = defineMessageCommand({
			data: { name: "Bookmark" },
			handler: async () => {},
		});

		assert.strictEqual(cmd.data.name, "Bookmark");
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
	});

	it("publishes command payloads through the REST client", async () => {
		const rest = createMockREST();
		rest.get.mock.mockImplementation(async () => ({ id: "app-id" }));
		rest.put.mock.mockImplementation(async (_route: string, init: { body: unknown }) => init.body);

		const cmd = defineCommand({
			data: { name: "ping", description: "Pong!" },
			handler: async () => {},
		});

		const result = await publishCommands({ rest, commands: [cmd] });

		assert.strictEqual(rest.get.mock.callCount(), 1);
		assert.strictEqual(rest.put.mock.callCount(), 1);
		assert.deepStrictEqual(result, [{ name: "ping", description: "Pong!", options: [], type: 1 }]);
	});
});
