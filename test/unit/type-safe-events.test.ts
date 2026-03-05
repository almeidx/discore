import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GatewayDispatchEvents, type GatewayMessageCreateDispatchData } from "discord-api-types/v10";
import { defineEvent } from "../../src/definitions/event.ts";
import { createEventRouter } from "../../src/routing/event-router.ts";
import { DefinitionType } from "../../src/types/definitions.ts";
import { createMockAPI } from "../fixtures/mock-api.ts";

describe("type-safe event definitions", () => {
	it("defineEvent infers event type from event name", () => {
		const evt = defineEvent({
			event: GatewayDispatchEvents.MessageCreate,
			handler: async (ctx) => {
				const _msg: GatewayMessageCreateDispatchData = ctx.event;
				void _msg;
			},
		});

		assert.strictEqual(evt.type, DefinitionType.Event);
		assert.strictEqual(evt.event, GatewayDispatchEvents.MessageCreate);
	});

	it("default priority is 0", () => {
		const evt = defineEvent({
			event: GatewayDispatchEvents.Ready,
			handler: async () => {},
		});

		assert.strictEqual(evt.priority, 0);
	});

	it("typed event handler receives correct payload", async () => {
		let receivedContent: string | undefined;

		const evt = defineEvent({
			event: GatewayDispatchEvents.MessageCreate,
			handler: async (ctx) => {
				receivedContent = ctx.event.content;
			},
		});

		const router = createEventRouter([evt], {});
		const mockPayload = { content: "hello", author: { id: "1" } };
		await router.dispatch(GatewayDispatchEvents.MessageCreate, mockPayload, createMockAPI(), {} as any, 0);

		assert.strictEqual(receivedContent, "hello");
	});

	it("passes shardId to event context", async () => {
		let receivedShardId: number | undefined;

		const evt = defineEvent({
			event: GatewayDispatchEvents.Ready,
			handler: async (ctx) => {
				receivedShardId = ctx.shardId;
			},
		});

		const router = createEventRouter([evt], {});
		await router.dispatch(GatewayDispatchEvents.Ready, {}, createMockAPI(), {} as any, 3);

		assert.strictEqual(receivedShardId, 3);
	});
});
