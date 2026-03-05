import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { GatewayDispatchEvents } from "discord-api-types/v10";
import { createBot } from "../../src/bot.ts";
import { defineMessageCommand } from "../../src/definitions/message-command.ts";
import { defineUserCommand } from "../../src/definitions/user-command.ts";
import { userCommandInteraction, messageCommandInteraction } from "../fixtures/interactions.ts";
import { createMockREST } from "../fixtures/mock-api.ts";
import { createMockGateway } from "../fixtures/mock-gateway.ts";

describe("context menu command flow integration", () => {
	it("routes user command through full bot pipeline", async () => {
		const handler = mock.fn(async () => {});

		const userInfo = defineUserCommand({
			data: { name: "User Info" },
			handler,
		});

		const gateway = createMockGateway();
		createBot({
			rest: createMockREST(),
			gateway: gateway as any,
			commands: [userInfo],
		});

		gateway.dispatch(
			GatewayDispatchEvents.InteractionCreate,
			userCommandInteraction("User Info", "777777777777777777"),
		);

		await new Promise((r) => setTimeout(r, 50));

		assert.strictEqual(handler.mock.callCount(), 1);
	});

	it("routes message command through full bot pipeline", async () => {
		let receivedContent: string | undefined;

		const bookmark = defineMessageCommand({
			data: { name: "Bookmark" },
			handler: async (ctx) => {
				receivedContent = ctx.targetMessage.content;
			},
		});

		const gateway = createMockGateway();
		createBot({
			rest: createMockREST(),
			gateway: gateway as any,
			commands: [bookmark],
		});

		gateway.dispatch(
			GatewayDispatchEvents.InteractionCreate,
			messageCommandInteraction("Bookmark", "888888888888888888"),
		);

		await new Promise((r) => setTimeout(r, 50));

		assert.strictEqual(receivedContent, "Hello world");
	});
});
