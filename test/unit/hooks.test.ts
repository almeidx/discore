import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { createCollectorStore } from "../../src/collectors/collector-store.ts";
import { createModalCollectorStore } from "../../src/collectors/modal-collector-store.ts";
import { createComponentRouter } from "../../src/routing/component-router.ts";
import { createInteractionRouter } from "../../src/routing/interaction-router.ts";
import { DefinitionType, type CommandDefinition } from "../../src/types/definitions.ts";
import { chatInputInteraction } from "../fixtures/interactions.ts";
import { createMockAPI } from "../fixtures/mock-api.ts";

describe("hooks", () => {
	function createRouter(cmd: CommandDefinition, globalHooks = {}) {
		return createInteractionRouter({
			commands: new Map([["test", cmd]]),
			commandGroups: new Map(),
			userCommands: new Map(),
			messageCommands: new Map(),
			autocompletes: [],
			componentRouter: createComponentRouter([], [], [], {}, undefined),
			collectorStore: createCollectorStore(),
			modalCollectorStore: createModalCollectorStore(),
			hooks: globalHooks,
			errorResponse: undefined,
			missingPermissionsResponse: undefined,
		});
	}

	it("both global and per-command hooks run (global first)", async () => {
		const order: string[] = [];
		const globalBefore = mock.fn(async () => {
			order.push("global");
		});
		const localBefore = mock.fn(async () => {
			order.push("local");
		});

		const cmd: CommandDefinition = {
			type: DefinitionType.Command,
			data: { name: "test", description: "test", options: [] },
			hooks: { beforeCommand: localBefore },
			handler: async () => {},
		};

		const router = createRouter(cmd, { beforeCommand: globalBefore });
		await router.handle(createMockAPI(), {} as any, chatInputInteraction("test"));

		assert.strictEqual(globalBefore.mock.callCount(), 1);
		assert.strictEqual(localBefore.mock.callCount(), 1);
		assert.deepStrictEqual(order, ["global", "local"]);
	});

	it("global beforeCommand returning false prevents per-command and handler", async () => {
		const localBefore = mock.fn(async () => {});
		const handler = mock.fn(async () => {});

		const cmd: CommandDefinition = {
			type: DefinitionType.Command,
			data: { name: "test", description: "test", options: [] },
			hooks: { beforeCommand: localBefore },
			handler,
		};

		const router = createRouter(cmd, { beforeCommand: async () => false });
		await router.handle(createMockAPI(), {} as any, chatInputInteraction("test"));

		assert.strictEqual(localBefore.mock.callCount(), 0);
		assert.strictEqual(handler.mock.callCount(), 0);
	});

	it("afterCommand does not run when beforeCommand cancels execution", async () => {
		const afterCommand = mock.fn(async () => {});

		const cmd: CommandDefinition = {
			type: DefinitionType.Command,
			data: { name: "test", description: "test", options: [] },
			hooks: {
				beforeCommand: async () => false,
				afterCommand,
			},
			handler: async () => {},
		};

		const router = createRouter(cmd);
		await router.handle(createMockAPI(), {} as any, chatInputInteraction("test"));

		assert.strictEqual(afterCommand.mock.callCount(), 0);
	});

	it("afterCommand runs even when handler throws", async () => {
		const afterCommand = mock.fn(async () => {});

		const cmd: CommandDefinition = {
			type: DefinitionType.Command,
			data: { name: "test", description: "test", options: [] },
			hooks: { afterCommand, onError: async () => {} },
			handler: async () => {
				throw new Error("boom");
			},
		};

		const router = createRouter(cmd);
		await router.handle(createMockAPI(), {} as any, chatInputInteraction("test"));

		assert.strictEqual(afterCommand.mock.callCount(), 1);
	});

	it("global afterCommand runs when no per-command hook", async () => {
		const afterCommand = mock.fn(async () => {});

		const cmd: CommandDefinition = {
			type: DefinitionType.Command,
			data: { name: "test", description: "test", options: [] },
			handler: async () => {},
		};

		const router = createRouter(cmd, { afterCommand });
		await router.handle(createMockAPI(), {} as any, chatInputInteraction("test"));

		assert.strictEqual(afterCommand.mock.callCount(), 1);
	});

	it("both per-command and global afterCommand run", async () => {
		const order: string[] = [];
		const globalAfter = mock.fn(async () => {
			order.push("global");
		});
		const localAfter = mock.fn(async () => {
			order.push("local");
		});

		const cmd: CommandDefinition = {
			type: DefinitionType.Command,
			data: { name: "test", description: "test", options: [] },
			hooks: { afterCommand: localAfter },
			handler: async () => {},
		};

		const router = createRouter(cmd, { afterCommand: globalAfter });
		await router.handle(createMockAPI(), {} as any, chatInputInteraction("test"));

		assert.strictEqual(localAfter.mock.callCount(), 1);
		assert.strictEqual(globalAfter.mock.callCount(), 1);
		assert.deepStrictEqual(order, ["local", "global"]);
	});
});
