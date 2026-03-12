import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCollectorStore } from "../../src/collectors/collector-store.ts";
import { createButtonContext } from "../../src/context/button.ts";
import { createCommandContext } from "../../src/context/command.ts";
import { createInteractionContext } from "../../src/context/interaction.ts";
import type { ModalContext } from "../../src/types/contexts.ts";
import type { ComponentInteractionContext } from "../../src/types/internal.ts";
import { buttonInteraction, chatInputInteraction } from "../fixtures/interactions.ts";
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

	it("preserves live reply state in derived command contexts", async () => {
		const api = createMockAPI();
		const ctx = createCommandContext(
			api,
			{} as any,
			chatInputInteraction("test"),
			createCollectorStore<ComponentInteractionContext>(),
			createCollectorStore<ModalContext>(),
		);

		await ctx.reply({ content: "hello" });
		assert.strictEqual(ctx.replied, true);

		await ctx.reply({ content: "again" });
		assert.strictEqual(api.interactions.reply.mock.callCount(), 1);
		assert.strictEqual(api.interactions.followUp.mock.callCount(), 1);
	});

	it("marks component contexts as acknowledged after update", async () => {
		const api = createMockAPI();
		const ctx = createButtonContext(api, {} as any, buttonInteraction("confirm"), {});

		await ctx.update({ content: "updated" });

		assert.strictEqual(ctx.replied, true);
		assert.strictEqual(ctx.deferred, false);
		assert.strictEqual(api.interactions.updateMessage.mock.callCount(), 1);

		await ctx.reply({ content: "follow-up" });
		assert.strictEqual(api.interactions.reply.mock.callCount(), 0);
		assert.strictEqual(api.interactions.followUp.mock.callCount(), 1);
	});

	it("marks component contexts as deferred after deferUpdate", async () => {
		const api = createMockAPI();
		const ctx = createButtonContext(api, {} as any, buttonInteraction("confirm"), {});

		await ctx.deferUpdate();

		assert.strictEqual(ctx.replied, true);
		assert.strictEqual(ctx.deferred, true);
		assert.strictEqual(api.interactions.deferMessageUpdate.mock.callCount(), 1);
	});
});
