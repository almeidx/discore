import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { createCollectorStore } from "../../src/collectors/collector-store.ts";
import { createModalCollectorStore } from "../../src/collectors/modal-collector-store.ts";
import { defineMessageCommand } from "../../src/definitions/message-command.ts";
import { defineUserCommand } from "../../src/definitions/user-command.ts";
import { createComponentRouter } from "../../src/routing/component-router.ts";
import { createInteractionRouter } from "../../src/routing/interaction-router.ts";
import {
	DefinitionType,
	type UserCommandDefinition,
	type MessageCommandDefinition,
} from "../../src/types/definitions.ts";
import { userCommandInteraction, messageCommandInteraction } from "../fixtures/interactions.ts";
import { createMockAPI } from "../fixtures/mock-api.ts";

describe("context menu commands", () => {
	function setup(userCmds: UserCommandDefinition[] = [], msgCmds: MessageCommandDefinition[] = []) {
		const api = createMockAPI();
		const gateway = {} as any;

		const userCommands = new Map<string, UserCommandDefinition>();
		for (const cmd of userCmds) userCommands.set(cmd.data.name, cmd);

		const messageCommands = new Map<string, MessageCommandDefinition>();
		for (const cmd of msgCmds) messageCommands.set(cmd.data.name, cmd);

		const router = createInteractionRouter({
			commands: new Map(),
			commandGroups: new Map(),
			userCommands,
			messageCommands,
			autocompletes: [],
			componentRouter: createComponentRouter([], [], [], {}, undefined),
			collectorStore: createCollectorStore(),
			modalCollectorStore: createModalCollectorStore(),
			hooks: {},
			errorResponse: undefined,
		});

		return { api, gateway, router };
	}

	it("defineUserCommand produces correct definition", () => {
		const cmd = defineUserCommand({
			data: { name: "User Info" },
			handler: async () => {},
		});

		assert.strictEqual(cmd.type, DefinitionType.UserCommand);
		assert.strictEqual(cmd.data.name, "User Info");
	});

	it("defineMessageCommand produces correct definition", () => {
		const cmd = defineMessageCommand({
			data: { name: "Bookmark" },
			handler: async () => {},
		});

		assert.strictEqual(cmd.type, DefinitionType.MessageCommand);
		assert.strictEqual(cmd.data.name, "Bookmark");
	});

	it("routes user command interaction to handler", async () => {
		const handler = mock.fn(async () => {});
		const cmd = defineUserCommand({
			data: { name: "User Info" },
			handler,
		});

		const { api, gateway, router } = setup([cmd]);
		await router.handle(api, gateway, userCommandInteraction("User Info", "777777777777777777"));

		assert.strictEqual(handler.mock.callCount(), 1);
	});

	it("provides targetUser in user command context", async () => {
		let receivedTargetId: string | undefined;
		const cmd = defineUserCommand({
			data: { name: "User Info" },
			handler: async (ctx) => {
				receivedTargetId = ctx.targetUser.id;
			},
		});

		const { api, gateway, router } = setup([cmd]);
		await router.handle(api, gateway, userCommandInteraction("User Info", "777777777777777777"));

		assert.strictEqual(receivedTargetId, "777777777777777777");
	});

	it("routes message command interaction to handler", async () => {
		const handler = mock.fn(async () => {});
		const cmd = defineMessageCommand({
			data: { name: "Bookmark" },
			handler,
		});

		const { api, gateway, router } = setup([], [cmd]);
		await router.handle(api, gateway, messageCommandInteraction("Bookmark", "888888888888888888"));

		assert.strictEqual(handler.mock.callCount(), 1);
	});

	it("provides targetMessage in message command context", async () => {
		let receivedContent: string | undefined;
		const cmd = defineMessageCommand({
			data: { name: "Bookmark" },
			handler: async (ctx) => {
				receivedContent = ctx.targetMessage.content;
			},
		});

		const { api, gateway, router } = setup([], [cmd]);
		await router.handle(api, gateway, messageCommandInteraction("Bookmark", "888888888888888888"));

		assert.strictEqual(receivedContent, "Hello world");
	});

	it("does nothing for unknown user command", async () => {
		const { api, gateway, router } = setup();
		await router.handle(api, gateway, userCommandInteraction("Unknown", "777777777777777777"));
	});
});
