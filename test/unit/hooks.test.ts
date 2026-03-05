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
			autocompletes: [],
			componentRouter: createComponentRouter([], [], []),
			collectorStore: createCollectorStore(),
			modalCollectorStore: createModalCollectorStore(),
			hooks: globalHooks,
			errorResponse: undefined,
		});
	}

	it("per-command hook overrides global hook", async () => {
		const globalBefore = mock.fn(async () => {});
		const localBefore = mock.fn(async () => {});

		const cmd: CommandDefinition = {
			type: DefinitionType.Command,
			data: { name: "test", description: "test", options: [] },
			hooks: { beforeCommand: localBefore },
			handler: async () => {},
		};

		const router = createRouter(cmd, { beforeCommand: globalBefore });
		await router.handle(createMockAPI(), {} as any, chatInputInteraction("test"));

		assert.strictEqual(localBefore.mock.callCount(), 1);
		assert.strictEqual(globalBefore.mock.callCount(), 0);
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
});
