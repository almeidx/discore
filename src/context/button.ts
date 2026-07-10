import type { APIMessageComponentInteraction } from "discord-api-types/v10";
import type { Bot } from "../bot.ts";
import type { ButtonContext } from "../types/contexts.ts";
import { createComponentUpdateMethods, createManagedInteractionContext } from "./interaction.ts";

export function createButtonContext(
	bot: Bot,
	interaction: APIMessageComponentInteraction,
	params: Record<string, string>,
): ButtonContext {
	const { context: base, controller } = createManagedInteractionContext(bot, interaction);

	return Object.assign(base, {
		interaction,
		customId: interaction.data.custom_id,
		params,
		...createComponentUpdateMethods(bot.api, interaction, controller),
	}) as ButtonContext;
}
