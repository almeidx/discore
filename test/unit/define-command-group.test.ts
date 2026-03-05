import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApplicationCommandOptionType } from "discord-api-types/v10";
import { defineCommandGroup } from "../../src/definitions/command-group.ts";
import { defineCommand } from "../../src/definitions/command.ts";
import { DefinitionType, type CommandDefinition, type SubcommandGroup } from "../../src/types/definitions.ts";

describe("defineCommandGroup", () => {
	it("groups subcommands under one name", () => {
		const ban = defineCommand({
			data: {
				name: "ban",
				description: "Ban a user",
				options: [{ name: "user", type: ApplicationCommandOptionType.User, description: "u", required: true }] as const,
			},
			handler: async () => {},
		});

		const kick = defineCommand({
			data: { name: "kick", description: "Kick a user" },
			handler: async () => {},
		});

		const group = defineCommandGroup({
			data: { name: "mod", description: "Moderation commands" },
			subcommands: [ban, kick],
		});

		assert.strictEqual(group.type, DefinitionType.CommandGroup);
		assert.strictEqual(group.data.name, "mod");
		assert.strictEqual(group.subcommands.length, 2);

		const first = group.subcommands[0] as CommandDefinition;
		const second = group.subcommands[1] as CommandDefinition;
		assert.strictEqual(first.data.name, "ban");
		assert.strictEqual(second.data.name, "kick");
	});

	it("accepts SubcommandGroup entries", () => {
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

		const group = defineCommandGroup({
			data: { name: "manage", description: "Management commands" },
			subcommands: [roleGroup],
		});

		assert.strictEqual(group.subcommands.length, 1);

		const entry = group.subcommands[0] as SubcommandGroup;
		assert.ok(!("type" in entry));
		assert.strictEqual(entry.name, "role");
		assert.strictEqual(entry.subcommands.length, 2);
		assert.strictEqual(entry.subcommands[0]!.data.name, "add");
		assert.strictEqual(entry.subcommands[1]!.data.name, "remove");
	});
});
