import type {
	APIApplicationCommandBasicOption,
	GatewayDispatchEvents,
	RESTPostAPIChatInputApplicationCommandsJSONBody,
	RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import type {
	CommandContext,
	EventContext,
	ButtonContext,
	SelectMenuContext,
	ModalContext,
	AutocompleteContext,
	UserCommandContext,
	MessageCommandContext,
} from "./contexts.ts";
import type { CommandHooks } from "./hooks.ts";

export const DefinitionType = {
	Command: 1,
	CommandGroup: 2,
	Event: 3,
	Button: 4,
	SelectMenu: 5,
	Modal: 6,
	Autocomplete: 7,
	UserCommand: 8,
	MessageCommand: 9,
} as const;

export type DefinitionType = (typeof DefinitionType)[keyof typeof DefinitionType];

export type CommandData<
	TOptions extends readonly APIApplicationCommandBasicOption[] = readonly APIApplicationCommandBasicOption[],
> = Omit<RESTPostAPIChatInputApplicationCommandsJSONBody, "type" | "options"> & { options: TOptions };

export type CommandGroupData = Omit<RESTPostAPIChatInputApplicationCommandsJSONBody, "type" | "options">;

export interface CommandDefinition {
	type: typeof DefinitionType.Command;
	data: CommandData;
	hooks?: CommandHooks;
	handler: (ctx: CommandContext) => Promise<void>;
}

export interface CommandGroupDefinition {
	type: typeof DefinitionType.CommandGroup;
	data: CommandGroupData;
	subcommands: (CommandDefinition | SubcommandGroup)[];
}

export interface EventDefinition {
	type: typeof DefinitionType.Event;
	event: GatewayDispatchEvents;
	priority: number;
	handler: (ctx: EventContext) => Promise<void>;
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
	command: string | string[];
	option: string;
	handler: (ctx: AutocompleteContext) => Promise<void>;
}

export type ContextMenuCommandData = Omit<RESTPostAPIContextMenuApplicationCommandsJSONBody, "type">;

export interface UserCommandDefinition {
	type: typeof DefinitionType.UserCommand;
	data: ContextMenuCommandData;
	hooks?: CommandHooks;
	handler: (ctx: UserCommandContext) => Promise<void>;
}

export interface MessageCommandDefinition {
	type: typeof DefinitionType.MessageCommand;
	data: ContextMenuCommandData;
	hooks?: CommandHooks;
	handler: (ctx: MessageCommandContext) => Promise<void>;
}

export interface SubcommandGroup {
	name: string;
	description: string;
	subcommands: CommandDefinition[];
}

export type InteractionDefinition = ButtonDefinition | SelectMenuDefinition | ModalDefinition | AutocompleteDefinition;

export type AnyCommandDefinition =
	| CommandDefinition
	| CommandGroupDefinition
	| UserCommandDefinition
	| MessageCommandDefinition;
