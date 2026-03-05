import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { ApplicationCommandOptionType } from "discord-api-types/v10";
import { GatewayDispatchEvents } from "discord-api-types/v10";
import { createBot } from "../../src/bot.ts";
import { defineCommand } from "../../src/definitions/command.ts";
import { chatInputInteraction } from "../fixtures/interactions.ts";
import { createMockREST } from "../fixtures/mock-api.ts";
import { createMockGateway } from "../fixtures/mock-gateway.ts";

describe("command flow integration", () => {
	it("dispatches command through full bot pipeline", async () => {
		const handler = mock.fn(async (ctx: any) => {
			await ctx.reply({ content: "Pong!" });
		});

		const ping = defineCommand({
			data: { name: "ping", description: "Pong!" },
			handler,
		});

		const gateway = createMockGateway();
		createBot({
			rest: createMockREST(),
			gateway: gateway as any,
			commands: [ping],
		});

		const interaction = chatInputInteraction("ping");
		gateway.dispatch(GatewayDispatchEvents.InteractionCreate, interaction);

		await new Promise((r) => setTimeout(r, 50));

		assert.strictEqual(handler.mock.callCount(), 1);
	});

	it("dispatches command with options", async () => {
		let receivedUser: string | undefined;

		const ban = defineCommand({
			data: {
				name: "ban",
				description: "Ban",
				options: [{ name: "user", type: ApplicationCommandOptionType.User, description: "u", required: true }] as const,
			},
			handler: async (ctx) => {
				receivedUser = ctx.options.user;
			},
		});

		const gateway = createMockGateway();
		createBot({
			rest: createMockREST(),
			gateway: gateway as any,
			commands: [ban],
		});

		const interaction = chatInputInteraction("ban", [
			{ name: "user", type: ApplicationCommandOptionType.User, value: "999888777" },
		]);
		gateway.dispatch(GatewayDispatchEvents.InteractionCreate, interaction);

		await new Promise((r) => setTimeout(r, 50));

		assert.strictEqual(receivedUser, "999888777");
	});

	it("hooks execute in correct order", async () => {
		const order: string[] = [];

		const cmd = defineCommand({
			data: { name: "test", description: "test" },
			hooks: {
				beforeCommand: async () => {
					order.push("before");
				},
				afterCommand: async () => {
					order.push("after");
				},
			},
			handler: async () => {
				order.push("handler");
			},
		});

		const gateway = createMockGateway();
		createBot({
			rest: createMockREST(),
			gateway: gateway as any,
			commands: [cmd],
		});

		gateway.dispatch(GatewayDispatchEvents.InteractionCreate, chatInputInteraction("test"));
		await new Promise((r) => setTimeout(r, 50));

		assert.deepStrictEqual(order, ["before", "handler", "after"]);
	});
});
