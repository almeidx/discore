import assert from "node:assert/strict";
import { it } from "node:test";
import { createCollectorStore } from "../../src/collectors/collector-store.ts";
import { createAutocompleteContext } from "../../src/context/autocomplete.ts";
import { createButtonContext } from "../../src/context/button.ts";
import { createCommandContext } from "../../src/context/command.ts";
import { createMessageCommandContext } from "../../src/context/message-command.ts";
import { createModalContext } from "../../src/context/modal.ts";
import { createSelectMenuContext } from "../../src/context/select-menu.ts";
import { createUserCommandContext } from "../../src/context/user-command.ts";
import {
	isAutocomplete,
	isButton,
	isCommand,
	isMessageCommand,
	isModal,
	isSelectMenu,
	isUserCommand,
} from "../../src/guards.ts";
import type { ModalContext } from "../../src/types/contexts.ts";
import type { AnyInteractionContext } from "../../src/types/hooks.ts";
import type { ComponentInteractionContext } from "../../src/types/internal.ts";
import {
	autocompleteInteraction,
	buttonInteraction,
	chatInputInteraction,
	messageCommandInteraction,
	modalSubmitInteraction,
	selectMenuInteraction,
	userCommandInteraction,
} from "../fixtures/interactions.ts";
import { createMockBot } from "../fixtures/mock-bot.ts";

function createCommandTestContext(): AnyInteractionContext {
	return createCommandContext(
		createMockBot(),
		chatInputInteraction("search"),
		createCollectorStore<ComponentInteractionContext>(),
		createCollectorStore<ModalContext>(),
	);
}

function createUserCommandTestContext(): AnyInteractionContext {
	return createUserCommandContext(
		createMockBot(),
		userCommandInteraction("info", "999"),
		createCollectorStore<ComponentInteractionContext>(),
		createCollectorStore<ModalContext>(),
	);
}

function createMessageCommandTestContext(): AnyInteractionContext {
	return createMessageCommandContext(
		createMockBot(),
		messageCommandInteraction("quote", "555"),
		createCollectorStore<ComponentInteractionContext>(),
		createCollectorStore<ModalContext>(),
	);
}

function createButtonTestContext(): AnyInteractionContext {
	return createButtonContext(createMockBot(), buttonInteraction("confirm"), {});
}

function createSelectMenuTestContext(): AnyInteractionContext {
	return createSelectMenuContext(createMockBot(), selectMenuInteraction("choose", ["a"]), {});
}

function createModalTestContext(): AnyInteractionContext {
	return createModalContext(createMockBot(), modalSubmitInteraction("feedback", []), {});
}

function createAutocompleteTestContext(): AnyInteractionContext {
	return createAutocompleteContext(
		createMockBot(),
		autocompleteInteraction("search", { name: "query", value: "x", type: 3 }),
	);
}

const commandCtx = createCommandTestContext();
const userCommandCtx = createUserCommandTestContext();
const messageCommandCtx = createMessageCommandTestContext();
const buttonCtx = createButtonTestContext();
const selectMenuCtx = createSelectMenuTestContext();
const modalCtx = createModalTestContext();
const autocompleteCtx = createAutocompleteTestContext();

const guards: Record<string, (ctx: AnyInteractionContext) => boolean> = {
	isCommand,
	isUserCommand,
	isMessageCommand,
	isButton,
	isSelectMenu,
	isModal,
	isAutocomplete,
};

const contexts: Record<string, AnyInteractionContext> = {
	isCommand: commandCtx,
	isUserCommand: userCommandCtx,
	isMessageCommand: messageCommandCtx,
	isButton: buttonCtx,
	isSelectMenu: selectMenuCtx,
	isModal: modalCtx,
	isAutocomplete: autocompleteCtx,
};

for (const [guardName, guard] of Object.entries(guards)) {
	for (const [ctxName, ctx] of Object.entries(contexts)) {
		const expected = guardName === ctxName;
		const action = expected ? "accepts" : "rejects";

		it(`${guardName} ${action} ${ctxName} context`, () => {
			assert.strictEqual(guard(ctx), expected);
		});
	}
}

it("narrows the context type", () => {
	const ctx: AnyInteractionContext = commandCtx;
	if (isCommand(ctx)) {
		void ctx.options;
	}
	if (isButton(ctx)) {
		void ctx.customId;
	}
	assert.ok(true);
});
