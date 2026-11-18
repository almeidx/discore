import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
	CollectorTimeoutError,
	defineButton,
	defineCommand,
	defineModal,
	type ButtonContext,
	type CollectComponentsOptions,
	type CommandContext,
	type InteractionDefinition,
	type ModalContext,
} from "../../src/index.ts";
import {
	buttonInteraction,
	chatInputInteraction,
	modalSubmitInteraction,
	selectMenuInteraction,
} from "../fixtures/interactions.ts";
import { createTestBot, type TestBot } from "../fixtures/test-bot.ts";

interface Collecting<T> extends TestBot {
	/** Settles with the collector's outcome once the command handler has finished. */
	result: Promise<T>;
}

/**
 * Runs a command whose handler calls `collect` and resolves once `collect` has registered its collector,
 * so the test can deliver interactions while the handler is still waiting on them.
 */
async function collectFromCommand<T>(
	collect: (ctx: CommandContext) => Promise<T>,
	interactions: InteractionDefinition[] = [],
): Promise<Collecting<T>> {
	const registered = Promise.withResolvers<{ pending: Promise<T> }>();
	const command = defineCommand({
		data: { name: "collect", description: "Collects interactions" },
		handler: async (ctx) => {
			const pending = collect(ctx);
			registered.resolve({ pending });
			await pending.catch(() => {});
		},
	});
	const testBot = createTestBot({ commands: [command], interactions });
	const handlerDone = testBot.interact(chatInputInteraction("collect"));
	const { pending } = await Promise.race([
		registered.promise,
		handlerDone.then(() => {
			throw new Error("command finished without starting a collector");
		}),
	]);
	return { ...testBot, result: handlerDone.then(() => pending) };
}

function persistentButton(customId: string | RegExp) {
	const handler = mock.fn<(ctx: ButtonContext) => Promise<void>>(async () => {});
	return { handler, definition: defineButton({ customId, handler }) };
}

function persistentModal(customId: string) {
	const handler = mock.fn<(ctx: ModalContext) => Promise<void>>(async () => {});
	return { handler, definition: defineModal({ customId, handler }) };
}

describe("awaitComponent", () => {
	it("intercepts a matching component before persistent handlers", async () => {
		const persistent = persistentButton("confirm");
		const { interact, result } = await collectFromCommand(
			(ctx) => ctx.awaitComponent({ filter: (i) => i.customId === "confirm", timeout: 5000 }),
			[persistent.definition],
		);

		await interact(buttonInteraction("confirm"));

		assert.strictEqual((await result).customId, "confirm");
		assert.strictEqual(persistent.handler.mock.callCount(), 0);
	});

	it("intercepts select menus with their values", async () => {
		const { interact, result } = await collectFromCommand((ctx) =>
			ctx.awaitComponent({ filter: (i) => i.customId === "choose", timeout: 5000 }),
		);

		await interact(selectMenuInteraction("choose", ["a", "b"]));

		const selected = await result;
		assert.ok("values" in selected);
		assert.deepStrictEqual(selected.values, ["a", "b"]);
	});

	it("lets components rejected by the filter reach persistent handlers", async () => {
		const persistent = persistentButton("other");
		const { interact, result } = await collectFromCommand(
			(ctx) => ctx.awaitComponent({ filter: (i) => i.customId === "confirm", timeout: 5000 }),
			[persistent.definition],
		);

		await interact(buttonInteraction("other"));
		assert.strictEqual(persistent.handler.mock.callCount(), 1);

		await interact(buttonInteraction("confirm"));
		assert.strictEqual((await result).customId, "confirm");
	});

	it("rejects with CollectorTimeoutError after the timeout and stops intercepting", async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout"] });
		const persistent = persistentButton("confirm");
		const { interact, result } = await collectFromCommand(
			(ctx) => ctx.awaitComponent({ filter: () => true, timeout: 50 }),
			[persistent.definition],
		);

		t.mock.timers.tick(50);

		await assert.rejects(result, (error) => {
			assert.ok(error instanceof CollectorTimeoutError);
			assert.strictEqual(error.message, "Collector timed out after 50ms");
			return true;
		});
		await interact(buttonInteraction("confirm"));
		assert.strictEqual(persistent.handler.mock.callCount(), 1);
	});
});

describe("awaitModal", () => {
	it("intercepts a matching modal submission before persistent handlers", async () => {
		const persistent = persistentModal("test-modal");
		const { interact, result } = await collectFromCommand(
			(ctx) => ctx.awaitModal({ filter: (i) => i.customId === "test-modal", timeout: 5000 }),
			[persistent.definition],
		);

		await interact(modalSubmitInteraction("test-modal", [{ custom_id: "name", value: "hello" }]));

		const submitted = await result;
		assert.strictEqual(submitted.customId, "test-modal");
		assert.strictEqual(submitted.fields.getRequired("name"), "hello");
		assert.strictEqual(persistent.handler.mock.callCount(), 0);
	});

	it("stops intercepting after resolving", async () => {
		const persistent = persistentModal("feedback");
		const { interact, result } = await collectFromCommand(
			(ctx) => ctx.awaitModal({ filter: (i) => i.customId === "feedback", timeout: 5000 }),
			[persistent.definition],
		);

		await interact(modalSubmitInteraction("feedback", []));
		await result;
		await interact(modalSubmitInteraction("feedback", []));

		assert.strictEqual(persistent.handler.mock.callCount(), 1);
	});

	it("rejects with CollectorTimeoutError after the timeout and stops intercepting", async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout"] });
		const persistent = persistentModal("feedback");
		const { interact, result } = await collectFromCommand(
			(ctx) => ctx.awaitModal({ filter: () => true, timeout: 50 }),
			[persistent.definition],
		);

		t.mock.timers.tick(50);

		await assert.rejects(result, CollectorTimeoutError);
		await interact(modalSubmitInteraction("feedback", []));
		assert.strictEqual(persistent.handler.mock.callCount(), 1);
	});
});

describe("collectComponents", () => {
	type OnEnd = NonNullable<CollectComponentsOptions["onEnd"]>;

	it("buffers components until iterated and ends after max", async () => {
		const persistent = persistentButton(/^btn/);
		const onEnd = mock.fn<OnEnd>();
		const startIterating = Promise.withResolvers<void>();
		const { interact, result } = await collectFromCommand(
			async (ctx) => {
				const collector = ctx.collectComponents({ filter: () => true, timeout: 5000, max: 2, onEnd });
				await startIterating.promise;
				const ids: string[] = [];
				for await (const component of collector) ids.push(component.customId);
				return ids;
			},
			[persistent.definition],
		);

		await interact(buttonInteraction("btn1"));
		await interact(buttonInteraction("btn2"));
		await interact(buttonInteraction("btn3"));
		startIterating.resolve();

		assert.deepStrictEqual(await result, ["btn1", "btn2"]);
		assert.deepStrictEqual(
			onEnd.mock.calls.map((call) => call.arguments[1]),
			["max"],
		);
		assert.deepStrictEqual(
			onEnd.mock.calls[0]!.arguments[0].map((component) => component.customId),
			["btn1", "btn2"],
		);
		assert.strictEqual(persistent.handler.mock.callCount(), 1);
		assert.strictEqual(persistent.handler.mock.calls[0]!.arguments[0].customId, "btn3");
	});

	it("ends when stopped manually", async () => {
		const persistent = persistentButton(/^btn/);
		const onEnd = mock.fn<OnEnd>();
		const { interact, result } = await collectFromCommand(
			async (ctx) => {
				const collector = ctx.collectComponents({ filter: () => true, timeout: 5000, onEnd });
				const first = await collector.next();
				collector.stop();
				return { first: first.value?.customId, afterStop: await collector.next() };
			},
			[persistent.definition],
		);

		await interact(buttonInteraction("btn1"));
		const { first, afterStop } = await result;
		await interact(buttonInteraction("btn2"));

		assert.strictEqual(first, "btn1");
		assert.strictEqual(afterStop.done, true);
		assert.deepStrictEqual(
			onEnd.mock.calls.map((call) => call.arguments[1]),
			["manual"],
		);
		assert.strictEqual(persistent.handler.mock.callCount(), 1);
	});

	it("ends with the timeout reason and completes a pending iteration", async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout"] });
		const onEnd = mock.fn<OnEnd>();
		const { interact, result } = await collectFromCommand(async (ctx) => {
			const ids: string[] = [];
			for await (const component of ctx.collectComponents({ filter: () => true, timeout: 1000, onEnd })) {
				ids.push(component.customId);
			}
			return ids;
		});

		await interact(buttonInteraction("btn1"));
		t.mock.timers.tick(1000);

		assert.deepStrictEqual(await result, ["btn1"]);
		assert.deepStrictEqual(
			onEnd.mock.calls.map((call) => call.arguments[1]),
			["timeout"],
		);
	});

	it("resolves concurrent pending next calls in arrival order", async () => {
		const { interact, result } = await collectFromCommand(async (ctx) => {
			const collector = ctx.collectComponents({ filter: () => true, timeout: 5000 });
			const results = await Promise.all([collector.next(), collector.next()]);
			collector.stop();
			return results.map((next) => next.value?.customId);
		});

		await interact(buttonInteraction("btn1"));
		await interact(buttonInteraction("btn2"));

		assert.deepStrictEqual(await result, ["btn1", "btn2"]);
	});
});
