import type { APIMessageComponentInteraction } from "discord-api-types/v10";
import type { Bot } from "../bot.ts";
import type { SelectMenuContext } from "../types/contexts.ts";
import { createComponentUpdateMethods, createManagedInteractionContext } from "./interaction.ts";

export function createSelectMenuContext(
	bot: Bot,
	interaction: APIMessageComponentInteraction,
	params: Record<string, string>,
): SelectMenuContext {
	const { context: base, controller } = createManagedInteractionContext(bot, interaction);

	return Object.assign(base, {
		interaction,
		customId: interaction.data.custom_id,
		params,
		values: "values" in interaction.data ? (interaction.data.values ?? []) : [],
		...createComponentUpdateMethods(bot.api, interaction, controller),
	}) as SelectMenuContext;
}
