import { InteractionType, ApplicationCommandType, ComponentType } from "discord-api-types/v10";
import type { APIMessageComponentInteraction } from "discord-api-types/v10";
import type {
	CommandContext,
	ButtonContext,
	SelectMenuContext,
	ModalContext,
	AutocompleteContext,
	UserCommandContext,
	MessageCommandContext,
} from "./types/contexts.ts";
import type { AnyInteractionContext } from "./types/hooks.ts";

export function isCommand(ctx: AnyInteractionContext): ctx is CommandContext {
	return (
		ctx.interaction.type === InteractionType.ApplicationCommand &&
		ctx.interaction.data.type === ApplicationCommandType.ChatInput
	);
}

export function isUserCommand(ctx: AnyInteractionContext): ctx is UserCommandContext {
	return (
		ctx.interaction.type === InteractionType.ApplicationCommand &&
		ctx.interaction.data.type === ApplicationCommandType.User
	);
}

export function isMessageCommand(ctx: AnyInteractionContext): ctx is MessageCommandContext {
	return (
		ctx.interaction.type === InteractionType.ApplicationCommand &&
		ctx.interaction.data.type === ApplicationCommandType.Message
	);
}

export function isButton(ctx: AnyInteractionContext): ctx is ButtonContext {
	return (
		ctx.interaction.type === InteractionType.MessageComponent &&
		(ctx.interaction as APIMessageComponentInteraction).data.component_type === ComponentType.Button
	);
}

export function isSelectMenu(ctx: AnyInteractionContext): ctx is SelectMenuContext {
	return (
		ctx.interaction.type === InteractionType.MessageComponent &&
		(ctx.interaction as APIMessageComponentInteraction).data.component_type !== ComponentType.Button
	);
}

export function isModal(ctx: AnyInteractionContext): ctx is ModalContext {
	return ctx.interaction.type === InteractionType.ModalSubmit;
}

export function isAutocomplete(ctx: AnyInteractionContext): ctx is AutocompleteContext {
	return ctx.interaction.type === InteractionType.ApplicationCommandAutocomplete;
}
