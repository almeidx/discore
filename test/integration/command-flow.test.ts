import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { defineCommand, type CommandContext } from "../../src/index.ts";
import { chatInputInteraction } from "../fixtures/interactions.ts";
import { createTestBot } from "../fixtures/test-bot.ts";

describe("command flow", () => {
	it("runs the matching command with the interaction on its context", async () => {
		let context: CommandContext | undefined;
		const ping = defineCommand({
			data: { name: "ping", description: "d" },
			handler: (ctx) => {
				context = ctx;
			},
		});
		const other = mock.fn(() => {});
		const { interact } = createTestBot({
			commands: [ping, defineCommand({ data: { name: "other", description: "d" }, handler: other })],
		});
		const interaction = chatInputInteraction("ping");

		await interact(interaction);

		assert.strictEqual(context?.interaction, interaction);
		assert.strictEqual(other.mock.callCount(), 0);
	});

	it("ignores commands that are not registered", async () => {
		const handler = mock.fn(() => {});
		const afterInteraction = mock.fn(() => {});
		const { api, interact } = createTestBot({
			commands: [defineCommand({ data: { name: "ping", description: "d" }, handler })],
			hooks: { afterInteraction },
		});

		await interact(chatInputInteraction("unknown"));

		assert.strictEqual(handler.mock.callCount(), 0);
		assert.strictEqual(afterInteraction.mock.callCount(), 0);
		assert.strictEqual(api.interactions.reply.mock.callCount(), 0);
	});
});
