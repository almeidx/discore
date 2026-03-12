import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { awaitComponent } from "../../src/collectors/await-component.ts";
import { collectComponents } from "../../src/collectors/collect-components.ts";
import { createCollectorStore } from "../../src/collectors/collector-store.ts";
import { CollectorTimeoutError } from "../../src/collectors/errors.ts";
import { createButtonContext } from "../../src/context/button.ts";
import type { ComponentInteractionContext } from "../../src/types/internal.ts";
import { buttonInteraction } from "../fixtures/interactions.ts";
import { createMockAPI } from "../fixtures/mock-api.ts";

function fakeButtonCtx(customId: string) {
	return createButtonContext(createMockAPI() as any, {} as any, buttonInteraction(customId), {});
}

describe("collector-store", () => {
	it("dispatches to matching collector", () => {
		const store = createCollectorStore<ComponentInteractionContext>();
		let received = false;

		store.register({
			filter: () => true,
			handle: () => {
				received = true;
			},
		});

		const ctx = fakeButtonCtx("test");
		const handled = store.dispatch(ctx);

		assert.strictEqual(handled, true);
		assert.strictEqual(received, true);
	});

	it("returns false when no collector matches", () => {
		const store = createCollectorStore<ComponentInteractionContext>();
		store.register({
			filter: () => false,
			handle: () => {},
		});

		const handled = store.dispatch(fakeButtonCtx("test"));
		assert.strictEqual(handled, false);
	});
});

describe("awaitComponent", () => {
	it("resolves when a matching component arrives", async () => {
		const store = createCollectorStore<ComponentInteractionContext>();
		const promise = awaitComponent(store, {
			filter: (ctx) => ctx.customId === "confirm",
			timeout: 5000,
		});

		const ctx = fakeButtonCtx("confirm");
		store.dispatch(ctx);

		const result = await promise;
		assert.strictEqual(result.customId, "confirm");
	});

	it("rejects on timeout", async () => {
		const store = createCollectorStore<ComponentInteractionContext>();
		const promise = awaitComponent(store, {
			filter: () => true,
			timeout: 50,
		});

		await assert.rejects(promise, CollectorTimeoutError);
	});
});

describe("collectComponents", () => {
	it("yields matching components and stops on max", async () => {
		const store = createCollectorStore<ComponentInteractionContext>();
		let endReason: string | undefined;

		const collector = collectComponents(store, {
			filter: () => true,
			timeout: 5000,
			max: 2,
			onEnd: (_, reason) => {
				endReason = reason;
			},
		});

		store.dispatch(fakeButtonCtx("btn1"));
		store.dispatch(fakeButtonCtx("btn2"));

		const results: string[] = [];
		for await (const ctx of collector) {
			results.push(ctx.customId);
		}

		assert.deepStrictEqual(results, ["btn1", "btn2"]);
		assert.strictEqual(endReason, "max");
	});

	it("stops manually", async () => {
		const store = createCollectorStore<ComponentInteractionContext>();
		let endReason: string | undefined;

		const collector = collectComponents(store, {
			filter: () => true,
			timeout: 5000,
			onEnd: (_, reason) => {
				endReason = reason;
			},
		});

		store.dispatch(fakeButtonCtx("btn1"));

		const iter = await collector.next();
		assert.strictEqual(iter.done, false);

		collector.stop();

		const done = await collector.next();
		assert.strictEqual(done.done, true);
		assert.strictEqual(endReason, "manual");
	});

	it("supports multiple pending next calls without hanging", async () => {
		const store = createCollectorStore<ComponentInteractionContext>();
		const collector = collectComponents(store, {
			filter: () => true,
			timeout: 5000,
		});

		const first = collector.next();
		const second = collector.next();

		store.dispatch(fakeButtonCtx("btn1"));
		store.dispatch(fakeButtonCtx("btn2"));

		const firstResult = await first;
		const secondResult = await second;

		assert.strictEqual(firstResult.done, false);
		assert.strictEqual(firstResult.value.customId, "btn1");
		assert.strictEqual(secondResult.done, false);
		assert.strictEqual(secondResult.value.customId, "btn2");
	});
});
