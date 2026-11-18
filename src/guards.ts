import { InteractionType, ApplicationCommandType, ComponentType } from "discord-api-types/v10";
import type { AutocompleteContext } from "./autocomplete/autocomplete.ts";
import type { CommandContext } from "./commands/chat-input.ts";
import type { MessageCommandContext, UserCommandContext } from "./commands/context-menu.ts";
import type { ButtonContext } from "./components/button.ts";
import type { ModalContext } from "./components/modal.ts";
import type { SelectMenuContext } from "./components/select-menu.ts";
import type { AnyInteractionContext } from "./hooks.ts";

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
		ctx.interaction.data.component_type === ComponentType.Button
	);
}

export function isSelectMenu(ctx: AnyInteractionContext): ctx is SelectMenuContext {
	return (
		ctx.interaction.type === InteractionType.MessageComponent &&
		ctx.interaction.data.component_type !== ComponentType.Button
	);
}

export function isModal(ctx: AnyInteractionContext): ctx is ModalContext {
	return ctx.interaction.type === InteractionType.ModalSubmit;
}

export function isAutocomplete(ctx: AnyInteractionContext): ctx is AutocompleteContext {
	return ctx.interaction.type === InteractionType.ApplicationCommandAutocomplete;
}
