import type { APIModalSubmitInteraction } from "discord-api-types/v10";
import type { Bot } from "../bot.ts";
import { DefinitionType } from "../definition-type.ts";
import { createComponentContext, type ComponentContextBase, type CustomIdHandler } from "./context.ts";
import { createModalFields, type ModalFields } from "./modal-fields.ts";

/** Context passed to modal submission handlers. Access submitted values via {@link fields}. */
export interface ModalContext extends ComponentContextBase {
	interaction: APIModalSubmitInteraction;
	fields: ModalFields;
}

export interface ModalDefinition extends CustomIdHandler<ModalContext> {
	type: typeof DefinitionType.Modal;
}

export type DefineModalConfig = Omit<ModalDefinition, "type">;

/** Defines a modal submission handler matched by a regex or exact string on `customId`. Access field values via `ctx.fields`. */
export function defineModal(config: DefineModalConfig): ModalDefinition {
	return { ...config, type: DefinitionType.Modal };
}

export function createModalContext(
	bot: Bot,
	interaction: APIModalSubmitInteraction,
	params: Record<string, string>,
): ModalContext {
	return Object.assign(createComponentContext(bot, interaction, params), {
		fields: createModalFields(interaction),
	}) as ModalContext;
}
