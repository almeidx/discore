import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { createCollectorStore } from "../../src/collectors/collector-store.ts";
import { defineMessageCommand } from "../../src/definitions/message-command.ts";
import { defineUserCommand } from "../../src/definitions/user-command.ts";
import { createComponentRouter } from "../../src/routing/component-router.ts";
import { createInteractionRouter } from "../../src/routing/interaction-router.ts";
import type { ModalContext } from "../../src/types/contexts.ts";
import {
	DefinitionType,
	type UserCommandDefinition,
	type MessageCommandDefinition,
} from "../../src/types/definitions.ts";
import type { ComponentInteractionContext } from "../../src/types/internal.ts";
import { userCommandInteraction, messageCommandInteraction } from "../fixtures/interactions.ts";
import { createMockBot } from "../fixtures/mock-bot.ts";

describe("context menu commands", () => {
	function setup(userCmds: UserCommandDefinition[] = [], msgCmds: MessageCommandDefinition[] = []) {
		const bot = createMockBot();

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
			collectorStore: createCollectorStore<ComponentInteractionContext>(),
			modalCollectorStore: createCollectorStore<ModalContext>(),
			hooks: {},
			errorResponse: undefined,
			missingPermissionsResponse: undefined,
		});

		return { bot, router };
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

		const { bot, router } = setup([cmd]);
		await router.handle(bot, userCommandInteraction("User Info", "777777777777777777"));

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

		const { bot, router } = setup([cmd]);
		await router.handle(bot, userCommandInteraction("User Info", "777777777777777777"));

		assert.strictEqual(receivedTargetId, "777777777777777777");
	});

	it("routes message command interaction to handler", async () => {
		const handler = mock.fn(async () => {});
		const cmd = defineMessageCommand({
			data: { name: "Bookmark" },
			handler,
		});

		const { bot, router } = setup([], [cmd]);
		await router.handle(bot, messageCommandInteraction("Bookmark", "888888888888888888"));

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

		const { bot, router } = setup([], [cmd]);
		await router.handle(bot, messageCommandInteraction("Bookmark", "888888888888888888"));

		assert.strictEqual(receivedContent, "Hello world");
	});

	it("does nothing for unknown user command", async () => {
		const { bot, router } = setup();
		await router.handle(bot, userCommandInteraction("Unknown", "777777777777777777"));
	});
});
