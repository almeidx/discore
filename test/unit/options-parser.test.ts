import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApplicationCommandOptionType } from "discord-api-types/v10";
import { parseOptions } from "../../src/options-parser.ts";
import { chatInputInteraction, subcommandInteraction } from "../fixtures/interactions.ts";

describe("parseOptions", () => {
	it("parses flat options", () => {
		const interaction = chatInputInteraction("test", [
			{ name: "name", type: ApplicationCommandOptionType.String, value: "hello" },
			{ name: "count", type: ApplicationCommandOptionType.Integer, value: 42 },
		]);

		const result = parseOptions(interaction);
		assert.deepStrictEqual(result.options, { name: "hello", count: 42 });
		assert.strictEqual(result.subcommand, undefined);
		assert.strictEqual(result.subcommandGroup, undefined);
	});

	it("parses subcommand options", () => {
		const interaction = subcommandInteraction("mod", "ban", [
			{ name: "user", type: ApplicationCommandOptionType.User, value: "999" },
		]);
		(interaction.data as any).resolved = {
			users: { "999": { id: "999", username: "test", discriminator: "0", avatar: null, global_name: null } },
		};

		const result = parseOptions(interaction);
		assert.deepStrictEqual(result.options, {
			user: {
				user: { id: "999", username: "test", discriminator: "0", avatar: null, global_name: null },
				member: undefined,
			},
		});
		assert.strictEqual(result.subcommand, "ban");
	});

	it("handles empty options", () => {
		const interaction = chatInputInteraction("ping");
		const result = parseOptions(interaction);
		assert.deepStrictEqual(result.options, {});
	});
});
