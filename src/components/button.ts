import type { APIMessageComponentInteraction } from "discord-api-types/v10";
import type { Bot } from "../bot.ts";
import { DefinitionType } from "../definition-type.ts";
import { createComponentContext, type ComponentContextBase, type CustomIdHandler } from "./context.ts";

/** Context passed to button interaction handlers. Named capture groups from the regex are in {@link params}. */
export interface ButtonContext extends ComponentContextBase {
	interaction: APIMessageComponentInteraction;
}

export interface ButtonDefinition extends CustomIdHandler<ButtonContext> {
	type: typeof DefinitionType.Button;
}

export type DefineButtonConfig = Omit<ButtonDefinition, "type">;

/** Defines a button interaction handler matched by a regex or exact string on `customId`. Named capture groups become `ctx.params`. */
export function defineButton(config: DefineButtonConfig): ButtonDefinition {
	return { ...config, type: DefinitionType.Button };
}

export function createButtonContext(
	bot: Bot,
	interaction: APIMessageComponentInteraction,
	params: Record<string, string>,
): ButtonContext {
	return createComponentContext(bot, interaction, params) as ButtonContext;
}
