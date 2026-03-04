export type { InferOptions, OptionTypeMap } from "./types/options.ts";
export type { CommandHooks, GlobalHooks } from "./types/hooks.ts";
export type {
	BaseContext,
	InteractionContext,
	CommandContext,
	EventContext,
	ButtonContext,
	SelectMenuContext,
	ModalContext,
	AutocompleteContext,
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
	type InteractionDefinition,
	type AnyCommandDefinition,
	type CommandData,
	type CommandGroupData,
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

export { createBot } from "./bot.ts";
export type { CreateBotOptions, Bot } from "./bot.ts";
export { publishCommands } from "./publish.ts";
export type { PublishCommandsOptions } from "./publish.ts";

export { CollectorTimeoutError } from "./collectors/errors.ts";
