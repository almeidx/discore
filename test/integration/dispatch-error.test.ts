import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import type { WebSocketManager } from "@discordjs/ws";
import { WebSocketShardEvents } from "@discordjs/ws";
import {
	ApplicationCommandOptionType,
	GatewayDispatchEvents,
	type GatewayDispatchPayload,
} from "discord-api-types/v10";
import { createBot } from "../../src/bot.ts";
import { createCollectorStore } from "../../src/collectors/collector-store.ts";
import { defineCommand } from "../../src/definitions/command.ts";
import { defineEvent } from "../../src/definitions/event.ts";
import { createComponentRouter } from "../../src/routing/component-router.ts";
import { createInteractionRouter } from "../../src/routing/interaction-router.ts";
import type { ModalContext } from "../../src/types/contexts.ts";
import { DefinitionType, type AutocompleteDefinition, type CommandDefinition } from "../../src/types/definitions.ts";
import type { ComponentInteractionContext } from "../../src/types/internal.ts";
import { autocompleteInteraction, chatInputInteraction } from "../fixtures/interactions.ts";
import { createMockAPI, createMockREST } from "../fixtures/mock-api.ts";
import { createMockGateway } from "../fixtures/mock-gateway.ts";

function getDispatchListener(gateway: ReturnType<typeof createMockGateway>) {
	const listeners = gateway.listeners(WebSocketShardEvents.Dispatch);
	assert.strictEqual(listeners.length, 1);
	return listeners[0] as (payload: GatewayDispatchPayload, shardId: number) => Promise<void>;
}

function interactionPayload(data: unknown): GatewayDispatchPayload {
	return { t: GatewayDispatchEvents.InteractionCreate, d: data, op: 0, s: 1 } as GatewayDispatchPayload;
}

function createRouter(commands: CommandDefinition[] = [], autocompletes: AutocompleteDefinition[] = []) {
	return createInteractionRouter({
		commands: new Map(commands.map((cmd) => [cmd.data.name, cmd] as const)),
		commandGroups: new Map(),
		userCommands: new Map(),
		messageCommands: new Map(),
		autocompletes,
		componentRouter: createComponentRouter([], [], [], {}, undefined),
		collectorStore: createCollectorStore<ComponentInteractionContext>(),
		modalCollectorStore: createCollectorStore<ModalContext>(),
		hooks: {},
		errorResponse: undefined,
		missingPermissionsResponse: undefined,
	});
}

describe("dispatch error isolation", () => {
	it("event handlers still run when an interaction handler throws", async () => {
		const command = defineCommand({
			data: { name: "test", description: "test" },
			handler: async () => {
				throw new Error("boom");
			},
		});
		const eventHandler = mock.fn(async () => {});
		const event = defineEvent({
			event: GatewayDispatchEvents.InteractionCreate,
			handler: eventHandler,
		});
		const gateway = createMockGateway();
		createBot({
			rest: createMockREST(),
			gateway: gateway as unknown as WebSocketManager,
			commands: [command],
			events: [event],
		});

		const listener = getDispatchListener(gateway);
		await assert.rejects(listener(interactionPayload(chatInputInteraction("test")), 0), { message: "boom" });

		assert.strictEqual(eventHandler.mock.callCount(), 1);
	});

	it("interaction handlers still run when an event handler throws", async () => {
		const commandHandler = mock.fn(async () => {});
		const command = defineCommand({
			data: { name: "test", description: "test" },
			handler: commandHandler,
		});
		const event = defineEvent({
			event: GatewayDispatchEvents.InteractionCreate,
			handler: async () => {
				throw new Error("event boom");
			},
		});
		const gateway = createMockGateway();
		createBot({
			rest: createMockREST(),
			gateway: gateway as unknown as WebSocketManager,
			commands: [command],
			events: [event],
		});

		const listener = getDispatchListener(gateway);
		await assert.rejects(listener(interactionPayload(chatInputInteraction("test")), 0), { message: "event boom" });

		assert.strictEqual(commandHandler.mock.callCount(), 1);
	});

	it("both failing produces an AggregateError carrying both errors", async () => {
		const command = defineCommand({
			data: { name: "test", description: "test" },
			handler: async () => {
				throw new Error("interaction boom");
			},
		});
		const event = defineEvent({
			event: GatewayDispatchEvents.InteractionCreate,
			handler: async () => {
				throw new Error("event boom");
			},
		});
		const gateway = createMockGateway();
		createBot({
			rest: createMockREST(),
			gateway: gateway as unknown as WebSocketManager,
			commands: [command],
			events: [event],
		});

		const listener = getDispatchListener(gateway);
		let thrown: unknown;
		try {
			await listener(interactionPayload(chatInputInteraction("test")), 0);
		} catch (error) {
			thrown = error;
		}

		assert.ok(thrown instanceof AggregateError);
		assert.strictEqual(thrown.errors.length, 2);
	});

	it("original handler error propagates when the fallback error response fails", async () => {
		const command: CommandDefinition = {
			type: DefinitionType.Command,
			data: { name: "test", description: "test", options: [] },
			handler: async () => {
				throw new Error("boom");
			},
		};
		const api = createMockAPI();
		api.interactions.reply.mock.mockImplementation(async () => {
			throw new Error("reply failed");
		});
		const router = createRouter([command]);

		await assert.rejects(router.handle(api, {} as WebSocketManager, chatInputInteraction("test")), {
			message: "boom",
		});
	});

	it("original autocomplete error propagates when the empty-choices response fails", async () => {
		const autocomplete: AutocompleteDefinition = {
			type: DefinitionType.Autocomplete,
			command: "search",
			option: "query",
			handler: async () => {
				throw new Error("boom");
			},
		};
		const api = createMockAPI();
		api.interactions.createAutocompleteResponse.mock.mockImplementation(async () => {
			throw new Error("autocomplete failed");
		});
		const router = createRouter([], [autocomplete]);

		await assert.rejects(
			router.handle(
				api,
				{} as WebSocketManager,
				autocompleteInteraction("search", {
					name: "query",
					value: "x",
					type: ApplicationCommandOptionType.String,
				}),
			),
			{ message: "boom" },
		);
	});

	it("success path is unchanged and ordered", async () => {
		const order: string[] = [];
		const command = defineCommand({
			data: { name: "test", description: "test" },
			handler: async () => {
				order.push("interaction");
			},
		});
		const event = defineEvent({
			event: GatewayDispatchEvents.InteractionCreate,
			handler: async () => {
				order.push("event");
			},
		});
		const gateway = createMockGateway();
		createBot({
			rest: createMockREST(),
			gateway: gateway as unknown as WebSocketManager,
			commands: [command],
			events: [event],
		});

		const listener = getDispatchListener(gateway);
		await listener(interactionPayload(chatInputInteraction("test")), 0);

		assert.deepStrictEqual(order, ["interaction", "event"]);
	});
});
