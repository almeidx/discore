import type { APIApplicationCommandAutocompleteInteraction } from "discord-api-types/v10";
import type { Bot } from "../bot.ts";
import type { GlobalHooks } from "../hooks.ts";
import { runInteraction } from "../interaction/pipeline.ts";
import { removeItem } from "../remove-item.ts";
import { createAutocompleteContext, matchesAutocomplete, type AutocompleteDefinition } from "./autocomplete.ts";

export interface AutocompleteRouter {
	add(def: AutocompleteDefinition): void;
	remove(def: AutocompleteDefinition): boolean;
	handle(interaction: APIApplicationCommandAutocompleteInteraction): Promise<void>;
}

export function createAutocompleteRouter(config: { bot: Bot; hooks: GlobalHooks }): AutocompleteRouter {
	const { bot, hooks } = config;
	const definitions: AutocompleteDefinition[] = [];

	return {
		add(def) {
			definitions.push(def);
		},

		remove(def) {
			return removeItem(definitions, def);
		},

		async handle(interaction) {
			const { context: ctx, hasResponded } = createAutocompleteContext(bot, interaction);
			const def = definitions.find((candidate) => matchesAutocomplete(candidate, ctx));
			if (!def) return;

			await runInteraction(
				ctx,
				hooks,
				[def.hooks],
				() => def.handler(ctx),
				async () => {
					if (!hasResponded()) await ctx.respond([]);
				},
			);
		},
	};
}
