import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
	ApplicationCommandOptionType,
	ComponentType,
	type APIInteraction,
	type APIMessage,
	type APIUser,
} from "discord-api-types/v10";
import {
	defineAutocomplete,
	defineButton,
	defineCommand,
	defineMessageCommand,
	defineModal,
	defineSelectMenu,
	defineUserCommand,
	isAutocomplete,
	isButton,
	isCommand,
	isMessageCommand,
	isModal,
	isSelectMenu,
	isUserCommand,
	type AnyInteractionContext,
	type ModalFields,
} from "../../src/index.ts";
import {
	autocompleteInteraction,
	buttonInteraction,
	chatInputInteraction,
	messageCommandInteraction,
	modalSubmitInteraction,
	selectMenuInteraction,
	userCommandInteraction,
} from "../fixtures/interactions.ts";
import { createTestBot } from "../fixtures/test-bot.ts";

const userSelect = selectMenuInteraction("choose", ["999"]);
Object.assign(userSelect.data, { component_type: ComponentType.UserSelect });

const interactions = {
	command: chatInputInteraction("search"),
	userCommand: userCommandInteraction("info", "999"),
	messageCommand: messageCommandInteraction("quote", "555"),
	button: buttonInteraction("confirm"),
	stringSelect: selectMenuInteraction("choose", ["a"]),
	userSelect,
	modal: modalSubmitInteraction("feedback", []),
	autocomplete: autocompleteInteraction("search", {
		name: "query",
		value: "x",
		type: ApplicationCommandOptionType.String,
	}),
} satisfies Record<string, APIInteraction>;

type Kind = keyof typeof interactions;

const kinds = Object.keys(interactions) as Kind[];

const guards: [name: string, guard: (ctx: AnyInteractionContext) => boolean, accepts: Kind[]][] = [
	["isCommand", isCommand, ["command"]],
	["isUserCommand", isUserCommand, ["userCommand"]],
	["isMessageCommand", isMessageCommand, ["messageCommand"]],
	["isButton", isButton, ["button"]],
	["isSelectMenu", isSelectMenu, ["stringSelect", "userSelect"]],
	["isModal", isModal, ["modal"]],
	["isAutocomplete", isAutocomplete, ["autocomplete"]],
];

describe("interaction context guards", () => {
	const contexts = new Map<Kind, AnyInteractionContext>();

	before(async () => {
		const handler = () => {};
		const { interact } = createTestBot({
			commands: [
				defineCommand({ data: { name: "search", description: "Search" }, handler }),
				defineUserCommand({ data: { name: "info" }, handler }),
				defineMessageCommand({ data: { name: "quote" }, handler }),
			],
			interactions: [
				defineButton({ customId: "confirm", handler }),
				defineSelectMenu({ customId: "choose", handler }),
				defineModal({ customId: "feedback", handler }),
				defineAutocomplete({ command: "search", option: "query", handler }),
			],
			hooks: {
				afterInteraction: (ctx) => {
					const kind = kinds.find((candidate) => interactions[candidate] === ctx.interaction);
					assert.ok(kind);
					contexts.set(kind, ctx);
				},
			},
		});

		for (const kind of kinds) await interact(interactions[kind]);

		assert.deepStrictEqual([...contexts.keys()], kinds);
	});

	for (const [name, guard, accepts] of guards) {
		it(`${name} accepts only ${accepts.join(" and ")} contexts`, () => {
			assert.deepStrictEqual(
				kinds.filter((kind) => guard(contexts.get(kind)!)),
				accepts,
			);
		});
	}
});

function assertGuardsNarrow(ctx: AnyInteractionContext): void {
	// @ts-expect-error options exist only on command and autocomplete contexts
	void ctx.options;
	// @ts-expect-error customId exists only on component and modal contexts
	void ctx.customId;

	if (isCommand(ctx)) {
		const options: Record<string, unknown> = ctx.options;
		void options;
	}
	if (isUserCommand(ctx)) {
		const targetUser: APIUser = ctx.targetUser;
		void targetUser;
	}
	if (isMessageCommand(ctx)) {
		const targetMessage: APIMessage = ctx.targetMessage;
		void targetMessage;
	}
	if (isButton(ctx)) {
		const customId: string = ctx.customId;
		// @ts-expect-error button contexts have no selected values
		void ctx.values;
		void customId;
	}
	if (isSelectMenu(ctx)) {
		const values: string[] = ctx.values;
		void values;
	}
	if (isModal(ctx)) {
		const fields: ModalFields = ctx.fields;
		void fields;
	}
	if (isAutocomplete(ctx)) {
		const focused: { name: string; value: string | number } = ctx.focused;
		// @ts-expect-error autocomplete interactions cannot be replied to
		void ctx.reply;
		void focused;
	}
}

void assertGuardsNarrow;
