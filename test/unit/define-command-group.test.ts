import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { defineCommand } from "../../src/definitions/command.ts";
import { defineCommandGroup } from "../../src/definitions/command-group.ts";
import { DefinitionType } from "../../src/types/definitions.ts";
import { ApplicationCommandOptionType } from "discord-api-types/v10";

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
		assert.strictEqual(group.subcommands[0]?.data.name, "ban");
		assert.strictEqual(group.subcommands[1]?.data.name, "kick");
	});
});
