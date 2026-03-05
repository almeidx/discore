import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { createCollectorStore } from "../../src/collectors/collector-store.ts";
import { createModalCollectorStore } from "../../src/collectors/modal-collector-store.ts";
import { createComponentRouter } from "../../src/routing/component-router.ts";
import { createInteractionRouter } from "../../src/routing/interaction-router.ts";
import { DefinitionType, type CommandDefinition } from "../../src/types/definitions.ts";
import { chatInputInteraction } from "../fixtures/interactions.ts";
import { createMockAPI } from "../fixtures/mock-api.ts";

describe("createInteractionRouter", () => {
	function setup(commands: CommandDefinition[] = []) {
		const api = createMockAPI();
		const gateway = {} as any;
		const collectorStore = createCollectorStore();
		const componentRouter = createComponentRouter([], [], []);

		const commandMap = new Map<string, CommandDefinition>();
		for (const cmd of commands) {
			commandMap.set(cmd.data.name, cmd);
		}

		const router = createInteractionRouter({
			commands: commandMap,
			commandGroups: new Map(),
			userCommands: new Map(),
			messageCommands: new Map(),
			autocompletes: [],
			componentRouter,
			collectorStore,
			modalCollectorStore: createModalCollectorStore(),
			hooks: {},
			errorResponse: undefined,
		});

		return { api, gateway, router, collectorStore };
	}

	it("dispatches chat input command to handler", async () => {
		const handler = mock.fn(async () => {});
		const cmd: CommandDefinition = {
			type: DefinitionType.Command,
			data: { name: "ping", description: "Pong!", options: [] },
			handler,
		};

		const { api, gateway, router } = setup([cmd]);
		const interaction = chatInputInteraction("ping");

		await router.handle(api, gateway, interaction);

		assert.strictEqual(handler.mock.callCount(), 1);
	});

	it("does nothing for unknown command", async () => {
		const { api, gateway, router } = setup();
		const interaction = chatInputInteraction("unknown");

		await router.handle(api, gateway, interaction);
	});

	it("runs beforeCommand hook and can cancel", async () => {
		const handler = mock.fn(async () => {});
		const cmd: CommandDefinition = {
			type: DefinitionType.Command,
			data: { name: "test", description: "test", options: [] },
			hooks: {
				beforeCommand: async () => false,
			},
			handler,
		};

		const { api, gateway, router } = setup([cmd]);
		await router.handle(api, gateway, chatInputInteraction("test"));

		assert.strictEqual(handler.mock.callCount(), 0);
	});

	it("runs onError hook when handler throws", async () => {
		const onError = mock.fn(async () => {});
		const cmd: CommandDefinition = {
			type: DefinitionType.Command,
			data: { name: "test", description: "test", options: [] },
			hooks: { onError },
			handler: async () => {
				throw new Error("boom");
			},
		};

		const { api, gateway, router } = setup([cmd]);
		await router.handle(api, gateway, chatInputInteraction("test"));

		assert.strictEqual(onError.mock.callCount(), 1);
	});

	it("sends error response when handler throws and onError does not suppress", async () => {
		const cmd: CommandDefinition = {
			type: DefinitionType.Command,
			data: { name: "test", description: "test", options: [] },
			handler: async () => {
				throw new Error("boom");
			},
		};

		const api = createMockAPI();
		const gateway = {} as any;
		const router = createInteractionRouter({
			commands: new Map([["test", cmd]]),
			commandGroups: new Map(),
			userCommands: new Map(),
			messageCommands: new Map(),
			autocompletes: [],
			componentRouter: createComponentRouter([], [], []),
			collectorStore: createCollectorStore(),
			modalCollectorStore: createModalCollectorStore(),
			hooks: {},
			errorResponse: undefined,
		});

		await router.handle(api, gateway, chatInputInteraction("test"));

		assert.strictEqual(api.interactions.reply.mock.callCount(), 1);
	});

	it("suppresses error response when onError returns false", async () => {
		const cmd: CommandDefinition = {
			type: DefinitionType.Command,
			data: { name: "test", description: "test", options: [] },
			hooks: {
				onError: async () => false,
			},
			handler: async () => {
				throw new Error("boom");
			},
		};

		const api = createMockAPI();
		const gateway = {} as any;
		const router = createInteractionRouter({
			commands: new Map([["test", cmd]]),
			commandGroups: new Map(),
			userCommands: new Map(),
			messageCommands: new Map(),
			autocompletes: [],
			componentRouter: createComponentRouter([], [], []),
			collectorStore: createCollectorStore(),
			modalCollectorStore: createModalCollectorStore(),
			hooks: {},
			errorResponse: undefined,
		});

		await router.handle(api, gateway, chatInputInteraction("test"));

		assert.strictEqual(api.interactions.reply.mock.callCount(), 0);
	});
});
