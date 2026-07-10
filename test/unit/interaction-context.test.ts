import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCollectorStore } from "../../src/collectors/collector-store.ts";
import { createAutocompleteContext } from "../../src/context/autocomplete.ts";
import { createButtonContext } from "../../src/context/button.ts";
import { createCommandContext } from "../../src/context/command.ts";
import { createEventContext } from "../../src/context/event.ts";
import { createInteractionContext } from "../../src/context/interaction.ts";
import type { InteractionCallbackResponse, InteractionContext, ModalContext } from "../../src/types/contexts.ts";
import type { ComponentInteractionContext } from "../../src/types/internal.ts";
import { autocompleteInteraction, buttonInteraction, chatInputInteraction } from "../fixtures/interactions.ts";
import { createMockAPI } from "../fixtures/mock-api.ts";
import { createMockBot } from "../fixtures/mock-bot.ts";

describe("createInteractionContext", () => {
	it("tracks replied state after reply", async () => {
		const api = createMockAPI();
		const interaction = chatInputInteraction("test");
		const ctx = createInteractionContext(createMockBot(api), interaction);

		assert.strictEqual(ctx.replied, false);
		assert.strictEqual(ctx.deferred, false);

		await ctx.reply({ content: "hello" });

		assert.strictEqual(ctx.replied, true);
		assert.strictEqual(api.interactions.reply.mock.callCount(), 1);
	});

	it("auto-delegates to followUp when already replied", async () => {
		const api = createMockAPI();
		const interaction = chatInputInteraction("test");
		const ctx = createInteractionContext(createMockBot(api), interaction);

		await ctx.reply({ content: "first" });
		await ctx.reply({ content: "second" });

		assert.strictEqual(api.interactions.reply.mock.callCount(), 1);
		assert.strictEqual(api.interactions.followUp.mock.callCount(), 1);
	});

	it("tracks deferred state", async () => {
		const api = createMockAPI();
		const interaction = chatInputInteraction("test");
		const ctx = createInteractionContext(createMockBot(api), interaction);

		const response = await ctx.defer();

		assert.strictEqual(response, undefined);
		assert.strictEqual(ctx.deferred, true);
		assert.strictEqual(ctx.replied, true);
		assert.strictEqual(api.interactions.defer.mock.callCount(), 1);
	});

	it("returns the interaction callback response when requested", async () => {
		const api = createMockAPI();
		const interaction = chatInputInteraction("test");
		const ctx = createInteractionContext(createMockBot(api), interaction);
		const callback = {
			interaction: { id: interaction.id, type: interaction.type },
		} as InteractionCallbackResponse;

		api.interactions.defer.mock.mockImplementationOnce(async () => callback);

		const response = await ctx.defer({ with_response: true });

		assert.strictEqual(response, callback);
		assert.deepStrictEqual(api.interactions.defer.mock.calls[0]!.arguments[2], { with_response: true });
		assert.strictEqual(ctx.deferred, true);
		assert.strictEqual(ctx.replied, true);
	});

	it("tracks replied state after showModal", async () => {
		const api = createMockAPI();
		const interaction = chatInputInteraction("test");
		const ctx = createInteractionContext(createMockBot(api), interaction);

		await ctx.showModal({ title: "Test", custom_id: "test", components: [] });

		assert.strictEqual(ctx.replied, true);
		assert.strictEqual(api.interactions.createModal.mock.callCount(), 1);
	});

	it("preserves live reply state in derived command contexts", async () => {
		const api = createMockAPI();
		const ctx = createCommandContext(
			createMockBot(api),
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
		const ctx = createButtonContext(createMockBot(api), buttonInteraction("confirm"), {});

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
		const ctx = createButtonContext(createMockBot(api), buttonInteraction("confirm"), {});

		await ctx.deferUpdate();

		assert.strictEqual(ctx.replied, true);
		assert.strictEqual(ctx.deferred, true);
		assert.strictEqual(api.interactions.deferMessageUpdate.mock.callCount(), 1);
	});

	it("exposes the same bot instance on base and derived interaction contexts", () => {
		const bot = createMockBot();
		const interactionCtx = createInteractionContext(bot, chatInputInteraction("test"));
		const commandCtx = createCommandContext(
			bot,
			chatInputInteraction("test"),
			createCollectorStore<ComponentInteractionContext>(),
			createCollectorStore<ModalContext>(),
		);
		const buttonCtx = createButtonContext(bot, buttonInteraction("confirm"), {});
		const autocompleteCtx = createAutocompleteContext(
			bot,
			autocompleteInteraction("search", { name: "query", type: 3, value: "test" }),
		);
		const eventCtx = createEventContext(bot, { content: "test" }, 0);

		assert.strictEqual(interactionCtx.bot, bot);
		assert.strictEqual(commandCtx.bot, bot);
		assert.strictEqual(buttonCtx.bot, bot);
		assert.strictEqual(autocompleteCtx.bot, bot);
		assert.strictEqual(eventCtx.bot, bot);
	});
});

function assertDeferReturnTypes(ctx: InteractionContext, withResponse: boolean) {
	const response: Promise<InteractionCallbackResponse> = ctx.defer({ with_response: true });
	const noResponse: Promise<undefined> = ctx.defer();
	const explicitNoResponse: Promise<undefined> = ctx.defer({ with_response: false });
	const optionalResponse: Promise<InteractionCallbackResponse | undefined> = ctx.defer({
		with_response: withResponse,
	});

	void response;
	void noResponse;
	void explicitNoResponse;
	void optionalResponse;
}

void assertDeferReturnTypes;

describe("interaction state re-entrancy", () => {
	it("concurrent replies send one initial reply and one follow-up", async () => {
		const api = createMockAPI();
		const ctx = createInteractionContext(createMockBot(api), chatInputInteraction("test"));

		await Promise.all([ctx.reply({ content: "a" }), ctx.reply({ content: "b" })]);

		assert.strictEqual(api.interactions.reply.mock.callCount(), 1);
		assert.strictEqual(api.interactions.followUp.mock.callCount(), 1);
	});

	it("failed initial reply rolls back so a retry replies instead of following up", async () => {
		const api = createMockAPI();
		const ctx = createInteractionContext(createMockBot(api), chatInputInteraction("test"));
		api.interactions.reply.mock.mockImplementationOnce(async () => {
			throw new Error("network");
		});

		await assert.rejects(ctx.reply({ content: "a" }), { message: "network" });
		assert.strictEqual(ctx.replied, false);

		await ctx.reply({ content: "a" });

		assert.strictEqual(api.interactions.reply.mock.callCount(), 2);
		assert.strictEqual(api.interactions.followUp.mock.callCount(), 0);
	});

	it("defer after reply rejects with a descriptive error", async () => {
		const api = createMockAPI();
		const ctx = createInteractionContext(createMockBot(api), chatInputInteraction("test"));

		await ctx.reply({ content: "hello" });

		await assert.rejects(ctx.defer(), { message: /already acknowledged/ });
		assert.strictEqual(api.interactions.defer.mock.callCount(), 0);
	});

	it("showModal after reply rejects with a descriptive error", async () => {
		const api = createMockAPI();
		const ctx = createInteractionContext(createMockBot(api), chatInputInteraction("test"));

		await ctx.reply({ content: "hello" });

		await assert.rejects(ctx.showModal({ title: "Test", custom_id: "test", components: [] }), {
			message: /already acknowledged/,
		});
		assert.strictEqual(api.interactions.createModal.mock.callCount(), 0);
	});

	it("update after reply rejects with a descriptive error", async () => {
		const api = createMockAPI();
		const ctx = createButtonContext(createMockBot(api), buttonInteraction("confirm"), {});

		await ctx.reply({ content: "hello" });

		await assert.rejects(ctx.update({ content: "x" }), { message: /already acknowledged/ });
		assert.strictEqual(api.interactions.updateMessage.mock.callCount(), 0);
	});

	it("failed defer rolls back both flags", async () => {
		const api = createMockAPI();
		const ctx = createInteractionContext(createMockBot(api), chatInputInteraction("test"));
		api.interactions.defer.mock.mockImplementationOnce(async () => {
			throw new Error("network");
		});

		await assert.rejects(ctx.defer());
		assert.strictEqual(ctx.deferred, false);
		assert.strictEqual(ctx.replied, false);

		await ctx.reply({ content: "a" });

		assert.strictEqual(api.interactions.reply.mock.callCount(), 1);
		assert.strictEqual(api.interactions.followUp.mock.callCount(), 0);
	});

	it("failed showModal rolls back", async () => {
		const api = createMockAPI();
		const ctx = createInteractionContext(createMockBot(api), chatInputInteraction("test"));
		api.interactions.createModal.mock.mockImplementationOnce(async () => {
			throw new Error("network");
		});

		await assert.rejects(ctx.showModal({ title: "Test", custom_id: "test", components: [] }));

		assert.strictEqual(ctx.replied, false);
	});

	it("failed update rolls back", async () => {
		const api = createMockAPI();
		const ctx = createButtonContext(createMockBot(api), buttonInteraction("confirm"), {});
		api.interactions.updateMessage.mock.mockImplementationOnce(async () => {
			throw new Error("network");
		});

		await assert.rejects(ctx.update({ content: "a" }), { message: "network" });
		assert.strictEqual(ctx.replied, false);
		assert.strictEqual(ctx.deferred, false);

		await ctx.update({ content: "a" });

		assert.strictEqual(api.interactions.updateMessage.mock.callCount(), 2);
		assert.strictEqual(ctx.replied, true);
		assert.strictEqual(ctx.deferred, false);
	});

	it("failed deferUpdate rolls back", async () => {
		const api = createMockAPI();
		const ctx = createButtonContext(createMockBot(api), buttonInteraction("confirm"), {});
		api.interactions.deferMessageUpdate.mock.mockImplementationOnce(async () => {
			throw new Error("network");
		});

		await assert.rejects(ctx.deferUpdate(), { message: "network" });
		assert.strictEqual(ctx.replied, false);
		assert.strictEqual(ctx.deferred, false);

		await ctx.deferUpdate();

		assert.strictEqual(api.interactions.deferMessageUpdate.mock.callCount(), 2);
		assert.strictEqual(ctx.replied, true);
		assert.strictEqual(ctx.deferred, true);
	});
});
