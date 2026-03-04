import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createBot } from "../../src/bot.ts";
import { defineButton } from "../../src/definitions/button.ts";
import { defineSelectMenu } from "../../src/definitions/select-menu.ts";
import { defineModal } from "../../src/definitions/modal.ts";
import { createMockREST } from "../fixtures/mock-api.ts";
import { createMockGateway } from "../fixtures/mock-gateway.ts";
import { buttonInteraction, selectMenuInteraction, modalSubmitInteraction } from "../fixtures/interactions.ts";
import { GatewayDispatchEvents } from "discord-api-types/v10";
import type { ButtonContext, SelectMenuContext, ModalContext } from "../../src/types/contexts.ts";

describe("component flow integration", () => {
	it("routes button interaction to handler", async () => {
		const handler = mock.fn<(ctx: ButtonContext) => Promise<void>>(async () => {});

		const verifyButton = defineButton({
			customId: /^verify:(?<userId>\d+)$/,
			handler,
		});

		const gateway = createMockGateway();
		createBot({
			rest: createMockREST(),
			gateway: gateway as any,
			interactions: [verifyButton],
		});

		gateway.dispatch(GatewayDispatchEvents.InteractionCreate, buttonInteraction("verify:42"));
		await new Promise((r) => setTimeout(r, 50));

		assert.strictEqual(handler.mock.callCount(), 1);
		const ctx = handler.mock.calls[0]!.arguments[0];
		assert.strictEqual(ctx.params.userId, "42");
	});

	it("routes select menu interaction to handler", async () => {
		const handler = mock.fn<(ctx: SelectMenuContext) => Promise<void>>(async () => {});

		const roleSelect = defineSelectMenu({
			customId: /^role-select:(?<panel>\w+)$/,
			handler,
		});

		const gateway = createMockGateway();
		createBot({
			rest: createMockREST(),
			gateway: gateway as any,
			interactions: [roleSelect],
		});

		gateway.dispatch(GatewayDispatchEvents.InteractionCreate, selectMenuInteraction("role-select:main", ["role1"]));
		await new Promise((r) => setTimeout(r, 50));

		assert.strictEqual(handler.mock.callCount(), 1);
	});

	it("routes modal submission to handler", async () => {
		const handler = mock.fn<(ctx: ModalContext) => Promise<void>>(async () => {});

		const feedbackModal = defineModal({
			customId: /^feedback:(?<type>\w+)$/,
			handler,
		});

		const gateway = createMockGateway();
		createBot({
			rest: createMockREST(),
			gateway: gateway as any,
			interactions: [feedbackModal],
		});

		gateway.dispatch(
			GatewayDispatchEvents.InteractionCreate,
			modalSubmitInteraction("feedback:bug", [{ custom_id: "desc", value: "broken" }]),
		);
		await new Promise((r) => setTimeout(r, 50));

		assert.strictEqual(handler.mock.callCount(), 1);
	});
});
