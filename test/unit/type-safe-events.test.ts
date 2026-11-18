import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	GatewayDispatchEvents,
	type GatewayMessageCreateDispatchData,
	type GatewayReadyDispatchData,
} from "discord-api-types/v10";
import { defineEvent } from "../../src/index.ts";
import { createTestBot } from "../fixtures/test-bot.ts";

function assertEventTyping(): void {
	defineEvent({
		event: GatewayDispatchEvents.MessageCreate,
		hooks: {
			onError: (ctx) => {
				const _message: GatewayMessageCreateDispatchData = ctx.event;
				void _message;
			},
		},
		handler: (ctx) => {
			const _message: GatewayMessageCreateDispatchData = ctx.event;
			// @ts-expect-error MessageCreate data is a message, not Ready data; fails if ctx.event widens to any
			const _ready: GatewayReadyDispatchData = ctx.event;
			void _message;
			void _ready;
		},
	});
}

void assertEventTyping;

describe("type-safe event definitions", () => {
	it("gives handlers the dispatched payload and shard id", async () => {
		let received: { content: string; shardId: number } | undefined;
		const { dispatch } = createTestBot({
			events: [
				defineEvent({
					event: GatewayDispatchEvents.MessageCreate,
					handler: (ctx) => {
						received = { content: ctx.event.content, shardId: ctx.shardId };
					},
				}),
			],
		});

		await dispatch(GatewayDispatchEvents.MessageCreate, { content: "hello", author: { id: "1" } }, 3);

		assert.ok(received);
		assert.strictEqual(received.content, "hello");
		assert.strictEqual(received.shardId, 3);
	});
});
