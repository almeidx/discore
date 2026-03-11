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
	function setup(commands: CommandDefinition[] = [], overrides: Record<string, unknown> = {}) {
		const api = createMockAPI();
		const gateway = {} as any;
		const collectorStore = createCollectorStore();
		const componentRouter = createComponentRouter([], [], [], {}, undefined);

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
			missingPermissionsResponse: undefined,
			...overrides,
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
			componentRouter: createComponentRouter([], [], [], {}, undefined),
			collectorStore: createCollectorStore(),
			modalCollectorStore: createModalCollectorStore(),
			hooks: {},
			errorResponse: undefined,
			missingPermissionsResponse: undefined,
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
			componentRouter: createComponentRouter([], [], [], {}, undefined),
			collectorStore: createCollectorStore(),
			modalCollectorStore: createModalCollectorStore(),
			hooks: {},
			errorResponse: undefined,
			missingPermissionsResponse: undefined,
		});

		await router.handle(api, gateway, chatInputInteraction("test"));

		assert.strictEqual(api.interactions.reply.mock.callCount(), 0);
	});

	it("blocks command when bot is missing required permissions", async () => {
		const handler = mock.fn(async () => {});
		const cmd: CommandDefinition = {
			type: DefinitionType.Command,
			data: { name: "ban", description: "Ban a user", options: [] },
			requiredBotPermissions: 4n, // BanMembers
			handler,
		};

		const { api, gateway, router } = setup([cmd]);
		const interaction = chatInputInteraction("ban");
		interaction.app_permissions = "0";

		await router.handle(api, gateway, interaction);

		assert.strictEqual(handler.mock.callCount(), 0);
	});

	it("allows command when bot has required permissions", async () => {
		const handler = mock.fn(async () => {});
		const cmd: CommandDefinition = {
			type: DefinitionType.Command,
			data: { name: "ban", description: "Ban a user", options: [] },
			requiredBotPermissions: 4n,
			handler,
		};

		const { api, gateway, router } = setup([cmd]);
		const interaction = chatInputInteraction("ban");
		interaction.app_permissions = "4";

		await router.handle(api, gateway, interaction);

		assert.strictEqual(handler.mock.callCount(), 1);
	});

	it("calls command-level onMissingBotPermissions hook", async () => {
		const handler = mock.fn(async () => {});
		let receivedMissing: bigint | undefined;
		const cmd: CommandDefinition = {
			type: DefinitionType.Command,
			data: { name: "ban", description: "Ban a user", options: [] },
			requiredBotPermissions: 4n,
			hooks: {
				onMissingBotPermissions: async (_ctx, missing) => {
					receivedMissing = missing;
				},
			},
			handler,
		};

		const { api, gateway, router } = setup([cmd]);
		const interaction = chatInputInteraction("ban");
		interaction.app_permissions = "0";

		await router.handle(api, gateway, interaction);

		assert.strictEqual(handler.mock.callCount(), 0);
		assert.strictEqual(receivedMissing, 4n);
		assert.strictEqual(api.interactions.reply.mock.callCount(), 0);
	});

	it("bypasses permission check when onMissingBotPermissions returns true", async () => {
		const handler = mock.fn(async () => {});
		const cmd: CommandDefinition = {
			type: DefinitionType.Command,
			data: { name: "ban", description: "Ban a user", options: [] },
			requiredBotPermissions: 4n,
			hooks: { onMissingBotPermissions: async () => true },
			handler,
		};

		const { api, gateway, router } = setup([cmd]);
		const interaction = chatInputInteraction("ban");
		interaction.app_permissions = "0";

		await router.handle(api, gateway, interaction);

		assert.strictEqual(handler.mock.callCount(), 1);
	});

	it("calls global onMissingBotPermissions when command has no hook", async () => {
		const handler = mock.fn(async () => {});
		const globalOnMissing = mock.fn(async () => {});
		const cmd: CommandDefinition = {
			type: DefinitionType.Command,
			data: { name: "ban", description: "Ban a user", options: [] },
			requiredBotPermissions: 4n,
			handler,
		};

		const api = createMockAPI();
		const gateway = {} as any;
		const router = createInteractionRouter({
			commands: new Map([["ban", cmd]]),
			commandGroups: new Map(),
			userCommands: new Map(),
			messageCommands: new Map(),
			autocompletes: [],
			componentRouter: createComponentRouter([], [], [], {}, undefined),
			collectorStore: createCollectorStore(),
			modalCollectorStore: createModalCollectorStore(),
			hooks: { onMissingBotPermissions: globalOnMissing },
			errorResponse: undefined,
			missingPermissionsResponse: undefined,
		});

		const interaction = chatInputInteraction("ban");
		interaction.app_permissions = "0";

		await router.handle(api, gateway, interaction);

		assert.strictEqual(handler.mock.callCount(), 0);
		assert.strictEqual(globalOnMissing.mock.callCount(), 1);
	});

	it("reports only missing permissions, not all required ones", async () => {
		let receivedMissing: bigint | undefined;
		const cmd: CommandDefinition = {
			type: DefinitionType.Command,
			data: { name: "test", description: "test", options: [] },
			requiredBotPermissions: 4n | 8n, // BanMembers | KickMembers
			hooks: {
				onMissingBotPermissions: async (_ctx, missing) => {
					receivedMissing = missing;
				},
			},
			handler: async () => {},
		};

		const { api, gateway, router } = setup([cmd]);
		const interaction = chatInputInteraction("test");
		interaction.app_permissions = "4"; // has BanMembers, missing KickMembers

		await router.handle(api, gateway, interaction);

		assert.strictEqual(receivedMissing, 8n);
	});

	it("sends missingPermissionsResponse when configured", async () => {
		const handler = mock.fn(async () => {});
		const cmd: CommandDefinition = {
			type: DefinitionType.Command,
			data: { name: "ban", description: "Ban a user", options: [] },
			requiredBotPermissions: 4n,
			handler,
		};

		const { api, gateway, router } = setup([cmd], {
			missingPermissionsResponse: { content: "No perms!", flags: 64 },
		});
		const interaction = chatInputInteraction("ban");
		interaction.app_permissions = "0";

		await router.handle(api, gateway, interaction);

		assert.strictEqual(handler.mock.callCount(), 0);
		assert.strictEqual(api.interactions.reply.mock.callCount(), 1);
	});

	it("sends no response when missingPermissionsResponse is not configured and no hook handles it", async () => {
		const handler = mock.fn(async () => {});
		const cmd: CommandDefinition = {
			type: DefinitionType.Command,
			data: { name: "ban", description: "Ban a user", options: [] },
			requiredBotPermissions: 4n,
			handler,
		};

		const { api, gateway, router } = setup([cmd]);
		const interaction = chatInputInteraction("ban");
		interaction.app_permissions = "0";

		await router.handle(api, gateway, interaction);

		assert.strictEqual(handler.mock.callCount(), 0);
		assert.strictEqual(api.interactions.reply.mock.callCount(), 0);
	});

	it("calls missingPermissionsResponse function with context and missing perms", async () => {
		const handler = mock.fn(async () => {});
		let receivedMissing: bigint | undefined;
		const cmd: CommandDefinition = {
			type: DefinitionType.Command,
			data: { name: "ban", description: "Ban a user", options: [] },
			requiredBotPermissions: 4n,
			handler,
		};

		const { api, gateway, router } = setup([cmd], {
			missingPermissionsResponse: (_ctx: unknown, missing: bigint) => {
				receivedMissing = missing;
				return { content: "Missing!", flags: 64 };
			},
		});
		const interaction = chatInputInteraction("ban");
		interaction.app_permissions = "0";

		await router.handle(api, gateway, interaction);

		assert.strictEqual(receivedMissing, 4n);
		assert.strictEqual(api.interactions.reply.mock.callCount(), 1);
	});

	it("skips permission check when app_permissions is undefined", async () => {
		const handler = mock.fn(async () => {});
		const cmd: CommandDefinition = {
			type: DefinitionType.Command,
			data: { name: "test", description: "test", options: [] },
			requiredBotPermissions: 4n,
			handler,
		};

		const { api, gateway, router } = setup([cmd]);
		const interaction = chatInputInteraction("test");
		(interaction as any).app_permissions = undefined;

		await router.handle(api, gateway, interaction);

		assert.strictEqual(handler.mock.callCount(), 1);
	});
});
