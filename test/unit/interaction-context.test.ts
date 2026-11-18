import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	ApplicationCommandOptionType,
	GatewayDispatchEvents,
	type APIInteraction,
	type APIMessage,
} from "discord-api-types/v10";
import {
	defineAutocomplete,
	defineButton,
	defineCommand,
	defineEvent,
	defineMessageCommand,
	defineModal,
	defineSelectMenu,
	defineUserCommand,
	type Bot,
	type ButtonContext,
	type CommandContext,
	type InteractionCallbackResponse,
	type InteractionContext,
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
import type { MockAPI } from "../fixtures/mock-api.ts";
import { createTestBot } from "../fixtures/test-bot.ts";

interface Captured<TContext> {
	ctx: TContext;
	api: MockAPI;
	bot: Bot;
	interaction: APIInteraction;
}

async function commandContext(): Promise<Captured<CommandContext>> {
	let ctx: CommandContext | undefined;
	const { api, bot, interact } = createTestBot({
		commands: [
			defineCommand({
				data: { name: "test", description: "test" },
				handler: (received) => {
					ctx = received;
				},
			}),
		],
	});
	const interaction = chatInputInteraction("test");

	await interact(interaction);

	assert.ok(ctx);
	return { ctx, api, bot, interaction };
}

async function buttonContext(): Promise<Captured<ButtonContext>> {
	let ctx: ButtonContext | undefined;
	const { api, bot, interact } = createTestBot({
		interactions: [
			defineButton({
				customId: "confirm",
				handler: (received) => {
					ctx = received;
				},
			}),
		],
	});
	const interaction = buttonInteraction("confirm");

	await interact(interaction);

	assert.ok(ctx);
	return { ctx, api, bot, interaction };
}

const modal = { title: "Test", custom_id: "test", components: [] };

describe("interaction response state", () => {
	it("starts unacknowledged and is replied after reply", async () => {
		const { ctx, api, interaction } = await commandContext();

		assert.strictEqual(ctx.replied, false);
		assert.strictEqual(ctx.deferred, false);

		await ctx.reply({ content: "hello" });

		assert.strictEqual(ctx.replied, true);
		assert.strictEqual(ctx.deferred, false);
		assert.deepStrictEqual(api.interactions.reply.mock.calls[0]!.arguments, [
			interaction.id,
			interaction.token,
			{ content: "hello" },
		]);
	});

	it("sends replies after the first response as follow-ups", async () => {
		const { ctx, api, interaction } = await commandContext();

		await ctx.reply({ content: "first" });
		await ctx.reply({ content: "second" });

		assert.strictEqual(api.interactions.reply.mock.callCount(), 1);
		assert.deepStrictEqual(api.interactions.followUp.mock.calls[0]!.arguments, [
			interaction.application_id,
			interaction.token,
			{ content: "second" },
		]);
	});

	it("sends one initial reply and one follow-up for concurrent replies", async () => {
		const { ctx, api } = await commandContext();

		await Promise.all([ctx.reply({ content: "a" }), ctx.reply({ content: "b" })]);

		assert.strictEqual(api.interactions.reply.mock.callCount(), 1);
		assert.strictEqual(api.interactions.followUp.mock.callCount(), 1);
	});

	it("rolls back a failed initial reply so a retry replies instead of following up", async () => {
		const { ctx, api } = await commandContext();
		api.interactions.reply.mock.mockImplementationOnce(async () => {
			throw new Error("network");
		});

		await assert.rejects(ctx.reply({ content: "a" }), { message: "network" });
		assert.strictEqual(ctx.replied, false);

		await ctx.reply({ content: "a" });

		assert.strictEqual(api.interactions.reply.mock.callCount(), 2);
		assert.strictEqual(api.interactions.followUp.mock.callCount(), 0);
	});

	it("defer sends the deferral without options by default", async () => {
		const { ctx, api, interaction } = await commandContext();

		await ctx.defer();

		assert.deepStrictEqual(api.interactions.defer.mock.calls[0]!.arguments, [
			interaction.id,
			interaction.token,
			undefined,
		]);
	});

	it("defer with with_response resolves to the interaction callback response", async () => {
		const { ctx, api, interaction } = await commandContext();
		const callback = { interaction: { id: interaction.id, type: interaction.type } } as InteractionCallbackResponse;
		api.interactions.defer.mock.mockImplementationOnce(async () => callback);

		const response = await ctx.defer({ with_response: true });

		assert.strictEqual(response, callback);
		assert.deepStrictEqual(api.interactions.defer.mock.calls[0]!.arguments[2], { with_response: true });
	});

	it("showModal sends the modal as the initial response", async () => {
		const { ctx, api, interaction } = await commandContext();

		await ctx.showModal(modal);

		assert.deepStrictEqual(api.interactions.createModal.mock.calls[0]!.arguments, [
			interaction.id,
			interaction.token,
			modal,
		]);
	});

	it("update acknowledges a component so a later reply follows up", async () => {
		const { ctx, api, interaction } = await buttonContext();

		await ctx.update({ content: "updated" });

		assert.strictEqual(ctx.replied, true);
		assert.strictEqual(ctx.deferred, false);
		assert.deepStrictEqual(api.interactions.updateMessage.mock.calls[0]!.arguments, [
			interaction.id,
			interaction.token,
			{ content: "updated" },
		]);

		await ctx.reply({ content: "follow-up" });

		assert.strictEqual(api.interactions.reply.mock.callCount(), 0);
		assert.strictEqual(api.interactions.followUp.mock.callCount(), 1);
	});

	it("deferUpdate sends a deferred message update", async () => {
		const { ctx, api, interaction } = await buttonContext();

		await ctx.deferUpdate();

		assert.deepStrictEqual(api.interactions.deferMessageUpdate.mock.calls[0]!.arguments, [
			interaction.id,
			interaction.token,
		]);
	});
});

describe("initial-response-only methods", () => {
	interface FirstResponseMethod {
		name: string;
		endpoint: keyof MockAPI["interactions"];
		deferred: boolean;
		send(ctx: ButtonContext): Promise<unknown>;
	}
	const methods: FirstResponseMethod[] = [
		{ name: "defer", endpoint: "defer", deferred: true, send: (ctx) => ctx.defer() },
		{ name: "showModal", endpoint: "createModal", deferred: false, send: (ctx) => ctx.showModal(modal) },
		{ name: "update", endpoint: "updateMessage", deferred: false, send: (ctx) => ctx.update({}) },
		{ name: "deferUpdate", endpoint: "deferMessageUpdate", deferred: true, send: (ctx) => ctx.deferUpdate() },
	];

	for (const { name, endpoint, deferred, send } of methods) {
		it(`${name} rejects without calling the API once the interaction was acknowledged`, async () => {
			const { ctx, api } = await buttonContext();
			await ctx.reply({ content: "hello" });

			await assert.rejects(send(ctx), {
				message: `Interaction was already acknowledged; ${name}() must be the first response`,
			});
			assert.strictEqual(api.interactions[endpoint].mock.callCount(), 0);
		});

		it(`${name} rolls back the response state when the API call fails`, async () => {
			const { ctx, api } = await buttonContext();
			api.interactions[endpoint].mock.mockImplementationOnce(async () => {
				throw new Error("network");
			});

			await assert.rejects(send(ctx), { message: "network" });
			assert.strictEqual(ctx.replied, false);
			assert.strictEqual(ctx.deferred, false);

			await send(ctx);

			assert.strictEqual(api.interactions[endpoint].mock.callCount(), 2);
			assert.strictEqual(ctx.replied, true);
			assert.strictEqual(ctx.deferred, deferred);
		});
	}
});

describe("reply management", () => {
	it("followUp, editReply, fetchReply and deleteReply go through the interaction webhook", async () => {
		const { ctx, api, interaction } = await commandContext();
		const webhook = [interaction.application_id, interaction.token];
		const followUp = { id: "follow-up" } as APIMessage;
		const edited = { id: "edited" } as APIMessage;
		const original = { id: "original" } as APIMessage;
		api.interactions.followUp.mock.mockImplementationOnce(async () => followUp);
		api.interactions.editReply.mock.mockImplementationOnce(async () => edited);
		api.interactions.getOriginalReply.mock.mockImplementationOnce(async () => original);

		assert.strictEqual(await ctx.followUp({ content: "f" }), followUp);
		assert.strictEqual(await ctx.editReply({ content: "e" }), edited);
		assert.strictEqual(await ctx.fetchReply(), original);
		await ctx.deleteReply();

		assert.deepStrictEqual(api.interactions.followUp.mock.calls[0]!.arguments, [...webhook, { content: "f" }]);
		assert.deepStrictEqual(api.interactions.editReply.mock.calls[0]!.arguments, [...webhook, { content: "e" }]);
		assert.deepStrictEqual(api.interactions.getOriginalReply.mock.calls[0]!.arguments, webhook);
		assert.deepStrictEqual(api.interactions.deleteReply.mock.calls[0]!.arguments, webhook);
	});
});

describe("context bot", () => {
	it("exposes the bot instance on every interaction context and on event contexts", async () => {
		const contexts: { bot: Bot }[] = [];
		const capture = (ctx: { bot: Bot }) => {
			contexts.push(ctx);
		};
		const { bot, interact, dispatch } = createTestBot({
			commands: [
				defineCommand({ data: { name: "test", description: "test" }, handler: capture }),
				defineUserCommand({ data: { name: "Inspect User" }, handler: capture }),
				defineMessageCommand({ data: { name: "Inspect Message" }, handler: capture }),
			],
			interactions: [
				defineButton({ customId: "confirm", handler: capture }),
				defineSelectMenu({ customId: "choose", handler: capture }),
				defineModal({ customId: "feedback", handler: capture }),
				defineAutocomplete({ command: "search", option: "query", handler: capture }),
			],
			events: [defineEvent({ event: GatewayDispatchEvents.MessageCreate, handler: capture })],
		});

		await interact(chatInputInteraction("test"));
		await interact(userCommandInteraction("Inspect User", "777777777777777777"));
		await interact(messageCommandInteraction("Inspect Message", "888888888888888888"));
		await interact(buttonInteraction("confirm"));
		await interact(selectMenuInteraction("choose", ["a"]));
		await interact(modalSubmitInteraction("feedback", []));
		await interact(
			autocompleteInteraction("search", { name: "query", type: ApplicationCommandOptionType.String, value: "x" }),
		);
		await dispatch(GatewayDispatchEvents.MessageCreate, { content: "test" });

		assert.strictEqual(contexts.length, 8);
		for (const ctx of contexts) assert.strictEqual(ctx.bot, bot);
	});
});

function assertDeferReturnTypes(ctx: InteractionContext, withResponse: boolean): void {
	const response: Promise<InteractionCallbackResponse> = ctx.defer({ with_response: true });
	const noResponse: Promise<undefined> = ctx.defer();
	const explicitNoResponse: Promise<undefined> = ctx.defer({ with_response: false });
	const optionalResponse: Promise<InteractionCallbackResponse | undefined> = ctx.defer({
		with_response: withResponse,
	});
	// @ts-expect-error without with_response, defer resolves to undefined rather than the callback response
	const missingResponse: Promise<InteractionCallbackResponse> = ctx.defer();
	// @ts-expect-error with_response: true always resolves to the callback response
	const unexpectedUndefined: Promise<undefined> = ctx.defer({ with_response: true });
	// @ts-expect-error a runtime boolean may resolve to either type
	const narrowedOptional: Promise<InteractionCallbackResponse> = ctx.defer({ with_response: withResponse });

	void [response, noResponse, explicitNoResponse, optionalResponse];
	void [missingResponse, unexpectedUndefined, narrowedOptional];
}

void assertDeferReturnTypes;
