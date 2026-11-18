import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { GatewayDispatchEvents } from "discord-api-types/v10";
import { defineEvent, type GlobalHooks } from "../../src/index.ts";
import { createTestBot } from "../fixtures/test-bot.ts";

function thrower(message: string) {
	return async () => {
		throw new Error(message);
	};
}

function errorMessages(error: unknown): string[] {
	assert.ok(error instanceof AggregateError);
	return Array.from(error.errors as Iterable<unknown>, (cause) => (cause as Error).message);
}

describe("event dispatch", () => {
	it("runs only the handlers registered for the dispatched event", async () => {
		const onMessage = mock.fn();
		const onGuild = mock.fn();
		const { dispatch } = createTestBot({
			events: [
				defineEvent({ event: GatewayDispatchEvents.MessageCreate, handler: onMessage }),
				defineEvent({ event: GatewayDispatchEvents.GuildCreate, handler: onGuild }),
			],
		});

		await dispatch(GatewayDispatchEvents.MessageCreate, {});
		await dispatch(GatewayDispatchEvents.TypingStart, {});

		assert.strictEqual(onMessage.mock.callCount(), 1);
		assert.strictEqual(onGuild.mock.callCount(), 0);
	});

	it("runs handlers in ascending priority order, defaulting to 0", async () => {
		const order: string[] = [];
		const handler = (label: string) => () => {
			order.push(label);
		};
		const { dispatch } = createTestBot({
			events: [
				defineEvent({ event: GatewayDispatchEvents.MessageCreate, priority: 10, handler: handler("10") }),
				defineEvent({ event: GatewayDispatchEvents.MessageCreate, handler: handler("default") }),
				defineEvent({ event: GatewayDispatchEvents.MessageCreate, priority: 5, handler: handler("5") }),
				defineEvent({ event: GatewayDispatchEvents.MessageCreate, priority: -1, handler: handler("-1") }),
			],
		});

		await dispatch(GatewayDispatchEvents.MessageCreate, {});

		assert.deepStrictEqual(order, ["-1", "default", "5", "10"]);
	});

	it("awaits each handler before starting the next", async () => {
		const order: string[] = [];
		const { dispatch } = createTestBot({
			events: [
				defineEvent({
					event: GatewayDispatchEvents.MessageCreate,
					priority: 0,
					handler: async () => {
						const { promise, resolve } = Promise.withResolvers<void>();
						setImmediate(resolve);
						await promise;
						order.push("first");
					},
				}),
				defineEvent({
					event: GatewayDispatchEvents.MessageCreate,
					priority: 1,
					handler: () => {
						order.push("second");
					},
				}),
			],
		});

		await dispatch(GatewayDispatchEvents.MessageCreate, {});

		assert.deepStrictEqual(order, ["first", "second"]);
	});

	it("runs once handlers on the first dispatch only", async () => {
		const once = mock.fn();
		const always = mock.fn();
		const { dispatch } = createTestBot({
			events: [
				defineEvent({ event: GatewayDispatchEvents.MessageCreate, once: true, handler: once }),
				defineEvent({ event: GatewayDispatchEvents.MessageCreate, handler: always }),
			],
		});

		await dispatch(GatewayDispatchEvents.MessageCreate, {});
		await dispatch(GatewayDispatchEvents.MessageCreate, {});

		assert.strictEqual(once.mock.callCount(), 1);
		assert.strictEqual(always.mock.callCount(), 2);
	});

	it("removes a once handler even when it throws", async () => {
		const handler = mock.fn(thrower("boom"));
		const { dispatch } = createTestBot({
			events: [defineEvent({ event: GatewayDispatchEvents.MessageCreate, once: true, handler })],
			hooks: { onEventError: () => {} },
		});

		await dispatch(GatewayDispatchEvents.MessageCreate, {});
		await dispatch(GatewayDispatchEvents.MessageCreate, {});

		assert.strictEqual(handler.mock.callCount(), 1);
	});

	it("rethrows a handler error when no error hook handles it", async () => {
		const { dispatch } = createTestBot({
			events: [defineEvent({ event: GatewayDispatchEvents.MessageCreate, handler: thrower("boom") })],
		});

		await assert.rejects(dispatch(GatewayDispatchEvents.MessageCreate, {}), { message: "boom" });
	});

	it("passes handler errors to onEventError instead of rethrowing", async () => {
		const payload = { content: "hi" };
		const onEventError = mock.fn<NonNullable<GlobalHooks["onEventError"]>>();
		const { dispatch } = createTestBot({
			events: [defineEvent({ event: GatewayDispatchEvents.MessageCreate, handler: thrower("boom") })],
			hooks: { onEventError },
		});

		await dispatch(GatewayDispatchEvents.MessageCreate, payload, 2);

		assert.strictEqual(onEventError.mock.callCount(), 1);
		const [ctx, error] = onEventError.mock.calls[0]!.arguments;
		assert.strictEqual(ctx.event, payload);
		assert.strictEqual(ctx.shardId, 2);
		assert.ok(error instanceof Error);
		assert.strictEqual(error.message, "boom");
	});

	it("runs the per-event onError before the global onEventError", async () => {
		const order: string[] = [];
		const { dispatch } = createTestBot({
			events: [
				defineEvent({
					event: GatewayDispatchEvents.MessageCreate,
					hooks: {
						onError: (_ctx, error) => {
							order.push(`event:${(error as Error).message}`);
						},
					},
					handler: thrower("boom"),
				}),
			],
			hooks: {
				onEventError: (_ctx, error) => {
					order.push(`global:${(error as Error).message}`);
				},
			},
		});

		await dispatch(GatewayDispatchEvents.MessageCreate, {});

		assert.deepStrictEqual(order, ["event:boom", "global:boom"]);
	});

	it("skips onEventError when the per-event onError returns false", async () => {
		const onEventError = mock.fn();
		const { dispatch } = createTestBot({
			events: [
				defineEvent({
					event: GatewayDispatchEvents.MessageCreate,
					hooks: { onError: () => false },
					handler: thrower("boom"),
				}),
			],
			hooks: { onEventError },
		});

		await dispatch(GatewayDispatchEvents.MessageCreate, {});

		assert.strictEqual(onEventError.mock.callCount(), 0);
	});

	it("does not rethrow when the per-event onError returns false and no global hook is set", async () => {
		const { dispatch } = createTestBot({
			events: [
				defineEvent({
					event: GatewayDispatchEvents.MessageCreate,
					hooks: { onError: () => false },
					handler: thrower("boom"),
				}),
			],
		});

		await assert.doesNotReject(dispatch(GatewayDispatchEvents.MessageCreate, {}));
	});

	it("keeps running later handlers after one throws", async () => {
		const second = mock.fn();
		const { dispatch } = createTestBot({
			events: [
				defineEvent({ event: GatewayDispatchEvents.MessageCreate, priority: 0, handler: thrower("first boom") }),
				defineEvent({ event: GatewayDispatchEvents.MessageCreate, priority: 1, handler: second }),
			],
		});

		await assert.rejects(dispatch(GatewayDispatchEvents.MessageCreate, {}), { message: "first boom" });
		assert.strictEqual(second.mock.callCount(), 1);
	});

	it("collects failures from several handlers into an AggregateError", async () => {
		const { dispatch } = createTestBot({
			events: [
				defineEvent({ event: GatewayDispatchEvents.MessageCreate, priority: 0, handler: thrower("first") }),
				defineEvent({ event: GatewayDispatchEvents.MessageCreate, priority: 1, handler: thrower("second") }),
			],
		});

		await assert.rejects(dispatch(GatewayDispatchEvents.MessageCreate, {}), (error: unknown) => {
			assert.deepStrictEqual(errorMessages(error), ["first", "second"]);
			return true;
		});
	});

	it("collects a throwing per-event onError together with the handler error", async () => {
		const { dispatch } = createTestBot({
			events: [
				defineEvent({
					event: GatewayDispatchEvents.MessageCreate,
					hooks: { onError: thrower("hook boom") },
					handler: thrower("handler boom"),
				}),
			],
		});

		await assert.rejects(dispatch(GatewayDispatchEvents.MessageCreate, {}), (error: unknown) => {
			assert.deepStrictEqual(errorMessages(error), ["hook boom", "handler boom"]);
			return true;
		});
	});

	it("rethrows an error thrown by onEventError", async () => {
		const { dispatch } = createTestBot({
			events: [defineEvent({ event: GatewayDispatchEvents.MessageCreate, handler: thrower("boom") })],
			hooks: { onEventError: thrower("global hook boom") },
		});

		await assert.rejects(dispatch(GatewayDispatchEvents.MessageCreate, {}), { message: "global hook boom" });
	});
});
