import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
	ApplicationCommandOptionType,
	type APIApplicationCommandAutocompleteInteraction,
	type APIApplicationCommandInteractionDataStringOption,
	type APIApplicationCommandInteractionDataSubcommandOption,
	type InteractionType,
} from "discord-api-types/v10";
import { defineAutocomplete, type AutocompleteContext, type AutocompleteDefinition } from "../../src/index.ts";
import { autocompleteInteraction } from "../fixtures/interactions.ts";
import { createTestBot } from "../fixtures/test-bot.ts";

type AutocompleteOptions = APIApplicationCommandAutocompleteInteraction["data"]["options"];

type SubcommandOption =
	APIApplicationCommandInteractionDataSubcommandOption<InteractionType.ApplicationCommandAutocomplete>;

const focusedQuery: APIApplicationCommandInteractionDataStringOption = {
	name: "query",
	value: "ab",
	type: ApplicationCommandOptionType.String,
	focused: true,
};

function autocomplete(command: string, options: AutocompleteOptions): APIApplicationCommandAutocompleteInteraction {
	const interaction = autocompleteInteraction(command, focusedQuery);
	interaction.data.options = options;
	return interaction;
}

/** Builds an autocomplete interaction focused on `query`, nested under the given subcommand path. */
function autocompleteAt(
	command: string,
	group?: string,
	subcommand?: string,
): APIApplicationCommandAutocompleteInteraction {
	if (!subcommand) return autocomplete(command, [focusedQuery]);
	const sub: SubcommandOption = {
		name: subcommand,
		type: ApplicationCommandOptionType.Subcommand,
		options: [focusedQuery],
	};
	if (!group) return autocomplete(command, [sub]);
	return autocomplete(command, [{ name: group, type: ApplicationCommandOptionType.SubcommandGroup, options: [sub] }]);
}

function throwingHandler(error: Error) {
	return () => {
		throw error;
	};
}

describe("autocomplete", () => {
	it("exposes the focused option and sibling options, and responds with choices", async () => {
		let received: AutocompleteContext | undefined;
		const { api, interact } = createTestBot({
			interactions: [
				defineAutocomplete({
					command: "search",
					option: "query",
					handler: async (ctx) => {
						received = ctx;
						await ctx.respond([{ name: "abc", value: "abc" }]);
					},
				}),
			],
		});
		const interaction = autocomplete("search", [
			{ name: "category", type: ApplicationCommandOptionType.String, value: "books" },
			focusedQuery,
		]);

		await interact(interaction);

		assert.ok(received);
		assert.strictEqual(received.interaction, interaction);
		assert.deepStrictEqual(received.focused, { name: "query", value: "ab" });
		assert.deepStrictEqual({ ...received.options }, { category: "books", query: "ab" });
		assert.strictEqual(received.subcommand, undefined);
		assert.strictEqual(received.subcommandGroup, undefined);
		assert.deepStrictEqual(api.interactions.createAutocompleteResponse.mock.calls[0]?.arguments, [
			interaction.id,
			interaction.token,
			{ choices: [{ name: "abc", value: "abc" }] },
		]);
		assert.strictEqual(api.interactions.createAutocompleteResponse.mock.callCount(), 1);
	});

	it("exposes the subcommand group and subcommand of the focused option", async () => {
		let received: AutocompleteContext | undefined;
		const { interact } = createTestBot({
			interactions: [
				defineAutocomplete({
					command: "search",
					option: "query",
					handler: (ctx) => {
						received = ctx;
					},
				}),
			],
		});

		await interact(autocompleteAt("search", "admin", "users"));

		assert.ok(received);
		assert.strictEqual(received.subcommandGroup, "admin");
		assert.strictEqual(received.subcommand, "users");
		assert.deepStrictEqual(received.focused, { name: "query", value: "ab" });
		assert.deepStrictEqual({ ...received.options }, { query: "ab" });
	});

	describe("matching", () => {
		const cases: Array<{
			command: AutocompleteDefinition["command"];
			option?: string;
			path: [command: string, group?: string, subcommand?: string];
			matches: boolean;
		}> = [
			{ command: "search", path: ["search"], matches: true },
			{ command: "search", path: ["search", undefined, "users"], matches: true },
			{ command: "search", path: ["search", "admin", "users"], matches: true },
			{ command: "search", path: ["other"], matches: false },
			{ command: "search", option: "tag", path: ["search"], matches: false },
			{ command: ["search", "users"], path: ["search", undefined, "users"], matches: true },
			{ command: ["search", "users"], path: ["search", undefined, "posts"], matches: false },
			{ command: ["search", "users"], path: ["search"], matches: false },
			{ command: ["search", "users"], path: ["other", undefined, "users"], matches: false },
			{ command: ["search", "admin", "users"], path: ["search", "admin", "users"], matches: true },
			{ command: ["search", "admin", "users"], path: ["search", "guest", "users"], matches: false },
			{ command: ["search", "admin", "users"], path: ["search", "admin", "posts"], matches: false },
			{ command: ["search", "admin", "users"], path: ["search", undefined, "users"], matches: false },
		];

		for (const { command, option = "query", path, matches } of cases) {
			const target = path.filter((part) => part !== undefined).join(" ");
			it(`${JSON.stringify(command)} on option "${option}" ${matches ? "matches" : "does not match"} ${target}`, async () => {
				const handler = mock.fn();
				const beforeInteraction = mock.fn();
				const afterInteraction = mock.fn();
				const { interact } = createTestBot({
					hooks: { beforeInteraction, afterInteraction },
					interactions: [defineAutocomplete({ command, option, handler })],
				});

				await interact(autocompleteAt(...path));

				const expected = matches ? 1 : 0;
				assert.strictEqual(handler.mock.callCount(), expected);
				assert.strictEqual(beforeInteraction.mock.callCount(), expected);
				assert.strictEqual(afterInteraction.mock.callCount(), expected);
			});
		}

		it("runs only the first matching definition", async () => {
			const first = mock.fn();
			const second = mock.fn();
			const { interact } = createTestBot({
				interactions: [
					defineAutocomplete({ command: "search", option: "query", handler: first }),
					defineAutocomplete({ command: ["search", "users"], option: "query", handler: second }),
				],
			});

			await interact(autocompleteAt("search", undefined, "users"));

			assert.strictEqual(first.mock.callCount(), 1);
			assert.strictEqual(second.mock.callCount(), 0);
		});
	});

	describe("errors", () => {
		it("runs definition then global onError, responds with no choices, and rethrows", async () => {
			const error = new Error("boom");
			const order: string[] = [];
			const { api, interact } = createTestBot({
				hooks: {
					onError: (_ctx, cause) => {
						order.push("global");
						assert.strictEqual(cause, error);
					},
				},
				interactions: [
					defineAutocomplete({
						command: "search",
						option: "query",
						hooks: {
							onError: (_ctx, cause) => {
								order.push("definition");
								assert.strictEqual(cause, error);
							},
						},
						handler: throwingHandler(error),
					}),
				],
			});
			const interaction = autocompleteAt("search");

			await assert.rejects(interact(interaction), (thrown) => thrown === error);

			assert.deepStrictEqual(order, ["definition", "global"]);
			assert.deepStrictEqual(api.interactions.createAutocompleteResponse.mock.calls[0]?.arguments, [
				interaction.id,
				interaction.token,
				{ choices: [] },
			]);
			assert.strictEqual(api.interactions.createAutocompleteResponse.mock.callCount(), 1);
		});

		it("skips the empty response when the handler already responded", async () => {
			const error = new Error("boom");
			const { api, interact } = createTestBot({
				interactions: [
					defineAutocomplete({
						command: "search",
						option: "query",
						handler: async (ctx) => {
							await ctx.respond([{ name: "abc", value: "abc" }]);
							throw error;
						},
					}),
				],
			});

			await assert.rejects(interact(autocompleteAt("search")), (thrown) => thrown === error);

			assert.strictEqual(api.interactions.createAutocompleteResponse.mock.callCount(), 1);
			assert.deepStrictEqual(api.interactions.createAutocompleteResponse.mock.calls[0]!.arguments[2], {
				choices: [{ name: "abc", value: "abc" }],
			});
		});

		it("rethrows the handler error when the empty response fails", async () => {
			const error = new Error("boom");
			const { api, interact } = createTestBot({
				interactions: [defineAutocomplete({ command: "search", option: "query", handler: throwingHandler(error) })],
			});
			api.interactions.createAutocompleteResponse.mock.mockImplementation(async () => {
				throw new Error("response failed");
			});

			await assert.rejects(interact(autocompleteAt("search")), (thrown) => thrown === error);
			assert.strictEqual(api.interactions.createAutocompleteResponse.mock.callCount(), 1);
		});

		it("suppresses the global hook, response, and rethrow when the definition onError returns false", async () => {
			const globalOnError = mock.fn();
			const { api, interact } = createTestBot({
				hooks: { onError: globalOnError },
				interactions: [
					defineAutocomplete({
						command: "search",
						option: "query",
						hooks: { onError: () => false },
						handler: throwingHandler(new Error("boom")),
					}),
				],
			});

			await interact(autocompleteAt("search"));

			assert.strictEqual(globalOnError.mock.callCount(), 0);
			assert.strictEqual(api.interactions.createAutocompleteResponse.mock.callCount(), 0);
		});

		it("suppresses the response and rethrow when the global onError returns false", async () => {
			const globalOnError = mock.fn(() => false);
			const { api, interact } = createTestBot({
				hooks: { onError: globalOnError },
				interactions: [
					defineAutocomplete({ command: "search", option: "query", handler: throwingHandler(new Error("boom")) }),
				],
			});

			await interact(autocompleteAt("search"));

			assert.strictEqual(globalOnError.mock.callCount(), 1);
			assert.strictEqual(api.interactions.createAutocompleteResponse.mock.callCount(), 0);
		});
	});
});
