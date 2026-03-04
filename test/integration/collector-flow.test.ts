import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createBot } from "../../src/bot.ts";
import { defineCommand } from "../../src/definitions/command.ts";
import { defineButton } from "../../src/definitions/button.ts";
import { defineModal } from "../../src/definitions/modal.ts";
import { createMockREST } from "../fixtures/mock-api.ts";
import { createMockGateway } from "../fixtures/mock-gateway.ts";
import { chatInputInteraction, buttonInteraction, modalSubmitInteraction } from "../fixtures/interactions.ts";
import { GatewayDispatchEvents } from "discord-api-types/v10";
describe("collector flow integration", () => {
	it("collector intercepts component before persistent handler", async () => {
		const persistentHandler = mock.fn(async () => {});
		const button = defineButton({
			customId: /^confirm$/,
			handler: persistentHandler,
		});

		let collectorResolved = false;

		const cmd = defineCommand({
			data: { name: "test", description: "test" },
			handler: async (ctx) => {
				await ctx.reply({ content: "Click!" });

				const promise = ctx.awaitComponent({
					filter: (i) => i.customId === "confirm",
					timeout: 5000,
				});

				setTimeout(() => {
					gateway.dispatch(GatewayDispatchEvents.InteractionCreate, buttonInteraction("confirm"));
				}, 10);

				const result = await promise;
				collectorResolved = true;
				assert.strictEqual(result.customId, "confirm");
			},
		});

		const gateway = createMockGateway();
		createBot({
			rest: createMockREST(),
			gateway: gateway as any,
			commands: [cmd],
			interactions: [button],
		});

		gateway.dispatch(GatewayDispatchEvents.InteractionCreate, chatInputInteraction("test"));
		await new Promise((r) => setTimeout(r, 200));

		assert.strictEqual(collectorResolved, true);
		assert.strictEqual(persistentHandler.mock.callCount(), 0);
	});

	it("collector intercepts modal submission before persistent handler", async () => {
		const persistentHandler = mock.fn(async () => {});
		const modal = defineModal({
			customId: /^test-modal$/,
			handler: persistentHandler,
		});

		let collectorResolved = false;

		const cmd = defineCommand({
			data: { name: "modal-test", description: "test" },
			handler: async (ctx) => {
				await ctx.reply({ content: "Opening modal..." });

				const promise = ctx.awaitModal({
					filter: (i) => i.customId === "test-modal",
					timeout: 5000,
				});

				setTimeout(() => {
					gateway.dispatch(
						GatewayDispatchEvents.InteractionCreate,
						modalSubmitInteraction("test-modal", [{ custom_id: "name", value: "hello" }]),
					);
				}, 10);

				const result = await promise;
				collectorResolved = true;
				assert.strictEqual(result.customId, "test-modal");
				assert.strictEqual(result.fields.getRequired("name"), "hello");
			},
		});

		const gateway = createMockGateway();
		createBot({
			rest: createMockREST(),
			gateway: gateway as any,
			commands: [cmd],
			interactions: [modal],
		});

		gateway.dispatch(GatewayDispatchEvents.InteractionCreate, chatInputInteraction("modal-test"));
		await new Promise((r) => setTimeout(r, 200));

		assert.strictEqual(collectorResolved, true);
		assert.strictEqual(persistentHandler.mock.callCount(), 0);
	});
});
