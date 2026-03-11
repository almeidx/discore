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
import type { CommandHooks, HandlerHooks } from "./hooks.ts";

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
	requiredBotPermissions?: bigint;
	hooks?: CommandHooks;
	handler: (ctx: CommandContext) => void | Promise<void>;
}

export interface CommandGroupDefinition {
	type: typeof DefinitionType.CommandGroup;
	data: CommandGroupData;
	requiredBotPermissions?: bigint;
	hooks?: CommandHooks;
	subcommands: (CommandDefinition | SubcommandGroup)[];
}

export interface EventDefinition {
	type: typeof DefinitionType.Event;
	event: GatewayDispatchEvents;
	priority: number;
	once?: boolean;
	handler: (ctx: EventContext) => void | Promise<void>;
}

export interface ButtonDefinition {
	type: typeof DefinitionType.Button;
	customId: string | RegExp;
	hooks?: HandlerHooks<ButtonContext>;
	handler: (ctx: ButtonContext) => void | Promise<void>;
}

export interface SelectMenuDefinition {
	type: typeof DefinitionType.SelectMenu;
	customId: string | RegExp;
	hooks?: HandlerHooks<SelectMenuContext>;
	handler: (ctx: SelectMenuContext) => void | Promise<void>;
}

export interface ModalDefinition {
	type: typeof DefinitionType.Modal;
	customId: string | RegExp;
	hooks?: HandlerHooks<ModalContext>;
	handler: (ctx: ModalContext) => void | Promise<void>;
}

export interface AutocompleteDefinition {
	type: typeof DefinitionType.Autocomplete;
	command: string | string[];
	option: string;
	handler: (ctx: AutocompleteContext) => void | Promise<void>;
}

export type ContextMenuCommandData = Omit<RESTPostAPIContextMenuApplicationCommandsJSONBody, "type">;

export interface UserCommandDefinition {
	type: typeof DefinitionType.UserCommand;
	data: ContextMenuCommandData;
	requiredBotPermissions?: bigint;
	hooks?: CommandHooks;
	handler: (ctx: UserCommandContext) => void | Promise<void>;
}

export interface MessageCommandDefinition {
	type: typeof DefinitionType.MessageCommand;
	data: ContextMenuCommandData;
	requiredBotPermissions?: bigint;
	hooks?: CommandHooks;
	handler: (ctx: MessageCommandContext) => void | Promise<void>;
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
