export type { InferOptions, OptionTypeMap, ResolvedUser } from "./types/options.ts";
export type { CommandHooks, GlobalHooks, AnyInteractionContext } from "./types/hooks.ts";
export type { GatewayEventData } from "./types/events.ts";
export type {
	BaseContext,
	InteractionContext,
	CommandContext,
	EventContext,
	ButtonContext,
	SelectMenuContext,
	ModalContext,
	AutocompleteContext,
	UserCommandContext,
	MessageCommandContext,
	AwaitComponentOptions,
	AwaitModalOptions,
	CollectComponentsOptions,
	ComponentCollector,
} from "./types/contexts.ts";
export {
	DefinitionType,
	type CommandDefinition,
	type CommandGroupDefinition,
	type EventDefinition,
	type ButtonDefinition,
	type SelectMenuDefinition,
	type ModalDefinition,
	type AutocompleteDefinition,
	type UserCommandDefinition,
	type MessageCommandDefinition,
	type SubcommandGroup,
	type InteractionDefinition,
	type AnyCommandDefinition,
	type CommandData,
	type CommandGroupData,
	type ContextMenuCommandData,
} from "./types/definitions.ts";
export type { ComponentInteractionContext } from "./types/internal.ts";
export type { ModalFields } from "./modal-fields.ts";

export { defineCommand } from "./definitions/command.ts";
export type { DefineCommandConfig } from "./definitions/command.ts";
export { defineCommandGroup } from "./definitions/command-group.ts";
export { defineEvent } from "./definitions/event.ts";
export { defineButton } from "./definitions/button.ts";
export { defineSelectMenu } from "./definitions/select-menu.ts";
export { defineModal } from "./definitions/modal.ts";
export { defineAutocomplete } from "./definitions/autocomplete.ts";
export type { DefineAutocompleteConfig } from "./definitions/autocomplete.ts";
export { defineUserCommand } from "./definitions/user-command.ts";
export { defineMessageCommand } from "./definitions/message-command.ts";

export { createBot } from "./bot.ts";
export type { CreateBotOptions, Bot } from "./bot.ts";
export { publishCommands } from "./publish.ts";
export type { PublishCommandsOptions } from "./publish.ts";

export { CollectorTimeoutError } from "./collectors/errors.ts";

export {
	isCommand,
	isUserCommand,
	isMessageCommand,
	isButton,
	isSelectMenu,
	isModal,
	isAutocomplete,
} from "./guards.ts";
