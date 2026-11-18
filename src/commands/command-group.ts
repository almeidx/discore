import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	type APIApplicationCommandSubcommandOption,
	type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import { DefinitionType } from "../definition-type.ts";
import type { CommandHooks } from "../hooks.ts";
import type { CommandDefinition } from "./chat-input.ts";
import type { CommandBase } from "./command-base.ts";

export type CommandGroupData = Omit<RESTPostAPIChatInputApplicationCommandsJSONBody, "type" | "options">;

export interface SubcommandGroup {
	name: string;
	description: string;
	subcommands: CommandDefinition[];
}

export interface CommandGroupDefinition extends CommandBase {
	type: typeof DefinitionType.CommandGroup;
	data: CommandGroupData;
	/** Hooks that apply to all subcommands in this group, between global and subcommand hooks. */
	hooks?: CommandHooks;
	subcommands: (CommandDefinition | SubcommandGroup)[];
}

export type DefineCommandGroupConfig = Omit<CommandGroupDefinition, "type">;

export function defineCommandGroup(config: DefineCommandGroupConfig): CommandGroupDefinition {
	return { ...config, type: DefinitionType.CommandGroup };
}

function isSubcommandGroup(entry: CommandDefinition | SubcommandGroup): entry is SubcommandGroup {
	return !("type" in entry);
}

export function findSubcommand(
	group: CommandGroupDefinition,
	subcommandGroup: string | undefined,
	subcommand: string | undefined,
): CommandDefinition | undefined {
	const entries = subcommandGroup
		? group.subcommands.find(
				(entry): entry is SubcommandGroup => isSubcommandGroup(entry) && entry.name === subcommandGroup,
			)?.subcommands
		: group.subcommands;
	return entries?.find(
		(entry): entry is CommandDefinition => !isSubcommandGroup(entry) && entry.data.name === subcommand,
	);
}

function toSubcommandOption(cmd: CommandDefinition): APIApplicationCommandSubcommandOption {
	return {
		name: cmd.data.name,
		description: cmd.data.description,
		type: ApplicationCommandOptionType.Subcommand,
		options: [...cmd.data.options],
	};
}

export function commandGroupToPayload(group: CommandGroupDefinition): RESTPostAPIChatInputApplicationCommandsJSONBody {
	return {
		...group.data,
		type: ApplicationCommandType.ChatInput,
		options: group.subcommands.map((entry) =>
			isSubcommandGroup(entry)
				? {
						name: entry.name,
						description: entry.description,
						type: ApplicationCommandOptionType.SubcommandGroup,
						options: entry.subcommands.map(toSubcommandOption),
					}
				: toSubcommandOption(entry),
		),
	};
}
