import type { APIMessageComponentInteraction } from "discord-api-types/v10";
import type { Bot } from "../bot.ts";
import { DefinitionType } from "../definition-type.ts";
import { createComponentContext, type ComponentContextBase, type CustomIdHandler } from "./context.ts";

/** Context passed to select menu interaction handlers. Selected values are in {@link values}. */
export interface SelectMenuContext extends ComponentContextBase {
	interaction: APIMessageComponentInteraction;
	values: string[];
}

export interface SelectMenuDefinition extends CustomIdHandler<SelectMenuContext> {
	type: typeof DefinitionType.SelectMenu;
}

export type DefineSelectMenuConfig = Omit<SelectMenuDefinition, "type">;

/** Defines a select menu handler matched by a regex or exact string on `customId`. Selected values are in `ctx.values`. */
export function defineSelectMenu(config: DefineSelectMenuConfig): SelectMenuDefinition {
	return { ...config, type: DefinitionType.SelectMenu };
}

export function createSelectMenuContext(
	bot: Bot,
	interaction: APIMessageComponentInteraction,
	params: Record<string, string>,
): SelectMenuContext {
	return Object.assign(createComponentContext(bot, interaction, params), {
		values: "values" in interaction.data ? (interaction.data.values ?? []) : [],
	}) as SelectMenuContext;
}
