import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { defineCommand } from "../../src/definitions/command.ts";
import { DefinitionType } from "../../src/types/definitions.ts";
import { ApplicationCommandOptionType } from "discord-api-types/v10";

describe("defineCommand", () => {
	it("returns a command definition with correct shape", () => {
		const cmd = defineCommand({
			data: { name: "ping", description: "Pong!" },
			handler: async () => {},
		});

		assert.strictEqual(cmd.type, DefinitionType.Command);
		assert.strictEqual(cmd.data.name, "ping");
		assert.strictEqual(cmd.data.description, "Pong!");
		assert.deepStrictEqual(cmd.data.options, []);
	});

	it("includes options in the definition", () => {
		const cmd = defineCommand({
			data: {
				name: "ban",
				description: "Ban a user",
				options: [
					{ name: "user", type: ApplicationCommandOptionType.User, description: "The user", required: true },
				] as const,
			},
			handler: async () => {},
		});

		assert.strictEqual(cmd.data.options.length, 1);
		assert.strictEqual(cmd.data.options[0]?.name, "user");
		assert.strictEqual(cmd.data.options[0]?.type, ApplicationCommandOptionType.User);
	});

	it("includes hooks in the definition", () => {
		const cmd = defineCommand({
			data: { name: "test", description: "test" },
			hooks: {
				beforeCommand: async () => {},
			},
			handler: async () => {},
		});

		assert.ok(cmd.hooks?.beforeCommand);
	});
});
