import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCollectorStore } from "../../src/collectors/collector-store.ts";
import { awaitComponent } from "../../src/collectors/await-component.ts";
import { collectComponents } from "../../src/collectors/collect-components.ts";
import { CollectorTimeoutError } from "../../src/collectors/errors.ts";
import { createButtonContext } from "../../src/context/button.ts";
import { createMockAPI } from "../fixtures/mock-api.ts";
import { buttonInteraction } from "../fixtures/interactions.ts";

function fakeButtonCtx(customId: string) {
	return createButtonContext(createMockAPI() as any, {} as any, buttonInteraction(customId), {});
}

describe("collector-store", () => {
	it("dispatches to matching collector", () => {
		const store = createCollectorStore();
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
		const store = createCollectorStore();
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
		const store = createCollectorStore();
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
		const store = createCollectorStore();
		const promise = awaitComponent(store, {
			filter: () => true,
			timeout: 50,
		});

		await assert.rejects(promise, CollectorTimeoutError);
	});
});

describe("collectComponents", () => {
	it("yields matching components and stops on max", async () => {
		const store = createCollectorStore();
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
		const store = createCollectorStore();
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
});
