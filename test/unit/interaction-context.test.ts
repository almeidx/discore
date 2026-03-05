import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInteractionContext } from "../../src/context/interaction.ts";
import { chatInputInteraction } from "../fixtures/interactions.ts";
import { createMockAPI } from "../fixtures/mock-api.ts";

describe("createInteractionContext", () => {
	it("tracks replied state after reply", async () => {
		const api = createMockAPI();
		const interaction = chatInputInteraction("test");
		const ctx = createInteractionContext(api, {} as any, interaction);

		assert.strictEqual(ctx.replied, false);
		assert.strictEqual(ctx.deferred, false);

		await ctx.reply({ content: "hello" });

		assert.strictEqual(ctx.replied, true);
		assert.strictEqual(api.interactions.reply.mock.callCount(), 1);
	});

	it("auto-delegates to followUp when already replied", async () => {
		const api = createMockAPI();
		const interaction = chatInputInteraction("test");
		const ctx = createInteractionContext(api, {} as any, interaction);

		await ctx.reply({ content: "first" });
		await ctx.reply({ content: "second" });

		assert.strictEqual(api.interactions.reply.mock.callCount(), 1);
		assert.strictEqual(api.interactions.followUp.mock.callCount(), 1);
	});

	it("tracks deferred state", async () => {
		const api = createMockAPI();
		const interaction = chatInputInteraction("test");
		const ctx = createInteractionContext(api, {} as any, interaction);

		await ctx.defer();

		assert.strictEqual(ctx.deferred, true);
		assert.strictEqual(ctx.replied, true);
		assert.strictEqual(api.interactions.defer.mock.callCount(), 1);
	});

	it("tracks replied state after showModal", async () => {
		const api = createMockAPI();
		const interaction = chatInputInteraction("test");
		const ctx = createInteractionContext(api, {} as any, interaction);

		await ctx.showModal({ title: "Test", custom_id: "test", components: [] });

		assert.strictEqual(ctx.replied, true);
		assert.strictEqual(api.interactions.createModal.mock.callCount(), 1);
	});
});
