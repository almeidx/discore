import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { GatewayDispatchEvents } from "discord-api-types/v10";
import { defineCommand, defineEvent } from "../../src/index.ts";
import { chatInputInteraction } from "../fixtures/interactions.ts";
import { createTestBot } from "../fixtures/test-bot.ts";

function createBotWith(commandHandler: () => void, eventHandler: () => void) {
	return createTestBot({
		commands: [defineCommand({ data: { name: "test", description: "d" }, handler: commandHandler })],
		events: [defineEvent({ event: GatewayDispatchEvents.InteractionCreate, handler: eventHandler })],
	});
}

describe("dispatch errors", () => {
	it("still runs event handlers when an interaction handler throws, then rethrows its error", async () => {
		const eventHandler = mock.fn(() => {});
		const { interact } = createBotWith(() => {
			throw new Error("boom");
		}, eventHandler);

		await assert.rejects(interact(chatInputInteraction("test")), { message: "boom" });

		assert.strictEqual(eventHandler.mock.callCount(), 1);
	});

	it("still runs interaction handlers when an event handler throws, then rethrows its error", async () => {
		const commandHandler = mock.fn(() => {});
		const { interact } = createBotWith(commandHandler, () => {
			throw new Error("event boom");
		});

		await assert.rejects(interact(chatInputInteraction("test")), { message: "event boom" });

		assert.strictEqual(commandHandler.mock.callCount(), 1);
	});

	it("rejects with an AggregateError carrying both errors when both fail", async () => {
		const interactionError = new Error("interaction boom");
		const eventError = new Error("event boom");
		const { interact } = createBotWith(
			() => {
				throw interactionError;
			},
			() => {
				throw eventError;
			},
		);

		await assert.rejects(interact(chatInputInteraction("test")), (error) => {
			assert.ok(error instanceof AggregateError);
			assert.strictEqual(error.message, "Dispatch failed");
			assert.deepStrictEqual(error.errors, [interactionError, eventError]);
			return true;
		});
	});

	it("rethrows the handler's error when sending the error response fails", async () => {
		const { api, interact } = createBotWith(
			() => {
				throw new Error("boom");
			},
			() => {},
		);
		api.interactions.reply.mock.mockImplementation(async () => {
			throw new Error("reply failed");
		});

		await assert.rejects(interact(chatInputInteraction("test")), { message: "boom" });

		assert.strictEqual(api.interactions.reply.mock.callCount(), 1);
	});

	it("runs the interaction handler before event handlers", async () => {
		const order: string[] = [];
		const { interact } = createBotWith(
			() => {
				order.push("interaction");
			},
			() => {
				order.push("event");
			},
		);

		await interact(chatInputInteraction("test"));

		assert.deepStrictEqual(order, ["interaction", "event"]);
	});
});
