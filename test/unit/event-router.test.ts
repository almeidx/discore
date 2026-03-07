import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { GatewayDispatchEvents } from "discord-api-types/v10";
import { createEventRouter } from "../../src/routing/event-router.ts";
import { DefinitionType, type EventDefinition } from "../../src/types/definitions.ts";
import { createMockAPI } from "../fixtures/mock-api.ts";

describe("createEventRouter", () => {
	it("dispatches event to matching handler", async () => {
		const handler = mock.fn(async () => {});
		const events: EventDefinition[] = [
			{ type: DefinitionType.Event, event: GatewayDispatchEvents.MessageCreate, priority: 0, handler },
		];

		const router = createEventRouter(events, {});
		const api = createMockAPI();

		await router.dispatch(GatewayDispatchEvents.MessageCreate, { content: "hi" }, api, {} as any, 0);

		assert.strictEqual(handler.mock.callCount(), 1);
	});

	it("does nothing for unregistered event", async () => {
		const router = createEventRouter([], {});
		const api = createMockAPI();

		await router.dispatch(GatewayDispatchEvents.MessageCreate, {}, api, {} as any, 0);
	});

	it("executes multiple handlers in priority order", async () => {
		const order: number[] = [];

		const events: EventDefinition[] = [
			{
				type: DefinitionType.Event,
				event: GatewayDispatchEvents.MessageCreate,
				priority: 10,
				handler: async () => {
					order.push(10);
				},
			},
			{
				type: DefinitionType.Event,
				event: GatewayDispatchEvents.MessageCreate,
				priority: 0,
				handler: async () => {
					order.push(0);
				},
			},
			{
				type: DefinitionType.Event,
				event: GatewayDispatchEvents.MessageCreate,
				priority: 5,
				handler: async () => {
					order.push(5);
				},
			},
		];

		const router = createEventRouter(events, {});
		await router.dispatch(GatewayDispatchEvents.MessageCreate, {}, createMockAPI(), {} as any, 0);

		assert.deepStrictEqual(order, [0, 5, 10]);
	});

	it("calls onEventError when handler throws", async () => {
		const onEventError = mock.fn(async () => {});
		const events: EventDefinition[] = [
			{
				type: DefinitionType.Event,
				event: GatewayDispatchEvents.MessageCreate,
				priority: 0,
				handler: async () => {
					throw new Error("boom");
				},
			},
		];

		const router = createEventRouter(events, { onEventError });
		await router.dispatch(GatewayDispatchEvents.MessageCreate, {}, createMockAPI(), {} as any, 0);

		assert.strictEqual(onEventError.mock.callCount(), 1);
		const errorArg = onEventError.mock.calls[0]!.arguments as unknown[];
		assert.strictEqual((errorArg[1] as Error).message, "boom");
	});

	it("does not propagate error when onEventError is set", async () => {
		const events: EventDefinition[] = [
			{
				type: DefinitionType.Event,
				event: GatewayDispatchEvents.MessageCreate,
				priority: 0,
				handler: async () => {
					throw new Error("boom");
				},
			},
		];

		const router = createEventRouter(events, { onEventError: async () => {} });

		await assert.doesNotReject(router.dispatch(GatewayDispatchEvents.MessageCreate, {}, createMockAPI(), {} as any, 0));
	});

	it("continues to next handler when one throws", async () => {
		const secondHandler = mock.fn(async () => {});
		const events: EventDefinition[] = [
			{
				type: DefinitionType.Event,
				event: GatewayDispatchEvents.MessageCreate,
				priority: 0,
				handler: async () => {
					throw new Error("first boom");
				},
			},
			{
				type: DefinitionType.Event,
				event: GatewayDispatchEvents.MessageCreate,
				priority: 1,
				handler: secondHandler,
			},
		];

		const router = createEventRouter(events, { onEventError: async () => {} });
		await router.dispatch(GatewayDispatchEvents.MessageCreate, {}, createMockAPI(), {} as any, 0);

		assert.strictEqual(secondHandler.mock.callCount(), 1);
	});
});
