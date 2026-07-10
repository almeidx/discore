import type { APIModalSubmitInteraction } from "discord-api-types/v10";
import type { Bot } from "../bot.ts";
import { createModalFields } from "../modal-fields.ts";
import type { ModalContext } from "../types/contexts.ts";
import { createComponentUpdateMethods, createManagedInteractionContext } from "./interaction.ts";

export function createModalContext(
	bot: Bot,
	interaction: APIModalSubmitInteraction,
	params: Record<string, string>,
): ModalContext {
	const { context: base, controller } = createManagedInteractionContext(bot, interaction);

	return Object.assign(base, {
		interaction,
		customId: interaction.data.custom_id,
		params,
		fields: createModalFields(interaction),
		...createComponentUpdateMethods(bot.api, interaction, controller),
	}) as ModalContext;
}
