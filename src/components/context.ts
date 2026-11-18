import type { CreateInteractionUpdateMessageResponseOptions } from "@discordjs/core";
import type { APIMessageComponentInteraction, APIModalSubmitInteraction } from "discord-api-types/v10";
import type { Bot } from "../bot.ts";
import type { HandlerHooks } from "../hooks.ts";
import { createInteractionContext, type InteractionContext } from "../interaction/context.ts";
import type { ButtonContext } from "./button.ts";
import type { SelectMenuContext } from "./select-menu.ts";

/** Members shared by button, select menu, and modal contexts. */
export interface ComponentContextBase extends InteractionContext {
	customId: string;
	/** Named capture groups from the matched `customId` pattern. */
	params: Record<string, string>;
	update(data: CreateInteractionUpdateMessageResponseOptions): Promise<void>;
	deferUpdate(): Promise<void>;
}

/** A handler matched against an interaction's `customId` by exact string or regex. */
export interface CustomIdHandler<TContext> {
	customId: string | RegExp;
	hooks?: HandlerHooks<TContext>;
	handler: (ctx: TContext) => void | Promise<void>;
}

export type ComponentInteractionContext = ButtonContext | SelectMenuContext;

export function createComponentContext(
	bot: Bot,
	interaction: APIMessageComponentInteraction | APIModalSubmitInteraction,
	params: Record<string, string>,
): ComponentContextBase {
	const { api } = bot;
	const { context, acknowledge } = createInteractionContext(bot, interaction);

	return Object.assign(context, {
		customId: interaction.data.custom_id,
		params,

		async update(data: CreateInteractionUpdateMessageResponseOptions): Promise<void> {
			await acknowledge("update", false, () => api.interactions.updateMessage(interaction.id, interaction.token, data));
		},

		async deferUpdate(): Promise<void> {
			await acknowledge("deferUpdate", true, () =>
				api.interactions.deferMessageUpdate(interaction.id, interaction.token),
			);
		},
	});
}
