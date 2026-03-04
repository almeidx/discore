import type {
	APIApplicationCommandBasicOption,
	RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import type {
	CommandContext,
	EventContext,
	ButtonContext,
	SelectMenuContext,
	ModalContext,
	AutocompleteContext,
} from "./contexts.ts";
import type { CommandHooks } from "./hooks.ts";
import type { InferOptions } from "./options.ts";

export const DefinitionType = {
	Command: 1,
	CommandGroup: 2,
	Event: 3,
	Button: 4,
	SelectMenu: 5,
	Modal: 6,
	Autocomplete: 7,
} as const;

export type DefinitionType = (typeof DefinitionType)[keyof typeof DefinitionType];

export type CommandData<
	TOptions extends readonly APIApplicationCommandBasicOption[] = readonly APIApplicationCommandBasicOption[],
> = Omit<RESTPostAPIChatInputApplicationCommandsJSONBody, "type" | "options"> & { options: TOptions };

export type CommandGroupData = Omit<RESTPostAPIChatInputApplicationCommandsJSONBody, "type" | "options">;

export interface CommandDefinition<
	TOptions extends readonly APIApplicationCommandBasicOption[] = readonly APIApplicationCommandBasicOption[],
> {
	type: typeof DefinitionType.Command;
	data: CommandData<TOptions>;
	hooks?: CommandHooks;
	handler: (ctx: CommandContext<InferOptions<TOptions>>) => Promise<void>;
}

export interface CommandGroupDefinition {
	type: typeof DefinitionType.CommandGroup;
	data: CommandGroupData;
	subcommands: CommandDefinition[];
}

export interface EventDefinition<TEvent = unknown> {
	type: typeof DefinitionType.Event;
	event: string;
	priority: number;
	handler: (ctx: EventContext<TEvent>) => Promise<void>;
}

export interface ButtonDefinition {
	type: typeof DefinitionType.Button;
	customId: RegExp;
	handler: (ctx: ButtonContext) => Promise<void>;
}

export interface SelectMenuDefinition {
	type: typeof DefinitionType.SelectMenu;
	customId: RegExp;
	handler: (ctx: SelectMenuContext) => Promise<void>;
}

export interface ModalDefinition {
	type: typeof DefinitionType.Modal;
	customId: RegExp;
	handler: (ctx: ModalContext) => Promise<void>;
}

export interface AutocompleteDefinition {
	type: typeof DefinitionType.Autocomplete;
	command: string;
	option: string;
	handler: (ctx: AutocompleteContext) => Promise<void>;
}

export type InteractionDefinition = ButtonDefinition | SelectMenuDefinition | ModalDefinition | AutocompleteDefinition;

export type AnyCommandDefinition = CommandDefinition | CommandGroupDefinition;
