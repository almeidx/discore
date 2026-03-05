import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApplicationCommandOptionType } from "discord-api-types/v10";
import { defineCommandGroup } from "../../src/definitions/command-group.ts";
import { defineCommand } from "../../src/definitions/command.ts";

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
		assert.strictEqual(group.subcommands[0]?.data.name, "ban");
		assert.strictEqual(group.subcommands[0]?.data.options[0]?.name, "user");
		assert.strictEqual(group.subcommands[0]?.data.options[0]?.type, ApplicationCommandOptionType.User);
	});
});
