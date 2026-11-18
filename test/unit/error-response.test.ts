import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { MessageFlags } from "discord-api-types/v10";
import { defineCommand, type CommandContext, type CreateBotOptions, type InteractionContext } from "../../src/index.ts";
import { chatInputInteraction } from "../fixtures/interactions.ts";
import { createTestBot } from "../fixtures/test-bot.ts";

function failingCommand(errorResponse?: CreateBotOptions["errorResponse"]) {
	const error = new Error("boom");
	const state: { ctx?: CommandContext } = {};
	const command = defineCommand({
		data: { name: "fail", description: "d" },
		handler: (ctx) => {
			state.ctx = ctx;
			throw error;
		},
	});
	return {
		error,
		state,
		interaction: chatInputInteraction("fail"),
		...createTestBot({ errorResponse, commands: [command] }),
	};
}

describe("command errorResponse", () => {
	it("replies 'Something went wrong.' ephemerally by default and rethrows", async () => {
		const { api, interact, interaction } = failingCommand();

		await assert.rejects(interact(interaction), { message: "boom" });

		assert.deepStrictEqual(
			api.interactions.reply.mock.calls.map((call) => call.arguments),
			[[interaction.id, interaction.token, { content: "Something went wrong.", flags: MessageFlags.Ephemeral }]],
		);
	});

	it("replies with a configured response object", async () => {
		const response = { content: "Oops" };
		const { api, interact, interaction } = failingCommand(response);

		await assert.rejects(interact(interaction), { message: "boom" });

		assert.deepStrictEqual(
			api.interactions.reply.mock.calls.map((call) => call.arguments),
			[[interaction.id, interaction.token, response]],
		);
	});

	it("replies with the result of a response function given the context and error", async () => {
		const errorResponse = mock.fn((_ctx: InteractionContext, error: unknown) => ({
			content: `Failed: ${(error as Error).message}`,
		}));
		const { api, interact, interaction, error, state } = failingCommand(errorResponse);

		await assert.rejects(interact(interaction), error);

		assert.strictEqual(errorResponse.mock.callCount(), 1);
		const [ctx, received] = errorResponse.mock.calls[0]!.arguments;
		assert.ok(state.ctx);
		assert.strictEqual(ctx, state.ctx);
		assert.strictEqual(received, error);
		assert.deepStrictEqual(
			api.interactions.reply.mock.calls.map((call) => call.arguments),
			[[interaction.id, interaction.token, { content: "Failed: boom" }]],
		);
	});

	it("sends nothing when set to null but still rethrows", async () => {
		const { api, interact, interaction } = failingCommand(null);

		await assert.rejects(interact(interaction), { message: "boom" });

		assert.strictEqual(api.interactions.reply.mock.callCount(), 0);
	});
});
